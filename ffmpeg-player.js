// ffmpegPlayer.js
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

/**
 * Starts an ffmpeg-based video player that decodes the input stream and renders it on a canvas.
 *
 * @param {string} inputUrl - The URL or file path of the video stream to decode.
 * @param {HTMLCanvasElement} canvasElement - The canvas element where the video will be rendered.
 * @param {number} [width=640] - The width of the video output.
 * @param {number} [height=360] - The height of the video output.
 */
export function startFfmpegPlayer(inputUrl, canvasElement, width = 640, height = 360) {
  // Set the canvas dimensions.
  canvasElement.width = width;
  canvasElement.height = height;
  const ctx = canvasElement.getContext('2d');

  // Each frame is width * height pixels with 3 bytes per pixel (RGB24).
  const frameSize = width * height * 3;
  let frameBuffer = Buffer.alloc(0);

  // Set up the ffmpeg command:
  // - Input: provided by inputUrl.
  // - Output: raw video to stdout, using RGB24 pixel format.
  const command = ffmpeg(inputUrl)
    .setFfmpegPath(ffmpegPath)
    .outputOptions([
      '-f', 'rawvideo',
      '-pix_fmt', 'rgb24'
    ])
    .output('-') // Use stdout as the output.
    .on('start', (cmdLine) => {
      console.log('FFmpeg process started with command:', cmdLine);
    })
    .on('error', (err) => {
      console.error('An error occurred in FFmpeg:', err.message);
    })
    .on('end', () => {
      console.log('FFmpeg processing finished.');
    });

  // Pipe the ffmpeg output stream.
  const ffmpegStream = command.pipe();

  // Listen for data from ffmpeg.
  ffmpegStream.on('data', (chunk) => {
    // Append new data to the frame buffer.
    frameBuffer = Buffer.concat([frameBuffer, chunk]);

    // Process complete frames from the buffer.
    while (frameBuffer.length >= frameSize) {
      // Extract one full frame.
      const frameData = frameBuffer.slice(0, frameSize);
      frameBuffer = frameBuffer.slice(frameSize);

      // Convert the raw frame data into an ImageData object.
      // (Browser's ImageData expects a Uint8ClampedArray.)
      const imageDataArray = new Uint8ClampedArray(frameData);
      const imageData = new ImageData(imageDataArray, width, height);

      // Draw the frame on the canvas.
      ctx.putImageData(imageData, 0, 0);
    }
  });

  ffmpegStream.on('end', () => {
    console.log('FFmpeg stream ended.');
  });
}
    