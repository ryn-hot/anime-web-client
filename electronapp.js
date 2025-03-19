import { app, BrowserWindow, ipcMain } from 'electron';
import http from 'http';
import { getGlobalClient } from './webtorrent-client.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dynamicFinder } from './dynamic_fetch.js';
import { dbInit } from './passive_index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let streamServer = null;

// await dbInit();

ipcMain.handle('dynamic-finder', async (event, alID, episodeNum, audio) => {
    try {
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


ipcMain.handle('start-stream', async (event, magnetLink, fileIndex) => {
  const client = getGlobalClient();
  return new Promise((resolve, reject) => {
    try {
      let activeTorrent = null;

      client.add(magnetLink, { destroyStoreOnDestroy: true }, (torrent) => {
        activeTorrent = torrent;

        if (!torrent.files[fileIndex]) {
          torrent.destroy();
          return reject(new Error("Invalid file index"));
        }

        const file = torrent.files[fileIndex];
        console.log(`File ready for streaming: ${file.name} (${file.length} bytes)`);

        // Dynamically determine the MIME type based on the file extension
        const ext = path.extname(file.name).toLowerCase();
        let mimeType;
        switch (ext) {
          case '.mp4':
            mimeType = 'video/mp4';
            break;
          case '.mkv':
            mimeType = 'video/x-matroska';
            break;
          case '.webm':
            mimeType = 'video/webm';
            break;
          default:
            mimeType = 'application/octet-stream';
        }

        // Stop any existing server
        if (streamServer) {
          streamServer.close();
          streamServer = null;
        }

        // Create a new HTTP server to serve the file stream
        streamServer = http.createServer((req, res) => {
          // Optionally, you can check req.url (e.g. only handle '/stream')
          console.log("Stream request received");
          const range = req.headers.range;
          const fileSize = file.length;
          let start = 0,
            end = fileSize - 1;

          if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            start = parseInt(parts[0], 10);
            end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

            // Optionally, remove or adjust the chunk size limit for FFmpeg

            res.writeHead(206, {
              "Content-Range": `bytes ${start}-${end}/${fileSize}`,
              "Accept-Ranges": "bytes",
              "Content-Length": end - start + 1,
              "Content-Type": mimeType,
              "Connection": "keep-alive"
            });
          } else {
            res.writeHead(200, {
              "Content-Length": fileSize,
              "Content-Type": mimeType,
              "Connection": "keep-alive"
            });
          }

          // Create a read stream from the file
          const fileStream = file.createReadStream({ start, end });

          fileStream.on('error', (err) => {
            console.error("File stream error:", err);
            if (!res.headersSent) {
              res.writeHead(500);
              res.end("Internal Server Error");
            } else if (!res.writableEnded) {
              res.end();
            }
          });

          fileStream.on('end', () => {
            console.log(`Stream range ${start}-${end} completed`);
          });

          // Clean up when client disconnects
          res.on('close', () => {
            console.log("HTTP response closed");
            fileStream.destroy();
          });

          fileStream.pipe(res).on('error', (err) => {
            console.error("Error piping stream:", err);
          });
        });

        streamServer.on('error', (err) => {
          console.error("Stream server error:", err);
          if (activeTorrent) {
            activeTorrent.destroy();
          }
          reject(err);
        });

        streamServer.listen(3001, () => {
          console.log("Stream server listening on port 3001");
          // Optionally, you could resolve an object that includes the MIME type:
          resolve({ url: "http://localhost:3001/stream", mimeType });
        });

        torrent.on('error', (err) => {
          console.error("Torrent error:", err);
          if (streamServer) {
            streamServer.close();
          }
        });

        app.on('before-quit', () => {
          if (activeTorrent) {
            activeTorrent.destroy();
          }
          if (streamServer) {
            streamServer.close();
          }
        });
      }).on('error', err => {
        console.error('Torrent add error:', err.message);
        reject(err);
      });

      client.on('error', (err) => {
        console.error("WebTorrent client error:", err);
        reject(err);
      });
    } catch (err) {
      console.error("Error in start-stream:", err);
      reject(err);
    }
  });
});



async function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      webSecurity: false,
      preload: path.join(__dirname, 'preload.mjs')
    }
  });

  // Load the index.html file
  await mainWindow.loadFile(path.join(__dirname, 'frontend', 'index.html'));
  
  mainWindow.webContents.openDevTools();
  // Open DevTools during development
  // mainWindow.webContents.openDevTools();
  
  // Handle window being closed
  mainWindow.on('closed', () => {
    mainWindow = null;  
  });
}

function cleanupResources() {
    console.log('Cleaning up resources...');
    
    // Close any active HTTP server
    if (streamServer) {
      console.log('Closing stream server');
      streamServer.close();
      streamServer = null;
    }
    
    // Destroy WebTorrent client if it exists
    const client = getGlobalClient();
    if (client) {
      console.log('Destroying WebTorrent client');
      client.destroy();
    }
}


// Create window when app is ready
app.whenReady().then(() => {

    createWindow();

});

app.on('before-quit', cleanupResources);
app.on('will-quit', cleanupResources);

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
    cleanupResources();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
});

