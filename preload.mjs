// preload.js
import  { contextBridge, ipcRenderer } from 'electron'
import { startFfmpegPlayer } from './ffmpegHandler.js';



// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    startStream: (magnetLink, fileIndex) => ipcRenderer.invoke('start-stream', magnetLink, fileIndex),
    startFfmpeg: (streamUrl, canvasId, width, height) => startFfmpegPlayer(streamUrl, canvasId, width, height),
    dynamicFinder: (alID, episodeNum, audio) => ipcRenderer.invoke('dynamic-finder', alID, episodeNum, audio)
});


