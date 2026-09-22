import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  AUTHORIZATION,
  AUTHORIZATION_EVENT,
  AUTHORIZATION_PHRASES,
  BASE,
  CONTROL,
  DIRECTOR_TASK_ID,
  DURATION_SECONDS,
  FPS,
  FRAME_COUNT,
  IDENTITIES,
  JOB,
  MANIFEST,
  MESSAGE_ID,
  R2_CANDIDATE,
  R2_CANDIDATE_SHA,
  R2_JOB,
  R2_SFX_CUES,
  R2_VISUAL_PLAN,
  R3_SFX_CUES,
  R3_REMOTION_VISUAL_PLAN,
  REVISION_SCOPE,
  ROUTE,
  SOURCE,
  SOURCE_SHA,
  TASK_ID,
  TURN_ID,
  collectLanzhouAISalonFormalR3Bindings,
  expectedR3SfxCues,
} from './formal-adapter.r3.mjs';
import {SCOPED_DIRECT_EXPORT_GATE_FILES} from '../../../../tools/scoped-direct-export-core.mjs';

const root = path.resolve(import.meta.dirname, '../../../..');
const rollout =
  '/Users/pc/.codex/sessions/2026/09/22/rollout-2026-09-22T20-46-30-01a0c927-4bb8-7023-b8e4-8e217fe7df81.jsonl';
const sourceLine = 10;
const sourceLines = fs.readFileSync(rollout, 'utf8').split('\n');
const rawEvent = sourceLines[sourceLine - 1];
if (!rawEvent) throw new Error(`授权记录第 ${sourceLine} 行不存在`);
const event = JSON.parse(rawEvent);
const userText = event.payload?.content
  ?.filter((item) => ['input_text', 'text'].includes(item.type))
  .map((item) => item.text)
  .join('\n')
  .trim();
if (
  event.type !== 'response_item' ||
  event.payload?.role !== 'user' ||
  event.payload?.id !== MESSAGE_ID ||
  event.payload?.internal_chat_message_metadata_passthrough?.turn_id !== TURN_ID ||
  !AUTHORIZATION_PHRASES.every((phrase) => userText?.includes(phrase))
) {
  throw new Error('指定授权行没有完整包含已看正片、唯一问题、洪岩、右移和挡脸五项原话');
}

const hashBytes = (bytes) => createHash('sha256').update(bytes).digest('hex');
const absolute = (relativePath) => path.resolve(root, relativePath);
const hashFile = (relativePath) => hashBytes(fs.readFileSync(absolute(relativePath)));
const reference = (relativePath) => ({path: relativePath, sha256: hashFile(relativePath)});
const readJson = (relativePath) => JSON.parse(fs.readFileSync(absolute(relativePath), 'utf8'));
const writeJson = (relativePath, value) => {
  fs.mkdirSync(path.dirname(absolute(relativePath)), {recursive: true});
  fs.writeFileSync(absolute(relativePath), `${JSON.stringify(value, null, 2)}\n`);
};

if (hashFile(R2_CANDIDATE) !== R2_CANDIDATE_SHA) {
  throw new Error('用户已观看的 R2 候选摘要不一致，禁止建立 R3 返修链');
}

fs.mkdirSync(absolute(CONTROL), {recursive: true});
fs.writeFileSync(absolute(AUTHORIZATION_EVENT), `${rawEvent}\n`);
writeJson(AUTHORIZATION, {
  schema: 'lanzhou-ai-salon-revision-authorization/v3',
  evidence: {
    ...reference(AUTHORIZATION_EVENT),
    source: rollout,
    sourceLine,
  },
  messageId: MESSAGE_ID,
  turnId: TURN_ID,
  userTextSha256: hashBytes(userText),
  baseCandidateReviewedByUser: true,
  baseCandidate: reference(R2_CANDIDATE),
  revisionScope: REVISION_SCOPE,
  correctedIdentities: IDENTITIES,
  finalSource: {path: SOURCE, sha256: SOURCE_SHA, frameCount: FRAME_COUNT, fps: FPS},
  spokenAuthority: 'recorded-audio',
  semanticTextPolicy: 'convert-from-final-source-recording',
  formalCandidateAuthorized: true,
  intermediatePreviewRequired: false,
  fullWatchConfirmed: false,
  publishAuthorized: false,
  scope:
    '以用户已完整观看的 R2 正式候选为返修基准；只把洪岩介绍卡、章节标和三段语义动效移到画面右侧；音频、字幕、时长、素材、音效及其他人物保持不变；R3 仍待完整观看，未授权发布。',
});

const directorDirectory = `${BASE}/03_导演拆解/director-v2-r2`;
const expectedDirectorArtifacts = {
  preproductionRequest: `${directorDirectory}/director-cues.v2.json`,
  preproductionPlan: `${directorDirectory}/director-cues-user-approval.v2.json`,
  routeLock: `${directorDirectory}/handoff-v2/director-cues-v2-handoff.v1.json`,
  preproductionValidation: `${directorDirectory}/handoff-v2/director-cues-v2-handoff-validation-receipt.v1.json`,
};
const missingDirectorArtifacts = Object.values(expectedDirectorArtifacts).filter(
  (relativePath) => !fs.existsSync(absolute(relativePath)),
);
if (missingDirectorArtifacts.length > 0) {
  throw new Error(`R2 导演四件套尚未就绪：\n${missingDirectorArtifacts.join('\n')}`);
}
const directorArtifacts = Object.fromEntries(
  Object.entries(expectedDirectorArtifacts).map(([key, relativePath]) => [key, reference(relativePath)]),
);

const visualPlanPath = `${BASE}/06_剪辑工程/visual-plan.r3.json`;
const visualPlan = readJson(visualPlanPath);
const r2VisualPlan = readJson(R2_VISUAL_PLAN);
const remotionVisualPlan = readJson(R3_REMOTION_VISUAL_PLAN);
const r2Sfx = readJson(R2_SFX_CUES);
writeJson(R3_SFX_CUES, expectedR3SfxCues(r2Sfx));
const sfx = readJson(R3_SFX_CUES);
if (
  visualPlan.videoId !== 'LANZHOU_AI_SALON_20260920_FINAL_R3' ||
  visualPlan.schemaVersion !== 4 ||
  !Array.isArray(visualPlan.layers) ||
  JSON.stringify(visualPlan) !== JSON.stringify(remotionVisualPlan) ||
  visualPlan.layers.length !== r2VisualPlan.layers?.length ||
  !Array.isArray(sfx.cues)
) {
  throw new Error('R3 视觉计划、Remotion 内嵌计划或等内容音效副本尚未稳定');
}

const job = {
  schemaVersion: 1,
  jobId: '20260920-lanzhou-ai-salon-v8-r3-formal',
  videoId: 'LANZHOU_AI_SALON_20260920_FINAL_R3',
  title: '兰州AI实践者共创沙龙第一期',
  purpose:
    '基于用户已观看的 R2 正式候选生成 R3 布局返修候选；只将洪岩介绍卡、章节标和三段语义动效移到右侧，完整保留音频、字幕、18413 帧、素材、音效和其他人物画面。',
  revisionBase: reference(R2_CANDIDATE),
  revisionScope: REVISION_SCOPE,
  productionState: 'ready-for-production',
  productionEligible: true,
  productionProfile: {id: 'v8-semantic-continuity-sfx', version: 'V8'},
  contentApproval: {
    userScriptApproved: true,
    evidence: '沿用 R2 已绑定内容批准；本轮用户只授权洪岩相关画面元素右移。',
  },
  experiment: {
    id: 'v8-semantic-continuity-sfx',
    status: 'candidate-preview-required',
    userPreviewApproved: false,
    formalCandidateAuthorized: true,
    revisionReason: '用户已观看 R2 正片，唯一返修是将洪岩全部介绍与三段语义动效移到画面右侧；R3 完整观看与发布仍待后续确认。',
    primaryVisualEventCount: visualPlan.layers.length,
    sfxCueCount: sfx.cues.length,
  },
  baseline: {
    path: 'workflow/production-baseline.v1.json',
    id: 'koubo-formal-16x9-v1',
    revision: 'V7.2-20260730',
  },
  inputs: {
    source: SOURCE,
    renderProxy: 'remotion/public-salon-20260920/media/salon-final-proxy-v2.mp4',
    transcript: `${BASE}/05_实录与字幕/canonical-transcript.final-source.v2.json`,
    captions: 'remotion/public-salon-20260920/data/captions.final-source.bilingual.v2.json',
    bilingualCaptions: 'remotion/public-salon-20260920/data/captions.final-source.bilingual.v2.json',
    spokenSourcePolicy: `${BASE}/05_实录与字幕/spoken-source-policy.v2.json`,
    visualPlan: visualPlanPath,
    sfxCueSheet: R3_SFX_CUES,
    sfxManifest: 'assets/sfx/koubo-sfx-v8/manifest.json',
    timingRebind: `${BASE}/06_剪辑工程/final-proxy.receipt.v2.json`,
    fingerprintPaths: [
      SOURCE,
      `${BASE}/00_工程控制/final-source.v2.json`,
      `${BASE}/00_工程控制/build-final-proxy.v2.mjs`,
      `${BASE}/00_工程控制/build-final-captions.v2.mjs`,
      `${BASE}/00_工程控制/build-final-visual-assets.v2.mjs`,
      `${BASE}/05_实录与字幕/caption-review.final-source.v2.json`,
      `${BASE}/06_剪辑工程/final-proxy.receipt.v2.json`,
      AUTHORIZATION,
      AUTHORIZATION_EVENT,
      R2_JOB,
      R2_VISUAL_PLAN,
      R2_SFX_CUES,
      R3_SFX_CUES,
      R2_CANDIDATE,
      `${CONTROL}/formal-adapter.r3.mjs`,
      `${CONTROL}/build-formal-binding.r3.mjs`,
      MANIFEST,
      ...Object.values(expectedDirectorArtifacts),
      'remotion/src/salon-20260920-r3/Root.tsx',
      'remotion/src/salon-20260920-r3/SalonHighlightR3.tsx',
      'remotion/src/salon-20260920-r3/index.ts',
      'remotion/src/salon-20260920-r3/index.tsx',
      R3_REMOTION_VISUAL_PLAN,
      'workflow/active-production-profile.v1.json',
      'assets/sfx/koubo-sfx-v8/manifest.json',
      ...SCOPED_DIRECT_EXPORT_GATE_FILES,
    ],
  },
  remotion: {
    root: 'remotion',
    entry: 'src/salon-20260920-r3/index.tsx',
    publicDir: 'remotion/public-salon-20260920',
    compositionWithSfx: 'LanzhouAISalon20260920R3-WithSfx',
    compositionWithoutSfx: 'LanzhouAISalon20260920R3-NoSfx',
    durationSeconds: DURATION_SECONDS,
    fps: FPS,
    width: 1920,
    height: 1080,
    concurrency: 2,
  },
  preview: {
    enabled: false,
    output: null,
    ranges: [],
    renderWithoutSfxComparison: false,
  },
  riskFrames: {
    enabled: true,
    fullResolution: true,
    outputDirectory: `${BASE}/07_预览与质检/正式R3/frames`,
    entries: visualPlan.layers
      .filter((layer) => layer.checks?.needsFrameReview && Number.isFinite(layer.checks?.reviewAt))
      .map((layer) => ({time: layer.checks.reviewAt, layerIds: [layer.id]})),
  },
  audioPreflight: {
    enabled: true,
    source: 'formal-candidate',
    integratedLoudnessTargetLufs: -16,
    truePeakMaxDbtp: -1.5,
    preferredTruePeakDbtp: -1.8,
  },
  formal: {
    enabled: true,
    composition: 'with-sfx',
    rawOutput: `${BASE}/08_正式成片/兰州AI实践者共创沙龙第一期_R3_正式渲染原始.mp4`,
    finalOutput: `${BASE}/08_正式成片/兰州AI实践者共创沙龙第一期_V8_R3_1080P_正式候选.mp4`,
    crf: 18,
    pixelFormat: 'yuv420p',
    audioCodec: 'aac',
    audioBitrate: '320k',
    loudness: {
      enabled: true,
      integratedLoudnessTargetLufs: -16,
      loudnessRangeTargetLu: 11,
      truePeakTargetDbtp: -1.8,
    },
  },
  finalReview: {fullWatchConfirmed: false, reviewOutcome: 'pending'},
  publishAuthorized: false,
  cache: {
    enabled: true,
    directory: 'work/production-cache/lanzhou-ai-salon-v8-r3',
    reuseOnlyOnExactFingerprint: true,
  },
  reports: {
    runManifest: `${BASE}/07_预览与质检/正式R3/run-manifest.json`,
    timingReport: `${BASE}/07_预览与质检/正式R3/timing.json`,
    regressionReport: `${BASE}/07_预览与质检/正式R3/regression.json`,
  },
  knowledgeContext: {
    taskId: TASK_ID,
    contextPath: `${TASK_ID}/context.json`,
    status: 'context-must-be-refreshed-after-final-job-binding',
  },
  director: {
    required: true,
    profileId: 'paper-editorial-director-v9',
    profileVersion: '9.1.0',
    taskId: DIRECTOR_TASK_ID,
    phase: 'post-shoot',
    postshootEvidence: 'actual-spoken-timeline',
    skillPackageAccepted: true,
    artifacts: directorArtifacts,
  },
  productionGate: {
    schema: 'director-production-entry-binding/v2',
    route: ROUTE,
    state: 'scoped-formal-authorized-r3',
    revisionId: 'lanzhou-ai-salon-v8-r3',
    formalEnabled: true,
    userPreviewApproved: false,
    scopedDirectExport: {path: MANIFEST, sha256: '0'.repeat(64)},
  },
  blockers: [],
};

writeJson(JOB, job);
const manifest = {
  schema: 'lanzhou-ai-salon-formal-manifest/v3',
  route: ROUTE,
  episodeId: job.videoId,
  jobId: job.jobId,
  jobPath: JOB,
  source: {path: SOURCE, sha256: SOURCE_SHA, frameCount: FRAME_COUNT, fps: FPS},
  baseCandidate: reference(R2_CANDIDATE),
  revisionScope: REVISION_SCOPE,
  correctedIdentities: IDENTITIES,
  spokenAuthority: 'recorded-audio',
  productionProfile: 'V8',
  authorization: reference(AUTHORIZATION),
  output: {
    rawOutput: job.formal.rawOutput,
    finalCandidate: job.formal.finalOutput,
    fullWatchConfirmed: false,
    publishAuthorized: false,
  },
  binding: collectLanzhouAISalonFormalR3Bindings({projectRoot: root, job}),
};
writeJson(MANIFEST, manifest);
const pin = hashFile(MANIFEST);
job.productionGate.scopedDirectExport.sha256 = pin;
writeJson(JOB, job);

const corePath = absolute('tools/scoped-direct-export-core.mjs');
const coreSource = fs.readFileSync(corePath, 'utf8');
const replacement = `export const LANZHOU_AI_SALON_FORMAL_R3_PIN = '${pin}';`;
const updatedCore = coreSource.replace(
  /export const LANZHOU_AI_SALON_FORMAL_R3_PIN = '[a-f0-9]*';/u,
  replacement,
);
if (updatedCore === coreSource) {
  throw new Error('tools/scoped-direct-export-core.mjs 缺少本期固定摘要位置');
}
fs.writeFileSync(corePath, updatedCore);

console.log(
  JSON.stringify({
    status: 'lanzhou-ai-salon-formal-r3-bound',
    job: JOB,
    manifest: MANIFEST,
    pin,
    authorizationSourceLine: sourceLine,
    messageId: MESSAGE_ID,
    baseCandidate: R2_CANDIDATE,
    baseCandidateSha256: R2_CANDIDATE_SHA,
    revisionScope: REVISION_SCOPE,
    frameCount: FRAME_COUNT,
    durationSeconds: DURATION_SECONDS,
    formalCandidateAuthorized: true,
    fullWatchConfirmed: false,
    publishAuthorized: false,
  }),
);
