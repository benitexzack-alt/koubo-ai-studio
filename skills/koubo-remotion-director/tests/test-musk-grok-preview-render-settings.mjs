#!/usr/bin/env node
import assert from 'node:assert/strict';
import {buildControlledRemotionRenderArgsV2} from '../scripts/remotion-production-command-v2.mjs';
const base = {entryRelative: 'src/entry.tsx', composition: 'MuskGrokBusinessAI20261016-WithSfx',
  output: '/isolated/output.mp4', publicDir: '/isolated/public'};
const settings = {concurrency: 1, timeoutInMilliseconds: 120000, scale: 2 / 3};
const context = {mode: 'preview', command: 'direct-remotion-preview', preflightRoute: 'musk-grok-current-chat-review',
  episodeId: 'musk-grok-business-ai-20261016', jobId: '20261016_musk_grok_business_ai_v9_candidate',
  revisionId: 'musk-grok-business-ai-v9-preview-r1-20261016', inputFormat: 'director-cues-v2-surface-bound',
  width: 1920, height: 1080, fps: 30, durationSeconds: 5035 / 30};
const plain = ['render', base.entryRelative, base.composition, base.output,
  '--codec=h264', '--pixel-format=yuv420p', `--public-dir=${base.publicDir}`];
let passed = 0;
assert.deepEqual(buildControlledRemotionRenderArgsV2(base), plain); passed++;
assert.deepEqual(buildControlledRemotionRenderArgsV2({...base, renderContext: {mode: 'formal'}}), plain); passed++;
const actual = buildControlledRemotionRenderArgsV2({...base, previewRenderSettings: settings, renderContext: context});
assert.deepEqual(actual, [...plain, '--concurrency=1', '--timeout=120000', '--scale=0.6666666666666666']); passed++;
const r2Context = {...context, revisionId: 'musk-grok-business-ai-v9-preview-r2-20261016'};
assert.deepEqual(buildControlledRemotionRenderArgsV2({...base, previewRenderSettings: settings, renderContext: r2Context}), actual); passed++;
assert.equal(context.width * settings.scale, 1280); assert.equal(context.height * settings.scale, 720);
assert.equal(Math.round(context.durationSeconds * context.fps), 5035);
assert.equal(actual.some(arg => /^--(?:frames|fps|duration|props)(?:=|$)/u.test(arg)), false); passed++;
for (const [key, value] of Object.entries({mode: 'formal', command: 'direct-remotion-render',
  preflightRoute: 'v2-first-candidate-input', episodeId: 'another-episode', jobId: 'other-job', revisionId: 'r2',
  inputFormat: 'legacy', width: 1280, height: 720, fps: 24, durationSeconds: 100})) {
  assert.throws(() => buildControlledRemotionRenderArgsV2({...base, previewRenderSettings: settings,
    renderContext: {...context, [key]: value}}), error => error.code === 'RRPV2_PREVIEW_SETTINGS_SCOPE_INVALID', key);
  passed++;
}
for (const invalid of [null, ' --concurrency=1 ', [], {}, {...settings, concurrency: 2},
  {...settings, concurrency: '1'}, {...settings, timeoutInMilliseconds: 30000}, {...settings, scale: 1},
  {...settings, cli: '--props=unbound.json'}, {...settings, scale: NaN}]) {
  assert.throws(() => buildControlledRemotionRenderArgsV2({...base, renderContext: context,
    previewRenderSettings: invalid}), error => error.code === 'RRPV2_PREVIEW_SETTINGS_INVALID'); passed++;
}
assert.throws(() => buildControlledRemotionRenderArgsV2({...base, previewRenderSettings: settings}),
  error => error.code === 'RRPV2_PREVIEW_SETTINGS_SCOPE_INVALID'); passed++;
for (const [key, value] of Object.entries({mode: 'formal', command: 'direct-remotion-render',
  revisionId: 'musk-grok-business-ai-v9-preview-r3-20261016', jobId: 'another-job', episodeId: 'another-episode'})) {
  assert.throws(() => buildControlledRemotionRenderArgsV2({...base, previewRenderSettings: settings,
    renderContext: {...r2Context, [key]: value}}), error => error.code === 'RRPV2_PREVIEW_SETTINGS_SCOPE_INVALID', `R2 ${key}`);
  passed++;
}
console.log(JSON.stringify({ok: true, passed, defaultArgsUnchanged: true, formalSettingsRejected: true,
  previewDimensions: [1280, 720], logicalDimensions: [1920, 1080], fps: 30, durationInFrames: 5035,
  productionRenderInvoked: false}));
