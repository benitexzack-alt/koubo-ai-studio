import {spawnSync} from 'node:child_process';
import {mkdirSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const testRootRelative = `work/.v8-contract-test-${process.pid}`;
const testRoot = path.join(projectRoot, testRootRelative);
const clone = (value) => JSON.parse(JSON.stringify(value));
const audioFiles = [
  'remotion/public/audio/koubo-sfx-v1/section-air.wav',
  'remotion/public/audio/koubo-sfx-v1/card-reveal.wav',
  'remotion/public/audio/koubo-sfx-v1/node-connect.wav',
  'remotion/public/audio/koubo-sfx-v1/camera-shutter.wav',
  'remotion/public/audio/koubo-sfx-v2/number-affirmation.wav',
  'remotion/public/audio/koubo-sfx-v2/keyword-select.wav',
];

const writeJson = (name, value) => {
  const relativePath = `${testRootRelative}/${name}`;
  writeFileSync(
    path.join(projectRoot, relativePath),
    `${JSON.stringify(value, null, 2)}\n`,
    'utf8',
  );
  return relativePath;
};
const run = (script, argument) =>
  spawnSync(process.execPath, [script, argument], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
const output = (result) => `${result.stdout ?? ''}${result.stderr ?? ''}`;
const assertPasses = (label, result) => {
  if (result.status !== 0) throw new Error(`${label}应通过：\n${output(result)}`);
};
const assertFailsWith = (label, result, expected) => {
  if (result.status === 0) throw new Error(`${label}应失败，但通过了。`);
  if (!output(result).includes(expected)) {
    throw new Error(`${label}缺少错误“${expected}”：\n${output(result)}`);
  }
};

const layers = Array.from({length: 6}, (_, index) => {
  const start = index * 5;
  const family = ['statement', 'process', 'evidence'][index % 3];
  return {
    id: `layer-${index + 1}`,
    start,
    end: start + 4.5,
    spokenLine: `测试原句${index + 1}`,
    purpose: 'semantic-emphasis',
    kind: 'transparent-semantic-information',
    variant: family,
    titleOwner: true,
    overlapGroup: `group-${index + 1}`,
    zone: 'left-safe',
    background: 'talk',
    asset: {
      sourceType: 'remotion-component',
      source: `V8/${family}`,
    },
    assetDecision: {
      class: 'remotion-information',
      producer: 'codex-remotion',
      requestId: null,
      fallback: 'speaker-plus-information',
    },
    visualEvent: {
      id: `event-${index + 1}`,
      enterAt: start + 0.1,
      primary: true,
    },
    sound: {
      policy: 'required',
      role: `role-${index + 1}`,
      cueId: `cue-${index + 1}`,
      offsetFrames: 0,
      maxSyncErrorFrames: 2,
    },
    params: {component: family},
    presentation: {
      renderMode: 'speaker-overlay',
      semanticFamily: family,
      coverageRatio: 0.34,
      progressiveReveal: true,
    },
    checks: {
      avoidFace: true,
      avoidHands: true,
      avoidSubtitle: true,
      needsFrameReview: true,
      continuousReviewIntervalSeconds: 0.5,
      reviewAt: start + 2,
    },
  };
});

const basePlan = {
  schemaVersion: 4,
  experiment: {
    id: 'v8-semantic-continuity-sfx',
    status: 'candidate-preview-required',
  },
  videoId: 'V8_CONTRACT_TEST',
  videoTitle: 'V8合同测试',
  sourceVideo: 'source/test.mp4',
  baselineId: 'koubo-formal-16x9-v1',
  styleReferenceIds: ['ref-a', 'ref-b'],
  target: {aspect: '16:9', width: 1920, height: 1080, fps: 30, platform: 'douyin'},
  previewCoverage: [
    'hook',
    'complex-overlay',
    'cta',
    'speaker-overlay',
    'media-fullscreen',
    'progressive-process',
    'source-evidence',
    'hero-emphasis',
    'sfx-ab',
    'full-screen-asset',
  ],
  layers,
};

const baseCueSheet = {
  schemaVersion: 3,
  experimentId: 'v8-semantic-continuity-sfx',
  videoId: basePlan.videoId,
  cues: layers.map((layer, index) => ({
    id: layer.sound.cueId,
    visualEventId: layer.visualEvent.id,
    role: layer.sound.role,
    start: layer.visualEvent.enterAt,
    end: layer.visualEvent.enterAt + 0.6,
    source: audioFiles[index],
    volume: 0.3,
    userAudibilityConfirmed: false,
  })),
};

const baseJob = {
  schemaVersion: 1,
  videoId: basePlan.videoId,
  experiment: {
    id: 'v8-semantic-continuity-sfx',
    status: 'candidate-preview-required',
    userPreviewApproved: false,
    previewAuditionRoles: layers.map((layer) => layer.sound.role),
  },
  inputs: {visualPlan: '', sfxCueSheet: ''},
  remotion: {fps: 30},
  preview: {
    ranges: [{id: 'continuous-v8', startSeconds: 0, endSeconds: 30}],
    renderWithoutSfxComparison: true,
  },
  formal: {enabled: false},
};

const writeCase = (name, plan, cueSheet, job) => {
  const planPath = writeJson(`${name}.visual-plan.json`, plan);
  const cuePath = writeJson(`${name}.sfx.json`, cueSheet);
  const materialized = clone(job);
  materialized.inputs.visualPlan = planPath;
  materialized.inputs.sfxCueSheet = cuePath;
  return {
    planPath,
    jobPath: writeJson(`${name}.production.json`, materialized),
  };
};

mkdirSync(testRoot, {recursive: true});
try {
  const valid = writeCase('valid', basePlan, baseCueSheet, baseJob);
  assertPasses('合法V8视觉方案', run('tools/validate-visual-plan.mjs', valid.planPath));
  assertPasses('合法V8生产合同', run('tools/validate-v8-production-contract.mjs', valid.jobPath));

  const opaque = clone(basePlan);
  opaque.layers[0].background = 'opaque';
  const opaqueCase = writeCase('opaque', opaque, baseCueSheet, baseJob);
  assertFailsWith(
    '全屏说明页',
    run('tools/validate-v8-production-contract.mjs', opaqueCase.jobPath),
    '禁止全屏或不透明背景',
  );

  const callDemo = clone(basePlan);
  callDemo.layers[0].params.component = 'call-demo';
  const callDemoCase = writeCase('call-demo', callDemo, baseCueSheet, baseJob);
  assertFailsWith(
    '旧call-demo',
    run('tools/validate-v8-production-contract.mjs', callDemoCase.jobPath),
    '仍使用被退回',
  );

  const oversized = clone(basePlan);
  oversized.layers[0].presentation.coverageRatio = 0.6;
  const oversizedCase = writeCase('oversized', oversized, baseCueSheet, baseJob);
  assertFailsWith(
    '覆盖过大',
    run('tools/validate-v8-production-contract.mjs', oversizedCase.jobPath),
    '超过 42%',
  );

  const quiet = clone(baseCueSheet);
  quiet.cues[0].volume = 0.12;
  const quietCase = writeCase('quiet', basePlan, quiet, baseJob);
  assertFailsWith(
    '旧低音量',
    run('tools/validate-v8-production-contract.mjs', quietCase.jobPath),
    '0.20–0.55',
  );

  const repeated = clone(baseCueSheet);
  repeated.cues[1].source = repeated.cues[0].source;
  const repeatedCase = writeCase('repeated-sfx', basePlan, repeated, baseJob);
  assertFailsWith(
    '短时重复音效',
    run('tools/validate-v8-production-contract.mjs', repeatedCase.jobPath),
    '连续音效不得复用',
  );

  const approvedPlan = clone(basePlan);
  approvedPlan.experiment.status = 'candidate-preview-approved';
  const approvedCues = clone(baseCueSheet);
  approvedCues.cues.forEach((cue) => {
    cue.userAudibilityConfirmed = true;
  });
  const approvedJob = clone(baseJob);
  approvedJob.experiment.status = 'candidate-preview-approved';
  approvedJob.experiment.userPreviewApproved = true;
  approvedJob.experiment.userPreviewApprovedAt = '2026-08-10T04:15:39Z';
  approvedJob.formal.enabled = true;
  const approvedCase = writeCase(
    'preview-approved',
    approvedPlan,
    approvedCues,
    approvedJob,
  );
  assertPasses(
    '用户预览通过后的视觉方案',
    run('tools/validate-visual-plan.mjs', approvedCase.planPath),
  );
  assertPasses(
    '用户预览通过后的正式片解锁',
    run('tools/validate-v8-production-contract.mjs', approvedCase.jobPath),
  );

  const unlocked = clone(baseJob);
  unlocked.formal.enabled = true;
  const unlockedCase = writeCase('unlocked-formal', basePlan, baseCueSheet, unlocked);
  assertFailsWith(
    '未试听先正式渲染',
    run('tools/validate-v8-production-contract.mjs', unlockedCase.jobPath),
    'formal.enabled=false',
  );

  console.log('V8生产合同回归通过：9/9。');
} finally {
  rmSync(testRoot, {recursive: true, force: true});
}
