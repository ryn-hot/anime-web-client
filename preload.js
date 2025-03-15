// In preload.js
import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Example: expose a function to search anime
  searchAnime: (query) => ipcRenderer.invoke('search-anime', query),
  // Add more API methods as needed
});