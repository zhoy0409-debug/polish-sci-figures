/* Developer-only preparation: download verified public wheels, never research data. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cache = path.join(root, '.cache/mobile-local-spike/node_modules/pyodide');
const offline = process.argv.includes('--offline');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const pkg = JSON.parse(await fs.readFile(path.join(cache, 'package.json'), 'utf8'));
if (pkg.name !== 'pyodide' || pkg.version !== '0.29.3') throw new Error('First install exactly pyodide@0.29.3 using the command in web/README.md');
const lock = JSON.parse(await fs.readFile(path.join(cache, 'pyodide-lock.json'), 'utf8'));
const names = new Set();
function add(name) {
  if (names.has(name)) return;
  const entry = lock.packages[name];
  if (!entry) throw new Error('Missing pinned dependency: ' + name);
  names.add(name);
  for (const dependency of entry.depends) add(dependency);
}
for (const name of ['numpy', 'scipy', 'pandas', 'matplotlib', 'pillow', 'opencv-python']) add(name);
let downloaded = 0;
for (const name of [...names].sort()) {
  const entry = lock.packages[name];
  if (!/^[a-zA-Z0-9_.-]+$/.test(entry.file_name) || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error('Invalid pinned package entry');
  const target = path.join(cache, entry.file_name);
  let bytes;
  try { bytes = await fs.readFile(target); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (bytes) {
    if (hash(bytes) !== entry.sha256) throw new Error('Existing cached package checksum differs: ' + entry.file_name);
    continue;
  }
  if (offline) throw new Error('Offline cache is missing ' + entry.file_name);
  const url = 'https://cdn.jsdelivr.net/pyodide/v0.29.3/full/' + entry.file_name;
  const response = await fetch(url, {credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(120000)});
  if (!response.ok) throw new Error('Official public asset download failed: ' + response.status + ' ' + entry.file_name);
  if (Number(response.headers.get('content-length')) > 64000000) throw new Error('Unexpected package size');
  bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 64000000 || hash(bytes) !== entry.sha256) throw new Error('Official package checksum mismatch: ' + entry.file_name);
  await fs.writeFile(target, bytes, {flag: 'wx'});
  downloaded++;
  console.log('Verified ' + name + ' ' + entry.version);
}
console.log(JSON.stringify({runtime: '0.29.3', packages: names.size, downloaded, offline, cache}));
