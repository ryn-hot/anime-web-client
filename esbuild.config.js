// esbuild.config.js
import esbuild from 'esbuild';
import fs from 'fs/promises';
import path from 'path';

const jassubWorkerPath = path.resolve(
  'node_modules/jassub/dist/jassub-worker.js'
);

const jassubPlugin = {
  name: 'jassub-worker-as-asset',
  setup(build) {
    // 1) intercept the import
    build.onResolve(
      { filter: /jassub\/dist\/jassub-worker\.js$/ },
      () => ({ path: jassubWorkerPath, namespace: 'jassub-asset' })
    );

    // 2) hand the loader actual bytes + tell it to treat them as a "file"
    build.onLoad(
      { filter: /.*/, namespace: 'jassub-asset' },
      async (args) => ({
        contents: await fs.readFile(args.path),
        loader: 'file'
      })
    );
  }
};

esbuild.build({
  entryPoints: [
    './frontend/js/script.js',
    './frontend/js/watch.js',
    './frontend/js/filter.js'
  ],
  bundle: true,
  sourcemap: true,
  outdir: './frontend/dist',
  publicPath: 'dist',
  format: 'iife',
  target: ['chrome58', 'firefox57', 'safari11'],
  loader: { '.wasm': 'dataurl', '.ttf': 'dataurl'}, 
  plugins: [jassubPlugin]        
}).catch(() => process.exit(1));
