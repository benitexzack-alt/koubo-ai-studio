import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const out = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(out, '../../../..');
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const bind = p => ({path: p, sha256: hash(p)});
const planPath = path.join(out, 'sfx-plan.v1.json');
const publicPath = path.join(out, 'audio-audit.public-assets.v1.json');
assert.equal(hash(planPath), 'c0f98c61533711c2d6af7b9f00bb8961f79ba927112523db487dc7d01c80d46f');
assert.equal(hash(publicPath), 'fb67fe2d40a0966b66eb50096559779f398c90bcf134ee2ce752c25f782c9abb');
const plan = read(planPath), requirements = read(publicPath);
const before = structuredClone(plan);
const oldSelectionPath = plan.visualSource.selectionPath;
const nextSelectionPath = path.join(path.dirname(oldSelectionPath), 'output-selection.derived.v2.json');
assert.equal(hash(oldSelectionPath), plan.visualSource.selectionSha256);
const oldSelection = read(oldSelectionPath), nextSelection = read(nextSelectionPath);
const nextBinding = bind(nextSelectionPath);
const changedLabels = [];
assert.equal(nextSelection.beats.length, oldSelection.beats.length);
for (const previous of oldSelection.beats) {
  const next = nextSelection.beats.find(b => b.beatId === previous.beatId);
  assert(next, previous.beatId);
  for (const key of ['decision', 'effectId', 'quote', 'texts', 'frames', 'region']) {
    assert.deepEqual(next[key], previous[key], `${previous.beatId}:${key}`);
  }
  const props = structuredClone(next.componentProps);
  if (['output-c017', 'output-c018'].includes(previous.beatId)) {
    assert.equal(previous.componentProps.label, '');
    assert.equal(props.label, next.texts[0]);
    changedLabels.push({visualId: next.beatId, before: '', after: props.label});
    props.label = '';
  }
  assert.deepEqual(props, previous.componentProps, `${previous.beatId}:props-except-two-labels`);
}
assert.equal(changedLabels.length, 2);
const oldLayoutPath = plan.visualSource.layoutPath;
assert.equal(hash(oldLayoutPath), plan.visualSource.layoutSha256);
const nextLayoutPath = path.resolve(root, nextSelection.derivation.plan.path);
assert.equal(hash(nextLayoutPath), nextSelection.derivation.plan.sha256);
const oldLayout = read(oldLayoutPath), nextLayout = read(nextLayoutPath);
const lineContract = layout => layout.officialDocument.phases.map(p => ({id: p.id, selectionBeatId: p.selectionBeatId,
  frames: p.frames, lines: p.lines.map(l => ({id: l.id, text: l.text, revealFrame: l.revealFrame,
    presentFromFrame: l.presentFromFrame, endFrameExclusive: l.endFrameExclusive, anchor: l.anchor}))}));
assert.deepEqual(lineContract(nextLayout), lineContract(oldLayout), 'official-line-texts-and-anchors-unchanged');
const nextLayoutBinding = bind(nextLayoutPath);
for (const cue of plan.cues) {
  const binding = cue.visualBinding;
  if (binding.sourcePath === oldSelectionPath) {
    binding.sourcePath = nextBinding.path;
    binding.sourceSha256 = nextBinding.sha256;
  }
  if (binding.officialLine) {
    binding.officialLine.sourcePath = nextLayoutBinding.path;
    binding.officialLine.sourceSha256 = nextLayoutBinding.sha256;
  }
}
plan.visualSource.selectionPath = nextBinding.path;
plan.visualSource.selectionSha256 = nextBinding.sha256;
plan.visualSource.layoutPath = nextLayoutBinding.path;
plan.visualSource.layoutSha256 = nextLayoutBinding.sha256;
plan.visualSource.prepareVisualSha256 = hash(plan.visualSource.prepareVisualPath);
plan.bindingUpdatedAt = new Date().toISOString();
const cueContract = p => p.cues.map(({visualBinding, ...cue}) => cue);
assert.deepEqual(cueContract(plan), cueContract(before));
for (const key of ['noCue', 'documentNoCue', 'protectedNoCue', 'publicAssets', 'sourceAudioGains', 'audibilityConfirmedByUser', 'finalMixAcceptance']) {
  assert.deepEqual(plan[key], before[key], key);
}
assert.equal(hash(nextSelectionPath), nextBinding.sha256);
assert.equal(hash(nextLayoutPath), nextLayoutBinding.sha256);
assert.equal(hash(planPath), 'c0f98c61533711c2d6af7b9f00bb8961f79ba927112523db487dc7d01c80d46f');
assert.equal(hash(publicPath), 'fb67fe2d40a0966b66eb50096559779f398c90bcf134ee2ce752c25f782c9abb');
fs.writeFileSync(path.join(out, 'audio-audit.sfx-plan-before-selection-v2.json'), fs.readFileSync(planPath), {flag: 'wx'});
fs.writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`);
requirements.plan = bind(planPath);
fs.writeFileSync(publicPath, `${JSON.stringify(requirements, null, 2)}\n`);
const receipt = {schemaVersion: 'lanzhou-r2-sfx-selection-delta/v1', checkedAt: plan.bindingUpdatedAt,
  status: 'selection-label-delta-bound-not-render-or-audibility-approval',
  previousSelection: bind(oldSelectionPath), nextSelection: nextBinding, nextLayout: nextLayoutBinding,
  changedLabels, cueCount: plan.cues.length, cuePlaybackAndNoCueAndSourceAssetsUnchanged: true,
  consumedFramesRectsWordsAndOfficialLineTimesUnchanged: true,
  noRepeatedAudioMeasurement: true, actualR2RenderTruePeakMeasured: false, audibilityConfirmedByUser: false,
  formal: false, plan: bind(planPath), publicRequirements: bind(publicPath)};
fs.writeFileSync(path.join(out, 'audio-audit.selection-v2-binding.json'), `${JSON.stringify(receipt, null, 2)}\n`, {flag: 'wx'});
console.log(JSON.stringify(receipt, null, 2));
