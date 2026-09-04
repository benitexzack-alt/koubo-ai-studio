import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const commit = '6c116cbd24eeb43c99d396696b509f8d88e58789';
const files = [
  'LICENSE', 'gallery/api/library.json', 'demos/README.md',
  'references/shots/typography/marker-underline-title.md',
  'references/shots/ui-entrance/list-reveal.md',
  'references/shots/effects/scanline-annotate-focus.md',
  'references/shots/transition/line-carry-transition.md',
  'references/shots/ui-entrance/paper-craft-moves.md',
];
const sha = (data) => crypto.createHash('sha256').update(data).digest('hex');
const entries = [];
for (const source of files) {
  const url = `https://raw.githubusercontent.com/Vincentwei1021/video-shotcraft/${commit}/${source}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status}: ${source}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const target = path.join(root, 'upstream', source);
  await fs.mkdir(path.dirname(target), {recursive: true});
  try {
    const existing = await fs.readFile(target);
    if (sha(existing) !== sha(bytes)) throw new Error(`拒绝覆盖不同快照: ${source}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await fs.writeFile(target, bytes, {flag: 'wx'});
  }
  entries.push({path: `upstream/${source}`, sourceUrl: url, sha256: sha(bytes), bytes: bytes.length});
}
const catalog = JSON.parse(await fs.readFile(path.join(root, 'upstream/gallery/api/library.json')));
const lock = {schemaVersion: 'shotcraft-upstream/v1', commit, catalogRevision: catalog.revision,
  stats: catalog.stats, license: 'Apache-2.0', audioImported: false, entries};
await fs.writeFile(path.join(root, 'upstream-lock.v1.json'), `${JSON.stringify(lock, null, 2)}\n`);
console.log(JSON.stringify({commit, stats: catalog.stats, files: entries.length}));
