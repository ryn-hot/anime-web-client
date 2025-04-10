import { createServer } from 'http';
import { getGlobalClient } from '../backend/webtorrent-client.js';
import Parser from './parser.js';
import debug from "debug";
import { videoRx } from './util.js';

const log = debug('http-server');

export default class StreamServer {
  mainWindow = null;

  constructor(port = 0) {
    this.port = port;
    this.server = null;
    this.torrent = null;
    this.files = new Map();
    this.client = getGlobalClient();

    this.subtitleTracks = new Map();
    this.subtitleCues = new Map();
    this.fonts = new Map();
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

      // Remove previous torrent if one exists
      if (this.torrent && !this.torrent.destroyed) {
          log(`Destroying previous torrent: ${this.torrent.infoHash}`);
          // Clear stored file/parsed data for the old torrent
          this.files.clear();
          this.subtitleTracks.clear();
          this.subtitleCues.clear();
          this.fonts.clear();
          this.torrent.destroy((err) => {
              if (err) log(`Error destroying previous torrent: ${err.message}`);
              this.torrent = null;
              this._addAndPrepareTorrent(magnetURI, fileIndex, resolve, reject);
          });
      } else {
          this._addAndPrepareTorrent(magnetURI, fileIndex, resolve, reject);
      }
    });
  }

  _addAndPrepareTorrent(magnetURI, fileIndex, resolve, reject) {
    log(`Adding torrent: ${magnetURI}`);
    this.client.add(magnetURI, (torrent) => {
      log(`Torrent metadata ready: ${torrent.infoHash}, Name: ${torrent.name}`);
      this.setTorrent(torrent); // Store the torrent object

      if (fileIndex < 0 || fileIndex >= torrent.files.length) {
        log(`Error: Invalid fileIndex ${fileIndex} for torrent ${torrent.name}`);
        return reject(new Error(`Invalid fileIndex ${fileIndex}`));
      }

      const file = torrent.files[fileIndex];
      log(`Selected file: ${file.name} (Index: ${fileIndex}, Length: ${file.length})`);

      // Make the file available for streaming requests
      this.addFile(fileIndex, file);

      // Check if it's MKV/WebM and initiate parsing
      const isMKVOrWebM = videoRx.test(file.name);
      if (isMKVOrWebM) {
        this.initiateParsing(fileIndex, file);
      } else {
          log(`Skipping parser for non-MKV/WebM file: ${file.name}`);
      }

      // Resolve with the stream URL for the frontend
      resolve(this.getStreamUrl(fileIndex));

      // Optional: Handle torrent errors
      torrent.on('error', (err) => {
        log(`Torrent error (${torrent.infoHash}): ${err.message}`);
        // Maybe notify the frontend?
      });
      torrent.on('done', () => {
          log(`Torrent done downloading: ${torrent.infoHash}`);
      });

    });

      // Handle client-level errors (e.g., invalid magnet URI)
      // Note: The 'error' event on the client might be harder to associate
      // with a specific 'add' call if multiple happen concurrently.
      // This basic handler logs any client error.
      /*const clientErrorHandler = (err) => {
          log(`WebTorrent client error: ${err.message}`);
          // It's hard to know if this error belongs to *this* specific add attempt
          // without more sophisticated tracking. We might reject the current promise
          // but it could be misleading.
          // reject(err); // Use with caution
      };
      this.client.once('error', clientErrorHandler);
      // Clean up the listener if the torrent loads successfully or if the promise rejects otherwise
      const cleanup = () => this.client.removeListener('error', clientErrorHandler);
      Promise.resolve.finally(cleanup); // Requires Node 12.9+ for Promise.finally
      Promise.reject.finally(cleanup); // Requires Node 12.9+ for Promise.finally */

  }


  setTorrent(torrent) {
    this.torrent = torrent;
  }
  
  addFile(fileIndex, file) {
    this.files.set(fileIndex.toString(), file);
  }
  
  getStreamUrl(fileIndex) {
    const address = this.server.address();
    return `http://localhost:${address.port}/stream/${fileIndex}`;
  }
  
  getSubtitleUrl(subtitleIndex) {
    const address = this.server.address();
    return `http://localhost:${address.port}/subtitle/${subtitleIndex}`;
  }
  
  getFontUrl(fileIndex, fontId) {
    const address = this.server.address();
    if (!address) return ''; // Handle server not ready
    return `http://localhost:${address.port}/font/${fileIndex}/${encodeURIComponent(fontId)}`;
  }
  
  handleRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    
    log(`Received request: ${pathname}`);
    
    // Handle CORS headers for all requests
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
    } else if (pathname.startsWith('/subtitle/')) {
      this.handleSubtitleRequest(req, res, pathname);
    } else if (pathname.startsWith('/font/')) {
      this.handleFontRequest(req, res, pathname);
    } else {
      res.statusCode = 404;
      res.end('Not Found');
    }
  }
  
  handleStreamRequest(req, res, pathname) {
    const fileIndex = pathname.split('/')[2];
    const file = this.files.get(fileIndex);
    
    if (!file) {
      res.statusCode = 404;
      res.end('File not found');
      return;
    }
    
    // Handle range requests for seeking
    const range = req.headers.range;
    
    if (!range) {
      // If no range is provided, send the content type and prepare for the whole file
      res.setHeader('Content-Type', this.getMimeType(file.name));
      res.setHeader('Content-Length', file.length);
      res.setHeader('Accept-Ranges', 'bytes');
      
      // Stream the entire file
      const stream = file.createReadStream();
      stream.pipe(res);
      return;
    }
    
    // Handle range request
    const parts = range.replace('bytes=', '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : file.length - 1;
    
    // Validate range
    if (start >= file.length || end >= file.length) {
      res.statusCode = 416; // Range Not Satisfiable
      res.setHeader('Content-Range', `bytes */${file.length}`);
      res.end();
      return;
    }
    
    // Set headers for partial content
    res.statusCode = 206; // Partial Content
    res.setHeader('Content-Range', `bytes ${start}-${end}/${file.length}`);
    res.setHeader('Content-Length', end - start + 1);
    res.setHeader('Content-Type', this.getMimeType(file.name));
    res.setHeader('Accept-Ranges', 'bytes');
    
    // Stream the range
    const stream = file.createReadStream({ start, end });
    stream.pipe(res);
  }
  
  initiateParsing(fileIndex, file) {
    const fileIndexStr = fileIndex.toString();
    if (file.parsingInitiated) {
       log(`Parsing already initiated for index ${fileIndexStr}`);
       return;
    }
    file.parsingInitiated = true; // Mark the file object itself
    log(`Initiating parsing for MKV/WebM: ${file.name} (Index: ${fileIndexStr})`);

    const parser = new Parser(file); // 'this' refers to StreamServer

    // Attach listeners to capture parsed data
    parser.on('tracks', (tracks) => this.handleParsedTracks(fileIndexStr, tracks));
    parser.on('subtitle', ({ subtitle, trackNumber }) => this.handleParsedSubtitle(fileIndexStr, trackNumber, subtitle));
    parser.on('file', (fontData) => this.handleParsedFont(fileIndexStr, fontData));
    parser.on('chapters', (chapters) => this.handleParsedChapters(fileIndexStr, chapters)); // Assuming parser emits chapters

    // *** Stream Consumption for Parsing ***
    // We need the parser to process the stream. Since `handleStreamRequest`
    // serves the stream on demand, we might need to *separately* consume
    // the stream just for parsing if the parser requires data flow.
    // This consumes bandwidth but ensures parsing happens.
    log(`Starting background stream consumption for parsing index ${fileIndexStr}`);
    const parseStream = file.createReadStream();

    // If the copied Parser uses the iterator method like Miru's original:
     if (typeof file.on === 'function') { // Check if it's an EventEmitter-like object
         file.on('iterator', ({ iterator }, cb) => {
             log(`Parser hooked into iterator for index ${fileIndexStr}`);
             cb(parser.metadata.parseStream(iterator)); // Assuming parser.metadata exists
         });
     } else {
         // Fallback: Consume the stream directly if iterator event isn't available
         // This might not work perfectly with matroska-metadata's parseStream
         // if it relies on the specific iterator implementation.
          log(`Consuming stream directly for parsing index ${fileIndexStr} (may be less efficient)`);
         parseStream.on('data', (chunk) => {
             // If parser needs manual feeding (unlikely for matroska-metadata)
             // parser.feed(chunk);
         });
     }


    parseStream.on('end', () => log(`Parsing stream ended for ${fileIndexStr}`));
    parseStream.on('error', (err) => log(`Parsing stream error for ${fileIndexStr}: ${err.message}`));
    parseStream.resume(); // Ensure the stream flows even if not piped anywhere else initially
  }

  handleParsedTracks(fileIndexStr, tracks) {
    log(`Received tracks for ${fileIndexStr}:`, tracks.map(t => `Track ${t.number}: ${t.codec} Lang: ${t.language}`));
    // Store tracks relevant for subtitles/audio selection
    // Example: Storing only subtitle tracks with language info
    const subTracks = tracks
        .filter(t => t.type === 'subtitle' && (t.codec === 'SubStationAlpha' || t.codec === 'SubRip' || t.codec === 'VobSub' || t.codec === 'WEBVTT'))
        .map(t => ({ number: t.number, language: t.language, name: t.name, codec: t.codec })); // Extract needed info
    this.subtitleTracks.set(fileIndexStr, subTracks);

    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      log(`Sending 'subtitle-tracks' to renderer for ${fileIndexStr}`);
      this.mainWindow.webContents.send('subtitle-tracks', {
          fileIndex: fileIndexStr,
          tracks: subTracks
      });
    } else { log("IPC Error: Cannot send tracks, mainWindow invalid."); }
  }

  handleParsedSubtitle(fileIndexStr, trackNumber, subtitle) {
    // Store cues, grouped by track number
    // log(`Received cue for ${fileIndexStr}, track ${trackNumber}: ${subtitle.text.substring(0, 50)}...`);
    if (!this.subtitleCues.has(fileIndexStr)) {
      this.subtitleCues.set(fileIndexStr, new Map());
    }
    const fileCuesMap = this.subtitleCues.get(fileIndexStr);
    if (!fileCuesMap.has(trackNumber)) {
      fileCuesMap.set(trackNumber, []);
    }
    fileCuesMap.get(trackNumber).push(subtitle);

    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('subtitle-cue', {
          fileIndex: fileIndexStr,
          trackNumber: trackNumber,
          subtitle: subtitle
      });
    }
  }

  handleParsedFont(fileIndexStr, fontData) {
    log(`Received font for ${fileIndexStr}, size: ${fontData.length}`);
    const fontId = `font_${this.fonts.get(fileIndexStr)?.size || 0}`; // Use map size for a simple unique enough ID
    log(`Received font for ${fileIndexStr}, id ${fontId}, size: ${fontData.length}`); // Use fontData.length directly

    if (!this.fonts.has(fileIndexStr)) {
        this.fonts.set(fileIndexStr, new Map()); // Store fonts in a Map per file
    }
    // Store the buffer using the ID
    this.fonts.get(fileIndexStr).set(fontId, fontData); // Assuming fontData is the buffer

    // --- FIX: Add the missing webContents.send call ---
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        log(`Sending 'subtitle-font' info to renderer for ${fileIndexStr}, id ${fontId}`);
        this.mainWindow.webContents.send('subtitle-font', {
            fileIndex: fileIndexStr,
            fontId: fontId, // Send the ID
            fontUrl: this.getFontUrl(fileIndexStr, fontId) // Send the URL
        });
    } else {
        log("IPC Error: Cannot send font info, mainWindow invalid.");
    }

  }

  handleParsedChapters(fileIndexStr, chapters) {
      log(`Received chapters for ${fileIndexStr}:`, chapters);
      // TODO: Store chapters and make them available to frontend if needed
  }

  handleSubtitleRequest(req, res, pathname) {
    const subtitleIndex = pathname.split('/')[2];
    // Implementation depends on how subtitles are stored
    // For now, just return a 404
    res.statusCode = 404;
    res.end('Subtitle not found');
  }
  
  handleFontRequest(req, res, pathname) {
    const parts = pathname.split('/');
    const fileIndexStr = parts[2];
    const fontId = decodeURIComponent(parts[3] || '');

    if (!fileIndexStr || !fontId) { /* ... bad request ... */ return; }

    const fileFontsMap = this.fonts.get(fileIndexStr);
    const fontBuffer = fileFontsMap ? fileFontsMap.get(fontId) : null;

    if (!fontBuffer) { /* ... not found ... */ return; }

    log(`Serving font id ${fontId} for file ${fileIndexStr}`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', fontBuffer.length);
    res.end(fontBuffer);
  }
  
  getMimeType(filename) {
    const extension = filename.split('.').pop().toLowerCase();
    
    switch (extension) {
      case 'mp4':
        return 'video/mp4';
      case 'webm':
        return 'video/webm';
      case 'mkv':
        return 'video/x-matroska';
      case 'avi':
        return 'video/x-msvideo';
      case 'mov':
        return 'video/quicktime';
      case 'srt':
        return 'text/plain';
      case 'vtt':
        return 'text/vtt';
      case 'ass':
      case 'ssa':
        return 'text/plain';
      case 'ttf':
        return 'font/ttf';
      case 'otf':
        return 'font/otf';
      case 'woff':
        return 'font/woff';
      case 'woff2':
        return 'font/woff2';
      default:
        return 'application/octet-stream';
    }
  }
  
  close() {
    if (this.server) {
      this.server.close();
      log('Server closed');
    }
  }
}