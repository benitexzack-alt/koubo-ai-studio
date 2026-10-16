#!/usr/bin/env node
// 隔离的合成输入测试：媒体只在临时目录产生，不安装密钥、不签署、不渲染作品。
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildFirstCandidateInputContract, validateFirstCandidateInputContract} from '../scripts/first-candidate-input-contract.mjs';
import {NATIVE_V2_INPUT_FORMAT, nativeV2FullDecodeTimeoutMs} from '../scripts/native-v2-first-candidate-input.mjs';
import {PAPER_BASELINE_ID, PAPER_TEXT_POLICY} from '../scripts/paper-quality-baseline.mjs';
import {paperMediaTools, runPaperMediaTool} from '../scripts/paper-asset-intake-media.mjs';
import {validateDirectorExternalMessageAnchorV2} from '../scripts/director-contract-v2-core.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const root = realpathSync(mkdtempSync(resolve(tmpdir(), 'synthetic-native-v2-')));
const sha = value => createHash('sha256').update(value).digest('hex');
const ref = path => ({path, sha256: sha(readFileSync(resolve(root, path)))});
const put = (path, value) => {
  mkdirSync(dirname(resolve(root, path)), {recursive: true});
  writeFileSync(resolve(root, path), typeof value === 'string' || Buffer.isBuffer(value) ? value : `${JSON.stringify(value, null, 2)}\n`);
  return ref(path);
};
const read = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const tool = paperMediaTools();
const run = args => runPaperMediaTool(tool.ffmpeg, args).stdout;
const identity = {episodeId: 'synthetic-episode', taskId: 'synthetic-task', revisionId: 'synthetic-r1'};
let job, contract;
const check = (command = 'preview') => validateFirstCandidateInputContract({projectRoot: root, contract, job, command});
const change = (key, mutate) => {
  const body = read(contract.artifacts[key].path);
  mutate(body);
  job.director.artifacts[key] = contract.artifacts[key] = put(contract.artifacts[key].path, body);
};
let passed = 0;
try {
  for (const [durationSeconds, expected] of [[8, 120000], [60, 120000], [60.0005, 120001], [5035 / 30, 335667], [300, 600000], [600, 600000]]) {
    assert.equal(nativeV2FullDecodeTimeoutMs(durationSeconds), expected); passed++;
  }
  mkdirSync(resolve(root, 'public'), {recursive: true});
  run(['-nostdin', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=beige:s=320x180:r=30:d=2',
    '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=2', '-ac', '2',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', resolve(root, 'public/source.mp4')]);
  run(['-nostdin', '-v', 'error', '-i', resolve(root, 'public/source.mp4'), '-vn', '-c:a', 'copy', resolve(root, 'public/voice.m4a')]);
  run(['-nostdin', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=beige:s=1920x1080', '-frames:v', '1', resolve(root, 'reference.png')]);
  put('public/synthetic-font.bin', '合成测试只校验字体文件绑定，不声称字形验收。');
  const sentence = '这个机制把输入压成结果。';
  const script = put('script.txt', sentence);
  const cues = JSON.parse(readFileSync(resolve(repo, 'skills/koubo-remotion-director/templates/director-cues.v2.json'), 'utf8'));
  cues.taskId = identity.taskId;
  cues.inputScript = {...script, authority: 'user-confirmed-script'};
  cues.selectionSummary.mainPoint = sentence;
  cues.selectionSummary.argumentFlow = ['输入转为结果'];
  cues.selectionSummary.routeCounts.speaker = 0;
  cues.selectionSummary.routeCounts['paper-editorial'] = 1;
  cues.selectionSummary.protectedSpeakerBeatIds = [];
  cues.semanticBeats = [{id: 'B01', order: 1, scriptQuote: sentence, rhetoricalRole: 'mechanism',
    claimClass: 'abstract-explanation', requiresFactCheck: false, factCheckId: null,
    primaryRoute: 'paper-editorial', routeCueId: 'P01', decisionReason: '纸带压缩呈现机制。', viewerGain: 'explain-mechanism'}];
  const prefix = '摄影级微缩纸艺定格，暖米色实体桌面，纤维卡纸与瓦楞纸形成三层空间，真实接触阴影，横版构图。';
  cues.styleLocks.paperEditorial = {referenceImages: [{id: 'REF01', ...ref('reference.png'), usage: 'style-mechanism-only'}],
    promptPrefix: prefix, textPolicy: PAPER_TEXT_POLICY, qualityBaselineId: PAPER_BASELINE_ID,
    mustKeep: ['真实纸纤维', '三层空间', '接触阴影'], mustAvoid: ['塑料质感', '漂浮文字', '装饰卡片']};
  cues.routePlans.paperEditorials = {status: 'planned', notRequiredReason: null, items: [{
    id: 'P01', beatId: 'B01', startAnchorText: '这个机制', endAnchorText: '压成结果', timingStatus: 'pre-shoot-text-anchor-only',
    purpose: 'illustration-only', evidenceEligible: false, durationSeconds: 2, reason: '让压缩机制可见。',
    visualRole: 'mechanism', visualMetaphor: '长纸带经过窄门成为短纸束', composition: '侧视单向压缩工作台', primaryAction: '长纸带穿过窄门',
    textPlan: [{text: '输入', surface: '长纸带表面', motion: 'with-object'}], referenceImageIds: ['REF01'],
    motionPlan: {goal: '看懂压缩', result: '长纸带成为短纸束', actions: ['长纸带穿过窄门'], textBinding: 'surface-bound', audioPolicy: 'preserve-usable-native-action-sound'},
    firstFramePrompt: `${prefix}侧视中景，前景是一条平放的长纸带，中景是瓦楞层清晰的窄门，后景是空托盘。长纸带表面直接准确生成中文“输入”，纸带尚未进入窄门，所有物件静止，字贴合纸面，不用悬浮文字。`,
    videoPrompt: '基于已确认首帧，长纸带穿过窄门，成为整齐短纸束。纸面上的中文输入与纸带同时运动，固定机位，结束后停留结果，保留纸张摩擦声音，不新增文字或其他物件。',
    negativePrompt: ['不重做场景', '不改变中文', '不漂浮文字'],
  }]};
  cues.rhythmAudit.runs = [];
  put('workflow/style.json', {id: 'synthetic-style'});
  put('workflow/active-director-profile.v1.json', {style: {path: 'workflow/style.json'}, paperQualityBaseline: {id: PAPER_BASELINE_ID}});
  const raw = put('raw.json', {segments: [{id: 0, start: 0, end: 1, text: sentence}]});
  const spoken = {canonicalSource: 'recorded-audio', scriptRole: 'comparison-only', rawSource: raw.path, rawSha256: raw.sha256,
    segments: [{id: 0, start: 0, end: 1, text: sentence, raw_text: sentence}]};
  const runtime = {fps: 30, durationInFrames: 60, width: 320, height: 180, assetPrefix: '',
    host: {src: 'source.mp4', trimBeforeFrame: 0, trimAfterFrame: 60},
    voice: {src: 'voice.m4a', trimBeforeFrame: 0, trimAfterFrame: 60, gain: 1, playbackRate: 1},
    fonts: {displaySrc: 'synthetic-font.bin', captionSrc: 'synthetic-font.bin'},
    captions: [{chinese: sentence, english: '', from: 0, to: 30}], review: {captions: 'pending'}, sfx: [],
    mediaSlots: [{id: 'P01', kind: 'paper', state: 'ready', reviewStatus: 'pending', sourceLabel: 'AI纸艺示意',
      window: {from: 0, to: 30}, asset: {type: 'video', src: 'source.mp4', sourceFps: 30, sourceInFrame: 0,
        nativeAudio: {src: 'voice.m4a'}}}]};
  const pcm = run(['-nostdin', '-v', 'error', '-i', resolve(root, 'public/source.mp4'), '-map', '0:a:0',
    '-c:a', 'pcm_s16le', '-f', 'hash', '-hash', 'sha256', '-']).trim();
  const preservation = put('preservation.json', {source: resolve(root, 'public/source.mp4'), preparedAudio: resolve(root, 'public/voice.m4a'),
    sourceDecodedPcmHash: pcm, preparedDecodedPcmHash: pcm, equal: true, originalStartSeconds: 0,
    preparedStartSeconds: 0, noTrimming: true, noSpeedChange: true});
  const assets = [['source.mp4', 'video'], ['voice.m4a', 'audio'], ['synthetic-font.bin', 'font']].map(([name, type]) => {
    const renderAsset = ref(`public/${name}`);
    const sourceReceipt = put(`${name}.origin.json`, {kind: 'synthetic-test-input', source: renderAsset});
    let decodeReceipt = null, durationSeconds = null, fps = null;
    if (type !== 'font') {
      const command = [tool.ffmpeg.path, '-nostdin', '-v', 'error', '-xerror', '-i', resolve(root, renderAsset.path), '-f', 'null', '-'];
      run(command.slice(1));
      decodeReceipt = put(`${name}.decode.json`, {source: renderAsset, command, exitCode: 0, fullDecode: true, tool: tool.ffmpeg});
      const probe = JSON.parse(runPaperMediaTool(tool.ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', resolve(root, renderAsset.path)]).stdout);
      const stream = probe.streams.find(item => item.codec_type === type);
      durationSeconds = Number(stream.duration ?? probe.format.duration); fps = type === 'video' ? 30 : null;
    }
    return {id: name, kind: 'synthetic', source: renderAsset, renderAsset, sourceReceipt, media: {type, durationSeconds, fps}, decodeReceipt};
  });
  const quote = '合成测试允许原话及现有带字纸艺进入内部小样，未进行人工验收。';
  const scope = {schemaVersion: 'episode-native-v2-review-authorization/v1', ...identity,
    scope: {reviewOnly: true, preserveAllOriginalSpeech: true, useExistingPaperVideos: true,
      allowPendingReviewInCandidate: true, formalAuthorized: false, publishAuthorized: false},
    quotedUserMessage: quote, sourceMessage: put('message.txt', quote), recordedAt: '2026-10-16T12:00:00+08:00'};
  const artifacts = {
    directorCues: put('cues.json', cues), runtimePlan: put('runtime.json', runtime), spokenTimeline: put('spoken.json', spoken),
    postshootRebind: put('rebind.json', {canonicalSource: 'recorded-audio', durationInFrames: 60, fps: 30,
      semanticBeats: [{sourceSpeechPreserved: true, scriptRole: 'comparison-only', sourceSegmentIds: [0], rawSpokenText: sentence}]}),
    mediaIntake: put('intake.json', {schemaVersion: 'episode-native-v2-media-intake/v1', ...identity,
      source: ref('public/source.mp4'), renderProxy: ref('public/source.mp4'), sourcePreservationReceipt: preservation, assets}),
    factReview: put('facts.json', {...identity, decisionItems: [{id: 'D01', issue: '合成疑点，仍待核验。', status: 'pending'}]}),
    userScope: put('scope.json', scope),
  };
  const imageRef = ref('reference.png');
  assets.push({id: 'synthetic-image', kind: 'context', source: imageRef, renderAsset: imageRef,
    sourceReceipt: put('image.origin.json', {kind: 'synthetic-test-input', source: imageRef}),
    media: {type: 'image', fps: null, durationSeconds: null}, decodeReceipt: null});
  artifacts.mediaIntake = put('intake.json', {...read('intake.json'), assets});
  job = {videoId: identity.episodeId, jobId: 'synthetic-job', productionEligible: false, formal: {enabled: false},
    experiment: {status: 'candidate-preview-required', userPreviewApproved: false},
    productionGate: {state: 'first-candidate-preview-required', revisionId: identity.revisionId,
      productionEligible: false, userPreviewApproved: false, formalEnabled: false},
    director: {taskId: identity.taskId, inputFormat: NATIVE_V2_INPUT_FORMAT, artifacts},
    inputs: {source: 'public/source.mp4', renderProxy: 'public/source.mp4'},
    remotion: {fps: 30, width: 320, height: 180, durationSeconds: 2, publicDir: 'public'}};
  const built = buildFirstCandidateInputContract({projectRoot: root, job, executionGroupId: 'synthetic-group', authorizedUserId: 'synthetic-user'});
  contract = built.contract;
  assert.equal(built.validation.ok, true);
  assert.equal(built.validation.humanAcceptancePerformed, false);
  assert.equal(built.validation.productionEligible, false);
  assert.deepEqual(built.validation.unresolvedFactIds, ['D01']);
  passed++;
  const baseJob = structuredClone(job), baseContract = structuredClone(contract);
  const baseFiles = new Map([...Object.values(artifacts), preservation, ...assets.map(item => item.decodeReceipt).filter(Boolean)]
    .map(item => [item.path, readFileSync(resolve(root, item.path))]));
  const reset = () => {
    for (const [path, bytes] of baseFiles) writeFileSync(resolve(root, path), bytes);
    job = structuredClone(baseJob); contract = structuredClone(baseContract);
  };
  const test = (name, mutation, code) => {
    reset();
    mutation();
    assert.throws(() => check(), error => error.code === code, name);
    passed++; console.log(`通过：${name}`);
  };
  test('字幕不得改成稿件原话', () => change('runtimePlan', value => {value.captions[0].chinese = '不是原话';}), 'NV2_CAPTIONS_NOT_SPOKEN_SOURCE');
  const corrected = sentence.replace('压成', '压缩成');
  const amendText = () => {
    change('spokenTimeline', value => {value.segments[0].text = corrected;});
    change('runtimePlan', value => {value.captions[0].chinese = corrected;});
  };
  test('字幕与候选正文一起改写也须校字来源', amendText, 'NV2_SPOKEN_CORRECTION_RECEIPT_REQUIRED');
  reset(); amendText();
  const correction = put('correction.json', {noFactCorrectionsApplied: true, noSpokenWordsTrimmed: true, corrections: [{
    segmentId: 0, raw_text: '压成', text: '压缩成', start: 0.4, end: 0.7, basis: '合成识别候选，仅验证待听校字的绑定。',
    status: 'asr-correction-candidate', humanListeningPerformed: false, userConfirmed: false}]});
  change('mediaIntake', value => {value.spokenCorrectionReceipt = correction;});
  assert.equal(check().humanAcceptancePerformed, false); passed++;
  test('ASR原时间不得随工程缩改', () => {
    change('spokenTimeline', value => {value.segments[0].end = 0.9;});
    change('runtimePlan', value => {value.captions[0].to = 27;});
  }, 'NV2_RAW_SPEECH_COVERAGE_MISMATCH');
  test('不能以自报总长截断原声或尾部静音', () => {
    job.remotion.durationSeconds = 1;
    change('runtimePlan', value => {value.durationInFrames = 30; value.host.trimAfterFrame = 30; value.voice.trimAfterFrame = 30;});
    change('postshootRebind', value => {value.durationInFrames = 30;});
  }, 'NV2_SOURCE_DURATION_NOT_FULL');
  test('待听英文不能冒充已验收', () => change('runtimePlan', value => {value.review.captions = 'accepted';}), 'NV2_CAPTIONS_NOT_SPOKEN_SOURCE');
  test('原声不得变速', () => change('runtimePlan', value => {value.voice.playbackRate = 1.1;}), 'NV2_FULL_SOURCE_RETENTION_REQUIRED');
  test('未知原速视频窗不得越出真实时长', () => change('runtimePlan', value => {value.mediaSlots[0].asset.sourceInFrame = 50;}), 'NV2_PAPER_OR_MEDIA_WINDOW_EXCEEDS_SOURCE');
  test('路径前缀不得越界', () => change('runtimePlan', value => {value.assetPrefix = '../';}), 'NV2_ASSET_PREFIX_INVALID');
  test('原始ASR全文不能遗漏', () => change('postshootRebind', value => {value.semanticBeats[0].sourceSegmentIds = [];}), 'NV2_REBIND_SPEECH_COVERAGE_MISMATCH');
  test('纸艺必须真实到件', () => change('runtimePlan', value => {value.mediaSlots[0].state = 'pending';}), 'NV2_EXISTING_PAPER_REQUIRED');
  test('小样授权不能升级公开发布', () => change('userScope', value => {value.scope.publishAuthorized = true;}), 'NV2_REVIEW_SCOPE_REQUIRED');
  test('输入哈希漂移必须拒绝', () => {contract.artifacts.runtimePlan.sha256 = '0'.repeat(64);}, 'FCI_INPUT_SHA_MISMATCH');
  test('分支不能默认为旧格式', () => {delete job.director.inputFormat;}, 'NV2_FORMAT_BINDING_MISMATCH');
  test('不能填成已观看', () => {contract.fullWatchConfirmed = true;}, 'FCI_STATE_INVALID');
  test('原声保全回执不能只填通过', () => {
    const value = read('preservation.json'); value.sourceDecodedPcmHash = `SHA256=${'0'.repeat(64)}`;
    const binding = put('preservation.json', value); change('mediaIntake', value => {value.sourcePreservationReceipt = binding;});
  }, 'NV2_ORIGINAL_AUDIO_NOT_PRESERVED');
  job = structuredClone(baseJob); contract = structuredClone(baseContract);
  assert.throws(() => check('direct-remotion-formal'), error => error.code === 'FCI_COMMAND_FORBIDDEN'); passed++;
  const unsigned = validateDirectorExternalMessageAnchorV2({sourceThreadId: root, sourceMessageId: root,
    sourceMessageSha256: sha(root), issuerGroupId: 'unsigned-current-execution', explicitAcceptanceQuote: '只允许小样'},
    'director-first-candidate-input-authorization');
  assert.equal(unsigned.ok, false); passed++;
  console.log(JSON.stringify({ok: true, passed, scope: '隔离原生输入、真实解码与拒绝边界；未签署、未生产渲染、未人工验收'}));
} finally { rmSync(root, {recursive: true, force: true}); }
