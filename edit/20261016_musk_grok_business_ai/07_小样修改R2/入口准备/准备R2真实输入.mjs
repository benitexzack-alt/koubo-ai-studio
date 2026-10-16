// 仅在主线程冻结 R2 runtime、媒体映射和 Remotion 快照后执行；不渲染、不刷新知识上下文。
import {existsSync, readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {paperMediaTools, runPaperMediaTool} from '../../../../skills/koubo-remotion-director/scripts/paper-asset-intake-media.mjs';
import {MUSK_GROK_CHAT_R2_SOURCE} from '../../../../skills/koubo-remotion-director/scripts/musk-grok-chat-preview-authorization.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../../../..');
const episode = path.resolve(directory, '../..');
const r1 = path.join(episode, '05_后期工程/本期候选输入');
const r2 = path.dirname(directory);
const revisionId = 'musk-grok-business-ai-v9-preview-r2-20261016';
const executionGroupId = 'codex-musk-grok-v9-preview-r2-20261016';
const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
const sha = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const inside = (value) => {
  const file = path.resolve(root, value), relative = path.relative(root, file);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('本期输入路径越界');
  return file;
};
const ref = (file) => ({path: path.relative(root, file).split(path.sep).join('/'), sha256: sha(file)});
const checkRef = (reference) => {
  const file = inside(reference.path);
  if (sha(file) !== reference.sha256) throw new Error(`输入哈希不符：${reference.path}`);
  return file;
};
const write = (name, value) => {
  const file = path.join(directory, name); mkdirSync(path.dirname(file), {recursive: true});
  writeFileSync(file, JSON.stringify(value, null, 2) + '\n', {flag: 'wx'}); return file;
};
const options = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  if (!['--runtime-sha', '--media-map', '--knowledge-task-id'].includes(process.argv[i]) || !process.argv[i + 1]) {
    throw new Error('参数：--runtime-sha <冻结SHA> --media-map <主线程真实映射JSON> --knowledge-task-id <R2知识任务ID>');
  }
  if (options.has(process.argv[i])) throw new Error('参数不可重复');
  options.set(process.argv[i], process.argv[i + 1]);
}
if (options.size !== 3 || !/^[a-f0-9]{64}$/u.test(options.get('--runtime-sha')) ||
    !/^task-[A-Za-z0-9_-]+$/u.test(options.get('--knowledge-task-id'))) throw new Error('缺少冻结输入或真实任务ID');
if (existsSync(path.join(directory, 'production-job.first-candidate.v1.json'))) throw new Error('R2已有job，停止覆盖');
const runtimeFile = path.join(r2, 'runtime-plan.r2.json');
if (sha(runtimeFile) !== options.get('--runtime-sha')) throw new Error('R2运行计划未匹配主线程冻结SHA');
const runtime = read(runtimeFile), oldRuntime = read(path.join(episode, '04_后期准备/runtime-plan.v1.json'));
if (runtime.durationInFrames !== 5035 || runtime.fps !== 30 || runtime.width !== 1920 || runtime.height !== 1080 ||
    JSON.stringify(runtime.captions) !== JSON.stringify(oldRuntime.captions) ||
    JSON.stringify(runtime.voice) !== JSON.stringify(oldRuntime.voice) || JSON.stringify(runtime.host) !== JSON.stringify(oldRuntime.host)) {
  throw new Error('R2须保留完整原声、字幕、host和逻辑规格');
}
const sourceFile = checkRef(MUSK_GROK_CHAT_R2_SOURCE), source = read(sourceFile);
const mediaMapFile = inside(options.get('--media-map')), mediaMap = read(mediaMapFile);
if (!Array.isArray(mediaMap.clips) || !mediaMap.clips.length) throw new Error('本期汽车真实映射clips缺失');
const preparedMediaFile = path.join(directory, 'R2新增媒体入库已核.v1.json');
const preparedMedia = read(preparedMediaFile);
if (checkRef(preparedMedia.sourceMapping) !== mediaMapFile || !Array.isArray(preparedMedia.assets)) {
  throw new Error('新媒体实测回执未绑定当前汽车映射');
}
const suppliedAssets = preparedMedia.assets;
const sfxIndexFile = path.join(directory, '既有声效素材索引.v1.json');
const sfxIndex = read(sfxIndexFile);
if (!Array.isArray(sfxIndex.items) || !sfxIndex.items.length) throw new Error('既有声效来源索引缺失');
for (const item of sfxIndex.items) {
  for (const key of ['source', 'renderAsset', 'decodeReceipt', 'packManifest', 'licenseManifest']) checkRef(item[key]);
}
const snapshotFile = path.join(r2, 'Remotion内数据快照.r2.json'), snapshot = read(snapshotFile);
let matchedRuntime = false;
for (const item of snapshot.snapshots ?? [{source: snapshot.runtimeCanonical, snapshot: snapshot.snapshot}]) {
  const original = checkRef(item.source), copied = checkRef(item.snapshot);
  if (!readFileSync(original).equals(readFileSync(copied))) throw new Error('Remotion快照非同源字节');
  if (original === runtimeFile) matchedRuntime = true;
}
if (!matchedRuntime) throw new Error('快照回执未绑定R2运行计划');
const guardPaths = ['production-job.first-candidate.v1.json', 'first-candidate-input.v1.json', '内部预览聊天授权.v1.json',
  '本轮内部预览用户原话.v1.json', '内部审阅候选_有音效.mp4'].map(name => path.join(r1, name));
const r1Before = guardPaths.map(file => ref(file));
const job = read(path.join(r1, 'production-job.first-candidate.v1.json'));
const output = path.join(r2, '预览与质检/内部审阅候选_R2_有音效.mp4');
if (existsSync(output)) throw new Error('R2输出槽已有文件，禁止覆盖');
const now = new Date().toISOString();
const scopeFile = path.join(directory, '用户小样范围.v1.json'), scope = read(scopeFile);
if (scope.revisionId !== revisionId || checkRef(scope.sourceMessage) !== sourceFile ||
    scope.quotedUserMessage !== source.verbatimUserMessage ||
    scope.localRevisionScope?.v10Upgrade !== false || scope.localRevisionScope?.sharedStyleUpgrade !== false ||
    !Array.isArray(scope.supplementalUserMessages) || scope.supplementalUserMessages.length !== 1 ||
    checkRef(preparedMedia.userScope) !== scopeFile) throw new Error('R2真实原话与补充范围绑定不符');
for (const item of scope.supplementalUserMessages) {
  const record = read(checkRef(item.sourceMessage));
  if (record.source !== 'current-human-chat-message' || record.verbatimUserMessage !== item.quotedUserMessage) {
    throw new Error('V9动效反馈未绑定真实原话');
  }
}
const provenance = read(path.join(r1, '来源到件现状.v1.json'));
Object.assign(provenance, {revisionId, capturedAt: now, runtimePlan: ref(runtimeFile), userScope: ref(scopeFile),
  remotionDataSnapshot: ref(snapshotFile), snapshotByteEqualityIndependentlyChecked: true,
  currentUserAttachment: ref(sourceFile), newMediaMapping: ref(mediaMapFile),
  preparedNewMedia: ref(preparedMediaFile), existingSfxByPath: ref(sfxIndexFile),
  supplementalFeedback: scope.supplementalUserMessages.map(item => item.sourceMessage)});
const provenanceFile = write('来源到件现状.v1.json', provenance);
const intake = read(path.join(r1, '原生素材入库候选.v1.json'));
Object.assign(intake, {revisionId, createdAt: now, runtimePlan: ref(runtimeFile)});
// 旧来源仅继承已经保存的历史文本快照；当前来源包装绑定 R2，避免把已改变的渲染快照当 R1。
for (const asset of intake.assets) asset.sourceReceipt = ref(provenanceFile);
const mj = intake.assets.find(asset => asset.id === 'R04-MJ');
if (!mj) throw new Error('R1媒体缺少R04-MJ');
Object.assign(mj, {source: ref(inside(source.attachment.savedPath)), renderAsset: ref(inside(source.attachment.publicPath)),
  sourceReceipt: ref(sourceFile), media: {type: 'image', fps: null, durationSeconds: null}, decodeReceipt: null,
  provenanceNote: '本轮用户指定附件，不声称为本轮官网抓取或已取得公开使用权', reviewAccepted: false});
if (mj.source.sha256 !== source.attachment.sha256 || mj.renderAsset.sha256 !== source.attachment.sha256) {
  throw new Error('MJ真实来件与渲染副本不一致');
}
const tools = paperMediaTools();
for (const supplied of suppliedAssets) {
  const asset = structuredClone(supplied);
  if (typeof asset.id !== 'string' || !/^[A-Za-z0-9_-]+$/u.test(asset.id) || !['video', 'audio', 'image'].includes(asset.media?.type)) {
    throw new Error('新媒体必须有固定id及media.type');
  }
  checkRef(asset.source); const renderFile = checkRef(asset.renderAsset); checkRef(asset.sourceReceipt);
  if (['video', 'audio'].includes(asset.media.type)) {
    const probe = JSON.parse(runPaperMediaTool(tools.ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', renderFile]).stdout);
    const stream = probe.streams.find(item => item.codec_type === asset.media.type);
    if (!stream) throw new Error(`新素材缺少真实轨道：${asset.id}`);
    const durationSeconds = Number(stream.duration ?? probe.format.duration);
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) throw new Error('实际媒体时长无效');
    let fps = null;
    if (asset.media.type === 'video') {
      const [a, b] = stream.avg_frame_rate.split('/').map(Number); fps = a / b;
      if (!Number.isFinite(fps) || fps <= 0) throw new Error('实际视频帧率无效');
    }
    asset.media = {...asset.media, fps, durationSeconds};
    if (asset.decodeReceipt) checkRef(asset.decodeReceipt);
    else {
      const args = ['-nostdin', '-v', 'error', '-xerror', '-i', renderFile, '-map',
        asset.media.type === 'video' ? '0:v:0' : '0:a:0', ...(asset.media.type === 'video' ? ['-map', '0:a?'] : []), '-f', 'null', '-'];
      runPaperMediaTool(tools.ffmpeg, args, {timeout: Math.min(600000, Math.max(120000, Math.ceil(durationSeconds * 2000)))});
      asset.decodeReceipt = ref(write(`完整解码/${asset.id}.decode.v1.json`, {source: ref(renderFile),
        command: [tools.ffmpeg.path, ...args], exitCode: 0, fullDecode: true, tool: tools.ffmpeg, checkedAt: new Date().toISOString()}));
    }
  } else asset.decodeReceipt = null;
  asset.reviewAccepted = false;
  const index = intake.assets.findIndex(item => item.id === asset.id);
  if (index < 0) intake.assets.push(asset); else intake.assets[index] = asset;
}
for (const slot of runtime.mediaSlots) {
  if (slot.state !== 'ready') continue;
  const file = path.resolve(root, job.remotion.publicDir, `${runtime.assetPrefix ?? ''}${slot.asset.src}`);
  const asset = intake.assets.find(item => inside(item.renderAsset.path) === file);
  if (!asset) throw new Error(`R2运行素材未入库：${slot.id}`);
  asset.runtimeWindow = slot.window;
}
// 素材按真实文件去重；每个新 cue 另行映射至原文件及其真实来源记录，避免复制资产或丢失许可出处。
intake.existingSfxByPath = ref(sfxIndexFile);
intake.sfxCueBindings = runtime.sfx.map(cue => {
  const file = path.resolve(root, job.remotion.publicDir, `${runtime.assetPrefix ?? ''}${cue.src}`);
  const asset = intake.assets.find(item => inside(item.renderAsset.path) === file);
  const existing = sfxIndex.items.find(item => inside(item.renderAsset.path) === file);
  if (!asset || !existing || asset.renderAsset.sha256 !== existing.renderAsset.sha256) {
    throw new Error(`声效事件缺少当前真实来源映射：${cue.id}`);
  }
  return {cueId: cue.id, assetId: asset.id, src: cue.src, cue: structuredClone(cue),
    renderAsset: asset.renderAsset, sourceReceipt: asset.sourceReceipt,
    packManifest: existing.packManifest, licenseManifest: existing.licenseManifest,
    licenseRecorded: existing.licenseRecorded, humanAuditionPerformed: false, reviewAccepted: false};
});
const intakeFile = write('原生素材入库候选.v1.json', intake);
const facts = read(path.join(r1, '事实差异当前绑定.v1.json'));
Object.assign(facts, {revisionId, capturedAt: now, userScope: ref(scopeFile)});
const factsFile = write('事实差异当前绑定.v1.json', facts);
const rebound = read(path.join(episode, '04_后期准备/实录导演重绑候选.v1.json'));
Object.assign(rebound, {revisionId, status: 'prepared-for-internal-review-candidate',
  visualRevision: {sourceMessage: ref(sourceFile), runtimePlan: ref(runtimeFile),
    userScope: ref(scopeFile), supplementalFeedback: scope.supplementalUserMessages.map(item => item.sourceMessage),
    spokenTextAndOrderUnchanged: true, windows: runtime.mediaSlots.map(slot => ({id: slot.id, kind: slot.kind, window: slot.window}))}});
rebound.review.paperSlots = 'existing-user-videos-mapped-awaiting-preview-review';
const reboundFile = write('实录导演重绑候选.r2.json', rebound);
const input = read(path.join(r1, 'first-candidate-input.v1.json'));
Object.assign(input, {revisionId, executionGroupId});
input.artifacts = {...input.artifacts, runtimePlan: ref(runtimeFile), postshootRebind: ref(reboundFile),
  mediaIntake: ref(intakeFile), factReview: ref(factsFile), userScope: ref(scopeFile)};
const inputFile = write('first-candidate-input.v1.json', input);
job.director.artifacts = input.artifacts;
job.productionGate.revisionId = revisionId;
job.productionGate.firstCandidateInput = ref(inputFile);
job.productionGate.localChatPreviewAuthorization = null;
job.preview.output = path.relative(root, output).split(path.sep).join('/');
job.knowledgeContext = {taskId: options.get('--knowledge-task-id'), contextPath: `${options.get('--knowledge-task-id')}/context.json`};
job.preparationNote = 'R2真实输入已整理，尚待当前代码闭包聊天授权、真实知识上下文和受控复核；正式/发布/完整观看仍false。';
const jobFile = write('production-job.first-candidate.v1.json', job);
const authorization = read(path.join(r1, '内部预览聊天授权.draft.v1.json'));
Object.assign(authorization, {revisionId, executionGroupId, recordedAt: now, sourceMessages: ref(sourceFile), binding: null,
  supplementalSourceMessages: scope.supplementalUserMessages.map(item => item.sourceMessage),
  preparationState: 'awaiting-final-r2-code-input-binding'});
write('内部预览聊天授权.draft.v1.json', authorization);
for (const previous of r1Before) checkRef(previous);
write('R2输入准备回执.v1.json', {recordedAt: new Date().toISOString(), state: 'inputs-prepared-awaiting-binding-context-preflight',
  job: ref(jobFile), input: ref(inputFile), runtimePlan: ref(runtimeFile), sourceMessages: ref(sourceFile), mediaMap: ref(mediaMapFile),
  previousRevisionFilesUnchanged: r1Before, finalAuthorizationGenerated: false, knowledgeContextRefreshed: false,
  renderInvoked: false, fullWatchConfirmed: false, formalAuthorized: false, publishAuthorized: false});
console.log(JSON.stringify({job: ref(jobFile), input: ref(inputFile), assetCount: intake.assets.length,
  finalAuthorizationGenerated: false, knowledgeContextRefreshed: false, renderInvoked: false}));
