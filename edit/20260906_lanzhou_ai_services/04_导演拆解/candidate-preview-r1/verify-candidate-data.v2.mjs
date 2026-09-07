import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

const dir = import.meta.dirname;
const repo = path.resolve(dir, '../../../..');
const file = (name) => path.join(dir, name);
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const hash = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const streamHash = async (p) => {
  const digest = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(p)) digest.update(chunk);
  return digest.digest('hex');
};
const binding = (p) => ({path: path.relative(repo, p), sha256: hash(p)});
const checkedHashes = new Map();
const bound = async (b) => {
  const p = path.resolve(repo, b.path);
  if (!checkedHashes.has(p)) checkedHashes.set(p, await streamHash(p));
  assert.equal(checkedHashes.get(p), b.sha256, `绑定哈希不匹配: ${b.path}`);
};
const checks = [];
const check = async (name, fn) => {
  try { await fn(); checks.push({name, passed: true}); }
  catch (error) { checks.push({name, passed: false, error: String(error.stack ?? error)}); }
};
const d = read(file('data.v1.json'));
const c = read(d.inputs.canonical.path);
const b = read(d.inputs.bilingual.path);
const review = read(d.inputs.transcriptionReview.path);
const manifest = read(file('final-consumption.v2.json'));
const selection = read(path.resolve(repo, manifest.selection.path));
const request = read(path.resolve(repo, manifest.request.path));
const receipt = read(path.resolve(repo, manifest.rawMatchReceipt.path));
const raw = read(path.resolve(repo, receipt.selection.path));
const shift = (ms) => ms < 2300 ? ms : ms + 244000 / 30;
const near = (a, b) => assert(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
const overlap = (a, b) => a.startFrame < b.endFrameExclusive && a.endFrameExclusive > b.startFrame;

await check('所有数据输入、原片和新闻SHA仍匹配', async () => {
  for (const input of Object.values(d.inputs)) await bound(input);
  for (const segment of d.timeline.segments) await bound({path: segment.sourcePath, sha256: segment.sha256});
});
await check('57页原文英文、分页、词元编号及uncertain不变，纯数组完全相同', () => {
  assert.equal(d.captions.length, 57);
  assert.equal(c.captions.length, 57);
  assert.equal(b.captions.length, 57);
  assert.deepEqual(read(file('captions.json')), d.captions);
  d.captions.forEach((out, i) => {
    const source = c.captions[i], translated = b.captions[i];
    for (const [key, value] of Object.entries(source)) {
      if (!['startMs', 'endMs'].includes(key)) assert.deepEqual(out[key], value);
    }
    assert.equal(out.en, translated.en);
    assert.equal(out.sourceStartMs, source.startMs);
    assert.equal(out.sourceEndMs, source.endMs);
    near(out.startMs, shift(source.startMs));
    near(out.endMs, shift(source.endMs));
    assert.equal(out.outputStartFrame, Math.round(out.startMs * 30 / 1000));
    assert.equal(out.outputEndFrameExclusive, Math.round(out.endMs * 30 / 1000));
  });
  assert.equal(d.captions.at(-1).zh, '可以来找我。');
});
await check('1019词元仅平移，保留源token证据与原零时长，不做比例插值', () => {
  assert.equal(d.words.length, 1019);
  assert.equal(c.words.length, 1019);
  d.words.forEach((word, i) => {
    const source = c.words[i];
    for (const [key, value] of Object.entries(source)) {
      if (!['startMs', 'endMs', 'start', 'end'].includes(key)) assert.deepEqual(word[key], value);
    }
    assert.equal(word.sourceStartMs, source.startMs);
    assert.equal(word.sourceEndMs, source.endMs);
    near(word.startMs, shift(source.startMs));
    near(word.endMs, shift(source.endMs));
  });
  assert.equal(d.words.filter((w) => w.startMs === w.endMs).length, c.words.filter((w) => w.startMs === w.endMs).length);
});
await check('13项疑点原样保留且未听验，B23未说无伪造字幕', () => {
  assert.deepEqual(d.exceptions.transcription.uncertain, review.uncertain);
  assert.equal(review.uncertain.length, 13);
  assert.equal(d.exceptions.transcription.humanListeningPerformed, false);
  assert.equal(d.exceptions.transcription.userAudioReviewConfirmed, false);
  assert.equal(d.exceptions.recordedAbsence.length, 1);
  const absent = d.exceptions.recordedAbsence[0];
  assert.equal(absent.beatId, 'B23');
  assert.equal(absent.status, 'recorded-absence');
  assert.equal(absent.sourceTimeRange, null);
  assert.equal(absent.outputTimeRange, null);
  assert.equal(absent.fabricatedCaptionAdded, false);
  assert.equal(absent.oldPostshootPassedClaimed, false);
});
await check('8149+244=8393且插入三段无缺口重叠，新闻尾pad仅1帧', () => {
  assert.equal(d.timeline.sourceDurationInFrames, 8149);
  assert.equal(d.timeline.durationInFrames, 8393);
  near(d.timeline.durationSeconds, 8393 / 30);
  const [first, news, body] = d.timeline.segments;
  assert.deepEqual(d.timeline.segments.map((s) => [s.outputStartFrame, s.outputEndFrameExclusive]), [[0, 69], [69, 313], [313, 8393]]);
  assert.deepEqual([first.sourceInFrame, first.sourceOutFrameExclusive, body.sourceInFrame, body.sourceOutFrameExclusive], [0, 69, 69, 8149]);
  assert.equal(news.newsOnlyTailPadFrames, 1);
  assert.equal(news.sourceOutFrameExclusive, 243);
  assert.equal(news.sourceAudioDurationSeconds, 8.102993);
  assert.equal(news.hostNarrationPaused, true);
});
await check('五纸片位置、publicPath和原生全片范围固定，无循环或冻帧声明', async () => {
  const expected = [[3351, 3595, 240, 192], [3861, 4105, 283, 226], [4309, 4553, 240, 192], [5211, 5455, 240, 192], [6478, 6722, 283, 226]];
  assert.equal(d.papers.length, 5);
  for (const [i, paper] of d.papers.entries()) {
    assert.equal(paper.id, `P0${i + 1}`);
    assert.equal(paper.publicPath, `${paper.id}.mp4`);
    assert.deepEqual([paper.sourceStartFrame, paper.outputStartFrame, paper.durationInFrames, paper.sourceVideoFrameCount], expected[i]);
    assert.equal(paper.durationInFrames, Math.ceil(paper.sourceDurationSeconds * 30));
    near(paper.sourceDurationSeconds, paper.sourceVideoFrameCount / 24);
    assert.equal(paper.sourceInFrame, 0);
    assert.equal(paper.sourceOutFrameExclusive, paper.sourceVideoFrameCount);
    assert.equal(paper.playbackRate, 1);
    assert.equal(paper.freezeExtensionFrames, 0);
    assert.equal(paper.loop, false);
    assert.equal(paper.trimRequested, false);
    assert.equal(paper.labelPresentationMode, 'contextual-summary');
    assert.equal(paper.wordActionWithin300msSatisfied, false);
    assert.equal(paper.formalEligible, false);
    await bound({path: paper.sourcePath, sha256: paper.sha256});
  }
});
await check('10项纸片缺陷绑定原SHA和观察包络，未伪称精确缺陷起止或已修', async () => {
  assert.equal(d.exceptions.media.length, 10);
  for (const risk of d.exceptions.media) {
    const paper = d.papers.find((p) => p.id === risk.sceneId);
    assert.equal(risk.sha256, paper.sha256);
    await bound(risk.evidence);
    assert.equal(risk.defectFixed, false);
    assert.equal(risk.formalSatisfied, false);
    assert.equal(risk.intervalPrecision, 'sampled-observation-envelope-not-exact-defect-onset-or-offset');
    assert(risk.outputReviewWindow.startFrame >= paper.outputStartFrame);
    assert(risk.outputReviewWindow.endFrameExclusive <= paper.outputEndFrameExclusive);
  }
});
await check('157卡真实匹配、33参与与24保护排除合计覆盖57页', () => {
  assert.equal(receipt.summary.analyzedCardCount, 157);
  assert.equal(receipt.summary.applyCount, 15);
  assert.equal(receipt.summary.notNeededCount, 18);
  assert.equal(selection.beats.length, 33);
  assert.equal(request.beats.length, 33);
  assert.equal(receipt.matches.length, 33);
  const coverage = request.candidateOutputBinding.captionCoverage;
  assert.equal(coverage.length, 57);
  assert.equal(new Set(coverage.map((x) => x.captionId)).size, 57);
  for (const caption of d.captions) {
    const protectedByPaper = d.papers.some((p) => overlap({startFrame: caption.outputStartFrame, endFrameExclusive: caption.outputEndFrameExclusive}, {startFrame: p.outputStartFrame, endFrameExclusive: p.outputEndFrameExclusive}));
    const selected = selection.beats.find((x) => x.beatId === `output-${caption.id}`);
    assert.equal(Boolean(selected), !caption.reviewRequired && !protectedByPaper);
    if (selected) {
      assert.deepEqual(selected.frames, {startFrame: caption.outputStartFrame, endFrameExclusive: caption.outputEndFrameExclusive});
      assert(!overlap(selected.frames, {startFrame: 69, endFrameExclusive: 313}));
    }
  }
});
await check('全套新旧回执与最终manifest的SHA诚实匹配，不改raw为derived', async () => {
  await bound(read(file('data-validation.v1.json')).data);
  for (const key of ['data', 'captions', 'selection', 'request', 'rawMatchReceipt', 'derivedValidation']) await bound(manifest[key]);
  for (const key of ['request', 'captions', 'selection', 'experienceLookup']) await bound(receipt[key]);
  for (const input of Object.values(receipt.inputs)) await bound(input);
  for (const key of ['rawSelection', 'rawMatchReceipt', 'request', 'canonical', 'candidateData', 'component']) await bound(selection.derivation[key]);
  assert.notEqual(receipt.selection.sha256, manifest.selection.sha256);
  assert.equal(raw.revisionId, request.revisionId);
  assert.notEqual(selection.revisionId, raw.revisionId);
});
await check('每个关键词修订都绑定完整连续canonical词元，至少30帧稳定显示', () => {
  const anchors = selection.derivation.timingChanges;
  assert.equal(anchors.length, 11);
  const wordMap = new Map(d.words.map((w) => [w.id, w]));
  for (const anchor of anchors) {
    const beat = selection.beats.find((x) => x.beatId === anchor.beatId);
    const caption = d.captions.find((x) => x.id === anchor.canonicalCaptionId);
    const words = anchor.wordIds.map((id) => wordMap.get(id));
    assert.equal(words.map((w) => w.text).join(''), anchor.text);
    const index = caption.wordIds.indexOf(anchor.wordIds[0]);
    assert.deepEqual(caption.wordIds.slice(index, index + words.length), anchor.wordIds);
    near(anchor.outputStartMs, words[0].startMs);
    near(anchor.sourceStartMs, words[0].sourceStartMs);
    assert.equal(anchor.estimatedSpokenStartFrame, Math.round(words[0].startMs * 30 / 1000));
    assert.equal(beat.componentProps.items[anchor.itemIndex].atFrame, anchor.atFrame);
    assert.equal(anchor.visualLeadFrames, anchor.estimatedLocalStartFrame - anchor.atFrame);
    assert.equal(anchor.stableHoldFrames, beat.frames.endFrameExclusive - beat.frames.startFrame - Math.ceil(anchor.atFrame + 0.24 * 107));
    assert(anchor.stableHoldFrames >= 30);
    assert.equal(anchor.subTokenInterpolationUsed, false);
  }
  for (const beat of selection.beats) {
    const original = raw.beats.find((x) => x.beatId === beat.beatId);
    const copy = structuredClone(beat);
    if (copy.effectId === 'keyword-reveal') copy.componentProps.items = original.componentProps.items;
    assert.deepEqual(copy, original);
    if (beat.effectId === 'marker-underline') assert.equal(beat.componentProps.before + beat.componentProps.keyword + beat.componentProps.after, beat.quote);
  }
});
await check('官方图裁切与父任务指定一致，PNG尺寸及SHA有效，未伪称自己观看', async () => {
  const expectedRects = [{x: 12, y: 170, width: 1056, height: 275}, {x: 12, y: 170, width: 1056, height: 150}];
  for (const [i, id] of ['output-c017', 'output-c018'].entries()) {
    const beat = selection.beats.find((x) => x.beatId === id);
    await bound(beat.evidence.asset);
    assert.deepEqual(beat.region, {x: 72, y: 160, width: 1080, height: 510});
    assert.deepEqual(beat.evidence.rect, expectedRects[i]);
    assert.deepEqual(beat.componentProps.rect, beat.evidence.rect);
    const p = beat.evidence.presentation;
    const png = fs.readFileSync(path.resolve(repo, beat.evidence.asset.path));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.deepEqual({width: png.readUInt32BE(16), height: png.readUInt32BE(20)}, p.sourceSize);
    assert(p.sourceCrop.x + p.sourceCrop.width <= p.sourceSize.width);
    assert(p.sourceCrop.y + p.sourceCrop.height <= p.sourceSize.height);
    assert.equal(p.independentlyViewedByThisWorker, false);
    assert.equal(p.renderVerified, false);
  }
});
await check('现有shared selection校验真实通过，未渲染且formal=false', async () => {
  const validator = await import(pathToFileURL(path.join(repo, 'skills/koubo-shotcraft-library/scripts/validate-director-selection.mjs')).href);
  assert.deepEqual(validator.validateDirectorSelectionFiles(selection, repo), []);
  assert.equal(d.formalAllowed, false);
  assert.equal(d.renderPerformed, false);
  assert.equal(manifest.formalAllowed, false);
  assert.equal(manifest.renderPerformed, false);
  assert.equal(selection.derivation.applicationReceiptCreated, false);
  assert.equal(selection.derivation.sharedMatcherModified, false);
});
const failures = checks.filter((x) => !x.passed);
const result = {schemaVersion: 'koubo-candidate-data-independent-check/v1',
  status: failures.length ? 'blocked-with-preserved-check-failures' : 'machine-data-and-selection-checks-complete-not-rendered',
  checkedAt: new Date().toISOString(), generator: binding(import.meta.filename), manifest: binding(file('final-consumption.v2.json')),
  data: binding(file('data.v1.json')), captions: binding(file('captions.json')), selection: manifest.selection,
  checks, checkCount: checks.length, failureCount: failures.length, uniqueFileHashesChecked: checkedHashes.size,
  humanListeningPerformed: false, renderPerformed: false, formalAllowed: false,
  limits: ['仅本地数据、哈希与组件参数检查，不是有声成片或视觉阅读端到端验收。', '13项实录疑点和10项媒体缺陷仍保留，不在公开视频叠内部待审文字。']};
fs.writeFileSync(file('candidate-independent-check.v2.json'), JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({status: result.status, checkCount: checks.length, failureCount: failures.length, failures}, null, 2));
if (failures.length) process.exitCode = 1;
