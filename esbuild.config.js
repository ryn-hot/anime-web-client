// esbuild.config.js
import esbuild from "esbuild"

esbuild.build({
    entryPoints: [
        './frontend/js/script.js',  // entry point used by index.html
        './frontend/js/watch.js',   // entry point used by watch.html
        './frontend/js/filter.js' 
    ],
    bundle: true,
    sourcemap: true,
    outdir: './frontend/dist',
    // Use the IIFE format so the bundled code runs directly in the browser context
    format: 'iife',
    target: ['chrome58', 'firefox57', 'safari11'], // Adjust as needed for Electron
  }).catch(() => process.exit(1));