// Updated electronapp.js with video streaming support
import { app, BrowserWindow, ipcMain, protocol } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import ffmpegPath from 'ffmpeg-static';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import http from 'http';
import { createReadStream } from 'fs';
import fluent_ffmpeg from 'fluent-ffmpeg';

// Import your existing functions
import { dynamicFinder } from './dynamic_fetch.js';
import { getGlobalClient } from './webtorrent-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let webTorrentClient = null;
let videoStreamServer = null;
let serverPort = 3000;
let activeTorrents = new Map(); // Store active torrents by anime ID and episode

// Set FFmpeg path
process.env.FFMPEG_PATH = ffmpegPath;
fluent_ffmpeg.setFfmpegPath(ffmpegPath);

async function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Load the index.html file
  await mainWindow.loadFile(path.join(__dirname, 'frontend', 'index.html'));
  
  // Handle window being closed
  mainWindow.on('closed', () => {
    // Clean up all torrents and server
    cleanupTorrents();
    stopStreamServer();
    mainWindow = null;
  });
}

// Initialize WebTorrent client

// Start HTTP server for streaming
function startStreamServer() {
  if (videoStreamServer) return serverPort;

  const tempDir = path.join(app.getPath('temp'), 'secretanime-streams');
  
  // Create temp directory if it doesn't exist
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  videoStreamServer = http.createServer((req, res) => {
    const requestPath = decodeURIComponent(req.url.slice(1));
    const filePath = path.join(tempDir, requestPath);
    
    if (!fs.existsSync(filePath)) {
      res.statusCode = 404;
      res.end('File not found');
      return;
    }
    
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;
    
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': getMimeTypeFromFilePath(filePath)
      });
      
      const fileStream = createReadStream(filePath, { start, end });
      fileStream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': getMimeTypeFromFilePath(filePath)
      });
      
      const fileStream = createReadStream(filePath);
      fileStream.pipe(res);
    }
  });
  
  videoStreamServer.on('error', (err) => {
    console.error('Stream server error:', err);
  });
  
  videoStreamServer.listen(serverPort);
  return serverPort;
}

// Get MIME type from file extension
function getMimeTypeFromFilePath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.mp4':
      return 'video/mp4';
    case '.webm':
      return 'video/webm';
    case '.mkv':
      return 'video/x-matroska';
    case '.avi':
      return 'video/x-msvideo';
    default:
      return 'application/octet-stream';
  }
}

// Stop stream server
function stopStreamServer() {
  if (videoStreamServer) {
    videoStreamServer.close();
    videoStreamServer = null;
  }
}

// Clean up all torrents
function cleanupTorrents() {
  if (webTorrentClient) {
    webTorrentClient.destroy();
    webTorrentClient = null;
  }
  activeTorrents.clear();
}

// Handle the 'stream-torrent' IPC request
async function handleStreamTorrent(animeId, episodeNumber, audioType) {
  try {
    // Get torrent info using dynamicFinder
    const torrentInfo = await dynamicFinder(animeId, episodeNumber, audioType);
    
    if (!torrentInfo || !torrentInfo.magnetLink) {
      throw new Error('No valid torrent info found');
    }
    
    // Check if we already have this torrent
    const torrentKey = `${animeId}-${episodeNumber}-${audioType}`;
    let activeTorrent = activeTorrents.get(torrentKey);
    
    // If not, add it
    if (!activeTorrent) {
      const client = getGlobalClient();
      
      // Start the stream server if not running
      const port = startStreamServer();
      
      // Get the temp dir
      const tempDir = path.join(app.getPath('temp'), 'secretanime-streams');
      
      // Add the torrent
      activeTorrent = await new Promise((resolve, reject) => {
        const torrent = client.add(torrentInfo.magnetLink, { path: tempDir });
        
        torrent.on('ready', () => {
          console.log(`Torrent ready: ${torrent.name}`);
          resolve(torrent);
        });
        
        torrent.on('error', (err) => {
          console.error('Torrent error:', err);
          reject(err);
        });
        
        // Clean up after torrent is done
        torrent.on('done', () => {
          console.log(`Torrent downloaded: ${torrent.name}`);
        });
      });
      
      // Store the active torrent
      activeTorrents.set(torrentKey, activeTorrent);
    }
    
    // Get the target file
    const targetFile = activeTorrent.files[torrentInfo.fileIndex];
    if (!targetFile) {
      throw new Error('Target file not found in torrent');
    }
    
    // Ensure the file path is unique
    const uniqueFileName = `${animeId}-${episodeNumber}-${audioType}${path.extname(targetFile.name)}`;
    const filePath = path.join('secretanime-streams', uniqueFileName);
    
    // Create a symbolic link or copy if needed
    const tempDir = path.join(app.getPath('temp'), 'secretanime-streams');
    const actualFilePath = path.join(tempDir, targetFile.path);
    const uniqueFilePath = path.join(tempDir, uniqueFileName);
    
    // Only create link if target file exists and link doesn't
    try {
      await fs.promises.access(actualFilePath, fs.constants.F_OK);
      if (!fs.existsSync(uniqueFilePath)) {
        // Try to use symlink, but fall back to copy if symlink fails
        try {
          await fs.promises.symlink(actualFilePath, uniqueFilePath);
        } catch (e) {
          // If symlink fails (e.g., on Windows without admin), use stream copy
          console.log('Symlink failed, using copy instead');
          const readStream = fs.createReadStream(actualFilePath);
          const writeStream = fs.createWriteStream(uniqueFilePath);
          await pipeline(readStream, writeStream);
        }
      }
    } catch (err) {
      console.warn('File not fully downloaded yet, will be available soon');
    }
    
    // Return a stream URL for the renderer to use
    return {
      url: `http://localhost:${serverPort}/${uniqueFileName}`,
      fileName: targetFile.name,
      mimeType: getMimeTypeFromFilePath(targetFile.name),
      torrentStats: {
        peers: activeTorrent.numPeers,
        progress: Math.round(activeTorrent.progress * 100),
        downloadSpeed: formatBytes(activeTorrent.downloadSpeed) + '/s',
        uploadSpeed: formatBytes(activeTorrent.uploadSpeed) + '/s'
      }
    };
  } catch (error) {
    console.error('Error in handleStreamTorrent:', error);
    throw error;
  }
}

// Format bytes to human-readable format
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Set up IPC handlers
function setupIpcHandlers() {
  // Handle 'dynamic-finder' IPC request
  ipcMain.handle('dynamic-finder', async (event, animeId, episodeNumber, audioType) => {
    try {
      return await dynamicFinder(animeId, episodeNumber, audioType);
    } catch (error) {
      console.error('Error in dynamicFinder IPC handler:', error);
      throw error;
    }
  });
  
  // Handle 'stream-torrent' IPC request
  ipcMain.handle('stream-torrent', async (event, animeId, episodeNumber, audioType) => {
    try {
      return await handleStreamTorrent(animeId, episodeNumber, audioType);
    } catch (error) {
      console.error('Error in streamTorrent IPC handler:', error);
      throw error;
    }
  });
  
  // Handle 'get-torrent-stats' IPC request
  ipcMain.handle('get-torrent-stats', (event, animeId, episodeNumber, audioType) => {
    const torrentKey = `${animeId}-${episodeNumber}-${audioType}`;
    const activeTorrent = activeTorrents.get(torrentKey);
    
    if (!activeTorrent) {
      return null;
    }
    
    return {
      peers: activeTorrent.numPeers,
      progress: Math.round(activeTorrent.progress * 100),
      downloadSpeed: formatBytes(activeTorrent.downloadSpeed) + '/s',
      uploadSpeed: formatBytes(activeTorrent.uploadSpeed) + '/s'
    };
  });
}

function setupVideoSupport() {
  // Essential flags for hardware acceleration and video support
  app.commandLine.appendSwitch('enable-accelerated-mjpeg-decode');
  app.commandLine.appendSwitch('enable-accelerated-video');
  app.commandLine.appendSwitch('disable-gpu-driver-bug-workarounds');
  app.commandLine.appendSwitch('ignore-gpu-blacklist');
  app.commandLine.appendSwitch('enable-native-gpu-memory-buffers');
  app.commandLine.appendSwitch('enable-gpu-rasterization');
  
  // Media codec support
  app.commandLine.appendSwitch('enable-features', 'PlatformHEVCDecoderSupport');
  
  // Autoplay policy to allow autoplay without user interaction
  app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
  
  // Register file protocol for secure local file access
  protocol.registerFileProtocol('secure-file', (request, callback) => {
    const url = request.url.replace('secure-file://', '');
    const filePath = path.normalize(decodeURIComponent(url));
    callback({ path: filePath });
  });
}

// Create window when app is ready
app.whenReady().then(() => {
  setupVideoSupport();
  setupIpcHandlers();
  createWindow();
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  cleanupTorrents();
  stopStreamServer();
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Cleanup before quit
app.on('will-quit', () => {
  cleanupTorrents();
  stopStreamServer();
});