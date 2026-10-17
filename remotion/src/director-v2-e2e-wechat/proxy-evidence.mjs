#!/usr/bin/env node

import {execFileSync, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const THIS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(THIS_DIR, '../../..');
const PREVIEW_DIR = resolve(
  REPO_ROOT,
  'work/director-v2-e2e/20260823-wechat-geo-aao-candidate-01/preview',
);

const SOURCE_PATH = '/Users/pc/Downloads/ScreenRecording_08-22-2026 15-36-53_1.MP4';
const DEFAULT_PROXY_PATH = resolve(PREVIEW_DIR, 'media/screen-full-0a992254-30fps.mp4');
const DEFAULT_RECEIPT_PATH = resolve(PREVIEW_DIR, 'proxy-receipt.json');
const DEFAULT_EVIDENCE_DIR = resolve(PREVIEW_DIR, 'proxy-validation');
const DIRECT_CLI_BLOCK_CODE = 'CANDIDATE_PROXY_DIRECT_CLI_BLOCKED';

const SOURCE_EXPECTED = {
  sha256: '0a992254195c91eefebec1f0a8d1f91263890ec2910169470ec377a02640937e',
  durationSeconds: 274.243333,
  width: 888,
  height: 1920,
  frameCount: 13399,
};

const PROXY_EXPECTED = {
  sha256: '8e8a58c4e1b267350d623cf078b2ac3f6df22217d968e3080e4f08c86ec18e6b',
  durationSeconds: 274.266667,
  width: 888,
  height: 1920,
  fps: '30/1',
  frameCount: 8228,
};

const RETIRED_TIMEBASE = {
  proxyPath: resolve(REPO_ROOT, 'remotion/public/media/wechat-geo-aao-20260823/screen-30fps.mp4'),
  proxySha256: 'c62481e12b095462748d216c71b45cf8d81fe495a25a52a28a9fe763d948ea6c',
  upstreamPath: resolve(
    REPO_ROOT,
    'source/20260823_wechat_geo_aao/copy_9AA2C74C-7E1B-40E7-8634-D6F4835F95CD.MOV',
  ),
  upstreamSha256: '3c1f91ad88577b951b20d341bace5893fbaaa3ba075b17360df1a09a8ce90355',
};

const POINTS = [
  {timeSeconds: 0, expectedObservation: 'screen-recording opening state'},
  {timeSeconds: 40, expectedObservation: 'pre-query WeChat navigation state'},
  {timeSeconds: 86, expectedObservation: 'restaurant query waiting state'},
  {timeSeconds: 90, expectedObservation: 'restaurant query waiting state'},
  {timeSeconds: 98, expectedObservation: 'map-oriented answer state'},
  {timeSeconds: 101, expectedObservation: 'answer-card state'},
  {timeSeconds: 124, expectedObservation: 'map state'},
  {timeSeconds: 132, expectedObservation: 'mini-program loading state'},
  {timeSeconds: 134, expectedObservation: 'service agreement and privacy policy'},
  {timeSeconds: 138, expectedObservation: 'service loading state'},
  {timeSeconds: 150, expectedObservation: 'post-loading mini-program state'},
  {timeSeconds: 189, expectedObservation: 'later full-recording state'},
  {timeSeconds: 220, expectedObservation: 'later full-recording state'},
  {timeSeconds: 270, expectedObservation: 'full-recording tail state'},
  {timeSeconds: 274.2, expectedObservation: 'full-recording terminal state'},
];

const GENERATION_ARGUMENTS = (proxyPath) => [
  '-hide_banner',
  '-y',
  '-i',
  SOURCE_PATH,
  '-map',
  '0:v:0',
  '-vf',
  'fps=30:round=up',
  '-c:v',
  'libx264',
  '-preset',
  'medium',
  '-crf',
  '18',
  '-pix_fmt',
  'yuv420p',
  '-video_track_timescale',
  '90000',
  '-an',
  '-movflags',
  '+faststart',
  proxyPath,
];

const fail = (message) => {
  throw new Error(message);
};

const assert = (condition, message) => {
  if (!condition) fail(message);
};

const nearlyEqual = (actual, expected, tolerance = 0.000001) =>
  Math.abs(Number(actual) - Number(expected)) <= tolerance;

const run = (command, args) =>
  execFileSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

const runWithStderr = (command, args) => {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    fail(`${command} failed with exit ${result.status}: ${result.stderr || result.stdout}`);
  }
  return `${result.stdout || ''}\n${result.stderr || ''}`;
};

const sha256 = (path) =>
  createHash('sha256').update(readFileSync(path)).digest('hex');

const sha256Text = (value) => createHash('sha256').update(value).digest('hex');

const probe = (path) =>
  JSON.parse(
    run('ffprobe', [
      '-v',
      'error',
      '-show_streams',
      '-show_format',
      '-of',
      'json',
      path,
    ]),
  );

const videoStream = (ffprobe) =>
  ffprobe.streams.find((stream) => stream.codec_type === 'video');

const sourceFrameInventory = () => {
  const parsed = JSON.parse(
    run('ffprobe', [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'packet=pts_time',
      '-of',
      'json',
      SOURCE_PATH,
    ]),
  );
  return parsed.packets
    .map((packet) => Number(packet.pts_time))
    .sort((a, b) => a - b)
    .map((timestampSeconds, index) => ({index, timestampSeconds}));
};

const locateSourceFrame = (inventory, timeSeconds) => {
  const exactOrNext = inventory.find((frame) => frame.timestampSeconds >= timeSeconds);
  return exactOrNext || inventory[inventory.length - 1];
};

const extractSourceFrame = (timeSeconds, outputPath) => {
  runWithStderr('ffmpeg', [
    '-v',
    'error',
    '-ss',
    String(timeSeconds),
    '-i',
    SOURCE_PATH,
    '-map',
    '0:v:0',
    '-frames:v',
    '1',
    '-y',
    outputPath,
  ]);
};

const extractProxyFrame = (proxyPath, frameIndex, outputPath) => {
  runWithStderr('ffmpeg', [
    '-v',
    'error',
    '-i',
    proxyPath,
    '-map',
    '0:v:0',
    '-vf',
    `select=eq(n\\,${frameIndex})`,
    '-fps_mode',
    'passthrough',
    '-frames:v',
    '1',
    '-y',
    outputPath,
  ]);
};

const compareFrames = (sourceImagePath, proxyImagePath) => {
  const ssimLog = runWithStderr('ffmpeg', [
    '-hide_banner',
    '-i',
    sourceImagePath,
    '-i',
    proxyImagePath,
    '-lavfi',
    'ssim',
    '-f',
    'null',
    '-',
  ]);
  const psnrLog = runWithStderr('ffmpeg', [
    '-hide_banner',
    '-i',
    sourceImagePath,
    '-i',
    proxyImagePath,
    '-lavfi',
    'psnr',
    '-f',
    'null',
    '-',
  ]);
  const ssimMatch = ssimLog.match(/All:([0-9.]+)/);
  const psnrMatch = psnrLog.match(/average:([0-9.]+)/);
  assert(ssimMatch, 'Unable to parse FFmpeg SSIM output');
  assert(psnrMatch, 'Unable to parse FFmpeg PSNR output');
  return {
    ssimAll: Number(ssimMatch[1]),
    psnrAverageDb: Number(psnrMatch[1]),
  };
};

const ocr = (imagePath) =>
  run('tesseract', [imagePath, 'stdout', '-l', 'chi_sim+eng', '--psm', '6']);

const normalizedOcr = (text) => text.replace(/[\s\p{P}\p{S}]/gu, '');

const assertPrivacyPolicyFrame = (imagePath) => {
  const text = ocr(imagePath);
  const normalized = normalizedOcr(text);
  assert(
    normalized.includes('服务协议与隐私政策'),
    '134-second OCR assertion failed: missing 服务协议与隐私政策',
  );
  assert(normalized.includes('同意'), '134-second OCR assertion failed: missing 同意');
  assert(
    !normalized.includes('兰州中心'),
    '134-second OCR assertion failed: retired chat screen text 兰州中心 was detected',
  );
  assert(
    !normalized.includes('小微AI'),
    '134-second OCR assertion failed: retired chat screen marker 小微AI was detected',
  );
  return {text, normalized};
};

const validateSourceProbe = (sourceProbe) => {
  const stream = videoStream(sourceProbe);
  assert(stream, 'Authoritative source has no video stream');
  assert(stream.width === SOURCE_EXPECTED.width, 'Authoritative source width mismatch');
  assert(stream.height === SOURCE_EXPECTED.height, 'Authoritative source height mismatch');
  assert(Number(stream.nb_frames) === SOURCE_EXPECTED.frameCount, 'Authoritative source frame-count mismatch');
  assert(
    nearlyEqual(stream.duration, SOURCE_EXPECTED.durationSeconds),
    'Authoritative source duration mismatch',
  );
  assert(
    nearlyEqual(sourceProbe.format.duration, SOURCE_EXPECTED.durationSeconds),
    'Authoritative source container duration mismatch',
  );
};

const validateProxyProbe = (proxyProbe) => {
  const stream = videoStream(proxyProbe);
  assert(stream, 'Controlled proxy has no video stream');
  assert(stream.width === PROXY_EXPECTED.width, 'Controlled proxy width mismatch');
  assert(stream.height === PROXY_EXPECTED.height, 'Controlled proxy height mismatch');
  assert(stream.r_frame_rate === PROXY_EXPECTED.fps, 'Controlled proxy r_frame_rate mismatch');
  assert(stream.avg_frame_rate === PROXY_EXPECTED.fps, 'Controlled proxy avg_frame_rate mismatch');
  assert(Number(stream.nb_frames) === PROXY_EXPECTED.frameCount, 'Controlled proxy frame-count mismatch');
  assert(
    nearlyEqual(stream.duration, PROXY_EXPECTED.durationSeconds),
    'Controlled proxy duration mismatch',
  );
  assert(
    nearlyEqual(proxyProbe.format.duration, PROXY_EXPECTED.durationSeconds),
    'Controlled proxy container duration mismatch',
  );
};

const fullDecode = (path) => {
  const command = ['ffmpeg', '-v', 'error', '-i', path, '-map', '0:v:0', '-f', 'null', '-'];
  const result = spawnSync(command[0], command.slice(1), {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  assert(result.status === 0, `Full decode failed for ${path}: ${result.stderr}`);
  return {
    command,
    exitCode: result.status,
    stdoutSha256: sha256Text(result.stdout || ''),
    stderrSha256: sha256Text(result.stderr || ''),
    completed: true,
  };
};

const firstLine = (value) => value.split(/\r?\n/)[0];

const toolVersions = () => ({
  node: process.version,
  ffmpeg: firstLine(run('ffmpeg', ['-version'])),
  ffprobe: firstLine(run('ffprobe', ['-version'])),
  tesseract: firstLine(run('tesseract', ['--version'])),
});

const build = ({proxyPath, receiptPath, evidenceDir}) => {
  assert(existsSync(SOURCE_PATH), `Missing authoritative source: ${SOURCE_PATH}`);
  assert(existsSync(proxyPath), `Missing controlled proxy: ${proxyPath}`);

  const sourceSha = sha256(SOURCE_PATH);
  const proxySha = sha256(proxyPath);
  assert(sourceSha === SOURCE_EXPECTED.sha256, 'Authoritative source SHA-256 mismatch');
  assert(proxySha === PROXY_EXPECTED.sha256, 'Controlled proxy SHA-256 mismatch');

  const sourceProbe = probe(SOURCE_PATH);
  const proxyProbe = probe(proxyPath);
  validateSourceProbe(sourceProbe);
  validateProxyProbe(proxyProbe);
  const sourceDecode = fullDecode(SOURCE_PATH);
  const proxyDecode = fullDecode(proxyPath);

  const sourceFramesDir = resolve(evidenceDir, 'source-points');
  const proxyFramesDir = resolve(evidenceDir, 'proxy-points');
  mkdirSync(sourceFramesDir, {recursive: true});
  mkdirSync(proxyFramesDir, {recursive: true});

  const inventory = sourceFrameInventory();
  assert(inventory.length === SOURCE_EXPECTED.frameCount, 'Source frame inventory is incomplete');

  const pointEvidence = POINTS.map((point) => {
    const sourceFrame = locateSourceFrame(inventory, point.timeSeconds);
    const proxyBaseFrameIndex = Math.min(
      Math.round(point.timeSeconds * 30),
      PROXY_EXPECTED.frameCount - 1,
    );
    const key = String(point.timeSeconds).replace('.', 'p').padStart(3, '0');
    const sourceImagePath = resolve(sourceFramesDir, `t-${key}-source.png`);
    extractSourceFrame(point.timeSeconds, sourceImagePath);
    const candidateFrameIndices = [...new Set([
      Math.max(0, proxyBaseFrameIndex - 1),
      proxyBaseFrameIndex,
      Math.min(PROXY_EXPECTED.frameCount - 1, proxyBaseFrameIndex + 1),
    ])];
    const proxyCandidates = candidateFrameIndices.map((proxyFrameIndex) => {
      const proxyImagePath = resolve(
        proxyFramesDir,
        `t-${key}-proxy-f-${proxyFrameIndex}.png`,
      );
      extractProxyFrame(proxyPath, proxyFrameIndex, proxyImagePath);
      return {
        proxyFrameIndex,
        proxyFrameTimestampSeconds: proxyFrameIndex / 30,
        proxyImagePath,
        proxyImageSha256: sha256(proxyImagePath),
        similarity: compareFrames(sourceImagePath, proxyImagePath),
      };
    });
    const selected = [...proxyCandidates].sort(
      (a, b) => b.similarity.ssimAll - a.similarity.ssimAll,
    )[0];
    assert(
      selected.similarity.ssimAll >= 0.9,
      `Point ${point.timeSeconds}s best-neighbor SSIM ${selected.similarity.ssimAll} is below 0.9`,
    );
    assert(
      selected.similarity.psnrAverageDb >= 20,
      `Point ${point.timeSeconds}s best-neighbor PSNR ${selected.similarity.psnrAverageDb}dB is below 20dB`,
    );
    return {
      ...point,
      sourceFrameIndexAtOrAfterTime: sourceFrame.index,
      sourceFrameTimestampSeconds: sourceFrame.timestampSeconds,
      proxyBaseFrameIndex,
      proxyFrameIndex: selected.proxyFrameIndex,
      proxyFrameTimestampSeconds: selected.proxyFrameTimestampSeconds,
      sourceImagePath,
      sourceImageSha256: sha256(sourceImagePath),
      proxyImagePath: selected.proxyImagePath,
      proxyImageSha256: selected.proxyImageSha256,
      similarity: selected.similarity,
      proxyCandidates,
    };
  });

  const point134 = pointEvidence.find((point) => point.timeSeconds === 134);
  assert(point134, 'Missing required 134-second evidence point');
  const source134Ocr = assertPrivacyPolicyFrame(point134.sourceImagePath);
  const proxy134Ocr = assertPrivacyPolicyFrame(point134.proxyImagePath);

  const pointMetricsPath = resolve(evidenceDir, 'point-metrics.json');
  const pointMetrics = {
    schemaVersion: 'director-v2-e2e-screen-proxy-point-metrics/v1',
    sourceSha256: sourceSha,
    proxySha256: proxySha,
    selectionPolicy: 'For VFR-to-CFR evidence only, compare the base round(t*30) proxy frame and its immediate neighbors; retain all metrics and select the highest-SSIM frame. This does not convert or reuse any retired 189-second timeline.',
    points: pointEvidence,
  };
  writeFileSync(pointMetricsPath, `${JSON.stringify(pointMetrics, null, 2)}\n`);

  const receipt = {
    schemaVersion: 'director-v2-e2e-screen-proxy-receipt/v1',
    status: 'validated-input-proxy',
    productionEligible: false,
    candidateRenderAllowed: true,
    authoritativeSource: {
      absolutePath: SOURCE_PATH,
      sha256: sourceSha,
      bytes: statSync(SOURCE_PATH).size,
      ffprobeCommand: ['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', SOURCE_PATH],
      ffprobe: sourceProbe,
      fullDecode: sourceDecode,
    },
    controlledProxy: {
      absolutePath: proxyPath,
      sha256: proxySha,
      bytes: statSync(proxyPath).size,
      ffprobeCommand: ['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', proxyPath],
      ffprobe: proxyProbe,
      fullDecode: proxyDecode,
      audioPolicy: {
        containsAudio: false,
        audioStreamCount: proxyProbe.streams.filter((stream) => stream.codec_type === 'audio').length,
        purpose: 'Visual-only full-timeline screen-recording proxy. Spoken audio remains sourced from the authoritative oral recording, not this proxy.',
      },
      cfrQuantization: {
        authoritativeTimelineSeconds: SOURCE_EXPECTED.durationSeconds,
        proxyTimelineSeconds: PROXY_EXPECTED.durationSeconds,
        extraTerminalHoldSeconds: Number(
          (PROXY_EXPECTED.durationSeconds - SOURCE_EXPECTED.durationSeconds).toFixed(6),
        ),
        rationale: '30fps cannot represent 274.243333 seconds exactly; round=up keeps the final source extent and adds only a terminal-frame quantization hold.',
      },
    },
    generation: {
      executable: 'ffmpeg',
      arguments: GENERATION_ARGUMENTS(proxyPath),
      commandDisplay: ['ffmpeg', ...GENERATION_ARGUMENTS(proxyPath)]
        .map((part) => JSON.stringify(part))
        .join(' '),
      containsCredentialOrToken: false,
      tools: toolVersions(),
      generatorScript: {
        absolutePath: fileURLToPath(import.meta.url),
        sha256: sha256(fileURLToPath(import.meta.url)),
      },
    },
    mapping: {
      sourceTimelineStartSeconds: 0,
      sourceTimelineEndSeconds: SOURCE_EXPECTED.durationSeconds,
      proxyFps: 30,
      formula: 'proxyBaseFrameIndex = min(round(sourceTimeSeconds * 30), 8227); proxyFrameTimestampSeconds = proxyFrameIndex / 30',
      pointEvidenceNeighborRule: 'For VFR-to-CFR verification only, compare base-1/base/base+1 and select the highest SSIM while retaining every candidate metric. Candidate editing must still use the authoritative full timeline; this rule never converts old 189-second times.',
      sourceFrameRule: 'sourceFrameIndexAtOrAfterTime is the first presentation-ordered authoritative VFR packet timestamp greater than or equal to the requested source time.',
      retiredTimelineConversionAllowed: false,
    },
    retiredTimebaseIsolation: {
      retiredProxy: {
        absolutePath: RETIRED_TIMEBASE.proxyPath,
        sha256: RETIRED_TIMEBASE.proxySha256,
      },
      retiredUpstreamDerivative: {
        absolutePath: RETIRED_TIMEBASE.upstreamPath,
        sha256: RETIRED_TIMEBASE.upstreamSha256,
      },
      relationship: 'The 189-second upstream derivative is a nonlinear shortening of the 274.243333-second authoritative recording. The retired proxy follows that derivative and is not a trim or constant-speed transform of the authoritative timeline.',
      old86To150MappingMayBeConverted: false,
      old86To150MappingMayBeReused: false,
    },
    points: pointEvidence,
    pointMetricsArtifact: {
      absolutePath: pointMetricsPath,
      sha256: sha256(pointMetricsPath),
    },
    semanticAssertions: {
      at134Seconds: {
        status: 'passed',
        mustContain: ['服务协议与隐私政策', '同意'],
        mustNotContain: ['兰州中心', '小微AI'],
        sourceOcrText: source134Ocr.text,
        proxyOcrText: proxy134Ocr.text,
        assertion: '134 seconds is the service-agreement/privacy-policy screen, not the retired green restaurant-query chat screen.',
      },
    },
    failClosedPolicy: {
      sourceShaMismatchBlocks: true,
      sourceProbeMismatchBlocks: true,
      proxyShaMismatchBlocks: true,
      proxyProbeMismatchBlocks: true,
      pointEvidenceMismatchBlocks: true,
      privacyPolicyAssertionFailureBlocks: true,
      renderBlockedWithoutValidReceipt: true,
      promotionBlocked: true,
    },
  };

  mkdirSync(dirname(receiptPath), {recursive: true});
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  validate({receiptPath});
  return receipt;
};

const validate = ({receiptPath}) => {
  assert(existsSync(receiptPath), `Missing proxy receipt: ${receiptPath}`);
  const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
  assert(
    receipt.schemaVersion === 'director-v2-e2e-screen-proxy-receipt/v1',
    'Proxy receipt schema mismatch',
  );
  assert(receipt.status === 'validated-input-proxy', 'Proxy receipt status mismatch');
  assert(receipt.productionEligible === false, 'Proxy receipt must not enable production');
  assert(receipt.candidateRenderAllowed === true, 'Proxy receipt does not allow candidate render');
  assert(receipt.authoritativeSource.absolutePath === SOURCE_PATH, 'Receipt source path mismatch');
  assert(receipt.authoritativeSource.sha256 === SOURCE_EXPECTED.sha256, 'Receipt source SHA mismatch');
  assert(receipt.controlledProxy.sha256 === PROXY_EXPECTED.sha256, 'Receipt proxy SHA mismatch');
  assert(receipt.authoritativeSource.bytes === statSync(SOURCE_PATH).size, 'Receipt source byte count mismatch');
  assert(
    receipt.controlledProxy.bytes === statSync(receipt.controlledProxy.absolutePath).size,
    'Receipt proxy byte count mismatch',
  );
  assert(
    receipt.generation.generatorScript.sha256 === sha256(fileURLToPath(import.meta.url)),
    'Receipt generator/validator script SHA mismatch',
  );
  assert(
    receipt.mapping.retiredTimelineConversionAllowed === false,
    'Receipt permits conversion from the retired timeline',
  );
  assert(
    receipt.retiredTimebaseIsolation.retiredProxy.sha256 === RETIRED_TIMEBASE.proxySha256,
    'Retired proxy identity is not bound',
  );
  assert(
    receipt.retiredTimebaseIsolation.retiredUpstreamDerivative.sha256 ===
      RETIRED_TIMEBASE.upstreamSha256,
    'Retired upstream derivative identity is not bound',
  );
  assert(
    receipt.retiredTimebaseIsolation.old86To150MappingMayBeConverted === false &&
      receipt.retiredTimebaseIsolation.old86To150MappingMayBeReused === false,
    'Retired 86-150 second mapping is not fail-closed',
  );

  assert(sha256(SOURCE_PATH) === SOURCE_EXPECTED.sha256, 'Live source SHA mismatch');
  assert(
    sha256(receipt.controlledProxy.absolutePath) === PROXY_EXPECTED.sha256,
    'Live proxy SHA mismatch',
  );

  const sourceProbe = probe(SOURCE_PATH);
  const proxyProbe = probe(receipt.controlledProxy.absolutePath);
  validateSourceProbe(sourceProbe);
  validateProxyProbe(proxyProbe);
  assert(
    proxyProbe.streams.filter((stream) => stream.codec_type === 'audio').length === 0,
    'Controlled proxy unexpectedly contains audio',
  );
  assert(
    JSON.stringify(sourceProbe) === JSON.stringify(receipt.authoritativeSource.ffprobe),
    'Receipt source ffprobe no longer matches live source',
  );
  assert(
    JSON.stringify(proxyProbe) === JSON.stringify(receipt.controlledProxy.ffprobe),
    'Receipt proxy ffprobe no longer matches live proxy',
  );
  fullDecode(SOURCE_PATH);
  fullDecode(receipt.controlledProxy.absolutePath);

  assert(existsSync(receipt.pointMetricsArtifact.absolutePath), 'Point-metrics artifact is missing');
  assert(
    sha256(receipt.pointMetricsArtifact.absolutePath) === receipt.pointMetricsArtifact.sha256,
    'Point-metrics artifact SHA mismatch',
  );
  const metricArtifact = JSON.parse(readFileSync(receipt.pointMetricsArtifact.absolutePath, 'utf8'));
  assert(metricArtifact.sourceSha256 === SOURCE_EXPECTED.sha256, 'Point metrics source SHA mismatch');
  assert(metricArtifact.proxySha256 === PROXY_EXPECTED.sha256, 'Point metrics proxy SHA mismatch');
  assert(
    JSON.stringify(metricArtifact.points) === JSON.stringify(receipt.points),
    'Point metrics no longer match receipt points',
  );

  assert(receipt.points.length === POINTS.length, 'Proxy receipt point count mismatch');
  const validationTempDir = mkdtempSync(resolve(tmpdir(), 'director-v2-proxy-validate-'));
  const liveInventory = sourceFrameInventory();
  assert(liveInventory.length === SOURCE_EXPECTED.frameCount, 'Live source packet inventory is incomplete');
  try {
    for (const expectedPoint of POINTS) {
      const point = receipt.points.find((item) => item.timeSeconds === expectedPoint.timeSeconds);
      assert(point, `Missing receipt point ${expectedPoint.timeSeconds}s`);
      const expectedProxyBaseFrame = Math.min(
        Math.round(expectedPoint.timeSeconds * 30),
        PROXY_EXPECTED.frameCount - 1,
      );
      const liveSourceFrame = locateSourceFrame(liveInventory, expectedPoint.timeSeconds);
      assert(
        point.sourceFrameIndexAtOrAfterTime === liveSourceFrame.index,
        `Source frame index mismatch at ${point.timeSeconds}s`,
      );
      assert(
        nearlyEqual(point.sourceFrameTimestampSeconds, liveSourceFrame.timestampSeconds),
        `Source frame timestamp mismatch at ${point.timeSeconds}s`,
      );
      assert(
        point.proxyBaseFrameIndex === expectedProxyBaseFrame,
        `Proxy base frame mismatch at ${point.timeSeconds}s`,
      );
      assert(
        Math.abs(point.proxyFrameIndex - expectedProxyBaseFrame) <= 1,
        `Selected proxy frame is outside the permitted one-frame neighborhood at ${point.timeSeconds}s`,
      );
      assert(existsSync(point.sourceImagePath), `Missing source point image at ${point.timeSeconds}s`);
      assert(existsSync(point.proxyImagePath), `Missing proxy point image at ${point.timeSeconds}s`);
      assert(
        sha256(point.sourceImagePath) === point.sourceImageSha256,
        `Source point image SHA mismatch at ${point.timeSeconds}s`,
      );
      assert(
        sha256(point.proxyImagePath) === point.proxyImageSha256,
        `Proxy point image SHA mismatch at ${point.timeSeconds}s`,
      );

      const liveSourceImagePath = resolve(validationTempDir, `source-${point.timeSeconds}.png`);
      const liveProxyImagePath = resolve(
        validationTempDir,
        `proxy-${point.timeSeconds}-f-${point.proxyFrameIndex}.png`,
      );
      extractSourceFrame(point.timeSeconds, liveSourceImagePath);
      extractProxyFrame(receipt.controlledProxy.absolutePath, point.proxyFrameIndex, liveProxyImagePath);
      assert(
        sha256(liveSourceImagePath) === point.sourceImageSha256,
        `Receipt source image is not reproducible from live source media at ${point.timeSeconds}s`,
      );
      assert(
        sha256(liveProxyImagePath) === point.proxyImageSha256,
        `Receipt proxy image is not reproducible from live proxy media at ${point.timeSeconds}s`,
      );

      const similarity = compareFrames(liveSourceImagePath, liveProxyImagePath);
      assert(similarity.ssimAll >= 0.9, `Live-media SSIM failed at ${point.timeSeconds}s`);
      assert(similarity.psnrAverageDb >= 20, `Live-media PSNR failed at ${point.timeSeconds}s`);
      assert(
        nearlyEqual(similarity.ssimAll, point.similarity.ssimAll),
        `Receipt SSIM mismatch at ${point.timeSeconds}s`,
      );
      assert(
        nearlyEqual(similarity.psnrAverageDb, point.similarity.psnrAverageDb),
        `Receipt PSNR mismatch at ${point.timeSeconds}s`,
      );
      assert(Array.isArray(point.proxyCandidates), `Missing proxy candidates at ${point.timeSeconds}s`);
      for (const candidate of point.proxyCandidates) {
        assert(existsSync(candidate.proxyImagePath), `Missing proxy candidate image at ${point.timeSeconds}s`);
        assert(
          sha256(candidate.proxyImagePath) === candidate.proxyImageSha256,
          `Proxy candidate SHA mismatch at ${point.timeSeconds}s frame ${candidate.proxyFrameIndex}`,
        );
        const liveCandidatePath = resolve(
          validationTempDir,
          `proxy-${point.timeSeconds}-candidate-f-${candidate.proxyFrameIndex}.png`,
        );
        extractProxyFrame(
          receipt.controlledProxy.absolutePath,
          candidate.proxyFrameIndex,
          liveCandidatePath,
        );
        assert(
          sha256(liveCandidatePath) === candidate.proxyImageSha256,
          `Proxy candidate is not reproducible from live proxy media at ${point.timeSeconds}s frame ${candidate.proxyFrameIndex}`,
        );
        const candidateSimilarity = compareFrames(liveSourceImagePath, liveCandidatePath);
        assert(
          nearlyEqual(candidateSimilarity.ssimAll, candidate.similarity.ssimAll),
          `Proxy candidate SSIM mismatch at ${point.timeSeconds}s frame ${candidate.proxyFrameIndex}`,
        );
        assert(
          nearlyEqual(candidateSimilarity.psnrAverageDb, candidate.similarity.psnrAverageDb),
          `Proxy candidate PSNR mismatch at ${point.timeSeconds}s frame ${candidate.proxyFrameIndex}`,
        );
      }
    }
  } finally {
    rmSync(validationTempDir, {recursive: true, force: true});
  }

  const point134 = receipt.points.find((point) => point.timeSeconds === 134);
  assertPrivacyPolicyFrame(point134.sourceImagePath);
  assertPrivacyPolicyFrame(point134.proxyImagePath);
  assert(
    receipt.semanticAssertions.at134Seconds.status === 'passed',
    'Receipt 134-second semantic assertion is not passed',
  );
  assert(receipt.failClosedPolicy.renderBlockedWithoutValidReceipt, 'Fail-closed render policy missing');
  return {ok: true, receiptPath};
};

const parseArguments = () => {
  const args = process.argv.slice(2);
  const mode = args.shift() || 'validate';
  const options = {
    mode,
    proxyPath: DEFAULT_PROXY_PATH,
    receiptPath: DEFAULT_RECEIPT_PATH,
    evidenceDir: DEFAULT_EVIDENCE_DIR,
  };
  while (args.length > 0) {
    const flag = args.shift();
    const value = args.shift();
    if (!value) fail(`Missing value for ${flag}`);
    if (flag === '--proxy') options.proxyPath = resolve(value);
    else if (flag === '--receipt') options.receiptPath = resolve(value);
    else if (flag === '--evidence-dir') options.evidenceDir = resolve(value);
    else fail(`Unknown option: ${flag}`);
  }
  return options;
};

try {
  fail(
    `${DIRECT_CLI_BLOCK_CODE}: live build/validate requires an independently installed, immutable system launcher; repository code cannot authorize itself`,
  );
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
