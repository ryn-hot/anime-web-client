// src/renderer/videoPlayer.js
export class VideoPlayer {
    /**
     * @param {HTMLVideoElement} videoElement - The video element to attach MSE to.
     * @param {string} [mimeType] - Optional MIME type for the SourceBuffer.
     */
    constructor(videoElement, mimeType) {
      this.videoElement = videoElement;
      // Default to fragmented MP4 with H.264 & AAC codecs; adjust as needed.
      this.mimeType = mimeType || 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"';
      this.mediaSource = null;
      this.sourceBuffer = null;
    }
  
    /**
     * Initialize MediaSource and attach it to the video element.
     */
    init() {
      if (!('MediaSource' in window)) {
        console.error("MediaSource API is not supported in this browser");
        return;
      }
      this.mediaSource = new MediaSource();
      this.videoElement.src = URL.createObjectURL(this.mediaSource);
      this.mediaSource.addEventListener('sourceopen', this.handleSourceOpen.bind(this));
    }
  
    /**
     * Handler for the 'sourceopen' event; creates a SourceBuffer.
     */
    handleSourceOpen() {
      try {
        this.sourceBuffer = this.mediaSource.addSourceBuffer(this.mimeType);
        this.sourceBuffer.mode = 'sequence';
        console.log("SourceBuffer created with MIME type:", this.mimeType);
      } catch (e) {
        console.error("Error creating SourceBuffer:", e);
      }
    }
  
    /**
     * Loads the stream from the provided URL and appends data to the SourceBuffer.
     *
     * @param {string} url - The URL of the remuxed stream (e.g. from your GStreamer pipeline).
     */
    async loadStream(url) {
      console.log("Loading stream from URL:", url);
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        const reader = response.body.getReader();
  
        // Function to process incoming chunks recursively.
        const processChunk = async () => {
          const { done, value } = await reader.read();
          if (done) {
            console.log("Stream completed");
            if (this.mediaSource.readyState === 'open') {
              this.mediaSource.endOfStream();
            }
            return;
          }
          // If the sourceBuffer is updating, wait for the updateend event.
          if (this.sourceBuffer.updating) {
            await new Promise(resolve => {
              this.sourceBuffer.addEventListener("updateend", resolve, { once: true });
            });
          }
          try {
            this.sourceBuffer.appendBuffer(value);
          } catch (err) {
            console.error("Error appending buffer:", err);
          }
          processChunk();
        };
        processChunk();
      } catch (err) {
        console.error("Error fetching stream:", err);
      }
    }
  }
  