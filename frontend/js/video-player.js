// This code should be added to your watch.js file

// Video Player Manager for SecretAnime
export class VideoPlayerManager {
    constructor() {
      this.videoContainer = document.querySelector('.video-container');
      this.videoElement = null;
      this.currentEpisode = null;
      this.currentAudio = 'sub'; // Default to subbed version
      this.currentAnimeId = null;
      this.plyr = null;
      this.torrentStats = null;
      
      // Initialize the video player
      this.initPlayer();
      
      // Listen for audio option changes
      this.setupAudioOptionListeners();
    }
    
    // Initialize the player with HTML and styles
    initPlayer() {
      // Clear existing content
      this.videoContainer.innerHTML = `
        <div class="player-container">
          <video id="player" crossorigin playsinline controls class="video-js"></video>
          <div class="torrent-stats">
            <span class="download-speed"><i class="fas fa-download"></i> <span>0 KB/s</span></span>
            <span class="upload-speed"><i class="fas fa-upload"></i> <span>0 KB/s</span></span>
            <span class="peers"><i class="fas fa-users"></i> <span>0</span></span>
            <span class="progress-percent"><i class="fas fa-percentage"></i> <span>0%</span></span>
          </div>
          <div class="loading-overlay">
            <div class="spinner"></div>
            <div class="loading-text">Connecting to peers...</div>
          </div>
        </div>
      `;
      
      // Store references
      this.videoElement = document.getElementById('player');
      this.torrentStats = document.querySelector('.torrent-stats');
      this.loadingOverlay = document.querySelector('.loading-overlay');
      
      // Hide stats initially
      this.torrentStats.style.display = 'none';
      
      // Create and add styles
      this.addPlayerStyles();
      
      // Initialize Plyr for better controls
      if (window.Plyr) {
        this.plyr = new Plyr('#player', {
          captions: { active: true, update: true },
          quality: { default: 720, options: [1080, 720, 480, 360] },
          speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] }
        });
      }
    }
    
    // Set up listeners for audio option changes (sub/dub)
    setupAudioOptionListeners() {
      const sourceButtons = document.querySelectorAll('.source-button');
      if (sourceButtons.length) {
        sourceButtons.forEach(button => {
          button.addEventListener('click', () => {
            const audioType = button.dataset.type; // 'sub' or 'dub'
            if (audioType !== this.currentAudio) {
              this.currentAudio = audioType;
              
              // If we have a current episode, reload with new audio
              if (this.currentEpisode && this.currentAnimeId) {
                this.loadEpisode(this.currentAnimeId, this.currentEpisode, this.currentAudio);
              }
            }
          });
        });
      }
    }
    
    // Add styles for the player
    addPlayerStyles() {
      const styleId = 'video-player-styles';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          .player-container {
            position: relative;
            width: 100%;
            border-radius: 8px 8px 0 0;
            overflow: hidden;
            background-color: #000;
          }
          
          #player {
            width: 100%;
            height: auto;
            max-height: 70vh;
            background: #000;
          }
          
          .torrent-stats {
            display: flex;
            justify-content: space-between;
            padding: 8px 12px;
            background-color: #1a1a1a;
            font-size: 14px;
            color: #ccc;
          }
          
          .torrent-stats i {
            margin-right: 5px;
            color: #e74c3c;
          }
          
          .loading-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 10;
          }
          
          .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            border-top-color: #e74c3c;
            animation: spin 1s ease-in-out infinite;
            margin-bottom: 15px;
          }
          
          .loading-text {
            color: white;
            font-size: 16px;
          }
          
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `;
        document.head.appendChild(style);
      }
    }
    
    // Load and play a specific episode
    async loadEpisode(animeId, episodeNumber, audioType = 'sub') {
      // Show loading overlay
      this.showLoading(true);
      
      try {
        // Save current episode info
        this.currentEpisode = episodeNumber;
        this.currentAudio = audioType;
        this.currentAnimeId = animeId;
        
        // Update UI to show selected episode
        this.updateEpisodeSelection(episodeNumber);
        
        // Use the electronAPI to get torrent info
        const torrentData = await window.electronAPI.dynamicFinder(animeId, episodeNumber, audioType);
        
        if (!torrentData) {
          this.showError("Couldn't find video source for this episode.");
          return;
        }
        
        // Now we have the magnet link and file index
        console.log(`Starting to stream: ${torrentData.fileName} (index: ${torrentData.fileIndex})`);
        
        // Request streaming from the backend
        const videoSrc = await window.electronAPI.streamTorrent(animeId, episodeNumber, audioType);
        
        // Show torrent stats
        this.torrentStats.style.display = 'flex';
        
        // Set up torrent stats update interval
        this.statsInterval = setInterval(() => {
          this.updateTorrentStats();
        }, 1000);
        
        // Hide loading overlay when video can play
        this.videoElement.addEventListener('canplay', () => {
          this.showLoading(false);
        }, { once: true });
        
        // Handle video end
        this.videoElement.addEventListener('ended', () => {
          clearInterval(this.statsInterval);
          // Optionally auto-play next episode
          // this.loadEpisode(animeId, episodeNumber + 1, audioType);
        }, { once: true });
        
        // Handle errors
        this.videoElement.addEventListener('error', () => {
          this.showError("Error playing video. Try another source or episode.");
          clearInterval(this.statsInterval);
        }, { once: true });
        
      } catch (error) {
        console.error('Error loading episode:', error);
        this.showError("Failed to load episode. Please try again.");
        this.showLoading(false);
      }
    }
    
    // Update episode selection UI
    updateEpisodeSelection(episodeNumber) {
      // Update the active state of episode buttons
      const episodeButtons = document.querySelectorAll('.episode-button');
      episodeButtons.forEach(button => {
        if (parseInt(button.textContent) === episodeNumber) {
          button.classList.add('active');
        } else {
          button.classList.remove('active');
        }
      });
      
      // Update the active state of episode cards
      const episodeCards = document.querySelectorAll('.episode-card');
      episodeCards.forEach(card => {
        const cardEpNumber = card.querySelector('.episode-number-overlay');
        if (cardEpNumber && parseInt(cardEpNumber.textContent.replace('EP ', '')) === episodeNumber) {
          card.classList.add('active');
        } else {
          card.classList.remove('active');
        }
      });
    }
    
    // Show/hide loading overlay
    showLoading(show) {
      if (this.loadingOverlay) {
        this.loadingOverlay.style.display = show ? 'flex' : 'none';
      }
    }
    
    // Show error message
    showError(message) {
      this.showLoading(false);
      
      const errorEl = document.createElement('div');
      errorEl.className = 'video-error-message';
      errorEl.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${message}`;
      
      // Add to container but don't remove the video element
      this.videoContainer.appendChild(errorEl);
      
      // Remove after 5 seconds
      setTimeout(() => {
        if (errorEl.parentNode) {
          errorEl.parentNode.removeChild(errorEl);
        }
      }, 5000);
    }
    
    // Update torrent statistics display
    updateTorrentStats(stats) {
      if (!stats) return;
      
      const downloadSpeedEl = document.querySelector('.download-speed span');
      const uploadSpeedEl = document.querySelector('.upload-speed span');
      const peersEl = document.querySelector('.peers span');
      const progressEl = document.querySelector('.progress-percent span');
      
      if (downloadSpeedEl) downloadSpeedEl.textContent = stats.downloadSpeed;
      if (uploadSpeedEl) uploadSpeedEl.textContent = stats.uploadSpeed;
      if (peersEl) peersEl.textContent = stats.peers;
      if (progressEl) progressEl.textContent = `${stats.progress}%`;
    }
    
    // Format bytes to human-readable format
    formatBytes(bytes, decimals = 2) {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const dm = decimals < 0 ? 0 : decimals;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
}
  
  // Initialize player when DOM is loaded
  document.addEventListener('DOMContentLoaded', async () => {
    // This will run after your existing DOMContentLoaded event
    // since we're adding it to the existing file
    
    // Create the video player manager
    window.videoPlayerManager = new VideoPlayerManager();
    
    // Load scripts for player enhancement
    await loadExternalScript('https://cdn.jsdelivr.net/npm/plyr@3.7.8/dist/plyr.min.js');
    
    // Get query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const animeId = urlParams.get('id');
    
    // Attach episode selection handlers to existing episode UI
    function attachEpisodeSelectionHandlers() {
      // For grid view buttons
      const episodeButtons = document.querySelectorAll('.episode-button');
      episodeButtons.forEach(button => {
        button.addEventListener('click', () => {
          const episodeNumber = parseInt(button.textContent);
          window.videoPlayerManager.loadEpisode(animeId, episodeNumber, getCurrentAudioType());
        });
      });
      
      // For card view
      const episodeCards = document.querySelectorAll('.episode-card');
      episodeCards.forEach(card => {
        card.addEventListener('click', () => {
          const episodeNumberEl = card.querySelector('.episode-number-overlay');
          if (episodeNumberEl) {
            const episodeNumber = parseInt(episodeNumberEl.textContent.replace('EP ', ''));
            window.videoPlayerManager.loadEpisode(animeId, episodeNumber, getCurrentAudioType());
          }
        });
      });
    }
    
    // Get current audio type (sub/dub)
    function getCurrentAudioType() {
      const activeButton = document.querySelector('.source-button.active');
      return activeButton ? activeButton.dataset.type : 'sub';
    }
    
    // Helper to load external scripts
    function loadExternalScript(src) {
      return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
          resolve();
          return;
        }
        
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }
    
    // Attach handlers after UI is created
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.addedNodes.length) {
          const episodePanel = document.querySelector('.episodes-panel');
          if (episodePanel) {
            attachEpisodeSelectionHandlers();
            observer.disconnect();
            break;
          }
        }
      }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
    
    // If episode panel already exists, attach handlers now
    if (document.querySelector('.episodes-panel')) {
      attachEpisodeSelectionHandlers();
    }
});