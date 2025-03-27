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

    ipcMain.handle('dynamic-finder', async (event, alID, episodeNum, audio) => {
        try {
            if (activeTorrent) {
                console.log('Destroying previous active torrent');
                activeTorrent.destroy();
                activeTorrent = null;
            }
            
            console.log("Dynamic Finder Called");
            const result = await dynamicFinder(alID, episodeNum, audio);
            console.log("Magnet Link in ipc:",result.magnetLink);
            console.log("File Index in ipc:", result.fileIndex)
            return result;
        } catch (error) {
            console.error("Error in dynamicFinder:", error);
            throw error; // Re-throw to send the error back to renderer
        }
    });
    
    
  
    // Additional IPC handlers for controlling playback (subtitle switching, audio track changes, etc.)
    // can be added here following a similar pattern.
}