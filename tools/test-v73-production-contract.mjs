import {spawnSync} from 'node:child_process';
import {mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const testRootRelative = `work/.v73-contract-test-${process.pid}`;
const testRoot = resolve(projectRoot, testRootRelative);
const audioSource = 'remotion/public/audio/koubo-sfx-v2/card-slide.wav';

const writeJson = (name, value) => {
  const relativePath = `${testRootRelative}/${name}`;
  writeFileSync(
    resolve(projectRoot, relativePath),
    `${JSON.stringify(value, null, 2)}\n`,
    'utf8',
  );
  return relativePath;
};

const clone = (value) => JSON.parse(JSON.stringify(value));
const run = (script, argument) =>
  spawnSync(process.execPath, [script, argument], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
const output = (result) => `${result.stdout ?? ''}${result.stderr ?? ''}`;
const assertPasses = (label, result) => {
  if (result.status !== 0) {
    throw new Error(`${label}应通过，但失败：\n${output(result)}`);
  }
};
const assertFailsWith = (label, result, expectedText) => {
  if (result.status === 0) {
    throw new Error(`${label}应失败，但通过了。`);
  }
  if (!output(result).includes(expectedText)) {
    throw new Error(
      `${label}失败信息不包含“${expectedText}”：\n${output(result)}`,
    );
  }
};

const basePlan = {
  schemaVersion: 3,
  experiment: {
    id: 'v73-media-sfx-speed',
    status: 'ready-for-next-video-validation',
  },
  videoId: 'V73_CONTRACT_TEST',
  videoTitle: 'V7.3合同测试',
  sourceVideo: 'source/test.mp4',
  baselineId: 'koubo-formal-16x9-v1',
  styleReferenceIds: [],
  target: {
    aspect: '16:9',
    width: 1920,
    height: 1080,
    fps: 30,
    platform: 'douyin',
  },
  previewCoverage: [
    'hook',
    'complex-overlay',
    'full-screen-asset',
    'cta',
    'all-new-sfx-roles',
  ],
  layers: [
    {
      id: 'layer-001',
      start: 0,
      end: 5,
      spokenLine: '这是测试口播原句。',
      purpose: 'hook',
      kind: 'semantic-motion-card',
      variant: 'statement',
      titleOwner: true,
      overlapGroup: 'hook',
      zone: 'top-left',
      asset: {
        sourceType: 'remotion-component',
        source: 'TestCard',
      },
      assetDecision: {
        class: 'remotion-information',
        producer: 'codex-remotion',
        requestId: null,
        fallback: 'speaker-plus-information',
      },
      visualEvent: {
        id: 'visual-event-001',
        enterAt: 1,
        primary: true,
      },
      sound: {
        policy: 'required',
        role: 'soft-card-pop',
        cueId: 'sfx-001',
        offsetFrames: 0,
        maxSyncErrorFrames: 2,
      },
      checks: {
        needsFrameReview: true,
        reviewAt: 2,
      },
    },
  ],
  deferred: [],
};

const baseCueSheet = {
  schemaVersion: 2,
  videoId: 'V73_CONTRACT_TEST',
  cues: [
    {
      id: 'sfx-001',
      visualEventId: 'visual-event-001',
      role: 'soft-card-pop',
      start: 1,
      end: 1.5,
      source: audioSource,
      volume: 0.12,
    },
  ],
};

const baseJob = {
  schemaVersion: 1,
  jobId: 'v73-contract-test',
  videoId: 'V73_CONTRACT_TEST',
  title: 'V7.3合同测试',
  productionState: 'ready-for-production',
  experiment: {
    id: 'v73-media-sfx-speed',
    status: 'ready-for-next-video-validation',
    userMediaRequest: null,
    fullLengthLowResPreview: {
      enabled: false,
      reason: null,
    },
    previewAuditionRoles: ['soft-card-pop'],
  },
  inputs: {
    visualPlan: '',
    sfxCueSheet: '',
  },
  remotion: {
    fps: 30,
  },
  preview: {
    ranges: [
      {
        id: 'hook-and-sfx',
        startSeconds: 0,
        endSeconds: 3,
      },
    ],
  },
  reports: {
    timingReport: `${testRootRelative}/timing-report.json`,
  },
};

const writeCase = (name, plan, cueSheet, job) => {
  const planPath = writeJson(`${name}.visual-plan.json`, plan);
  const cuePath = writeJson(`${name}.sfx-cues.json`, cueSheet);
  const materializedJob = clone(job);
  materializedJob.inputs.visualPlan = planPath;
  materializedJob.inputs.sfxCueSheet = cuePath;
  return writeJson(`${name}.production.json`, materializedJob);
};

mkdirSync(testRoot, {recursive: true});

try {
  const validJob = writeCase('valid', basePlan, baseCueSheet, baseJob);
  assertPasses(
    '合法V7.3视觉方案',
    run('tools/validate-visual-plan.mjs', `${testRootRelative}/valid.visual-plan.json`),
  );
  assertPasses(
    '合法V7.3生产合同',
    run('tools/validate-v73-production-contract.mjs', validJob),
  );

  const missingCueSheet = clone(baseCueSheet);
  missingCueSheet.cues = [];
  const missingCueJob = writeCase(
    'missing-cue',
    basePlan,
    missingCueSheet,
    baseJob,
  );
  assertFailsWith(
    '主卡漏配音效',
    run('tools/validate-v73-production-contract.mjs', missingCueJob),
    '绑定的音效点不存在',
  );

  const delayedCueSheet = clone(baseCueSheet);
  delayedCueSheet.cues[0].start = 1.2;
  const delayedCueJob = writeCase(
    'delayed-cue',
    basePlan,
    delayedCueSheet,
    baseJob,
  );
  assertFailsWith(
    '音效同步偏差超标',
    run('tools/validate-v73-production-contract.mjs', delayedCueJob),
    '超过允许',
  );

  const wrongProducerPlan = clone(basePlan);
  wrongProducerPlan.layers[0].assetDecision = {
    class: 'generated-video',
    producer: 'codex-remotion',
    requestId: 'S01',
    fallback: 'speaker-plus-information',
  };
  wrongProducerPlan.layers[0].asset.source = audioSource;
  const wrongProducerJob = writeCase(
    'wrong-producer',
    wrongProducerPlan,
    baseCueSheet,
    baseJob,
  );
  assertFailsWith(
    '叙事视频错交Remotion',
    run('tools/validate-v73-production-contract.mjs', wrongProducerJob),
    '不得交给 Remotion 制作',
  );

  const missingTimingJob = clone(baseJob);
  missingTimingJob.reports.timingReport = '';
  const missingTimingPath = writeCase(
    'missing-timing',
    basePlan,
    baseCueSheet,
    missingTimingJob,
  );
  assertFailsWith(
    '缺失计时报告路径',
    run('tools/validate-v73-production-contract.mjs', missingTimingPath),
    'reports.timingReport',
  );

  const uncoveredRoleJob = clone(baseJob);
  uncoveredRoleJob.preview.ranges = [
    {
      id: 'wrong-range',
      startSeconds: 3,
      endSeconds: 4,
    },
  ];
  const uncoveredRolePath = writeCase(
    'uncovered-role',
    basePlan,
    baseCueSheet,
    uncoveredRoleJob,
  );
  assertFailsWith(
    '新音色未进入试听预览',
    run('tools/validate-v73-production-contract.mjs', uncoveredRolePath),
    '未被代表性预览覆盖',
  );

  const evasionPlan = clone(basePlan);
  evasionPlan.layers[0].visualEvent.primary = false;
  evasionPlan.layers[0].sound.policy = 'optional';
  const evasionJobPath = writeCase(
    'primary-evasion',
    evasionPlan,
    baseCueSheet,
    baseJob,
  );
  assertFailsWith(
    '主卡不得通过primary=false逃避音效',
    run('tools/validate-v73-production-contract.mjs', evasionJobPath),
    '不得标记为非主事件逃避音效',
  );

  const runnerPlan = clone(basePlan);
  runnerPlan.layers = Array.from({length: 8}, (_, index) => {
    const layer = clone(basePlan.layers[0]);
    const start = index * 2;
    layer.id = `runner-layer-${index + 1}`;
    layer.start = start;
    layer.end = start + 1.5;
    layer.overlapGroup = `runner-group-${index + 1}`;
    layer.visualEvent.id = `runner-event-${index + 1}`;
    layer.visualEvent.enterAt = start + 0.1;
    layer.sound.cueId = `runner-sfx-${index + 1}`;
    layer.checks.reviewAt = start + 0.75;
    return layer;
  });
  const runnerCueSheet = clone(baseCueSheet);
  runnerCueSheet.cues = runnerPlan.layers.map((layer, index) => ({
    id: `runner-sfx-${index + 1}`,
    visualEventId: layer.visualEvent.id,
    role: 'soft-card-pop',
    start: layer.visualEvent.enterAt,
    end: layer.visualEvent.enterAt + 0.5,
    source: audioSource,
    volume: 0.12,
  }));
  const lockedJob = JSON.parse(
    readFileSync(
      resolve(
        projectRoot,
        'workflow/jobs/20260731_lanzhou_opc_v72.production.json',
      ),
      'utf8',
    ),
  );
  lockedJob.jobId = 'v73-runner-integration-test';
  lockedJob.videoId = basePlan.videoId;
  lockedJob.title = 'V7.3生产器集成测试';
  lockedJob.experiment = clone(baseJob.experiment);
  lockedJob.preview.ranges = [
    {
      id: 'all-test-events',
      startSeconds: 0,
      endSeconds: 16,
    },
  ];
  lockedJob.reports.timingReport = `${testRootRelative}/runner-timing-report.json`;
  const runnerJobPath = writeCase(
    'runner-integration',
    runnerPlan,
    runnerCueSheet,
    lockedJob,
  );
  const actualRunnerResult = spawnSync(
    process.execPath,
    [
      'tools/run-v72-production.mjs',
      runnerJobPath,
      'doctor',
      '--dry-run',
    ],
    {cwd: projectRoot, encoding: 'utf8'},
  );
  assertPasses('V7.3与生产器doctor集成', actualRunnerResult);
  const runnerBadCueSheet = clone(runnerCueSheet);
  runnerBadCueSheet.cues[0].start += 0.2;
  const runnerBadJobPath = writeCase(
    'runner-integration-bad-sync',
    runnerPlan,
    runnerBadCueSheet,
    lockedJob,
  );
  const badRunnerResult = spawnSync(
    process.execPath,
    [
      'tools/run-v72-production.mjs',
      runnerBadJobPath,
      'doctor',
      '--dry-run',
    ],
    {cwd: projectRoot, encoding: 'utf8'},
  );
  assertFailsWith(
    '生产器doctor必须调用V7.3合同门禁',
    badRunnerResult,
    'V7.3生产合同校验',
  );

  console.log('V7.3生产合同回归通过：9/9。');
} finally {
  rmSync(testRoot, {recursive: true, force: true});
}
