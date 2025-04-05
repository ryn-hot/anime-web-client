import TorrentStreamer from './modules/webtorrent-client.js';
import VideoPlayer from './components/video-player.js';

/**
 * Miru-style torrent streaming implementation
 */
export default class MiruPlayer {
  constructor(videoElementId) {
    this.torrentStreamer = new TorrentStreamer();
    this.videoPlayer = new VideoPlayer(videoElementId);
    this.currentInfoHash = null;
    this.currentStreamInfo = null;
    
    // Set up progress tracking
    this.setupProgressTracking();
  }
  
  /**
   * Stream a torrent file
   * @param {string} magnetLink - Magnet link or torrent URI
   * @param {number} fileIndex - Index of the file to stream (-1 for auto-select)
   * @returns {Promise<Object>} Stream information
   */
  async streamTorrent(magnetLink, fileIndex) {
    try {
      // Start streaming
      const streamInfo = await this.torrentStreamer.streamTorrent(magnetLink, fileIndex);
      this.currentStreamInfo = streamInfo;
      
      // Set video source
      this.videoPlayer.setSource(streamInfo.streamUrl, streamInfo.mimeType);
      
      // Add subtitles if available
      if (streamInfo.subtitles && streamInfo.subtitles.length > 0) {
        this.videoPlayer.addSubtitles(streamInfo.subtitles);
      }
      
      // Auto-play
      this.videoPlayer.play();
      
      return streamInfo;
    } catch (error) {
      console.error('Failed to stream torrent:', error);
      throw error;
    }
  }
  
  /**
   * Set up progress tracking
   */
  setupProgressTracking() {
    // Update progress every second
    setInterval(() => {
      if (this.currentInfoHash) {
        const progress = this.torrentStreamer.getTorrentProgress(this.currentInfoHash);
        const speed = this.torrentStreamer.getTorrentSpeed(this.currentInfoHash);
        
        // Emit progress event
        const event = new CustomEvent('progress', {
          detail: {
            progress,
            speed,
            downloaded: progress * (this.currentStreamInfo?.fileSize || 0),
            total: this.currentStreamInfo?.fileSize || 0
          }
        });
        
        document.dispatchEvent(event);
      }
    }, 1000);
  }
  
  /**
   * Get current playback status
   * @returns {Object} Playback status
   */
  getStatus() {
    return {
      playing: this.videoPlayer.isPlaying(),
      currentTime: this.videoPlayer.getCurrentTime(),
      duration: this.videoPlayer.getDuration(),
      progress: this.currentInfoHash ? this.torrentStreamer.getTorrentProgress(this.currentInfoHash) : 0,
      speed: this.currentInfoHash ? this.torrentStreamer.getTorrentSpeed(this.currentInfoHash) : 0
    };
  }
  
  /**
   * Clean up resources
   */
  destroy() {
    this.torrentStreamer.destroy();
  }
}