// preload.js
import { contextBridge, ipcRenderer } from 'electron';

// Expose a controlled way for the renderer to receive messages
contextBridge.exposeInMainWorld('electronIPC', {
  /**
   * Listen for messages from the main process on specific channels.
   * @param {string} channel - The channel name to listen on.
   * @param {Function} func - The callback function to execute with the data.
   * @returns {Function} - A function to remove this specific listener.
   */
  receive: (channel, func) => {
    // List of channels allowed to be listened to from the main process
    const validChannels = ['subtitle-tracks', 'subtitle-cue', 'subtitle-font'];
    if (validChannels.includes(channel)) {
      // Create the listener function
      // Deliberately strip the 'event' argument from ipcRenderer.on as it includes potentially sensitive sender details
      const subscription = (event, ...args) => func(...args);
      // Add the listener
      ipcRenderer.on(channel, subscription);
      // Return a cleanup function to remove the listener
      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    } else {
      console.warn(`Attempted to listen on invalid channel: ${channel}`);
      return () => {}; // Return empty cleanup function for invalid channels
    }
  }
});

console.log("Minimal preload script executed, electronIPC exposed.");