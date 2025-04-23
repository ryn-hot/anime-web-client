// subtitle.js

import JASSUB from 'jassub';
import workerUrl from 'jassub/dist/jassub-worker.js';
import wasmUrl   from 'jassub/dist/jassub-worker.wasm';
import robotoURL from "../frontend/assets/fonts/Roboto-Medium.ttf";

import { toTS, subRx } from './util.js'; // Assuming util.js is in the same directory

// Helper for logging
const log = (message, ...args) => {
    console.debug(`[SubtitleManager] ${message}`, ...args);
};

// Placeholder for getting settings from your app's settings module
const getSetting = (key, defaultValue) => {
    // Replace with your actual settings logic
    const settings = {
        font: { name: 'Roboto Medium', url: robotoURL}, // Example default font setting
        subtitleRenderHeight: '0', // Example: '720' for Android, '0' for desktop default
        subtitleLanguage: 'eng', // Example default language
        missingFont: true,
        disableSubtitleBlur: false,
    };
    return settings[key] !== undefined ? settings[key] : defaultValue;
};

// Default ASS header (customize as needed, especially Fontname/Fontsize)
const defaultFontName = getSetting('font', { name: 'Roboto Medium' }).name.toLowerCase();
const defaultHeader = `[Script Info]
Title: Default Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: None

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${defaultFontName},52,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2.6,0,2,20,20,46,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

const stylesRx = /^Style:[^,]*/gm; // From Miru code

export default class SubtitleManager {
    /**
     * @param {HTMLVideoElement} videoElement - The video element to attach subtitles to.
     * @param {Function} onTrackListUpdate - Callback function when track list changes `(tracks) => {}`.
     */
    constructor(videoElement, onTrackListUpdate) {
        if (!videoElement) {
            throw new Error("Video element must be provided to SubtitleManager");
        }
        this.video = videoElement;
        this.onTrackListUpdate = onTrackListUpdate || (() => {}); // Callback to update UI

        this.renderer = null;
        this.isDestroyed = false;

        this.headers = []; // Stores track header info { number, language, name, header, type, codec }
        this.tracks = []; // Stores array of parsed subtitle cues for each track number []
        this._tracksString = []; // Stores stringified cues to prevent duplicates [Set()]
        this._stylesMap = []; // Maps style names to indices for ASS conversion { [styleName]: index }

        // Assuming a default font is served from the root, adjust as necessary
        this.fonts = [robotoURL];

        this.currentTrack = -1; // -1 means subtitles off

        this.ipcCleanupFunctions = [];

        // --- Setup Listeners ---
        this.setupIPCListeners(); // Placeholder for WebSocket or other communication
        this.pendingCues = {};  
    }

    /**
     * Placeholder: Replace with your actual WebSocket/SSE/etc. listener setup
     */
   
    setupIPCListeners() {
        if (window.electronIPC && typeof window.electronIPC.receive === 'function') {
            log("Setting up IPC listeners...");
            // Store the cleanup function returned by receive
            this.ipcCleanupFunctions.push(
                window.electronIPC.receive('subtitle-tracks', this.handleIPCMessage)
            );
            this.ipcCleanupFunctions.push(
                window.electronIPC.receive('subtitle-cue', this.handleIPCMessage)
            );
            this.ipcCleanupFunctions.push(
                window.electronIPC.receive('subtitle-font', this.handleIPCMessage)
            );
        } else {
            console.error("Error: window.electronIPC.receive is not available. Check preload script.");
        }
    }

    handleIPCMessage = (channel, data) => {
        if (this.isDestroyed) return;

        if (data) {
            console.log(`Received IPC message on channel '${channel}' for current file`); // Can be verbose
            switch (channel) {
                case 'subtitle-tracks':
                    this.handleTracks(data.tracks);
                    break;
                case 'subtitle-cue':
                    this.handleSubtitleCue(data); // data = { trackNumber, subtitle }
                    break;
                case 'subtitle-font':
                    this.handleFontInfo(data); // data = { fontId, fontUrl }
                    break;
            }
        } else {
             console.log(`Ignoring IPC message on ${channel}`);
        }
    }

    handleFontInfo = ({ fontUrl }) => {
        if (this.isDestroyed || !fontUrl) return;
        log(`Received font info, URL: ${fontUrl}`);
        if (!this.fonts.includes(fontUrl)) {
            this.fonts.push(fontUrl);
            this.initRenderer();
            log(`Font URL ${fontUrl} added to list for JASSUB.`);
            // this.renderer?.addFont(fontUrl); // Usually not needed, JASSUB fetches on demand
        }
    }


    /**
     * Processes the list of tracks received from the backend parser.
     * @param {Array<object>} tracksData - Array of track objects from the parser.
     */
    handleTracks = (tracksData) => {
        if (this.isDestroyed) return;
        console.log(`Processing ${tracksData.length} tracks`);

        let trackListChanged = true;
        for (const track of tracksData) {
            console.log(`track type: ${track.type}`);
            //console.log(track);
    
            const trackNumber = track.number;
            if (!this.tracks[trackNumber]) {
                const isASS = track.type === 'ass';
                const header = isASS ? (track.header || defaultHeader) : defaultHeader; // Use parsed header for ASS, default otherwise

                this.tracks[trackNumber] = []; // Initialize cue array
                this._tracksString[trackNumber] = new Set(); // Initialize duplicate check set
                this.headers[trackNumber] = { // Store header info
                    number: trackNumber,
                    language: track.language || 'und',
                    header: header,
                    type: isASS ? 'ass' : (track.type || 'unknown').toLowerCase(), // Store original type
                };

                // Create style map for ASS conversion
                this._stylesMap[trackNumber] = { Default: 0 }; // Default style index
                const styleMatches = header.match(stylesRx);
                if (styleMatches) {
                    for (let i = 0; i < styleMatches.length; ++i) {
                        const style = styleMatches[i].replace('Style:', '').trim();
                        this._stylesMap[trackNumber][style] = i + 1;
                    }
                }
                trackListChanged = true;
                console.log(`Added track ${trackNumber}: Lang=${this.headers[trackNumber].language}, Type=${this.headers[trackNumber].type}`);

            }
        }

        if (trackListChanged) {
            this.initRenderer(); // Ensure renderer is ready
            this.onTrackListUpdate(this.getTrackList()); // Notify UI

            // Auto-select initial track (optional, based on Miru's behavior)
            if (this.currentTrack === -1) { // Only if no track is selected yet
                const tracks = this.getTrackList();
                if (tracks?.length) {
                    const preferredLang = getSetting('subtitleLanguage', 'eng');
                    let trackToSelect = tracks.find(({ language }) => language === preferredLang);
                    if (!trackToSelect) {
                        trackToSelect = tracks.find(({ language }) => language === 'eng' || language === 'und');
                    }
                    if (!trackToSelect) {
                         trackToSelect = tracks[0]; // Fallback to the first track
                    }
                    if (trackToSelect) {
                         this.selectTrack(trackToSelect.number);
                    }

                    if (this.pendingCues[trackToSelect.number]) {
                        this.pendingCues[trackToSelect.number].forEach(cue =>
                            this._addCue(trackToSelect.number, cue)
                        );
                        delete this.pendingCues[trackToSelect.number];
                    }
                }
            }
        }
    }

    /**
     * Processes a single subtitle cue received from the backend.
     * @param {{trackNumber: number, subtitle: object}} data
     */
    handleSubtitleCue = ({ trackNumber, subtitle }) => {
        /* if (trackNumber === 3) {
            console.log(subtitle)
        } */

        if (this.isDestroyed) return;

        if (!this.tracks[trackNumber]) {
            (this.pendingCues[trackNumber] ??= []).push(subtitle);
            return;
        }

        const stringifiedCue = JSON.stringify(subtitle); // For duplicate check
        if (this._tracksString[trackNumber].has(stringifiedCue)) {
            return; // Skip duplicate
        }
        this._tracksString[trackNumber].add(stringifiedCue);

        const isASS = this.headers[trackNumber]?.type === 'ass';
        const assCue = this.constructSub(subtitle, !isASS, this.tracks[trackNumber].length, trackNumber); // Convert if needed
        this.tracks[trackNumber].push(assCue);

        // If this is the currently active track, send the event to JASSUB
        if (this.currentTrack === trackNumber && this.renderer) {
            this.renderer.createEvent(assCue);
        }
    }

    _addCue(trackNumber, subtitle) {
        console.log(`Adding sub from pending cue. Track Number: ${trackNumber}, Subtitle: ${subtitle}`);
        const isASS  = this.headers[trackNumber]?.type === 'ass';
        const assCue = this.constructSub(
            subtitle, !isASS,
                this.tracks[trackNumber].length + 1,   // keep unique _index
                trackNumber
            );

        this.tracks[trackNumber].push(assCue);
        if (this.currentTrack === trackNumber && this.renderer) {
            this.renderer.createEvent(assCue);
        }
    }
    /**
     * Processes font data received from the backend.
     * @param {Uint8Array | ArrayBuffer} fontData - The font file data.
     */
    handleFontData = (fontData) => {
        if (this.isDestroyed || !fontData) return;
        log("Adding embedded font to JASSUB");
        // JASSUB needs the font URL or the font buffer itself.
        // Assuming fontData is ArrayBuffer/Uint8Array
        const fontBuffer = fontData instanceof Uint8Array ? fontData.buffer : fontData;
        const fontUrl = URL.createObjectURL(new Blob([fontBuffer])); // Create temporary URL
        this.fonts.push(fontUrl); // Keep track for cleanup maybe?
        this.initRenderer(); // Ensure renderer exists
        this.renderer?.addFont(fontUrl); // Add font to JASSUB
    }

  
    /**
     * Adds an external subtitle file (from drag/drop, paste, or file input).
     * @param {File} file
     */

    // --- JASSUB Control ---

    initRenderer() {
        if (!this.renderer && !this.isDestroyed && this.video) {
             console.log("Initializing JASSUB renderer");
             // console.log('workerUrl =', workerUrl);      // should print something like ".../dist/jassub-worker-XYZ.js"
             // console.log('wasmUrl   =', wasmUrl);        // ditto for the wasm file
             //fetch(wasmUrl).then(r => console.log('WASM response', r.status, r.url))
             // .catch(err => console.error('WASM fetch failed', err));
            const options = {
                video: this.video,
                subContent: defaultHeader, // Initial header
                fonts: this.fonts, // Array of font URLs/buffers
                // IMPORTANT: Update these paths to where you serve JASSUB files
                workerUrl,                 // ✅ bundler‑generated URL
                wasmUrl,                   // ✅ bundler‑generated URL
                legacyWasmUrl : wasmUrl + '.js',
                // modernWasmUrl: '/jassub/jassub-worker-modern.wasm', // If using modern build

                // Settings based placeholders
                offscreenRender: true, // Recommended for performance if supported
                libassMemoryLimit: 1024, // Example value
                libassGlyphLimit: 80000, // Example value
                maxRenderHeight: parseInt(getSetting('subtitleRenderHeight', '0')) || 0,
                fallbackFont: getSetting('font', { name: 'Roboto Medium' }).name,
                useLocalFonts: getSetting('missingFont', true), // Use system fonts if needed
                dropAllBlur: getSetting('disableSubtitleBlur', false), // Performance optimization
            };
             try {
                this.renderer = new JASSUB(options);
                log("JASSUB renderer initialized");
             } catch (e) {
                 console.error("Failed to initialize JASSUB:", e);
                 // Handle initialization error (e.g., show message to user)
             }
        }
    }

    /**
     * Selects a subtitle track to display.
     * @param {number} trackNumber - The track number to select, or -1 to disable.
     */
    selectTrack(trackNumber) {
        if (this.isDestroyed) return;
        this.currentTrack = Number(trackNumber);
        log(`Selecting subtitle track: ${this.currentTrack}`);

        this.initRenderer(); // Make sure it's initialized

        if (!this.renderer) {
            log("Renderer not available for track selection.");
            return;
        }

        if (this.currentTrack === -1) {
            this.renderer.setTrack(null); // Disable subtitles
        } else if (this.headers[this.currentTrack]) {
            // Set the track content (header + all cues parsed so far)
             const header = this.headers[this.currentTrack].header || defaultHeader;
             const trackCues = this.tracks[this.currentTrack] || [];

            // Format cues back into ASS Dialogue lines for setTrack
            let assContent = header;
            for (const cue of trackCues) {
                // Reuse formatting logic from addSingleSubtitleFile's cue parsing
                 const startStr = toTS(cue.Start, 1); // Use util function with centiseconds
                 const endStr = toTS(cue.Start + cue.Duration, 1);
                assContent += `Dialogue: ${cue.Layer || 0},${startStr},${endStr},${cue.Style ? this._stylesMap[this.currentTrack][cue.Style] || 'Default' : 'Default'},${cue.Name || ''},${cue.MarginL || 0},${cue.MarginR || 0},${cue.MarginV || 0},${cue.Effect || ''},${cue.Text.replace(/\r?\n/g, '\\N')}\n`;
            }

             this.renderer.setTrack(assContent);
            // Note: If cues arrive later via handleSubtitleCue, they are added individually using createEvent.
        } else {
            log(`Track ${this.currentTrack} not found in headers.`);
             this.renderer.setTrack(null); // Disable if track info is missing
        }
         this.onTrackListUpdate(this.getTrackList()); // Update UI state
    }

    /**
     * Returns a list of available subtitle tracks for UI display.
     */
    getTrackList() {
        return this.headers
            .filter(header => header !== undefined && header !== null) // Filter out empty slots
            .map(header => ({
                number: header.number,
                label: header.name || `Track ${header.number}`,
                language: header.language || 'und',
                selected: header.number === this.currentTrack,
            }));
    }

    /**
     * Cleans up resources used by the subtitle manager.
     */
    destroy() {
        log(`Destroying SubtitleManager`);
        this.isDestroyed = true;
        if (this.renderer) {
            this.renderer.destroy();
            this.renderer = null;
        }
        this.fonts.forEach(url => { // Font cleanup remains
            if (url.startsWith('blob:')) {
                URL.revokeObjectURL(url);
            }
        });

        // --- FIX: Ensure cleanup functions are called ---
        if (this.ipcCleanupFunctions) {
            log("Removing IPC listeners...");
            this.ipcCleanupFunctions.forEach(cleanup => cleanup()); // Execute each cleanup func
            this.ipcCleanupFunctions = []; // Clear the array
        }

        this.fonts = [];
        this.headers = [];
        this.tracks = [];
        this._tracksString = [];
        this._stylesMap = [];
        this.currentTrack = -1;


        this.onTrackListUpdate = () => {}; // Prevent further UI updates
        log("SubtitleManager destroyed");
    }

    // --- Conversion Logic (Adapted from Miru) ---

    /**
     * Converts SRT, VTT, or SUB text content to ASS Dialogue lines.
     * @param {string} text - The subtitle text content.
     * @param {string} type - The subtitle format type ('srt', 'vtt', 'sub').
     * @returns {string[]} - An array of ASS Dialogue strings.
     */
    convertSubText(text, type) {
        if (type === 'ass' || type === 'ssa') {
             // Return only the events part for direct use or reconstruction
             const eventMarker = '[Events]';
             const eventIndex = text.indexOf(eventMarker);
             if (eventIndex !== -1) {
                 // Skip header and format line
                 const lines = text.substring(eventIndex + eventMarker.length).trim().split('\n');
                 if (lines[0] && lines[0].trim().toLowerCase().startsWith('format:')) {
                     return lines.slice(1); // Return only dialogue lines
                 }
                 return lines;
             }
             return []; // No events found
        }

        const srtRx = /(?:\d+\r?\n)?(\d{1,2}:\d{2}:\d{2}[,.]\d{2,3})\s?-->\s?(\d{1,2}:\d{2}:\d{2}[,.]\d{2,3})(.*)\r?\n([\s\S]*?(?=\r?\n\r?\n|\r?\n*$))/gi;
        const vttRx = /(?:.*\r?\n)?(\d{2}:)?(\d{2}:\d{2}[,.]\d{3})\s?-->\s?(\d{2}:)?(\d{2}:\d{2}[,.]\d{3})(.*)\r?\n([\s\S]*?(?=\r?\n\r?\n|\r?\n*$))/gi;
        const subRx = /[{[](\d+)[}\]][{[](\d+)[}\]](.+)/i;

        const subtitles = [];
        text = text.replace(/\r/g, ''); // Normalize line endings

        if (type === 'srt' || type === 'vtt' || vttRx.test(text) || srtRx.test(text)) { // Detect VTT/SRT structure
             log(`Converting ${type} to ASS`);
            const regex = (type === 'vtt' || text.includes('WEBVTT')) ? vttRx : srtRx;
            let match;
            regex.lastIndex = 0; // Reset regex state

             while ((match = regex.exec(text)) !== null) {
                let startTime = match[1] || match[2]; // Handle VTT optional hours
                let endTime = match[3] || match[4];
                let dialogueText = (type === 'vtt' ? match[6] : match[4]) || '';
                // const settings = (type === 'vtt' ? match[5] : match[3]) || ''; // VTT/SRT settings - ignore for basic conversion

                 // Normalize time to H:MM:SS.cs
                 startTime = this.normalizeTimeFormat(startTime);
                 endTime = this.normalizeTimeFormat(endTime);


                // Convert VTT/HTML tags to ASS tags (basic)
                dialogueText = dialogueText
                    .replace(/<c\.([^>]+)>([^<]*)<\/c>/g, '{\\c&H$1&}$2{\\c}') // Basic color <c.color>text</c> (assuming hex color)
                    .replace(/<b[^>]*>([^<]*)<\/b>/g, '{\\b1}$1{\\b0}')      // Bold <b>text</b>
                    .replace(/<i[^>]*>([^<]*)<\/i>/g, '{\\i1}$1{\\i0}')      // Italic <i>text</i>
                    .replace(/<u[^>]*>([^<]*)<\/u>/g, '{\\u1}$1{\\u0}')      // Underline <u>text</u>
                    .replace(/<[^>]+>/g, '')                             // Remove unsupported tags
                    .replace(/&amp;/g, '&')                              // Decode HTML entities
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&nbsp;/g, ' ')
                    .replace(/\r?\n/g, '\\N');                          // Convert newlines


                subtitles.push(`Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${dialogueText}`);
            }
        } else if (type === 'sub' && subRx.test(text)) {
            log("Converting SUB (MicroDVD) to ASS");
             let lines = text.split('\n');
             let fps = 23.976; // Default FPS, MicroDVD is frame-based
             // Attempt to find FPS comment if present (often missing)
             const fpsMatch = text.match(/{\s*FRAMERATE\s*=\s*(\d+(?:\.\d+)?)\s*}/i);
             if(fpsMatch && fpsMatch[1]) {
                 fps = parseFloat(fpsMatch[1]);
                 log(`Detected FPS: ${fps}`);
             } else {
                 log(`Warning: No FPS found in .sub file, assuming ${fps}fps.`);
             }
             const frameDuration = 1000 / fps; // Duration of one frame in ms

             for (const line of lines) {
                 const match = line.match(subRx);
                 if (match) {
                     const startFrame = parseInt(match[1], 10);
                     const endFrame = parseInt(match[2], 10);
                     const dialogueText = match[3].replace(/\|/g, '\\N'); // Replace MicroDVD newline marker
                     const startTime = toTS((startFrame * frameDuration) / 1000, 1); // Convert frame to H:MM:SS.cs
                     const endTime = toTS((endFrame * frameDuration) / 1000, 1);
                     subtitles.push(`Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${dialogueText}`);
                 }
             }
        } else {
             log(`Unsupported subtitle type for conversion or unrecognized format: ${type}`);
             // Maybe attempt SRT/VTT detection again if type was uncertain
        }
        return subtitles; // Array of ASS Dialogue lines
    }


    /**
     * Normalizes various time string formats to H:MM:SS.cs (ASS format).
     * Handles formats like HH:MM:SS,ms, MM:SS.ms, H:MM:SS.ms etc.
     * @param {string} timeStr
     * @returns {string} Formatted time string H:MM:SS.cs
     */
     normalizeTimeFormat(timeStr) {
        if (!timeStr) return '0:00:00.00';
        timeStr = timeStr.replace(',', '.');
        const parts = timeStr.split(':');
        let hours = 0, minutes = 0, seconds = 0, centiseconds = 0;

        if (parts.length === 3) { // H:MM:SS.cs or HH:MM:SS.cs
            hours = parseInt(parts[0], 10);
            minutes = parseInt(parts[1], 10);
            const secParts = parts[2].split('.');
            seconds = parseInt(secParts[0], 10);
            centiseconds = parseInt((secParts[1] || '0').padEnd(2, '0').substring(0, 2), 10); // Ensure 2 digits for cs
        } else if (parts.length === 2) { // MM:SS.cs
            minutes = parseInt(parts[0], 10);
            const secParts = parts[1].split('.');
            seconds = parseInt(secParts[0], 10);
            centiseconds = parseInt((secParts[1] || '0').padEnd(2, '0').substring(0, 2), 10);
        } else if (parts.length === 1 && timeStr.includes('.')) { // SS.cs
             const secParts = timeStr.split('.');
             seconds = parseInt(secParts[0], 10);
             centiseconds = parseInt((secParts[1] || '0').padEnd(2, '0').substring(0, 2), 10);
        } else {
            log(`Unrecognized time format for normalization: ${timeStr}`);
            return '0:00:00.00';
        }

         if (isNaN(hours) || isNaN(minutes) || isNaN(seconds) || isNaN(centiseconds)) {
             log(`Failed to parse time components: ${timeStr}`);
             return '0:00:00.00';
         }

        // Format H:MM:SS.cs
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
    }


    /**
     * Constructs the object format expected by JASSUB's createEvent.
     * Adapted from Miru
     * @param {object} subtitle - The raw subtitle cue object.
     * @param {boolean} isNotAss - True if the original format needed conversion (e.g., SRT -> ASS).
     * @param {number} subtitleIndex - The index within the track's cue array.
     * @param {number} trackNumber - The track number this cue belongs to.
     * @returns {object} JASSUB event object.
     */
    constructSub(subtitle, isNotAss, subtitleIndex, trackNumber) {
        let text = subtitle.text || '';
        // This conversion logic is mostly handled in convertSubText now
        // if (isNotAss === true) {
        //    // ... (tag conversion was here) ...
        // }
        return {
            Start: subtitle.time, // Assuming 'time' is start time in seconds
            Duration: subtitle.duration, // Assuming duration is in seconds
            Style: this._stylesMap[trackNumber]?.[subtitle.style || 'Default'] || 'Default', // Use mapped style name or Default
            Name: subtitle.name || '',
            MarginL: Number(subtitle.marginL) || 0,
            MarginR: Number(subtitle.marginR) || 0,
            MarginV: Number(subtitle.marginV) || 0,
            Effect: subtitle.effect || '',
            Text: text,
            ReadOrder: 1, // Default read ordere
            Layer: Number(subtitle.layer) || 0,
            _index: subtitleIndex + 1 // JASSUB uses this internally sometimes
        };
    }
}

