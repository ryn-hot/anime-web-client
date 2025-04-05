import { app, BrowserWindow, ipcMain } from 'electron';
import http from 'http';
import { getGlobalClient } from './backend/webtorrent-client.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dynamicFinder } from './backend/dynamic_fetch.js';

// import ffprobeStatic from 'ffprobe-static';
// import ffprobeLib from 'ffprobe';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

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

