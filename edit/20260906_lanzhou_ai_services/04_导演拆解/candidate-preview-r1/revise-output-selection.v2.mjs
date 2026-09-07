import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const dir = import.meta.dirname;
const repo = path.resolve(dir, '../../../..');
const file = (name) => path.join(dir, name);
const read = (name) => JSON.parse(fs.readFileSync(file(name), 'utf8'));
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const bind = (p) => ({path: path.relative(repo, p).split(path.sep).join('/'), sha256: sha(p)});
const write = (name, value) => fs.writeFileSync(file(name), JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
const data = read('data.v1.json');
const fps = data.canvas.fps;
const component = path.join(repo, 'skills/koubo-shotcraft-library/assets/ShotcraftEffects.tsx');
const matcher = path.join(repo, 'skills/koubo-shotcraft-library/scripts/match-director-effects.mjs');
const validator = path.join(repo, 'skills/koubo-shotcraft-library/scripts/validate-director-selection.mjs');
const componentText = fs.readFileSync(component, 'utf8');
assert(componentText.includes('atFrame + 0.24 * 107 * props.fps / 30'));
const entranceFramesExact = 0.24 * 107 * fps / 30;
const entranceFrames = Math.ceil(entranceFramesExact);
const minimumStableHoldFrames = 30;
const holds = (selection) => selection.beats.filter((b) => b.effectId === 'keyword-reveal').flatMap((b) => {
  const duration = b.frames.endFrameExclusive - b.frames.startFrame;
  return b.componentProps.items.map((item, itemIndex) => {
    const settledAtFrame = Math.ceil(Math.min(duration - 1, item.atFrame + entranceFramesExact));
    return {beatId: b.beatId, itemIndex, text: item.text, atFrame: item.atFrame, durationInFrames: duration,
      settledAtFrame, stableHoldFrames: duration - settledAtFrame,
      sufficientStableHold: duration - settledAtFrame >= minimumStableHoldFrames};
  });
});
const previous = read('output-match-selection.v1.json');
const baseline = holds(previous);
write('keyword-readability-failure.v1.json', {
  status: 'failed-local-stable-hold-check', selection: bind(file('output-match-selection.v1.json')),
  existingStructuralValidation: bind(file('output-match-validation.v1.json')),
  component: bind(component), minimumStableHoldFrames, entranceFramesExact,
  checks: baseline, failures: baseline.filter((x) => !x.sufficientStableHold),
  note: '真实读取已生成参数并按组件公式检查。原结构校验通过不代表文字有足够稳定阅读时间；未进行渲染或人眼阅读验收。',
  formalAllowed: false,
});

const request = read('output-match-request.v1.json');
request.revisionId = '20260907-lanzhou-ai-services-output-match-r2';
request.candidateOutputBinding.supersedes = bind(file('output-match-request.v1.json'));
request.candidateOutputBinding.revisionReason = '父任务已查看官方帧并指定真实源裁切；不修改纸片、字幕或口播时点。';
const placements = {
  'output-c017': {
    rect: {x: 12, y: 170, width: 1056, height: 275},
    sourceSize: {width: 2160, height: 1620}, sourceCrop: {x: 260, y: 445, width: 1640, height: 427},
    outputImageRect: {x: 84, y: 330, width: 1056, height: 275},
    contentScope: '元数据、发文日期与正标题',
  },
  'output-c018': {
    rect: {x: 12, y: 170, width: 1056, height: 150},
    sourceSize: {width: 1620, height: 174}, sourceCrop: {x: 0, y: 0, width: 1620, height: 174},
    outputImageRect: {x: 84, y: 330, width: 1056, height: 113.4},
    contentScope: '完整原文，包括末行扎根用户现场',
  },
};
for (const [id, p] of Object.entries(placements)) {
  const beat = request.beats.find((b) => b.beatId === id);
  assert.deepEqual(beat.region, {x: 72, y: 160, width: 1080, height: 510});
  beat.evidence.rect = p.rect;
  beat.evidence.claimBoundary = '工信厅科函〔2026〕414号的政策背景，不是对本人或公司的资质认定或推荐；与开头另一份包容支持政策分开。父任务已查看源图并指定裁切，本子任务未独立看图，最终画面尚未渲染复核。';
  beat.evidence.presentation = {...p, coordinateSystem: 'sourceCrop为源图像素；outputImageRect为1920x1080全局像素；rect为effect region局部像素',
    background: '#ffffff', preserveEntireSpecifiedCrop: true, preserveAspectRatio: true,
    heightRoundingTolerancePx: 0.1, source: 'parent-task-reported-frame-inspection-and-explicit-crop',
    independentlyViewedByThisWorker: false, renderVerified: false};
}
write('output-match-request.v2.json', request);
const attempts = [];
const run = (id, script, args) => {
  const startedAt = new Date().toISOString();
  const result = spawnSync(process.execPath, [script, ...args], {cwd: repo, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024});
  for (const stream of ['stdout', 'stderr']) fs.writeFileSync(file(`${id}.${stream}.txt`), result[stream] ?? '', {flag: 'wx'});
  attempts.push({id, startedAt, finishedAt: new Date().toISOString(), command: [process.execPath, script, ...args], exitCode: result.status,
    signal: result.signal, error: result.error ? String(result.error) : null,
    stdout: bind(file(`${id}.stdout.txt`)), stderr: bind(file(`${id}.stderr.txt`))});
  if (result.status !== 0) {
    write('output-revision-attempts.v2.json', {status: 'failed-preserved', attempts, formalAllowed: false});
    throw new Error(result.stderr || result.stdout || String(result.error));
  }
  return result;
};
run('output-match-r2', matcher, ['--request', file('output-match-request.v2.json'), '--selection', file('output-match-selection.raw.v2.json'),
  '--receipt', file('output-match-receipt.v2.json'), '--lookup', file('output-experience-lookup.v2.json'), '--repo-root', repo]);
const raw = read('output-match-selection.raw.v2.json');
const receipt = read('output-match-receipt.v2.json');
assert.equal(receipt.summary.analyzedCardCount, 157);
assert.equal(sha(component), request.componentModule.sha256);
const derived = structuredClone(raw);
derived.revisionId = '20260907-lanzhou-ai-services-derived-application-timing-r2';
const timingChanges = [];
const wordMap = new Map(data.words.map((w) => [w.id, w]));
for (const beat of derived.beats.filter((b) => b.effectId === 'keyword-reveal')) {
  const caption = data.captions.find((c) => `output-${c.id}` === beat.beatId);
  const words = caption.wordIds.map((id) => wordMap.get(id));
  const duration = beat.frames.endFrameExclusive - beat.frames.startFrame;
  for (const [itemIndex, item] of beat.componentProps.items.entries()) {
    const spans = [];
    for (let start = 0; start < words.length; start++) {
      let text = '';
      for (let end = start; end < words.length && text.length <= item.text.length; end++) {
        text += words[end].text;
        if (text === item.text) spans.push(words.slice(start, end + 1));
      }
    }
    assert.equal(spans.length, 1, `词元整段锚必须唯一，不按字数插值: ${beat.beatId}/${item.text}`);
    const matched = spans[0];
    const estimatedSpokenStartFrame = Math.round(matched[0].startMs * fps / 1000);
    const estimatedLocalStartFrame = estimatedSpokenStartFrame - beat.frames.startFrame;
    const originalAtFrame = item.atFrame;
    // 入场预滚与阅读余量是显示设计，词元音频估计点独立保存，不移动字幕或伪造词级时间。
    item.atFrame = Math.max(0, Math.min(estimatedLocalStartFrame - entranceFrames, duration - entranceFrames - minimumStableHoldFrames));
    timingChanges.push({beatId: beat.beatId, itemIndex, text: item.text, canonicalCaptionId: caption.id,
      wordIds: matched.map((w) => w.id), sourceStartMs: matched[0].sourceStartMs, sourceEndMs: matched.at(-1).sourceEndMs,
      outputStartMs: matched[0].startMs, outputEndMs: matched.at(-1).endMs,
      timingPrecision: 'asr-token-estimate', timingAccuracyMs: null, subTokenInterpolationUsed: false,
      originalAtFrame, atFrame: item.atFrame, estimatedSpokenStartFrame, estimatedLocalStartFrame,
      visualLeadFrames: estimatedLocalStartFrame - item.atFrame,
      settledAtFrame: Math.ceil(item.atFrame + entranceFramesExact),
      stableHoldFrames: duration - Math.ceil(item.atFrame + entranceFramesExact),
      mode: 'explicit-visual-preroll-not-word-synchronous',
      note: '按真实ASR词元估计点计算入场预滚；必要时为至少30帧稳定阅读进一步提前。提前的是视觉标签，不是音频或字幕，不宣称300ms逐字同步。'});
  }
}
derived.derivation = {status: 'named-agent-derived-selection-not-raw-matcher-output',
  rawSelection: bind(file('output-match-selection.raw.v2.json')), rawMatchReceipt: bind(file('output-match-receipt.v2.json')),
  request: bind(file('output-match-request.v2.json')), canonical: data.inputs.canonical, candidateData: bind(file('data.v1.json')),
  component: bind(component), entranceFramesExact, minimumStableHoldFrames, timingChanges,
  changedFields: ['revisionId', 'beats[keyword-reveal].componentProps.items[].atFrame', 'derivation'],
  paperPositionsChanged: false, subtitleContentChanged: false, sharedMatcherModified: false,
  renderPerformed: false, applicationReceiptCreated: false, formalAllowed: false};
write('output-selection.derived.v2.json', derived);
const finalValidation = run('output-derived-validation-r2', validator, [file('output-selection.derived.v2.json'), repo]);
const finalChecks = holds(derived);
assert(finalChecks.every((x) => x.sufficientStableHold));
for (const b of derived.beats) {
  const original = raw.beats.find((x) => x.beatId === b.beatId);
  const copy = structuredClone(b);
  if (copy.effectId === 'keyword-reveal') copy.componentProps.items = original.componentProps.items;
  assert.deepEqual(copy, original);
  if (b.effectId === 'marker-underline') assert.equal(b.componentProps.before + b.componentProps.keyword + b.componentProps.after, b.quote);
}
write('output-derived-validation.v2.json', {
  status: 'machine-validated-derived-selection-not-rendered', selection: bind(file('output-selection.derived.v2.json')),
  rawMatchReceipt: bind(file('output-match-receipt.v2.json')), request: bind(file('output-match-request.v2.json')),
  canonical: data.inputs.canonical, candidateData: bind(file('data.v1.json')), captions: bind(file('captions.json')),
  validator: bind(validator), component: bind(component), structuralResult: JSON.parse(finalValidation.stdout),
  baselineReadabilityFailures: baseline.filter((x) => !x.sufficientStableHold).length,
  rawR2ReadabilityFailures: holds(raw).filter((x) => !x.sufficientStableHold).length,
  finalReadabilityChecks: finalChecks, allStableHoldsAtLeast30Frames: true,
  derivedChangesLimitedToKeywordTimingAndProvenance: true, markerPropsComplete: true,
  renderPerformed: false, visualReadabilityHumanAccepted: false, formalAllowed: false,
});
write('output-revision-attempts.v2.json', {status: 'actual-attempts-and-local-failure-preserved', attempts,
  baselineFailure: bind(file('keyword-readability-failure.v1.json')), repair: bind(file('output-derived-validation.v2.json')),
  rawMatcherModified: false, formalAllowed: false});
write('final-consumption.v2.json', {
  schemaVersion: 'koubo-candidate-consumption-manifest/v1', status: 'candidate-data-and-derived-selection-ready',
  data: bind(file('data.v1.json')), captions: bind(file('captions.json')),
  selection: bind(file('output-selection.derived.v2.json')), request: bind(file('output-match-request.v2.json')),
  rawMatchReceipt: bind(file('output-match-receipt.v2.json')), derivedValidation: bind(file('output-derived-validation.v2.json')),
  supersedesOnlyShotcraftPathsInImmutableData: true,
  consumption: {
    selectionShape: '原koubo-shotcraft-director-selection/v1；beats数组及componentProps原合同，新增derivation只供审计。',
    frame: 'frame = globalFrame - beat.frames.startFrame；durationInFrames = endFrameExclusive - startFrame；fps=30。',
    marker: '必须传入完整componentProps，包括before、keyword、after，不能只取texts[0]。',
    keyword: '必须传入全部componentProps.items，atFrame已是局部显示帧；不能在消费时再次均分或重新推算。',
    evidence: 'componentProps.rect与evidence.rect已相同；父任务按evidence.presentation.sourceCrop/outputImageRect布置真实源图。',
    captions: '只显示zh/en；reviewRequired、uncertainIds、exceptions等审计字段不得出现在公开视频画面。',
    applicationReceipt: '实际应用回执应绑定本manifest.selection的路径、SHA与revisionId；原matcher receipt仍绑定raw selection，不能改写成衍生选择由matcher原生生成。',
  },
  paperTimingNotes: [
    {paperId: 'P02', sourceStartSeconds: 128.7, outputStartFrame: 4105,
      note: '按本次contextual-summary保留。流程与人工确认纸片跨到试用、出错处理话题，不是该段每个字或动作的精确对应；未把跨beat误称postshoot逐字合格。'},
    {paperId: 'P03', sourceStartSeconds: 143.64, outputStartFrame: 4553,
      note: '此时实录开始培训段，纸片回顾前段试用、纠错和更新，按contextual-summary保留，不移动时点。'},
  ],
  outputFrames: 8393, transcriptUncertainCount: 13, paperPositionsUnchanged: true,
  oldPostshootPassed: false, B23: 'recorded-absence', formalAllowed: false, renderPerformed: false,
});
console.log(JSON.stringify({selection: bind(file('output-selection.derived.v2.json')), summary: receipt.summary,
  stableHoldFrames: finalChecks.map((x) => ({beatId: x.beatId, itemIndex: x.itemIndex, frames: x.stableHoldFrames})),
  structuralValidation: JSON.parse(finalValidation.stdout)}, null, 2));
