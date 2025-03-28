import { spawn } from 'child_process';

function probeHeader(file) {
    return new Promise((resolve, reject) => {
      const limitBytes = 5 * 1024 * 1024; // 5 MB
      const sampleStream = file.createReadStream({ start: 0, end: limitBytes - 1 });
      
      const ffprobeProcess = spawn('ffprobe', [
        '-v', 'error',
        '-print_format', 'json',
        '-show_streams',
        '-i', 'pipe:0'
      ]);
      
      let dataBuffer = '';
      ffprobeProcess.stdout.on('data', (data) => {
        dataBuffer += data.toString();
      });
      
      ffprobeProcess.stderr.on('data', (data) => {
        console.error('ffprobe stderr:', data.toString());
      });
      
      ffprobeProcess.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error(`ffprobe exited with code ${code}`));
        }
        try {
          const metadata = JSON.parse(dataBuffer);
          resolve(metadata);
        } catch (err) {
          reject(err);
        }
      });
      
      // Handle errors on the streams
      ffprobeProcess.stdin.on('error', (err) => {
        if (err.code === 'EPIPE') {
          sampleStream.destroy();
        } else {
          reject(err);
        }
      });
      
      sampleStream.on('error', (err) => {
        reject(err);
      });
      
      // Pipe the 5 MB sample into ffprobe's stdin.
      sampleStream.pipe(ffprobeProcess.stdin);
    });
  }
  
export default probeHeader;