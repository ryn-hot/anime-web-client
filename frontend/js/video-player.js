export default class VideoPlayer {
    constructor(elementId) {
      this.videoElement = document.getElementById(elementId);
      if (!this.videoElement) {
        throw new Error(`Video element with ID ${elementId} not found`);
      }
      
      this.videoElement.controls = true;
      this.videoElement.crossOrigin = 'anonymous';
      
      // Set up event listeners
      this.setupEventListeners();
    }
    
    setupEventListeners() {
      this.videoElement.addEventListener('error', (e) => {
        console.error('Video error:', e);
      });
      
      this.videoElement.addEventListener('loadedmetadata', () => {
        console.log('Video metadata loaded');
      });
      
      this.videoElement.addEventListener('play', () => {
        console.log('Video started playing');
      });
      
      this.videoElement.addEventListener('pause', () => {
        console.log('Video paused');
      });
      
      this.videoElement.addEventListener('ended', () => {
        console.log('Video ended');
      });
    }
    
    /**
     * Set the video source
     * @param {string} url - Video URL
     * @param {string} mimeType - MIME type of the video
     */
    setSource(url, mimeType) {
      this.videoElement.src = url;
      this.videoElement.type = mimeType;
    }
    
    /**
     * Add subtitle tracks
     * @param {Array} subtitles - Array of subtitle objects
     */
    addSubtitles(subtitles) {
      // Remove existing tracks
      while (this.videoElement.firstChild) {
        this.videoElement.removeChild(this.videoElement.firstChild);
      }
      
      // Add new tracks
      for (const subtitle of subtitles) {
        const track = document.createElement('track');
        track.kind = 'subtitles';
        track.label = subtitle.label;
        track.srclang = subtitle.lang;
        track.src = subtitle.url;
        
        // Make the first track default
        if (subtitles.indexOf(subtitle) === 0) {
          track.default = true;
        }
        
        this.videoElement.appendChild(track);
      }
    }
    
    /**
     * Play the video
     */
    play() {
      this.videoElement.play();
    }
    
    /**
     * Pause the video
     */
    pause() {
      this.videoElement.pause();
    }
    
    /**
     * Set the current time
     * @param {number} time - Time in seconds
     */
    setTime(time) {
      this.videoElement.currentTime = time;
    }
    
    /**
     * Get the current time
     * @returns {number} Current time in seconds
     */
    getCurrentTime() {
      return this.videoElement.currentTime;
    }
    
    /**
     * Get the video duration
     * @returns {number} Duration in seconds
     */
    getDuration() {
      return this.videoElement.duration;
    }
    
    /**
     * Set the volume
     * @param {number} volume - Volume (0-1)
     */
    setVolume(volume) {
      this.videoElement.volume = Math.max(0, Math.min(1, volume));
    }
    
    /**
     * Check if the video is playing
     * @returns {boolean} True if playing
     */
    isPlaying() {
      return !this.videoElement.paused;
    }
  }