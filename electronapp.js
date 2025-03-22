import { app, BrowserWindow, ipcMain } from 'electron';
import http from 'http';
import { getGlobalClient } from './webtorrent-client.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dynamicFinder } from './dynamic_fetch.js';
import { dbInit } from './passive_index.js';
import fluentFfmpeg from 'fluent-ffmpeg';
import fs from 'fs';
// import ffprobeStatic from 'ffprobe-static';
// import ffprobeLib from 'ffprobe';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let streamServer = null;

  
const ffmpeg = fluentFfmpeg;
const ffprobe = (filePath, callback) => {
    return fluentFfmpeg.ffprobe(filePath, callback);
}; 
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


let activeTorrent = null;
ipcMain.handle('start-stream', async (event, magnetLink, fileIndex) => {
  const client = getGlobalClient();

  if (streamServer) {
    console.log("Closing existing stream server");
    streamServer.close();
    streamServer = null;
  }


  return new Promise((resolve, reject) => {
    try {

        // First, destroy any previous active torrent
        if (activeTorrent) {
            console.log('Destroying previous active torrent');
            activeTorrent.destroy();
            activeTorrent = null;
        }

        client.add(magnetLink, { destroyStoreOnDestroy: true }, async (torrent) => {
        activeTorrent = torrent;

        if (!torrent.files[fileIndex]) {
            torrent.destroy();
            return reject(new Error("Invalid file index"));
        }

       
        
        const file = torrent.files[fileIndex];
        console.log(`File ready for streaming: ${file.name} (${file.length} bytes)`);

        let subtitleTracks = [];

        // Dynamically determine the MIME type based on the file extension
        console.log('getting file names')
        const ext = path.extname(file.name).toLowerCase();
        console.log('path exctraction');

        const tempFilePath = path.join(app.getPath('temp'), `torrent-${torrent.infoHash}-${fileIndex}${ext}`);
        console.log('tempFile Path Created')
        // Function to extract subtitle info
        const extractSubtitleInfo = () => {
            return new Promise(async (resolve, reject) => {
                try {
                    console.log("extractSubtitleInfo called");
                    const fileStream = file.createReadStream();
                    const writeStream = fs.createWriteStream(tempFilePath);
                    
                    console.log("file stream created for sub");

                    await new Promise((resolveStream, rejectStream) => {
                        fileStream.pipe(writeStream);
                        writeStream.on('finish', resolveStream);
                        writeStream.on('error', rejectStream);
                    });
                    
                    const info = await new Promise((resolveProbe, rejectProbe) => {
                        ffprobe(tempFilePath, (err, metadata) => {
                            if (err) rejectProbe(err);
                            else resolveProbe(metadata);
                        });
                    });
                    
                    // Extract subtitle tracks
                    if (info && info.streams) {
                        subtitleTracks = info.streams
                            .filter(stream => stream.codec_type === 'subtitle')
                            .map((stream, index) => ({
                                id: stream.index,
                                language: stream.tags && stream.tags.language ? stream.tags.language : `Subtitle ${index+1}`,
                                title: stream.tags && stream.tags.title ? stream.tags.title : `Subtitle ${index+1}`,
                                codec: stream.codec_name
                            }));
                        
                        console.log("Found subtitle tracks:", subtitleTracks);
                    }
                    
                    resolve(subtitleTracks);
                } catch (err) {
                    console.error("Error extracting subtitle info:", err);
                    // Continue even if subtitle extraction fails
                    resolve([]);
                }
            });
        };

        await extractSubtitleInfo();

   
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
            console.log("Creating HTTP Stream Server");
            const url = new URL(req.url, `http://${req.headers.host}`);
            const pathname = url.pathname;
            
            // Handle subtitle requests
            if (pathname.startsWith('/subtitles/')) {
                const subtitleId = parseInt(pathname.split('/').pop());
                if (isNaN(subtitleId) || !subtitleTracks.find(track => track.id === subtitleId)) {
                  res.writeHead(404);
                  res.end("Subtitle not found");
                  return;
                }
                
                // Extract and convert subtitle to WebVTT using ffmpeg
                res.writeHead(200, {
                  "Content-Type": "text/vtt",
                  "Access-Control-Allow-Origin": "*"
                });
                
                ffmpeg(tempFilePath)
                  .noVideo()
                  // Remove .output('pipe:1') to avoid duplicate output specification
                  .outputOptions([
                    '-c:s webvtt',
                    '-map', `0:${subtitleId}`
                  ])
                  .format('webvtt')
                  .on('start', (commandLine) => {
                    console.log("ffmpeg command:", commandLine);
                  })
                  .pipe(res, { end: true })
                  .on('error', (err) => {
                    console.error("Error streaming subtitle:", err);
                    if (!res.headersSent) {
                      res.writeHead(500);
                      res.end("Subtitle extraction error");
                    } else if (!res.writableEnded) {
                      res.end();
                    }
                  });
                
                return;
            }


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
          resolve({ 
            url: "http://localhost:3001/stream", 
            mimeType,
            subtitles: subtitleTracks.map(track => ({
              ...track,
              url: `http://localhost:3001/subtitles/${track.id}`
            }))
          });
        });

        torrent.on('error', (err) => {
          console.error("Torrent error:", err);

          if (streamServer) {
            streamServer.close();
          }

          if (fs.existsSync(tempFilePath)) {
            try {
              fs.unlinkSync(tempFilePath);
            } catch (err) {
              console.error('Error removing temporary file:', err);
            }
          }

        });

        app.on('before-quit', () => {
          if (activeTorrent) {
            activeTorrent.destroy();
          }
          if (streamServer) {
            streamServer.close();
          }
          
          if (fs.existsSync(tempFilePath)) {
            try {
              fs.unlinkSync(tempFilePath);
              console.log('Temporary file removed');
            } catch (err) {
              console.error('Error removing temporary file:', err);
            }
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

    const tempDir = app.getPath('temp');
    try {
      const files = fs.readdirSync(tempDir);
      for (const file of files) {
        if (file.startsWith('torrent-')) {
          fs.unlinkSync(path.join(tempDir, file));
        }
      }
    } catch (err) {
      console.error('Error cleaning up temp files:', err);
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

