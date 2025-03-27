// src/renderer/uiController.js
export class UIController {
    /**
     * @param {VideoPlayer} videoPlayer - Instance of the VideoPlayer.
     * @param {Object} controlElements - Object with DOM elements for controls.
     *   Expected keys: playPauseButton, subtitleSelect, audioSelect.
     */
    constructor(videoPlayer, controlElements) {
      this.videoPlayer = videoPlayer;
      this.playPauseButton = controlElements.playPauseButton;
      this.subtitleSelect = controlElements.subtitleSelect;
      this.audioSelect = controlElements.audioSelect;
    }
  
    /**
     * Initialize UI control event listeners.
     */
    init() {
      if (this.playPauseButton) {
        this.playPauseButton.addEventListener('click', () => this.togglePlayPause());
      }
      if (this.subtitleSelect) {
        this.subtitleSelect.addEventListener('change', (e) => this.changeSubtitle(e.target.value));
      }
      if (this.audioSelect) {
        this.audioSelect.addEventListener('change', (e) => this.changeAudio(e.target.value));
      }
    }
  
    /**
     * Toggles play and pause for the video element.
     */
    togglePlayPause() {
      if (this.videoPlayer.videoElement.paused) {
        this.videoPlayer.videoElement.play();
        this.playPauseButton.innerHTML = '<i class="fas fa-pause"></i>';
      } else {
        this.videoPlayer.videoElement.pause();
        this.playPauseButton.innerHTML = '<i class="fas fa-play"></i>';
      }
    }
  
    /**
     * Handler for changing subtitle tracks.
     * @param {string} subtitleTrack - The selected subtitle track identifier.
     */
    changeSubtitle(subtitleTrack) {
      console.log("Subtitle track changed to:", subtitleTrack);
      // For example, trigger an IPC call to update the backend:
      // window.electronAPI.changeSubtitle(subtitleTrack);
    }
  
    /**
     * Handler for changing audio tracks.
     * @param {string} audioTrack - The selected audio track identifier.
     */
    changeAudio(audioTrack) {
      console.log("Audio track changed to:", audioTrack);
      // For example, trigger an IPC call to update the backend:
      // window.electronAPI.changeAudio(audioTrack);
    }
  }
  