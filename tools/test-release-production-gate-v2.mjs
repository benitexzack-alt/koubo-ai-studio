#!/usr/bin/env node

import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import {dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {findRetiredGeneratedStyleContentHashes} from './generated-style-policy.mjs';
import {
  RELEASE_PRODUCTION_GATE_SCHEMA,
  RELEASE_RISK_FRAME_RECEIPT_SCHEMA,
  validateReleaseRiskFrameReceiptV2,
  validateReleaseProductionGateV2,
} from './release-production-gate-v2.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(HERE, '..');
const validator = resolve(projectRoot, 'tools/validate-release.mjs');
const accidentJob = resolve(projectRoot, 'workflow/jobs/20260823_wechat_geo_aao_v80.production.json');
const rejectedOutput = resolve(
  projectRoot,
  'work/production-runs/20260823-wechat-geo-aao-v80/rejected-output/微信AI_GEO_AAO_16x9_V80_已否决_禁止发布.mp4',
);
const testRoot = mkdtempSync(resolve(projectRoot, 'edit/.release-production-gate-test-'));
const binRoot = join(testRoot, 'bin');
const mediaMarker = join(testRoot, 'media-command-called.txt');
const sha256File = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const relativeProject = (path) => relative(projectRoot, path).split('\\').join('/');
const writeJson = (name, value) => {
  const path = join(testRoot, `${name}.json`);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
  return path;
};
const snapshot = (paths) => Object.fromEntries(paths.map((path) => {
  if (!existsSync(path)) return [path, null];
  const stat = statSync(path);
  return [path, {bytes: stat.size, sha256: stat.isFile() ? sha256File(path) : null}];
}));
const rawFrameSha256 = (path, atSeconds) => {
  const result = spawnSync('ffmpeg', [
    '-v', 'error', '-ss', Number(atSeconds).toFixed(6), '-i', path,
    '-map', '0:v:0', '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1',
  ], {encoding: null, maxBuffer: 64 * 1024 * 1024});
  assert.equal(result.status, 0, String(result.stderr));
  return createHash('sha256').update(result.stdout).digest('hex');
};

mkdirSync(binRoot, {recursive: true});
for (const command of ['ffmpeg', 'ffprobe']) {
  const path = join(binRoot, command);
  writeFileSync(path, `#!/bin/sh\nprintf '%s\\n' '${command}' >> '${mediaMarker}'\nexit 97\n`);
  chmodSync(path, 0o755);
}

const tests = [];
const test = (name, fn) => tests.push({name, fn});

test('旧 release 缺 v2 生产门，在任何媒体命令前拒绝', () => {
  const releasePath = writeJson('legacy-release', {
    schemaVersion: 1,
    releaseId: 'legacy-history-only',
    status: 'verified',
  });
  const result = spawnSync(process.execPath, [validator, releasePath], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: {...process.env, PATH: binRoot},
  });
  assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
  assert.match(`${result.stdout}\n${result.stderr}`, /RPG2_GATE_REQUIRED/u);
  assert.equal(existsSync(mediaMarker), false, '冻结门失败前不得调用 ffmpeg/ffprobe');
});

test('事故 job 在解码、报告或输出写入前冻结', () => {
  const controlled = [
    accidentJob,
    resolve(projectRoot, 'work/production-runs/20260823-wechat-geo-aao-v80/run-manifest.json'),
    resolve(projectRoot, 'work/production-runs/20260823-wechat-geo-aao-v80/timing-report.json'),
    rejectedOutput,
    resolve(projectRoot, 'outputs/微信AI_GEO_AAO_16x9_V80_有音效_候选成片_v1.mp4'),
  ];
  const before = snapshot(controlled);
  const releasePath = writeJson('accident-release', {
    schemaVersion: 1,
    releaseId: 'accident-must-stay-blocked',
    status: 'verified',
    productionGate: {
      schema: RELEASE_PRODUCTION_GATE_SCHEMA,
      job: {path: relativeProject(accidentJob), sha256: sha256File(accidentJob)},
    },
  });
  const result = spawnSync(process.execPath, [validator, releasePath], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: {...process.env, PATH: binRoot},
  });
  assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
  assert.match(`${result.stdout}\n${result.stderr}`, /DPG2_FROZEN_JOB_REVISION/u);
  assert.deepEqual(snapshot(controlled), before, '冻结失败后受控 job/报告/输出字节不得变化');
  assert.equal(existsSync(mediaMarker), false, '事故修订冻结前不得调用 ffmpeg/ffprobe');
});

test('项目外 release 即使内容完整也拒绝', () => {
  const result = validateReleaseProductionGateV2({
    projectRoot,
    releasePath: '/private/tmp/not-a-controlled-release.json',
    release: {productionGate: {schema: RELEASE_PRODUCTION_GATE_SCHEMA}},
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'RPG2_PROJECT_PATH_OUTSIDE');
});

test('含 generatedVideoPlan 的发布在媒体命令前保持总冻结', () => {
  const generatedJobPath = writeJson('generated-video-release-job', {
    schemaVersion: 1,
    jobId: 'generated-video-release-must-stay-frozen',
    videoId: 'generated-video-release-must-stay-frozen',
    inputs: {generatedVideoPlan: 'edit/generated-video/not-trusted/plan.json'},
  });
  const releasePath = writeJson('generated-video-release', {
    schemaVersion: 1,
    releaseId: 'generated-video-release-must-stay-frozen',
    productionGate: {
      schema: RELEASE_PRODUCTION_GATE_SCHEMA,
      job: {path: relativeProject(generatedJobPath), sha256: sha256File(generatedJobPath)},
    },
  });

  const result = validateReleaseProductionGateV2({projectRoot, releasePath});

  assert.equal(result.ok, false);
  assert.equal(result.code, 'RPG2_GENERATED_VIDEO_RELEASE_FROZEN');
  assert.equal(existsSync(mediaMarker), false, 'generated-video 总冻结前不得调用媒体命令');
});

test('已否决完整成片 SHA 不能因改名绕过退役门', () => {
  assert.equal(sha256File(rejectedOutput), '3ba5cef4e0c5ae26e2f70d27c8799cea5d736498d85dcbd00dba2050125e5488');
  const hits = findRetiredGeneratedStyleContentHashes(
    {formalOutput: relativeProject(rejectedOutput)},
    {projectRoot, documentPaths: [rejectedOutput]},
  );
  assert.ok(hits.some((hit) => hit.sha256 === '3ba5cef4e0c5ae26e2f70d27c8799cea5d736498d85dcbd00dba2050125e5488'));
});

test('风险帧必须是最终MP4对应时刻的实际解码像素', () => {
  const videoPath = join(testRoot, 'risk-source.mp4');
  const framePath = join(testRoot, 'risk-frame-0p5.png');
  const videoResult = spawnSync('ffmpeg', [
    '-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=1920x1080:rate=30',
    '-t', '1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-an', videoPath,
  ], {encoding: 'utf8'});
  assert.equal(videoResult.status, 0, videoResult.stderr);
  const frameResult = spawnSync('ffmpeg', [
    '-v', 'error', '-y', '-ss', '0.500000', '-i', videoPath, '-frames:v', '1', framePath,
  ], {encoding: 'utf8'});
  assert.equal(frameResult.status, 0, frameResult.stderr);
  const pixelSha256 = rawFrameSha256(videoPath, 0.5);
  const receiptPath = writeJson('risk-frame-receipt', {
    schema: RELEASE_RISK_FRAME_RECEIPT_SCHEMA,
    evidenceScope: 'real-final-output',
    sourceVideo: {
      path: relativeProject(videoPath),
      sha256: sha256File(videoPath),
      bytes: statSync(videoPath).size,
      fps: 30,
    },
    frames: [{
      path: relativeProject(framePath),
      sha256: sha256File(framePath),
      sourceVideoSha256: sha256File(videoPath),
      atSeconds: 0.5,
      frameIndex: 15,
      pixelSha256,
    }],
  });
  const result = validateReleaseRiskFrameReceiptV2({
    projectRoot,
    receiptReference: {path: relativeProject(receiptPath), sha256: sha256File(receiptPath)},
    formalOutputReference: {
      path: relativeProject(videoPath),
      sha256: sha256File(videoPath),
      bytes: statSync(videoPath).size,
    },
    reviewFrames: [0.5],
  });
  assert.equal(result.body.sourceVideo.sha256, sha256File(videoPath));

  const invalidFrame = join(testRoot, 'unrelated-risk-frame.png');
  const invalidResult = spawnSync('ffmpeg', [
    '-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=red:size=1920x1080', '-frames:v', '1', invalidFrame,
  ], {encoding: 'utf8'});
  assert.equal(invalidResult.status, 0, invalidResult.stderr);
  const tampered = JSON.parse(readFileSync(receiptPath, 'utf8'));
  tampered.frames[0].path = relativeProject(invalidFrame);
  tampered.frames[0].sha256 = sha256File(invalidFrame);
  const tamperedPath = writeJson('risk-frame-receipt-tampered', tampered);
  assert.throws(
    () => validateReleaseRiskFrameReceiptV2({
      projectRoot,
      receiptReference: {path: relativeProject(tamperedPath), sha256: sha256File(tamperedPath)},
      formalOutputReference: {
        path: relativeProject(videoPath),
        sha256: sha256File(videoPath),
        bytes: statSync(videoPath).size,
      },
      reviewFrames: [0.5],
    }),
    (error) => error?.code === 'RPG2_RISK_FRAME_PIXEL_MISMATCH',
  );
});

let passed = 0;
try {
  for (const item of tests) {
    await item.fn();
    passed += 1;
    console.log(`PASS ${item.name}`);
  }
  console.log(`RESULT ${passed}/${tests.length} passed; skipped=0; networkCalls=0`);
} finally {
  rmSync(testRoot, {recursive: true, force: true});
}
