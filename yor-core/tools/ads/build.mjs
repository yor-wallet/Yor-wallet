import { mkdirSync, writeFileSync } from 'node:fs';
import { SCENES } from './scenes.mjs';
const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
for (const [k, fn] of Object.entries(SCENES)) {
  const svg = fn().replace(' width="240" height="200"', '').replace(' role="img" aria-hidden="true" focusable="false"', '');
  writeFileSync(`${OUT}/ad-${k}.svg`, svg);
}
