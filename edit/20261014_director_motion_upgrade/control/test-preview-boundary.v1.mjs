import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {JOB_ID, EPISODE, ROUTE, REVISION, SOURCE, SOURCE_SHA, RUNTIME, PUBLIC, ENTRY, OUTPUT,
  ORIGINAL_CAPTIONS, START, END, FRAMES, sliceMinuteCaptions, assertMinutePreviewBoundary,
  assertMinutePreviewAuthorization} from './export-adapter.v1.mjs';

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const originalCaptions = JSON.parse(readFileSync(resolve(root, ORIGINAL_CAPTIONS), 'utf8'));
const fixture = () => ({command: 'direct-remotion-preview', originalCaptions, sourceSha256: SOURCE_SHA,
  job: {jobId: JOB_ID, videoId: EPISODE, productionEligible: false, publishAuthorized: false,
    inputs: {source: SOURCE, visualPlan: RUNTIME},
    productionGate: {schema: 'director-production-entry-binding/v2', route: ROUTE, revisionId: REVISION,
      state: 'scoped-preview-authorized-v1', formalEnabled: false, userPreviewApproved: false},
    experiment: {userPreviewApproved: false}, finalReview: {fullWatchConfirmed: false},
    preview: {enabled: true, output: OUTPUT}, formal: {enabled: false, rawOutput: null, finalOutput: null},
    remotion: {root: 'remotion', entry: ENTRY, publicDir: PUBLIC,
      compositionWithSfx: 'DirectorMotionUpgrade20261014-WithSfx', compositionWithoutSfx: null,
      durationSeconds: FRAMES / 30, fps: 30, width: 1920, height: 1080}},
  runtime: {sourceStartFrame: START, sourceEndFrame: END, durationInFrames: FRAMES,
    fps: 30, width: 1920, height: 1080, captions: sliceMinuteCaptions(originalCaptions),
    paperClips: [{id: 'P03', from: 514, to: 730, sourceInFrame: 0, sourceFps: 24},
      {id: 'P04', from: 1371, to: 1596, sourceInFrame: 0, sourceFps: 24}]}});
const authorizationFixture = () => ({auth: {schema: 'director-motion-minute-preview-authorization/v1',
  episodeId: EPISODE, jobId: JOB_ID, revisionId: REVISION, phase: 'minute-preview',
  userQuote: '此为测试夹具，不是真实授权。', currentMessageId: null, independentSignature: false,
  previewAuthorized: true, previewAccepted: false, formalEnabled: false, fullWatchConfirmed: false,
  publishAuthorized: false, scope: {sourceStartFrame: START, sourceEndFrame: END,
    originalSpeed: true, providerCallsAllowed: false}},
  events: [{type: 'response_item', payload: {role: 'user', content: [
    {type: 'input_text', text: '此为测试夹具，不是真实授权。'}]}}]});

test('实际历史字幕只切窗平移，合法预览边界通过', () => {
  const value = fixture();
  assert.equal(assertMinutePreviewBoundary(value), true);
  assert.ok(value.runtime.captions.length > 0);
  for (const caption of value.runtime.captions) {
    const original = originalCaptions.find(c => c.id === caption.id);
    assert.equal(caption.chinese, original.chinese);
    assert.equal(caption.english, original.english);
    assert.ok(caption.from >= 0 && caption.to <= FRAMES);
  }
});
test('改变连续窗口不可过', () => {
  const value = fixture(); value.runtime.sourceStartFrame += 1;
  assert.throws(() => assertMinutePreviewBoundary(value), /连续窗口/u);
});
test('改写一个实际字幕字符不可过', () => {
  const value = fixture(); value.runtime.captions[0].chinese += '改';
  assert.throws(() => assertMinutePreviewBoundary(value), /逐字/u);
});
test('更换原片路径或源摘要不可过', () => {
  for (const mutation of [v => {v.job.inputs.source = 'other.mp4';}, v => {v.sourceSha256 = '0'.repeat(64);}]) {
    const value = fixture(); mutation(value);
    assert.throws(() => assertMinutePreviewBoundary(value), /更换历史原片/u);
  }
});
test('所有正式导出及发布入口不可过', () => {
  for (const command of ['formal', 'formal-audio', 'direct-remotion-render', 'release-validation']) {
    const value = fixture(); value.command = command;
    assert.throws(() => assertMinutePreviewBoundary(value), /只允许/u);
  }
});
test('任一人工终验或正式生产开关提前开启不可过', () => {
  for (const mutation of [v => {v.job.productionEligible = true;},
    v => {v.job.formal.enabled = true;}, v => {v.job.productionGate.userPreviewApproved = true;},
    v => {v.job.finalReview.fullWatchConfirmed = true;}, v => {v.job.publishAuthorized = true;}]) {
    const value = fixture(); mutation(value);
    assert.throws(() => assertMinutePreviewBoundary(value), /人工验收/u);
  }
});
test('改变纸艺源窗或目标输出不可过', () => {
  const paper = fixture(); paper.runtime.paperClips[0].sourceInFrame = 1;
  assert.throws(() => assertMinutePreviewBoundary(paper), /纸艺窗口/u);
  const output = fixture(); output.job.preview.output = 'outputs/formal.mp4';
  assert.throws(() => assertMinutePreviewBoundary(output), /固定预览输出/u);
});
test('授权文本一致性函数合法夹具通过，但不产生真实授权文件', () => {
  assert.equal(assertMinutePreviewAuthorization(authorizationFixture()), true);
});
test('错误授权范围、正文、伪造消息标识均不可过', () => {
  for (const mutation of [v => {v.auth.scope.sourceEndFrame += 1;},
    v => {v.auth.scope.providerCallsAllowed = true;}, v => {v.auth.formalEnabled = true;},
    v => {v.auth.userQuote += '改';}, v => {v.auth.currentMessageId = 'invented';}]) {
    const value = authorizationFixture(); mutation(value);
    assert.throws(() => assertMinutePreviewAuthorization(value));
  }
});
