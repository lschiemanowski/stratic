import { build } from 'esbuild';
import { dirname, join } from 'node:path';
import { mkdirSync, copyFileSync, cpSync, rmSync, readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
const bundles = await Promise.all([
  build({ entryPoints: ['src/cli.ts'], outfile: 'dist/cli.mjs', bundle: true, metafile: true, platform: 'node', format: 'esm', packages: 'external' }),
  build({ entryPoints: ['src/desktop/view-worker.ts'], outfile: 'dist/view-worker.cjs', bundle: true, metafile: true, platform: 'node', format: 'cjs' }),
  build({ entryPoints: ['src/desktop/main.ts'], outfile: 'dist/main.cjs', bundle: true, metafile: true, platform: 'node', format: 'cjs', external: ['electron'] }),
  build({ entryPoints: ['src/desktop/preload.ts'], outfile: 'dist/preload.cjs', bundle: true, metafile: true, platform: 'node', format: 'cjs', external: ['electron'] }),
  build({ entryPoints: ['src/desktop/renderer.ts'], outfile: 'dist/renderer.js', bundle: true, metafile: true, platform: 'browser', format: 'iife' }),
]);
for (const name of ['index.html', 'style.css']) copyFileSync(`src/desktop/${name}`, `dist/${name}`);

copyFileSync('node_modules/highlight.js/styles/github.css', 'dist/highlight.css');

copyFileSync('node_modules/katex/dist/katex.min.css', 'dist/katex.css');
cpSync('node_modules/katex/dist/fonts', 'dist/fonts', { recursive: true });

copyFileSync('src/desktop/assets/stratic-icon.png', 'dist/stratic-icon.png');

// Retain dependency notices alongside the bundled desktop code and fonts.
const packages = new Set<string>(['node_modules/katex', 'node_modules/highlight.js']);
for (const bundle of bundles) for (const input of Object.keys(bundle.metafile!.inputs)) {
  if (!input.includes('node_modules/')) continue;
  let path = dirname(input);
  while (path !== '.' && !existsSync(join(path, 'package.json'))) path = dirname(path);
  if (path !== '.') packages.add(path);
}
const notices = [...packages].sort().map(path => {
  const metadata = JSON.parse(readFileSync(join(path, 'package.json'), 'utf8'));
  const licenses = readdirSync(path).filter(name => /^(licen[cs]e|copying|notice)([.-]|$)/i.test(name));
  return `${metadata.name}@${metadata.version} (${metadata.license ?? 'see license'})\n` + licenses.map(name => readFileSync(join(path, name), 'utf8')).join('\n');
});
writeFileSync('dist/THIRD_PARTY_NOTICES.txt', notices.join('\n\n--------------------\n\n'));
