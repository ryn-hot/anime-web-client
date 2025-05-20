import { app, BrowserWindow, ipcMain, session } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { dynamicFinder } from './backend/dynamic_fetch.js';
import StreamServer from './modules/http-server.js';
import fs from 'fs';
import os   from 'os';




const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let streamServer;

ipcMain.handle('dynamic-finder', async (event, alID, episodeNum, audio) => {
    try {
        console.log("Dynamic Finder Called");
        const result = await dynamicFinder(alID, episodeNum, audio);
        console.log("Magnet Link in ipc:",result.magnetLink);
        console.log("File Index in ipc:", result.fileIndex)

        // Check if server exists and trigger loading
        if (streamServer) {
          console.log("IPC: Triggering server to load torrent...");
          // Now call the server to load the torrent
          const streamUrl = await streamServer.loadTorrentAndServe(result.magnetLink, result.fileIndex, audio);
          console.log("IPC: Server started loading, stream URL:", streamUrl);
          // You might return the streamUrl if the frontend needs it immediately
          // return { streamUrl: streamUrl }; // Or combine with original result if needed
          return streamUrl; // Send stream URL back to renderer
        } else {
          console.error("IPC Error: StreamServer not initialized when dynamic-finder was called.");
          throw new Error("Server not ready");
        }

    } catch (error) {
        console.error("Error in dynamicFinder:", error);
        throw error; // Re-throw to send the error back to renderer
    }
});


// Function to initialize the server
async function initializeServer() {
  if (streamServer) {
      console.log("Server already initialized.");
      return;
  }
  console.log("Initializing StreamServer...");
  streamServer = new StreamServer(); // Instantiate the server

  if (mainWindow) {
      streamServer.setWindow(mainWindow); // Set the window reference for IPC
  } else {
      console.warn("MainWindow not available when initializing server. IPC might fail until window is set.");
      // Optional: Set it later if window creation happens after server start
      // app.on('browser-window-created', (event, window) => {
      //    if (!mainWindow) mainWindow = window; // Assuming first window is main
      //    streamServer.setWindow(mainWindow);
      // });
  }

  try {
      const address = await streamServer.start(); // Start the server
      console.log(`Streaming server started successfully at http://localhost:${address.port}`);
  } catch (error) {
      console.error("Failed to start stream server:", error);
      streamServer = null; // Nullify on error maybe? Or handle differently.
      // Consider notifying the user or quitting?
  }
}

async function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js')
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

export function purgeTmpMuxFiles() {
  const dir    = os.tmpdir();          // same place you write the muxes
  const keepMs = 1;  // OPTIONAL: only wipe files older than 24 h

  // pattern your muxer creates, e.g.
  // 675093f262ff780c673e89c3bf7eea24a299be4f_0_1_copy.mkv
  const muxRx = /^[0-9a-f]{40}_\d+_\d+_(copy|aac)\.mkv$/i;

  for (const file of fs.readdirSync(dir)) {
    if (!muxRx.test(file)) continue;

    const full = path.join(dir, file);
    try {
      const { mtimeMs } = fs.statSync(full);
      if (Date.now() - mtimeMs > keepMs) {
        fs.rmSync(full, { force: true });
        console.log(`Purging File: `, file)
      }
    } catch (err) {
      console.warn('[purgeTmpMuxFiles]', err.message);
    }
  }
}


const { rm } = fs.promises;          // ← promise version

let cleanupRan = false;              // guard so we don’t run twice


async function cleanupResources() {
  if (cleanupRan) return;
  cleanupRan = true;

  console.log("Cleaning up resources...");
  if (streamServer) {
      streamServer.close();
      streamServer = null;
      console.log("StreamServer closed.");
  }
}


app.whenReady().then(async () => {
  // await session.defaultSession.clearStorageData();
  await createWindow(); // Create the UI window first
  await initializeServer(); // Then initialize the server
  purgeTmpMuxFiles();  

  app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) {
          createWindow();
          // If re-creating window, ensure server knows about it
           if (streamServer && mainWindow) {
               streamServer.setWindow(mainWindow);
           }
      }
  });
});

app.on('before-quit', cleanupResources);

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', async () => {
    await cleanupResources();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
});

