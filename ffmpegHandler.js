// ffmpegHandler.js 
import ffmpeg from "fluent-ffmpeg"
import ffmpegPath from 'ffmpeg-static';

export function startFfmpegPlayer(streamUrl, canvasId, width = 640, height = 360) {
  // Find the canvas element in the DOM
  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    console.error("Canvas not found: ", canvasId);
    return;
  }
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Calculate frame size (RGB24: 3 bytes per pixel)
  const frameSize = width * height * 3;
  let frameBuffer = Buffer.alloc(0);

  // Configure FFmpeg to output raw video frames
  const command = ffmpeg(streamUrl)
    .setFfmpegPath(ffmpegPath)
    .outputOptions([
      '-f', 'rawvideo',
      '-pix_fmt', 'rgb24'
    ])
    .output('-')
    .on('start', (cmdLine) => {
      console.log('FFmpeg process started:', cmdLine);
    })
    .on('error', (err) => {
      console.error('FFmpeg error:', err);
    })
    .on('end', () => {
      console.log('FFmpeg finished');
    });

  // Pipe FFmpeg output and process frame data
  const ffmpegStream = command.pipe();

  ffmpegStream.on('data', (chunk) => {
    frameBuffer = Buffer.concat([frameBuffer, chunk]);
    while (frameBuffer.length >= frameSize) {
      const frameData = frameBuffer.slice(0, frameSize);
      frameBuffer = frameBuffer.slice(frameSize);
      // Create an ImageData object and draw it on the canvas
      const imageDataArray = new Uint8ClampedArray(frameData);
      const imageData = new ImageData(imageDataArray, width, height);
      ctx.putImageData(imageData, 0, 0);
    }
  });
}

