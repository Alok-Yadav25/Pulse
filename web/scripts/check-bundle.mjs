import { readFile, readdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

// Vite's entry uses modulepreload for static imports. Lazy chart chunks are excluded.
const index = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
const files = [...index.matchAll(/(?:src|href)="(\/assets\/[^"\s]+\.js)"/g)].map(match => match[1]);
let bytes = 0;
for (const file of new Set(files)) bytes += gzipSync(await readFile(new URL(`../dist${file}`, import.meta.url))).length;
console.log(`Initial JS: ${(bytes / 1024).toFixed(1)} KiB gzip (limit: 200 KiB).`);
if (bytes > 200 * 1024) throw new Error('Initial JavaScript exceeds the 200 KiB gzip budget.');
// Print every chunk separately so deferred code remains visible in build reports.
for (const file of (await readdir(new URL('../dist/assets', import.meta.url))).filter(name => name.endsWith('.js'))) {
  const content = await readFile(new URL(join('../dist/assets', file), import.meta.url));
  console.log(`${file}: ${(gzipSync(content).length / 1024).toFixed(1)} KiB gzip`);
}
