// preload.js
import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Anime data functions
  dynamicFinder: (alID, episodeNum, audio) => 
    ipcRenderer.invoke('dynamic-finder', alID, episodeNum, audio),
    
  // Video streaming functions
  streamTorrent: (alID, episodeNum, audio) => 
    ipcRenderer.invoke('stream-torrent', alID, episodeNum, audio),
    
  // Get torrent statistics
  getTorrentStats: (alID, episodeNum, audio) =>
    ipcRenderer.invoke('get-torrent-stats', alID, episodeNum, audio),
    
  // Video player status
  onTorrentProgress: (callback) => {
    ipcRenderer.on('torrent-progress', (_, data) => callback(data));
    return () => {
      ipcRenderer.removeAllListeners('torrent-progress');
    };
  },
  
  // System integration
  openExternalLink: (url) => ipcRenderer.invoke('open-external-link', url)
});

// Add some utility functions directly available in the renderer process
contextBridge.exposeInMainWorld('utils', {
  formatBytes: (bytes, decimals = 2) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  },
  
  getMimeType: (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    switch (ext) {
      case 'mp4':
        return 'video/mp4';
      case 'webm':
        return 'video/webm';
      case 'mkv':
        return 'video/x-matroska';
      case 'avi':
        return 'video/x-msvideo';
      default:
        return 'video/mp4';
    }
  },
  
  getExtension: (filename) => {
    return filename.split('.').pop().toLowerCase();
  }
});