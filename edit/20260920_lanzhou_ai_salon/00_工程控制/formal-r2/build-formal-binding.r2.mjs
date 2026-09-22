import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  AUTHORIZATION,
  AUTHORIZATION_EVENT,
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
  ROUTE,
  SOURCE,
  SOURCE_SHA,
  TASK_ID,
  TURN_ID,
  collectLanzhouAISalonFormalR2Bindings,
} from './formal-adapter.r2.mjs';
import {SCOPED_DIRECT_EXPORT_GATE_FILES} from '../../../../tools/scoped-direct-export-core.mjs';

const root = path.resolve(import.meta.dirname, '../../../..');
const rollout =
  '/Users/pc/.codex/sessions/2026/09/21/rollout-2026-09-21T22-10-12-01a0c44d-8fa2-78f2-8c5a-63b851bd3102.jsonl';
const sourceLine = 1587;
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
  !IDENTITIES.every((identity) => userText?.includes(identity)) ||
  !userText?.includes('视频最后以这个为最终版本') ||
  !userText?.includes('所有的语义按照原视频进行文字转换') ||
  !userText?.includes('抓紧出正片')
) {
  throw new Error('指定授权行不是本期最终源、实录语义、三条身份修正与正片指令的真实用户消息');
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

fs.mkdirSync(absolute(CONTROL), {recursive: true});
fs.writeFileSync(absolute(AUTHORIZATION_EVENT), `${rawEvent}\n`);
writeJson(AUTHORIZATION, {
  schema: 'lanzhou-ai-salon-formal-authorization/v2',
  evidence: {
    ...reference(AUTHORIZATION_EVENT),
    source: rollout,
    sourceLine,
  },
  messageId: MESSAGE_ID,
  turnId: TURN_ID,
  userTextSha256: hashBytes(userText),
  correctedIdentities: IDENTITIES,
  finalSource: {path: SOURCE, sha256: SOURCE_SHA, frameCount: FRAME_COUNT, fps: FPS},
  spokenAuthority: 'recorded-audio',
  semanticTextPolicy: 'convert-from-final-source-recording',
  formalCandidateAuthorized: true,
  intermediatePreviewRequired: false,
  fullWatchConfirmed: false,
  publishAuthorized: false,
  scope:
    '以用户指定的新 MOV 为最终源，完整保留 18413 帧；字幕与语义包装以该源实录为唯一正文；应用三条最终身份；直接输出本地正式候选。',
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

const visualPlanPath = `${BASE}/06_剪辑工程/visual-plan.v2.json`;
const sfxPath = `${BASE}/06_剪辑工程/sfx-cues.v2.json`;
const visualPlan = readJson(visualPlanPath);
const sfx = readJson(sfxPath);
if (
  visualPlan.videoId !== 'LANZHOU_AI_SALON_20260920_FINAL_R2' ||
  visualPlan.schemaVersion !== 4 ||
  !Array.isArray(visualPlan.layers) ||
  !Array.isArray(sfx.cues)
) {
  throw new Error('V8 视觉计划或音效点位表尚未稳定');
}

const job = {
  schemaVersion: 1,
  jobId: '20260920-lanzhou-ai-salon-v8-r2-formal',
  videoId: 'LANZHOU_AI_SALON_20260920_FINAL_R2',
  title: '兰州AI实践者共创沙龙第一期',
  purpose:
    '以用户指定的 10分13秒最终源完整输出正式候选；保持原始语序与 18413 帧，以实录音频生成中英字幕，应用七位嘉宾介绍卡、六张用户图片和 V8 语义动效与音效。',
  productionState: 'ready-for-production',
  productionEligible: true,
  productionProfile: {id: 'v8-semantic-continuity-sfx', version: 'V8'},
  contentApproval: {
    userScriptApproved: true,
    evidence:
      '用户指定新 MOV 为最终版本，要求全部语义按原视频转成文字，确认黄鹏飞、葛永鹏、韩志鑫三条身份，并要求抓紧出正片。',
  },
  experiment: {
    id: 'v8-semantic-continuity-sfx',
    status: 'candidate-preview-required',
    userPreviewApproved: false,
    formalCandidateAuthorized: true,
    revisionReason: '用户直接指定最终源并授权输出正式候选；完整观看与发布仍待后续确认。',
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
    sfxCueSheet: sfxPath,
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
      `${CONTROL}/formal-adapter.r2.mjs`,
      `${CONTROL}/build-formal-binding.r2.mjs`,
      MANIFEST,
      ...Object.values(expectedDirectorArtifacts),
      'remotion/src/salon-20260920-r2/Root.tsx',
      'remotion/src/salon-20260920-r2/SalonHighlightR2.tsx',
      'remotion/src/salon-20260920-r2/index.ts',
      'remotion/src/salon-20260920-r2/index.tsx',
      'workflow/active-production-profile.v1.json',
      'assets/sfx/koubo-sfx-v8/manifest.json',
      ...SCOPED_DIRECT_EXPORT_GATE_FILES,
    ],
  },
  remotion: {
    root: 'remotion',
    entry: 'src/salon-20260920-r2/index.tsx',
    publicDir: 'remotion/public-salon-20260920',
    compositionWithSfx: 'LanzhouAISalon20260920R2-WithSfx',
    compositionWithoutSfx: 'LanzhouAISalon20260920R2-NoSfx',
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
    outputDirectory: `${BASE}/07_预览与质检/正式R2/frames`,
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
    rawOutput: `${BASE}/08_正式成片/兰州AI实践者共创沙龙第一期_R2_正式渲染原始.mp4`,
    finalOutput: `${BASE}/08_正式成片/兰州AI实践者共创沙龙第一期_V8_R2_1080P_正式候选.mp4`,
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
    directory: 'work/production-cache/lanzhou-ai-salon-v8-r2',
    reuseOnlyOnExactFingerprint: true,
  },
  reports: {
    runManifest: `${BASE}/07_预览与质检/正式R2/run-manifest.json`,
    timingReport: `${BASE}/07_预览与质检/正式R2/timing.json`,
    regressionReport: `${BASE}/07_预览与质检/正式R2/regression.json`,
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
    state: 'scoped-formal-authorized-r2',
    revisionId: 'lanzhou-ai-salon-v8-r2',
    formalEnabled: true,
    userPreviewApproved: false,
    scopedDirectExport: {path: MANIFEST, sha256: '0'.repeat(64)},
  },
  blockers: [],
};

writeJson(JOB, job);
const manifest = {
  schema: 'lanzhou-ai-salon-formal-manifest/v2',
  route: ROUTE,
  episodeId: job.videoId,
  jobId: job.jobId,
  jobPath: JOB,
  source: {path: SOURCE, sha256: SOURCE_SHA, frameCount: FRAME_COUNT, fps: FPS},
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
  binding: collectLanzhouAISalonFormalR2Bindings({projectRoot: root, job}),
};
writeJson(MANIFEST, manifest);
const pin = hashFile(MANIFEST);
job.productionGate.scopedDirectExport.sha256 = pin;
writeJson(JOB, job);

const corePath = absolute('tools/scoped-direct-export-core.mjs');
const coreSource = fs.readFileSync(corePath, 'utf8');
const replacement = `export const LANZHOU_AI_SALON_FORMAL_R2_PIN = '${pin}';`;
const updatedCore = coreSource.replace(
  /export const LANZHOU_AI_SALON_FORMAL_R2_PIN = '[a-f0-9]*';/u,
  replacement,
);
if (updatedCore === coreSource) {
  throw new Error('tools/scoped-direct-export-core.mjs 缺少本期固定摘要位置');
}
fs.writeFileSync(corePath, updatedCore);

console.log(
  JSON.stringify({
    status: 'lanzhou-ai-salon-formal-r2-bound',
    job: JOB,
    manifest: MANIFEST,
    pin,
    authorizationSourceLine: sourceLine,
    messageId: MESSAGE_ID,
    frameCount: FRAME_COUNT,
    durationSeconds: DURATION_SECONDS,
    formalCandidateAuthorized: true,
    fullWatchConfirmed: false,
    publishAuthorized: false,
  }),
);
