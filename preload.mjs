// preload.js
import  { contextBridge, ipcRenderer } from 'electron'
import { startFfmpegPlayer, cleanupFfmpeg, cleanupAllFfmpeg } from './ffmpegHandler.js';



// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    startStream: (magnetLink, fileIndex) => ipcRenderer.invoke('start-stream', magnetLink, fileIndex),
    dynamicFinder: (alID, episodeNum, audio) => ipcRenderer.invoke('dynamic-finder', alID, episodeNum, audio)
});

window.addEventListener('beforeunload', () => {
    cleanupAllFfmpeg();
});
