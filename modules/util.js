// File extension helpers
export const videoExtensions = ['3g2', '3gp', 'asf', 'avi', 'dv', 'flv', 'gxf', 'm2ts', 'm4a', 'm4b', 'm4p', 'm4r', 'm4v', 'mkv', 'mov', 'mp4', 'mpd', 'mpeg', 'mpg', 'mxf', 'nut', 'ogm', 'ogv', 'swf', 'ts', 'vob', 'webm', 'wmv', 'wtv'];
export const videoRx = new RegExp(`.(${videoExtensions.join('|')})$`, 'i');

export const subtitleExtensions = ['srt', 'vtt', 'ass', 'ssa', 'sub', 'txt'];
export const subRx = new RegExp(`.(${subtitleExtensions.join('|')})$`, 'i');
    
export const fontExtensions = ['ttf', 'ttc', 'woff', 'woff2', 'otf', 'cff', 'otc', 'pfa', 'pfb', 'pcf', 'fnt', 'bdf', 'pfr', 'eot'];
export const fontRx = new RegExp(`.(${fontExtensions.join('|')})$`, 'i');

// Debug utility
export const debug = (prefix) => (message) => {
  console.log(`[${prefix}] ${message}`);
};

// Helper to convert ASS to WebVTT
export function convertAssToVtt(assContent) {
  // Basic ASS to WebVTT conversion
  // In a production app, you'd use a more sophisticated converter
  let vttContent = 'WEBVTT\n\n';
  
  // Extract dialogue lines
  const dialogueLines = assContent.split('\n').filter(line => line.startsWith('Dialogue:'));
  
  dialogueLines.forEach(line => {
    const parts = line.split(',');
    if (parts.length >= 10) {
      const startTime = parseAssTime(parts[1].trim());
      const endTime = parseAssTime(parts[2].trim());
      
      // Extract text (everything after the 9th comma)
      let text = parts.slice(9).join(',');
      // Remove ASS styling tags
      text = text.replace(/{[^}]*}/g, '');
      
      vttContent += `${startTime} --> ${endTime}\n${text}\n\n`;
    }
  });
  
  return vttContent;
}

function parseAssTime(assTime) {
  // Convert ASS time format (H:MM:SS.cc) to WebVTT format (HH:MM:SS.mmm)
  const [h, m, rest] = assTime.split(':');
  const [s, cs] = rest.split('.');
  const ms = cs ? parseInt(cs) * 10 : 0; // Convert centiseconds to milliseconds
  
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}:${s.padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

// File buffer to blob URL
export function bufferToUrl(buffer, mimeType) {
  const blob = new Blob([buffer], { type: mimeType });
  return URL.createObjectURL(blob);
}