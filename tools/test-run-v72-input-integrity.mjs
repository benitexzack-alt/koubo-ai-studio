import {spawn, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const testRootRelative = `work/.v72-input-integrity-${process.pid}`;
const testRoot = path.resolve(projectRoot, testRootRelative);
const fakeKnowledgeBase = path.join(testRoot, 'fake-kb');
const taskId = `v72-integrity-${process.pid}`;
const contextRelative = `${taskId}/context.json`;
const runner = 'tools/run-v72-production.mjs';

const relative = (absolutePath) =>
  path.relative(projectRoot, absolutePath).split(path.sep).join('/');
const writeJson = (absolutePath, value) => {
  mkdirSync(path.dirname(absolutePath), {recursive: true});
  writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};
const combinedOutput = (result) => `${result.stdout ?? ''}${result.stderr ?? ''}`;
const assertFailsWith = (label, result, text) => {
  if (result.status === 0) throw new Error(`${label}应失败，但通过了。`);
  if (!combinedOutput(result).includes(text)) {
    throw new Error(`${label}未包含“${text}”：\n${combinedOutput(result)}`);
  }
};
const hash = (value) => createHash('sha256').update(value).digest('hex');

mkdirSync(testRoot, {recursive: true});

try {
  const profile = JSON.parse(
    readFileSync(
      path.join(projectRoot, 'workflow/active-production-profile.v1.json'),
      'utf8',
    ),
  );
  const baseline = JSON.parse(
    readFileSync(path.join(projectRoot, 'workflow/production-baseline.v1.json'), 'utf8'),
  );

  const sourcePath = path.join(testRoot, 'source.mp4');
  const sourceTargetPath = path.join(testRoot, 'source-target.mp4');
  const renderProxyPath = path.join(testRoot, 'render-proxy.mp4');
  const visualPlanPath = path.join(testRoot, 'visual-plan.json');
  const captionsPath = path.join(testRoot, 'captions.json');
  const cueSheetPath = path.join(testRoot, 'sfx-cues.json');
  const rawOutputPath = path.join(testRoot, 'formal-raw.mp4');
  const finalOutputPath = path.join(testRoot, 'formal-final.mp4');
  const runManifestPath = path.join(testRoot, 'reports', 'run-manifest.json');
  const jobPath = path.join(testRoot, 'integrity.production.json');

  const initialMedia = Buffer.alloc(64 * 1024 * 1024, 0x41);
  writeFileSync(sourcePath, initialMedia);
  writeFileSync(sourceTargetPath, initialMedia);
  writeFileSync(renderProxyPath, 'render-proxy', 'utf8');
  writeJson(visualPlanPath, {schemaVersion: 4, layers: []});
  writeJson(captionsPath, {schemaVersion: 1, captions: []});
  writeJson(cueSheetPath, {schemaVersion: 3, cues: []});
  writeFileSync(rawOutputPath, 'raw-output', 'utf8');
  writeFileSync(finalOutputPath, 'final-output', 'utf8');

  const job = {
    schemaVersion: 1,
    jobId: `v72-input-integrity-${process.pid}`,
    videoId: 'V72_INPUT_INTEGRITY_TEST',
    title: 'V7.2输入完整性测试',
    productionState: 'ready-for-production',
    productionProfile: {
      id: profile.profileId,
      version: profile.profileVersion,
    },
    experiment: {id: profile.requirements.experimentId},
    knowledgeContext: {taskId, contextPath: contextRelative},
    baseline: {
      path: 'workflow/production-baseline.v1.json',
      id: baseline.baselineId,
      revision: baseline.baselineRevision,
    },
    inputs: {
      source: relative(sourcePath),
      renderProxy: relative(renderProxyPath),
      visualPlan: relative(visualPlanPath),
      bilingualCaptions: relative(captionsPath),
      sfxCueSheet: relative(cueSheetPath),
      fingerprintPaths: [relative(sourcePath)],
    },
    remotion: {
      root: 'remotion',
      entry: 'src/index.ts',
      compositionWithSfx: 'IntegrityWithSfx',
      compositionWithoutSfx: 'IntegrityWithoutSfx',
      width: baseline.production.width,
      height: baseline.production.height,
      fps: baseline.production.fps,
      durationSeconds: 1,
      concurrency: 1,
    },
    preview: {
      output: relative(path.join(testRoot, 'preview.mp4')),
      renderWithoutSfxComparison: false,
      ranges: [{id: 'integrity', startSeconds: 0, endSeconds: 0.5}],
      scale: 0.25,
      crf: 28,
    },
    riskFrames: {outputDirectory: relative(path.join(testRoot, 'risk-frames'))},
    audioPreflight: {
      integratedLoudnessTargetLufs: -16,
      preferredTruePeakDbtp: -1.8,
      truePeakMaxDbtp: -1.5,
    },
    formal: {
      enabled: true,
      composition: 'with-sfx',
      rawOutput: relative(rawOutputPath),
      finalOutput: relative(finalOutputPath),
      crf: 18,
      pixelFormat: 'yuv420p',
      audioBitrate: '192k',
      loudness: {
        integratedLoudnessTargetLufs: -16,
        loudnessRangeTargetLu: 11,
        truePeakTargetDbtp: -2.2,
      },
    },
    cache: {enabled: false, directory: relative(path.join(testRoot, 'cache'))},
    reports: {
      runManifest: relative(runManifestPath),
      timingReport: relative(path.join(testRoot, 'reports', 'timing-report.json')),
      regressionReport: relative(path.join(testRoot, 'reports', 'regression-report.json')),
    },
  };
  writeJson(jobPath, job);

  const contextPath = path.join(fakeKnowledgeBase, '.opc-rag', 'tasks', contextRelative);
  writeJson(contextPath, {
    task: {id: taskId, important: true},
    project_route: {project_root: projectRoot},
    receipt_groups: {
      task_original_materials: {entries: [{resolved_path: jobPath}]},
    },
  });
  const fakeRagScript = path.join(
    fakeKnowledgeBase,
    '04_Claude Code日常操作',
    'scripts',
    'opc_rag.py',
  );
  mkdirSync(path.dirname(fakeRagScript), {recursive: true});
  writeFileSync(
    fakeRagScript,
    'import json\nprint(json.dumps({"status":"context-valid","gate":{"formal_execution_allowed":True}}))\n',
    'utf8',
  );

  const env = {...process.env, KOUBO_PERSONAL_KB: fakeKnowledgeBase};
  const run = (command) =>
    spawnSync(
      process.execPath,
      [runner, relative(jobPath), command, '--dry-run'],
      {cwd: projectRoot, env, encoding: 'utf8'},
    );

  const initialFingerprintResult = run('fingerprint');
  if (initialFingerprintResult.status !== 0) {
    throw new Error(`初始指纹应通过：\n${combinedOutput(initialFingerprintResult)}`);
  }
  const fingerprint = combinedOutput(initialFingerprintResult).match(
    /输入指纹：([a-f0-9]{64})/,
  )?.[1];
  if (!fingerprint) throw new Error('未能从输出解析初始指纹。');

  const successDirectory = path.join(path.dirname(runManifestPath), 'stage-success');
  const rawManifestPath = path.join(
    successDirectory,
    `${job.jobId}.formal-render.json`,
  );
  const audioManifestPath = path.join(
    successDirectory,
    `${job.jobId}.formal-audio.json`,
  );
  const staleManifest = (stageId, outputPath, contents) => ({
    schemaVersion: 1,
    status: 'passed',
    jobId: job.jobId,
    stageId,
    fingerprint,
    outputs: [
      {
        path: relative(outputPath),
        sizeBytes: Buffer.byteLength(contents),
        sha256: hash(contents),
      },
    ],
    createdAt: new Date().toISOString(),
  });
  writeJson(rawManifestPath, staleManifest('formal-render', rawOutputPath, 'raw-output'));
  writeJson(
    audioManifestPath,
    staleManifest('formal-audio', finalOutputPath, 'final-output'),
  );

  writeFileSync(sourcePath, Buffer.alloc(initialMedia.length, 0x42));
  assertFailsWith(
    '指纹变化后 formal-audio 禁止复用旧 raw',
    run('formal-audio'),
    '禁止复用 formal-render 旧产物',
  );
  assertFailsWith(
    '指纹变化后 qa 禁止复用旧 final',
    run('qa'),
    '禁止复用 formal-audio 旧产物',
  );

  writeFileSync(sourcePath, initialMedia);
  const renderReplacement = await new Promise((resolveResult, reject) => {
    const child = spawn(
      process.execPath,
      [runner, relative(jobPath), 'preview', '--dry-run'],
      {cwd: projectRoot, env, stdio: ['ignore', 'pipe', 'pipe']},
    );
    let stdout = '';
    let stderr = '';
    let replaced = false;
    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      if (!replaced && text.includes('[预演] 渲染')) {
        replaced = true;
        writeFileSync(sourcePath, Buffer.alloc(initialMedia.length, 0x43));
      }
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (status) => resolveResult({status, stdout, stderr, replaced}));
  });
  if (!renderReplacement.replaced) {
    throw new Error('渲染期间替换测试未触发替换动作。');
  }
  if (renderReplacement.status === 0) {
    throw new Error('Remotion渲染期间替换媒体应失败，但通过了。');
  }
  const replacementOutput = combinedOutput(renderReplacement);
  if (
    !replacementOutput.includes('在计算指纹时发生变化') &&
    !replacementOutput.includes('检测到输入已变化')
  ) {
    throw new Error(
      `Remotion渲染期间替换媒体未被指纹门禁拦截：\n${replacementOutput}`,
    );
  }

  rmSync(sourcePath, {force: true});
  symlinkSync(path.basename(sourceTargetPath), sourcePath);
  assertFailsWith(
    '指纹输入符号链接',
    run('fingerprint'),
    '禁止符号链接路径组件',
  );

  console.log('V7.2生产输入完整性回归通过：4/4。');
} finally {
  rmSync(testRoot, {recursive: true, force: true});
}
