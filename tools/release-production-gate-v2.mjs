import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync,
} from 'node:fs';
import {dirname, isAbsolute, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

import {assertNoRetiredGeneratedStyle} from './generated-style-policy.mjs';
import {assertProductionEntryPreflightV2} from '../skills/koubo-remotion-director/scripts/director-production-preflight-v2.mjs';
import {assertScopedDirectExportRelease} from './scoped-direct-export-core.mjs';

export const RELEASE_PRODUCTION_GATE_SCHEMA = 'release-production-gate/v2';
export const RELEASE_RISK_FRAME_RECEIPT_SCHEMA = 'release-risk-frame-receipt/v2';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_RELEASE_PROJECT_ROOT = resolve(HERE, '..');
const SHA256_RE = /^[a-f0-9]{64}$/u;
const ALLOWED_RUN_COMMANDS = new Set(['formal', 'formal-audio', 'qa', 'regression', 'all']);
const REQUIRED_STAGE_IDS = Object.freeze(['formal-render', 'formal-audio', 'formal-qa']);

export class ReleaseProductionGateV2Error extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = 'ReleaseProductionGateV2Error';
    this.code = code;
    this.details = details;
  }
}

const fail = (code, message, details = null) => {
  throw new ReleaseProductionGateV2Error(code, message, details);
};
const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim().length > 0;
const sha256Bytes = (value) => createHash('sha256').update(value).digest('hex');
const normalizeRelative = (projectRoot, absolutePath) =>
  relative(projectRoot, absolutePath).split(sep).join('/');

const assertInsideProject = (projectRoot, pathValue, label) => {
  if (!isText(pathValue)) fail('RPG2_PROJECT_PATH_REQUIRED', `${label}必须是项目内非空路径。`);
  const absolutePath = isAbsolute(pathValue) ? resolve(pathValue) : resolve(projectRoot, pathValue);
  const relation = relative(projectRoot, absolutePath);
  if (!relation || relation === '..' || relation.startsWith(`..${sep}`) || isAbsolute(relation)) {
    fail('RPG2_PROJECT_PATH_OUTSIDE', `${label}必须位于口播项目内。`);
  }
  let cursor = projectRoot;
  for (const segment of relation.split(sep).filter(Boolean)) {
    cursor = resolve(cursor, segment);
    if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink()) {
      fail('RPG2_PROJECT_PATH_SYMLINK', `${label}不得经过符号链接。`);
    }
  }
  if (!existsSync(absolutePath)) fail('RPG2_PROJECT_FILE_MISSING', `${label}不存在。`);
  if (realpathSync(absolutePath) !== absolutePath) {
    fail('RPG2_PROJECT_REALPATH_MISMATCH', `${label}真实路径不一致。`);
  }
  const stat = lstatSync(absolutePath);
  if (!stat.isFile()) fail('RPG2_REGULAR_FILE_REQUIRED', `${label}必须是普通文件。`);
  return {absolutePath, relativePath: normalizeRelative(projectRoot, absolutePath), stat};
};

const makeFileHasher = (projectRoot) => {
  const cache = new Map();
  return (pathValue, label) => {
    const file = assertInsideProject(projectRoot, pathValue, label);
    if (!cache.has(file.absolutePath)) {
      cache.set(file.absolutePath, sha256Bytes(readFileSync(file.absolutePath)));
    }
    return {...file, sha256: cache.get(file.absolutePath)};
  };
};

const readBoundJson = ({projectRoot, reference, label, hashFile}) => {
  if (!isRecord(reference) || !isText(reference.path) || !SHA256_RE.test(String(reference.sha256 ?? ''))) {
    fail('RPG2_BOUND_JSON_REFERENCE_INVALID', `${label}必须绑定项目内路径和小写 SHA-256。`);
  }
  const file = hashFile(reference.path, label);
  if (file.sha256 !== reference.sha256) fail('RPG2_BOUND_JSON_SHA_MISMATCH', `${label} SHA-256 已变化。`);
  let body;
  try {
    body = JSON.parse(readFileSync(file.absolutePath, 'utf8'));
  } catch {
    fail('RPG2_BOUND_JSON_INVALID', `${label}不是有效 JSON。`);
  }
  return {...file, body};
};

const assertBoundMedia = ({projectRoot, reference, expectedPath, label, hashFile}) => {
  if (!isRecord(reference) || !isText(reference.path) || !SHA256_RE.test(String(reference.sha256 ?? ''))) {
    fail('RPG2_BOUND_MEDIA_REFERENCE_INVALID', `${label}必须绑定项目内路径和小写 SHA-256。`);
  }
  const file = hashFile(reference.path, label);
  if (file.sha256 !== reference.sha256) fail('RPG2_BOUND_MEDIA_SHA_MISMATCH', `${label} SHA-256 已变化。`);
  if (expectedPath && file.relativePath !== expectedPath) {
    fail('RPG2_BOUND_MEDIA_PATH_MISMATCH', `${label}没有绑定当前 job 指定路径。`);
  }
  if (Number(reference.bytes) !== file.stat.size) {
    fail('RPG2_BOUND_MEDIA_BYTES_MISMATCH', `${label}字节数已变化。`);
  }
  return file;
};

const validateOutputSnapshot = ({projectRoot, output, hashFile, label}) => {
  if (!isRecord(output) || !isText(output.path) || !SHA256_RE.test(String(output.sha256 ?? ''))) {
    fail('RPG2_STAGE_OUTPUT_INVALID', `${label}产物摘要不完整。`);
  }
  const file = hashFile(output.path, `${label}产物`);
  if (file.sha256 !== output.sha256 || Number(output.sizeBytes) !== file.stat.size) {
    fail('RPG2_STAGE_OUTPUT_MISMATCH', `${label}产物与成功回执不一致。`);
  }
  return file;
};

const validateStageReceipt = ({projectRoot, reference, expectedStageId, jobId, fingerprint, hashFile}) => {
  const stage = readBoundJson({projectRoot, reference, label: `${expectedStageId} 成功回执`, hashFile});
  if (
    stage.body.schemaVersion !== 1 ||
    stage.body.status !== 'passed' ||
    stage.body.jobId !== jobId ||
    stage.body.stageId !== expectedStageId ||
    stage.body.fingerprint !== fingerprint ||
    !Array.isArray(stage.body.outputs) ||
    stage.body.outputs.length === 0
  ) {
    fail('RPG2_STAGE_RECEIPT_CONTENT_INVALID', `${expectedStageId} 成功回执身份、状态或指纹无效。`);
  }
  const outputs = stage.body.outputs.map((output, index) =>
    validateOutputSnapshot({projectRoot, output, hashFile, label: `${expectedStageId}[${index}]`}));
  return {...stage, outputs};
};

const rawFrameSha256 = ({mediaPath, atSeconds}) => {
  const result = spawnSync('ffmpeg', [
    '-v', 'error',
    '-ss', Number(atSeconds).toFixed(6),
    '-i', mediaPath,
    '-map', '0:v:0',
    '-frames:v', '1',
    '-f', 'rawvideo',
    '-pix_fmt', 'rgb24',
    'pipe:1',
  ], {encoding: null, maxBuffer: 64 * 1024 * 1024});
  if (result.status !== 0 || !Buffer.isBuffer(result.stdout) || result.stdout.length === 0) {
    fail('RPG2_RISK_FRAME_DECODE_FAILED', '风险帧无法从绑定媒体解码。');
  }
  return {sha256: sha256Bytes(result.stdout), bytes: result.stdout.length};
};

const validateRiskFrameReceipt = ({
  projectRoot,
  reference,
  formalOutput,
  reviewFrames,
  hashFile,
}) => {
  const receipt = readBoundJson({projectRoot, reference, label: '最终成片风险帧回执', hashFile});
  if (
    receipt.body.schema !== RELEASE_RISK_FRAME_RECEIPT_SCHEMA ||
    receipt.body.evidenceScope !== 'real-final-output' ||
    receipt.body.sourceVideo?.path !== formalOutput.relativePath ||
    receipt.body.sourceVideo?.sha256 !== formalOutput.sha256 ||
    Number(receipt.body.sourceVideo?.bytes) !== formalOutput.stat.size ||
    !Array.isArray(receipt.body.frames) ||
    receipt.body.frames.length === 0
  ) {
    fail('RPG2_RISK_FRAME_RECEIPT_CONTENT_INVALID', '风险帧回执必须绑定当前最终成片和实际抽帧清单。');
  }
  const declaredTimes = receipt.body.frames.map((frame) => Number(frame.atSeconds));
  if (
    !Array.isArray(reviewFrames) ||
    reviewFrames.length !== declaredTimes.length ||
    reviewFrames.some((value, index) => Math.abs(Number(value) - declaredTimes[index]) > 0.001)
  ) {
    fail('RPG2_RISK_FRAME_TIMELINE_MISMATCH', '发布记录关键帧时间必须逐项绑定最终成片风险帧回执。');
  }
  for (const [index, frame] of receipt.body.frames.entries()) {
    if (
      !isRecord(frame) ||
      frame.sourceVideoSha256 !== formalOutput.sha256 ||
      !Number.isFinite(Number(frame.atSeconds)) ||
      Number(frame.atSeconds) < 0 ||
      !Number.isInteger(Number(frame.frameIndex)) ||
      !SHA256_RE.test(String(frame.pixelSha256 ?? ''))
    ) {
      fail('RPG2_RISK_FRAME_ENTRY_INVALID', `风险帧第 ${index + 1} 项绑定不完整。`);
    }
    const image = hashFile(frame.path, `风险帧第 ${index + 1} 张图片`);
    if (image.sha256 !== frame.sha256) {
      fail('RPG2_RISK_FRAME_FILE_SHA_MISMATCH', `风险帧第 ${index + 1} 张图片 SHA-256 已变化。`);
    }
    const expectedFrameIndex = Math.round(Number(frame.atSeconds) * Number(receipt.body.sourceVideo.fps));
    if (Number(frame.frameIndex) !== expectedFrameIndex) {
      fail('RPG2_RISK_FRAME_INDEX_MISMATCH', `风险帧第 ${index + 1} 项时间与帧号不一致。`);
    }
    const sourcePixels = rawFrameSha256({mediaPath: formalOutput.absolutePath, atSeconds: frame.atSeconds});
    const imagePixels = rawFrameSha256({mediaPath: image.absolutePath, atSeconds: 0});
    if (
      sourcePixels.sha256 !== imagePixels.sha256 ||
      sourcePixels.sha256 !== frame.pixelSha256 ||
      sourcePixels.bytes !== imagePixels.bytes
    ) {
      fail('RPG2_RISK_FRAME_PIXEL_MISMATCH', `风险帧第 ${index + 1} 张不是当前最终成片对应时刻的实际像素。`);
    }
  }
  return receipt;
};

export const validateReleaseRiskFrameReceiptV2 = ({
  projectRoot = DEFAULT_RELEASE_PROJECT_ROOT,
  receiptReference,
  formalOutputReference,
  reviewFrames,
}) => {
  const canonicalRoot = resolve(projectRoot);
  const hashFile = makeFileHasher(canonicalRoot);
  const formalOutput = assertBoundMedia({
    projectRoot: canonicalRoot,
    reference: formalOutputReference,
    expectedPath: formalOutputReference?.path,
    label: '风险帧绑定正式输出',
    hashFile,
  });
  return validateRiskFrameReceipt({
    projectRoot: canonicalRoot,
    reference: receiptReference,
    formalOutput,
    reviewFrames,
    hashFile,
  });
};

export const validateReleaseProductionGateV2 = ({
  projectRoot = DEFAULT_RELEASE_PROJECT_ROOT,
  releasePath,
  release = null,
}) => {
  try {
    const canonicalRoot = resolve(projectRoot);
    const hashFile = makeFileHasher(canonicalRoot);
    const releaseFile = hashFile(releasePath, '发布记录');
    let parsedRelease = release;
    if (!isRecord(parsedRelease)) {
      try {
        parsedRelease = JSON.parse(readFileSync(releaseFile.absolutePath, 'utf8'));
      } catch {
        fail('RPG2_RELEASE_JSON_INVALID', '发布记录不是有效 JSON。');
      }
    }
    const gate = parsedRelease.productionGate;
    if (!isRecord(gate) || gate.schema !== RELEASE_PRODUCTION_GATE_SCHEMA) {
      fail('RPG2_GATE_REQUIRED', '发布校验必须绑定 release-production-gate/v2；旧记录只能作历史证据。');
    }
    const jobFile = readBoundJson({projectRoot: canonicalRoot, reference: gate.job, label: '发布绑定 job', hashFile});
    if (isText(jobFile.body.inputs?.generatedVideoPlan)) {
      fail(
        'RPG2_GENERATED_VIDEO_RELEASE_FROZEN',
        '当前 H3 上传、外部授权、单次消费、query/result/download 与人工验收信任链尚未闭合；' +
        '任何包含 generatedVideoPlan 的发布修订均在媒体解码和报告写入前冻结。',
      );
    }
    const preflight = assertProductionEntryPreflightV2({
      projectRoot: canonicalRoot,
      jobPath: jobFile.absolutePath,
      job: jobFile.body,
      command: 'release-validation',
      entrypoint: 'tools/validate-release.mjs',
    });
    const scopedDirectExport = assertScopedDirectExportRelease({release: parsedRelease, preflight});
    if (
      gate.jobSnapshotSha256 !== preflight.jobSnapshotSha256 ||
      gate.directorContractSha256 !== preflight.directorContractSha256 ||
      gate.handoffBindingSha256 !== preflight.handoffBindingSha256 ||
      gate.freezeReceiptSha256 !== preflight.freezeReceiptSha256
    ) {
      fail('RPG2_PREFLIGHT_BINDING_MISMATCH', '发布记录没有绑定本次真实导演/冻结预检结果。');
    }
    if (parsedRelease.videoId !== jobFile.body.videoId) {
      fail('RPG2_VIDEO_ID_MISMATCH', 'release.videoId 与当前 job.videoId 不一致。');
    }
    const expectedFormalPath = jobFile.body.formal?.finalOutput;
    const expectedPreviewPath = jobFile.body.preview?.output;
    if (parsedRelease.production?.formalOutput !== expectedFormalPath) {
      fail('RPG2_FORMAL_OUTPUT_ROUTE_MISMATCH', 'release 正式输出没有绑定 job.formal.finalOutput。');
    }
    if (!scopedDirectExport && parsedRelease.production?.previewOutput !== expectedPreviewPath) {
      fail('RPG2_PREVIEW_OUTPUT_ROUTE_MISMATCH', 'release 预览输出没有绑定 job.preview.output。');
    }
    const formalOutput = assertBoundMedia({
      projectRoot: canonicalRoot,
      reference: gate.formalOutput,
      expectedPath: expectedFormalPath,
      label: '正式输出',
      hashFile,
    });
    const previewOutput = scopedDirectExport ? null : assertBoundMedia({
      projectRoot: canonicalRoot,
      reference: gate.previewOutput,
      expectedPath: expectedPreviewPath,
      label: '预览输出',
      hashFile,
    });
    assertNoRetiredGeneratedStyle({
      value: {release: parsedRelease, job: jobFile.body},
      operation: 'release-validation',
      location: '$.releaseValidation',
      projectRoot: canonicalRoot,
      documentPaths: [releaseFile.absolutePath, jobFile.absolutePath, formalOutput.absolutePath, ...(previewOutput ? [previewOutput.absolutePath] : [])],
      additionalStrings: [formalOutput.relativePath, ...(previewOutput ? [previewOutput.relativePath] : [])],
    });

    const runManifest = readBoundJson({projectRoot: canonicalRoot, reference: gate.runManifest, label: '正式运行清单', hashFile});
    if (
      runManifest.relativePath !== jobFile.body.reports?.runManifest ||
      runManifest.body.schemaVersion !== 1 ||
      runManifest.body.status !== 'passed' ||
      runManifest.body.jobId !== jobFile.body.jobId ||
      !ALLOWED_RUN_COMMANDS.has(runManifest.body.command) ||
      !isText(runManifest.body.fingerprint) ||
      runManifest.body.fingerprint !== gate.runFingerprint ||
      runManifest.body.formalQa?.status !== 'passed' ||
      runManifest.body.formalQa?.output !== formalOutput.relativePath ||
      runManifest.body.formalQa?.sha256 !== formalOutput.sha256
    ) {
      fail('RPG2_RUN_MANIFEST_INVALID', '运行清单必须绑定当前 job、指纹、正式 QA 与正式输出 SHA。');
    }
    if (!isRecord(gate.stageReceipts)) {
      fail('RPG2_STAGE_RECEIPTS_REQUIRED', '发布门必须绑定 formal-render/formal-audio/formal-qa 三段成功回执。');
    }
    const stageReceipts = Object.fromEntries(REQUIRED_STAGE_IDS.map((stageId) => [
      stageId,
      validateStageReceipt({
        projectRoot: canonicalRoot,
        reference: gate.stageReceipts[stageId],
        expectedStageId: stageId,
        jobId: jobFile.body.jobId,
        fingerprint: gate.runFingerprint,
        hashFile,
      }),
    ]));
    for (const stageId of ['formal-audio', 'formal-qa']) {
      if (
        stageReceipts[stageId].outputs.length !== 1 ||
        stageReceipts[stageId].outputs[0].relativePath !== formalOutput.relativePath ||
        stageReceipts[stageId].outputs[0].sha256 !== formalOutput.sha256
      ) {
        fail('RPG2_FORMAL_STAGE_OUTPUT_MISMATCH', `${stageId} 没有绑定当前正式输出。`);
      }
    }
    if (
      stageReceipts['formal-render'].outputs.length !== 1 ||
      stageReceipts['formal-render'].outputs[0].relativePath !== jobFile.body.formal?.rawOutput
    ) {
      fail('RPG2_RAW_STAGE_OUTPUT_MISMATCH', 'formal-render 没有绑定当前正式 raw 输出。');
    }
    const riskFrameReceipt = validateRiskFrameReceipt({
      projectRoot: canonicalRoot,
      reference: gate.riskFrameReceipt,
      formalOutput,
      reviewFrames: parsedRelease.qa?.keyframeReview?.frames,
      hashFile,
    });
    return {
      ok: true,
      code: 'RPG2_OK',
      route: preflight.route ?? 'director-automation-v2',
      scopedDirectExportSha256: preflight.scopedDirectExportSha256 ?? null,
      releasePath: releaseFile.relativePath,
      releaseSha256: releaseFile.sha256,
      jobPath: jobFile.relativePath,
      jobSha256: jobFile.sha256,
      jobSnapshotSha256: preflight.jobSnapshotSha256,
      directorContractSha256: preflight.directorContractSha256,
      handoffBindingSha256: preflight.handoffBindingSha256,
      freezeReceiptSha256: preflight.freezeReceiptSha256,
      runFingerprint: gate.runFingerprint,
      formalOutputSha256: formalOutput.sha256,
      previewOutputSha256: previewOutput?.sha256 ?? null,
      riskFrameReceiptSha256: riskFrameReceipt.sha256,
    };
  } catch (error) {
    if (error instanceof ReleaseProductionGateV2Error) {
      return {ok: false, code: error.code, message: error.message, details: error.details};
    }
    return {
      ok: false,
      code: error?.code ?? 'RPG2_UNEXPECTED',
      message: error instanceof Error ? error.message : String(error),
    };
  }
};

export const assertReleaseProductionGateV2 = (options) => {
  const result = validateReleaseProductionGateV2(options);
  if (!result.ok) fail(result.code, result.message, result.details);
  return result;
};
