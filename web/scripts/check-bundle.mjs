import { readFile, readdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
const index=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
const entryNames=[...index.matchAll(/(?:src|href)="(\/assets\/[^"\s]+\.js)"/g)].map(m=>m[1].split('/').at(-1));
let all=0,entry=0;
for(const name of (await readdir(new URL('../dist/assets',import.meta.url))).filter(n=>n.endsWith('.js'))){const bytes=gzipSync(await readFile(new URL(`../dist/assets/${name}`,import.meta.url))).length;all+=bytes;if(entryNames.includes(name))entry+=bytes;console.log(`${name}: ${(bytes/1024).toFixed(1)} KiB gzip`);}
console.log(`Entry JS: ${(entry/1024).toFixed(1)} KiB gzip. ALL route and chart JS: ${(all/1024).toFixed(1)} KiB gzip (200 KiB limit).`);
if(all>200*1024)throw new Error('Total application JavaScript exceeds 200 KiB gzip, including every lazy route and chart.');
