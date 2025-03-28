// preload.js
import  { contextBridge, ipcRenderer } from 'electron'


// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    startTorrentStream: (animeId, episodeNum, audio) => ipcRenderer.invoke('start-torrent-stream', animeId, episodeNum, audio),
    startGstreamerPipeline: (torrentStreamData) => ipcRenderer.invoke('start-gstreamer-pipeline', torrentStreamData),
    stopGstreamerPipeline: () => ipcRenderer.invoke('stop-gstreamer-pipeline'),
    changeSubtitle: (subtitleTrack) => ipcRenderer.invoke('change-subtitle', subtitleTrack),
    changeAudio: (audioTrack) => ipcRenderer.invoke('change-audio', audioTrack)
});
