// src/main/index.js
import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { registerIpcHandlers } from './ipcHandlers.js';

// Resolve __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true, // Enforce context isolation for security
      preload: path.join(__dirname, '../preload/preload.js'), // Preload script for secure IPC
    },
  });

  // Load the front-end HTML file
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Optionally open the DevTools during development
  mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// When Electron is ready, register IPC handlers and create the window
app.on('ready', () => {
  registerIpcHandlers();
  createWindow();
});

// Quit the app when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Re-create a window when the app is activated (macOS specific)
app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
