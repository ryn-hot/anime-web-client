// File extension helpers
export const videoExtensions = ['3g2', '3gp', 'asf', 'avi', 'dv', 'flv', 'gxf', 'm2ts', 'm4a', 'm4b', 'm4p', 'm4r', 'm4v', 'mkv', 'mov', 'mp4', 'mpd', 'mpeg', 'mpg', 'mxf', 'nut', 'ogm', 'ogv', 'swf', 'ts', 'vob', 'webm', 'wmv', 'wtv'];
export const videoRx = new RegExp(`.(${videoExtensions.join('|')})$`, 'i');

export const subtitleExtensions = ['srt', 'vtt', 'ass', 'ssa', 'sub', 'txt'];
export const subRx = new RegExp(`.(${subtitleExtensions.join('|')})$`, 'i');
    
export const fontExtensions = ['ttf', 'ttc', 'woff', 'woff2', 'otf', 'cff', 'otc', 'pfa', 'pfb', 'pcf', 'fnt', 'bdf', 'pfr', 'eot'];
export const fontRx = new RegExp(`.(${fontExtensions.join('|')})$`, 'i');
