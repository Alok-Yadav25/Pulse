import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { transform } from '../web/node_modules/esbuild/lib/main.js';

const source = await readFile(new URL('./pulse.js', import.meta.url), 'utf8');
const { code } = await transform(source, { minify: true, target: 'es2020' });
const size = gzipSync(code).length;
if (size > 2048) throw new Error(`Tracker is ${size} gzip bytes; maximum is 2048.`);
const target = new URL('../backend/app/static/', import.meta.url);
await mkdir(target, { recursive: true });
await writeFile(new URL('t.js', target), code);
console.log(`Tracker: ${size} bytes gzip / ${Buffer.byteLength(code)} bytes raw.`);
