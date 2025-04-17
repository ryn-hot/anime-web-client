// http-server.js (Updated for Integration)
import { createServer } from 'http';
import { getGlobalClient } from '../backend/webtorrent-client.js';
import Parser from './parser.js';
import debug from "debug";
import { videoRx } from './util.js';
import { EventEmitter } from 'events';

const log = debug('http-server');

export default class StreamServer {
  mainWindow = null;
  port = 0;
  server = null;
  client = null;

  // --- State for the CURRENTLY active torrent/parser ---
  activeTorrent = null;
  activeFileIndex = null;
  activeFile = null;
  activeParser = null;
  activeParsingStream = null;
  activeParserEventHandler = null;
  // --- End Current State ---

  // Store subtitle/font info for the active file
  subtitleTracks = new Map(); // Using Map keyed by trackNumber might be better later
  subtitleCues = new Map();   // Key: trackNumber, Value: array of cues
  fonts = new Map();        // Key: fontId, Value: fontBuffer

  constructor(port = 0) {
    this.port = port;
    this.client = getGlobalClient();
    // Initialize maps for safety, although they'll be cleared on new torrent load
    this.clearSubtitleData();
  }

  clearSubtitleData() {
     this.subtitleTracks.clear();
     this.subtitleCues.clear();
     this.fonts.clear();
     log('Cleared previous subtitle tracks, cues, and fonts.');
  }

  // --- Cleanup function for the active parser and its stream ---
  cleanupParser() {
    if (this.activeParserEventHandler) {
        log(`Removing listeners from previous parser event handler for index ${this.activeFileIndex}...`);
        this.activeParserEventHandler.removeAllListeners(); // *** Remove listeners ***
        this.activeParserEventHandler = null;
    }
    if (this.activeParser) {
        log(`Destroying previous parser for file index ${this.activeFileIndex}...`);
        this.activeParser.destroy();
        this.activeParser = null;
    }
    if (this.activeParsingStream && typeof this.activeParsingStream.destroy === 'function') {
        log(`Destroying previous parser input stream for file index ${this.activeFileIndex}...`);
        this.activeParsingStream.destroy();
        this.activeParsingStream = null;
    }
    this.activeFileIndex = null;
    this.activeFile = null;
    this.clearSubtitleData();
  }

  setWindow(windowInstance) {
    this.mainWindow = windowInstance;
    log("Main window reference set for IPC.");
  }

  start() {
    return new Promise((resolve, reject) => {
      try {
        this.server = createServer(this.handleRequest.bind(this));
        this.server.listen(this.port, () => {
          const address = this.server.address();
          log(`Server started on port ${address.port}`);
          resolve(address);
        });
        this.server.on('error', (error) => {
          log(`Server error: ${error.message}`);
          reject(error);
        });
      } catch (error) {
        log(`Failed to start server: ${error.message}`);
        reject(error);
      }
    });
  }

  loadTorrentAndServe(magnetURI, fileIndex) {
    return new Promise((resolve, reject) => {
      log(`Attempting to load torrent: ${magnetURI}, fileIndex: ${fileIndex}`);

      // --- Cleanup previous torrent, parser, and stream ---
      if (this.activeTorrent && !this.activeTorrent.destroyed) {
          log(`Destroying previous torrent: ${this.activeTorrent.infoHash}`);
          this.cleanupParser(); // Destroy parser and its stream first
          this.activeTorrent.destroy((err) => {
              if (err) log(`Error destroying previous torrent: ${err.message}`);
              this.activeTorrent = null;
              this._addAndPrepareTorrent(magnetURI, fileIndex, resolve, reject);
          });
      } else {
          this.cleanupParser(); // Ensure any lingering parser/stream is gone
          this._addAndPrepareTorrent(magnetURI, fileIndex, resolve, reject);
      }
    });
  }

  _addAndPrepareTorrent(magnetURI, fileIndex, resolve, reject) {
    log(`Adding torrent: ${magnetURI}`);
    this.client.add(magnetURI, { announce: this.client.tracker.announce }, (torrent) => { // Pass announce trackers
      log(`Torrent metadata ready: ${torrent.infoHash}, Name: ${torrent.name}`);
      this.activeTorrent = torrent; // Store the active torrent object

      if (fileIndex < 0 || fileIndex >= torrent.files.length) {
        log(`Error: Invalid fileIndex ${fileIndex} for torrent ${torrent.name}`);
        reject(new Error(`Invalid fileIndex ${fileIndex}`));
        this.activeTorrent = null; // Clear if invalid index
        return;
      }

      this.activeFileIndex = fileIndex;
      this.activeFile = torrent.files[fileIndex]; // Store active file
      log(`Selected file: ${this.activeFile.name} (Index: ${this.activeFileIndex}, Length: ${this.activeFile.length})`);

      log(`Selecting file for priority download: ${this.activeFile.name}`);
      this.activeFile.select();

      // --- Setup and Start Parser Immediately ---
      const isMKVOrWebM = videoRx.test(this.activeFile.name);
      if (isMKVOrWebM) {
        this.initiateParsingSetup(this.activeFileIndex, this.activeFile); // Pass index and file
      } else {
          log(`Skipping parser setup for non-MKV/WebM file: ${this.activeFile.name}`);
      }
      // --- End Parser Setup ---

      // Resolve with the stream URL for the frontend
      resolve(this.getStreamUrl(this.activeFileIndex));

      torrent.on('error', (err) => {
        log(`Torrent error (${torrent.infoHash}): ${err.message}`);
        // Maybe notify the frontend? Clean up?
        this.cleanupParser();
        this.activeTorrent = null;
      });
      torrent.on('done', () => {
          log(`Torrent done downloading: ${torrent.infoHash}`);
          // Note: Parser stream might finish earlier or later than torrent download
      });

    });
  }

  // --- No need for setTorrent, addFile methods if only handling one active ---

  getStreamUrl(fileIndex) {
    if (fileIndex !== this.activeFileIndex || !this.server?.address()) {
        log('Warning: Requesting stream URL for inactive/invalid index or server not ready.');
        return ''; // Or handle error appropriately
    }
    const address = this.server.address();
    return `http://localhost:${address.port}/stream/${fileIndex}`;
  }

  getFontUrl(fileIndex, fontId) {
    if (fileIndex !== this.activeFileIndex || !this.server?.address()) return '';
    const address = this.server.address();
    return `http://localhost:${address.port}/font/${fileIndex}/${encodeURIComponent(fontId)}`;
  }

  handleRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    log(`Received request: ${pathname}`);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (pathname.startsWith('/stream/')) {
      this.handleStreamRequest(req, res, pathname);
    } else if (pathname.startsWith('/font/')) {
      this.handleFontRequest(req, res, pathname);
    } else {
      res.statusCode = 404;
      res.end('Not Found');
    }
  }

  handleStreamRequest(req, res, pathname) {
    const requestedIndexStr = pathname.split('/')[2];
    const requestedIndex = parseInt(requestedIndexStr, 10);

    // Check if request matches the currently active file
    if (requestedIndex !== this.activeFileIndex || !this.activeFile) {
      log(`Stream request for inactive index ${requestedIndexStr} (active: ${this.activeFileIndex})`);
      res.statusCode = 404;
      res.end('File not found or inactive');
      return;
    }

    const file = this.activeFile; // Use the stored active file

    // --- Range request logic remains the same ---
    const range = req.headers.range;
    let streamOptions = {};

    if (range) {
        const parts = range.replace('bytes=', '').split('-');
        const start = parseInt(parts[0], 10);
        let end = parts[1] ? parseInt(parts[1], 10) : file.length - 1;

        if (start >= file.length || end >= file.length || start > end) {
            res.statusCode = 416;
            res.setHeader('Content-Range', `bytes */${file.length}`);
            res.end();
            return;
        }
        streamOptions = { start, end };
        res.statusCode = 206;
        res.setHeader('Content-Range', `bytes ${start}-${end}/${file.length}`);
        res.setHeader('Content-Length', end - start + 1);
    } else {
        res.statusCode = 200;
        res.setHeader('Content-Length', file.length);
    }

    res.setHeader('Content-Type', this.getMimeType(file.name));
    res.setHeader('Accept-Ranges', 'bytes');

    // --- NO PARSER STARTING LOGIC HERE ---

    // Create stream *for the response*
    const responseStream = file.createReadStream(streamOptions);

    responseStream.on('error', (err) => {
        log(`Error in file response stream for index ${this.activeFileIndex}: ${err.message}`);
        if (!res.writableEnded) {
            try { res.statusCode = 500; res.end('Stream Error'); }
            catch (e) { log("Error sending stream error response:", e); }
        }
    });

    res.on('close', () => {
        log(`Response closed for index ${this.activeFileIndex}, destroying response stream.`);
        responseStream.destroy();
    });

    responseStream.pipe(res);
  }

  // --- Setup Parser and Immediately Start Parsing ---
  // --- Setup Parser using standard EventEmitter ---
  initiateParsingSetup(fileIndex, file) {
    const fileIndexStr = fileIndex.toString();

    if (this.activeParser) {
       log(`Warning: Initiating parsing setup while another parser seems active. Cleaning up old one.`);
       this.cleanupParser();
    }

    log(`Setting up parser for MKV/WebM: ${file.name} (Index: ${fileIndexStr})`);

    // *** Create a standard EventEmitter for this parser instance ***
    this.activeParserEventHandler = new EventEmitter();

    try {
        // *** Pass the standard EventEmitter to the Parser ***
        this.activeParser = new Parser(file, this.activeParserEventHandler);

        // --- Attach listeners to the DEDICATED EVENT EMITTER ---
        this.activeParserEventHandler.on('subtitle-tracks', (tracks) => {
            log(`HTTP Server received 'subtitle-tracks' event via dedicated emitter`);
            /* log('--- Tracks Detected ---');
            (tracks || []).forEach(t => log(`  Track ${t.number}: Type=${t.type}, Codec=${t.codec}, Lang=${t.language}, Name=${t.name}`)); */
            this.handleParsedTracks(tracks);
        });
        this.activeParserEventHandler.on('subtitle-cue', ({ subtitle, trackNumber }) => {
            // log(`HTTP Server received 'subtitle-cue' event via dedicated emitter for track ${trackNumber}`);
            this.handleParsedSubtitle(subtitle, trackNumber);
        });
        this.activeParserEventHandler.on('subtitle-font-data', (fontData) => {
             log(`HTTP Server received 'subtitle-font-data' event via dedicated emitter for ${fontData.filename || 'unknown font'}`);
            this.handleParsedFont(fontData);
        });
        this.activeParserEventHandler.on('subtitle-chapters', (chapters) => {
            //log(`HTTP Server received 'subtitle-chapters' event via dedicated emitter`);
            this.handleParsedChapters(chapters);
        });
        this.activeParserEventHandler.on('parser-error', (err) => {
            log(`HTTP Server received 'parser-error' event via dedicated emitter: ${err.message || err}`);
        });
        this.activeParserEventHandler.on('parsing-finished', () => {
             log(`HTTP Server received 'parsing-finished' event via dedicated emitter for ${fileIndexStr}`);
        });
        // --- End Attaching Listeners ---

        log(`Creating stream and starting parser immediately for ${fileIndexStr}.`);
        this.activeParsingStream = file.createReadStream();

        this.activeParsingStream.on('error', (streamErr) => {
             log(`Error on stream passed to parser (Index ${fileIndexStr}): ${streamErr.message}`);
             this.cleanupParser();
        });
         this.activeParsingStream.on('close', () => {
             log(`Stream created for parser (Index ${fileIndexStr}) has closed.`);
         });

        // Call startParsingFromStream - parser will consume it and emit on the event handler we passed
        this.activeParser.startParsingFromStream(this.activeParsingStream);

    } catch (initError) {
         log(`Fatal error creating parser or starting stream: ${initError.message}`);
         this.cleanupParser();
    }
  }

  // --- Handlers now use the class member maps/variables directly ---

  handleParsedTracks(tracks) {
    // Clear previous tracks for the new file
    this.subtitleTracks.clear();
    const trackMap = new Map(); // Temp map for processing

    const subTracks = tracks
        .filter(t => t.codec === 'SubStationAlpha' || t.codec === 'SubRip' || t.codec === 'VobSub' || t.codec === 'WEBVTT' || t.type === 'ass') // Check type 'ass' too
        .map(t => ({ number: t.number, language: t.language, name: t.name, codec: t.codec, header: t.header }));

    log(`Received ${subTracks.length} subtitle tracks for active file`);
    subTracks.forEach(t => {
        log(`  Track ${t.number}: Codec=${t.codec}, Lang=${t.language}, Name=${t.name}, Header=${t.header ? '[Yes]' : '[No]'}`);
        trackMap.set(t.number, t); // Store processed track info
    });
    this.subtitleTracks = trackMap; // Replace the class member map

    // Send all processed subtitle tracks at once
    this.sendToRenderer('subtitle-tracks', {
         // No need to send fileIndex if renderer tracks the active file
         tracks: Array.from(this.subtitleTracks.values()) // Send array of track objects
    });
  }

  handleParsedSubtitle(subtitle, trackNumber) {
    // Store cues, grouped by track number
    if (!this.subtitleCues.has(trackNumber)) {
      this.subtitleCues.set(trackNumber, []);
    }
    this.subtitleCues.get(trackNumber).push(subtitle);

    // log(`Received cue for track ${trackNumber}: ${subtitle.text.substring(0, 50)}...`); // Verbose subtitle-tracks
    // Send individual cue
    this.sendToRenderer('subtitle-cue', {
        trackNumber: trackNumber,
        subtitle: subtitle
    });
  }

  handleParsedFont(fontData) {
    // Use filename from fontData if available, otherwise generate ID
    const filename = fontData.filename || `font_${this.fonts.size}`;
    const fontId = filename; // Use filename as ID for simplicity, ensure uniqueness if needed

    log(`Received font: ${filename}, id: ${fontId}, size: ${fontData.data?.length || fontData.length}`);

    const buffer = fontData.data || fontData; // Handle if parser sends object or just buffer

    // Store the buffer using the ID
    this.fonts.set(fontId, buffer);

    this.sendToRenderer('subtitle-font', {
        fontId: fontId,
        fontUrl: this.getFontUrl(this.activeFileIndex, fontId) // Generate URL using active index
    });
  }

  handleParsedChapters(chapters) {
      log(`Received ${chapters?.length || 0} chapters for active file`);
      // Store chapters if needed, maybe clear previous ones first
      // this.activeChapters = chapters;
      this.sendToRenderer('subtitle-chapters', { chapters: chapters });
  }

  handleFontRequest(req, res, pathname) {
    const parts = pathname.split('/');
    if (parts.length < 4) { /* ... bad request ... */ return; }
    const requestedIndexStr = parts[2];
    const fontId = decodeURIComponent(parts[3]);

    // Check if request matches the active file index
    if (parseInt(requestedIndexStr, 10) !== this.activeFileIndex) {
        res.statusCode = 404;
        return res.end('Font request for inactive file index');
    }

    const fontBuffer = this.fonts.get(fontId);

    if (!fontBuffer) { /* ... not found ... */ return; }

    log(`Serving font id ${fontId} for file ${this.activeFileIndex}, size: ${fontBuffer.length}`);
    let contentType = 'application/octet-stream';
    if (fontId.includes('.')) {
         try { contentType = this.getMimeType(fontId) || contentType; } catch (e) { /* Ignore */ }
    }
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', fontBuffer.length);
    res.end(fontBuffer);
  }

  getMimeType(filename) {
    // ... (keep existing getMimeType implementation) ...
    const extension = filename.split('.').pop().toLowerCase();
    switch (extension) {
      case 'mp4': return 'video/mp4';
      case 'webm': return 'video/webm';
      case 'mkv': return 'video/x-matroska';
      // ... other types ...
      case 'ttf': return 'font/ttf';
      case 'otf': return 'font/otf';
      case 'woff': return 'font/woff';
      case 'woff2': return 'font/woff2';
      default: return 'application/octet-stream';
    }
  }

  // Helper to send IPC messages
  sendToRenderer(channel, data) {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          // log(`Sending IPC [${channel}]`); // Optional verbose log
          // log(`[http-server] SENDING IPC: Channel=${channel}, FileIndex\=</span>{payload.fileIndex}`);
          this.mainWindow.webContents.send(channel, { fileIndex: this.activeFileIndex, ...data });
      } else {
          log(`IPC Error: Cannot send [${channel}], mainWindow invalid.`);
      }
  }

  close() {
    log('Closing server...');
    if (this.server) {
      this.server.close(() => { log('HTTP server closed.'); });
    }
    // Cleanup parser and torrent if server is closed permanently
    this.cleanupParser();
    if (this.activeTorrent && !this.activeTorrent.destroyed) {
        log('Destroying active torrent on server close...');
        this.activeTorrent.destroy(() => { log('Active torrent destroyed.'); });
        this.activeTorrent = null;
    }
     // Optional: Close WebTorrent client if server owns it
     // if (this.client) { this.client.destroy(...) }
  }
}