const { contextBridge, ipcRenderer } = require('electron');

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
      // Create the listener function, deliberately stripping the event object
      const subscription = (event, ...args) => func(...args);
      ipcRenderer.on(channel, subscription);
      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    } else {
      console.warn(`Attempted to listen on invalid channel: ${channel}`);
      return () => {}; // Return an empty function
    }
  }


});

contextBridge.exposeInMainWorld('electronAPI', {
  dynamicFinder: (alID, episodeNum, audio) => ipcRenderer.invoke('dynamic-finder', alID, episodeNum, audio)
});

console.log("Minimal preload script executed, electronIPC exposed.");
