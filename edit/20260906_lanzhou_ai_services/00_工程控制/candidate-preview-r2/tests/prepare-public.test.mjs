import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {ROOT, CONTROL, EPISODE, PUBLIC, readJson} from '../runner-core.mjs';
import {buildMappings} from '../prepare-public.v1.mjs';

const r1 = readJson(path.join(ROOT, `edit/${EPISODE}/00_工程控制/candidate-preview-r1/public-assets.v1.json`));
const requirements = readJson(path.join(ROOT, CONTROL, 'audio-audit.public-assets.v1.json'));

test('22 exact assets map to R2 without changing R1 paths or original hashes', () => {
  const snapshot = JSON.stringify(r1);
  const mappings = buildMappings(r1, requirements);
  assert.equal(mappings.length, 22);
  assert.equal(mappings.filter(b => b.sourceGroup === 'r1-preserved').length, 13);
  assert.equal(mappings.filter(b => b.sourceGroup === 'r2-approved-sfx').length, 9);
  assert.ok(mappings.every(b => b.publicPath.startsWith(`${PUBLIC}/`)));
  assert.equal(JSON.stringify(r1), snapshot);
});

test('escaping source, altered target, duplicate asset and generation requests fail', () => {
  for (const change of [p => p.assets[0].sourcePath = '/tmp/not-authorized.wav', p => p.assets[0].targetPath = '/tmp/output.wav',
    p => p.assets[1] = {...p.assets[0]}, p => p.assets[0].newGenerationRequested = true]) {
    const p = structuredClone(requirements); change(p); assert.throws(() => buildMappings(r1, p));
  }
});

test('later cue-plan hash changes do not silently change the linked asset set', () => {
  const p = structuredClone(requirements); p.plan.sha256 = '0'.repeat(64);
  assert.deepEqual(buildMappings(r1, p), buildMappings(r1, requirements));
});
