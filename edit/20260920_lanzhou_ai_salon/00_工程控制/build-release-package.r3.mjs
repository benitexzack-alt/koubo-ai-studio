import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../../..');
const r2PackageRelative =
  'edit/20260920_lanzhou_ai_salon/09_发布包/R2_V8_正式候选';
const packageRootRelative =
  'edit/20260920_lanzhou_ai_salon/09_发布包/R3_V8_正式候选';
const candidateSourceRelative =
  'edit/20260920_lanzhou_ai_salon/08_正式成片/兰州AI实践者共创沙龙第一期_V8_R3_1080P_正式候选.mp4';
const r2CandidateRelative =
  'edit/20260920_lanzhou_ai_salon/08_正式成片/兰州AI实践者共创沙龙第一期_V8_R2_1080P_正式候选.mp4';
const runManifestRelative =
  'edit/20260920_lanzhou_ai_salon/07_预览与质检/正式R3/run-manifest.json';
const timingRelative =
  'edit/20260920_lanzhou_ai_salon/07_预览与质检/正式R3/timing.json';
const riskRootRelative =
  'edit/20260920_lanzhou_ai_salon/07_预览与质检/正式R3/final-risk-frames';
const riskReceiptRelative =
  `${riskRootRelative}/risk-frame-extraction.receipt.v2.json`;
const jobRelative =
  'workflow/jobs/20260920_lanzhou_ai_salon_v8_r3.production.json';
const expectedR2CandidateSha256 =
  'e90d5326137c739ee6c601b7b1b1c2f31daeb7ee20f34e56f8ef70f08b1e4cca';
const expectedAudioPcmSha256 =
  'cb9843f1495bf6a84222763adde2d7fad70677b789cc1c83d228eaec2f946fa5';
const expectedSrtSha256 =
  '3a0dd364329aa4c124965def4fff1fd775973a2626c429b10665f04675f132f0';

const names = Object.freeze({
  video: '兰州AI实践者共创沙龙第一期_V8_R3_1080P_正式候选.mp4',
  screenshot: '本条成片真人截图_606秒.png',
  srt: '兰州AI实践者共创沙龙第一期_中英字幕_R3.srt',
  publishing: '发布包装.md',
  coverPrompt: '3比4真人截图合成封面提示词.md',
  copyReview: '发布包装.copy-review.json',
  languageScan: '发布文字机器扫描回执.v1.json',
  coverReceipt: '封面来源回执.v1.json',
  formalQa: '正式全片机器质检回执.v1.json',
  riskReceipt: '正式成片风险帧回执.v2.json',
  releaseRecord: '发布记录.v1.json',
  readme: '00_交付说明.md',
  manifest: '发布包清单.v1.json',
});

const absolute = (relativePath) => path.resolve(root, relativePath);
const relative = (absolutePath) =>
  path.relative(root, absolutePath).split(path.sep).join('/');
const packageRoot = absolute(packageRootRelative);
const r2Package = absolute(r2PackageRelative);
const destination = (name) => path.join(packageRoot, name);
const packagePath = (name) => `${packageRootRelative}/${name}`;
const hashBytes = (bytes) => createHash('sha256').update(bytes).digest('hex');
const hashFile = (filePath) => hashBytes(fs.readFileSync(filePath));
const readJson = (relativePath) =>
  JSON.parse(fs.readFileSync(absolute(relativePath), 'utf8'));
const readPackageJson = (name) =>
  JSON.parse(fs.readFileSync(path.join(r2Package, name), 'utf8'));
const writeJson = (name, value) =>
  fs.writeFileSync(destination(name), `${JSON.stringify(value, null, 2)}\n`);
const fail = (message) => {
  throw new Error(message);
};
const requireThat = (condition, message) => {
  if (!condition) fail(message);
};
const run = (binary, args, {buffer = false, json = false} = {}) => {
  const result = spawnSync(binary, args, {
    cwd: root,
    encoding: buffer ? null : 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    const stderr = buffer
      ? result.stderr?.toString('utf8')
      : result.stderr;
    const stdout = buffer
      ? result.stdout?.toString('utf8')
      : result.stdout;
    fail(`${binary} 执行失败：${stderr || stdout || result.error?.message}`);
  }
  if (buffer) return result.stdout;
  return json ? JSON.parse(result.stdout) : result.stdout;
};
const replaceExact = (source, from, to, expectedCount = 1) => {
  const count = source.split(from).length - 1;
  requireThat(count === expectedCount, `替换数量异常：${from}，实际 ${count}`);
  return source.replaceAll(from, to);
};
const chinaIso = () => {
  const shifted = new Date(Date.now() + 8 * 60 * 60 * 1000)
    .toISOString()
    .replace('Z', '+08:00');
  return shifted;
};
const fileReference = (name) => ({
  path: packagePath(name),
  sha256: hashFile(destination(name)),
  bytes: fs.statSync(destination(name)).size,
});
const assertOrdinaryFile = (filePath, label) => {
  const stat = fs.lstatSync(filePath);
  requireThat(stat.isFile() && !stat.isSymbolicLink(), `${label} 不是普通文件`);
  return stat;
};

requireThat(
  packageRoot ===
    absolute('edit/20260920_lanzhou_ai_salon/09_发布包/R3_V8_正式候选'),
  '发布包清理路径必须严格等于 R3 独立目录',
);
requireThat(fs.existsSync(r2Package), 'R2 发布包模板不存在');

const job = readJson(jobRelative);
const runManifest = readJson(runManifestRelative);
const timing = readJson(timingRelative);
const riskExtraction = readJson(riskReceiptRelative);
const candidateSource = absolute(candidateSourceRelative);
const r2Candidate = absolute(r2CandidateRelative);
const createdAt = chinaIso();

requireThat(
  job.jobId === '20260920-lanzhou-ai-salon-v8-r3-formal' &&
    job.videoId === 'LANZHOU_AI_SALON_20260920_FINAL_R3' &&
    job.formal?.finalOutput === candidateSourceRelative &&
    job.finalReview?.fullWatchConfirmed === false &&
    job.publishAuthorized === false,
  'R3 job 身份或人工验收边界不一致',
);
requireThat(
  runManifest.status === 'passed' &&
    runManifest.command === 'formal' &&
    runManifest.dryRun === false &&
    timing.status === 'passed',
  'R3 formal runner 没有完整通过',
);
requireThat(fs.existsSync(candidateSource), 'R3 正式候选不存在');

const candidateSha256 = hashFile(candidateSource);
const candidateBytes = fs.statSync(candidateSource).size;
requireThat(
  candidateSha256 === runManifest.formalQa?.sha256 &&
    candidateBytes === runManifest.formalQa?.sizeBytes &&
    runManifest.formalQa?.output === candidateSourceRelative &&
    runManifest.formalQa?.status === 'passed' &&
    candidateSha256 !== expectedR2CandidateSha256,
  'R3 候选哈希、大小或 formal QA 绑定不一致',
);
requireThat(
  hashFile(r2Candidate) === expectedR2CandidateSha256,
  'R2 只读对照候选摘要漂移',
);

const stageRoot =
  'edit/20260920_lanzhou_ai_salon/07_预览与质检/正式R3/stage-success';
const stageFiles = [
  `${stageRoot}/20260920-lanzhou-ai-salon-v8-r3-formal.formal-render.json`,
  `${stageRoot}/20260920-lanzhou-ai-salon-v8-r3-formal.formal-audio.json`,
  `${stageRoot}/20260920-lanzhou-ai-salon-v8-r3-formal.formal-qa.json`,
];
const stages = stageFiles.map(readJson);
requireThat(
  stages.every(
    (stage) =>
      stage.status === 'passed' &&
      stage.jobId === job.jobId &&
      stage.fingerprint === runManifest.fingerprint,
  ) &&
    stages.map((stage) => stage.stageId).join(',') ===
      'formal-render,formal-audio,formal-qa' &&
    stages[1].outputs?.[0]?.sha256 === candidateSha256 &&
    stages[2].outputs?.[0]?.sha256 === candidateSha256,
  'formal-render/audio/qa 三段成功回执不完整或 fingerprint 不一致',
);

const probe = run(
  'ffprobe',
  [
    '-v',
    'error',
    '-count_frames',
    '-show_entries',
    'format=duration,size:stream=index,codec_name,codec_type,width,height,pix_fmt,r_frame_rate,avg_frame_rate,nb_frames,nb_read_frames,sample_rate,channels,bit_rate',
    '-of',
    'json',
    candidateSource,
  ],
  {json: true},
);
const video = probe.streams?.find((stream) => stream.codec_type === 'video');
const audio = probe.streams?.find((stream) => stream.codec_type === 'audio');
requireThat(
  video?.codec_name === 'h264' &&
    video?.width === 1920 &&
    video?.height === 1080 &&
    video?.r_frame_rate === '30/1' &&
    video?.nb_frames === '18413' &&
    video?.nb_read_frames === '18413' &&
    audio?.codec_name === 'aac' &&
    audio?.sample_rate === '48000' &&
    audio?.channels === 2 &&
    Number(probe.format?.duration) === 613.9,
  'R3 候选媒体规格或完整解码帧数不一致',
);
const pcmHashOutput = run('ffmpeg', [
  '-hide_banner',
  '-loglevel',
  'error',
  '-i',
  candidateSource,
  '-map',
  '0:a:0',
  '-vn',
  '-c:a',
  'pcm_s16le',
  '-f',
  'hash',
  '-hash',
  'sha256',
  '-',
]).trim();
const audioPcmSha256 = pcmHashOutput.replace(/^SHA256=/u, '').toLowerCase();
requireThat(
  audioPcmSha256 === expectedAudioPcmSha256,
  'R3 解码音频与 R2 固定音频基准不一致',
);

requireThat(
  riskExtraction.schema === 'salon-final-risk-frame-extraction/v2' &&
    riskExtraction.status === 'extracted-for-human-review' &&
    riskExtraction.source?.path === candidateSourceRelative &&
    riskExtraction.source?.sha256 === candidateSha256 &&
    riskExtraction.expectedFrameCount === 18413 &&
    riskExtraction.extractedCount === 41 &&
    riskExtraction.frames?.length === 41,
  'R3 风险帧提取回执不完整',
);
for (let index = 0; index < riskExtraction.frames.length; index += 1) {
  const frame = riskExtraction.frames[index];
  const contract = job.riskFrames.entries[index];
  const filePath = absolute(frame.path);
  assertOrdinaryFile(filePath, `风险帧 ${index + 1}`);
  requireThat(
    frame.index === index + 1 &&
      frame.timeSeconds === contract.time &&
      JSON.stringify(frame.layerIds) === JSON.stringify(contract.layerIds) &&
      frame.sha256 === hashFile(filePath),
    `风险帧 ${index + 1} 与 R3 job 或摘要不一致`,
  );
}
const contactSheetPath = absolute(riskExtraction.contactSheet.path);
assertOrdinaryFile(contactSheetPath, 'R3 风险帧联系表');
requireThat(
  riskExtraction.contactSheet.sha256 === hashFile(contactSheetPath),
  'R3 风险帧联系表摘要不一致',
);

fs.rmSync(packageRoot, {recursive: true, force: true});
fs.mkdirSync(packageRoot, {recursive: true});

fs.linkSync(candidateSource, destination(names.video));
const sourceStat = fs.statSync(candidateSource);
const packageVideoStat = fs.statSync(destination(names.video));
const r2Stat = fs.statSync(r2Candidate);
requireThat(
  sourceStat.dev === packageVideoStat.dev &&
    sourceStat.ino === packageVideoStat.ino &&
    sourceStat.ino !== r2Stat.ino &&
    hashFile(destination(names.video)) === candidateSha256,
  '包内 MP4 不是 R3 正式候选的独立硬链接',
);

const r2Srt = path.join(r2Package, '兰州AI实践者共创沙龙第一期_中英字幕_R2.srt');
fs.copyFileSync(r2Srt, destination(names.srt));
requireThat(
  hashFile(r2Srt) === expectedSrtSha256 &&
    hashFile(destination(names.srt)) === expectedSrtSha256,
  '180 块 SRT 没有保持正文原字节',
);
const srtBlocks = fs
  .readFileSync(destination(names.srt), 'utf8')
  .trim()
  .split(/\r?\n\r?\n/u);
requireThat(
  srtBlocks.length === 180 &&
    srtBlocks.every((block, index) => block.startsWith(`${index + 1}\n`)),
  'SRT 必须保持 180 个连续编号字幕块',
);

const r2CoverPrompt = path.join(r2Package, names.coverPrompt);
fs.copyFileSync(r2CoverPrompt, destination(names.coverPrompt));
requireThat(
  hashFile(r2CoverPrompt) === hashFile(destination(names.coverPrompt)),
  '封面提示词没有保持原字节',
);

const r2Publishing = fs.readFileSync(path.join(r2Package, names.publishing), 'utf8');
const publishing = replaceExact(
  r2Publishing,
  '兰州AI实践者共创沙龙第一期_V8_R2_1080P_正式候选.mp4',
  names.video,
);
fs.writeFileSync(destination(names.publishing), publishing);
const publicStart = '<!-- PUBLIC_COPY_START -->';
const publicEnd = '<!-- PUBLIC_COPY_END -->';
const publicSection = (value) => {
  const start = value.indexOf(publicStart);
  const end = value.indexOf(publicEnd);
  requireThat(start >= 0 && end > start, '发布包装缺少 PUBLIC_COPY 标记');
  return value.slice(start, end + publicEnd.length);
};
requireThat(
  publicSection(publishing) === publicSection(r2Publishing),
  '标题、发布文案、话题或封面精确文字发生变化',
);

run('ffmpeg', [
  '-hide_banner',
  '-loglevel',
  'error',
  '-ss',
  '606',
  '-i',
  candidateSource,
  '-frames:v',
  '1',
  '-vf',
  'scale=1920:1080:flags=lanczos',
  '-y',
  destination(names.screenshot),
]);
const screenshotGeometry = run('identify', [
  '-format',
  '%w %h',
  destination(names.screenshot),
]).trim();
requireThat(screenshotGeometry === '1920 1080', '606 秒截图尺寸不正确');

const publishingSha256 = hashFile(destination(names.publishing));
const coverPromptSha256 = hashFile(destination(names.coverPrompt));
const screenshotSha256 = hashFile(destination(names.screenshot));

const r2LanguageScan = readPackageJson(names.languageScan);
const languageScan = structuredClone(r2LanguageScan);
languageScan.scannedAt = createdAt;
languageScan.draft.path = absolute(packagePath(names.publishing));
languageScan.draft.sha256 = publishingSha256;
languageScan.sourceScanReceipt = {
  sha256: hashFile(path.join(r2Package, names.languageScan)),
  publicCopyByteIdentical: true,
};
languageScan.boundary =
  'R3 公开文字与已通过扫描的 R2 PUBLIC_COPY 字节完全一致；本回执重新绑定 R3 发布包装。该局部扫描不授予公开发布权限。';
writeJson(names.languageScan, languageScan);

const r2CopyReview = readPackageJson(names.copyReview);
const copyReview = structuredClone(r2CopyReview);
copyReview.task_id = '20260920-lanzhou-ai-salon-v8-r3-release-copy';
copyReview.reviewed_at = createdAt;
copyReview.draft.path = absolute(packagePath(names.publishing));
copyReview.draft.sha256 = publishingSha256;
copyReview.cover_prompt.path = absolute(packagePath(names.coverPrompt));
copyReview.cover_prompt.sha256 = coverPromptSha256;
copyReview.machine_language_scan.path = absolute(packagePath(names.languageScan));
copyReview.machine_language_scan.status = languageScan.status;
copyReview.r3_rebind = {
  publicCopyByteIdenticalToR2: true,
  coverPromptByteIdenticalToR2: true,
  sourceReviewSha256: hashFile(path.join(r2Package, names.copyReview)),
};
copyReview.package_status = 'ready-for-user-review';
copyReview.userFullWatchConfirmed = false;
copyReview.publishAuthorized = false;
writeJson(names.copyReview, copyReview);

const riskReceipt = structuredClone(riskExtraction);
riskReceipt.status = 'reviewed-for-user-review';
riskReceipt.humanReview = {
  reviewedAt: createdAt,
  reviewer: 'Codex visual review',
  contactSheetReviewed: true,
  fullResolutionTargetFrameIndexes: [28, 29, 30, 31],
  reviewedFrameCount: 41,
  blockingFindingCount: 0,
  finding:
    '41帧联系表已逐项复核；洪岩介绍卡、06章节标和029至031三段语义动效另以原分辨率复核，均位于画面右侧，未遮挡洪岩面部，未见裁字或越界。',
};
riskReceipt.fullWatchConfirmed = false;
riskReceipt.publishAuthorized = false;
writeJson(names.riskReceipt, riskReceipt);

const formalQaReceipt = {
  schemaVersion: 1,
  status: 'passed',
  scope: 'formal-candidate-machine-qa',
  sourceRunManifest: runManifestRelative,
  sourceRunManifestSha256: hashFile(absolute(runManifestRelative)),
  stageSuccessReceipts: stageFiles.map((stagePath) => ({
    path: stagePath,
    sha256: hashFile(absolute(stagePath)),
  })),
  audioPcmSha256,
  audioUnchangedFromR2: true,
  formalQa: runManifest.formalQa,
  humanReviewBoundary: {
    riskFramesReviewed: true,
    riskFrameCount: 41,
    fullSpeedFullWatchConfirmedByUser: false,
    verifiedReleaseAllowed: false,
    note: '机器质检和风险帧复核不能替代用户正常速度完整观看。',
  },
};
writeJson(names.formalQa, formalQaReceipt);

const coverReceipt = {
  schemaVersion: 1,
  status: 'source-bound-cover-not-generated',
  video: fileReference(names.video),
  screenshot: {
    ...fileReference(names.screenshot),
    width: 1920,
    height: 1080,
    timeSeconds: 606,
    sourceKind: 'this-r3-formal-video-host-frame',
    notAiGenerated: true,
    fullFrameUnretouched: true,
    uniquePersonSource: true,
  },
  prompt: fileReference(names.coverPrompt),
  review: {
    frameReviewed: true,
    finding:
      'R3正式候选606秒处主持人居中、微笑、人物清晰，可作为本条封面唯一人物来源；片内叠字和字幕只允许在合成时作为叠加层移除，不能重绘人物。',
    finalCoverImageGenerated: false,
    finalCoverImageUserReviewConfirmed: false,
  },
};
writeJson(names.coverReceipt, coverReceipt);

const r2Release = readPackageJson(names.releaseRecord);
const releaseRecord = structuredClone(r2Release);
releaseRecord.releaseId = '20260920-lanzhou-ai-salon-v8-r3-candidate-v1';
releaseRecord.createdAt = createdAt;
releaseRecord.status = 'ready-for-user-review';
releaseRecord.formalCandidate = {
  ...fileReference(names.video),
  hardLinkedFrom: candidateSourceRelative,
  sameInodeVerified: true,
  durationSeconds: Number(probe.format.duration),
  frameCount: Number(video.nb_frames),
  width: video.width,
  height: video.height,
  fps: 30,
  videoCodec: video.codec_name,
  audioCodec: audio.codec_name,
  audioSampleRate: Number(audio.sample_rate),
  audioChannels: audio.channels,
  differsFromR2ContainerSha256: true,
  audioPcmSha256,
  audioUnchangedFromR2: true,
};
releaseRecord.sourcePolicy.subtitlePath = packagePath(names.srt);
releaseRecord.sourcePolicy.subtitleSha256 = hashFile(destination(names.srt));
releaseRecord.visualDelivery.recommendedCoverFrame = {
  path: packagePath(names.screenshot),
  sha256: screenshotSha256,
  timeSeconds: 606,
};
releaseRecord.qa = {
  status: 'passed',
  fullDecode: true,
  blackFrameCount: runManifest.formalQa.blackFrameCount,
  integratedLoudnessLufs: runManifest.formalQa.integratedLoudnessLufs,
  loudnessRangeLu: runManifest.formalQa.loudnessRangeLu,
  truePeakDbtp: runManifest.formalQa.truePeakDbtp,
  audioPcmSha256,
  formalRunManifest: {
    path: runManifestRelative,
    sha256: hashFile(absolute(runManifestRelative)),
  },
  formalQaReceipt: {
    path: packagePath(names.formalQa),
    sha256: hashFile(destination(names.formalQa)),
  },
  riskFrameReceipt: {
    path: packagePath(names.riskReceipt),
    sha256: hashFile(destination(names.riskReceipt)),
  },
  riskFrameContactSheet: {
    path: riskExtraction.contactSheet.path,
    sha256: riskExtraction.contactSheet.sha256,
  },
  spokenSourcePolicy: r2Release.qa.spokenSourcePolicy,
};
releaseRecord.publishingCopy.path = packagePath(names.publishing);
releaseRecord.publishingCopy.sha256 = publishingSha256;
releaseRecord.publishingCopy.copyReviewPath = packagePath(names.copyReview);
releaseRecord.acceptance = {
  machineQaPassed: true,
  riskFramesReviewed: true,
  userFullWatchConfirmed: false,
  verified: false,
  publishAuthorized: false,
  published: false,
};
releaseRecord.canonicalReleaseGate = {
  run: false,
  passed: false,
  reason: '本轮仅整理 R3 正式候选本地发布包，未建立 release-production-gate/v2 规范发布记录。',
};
releaseRecord.nextGate =
  '用户以正常速度完整观看 R3 正式候选并确认；公开发布仍需单独授权、参与者传播授权复核与发布当日平台 AI 内容声明。';
writeJson(names.releaseRecord, releaseRecord);

const readme = `# 兰州AI实践者共创沙龙第一期｜R3 V8正式候选

当前状态：\`ready-for-user-review\`。

## 本次交付

- 正式候选：\`${names.video}\`
- 时长约10分13.9秒，完整保留既有音频、字幕、时长、素材、音效及其他人物画面；本轮只把洪岩介绍卡、06章节标和三段语义动效移到画面右侧。
- 画面规格：1920×1080、30fps、18413帧、H.264；音频为AAC、48kHz、双声道。
- 中文字幕以最终源实际录音为唯一正文，英文从实录中文翻译。包内提供180块中英字幕SRT，正文与R2保持字节一致。
- 41个正式风险帧及联系表已复核；洪岩四个目标帧另以原分辨率确认右置且未遮挡面部。
- 包内MP4与08_正式成片中的R3候选为同一inode硬链接，SHA-256为\`${candidateSha256}\`。

## 自动质检结果

- 完整解码18413帧，未检出黑帧。
- 综合响度约${runManifest.formalQa.integratedLoudnessLufs} LUFS，响度范围${runManifest.formalQa.loudnessRangeLu} LU，真峰值${runManifest.formalQa.truePeakDbtp} dBTP。
- R3解码音频PCM摘要与R2固定基准一致，字幕、声音与时长未改变。
- 正式渲染、响度处理和机器质检三个阶段均为\`passed\`且使用同一fingerprint。

## 人工验收边界

机器质检和风险帧复核不能替代正常速度完整观看。当前\`fullWatchConfirmed=false\`、\`publishAuthorized=false\`，未标记为\`verified\`，也未执行规范release门禁或公开发布。用户完整观看并确认后，仍需单独取得发布授权，并复核参与者肖像、声音、活动传播授权及平台当日AI内容声明。
`;
fs.writeFileSync(destination(names.readme), readme);

const manifestRoles = [
  ['formal-mp4', names.video],
  ['current-video-real-person-frame', names.screenshot],
  ['bilingual-srt', names.srt],
  ['publish-copy-and-cover-prompt', names.publishing],
  ['standalone-cover-prompt', names.coverPrompt],
  ['dual-skill-copy-review', names.copyReview],
  ['release-copy-language-scan', names.languageScan],
  ['cover-source-receipt', names.coverReceipt],
  ['formal-machine-qa', names.formalQa],
  ['formal-risk-frame-receipt', names.riskReceipt],
  ['release-record', names.releaseRecord],
  ['delivery-readme', names.readme],
];
const manifest = {
  schemaVersion: 1,
  packageId: '20260920-lanzhou-ai-salon-v8-r3-candidate-v1-package',
  createdAt,
  status: 'ready-for-user-review',
  packageRoot: packageRootRelative,
  itemCount: manifestRoles.length,
  files: manifestRoles.map(([role, name]) => ({role, ...fileReference(name)})),
  deliveryState: {
    formalCandidateReady: true,
    localReleasePackageComplete: true,
    canonicalReleaseGateRun: false,
    canonicalReleaseGatePassed: false,
    userFullWatchConfirmed: false,
    verified: false,
    publishAuthorized: false,
    published: false,
  },
  acceptanceBoundary:
    '本地自校验、机器质检和风险帧复核均不能替代用户正常速度完整观看，也不构成规范release验证或公开发布授权。',
};
writeJson(names.manifest, manifest);

requireThat(manifest.itemCount === 12 && manifest.files.length === 12, '清单必须列12项');
for (const item of manifest.files) {
  const filePath = absolute(item.path);
  const stat = assertOrdinaryFile(filePath, item.role);
  requireThat(
    item.sha256 === hashFile(filePath) && item.bytes === stat.size,
    `清单摘要或大小不匹配：${item.path}`,
  );
}

const expectedNames = new Set(Object.values(names));
const actualNames = fs
  .readdirSync(packageRoot, {withFileTypes: true})
  .filter((entry) => {
    requireThat(entry.isFile() && !entry.isSymbolicLink(), `发布包含非普通文件：${entry.name}`);
    return true;
  })
  .map((entry) => entry.name);
requireThat(
  actualNames.length === 13 &&
    actualNames.every((name) => expectedNames.has(name)) &&
    expectedNames.size === actualNames.length,
  '发布包实际普通文件集合不是固定13项',
);

for (const name of actualNames) {
  const stat = fs.statSync(destination(name));
  if (name === names.video) {
    requireThat(
      stat.dev === sourceStat.dev && stat.ino === sourceStat.ino && stat.nlink === 2,
      '包内MP4硬链接验证失败',
    );
  } else {
    requireThat(stat.nlink === 1, `除MP4外文件不得是硬链接：${name}`);
  }
}

const staleTokens = [
  'R2_V8_正式候选',
  'V8_R2_1080P_正式候选',
  '07_预览与质检/正式R2',
  expectedR2CandidateSha256,
];
for (const name of actualNames.filter((item) => /\.(?:json|md|srt)$/u.test(item))) {
  const text = fs.readFileSync(destination(name), 'utf8');
  for (const token of staleTokens) {
    requireThat(!text.includes(token), `R3 发布包残留 R2 候选引用：${name} -> ${token}`);
  }
}
requireThat(
  releaseRecord.status === 'ready-for-user-review' &&
    releaseRecord.acceptance.userFullWatchConfirmed === false &&
    releaseRecord.acceptance.verified === false &&
    releaseRecord.acceptance.publishAuthorized === false &&
    releaseRecord.acceptance.published === false &&
    copyReview.reading_limits.human_read_aloud_completed === false &&
    copyReview.reading_limits.user_language_approval_for_new_copy === false &&
    copyReview.full_content_gate_run === false &&
    copyReview.full_content_gate_passed === false &&
    coverReceipt.review.finalCoverImageGenerated === false &&
    coverReceipt.review.finalCoverImageUserReviewConfirmed === false,
  '发布包人工验收、封面或发布状态越权',
);

console.log(
  JSON.stringify({
    status: manifest.status,
    packageRoot: packageRootRelative,
    manifest: packagePath(names.manifest),
    manifestSha256: hashFile(destination(names.manifest)),
    itemCount: manifest.itemCount,
    directoryFileCount: actualNames.length,
    candidateSha256,
    candidateBytes,
    candidateInode: packageVideoStat.ino,
    hardLinkVerified: true,
    audioPcmSha256,
    subtitleBlockCount: srtBlocks.length,
    screenshotSha256,
    riskFrameCount: riskReceipt.frames.length,
    contactSheetSha256: riskReceipt.contactSheet.sha256,
    fullWatchConfirmed: false,
    verified: false,
    publishAuthorized: false,
    published: false,
    canonicalReleaseGatePassed: false,
  }),
);
