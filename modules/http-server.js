import { createServer } from 'http';
import { debug } from './util.js';

const log = debug('http-server');

export default class StreamServer {
  constructor(port = 0) {
    this.port = port;
    this.server = null;
    this.torrent = null;
    this.files = new Map();
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
  
  getFontUrl(fontIndex) {
    const address = this.server.address();
    return `http://localhost:${address.port}/font/${fontIndex}`;
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
  
  handleSubtitleRequest(req, res, pathname) {
    const subtitleIndex = pathname.split('/')[2];
    // Implementation depends on how subtitles are stored
    // For now, just return a 404
    res.statusCode = 404;
    res.end('Subtitle not found');
  }
  
  handleFontRequest(req, res, pathname) {
    const fontIndex = pathname.split('/')[2];
    // Implementation depends on how fonts are stored
    // For now, just return a 404
    res.statusCode = 404;
    res.end('Font not found');
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