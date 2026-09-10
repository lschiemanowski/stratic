import { build } from 'esbuild';
import { mkdirSync, copyFileSync, cpSync } from 'node:fs';
mkdirSync('dist', { recursive: true });
await Promise.all([
  build({ entryPoints: ['src/desktop/view-worker.ts'], outfile: 'dist/view-worker.cjs', bundle: true, platform: 'node', format: 'cjs' }),
  build({ entryPoints: ['src/desktop/main.ts'], outfile: 'dist/main.cjs', bundle: true, platform: 'node', format: 'cjs', external: ['electron'] }),
  build({ entryPoints: ['src/desktop/preload.ts'], outfile: 'dist/preload.cjs', bundle: true, platform: 'node', format: 'cjs', external: ['electron'] }),
  build({ entryPoints: ['src/desktop/renderer.ts'], outfile: 'dist/renderer.js', bundle: true, platform: 'browser', format: 'iife' }),
]);
for (const name of ['index.html', 'style.css']) copyFileSync(`src/desktop/${name}`, `dist/${name}`);

copyFileSync('node_modules/highlight.js/styles/github.css', 'dist/highlight.css');

copyFileSync('node_modules/katex/dist/katex.min.css', 'dist/katex.css');
cpSync('node_modules/katex/dist/fonts', 'dist/fonts', { recursive: true });
