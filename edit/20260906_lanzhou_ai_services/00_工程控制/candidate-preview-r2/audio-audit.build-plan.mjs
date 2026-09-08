import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const out = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(out, '../../../..');
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const dataPath = path.join(root, 'edit/20260906_lanzhou_ai_services/04_导演拆解/candidate-preview-r1/data.v1.json');
const data = read(dataPath), metricsPath = path.join(out, 'audio-audit.measurements.json'), metrics = read(metricsPath);
const visualPath = path.join(root, 'remotion/src/lanzhou-services-v91-candidate-r1/visual-plan.v1.json');
const visual = read(visualPath);
const selectionPath = path.join(root, 'edit/20260906_lanzhou_ai_services/04_导演拆解/candidate-preview-r2/output-selection.derived.v1.json');
const layoutPath = path.join(root, 'edit/20260906_lanzhou_ai_services/04_导演拆解/candidate-preview-r2/evidence-layout-plan.v1.json');
const selection = read(selectionPath), layout = read(layoutPath);
const visualRows = [...visual.semantic, ...selection.beats.filter(b => b.decision === 'apply').map(b => ({
  id: b.beatId, from: b.frames.startFrame, to: b.frames.endFrameExclusive,
  effectId: b.effectId, props: b.componentProps,
}))];
const prepareVisualPath = path.join(out, 'prepare-visual.v1.mjs');
const manifestPath = path.join(root, 'assets/sfx/koubo-sfx-v8/manifest.json'), manifest = read(manifestPath);
const fps = 30;
const configs = {
  A: ['v3-soft-card-pop-b', 0.36, 0, 12], B: ['v1-keyword-tick', 0.30, 0, 7],
  C: ['v1-section-air', 0.32, 0, 8], D: ['v3-media-whoosh-b', 0.28, 0, 6],
  E: ['v1-card-reveal', 0.30, 0, 12], F: ['v3-list-tick-b', 0.32, 0, 6],
  G: ['v3-number-settle-a', 0.26, 0, 11], H: ['v3-line-connect-a', 0.28, 6, 12],
  I: ['v3-chapter-sweep-a', 0.30, 5, 10],
};
const specs = [
  ['c001', '包容', 'A', '主重音'], ['c001', '支持', 'B', '轻节点'],
  ['c002', '在兰州', 'C', '主重音'], ['c004', '处理得更明白', 'D', '轻节点'],
  ['c007', '企业AI应用', 'I', '主重音'], ['c011', '靠谱', 'F', '轻节点'],
  ['c015', '公司的资料', 'H', '关系推进'], ['c017', '人工智能', 'E', '文件关键行'],
  ['c018', '扎根', 'B', '文件关键行'], ['c020', '外贸', 'G', '关系推进'],
  ['c023', '版本', 'D', '轻节点'], ['c024', '作废', 'E', '关系推进'],
  ['c027', '出处', 'C', '关系推进'], ['c028', '确定', 'B', '轻节点'],
  ['c031', '更新', 'H', '关系推进'], ['c034', '核对', 'F', '轻节点'],
  ['c035', '对外', 'I', '主重音'], ['c037', '真实', 'D', '轻节点'],
  ['c040', '实际查', 'G', '关系推进'], ['c042', '客户咨询', 'A', '主重音'],
  ['c043', '权限', 'C', '关系推进'], ['c044', '待跟进', 'H', '关系推进'],
  ['c045', '决定', 'F', '轻节点'],
  ['c051', '适合', 'E', '关系推进'], ['c052', '改进', 'I', '主重音'],
  ['c057', '找我', 'G', '关系推进'],
];
const normalize = s => s.replace(/[\s，。！？、,.!?]/g, '');
const noCueReasons = {
  c003: '收益说明轻停留，未发生新承重关系变化；保留口播，重点留给下一句处理得更明白。',
  c005: '具体麻烦承接前句，无新增关键节点；不为普通语义卡翻页加声。',
  c006: '个人成本说明，不用音效夸大经历；该段主重音留给企业AI应用。',
  c008: '仍在探索的边界声明，静留原声，不重复章节声。',
  c009: '新工具新鲜感只是设问铺垫，无承重变化；不逐卡出声。',
  c010: '与下一句靠谱同属工具核验问题组，只在后者保留一个轻节点。',
  c012: '对前面核验问题收束，已有靠谱节点，不再叠确认声。',
  c013: '时间约束的自然口播，画面轻停留，不独立加声。',
  c014: '承接工具选择到资料接入，主节点保留在公司的资料。',
  c016: '对资料接入工作的小结，无新承重关系变化，留原声。',
  c019: '文件论据后的方向过渡，前两处文件节点已有音效，不再增加。',
  c021: '资料类型属于同一外贸示例；保留已有外贸节点，不对列表每项加声。',
  c022: '新老员工对照是问题铺垫，重点声留给拿错版本与作废分流。',
  c025: '接入适用性是前述资料分流的承接，靠原声说明，不增加切纸艺声。',
  c033: '纸艺返回后的短残段仅48帧；不追补前面纸艺期间已说出的节点，下一句核对已有声。',
  c036: '信息准确性承接对外主节点，保持静留，不逐字幕强调。',
  c038: '联系渠道属于同一对外信息组，已有真实案例节点；不在纸艺前追加声。',
  c041: '日常场景的引入，主节点留到实际客户咨询任务。',
  c047: '取消原看清情况cue：该词不在此行可见文字；可见摘句原来费劲的那几步变得好做一点的实录词点230.043-233.183秒均在P05内，禁止移点或改字强行配声。',
  c048: '对前述价值判断自然收束，无新的操作关系；不把每个划线效果配成独立音效。',
  c049: '面对面沟通邀请轻停留，保留原声，避免结尾连续音效。',
  c050: '尊重用户业务经验的边界说明，不新增强调声。',
  c053: '纠错开放性承接学习改进，同一语义对象已有主声，不逐项出声。',
  c054: '欢迎指出与前句纠错同属一组，延续原声，不重复确认声。',
  c055: '感谢支持的自然口播，不重复开头支持音效，避免结尾堆声。',
  c056: '咨询需求列表是末尾找我节点的铺垫，只在最终行动词保留一个声。',
};
const visibleTexts = row => {
  const props = row.props ?? {};
  const officialPhase = layout.officialDocument.phases.find(p => p.selectionBeatId === row.id);
  return [row.title, row.detail, ...(row.items ?? []), props.before, props.keyword, props.after, props.label,
    ...(props.items ?? []).map(i => i.text), ...(officialPhase?.lines ?? []).map(l => l.text)].filter(x => typeof x === 'string' && x.length);
};
const assets = Object.entries(configs).map(([key, [id, gain, sourceStartFrame, durationInFrames]]) => {
  const item = manifest.items.find(x => x.id === id), measured = metrics.candidateAssets.find(x => x.id === id);
  assert(item && measured);
  const source = path.join(root, item.output);
  assert.equal(hash(source), item.outputSha256);
  return {key, id, sourcePath: source, sha256: item.outputSha256, bytes: fs.statSync(source).size,
    publicPath: `sfx/${id}.wav`, targetPath: path.join(root, 'remotion/public/lanzhou-services-candidate-r2/sfx', `${id}.wav`),
    license: item.license, licenseReference: path.join(root, item.licenseReference), licenseReferenceSha256: hash(path.join(root, item.licenseReference)),
    manifestPath, manifestSha256: hash(manifestPath), nativeMetrics: measured.native48kStereo,
    gain, sourceStartFrame, durationInFrames, copyOrLinkRequested: true, newGenerationRequested: false};
});
const exclusions = [{id: 'U01-news', from: 69, to: 313}, ...data.papers.map(p => ({id: p.id, from: p.outputStartFrame, to: p.outputStartFrame + p.durationInFrames}))];
const cues = specs.map(([captionId, phrase, key, role], index) => {
  const caption = data.captions.find(c => c.id === captionId), asset = assets.find(a => a.key === key);
  const row = visualRows.find(r => r.sourceCaptionId === captionId || r.id === `output-${captionId}`);
  assert(row, `visual row absent: ${captionId}`);
  const matchedVisibleText = visibleTexts(row).find(t => normalize(t).includes(normalize(phrase)));
  assert(matchedVisibleText, `phrase not visible: ${captionId}:${phrase}`);
  const officialLine = layout.officialDocument.phases.find(p => p.selectionBeatId === row.id)?.lines.find(l => normalize(l.text).includes(normalize(phrase)));
  const words = caption.wordIds.map(id => data.words.find(w => w.id === id));
  let combined = '';
  const ranges = words.map(w => { const start = combined.length; combined += normalize(w.text); return {w, start, end: combined.length}; });
  const start = combined.indexOf(normalize(phrase)), end = start + normalize(phrase).length;
  assert(start >= 0, `${captionId}:${phrase}`);
  const matched = ranges.filter(r => r.end > start && r.start < end).map(r => r.w);
  const anchor = matched.find(w => w.endMs > w.startMs) ?? matched[0];
  const anchorFrame = Math.round(anchor.startMs * fps / 1000);
  if (officialLine) assert.equal(anchorFrame, officialLine.revealFrame, `official line anchor: ${captionId}:${phrase}`);
  const energyLatencySeconds = Math.max(0, asset.nativeMetrics.energy05Seconds - asset.sourceStartFrame / fps);
  const frame = anchorFrame - Math.round(energyLatencySeconds * fps);
  const durationInFrames = asset.durationInFrames;
  assert(frame >= 0 && frame + durationInFrames <= 8393);
  assert(frame >= row.from && frame + durationInFrames <= row.to, `outside visual row: ${captionId}:${phrase}`);
  const timedItem = (row.props?.items ?? []).find(i => normalize(i.text).includes(normalize(phrase)));
  if (timedItem) assert(frame >= row.from + timedItem.atFrame, `before visible item: ${captionId}:${phrase}`);
  assert(exclusions.every(x => frame + durationInFrames <= x.from || frame >= x.to), `protected window: ${captionId}:${phrase}`);
  return {id: `r2-sfx-${String(index + 1).padStart(2, '0')}`, frame, visualId: row.id, durationInFrames, publicPath: asset.publicPath,
    sourceSha256: asset.sha256, gain: asset.gain, sourceStartFrame: asset.sourceStartFrame, fadeOutFrames: 1,
    role, sourceCaptionId: captionId, phrase, visualBinding: {visualId: row.id, from: row.from, to: row.to,
      matchedVisibleText, matchedItemAtFrame: timedItem?.atFrame ?? null,
      sourcePath: row.sourceCaptionId ? visualPath : selectionPath, sourceSha256: hash(row.sourceCaptionId ? visualPath : selectionPath),
      ...(officialLine ? {officialLine: {id: officialLine.id, text: officialLine.text, revealFrame: officialLine.revealFrame,
        sourcePath: layoutPath, sourceSha256: hash(layoutPath), matchingKind: 'actual-spoken-substring-of-displayed-official-line-not-full-line-ASR'}} : {}),
      rule: '绑定既有可见摘句和实录词点；R2生成后只复核对应row与props未漂移，不改图像全文或字幕。'},
    anchor: {wordIds: matched.map(w => w.id), words: matched.map(w => ({id: w.id, text: w.text, startMs: w.startMs, endMs: w.endMs})),
      startMs: anchor.startMs, wordFrame: anchorFrame, timingPrecision: 'recorded-transcript-asr-token-estimate-not-human-audition',
      zeroDurationTokensPresent: matched.some(w => w.startMs === w.endMs), uncertainIds: caption.uncertainIds},
    predictedEnergyOnsetMs: (frame / fps + energyLatencySeconds) * 1000,
    onsetVsAnchorMs: (frame / fps + energyLatencySeconds) * 1000 - anchor.startMs};
}).sort((a, b) => a.frame - b.frame);
const occurrences = assets.map(asset => {
  const same = cues.filter(c => c.sourceSha256 === asset.sha256);
  assert(same.length <= 3);
  for (let i = 1; i < same.length; i++) assert(same[i].frame - same[i - 1].frame >= 25 * fps);
  return {assetId: asset.id, uses: same.length, frames: same.map(c => c.frame)};
});
for (let i = 1; i < cues.length; i++) {
  assert.notEqual(cues[i].sourceSha256, cues[i - 1].sourceSha256);
  assert(cues[i].frame >= cues[i - 1].frame + cues[i - 1].durationInFrames);
}
const noCue = visualRows.filter(row => !cues.some(c => c.visualId === row.id)).map(row => {
  const captionId = row.sourceCaptionId ?? row.id.replace(/^output-/, '');
  assert(noCueReasons[captionId], `missing noCue reason: ${row.id}`);
  return {visualId: row.id, sourceCaptionId: captionId, from: row.from, to: row.to,
    visibleTexts: visibleTexts(row), decision: 'noCue', reason: noCueReasons[captionId]};
}).sort((a, b) => a.from - b.from);
assert.equal(new Set(cues.map(c => c.visualId)).size + noCue.length, visualRows.length);
const plan = {schemaVersion: 'lanzhou-services-r2-sfx-plan/v1', createdAt: new Date().toISOString(),
  status: 'ready-for-parent-visual-binding-not-user-audibility-approved', episodeId: '20260906_lanzhou_ai_services',
  fps, durationInFrames: 8393, publicDir: 'remotion/public/lanzhou-services-candidate-r2',
  recordedData: {path: dataPath, sha256: hash(dataPath)}, sourceAudioGains: {host: 1, news: 0.62, paper: 0.1},
  replaceR1AttachedSfxEntirely: true, ordinaryCaptionSfxAllowed: false, protectedIntervals: exclusions,
  cues, noCue, protectedNoCue: exclusions.map(x => ({...x, decision: 'noCue', reason: '用户明确禁止在新闻或纸艺期间新增SFX；不影响既定原声。'})),
  documentNoCue: layout.officialDocument.phases.flatMap(p => p.lines).filter(l => !cues.some(c => c.visualBinding.officialLine?.id === l.id)).map(l => ({
    lineId: l.id, text: l.text, frame: l.revealFrame, decision: 'noCue',
    reason: '同一文件只保留人工智能一主声和扎根一轻声；本行是同一引文的连续阅读/上下文补全，不再逐行加声，不声称官方补全句逐字说出。'})),
  visualSource: {path: visualPath, sha256: hash(visualPath), prepareVisualPath, prepareVisualSha256: hash(prepareVisualPath),
    selectionPath, selectionSha256: hash(selectionPath), layoutPath, layoutSha256: hash(layoutPath),
    r2GeneratedVisualRevalidationPending: true, scope: '实际绑定父prepare-visual克隆的R1 semantic与R2当前派生selection/官方行布局；合并visual-plan生成后仅核对引用行无漂移。'},
  publicAssets: assets.map(({key, gain, sourceStartFrame, durationInFrames, ...a}) => a),
  validation: {cueCount: cues.length, distinctFiles: assets.length, occurrences, noProtectedWindowOverlap: true,
    noSimultaneousAdditionalSfx: true, noConsecutiveSameSource: true, sameSourceGapAtLeast25s: true, eachSourceMax3: true,
    measuredAssetHashesCurrent: true, openingOnlyRecordedHostWords: true,
    allVisualIdsExistInBoundSource: true, allCueIntervalsWithinBoundVisualRows: true, allPhrasesInVisibleText: true,
    timedEffectItemsAlreadyVisible: true, visualRowCount: visualRows.length, noCueCount: noCue.length, allVisualRowsAccountedFor: true},
  implementation: {sequenceDurationField: 'durationInFrames', audioOffsetField: 'sourceStartFrame', gainField: 'gain',
    fadeOutFrames: 1, loop: false, note: '需消费音频源偏移和时长，不能只保留gain并统一播45帧。新visual-plan须把visualBinding词点/文件行与这些实录锚点绑定；若视觉时点变化需差异复核，不机械迁移。'},
  audibilityConfirmedByUser: false,
  finalMixAcceptance: {status: 'pending-actual-r2-render', measuredTruePeakDbtp: null, truePeakMeasured: false,
    targetMaximumDbtp: -1, overloadConfirmedAbsent: false,
    rule: '最终立体声AAC实测true peak <= -1 dBTP并全解码后才可记技术不过载；仅减新增SFX或改点，不降host/news/paper，不以源峰值预测代替合成测量。'},
  audition: {audibilityConfirmedByUser: false, normalSpeedHumanListeningPerformed: false,
    targets: '先听首句两个词、新闻返回、两处文件关键行；只有新增SFX A/B可静音，host/news/paper保持。'},
  pendingAsrItemsRemain: 13, paperP03AudibilityRemainsP2: true, formalEnabled: false, productionEligible: false,
  noNewMediaGenerated: true, r2ContextNotStarted: true};
const planPath = path.join(out, 'sfx-plan.v1.json');
const requirementsPath = path.join(out, 'audio-audit.public-assets.v1.json');
// Only replace this worker's exact earlier drafts; concurrent edits must stop the write.
assert.equal(hash(planPath), '342a4d03dcbd8a0be4770a540a505ea94cbe5a39a9dbc32c0be1032b3c8d94f4');
assert.equal(hash(requirementsPath), '903686ddb681a8329c0af00ef67d464dfde52160e277a73350958ea2246282a3');
fs.writeFileSync(path.join(out, 'audio-audit.sfx-plan-before-visual-binding.json'), fs.readFileSync(planPath), {flag: 'wx'});
fs.writeFileSync(planPath, JSON.stringify(plan, null, 2) + '\n');
fs.writeFileSync(requirementsPath, JSON.stringify({schemaVersion: 'lanzhou-r2-sfx-public-requirements/v1',
  plan: {path: planPath, sha256: hash(planPath)}, publicDir: plan.publicDir, assets: plan.publicAssets,
  sourceMediaFromR1Unchanged: true, sourceGains: plan.sourceAudioGains, permissionExpansionRequiredForLinks: '由父任务冻结后Linnaeus执行，本worker不创建public链接。',
  formalEnabled: false}, null, 2) + '\n');
console.log(JSON.stringify({planPath, sha256: hash(planPath), requirementsPath, requirementsSha256: hash(requirementsPath),
  validation: plan.validation, cues: cues.map(c => ({id: c.id, visualId: c.visualId, phrase: c.phrase, frame: c.frame, gain: c.gain, durationInFrames: c.durationInFrames, sourceStartFrame: c.sourceStartFrame, publicPath: c.publicPath}))}, null, 2));
