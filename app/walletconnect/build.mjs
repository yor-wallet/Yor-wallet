// Construit ../js/vendor/reown-appkit.js (un seul fichier, IIFE, expose window.NexAppKit).
// Usage : cd walletconnect && npm ci && npm run build   (ou npm install si vous n'avez pas package-lock.json)
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const outfile = here('../js/vendor/reown-appkit.js');

const r = await build({
  entryPoints: [here('./src/entry.js')],
  bundle: true, format: 'iife', platform: 'browser', target: 'es2020', minify: true, legalComments: 'none',
  outfile, metafile: true, logLevel: 'warning',
  define: { 'process.env.NODE_ENV': '"production"', global: 'globalThis' },
  conditions: ['browser', 'import', 'module'], mainFields: ['browser', 'module', 'main']
});
const bytes = Object.values(r.metafile.outputs)[0].bytes;
const sha = createHash('sha256').update(readFileSync(outfile)).digest('hex');
console.log('ecrit  js/vendor/reown-appkit.js');
console.log('octets', bytes);
console.log('sha256', sha);
