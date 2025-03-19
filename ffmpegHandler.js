// ffmpegHandler.js 
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from 'ffmpeg-static';

// Track active ffmpeg processes for cleanup
const activeCommands = new Set();

// Clean up function to call when no longer using a command
export function cleanupFfmpeg(command) {
  if (command && activeCommands.has(command)) {
    try {
      command.kill('SIGKILL');
    } catch (err) {
      console.error('Error killing ffmpeg process:', err);
    }
    activeCommands.delete(command);
  }
}

// Clean up all ffmpeg processes
export function cleanupAllFfmpeg() {
  for (const command of activeCommands) {
    try {
      command.kill('SIGKILL');
    } catch (err) {
      console.error('Error killing ffmpeg process during cleanup:', err);
    }
  }
  activeCommands.clear();
}

export function startFfmpegPlayer(streamUrl, canvasId, width = 640, height = 360, mimeType) {
  // Find the canvas element in the DOM
  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    console.error("Canvas not found: ", canvasId);
    return null;
  }
  
  // Set canvas dimensions
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  // Clear canvas with black background
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Show loading text
  ctx.fillStyle = 'white';
  ctx.font = '16px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Loading video...', canvas.width / 2, canvas.height / 2);

  // Calculate frame size (RGB24: 3 bytes per pixel)
  const frameSize = width * height * 3;
  let frameBuffer = Buffer.alloc(0);
  
  // Create active flag for tracking state
  let active = true;

  // Configure FFmpeg with more explicit output settings
  const command = ffmpeg(streamUrl, { timeout: 30000 })
    .setFfmpegPath(ffmpegPath)
    .noAudio()
    .videoCodec('rawvideo')
    .outputOptions([
      '-f', 'rawvideo',       // Force output format
      '-pix_fmt', 'rgb24',    // RGB pixel format (3 bytes per pixel)
      '-vsync', '0',          // Video sync method
      '-r', '30',             // Frame rate
      '-s', `${width}x${height}` // Output size
    ])
    .output('-')              // Output to stdout
    .on('start', (cmdLine) => {
      console.log('FFmpeg command:', cmdLine);
    })
    .on('stderr', (stderrLine) => {
      // Only log errors, not all stderr output
      if (stderrLine.includes('Error') || stderrLine.includes('Invalid')) {
        console.error('FFmpeg stderr:', stderrLine);
      }
    })
    .on('error', (err, stdout, stderr) => {
      console.error('FFmpeg error:', err.message);
      // Only show a portion of stderr to avoid flooding the console
      if (stderr) {
        console.error('FFmpeg stderr:', stderr.substring(0, 500) + (stderr.length > 500 ? '...' : ''));
      }
      
      // Show error message on canvas
      if (active && ctx) {
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'red';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Error loading video', canvas.width / 2, canvas.height / 2 - 15);
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.fillText('Try selecting a different episode', canvas.width / 2, canvas.height / 2 + 15);
      }
      
      active = false;
    })
    .on('end', () => {
      console.log('FFmpeg finished');
      active = false;
      
      // Show end message on canvas
      if (ctx) {
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Video playback ended', canvas.width / 2, canvas.height / 2);
      }
    });

  // Add to active commands for tracking
  activeCommands.add(command);

  try {
    // Pipe FFmpeg output with better error handling
    const ffmpegStream = command.pipe();
    
    // Handle stream errors
    ffmpegStream.on('error', (err) => {
      console.error('FFmpeg stream error:', err);
      active = false;
    });
    
    // Process incoming frame data
    ffmpegStream.on('data', (chunk) => {
      if (!active) return;
      
      try {
        // Append the new chunk to our buffer
        frameBuffer = Buffer.concat([frameBuffer, chunk]);
        
        // Process complete frames
        while (frameBuffer.length >= frameSize) {
          const frameData = frameBuffer.slice(0, frameSize);
          frameBuffer = frameBuffer.slice(frameSize);
          
          // Create an ImageData object and draw it on the canvas
          const imageDataArray = new Uint8ClampedArray(frameData);
          const imageData = new ImageData(imageDataArray, width, height);
          ctx.putImageData(imageData, 0, 0);
        }
      } catch (err) {
        console.error('Error processing frame data:', err);
      }
    });
    
    // Handle end of stream
    ffmpegStream.on('end', () => {
      console.log('FFmpeg stream ended');
      active = false;
    });
    
    return command;
  } catch (err) {
    console.error('Error setting up FFmpeg stream:', err);
    cleanupFfmpeg(command);
    return null;
  }
}