import { ipcMain } from 'electron';
// We'll eventually implement these modules to handle torrent streaming and GStreamer processing.
import TorrentManager from './torrentManager.js';
import GStreamerPipeline from './gstreamerPipeline.js';
import { dynamicFinder } from '../dynamic_fetch.js';


export function registerIpcHandlers() {
    // Start the torrent stream and return stream data (like the non-seekable stream or metadata)
    ipcMain.handle('start-torrent-stream', async (event, torrentId, options) => {
      try {
        const streamData = await TorrentManager.startStream(torrentId, options);
        return streamData;
      } catch (err) {
        console.error('Error starting torrent stream:', err);
        throw err;
      }
    });
  
    // Start the GStreamer pipeline to remux the torrent stream for embedded playback.
    // It should return an output URL or manifest that the renderer can use.
    ipcMain.handle('start-gstreamer-pipeline', async (event, streamData) => {
      try {
        const outputUrl = await GStreamerPipeline.start(streamData);
        return outputUrl;
      } catch (err) {
        console.error('Error starting GStreamer pipeline:', err);
        throw err;
      }
    });

    ipcMain.handle('stop-gstreamer-pipeline', async (event) => {
      try {
        const outputUrl = GStreamerPipeline.stop();
        return outputUrl;
      } catch (err) {
        console.error('Error starting GStreamer pipeline:', err);
        throw err;
      }
    });

    ipcMain.handle('change-subtitle', async (event, subtitleTrack) => {
      try {
        console.log("Changing subtitle track to:", subtitleTrack);
        // TODO: Implement track switching in your GStreamer pipeline (or related module)
        // For example: await GStreamerPipeline.changeSubtitle(subtitleTrack);
        return { success: true };
      } catch (err) {
        console.error("Error changing subtitle:", err);
        throw err;
      }
    });
  
    ipcMain.handle('change-audio', async (event, audioTrack) => {
      try {
        console.log("Changing audio track to:", audioTrack);
        // TODO: Implement track switching in your GStreamer pipeline (or related module)
        // For example: await GStreamerPipeline.changeAudio(audioTrack);
        return { success: true };
      } catch (err) {
        console.error("Error changing audio:", err);
        throw err;
      }
    });
    
}