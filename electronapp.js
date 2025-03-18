import { app, BrowserWindow, ipcMain } from 'electron';
import http from 'http';
import { getGlobalClientTest } from './webtorrent-client.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dynamicFinder } from './dynamic_fetch.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let streamServer = null;

ipcMain.handle('dynamic-finder', async (event, alID, episodeNum, audio) => {
    try {
      const result = await dynamicFinder(alID, episodeNum, audio);
      return result;
    } catch (error) {
      console.error("Error in dynamicFinder:", error);
      throw error; // Re-throw to send the error back to renderer
    }
});

ipcMain.handle('start-stream', async (event, magnetLink, fileIndex) => {
    const client = getGlobalClientTest();
    return new Promise((resolve, reject) => {
      client.add(magnetLink, (torrent) => { 
        if (!torrent.files[fileIndex]) {
          return reject(new Error("Invalid file index"));
        }
        const file = torrent.files[fileIndex];
  
        // If the server isn’t running yet, create it.
        if (!streamServer) {
          streamServer = http.createServer((req, res) => {
            // For production you may want to support range requests.
            file.createReadStream().pipe(res);
          }).listen(3001, () => {
            console.log("Stream server listening on port 3001");
          });
        }
        // Return the local HTTP URL.
        resolve("http://localhost:3001/stream");
      });
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




// Create window when app is ready
app.whenReady().then(() => {

    createWindow();

});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
});

