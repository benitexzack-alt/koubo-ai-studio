import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const dir = import.meta.dirname;
const data = JSON.parse(fs.readFileSync(path.join(dir, 'data.v1.json'), 'utf8'));
assert(Array.isArray(data.captions));
for (const p of data.papers) assert.equal(p.publicPath, `${p.id}.mp4`);
fs.writeFileSync(path.join(dir, 'captions.json'), JSON.stringify(data.captions, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({path: path.join(dir, 'captions.json'), count: data.captions.length, pureArray: true}));
