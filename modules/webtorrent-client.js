import WebTorrent from 'webtorrent';
import { debug, videoRx, subRx, fontRx } from './util.js';
import MediaParser from './parser.js';
import StreamServer from './http-server.js';

const log = debug('webtorrent-client');

export default class TorrentStreamer {
  constructor() {
    this.client = new WebTorrent();
    this.server = new StreamServer();
    this.parser = new MediaParser();
    this.torrents = new Map();
    this.mediaInfo = new Map();
    this.subtitles = [];
    this.fonts = [];
    this.currentTorrent = null;
    this.serverAddress = null;
    
    // Start HTTP server
    this.server.start().then(address => {
      this.serverAddress = address;
      log(`Server started on port ${address.port}`);
    }).catch(error => {
      log(`Failed to start server: ${error.message}`);
    });
    
    // Set up WebTorrent client event listeners
    this.client.on('error', error => {
      log(`WebTorrent error: ${error.message}`);
    });
  }
  
  /**
   * Add a torrent and select a file to stream
   * @param {string} magnetURI - Magnet URI or torrent file
   * @param {number} fileIndex - Index of the file to stream (-1 for auto-select)
   * @returns {Promise<Object>} Stream information
   */
  async streamTorrent(magnetURI, fileIndex = -1) {
    log(`Adding torrent: ${magnetURI}`);
    
    return new Promise((resolve, reject) => {
      try {
        // Add the torrent
        this.client.add(magnetURI, torrent => {
          log(`Torrent added: ${torrent.name}`);
          this.currentTorrent = torrent;
          this.torrents.set(torrent.infoHash, torrent);
          this.server.setTorrent(torrent);
          
          // Process files
          this.processTorrentFiles(torrent, fileIndex)
            .then(streamInfo => resolve(streamInfo))
            .catch(error => reject(error));
        });
      } catch (error) {
        log(`Failed to add torrent: ${error.message}`);
        reject(error);
      }
    });
  }
  
  /**
   * Process torrent files and prepare streaming
   * @param {Object} torrent - WebTorrent torrent object
   * @param {number} selectedIndex - Index of the file to stream (-1 for auto-select)
   * @returns {Promise<Object>} Stream information
   */
  async processTorrentFiles(torrent, selectedIndex) {
    log(`Processing torrent files for ${torrent.name}`);
    
    const files = torrent.files;
    const videoFiles = files.filter(file => videoRx.test(file.name));
    
    if (!videoFiles.length) {
      throw new Error('No video files found in torrent');
    }
    
    // Select video file
    let videoFile;
    if (selectedIndex >= 0 && selectedIndex < files.length) {
      videoFile = files[selectedIndex];
      if (!videoRx.test(videoFile.name)) {
        throw new Error('Selected file is not a video file');
      }
    } else {
      // Auto-select the largest video file
      videoFile = videoFiles.reduce((a, b) => a.length > b.length ? a : b);
    }
    
    log(`Selected video file: ${videoFile.name} (${videoFile.length} bytes)`);
    
    // Get the file index in the torrent
    const fileIndex = files.indexOf(videoFile);
    this.server.addFile(fileIndex, videoFile);
    
    // Find and process subtitle files
    await this.findSubtitleFiles(torrent, videoFile);
    
    // Find and process font files
    await this.findFontFiles(torrent);
    
    // Parse video file for metadata
    const mediaInfo = await this.parser.parseFile(videoFile);
    this.mediaInfo.set(fileIndex, mediaInfo);
    
    // Return stream information
    return {
      streamUrl: this.server.getStreamUrl(fileIndex),
      fileName: videoFile.name,
      fileSize: videoFile.length,
      mimeType: this.parser.getMimeType(videoFile.name),
      subtitles: this.subtitles,
      mediaInfo
    };
  }
  
  /**
   * Find and process subtitle files in the torrent
   * @param {Object} torrent - WebTorrent torrent object
   * @param {Object} videoFile - Selected video file
   */
  async findSubtitleFiles(torrent, videoFile) {
    log(`Looking for subtitle files for ${videoFile.name}`);
    
    // Clear previous subtitles
    this.subtitles = [];
    
    // Get filename without extension
    const nameWithoutExt = videoFile.name.substring(0, videoFile.name.lastIndexOf('.'));
    const videoDir = videoFile.path.substring(0, videoFile.path.lastIndexOf('/') + 1);
    
    // Look for matching subtitle files
    for (const file of torrent.files) {
      if (subRx.test(file.name)) {
        const fileNameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.'));
        const fileDir = file.path.substring(0, file.path.lastIndexOf('/') + 1);
        
        // Check if subtitle file matches video file (same name or in same directory)
        if (fileNameWithoutExt === nameWithoutExt || fileDir === videoDir) {
          log(`Found matching subtitle: ${file.name}`);
          
          // Get subtitle content
          await new Promise(resolve => {
            file.getBuffer((err, buffer) => {
              if (!err) {
                const subtitleInfo = this.parser.processTorrentSubtitle(file, buffer);
                this.subtitles.push(subtitleInfo);
              }
              resolve();
            });
          });
        }
      }
    }
    
    log(`Found ${this.subtitles.length} subtitle files`);
  }
  
  /**
   * Find and process font files in the torrent
   * @param {Object} torrent - WebTorrent torrent object
   */
  async findFontFiles(torrent) {
    log(`Looking for font files in the torrent`);
    
    // Clear previous fonts
    this.fonts = [];
    
    // Look for font files
    for (const file of torrent.files) {
      if (fontRx.test(file.name)) {
        log(`Found font file: ${file.name}`);
        
        // Get font content
        await new Promise(resolve => {
          file.getBuffer((err, buffer) => {
            if (!err) {
              const mimeType = file.name.toLowerCase().endsWith('.ttf') ? 'font/ttf' : 
                               file.name.toLowerCase().endsWith('.otf') ? 'font/otf' : 
                               file.name.toLowerCase().endsWith('.woff') ? 'font/woff' : 
                               file.name.toLowerCase().endsWith('.woff2') ? 'font/woff2' : 
                               'application/octet-stream';
              
              const fontUrl = URL.createObjectURL(new Blob([buffer], { type: mimeType }));
              
              this.fonts.push({
                name: file.name,
                url: fontUrl,
                mimeType
              });
            }
            resolve();
          });
        });
      }
    }
    
    log(`Found ${this.fonts.length} font files`);
    
    // If fonts are found, inject them into the document
    if (this.fonts.length > 0) {
      this.injectFonts();
    }
  }
  
  /**
   * Inject font styles into the document
   */
  injectFonts() {
    // Create a style element if it doesn't exist
    let styleElement = document.getElementById('torrent-fonts');
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = 'torrent-fonts';
      document.head.appendChild(styleElement);
    }
    
    // Create @font-face rules
    let fontFaces = '';
    for (const font of this.fonts) {
      fontFaces += `
        @font-face {
          font-family: "${font.name.split('.')[0]}";
          src: url(${font.url});
          font-weight: normal;
          font-style: normal;
        }
      `;
    }
    
    // Add font faces to the style element
    styleElement.textContent = fontFaces;
  }
  
  /**
   * Get torrent download progress
   * @param {string} infoHash - Torrent info hash
   * @returns {number} Progress (0-1)
   */
  getTorrentProgress(infoHash) {
    const torrent = this.torrents.get(infoHash);
    if (!torrent) return 0;
    return torrent.progress;
  }
  
  /**
   * Get torrent download speed
   * @param {string} infoHash - Torrent info hash
   * @returns {number} Download speed in bytes per second
   */
  getTorrentSpeed(infoHash) {
    const torrent = this.torrents.get(infoHash);
    if (!torrent) return 0;
    return torrent.downloadSpeed;
  }
  
  /**
   * Destroy the client and clean up resources
   */
  destroy() {
    log('Destroying TorrentStreamer');
    
    // Remove font styles
    const styleElement = document.getElementById('torrent-fonts');
    if (styleElement) {
      styleElement.remove();
    }
    
    // Release blob URLs
    for (const subtitle of this.subtitles) {
      URL.revokeObjectURL(subtitle.url);
    }
    
    for (const font of this.fonts) {
      URL.revokeObjectURL(font.url);
    }
    
    // Close HTTP server
    this.server.close();
    
    // Destroy WebTorrent client
    this.client.destroy();
  }
}