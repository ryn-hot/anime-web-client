(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // frontend/js/bottleneck.js
  var AniListAPI = class {
    constructor() {
      this.rateLimitRemaining = 30;
      this.lastRequestTime = 0;
      this.cooldownMs = 300;
      this.retryQueue = [];
      this.isProcessingQueue = false;
      this.maxRetries = 3;
    }
    async makeRequest(options, retryCount = 0) {
      var _a, _b;
      const now = Date.now();
      const timeToWait = Math.max(0, this.lastRequestTime + this.cooldownMs - now);
      if (timeToWait > 0) {
        await new Promise((resolve) => setTimeout(resolve, timeToWait));
      }
      if (this.rateLimitRemaining <= 0) {
        return new Promise((resolve, reject) => {
          this.retryQueue.push({ options, resolve, reject });
          this.processQueue();
        });
      }
      try {
        const response = await fetch("https://graphql.anilist.co", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          mode: "cors",
          // Add this line
          credentials: "omit",
          // Add this line
          body: JSON.stringify({
            query: options.query,
            variables: options.variables || {}
          })
        });
        if (!response.ok) {
          throw new Error("HTTP error! status: ".concat(response.status));
        }
        this.rateLimitRemaining = parseInt((_a = response.headers.get("X-RateLimit-Remaining")) != null ? _a : "30");
        this.lastRequestTime = Date.now();
        if (response.status === 429) {
          const retryAfter = parseInt((_b = response.headers.get("Retry-After")) != null ? _b : "60");
          console.log("Rate limited. Attempt ".concat(retryCount + 1, " of ").concat(this.maxRetries, ". Waiting ").concat(retryAfter, " seconds."));
          if (retryCount < this.maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, retryAfter * 1e3 + 100));
            return this.makeRequest(options, retryCount + 1);
          } else {
            throw new Error("Failed after ".concat(this.maxRetries, " retry attempts due to rate limiting"));
          }
        }
        const data = await response.json();
        if (data.errors) {
          const error = new Error(data.errors[0].message);
          error.response = response;
          error.errors = data.errors;
          throw error;
        }
        return data;
      } catch (error) {
        if (!error.response && retryCount < this.maxRetries) {
          console.log("Network error. Attempt ".concat(retryCount + 1, " of ").concat(this.maxRetries, ". Retrying in 5 seconds."));
          await new Promise((resolve) => setTimeout(resolve, 5e3));
          return this.makeRequest(options, retryCount + 1);
        }
        throw error;
      }
    }
    async processQueue() {
      if (this.isProcessingQueue || this.retryQueue.length === 0) return;
      this.isProcessingQueue = true;
      while (this.retryQueue.length > 0) {
        const { options, resolve, reject } = this.retryQueue[0];
        try {
          const result = await this.makeRequest(options);
          resolve(result);
          this.retryQueue.shift();
        } catch (error) {
          reject(error);
          this.retryQueue.shift();
        }
        if (this.rateLimitRemaining <= 0) break;
      }
      this.isProcessingQueue = false;
    }
  };

  // frontend/js/video-player.js
  var VideoPlayer = class {
    constructor(elementId) {
      this.videoElement = document.getElementById(elementId);
      if (!this.videoElement) {
        throw new Error("Video element with ID ".concat(elementId, " not found"));
      }
      this.videoElement.controls = true;
      this.videoElement.crossOrigin = "anonymous";
      this.setupEventListeners();
    }
    setupEventListeners() {
      this.videoElement.addEventListener("error", (e) => {
        console.error("Video error:", e);
      });
      this.videoElement.addEventListener("loadedmetadata", () => {
        console.log("Video metadata loaded");
      });
      this.videoElement.addEventListener("play", () => {
        console.log("Video started playing");
      });
      this.videoElement.addEventListener("pause", () => {
        console.log("Video paused");
      });
      this.videoElement.addEventListener("ended", () => {
        console.log("Video ended");
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
      while (this.videoElement.firstChild) {
        this.videoElement.removeChild(this.videoElement.firstChild);
      }
      for (const subtitle of subtitles) {
        const track = document.createElement("track");
        track.kind = "subtitles";
        track.label = subtitle.label;
        track.srclang = subtitle.lang;
        track.src = subtitle.url;
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
  };

  // node_modules/rvfc-polyfill/index.js
  if (typeof HTMLVideoElement !== "undefined" && !("requestVideoFrameCallback" in HTMLVideoElement.prototype) && "getVideoPlaybackQuality" in HTMLVideoElement.prototype) {
    HTMLVideoElement.prototype._rvfcpolyfillmap = {};
    HTMLVideoElement.prototype.requestVideoFrameCallback = function(callback) {
      const handle = performance.now();
      const quality = this.getVideoPlaybackQuality();
      const baseline = this.mozPresentedFrames || this.mozPaintedFrames || quality.totalVideoFrames - quality.droppedVideoFrames;
      const check = (old, now) => {
        const newquality = this.getVideoPlaybackQuality();
        const presentedFrames = this.mozPresentedFrames || this.mozPaintedFrames || newquality.totalVideoFrames - newquality.droppedVideoFrames;
        if (presentedFrames > baseline) {
          const processingDuration = this.mozFrameDelay || newquality.totalFrameDelay - quality.totalFrameDelay || 0;
          const timediff = now - old;
          callback(now, {
            presentationTime: now + processingDuration * 1e3,
            expectedDisplayTime: now + timediff,
            width: this.videoWidth,
            height: this.videoHeight,
            mediaTime: Math.max(0, this.currentTime || 0) + timediff / 1e3,
            presentedFrames,
            processingDuration
          });
          delete this._rvfcpolyfillmap[handle];
        } else {
          this._rvfcpolyfillmap[handle] = requestAnimationFrame((newer) => check(now, newer));
        }
      };
      this._rvfcpolyfillmap[handle] = requestAnimationFrame((newer) => check(handle, newer));
      return handle;
    };
    HTMLVideoElement.prototype.cancelVideoFrameCallback = function(handle) {
      cancelAnimationFrame(this._rvfcpolyfillmap[handle]);
      delete this._rvfcpolyfillmap[handle];
    };
  }

  // node_modules/jassub/src/jassub.js
  var webYCbCrMap = {
    bt709: "BT709",
    // these might not be exactly correct? oops?
    bt470bg: "BT601",
    // alias BT.601 PAL... whats the difference?
    smpte170m: "BT601"
    // alias BT.601 NTSC... whats the difference?
  };
  var colorMatrixConversionMap = {
    BT601: {
      BT709: "1.0863 -0.0723 -0.014 0 0 0.0965 0.8451 0.0584 0 0 -0.0141 -0.0277 1.0418"
    },
    BT709: {
      BT601: "0.9137 0.0784 0.0079 0 0 -0.1049 1.1722 -0.0671 0 0 0.0096 0.0322 0.9582"
    },
    FCC: {
      BT709: "1.0873 -0.0736 -0.0137 0 0 0.0974 0.8494 0.0531 0 0 -0.0127 -0.0251 1.0378",
      BT601: "1.001 -0.0008 -0.0002 0 0 0.0009 1.005 -0.006 0 0 0.0013 0.0027 0.996"
    },
    SMPTE240M: {
      BT709: "0.9993 0.0006 0.0001 0 0 -0.0004 0.9812 0.0192 0 0 -0.0034 -0.0114 1.0148",
      BT601: "0.913 0.0774 0.0096 0 0 -0.1051 1.1508 -0.0456 0 0 0.0063 0.0207 0.973"
    }
  };
  var _JASSUB = class _JASSUB extends EventTarget {
    /**
     * @param {Object} options Settings object.
     * @param {HTMLVideoElement} options.video Video to use as target for rendering and event listeners. Optional if canvas is specified instead.
     * @param {HTMLCanvasElement} [options.canvas=HTMLCanvasElement] Canvas to use for manual handling. Not required if video is specified.
     * @param {'js'|'wasm'} [options.blendMode='js'] Which image blending mode to use. WASM will perform better on lower end devices, JS will perform better if the device and browser supports hardware acceleration.
     * @param {Boolean} [options.asyncRender=true] Whether or not to use async rendering, which offloads the CPU by creating image bitmaps on the GPU.
     * @param {Boolean} [options.offscreenRender=true] Whether or not to render things fully on the worker, greatly reduces CPU usage.
     * @param {Boolean} [options.onDemandRender=true] Whether or not to render subtitles as the video player decodes renders, rather than predicting which frame the player is on using events.
     * @param {Number} [options.targetFps=24] Target FPS to render subtitles at. Ignored when onDemandRender is enabled.
     * @param {Number} [options.timeOffset=0] Subtitle time offset in seconds.
     * @param {Boolean} [options.debug=false] Whether or not to print debug information.
     * @param {Number} [options.prescaleFactor=1.0] Scale down (< 1.0) the subtitles canvas to improve performance at the expense of quality, or scale it up (> 1.0).
     * @param {Number} [options.prescaleHeightLimit=1080] The height in pixels beyond which the subtitles canvas won't be prescaled.
     * @param {Number} [options.maxRenderHeight=0] The maximum rendering height in pixels of the subtitles canvas. Beyond this subtitles will be upscaled by the browser.
     * @param {Boolean} [options.dropAllAnimations=false] Attempt to discard all animated tags. Enabling this may severly mangle complex subtitles and should only be considered as an last ditch effort of uncertain success for hardware otherwise incapable of displaing anything. Will not reliably work with manually edited or allocated events.
     * @param {Boolean} [options.dropAllBlur=false] The holy grail of performance gains. If heavy TS lags a lot, disabling this will make it ~x10 faster. This drops blur from all added subtitle tracks making most text and backgrounds look sharper, this is way less intrusive than dropping all animations, while still offering major performance gains.
     * @param {String} [options.workerUrl='jassub-worker.js'] The URL of the worker.
     * @param {String} [options.wasmUrl='jassub-worker.wasm'] The URL of the worker WASM.
     * @param {String} [options.legacyWasmUrl='jassub-worker.wasm.js'] The URL of the worker WASM. Only loaded if the browser doesn't support WASM.
     * @param {String} options.modernWasmUrl The URL of the modern worker WASM. This includes faster ASM instructions, but is only supported by newer browsers, disabled if the URL isn't defined.
     * @param {String} [options.subUrl=options.subContent] The URL of the subtitle file to play.
     * @param {String} [options.subContent=options.subUrl] The content of the subtitle file to play.
     * @param {String[]|Uint8Array[]} [options.fonts] An array of links or Uint8Arrays to the fonts used in the subtitle. If Uint8Array is used the array is copied, not referenced. This forces all the fonts in this array to be loaded by the renderer, regardless of if they are used.
     * @param {Object} [options.availableFonts={'liberation sans': './default.woff2'}] Object with all available fonts - Key is font family in lower case, value is link or Uint8Array: { arial: '/font1.ttf' }. These fonts are selectively loaded if detected as used in the current subtitle track.
     * @param {String} [options.fallbackFont='liberation sans'] The font family key of the fallback font in availableFonts to use if the other font for the style is missing special glyphs or unicode.
     * @param {Boolean} [options.useLocalFonts=false] If the Local Font Access API is enabled [chrome://flags/#font-access], the library will query for permissions to use local fonts and use them if any are missing. The permission can be queried beforehand using navigator.permissions.request({ name: 'local-fonts' }).
     * @param {Number} [options.libassMemoryLimit] libass bitmap cache memory limit in MiB (approximate).
     * @param {Number} [options.libassGlyphLimit] libass glyph cache memory limit in MiB (approximate).
     */
    constructor(options) {
      var _a, _b;
      super();
      if (!globalThis.Worker) throw this.destroy("Worker not supported");
      if (!options) throw this.destroy("No options provided");
      this._loaded = /** @type {Promise<void>} */
      new Promise((resolve) => {
        this._init = resolve;
      });
      const test = _JASSUB._test();
      this._onDemandRender = "requestVideoFrameCallback" in HTMLVideoElement.prototype && ((_a = options.onDemandRender) != null ? _a : true);
      this._offscreenRender = "transferControlToOffscreen" in HTMLCanvasElement.prototype && !options.canvas && ((_b = options.offscreenRender) != null ? _b : true);
      this.timeOffset = options.timeOffset || 0;
      this._video = options.video;
      this._videoHeight = 0;
      this._videoWidth = 0;
      this._videoColorSpace = null;
      this._canvas = options.canvas;
      if (this._video && !this._canvas) {
        this._canvasParent = document.createElement("div");
        this._canvasParent.className = "JASSUB";
        this._canvasParent.style.position = "relative";
        this._canvas = this._createCanvas();
        this._video.insertAdjacentElement("afterend", this._canvasParent);
      } else if (!this._canvas) {
        throw this.destroy("Don't know where to render: you should give video or canvas in options.");
      }
      this._bufferCanvas = document.createElement("canvas");
      this._bufferCtx = this._bufferCanvas.getContext("2d");
      if (!this._bufferCtx) throw this.destroy("Canvas rendering not supported");
      this._canvasctrl = this._offscreenRender ? this._canvas.transferControlToOffscreen() : this._canvas;
      this._ctx = !this._offscreenRender && this._canvasctrl.getContext("2d");
      this._lastRenderTime = 0;
      this.debug = !!options.debug;
      this.prescaleFactor = options.prescaleFactor || 1;
      this.prescaleHeightLimit = options.prescaleHeightLimit || 1080;
      this.maxRenderHeight = options.maxRenderHeight || 0;
      this._boundResize = this.resize.bind(this);
      this._boundTimeUpdate = this._timeupdate.bind(this);
      this._boundSetRate = this.setRate.bind(this);
      this._boundUpdateColorSpace = this._updateColorSpace.bind(this);
      if (this._video) this.setVideo(options.video);
      if (this._onDemandRender) {
        this.busy = false;
        this._lastDemandTime = null;
      }
      this._worker = new Worker(options.workerUrl || "jassub-worker.js");
      this._worker.onmessage = (e) => this._onmessage(e);
      this._worker.onerror = (e) => this._error(e);
      test.then(() => {
        var _a2, _b2, _c, _d;
        this._worker.postMessage({
          target: "init",
          wasmUrl: _JASSUB._supportsSIMD && options.modernWasmUrl ? options.modernWasmUrl : (_a2 = options.wasmUrl) != null ? _a2 : "jassub-worker.wasm",
          legacyWasmUrl: (_b2 = options.legacyWasmUrl) != null ? _b2 : "jassub-worker.wasm.js",
          asyncRender: typeof createImageBitmap !== "undefined" && ((_c = options.asyncRender) != null ? _c : true),
          onDemandRender: this._onDemandRender,
          width: this._canvasctrl.width || 0,
          height: this._canvasctrl.height || 0,
          blendMode: options.blendMode || "js",
          subUrl: options.subUrl,
          subContent: options.subContent || null,
          fonts: options.fonts || [],
          availableFonts: options.availableFonts || { "liberation sans": "./default.woff2" },
          fallbackFont: options.fallbackFont || "liberation sans",
          debug: this.debug,
          targetFps: options.targetFps || 24,
          dropAllAnimations: options.dropAllAnimations,
          dropAllBlur: options.dropAllBlur,
          libassMemoryLimit: options.libassMemoryLimit || 0,
          libassGlyphLimit: options.libassGlyphLimit || 0,
          // @ts-ignore
          useLocalFonts: typeof queryLocalFonts !== "undefined" && ((_d = options.useLocalFonts) != null ? _d : true),
          hasBitmapBug: _JASSUB._hasBitmapBug
        });
        if (this._offscreenRender === true) this.sendMessage("offscreenCanvas", null, [this._canvasctrl]);
      });
    }
    _createCanvas() {
      this._canvas = document.createElement("canvas");
      this._canvas.style.display = "block";
      this._canvas.style.position = "absolute";
      this._canvas.style.pointerEvents = "none";
      this._canvasParent.appendChild(this._canvas);
      return this._canvas;
    }
    static _testSIMD() {
      if (_JASSUB._supportsSIMD !== null) return;
      try {
        _JASSUB._supportsSIMD = WebAssembly.validate(Uint8Array.of(0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11));
      } catch (e) {
        _JASSUB._supportsSIMD = false;
      }
    }
    static async _testImageBugs() {
      if (_JASSUB._hasBitmapBug !== null) return;
      const canvas1 = document.createElement("canvas");
      const ctx1 = canvas1.getContext("2d", { willReadFrequently: true });
      if (!ctx1) throw new Error("Canvas rendering not supported");
      if (typeof ImageData.prototype.constructor === "function") {
        try {
          new ImageData(new Uint8ClampedArray([0, 0, 0, 0]), 1, 1);
        } catch (e) {
          console.log("Detected that ImageData is not constructable despite browser saying so");
          self.ImageData = function(data, width, height) {
            const imageData = ctx1.createImageData(width, height);
            if (data) imageData.data.set(data);
            return imageData;
          };
        }
      }
      const canvas2 = document.createElement("canvas");
      const ctx2 = canvas2.getContext("2d", { willReadFrequently: true });
      if (!ctx2) throw new Error("Canvas rendering not supported");
      canvas1.width = canvas2.width = 1;
      canvas1.height = canvas2.height = 1;
      ctx1.clearRect(0, 0, 1, 1);
      ctx2.clearRect(0, 0, 1, 1);
      const prePut = ctx2.getImageData(0, 0, 1, 1).data;
      ctx1.putImageData(new ImageData(new Uint8ClampedArray([0, 255, 0, 0]), 1, 1), 0, 0);
      ctx2.drawImage(canvas1, 0, 0);
      const postPut = ctx2.getImageData(0, 0, 1, 1).data;
      _JASSUB._hasAlphaBug = prePut[1] !== postPut[1];
      if (_JASSUB._hasAlphaBug) console.log("Detected a browser having issue with transparent pixels, applying workaround");
      if (typeof createImageBitmap !== "undefined") {
        const subarray = new Uint8ClampedArray([255, 0, 255, 0, 255]).subarray(1, 5);
        ctx2.drawImage(await createImageBitmap(new ImageData(subarray, 1)), 0, 0);
        const { data } = ctx2.getImageData(0, 0, 1, 1);
        _JASSUB._hasBitmapBug = false;
        for (const [i, number] of data.entries()) {
          if (Math.abs(subarray[i] - number) > 15) {
            _JASSUB._hasBitmapBug = true;
            console.log("Detected a browser having issue with partial bitmaps, applying workaround");
            break;
          }
        }
      } else {
        _JASSUB._hasBitmapBug = false;
      }
      canvas1.remove();
      canvas2.remove();
    }
    static async _test() {
      _JASSUB._testSIMD();
      await _JASSUB._testImageBugs();
    }
    /**
     * Resize the canvas to given parameters. Auto-generated if values are ommited.
     * @param  {Number} [width=0]
     * @param  {Number} [height=0]
     * @param  {Number} [top=0]
     * @param  {Number} [left=0]
     * @param  {Boolean} [force=false]
     */
    resize(width = 0, height = 0, top = 0, left = 0, force = ((_a) => (_a = this._video) == null ? void 0 : _a.paused)()) {
      if ((!width || !height) && this._video) {
        const videoSize = this._getVideoPosition();
        let renderSize = null;
        if (this._videoWidth) {
          const widthRatio = this._video.videoWidth / this._videoWidth;
          const heightRatio = this._video.videoHeight / this._videoHeight;
          renderSize = this._computeCanvasSize((videoSize.width || 0) / widthRatio, (videoSize.height || 0) / heightRatio);
        } else {
          renderSize = this._computeCanvasSize(videoSize.width || 0, videoSize.height || 0);
        }
        width = renderSize.width;
        height = renderSize.height;
        if (this._canvasParent) {
          top = videoSize.y - (this._canvasParent.getBoundingClientRect().top - this._video.getBoundingClientRect().top);
          left = videoSize.x;
        }
        this._canvas.style.width = videoSize.width + "px";
        this._canvas.style.height = videoSize.height + "px";
      }
      this._canvas.style.top = top + "px";
      this._canvas.style.left = left + "px";
      if (force && this.busy === false) {
        this.busy = true;
      } else {
        force = false;
      }
      this.sendMessage("canvas", { width, height, force });
    }
    _getVideoPosition(width = this._video.videoWidth, height = this._video.videoHeight) {
      const videoRatio = width / height;
      const { offsetWidth, offsetHeight } = this._video;
      const elementRatio = offsetWidth / offsetHeight;
      width = offsetWidth;
      height = offsetHeight;
      if (elementRatio > videoRatio) {
        width = Math.floor(offsetHeight * videoRatio);
      } else {
        height = Math.floor(offsetWidth / videoRatio);
      }
      const x = (offsetWidth - width) / 2;
      const y = (offsetHeight - height) / 2;
      return { width, height, x, y };
    }
    _computeCanvasSize(width = 0, height = 0) {
      const scalefactor = this.prescaleFactor <= 0 ? 1 : this.prescaleFactor;
      const ratio = self.devicePixelRatio || 1;
      width = width * ratio;
      height = height * ratio;
      if (height <= 0 || width <= 0) {
        width = 0;
        height = 0;
      } else {
        const sgn = scalefactor < 1 ? -1 : 1;
        let newH = height * ratio;
        if (sgn * newH * scalefactor <= sgn * this.prescaleHeightLimit) {
          newH *= scalefactor;
        } else if (sgn * newH < sgn * this.prescaleHeightLimit) {
          newH = this.prescaleHeightLimit;
        }
        if (this.maxRenderHeight > 0 && newH > this.maxRenderHeight) newH = this.maxRenderHeight;
        width *= newH / height;
        height = newH;
      }
      return { width, height };
    }
    _timeupdate({ type }) {
      const eventmap = {
        seeking: true,
        waiting: true,
        playing: false
      };
      const playing = eventmap[type];
      if (playing != null) this._playstate = playing;
      this.setCurrentTime(this._video.paused || this._playstate, this._video.currentTime + this.timeOffset);
    }
    /**
     * Change the video to use as target for event listeners.
     * @param  {HTMLVideoElement} video
     */
    setVideo(video) {
      if (video instanceof HTMLVideoElement) {
        this._removeListeners();
        this._video = video;
        if (this._onDemandRender) {
          this._video.requestVideoFrameCallback(this._handleRVFC.bind(this));
        } else {
          this._playstate = video.paused;
          video.addEventListener("timeupdate", this._boundTimeUpdate, false);
          video.addEventListener("progress", this._boundTimeUpdate, false);
          video.addEventListener("waiting", this._boundTimeUpdate, false);
          video.addEventListener("seeking", this._boundTimeUpdate, false);
          video.addEventListener("playing", this._boundTimeUpdate, false);
          video.addEventListener("ratechange", this._boundSetRate, false);
          video.addEventListener("resize", this._boundResize, false);
        }
        if ("VideoFrame" in window) {
          video.addEventListener("loadedmetadata", this._boundUpdateColorSpace, false);
          if (video.readyState > 2) this._updateColorSpace();
        }
        if (video.videoWidth > 0) this.resize();
        if (typeof ResizeObserver !== "undefined") {
          if (!this._ro) this._ro = new ResizeObserver(() => this.resize());
          this._ro.observe(video);
        }
      } else {
        this._error("Video element invalid!");
      }
    }
    runBenchmark() {
      this.sendMessage("runBenchmark");
    }
    /**
     * Overwrites the current subtitle content.
     * @param  {String} url URL to load subtitles from.
     */
    setTrackByUrl(url) {
      this.sendMessage("setTrackByUrl", { url });
      this._reAttachOffscreen();
      if (this._ctx) this._ctx.filter = "none";
    }
    /**
     * Overwrites the current subtitle content.
     * @param  {String} content Content of the ASS file.
     */
    setTrack(content) {
      this.sendMessage("setTrack", { content });
      this._reAttachOffscreen();
      if (this._ctx) this._ctx.filter = "none";
    }
    /**
     * Free currently used subtitle track.
     */
    freeTrack() {
      this.sendMessage("freeTrack");
    }
    /**
     * Sets the playback state of the media.
     * @param  {Boolean} isPaused Pause/Play subtitle playback.
     */
    setIsPaused(isPaused) {
      this.sendMessage("video", { isPaused });
    }
    /**
     * Sets the playback rate of the media [speed multiplier].
     * @param  {Number} rate Playback rate.
     */
    setRate(rate) {
      this.sendMessage("video", { rate });
    }
    /**
     * Sets the current time, playback state and rate of the subtitles.
     * @param  {Boolean} [isPaused] Pause/Play subtitle playback.
     * @param  {Number} [currentTime] Time in seconds.
     * @param  {Number} [rate] Playback rate.
     */
    setCurrentTime(isPaused, currentTime, rate) {
      this.sendMessage("video", { isPaused, currentTime, rate, colorSpace: this._videoColorSpace });
    }
    /**
     * @typedef {Object} ASS_Event
     * @property {Number} Start Start Time of the Event, in 0:00:00:00 format ie. Hrs:Mins:Secs:hundredths. This is the time elapsed during script playback at which the text will appear onscreen. Note that there is a single digit for the hours!
     * @property {Number} Duration End Time of the Event, in 0:00:00:00 format ie. Hrs:Mins:Secs:hundredths. This is the time elapsed during script playback at which the text will disappear offscreen. Note that there is a single digit for the hours!
     * @property {String} Style Style name. If it is "Default", then your own *Default style will be subtituted.
     * @property {String} Name Character name. This is the name of the character who speaks the dialogue. It is for information only, to make the script is easier to follow when editing/timing.
     * @property {Number} MarginL 4-figure Left Margin override. The values are in pixels. All zeroes means the default margins defined by the style are used.
     * @property {Number} MarginR 4-figure Right Margin override. The values are in pixels. All zeroes means the default margins defined by the style are used.
     * @property {Number} MarginV 4-figure Bottom Margin override. The values are in pixels. All zeroes means the default margins defined by the style are used.
     * @property {String} Effect Transition Effect. This is either empty, or contains information for one of the three transition effects implemented in SSA v4.x
     * @property {String} Text Subtitle Text. This is the actual text which will be displayed as a subtitle onscreen. Everything after the 9th comma is treated as the subtitle text, so it can include commas.
     * @property {Number} ReadOrder Number in order of which to read this event.
     * @property {Number} Layer Z-index overlap in which to render this event.
     * @property {Number} _index (Internal) index of the event.
    */
    /**
     * Create a new ASS event directly.
     * @param  {ASS_Event} event
     */
    createEvent(event) {
      this.sendMessage("createEvent", { event });
    }
    /**
     * Overwrite the data of the event with the specified index.
     * @param  {ASS_Event} event
     * @param  {Number} index
     */
    setEvent(event, index) {
      this.sendMessage("setEvent", { event, index });
    }
    /**
     * Remove the event with the specified index.
     * @param  {Number} index
     */
    removeEvent(index) {
      this.sendMessage("removeEvent", { index });
    }
    /**
     * Get all ASS events.
     * @param  {function(Error|null, ASS_Event): void} callback Function to callback when worker returns the events.
     */
    getEvents(callback) {
      this._fetchFromWorker({
        target: "getEvents"
      }, (err, { events }) => {
        callback(err, events);
      });
    }
    /**
     * @typedef {Object} ASS_Style
     * @property {String} Name The name of the Style. Case sensitive. Cannot include commas.
     * @property {String} FontName The fontname as used by Windows. Case-sensitive.
     * @property {Number} FontSize Font size.
     * @property {Number} PrimaryColour A long integer BGR (blue-green-red)  value. ie. the byte order in the hexadecimal equivelent of this number is BBGGRR
     * @property {Number} SecondaryColour A long integer BGR (blue-green-red)  value. ie. the byte order in the hexadecimal equivelent of this number is BBGGRR
     * @property {Number} OutlineColour A long integer BGR (blue-green-red)  value. ie. the byte order in the hexadecimal equivelent of this number is BBGGRR
     * @property {Number} BackColour This is the colour of the subtitle outline or shadow, if these are used. A long integer BGR (blue-green-red)  value. ie. the byte order in the hexadecimal equivelent of this number is BBGGRR.
     * @property {Number} Bold This defines whether text is bold (true) or not (false). -1 is True, 0 is False. This is independant of the Italic attribute - you can have have text which is both bold and italic.
     * @property {Number} Italic  Italic. This defines whether text is italic (true) or not (false). -1 is True, 0 is False. This is independant of the bold attribute - you can have have text which is both bold and italic.
     * @property {Number} Underline -1 or 0
     * @property {Number} StrikeOut -1 or 0
     * @property {Number} ScaleX Modifies the width of the font. [percent]
     * @property {Number} ScaleY Modifies the height of the font. [percent]
     * @property {Number} Spacing Extra space between characters. [pixels]
     * @property {Number} Angle The origin of the rotation is defined by the alignment. Can be a floating point number. [degrees]
     * @property {Number} BorderStyle 1=Outline + drop shadow, 3=Opaque box
     * @property {Number} Outline If BorderStyle is 1,  then this specifies the width of the outline around the text, in pixels. Values may be 0, 1, 2, 3 or 4.
     * @property {Number} Shadow If BorderStyle is 1,  then this specifies the depth of the drop shadow behind the text, in pixels. Values may be 0, 1, 2, 3 or 4. Drop shadow is always used in addition to an outline - SSA will force an outline of 1 pixel if no outline width is given.
     * @property {Number} Alignment This sets how text is "justified" within the Left/Right onscreen margins, and also the vertical placing. Values may be 1=Left, 2=Centered, 3=Right. Add 4 to the value for a "Toptitle". Add 8 to the value for a "Midtitle". eg. 5 = left-justified toptitle
     * @property {Number} MarginL This defines the Left Margin in pixels. It is the distance from the left-hand edge of the screen.The three onscreen margins (MarginL, MarginR, MarginV) define areas in which the subtitle text will be displayed.
     * @property {Number} MarginR This defines the Right Margin in pixels. It is the distance from the right-hand edge of the screen. The three onscreen margins (MarginL, MarginR, MarginV) define areas in which the subtitle text will be displayed.
     * @property {Number} MarginV This defines the vertical Left Margin in pixels. For a subtitle, it is the distance from the bottom of the screen. For a toptitle, it is the distance from the top of the screen. For a midtitle, the value is ignored - the text will be vertically centred.
     * @property {Number} Encoding This specifies the font character set or encoding and on multi-lingual Windows installations it provides access to characters used in multiple than one languages. It is usually 0 (zero) for English (Western, ANSI) Windows.
     * @property {Number} treat_fontname_as_pattern
     * @property {Number} Blur
     * @property {Number} Justify
    */
    /**
     * Create a new ASS style directly.
     * @param  {ASS_Style} style
     */
    createStyle(style) {
      this.sendMessage("createStyle", { style });
    }
    /**
     * Overwrite the data of the style with the specified index.
     * @param  {ASS_Style} style
     * @param  {Number} index
     */
    setStyle(style, index) {
      this.sendMessage("setStyle", { style, index });
    }
    /**
     * Remove the style with the specified index.
     * @param  {Number} index
     */
    removeStyle(index) {
      this.sendMessage("removeStyle", { index });
    }
    /**
     * Get all ASS styles.
     * @param  {function(Error|null, ASS_Style): void} callback Function to callback when worker returns the styles.
     */
    getStyles(callback) {
      this._fetchFromWorker({
        target: "getStyles"
      }, (err, { styles }) => {
        callback(err, styles);
      });
    }
    /**
     * Adds a font to the renderer.
     * @param  {String|Uint8Array} font Font to add.
     */
    addFont(font) {
      this.sendMessage("addFont", { font });
    }
    _sendLocalFont(name) {
      try {
        queryLocalFonts().then((fontData) => {
          const font = fontData == null ? void 0 : fontData.find((obj) => obj.fullName.toLowerCase() === name);
          if (font) {
            font.blob().then((blob) => {
              blob.arrayBuffer().then((buffer) => {
                this.addFont(new Uint8Array(buffer));
              });
            });
          }
        });
      } catch (e) {
        console.warn("Local fonts API:", e);
      }
    }
    _getLocalFont({ font }) {
      var _a;
      try {
        if ((_a = navigator == null ? void 0 : navigator.permissions) == null ? void 0 : _a.query) {
          navigator.permissions.query({ name: "local-fonts" }).then((permission) => {
            if (permission.state === "granted") {
              this._sendLocalFont(font);
            }
          });
        } else {
          this._sendLocalFont(font);
        }
      } catch (e) {
        console.warn("Local fonts API:", e);
      }
    }
    _unbusy() {
      if (this._lastDemandTime) {
        this._demandRender(this._lastDemandTime);
      } else {
        this.busy = false;
      }
    }
    _handleRVFC(now, { mediaTime, width, height }) {
      if (this._destroyed) return null;
      if (this.busy) {
        this._lastDemandTime = { mediaTime, width, height };
      } else {
        this.busy = true;
        this._demandRender({ mediaTime, width, height });
      }
      this._video.requestVideoFrameCallback(this._handleRVFC.bind(this));
    }
    _demandRender({ mediaTime, width, height }) {
      this._lastDemandTime = null;
      if (width !== this._videoWidth || height !== this._videoHeight) {
        this._videoWidth = width;
        this._videoHeight = height;
        this.resize();
      }
      this.sendMessage("demand", { time: mediaTime + this.timeOffset });
    }
    // if we're using offscreen render, we can't use ctx filters, so we can't use a transfered canvas
    _detachOffscreen() {
      if (!this._offscreenRender || this._ctx) return null;
      this._canvas.remove();
      this._createCanvas();
      this._canvasctrl = this._canvas;
      this._ctx = this._canvasctrl.getContext("2d");
      this.sendMessage("detachOffscreen");
      this.busy = false;
      this.resize(0, 0, 0, 0, true);
    }
    // if the video or track changed, we need to re-attach the offscreen canvas
    _reAttachOffscreen() {
      if (!this._offscreenRender || !this._ctx) return null;
      this._canvas.remove();
      this._createCanvas();
      this._canvasctrl = this._canvas.transferControlToOffscreen();
      this._ctx = false;
      this.sendMessage("offscreenCanvas", null, [this._canvasctrl]);
      this.resize(0, 0, 0, 0, true);
    }
    _updateColorSpace() {
      this._video.requestVideoFrameCallback(() => {
        try {
          const frame = new VideoFrame(this._video);
          this._videoColorSpace = webYCbCrMap[frame.colorSpace.matrix];
          frame.close();
          this.sendMessage("getColorSpace");
        } catch (e) {
          console.warn(e);
        }
      });
    }
    /**
     * Veryify the color spaces for subtitles and videos, then apply filters to correct the color of subtitles.
     * @param  {Object} options
     * @param  {String} options.subtitleColorSpace Subtitle color space. One of: BT601 BT709 SMPTE240M FCC
     * @param  {String=} options.videoColorSpace Video color space. One of: BT601 BT709
     */
    _verifyColorSpace({ subtitleColorSpace, videoColorSpace = this._videoColorSpace }) {
      if (!subtitleColorSpace || !videoColorSpace) return;
      if (subtitleColorSpace === videoColorSpace) return;
      this._detachOffscreen();
      this._ctx.filter = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'><filter id='f'><feColorMatrix type='matrix' values='".concat(colorMatrixConversionMap[subtitleColorSpace][videoColorSpace], " 0 0 0 0 0 1 0'/></filter></svg>#f\")");
    }
    _render({ images, asyncRender, times, width, height, colorSpace }) {
      this._unbusy();
      if (this.debug) times.IPCTime = Date.now() - times.JSRenderTime;
      if (this._canvasctrl.width !== width || this._canvasctrl.height !== height) {
        this._canvasctrl.width = width;
        this._canvasctrl.height = height;
        this._verifyColorSpace({ subtitleColorSpace: colorSpace });
      }
      this._ctx.clearRect(0, 0, this._canvasctrl.width, this._canvasctrl.height);
      for (const image of images) {
        if (image.image) {
          if (asyncRender) {
            this._ctx.drawImage(image.image, image.x, image.y);
            image.image.close();
          } else {
            this._bufferCanvas.width = image.w;
            this._bufferCanvas.height = image.h;
            this._bufferCtx.putImageData(new ImageData(this._fixAlpha(new Uint8ClampedArray(image.image)), image.w, image.h), 0, 0);
            this._ctx.drawImage(this._bufferCanvas, image.x, image.y);
          }
        }
      }
      if (this.debug) {
        times.JSRenderTime = Date.now() - times.JSRenderTime - times.IPCTime;
        let total = 0;
        const count = times.bitmaps || images.length;
        delete times.bitmaps;
        for (const key in times) total += times[key];
        console.log("Bitmaps: " + count + " Total: " + (total | 0) + "ms", times);
      }
    }
    _fixAlpha(uint8) {
      if (_JASSUB._hasAlphaBug) {
        for (let j = 3; j < uint8.length; j += 4) {
          uint8[j] = uint8[j] > 1 ? uint8[j] : 1;
        }
      }
      return uint8;
    }
    _ready() {
      this._init();
      this.dispatchEvent(new CustomEvent("ready"));
    }
    /**
     * Send data and execute function in the worker.
     * @param  {String} target Target function.
     * @param  {Object} [data] Data for function.
     * @param  {Transferable[]} [transferable] Array of transferables.
     */
    async sendMessage(target, data = {}, transferable) {
      await this._loaded;
      if (transferable) {
        this._worker.postMessage(__spreadValues({
          target,
          transferable
        }, data), [...transferable]);
      } else {
        this._worker.postMessage(__spreadValues({
          target
        }, data));
      }
    }
    _fetchFromWorker(workerOptions, callback) {
      try {
        const target = workerOptions.target;
        const timeout = setTimeout(() => {
          reject(new Error("Error: Timeout while try to fetch " + target));
        }, 5e3);
        const resolve = ({ data }) => {
          if (data.target === target) {
            callback(null, data);
            this._worker.removeEventListener("message", resolve);
            this._worker.removeEventListener("error", reject);
            clearTimeout(timeout);
          }
        };
        const reject = (event) => {
          callback(event);
          this._worker.removeEventListener("message", resolve);
          this._worker.removeEventListener("error", reject);
          clearTimeout(timeout);
        };
        this._worker.addEventListener("message", resolve);
        this._worker.addEventListener("error", reject);
        this._worker.postMessage(workerOptions);
      } catch (error) {
        this._error(error);
      }
    }
    _console({ content, command }) {
      console[command].apply(console, JSON.parse(content));
    }
    _onmessage({ data }) {
      if (this["_" + data.target]) this["_" + data.target](data);
    }
    _error(err) {
      const error = err instanceof Error ? err : err instanceof ErrorEvent ? err.error : new Error(err);
      const event = err instanceof Event ? new ErrorEvent(err.type, err) : new ErrorEvent("error", { error });
      this.dispatchEvent(event);
      console.error(error);
      return error;
    }
    _removeListeners() {
      if (this._video) {
        if (this._ro) this._ro.unobserve(this._video);
        if (this._ctx) this._ctx.filter = "none";
        this._video.removeEventListener("timeupdate", this._boundTimeUpdate);
        this._video.removeEventListener("progress", this._boundTimeUpdate);
        this._video.removeEventListener("waiting", this._boundTimeUpdate);
        this._video.removeEventListener("seeking", this._boundTimeUpdate);
        this._video.removeEventListener("playing", this._boundTimeUpdate);
        this._video.removeEventListener("ratechange", this._boundSetRate);
        this._video.removeEventListener("resize", this._boundResize);
        this._video.removeEventListener("loadedmetadata", this._boundUpdateColorSpace);
      }
    }
    /**
     * Destroy the object, worker, listeners and all data.
     * @param  {String|Error} [err] Error to throw when destroying.
     */
    destroy(err) {
      var _a, _b;
      if (err) err = this._error(err);
      if (this._video && this._canvasParent) (_a = this._video.parentNode) == null ? void 0 : _a.removeChild(this._canvasParent);
      this._destroyed = true;
      this._removeListeners();
      this.sendMessage("destroy");
      (_b = this._worker) == null ? void 0 : _b.terminate();
      return err;
    }
  };
  // test support for WASM, ImageData, alphaBug, but only once, on init so it doesn't run when first running the page
  /** @type {boolean|null} */
  __publicField(_JASSUB, "_supportsSIMD", null);
  /** @type {boolean|null} */
  __publicField(_JASSUB, "_hasAlphaBug", null);
  /** @type {boolean|null} */
  __publicField(_JASSUB, "_hasBitmapBug", null);
  var JASSUB = _JASSUB;

  // modules/util.js
  var videoExtensions = ["3g2", "3gp", "asf", "avi", "dv", "flv", "gxf", "m2ts", "m4a", "m4b", "m4p", "m4r", "m4v", "mkv", "mov", "mp4", "mpd", "mpeg", "mpg", "mxf", "nut", "ogm", "ogv", "swf", "ts", "vob", "webm", "wmv", "wtv"];
  var videoRx = new RegExp(".(".concat(videoExtensions.join("|"), ")$"), "i");
  var subtitleExtensions = ["srt", "vtt", "ass", "ssa", "sub", "txt"];
  var subRx = new RegExp(".(".concat(subtitleExtensions.join("|"), ")$"), "i");
  var fontExtensions = ["ttf", "ttc", "woff", "woff2", "otf", "cff", "otc", "pfa", "pfb", "pcf", "fnt", "bdf", "pfr", "eot"];
  var fontRx = new RegExp(".(".concat(fontExtensions.join("|"), ")$"), "i");
  function toTS(sec, full) {
    if (isNaN(sec) || sec < 0) {
      switch (full) {
        case 1:
          return "0:00:00.00";
        case 2:
          return "0:00:00";
        case 3:
          return "00:00";
        default:
          return "0:00";
      }
    }
    const hours = Math.floor(sec / 3600);
    let minutes = Math.floor(sec / 60) - hours * 60;
    let seconds = full === 1 ? (sec % 60).toFixed(2) : Math.floor(sec % 60);
    if (minutes < 10 && (hours > 0 || full)) minutes = "0" + minutes;
    if (seconds < 10) seconds = "0" + seconds;
    return hours > 0 || full === 1 || full === 2 ? hours + ":" + minutes + ":" + seconds : minutes + ":" + seconds;
  }

  // modules/subtitles.js
  var log = (message, ...args) => {
    console.debug("[SubtitleManager] ".concat(message), ...args);
  };
  var getSetting = (key, defaultValue) => {
    const settings = {
      font: { name: "Roboto Medium", url: "/Roboto.ttf" },
      // Example default font setting
      subtitleRenderHeight: "0",
      // Example: '720' for Android, '0' for desktop default
      subtitleLanguage: "eng",
      // Example default language
      missingFont: true,
      disableSubtitleBlur: false
    };
    return settings[key] !== void 0 ? settings[key] : defaultValue;
  };
  var defaultFontName = getSetting("font", { name: "Roboto Medium" }).name.toLowerCase();
  var defaultHeader = "[Script Info]\nTitle: Default Subtitles\nScriptType: v4.00+\nWrapStyle: 0\nScaledBorderAndShadow: yes\nYCbCr Matrix: None\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,".concat(defaultFontName, ",52,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2.6,0,2,20,20,46,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n");
  var stylesRx = /^Style:[^,]*/gm;
  var SubtitleManager = class {
    /**
     * @param {HTMLVideoElement} videoElement - The video element to attach subtitles to.
     * @param {Function} onTrackListUpdate - Callback function when track list changes `(tracks) => {}`.
     */
    constructor(videoElement, onTrackListUpdate) {
      __publicField(this, "handleIPCMessage", (channel, data) => {
        if (this.isDestroyed) return;
        if (data) {
          console.log("Received IPC message on channel '".concat(channel, "' for current file"));
          switch (channel) {
            case "subtitle-tracks":
              this.handleTracks(data.tracks);
              break;
            case "subtitle-cue":
              this.handleSubtitleCue(data);
              break;
            case "subtitle-font":
              this.handleFontInfo(data);
              break;
          }
        } else {
          console.log("Ignoring IPC message on ".concat(channel));
        }
      });
      __publicField(this, "handleFontInfo", ({ fontUrl }) => {
        if (this.isDestroyed || !fontUrl) return;
        log("Received font info, URL: ".concat(fontUrl));
        if (!this.fonts.includes(fontUrl)) {
          this.fonts.push(fontUrl);
          this.initRenderer();
          log("Font URL ".concat(fontUrl, " added to list for JASSUB."));
        }
      });
      /**
       * Processes the list of tracks received from the backend parser.
       * @param {Array<object>} tracksData - Array of track objects from the parser.
       */
      __publicField(this, "handleTracks", (tracksData) => {
        if (this.isDestroyed) return;
        log("Processing ".concat(tracksData.length, " tracks"));
        let trackListChanged = false;
        for (const track of tracksData) {
          if (track.type !== "subtitle") continue;
          const trackNumber = track.number;
          if (!this.tracks[trackNumber]) {
            const isASS = track.codec === "SubStationAlpha";
            const header = isASS ? track.header || defaultHeader : defaultHeader;
            this.tracks[trackNumber] = [];
            this._tracksString[trackNumber] = /* @__PURE__ */ new Set();
            this.headers[trackNumber] = {
              // Store header info
              number: trackNumber,
              language: track.language || "und",
              name: track.name || "Track ".concat(trackNumber),
              header,
              type: isASS ? "ass" : (track.codec || "unknown").toLowerCase(),
              // Store original type
              codec: track.codec
            };
            this._stylesMap[trackNumber] = { Default: 0 };
            const styleMatches = header.match(stylesRx);
            if (styleMatches) {
              for (let i = 0; i < styleMatches.length; ++i) {
                const style = styleMatches[i].replace("Style:", "").trim();
                this._stylesMap[trackNumber][style] = i + 1;
              }
            }
            trackListChanged = true;
            log("Added track ".concat(trackNumber, ": Lang=").concat(this.headers[trackNumber].language, ", Name=").concat(this.headers[trackNumber].name, ", Type=").concat(this.headers[trackNumber].type));
          }
        }
        if (trackListChanged) {
          this.initRenderer();
          this.onTrackListUpdate(this.getTrackList());
          if (this.currentTrack === -1) {
            const tracks = this.getTrackList();
            if (tracks == null ? void 0 : tracks.length) {
              const preferredLang = getSetting("subtitleLanguage", "eng");
              let trackToSelect = tracks.find(({ language }) => language === preferredLang);
              if (!trackToSelect) {
                trackToSelect = tracks.find(({ language }) => language === "eng" || language === "und");
              }
              if (!trackToSelect) {
                trackToSelect = tracks[0];
              }
              if (trackToSelect) {
                this.selectTrack(trackToSelect.number);
              }
            }
          }
        }
      });
      /**
       * Processes a single subtitle cue received from the backend.
       * @param {{trackNumber: number, subtitle: object}} data
       */
      __publicField(this, "handleSubtitleCue", ({ trackNumber, subtitle }) => {
        var _a;
        if (this.isDestroyed || !this.tracks[trackNumber]) return;
        const stringifiedCue = JSON.stringify(subtitle);
        if (this._tracksString[trackNumber].has(stringifiedCue)) {
          return;
        }
        this._tracksString[trackNumber].add(stringifiedCue);
        const isASS = ((_a = this.headers[trackNumber]) == null ? void 0 : _a.type) === "ass";
        const assCue = this.constructSub(subtitle, !isASS, this.tracks[trackNumber].length, trackNumber);
        this.tracks[trackNumber].push(assCue);
        if (this.currentTrack === trackNumber && this.renderer) {
          this.renderer.createEvent(assCue);
        }
      });
      /**
       * Processes font data received from the backend.
       * @param {Uint8Array | ArrayBuffer} fontData - The font file data.
       */
      __publicField(this, "handleFontData", (fontData) => {
        var _a;
        if (this.isDestroyed || !fontData) return;
        log("Adding embedded font to JASSUB");
        const fontBuffer = fontData instanceof Uint8Array ? fontData.buffer : fontData;
        const fontUrl = URL.createObjectURL(new Blob([fontBuffer]));
        this.fonts.push(fontUrl);
        this.initRenderer();
        (_a = this.renderer) == null ? void 0 : _a.addFont(fontUrl);
      });
      if (!videoElement) {
        throw new Error("Video element must be provided to SubtitleManager");
      }
      this.video = videoElement;
      this.onTrackListUpdate = onTrackListUpdate || (() => {
      });
      this.renderer = null;
      this.isDestroyed = false;
      this.headers = [];
      this.tracks = [];
      this._tracksString = [];
      this._stylesMap = [];
      this.fonts = [getSetting("font", { url: "/Roboto.ttf" }).url];
      this.currentTrack = -1;
      this.ipcCleanupFunctions = [];
      this.setupIPCListeners();
    }
    /**
     * Placeholder: Replace with your actual WebSocket/SSE/etc. listener setup
     */
    setupIPCListeners() {
      if (window.electronIPC && typeof window.electronIPC.receive === "function") {
        log("Setting up IPC listeners...");
        this.ipcCleanupFunctions.push(
          window.electronIPC.receive("subtitle-tracks", this.handleIPCMessage)
        );
        this.ipcCleanupFunctions.push(
          window.electronIPC.receive("subtitle-cue", this.handleIPCMessage)
        );
        this.ipcCleanupFunctions.push(
          window.electronIPC.receive("subtitle-font", this.handleIPCMessage)
        );
      } else {
        console.error("Error: window.electronIPC.receive is not available. Check preload script.");
      }
    }
    /**
     * Adds an external subtitle file (from drag/drop, paste, or file input).
     * @param {File} file
     */
    // --- JASSUB Control ---
    initRenderer() {
      if (!this.renderer && !this.isDestroyed && this.video) {
        log("Initializing JASSUB renderer");
        const options = {
          video: this.video,
          subContent: defaultHeader,
          // Initial header
          fonts: this.fonts,
          // Array of font URLs/buffers
          // IMPORTANT: Update these paths to where you serve JASSUB files
          workerUrl: "/jassub/jassub-worker.js",
          wasmUrl: "/jassub/jassub-worker.wasm",
          legacyWasmUrl: "/jassub/jassub-worker.wasm.js",
          // Fallback
          // modernWasmUrl: '/jassub/jassub-worker-modern.wasm', // If using modern build
          // Settings based placeholders
          offscreenRender: true,
          // Recommended for performance if supported
          libassMemoryLimit: 1024,
          // Example value
          libassGlyphLimit: 8e4,
          // Example value
          maxRenderHeight: parseInt(getSetting("subtitleRenderHeight", "0")) || 0,
          fallbackFont: getSetting("font", { name: "Roboto Medium" }).name,
          useLocalFonts: getSetting("missingFont", true),
          // Use system fonts if needed
          dropAllBlur: getSetting("disableSubtitleBlur", false)
          // Performance optimization
          // Example: Hardcode default font path (adjust as needed)
          // availableFonts: { [defaultFontName]: getSetting('font', {url: '/Roboto.ttf'}).url },
        };
        try {
          this.renderer = new JASSUB(options);
          log("JASSUB renderer initialized");
        } catch (e) {
          console.error("Failed to initialize JASSUB:", e);
        }
      }
    }
    /**
     * Selects a subtitle track to display.
     * @param {number} trackNumber - The track number to select, or -1 to disable.
     */
    selectTrack(trackNumber) {
      if (this.isDestroyed) return;
      this.currentTrack = Number(trackNumber);
      log("Selecting subtitle track: ".concat(this.currentTrack));
      this.initRenderer();
      if (!this.renderer) {
        log("Renderer not available for track selection.");
        return;
      }
      if (this.currentTrack === -1) {
        this.renderer.setTrack(null);
      } else if (this.headers[this.currentTrack]) {
        const header = this.headers[this.currentTrack].header || defaultHeader;
        const trackCues = this.tracks[this.currentTrack] || [];
        let assContent = header;
        for (const cue of trackCues) {
          const startStr = toTS(cue.Start, 1);
          const endStr = toTS(cue.Start + cue.Duration, 1);
          assContent += "Dialogue: ".concat(cue.Layer || 0, ",").concat(startStr, ",").concat(endStr, ",").concat(cue.Style ? this._stylesMap[this.currentTrack][cue.Style] || "Default" : "Default", ",").concat(cue.Name || "", ",").concat(cue.MarginL || 0, ",").concat(cue.MarginR || 0, ",").concat(cue.MarginV || 0, ",").concat(cue.Effect || "", ",").concat(cue.Text.replace(/\r?\n/g, "\\N"), "\n");
        }
        this.renderer.setTrack(assContent);
      } else {
        log("Track ".concat(this.currentTrack, " not found in headers."));
        this.renderer.setTrack(null);
      }
      this.onTrackListUpdate(this.getTrackList());
    }
    /**
     * Returns a list of available subtitle tracks for UI display.
     */
    getTrackList() {
      return this.headers.filter((header) => header !== void 0 && header !== null).map((header) => ({
        number: header.number,
        label: header.name || "Track ".concat(header.number),
        language: header.language || "und",
        selected: header.number === this.currentTrack,
        codec: header.codec
      }));
    }
    /**
     * Cleans up resources used by the subtitle manager.
     */
    destroy() {
      log("Destroying SubtitleManager");
      this.isDestroyed = true;
      if (this.renderer) {
        this.renderer.destroy();
        this.renderer = null;
      }
      this.fonts.forEach((url) => {
        if (url.startsWith("blob:")) {
          URL.revokeObjectURL(url);
        }
      });
      if (this.ipcCleanupFunctions) {
        log("Removing IPC listeners...");
        this.ipcCleanupFunctions.forEach((cleanup) => cleanup());
        this.ipcCleanupFunctions = [];
      }
      this.fonts = [];
      this.headers = [];
      this.tracks = [];
      this._tracksString = [];
      this._stylesMap = [];
      this.currentTrack = -1;
      this.onTrackListUpdate = () => {
      };
      log("SubtitleManager destroyed");
    }
    // --- Conversion Logic (Adapted from Miru) ---
    /**
     * Converts SRT, VTT, or SUB text content to ASS Dialogue lines.
     * @param {string} text - The subtitle text content.
     * @param {string} type - The subtitle format type ('srt', 'vtt', 'sub').
     * @returns {string[]} - An array of ASS Dialogue strings.
     */
    convertSubText(text, type) {
      if (type === "ass" || type === "ssa") {
        const eventMarker = "[Events]";
        const eventIndex = text.indexOf(eventMarker);
        if (eventIndex !== -1) {
          const lines = text.substring(eventIndex + eventMarker.length).trim().split("\n");
          if (lines[0] && lines[0].trim().toLowerCase().startsWith("format:")) {
            return lines.slice(1);
          }
          return lines;
        }
        return [];
      }
      const srtRx = /(?:\d+\r?\n)?(\d{1,2}:\d{2}:\d{2}[,.]\d{2,3})\s?-->\s?(\d{1,2}:\d{2}:\d{2}[,.]\d{2,3})(.*)\r?\n([\s\S]*?(?=\r?\n\r?\n|\r?\n*$))/gi;
      const vttRx = /(?:.*\r?\n)?(\d{2}:)?(\d{2}:\d{2}[,.]\d{3})\s?-->\s?(\d{2}:)?(\d{2}:\d{2}[,.]\d{3})(.*)\r?\n([\s\S]*?(?=\r?\n\r?\n|\r?\n*$))/gi;
      const subRx2 = /[{[](\d+)[}\]][{[](\d+)[}\]](.+)/i;
      const subtitles = [];
      text = text.replace(/\r/g, "");
      if (type === "srt" || type === "vtt" || vttRx.test(text) || srtRx.test(text)) {
        log("Converting ".concat(type, " to ASS"));
        const regex = type === "vtt" || text.includes("WEBVTT") ? vttRx : srtRx;
        let match;
        regex.lastIndex = 0;
        while ((match = regex.exec(text)) !== null) {
          let startTime = match[1] || match[2];
          let endTime = match[3] || match[4];
          let dialogueText = (type === "vtt" ? match[6] : match[4]) || "";
          startTime = this.normalizeTimeFormat(startTime);
          endTime = this.normalizeTimeFormat(endTime);
          dialogueText = dialogueText.replace(/<c\.([^>]+)>([^<]*)<\/c>/g, "{\\c&H$1&}$2{\\c}").replace(/<b[^>]*>([^<]*)<\/b>/g, "{\\b1}$1{\\b0}").replace(/<i[^>]*>([^<]*)<\/i>/g, "{\\i1}$1{\\i0}").replace(/<u[^>]*>([^<]*)<\/u>/g, "{\\u1}$1{\\u0}").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/\r?\n/g, "\\N");
          subtitles.push("Dialogue: 0,".concat(startTime, ",").concat(endTime, ",Default,,0,0,0,,").concat(dialogueText));
        }
      } else if (type === "sub" && subRx2.test(text)) {
        log("Converting SUB (MicroDVD) to ASS");
        let lines = text.split("\n");
        let fps = 23.976;
        const fpsMatch = text.match(/{\s*FRAMERATE\s*=\s*(\d+(?:\.\d+)?)\s*}/i);
        if (fpsMatch && fpsMatch[1]) {
          fps = parseFloat(fpsMatch[1]);
          log("Detected FPS: ".concat(fps));
        } else {
          log("Warning: No FPS found in .sub file, assuming ".concat(fps, "fps."));
        }
        const frameDuration = 1e3 / fps;
        for (const line of lines) {
          const match = line.match(subRx2);
          if (match) {
            const startFrame = parseInt(match[1], 10);
            const endFrame = parseInt(match[2], 10);
            const dialogueText = match[3].replace(/\|/g, "\\N");
            const startTime = toTS(startFrame * frameDuration / 1e3, 1);
            const endTime = toTS(endFrame * frameDuration / 1e3, 1);
            subtitles.push("Dialogue: 0,".concat(startTime, ",").concat(endTime, ",Default,,0,0,0,,").concat(dialogueText));
          }
        }
      } else {
        log("Unsupported subtitle type for conversion or unrecognized format: ".concat(type));
      }
      return subtitles;
    }
    /**
     * Normalizes various time string formats to H:MM:SS.cs (ASS format).
     * Handles formats like HH:MM:SS,ms, MM:SS.ms, H:MM:SS.ms etc.
     * @param {string} timeStr
     * @returns {string} Formatted time string H:MM:SS.cs
     */
    normalizeTimeFormat(timeStr) {
      if (!timeStr) return "0:00:00.00";
      timeStr = timeStr.replace(",", ".");
      const parts = timeStr.split(":");
      let hours = 0, minutes = 0, seconds = 0, centiseconds = 0;
      if (parts.length === 3) {
        hours = parseInt(parts[0], 10);
        minutes = parseInt(parts[1], 10);
        const secParts = parts[2].split(".");
        seconds = parseInt(secParts[0], 10);
        centiseconds = parseInt((secParts[1] || "0").padEnd(2, "0").substring(0, 2), 10);
      } else if (parts.length === 2) {
        minutes = parseInt(parts[0], 10);
        const secParts = parts[1].split(".");
        seconds = parseInt(secParts[0], 10);
        centiseconds = parseInt((secParts[1] || "0").padEnd(2, "0").substring(0, 2), 10);
      } else if (parts.length === 1 && timeStr.includes(".")) {
        const secParts = timeStr.split(".");
        seconds = parseInt(secParts[0], 10);
        centiseconds = parseInt((secParts[1] || "0").padEnd(2, "0").substring(0, 2), 10);
      } else {
        log("Unrecognized time format for normalization: ".concat(timeStr));
        return "0:00:00.00";
      }
      if (isNaN(hours) || isNaN(minutes) || isNaN(seconds) || isNaN(centiseconds)) {
        log("Failed to parse time components: ".concat(timeStr));
        return "0:00:00.00";
      }
      return "".concat(hours, ":").concat(String(minutes).padStart(2, "0"), ":").concat(String(seconds).padStart(2, "0"), ".").concat(String(centiseconds).padStart(2, "0"));
    }
    /**
     * Constructs the object format expected by JASSUB's createEvent.
     * Adapted from Miru
     * @param {object} subtitle - The raw subtitle cue object.
     * @param {boolean} isNotAss - True if the original format needed conversion (e.g., SRT -> ASS).
     * @param {number} subtitleIndex - The index within the track's cue array.
     * @param {number} trackNumber - The track number this cue belongs to.
     * @returns {object} JASSUB event object.
     */
    constructSub(subtitle, isNotAss, subtitleIndex, trackNumber) {
      var _a;
      let text = subtitle.text || "";
      return {
        Start: subtitle.time,
        // Assuming 'time' is start time in seconds
        Duration: subtitle.duration,
        // Assuming duration is in seconds
        Style: ((_a = this._stylesMap[trackNumber]) == null ? void 0 : _a[subtitle.style || "Default"]) || "Default",
        // Use mapped style name or Default
        Name: subtitle.name || "",
        MarginL: Number(subtitle.marginL) || 0,
        MarginR: Number(subtitle.marginR) || 0,
        MarginV: Number(subtitle.marginV) || 0,
        Effect: subtitle.effect || "",
        Text: text,
        ReadOrder: 1,
        // Default read ordere
        Layer: Number(subtitle.layer) || 0,
        _index: subtitleIndex
        // JASSUB uses this internally sometimes
      };
    }
  };

  // frontend/js/watch.js
  var anilistAPI = new AniListAPI();
  var subtitleManager = null;
  function getAnimeData() {
    const animeDataStr = sessionStorage.getItem("currentAnimeData");
    if (animeDataStr) {
      try {
        return JSON.parse(animeDataStr);
      } catch (e) {
        console.error("Error parsing anime data:", e);
      }
    }
  }
  document.addEventListener("DOMContentLoaded", async () => {
    const animeData = getAnimeData();
    if (!animeData || animeData.isLoading) {
      showSkeletonUI();
      const urlParams = new URLSearchParams(window.location.search);
      const animeId = urlParams.get("id");
      if (animeId) {
        await fetchCompleteAnimeData(animeId);
      }
    }
    const menuButton = document.querySelector(".menu-button");
    const sidebar = document.querySelector(".sidebar");
    const overlay = document.querySelector(".overlay");
    menuButton.addEventListener("click", () => {
      toggleSidebar();
    });
    overlay.addEventListener("click", closeSidebar);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeSidebar();
      }
    });
    const searchButton = document.getElementById("search-button");
    if (searchButton) {
      searchButton.addEventListener("click", () => {
        const searchSelect = document.querySelector('.search-input[name="keyword"]');
        const searchValue = searchSelect ? searchSelect.value.trim() : "";
        window.location.href = "search.html".concat(searchValue ? "?search=".concat(encodeURIComponent(searchValue)) : "");
      });
    }
    const searchForm = document.querySelector(".search-content form");
    if (searchForm) {
      searchForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const searchSelect = document.querySelector('.search-input[name="keyword"]');
        const searchValue = searchSelect ? searchSelect.value.trim() : "";
        window.location.href = "search.html".concat(searchValue ? "?search=".concat(encodeURIComponent(searchValue)) : "");
      });
    }
    const filterButton = document.getElementById("filter-button");
    if (filterButton) {
      filterButton.addEventListener("click", () => {
        const searchSelect = document.querySelector('.search-input[name="keyword"]');
        const searchValue = searchSelect ? searchSelect.value.trim() : "";
        window.location.href = "search.html".concat(searchValue ? "?search=".concat(encodeURIComponent(searchValue)) : "");
      });
    }
    function toggleSidebar() {
      if (sidebar.classList.contains("expanded")) {
        sidebar.classList.remove("expanded");
        overlay.classList.remove("active");
      } else {
        sidebar.classList.add("expanded");
        overlay.classList.add("active");
      }
    }
    function closeSidebar() {
      sidebar.classList.remove("expanded");
      overlay.classList.remove("active");
    }
    function updateUIWithCompleteData(animeData2) {
      function updateEpisodeInfo(episodeNumber) {
        const animeData3 = getAnimeData();
        const animeTitle = (animeData3 == null ? void 0 : animeData3.title) || "Anime";
        const watchingTitleEl = document.querySelector(".watching-title");
        if (watchingTitleEl) {
          watchingTitleEl.textContent = "You are watching: ".concat(animeTitle, " Episode ").concat(episodeNumber);
        }
        const episodeData = getEpisodeData(episodeNumber);
        const videoTitleEl = document.querySelector(".video-title");
        if (videoTitleEl && episodeData.title) {
          videoTitleEl.textContent = "You are watching: ".concat(episodeData.title);
        }
      }
      function getEpisodeData(episodeNumber) {
        if (animeData2.episodeData && Array.isArray(animeData2.episodeData)) {
          const episodeIndex = episodeNumber - 1;
          if (episodeIndex >= 0 && episodeIndex < animeData2.episodeData.length) {
            return animeData2.episodeData[episodeIndex];
          }
        }
        return {
          title: "Episode ".concat(episodeNumber),
          overview: "No description available.",
          img: "/api/placeholder/213/120",
          duration: null
        };
      }
      updateEpisodeInfo(1);
      createVideoInfoSection();
      createVideoControlBar();
      createRelatedSeriesSection();
      createEpisodesPanel();
      document.querySelectorAll(".skeleton-loading").forEach((el) => {
        el.classList.remove("skeleton-loading");
      });
    }
    async function fetchCompleteAnimeData(animeId) {
      var _a, _b, _c, _d, _e, _f, _g;
      try {
        const mappingsResponse = await fetch("https://api.ani.zip/mappings?anilist_id=" + animeId);
        const mappingsjson = await mappingsResponse.json();
        const episodeCount = mappingsjson == null ? void 0 : mappingsjson.episodeCount;
        const episodeMetadata = [];
        if (episodeCount) {
          const episodes = (mappingsjson == null ? void 0 : mappingsjson.episodes) || -1;
          if (episodes !== -1) {
            for (let i = 1; i <= episodeCount; i++) {
              const epKey = i.toString();
              if (episodes[epKey]) {
                episodeMetadata.push({
                  episodeNumber: i,
                  overview: episodes[epKey].overview,
                  img: episodes[epKey].image,
                  title: (_a = episodes[epKey].title) == null ? void 0 : _a.en,
                  duration: episodes[epKey].duration
                });
              }
            }
          }
        }
        const relationalDataFetch = await alIdFetch(animeId);
        const relationalData = ((_b = relationalDataFetch == null ? void 0 : relationalDataFetch.data) == null ? void 0 : _b.Media) || {};
        let anilistEpisodes;
        if (relationalData.status === "RELEASING" && relationalData.nextAiringEpisode) {
          if (episodeCount >= relationalData.nextAiringEpisode.episode) {
            anilistEpisodes = relationalData.nextAiringEpisode.episode - 1;
          } else {
            anilistEpisodes = episodeCount;
          }
        } else {
          if (relationalData.episodes !== void 0) {
            anilistEpisodes = relationalData.episodes;
          } else {
            anilistEpisodes = episodeCount;
          }
        }
        const relations = seasonsResolver(((_c = relationalData == null ? void 0 : relationalData.relations) == null ? void 0 : _c.edges) || [], (relationalData == null ? void 0 : relationalData.format) || "", relationalData.coverImage.extraLarge || "/api/placeholder/160/90", anilistEpisodes, ((_d = relationalData.title) == null ? void 0 : _d.english) || ((_e = relationalData.title) == null ? void 0 : _e.romaji));
        const completeAnimeData = {
          id: animeId,
          idMal: relationalData.idMal,
          title: ((_f = relationalData.title) == null ? void 0 : _f.english) || ((_g = relationalData.title) == null ? void 0 : _g.romaji),
          description: relationalData.description,
          status: relationalData.status,
          format: relationalData.format,
          episodes: anilistEpisodes,
          duration: relationalData.duration || 0,
          genres: relationalData.genres || [],
          relations,
          episodeData: episodeMetadata,
          isLoading: false
          // Mark as loaded
        };
        sessionStorage.setItem("currentAnimeData", JSON.stringify(completeAnimeData));
        updateUIWithCompleteData(completeAnimeData);
      } catch (error) {
        console.error("Error fetching complete anime data:", error);
        const currentData = getAnimeData();
        if (currentData) {
          currentData.isLoading = false;
          currentData.loadError = true;
          sessionStorage.setItem("currentAnimeData", JSON.stringify(currentData));
        }
      }
    }
    function showSkeletonUI() {
      const videoContainer = document.querySelector(".video-container");
      if (videoContainer) {
        videoContainer.innerHTML = '\n                <div class="video-placeholder skeleton-loading">\n                    <div class="skeleton-player"></div>\n                </div>\n            ';
      }
      const videoInfo = document.querySelector(".video-info");
      if (videoInfo) {
        videoInfo.innerHTML = '\n                <div class="episode-info skeleton-loading">\n                    <div class="title-container">\n                        <div class="skeleton-text-large"></div>\n                        <div class="skeleton-text-small"></div>\n                    </div>\n                </div>\n                <div class="audio-options skeleton-loading">\n                    <div class="skeleton-button"></div>\n                    <div class="skeleton-button"></div>\n                </div>\n            ';
      }
      const episodesPanel = document.querySelector(".episodes-panel");
      if (episodesPanel) {
        const episodesGrid = episodesPanel.querySelector(".episodes-grid");
        if (episodesGrid) {
          episodesGrid.innerHTML = "";
          const viewMode = episodesPanel.classList.contains("card-mode") ? "card" : "grid";
          if (viewMode === "grid") {
            for (let i = 0; i < 24; i++) {
              const skeletonButton = document.createElement("div");
              skeletonButton.className = "episode-button skeleton-loading";
              episodesGrid.appendChild(skeletonButton);
            }
          } else {
            for (let i = 0; i < 6; i++) {
              const skeletonCard = document.createElement("div");
              skeletonCard.className = "episode-card skeleton-loading";
              const thumbnail = document.createElement("div");
              thumbnail.className = "skeleton-thumbnail";
              const content = document.createElement("div");
              content.className = "skeleton-content";
              content.innerHTML = '\n                            <div class="skeleton-text-large"></div>\n                            <div class="skeleton-text-small"></div>\n                            <div class="skeleton-text-small"></div>\n                        ';
              skeletonCard.appendChild(thumbnail);
              skeletonCard.appendChild(content);
              episodesGrid.appendChild(skeletonCard);
            }
          }
        }
      }
      const seasonsSection = document.querySelector(".seasons-section");
      if (seasonsSection) {
        const seasonsContainer = seasonsSection.querySelector(".seasons-container");
        if (seasonsContainer) {
          seasonsContainer.innerHTML = "";
          for (let i = 0; i < 4; i++) {
            const skeletonCard = document.createElement("div");
            skeletonCard.className = "season-card skeleton-loading";
            seasonsContainer.appendChild(skeletonCard);
          }
        }
      }
    }
    function alIdFetch(alID) {
      const query = "\n        query ($id: Int) {\n          Media(id: $id, type: ANIME) {\n            episodes\n            status\n            title {\n              romaji\n              english\n              native\n            }\n            coverImage {\n                large\n                extraLarge\n            }\n            nextAiringEpisode {\n                airingAt\n                timeUntilAiring\n                episode\n              }\n            format\n            relations {\n                    edges {\n                        node {\n                            type\n                            id\n                            title {\n                                english\n                                romaji\n                            }\n                            format\n                            episodes\n                            coverImage {\n                                large\n                                extraLarge\n                            }\n                        }\n                    relationType\n                }\n            }\n          }\n        }\n        ";
      return anilistAPI.makeRequest({ query, variables: { id: parseInt(alID) } }).catch((error) => console.error("Error fetching data:", error));
    }
    function seasonsResolver(edges, format, img, episodes, title) {
      const filter = edges.filter((edge) => edge.node.format === format && (edge.relationType === "PREQUEL" || edge.relationType === "SEQUEL"));
      let relations = [];
      for (const edge of filter) {
        relations.push({ id: edge.node.id, relationType: edge.relationType, episodeNum: edge.node.episodes, img: edge.node.coverImage.extraLarge, title: edge.node.title.english || edge.node.title.romaji });
      }
      relations.sort((a, b) => getOrder(a) - getOrder(b));
      console.log(relations);
      const middleIndex = Math.floor(relations.length / 2);
      const newElement = { relationType: "SOURCE", episodeNum: episodes, img, title };
      if (relations.length > 1) {
        relations.splice(middleIndex, 0, newElement);
      } else if (relations.length > 0 && relations[0].relationType === "PREQUEL") {
        relations.push(newElement);
      } else if (relations.length > 0 && relations[0].relationType === "SEQUEL") {
        relations.unshift(newElement);
      } else {
      }
      console.log(relations);
      return relations;
      function getOrder(item) {
        if (item.relationType === "PREQUEL") return -1;
        if (item.relationType === "SEQUEL") return 1;
        return 0;
      }
    }
    function createVideoInfoSection() {
      const videoPanel = document.querySelector(".video-panel") || document.getElementById("main-content-watch");
      if (!videoPanel) return;
      let videoInfo = document.querySelector(".video-info");
      if (videoInfo) {
        videoInfo.innerHTML = "";
      } else {
        videoInfo = document.createElement("div");
        videoInfo.className = "video-info";
        const videoContainer = document.querySelector(".video-container");
        if (videoContainer && videoContainer.parentNode) {
          videoContainer.parentNode.insertBefore(videoInfo, videoContainer.nextSibling);
        } else {
          videoPanel.appendChild(videoInfo);
        }
      }
      const episodeInfo = document.createElement("div");
      episodeInfo.className = "episode-info";
      const titleContainer = document.createElement("div");
      titleContainer.className = "title-container";
      const watchingText = document.createElement("h2");
      watchingText.className = "watching-title";
      const animeData2 = getAnimeData();
      const animeTitle = (animeData2 == null ? void 0 : animeData2.title) || "";
      watchingText.textContent = "You are watching: ".concat(animeTitle, " Episode 1");
      const serverMessage = document.createElement("p");
      serverMessage.className = "server-message";
      serverMessage.textContent = "If the current server is not working, please try switching to other servers.";
      titleContainer.appendChild(watchingText);
      titleContainer.appendChild(serverMessage);
      episodeInfo.appendChild(titleContainer);
      const audioOptions = document.createElement("div");
      audioOptions.className = "audio-options";
      const subButton = document.createElement("button");
      subButton.className = "source-button active";
      subButton.dataset.type = "sub";
      subButton.innerHTML = '<i class="fas fa-closed-captioning"></i> SUB';
      const dubButton = document.createElement("button");
      dubButton.className = "source-button";
      dubButton.dataset.type = "dub";
      dubButton.innerHTML = '<i class="fas fa-microphone"></i> DUB';
      audioOptions.appendChild(subButton);
      audioOptions.appendChild(dubButton);
      videoInfo.appendChild(episodeInfo);
      videoInfo.appendChild(audioOptions);
      addVideoInfoStyles();
      initSourceButtons();
    }
    function addVideoInfoStyles() {
      const existingStyle = document.getElementById("video-info-styles");
      if (existingStyle) {
        existingStyle.remove();
      }
      const style = document.createElement("style");
      style.id = "video-info-styles";
      style.textContent = "\n            .video-info {\n                display: flex !important;\n                justify-content: space-between !important;\n                align-items: center !important;\n                background-color: #1a1a1a !important;\n                padding: 15px 20px !important;\n                color: #fff !important;\n                box-shadow: none !important;\n                margin: 0 !important;\n            }\n            \n            .episode-info {\n                flex: 1 !important;\n                margin: 0 !important;\n                padding: 0 !important;\n            }\n            \n            .title-container {\n                display: flex !important;\n                flex-direction: column !important;\n                margin: 0 !important;\n                padding: 0 !important;\n            }\n            \n            .watching-title {\n                font-size: 18px !important;\n                margin: 0 0 10px 0 !important; /* Increased bottom margin for spacing */\n                padding: 0 !important;\n                font-weight: 500 !important;\n                color: #fff !important;\n                line-height: 1.2 !important;\n            }\n            \n            .server-message {\n                font-size: 14px !important;\n                color: #888 !important;\n                margin: 0 !important;\n                padding: 0 !important;\n                line-height: 1.4 !important;\n                font-weight: normal !important;\n                max-width: 600px !important;\n                text-align: left !important;\n            }\n            \n            .audio-options {\n                display: flex !important;\n                align-items: center !important;\n                gap: 10px !important;\n                flex-shrink: 0 !important;\n            }\n            \n            .source-button {\n                padding: 8px 20px !important;\n                border-radius: 25px !important;\n                border: none !important;\n                background-color: #333 !important;\n                color: #fff !important;\n                cursor: pointer !important;\n                transition: all 0.2s !important;\n                font-size: 14px !important;\n                display: flex !important;\n                align-items: center !important;\n                gap: 5px !important;\n            }\n            \n            .source-button i {\n                font-size: 16px !important;\n            }\n            \n            .source-button.active {\n                background-color: #e74c3c !important;\n            }\n            \n            .source-button:hover:not(.active) {\n                background-color: #444 !important;\n            }\n        ";
      document.head.appendChild(style);
    }
    function initSourceButtons() {
      const sourceButtons = document.querySelectorAll(".source-button");
      sourceButtons.forEach((button) => {
        button.addEventListener("click", function() {
          const type = this.dataset.type;
          document.querySelectorAll(".source-button").forEach((btn) => {
            btn.classList.remove("active");
          });
          this.classList.add("active");
          const videoContainer = document.querySelector(".video-container");
          if (videoContainer) {
            const notification = document.createElement("div");
            notification.className = "source-change-notification";
            notification.textContent = "Loading ".concat(type === "sub" ? "Subtitled" : "Dubbed", " version");
            videoContainer.appendChild(notification);
            setTimeout(() => {
              notification.classList.add("fade-out");
              setTimeout(() => notification.remove(), 500);
            }, 3e3);
          }
          console.log("Switched to ".concat(type.toUpperCase()));
        });
      });
    }
    function addNotificationStyles() {
      const style = document.createElement("style");
      style.textContent = "\n            .source-change-notification {\n                position: absolute;\n                top: 20px;\n                right: 20px;\n                background-color: rgba(0, 0, 0, 0.7);\n                color: white;\n                padding: 10px 15px;\n                border-radius: 5px;\n                z-index: 10;\n                animation: fadeIn 0.3s;\n            }\n            \n            .source-change-notification.fade-out {\n                animation: fadeOut 0.5s;\n            }\n            \n            @keyframes fadeIn {\n                from { opacity: 0; transform: translateY(-10px); }\n                to { opacity: 1; transform: translateY(0); }\n            }\n            \n            @keyframes fadeOut {\n                from { opacity: 1; transform: translateY(0); }\n                to { opacity: 0; transform: translateY(-10px); }\n            }\n        ";
      document.head.appendChild(style);
    }
    function createRelatedSeriesSection() {
      const animeData2 = getAnimeData();
      const mainContent = document.getElementById("main-content-watch");
      if (!mainContent) return;
      const relations = animeData2.relations || [];
      console.log("Relations: ", relations.length);
      if (relations.length === 0) return;
      let relatedSection = document.querySelector(".seasons-section");
      if (relatedSection) {
        relatedSection.innerHTML = "";
      } else {
        relatedSection = document.createElement("div");
        relatedSection.className = "seasons-section";
        const videoPanel = document.querySelector(".video-panel");
        const episodesPanel = document.querySelector(".episodes-panel");
        if (videoPanel) {
          if (episodesPanel && episodesPanel.parentNode === mainContent) {
            mainContent.insertBefore(relatedSection, episodesPanel);
          } else {
            videoPanel.appendChild(relatedSection);
          }
        } else {
          if (mainContent.firstChild) {
            mainContent.insertBefore(relatedSection, mainContent.firstChild);
          } else {
            mainContent.appendChild(relatedSection);
          }
        }
      }
      const sectionHeader = document.createElement("div");
      sectionHeader.className = "section-header";
      const sectionTitle = document.createElement("h2");
      sectionTitle.className = "section-title";
      sectionTitle.textContent = "Related Series";
      const navigationControls = document.createElement("div");
      navigationControls.className = "navigation-controls";
      const prevButton = document.createElement("button");
      prevButton.className = "nav-button prev";
      prevButton.innerHTML = '<i class="fas fa-chevron-left"></i>';
      const nextButton = document.createElement("button");
      nextButton.className = "nav-button next";
      nextButton.innerHTML = '<i class="fas fa-chevron-right"></i>';
      navigationControls.appendChild(prevButton);
      navigationControls.appendChild(nextButton);
      sectionHeader.appendChild(sectionTitle);
      sectionHeader.appendChild(navigationControls);
      const relatedContainer = document.createElement("div");
      relatedContainer.className = "seasons-container";
      relations.forEach((relation) => {
        const relationCard = document.createElement("div");
        relationCard.className = "season-card";
        relationCard.dataset.relationType = relation.relationType;
        const bgImage = document.createElement("div");
        bgImage.className = "season-bg";
        bgImage.style.backgroundImage = "url(".concat(relation.img || "/api/placeholder/160/90", ")");
        const relationInfo = document.createElement("div");
        relationInfo.className = "season-info";
        const relationTitle = document.createElement("h3");
        relationTitle.className = "season-title";
        if (relation.relationType === "PREQUEL") {
          relationTitle.textContent = relation.title || "Prequel";
        } else if (relation.relationType === "SEQUEL") {
          relationTitle.textContent = relation.title || "Sequel";
        } else if (relation.relationType === "SOURCE") {
          relationTitle.textContent = relation.title || "Source";
        }
        const episodeCount = document.createElement("span");
        episodeCount.className = "episode-count";
        episodeCount.textContent = "".concat(relation.episodeNum || "?", " Eps");
        relationInfo.appendChild(relationTitle);
        relationInfo.appendChild(episodeCount);
        relationCard.appendChild(bgImage);
        relationCard.appendChild(relationInfo);
        relatedContainer.appendChild(relationCard);
        relationCard.addEventListener("click", () => {
          console.log("Switching to ".concat(relation.relationType));
          document.querySelectorAll(".season-card").forEach((card) => {
            card.classList.remove("active");
          });
          relationCard.classList.add("active");
          if (relation.relationType === "SOURCE" && relationCard.classList.contains("active")) {
            console.log("Already on source anime");
            return;
          }
          if (!relation.id) {
            console.error("No anime ID available for related series");
            return;
          }
          try {
            const initialData = {
              id: relation.id,
              title: relation.title || "",
              status: relation.status || "",
              format: relation.format || "",
              isLoading: true
              // Flag to indicate data is still loading
            };
            sessionStorage.setItem("currentAnimeData", JSON.stringify(initialData));
            window.location.href = "watch.html?id=".concat(relation.id);
          } catch (error) {
            console.error("Error navigating to related series:", error);
          }
          console.log("Navigate to related series");
        });
      });
      relatedSection.appendChild(sectionHeader);
      relatedSection.appendChild(relatedContainer);
      let scrollPosition = 0;
      const cardWidth = 220;
      prevButton.addEventListener("click", () => {
        scrollPosition = Math.max(scrollPosition - cardWidth, 0);
        relatedContainer.scrollTo({
          left: scrollPosition,
          behavior: "smooth"
        });
      });
      nextButton.addEventListener("click", () => {
        scrollPosition = Math.min(
          scrollPosition + cardWidth,
          relatedContainer.scrollWidth - relatedContainer.clientWidth
        );
        relatedContainer.scrollTo({
          left: scrollPosition,
          behavior: "smooth"
        });
      });
      const sourceCard = relatedContainer.querySelector('.season-card[data-relation-type="SOURCE"]');
      if (sourceCard) {
        sourceCard.classList.add("active");
      } else {
        relatedContainer.querySelector(".season-card").classList.add("active");
      }
    }
    function createEpisodesPanel() {
      const animeData2 = getAnimeData();
      const mainContent = document.getElementById("main-content-watch");
      if (!mainContent) return;
      const totalEpisodes = animeData2.episodes || 0;
      if (totalEpisodes <= 0) return;
      let viewMode = "card";
      let currentlySelectedEpisode = 1;
      function getEpisodesPerPage() {
        return viewMode === "grid" ? 100 : 6;
      }
      let currentPage = 0;
      function calculatePagination() {
        const episodesPerPage2 = getEpisodesPerPage();
        const totalPages2 = Math.ceil(totalEpisodes / episodesPerPage2);
        return { episodesPerPage: episodesPerPage2, totalPages: totalPages2 };
      }
      let { episodesPerPage, totalPages } = calculatePagination();
      function updateEpisodeRange() {
        const startEp = currentPage * episodesPerPage + 1;
        const endEp = Math.min((currentPage + 1) * episodesPerPage, totalEpisodes);
        return {
          start: startEp,
          end: endEp,
          display: "".concat(String(startEp).padStart(3, "0"), "-").concat(String(endEp).padStart(3, "0"))
        };
      }
      let currentRange = updateEpisodeRange();
      const episodesSection = document.createElement("div");
      episodesSection.className = "episodes-panel";
      const header = document.createElement("div");
      header.className = "episodes-header";
      const title = document.createElement("h2");
      title.textContent = "Episodes";
      header.appendChild(title);
      const controls = document.createElement("div");
      controls.className = "episodes-controls";
      const searchInput = document.createElement("div");
      searchInput.className = "episode-search";
      searchInput.innerHTML = '<span class="search-hash">#</span><input type="text" placeholder="Find">';
      const listView1Button = document.createElement("button");
      listView1Button.className = "episode-list-button active";
      listView1Button.id = "card-view-button";
      listView1Button.innerHTML = '<i class="fas fa-list"></i>';
      const listView2Button = document.createElement("button");
      listView2Button.className = "episode-list-button";
      listView2Button.id = "grid-view-button";
      listView2Button.innerHTML = '<i class="fas fa-th-large"></i>';
      controls.appendChild(searchInput);
      controls.appendChild(listView1Button);
      controls.appendChild(listView2Button);
      header.appendChild(controls);
      const navigation = document.createElement("div");
      navigation.className = "episodes-navigation";
      const prevButton = document.createElement("button");
      prevButton.className = "nav-button prev";
      prevButton.innerHTML = '<i class="fas fa-chevron-left"></i>';
      if (currentPage === 0) {
        prevButton.disabled = true;
        prevButton.style.opacity = "0.5";
        prevButton.style.cursor = "not-allowed";
      }
      const rangeText = document.createElement("span");
      rangeText.className = "episodes-range";
      rangeText.textContent = currentRange.display;
      const nextButton = document.createElement("button");
      nextButton.className = "nav-button next";
      nextButton.innerHTML = '<i class="fas fa-chevron-right"></i>';
      if (currentPage === totalPages - 1 || totalPages <= 1) {
        nextButton.disabled = true;
        nextButton.style.opacity = "0.5";
        nextButton.style.cursor = "not-allowed";
      }
      navigation.appendChild(prevButton);
      navigation.appendChild(rangeText);
      navigation.appendChild(nextButton);
      function addCardViewStyles() {
        const style = document.createElement("style");
        style.textContent = "\n                /* Base episodes panel styles with transitions */\n                .episodes-panel {\n                    transition: width 0.3s ease, max-width 0.3s ease;\n                    width: 300px; /* Default width for grid view */\n                }\n                \n                /* Expanded panel for card view */\n                .episodes-panel.card-mode {\n                    width: 650px; /* Wider width for card view */\n                    max-width: calc(100vw - 40px); /* Responsive limit */\n                }\n                \n                /* Adjust main content layout when panel is in card mode */\n                #main-content-watch {\n                    transition: grid-template-columns 0.3s ease;\n                }\n                \n                /* Responsive adjustment for main content */\n                @media (max-width: 1000px) {\n                    .episodes-panel.card-mode {\n                        width: 550px;\n                    }\n                }\n                \n                @media (max-width: 850px) {\n                    .episodes-panel.card-mode {\n                        width: 100%;\n                        max-width: 100%;\n                    }\n                }\n                \n                /* Card view specific styles */\n                .episodes-grid.card-view {\n                    display: flex;\n                    flex-direction: column;\n                    gap: 15px;\n                }\n                \n                .episode-card {\n                    display: flex;\n                    background-color: #292929;\n                    border-radius: 8px;\n                    overflow: hidden;\n                    height: 120px;\n                    transition: transform 0.2s, box-shadow 0.2s;\n                    cursor: pointer;\n                }\n                \n                .episode-card:hover {\n                    transform: translateY(-3px);\n                    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);\n                }\n                \n                .episode-card.active {\n                    border: 2px solid #e74c3c;\n                }\n                \n                .episode-card-thumbnail {\n                    width: 213px; /* 16:9 ratio based on height */\n                    height: 120px;\n                    background-size: cover;\n                    background-position: center;\n                    flex-shrink: 0;\n                    position: relative;\n                }\n                \n                .episode-number-overlay {\n                    position: absolute;\n                    top: 8px;\n                    left: 8px;\n                    background-color: rgba(0, 0, 0, 0.7);\n                    color: white;\n                    padding: 3px 8px;\n                    border-radius: 4px;\n                    font-size: 12px;\n                    font-weight: bold;\n                }\n                \n                .episode-duration {\n                    position: absolute;\n                    bottom: 8px;\n                    right: 8px;\n                    background-color: rgba(0, 0, 0, 0.7);\n                    color: white;\n                    padding: 3px 8px;\n                    border-radius: 4px;\n                    font-size: 12px;\n                }\n                \n                .episode-card-content {\n                    padding: 12px;\n                    overflow: hidden;\n                    display: flex;\n                    flex-direction: column;\n                    flex: 1;\n                }\n                \n                .episode-card-title {\n                    font-weight: bold;\n                    margin: 0 0 8px 0;\n                    font-size: 14px;\n                    white-space: nowrap;\n                    overflow: hidden;\n                    text-overflow: ellipsis;\n                }\n                \n                .episode-card-overview {\n                    font-size: 12px;\n                    color: #ccc;\n                    line-height: 1.4;\n                    overflow: hidden;\n                    display: -webkit-box;\n                    -webkit-line-clamp: 3;\n                    -webkit-box-orient: vertical;\n                    max-height: 4.2em;\n                }\n                \n                /* Button styles */\n                .episode-button {\n                    transition: transform 0.2s, background-color 0.2s;\n                }\n                \n                .episode-button:hover {\n                    transform: scale(1.05);\n                    background-color: #3a3a3a;\n                }\n                \n                .episode-button.active {\n                    background-color: #e74c3c;\n                    color: white;\n                    font-weight: bold;\n                }\n                \n                .episode-list-button {\n                    background: none;\n                    border: none;\n                    color: #aaa;\n                    font-size: 18px;\n                    padding: 5px 10px;\n                    cursor: pointer;\n                    transition: color 0.2s;\n                }\n                \n                .episode-list-button:hover {\n                    color: white;\n                }\n                \n                .episode-list-button.active {\n                    color: #e74c3c;\n                }\n            ";
        document.head.appendChild(style);
      }
      addCardViewStyles();
      function generateEpisodeGrid() {
        const grid = document.createElement("div");
        grid.className = "episodes-grid";
        for (let i = currentRange.start; i <= currentRange.end; i++) {
          const episodeButton = document.createElement("button");
          episodeButton.className = "episode-button";
          episodeButton.textContent = i;
          if (i === currentlySelectedEpisode) {
            episodeButton.classList.add("active");
          }
          episodeButton.addEventListener("click", async () => {
            const episodeNumber = parseInt(episodeButton.textContent);
            document.querySelectorAll(".episode-button").forEach((btn) => {
              btn.classList.remove("active");
            });
            episodeButton.classList.add("active");
            updateEpisodeInfo(episodeNumber);
            currentlySelectedEpisode = episodeNumber;
            await loadEpisodeStream(episodeNumber);
          });
          grid.appendChild(episodeButton);
        }
        return grid;
      }
      function handleTrackListUpdate(tracks) {
        console.log("Subtitle tracks available for UI:", tracks);
        const selectEl = document.getElementById("subtitle-select");
        if (!selectEl) return;
        selectEl.innerHTML = '<option value="-1">Subtitles Off</option>';
        tracks.forEach((track) => {
          const option = document.createElement("option");
          option.value = track.number;
          const langPart = track.language && track.language !== "und" ? " (".concat(track.language, ")") : "";
          option.textContent = '<span class="math-inline">{track.label}</span>{langPart}';
          option.selected = track.selected;
          selectEl.appendChild(option);
        });
        selectEl.onchange = (event) => {
          const selectedTrackNumber = parseInt(event.target.value, 10);
          if (subtitleManager) {
            subtitleManager.selectTrack(selectedTrackNumber);
          }
        };
      }
      async function ensureVideoElement() {
        let videoElem = document.getElementById("video-player");
        if (!videoElem) {
          videoElem = document.createElement("video");
          videoElem.id = "video-player";
          videoElem.className = "video-player";
          videoElem.controls = true;
          document.querySelector(".video-container").appendChild(videoElem);
        }
      }
      async function loadEpisodeStream(episodeNumber) {
        var _a, _b;
        try {
          await ensureVideoElement();
          const videoElem = document.getElementById("video-player");
          if (!videoElem) {
            throw new Error("Video element not found after ensuring its existence.");
          }
          if (subtitleManager) {
            subtitleManager.destroy();
          }
          subtitleManager = new SubtitleManager(
            videoElem,
            handleTrackListUpdate
            // Pass the UI update function
          );
          const urlParams = new URLSearchParams(window.location.search);
          const animeId = urlParams.get("id");
          if (!animeId) {
            throw new Error("Missing anime ID in URL");
          }
          const audioType = ((_b = (_a = document.querySelector(".source-button.active")) == null ? void 0 : _a.dataset) == null ? void 0 : _b.type) || "sub";
          const streamUrl = await window.electronAPI.dynamicFinder(animeId, episodeNumber, audioType);
          console.log("Stream URL received:", streamUrl);
          const player = new VideoPlayer("video-player");
          player.setSource(streamUrl, "video/x-matroska");
          player.play();
        } catch (error) {
          console.error("Error while loading episode stream:", error);
        }
      }
      function generateEpisodeCards() {
        const grid = document.createElement("div");
        grid.className = "episodes-grid card-view";
        for (let i = currentRange.start; i <= currentRange.end; i++) {
          const episodeData = getEpisodeData(i);
          const episodeCard = document.createElement("div");
          episodeCard.className = "episode-card";
          episodeCard.style.maxWidth = "100%";
          if (i === currentlySelectedEpisode) {
            episodeCard.classList.add("active");
          }
          const thumbnail = document.createElement("div");
          thumbnail.className = "episode-card-thumbnail";
          thumbnail.style.backgroundImage = "url(".concat(episodeData.img || "/api/placeholder/213/120", ")");
          const episodeNumber = document.createElement("div");
          episodeNumber.className = "episode-number-overlay";
          episodeNumber.textContent = "EP ".concat(i);
          thumbnail.appendChild(episodeNumber);
          if (episodeData.duration) {
            const duration = document.createElement("div");
            duration.className = "episode-duration";
            duration.textContent = formatDuration(episodeData.duration);
            thumbnail.appendChild(duration);
          }
          const content = document.createElement("div");
          content.className = "episode-card-content";
          const title2 = document.createElement("h3");
          title2.className = "episode-card-title";
          title2.textContent = episodeData.title || "Episode ".concat(i);
          content.appendChild(title2);
          const overview = document.createElement("p");
          overview.className = "episode-card-overview";
          overview.textContent = episodeData.overview || "No description available.";
          content.appendChild(overview);
          episodeCard.appendChild(thumbnail);
          episodeCard.appendChild(content);
          episodeCard.addEventListener("click", async () => {
            const episodeNumber2 = parseInt(episodeCard.querySelector(".episode-number-overlay").textContent.replace("EP ", ""));
            document.querySelectorAll(".episode-card").forEach((card) => {
              card.classList.remove("active");
            });
            episodeCard.classList.add("active");
            updateEpisodeInfo(episodeNumber2);
            currentlySelectedEpisode = episodeNumber2;
            await loadEpisodeStream(episodeNumber2);
            console.log("Switching to episode ".concat(episodeNumber2));
          });
          grid.appendChild(episodeCard);
        }
        return grid;
      }
      function updateEpisodeInfo(episodeNumber) {
        const animeData3 = getAnimeData();
        const animeTitle = (animeData3 == null ? void 0 : animeData3.title) || "Anime";
        const watchingTitleEl = document.querySelector(".watching-title");
        if (watchingTitleEl) {
          watchingTitleEl.textContent = "You are watching: ".concat(animeTitle, " Episode ").concat(episodeNumber);
        }
        const episodeData = getEpisodeData(episodeNumber);
        const videoTitleEl = document.querySelector(".video-title");
        if (videoTitleEl && episodeData.title) {
          videoTitleEl.textContent = "You are watching: ".concat(episodeData.title);
        }
      }
      function getEpisodeData(episodeNumber) {
        if (animeData2.episodeData && Array.isArray(animeData2.episodeData)) {
          const episodeIndex = episodeNumber - 1;
          if (episodeIndex >= 0 && episodeIndex < animeData2.episodeData.length) {
            return animeData2.episodeData[episodeIndex];
          }
        }
        return {
          title: "Episode ".concat(episodeNumber),
          overview: "No description available.",
          img: "/api/placeholder/213/120",
          duration: null
        };
      }
      function formatDuration(minutes) {
        if (!minutes) return "??:??";
        const hrs = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hrs > 0) {
          return "".concat(hrs, ":").concat(String(mins).padStart(2, "0"));
        }
        return "".concat(mins, ":00");
      }
      function generateCurrentView() {
        return viewMode === "grid" ? generateEpisodeGrid() : generateEpisodeCards();
      }
      const initialView = generateCurrentView();
      episodesSection.appendChild(header);
      episodesSection.appendChild(navigation);
      episodesSection.appendChild(initialView);
      episodesSection.classList.add("card-mode");
      const videoPanel = document.querySelector(".video-panel");
      if (videoPanel) {
        mainContent.insertBefore(episodesSection, videoPanel);
      } else {
        mainContent.appendChild(episodesSection);
      }
      function updateEpisodeDisplay() {
        const newPagination = calculatePagination();
        episodesPerPage = newPagination.episodesPerPage;
        totalPages = newPagination.totalPages;
        if (currentPage >= totalPages) {
          currentPage = totalPages - 1;
        }
        currentRange = updateEpisodeRange();
        rangeText.textContent = currentRange.display;
        prevButton.disabled = currentPage === 0;
        prevButton.style.opacity = currentPage === 0 ? "0.5" : "1";
        prevButton.style.cursor = currentPage === 0 ? "not-allowed" : "pointer";
        nextButton.disabled = currentPage === totalPages - 1;
        nextButton.style.opacity = currentPage === totalPages - 1 ? "0.5" : "1";
        nextButton.style.cursor = currentPage === totalPages - 1 ? "not-allowed" : "pointer";
        const oldGrid = episodesSection.querySelector(".episodes-grid");
        const newGrid = generateCurrentView();
        episodesSection.replaceChild(newGrid, oldGrid);
      }
      listView1Button.addEventListener("click", () => {
        if (viewMode !== "card") {
          viewMode = "card";
          listView1Button.classList.add("active");
          listView2Button.classList.remove("active");
          const episodesPerPageInCardView = 6;
          const targetPage = Math.floor((currentlySelectedEpisode - 1) / episodesPerPageInCardView);
          currentPage = targetPage;
          episodesSection.classList.add("card-mode");
          setTimeout(() => {
            updateEpisodeDisplay();
            setTimeout(() => {
              const episodeCards = episodesSection.querySelectorAll(".episode-card");
              episodeCards.forEach((card) => {
                const episodeNumber = parseInt(card.querySelector(".episode-number-overlay").textContent.replace("EP ", ""));
                if (episodeNumber === currentlySelectedEpisode) {
                  card.classList.add("active");
                }
              });
            }, 50);
          }, 50);
        }
      });
      listView2Button.addEventListener("click", () => {
        if (viewMode !== "grid") {
          viewMode = "grid";
          listView2Button.classList.add("active");
          listView1Button.classList.remove("active");
          const episodesPerPageInGridView = 100;
          const targetPage = Math.floor((currentlySelectedEpisode - 1) / episodesPerPageInGridView);
          currentPage = targetPage;
          episodesSection.classList.remove("card-mode");
          setTimeout(() => {
            updateEpisodeDisplay();
            setTimeout(() => {
              const episodeButtons = episodesSection.querySelectorAll(".episode-button");
              episodeButtons.forEach((button) => {
                if (parseInt(button.textContent) === currentlySelectedEpisode) {
                  button.classList.add("active");
                }
              });
            }, 50);
          }, 50);
        }
      });
      prevButton.addEventListener("click", () => {
        if (currentPage > 0) {
          currentPage--;
          updateEpisodeDisplay();
          episodesSection.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
      nextButton.addEventListener("click", () => {
        if (currentPage < totalPages - 1) {
          currentPage++;
          updateEpisodeDisplay();
          episodesSection.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
      const searchInputElement = searchInput.querySelector("input");
      searchInputElement.addEventListener("keyup", (e) => {
        if (e.key === "Enter") {
          const searchValue = parseInt(searchInputElement.value);
          if (!isNaN(searchValue) && searchValue > 0 && searchValue <= totalEpisodes) {
            const targetPage = Math.floor((searchValue - 1) / episodesPerPage);
            if (targetPage !== currentPage) {
              currentPage = targetPage;
              updateEpisodeDisplay();
            }
            setTimeout(() => {
              if (viewMode === "grid") {
                const targetButton = Array.from(
                  episodesSection.querySelectorAll(".episode-button")
                ).find((btn) => parseInt(btn.textContent) === searchValue);
                if (targetButton) {
                  targetButton.click();
                  targetButton.scrollIntoView({ behavior: "smooth", block: "center" });
                }
              } else {
                const targetCards = episodesSection.querySelectorAll(".episode-card");
                const targetIndex = searchValue - currentRange.start;
                if (targetIndex >= 0 && targetIndex < targetCards.length) {
                  targetCards[targetIndex].click();
                  targetCards[targetIndex].scrollIntoView({ behavior: "smooth", block: "center" });
                }
              }
            }, 100);
          }
        }
      });
    }
    function createVideoControlBar() {
      const videoContainer = document.querySelector(".video-container");
      if (!videoContainer) return;
      if (videoContainer.querySelector(".video-control-bar")) {
        console.log("Control bar already exists, skipping creation");
        return;
      }
      const controlBar = document.createElement("div");
      controlBar.className = "video-control-bar";
      const buttons = [
        { icon: "download", label: "Download" },
        { icon: "bookmark", label: "Bookmark" },
        { icon: "play-circle", label: "AutoPlay" },
        { icon: "forward", label: "AutoSkip" },
        { icon: "users", label: "W2G" }
      ];
      buttons.forEach((button) => {
        const buttonEl = document.createElement("button");
        buttonEl.className = "control-button";
        buttonEl.setAttribute("aria-label", button.label);
        buttonEl.dataset.action = button.label.toLowerCase();
        const icon = document.createElement("i");
        icon.className = "fas fa-".concat(button.icon);
        const text = document.createElement("span");
        text.textContent = button.label;
        buttonEl.appendChild(icon);
        buttonEl.appendChild(text);
        buttonEl.addEventListener("click", function() {
          console.log("".concat(button.label, " button clicked"));
          if (["autoplay", "autoskip"].includes(button.label.toLowerCase())) {
            this.classList.toggle("active");
          }
        });
        controlBar.appendChild(buttonEl);
      });
      videoContainer.appendChild(controlBar);
      addVideoControlBarStyles();
    }
    function addVideoControlBarStyles() {
      const style = document.createElement("style");
      style.textContent = "\n            .video-control-bar {\n                display: flex;\n                justify-content: space-around;\n                align-items: center;\n                background-color: #1a1a1a;\n                border-radius: 0 0 8px 8px;\n                padding: 10px 15px;\n                margin-top: -5px;\n                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);\n            }\n            \n            .control-button {\n                display: flex;\n                flex-direction: column;\n                align-items: center;\n                background: none;\n                border: none;\n                color: #aaa;\n                font-size: 12px;\n                padding: 5px 10px;\n                cursor: pointer;\n                transition: color 0.2s, transform 0.2s;\n            }\n            \n            .control-button:hover {\n                color: #e74c3c;\n                transform: translateY(-2px);\n            }\n            \n            .control-button.active {\n                color: #e74c3c;\n            }\n            \n            .control-button i {\n                font-size: 18px;\n                margin-bottom: 5px;\n            }\n        ";
      document.head.appendChild(style);
    }
    const episodeItems = document.querySelectorAll(".episode-item");
    episodeItems.forEach((item) => {
      item.addEventListener("click", () => {
        const episodeTitle = item.querySelector(".episode-title").textContent;
        const videoTitleElement = document.querySelector(".video-title");
        if (videoTitleElement) {
          videoTitleElement.textContent = episodeTitle;
        }
        isPlaying = false;
        if (playPauseButton) {
          playPauseButton.innerHTML = '<i class="fas fa-play"></i>';
        }
        currentProgress = 0;
        if (progressBar) {
          progressBar.style.width = "0%";
        }
        if (currentTimeDisplay) {
          currentTimeDisplay.textContent = "00:00";
        }
        if (videoPlayer) {
          videoPlayer.scrollIntoView({ behavior: "smooth" });
        }
      });
    });
  });
})();
//# sourceMappingURL=watch.js.map
