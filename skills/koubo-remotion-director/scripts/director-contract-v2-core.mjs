import {createHash, verify as verifySignature} from 'node:crypto';
import {existsSync, lstatSync, readFileSync, realpathSync, statSync} from 'node:fs';
import {isAbsolute, relative, resolve, sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

import {assertNoRetiredGeneratedStyle} from '../../../tools/generated-style-policy.mjs';

export const DIRECTOR_CONTRACT_SCHEMA = 'director-contract/v2';
export const MAX_UNEXPLAINED_VISUAL_GAP_SECONDS = 15;
export const DIRECTOR_TRANSCRIPT_SCHEMA = 'spoken-transcript/v2';
export const DIRECTOR_TECHNICAL_QA_SCHEMA = 'director-candidate-technical-qa/v2';
export const DIRECTOR_CANDIDATE_WRAPPER_RECEIPT_SCHEMA = 'director-controlled-candidate-wrapper-receipt/v2';
export const DIRECTOR_HUMAN_REVIEW_SCHEMA = 'director-human-style-acceptance/v2';
export const DIRECTOR_SUPERVISOR_REVIEW_SCHEMA = 'director-supervisor-handoff-acceptance/v2';
export const DIRECTOR_HANDOFF_RECEIPT_SCHEMA = 'director-automation-handoff-receipt/v2';
export const DIRECTOR_EXTERNAL_ACCEPTANCE_ANCHOR_REGISTRY_SCHEMA = 'director-external-acceptance-anchor-registry/v2';
export const DIRECTOR_EXTERNAL_ANCHOR_TRUST_STATE = 'blocked-no-independent-ed25519-key';
export const DIRECTOR_EXTERNAL_TRUST_ROOT_SCHEMA = 'director-independent-ed25519-trust-root/v2';
export const DIRECTOR_EXTERNAL_TRUST_ROOT_PATH = process.platform === 'darwin'
  ? '/Library/Application Support/KouboDirector/director-independent-ed25519-trust-root.v2.json'
  : '/etc/koubo-director/director-independent-ed25519-trust-root.v2.json';

const EXTERNAL_ACCEPTANCE_ANCHOR_REGISTRY_PATH = resolve(
  fileURLToPath(new URL('../fixtures/external-acceptance-anchor-registry.v2.json', import.meta.url)),
);

const EFFECTIVE_VISUAL_KINDS = new Set([
  'real-evidence',
  'official-source',
  'screen-recording',
  'generated-video',
  'remotion-semantic',
  'semantic-assembly',
]);

const NON_EFFECTIVE_VISUAL_KINDS = new Set([
  'speaker-only',
  'subtitle-only',
  'camera-motion-only',
  'logo-only',
  'decorative-only',
]);

const SHA256_RE = /^[a-f0-9]{64}$/;
const EPSILON = 0.025;
const GLOBAL_PROBE_CACHE = new Map();
const GLOBAL_DECODE_CACHE = new Map();
const GLOBAL_SIGNAL_CACHE = new Map();
const GLOBAL_RAW_FRAME_CACHE = new Map();

const round = (value, digits = 6) => Number(Number(value).toFixed(digits));
const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isNonEmpty = (value) => typeof value === 'string' && value.trim().length > 0;
const asArray = (value) => (Array.isArray(value) ? value : []);
const finite = (value) => Number.isFinite(Number(value));

const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
};

export const stableJsonSha256 = (value) =>
  createHash('sha256').update(JSON.stringify(stableValue(value))).digest('hex');

const containsFixtureOrTestMarker = (value, visited = new WeakSet()) => {
  if (typeof value === 'string') return /(?:fixture|validator[ -]?test|not[ -]?project|test[ -]?only)/iu.test(value);
  if (!value || typeof value !== 'object' || visited.has(value)) return false;
  visited.add(value);
  if (Array.isArray(value)) return value.some((item) => containsFixtureOrTestMarker(item, visited));
  return Object.entries(value).some(([key, item]) =>
    (/(?:fixture|validatorTest|notProject|testOnly)/iu.test(key) && Boolean(item)) ||
    containsFixtureOrTestMarker(item, visited));
};

const readExternalAcceptanceAnchorRegistry = () => {
  let registry;
  try { registry = JSON.parse(readFileSync(EXTERNAL_ACCEPTANCE_ANCHOR_REGISTRY_PATH, 'utf8')); }
  catch (error) {
    return {ok: false, reason: `外部验收锚点注册表不可读：${error.message}`};
  }
  if (
    registry?.schema !== DIRECTOR_EXTERNAL_ACCEPTANCE_ANCHOR_REGISTRY_SCHEMA ||
    registry?.managedBy !== 'independent-supervision-only' ||
    registry?.trustModel !== 'ed25519-detached-entry-signature' ||
    !Array.isArray(registry?.entries)
  ) {
    return {ok: false, reason: '外部验收锚点注册表 schema/管理边界无效'};
  }
  return {ok: true, registry};
};

export const readDirectorIndependentTrustRootV2 = () => {
  if (!existsSync(DIRECTOR_EXTERNAL_TRUST_ROOT_PATH)) {
    return {ok: false, reason: `${DIRECTOR_EXTERNAL_ANCHOR_TRUST_STATE}：独立系统信任根尚未安装`};
  }
  let stat;
  try {
    stat = lstatSync(DIRECTOR_EXTERNAL_TRUST_ROOT_PATH);
    if (!stat.isFile() || stat.isSymbolicLink() || realpathSync(DIRECTOR_EXTERNAL_TRUST_ROOT_PATH) !== DIRECTOR_EXTERNAL_TRUST_ROOT_PATH) {
      return {ok: false, reason: '独立系统信任根必须是固定绝对路径上的普通文件，禁止符号链接'};
    }
    if (stat.uid !== 0 || (stat.mode & 0o022) !== 0) {
      return {ok: false, reason: '独立系统信任根必须由 root 拥有，且组/其他用户不可写'};
    }
  } catch (error) {
    return {ok: false, reason: `独立系统信任根属性不可验证：${error.message}`};
  }
  let body;
  try { body = JSON.parse(readFileSync(DIRECTOR_EXTERNAL_TRUST_ROOT_PATH, 'utf8')); }
  catch (error) { return {ok: false, reason: `独立系统信任根 JSON 不可读：${error.message}`}; }
  if (
    body?.schema !== DIRECTOR_EXTERNAL_TRUST_ROOT_SCHEMA ||
    body?.managedBy !== 'independent-system-administrator' ||
    !Array.isArray(body?.keys)
  ) {
    return {ok: false, reason: '独立系统信任根 schema/管理边界无效'};
  }
  const keys = new Map();
  for (const item of body.keys) {
    if (
      !isNonEmpty(item?.keyId) || item?.algorithm !== 'ed25519' || item?.status !== 'active' ||
      !isNonEmpty(item?.publicKeyPem) || keys.has(item.keyId)
    ) {
      return {ok: false, reason: '独立系统信任根含无效、重复或非激活 Ed25519 公钥'};
    }
    keys.set(item.keyId, item.publicKeyPem);
  }
  if (keys.size === 0) return {ok: false, reason: `${DIRECTOR_EXTERNAL_ANCHOR_TRUST_STATE}：独立信任根没有激活公钥`};
  return {ok: true, path: DIRECTOR_EXTERNAL_TRUST_ROOT_PATH, sha256: createHash('sha256').update(readFileSync(DIRECTOR_EXTERNAL_TRUST_ROOT_PATH)).digest('hex'), keys};
};

export const buildDirectorExternalAnchorBindingPayloadV2 = (receipt, kind) => ({
  schema: 'director-external-message-binding/v2',
  kind,
  receipt: stableValue(receipt),
});

export const serializeDirectorExternalAnchorEntryForSignatureV2 = (entry) =>
  JSON.stringify(stableValue(Object.fromEntries(
    Object.entries(entry).filter(([key]) => key !== 'signatureBase64'),
  )));

export const verifyDirectorExternalAnchorEntryV2 = ({receipt, kind, entry, publicKey}) => {
  if (!isRecord(receipt) || !isRecord(entry) || !isNonEmpty(kind)) {
    return {ok: false, reason: '外部锚点校验参数不完整'};
  }
  const expectedPayload = buildDirectorExternalAnchorBindingPayloadV2(receipt, kind);
  const expectedBindingSha256 = stableJsonSha256(expectedPayload);
  if (
    entry.kind !== kind ||
    entry.status !== 'accepted' ||
    entry.sourceThreadId !== receipt.sourceThreadId ||
    entry.sourceMessageId !== receipt.sourceMessageId ||
    entry.sourceMessageSha256 !== receipt.sourceMessageSha256 ||
    entry.issuerGroupId !== receipt.issuerGroupId ||
    entry.explicitAcceptanceQuoteSha256 !== createHash('sha256').update(receipt.explicitAcceptanceQuote ?? '').digest('hex')
  ) {
    return {ok: false, reason: '外部锚点消息身份与回执不一致'};
  }
  if (
    entry.receiptBindingSha256 !== expectedBindingSha256 ||
    JSON.stringify(stableValue(entry.receiptBindingPayload)) !== JSON.stringify(stableValue(expectedPayload))
  ) {
    return {ok: false, reason: '外部锚点未逐项绑定当前回执、媒体、QA、A/B、观看、结论、修订与有效期'};
  }
  if (!publicKey) {
    return {ok: false, reason: '尚未安装独立监督方 Ed25519 公钥；仓库内 JSON 不能自行成为信任根'};
  }
  if (typeof entry.signatureBase64 !== 'string' || !entry.signatureBase64.trim()) {
    return {ok: false, reason: '外部锚点缺少独立 Ed25519 签名'};
  }
  let signatureValid = false;
  try {
    signatureValid = verifySignature(
      null,
      Buffer.from(serializeDirectorExternalAnchorEntryForSignatureV2(entry)),
      publicKey,
      Buffer.from(entry.signatureBase64, 'base64'),
    );
  } catch {
    signatureValid = false;
  }
  return signatureValid
    ? {ok: true, entry}
    : {ok: false, reason: '外部锚点 Ed25519 签名无效'};
};

export const validateDirectorExternalMessageAnchorV2 = (receipt, kind) => {
  if (!isRecord(receipt) || containsFixtureOrTestMarker(receipt)) {
    return {ok: false, reason: '验收回执包含 fixture/test/non-project 标记'};
  }
  const loaded = readExternalAcceptanceAnchorRegistry();
  if (!loaded.ok) return loaded;
  const match = loaded.registry.entries.find((entry) =>
    entry?.kind === kind &&
    entry?.status === 'accepted' &&
    entry?.sourceThreadId === receipt.sourceThreadId &&
    entry?.sourceMessageId === receipt.sourceMessageId &&
    entry?.sourceMessageSha256 === receipt.sourceMessageSha256 &&
    entry?.issuerGroupId === receipt.issuerGroupId &&
    entry?.explicitAcceptanceQuoteSha256 === createHash('sha256').update(receipt.explicitAcceptanceQuote ?? '').digest('hex'));
  if (!match) return {ok: false, reason: '回执消息未进入独立外部验收锚点注册表'};
  const trustRoot = readDirectorIndependentTrustRootV2();
  if (!trustRoot.ok) return trustRoot;
  const publicKey = trustRoot.keys.get(match.signerKeyId);
  return verifyDirectorExternalAnchorEntryV2({receipt, kind, entry: match, publicKey});
};

const externalAcceptanceAnchorMatches = validateDirectorExternalMessageAnchorV2;

export const computeHandoffContractSnapshotSha256 = (contract) => {
  const snapshot = structuredClone(contract);
  if (isRecord(snapshot.lifecycle)) delete snapshot.lifecycle.handoff;
  return stableJsonSha256(snapshot);
};

export const buildHandoffSupervisionBindingPayload = (contract) => ({
  schemaVersion: 'director-handoff-supervision-intent/v2',
  contractId: contract.contractId,
  contractRevisionId: contract.contractRevisionId || null,
  contractSnapshotSha256: computeHandoffContractSnapshotSha256(contract),
  candidateMp4Sha256: contract.lifecycle?.candidate?.media?.sha256 || null,
  technicalQaReceiptSha256: contract.lifecycle?.candidate?.technicalQaReceipt?.sha256 || null,
  humanReviewReceiptSha256: contract.lifecycle?.styleAcceptance?.humanReviewReceipt?.sha256 || null,
  withSfxSha256: contract.previewAB?.variants?.find((item) => item.id === 'A-with-sfx')?.sha256 || null,
  withoutSfxSha256: contract.previewAB?.variants?.find((item) => item.id === 'B-without-sfx')?.sha256 || null,
});

export const computeHandoffSupervisionBindingSha256 = (contract) =>
  stableJsonSha256(buildHandoffSupervisionBindingPayload(contract));

export const buildHandoffBindingPayload = (contract) => ({
  schemaVersion: 'director-contract-handoff/v2',
  contractId: contract.contractId,
  contractRevisionId: contract.contractRevisionId || null,
  contractSnapshotSha256: computeHandoffContractSnapshotSha256(contract),
  supervisionBindingSha256: computeHandoffSupervisionBindingSha256(contract),
  candidateMp4Sha256: contract.lifecycle?.candidate?.media?.sha256 || null,
  technicalQaReceiptSha256: contract.lifecycle?.candidate?.technicalQaReceipt?.sha256 || null,
  humanReviewReceiptSha256: contract.lifecycle?.styleAcceptance?.humanReviewReceipt?.sha256 || null,
  supervisorReviewReceiptSha256: contract.lifecycle?.handoff?.supervisorReviewReceipt?.sha256 || null,
  withSfxSha256: contract.previewAB?.variants?.find((item) => item.id === 'A-with-sfx')?.sha256 || null,
  withoutSfxSha256: contract.previewAB?.variants?.find((item) => item.id === 'B-without-sfx')?.sha256 || null,
});

export const computeHandoffBindingSha256 = (contract) => stableJsonSha256(buildHandoffBindingPayload(contract));

const parseRate = (value) => {
  if (typeof value === 'number') return value;
  if (!isNonEmpty(value)) return Number.NaN;
  if (!value.includes('/')) return Number(value);
  const [numerator, denominator] = value.split('/').map(Number);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return Number.NaN;
  }
  return numerator / denominator;
};

const canonicalIntervals = (intervals, durationSeconds) => {
  const clipped = intervals
    .filter((item) => finite(item.start) && finite(item.end))
    .map((item) => ({
      start: Math.max(0, Math.min(durationSeconds, Number(item.start))),
      end: Math.max(0, Math.min(durationSeconds, Number(item.end))),
    }))
    .filter((item) => item.end - item.start > EPSILON)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const merged = [];
  for (const interval of clipped) {
    const previous = merged.at(-1);
    if (!previous || interval.start > previous.end + EPSILON) {
      merged.push({...interval});
    } else {
      previous.end = Math.max(previous.end, interval.end);
    }
  }
  return merged;
};

const intervalDuration = (intervals) => intervals.reduce((sum, item) => sum + item.end - item.start, 0);

const intersectDuration = (intervals, start, end) =>
  intervals.reduce((sum, item) => sum + Math.max(0, Math.min(end, item.end) - Math.max(start, item.start)), 0);

export const analyzeVisualCoverage = ({durationSeconds, semanticSegments, visualEvents}) => {
  const effectiveEvents = asArray(visualEvents).filter((event) => EFFECTIVE_VISUAL_KINDS.has(event.kind));
  const effectiveIntervals = canonicalIntervals(effectiveEvents, durationSeconds);
  const uncoveredWindows = [];
  let cursor = 0;
  for (const interval of effectiveIntervals) {
    if (interval.start > cursor + EPSILON) {
      uncoveredWindows.push({start: round(cursor), end: round(interval.start), duration: round(interval.start - cursor)});
    }
    cursor = Math.max(cursor, interval.end);
  }
  if (cursor < durationSeconds - EPSILON) {
    uncoveredWindows.push({start: round(cursor), end: round(durationSeconds), duration: round(durationSeconds - cursor)});
  }

  const effectiveDuration = intervalDuration(effectiveIntervals);
  const perSemanticSegment = asArray(semanticSegments).map((segment) => {
    const segmentDuration = Number(segment.end) - Number(segment.start);
    const coveredDuration = intersectDuration(effectiveIntervals, Number(segment.start), Number(segment.end));
    return {
      segmentId: segment.id,
      start: Number(segment.start),
      end: Number(segment.end),
      coveredDuration: round(coveredDuration),
      coverageRatio: segmentDuration > 0 ? round(coveredDuration / segmentDuration) : 0,
    };
  });

  return {
    effectiveKinds: [...EFFECTIVE_VISUAL_KINDS],
    excludedKinds: [...NON_EFFECTIVE_VISUAL_KINDS],
    effectiveIntervals: effectiveIntervals.map((item) => ({start: round(item.start), end: round(item.end)})),
    effectiveDuration: round(effectiveDuration),
    fullCoverageRatio: durationSeconds > 0 ? round(effectiveDuration / durationSeconds) : 0,
    uncoveredWindows,
    maxUnexplainedWindow: uncoveredWindows.length
      ? uncoveredWindows.reduce((largest, item) => (item.duration > largest.duration ? item : largest))
      : {start: null, end: null, duration: 0},
    perSemanticSegment,
  };
};

const firstTimelineDefect = (segments, durationSeconds) => {
  if (!segments.length) return {kind: 'empty', at: 0};
  const ordered = [...segments].sort((a, b) => Number(a.start) - Number(b.start) || Number(a.end) - Number(b.end));
  if (Math.abs(Number(ordered[0].start)) > EPSILON) {
    return {kind: 'start', expected: 0, actual: Number(ordered[0].start)};
  }
  for (let index = 0; index < ordered.length; index += 1) {
    const current = ordered[index];
    if (!finite(current.start) || !finite(current.end) || Number(current.end) <= Number(current.start) + EPSILON) {
      return {kind: 'range', segmentId: current.id, start: current.start, end: current.end};
    }
    if (index > 0) {
      const previous = ordered[index - 1];
      const delta = Number(current.start) - Number(previous.end);
      if (delta > EPSILON) {
        return {kind: 'gap', previousId: previous.id, nextId: current.id, start: Number(previous.end), end: Number(current.start)};
      }
      if (delta < -EPSILON) {
        return {kind: 'overlap', previousId: previous.id, nextId: current.id, start: Number(current.start), end: Number(previous.end)};
      }
    }
  }
  const actualEnd = Number(ordered.at(-1).end);
  if (Math.abs(actualEnd - durationSeconds) > EPSILON) {
    return {kind: 'end', expected: durationSeconds, actual: actualEnd};
  }
  return null;
};

const makeFileServices = ({rootDir, checkFiles, ffprobePath, ffmpegPath}) => {
  const hashCache = new Map();
  const probeCache = GLOBAL_PROBE_CACHE;
  const decodeCache = GLOBAL_DECODE_CACHE;
  const signalCache = GLOBAL_SIGNAL_CACHE;
  const rawFrameCache = GLOBAL_RAW_FRAME_CACHE;

  const absolutePath = (pathValue) => (isAbsolute(pathValue) ? pathValue : resolve(rootDir, pathValue));
  const hashFile = (pathValue) => {
    const absolute = absolutePath(pathValue);
    if (!hashCache.has(absolute)) {
      hashCache.set(absolute, createHash('sha256').update(readFileSync(absolute)).digest('hex'));
    }
    return hashCache.get(absolute);
  };
  const probeMedia = (pathValue) => {
    const absolute = absolutePath(pathValue);
    if (probeCache.has(absolute)) return probeCache.get(absolute);
    const result = spawnSync(
      ffprobePath,
      ['-v', 'error', '-count_frames', '-show_entries', 'format=duration,format_name:stream=index,codec_type,width,height,avg_frame_rate,r_frame_rate,sample_rate,nb_frames,nb_read_frames', '-of', 'json', absolute],
      {encoding: 'utf8', maxBuffer: 16 * 1024 * 1024},
    );
    if (result.status !== 0) {
      const error = new Error((result.stderr || result.stdout || 'ffprobe failed').trim());
      error.code = 'FFPROBE_FAILED';
      throw error;
    }
    const parsed = JSON.parse(result.stdout);
    const video = asArray(parsed.streams).find((stream) => stream.codec_type === 'video');
    const audioStreams = asArray(parsed.streams).filter((stream) => stream.codec_type === 'audio');
    const audio = audioStreams[0];
    const durationSeconds = Number(parsed.format?.duration);
    const normalized = {
      durationSeconds,
      formatName: parsed.format?.format_name || '',
      hasVideo: Boolean(video),
      hasAudio: Boolean(audio),
      audioStreamCount: audioStreams.length,
      width: video ? Number(video.width) : null,
      height: video ? Number(video.height) : null,
      videoFrameRate: video ? parseRate(video.avg_frame_rate || video.r_frame_rate) : null,
      videoFrameCount: video ? Number(video.nb_read_frames || video.nb_frames) : null,
      audioSampleRate: audio ? Number(audio.sample_rate) : null,
    };
    probeCache.set(absolute, normalized);
    return normalized;
  };

  const decodeVideo = (pathValue) => {
    const absolute = absolutePath(pathValue);
    if (decodeCache.has(absolute)) return decodeCache.get(absolute);
    const result = spawnSync(
      ffmpegPath,
      ['-v', 'error', '-i', absolute, '-map', '0:v:0', '-f', 'framemd5', '-'],
      {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024},
    );
    if (result.status !== 0) {
      const error = new Error('ffmpeg full decode failed');
      error.code = 'FULL_DECODE_FAILED';
      throw error;
    }
    const frameHashes = result.stdout
      .split(/\r?\n/u)
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => line.split(',').at(-1)?.trim())
      .filter(isNonEmpty);
    if (!frameHashes.length) {
      const error = new Error('ffmpeg full decode produced no frames');
      error.code = 'FULL_DECODE_EMPTY';
      throw error;
    }
    let maxConsecutiveIdenticalFrames = 1;
    let runLength = 1;
    let consecutiveDuplicateFrames = 0;
    for (let index = 1; index < frameHashes.length; index += 1) {
      if (frameHashes[index] === frameHashes[index - 1]) {
        runLength += 1;
        consecutiveDuplicateFrames += 1;
        maxConsecutiveIdenticalFrames = Math.max(maxConsecutiveIdenticalFrames, runLength);
      } else {
        runLength = 1;
      }
    }
    const uniqueFrames = new Set(frameHashes).size;
    const decoded = {
      frameHashes,
      decodedFrameCount: frameHashes.length,
      uniqueFrameCount: uniqueFrames,
      duplicateFrameCount: frameHashes.length - uniqueFrames,
      duplicateFrameRatio: round((frameHashes.length - uniqueFrames) / frameHashes.length),
      consecutiveDuplicateFrames,
      maxConsecutiveIdenticalFrames,
      videoTimelineSha256: stableJsonSha256(frameHashes),
    };
    decodeCache.set(absolute, decoded);
    return decoded;
  };

  const measureSignal = (pathValue) => {
    const absolute = absolutePath(pathValue);
    if (signalCache.has(absolute)) return signalCache.get(absolute);
    const result = spawnSync(
      ffmpegPath,
      ['-v', 'error', '-i', absolute, '-map', '0:v:0', '-vf', 'signalstats,metadata=print:file=-', '-an', '-f', 'null', '-'],
      {encoding: 'utf8', maxBuffer: 128 * 1024 * 1024},
    );
    if (result.status !== 0) {
      const error = new Error('ffmpeg signalstats failed');
      error.code = 'SIGNALSTATS_FAILED';
      throw error;
    }
    const yavg = [...result.stdout.matchAll(/lavfi\.signalstats\.YAVG=([0-9.]+)/gu)].map((match) => Number(match[1]));
    if (!yavg.length) {
      const error = new Error('ffmpeg signalstats produced no frame metrics');
      error.code = 'SIGNALSTATS_EMPTY';
      throw error;
    }
    const measured = {
      measuredFrameCount: yavg.length,
      blackFrameCount: yavg.filter((value) => value <= 4).length,
      whiteFrameCount: yavg.filter((value) => value >= 251).length,
    };
    signalCache.set(absolute, measured);
    return measured;
  };

  const rawImageHash = (pathValue) => {
    const absolute = absolutePath(pathValue);
    const key = `image:${absolute}`;
    if (rawFrameCache.has(key)) return rawFrameCache.get(key);
    const result = spawnSync(
      ffmpegPath,
      ['-v', 'error', '-i', absolute, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
      {encoding: null, maxBuffer: 64 * 1024 * 1024},
    );
    if (result.status !== 0 || !result.stdout?.length) {
      const error = new Error('risk frame image decode failed');
      error.code = 'RISK_FRAME_IMAGE_DECODE_FAILED';
      throw error;
    }
    const hash = createHash('sha256').update(result.stdout).digest('hex');
    rawFrameCache.set(key, hash);
    return hash;
  };

  const rawVideoFrameHash = (pathValue, frameIndex) => {
    const absolute = absolutePath(pathValue);
    const key = `video:${absolute}:${frameIndex}`;
    if (rawFrameCache.has(key)) return rawFrameCache.get(key);
    const result = spawnSync(
      ffmpegPath,
      ['-v', 'error', '-i', absolute, '-vf', `select=eq(n\\,${frameIndex})`, '-vsync', '0', '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
      {encoding: null, maxBuffer: 64 * 1024 * 1024},
    );
    if (result.status !== 0 || !result.stdout?.length) {
      const error = new Error('video frame extraction failed');
      error.code = 'RISK_FRAME_VIDEO_DECODE_FAILED';
      throw error;
    }
    const hash = createHash('sha256').update(result.stdout).digest('hex');
    rawFrameCache.set(key, hash);
    return hash;
  };

  return {
    absolutePath,
    hashFile,
    probeMedia,
    decodeVideo,
    measureSignal,
    rawImageHash,
    rawVideoFrameHash,
    checkFiles,
  };
};

const validateHashBoundFile = ({
  item,
  path,
  codePrefix,
  services,
  errors,
  requireProbe = false,
  mediaKind = 'any',
}) => {
  if (!isRecord(item) || !isNonEmpty(item.path)) {
    errors.push({code: `${codePrefix}_PATH_REQUIRED`, path, message: '必须绑定非空文件路径'});
    return null;
  }
  if (!SHA256_RE.test(item.sha256 || '')) {
    errors.push({code: `${codePrefix}_SHA256_REQUIRED`, path: `${path}.sha256`, message: '必须绑定小写 64 位 SHA-256'});
    return null;
  }
  if (requireProbe && !isRecord(item.ffprobe)) {
    errors.push({code: `${codePrefix}_FFPROBE_REQUIRED`, path: `${path}.ffprobe`, message: '媒体必须绑定 ffprobe 摘要'});
    return null;
  }
  if (!services.checkFiles) return null;
  const absolute = services.absolutePath(item.path);
  if (!existsSync(absolute) || !statSync(absolute).isFile()) {
    errors.push({code: `${codePrefix}_FILE_MISSING`, path: `${path}.path`, message: '绑定文件不存在', details: {absolutePath: absolute}});
    return null;
  }
  const actualHash = services.hashFile(item.path);
  if (actualHash !== item.sha256) {
    errors.push({
      code: `${codePrefix}_SHA256_MISMATCH`,
      path: `${path}.sha256`,
      message: '文件内容 SHA-256 与合同不一致',
      details: {declared: item.sha256, actual: actualHash, absolutePath: absolute},
    });
    return null;
  }
  if (!requireProbe) return null;
  let actualProbe;
  try {
    actualProbe = services.probeMedia(item.path);
  } catch (error) {
    errors.push({code: `${codePrefix}_FFPROBE_FAILED`, path: `${path}.path`, message: error.message});
    return null;
  }
  const declared = item.ffprobe;
  if (!finite(declared.durationSeconds) || Math.abs(Number(declared.durationSeconds) - actualProbe.durationSeconds) > 0.12) {
    errors.push({
      code: `${codePrefix}_FFPROBE_MISMATCH`,
      path: `${path}.ffprobe.durationSeconds`,
      message: '声明时长与实际 ffprobe 不一致',
      details: {declared: declared.durationSeconds, actual: actualProbe.durationSeconds},
    });
    return actualProbe;
  }
  if (mediaKind === 'audio' && !actualProbe.hasAudio) {
    errors.push({code: `${codePrefix}_FFPROBE_MISMATCH`, path: `${path}.ffprobe.hasAudio`, message: '媒体没有可解码音轨'});
  }
  if (mediaKind === 'video') {
    const dimensionsMatch =
      actualProbe.hasVideo &&
      Number(declared.width) === actualProbe.width &&
      Number(declared.height) === actualProbe.height &&
      finite(declared.videoFrameRate) &&
      Math.abs(Number(declared.videoFrameRate) - actualProbe.videoFrameRate) <= 0.02;
    if (!dimensionsMatch) {
      errors.push({
        code: `${codePrefix}_FFPROBE_MISMATCH`,
        path: `${path}.ffprobe`,
        message: '视频尺寸或帧率与实际 ffprobe 不一致',
        details: {declared, actual: actualProbe},
      });
    }
  }
  return actualProbe;
};

const readVerifiedJsonReceipt = ({item, path, codePrefix, services, errors}) => {
  validateHashBoundFile({item, path, codePrefix, services, errors});
  if (!services.checkFiles || !isRecord(item) || !isNonEmpty(item.path) || !SHA256_RE.test(item.sha256 || '')) return null;
  const absolute = services.absolutePath(item.path);
  if (!existsSync(absolute) || !statSync(absolute).isFile()) return null;
  try {
    if (services.hashFile(item.path) !== item.sha256) return null;
    return JSON.parse(readFileSync(absolute, 'utf8'));
  } catch (error) {
    errors.push({code: `${codePrefix}_JSON_INVALID`, path, message: '回执文件不是可验证 JSON', details: {reason: error.message}});
    return null;
  }
};

const validateTechnicalQaReceipt = ({candidate, services, errors}) => {
  const path = 'lifecycle.candidate.technicalQaReceipt';
  const body = readVerifiedJsonReceipt({
    item: candidate?.technicalQaReceipt,
    path,
    codePrefix: 'DCV2_LIFECYCLE_TECHNICAL_QA_RECEIPT',
    services,
    errors,
  });
  if (!services.checkFiles || !body) return null;
  if (body.schema !== DIRECTOR_TECHNICAL_QA_SCHEMA || body.evidenceScope !== 'real-e2e' || body.status !== 'passed') {
    errors.push({code: 'DCV2_TECHNICAL_QA_SCHEMA_INVALID', path, message: '技术 QA 回执必须使用唯一 schema、real-e2e 且 status=passed'});
    return null;
  }
  if (body.candidatePath !== candidate?.media?.path || body.candidateSha256 !== candidate?.media?.sha256) {
    errors.push({code: 'DCV2_TECHNICAL_QA_CANDIDATE_BINDING_INVALID', path, message: '技术 QA 回执未绑定当前候选 MP4 路径与 SHA'});
    return null;
  }
  let probe;
  let decode;
  let signal;
  try {
    probe = services.probeMedia(candidate.media.path);
    decode = services.decodeVideo(candidate.media.path);
    signal = services.measureSignal(candidate.media.path);
  } catch (error) {
    errors.push({code: 'DCV2_TECHNICAL_QA_RECOMPUTE_FAILED', path, message: '无法重算候选片全解码/帧/信号质量指标', details: {reason: error.code || error.message}});
    return null;
  }
  const expectedFrames = Math.round(probe.durationSeconds * probe.videoFrameRate);
  const actual = {
    decodedFrameCount: decode.decodedFrameCount,
    ffprobeFrameCount: probe.videoFrameCount,
    expectedFrameCount: expectedFrames,
    blackFrameCount: signal.blackFrameCount,
    whiteFrameCount: signal.whiteFrameCount,
    maxConsecutiveIdenticalFrames: decode.maxConsecutiveIdenticalFrames,
    duplicateFrameCount: decode.duplicateFrameCount,
    duplicateFrameRatio: decode.duplicateFrameRatio,
    uniqueFrameCount: decode.uniqueFrameCount,
    videoTimelineSha256: decode.videoTimelineSha256,
  };
  const declared = body.checks;
  const declaredMatches =
    declared?.fullDecode?.passed === true &&
    Number(declared.fullDecode.decodedFrameCount) === actual.decodedFrameCount &&
    Number(declared.frameCount?.ffprobeFrameCount) === actual.ffprobeFrameCount &&
    Number(declared.frameCount?.expectedFrameCount) === actual.expectedFrameCount &&
    declared.blackWhite?.passed === true &&
    Number(declared.blackWhite.blackFrameCount) === actual.blackFrameCount &&
    Number(declared.blackWhite.whiteFrameCount) === actual.whiteFrameCount &&
    declared.freeze?.passed === true &&
    Number(declared.freeze.maxConsecutiveIdenticalFrames) === actual.maxConsecutiveIdenticalFrames &&
    declared.duplicate?.passed === true &&
    Number(declared.duplicate.duplicateFrameCount) === actual.duplicateFrameCount &&
    Math.abs(Number(declared.duplicate.duplicateFrameRatio) - actual.duplicateFrameRatio) <= 0.000001 &&
    declared.coverage?.passed === true &&
    Number(declared.coverage.coveredFrameCount) === actual.decodedFrameCount &&
    Number(declared.coverage.expectedFrameCount) === actual.expectedFrameCount &&
    declared.motion?.passed === true &&
    Number(declared.motion.uniqueFrameCount) === actual.uniqueFrameCount &&
    declared.videoTimelineSha256 === actual.videoTimelineSha256;
  if (!declaredMatches) {
    errors.push({code: 'DCV2_TECHNICAL_QA_METRICS_MISMATCH', path, message: '技术 QA 必须与本次实测全解码、帧数、黑白、冻结、重复、动态和覆盖指标一致', details: {actual}});
  }
  const technicalPass =
    Math.abs(actual.decodedFrameCount - actual.expectedFrameCount) <= 2 &&
    (!finite(actual.ffprobeFrameCount) || Math.abs(actual.ffprobeFrameCount - actual.decodedFrameCount) <= 2) &&
    actual.blackFrameCount === 0 &&
    actual.whiteFrameCount === 0 &&
    actual.maxConsecutiveIdenticalFrames <= Math.ceil(probe.videoFrameRate * 2) &&
    actual.duplicateFrameRatio <= 0.25 &&
    actual.uniqueFrameCount / actual.decodedFrameCount >= 0.75;
  if (!technicalPass) {
    errors.push({code: 'DCV2_TECHNICAL_QA_ACTUAL_FAILED', path, message: '候选片实测技术指标未达到全解码、黑白帧、冻结/重复帧与动态覆盖底线', details: {actual}});
  }
  return {body, probe, decode, signal, actual};
};

const allKnownIds = (items) => new Set(asArray(items).map((item) => item?.id).filter(isNonEmpty));
const invalidIds = (ids, known) => asArray(ids).filter((id) => !known.has(id));

export const computeDirectorMediaQaMetrics = (
  mediaPath,
  {rootDir = process.cwd(), ffprobePath = 'ffprobe', ffmpegPath = 'ffmpeg'} = {},
) => {
  const services = makeFileServices({rootDir: resolve(rootDir), checkFiles: true, ffprobePath, ffmpegPath});
  const probe = services.probeMedia(mediaPath);
  const decode = services.decodeVideo(mediaPath);
  const signal = services.measureSignal(mediaPath);
  return {
    probe,
    decodedFrameCount: decode.decodedFrameCount,
    ffprobeFrameCount: probe.videoFrameCount,
    expectedFrameCount: Math.round(probe.durationSeconds * probe.videoFrameRate),
    blackFrameCount: signal.blackFrameCount,
    whiteFrameCount: signal.whiteFrameCount,
    maxConsecutiveIdenticalFrames: decode.maxConsecutiveIdenticalFrames,
    duplicateFrameCount: decode.duplicateFrameCount,
    duplicateFrameRatio: decode.duplicateFrameRatio,
    uniqueFrameCount: decode.uniqueFrameCount,
    videoTimelineSha256: decode.videoTimelineSha256,
  };
};

export const validateDirectorContractV2 = (contract, options = {}) => {
  const rootDir = resolve(options.rootDir || process.cwd());
  const checkFiles = options.checkFiles !== false;
  const services = makeFileServices({
    rootDir,
    checkFiles,
    ffprobePath: options.ffprobePath || 'ffprobe',
    ffmpegPath: options.ffmpegPath || 'ffmpeg',
  });
  const errors = [];
  const report = {
    schemaVersion: contract?.schemaVersion || null,
    contractId: contract?.contractId || null,
    evidenceScope: contract?.evidenceScope || null,
    fileVerification: checkFiles ? 'enabled' : 'disabled-fixture-only',
    screenRecordings: [],
    visualCoverage: null,
    formalLocked: null,
    lifecycle: {
      state: contract?.lifecycle?.state || null,
      productionEligible: contract?.productionEligible ?? null,
      handoffBindingSha256: contract?.lifecycle?.handoff?.bindingSha256 || null,
    },
  };
  const push = (code, path, message, details) => errors.push({code, path, message, ...(details ? {details} : {})});

  if (!isRecord(contract)) {
    return {ok: false, schemaVersion: null, errors: [{code: 'DCV2_CONTRACT_OBJECT_REQUIRED', path: '$', message: '合同必须是 JSON 对象'}], report};
  }
  if (contract.schemaVersion !== DIRECTOR_CONTRACT_SCHEMA) {
    push('DCV2_SCHEMA_VERSION_INVALID', 'schemaVersion', `schemaVersion 必须是 ${DIRECTOR_CONTRACT_SCHEMA}`);
  }
  if (!isNonEmpty(contract.contractId)) push('DCV2_CONTRACT_ID_REQUIRED', 'contractId', '合同必须有稳定 contractId');
  if (!isNonEmpty(contract.executionGroupId)) {
    push('DCV2_EXECUTION_GROUP_ID_REQUIRED', 'executionGroupId', '合同必须标识执行组，用于阻断自签验收');
  }
  if (!isNonEmpty(contract.authorizedUserId)) {
    push('DCV2_AUTHORIZED_USER_ID_REQUIRED', 'authorizedUserId', '合同必须绑定有权验收用户');
  }
  if (!['fixture-only', 'real-e2e'].includes(contract.evidenceScope)) {
    push('DCV2_EVIDENCE_SCOPE_INVALID', 'evidenceScope', 'evidenceScope 只能是 fixture-only 或 real-e2e');
  }
  if (!checkFiles && contract.evidenceScope === 'real-e2e') {
    push('DCV2_REAL_E2E_FILE_CHECK_REQUIRED', 'evidenceScope', 'real-e2e 禁止关闭文件、SHA-256 与 ffprobe 检查');
  }
  if (!checkFiles && contract.lifecycle?.state !== 'candidate-blocked') {
    push('DCV2_FIXTURE_LIFECYCLE_ADVANCE_FORBIDDEN', 'lifecycle.state', '关闭文件检查时只能验证 candidate-blocked fixture，禁止模拟晋级');
  }
  try {
    assertNoRetiredGeneratedStyle({
      value: contract,
      operation: 'director-contract-v2-validation',
      location: '$.directorContract',
      projectRoot: rootDir,
    });
  } catch (error) {
    push('DCV2_RETIRED_GENERATED_STYLE', '$', error.message, {policyCode: error.code, hits: error.hits});
  }
  const lifecycleState = contract.lifecycle?.state;
  const expectedProductionEligible = lifecycleState === 'automation-handoff-eligible';
  if (contract.productionEligible !== expectedProductionEligible) {
    push(
      expectedProductionEligible ? 'DCV2_HANDOFF_PRODUCTION_ELIGIBILITY_REQUIRED' : 'DCV2_PRODUCTION_ELIGIBLE_MUST_BE_FALSE',
      'productionEligible',
      expectedProductionEligible ? '只有完整交接回执验证后才能标记 productionEligible=true' : '用户动态样片验收与交接前必须保持 false',
    );
  }

  const spoken = contract.spokenSource;
  if (!isRecord(spoken)) {
    push('DCV2_SPOKEN_SOURCE_REQUIRED', 'spokenSource', '必须绑定完整口播事实源');
  }
  const audio = spoken?.audio;
  const transcript = spoken?.transcript;
  const audioProbe = validateHashBoundFile({
    item: audio,
    path: 'spokenSource.audio',
    codePrefix: 'DCV2_AUDIO',
    services,
    errors,
    requireProbe: true,
    mediaKind: 'audio',
  });
  validateHashBoundFile({
    item: transcript,
    path: 'spokenSource.transcript',
    codePrefix: 'DCV2_TRANSCRIPT',
    services,
    errors,
  });
  if (audio?.completeness !== 'full-recording' || transcript?.authority !== 'recorded-audio') {
    push('DCV2_SPOKEN_SOURCE_COMPLETENESS_INVALID', 'spokenSource', '口播音频必须标记 full-recording，逐字稿权威必须是 recorded-audio');
  }

  let transcriptFileBody = null;
  if (checkFiles && isNonEmpty(transcript?.path) && existsSync(services.absolutePath(transcript.path))) {
    try {
      transcriptFileBody = JSON.parse(readFileSync(services.absolutePath(transcript.path), 'utf8'));
      if (transcriptFileBody.schema !== DIRECTOR_TRANSCRIPT_SCHEMA) {
        push('DCV2_TRANSCRIPT_FILE_SCHEMA_INVALID', 'spokenSource.transcript.path', `逐字稿文件 schema 必须是 ${DIRECTOR_TRANSCRIPT_SCHEMA}`);
      }
      for (const field of ['durationSeconds', 'segments', 'words']) {
        if (stableJsonSha256(transcriptFileBody[field]) !== stableJsonSha256(transcript?.[field])) {
          push('DCV2_TRANSCRIPT_FILE_BINDING_MISMATCH', `spokenSource.transcript.${field}`, '合同内嵌逐字时间轴与已绑定逐字稿文件不一致');
        }
      }
    } catch (error) {
      push('DCV2_TRANSCRIPT_FILE_JSON_INVALID', 'spokenSource.transcript.path', '逐字稿文件不是可解析 JSON', {reason: error.message});
    }
  }

  const transcriptDuration = Number(transcript?.durationSeconds);
  if (!finite(transcriptDuration) || transcriptDuration <= 0) {
    push('DCV2_TRANSCRIPT_DURATION_INVALID', 'spokenSource.transcript.durationSeconds', '逐字时间轴必须声明完整正时长');
  }
  if (audioProbe && finite(transcriptDuration) && Math.abs(audioProbe.durationSeconds - transcriptDuration) > 0.25) {
    push('DCV2_AUDIO_TRANSCRIPT_DURATION_MISMATCH', 'spokenSource.transcript.durationSeconds', '完整口播音频与逐字时间轴时长不一致', {
      audioDuration: round(audioProbe.durationSeconds),
      transcriptDuration,
    });
  }

  const transcriptSegments = asArray(transcript?.segments);
  const transcriptWords = asArray(transcript?.words);
  const transcriptSegmentIds = allKnownIds(transcriptSegments);
  const transcriptWordIds = allKnownIds(transcriptWords);
  if (!transcriptSegments.length || !transcriptWords.length) {
    push('DCV2_TRANSCRIPT_INDEX_REQUIRED', 'spokenSource.transcript', '逐字时间轴必须内嵌 segment 与 word 索引');
  }
  const transcriptDefect = finite(transcriptDuration) ? firstTimelineDefect(transcriptSegments, transcriptDuration) : null;
  if (transcriptDefect) {
    push('DCV2_TRANSCRIPT_TIMELINE_INCOMPLETE', 'spokenSource.transcript.segments', '逐字时间轴 segment 必须从 0 连续覆盖到全片结束', transcriptDefect);
  }
  const transcriptWordDefect = finite(transcriptDuration) ? firstTimelineDefect(transcriptWords, transcriptDuration) : null;
  if (transcriptWordDefect) {
    push('DCV2_TRANSCRIPT_WORD_TIMELINE_INVALID', 'spokenSource.transcript.words', '逐字稿 word 时间必须单调、无重叠且从 0 连续覆盖到全片结束', transcriptWordDefect);
  }

  const semanticSegments = asArray(contract.semanticSegments);
  const semanticIds = allKnownIds(semanticSegments);
  const semanticDefect = finite(transcriptDuration) ? firstTimelineDefect(semanticSegments, transcriptDuration) : null;
  if (semanticDefect) {
    push('DCV2_SEMANTIC_TIMELINE_INCOMPLETE', 'semanticSegments', '口播语义段必须从 0 连续覆盖到全片结束', semanticDefect);
  }
  for (const [index, segment] of semanticSegments.entries()) {
    const path = `semanticSegments[${index}]`;
    if (!isNonEmpty(segment.id) || !isNonEmpty(segment.spokenLine) || !isNonEmpty(segment.semanticPurpose)) {
      push('DCV2_SEMANTIC_SEGMENT_BINDING_INCOMPLETE', path, '每个语义段必须有 id、原句和语义目的');
      continue;
    }
    const badTranscriptSegments = invalidIds(segment.transcriptSegmentIds, transcriptSegmentIds);
    const badWords = invalidIds(segment.wordIds, transcriptWordIds);
    if (!asArray(segment.transcriptSegmentIds).length || !asArray(segment.wordIds).length || badTranscriptSegments.length || badWords.length) {
      push('DCV2_SEMANTIC_TRANSCRIPT_IDS_INVALID', path, '语义段必须绑定真实 transcript segment/word IDs', {
        badTranscriptSegments,
        badWords,
      });
    }
    const boundTranscriptSegments = transcriptSegments.filter((item) => asArray(segment.transcriptSegmentIds).includes(item.id));
    const boundWords = transcriptWords.filter((item) => asArray(segment.wordIds).includes(item.id));
    const rangeOverlapsWords = boundWords.length > 0 && boundWords.every((word) =>
      Number(word.end) > Number(segment.start) + EPSILON && Number(word.start) < Number(segment.end) - EPSILON);
    const expectedSpokenLine = boundTranscriptSegments.map((item) => item.text).join(' ').replace(/\s+/gu, ' ').trim();
    if (!rangeOverlapsWords || (expectedSpokenLine && segment.spokenLine.replace(/\s+/gu, ' ').trim() !== expectedSpokenLine)) {
      push('DCV2_SEMANTIC_TRANSCRIPT_CONTENT_MISMATCH', path, '语义段原句/时段必须与已解析逐字稿正文及真实词时段一致');
    }
  }

  const recordings = asArray(contract.screenRecordings);
  if (!recordings.length) {
    push('DCV2_SCREEN_RECORDING_REQUIRED', 'screenRecordings', '必须绑定任务范围内的完整录屏；没有录屏时应显式停在素材缺口阶段');
  }
  const recordingIds = allKnownIds(recordings);
  const recordingSegmentIndex = new Map();
  for (const [index, recording] of recordings.entries()) {
    const path = `screenRecordings[${index}]`;
    validateHashBoundFile({item: recording, path, codePrefix: 'DCV2_SCREEN_RECORDING', services, errors, requireProbe: true, mediaKind: 'video'});
    if (recording.completeness !== 'full-recording') {
      push('DCV2_SCREEN_RECORDING_COMPLETENESS_INVALID', `${path}.completeness`, '录屏必须绑定完整源文件，不能只把已裁片段冒充全量录屏');
    }
    if (!isNonEmpty(recording.id)) {
      push('DCV2_SCREEN_RECORDING_ID_REQUIRED', `${path}.id`, '每条完整录屏必须有稳定 ID');
      continue;
    }
    const duration = Number(recording.ffprobe?.durationSeconds);
    const segments = asArray(recording.segments);
    const defect = finite(duration) ? firstTimelineDefect(segments, duration) : {kind: 'duration'};
    if (defect) {
      push('DCV2_SCREEN_TIMELINE_INCOMPLETE', `${path}.segments`, '每条录屏必须由 used/excluded 分段从 0 连续覆盖到完整时长', defect);
    }
    let usedDuration = 0;
    for (const [segmentIndex, segment] of segments.entries()) {
      const segmentPath = `${path}.segments[${segmentIndex}]`;
      if (!['used', 'excluded'].includes(segment.disposition)) {
        push('DCV2_SCREEN_SEGMENT_DISPOSITION_INVALID', `${segmentPath}.disposition`, '录屏分段必须标记 used 或 excluded');
      }
      if (!isNonEmpty(segment.semanticReason)) {
        push('DCV2_SCREEN_SEGMENT_REASON_REQUIRED', `${segmentPath}.semanticReason`, 'used/excluded 都必须写语义理由');
      }
      if (segment.disposition === 'used' && finite(segment.start) && finite(segment.end)) {
        usedDuration += Number(segment.end) - Number(segment.start);
      }
      if (isNonEmpty(segment.id)) recordingSegmentIndex.set(`${recording.id}:${segment.id}`, segment);
    }
    report.screenRecordings.push({
      recordingId: recording.id,
      usedDuration: round(usedDuration),
      totalDuration: finite(duration) ? duration : null,
      usageRatio: finite(duration) && duration > 0 ? round(usedDuration / duration) : null,
      usageRatioPolicy: 'report-only-no-quality-threshold',
    });
  }

  const mappings = asArray(contract.screenMappings);
  const mappingIds = allKnownIds(mappings);
  const mappingsByRecordingSegment = new Map();
  for (const [index, mapping] of mappings.entries()) {
    const path = `screenMappings[${index}]`;
    const key = `${mapping.recordingId}:${mapping.recordingSegmentId}`;
    const sourceSegment = recordingSegmentIndex.get(key);
    if (!recordingIds.has(mapping.recordingId) || !sourceSegment) {
      push('DCV2_SCREEN_MAPPING_SOURCE_IDS_INVALID', path, '映射必须绑定已声明录屏与录屏分段 ID');
      continue;
    }
    if (!finite(mapping.sourceIn) || !finite(mapping.sourceOut) || Number(mapping.sourceOut) <= Number(mapping.sourceIn) + EPSILON || Number(mapping.sourceIn) < Number(sourceSegment.start) - EPSILON || Number(mapping.sourceOut) > Number(sourceSegment.end) + EPSILON) {
      push('DCV2_SCREEN_MAPPING_SOURCE_RANGE_INVALID', path, 'sourceIn/sourceOut 必须位于绑定录屏分段内');
    }
    if (
      !finite(mapping.outputIn) ||
      !finite(mapping.outputOut) ||
      Number(mapping.outputOut) <= Number(mapping.outputIn) + EPSILON ||
      Number(mapping.outputIn) < -EPSILON ||
      (finite(transcriptDuration) && Number(mapping.outputOut) > transcriptDuration + EPSILON) ||
      !finite(mapping.playbackRate) ||
      Number(mapping.playbackRate) <= 0
    ) {
      push('DCV2_SCREEN_MAPPING_OUTPUT_RANGE_INVALID', path, '录屏映射必须绑定合法 outputIn/outputOut 与正数 playbackRate');
    } else {
      const expectedOutputDuration = (Number(mapping.sourceOut) - Number(mapping.sourceIn)) / Number(mapping.playbackRate);
      const actualOutputDuration = Number(mapping.outputOut) - Number(mapping.outputIn);
      if (Math.abs(expectedOutputDuration - actualOutputDuration) > 0.08) {
        push('DCV2_SCREEN_MAPPING_OUTPUT_DURATION_MISMATCH', path, '输出时段与源时段/playbackRate 不一致');
      }
    }
    if (!isNonEmpty(mapping.visualEventId)) {
      push('DCV2_SCREEN_MAPPING_VISUAL_EVENT_REQUIRED', `${path}.visualEventId`, '录屏映射必须绑定 screen-recording 视觉事件');
    }
    const badSemanticIds = invalidIds(mapping.semanticSegmentIds, semanticIds);
    const badWordIds = invalidIds(mapping.wordIds, transcriptWordIds);
    if (!asArray(mapping.semanticSegmentIds).length || !asArray(mapping.wordIds).length || badSemanticIds.length || badWordIds.length) {
      push('DCV2_SCREEN_MAPPING_SPOKEN_IDS_INVALID', path, '映射必须绑定口播 semantic segment 与 subtitle word IDs', {badSemanticIds, badWordIds});
    }
    if (!isNonEmpty(mapping.selectionReason)) {
      push('DCV2_SCREEN_MAPPING_SELECTION_REASON_REQUIRED', `${path}.selectionReason`, '必须解释为何选择这段录屏，而非只报告使用率');
    }
    const current = mappingsByRecordingSegment.get(key) || [];
    current.push(mapping);
    mappingsByRecordingSegment.set(key, current);
  }
  for (const [key, segment] of recordingSegmentIndex.entries()) {
    if (segment.disposition === 'used' && !mappingsByRecordingSegment.has(key)) {
      push('DCV2_USED_SCREEN_SEGMENT_UNMAPPED', 'screenMappings', '所有 used 录屏分段必须至少有一条语义映射', {recordingSegment: key});
    }
  }

  const visualEvents = asArray(contract.visualEvents);
  const visualEventIds = allKnownIds(visualEvents);
  for (const [index, event] of visualEvents.entries()) {
    const path = `visualEvents[${index}]`;
    if (!isNonEmpty(event.id) || !finite(event.start) || !finite(event.end) || Number(event.end) <= Number(event.start) + EPSILON || Number(event.start) < -EPSILON || (finite(transcriptDuration) && Number(event.end) > transcriptDuration + EPSILON)) {
      push('DCV2_VISUAL_EVENT_RANGE_INVALID', path, '视觉事件必须有 ID 和有效进入/退出时间');
      continue;
    }
    if (!EFFECTIVE_VISUAL_KINDS.has(event.kind) && !NON_EFFECTIVE_VISUAL_KINDS.has(event.kind)) {
      push('DCV2_VISUAL_EVENT_KIND_INVALID', `${path}.kind`, '视觉事件 kind 未声明为有效语义画面或明确的非有效画面');
    }
    const badSemanticIds = invalidIds(event.semanticSegmentIds, semanticIds);
    const badWordIds = invalidIds(event.wordIds, transcriptWordIds);
    if (!asArray(event.semanticSegmentIds).length || !asArray(event.wordIds).length || badSemanticIds.length || badWordIds.length) {
      push('DCV2_VISUAL_EVENT_SPOKEN_BINDING_INVALID', path, '视觉事件必须绑定口播语义段与字幕词 ID', {badSemanticIds, badWordIds});
    }
    if (EFFECTIVE_VISUAL_KINDS.has(event.kind) && !isNonEmpty(event.cognitiveGain)) {
      push('DCV2_VISUAL_EVENT_COGNITIVE_GAIN_REQUIRED', `${path}.cognitiveGain`, '有效语义画面必须声明认知增量');
    }
    const boundWords = transcriptWords.filter((word) => asArray(event.wordIds).includes(word.id));
    if (!boundWords.some((word) => Number(word.end) > Number(event.start) + EPSILON && Number(word.start) < Number(event.end) - EPSILON)) {
      push('DCV2_VISUAL_EVENT_WORD_TIME_DISJOINT', path, '视觉事件必须与其绑定真实逐字稿词时段实际重合');
    }
  }
  for (const [index, mapping] of mappings.entries()) {
    const event = visualEvents.find((item) => item.id === mapping.visualEventId);
    if (
      !event ||
      event.kind !== 'screen-recording' ||
      event.screenMappingId !== mapping.id ||
      Math.abs(Number(event.start) - Number(mapping.outputIn)) > EPSILON ||
      Math.abs(Number(event.end) - Number(mapping.outputOut)) > EPSILON
    ) {
      push('DCV2_SCREEN_MAPPING_VISUAL_EVENT_INVALID', `screenMappings[${index}].visualEventId`, '录屏映射必须绑定同输出时段的 screen-recording 事件，且事件反向绑定 mappingId');
    }
  }

  const coveragePolicy = contract.visualCoveragePolicy;
  if (!isRecord(coveragePolicy) || !finite(coveragePolicy.minFullCoverageRatio) || Number(coveragePolicy.minFullCoverageRatio) <= 0 || Number(coveragePolicy.minFullCoverageRatio) > 1 || !finite(coveragePolicy.minPerSemanticSegmentRatio) || Number(coveragePolicy.minPerSemanticSegmentRatio) <= 0 || Number(coveragePolicy.minPerSemanticSegmentRatio) > 1) {
    push('DCV2_VISUAL_COVERAGE_POLICY_INVALID', 'visualCoveragePolicy', '必须显式声明 0—1 范围内的全片与逐语义段最低覆盖率');
  }
  if (!isRecord(coveragePolicy) || !finite(coveragePolicy.maxUnexplainedWindowSeconds) || Number(coveragePolicy.maxUnexplainedWindowSeconds) <= 0 || Number(coveragePolicy.maxUnexplainedWindowSeconds) > MAX_UNEXPLAINED_VISUAL_GAP_SECONDS) {
    push('DCV2_VISUAL_MAX_GAP_POLICY_INVALID', 'visualCoveragePolicy.maxUnexplainedWindowSeconds', '最大无解释空窗阈值必须大于 0 且不超过 15 秒');
  }
  if (finite(transcriptDuration) && transcriptDuration > 0) {
    report.visualCoverage = analyzeVisualCoverage({durationSeconds: transcriptDuration, semanticSegments, visualEvents});
    const maxWindow = report.visualCoverage.maxUnexplainedWindow;
    if (isRecord(coveragePolicy) && finite(coveragePolicy.maxUnexplainedWindowSeconds) && maxWindow.duration > Number(coveragePolicy.maxUnexplainedWindowSeconds) + EPSILON) {
      push('DCV2_VISUAL_MAX_GAP_EXCEEDED', 'visualEvents', '有效语义画面最大无解释空窗超出阈值；字幕、纯运镜、人物空讲不计有效覆盖', {
        thresholdSeconds: Number(coveragePolicy.maxUnexplainedWindowSeconds),
        window: maxWindow,
      });
    }
    if (isRecord(coveragePolicy) && finite(coveragePolicy.minFullCoverageRatio) && report.visualCoverage.fullCoverageRatio + EPSILON < Number(coveragePolicy.minFullCoverageRatio)) {
      push('DCV2_VISUAL_FULL_COVERAGE_TOO_LOW', 'visualEvents', '全片有效语义覆盖率低于合同阈值', {
        required: Number(coveragePolicy.minFullCoverageRatio),
        actual: report.visualCoverage.fullCoverageRatio,
      });
    }
    if (isRecord(coveragePolicy) && finite(coveragePolicy.minPerSemanticSegmentRatio)) {
      const failing = report.visualCoverage.perSemanticSegment.filter((item) => item.coverageRatio + EPSILON < Number(coveragePolicy.minPerSemanticSegmentRatio));
      if (failing.length) {
        push('DCV2_VISUAL_SEGMENT_COVERAGE_TOO_LOW', 'visualEvents', '至少一个口播语义段的有效画面覆盖率低于合同阈值', {
          required: Number(coveragePolicy.minPerSemanticSegmentRatio),
          failing,
        });
      }
    }
  }

  const presentations = asArray(contract.screenPresentations);
  const presentationMappingIds = new Set();
  for (const [index, presentation] of presentations.entries()) {
    const path = `screenPresentations[${index}]`;
    if (!mappingIds.has(presentation.mappingId)) {
      push('DCV2_SCREEN_PRESENTATION_MAPPING_INVALID', `${path}.mappingId`, '竖屏呈现合同必须绑定有效 screen mapping');
      continue;
    }
    presentationMappingIds.add(presentation.mappingId);
    const mapping = mappings.find((item) => item.id === presentation.mappingId);
    const recording = recordings.find((item) => item.id === mapping?.recordingId);
    const sourceDimensions = presentation.sourceDimensions;
    const dimensionsValid = isRecord(sourceDimensions) && Number(sourceDimensions.width) > 0 && Number(sourceDimensions.height) > 0;
    if (!dimensionsValid || Number(sourceDimensions.width) !== Number(recording?.ffprobe?.width) || Number(sourceDimensions.height) !== Number(recording?.ffprobe?.height)) {
      push('DCV2_PRESENTATION_SOURCE_DIMENSIONS_MISMATCH', `${path}.sourceDimensions`, '呈现合同 sourceDimensions 必须与录屏 ffprobe 一致');
      continue;
    }
    const isPortrait = Number(sourceDimensions.height) > Number(sourceDimensions.width);
    if (!isPortrait) continue;
    if (presentation.fit === 'contain' || presentation.fit === 'phone-frame') {
      if (presentation.crop !== 'none' || Number(presentation.scale) !== 1) {
        push('DCV2_PORTRAIT_DEFAULT_TRANSFORM_INVALID', path, '9:16→16:9 默认只能 contain/phone-frame、crop=none、scale=1');
      }
      continue;
    }
    if (presentation.fit !== 'cover') {
      push('DCV2_PORTRAIT_FIT_INVALID', `${path}.fit`, '竖屏 fit 必须是 contain、phone-frame 或显式 cover');
      continue;
    }
    const coverFieldsComplete =
      presentation.crop === 'manual' &&
      isRecord(presentation.focus) &&
      finite(presentation.focus.x) &&
      finite(presentation.focus.y) &&
      isRecord(presentation.safeArea) &&
      finite(presentation.safeArea.x) &&
      finite(presentation.safeArea.y) &&
      finite(presentation.safeArea.width) &&
      finite(presentation.safeArea.height) &&
      isRecord(presentation.objectPosition) &&
      finite(presentation.objectPosition.x) &&
      finite(presentation.objectPosition.y) &&
      isNonEmpty(presentation.cropReason);
    if (!coverFieldsComplete) {
      push('DCV2_PORTRAIT_COVER_CONTRACT_INCOMPLETE', path, 'cover 必须绑定 crop/focus/safe-area/objectPosition/cropReason');
      continue;
    }
    const riskFrames = presentation.riskFrames;
    const requiredMoments = ['first', 'middle', 'last'];
    if (!isRecord(riskFrames) || requiredMoments.some((moment) => !isRecord(riskFrames[moment]))) {
      push('DCV2_PORTRAIT_COVER_RISK_FRAMES_REQUIRED', `${path}.riskFrames`, 'cover 必须绑定首/中/尾实际渲染风险帧回执');
      continue;
    }
    const protectedElements = asArray(presentation.protectedElements);
    if (!protectedElements.length || protectedElements.some((element) => !isNonEmpty(element.id) || !['text', 'button', 'qr-code'].includes(element.kind) || !isRecord(element.sourceBox))) {
      push('DCV2_PORTRAIT_PROTECTED_ELEMENTS_REQUIRED', `${path}.protectedElements`, 'cover 必须声明源画面中的关键文字、按钮或二维码及其源坐标');
      continue;
    }
    for (const moment of requiredMoments) {
      const receipt = riskFrames[moment];
      validateHashBoundFile({item: receipt, path: `${path}.riskFrames.${moment}`, codePrefix: 'DCV2_PORTRAIT_RISK_FRAME', services, errors});
      const checks = asArray(receipt.keyContentChecks);
      const checkedIds = new Set(checks.map((check) => check.id));
      if (!isNonEmpty(receipt.reviewedBy) || !isNonEmpty(receipt.reviewedAt) || !checks.length || checks.some((check) => !isNonEmpty(check.id) || !['text', 'button', 'qr-code'].includes(check.kind) || check.visible !== true || check.clipped !== false) || protectedElements.some((element) => !checkedIds.has(element.id))) {
        push('DCV2_PORTRAIT_KEY_CONTENT_REVIEW_INCOMPLETE', `${path}.riskFrames.${moment}`, '风险帧必须逐项确认关键文字、按钮、二维码可见且未裁切');
      }
      const candidateMedia = contract.lifecycle?.candidate?.media;
      const candidateProbe = candidateMedia?.ffprobe;
      const expectedMoment = moment === 'first'
        ? Number(mapping.outputIn)
        : moment === 'middle'
          ? (Number(mapping.outputIn) + Number(mapping.outputOut)) / 2
          : Math.max(Number(mapping.outputIn), Number(mapping.outputOut) - 1 / Number(candidateProbe?.videoFrameRate || 30));
      const receiptBound =
        receipt.sourceVideoSha256 === recording?.sha256 &&
        receipt.candidateVideoSha256 === candidateMedia?.sha256 &&
        finite(receipt.atSeconds) &&
        Number.isInteger(receipt.frameIndex) &&
        receipt.frameIndex >= 0 &&
        finite(candidateProbe?.videoFrameRate) &&
        Math.abs(Number(receipt.atSeconds) - expectedMoment) <= 1 / Number(candidateProbe.videoFrameRate) + EPSILON &&
        Math.abs(receipt.frameIndex - Math.round(Number(receipt.atSeconds) * Number(candidateProbe.videoFrameRate))) <= 1;
      if (!receiptBound) {
        push('DCV2_PORTRAIT_RISK_FRAME_BINDING_INVALID', `${path}.riskFrames.${moment}`, '风险帧必须绑定录屏源 SHA、当前候选片 SHA 及首/中/尾真实 frame/time');
      } else if (checkFiles) {
        try {
          const imageHash = services.rawImageHash(receipt.path);
          const videoFrameHash = services.rawVideoFrameHash(candidateMedia.path, receipt.frameIndex);
          if (imageHash !== videoFrameHash) {
            push('DCV2_PORTRAIT_RISK_FRAME_PIXEL_MISMATCH', `${path}.riskFrames.${moment}`, '风险帧像素与候选片对应时点实际解码帧不一致');
          }
        } catch (error) {
          push('DCV2_PORTRAIT_RISK_FRAME_PIXEL_CHECK_FAILED', `${path}.riskFrames.${moment}`, '风险帧像素复核失败', {reason: error.code || error.message});
        }
      }
    }
  }
  for (const mapping of mappings) {
    const recording = recordings.find((item) => item.id === mapping.recordingId);
    if (Number(recording?.ffprobe?.height) > Number(recording?.ffprobe?.width) && !presentationMappingIds.has(mapping.id)) {
      push('DCV2_PORTRAIT_PRESENTATION_REQUIRED', 'screenPresentations', '每条 9:16 录屏映射必须有 16:9 呈现合同', {mappingId: mapping.id});
    }
  }

  const generated = asArray(contract.generatedInsertions);
  const generatedIds = allKnownIds(generated);
  for (const [index, insertion] of generated.entries()) {
    const path = `generatedInsertions[${index}]`;
    validateHashBoundFile({item: insertion.media, path: `${path}.media`, codePrefix: 'DCV2_GENERATED_MEDIA', services, errors, requireProbe: true, mediaKind: 'video'});
    if (!['user', 'provider'].includes(insertion.producer)) {
      push('DCV2_GENERATED_PRODUCER_INVALID', `${path}.producer`, 'generated-video producer 只能是 user 或 provider');
    }
    const badSemanticIds = invalidIds(insertion.semanticSegmentIds, semanticIds);
    const badWordIds = invalidIds(insertion.wordIds, transcriptWordIds);
    if (!asArray(insertion.semanticSegmentIds).length || !asArray(insertion.wordIds).length || badSemanticIds.length || badWordIds.length || !finite(insertion.enterAt) || !finite(insertion.exitAt) || Number(insertion.exitAt) <= Number(insertion.enterAt) + EPSILON) {
      push('DCV2_GENERATED_SPOKEN_BINDING_INVALID', path, '生成插片必须绑定真实口播语义、字幕词 ID 与进入/退出点');
    }
    const obstacle = insertion.cognitiveObstacle;
    if (!isRecord(obstacle) || !isNonEmpty(obstacle.description) || !isNonEmpty(obstacle.transcriptQuote) || !asArray(obstacle.evidenceWordIds).length || invalidIds(obstacle.evidenceWordIds, transcriptWordIds).length) {
      push('DCV2_GENERATED_OBSTACLE_EVIDENCE_REQUIRED', `${path}.cognitiveObstacle`, '必须用逐字稿证据说明真实认知障碍');
    }
    if (!isNonEmpty(insertion.cognitiveGain)) {
      push('DCV2_GENERATED_COGNITIVE_GAIN_REQUIRED', `${path}.cognitiveGain`, '生成插片必须声明不可由装饰替代的认知增量');
    }
    const nonSub = insertion.nonSubstitutability;
    const requiredAlternatives = ['realMedia', 'officialMaterial', 'screenRecording', 'remotion'];
    if (!isRecord(nonSub) || requiredAlternatives.some((key) => !isRecord(nonSub[key]) || nonSub[key].checked !== true || !isNonEmpty(nonSub[key].evidence) || !isNonEmpty(nonSub[key].whyInsufficient)) || !isNonEmpty(nonSub.conclusion)) {
      push('DCV2_GENERATED_NON_SUBSTITUTABILITY_INCOMPLETE', `${path}.nonSubstitutability`, '必须逐项证明真实/官方/录屏/Remotion 不能优先替代');
    }
    const authorization = insertion.authorization;
    if (!isRecord(authorization) || authorization.authorized !== true || !isNonEmpty(authorization.source) || !isNonEmpty(authorization.scope)) {
      push('DCV2_GENERATED_AUTHORIZATION_REQUIRED', `${path}.authorization`, 'user/provider 均必须绑定来源与授权范围');
    } else {
      validateHashBoundFile({item: authorization.receipt, path: `${path}.authorization.receipt`, codePrefix: 'DCV2_GENERATED_AUTH_RECEIPT', services, errors});
    }
    if (insertion.producer === 'provider') {
      validateHashBoundFile({item: insertion.approvedStill, path: `${path}.approvedStill`, codePrefix: 'DCV2_APPROVED_STILL', services, errors});
      validateHashBoundFile({item: insertion.stillApprovalReceipt, path: `${path}.stillApprovalReceipt`, codePrefix: 'DCV2_STILL_APPROVAL_RECEIPT', services, errors});
      validateHashBoundFile({item: insertion.generationRequestReceipt, path: `${path}.generationRequestReceipt`, codePrefix: 'DCV2_GENERATION_REQUEST_RECEIPT', services, errors});
      if (!SHA256_RE.test(insertion.requestBoundStillSha256 || '') || insertion.requestBoundStillSha256 !== insertion.approvedStill?.sha256) {
        push('DCV2_PROVIDER_REQUEST_STILL_HASH_MISMATCH', `${path}.requestBoundStillSha256`, '真实动态请求回执必须绑定用户批准静帧 SHA-256');
      }
    }
    const boundEvents = visualEvents.filter((event) => event.kind === 'generated-video' && event.generatedInsertionId === insertion.id);
    if (boundEvents.length !== 1 || Math.abs(Number(boundEvents[0]?.start) - Number(insertion.enterAt)) > EPSILON || Math.abs(Number(boundEvents[0]?.end) - Number(insertion.exitAt)) > EPSILON) {
      push('DCV2_GENERATED_EVENT_TIMING_MISMATCH', path, '每个生成插片必须恰好绑定一个同进入/退出点的 generated-video 视觉事件');
    }
  }
  for (const event of visualEvents.filter((item) => item.kind === 'generated-video')) {
    if (!generatedIds.has(event.generatedInsertionId)) {
      push('DCV2_GENERATED_VISUAL_EVENT_UNBOUND', 'visualEvents', 'generated-video 视觉事件必须绑定 generatedInsertionId', {visualEventId: event.id});
    }
  }

  const sfx = contract.sfxSubjectiveReview;
  if (!isRecord(sfx) || sfx.normalSpeed !== true || !isNonEmpty(sfx.reviewedBy) || !isNonEmpty(sfx.reviewedAt) || !['accepted', 'pending', 'revise'].includes(sfx.decision) || !isNonEmpty(sfx.notes)) {
    push('DCV2_SFX_REVIEW_REQUIRED', 'sfxSubjectiveReview', '必须绑定正常音量、正常速度的主观试听回执');
  } else {
    if (sfx.decision === 'revise') {
      push('DCV2_SFX_REVIEW_REVISE_BLOCKED', 'sfxSubjectiveReview.decision', '音效主观试听结论为 revise，必须返修，不得晋级');
    }
    const withProbe = validateHashBoundFile({item: sfx.withSound, path: 'sfxSubjectiveReview.withSound', codePrefix: 'DCV2_SFX_WITH_SOUND', services, errors, requireProbe: true, mediaKind: 'video'});
    const withoutProbe = validateHashBoundFile({item: sfx.withoutSound, path: 'sfxSubjectiveReview.withoutSound', codePrefix: 'DCV2_SFX_WITHOUT_SOUND', services, errors, requireProbe: true, mediaKind: 'video'});
    if (SHA256_RE.test(sfx.withSound?.sha256 || '') && sfx.withSound.sha256 === sfx.withoutSound?.sha256) {
      push('DCV2_SFX_AB_HASHES_IDENTICAL', 'sfxSubjectiveReview', '有声/无声 A/B 必须是两个不同内容哈希');
    }
    if (checkFiles && withProbe && withoutProbe && (!withProbe.hasAudio || withoutProbe.hasAudio)) {
      push('DCV2_SFX_AUDIO_TRACK_RELATION_INVALID', 'sfxSubjectiveReview', 'WithSfx 实测必须有音轨；NoSfx 本合同必须实测无音轨');
    }
  }

  const speakerSafety = contract.continuousSpeakerSafety;
  if (!isRecord(speakerSafety)) {
    push('DCV2_SPEAKER_SAFE_AREA_RECEIPT_REQUIRED', 'continuousSpeakerSafety', '必须绑定连续人物安全区回执');
  } else {
    validateHashBoundFile({item: speakerSafety.source, path: 'continuousSpeakerSafety.source', codePrefix: 'DCV2_SPEAKER_SOURCE', services, errors, requireProbe: true, mediaKind: 'video'});
    const samples = asArray(speakerSafety.sampleFrames).sort((a, b) => Number(a.at) - Number(b.at));
    const duration = Number(speakerSafety.source?.ffprobe?.durationSeconds);
    const hasMiddleSample = finite(duration) && samples.some((sample) => Number(sample.at) >= duration / 3 && Number(sample.at) <= (duration * 2) / 3);
    const fullRange = samples.length >= 3 && finite(duration) && Number(samples[0].at) <= 0.5 && Number(samples.at(-1).at) >= duration - 0.5 && hasMiddleSample;
    if (!fullRange) {
      push('DCV2_SPEAKER_SAFE_AREA_SAMPLES_INCOMPLETE', 'continuousSpeakerSafety.sampleFrames', '至少绑定首/中/尾实际采样帧，覆盖连续人物完整时长');
    }
    for (const [index, sample] of samples.entries()) {
      validateHashBoundFile({item: sample, path: `continuousSpeakerSafety.sampleFrames[${index}]`, codePrefix: 'DCV2_SPEAKER_SAMPLE_FRAME', services, errors});
      if (!isRecord(sample.subjectBox) || !isRecord(sample.safeArea) || sample.inside !== true || !isNonEmpty(sample.reviewedBy) || !isNonEmpty(sample.reviewedAt)) {
        push('DCV2_SPEAKER_SAFE_AREA_SAMPLE_INVALID', `continuousSpeakerSafety.sampleFrames[${index}]`, '采样帧必须绑定人物框、安全区和人工复核');
      }
      const frameRate = Number(speakerSafety.source?.ffprobe?.videoFrameRate);
      const sampleBindingValid =
        sample.sourceVideoSha256 === speakerSafety.source?.sha256 &&
        Number.isInteger(sample.frameIndex) &&
        sample.frameIndex >= 0 &&
        finite(sample.at) &&
        finite(frameRate) &&
        Math.abs(sample.frameIndex - Math.round(Number(sample.at) * frameRate)) <= 1;
      if (!sampleBindingValid) {
        push('DCV2_SPEAKER_SAMPLE_FRAME_BINDING_INVALID', `continuousSpeakerSafety.sampleFrames[${index}]`, '人物安全区样帧必须绑定源视频 SHA 与真实 frame/time');
      } else if (checkFiles) {
        try {
          if (services.rawImageHash(sample.path) !== services.rawVideoFrameHash(speakerSafety.source.path, sample.frameIndex)) {
            push('DCV2_SPEAKER_SAMPLE_FRAME_PIXEL_MISMATCH', `continuousSpeakerSafety.sampleFrames[${index}]`, '人物安全区样帧与源视频对应解码帧像素不一致');
          }
        } catch (error) {
          push('DCV2_SPEAKER_SAMPLE_FRAME_PIXEL_CHECK_FAILED', `continuousSpeakerSafety.sampleFrames[${index}]`, '人物样帧像素复核失败', {reason: error.code || error.message});
        }
      }
    }
  }

  const preview = contract.previewAB;
  if (!isRecord(preview) || !finite(preview.durationSeconds) || Number(preview.durationSeconds) < 30 || Number(preview.durationSeconds) > 45) {
    push('DCV2_PREVIEW_DURATION_OUT_OF_RANGE', 'previewAB.durationSeconds', 'V8 同画面 A/B 预览固定为 30—45 秒');
  }
  const variants = asArray(preview?.variants);
  const variantIds = new Set(variants.map((item) => item.id));
  if (variants.length !== 2 || !variantIds.has('A-with-sfx') || !variantIds.has('B-without-sfx')) {
    push('DCV2_PREVIEW_AB_REQUIRED', 'previewAB.variants', '必须恰好绑定 A-with-sfx 与 B-without-sfx 两个同画面预览');
  }
  const samePictureReceipt = readVerifiedJsonReceipt({item: preview?.samePictureReceipt, path: 'previewAB.samePictureReceipt', codePrefix: 'DCV2_PREVIEW_SAME_PICTURE_RECEIPT', services, errors});
  const variantProbes = new Map();
  for (const [index, variant] of variants.entries()) {
    const probe = validateHashBoundFile({item: variant, path: `previewAB.variants[${index}]`, codePrefix: 'DCV2_PREVIEW_VARIANT', services, errors, requireProbe: true, mediaKind: 'video'});
    if (probe) variantProbes.set(variant.id, probe);
    if (finite(preview?.durationSeconds) && finite(variant.ffprobe?.durationSeconds) && Math.abs(Number(variant.ffprobe.durationSeconds) - Number(preview.durationSeconds)) > 0.15) {
      push('DCV2_PREVIEW_VARIANT_DURATION_MISMATCH', `previewAB.variants[${index}].ffprobe.durationSeconds`, 'A/B 预览声明时长必须与预览合同一致');
    }
  }
  const withVariant = variants.find((item) => item.id === 'A-with-sfx');
  const withoutVariant = variants.find((item) => item.id === 'B-without-sfx');
  if (isRecord(sfx) && withVariant && withoutVariant && (sfx.withSound?.sha256 !== withVariant.sha256 || sfx.withoutSound?.sha256 !== withoutVariant.sha256)) {
    push('DCV2_SFX_REVIEW_PREVIEW_BINDING_MISMATCH', 'sfxSubjectiveReview', '主观试听回执必须绑定当前 A/B 预览内容哈希');
  }
  if (lifecycleState !== 'candidate-blocked' && sfx?.decision !== 'accepted') {
    push('DCV2_SFX_ACCEPTANCE_REQUIRED_FOR_ADVANCE', 'sfxSubjectiveReview.decision', '风格晋级前 SFX A/B 主观结论必须是 accepted');
  }
  if (lifecycleState !== 'candidate-blocked') {
    const candidateMedia = contract.lifecycle?.candidate?.media;
    const candidateRange = contract.lifecycle?.candidate?.range;
    const previewRange = preview?.candidateRange;
    const candidateDuration = Number(candidateMedia?.ffprobe?.durationSeconds);
    const rangeValid =
      isRecord(candidateRange) &&
      isRecord(previewRange) &&
      Math.abs(Number(candidateRange.start) - 0) <= EPSILON &&
      Math.abs(Number(candidateRange.end) - candidateDuration) <= 0.15 &&
      Math.abs(Number(previewRange.start) - Number(candidateRange.start)) <= EPSILON &&
      Math.abs(Number(previewRange.end) - Number(candidateRange.end)) <= EPSILON;
    if (!rangeValid) {
      push('DCV2_PREVIEW_CANDIDATE_RANGE_MISMATCH', 'previewAB.candidateRange', 'candidate/WithSfx/NoSfx 必须绑定同一候选范围');
    }
    if (checkFiles && withVariant && withoutVariant && candidateMedia) {
      try {
        const candidateProbe = services.probeMedia(candidateMedia.path);
        const withProbe = variantProbes.get('A-with-sfx');
        const withoutProbe = variantProbes.get('B-without-sfx');
        const specsValid =
          candidateProbe.width >= 1920 &&
          candidateProbe.height >= 1080 &&
          candidateProbe.videoFrameRate >= 29.97 &&
          candidateProbe.durationSeconds >= 30 &&
          candidateProbe.durationSeconds <= 45.15 &&
          withProbe?.width === candidateProbe.width &&
          withProbe?.height === candidateProbe.height &&
          withoutProbe?.width === candidateProbe.width &&
          withoutProbe?.height === candidateProbe.height &&
          Math.abs(withProbe?.videoFrameRate - candidateProbe.videoFrameRate) <= 0.02 &&
          Math.abs(withoutProbe?.videoFrameRate - candidateProbe.videoFrameRate) <= 0.02 &&
          Math.abs(withProbe?.durationSeconds - candidateProbe.durationSeconds) <= 0.15 &&
          Math.abs(withoutProbe?.durationSeconds - candidateProbe.durationSeconds) <= 0.15;
        if (!specsValid) {
          push('DCV2_ADVANCE_MEDIA_SPEC_INVALID', 'lifecycle.candidate.media', '晋级媒体必须实测至少 1920x1080/30fps/30‑45s，且三片尺寸、帧率、时长一致');
        }
        const candidateDecode = services.decodeVideo(candidateMedia.path);
        const withDecode = services.decodeVideo(withVariant.path);
        const withoutDecode = services.decodeVideo(withoutVariant.path);
        const actualSamePicture =
          candidateDecode.videoTimelineSha256 === withDecode.videoTimelineSha256 &&
          candidateDecode.videoTimelineSha256 === withoutDecode.videoTimelineSha256 &&
          candidateDecode.decodedFrameCount === withDecode.decodedFrameCount &&
          candidateDecode.decodedFrameCount === withoutDecode.decodedFrameCount;
        if (!actualSamePicture) {
          push('DCV2_PREVIEW_ACTUAL_VIDEO_FRAMES_MISMATCH', 'previewAB.variants', 'candidate/WithSfx/NoSfx 实际全解码视频帧不是同一画面时间线');
        }
        const receiptValid =
          samePictureReceipt?.schema === 'director-ab-picture-match/v2' &&
          samePictureReceipt?.evidenceScope === 'real-e2e' &&
          samePictureReceipt?.candidateSha256 === candidateMedia.sha256 &&
          samePictureReceipt?.withSfxSha256 === withVariant.sha256 &&
          samePictureReceipt?.withoutSfxSha256 === withoutVariant.sha256 &&
          samePictureReceipt?.decodedFrameCount === candidateDecode.decodedFrameCount &&
          samePictureReceipt?.videoTimelineSha256 === candidateDecode.videoTimelineSha256;
        if (!receiptValid) {
          push('DCV2_PREVIEW_SAME_PICTURE_RECEIPT_CONTENT_INVALID', 'previewAB.samePictureReceipt', '同画面回执必须绑定三片 SHA 及本次实际全解码帧时间线');
        }
      } catch (error) {
        push('DCV2_PREVIEW_ACTUAL_COMPARISON_FAILED', 'previewAB', 'A/B/候选片实际全解码对比失败', {reason: error.code || error.message});
      }
    }
  }

  const formal = contract.formal;
  report.formalLocked = isRecord(formal) && formal.enabled === false;
  if (!isRecord(formal) || formal.enabled !== false || !isNonEmpty(formal.lockReason)) {
    push('DCV2_FORMAL_LOCK_REQUIRED', 'formal', 'formal 默认必须关闭并写明锁定原因');
  }

  const lifecycle = contract.lifecycle;
  if (!isRecord(lifecycle) || !['candidate-blocked', 'user-accepted-style', 'automation-handoff-eligible'].includes(lifecycle.state)) {
    push('DCV2_LIFECYCLE_STATE_INVALID', 'lifecycle.state', '状态只能按 candidate-blocked → user-accepted-style → automation-handoff-eligible 推进');
  } else {
    const candidate = lifecycle.candidate;
    validateHashBoundFile({item: candidate?.media, path: 'lifecycle.candidate.media', codePrefix: 'DCV2_LIFECYCLE_CANDIDATE_MEDIA', services, errors, requireProbe: true, mediaKind: 'video'});
    if (!isRecord(candidate) || !['low-fidelity-prototype', 'reviewable-full-fidelity-sample'].includes(candidate.qualityClass)) {
      push('DCV2_LIFECYCLE_CANDIDATE_QUALITY_CLASS_INVALID', 'lifecycle.candidate.qualityClass', '候选必须标记 low-fidelity-prototype 或 reviewable-full-fidelity-sample');
    }
    if (lifecycle.state === 'candidate-blocked') {
      if (lifecycle.styleAcceptance?.status === 'accepted' || isRecord(lifecycle.handoff)) {
        push('DCV2_LIFECYCLE_BLOCKED_STATE_HAS_ADVANCE_RECEIPT', 'lifecycle', 'candidate-blocked 不得携带已接受或交接完成状态');
      }
    } else {
      if (contract.evidenceScope !== 'real-e2e') {
        push('DCV2_LIFECYCLE_REAL_E2E_REQUIRED', 'evidenceScope', 'fixture-only 只能证明回归，不能晋级为用户接受风格或自动化交接');
      }
      if (!isNonEmpty(contract.contractRevisionId)) {
        push('DCV2_CONTRACT_REVISION_REQUIRED_FOR_ADVANCE', 'contractRevisionId', '候选晋级必须绑定稳定合同修订号，禁止复用旧验收消息');
      }
      if (!checkFiles) {
        push('DCV2_LIFECYCLE_REAL_FILE_CHECK_REQUIRED', 'evidenceScope', '候选晋级必须打开真实文件、媒体解码与回执内容检查');
      }
      if (candidate?.qualityClass !== 'reviewable-full-fidelity-sample') {
        push('DCV2_LIFECYCLE_LOW_FIDELITY_CANNOT_ADVANCE', 'lifecycle.candidate.qualityClass', '低保真样片不能晋级为用户接受风格或自动化交接');
      }
      if (candidate?.technicalQaStatus !== 'passed') {
        push('DCV2_LIFECYCLE_TECHNICAL_QA_NOT_PASSED', 'lifecycle.candidate.technicalQaStatus', '晋级前技术 QA 回执必须为 passed');
      }
      validateTechnicalQaReceipt({candidate, services, errors});
      const acceptance = lifecycle.styleAcceptance;
      const fullWatch = acceptance?.normalSpeedFullWatch;
      const candidateDuration = Number(candidate?.media?.ffprobe?.durationSeconds);
      const withSfx = contract.previewAB?.variants?.find((item) => item.id === 'A-with-sfx');
      const withoutSfx = contract.previewAB?.variants?.find((item) => item.id === 'B-without-sfx');
      const acceptanceComplete =
        acceptance?.status === 'accepted' &&
        isRecord(fullWatch) &&
        fullWatch.completed === true &&
        fullWatch.normalSpeed === true &&
        fullWatch.decision === 'accepted' &&
        isNonEmpty(fullWatch.reviewer) &&
        isNonEmpty(fullWatch.reviewedAt) &&
        isNonEmpty(fullWatch.conclusion) &&
        fullWatch.candidateMp4Sha256 === candidate?.media?.sha256 &&
        finite(fullWatch.fullDurationSeconds) &&
        finite(candidateDuration) &&
        Math.abs(Number(fullWatch.fullDurationSeconds) - candidateDuration) <= 0.15 &&
        acceptance.withSfxSha256 === withSfx?.sha256 &&
        acceptance.withoutSfxSha256 === withoutSfx?.sha256;
      if (!acceptanceComplete) {
        push('DCV2_LIFECYCLE_STYLE_ACCEPTANCE_INCOMPLETE', 'lifecycle.styleAcceptance', '用户接受必须绑定候选 MP4 SHA、正常速度完整观看、A/B SHA、审阅人、时间与接受结论');
      }
      const humanReview = readVerifiedJsonReceipt({
        item: acceptance?.humanReviewReceipt,
        path: 'lifecycle.styleAcceptance.humanReviewReceipt',
        codePrefix: 'DCV2_LIFECYCLE_HUMAN_REVIEW_RECEIPT',
        services,
        errors,
      });
      const humanReviewValid = humanReview &&
        humanReview.schema === DIRECTOR_HUMAN_REVIEW_SCHEMA &&
        humanReview.evidenceScope === 'real-e2e' &&
        humanReview.decision === 'accepted' &&
        humanReview.accepted === true &&
        humanReview.authorizedUserId === contract.authorizedUserId &&
        humanReview.reviewerId === contract.authorizedUserId &&
        isNonEmpty(humanReview.issuerGroupId) &&
        humanReview.issuerGroupId !== contract.executionGroupId &&
        isNonEmpty(humanReview.sourceThreadId) &&
        isNonEmpty(humanReview.sourceMessageId) &&
        isNonEmpty(humanReview.explicitAcceptanceQuote) &&
        humanReview.sourceMessageSha256 === createHash('sha256').update(humanReview.explicitAcceptanceQuote).digest('hex') &&
        humanReview.contractRevisionId === contract.contractRevisionId &&
        humanReview.candidateMp4Sha256 === candidate?.media?.sha256 &&
        humanReview.technicalQaReceiptSha256 === candidate?.technicalQaReceipt?.sha256 &&
        humanReview.withSfxSha256 === withSfx?.sha256 &&
        humanReview.withoutSfxSha256 === withoutSfx?.sha256 &&
        humanReview.normalSpeed === true &&
        humanReview.fullWatchCompleted === true &&
        finite(humanReview.watchedDurationSeconds) &&
        finite(humanReview.candidateDurationSeconds) &&
        Math.abs(Number(humanReview.watchedDurationSeconds) - candidateDuration) <= 0.15 &&
        Math.abs(Number(humanReview.candidateDurationSeconds) - candidateDuration) <= 0.15 &&
        humanReview.sfxDecision === 'accepted' &&
        isNonEmpty(humanReview.reviewedAt) &&
        !Number.isNaN(Date.parse(humanReview.reviewedAt)) &&
        isNonEmpty(humanReview.expiresAt) &&
        !Number.isNaN(Date.parse(humanReview.expiresAt)) &&
        Date.parse(humanReview.expiresAt) > Date.parse(humanReview.reviewedAt) &&
        Date.parse(humanReview.expiresAt) > Date.now();
      if (!humanReviewValid) {
        push('DCV2_HUMAN_REVIEW_RECEIPT_CONTENT_INVALID', 'lifecycle.styleAcceptance.humanReviewReceipt', '人工验收回执必须为唯一 schema、real-e2e，绑定授权用户、独立组、合同修订、原始消息、完整观看/候选时长、候选/QA/A-B SHA、accepted 结论与有效期');
      }
      const humanAnchor = externalAcceptanceAnchorMatches(humanReview, 'human-style-acceptance');
      if (!humanAnchor.ok) {
        push('DCV2_HUMAN_REVIEW_EXTERNAL_ANCHOR_INVALID', 'lifecycle.styleAcceptance.humanReviewReceipt', '人工验收回执必须绑定独立外部消息锚点，不得使用执行器自造 fixture/test 回执', {reason: humanAnchor.reason});
      }

      if (lifecycle.state === 'user-accepted-style') {
        if (isRecord(lifecycle.handoff)) {
          push('DCV2_LIFECYCLE_HANDOFF_PREMATURE', 'lifecycle.handoff', 'user-accepted-style 尚未形成自动化交接回执');
        }
      } else {
        const handoff = lifecycle.handoff;
        if (!isRecord(handoff)) {
          push('DCV2_LIFECYCLE_HANDOFF_REQUIRED', 'lifecycle.handoff', 'automation-handoff-eligible 必须有稳定哈希交接回执，不能只改布尔值');
        } else {
          const supervisorReview = readVerifiedJsonReceipt({
            item: handoff.supervisorReviewReceipt,
            path: 'lifecycle.handoff.supervisorReviewReceipt',
            codePrefix: 'DCV2_LIFECYCLE_SUPERVISOR_REVIEW_RECEIPT',
            services,
            errors,
          });
          const snapshotSha256 = computeHandoffContractSnapshotSha256(contract);
          const supervisorValid = supervisorReview &&
            supervisorReview.schema === DIRECTOR_SUPERVISOR_REVIEW_SCHEMA &&
            supervisorReview.evidenceScope === 'real-e2e' &&
            supervisorReview.decision === 'accepted' &&
            supervisorReview.accepted === true &&
            isNonEmpty(supervisorReview.supervisorId) &&
            isNonEmpty(supervisorReview.issuerGroupId) &&
            supervisorReview.issuerGroupId !== contract.executionGroupId &&
            isNonEmpty(supervisorReview.sourceThreadId) &&
            isNonEmpty(supervisorReview.sourceMessageId) &&
            supervisorReview.sourceThreadId !== humanReview?.sourceThreadId &&
            supervisorReview.sourceMessageId !== humanReview?.sourceMessageId &&
            isNonEmpty(supervisorReview.explicitAcceptanceQuote) &&
            supervisorReview.sourceMessageSha256 === createHash('sha256').update(supervisorReview.explicitAcceptanceQuote).digest('hex') &&
            supervisorReview.contractRevisionId === contract.contractRevisionId &&
            supervisorReview.contractSnapshotSha256 === snapshotSha256 &&
            supervisorReview.handoffSupervisionBindingSha256 === computeHandoffSupervisionBindingSha256(contract) &&
            supervisorReview.candidateMp4Sha256 === candidate?.media?.sha256 &&
            supervisorReview.technicalQaReceiptSha256 === candidate?.technicalQaReceipt?.sha256 &&
            supervisorReview.humanReviewReceiptSha256 === acceptance?.humanReviewReceipt?.sha256 &&
            supervisorReview.withSfxSha256 === withSfx?.sha256 &&
            supervisorReview.withoutSfxSha256 === withoutSfx?.sha256 &&
            isNonEmpty(supervisorReview.reviewedAt) &&
            !Number.isNaN(Date.parse(supervisorReview.reviewedAt)) &&
            isNonEmpty(supervisorReview.expiresAt) &&
            !Number.isNaN(Date.parse(supervisorReview.expiresAt)) &&
            Date.parse(supervisorReview.expiresAt) > Date.parse(supervisorReview.reviewedAt) &&
            Date.parse(supervisorReview.expiresAt) > Date.now();
          if (!supervisorValid) {
            push('DCV2_SUPERVISOR_REVIEW_RECEIPT_CONTENT_INVALID', 'lifecycle.handoff.supervisorReviewReceipt', '监督验收回执必须来自非执行组且独立消息，并绑定合同修订/快照、监督交接绑定、候选、QA、人工验收、A/B SHA 与有效期');
          }
          const supervisorAnchor = externalAcceptanceAnchorMatches(supervisorReview, 'supervisor-handoff-acceptance');
          if (!supervisorAnchor.ok) {
            push('DCV2_SUPERVISOR_REVIEW_EXTERNAL_ANCHOR_INVALID', 'lifecycle.handoff.supervisorReviewReceipt', '监督验收回执必须绑定独立外部消息锚点，不得使用执行器自造 fixture/test 回执', {reason: supervisorAnchor.reason});
          }
          const handoffReceipt = readVerifiedJsonReceipt({item: handoff.receipt, path: 'lifecycle.handoff.receipt', codePrefix: 'DCV2_LIFECYCLE_HANDOFF_RECEIPT', services, errors});
          const expectedPayload = buildHandoffBindingPayload(contract);
          const expectedBinding = stableJsonSha256(expectedPayload);
          const declaredPayload = handoff.bindingPayload;
          if (!isRecord(declaredPayload) || JSON.stringify(stableValue(declaredPayload)) !== JSON.stringify(stableValue(expectedPayload)) || handoff.bindingSha256 !== expectedBinding) {
            push('DCV2_LIFECYCLE_HANDOFF_BINDING_INVALID', 'lifecycle.handoff', '交接稳定哈希必须同时绑定合同快照、候选样片、技术 QA、人工回执和 A/B 预览');
          }
          const handoffReceiptValid =
            handoffReceipt?.schema === DIRECTOR_HANDOFF_RECEIPT_SCHEMA &&
            handoffReceipt?.evidenceScope === 'real-e2e' &&
            handoffReceipt?.status === 'automation-handoff-eligible' &&
            handoffReceipt?.contractRevisionId === contract.contractRevisionId &&
            handoffReceipt?.supervisionBindingSha256 === computeHandoffSupervisionBindingSha256(contract) &&
            handoffReceipt?.supervisorReviewReceiptSha256 === handoff.supervisorReviewReceipt?.sha256 &&
            JSON.stringify(stableValue(handoffReceipt?.bindingPayload)) === JSON.stringify(stableValue(expectedPayload)) &&
            handoffReceipt?.bindingSha256 === expectedBinding;
          if (!handoffReceiptValid) {
            push('DCV2_LIFECYCLE_HANDOFF_RECEIPT_CONTENT_INVALID', 'lifecycle.handoff.receipt', '交接回执必须使用唯一 schema，绑定监督回执 SHA、合同快照、候选、QA、人工验收与 A/B 稳定哈希');
          }
          if (containsFixtureOrTestMarker(handoffReceipt)) {
            push('DCV2_HANDOFF_RECEIPT_TEST_MARKER_FORBIDDEN', 'lifecycle.handoff.receipt', '交接回执含 fixture/test/non-project 标记，不得进入生产状态机');
          }
        }
      }
    }
  }

  const rights = contract.rightsBoundary;
  if (!isRecord(rights) || rights.internalMechanismStudyOnly !== true || rights.copyBrandAssets === true || rights.copySpecificLayouts === true || rights.copySpecificShots === true || rights.copyPhotographs === true || !isNonEmpty(rights.originalTransformationPlan)) {
    push('DCV2_RIGHTS_BOUNDARY_INCOMPLETE', 'rightsBoundary', '参考素材只能内部研究机制，必须阻断品牌/照片/具体版式/具体镜头复制并声明独创转换');
  }

  return {
    ok: errors.length === 0,
    schemaVersion: contract.schemaVersion || null,
    errors,
    report,
  };
};

export const formatValidationText = (result) => {
  if (result.ok) {
    const coverage = result.report.visualCoverage;
    return [
      `[DCV2_OK] ${result.report.contractId}`,
      `evidenceScope=${result.report.evidenceScope}`,
      `fullVisualCoverage=${coverage?.fullCoverageRatio ?? 'n/a'}`,
      `maxUnexplainedWindow=${coverage?.maxUnexplainedWindow?.duration ?? 'n/a'}s`,
      `lifecycle=${result.report.lifecycle?.state ?? 'n/a'}`,
      `productionEligible=${result.report.lifecycle?.productionEligible ?? 'n/a'}`,
      `formalLocked=${result.report.formalLocked}`,
    ].join('\n');
  }
  return result.errors
    .map((error) => `[${error.code}] ${error.path}: ${error.message}${error.details ? ` ${JSON.stringify(error.details)}` : ''}`)
    .join('\n');
};
