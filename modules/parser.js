import { debug, bufferToUrl, convertAssToVtt } from './util.js';

const log = debug('parser');

export default class MediaParser {
  constructor() {
    this.tracks = [];
    this.subtitles = [];
    this.fonts = [];
  }

  async parseFile(file) {
    log(`Parsing file: ${file.name}`);
    
    if (file.name.endsWith('.mkv') || file.name.endsWith('.webm')) {
      return this.parseMKV(file);
    } else if (file.name.endsWith('.mp4') || file.name.endsWith('.mov')) {
      return this.parseMP4(file);
    } else {
      // For other formats, just return basic info
      return {
        type: 'video',
        mimeType: this.getMimeType(file.name),
        tracks: [],
        subtitles: []
      };
    }
  }
  
  async parseMKV(file) {
    log('Parsing MKV file');
    
    try {
      // In a real implementation, you'd use matroska-metadata here
      // For demo purposes, we'll use a simplified approach
      const { Metadata } = await import('matroska-metadata');
      
      const metadata = new Metadata(file);
      const tracks = await metadata.getTracks();
      
      this.tracks = tracks.map(track => ({
        id: track.number,
        type: track.type,
        codec: track.codec,
        language: track.language || 'und',
        default: track.default
      }));
      
      // Set up subtitle extraction
      metadata.on('subtitle', (subtitle, trackNumber) => {
        this.subtitles.push({
          trackNumber,
          time: subtitle.time,
          text: subtitle.text
        });
      });
      
      // Parse attachments for fonts
      const attachments = await metadata.getAttachments();
      for (const attachment of attachments) {
        if (attachment.mimetype && attachment.mimetype.toLowerCase().includes('font')) {
          this.fonts.push({
            name: attachment.filename,
            data: attachment.data,
            mimetype: attachment.mimetype
          });
        }
      }
      
      return {
        type: 'mkv',
        tracks: this.tracks,
        subtitles: this.subtitles,
        fonts: this.fonts
      };
    } catch (error) {
      log(`Error parsing MKV: ${error.message}`);
      return {
        type: 'video',
        mimeType: 'video/matroska',
        tracks: [],
        subtitles: []
      };
    }
  }
  
  async parseMP4(file) {
    log('Parsing MP4 file');
    
    // For MP4 files, we rely more on the browser's capabilities
    // but we can still extract some metadata if needed
    try {
      // In a real implementation, you might use mp4box.js here
      return {
        type: 'mp4',
        mimeType: 'video/mp4',
        tracks: [],
        subtitles: []
      };
    } catch (error) {
      log(`Error parsing MP4: ${error.message}`);
      return {
        type: 'video',
        mimeType: 'video/mp4',
        tracks: [],
        subtitles: []
      };
    }
  }
  
  processTorrentSubtitle(file, buffer) {
    const extension = file.name.split('.').pop().toLowerCase();
    let mimeType;
    let content = buffer;
    
    switch (extension) {
      case 'srt':
        // Convert SRT to WebVTT
        content = 'WEBVTT\n\n' + 
          buffer.toString('utf-8')
                .replace(/(\d+):(\d+):(\d+),(\d+)/g, '$1:$2:$3.$4')
                .replace(/\r\n/g, '\n');
        mimeType = 'text/vtt';
        break;
      case 'vtt':
        mimeType = 'text/vtt';
        break;
      case 'ass':
      case 'ssa':
        // Convert ASS to WebVTT for browser compatibility
        content = convertAssToVtt(buffer.toString('utf-8'));
        mimeType = 'text/vtt';
        break;
      default:
        mimeType = 'text/plain';
    }
    
    const url = bufferToUrl(content, mimeType);
    
    // Try to detect language from filename
    const filenameLower = file.name.toLowerCase();
    let language = 'en';
    if (filenameLower.includes('.jp.') || filenameLower.includes('.jpn.')) {
      language = 'ja';
    } else if (filenameLower.includes('.fr.') || filenameLower.includes('.fre.')) {
      language = 'fr';
    }
    // Add more language detection as needed
    
    return {
      label: file.name,
      url,
      lang: language,
      mimeType
    };
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
      default:
        return 'video/mp4';
    }
  }
}