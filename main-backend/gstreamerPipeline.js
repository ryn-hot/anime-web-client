// src/main/gstreamerPipeline.js
import { spawn } from 'child_process';
import http from 'http';
import config from './config.js'; // Expects at least config.gstPort defined, e.g. { gstPort: 8000 }

let activePipeline = null;
let activeServer = null;

/**
 * Starts the GStreamer pipeline by piping in the torrent stream and
 * setting up an HTTP server that serves a fragmented MP4 stream.
 *
 * @param {Object} streamData - The torrent stream object with properties:
 *                              { stream: Readable, fileName: string, length: number, extension: string }
 * @returns {Promise<string>} - A URL (e.g., "http://localhost:8000/stream") that the front end can use.
 */
export function start(streamData) {
  return new Promise((resolve, reject) => {
    // Clean up any previous pipeline/server.
    if (activePipeline) {
      activePipeline.kill();
      activePipeline = null;
    }
    if (activeServer) {
      activeServer.close();
      activeServer = null;
    }

    // Build the GStreamer pipeline.
    // This sample pipeline reads from STDIN (using fdsrc), automatically demuxes
    // using decodebin (for a generic approach), and then remuxes into fragmented MP4.
    // Note: Adjust the pipeline as needed for your formats and track handling.
    const gstArgs = [
      'fdsrc', 'fd=0',
      '!', 'decodebin',
      '!', 'queue',
      // Here we use mp4mux with fragment-duration set to 1000ms.
      '!', 'mp4mux', 'fragment-duration=1000', 'streamable=true',
      '!', 'fdsink', 'fd=1'
    ];

    // Spawn the GStreamer process.
    const gstProcess = spawn('gst-launch-1.0', gstArgs, { stdio: ['pipe', 'pipe', 'inherit'] });
    activePipeline = gstProcess;

    gstProcess.on('error', (err) => {
      console.error('GStreamer process error:', err);
      reject(err);
    });

    // Pipe the torrent stream into the GStreamer process’s STDIN.
    streamData.stream.pipe(gstProcess.stdin);

    // Set up an HTTP server to serve the output from GStreamer.
    const server = http.createServer((req, res) => {
      if (req.url === '/stream') {
        // Set appropriate headers for fragmented MP4.
        res.writeHead(200, {
          'Content-Type': 'video/mp4',
          'Transfer-Encoding': 'chunked',
        });
        gstProcess.stdout.pipe(res);
        req.on('close', () => {
          // You could add logic here to detect when no clients are connected.
        });
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    server.on('error', (err) => {
      console.error('HTTP server error in GStreamerPipeline:', err);
      reject(err);
    });

    // Start listening on the configured port.
    server.listen(config.gstPort, () => {
      activeServer = server;
      const outputUrl = `http://localhost:${config.gstPort}/stream`;
      console.log(`GStreamer pipeline serving at ${outputUrl}`);
      resolve(outputUrl);
    });
  });
}

/**
 * Stops the active GStreamer pipeline and HTTP server.
 */
export function stop() {
  if (activePipeline) {
    activePipeline.kill();
    activePipeline = null;
  }
  if (activeServer) {
    activeServer.close();
    activeServer = null;
  }
}

export default {
  start,
  stop,
};
