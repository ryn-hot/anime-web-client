// preload.js
import  { contextBridge, ipcRenderer } from 'electron'




// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    dynamicFinder: (alID, episodeNum, audio) => ipcRenderer.invoke('dynamic-finder', alID, episodeNum, audio)
});
