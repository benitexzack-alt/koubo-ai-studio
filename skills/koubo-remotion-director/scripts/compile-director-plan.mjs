#!/usr/bin/env node

import {createHash} from 'node:crypto';
import {
  closeSync,
  constants as fsConstants,
  existsSync,
  fchmodSync,
  fstatSync,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  realpathSync,
  statSync,
  writeSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {inflateSync} from 'node:zlib';
import {
  DIRECTOR_RUNTIME_COMMON_FILES,
  DIRECTOR_RUNTIME_FILE_CONTRACT_ID,
  DIRECTOR_RUNTIME_RENDERABLE_FILES,
  DIRECTOR_VISUAL_PRIMITIVE_CAPABILITIES,
  DIRECTOR_VISUAL_PRIMITIVES,
  DIRECTOR_VISUAL_ROLE_CAPABILITIES,
  DIRECTOR_VISUAL_ROLES,
  assertComplexVisualRoleOrder,
  lockedSceneCompletionWindow,
  sceneCompletionWindow,
  sceneCompletionMinimumLockFrames,
  screenClipFrameState,
  validateDirectorPlanStructure,
  validateScreenClipFrameLifecycle,
} from '../assets/remotion-paper-editorial/style.ts';

export const REQUEST_SCHEMA = 'koubo-director-request/v1';
export const OUTPUT_SCHEMA = 'koubo-director-output/v1';
export const CONTROLLED_VISUAL_PRIMITIVES = new Set(DIRECTOR_VISUAL_PRIMITIVES);
export const CONTROLLED_VISUAL_ROLES = new Set(DIRECTOR_VISUAL_ROLES);
export const VISUAL_PRIMITIVE_CAPABILITIES = Object.freeze({
  complex: new Set(DIRECTOR_VISUAL_PRIMITIVE_CAPABILITIES.complex),
  mechanicalInput: new Set(DIRECTOR_VISUAL_PRIMITIVE_CAPABILITIES.mechanicalInput),
  mechanicalAction: new Set(DIRECTOR_VISUAL_PRIMITIVE_CAPABILITIES.mechanicalAction),
  mechanicalOutput: new Set(DIRECTOR_VISUAL_PRIMITIVE_CAPABILITIES.mechanicalOutput),
  mechanicalSupport: new Set(DIRECTOR_VISUAL_PRIMITIVE_CAPABILITIES.mechanicalSupport),
  occludedInput: new Set(DIRECTOR_VISUAL_PRIMITIVE_CAPABILITIES.occludedInput),
  occludedOccluder: new Set(DIRECTOR_VISUAL_PRIMITIVE_CAPABILITIES.occludedOccluder),
  occludedOutput: new Set(DIRECTOR_VISUAL_PRIMITIVE_CAPABILITIES.occludedOutput),
  occludedSupport: new Set(DIRECTOR_VISUAL_PRIMITIVE_CAPABILITIES.occludedSupport),
});
export const VISUAL_ROLE_CAPABILITIES = Object.freeze({
  complex: new Set(DIRECTOR_VISUAL_ROLE_CAPABILITIES.complex),
  mechanicalInput: new Set(DIRECTOR_VISUAL_ROLE_CAPABILITIES.mechanicalInput),
  mechanicalAction: new Set(DIRECTOR_VISUAL_ROLE_CAPABILITIES.mechanicalAction),
  mechanicalOutput: new Set(DIRECTOR_VISUAL_ROLE_CAPABILITIES.mechanicalOutput),
  mechanicalSupport: new Set(DIRECTOR_VISUAL_ROLE_CAPABILITIES.mechanicalSupport),
  occludedInput: new Set(DIRECTOR_VISUAL_ROLE_CAPABILITIES.occludedInput),
  occludedOccluder: new Set(DIRECTOR_VISUAL_ROLE_CAPABILITIES.occludedOccluder),
  occludedOutput: new Set(DIRECTOR_VISUAL_ROLE_CAPABILITIES.occludedOutput),
  occludedSupport: new Set(DIRECTOR_VISUAL_ROLE_CAPABILITIES.occludedSupport),
});
const SHA256_RE = /^[a-f0-9]{64}$/;
const EPSILON = 1 / 1000;
const MIN_SCREEN_PLAYBACK_RATE = 0.45;
const MAX_SCREEN_PLAYBACK_RATE = 1.25;
export const REQUEST_ISOLATION_LIST_SCHEMA = 'koubo-director-request-isolation-registry/v1';
export const REQUEST_ISOLATION_LIST_FILE_NAME = 'request-isolation-registry.v1.json';
export const DIRECTOR_COMPILER_RELATIVE_PATH =
  'skills/koubo-remotion-director/scripts/compile-director-plan.mjs';
export const REQUEST_ISOLATION_REGISTRY_RELATIVE_PATH =
  'skills/koubo-remotion-director/registries/request-isolation-registry.v1.json';
export const REQUEST_ISOLATION_REGISTRY_SHA256_ENV =
  'KOUBO_DIRECTOR_REQUEST_ISOLATION_REGISTRY_SHA256';
export const SUPERVISOR_ACCEPTANCE_ANCHOR_REGISTRY_SCHEMA =
  'koubo-director-supervisor-acceptance-anchor-registry/v1';
export const SUPERVISOR_ACCEPTANCE_ANCHOR_REGISTRY_RELATIVE_PATH =
  'skills/koubo-remotion-director/registries/supervisor-acceptance-anchor-registry.v1.json';
export const SUPERVISOR_ACCEPTANCE_REGISTRY_SHA256_ENV =
  'KOUBO_DIRECTOR_SUPERVISOR_ACCEPTANCE_REGISTRY_SHA256';
export const SUPERVISOR_A_ACCEPTANCE_KIND = 'supervisor-a-independent-acceptance';
export const SUPERVISOR_A_ACCEPTANCE_SCHEMA = 'director-supervisor-a-independent-acceptance/v1';
export const SUPERVISOR_A_REVIEW_SCHEMA = 'director-supervisor-a-independent-review/v1';
export const SUPERVISOR_A_ACCEPTANCE_FILE_NAME = 'supervisor-a-independent-acceptance.v1.json';
export const SUPERVISOR_A_MACHINE_REVIEW_FILE_NAME =
  'supervisor-a-independent-machine-review.v1.json';
export const SUPERVISOR_A_VISUAL_REVIEW_FILE_NAME =
  'supervisor-a-independent-visual-review.v1.json';
export const SUPERVISOR_A_ACCEPTANCE_DECLARATION_ID = 'supervisor-a-independent-acceptance';
export const SUPERVISOR_A_GATE_ID = 'supervisor-a-independent-acceptance';
export const SUPERVISOR_A_ACCEPTANCE_ID =
  'wechat-paper-editorial-exact30-a-canonical-20260825';
export const SUPERVISOR_A_AUTHORITATIVE_FRAMES = Object.freeze([
  0, 12, 24, 60, 96, 126, 165, 204, 243, 285, 318, 351, 376, 414, 432, 450, 463,
]);
export const SUPERVISOR_A_AUTHORITATIVE_FPS = 30;
export const SUPERVISOR_A_END_EXCLUSIVE_FRAME = 473;
export const SUPERVISOR_A_STATIC_DIRECTION_AUTHORITY_SHA256 =
  '6cc7e640de656f33bc2d7215c1d9fb5c221d528652b390468c37e4a6c24757f3';
export const SUPERVISOR_A_CORRECTED_TERMINAL_STATE_SHA256 =
  '1b99b7c02f026038ca63f85596b56cb93b4ffcd532b0848175a3cd3bd020a290';
export const SUPERVISOR_A_CANONICAL_STATE_TREE_SHA256 =
  '4537d24b5b449dd7c4685a9adfd32823f18b554c2df158b1cce2cf75858145e1';
export const SUPERVISOR_A_CANONICAL_SCHEDULE_SHA256 =
  '4d617a726997080bcb9d61e4997a581d4aaaa1f2d9c9ef7704acad127d92a0b0';
export const SUPERVISOR_A_ARTIFACT_BUNDLE_SCHEMA =
  'director-supervisor-a-artifact-bundle/v1';

const scriptPath = fileURLToPath(import.meta.url);
const defaultRepoRoot = path.resolve(path.dirname(scriptPath), '../../..');
const PLAN_PUBLICATION_INPUT_SNAPSHOTS = Symbol('director-plan-publication-input-snapshots');

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

export function stableStringify(value) {
  return JSON.stringify(canonicalize(value));
}

export function attachDirectorPlanPublicationInputSnapshots(
  plan,
  {request, integrityFiles},
) {
  invariant(
    plan && typeof plan === 'object' && !Array.isArray(plan),
    'DIRECTOR_PLAN_PUBLICATION_INPUT_PLAN_INVALID',
  );
  invariant(
    request && integrityFiles && !Object.hasOwn(plan, PLAN_PUBLICATION_INPUT_SNAPSHOTS),
    'DIRECTOR_PLAN_PUBLICATION_INPUT_SNAPSHOTS_INVALID',
  );
  Object.defineProperty(plan, PLAN_PUBLICATION_INPUT_SNAPSHOTS, {
    configurable: false,
    enumerable: false,
    writable: false,
    value: {request, integrityFiles},
  });
  return plan;
}

export function sha256Text(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function sha256File(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function verifiedFileIdentity(snapshot) {
  return {
    path: snapshot.path,
    realpath: snapshot.realpath,
    device: snapshot.device,
    inode: snapshot.inode,
    size: snapshot.size,
    sha256: snapshot.sha256,
  };
}

function openVerifiedFileSnapshot(filePath) {
  const absolutePath = path.resolve(filePath);
  invariant(
    path.isAbsolute(filePath) && path.normalize(filePath) === filePath,
    'DIRECTOR_VERIFIED_FILE_PATH_INVALID',
    filePath,
  );
  let descriptor;
  try {
    const pathBefore = lstatSync(absolutePath);
    const realPathBefore = realpathSync(absolutePath);
    invariant(
      pathBefore.isFile() && !pathBefore.isSymbolicLink(),
      'DIRECTOR_VERIFIED_FILE_PATH_INVALID',
      absolutePath,
    );
    descriptor = openSync(
      absolutePath,
      fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW,
    );
    const descriptorBefore = fstatSync(descriptor);
    invariant(
      descriptorBefore.isFile() &&
        descriptorBefore.dev === pathBefore.dev &&
        descriptorBefore.ino === pathBefore.ino,
      'DIRECTOR_VERIFIED_FILE_IDENTITY_DRIFT',
      absolutePath,
    );
    const bytes = readFileSync(descriptor);
    const descriptorAfter = fstatSync(descriptor);
    const pathAfter = lstatSync(absolutePath);
    invariant(
      descriptorAfter.isFile() &&
        descriptorAfter.dev === descriptorBefore.dev &&
        descriptorAfter.ino === descriptorBefore.ino &&
        descriptorAfter.size === descriptorBefore.size &&
        descriptorAfter.mtimeMs === descriptorBefore.mtimeMs &&
        descriptorAfter.ctimeMs === descriptorBefore.ctimeMs &&
        pathAfter.isFile() &&
        !pathAfter.isSymbolicLink() &&
        pathAfter.dev === descriptorAfter.dev &&
        pathAfter.ino === descriptorAfter.ino &&
        pathAfter.size === descriptorAfter.size &&
        realpathSync(absolutePath) === realPathBefore &&
        bytes.length === descriptorAfter.size,
      'DIRECTOR_VERIFIED_FILE_IDENTITY_DRIFT',
      absolutePath,
    );
    return {
      path: absolutePath,
      realpath: realPathBefore,
      device: descriptorAfter.dev,
      inode: descriptorAfter.ino,
      size: descriptorAfter.size,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      bytes,
      descriptor,
    };
  } catch (error) {
    if (descriptor !== undefined) closeSync(descriptor);
    throw error;
  }
}

function readVerifiedFileSnapshot(filePath) {
  const snapshot = openVerifiedFileSnapshot(filePath);
  try {
    const {descriptor: _descriptor, ...closedSnapshot} = snapshot;
    return closedSnapshot;
  } finally {
    closeSync(snapshot.descriptor);
  }
}

function parseVerifiedJsonSnapshot(snapshot, jsonErrorCode) {
  invariant(
    Buffer.isBuffer(snapshot?.bytes) &&
      createHash('sha256').update(snapshot.bytes).digest('hex') === snapshot.sha256,
    'DIRECTOR_VERIFIED_FILE_SNAPSHOT_INVALID',
    snapshot?.path,
  );
  let value;
  try {
    value = JSON.parse(snapshot.bytes.toString('utf8'));
  } catch (error) {
    invariant(false, jsonErrorCode, `${snapshot.path}:${error.message}`);
  }
  return {...snapshot, value};
}

export function readVerifiedJsonSnapshot(filePath, {
  jsonErrorCode = 'DIRECTOR_VERIFIED_JSON_INVALID',
} = {}) {
  return parseVerifiedJsonSnapshot(
    readVerifiedFileSnapshot(filePath),
    jsonErrorCode,
  );
}

export function revalidateVerifiedFileSnapshot(expectedSnapshot, {
  phase = 'revalidate',
} = {}) {
  const actualSnapshot = readVerifiedFileSnapshot(expectedSnapshot?.path);
  invariant(
    stableStringify(verifiedFileIdentity(actualSnapshot)) ===
      stableStringify(verifiedFileIdentity(expectedSnapshot)),
    'DIRECTOR_VERIFIED_FILE_SNAPSHOT_DRIFT',
    `${phase}:${expectedSnapshot?.path}`,
  );
  return actualSnapshot;
}

export function revalidateRequestForPublication(
  request,
  requestPath,
  expectedSnapshot,
  {phase = 'revalidate'} = {},
) {
  const actualSnapshot = readVerifiedJsonSnapshot(requestPath, {
    jsonErrorCode: 'DIRECTOR_REQUEST_PREWRITE_JSON_INVALID',
  });
  invariant(
    stableStringify(actualSnapshot.value) === stableStringify(request) &&
      stableStringify(verifiedFileIdentity(actualSnapshot)) ===
        stableStringify(verifiedFileIdentity(expectedSnapshot)),
    'DIRECTOR_REQUEST_PREWRITE_DRIFT',
    `${phase}:${requestPath}`,
  );
  return actualSnapshot;
}

export const MOTION_POSE_PROFILE = Object.freeze({
  frameWidth: 1920,
  frameHeight: 1080,
  maxRegionWidth: 1344,
  maxRegionHeight: 864,
  maxRegionArea: 725760,
  maxRegionAreaRatio: 0.35,
  minVisiblePixels: 64,
  minVisibleRatio: 0.001,
  maxVisibleRatio: 0.95,
  transparentBorderPixels: 2,
  significantChannelDelta: 5,
});

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const PNG_ADAM7_PASSES = Object.freeze([
  [0, 0, 8, 8],
  [4, 0, 8, 8],
  [0, 4, 4, 8],
  [2, 0, 4, 4],
  [0, 2, 2, 4],
  [1, 0, 2, 2],
  [0, 1, 1, 2],
]);

const PNG_CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let value = 0; value < 256; value += 1) {
    let crc = value;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    table[value] = crc >>> 0;
  }
  return table;
})();

function pngCrc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = PNG_CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function paethPredictor(left, above, upperLeft) {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left;
  if (aboveDistance <= upperLeftDistance) return above;
  return upperLeft;
}

function decodePngPass(inflated, offset, passWidth, passHeight) {
  const bytesPerPixel = 4;
  const rowBytes = passWidth * bytesPerPixel;
  const decoded = Buffer.alloc(passHeight * rowBytes);
  let cursor = offset;
  for (let y = 0; y < passHeight; y += 1) {
    invariant(cursor < inflated.length, 'DIRECTOR_MOTION_POSE_PNG_DECODE_FAILED', 'missing-filter-byte');
    const filterType = inflated[cursor];
    cursor += 1;
    invariant(filterType <= 4, 'DIRECTOR_MOTION_POSE_PNG_DECODE_FAILED', `filter-${filterType}`);
    invariant(
      cursor + rowBytes <= inflated.length,
      'DIRECTOR_MOTION_POSE_PNG_DECODE_FAILED',
      `truncated-scanline:${y}`,
    );
    const rowOffset = y * rowBytes;
    const previousOffset = (y - 1) * rowBytes;
    for (let x = 0; x < rowBytes; x += 1) {
      const raw = inflated[cursor + x];
      const left = x >= bytesPerPixel ? decoded[rowOffset + x - bytesPerPixel] : 0;
      const above = y > 0 ? decoded[previousOffset + x] : 0;
      const upperLeft = y > 0 && x >= bytesPerPixel
        ? decoded[previousOffset + x - bytesPerPixel]
        : 0;
      let value;
      if (filterType === 0) value = raw;
      else if (filterType === 1) value = raw + left;
      else if (filterType === 2) value = raw + above;
      else if (filterType === 3) value = raw + Math.floor((left + above) / 2);
      else value = raw + paethPredictor(left, above, upperLeft);
      decoded[rowOffset + x] = value & 0xff;
    }
    cursor += rowBytes;
  }
  return {decoded, cursor};
}

function adam7PassSize(fullSize, start, step) {
  return fullSize <= start ? 0 : Math.ceil((fullSize - start) / step);
}

function expectedInflatedPngBytes(width, height, interlaceMethod) {
  if (interlaceMethod === 0) return height * (1 + width * 4);
  return PNG_ADAM7_PASSES.reduce((total, [xStart, yStart, xStep, yStep]) => {
    const passWidth = adam7PassSize(width, xStart, xStep);
    const passHeight = adam7PassSize(height, yStart, yStep);
    return total + (passWidth > 0 && passHeight > 0 ? passHeight * (1 + passWidth * 4) : 0);
  }, 0);
}

function decodeRgbaPng(data, filePath) {
  invariant(
    data.length >= 8 && data.subarray(0, 8).equals(PNG_SIGNATURE),
    'DIRECTOR_MOTION_POSE_PNG_INVALID',
    filePath,
  );
  let offset = 8;
  let ihdr;
  let seenIhdr = false;
  let seenIdat = false;
  let idatEnded = false;
  let seenIend = false;
  const idatParts = [];
  while (offset < data.length) {
    invariant(
      offset + 12 <= data.length,
      'DIRECTOR_MOTION_POSE_PNG_INVALID',
      `${filePath}:truncated-chunk-header`,
    );
    const length = data.readUInt32BE(offset);
    const typeStart = offset + 4;
    const chunkDataStart = offset + 8;
    const chunkDataEnd = chunkDataStart + length;
    const chunkEnd = chunkDataEnd + 4;
    invariant(
      chunkEnd <= data.length,
      'DIRECTOR_MOTION_POSE_PNG_INVALID',
      `${filePath}:truncated-chunk`,
    );
    const typeBytes = data.subarray(typeStart, typeStart + 4);
    const type = typeBytes.toString('ascii');
    invariant(
      /^[A-Za-z]{4}$/.test(type),
      'DIRECTOR_MOTION_POSE_PNG_INVALID',
      `${filePath}:chunk-type`,
    );
    const chunkData = data.subarray(chunkDataStart, chunkDataEnd);
    const declaredCrc = data.readUInt32BE(chunkDataEnd);
    const actualCrc = pngCrc32(Buffer.concat([typeBytes, chunkData]));
    invariant(
      declaredCrc === actualCrc,
      'DIRECTOR_MOTION_POSE_PNG_INVALID',
      `${filePath}:${type}:crc`,
    );
    if (type === 'IHDR') {
      invariant(
        !seenIhdr && offset === 8 && length === 13,
        'DIRECTOR_MOTION_POSE_PNG_INVALID',
        `${filePath}:IHDR`,
      );
      seenIhdr = true;
      ihdr = {
        width: chunkData.readUInt32BE(0),
        height: chunkData.readUInt32BE(4),
        bitDepth: chunkData[8],
        colorType: chunkData[9],
        compressionMethod: chunkData[10],
        filterMethod: chunkData[11],
        interlaceMethod: chunkData[12],
      };
    } else {
      invariant(seenIhdr, 'DIRECTOR_MOTION_POSE_PNG_INVALID', `${filePath}:IHDR-first`);
      if (type === 'IDAT') {
        invariant(!idatEnded, 'DIRECTOR_MOTION_POSE_PNG_INVALID', `${filePath}:noncontiguous-IDAT`);
        seenIdat = true;
        idatParts.push(chunkData);
      } else {
        if (seenIdat && type !== 'IEND') idatEnded = true;
        if (type === 'IEND') {
          invariant(
            length === 0 && seenIdat && !seenIend,
            'DIRECTOR_MOTION_POSE_PNG_INVALID',
            `${filePath}:IEND`,
          );
          seenIend = true;
          offset = chunkEnd;
          break;
        }
        const critical = (typeBytes[0] & 0x20) === 0;
        invariant(
          !critical || type === 'PLTE',
          'DIRECTOR_MOTION_POSE_PNG_INVALID',
          `${filePath}:unsupported-critical-${type}`,
        );
        if (type === 'PLTE') {
          invariant(
            !seenIdat && length > 0 && length <= 768 && length % 3 === 0,
            'DIRECTOR_MOTION_POSE_PNG_INVALID',
            `${filePath}:PLTE`,
          );
        }
      }
    }
    offset = chunkEnd;
  }
  invariant(
    seenIhdr && seenIdat && seenIend && offset === data.length,
    'DIRECTOR_MOTION_POSE_PNG_INVALID',
    `${filePath}:incomplete-or-trailing-data`,
  );
  invariant(
    ihdr.width > 0 && ihdr.height > 0 && ihdr.bitDepth === 8 && ihdr.colorType === 6 &&
      ihdr.compressionMethod === 0 && ihdr.filterMethod === 0 &&
      (ihdr.interlaceMethod === 0 || ihdr.interlaceMethod === 1),
    'DIRECTOR_MOTION_POSE_PNG_FORMAT_INVALID',
    `${filePath}:${ihdr.width}x${ihdr.height}:depth-${ihdr.bitDepth}:type-${ihdr.colorType}:interlace-${ihdr.interlaceMethod}`,
  );
  invariant(
    ihdr.width <= MOTION_POSE_PROFILE.maxRegionWidth &&
      ihdr.height <= MOTION_POSE_PROFILE.maxRegionHeight &&
      ihdr.width * ihdr.height <= MOTION_POSE_PROFILE.maxRegionArea,
    'DIRECTOR_MOTION_POSE_PNG_DIMENSIONS_OUT_OF_PROFILE',
    `${filePath}:${ihdr.width}x${ihdr.height}`,
  );
  const expectedBytes = expectedInflatedPngBytes(
    ihdr.width,
    ihdr.height,
    ihdr.interlaceMethod,
  );
  let inflated;
  try {
    inflated = inflateSync(Buffer.concat(idatParts), {maxOutputLength: expectedBytes + 1});
  } catch (error) {
    invariant(false, 'DIRECTOR_MOTION_POSE_PNG_DECODE_FAILED', `${filePath}:${error.message}`);
  }
  invariant(
    inflated.length === expectedBytes,
    'DIRECTOR_MOTION_POSE_PNG_DECODE_FAILED',
    `${filePath}:${inflated.length}/${expectedBytes}`,
  );
  let rgba;
  if (ihdr.interlaceMethod === 0) {
    const pass = decodePngPass(inflated, 0, ihdr.width, ihdr.height);
    invariant(
      pass.cursor === inflated.length,
      'DIRECTOR_MOTION_POSE_PNG_DECODE_FAILED',
      `${filePath}:decoded-length`,
    );
    rgba = pass.decoded;
  } else {
    rgba = Buffer.alloc(ihdr.width * ihdr.height * 4);
    let cursor = 0;
    for (const [xStart, yStart, xStep, yStep] of PNG_ADAM7_PASSES) {
      const passWidth = adam7PassSize(ihdr.width, xStart, xStep);
      const passHeight = adam7PassSize(ihdr.height, yStart, yStep);
      if (passWidth === 0 || passHeight === 0) continue;
      const pass = decodePngPass(inflated, cursor, passWidth, passHeight);
      cursor = pass.cursor;
      for (let passY = 0; passY < passHeight; passY += 1) {
        for (let passX = 0; passX < passWidth; passX += 1) {
          const sourceOffset = (passY * passWidth + passX) * 4;
          const targetX = xStart + passX * xStep;
          const targetY = yStart + passY * yStep;
          const targetOffset = (targetY * ihdr.width + targetX) * 4;
          pass.decoded.copy(rgba, targetOffset, sourceOffset, sourceOffset + 4);
        }
      }
    }
    invariant(
      cursor === inflated.length,
      'DIRECTOR_MOTION_POSE_PNG_DECODE_FAILED',
      `${filePath}:adam7-decoded-length`,
    );
  }
  return {...ihdr, rgba};
}

export function inspectMotionPosePng(filePath) {
  let data;
  try {
    data = readFileSync(filePath);
  } catch (error) {
    invariant(false, 'DIRECTOR_MOTION_POSE_PNG_MISSING', `${filePath}:${error.message}`);
  }
  const decoded = decodeRgbaPng(data, filePath);
  const area = decoded.width * decoded.height;
  let visiblePixelCount = 0;
  let alphaBinary = true;
  let transparentBorder = true;
  const border = MOTION_POSE_PROFILE.transparentBorderPixels;
  for (let y = 0; y < decoded.height; y += 1) {
    for (let x = 0; x < decoded.width; x += 1) {
      const alpha = decoded.rgba[(y * decoded.width + x) * 4 + 3];
      if (alpha !== 0 && alpha !== 255) alphaBinary = false;
      if (alpha === 0) continue;
      visiblePixelCount += 1;
      if (
        x < border || y < border ||
        x >= decoded.width - border || y >= decoded.height - border
      ) transparentBorder = false;
    }
  }
  const minimumVisiblePixelCount = Math.max(
    MOTION_POSE_PROFILE.minVisiblePixels,
    Math.ceil(area * MOTION_POSE_PROFILE.minVisibleRatio),
  );
  invariant(
    alphaBinary,
    'DIRECTOR_MOTION_POSE_PNG_ALPHA_NON_BINARY',
    filePath,
  );
  invariant(
    visiblePixelCount >= minimumVisiblePixelCount,
    'DIRECTOR_MOTION_POSE_PNG_ALPHA_EMPTY_OR_SPARSE',
    `${filePath}:${visiblePixelCount}/${minimumVisiblePixelCount}`,
  );
  invariant(
    visiblePixelCount / area <= MOTION_POSE_PROFILE.maxVisibleRatio,
    'DIRECTOR_MOTION_POSE_PNG_ALPHA_COVERAGE_EXCESSIVE',
    `${filePath}:${visiblePixelCount}/${area}`,
  );
  invariant(
    transparentBorder,
    'DIRECTOR_MOTION_POSE_PNG_ALPHA_BORDER_NOT_TRANSPARENT',
    filePath,
  );
  return {
    width: decoded.width,
    height: decoded.height,
    bitDepth: decoded.bitDepth,
    colorType: decoded.colorType,
    interlaceMethod: decoded.interlaceMethod,
    fileSha256: createHash('sha256').update(data).digest('hex'),
    rgbaPixelSha256: createHash('sha256').update(decoded.rgba).digest('hex'),
    visiblePixelCount,
    alphaCoverage: visiblePixelCount / area,
    rgba: decoded.rgba,
  };
}

export function inspectPngIhdr(filePath) {
  const inspection = inspectMotionPosePng(filePath);
  return {
    width: inspection.width,
    height: inspection.height,
    bitDepth: inspection.bitDepth,
    colorType: inspection.colorType,
  };
}

export function assertMotionPoseRegion(region, render, {
  label = '',
  renderCode = 'DIRECTOR_MOTION_POSE_RENDER_PROFILE_INVALID',
  regionCode = 'DIRECTOR_MOTION_POSE_REGION_INVALID',
} = {}) {
  invariant(
    render?.width === MOTION_POSE_PROFILE.frameWidth &&
      render?.height === MOTION_POSE_PROFILE.frameHeight,
    renderCode,
    `${label}:${render?.width}x${render?.height}`,
  );
  exactObjectKeys(region, ['x', 'y', 'width', 'height'], regionCode, label);
  const {x, y, width, height} = region;
  const area = width * height;
  invariant(
    Number.isInteger(x) && x >= 0 && Number.isInteger(y) && y >= 0 &&
      Number.isInteger(width) && width > 0 && Number.isInteger(height) && height > 0 &&
      x + width <= render.width && y + height <= render.height &&
      width <= MOTION_POSE_PROFILE.maxRegionWidth &&
      height <= MOTION_POSE_PROFILE.maxRegionHeight &&
      area <= MOTION_POSE_PROFILE.maxRegionArea &&
      area / (render.width * render.height) <= MOTION_POSE_PROFILE.maxRegionAreaRatio,
    regionCode,
    `${label}:${x},${y},${width},${height}:${area}:${render.width}x${render.height}`,
  );
  return {x, y, width, height, area};
}

export function countSignificantMotionPosePixels(leftRgba, rightRgba) {
  invariant(
    Buffer.isBuffer(leftRgba) && Buffer.isBuffer(rightRgba) &&
      leftRgba.length === rightRgba.length && leftRgba.length % 4 === 0,
    'DIRECTOR_MOTION_POSE_PIXEL_BUFFER_INVALID',
  );
  let changedPixelCount = 0;
  for (let offset = 0; offset < leftRgba.length; offset += 4) {
    const leftAlpha = leftRgba[offset + 3];
    const rightAlpha = rightRgba[offset + 3];
    if (leftAlpha !== rightAlpha) {
      changedPixelCount += 1;
      continue;
    }
    if (leftAlpha === 0) continue;
    if (
      Math.abs(leftRgba[offset] - rightRgba[offset]) >
        MOTION_POSE_PROFILE.significantChannelDelta ||
      Math.abs(leftRgba[offset + 1] - rightRgba[offset + 1]) >
        MOTION_POSE_PROFILE.significantChannelDelta ||
      Math.abs(leftRgba[offset + 2] - rightRgba[offset + 2]) >
        MOTION_POSE_PROFILE.significantChannelDelta
    ) changedPixelCount += 1;
  }
  return changedPixelCount;
}

export function validateMotionPoseAssetContract({
  assets,
  scenes,
  render,
  resolveAssetPath = (assetPath) => assetPath,
}) {
  invariant(Array.isArray(assets), 'DIRECTOR_MOTION_POSE_ASSETS_INVALID');
  invariant(Array.isArray(scenes), 'DIRECTOR_MOTION_POSE_SCENES_INVALID');
  const assetsById = new Map();
  for (const asset of assets) {
    const id = safeId(asset?.id, 'motion pose visual asset id');
    invariant(!assetsById.has(id), 'DIRECTOR_MOTION_POSE_ASSET_ID_DUPLICATE', id);
    assetsById.set(id, asset);
  }
  const motionAssets = assets.filter((asset) => asset.role === 'motion-pose');
  const hasProgressiveScene = scenes.some(
    (scene) => scene?.stateReveal?.method === 'progressive-local-assembly',
  );
  if (motionAssets.length > 0 || hasProgressiveScene) {
    invariant(
      render?.width === MOTION_POSE_PROFILE.frameWidth &&
        render?.height === MOTION_POSE_PROFILE.frameHeight,
      'DIRECTOR_MOTION_POSE_RENDER_PROFILE_INVALID',
      `${render?.width}x${render?.height}`,
    );
  }
  const motionPathKeys = new Set();
  const motionStaticFileNames = new Set();
  const declaredFileSha256s = new Set();
  for (const asset of motionAssets) {
    invariant(
      typeof asset.path === 'string' && asset.path.length > 0 &&
        path.extname(asset.path).toLowerCase() === '.png',
      'DIRECTOR_MOTION_POSE_PNG_REQUIRED',
      asset.id,
    );
    invariant(
      typeof asset.staticFileName === 'string' &&
        path.basename(asset.staticFileName) === asset.staticFileName &&
        path.extname(asset.staticFileName).toLowerCase() === '.png',
      'DIRECTOR_MOTION_POSE_PNG_REQUIRED',
      asset.id,
    );
    invariant(
      SHA256_RE.test(asset.sha256),
      'DIRECTOR_MOTION_POSE_DECLARED_SHA256_INVALID',
      asset.id,
    );
    const absolutePath = path.resolve(resolveAssetPath(asset.path));
    invariant(
      !motionPathKeys.has(absolutePath),
      'DIRECTOR_MOTION_POSE_ASSET_PATH_DUPLICATE',
      absolutePath,
    );
    invariant(
      !motionStaticFileNames.has(asset.staticFileName),
      'DIRECTOR_MOTION_POSE_STATIC_FILE_NAME_DUPLICATE',
      asset.staticFileName,
    );
    invariant(
      !declaredFileSha256s.has(asset.sha256),
      'DIRECTOR_MOTION_POSE_FILE_SHA256_DUPLICATE',
      asset.sha256,
    );
    motionPathKeys.add(absolutePath);
    motionStaticFileNames.add(asset.staticFileName);
    declaredFileSha256s.add(asset.sha256);
  }

  const consumedMotionPoseIds = new Set();
  const actualFileSha256s = new Set();
  const rgbaPixelSha256s = new Set();
  const motionPoseIds = [];
  for (const scene of scenes) {
    const reveal = scene?.stateReveal;
    if (!reveal) continue;
    if (reveal.method === 'fully-occluded-hard-cut') {
      const occluder = assetsById.get(reveal.occluderAssetId);
      invariant(
        occluder?.role === 'occluder',
        'DIRECTOR_MOTION_POSE_AUTHORITY_ROLE_INVALID',
        `${scene.id}:${reveal.occluderAssetId}`,
      );
    }
    invariant(
      Array.isArray(reveal.states) && reveal.states.length > 0,
      'DIRECTOR_MOTION_POSE_STATES_INVALID',
      scene.id,
    );
    for (const state of reveal.states) {
      const authorityAsset = assetsById.get(state.assetId);
      invariant(
        authorityAsset && ['base-state', 'revealed-state'].includes(authorityAsset.role),
        'DIRECTOR_MOTION_POSE_AUTHORITY_ROLE_INVALID',
        `${scene.id}:${state.id}:${state.assetId}`,
      );
    }
    if (reveal.method !== 'progressive-local-assembly') continue;
    reveal.states.forEach((state, index) => {
      const label = `${scene.id}:${state.id}`;
      invariant(
        state.localMotion && typeof state.localMotion === 'object' &&
          !Array.isArray(state.localMotion),
        'DIRECTOR_MOTION_POSE_LOCAL_MOTION_REQUIRED',
        label,
      );
      if (index === 0) {
        exactObjectKeys(
          state.localMotion,
          ['model'],
          'DIRECTOR_MOTION_POSE_INITIAL_NOT_NEUTRAL',
          label,
        );
        invariant(
          state.localMotion.model === 'neutral/v1',
          'DIRECTOR_MOTION_POSE_INITIAL_NOT_NEUTRAL',
          label,
        );
        return;
      }
      exactObjectKeys(
        state.localMotion,
        ['model', 'region', 'poseAssetIds'],
        'DIRECTOR_MOTION_POSE_AUTHORED_INVALID',
        label,
      );
      invariant(
        state.localMotion.model === 'authored-local-stop-motion/v1',
        'DIRECTOR_MOTION_POSE_AUTHORED_INVALID',
        label,
      );
      const region = assertMotionPoseRegion(state.localMotion.region, render, {label});
      invariant(
        Array.isArray(state.localMotion.poseAssetIds) &&
          state.localMotion.poseAssetIds.length === 3 &&
          new Set(state.localMotion.poseAssetIds).size === 3 &&
          state.localMotion.poseAssetIds.every(
            (assetId) => typeof assetId === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(assetId),
          ),
        'DIRECTOR_MOTION_POSE_ASSET_IDS_INVALID',
        label,
      );
      invariant(
        Number.isInteger(state.atFrame) &&
          Number.isInteger(reveal.states[index - 1]?.atFrame) &&
          state.atFrame - reveal.states[index - 1].atFrame >= 10,
        'DIRECTOR_MOTION_POSE_PREROLL_INSUFFICIENT',
        label,
      );
      const inspections = state.localMotion.poseAssetIds.map((poseAssetId) => {
        const poseAsset = assetsById.get(poseAssetId);
        invariant(
          poseAsset?.role === 'motion-pose',
          'DIRECTOR_MOTION_POSE_ASSET_ROLE_INVALID',
          `${label}:${poseAssetId}`,
        );
        invariant(
          !consumedMotionPoseIds.has(poseAsset.id),
          'DIRECTOR_MOTION_POSE_ASSET_CONSUMED_TWICE',
          `${label}:${poseAsset.id}`,
        );
        const inspection = inspectMotionPosePng(path.resolve(resolveAssetPath(poseAsset.path)));
        invariant(
          inspection.fileSha256 === poseAsset.sha256,
          'DIRECTOR_MOTION_POSE_DECLARED_SHA256_MISMATCH',
          `${poseAsset.id}:${inspection.fileSha256}/${poseAsset.sha256}`,
        );
        invariant(
          inspection.width === region.width && inspection.height === region.height,
          'DIRECTOR_MOTION_POSE_DIMENSIONS_MISMATCH',
          `${label}:${poseAsset.id}:${inspection.width}x${inspection.height}:${region.width}x${region.height}`,
        );
        invariant(
          !actualFileSha256s.has(inspection.fileSha256),
          'DIRECTOR_MOTION_POSE_FILE_SHA256_DUPLICATE',
          `${poseAsset.id}:${inspection.fileSha256}`,
        );
        invariant(
          !rgbaPixelSha256s.has(inspection.rgbaPixelSha256),
          'DIRECTOR_MOTION_POSE_RGBA_PIXEL_SHA256_DUPLICATE',
          `${poseAsset.id}:${inspection.rgbaPixelSha256}`,
        );
        consumedMotionPoseIds.add(poseAsset.id);
        actualFileSha256s.add(inspection.fileSha256);
        rgbaPixelSha256s.add(inspection.rgbaPixelSha256);
        motionPoseIds.push(poseAsset.id);
        return inspection;
      });
      const minimumChangedPixelCount = Math.max(
        MOTION_POSE_PROFILE.minVisiblePixels,
        Math.ceil(region.area * MOTION_POSE_PROFILE.minVisibleRatio),
      );
      for (let poseIndex = 1; poseIndex < inspections.length; poseIndex += 1) {
        const changedPixelCount = countSignificantMotionPosePixels(
          inspections[poseIndex - 1].rgba,
          inspections[poseIndex].rgba,
        );
        invariant(
          changedPixelCount >= minimumChangedPixelCount,
          'DIRECTOR_MOTION_POSE_ADJACENT_CHANGE_INSUFFICIENT',
          `${label}:${poseIndex}->${poseIndex + 1}:${changedPixelCount}/${minimumChangedPixelCount}`,
        );
      }
    });
  }
  for (const asset of motionAssets) {
    invariant(
      consumedMotionPoseIds.has(asset.id),
      'DIRECTOR_MOTION_POSE_ASSET_UNUSED',
      asset.id,
    );
  }
  return {motionPoseIds};
}

export function normalizeSpokenText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\p{P}\p{S}\s]/gu, '');
}

function invariant(condition, code, detail) {
  if (!condition) {
    const error = new Error(`${code}${detail ? `: ${detail}` : ''}`);
    error.code = code;
    throw error;
  }
}

const REQUEST_SEMANTIC_FIELD_ALLOWLIST = new Set([
  'schemaVersion',
  'reference',
  'style',
  'authority',
  'transcriptSha256',
  'timelineWindow',
  'coordinateSystem',
  'wordTimeToleranceSeconds',
  'media',
  'spoken',
  'screen',
  'screenExcludedRanges',
  'sfx',
  'cues',
  'visualStateAssets',
  'authoritativeOriginal',
  'sourceIn',
  'sourceOut',
  'sha256',
  'id',
  'role',
  'volume',
  'captions',
  'text',
  'semanticBeats',
  'kind',
  'start',
  'end',
  'spokenLine',
  'cognitiveIncrement',
  'visualization',
  'layout',
  'camera',
  'layers',
  'objectGroups',
  'label',
  'groupLabel',
  'material',
  'visualPrimitive',
  'visualRole',
  'items',
  'input',
  'occluder',
  'output',
  'outputs',
  'support',
  'action',
  'mechanismNodes',
  'assemblyStages',
  'atSeconds',
  'targetIds',
  'relations',
  'from',
  'to',
  'stateReveal',
  'method',
  'occluderAssetId',
  'transitionFrames',
  'close',
  'occludedHold',
  'open',
  'states',
  'assetId',
  'stageId',
  'entityStateId',
  'changedEntityIds',
  'localMotion',
  'model',
  'region',
  'x',
  'y',
  'poseAssetIds',
  'transitionKind',
  'stills',
  'sceneId',
  'purpose',
  'referenceFrameIds',
  'requiredStageIds',
  'minimumSettledFrames',
  'render',
  'width',
  'height',
  'fps',
  'durationSeconds',
]);

function semanticProjection(value) {
  if (Array.isArray(value)) return value.map((item) => semanticProjection(item));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .filter((key) => REQUEST_SEMANTIC_FIELD_ALLOWLIST.has(key))
      .sort()
      .map((key) => [key, semanticProjection(value[key])]),
  );
}

export function requestSemanticSha256(request) {
  const semanticSource = {
    schemaVersion: request?.schemaVersion,
    reference: request?.reference,
    style: request?.style,
    authority: {
      transcriptSha256: request?.authority?.transcriptSha256,
      timelineWindow: request?.authority?.timelineWindow,
      wordTimeToleranceSeconds: request?.authority?.wordTimeToleranceSeconds,
    },
    media: request?.media,
    captions: request?.captions,
    semanticBeats: request?.semanticBeats,
    stills: request?.stills,
    render: request?.render,
  };
  return sha256Text(stableStringify(semanticProjection(semanticSource)));
}

export function requestAStateBundleSha256Values(request) {
  const fps = request?.render?.fps;
  if (!Number.isInteger(fps) || fps <= 0) return [];
  const visualAssets = new Map(
    (request?.media?.visualStateAssets ?? []).map((asset) => [asset.id, asset]),
  );
  const sceneStateByKey = new Map();
  for (const beat of request?.semanticBeats ?? []) {
    const states = beat?.visualization?.stateReveal?.states;
    if (!Array.isArray(states)) continue;
    for (const state of states) {
      const frame = Number.isInteger(state.atFrame)
        ? state.atFrame
        : Number.isFinite(state.atSeconds)
          ? Math.round(state.atSeconds * fps)
          : undefined;
      if (!Number.isInteger(frame)) continue;
      sceneStateByKey.set(`${beat.id}\0${state.assetId}`, {frame});
    }
  }
  const candidateBundles = [];
  for (const receipt of request?.authority?.receipts ?? []) {
    if (!Array.isArray(receipt?.bindings) || receipt.bindings.length !== 17) continue;
    const records = receipt.bindings.map((binding) => {
      const sceneState = sceneStateByKey.get(`${binding.sceneId}\0${binding.visualStateAssetId}`);
      const asset = visualAssets.get(binding.visualStateAssetId);
      if (
        !/^A\d{2}$/.test(binding.receiptStateId ?? '') ||
        !sceneState ||
        !asset ||
        !SHA256_RE.test(asset.sha256 ?? '')
      ) return undefined;
      return {
        stateId: binding.receiptStateId,
        frame: sceneState.frame,
        visualStateAssetId: binding.visualStateAssetId,
        assetSha256: asset.sha256,
      };
    });
    if (
      records.every(Boolean) &&
      records.every((record, index) => record.stateId === `A${String(index).padStart(2, '0')}`)
    ) {
      candidateBundles.push(sha256Text(stableStringify(records)));
    }
  }
  return [...new Set(candidateBundles)].sort();
}

export function requestAStateBundleSha256(request) {
  const values = requestAStateBundleSha256Values(request);
  return values.length === 1 ? values[0] : undefined;
}

export function requestForbiddenReceiptSha256Values(request) {
  return [...new Set(
    (request?.authority?.receipts ?? [])
      .map((receipt) => receipt?.sha256)
      .filter((sha256) => SHA256_RE.test(sha256 ?? '')),
  )].sort();
}

function registryIntegrityAnchor({
  expectedSha256,
  actualSha256,
  required,
  requiredCode,
  mismatchCode,
  label,
}) {
  if (!required) return {expectedSha256: undefined, actualSha256};
  invariant(SHA256_RE.test(expectedSha256 ?? ''), requiredCode, label);
  invariant(expectedSha256 === actualSha256, mismatchCode, `${expectedSha256}:${actualSha256}`);
  return {expectedSha256, actualSha256};
}

export function supervisorAArtifactBundleSha256({
  builderSha256,
  manifestSha256,
  generationReceiptSha256,
  authorityReceiptSha256,
  contactSheetSha256,
  stateTreeSha256,
  scheduleSha256,
  states,
}) {
  const namedSha256Values = {
    builderSha256,
    manifestSha256,
    generationReceiptSha256,
    authorityReceiptSha256,
    contactSheetSha256,
    stateTreeSha256,
    scheduleSha256,
  };
  for (const [label, sha256] of Object.entries(namedSha256Values)) {
    invariant(SHA256_RE.test(sha256 ?? ''), 'DIRECTOR_SUPERVISOR_A_ARTIFACT_BUNDLE_SHA_INVALID', label);
  }
  invariant(
    Array.isArray(states) && states.length === 17,
    'DIRECTOR_SUPERVISOR_A_ARTIFACT_BUNDLE_STATES_INVALID',
  );
  const canonicalStates = states.map((state, index) => {
    const id = `A${String(index).padStart(2, '0')}`;
    invariant(
      state?.id === id && SHA256_RE.test(state?.sha256 ?? ''),
      'DIRECTOR_SUPERVISOR_A_ARTIFACT_BUNDLE_STATES_INVALID',
      id,
    );
    return {id, sha256: state.sha256};
  });
  return sha256Text(stableStringify({
    schema: SUPERVISOR_A_ARTIFACT_BUNDLE_SCHEMA,
    ...namedSha256Values,
    states: canonicalStates,
  }));
}

function parseRequestIsolationList(isolationList, listPath) {
  invariant(
    isolationList?.schemaVersion === REQUEST_ISOLATION_LIST_SCHEMA,
    'DIRECTOR_REQUEST_ISOLATION_LIST_SCHEMA_INVALID',
    listPath,
  );
  exactObjectKeys(
    isolationList,
    ['schemaVersion', 'taskId', 'registryPolicy', 'entries'],
    'DIRECTOR_REQUEST_ISOLATION_REGISTRY_FIELDS_INVALID',
    listPath,
  );
  safeId(isolationList.taskId, `${listPath}:taskId`);
  exactObjectKeys(
    isolationList.registryPolicy,
    [
      'source',
      'relativePath',
      'externalSha256Env',
      'failClosedOnMissingRegistry',
      'matchAny',
    ],
    'DIRECTOR_REQUEST_ISOLATION_PATH_POLICY_INVALID',
    listPath,
  );
  invariant(
    isolationList.registryPolicy?.source === 'skill-fixed-registry' &&
      isolationList.registryPolicy?.relativePath === REQUEST_ISOLATION_REGISTRY_RELATIVE_PATH &&
      isolationList.registryPolicy?.externalSha256Env === REQUEST_ISOLATION_REGISTRY_SHA256_ENV &&
      isolationList.registryPolicy?.failClosedOnMissingRegistry === true &&
      isolationList.registryPolicy?.matchAny === true,
    'DIRECTOR_REQUEST_ISOLATION_PATH_POLICY_INVALID',
    listPath,
  );
  invariant(
    Array.isArray(isolationList.entries) && isolationList.entries.length > 0,
    'DIRECTOR_REQUEST_ISOLATION_ENTRIES_INVALID',
    listPath,
  );

  const requestIds = new Set();
  const canonicalSha256Values = new Set();
  const rawSha256Values = new Set();
  const semanticSha256Values = new Set();
  for (const [index, entry] of isolationList.entries.entries()) {
    const label = `${listPath}:entries.${index}`;
    exactObjectKeys(
      entry,
      [
        'requestId',
        'rawSha256',
        'canonicalSha256',
        'semanticSha256',
        'forbiddenBundleSha256',
        'forbiddenReceiptSha256',
        'status',
        'compileAllowed',
        'emitAllowed',
        'renderAllowed',
        'rejectionReasons',
        'legacyEvidence',
      ],
      'DIRECTOR_REQUEST_ISOLATION_ENTRY_FIELDS_INVALID',
      label,
    );
    safeId(entry.requestId, `${label}.requestId`);
    invariant(SHA256_RE.test(entry.rawSha256), 'DIRECTOR_REQUEST_ISOLATION_RAW_SHA_INVALID', label);
    invariant(SHA256_RE.test(entry.canonicalSha256), 'DIRECTOR_REQUEST_ISOLATION_CANONICAL_SHA_INVALID', label);
    invariant(SHA256_RE.test(entry.semanticSha256), 'DIRECTOR_REQUEST_ISOLATION_SEMANTIC_SHA_INVALID', label);
    invariant(
      SHA256_RE.test(entry.forbiddenBundleSha256),
      'DIRECTOR_REQUEST_ISOLATION_FORBIDDEN_BUNDLE_INVALID',
      label,
    );
    invariant(
      Array.isArray(entry.forbiddenReceiptSha256) &&
        entry.forbiddenReceiptSha256.length > 0 &&
        entry.forbiddenReceiptSha256.every((sha256) => SHA256_RE.test(sha256)) &&
        new Set(entry.forbiddenReceiptSha256).size === entry.forbiddenReceiptSha256.length &&
        entry.forbiddenReceiptSha256.every((sha256, receiptIndex) =>
          receiptIndex === 0 || sha256 > entry.forbiddenReceiptSha256[receiptIndex - 1]),
      'DIRECTOR_REQUEST_ISOLATION_FORBIDDEN_RECEIPTS_INVALID',
      label,
    );
    invariant(entry.status === 'invalid-pre-review', 'DIRECTOR_REQUEST_ISOLATION_STATUS_INVALID', label);
    invariant(entry.compileAllowed === false, 'DIRECTOR_REQUEST_ISOLATION_COMPILE_POLICY_INVALID', label);
    invariant(entry.emitAllowed === false, 'DIRECTOR_REQUEST_ISOLATION_EMIT_POLICY_INVALID', label);
    invariant(entry.renderAllowed === false, 'DIRECTOR_REQUEST_ISOLATION_RENDER_POLICY_INVALID', label);
    invariant(
      Array.isArray(entry.rejectionReasons) && entry.rejectionReasons.length === 2 &&
        entry.rejectionReasons.every((reason) => typeof reason === 'string' && reason.trim().length > 0),
      'DIRECTOR_REQUEST_ISOLATION_REASONS_INVALID',
      label,
    );
    exactObjectKeys(
      entry.legacyEvidence,
      ['path', 'schemaVersion'],
      'DIRECTOR_REQUEST_ISOLATION_EVIDENCE_INVALID',
      label,
    );
    nonEmpty(entry.legacyEvidence.path, `${label}.legacyEvidence.path`);
    nonEmpty(entry.legacyEvidence.schemaVersion, `${label}.legacyEvidence.schemaVersion`);
    invariant(!requestIds.has(entry.requestId), 'DIRECTOR_REQUEST_ISOLATION_REQUEST_ID_DUPLICATE', entry.requestId);
    invariant(!rawSha256Values.has(entry.rawSha256), 'DIRECTOR_REQUEST_ISOLATION_RAW_SHA_DUPLICATE', entry.rawSha256);
    invariant(
      !canonicalSha256Values.has(entry.canonicalSha256),
      'DIRECTOR_REQUEST_ISOLATION_CANONICAL_SHA_DUPLICATE',
      entry.canonicalSha256,
    );
    invariant(
      !semanticSha256Values.has(entry.semanticSha256),
      'DIRECTOR_REQUEST_ISOLATION_SEMANTIC_SHA_DUPLICATE',
      entry.semanticSha256,
    );
    requestIds.add(entry.requestId);
    rawSha256Values.add(entry.rawSha256);
    canonicalSha256Values.add(entry.canonicalSha256);
    semanticSha256Values.add(entry.semanticSha256);
  }
  return isolationList;
}

export function enforceRequestIsolation(request, options = {}) {
  const repoRoot = path.resolve(options.repoRoot ?? request?.projectRoot ?? defaultRepoRoot);
  const declaredRequestPath = options.requestPath;
  const listPath = path.join(defaultRepoRoot, REQUEST_ISOLATION_REGISTRY_RELATIVE_PATH);
  invariant(
    existsSync(listPath),
    'DIRECTOR_REQUEST_ISOLATION_REGISTRY_MISSING',
    listPath,
  );
  invariant(
    realpathSync(listPath) === listPath,
    'DIRECTOR_REQUEST_ISOLATION_REGISTRY_FIXED_PATH_INVALID',
    listPath,
  );

  const registrySnapshot = options.registrySnapshot ?? readVerifiedFileSnapshot(listPath);
  invariant(
    registrySnapshot.path === listPath,
    'DIRECTOR_REQUEST_ISOLATION_REGISTRY_FIXED_PATH_INVALID',
    listPath,
  );
  const listIntegrity = registryIntegrityAnchor({
    expectedSha256: process.env[REQUEST_ISOLATION_REGISTRY_SHA256_ENV],
    actualSha256: registrySnapshot.sha256,
    required: true,
    requiredCode: 'DIRECTOR_REQUEST_ISOLATION_REGISTRY_SHA_REQUIRED',
    mismatchCode: 'DIRECTOR_REQUEST_ISOLATION_REGISTRY_SHA_MISMATCH',
    label: REQUEST_ISOLATION_REGISTRY_SHA256_ENV,
  });
  const isolationList = parseRequestIsolationList(
    parseVerifiedJsonSnapshot(
      registrySnapshot,
      'DIRECTOR_REQUEST_ISOLATION_LIST_INVALID',
    ).value,
    listPath,
  );
  const requestId = nonEmpty(request?.requestId, 'requestId');
  const canonicalSha256 = sha256Text(stableStringify(request));
  const semanticSha256 = requestSemanticSha256(request);
  const aStateBundleSha256Values = requestAStateBundleSha256Values(request);
  const aStateBundleSha256Set = new Set(aStateBundleSha256Values);
  const receiptSha256Values = requestForbiddenReceiptSha256Values(request);
  const requestReceiptSha256Set = new Set(receiptSha256Values);
  const requestPathAvailable =
    typeof declaredRequestPath === 'string' && declaredRequestPath.trim().length > 0;
  const requestPath = requestPathAvailable ? resolvePath(declaredRequestPath, repoRoot) : undefined;
  const rawSha256 = requestPath && existsSync(requestPath) ? sha256File(requestPath) : undefined;
  const isolatedEntry = isolationList.entries.find((entry) =>
    (rawSha256 !== undefined && entry.rawSha256 === rawSha256) ||
    entry.canonicalSha256 === canonicalSha256 ||
    entry.requestId === requestId ||
    entry.semanticSha256 === semanticSha256 ||
    aStateBundleSha256Set.has(entry.forbiddenBundleSha256) ||
    entry.forbiddenReceiptSha256.some((sha256) => requestReceiptSha256Set.has(sha256)));

  if (isolatedEntry) {
    invariant(
      false,
      'DIRECTOR_REQUEST_ISOLATED_PRE_REVIEW',
      `${requestId}:${rawSha256}:${canonicalSha256}:${semanticSha256}:${isolatedEntry.requestId}:${listPath}`,
    );
  }

  const listActualSha256 = registrySnapshot.sha256;

  if (!requestPathAvailable) {
    invariant(
      request?.execution?.mode !== 'renderable',
      'DIRECTOR_REQUEST_ACTUAL_PATH_REQUIRED',
      'renderable-request-path-unavailable',
    );
    return {
      checked: false,
      reason: 'request-path-unavailable',
      listPath,
      listSha256: listActualSha256,
      listExpectedSha256: listIntegrity.expectedSha256,
      listActualSha256: listIntegrity.actualSha256,
      schemaVersion: isolationList.schemaVersion,
      taskId: isolationList.taskId,
    };
  }
  invariant(existsSync(requestPath), 'DIRECTOR_REQUEST_ACTUAL_FILE_MISSING', requestPath);

  return {
    checked: true,
    isolated: false,
    listPath,
    listSha256: listActualSha256,
    listExpectedSha256: listIntegrity.expectedSha256,
    listActualSha256: listIntegrity.actualSha256,
    schemaVersion: isolationList.schemaVersion,
    taskId: isolationList.taskId,
    rawSha256,
    canonicalSha256,
    semanticSha256,
    aStateBundleSha256Values,
    receiptSha256Values,
  };
}

function finiteNumber(value, label) {
  invariant(Number.isFinite(value), 'DIRECTOR_REQUEST_NUMBER_INVALID', label);
  return value;
}

function nonEmpty(value, label) {
  invariant(typeof value === 'string' && value.trim().length > 0, 'DIRECTOR_REQUEST_STRING_INVALID', label);
  return value;
}

function safeId(value, label) {
  nonEmpty(value, label);
  invariant(/^[a-z0-9][a-z0-9._-]*$/i.test(value), 'DIRECTOR_REQUEST_ID_INVALID', label);
  return value;
}

function controlledPrimitive(value, label) {
  nonEmpty(value, label);
  invariant(CONTROLLED_VISUAL_PRIMITIVES.has(value), 'DIRECTOR_VISUAL_PRIMITIVE_UNKNOWN', `${label}:${value}`);
  return value;
}

function controlledPrimitiveFor(value, capability, label) {
  const primitive = controlledPrimitive(value, label);
  invariant(
    VISUAL_PRIMITIVE_CAPABILITIES[capability]?.has(primitive),
    'DIRECTOR_VISUAL_PRIMITIVE_SLOT_INVALID',
    `${label}:${capability}:${primitive}`,
  );
  return primitive;
}

function controlledVisualRole(value, label) {
  nonEmpty(value, label);
  invariant(CONTROLLED_VISUAL_ROLES.has(value), 'DIRECTOR_VISUAL_ROLE_UNKNOWN', `${label}:${value}`);
  return value;
}

function controlledVisualRoleFor(value, capability, label) {
  const role = controlledVisualRole(value, label);
  invariant(
    VISUAL_ROLE_CAPABILITIES[capability]?.has(role),
    'DIRECTOR_VISUAL_ROLE_SLOT_INVALID',
    `${label}:${capability}:${role}`,
  );
  return role;
}

function compileRelations(relations, endpointIds, sceneId) {
  invariant(Array.isArray(relations) && relations.length > 0, 'DIRECTOR_RELATIONS_REQUIRED', sceneId);
  const seen = new Set();
  return relations.map((relation, index) => {
    const from = safeId(relation.from, `${sceneId}.relations.${index}.from`);
    const to = safeId(relation.to, `${sceneId}.relations.${index}.to`);
    invariant(from !== to, 'DIRECTOR_RELATION_SELF_LOOP_FORBIDDEN', `${sceneId}:${from}`);
    invariant(endpointIds.has(from) && endpointIds.has(to), 'DIRECTOR_RELATION_ENDPOINT_UNKNOWN', `${sceneId}:${from}->${to}`);
    const key = `${from}\0${to}`;
    invariant(!seen.has(key), 'DIRECTOR_RELATION_DUPLICATE', `${sceneId}:${from}->${to}`);
    seen.add(key);
    return {from, to};
  });
}

function roundedFrame(seconds, fps) {
  return Math.round(seconds * fps);
}

function halfOpenRangesOverlap(left, right) {
  return left.sourceIn < right.sourceOut && left.sourceOut > right.sourceIn;
}

function resolvePath(declaredPath, repoRoot) {
  nonEmpty(declaredPath, 'declaredPath');
  return path.isAbsolute(declaredPath) ? path.normalize(declaredPath) : path.resolve(repoRoot, declaredPath);
}

function isInside(parentPath, childPath) {
  const relative = path.relative(parentPath, childPath);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function verifyFile({role, id, declaredPath, expectedSha256}, repoRoot) {
  invariant(SHA256_RE.test(expectedSha256), 'DIRECTOR_REQUEST_SHA_INVALID', `${role}:${id}`);
  const absolutePath = resolvePath(declaredPath, repoRoot);
  invariant(existsSync(absolutePath), 'DIRECTOR_INPUT_FILE_MISSING', `${role}:${absolutePath}`);
  const actualSha256 = sha256File(absolutePath);
  invariant(actualSha256 === expectedSha256, 'DIRECTOR_INPUT_SHA_MISMATCH', `${role}:${id}`);
  return {role, id, path: absolutePath, sha256: actualSha256};
}

function parseBoundJson(filePath, code) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    invariant(false, code, `${filePath}:${error.message}`);
  }
}

function receiptStatePath(state, receiptPath, label) {
  const declaredPath = state?.absolutePath ?? state?.path ?? state?.relativePath;
  nonEmpty(declaredPath, `${label}.path`);
  return path.isAbsolute(declaredPath)
    ? path.normalize(declaredPath)
    : path.resolve(path.dirname(receiptPath), declaredPath);
}

function assertAcceptanceFileBinding(binding, declaration, label) {
  exactObjectKeys(
    binding,
    ['path', 'sha256'],
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_BINDING_FIELDS_INVALID',
    label,
  );
  invariant(binding && typeof binding === 'object', 'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_BINDING_REQUIRED', label);
  invariant(
    path.isAbsolute(binding.path) &&
      path.normalize(binding.path) === binding.path &&
      binding.path === declaration.path &&
      existsSync(binding.path) &&
      realpathSync(binding.path) === binding.path,
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_BINDING_PATH_MISMATCH',
    label,
  );
  invariant(
    binding.sha256 === declaration.sha256,
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_BINDING_SHA_MISMATCH',
    label,
  );
}

function exactObjectKeys(value, expectedKeys, code, label = '') {
  invariant(value && typeof value === 'object' && !Array.isArray(value), code, label);
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  invariant(
    actual.length === expected.length && actual.every((key, index) => key === expected[index]),
    code,
    `${label}:${actual.join(',')}`,
  );
}

function supervisorAcceptanceRegistryRelativePath(value, label) {
  const segments = typeof value === 'string' ? value.split('/') : [];
  invariant(
    typeof value === 'string' &&
      value.length > 0 &&
      value.trim() === value &&
      !path.isAbsolute(value) &&
      !path.posix.isAbsolute(value) &&
      !path.win32.isAbsolute(value) &&
      !value.includes('\\') &&
      path.posix.normalize(value) === value &&
      segments.every(
        (segment) => segment.length > 0 && segment !== '.' && segment !== '..',
      ),
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_ANCHOR_RELATIVE_PATH_INVALID',
    label,
  );
  return value;
}

function resolveSupervisorAcceptanceRegistryPath(value, repoRoot, label) {
  const relativePath = supervisorAcceptanceRegistryRelativePath(value, label);
  const absoluteRepoRoot = path.resolve(repoRoot);
  invariant(
    existsSync(absoluteRepoRoot) &&
      statSync(absoluteRepoRoot).isDirectory() &&
      realpathSync(absoluteRepoRoot) === absoluteRepoRoot,
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_ANCHOR_REPO_ROOT_INVALID',
    absoluteRepoRoot,
  );
  const lexicalPath = path.resolve(absoluteRepoRoot, ...relativePath.split('/'));
  invariant(
    lexicalPath !== absoluteRepoRoot && isInside(absoluteRepoRoot, lexicalPath),
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_ANCHOR_RELATIVE_PATH_INVALID',
    label,
  );
  invariant(existsSync(lexicalPath), 'DIRECTOR_INPUT_FILE_MISSING', lexicalPath);
  const metadata = lstatSync(lexicalPath);
  const realPath = realpathSync(lexicalPath);
  invariant(
    metadata.isFile() &&
      !metadata.isSymbolicLink() &&
      realPath === lexicalPath &&
      isInside(absoluteRepoRoot, realPath),
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_ANCHOR_PATH_ALIAS_FORBIDDEN',
    label,
  );
  return lexicalPath;
}

const EXECUTION_INTEGRITY_ANCHOR_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: 'compiler',
    relativePath: DIRECTOR_COMPILER_RELATIVE_PATH,
    environmentVariable: undefined,
  }),
  Object.freeze({
    id: 'requestIsolationRegistry',
    relativePath: REQUEST_ISOLATION_REGISTRY_RELATIVE_PATH,
    environmentVariable: REQUEST_ISOLATION_REGISTRY_SHA256_ENV,
  }),
  Object.freeze({
    id: 'supervisorAcceptanceRegistry',
    relativePath: SUPERVISOR_ACCEPTANCE_ANCHOR_REGISTRY_RELATIVE_PATH,
    environmentVariable: SUPERVISOR_ACCEPTANCE_REGISTRY_SHA256_ENV,
  }),
]);

function integrityAnchorErrorId(id) {
  return id.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
}

function captureExecutionIntegrityAnchorState(request, options = {}) {
  const repoRoot = path.resolve(options.repoRoot ?? request?.projectRoot ?? defaultRepoRoot);
  const anchors = request?.execution?.integrityAnchors;
  exactObjectKeys(
    anchors,
    EXECUTION_INTEGRITY_ANCHOR_DEFINITIONS.map((definition) => definition.id),
    'DIRECTOR_EXECUTION_INTEGRITY_ANCHORS_FIELDS_INVALID',
  );
  const verified = {};
  const fileSnapshots = {};
  for (const definition of EXECUTION_INTEGRITY_ANCHOR_DEFINITIONS) {
    const label = integrityAnchorErrorId(definition.id);
    const anchor = anchors[definition.id];
    exactObjectKeys(
      anchor,
      ['path', 'sha256'],
      `DIRECTOR_EXECUTION_INTEGRITY_ANCHOR_${label}_FIELDS_INVALID`,
      definition.id,
    );
    invariant(
      anchor.path === definition.relativePath,
      `DIRECTOR_EXECUTION_INTEGRITY_ANCHOR_${label}_PATH_INVALID`,
      `${anchor.path}:${definition.relativePath}`,
    );
    invariant(
      SHA256_RE.test(anchor.sha256 ?? ''),
      `DIRECTOR_EXECUTION_INTEGRITY_ANCHOR_${label}_SHA_INVALID`,
      anchor.sha256,
    );
    const absolutePath = path.resolve(repoRoot, definition.relativePath);
    const expectedAbsolutePath = definition.id === 'compiler'
      ? scriptPath
      : path.resolve(defaultRepoRoot, definition.relativePath);
    invariant(
      absolutePath === expectedAbsolutePath && existsSync(absolutePath) &&
        statSync(absolutePath).isFile() && realpathSync(absolutePath) === absolutePath,
      `DIRECTOR_EXECUTION_INTEGRITY_ANCHOR_${label}_PATH_INVALID`,
      `${absolutePath}:${expectedAbsolutePath}`,
    );
    const fileSnapshot = readVerifiedFileSnapshot(absolutePath);
    const actualSha256 = fileSnapshot.sha256;
    if (definition.id === 'compiler') {
      invariant(
        anchor.sha256 === actualSha256,
        'DIRECTOR_EXECUTION_INTEGRITY_ANCHOR_COMPILER_SHA_MISMATCH',
        `${anchor.sha256}:${actualSha256}`,
      );
    } else {
      const environmentSha256 = process.env[definition.environmentVariable];
      invariant(
        SHA256_RE.test(environmentSha256 ?? ''),
        `DIRECTOR_EXECUTION_INTEGRITY_ANCHOR_${label}_ENV_SHA_INVALID`,
        definition.environmentVariable,
      );
      invariant(
        anchor.sha256 === environmentSha256,
        `DIRECTOR_EXECUTION_INTEGRITY_ANCHOR_${label}_REQUEST_ENV_MISMATCH`,
        `${anchor.sha256}:${environmentSha256}`,
      );
      invariant(
        environmentSha256 === actualSha256,
        `DIRECTOR_EXECUTION_INTEGRITY_ANCHOR_${label}_ENV_ACTUAL_MISMATCH`,
        `${environmentSha256}:${actualSha256}`,
      );
    }
    verified[definition.id] = {
      path: definition.relativePath,
      sha256: actualSha256,
    };
    fileSnapshots[definition.id] = fileSnapshot;
  }
  return {anchors: verified, fileSnapshots};
}

export function validateExecutionIntegrityAnchors(request, options = {}) {
  return captureExecutionIntegrityAnchorState(request, options).anchors;
}

export function revalidateExecutionIntegrityAnchors(request, {
  expectedSnapshot,
  expectedFileSnapshots,
  phase,
  ...options
} = {}) {
  const actualState = captureExecutionIntegrityAnchorState(request, options);
  const actualSnapshot = actualState.anchors;
  invariant(
    stableStringify(actualSnapshot) === stableStringify(expectedSnapshot),
    'DIRECTOR_EXECUTION_INTEGRITY_ANCHORS_DRIFT',
    phase,
  );
  if (expectedFileSnapshots) {
    for (const definition of EXECUTION_INTEGRITY_ANCHOR_DEFINITIONS) {
      invariant(
        stableStringify(verifiedFileIdentity(actualState.fileSnapshots[definition.id])) ===
          stableStringify(verifiedFileIdentity(expectedFileSnapshots[definition.id])),
        'DIRECTOR_EXECUTION_INTEGRITY_ANCHOR_FILE_SNAPSHOT_DRIFT',
        `${phase}:${definition.id}`,
      );
    }
  }
  return actualSnapshot;
}

function parseSupervisorAcceptanceAnchorRegistry(registry, registryPath) {
  invariant(
    registry.schemaVersion === SUPERVISOR_ACCEPTANCE_ANCHOR_REGISTRY_SCHEMA,
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_ANCHOR_REGISTRY_SCHEMA_INVALID',
  );
  exactObjectKeys(
    registry,
    ['schemaVersion', 'taskId', 'registryPolicy', 'entries'],
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_ANCHOR_REGISTRY_FIELDS_INVALID',
  );
  safeId(registry.taskId, `${registryPath}:taskId`);
  exactObjectKeys(
    registry.registryPolicy,
    [
      'source',
      'relativePath',
      'externalSha256Env',
      'failClosedOnMissingRegistry',
      'failClosedOnMissingEntry',
    ],
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_ANCHOR_REGISTRY_POLICY_INVALID',
  );
  invariant(
    registry.registryPolicy?.source === 'skill-fixed-registry' &&
      registry.registryPolicy?.relativePath === SUPERVISOR_ACCEPTANCE_ANCHOR_REGISTRY_RELATIVE_PATH &&
      registry.registryPolicy?.externalSha256Env === SUPERVISOR_ACCEPTANCE_REGISTRY_SHA256_ENV &&
      registry.registryPolicy?.failClosedOnMissingRegistry === true &&
      registry.registryPolicy?.failClosedOnMissingEntry === true,
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_ANCHOR_REGISTRY_POLICY_INVALID',
  );
  invariant(Array.isArray(registry.entries), 'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_ANCHOR_ENTRIES_INVALID');
  const keys = new Set();
  for (const [index, entry] of registry.entries.entries()) {
    const label = `${registryPath}:entries.${index}`;
    exactObjectKeys(
      entry,
      ['gateId', 'acceptanceId', 'status', 'receipt', 'machineReview', 'visualReview'],
      'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_ANCHOR_ENTRY_FIELDS_INVALID',
      label,
    );
    safeId(entry.gateId, `${label}.gateId`);
    safeId(entry.acceptanceId, `${label}.acceptanceId`);
    invariant(
      entry.gateId === SUPERVISOR_A_GATE_ID,
      'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_ANCHOR_ID_INVALID',
      label,
    );
    invariant(entry.status === 'active', 'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_ANCHOR_STATUS_INVALID', label);
    for (const [bindingName, binding] of Object.entries({
      receipt: entry.receipt,
      machineReview: entry.machineReview,
      visualReview: entry.visualReview,
    })) {
      exactObjectKeys(
        binding,
        ['path', 'sha256'],
        'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_ANCHOR_BINDING_INVALID',
        `${label}.${bindingName}`,
      );
      invariant(
        supervisorAcceptanceRegistryRelativePath(
          binding.path,
          `${label}.${bindingName}.path`,
        ) === binding.path &&
          SHA256_RE.test(binding.sha256),
        'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_ANCHOR_BINDING_INVALID',
        `${label}.${bindingName}`,
      );
    }
    const key = `${entry.gateId}\0${entry.acceptanceId}`;
    invariant(!keys.has(key), 'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_ANCHOR_DUPLICATE', key);
    keys.add(key);
  }
  return registry;
}

function safePackageRelativePath(value, packageRoot, label) {
  nonEmpty(value, `${label}.relativePath`);
  invariant(
    !path.isAbsolute(value) &&
      path.normalize(value) === value &&
      path.posix.normalize(value) === value &&
      value !== '.' &&
      value !== '..' &&
      !value.includes('\\') &&
      !value.split('/').includes('..'),
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_RELATIVE_PATH_INVALID',
    label,
  );
  const lexicalPath = path.join(packageRoot, value);
  invariant(existsSync(lexicalPath), 'DIRECTOR_INPUT_FILE_MISSING', lexicalPath);
  const realPath = realpathSync(lexicalPath);
  invariant(
    realPath === path.normalize(lexicalPath) && isInside(packageRoot, realPath),
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_PATH_ALIAS_FORBIDDEN',
    label,
  );
  return realPath;
}

function exactAbsolutePackagePath(value, packageRoot, label) {
  nonEmpty(value, `${label}.path`);
  invariant(path.isAbsolute(value) && path.normalize(value) === value, 'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_ABSOLUTE_PATH_INVALID', label);
  invariant(existsSync(value), 'DIRECTOR_INPUT_FILE_MISSING', value);
  const realPath = realpathSync(value);
  invariant(
    realPath === value && isInside(packageRoot, realPath),
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_PATH_ALIAS_FORBIDDEN',
    label,
  );
  return realPath;
}

function assertUniquePathField(value, allowedKey, label) {
  invariant(
    value && typeof value === 'object' && !Array.isArray(value),
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_PATH_FIELDS_INVALID',
    label,
  );
  const pathLikeKeys = Object.keys(value).filter((key) =>
    key.toLowerCase() === 'file' || key.toLowerCase().includes('path'));
  invariant(
    pathLikeKeys.length === 1 && pathLikeKeys[0] === allowedKey,
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_PATH_ALIAS_FIELDS_FORBIDDEN',
    `${label}:${pathLikeKeys.join(',')}`,
  );
}

function collectTrueAuthorizationPaths(value, prefix = '') {
  if (!value || typeof value !== 'object') return [];
  const findings = [];
  for (const [key, child] of Object.entries(value)) {
    const childPath = prefix ? `${prefix}.${key}` : key;
    if (child === true && /(?:allowed|authorized|enabled|eligible)$/i.test(key)) {
      findings.push(childPath);
    }
    if (child && typeof child === 'object') {
      findings.push(...collectTrueAuthorizationPaths(child, childPath));
    }
  }
  return findings;
}

function validateSupervisorAIndependentAcceptanceGateCore({
  request,
  scenes,
  repoRoot: declaredRepoRoot,
  requestPath: declaredRequestPath,
  acceptanceAnchorRegistryPath,
  acceptanceAnchorRegistryExpectedSha256,
  acceptanceAnchorRegistrySnapshot,
}) {
  const executionMode = request?.execution?.mode;
  invariant(
    executionMode === 'renderable' || executionMode === 'plan-only',
    'DIRECTOR_EXECUTION_MODE_INVALID',
  );

  invariant(
    existsSync(acceptanceAnchorRegistryPath) &&
      realpathSync(acceptanceAnchorRegistryPath) === acceptanceAnchorRegistryPath,
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_ANCHOR_REGISTRY_FIXED_PATH_INVALID',
    acceptanceAnchorRegistryPath,
  );
  const registrySnapshot = acceptanceAnchorRegistrySnapshot ??
    readVerifiedFileSnapshot(acceptanceAnchorRegistryPath);
  invariant(
    registrySnapshot.path === acceptanceAnchorRegistryPath,
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_ANCHOR_REGISTRY_FIXED_PATH_INVALID',
    acceptanceAnchorRegistryPath,
  );
  const acceptanceAnchorRegistryActualSha256 = registrySnapshot.sha256;
  const acceptanceRegistryIntegrity = registryIntegrityAnchor({
    expectedSha256: acceptanceAnchorRegistryExpectedSha256,
    actualSha256: acceptanceAnchorRegistryActualSha256,
    required: true,
    requiredCode: 'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_REGISTRY_SHA_REQUIRED',
    mismatchCode: 'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_REGISTRY_SHA_MISMATCH',
    label: SUPERVISOR_ACCEPTANCE_REGISTRY_SHA256_ENV,
  });

  const repoRoot = path.resolve(declaredRepoRoot ?? request?.projectRoot ?? defaultRepoRoot);
  const acceptanceAnchorRegistry = parseSupervisorAcceptanceAnchorRegistry(
    parseVerifiedJsonSnapshot(
      registrySnapshot,
      'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_ANCHOR_REGISTRY_JSON_INVALID',
    ).value,
    acceptanceAnchorRegistryPath,
  );
  const anchorRegistryActualBinding = verifyFile({
    role: 'supervisor-acceptance-anchor-registry-integrity',
    id: 'actual',
    declaredPath: acceptanceAnchorRegistryPath,
    expectedSha256: acceptanceRegistryIntegrity.actualSha256,
  }, repoRoot);
  const anchorRegistryExpectedBinding = verifyFile({
    role: 'supervisor-acceptance-anchor-registry-integrity',
    id: 'external-expected',
    declaredPath: acceptanceAnchorRegistryPath,
    expectedSha256: acceptanceRegistryIntegrity.expectedSha256,
  }, repoRoot);
  if (executionMode === 'plan-only') {
    return {
      required: false,
      verifiedBindings: [anchorRegistryActualBinding, anchorRegistryExpectedBinding],
    };
  }

  const requestPath = resolvePath(declaredRequestPath ?? request?.execution?.requestPath, repoRoot);
  const expectedAcceptancePath = path.join(path.dirname(requestPath), SUPERVISOR_A_ACCEPTANCE_FILE_NAME);
  const expectedMachineReviewPath = path.join(
    path.dirname(requestPath),
    SUPERVISOR_A_MACHINE_REVIEW_FILE_NAME,
  );
  const expectedVisualReviewPath = path.join(
    path.dirname(requestPath),
    SUPERVISOR_A_VISUAL_REVIEW_FILE_NAME,
  );
  const declarations = request.authority?.receipts ?? [];
  invariant(Array.isArray(declarations), 'DIRECTOR_AUTHORITY_RECEIPTS_INVALID');
  const byId = new Map(declarations.map((item) => [item.id, item]));
  invariant(byId.size === declarations.length, 'DIRECTOR_AUTHORITY_RECEIPT_ID_DUPLICATE');

  const acceptanceDeclaration = byId.get(SUPERVISOR_A_ACCEPTANCE_DECLARATION_ID);
  invariant(
    acceptanceDeclaration?.kind === SUPERVISOR_A_ACCEPTANCE_KIND &&
      acceptanceDeclaration.effect === 'required-gate',
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_RECEIPT_REQUIRED',
  );
  exactObjectKeys(
    acceptanceDeclaration,
    ['id', 'kind', 'effect', 'gateId', 'acceptanceId', 'path', 'sha256'],
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_DECLARATION_INVALID',
  );
  safeId(acceptanceDeclaration.gateId, 'supervisor acceptance declaration gateId');
  safeId(acceptanceDeclaration.acceptanceId, 'supervisor acceptance declaration acceptanceId');
  invariant(
    acceptanceDeclaration.gateId === SUPERVISOR_A_GATE_ID,
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_ID_INVALID',
  );
  invariant(
    path.isAbsolute(acceptanceDeclaration.path) &&
      path.normalize(acceptanceDeclaration.path) === acceptanceDeclaration.path &&
      acceptanceDeclaration.path === expectedAcceptancePath,
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_PATH_INVALID',
    expectedAcceptancePath,
  );
  const acceptanceAnchor = acceptanceAnchorRegistry.entries.find((entry) =>
    entry.gateId === acceptanceDeclaration.gateId &&
      entry.acceptanceId === acceptanceDeclaration.acceptanceId);
  invariant(
    acceptanceAnchor,
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_ANCHOR_NOT_REGISTERED',
    `${acceptanceDeclaration.gateId}:${acceptanceDeclaration.acceptanceId}`,
  );
  const acceptanceAnchorReceiptPath = resolveSupervisorAcceptanceRegistryPath(
    acceptanceAnchor.receipt.path,
    repoRoot,
    'acceptanceAnchor.receipt.path',
  );
  const acceptanceAnchorMachineReviewPath = resolveSupervisorAcceptanceRegistryPath(
    acceptanceAnchor.machineReview.path,
    repoRoot,
    'acceptanceAnchor.machineReview.path',
  );
  const acceptanceAnchorVisualReviewPath = resolveSupervisorAcceptanceRegistryPath(
    acceptanceAnchor.visualReview.path,
    repoRoot,
    'acceptanceAnchor.visualReview.path',
  );
  invariant(
    acceptanceDeclaration.path === acceptanceAnchorReceiptPath &&
      acceptanceDeclaration.sha256 === acceptanceAnchor.receipt.sha256,
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_DECLARATION_ANCHOR_MISMATCH',
  );
  const acceptanceBinding = verifyFile({
    role: 'authority-receipt',
    id: SUPERVISOR_A_ACCEPTANCE_DECLARATION_ID,
    declaredPath: acceptanceDeclaration.path,
    expectedSha256: acceptanceDeclaration.sha256,
  }, repoRoot);
  invariant(
    realpathSync(acceptanceDeclaration.path) === acceptanceDeclaration.path,
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_PATH_ALIAS_FORBIDDEN',
    acceptanceDeclaration.path,
  );
  const acceptanceReceipt = parseBoundJson(
    acceptanceDeclaration.path,
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_JSON_INVALID',
  );
  invariant(
    acceptanceReceipt.schema === SUPERVISOR_A_ACCEPTANCE_SCHEMA,
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_SCHEMA_INVALID',
  );
  invariant(
    acceptanceReceipt.status === 'accepted-for-exact30-candidate',
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_STATUS_INVALID',
  );
  invariant(
    acceptanceReceipt.gateId === acceptanceDeclaration.gateId &&
      acceptanceReceipt.acceptanceId === acceptanceDeclaration.acceptanceId,
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_ID_MISMATCH',
  );
  exactObjectKeys(
    acceptanceReceipt,
    [
      'schema',
      'status',
      'gateId',
      'acceptanceId',
      'artifactBundleSha256',
      'stateCount',
      'fps',
      'endExclusiveFrame',
      'machineReview',
      'visualReview',
      'operationalEffect',
      'terminalAuthorityCorrection',
      'bindings',
    ],
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_FIELDS_INVALID',
  );
  invariant(
    acceptanceReceipt.stateCount === 17 &&
      acceptanceReceipt.fps === SUPERVISOR_A_AUTHORITATIVE_FPS &&
      acceptanceReceipt.endExclusiveFrame === SUPERVISOR_A_END_EXCLUSIVE_FRAME &&
      SHA256_RE.test(acceptanceReceipt.artifactBundleSha256 ?? ''),
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_SCHEDULE_HEADER_INVALID',
  );
  const reviewBindings = [];
  const reviewArtifactBundleSha256Values = [];
  for (const [
    label,
    review,
    anchorReview,
    anchorReviewPath,
    expectedRole,
    expectedReviewPath,
  ] of [
    [
      'machine',
      acceptanceReceipt.machineReview,
      acceptanceAnchor.machineReview,
      acceptanceAnchorMachineReviewPath,
      'machine',
      expectedMachineReviewPath,
    ],
    [
      'visual',
      acceptanceReceipt.visualReview,
      acceptanceAnchor.visualReview,
      acceptanceAnchorVisualReviewPath,
      'visual',
      expectedVisualReviewPath,
    ],
  ]) {
    exactObjectKeys(
      review,
      ['path', 'sha256', 'decision', 'p0', 'p1'],
      'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_REVIEW_BINDING_INVALID',
      label,
    );
    invariant(
      review.path === expectedReviewPath &&
        review.path === anchorReviewPath && review.sha256 === anchorReview.sha256,
      'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_REVIEW_ANCHOR_MISMATCH',
      label,
    );
    const reviewBinding = verifyFile({
      role: 'supervisor-independent-review',
      id: `${SUPERVISOR_A_ACCEPTANCE_DECLARATION_ID}-${label}`,
      declaredPath: review.path,
      expectedSha256: review.sha256,
    }, repoRoot);
    invariant(
      path.normalize(review.path) === review.path && realpathSync(review.path) === review.path,
      'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_REVIEW_PATH_ALIAS_FORBIDDEN',
      label,
    );
    reviewBindings.push(reviewBinding);
    const reviewReceipt = parseBoundJson(
      review.path,
      'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_REVIEW_JSON_INVALID',
    );
    exactObjectKeys(
      reviewReceipt,
      [
        'schema',
        'status',
        'gateId',
        'acceptanceId',
        'artifactBundleSha256',
        'reviewRole',
        'decision',
        'p0',
        'p1',
      ],
      'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_REVIEW_FIELDS_INVALID',
      label,
    );
    invariant(
      reviewReceipt.schema === SUPERVISOR_A_REVIEW_SCHEMA &&
        reviewReceipt.status === 'accepted-for-exact30-candidate' &&
        reviewReceipt.gateId === acceptanceDeclaration.gateId &&
        reviewReceipt.acceptanceId === acceptanceDeclaration.acceptanceId &&
        reviewReceipt.reviewRole === expectedRole &&
        SHA256_RE.test(reviewReceipt.artifactBundleSha256 ?? '') &&
        reviewReceipt.decision === 'go' && reviewReceipt.p0 === 0 && reviewReceipt.p1 === 0 &&
        review.decision === reviewReceipt.decision &&
        review.p0 === reviewReceipt.p0 && review.p1 === reviewReceipt.p1,
      'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_REVIEW_NOT_GO',
      label,
    );
    reviewArtifactBundleSha256Values.push(reviewReceipt.artifactBundleSha256);
  }
  exactObjectKeys(
    acceptanceReceipt.operationalEffect,
    [
      'exact30CompileAllowed',
      'productionEligible',
      'automationFreezeMustRemain',
      'automationHandoffAllowed',
    ],
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_OPERATIONAL_EFFECT_FIELDS_INVALID',
  );
  const operationalEffect = acceptanceReceipt.operationalEffect;
  invariant(
    operationalEffect.exact30CompileAllowed === true,
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_EXACT30_COMPILE_NOT_ALLOWED',
  );
  invariant(
    operationalEffect.productionEligible === false,
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_PRODUCTION_STATE_INVALID',
  );
  invariant(
    operationalEffect.automationFreezeMustRemain === true,
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_AUTOMATION_FREEZE_MISSING',
  );
  invariant(
    operationalEffect.automationHandoffAllowed === false,
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_AUTOMATION_HANDOFF_INVALID',
  );
  exactObjectKeys(
    acceptanceReceipt.terminalAuthorityCorrection,
    [
      'scope',
      'staticDirectionAuthoritySha256',
      'acceptedCandidateTerminalStateId',
      'acceptedCandidateTerminalStateSha256',
      'staticDirectionReceiptPreserved',
    ],
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_TERMINAL_CORRECTION_FIELDS_INVALID',
  );
  const terminalAuthorityCorrection = acceptanceReceipt.terminalAuthorityCorrection;
  invariant(
    terminalAuthorityCorrection.scope === 'exact30-candidate-only' &&
      terminalAuthorityCorrection.staticDirectionAuthoritySha256 ===
        SUPERVISOR_A_STATIC_DIRECTION_AUTHORITY_SHA256 &&
      terminalAuthorityCorrection.acceptedCandidateTerminalStateId === 'A16' &&
      terminalAuthorityCorrection.acceptedCandidateTerminalStateSha256 ===
        SUPERVISOR_A_CORRECTED_TERMINAL_STATE_SHA256 &&
      terminalAuthorityCorrection.staticDirectionReceiptPreserved === true,
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_TERMINAL_CORRECTION_INVALID',
  );
  exactObjectKeys(
    acceptanceReceipt.bindings,
    [
      'builder',
      'manifest',
      'generationReceipt',
      'authorityReceipt',
      'contactSheet',
      'stateTreeSha256',
      'scheduleSha256',
      'states',
    ],
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_BINDINGS_FIELDS_INVALID',
  );

  const sourceDeclarations = {
    manifest: byId.get('scene-a-progressive-states-manifest'),
    generationReceipt: byId.get('scene-a-progressive-states-generation-receipt'),
    authorityReceipt: byId.get('scene-a-dynamic-states-receipt'),
  };
  invariant(
    sourceDeclarations.manifest?.kind === 'visual-state-manifest' &&
      sourceDeclarations.manifest.effect === 'evidence-only',
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_MANIFEST_DECLARATION_INVALID',
  );
  invariant(
    sourceDeclarations.generationReceipt?.kind === 'visual-state-generation-receipt' &&
      sourceDeclarations.generationReceipt.effect === 'evidence-only',
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_GENERATION_RECEIPT_DECLARATION_INVALID',
  );
  invariant(
    sourceDeclarations.authorityReceipt?.kind === 'visual-state-package' &&
      sourceDeclarations.authorityReceipt.effect === 'evidence-only',
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_AUTHORITY_RECEIPT_DECLARATION_INVALID',
  );
  exactObjectKeys(
    sourceDeclarations.manifest,
    ['id', 'kind', 'effect', 'path', 'sha256'],
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_MANIFEST_DECLARATION_FIELDS_INVALID',
  );
  exactObjectKeys(
    sourceDeclarations.generationReceipt,
    ['id', 'kind', 'effect', 'path', 'sha256'],
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_GENERATION_DECLARATION_FIELDS_INVALID',
  );
  exactObjectKeys(
    sourceDeclarations.authorityReceipt,
    ['id', 'kind', 'effect', 'path', 'sha256', 'bindings'],
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_AUTHORITY_DECLARATION_FIELDS_INVALID',
  );
  const packageRootLexical = path.join(
    path.dirname(requestPath),
    'a-progressive-states-canonical',
  );
  invariant(
    existsSync(packageRootLexical) && statSync(packageRootLexical).isDirectory(),
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_PACKAGE_ROOT_MISSING',
    packageRootLexical,
  );
  const packageRoot = realpathSync(packageRootLexical);
  invariant(
    packageRoot === packageRootLexical,
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_PATH_ALIAS_FORBIDDEN',
    packageRootLexical,
  );
  const expectedSourcePaths = {
    manifest: path.join(packageRoot, 'a-progressive-states.manifest.json'),
    generationReceipt: path.join(packageRoot, 'a-progressive-states.receipt.json'),
    authorityReceipt: path.join(packageRoot, 'a-progressive-states.authority-receipt.json'),
  };
  for (const [label, declaration] of Object.entries(sourceDeclarations)) {
    invariant(
      existsSync(declaration.path) &&
      declaration.path === expectedSourcePaths[label] &&
        realpathSync(declaration.path) === declaration.path,
      'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_SOURCE_PATH_INVALID',
      label,
    );
    verifyFile({
      role: 'authority-receipt',
      id: declaration.id,
      declaredPath: declaration.path,
      expectedSha256: declaration.sha256,
    }, repoRoot);
    assertAcceptanceFileBinding(acceptanceReceipt.bindings?.[label], declaration, label);
  }

  const manifest = parseBoundJson(
    sourceDeclarations.manifest.path,
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_MANIFEST_JSON_INVALID',
  );
  const generationReceipt = parseBoundJson(
    sourceDeclarations.generationReceipt.path,
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_GENERATION_RECEIPT_JSON_INVALID',
  );
  const authorityReceipt = parseBoundJson(
    sourceDeclarations.authorityReceipt.path,
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_AUTHORITY_RECEIPT_JSON_INVALID',
  );
  invariant(
    manifest.schema === 'paper-editorial-a-progressive-states/v1' &&
      manifest.status === 'candidate-assets-only' &&
      manifest.stateCount === 17 &&
      Array.isArray(manifest.states) && manifest.states.length === 17,
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_MANIFEST_HEADER_INVALID',
  );
  invariant(
    generationReceipt.schema === 'paper-editorial-a-progressive-states-receipt/v1' &&
      generationReceipt.status === 'candidate-assets-generated-no-video-render' &&
      generationReceipt.stateCount === 17 &&
      Array.isArray(generationReceipt.states) && generationReceipt.states.length === 17,
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_GENERATION_RECEIPT_HEADER_INVALID',
  );
  invariant(
    authorityReceipt.schema === 'director-a-progressive-visual-state-package/v1' &&
      authorityReceipt.status === 'candidate-assets-awaiting-supervisor-independent-acceptance' &&
      authorityReceipt.stateCount === 17 &&
      Array.isArray(authorityReceipt.states) && authorityReceipt.states.length === 17,
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_AUTHORITY_RECEIPT_HEADER_INVALID',
  );
  invariant(
    manifest.render?.fps === SUPERVISOR_A_AUTHORITATIVE_FPS &&
      manifest.render?.sceneEndExclusiveFrame === SUPERVISOR_A_END_EXCLUSIVE_FRAME,
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_MANIFEST_SCHEDULE_HEADER_INVALID',
  );
  invariant(
    generationReceipt.prohibitedActionsObserved &&
      typeof generationReceipt.prohibitedActionsObserved === 'object',
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_GENERATION_PROHIBITED_ACTIONS_INVALID',
  );
  exactObjectKeys(
    generationReceipt.prohibitedActionsObserved,
    ['videoRendered', 'externalNetworkUsed', 'paidServiceUsed'],
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_GENERATION_PROHIBITED_ACTIONS_FIELDS_INVALID',
  );
  invariant(
    generationReceipt.prohibitedActionsObserved?.videoRendered === false &&
      generationReceipt.prohibitedActionsObserved?.externalNetworkUsed === false &&
      generationReceipt.prohibitedActionsObserved?.paidServiceUsed === false &&
      [
        generationReceipt.videoRendered,
        generationReceipt.externalNetworkUsed,
        generationReceipt.paidServiceUsed,
      ].every((value) => value === undefined || value === false),
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_GENERATION_PROHIBITED_ACTIONS_INVALID',
  );
  invariant(
    authorityReceipt.productionEligible === false &&
      authorityReceipt.automationHandoffAllowed === false &&
      [
        authorityReceipt.videoRendered,
        authorityReceipt.externalNetworkUsed,
        authorityReceipt.paidServiceUsed,
      ].every((value) => value === undefined || value === false) &&
      collectTrueAuthorizationPaths(authorityReceipt).length === 0,
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_AUTHORITY_OPERATIONAL_STATE_INVALID',
  );
  invariant(
    authorityReceipt.terminalAuthorityCorrection?.staticDirectionAuthoritySha256 ===
      SUPERVISOR_A_STATIC_DIRECTION_AUTHORITY_SHA256 &&
      authorityReceipt.terminalAuthorityCorrection?.acceptedCandidateTerminalStateSha256 ===
        SUPERVISOR_A_CORRECTED_TERMINAL_STATE_SHA256 &&
      authorityReceipt.terminalAuthorityCorrection?.supervisorAcceptanceRegistryRequired === true &&
      authorityReceipt.terminalAuthorityCorrection?.supervisorAcceptanceRegistryIssued === false &&
      authorityReceipt.terminalAuthorityCorrection?.authorSelfApprovalAllowed === false,
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_AUTHORITY_TERMINAL_CORRECTION_INVALID',
  );
  exactObjectKeys(
    generationReceipt.manifest,
    ['relativePath', 'sha256'],
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_GENERATION_MANIFEST_FIELDS_INVALID',
  );
  const generatedManifestPath = safePackageRelativePath(
    generationReceipt.manifest.relativePath,
    packageRoot,
    'generationReceipt.manifest',
  );
  invariant(
    generatedManifestPath === path.normalize(sourceDeclarations.manifest.path) &&
      generationReceipt.manifest?.sha256 === sourceDeclarations.manifest.sha256,
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_GENERATION_MANIFEST_MISMATCH',
  );
  exactObjectKeys(
    authorityReceipt.frozenInputs?.manifest,
    ['path', 'sha256'],
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_AUTHORITY_FROZEN_INPUT_FIELDS_INVALID',
    'manifest',
  );
  exactObjectKeys(
    authorityReceipt.frozenInputs?.generationReceipt,
    ['path', 'sha256'],
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_AUTHORITY_FROZEN_INPUT_FIELDS_INVALID',
    'generationReceipt',
  );
  exactObjectKeys(
    authorityReceipt.frozenInputs?.builder,
    ['path', 'sha256'],
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_AUTHORITY_FROZEN_INPUT_FIELDS_INVALID',
    'builder',
  );
  const authorityManifestPath = exactAbsolutePackagePath(
    authorityReceipt.frozenInputs.manifest.path,
    packageRoot,
    'authorityReceipt.frozenInputs.manifest',
  );
  const authorityGenerationReceiptPath = exactAbsolutePackagePath(
    authorityReceipt.frozenInputs.generationReceipt.path,
    packageRoot,
    'authorityReceipt.frozenInputs.generationReceipt',
  );
  const authorityBuilderPath = exactAbsolutePackagePath(
    authorityReceipt.frozenInputs.builder.path,
    packageRoot,
    'authorityReceipt.frozenInputs.builder',
  );
  invariant(
    authorityManifestPath === path.normalize(sourceDeclarations.manifest.path) &&
      authorityReceipt.frozenInputs?.manifest?.sha256 === sourceDeclarations.manifest.sha256 &&
      authorityGenerationReceiptPath === path.normalize(sourceDeclarations.generationReceipt.path) &&
      authorityReceipt.frozenInputs?.generationReceipt?.sha256 === sourceDeclarations.generationReceipt.sha256,
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_AUTHORITY_FROZEN_INPUT_MISMATCH',
  );
  invariant(
    generationReceipt.script === undefined,
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_PATH_ALIAS_FIELDS_FORBIDDEN',
    'generationReceipt.builder',
  );
  const builderRecord = generationReceipt.builder;
  exactObjectKeys(
    builderRecord,
    ['relativePath', 'sha256'],
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_BUILDER_FIELDS_INVALID',
  );
  const builderPath = safePackageRelativePath(
    builderRecord.relativePath,
    packageRoot,
    'generationReceipt.builder',
  );
  const builderBinding = acceptanceReceipt.bindings?.builder;
  exactObjectKeys(
    builderBinding,
    ['path', 'sha256'],
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_BUILDER_BINDING_FIELDS_INVALID',
  );
  invariant(
    builderBinding &&
      exactAbsolutePackagePath(builderBinding.path, packageRoot, 'acceptance.bindings.builder') === builderPath &&
      builderBinding.sha256 === builderRecord?.sha256 &&
      authorityBuilderPath === builderPath &&
      authorityReceipt.frozenInputs.builder.sha256 === builderRecord.sha256,
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_BUILDER_MISMATCH',
  );
  verifyFile({
    role: 'authority-evidence',
    id: 'scene-a-state-builder',
    declaredPath: builderBinding.path,
    expectedSha256: builderBinding.sha256,
  }, repoRoot);

  exactObjectKeys(
    manifest.contactSheet,
    ['relativePath', 'sha256', 'bytes'],
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_CONTACT_SHEET_FIELDS_INVALID',
    'manifest',
  );
  exactObjectKeys(
    generationReceipt.contactSheet,
    ['relativePath', 'sha256', 'bytes'],
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_CONTACT_SHEET_FIELDS_INVALID',
    'generationReceipt',
  );
  const contactSheetPath = safePackageRelativePath(
    manifest.contactSheet.relativePath,
    packageRoot,
    'manifest.contactSheet',
  );
  const contactSheetBinding = acceptanceReceipt.bindings?.contactSheet;
  exactObjectKeys(
    contactSheetBinding,
    ['path', 'sha256'],
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_CONTACT_SHEET_BINDING_FIELDS_INVALID',
  );
  invariant(
    contactSheetBinding &&
      exactAbsolutePackagePath(contactSheetBinding.path, packageRoot, 'acceptance.bindings.contactSheet') === contactSheetPath &&
      contactSheetBinding.sha256 === manifest.contactSheet?.sha256 &&
      generationReceipt.contactSheet?.sha256 === manifest.contactSheet?.sha256 &&
      safePackageRelativePath(
        generationReceipt.contactSheet.relativePath,
        packageRoot,
        'generationReceipt.contactSheet',
      ) === contactSheetPath &&
      manifest.contactSheet.bytes === statSync(contactSheetPath).size &&
      generationReceipt.contactSheet.bytes === statSync(contactSheetPath).size,
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_CONTACT_SHEET_MISMATCH',
  );
  exactObjectKeys(
    authorityReceipt.packageAssets?.contactSheet,
    ['path', 'sha256'],
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_AUTHORITY_CONTACT_SHEET_FIELDS_INVALID',
  );
  invariant(
    exactAbsolutePackagePath(
      authorityReceipt.packageAssets.contactSheet.path,
      packageRoot,
      'authorityReceipt.packageAssets.contactSheet',
    ) === contactSheetPath &&
      authorityReceipt.packageAssets.contactSheet.sha256 === manifest.contactSheet.sha256,
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_AUTHORITY_CONTACT_SHEET_MISMATCH',
  );
  verifyFile({
    role: 'authority-evidence',
    id: 'scene-a-contact-sheet',
    declaredPath: contactSheetBinding.path,
    expectedSha256: contactSheetBinding.sha256,
  }, repoRoot);

  const aScenes = scenes.filter((scene) =>
    scene.stateReveal?.method === 'progressive-local-assembly');
  invariant(aScenes.length === 1, 'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_SCENE_INVALID');
  const aScene = aScenes[0];
  invariant(
    request.render?.fps === SUPERVISOR_A_AUTHORITATIVE_FPS &&
      Math.abs(aScene.start * SUPERVISOR_A_AUTHORITATIVE_FPS) <= 1e-9 &&
      Math.abs(
        aScene.end * SUPERVISOR_A_AUTHORITATIVE_FPS -
          SUPERVISOR_A_END_EXCLUSIVE_FRAME,
      ) <= 1e-9,
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_REQUEST_SCHEDULE_HEADER_INVALID',
  );
  const requestStates = aScene.stateReveal.states;
  const requestAssets = new Map((request.media?.visualStateAssets ?? []).map((asset) => [asset.id, asset]));
  const declarationBindings = sourceDeclarations.authorityReceipt.bindings;
  const manifestStates = manifest.states;
  const generationStates = generationReceipt.states;
  const authorityStates = authorityReceipt.states ?? authorityReceipt.lockedStates;
  const acceptedStates = acceptanceReceipt.bindings?.states;
  invariant(
    [requestStates, declarationBindings, manifestStates, generationStates, authorityStates, acceptedStates]
      .every((states) => Array.isArray(states) && states.length === 17),
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_STATE_COUNT_INVALID',
  );
  invariant(
    new Set(requestStates.map((state) => state.id)).size === 17 &&
      new Set(requestStates.map((state) => state.assetId)).size === 17 &&
      new Set(declarationBindings.map((binding) => binding.visualStateAssetId)).size === 17,
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_STATE_ONE_TO_ONE_INVALID',
  );

  const acceptedStatePaths = [];
  const acceptedStateSha256Values = [];
  const scheduleRecords = [];

  for (let index = 0; index < 17; index += 1) {
    const expectedStateId = `A${String(index).padStart(2, '0')}`;
    const requestState = requestStates[index];
    const declarationBinding = declarationBindings[index];
    const manifestState = manifestStates[index];
    const generationState = generationStates[index];
    const authorityState = authorityStates[index];
    const acceptedState = acceptedStates[index];
    const expectedFrame = SUPERVISOR_A_AUTHORITATIVE_FRAMES[index];
    const expectedTimeSeconds = Number((expectedFrame / SUPERVISOR_A_AUTHORITATIVE_FPS).toFixed(6));
    invariant(
      declarationBinding.sceneId === aScene.id &&
        declarationBinding.receiptStateId === expectedStateId &&
        manifestState.id === expectedStateId &&
        generationState.id === expectedStateId &&
        authorityState.id === expectedStateId &&
        acceptedState.id === expectedStateId,
      'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_STATE_ORDER_MISMATCH',
      expectedStateId,
    );
    invariant(
      declarationBinding.visualStateAssetId === requestState.assetId,
      'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_REQUEST_STATE_BINDING_MISMATCH',
      expectedStateId,
    );
    const requestAsset = requestAssets.get(requestState.assetId);
    invariant(requestAsset, 'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_REQUEST_ASSET_MISSING', expectedStateId);
    exactObjectKeys(
      acceptedState,
      ['id', 'frame', 'timeSeconds', 'path', 'bytes', 'sha256'],
      'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_STATE_FIELDS_INVALID',
      expectedStateId,
    );
    assertUniquePathField(manifestState, 'relativePath', `manifest.${expectedStateId}`);
    assertUniquePathField(generationState, 'relativePath', `generation.${expectedStateId}`);
    assertUniquePathField(authorityState, 'absolutePath', `authority.${expectedStateId}`);
    assertUniquePathField(acceptedState, 'path', `acceptance.${expectedStateId}`);
    assertUniquePathField(requestAsset, 'path', `request.${expectedStateId}`);
    const manifestStatePath = safePackageRelativePath(
      manifestState.relativePath,
      packageRoot,
      `manifest.${expectedStateId}`,
    );
    const authorityStatePath = exactAbsolutePackagePath(
      authorityState.absolutePath,
      packageRoot,
      `authority.${expectedStateId}`,
    );
    const generationStatePath = safePackageRelativePath(
      generationState.relativePath,
      packageRoot,
      `generation.${expectedStateId}`,
    );
    const acceptedStatePath = exactAbsolutePackagePath(
      acceptedState.path,
      packageRoot,
      `acceptance.${expectedStateId}`,
    );
    acceptedStatePaths.push(acceptedStatePath);
    acceptedStateSha256Values.push(acceptedState.sha256);
    const requestAssetPath = exactAbsolutePackagePath(
      requestAsset.path,
      packageRoot,
      `request.visualStateAssets.${requestState.assetId}`,
    );
    invariant(
      requestState.atFrame === expectedFrame &&
        [manifestState.frame, generationState.frame, authorityState.frame, acceptedState.frame]
          .every((frame) => Number.isInteger(frame) && frame === expectedFrame),
      'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_STATE_FRAME_MISMATCH',
      expectedStateId,
    );
    invariant(
      [manifestState.timeSeconds, generationState.timeSeconds, authorityState.timeSeconds, acceptedState.timeSeconds]
        .every((timeSeconds) =>
          Number.isFinite(timeSeconds) && Math.abs(timeSeconds - expectedTimeSeconds) <= 1e-6),
      'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_STATE_TIME_MISMATCH',
      expectedStateId,
    );
    invariant(
      manifestStatePath === authorityStatePath &&
        authorityStatePath === generationStatePath &&
        authorityStatePath === acceptedStatePath &&
        acceptedStatePath === requestAssetPath,
      'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_STATE_PATH_MISMATCH',
      expectedStateId,
    );
    invariant(
      manifestState.sha256 === authorityState.sha256 &&
        authorityState.sha256 === generationState.sha256 &&
        authorityState.sha256 === acceptedState.sha256 &&
        acceptedState.sha256 === requestAsset.sha256,
      'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_STATE_SHA_MISMATCH',
      expectedStateId,
    );
    if (index === 16) {
      invariant(
        requestAsset.sha256 === SUPERVISOR_A_CORRECTED_TERMINAL_STATE_SHA256,
        'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_TERMINAL_STATE_SHA_MISMATCH',
        expectedStateId,
      );
    }
    verifyFile({
      role: 'visual-state',
      id: requestState.assetId,
      declaredPath: requestAssetPath,
      expectedSha256: requestAsset.sha256,
    }, repoRoot);
    const actualBytes = statSync(requestAssetPath).size;
    invariant(
      manifestState.bytes === actualBytes &&
        generationState.bytes === actualBytes &&
        authorityState.bytes === actualBytes &&
        acceptedState.bytes === actualBytes,
      'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_STATE_BYTES_MISMATCH',
      expectedStateId,
    );
    invariant(
      manifestState.relativePath === generationState.relativePath,
      'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_STATE_RELATIVE_PATH_MISMATCH',
      expectedStateId,
    );
    const canonicalRelativePath = path.relative(packageRoot, requestAssetPath).split(path.sep).join('/');
    invariant(
      manifestState.relativePath === canonicalRelativePath,
      'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_STATE_RELATIVE_PATH_NOT_CANONICAL',
      expectedStateId,
    );
    scheduleRecords.push({
      id: expectedStateId,
      frame: expectedFrame,
      relativePath: canonicalRelativePath,
      bytes: actualBytes,
      sha256: requestAsset.sha256,
    });
  }
  invariant(
    new Set(acceptedStatePaths).size === 17 && new Set(acceptedStateSha256Values).size === 17,
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_STATE_ONE_TO_ONE_INVALID',
  );

  const recomputedScheduleSha256 = sha256Text(stableStringify(scheduleRecords));
  invariant(
    recomputedScheduleSha256 === SUPERVISOR_A_CANONICAL_SCHEDULE_SHA256 &&
      manifest.scheduleSha256 === recomputedScheduleSha256 &&
      generationReceipt.scheduleSha256 === recomputedScheduleSha256 &&
      authorityReceipt.scheduleSha256 === recomputedScheduleSha256 &&
      acceptanceReceipt.bindings?.scheduleSha256 === recomputedScheduleSha256,
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_SCHEDULE_SHA_MISMATCH',
  );
  const recomputedStateTreeDefinition = scheduleRecords
    .map((state) => `${state.relativePath}\t${state.bytes}\t${state.sha256}\n`)
    .join('');
  const recomputedStateTreeSha256 = sha256Text(recomputedStateTreeDefinition);
  invariant(
    recomputedStateTreeSha256 === SUPERVISOR_A_CANONICAL_STATE_TREE_SHA256 &&
      SHA256_RE.test(generationReceipt.stateTreeSha256) &&
      generationReceipt.stateTreeSha256 === recomputedStateTreeSha256 &&
      (generationReceipt.stateTree?.sha256 ?? generationReceipt.stateTreeSha256) === recomputedStateTreeSha256 &&
      authorityReceipt.stateTree?.sha256 === recomputedStateTreeSha256 &&
      authorityReceipt.stateTreeSha256 === recomputedStateTreeSha256 &&
      acceptanceReceipt.bindings?.stateTreeSha256 === recomputedStateTreeSha256,
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_STATE_TREE_MISMATCH',
  );
  const recomputedArtifactBundleSha256 = supervisorAArtifactBundleSha256({
    builderSha256: sha256File(builderPath),
    manifestSha256: sha256File(sourceDeclarations.manifest.path),
    generationReceiptSha256: sha256File(sourceDeclarations.generationReceipt.path),
    authorityReceiptSha256: sha256File(sourceDeclarations.authorityReceipt.path),
    contactSheetSha256: sha256File(contactSheetPath),
    stateTreeSha256: recomputedStateTreeSha256,
    scheduleSha256: recomputedScheduleSha256,
    states: scheduleRecords.map(({id, sha256}) => ({id, sha256})),
  });
  invariant(
    acceptanceReceipt.artifactBundleSha256 === recomputedArtifactBundleSha256 &&
      reviewArtifactBundleSha256Values.length === 2 &&
      reviewArtifactBundleSha256Values.every(
        (artifactBundleSha256) => artifactBundleSha256 === recomputedArtifactBundleSha256,
      ),
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_ARTIFACT_BUNDLE_MISMATCH',
  );

  return {
    required: true,
    accepted: true,
    declarationId: SUPERVISOR_A_ACCEPTANCE_DECLARATION_ID,
    path: acceptanceBinding.path,
    sha256: acceptanceBinding.sha256,
    stateTreeSha256: recomputedStateTreeSha256,
    scheduleSha256: recomputedScheduleSha256,
    artifactBundleSha256: recomputedArtifactBundleSha256,
    stateCount: 17,
    terminalAuthorityCorrection,
    verifiedBindings: [
      anchorRegistryActualBinding,
      anchorRegistryExpectedBinding,
      ...reviewBindings,
    ],
  };
}

export function validateSupervisorAIndependentAcceptanceGate({
  request,
  scenes,
  repoRoot,
  requestPath,
  acceptanceAnchorRegistrySnapshot,
}) {
  const acceptanceAnchorRegistryPath = path.join(
    defaultRepoRoot,
    SUPERVISOR_ACCEPTANCE_ANCHOR_REGISTRY_RELATIVE_PATH,
  );
  invariant(
    existsSync(acceptanceAnchorRegistryPath) &&
      realpathSync(acceptanceAnchorRegistryPath) === acceptanceAnchorRegistryPath,
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_ANCHOR_REGISTRY_FIXED_PATH_INVALID',
    acceptanceAnchorRegistryPath,
  );
  return validateSupervisorAIndependentAcceptanceGateCore({
    request,
    scenes,
    repoRoot,
    requestPath,
    acceptanceAnchorRegistryPath,
    acceptanceAnchorRegistryExpectedSha256:
      process.env[SUPERVISOR_ACCEPTANCE_REGISTRY_SHA256_ENV],
    acceptanceAnchorRegistrySnapshot,
  });
}

export function validateSupervisorAIndependentAcceptanceFixtureForTest({
  request,
  scenes,
  repoRoot,
  requestPath,
  acceptanceAnchorRegistryPath,
}) {
  const temporaryRoot = realpathSync(tmpdir());
  const requestDirectory = realpathSync(path.dirname(requestPath));
  const injectedRegistryPath = path.resolve(acceptanceAnchorRegistryPath);
  invariant(
    request?.execution?.mode === 'renderable' &&
      isInside(temporaryRoot, requestDirectory) &&
      isInside(requestDirectory, injectedRegistryPath) &&
      existsSync(injectedRegistryPath) &&
      realpathSync(injectedRegistryPath) === injectedRegistryPath,
    'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_TEST_FIXTURE_INVALID',
  );
  return validateSupervisorAIndependentAcceptanceGateCore({
    request,
    scenes,
    repoRoot,
    requestPath,
    acceptanceAnchorRegistryPath: injectedRegistryPath,
    acceptanceAnchorRegistryExpectedSha256:
      process.env[SUPERVISOR_ACCEPTANCE_REGISTRY_SHA256_ENV],
  });
}

function validateAuthorityReceiptDeclarations(
  request,
  scenes,
  repoRoot,
  requestPath,
  acceptanceAnchorRegistrySnapshot,
) {
  const declarations = request.authority?.receipts ?? [];
  invariant(Array.isArray(declarations), 'DIRECTOR_AUTHORITY_RECEIPTS_INVALID');
  const byId = new Map();
  const verifiedBindings = [];
  for (const item of declarations) {
    const id = safeId(item.id, 'authority receipt id');
    invariant(!byId.has(id), 'DIRECTOR_AUTHORITY_RECEIPT_ID_DUPLICATE', id);
    invariant(['required-gate', 'evidence-only'].includes(item.effect), 'DIRECTOR_AUTHORITY_RECEIPT_EFFECT_INVALID', id);
    nonEmpty(item.kind, `authority receipt ${id} kind`);
    invariant(path.isAbsolute(item.path), 'DIRECTOR_AUTHORITY_RECEIPT_PATH_NOT_ABSOLUTE', id);
    byId.set(id, item);
    verifiedBindings.push(verifyFile({
      role: 'authority-receipt',
      id,
      declaredPath: item.path,
      expectedSha256: item.sha256,
    }, repoRoot));
  }

  const supervisorAcceptance = validateSupervisorAIndependentAcceptanceGate({
    request,
    scenes,
    repoRoot,
    requestPath,
    acceptanceAnchorRegistrySnapshot,
  });
  verifiedBindings.push(...(supervisorAcceptance.verifiedBindings ?? []));

  if ((request.media?.visualStateAssets ?? []).length === 0) return verifiedBindings;

  const userDeclaration = byId.get('user-b-style-direction-acceptance');
  const supervisorDeclaration = byId.get('supervisor-a-c-static-gate');
  invariant(
    userDeclaration?.kind === 'user-style-direction-acceptance' && userDeclaration.effect === 'required-gate',
    'DIRECTOR_USER_STYLE_ACCEPTANCE_RECEIPT_REQUIRED',
  );
  invariant(
    supervisorDeclaration?.kind === 'supervisor-static-gate' && supervisorDeclaration.effect === 'required-gate',
    'DIRECTOR_SUPERVISOR_STATIC_GATE_RECEIPT_REQUIRED',
  );

  const userReceipt = parseBoundJson(userDeclaration.path, 'DIRECTOR_USER_STYLE_ACCEPTANCE_RECEIPT_JSON_INVALID');
  invariant(userReceipt.schema === 'director-b-style-direction-acceptance/v1', 'DIRECTOR_USER_STYLE_ACCEPTANCE_SCHEMA_INVALID');
  invariant(userReceipt.status === 'accepted-narrow-scope', 'DIRECTOR_USER_STYLE_ACCEPTANCE_STATUS_INVALID');
  const acceptedScope = new Set(userReceipt.acceptedScope ?? []);
  for (const required of ['photographic-handcrafted-paper-miniature-visual-language', 'paper-stop-motion-rhythm', 'occluded-state-reveal']) {
    invariant(acceptedScope.has(required), 'DIRECTOR_USER_STYLE_ACCEPTANCE_SCOPE_INCOMPLETE', required);
  }
  invariant((userReceipt.prohibitedOverclaims ?? []).includes('mechanical-causality'), 'DIRECTOR_USER_STYLE_ACCEPTANCE_OVERCLAIM_BOUNDARY_MISSING');
  invariant(userReceipt.operationalEffect?.bStyleDirectionGatePassed === true, 'DIRECTOR_USER_STYLE_ACCEPTANCE_GATE_NOT_PASSED');
  invariant(userReceipt.operationalEffect?.productionEligible === false, 'DIRECTOR_USER_STYLE_ACCEPTANCE_PRODUCTION_STATE_INVALID');
  invariant(userReceipt.operationalEffect?.automationFreezeMustRemain === true, 'DIRECTOR_USER_STYLE_ACCEPTANCE_AUTOMATION_FREEZE_MISSING');
  invariant(userReceipt.operationalEffect?.renderCommandAuthorized === false, 'DIRECTOR_USER_STYLE_ACCEPTANCE_RENDER_AUTH_INVALID');

  const supervisorReceipt = parseBoundJson(supervisorDeclaration.path, 'DIRECTOR_SUPERVISOR_STATIC_GATE_JSON_INVALID');
  invariant(supervisorReceipt.schema === 'director-supervisor-static-gate/v1', 'DIRECTOR_SUPERVISOR_STATIC_GATE_SCHEMA_INVALID');
  invariant(supervisorReceipt.status === 'accepted-for-dynamic-candidate-only', 'DIRECTOR_SUPERVISOR_STATIC_GATE_STATUS_INVALID');
  invariant(supervisorReceipt.styleAuthority?.userBStyleAcceptanceReceipt?.path === userDeclaration.path, 'DIRECTOR_SUPERVISOR_GATE_USER_RECEIPT_PATH_MISMATCH');
  invariant(supervisorReceipt.styleAuthority?.userBStyleAcceptanceReceipt?.sha256 === userDeclaration.sha256, 'DIRECTOR_SUPERVISOR_GATE_USER_RECEIPT_SHA_MISMATCH');
  invariant(supervisorReceipt.styleAuthority?.forbiddenClaim === 'mechanical-causality', 'DIRECTOR_SUPERVISOR_GATE_OVERCLAIM_BOUNDARY_MISSING');
  invariant(supervisorReceipt.sceneA?.independentReview?.p0 === 0 && supervisorReceipt.sceneA?.independentReview?.p1 === 0, 'DIRECTOR_SUPERVISOR_GATE_SCENE_A_NOT_ACCEPTED');
  invariant(supervisorReceipt.sceneC?.independentReview?.p0 === 0 && supervisorReceipt.sceneC?.independentReview?.p1 === 0, 'DIRECTOR_SUPERVISOR_GATE_SCENE_C_NOT_ACCEPTED');
  invariant(supervisorReceipt.operationalEffect?.exact30SecondDynamicCandidateAllowed === true, 'DIRECTOR_SUPERVISOR_GATE_EXACT30_NOT_ALLOWED');
  invariant(supervisorReceipt.operationalEffect?.fullDynamicCandidateAccepted === false, 'DIRECTOR_SUPERVISOR_GATE_FULL_DYNAMIC_STATE_INVALID');
  invariant(supervisorReceipt.operationalEffect?.completeDirectorSkillAccepted === false, 'DIRECTOR_SUPERVISOR_GATE_SKILL_STATE_INVALID');
  invariant(supervisorReceipt.operationalEffect?.productionEligible === false, 'DIRECTOR_SUPERVISOR_GATE_PRODUCTION_STATE_INVALID');
  invariant(supervisorReceipt.operationalEffect?.automationFreezeMustRemain === true, 'DIRECTOR_SUPERVISOR_GATE_AUTOMATION_FREEZE_MISSING');
  invariant(supervisorReceipt.operationalEffect?.renderCommandAuthorizedForAutomation === false, 'DIRECTOR_SUPERVISOR_GATE_AUTOMATION_RENDER_AUTH_INVALID');

  const visualAssets = new Map((request.media.visualStateAssets ?? []).map((item) => [item.id, item]));
  const consumedAssets = new Set(
    scenes.flatMap((scene) => scene.stateReveal
      ? [
        ...(scene.stateReveal.method === 'fully-occluded-hard-cut'
          ? [scene.stateReveal.occluderAssetId]
          : []),
        ...scene.stateReveal.states.map((state) => state.assetId),
      ]
      : []),
  );
  for (const declaration of declarations.filter((item) => item.kind === 'visual-state-package')) {
    invariant(declaration.effect === 'evidence-only', 'DIRECTOR_VISUAL_STATE_RECEIPT_EFFECT_INVALID', declaration.id);
    invariant(Array.isArray(declaration.bindings) && declaration.bindings.length > 0, 'DIRECTOR_VISUAL_STATE_RECEIPT_BINDINGS_REQUIRED', declaration.id);
    const receipt = parseBoundJson(declaration.path, 'DIRECTOR_VISUAL_STATE_RECEIPT_JSON_INVALID');
    const receiptStates = receipt.states ?? receipt.lockedStates;
    invariant(Array.isArray(receiptStates), 'DIRECTOR_VISUAL_STATE_RECEIPT_STATES_INVALID', declaration.id);
    const receiptStateById = new Map(receiptStates.map((state) => [state.id, state]));
    invariant(receiptStateById.size === receiptStates.length, 'DIRECTOR_VISUAL_STATE_RECEIPT_STATE_ID_DUPLICATE', declaration.id);
    const bindingKeys = new Set();
    for (const binding of declaration.bindings) {
      const key = `${binding.sceneId}\0${binding.receiptStateId}\0${binding.visualStateAssetId}`;
      invariant(!bindingKeys.has(key), 'DIRECTOR_VISUAL_STATE_RECEIPT_BINDING_DUPLICATE', key);
      bindingKeys.add(key);
      const scene = scenes.find((item) => item.id === binding.sceneId);
      invariant(scene, 'DIRECTOR_VISUAL_STATE_RECEIPT_SCENE_UNKNOWN', binding.sceneId);
      const asset = visualAssets.get(binding.visualStateAssetId);
      invariant(asset, 'DIRECTOR_VISUAL_STATE_RECEIPT_ASSET_UNKNOWN', binding.visualStateAssetId);
      invariant(
        asset.role !== 'motion-pose',
        'DIRECTOR_VISUAL_STATE_RECEIPT_MOTION_POSE_FORBIDDEN',
        binding.visualStateAssetId,
      );
      invariant(consumedAssets.has(asset.id), 'DIRECTOR_VISUAL_STATE_RECEIPT_ASSET_NOT_CONSUMED', asset.id);
      const receiptState = receiptStateById.get(binding.receiptStateId);
      invariant(receiptState, 'DIRECTOR_VISUAL_STATE_RECEIPT_STATE_UNKNOWN', binding.receiptStateId);
      const receiptStatePath = receiptState.absolutePath
        ? path.normalize(receiptState.absolutePath)
        : path.resolve(path.dirname(declaration.path), receiptState.path);
      invariant(resolvePath(asset.path, repoRoot) === receiptStatePath, 'DIRECTOR_VISUAL_STATE_RECEIPT_ASSET_PATH_MISMATCH', asset.id);
      invariant(asset.sha256 === receiptState.sha256, 'DIRECTOR_VISUAL_STATE_RECEIPT_ASSET_SHA_MISMATCH', asset.id);
    }
  }

  const aCompletion = visualAssets.get('a-cost-complete');
  const cCompletion = visualAssets.get('c-menu-evidence');
  invariant(
    supervisorReceipt.sceneA?.completionStill?.sha256 ===
      SUPERVISOR_A_STATIC_DIRECTION_AUTHORITY_SHA256 &&
      supervisorAcceptance.terminalAuthorityCorrection?.staticDirectionAuthoritySha256 ===
        supervisorReceipt.sceneA.completionStill.sha256 &&
      supervisorAcceptance.terminalAuthorityCorrection?.acceptedCandidateTerminalStateId === 'A16' &&
      aCompletion?.sha256 ===
        supervisorAcceptance.terminalAuthorityCorrection.acceptedCandidateTerminalStateSha256,
    'DIRECTOR_SUPERVISOR_GATE_SCENE_A_AUTHORITY_MISMATCH',
  );
  invariant(cCompletion?.sha256 === supervisorReceipt.sceneC?.completionStill?.sha256, 'DIRECTOR_SUPERVISOR_GATE_SCENE_C_AUTHORITY_MISMATCH');
  const aStateDeclaration = byId.get('scene-a-dynamic-states-receipt');
  const aStateReceipt = parseBoundJson(aStateDeclaration.path, 'DIRECTOR_VISUAL_STATE_RECEIPT_JSON_INVALID');
  const aAuthorityPath = path.resolve(path.dirname(aStateDeclaration.path), aStateReceipt.frozenInputs?.authorityV4?.path ?? '');
  invariant(aStateReceipt.frozenInputs?.authorityV4?.sha256 === supervisorReceipt.sceneA?.completionStill?.sha256, 'DIRECTOR_SUPERVISOR_GATE_SCENE_A_RECEIPT_SHA_MISMATCH');
  invariant(aAuthorityPath === supervisorReceipt.sceneA?.completionStill?.path, 'DIRECTOR_SUPERVISOR_GATE_SCENE_A_RECEIPT_PATH_MISMATCH');
  const cManifestDeclaration = byId.get('scene-c-static-state-package-manifest-v2');
  invariant(cManifestDeclaration?.sha256 === supervisorReceipt.sceneC?.statePackageManifest?.sha256, 'DIRECTOR_SUPERVISOR_GATE_SCENE_C_MANIFEST_SHA_MISMATCH');
  invariant(cManifestDeclaration?.path === supervisorReceipt.sceneC?.statePackageManifest?.path, 'DIRECTOR_SUPERVISOR_GATE_SCENE_C_MANIFEST_PATH_MISMATCH');

  return verifiedBindings;
}

function resolvePublicAsset(publicDir, staticFileName, label) {
  nonEmpty(staticFileName, label);
  invariant(
    path.basename(staticFileName) === staticFileName && staticFileName !== '.' && staticFileName !== '..',
    'DIRECTOR_PUBLIC_STATIC_FILE_NAME_INVALID',
    label,
  );
  return path.join(publicDir, staticFileName);
}

function validateRequestSfx(request, durationSeconds) {
  const items = request.media?.sfx ?? [];
  invariant(Array.isArray(items), 'DIRECTOR_RENDER_PLAN_SFX_INVALID');
  invariant(request.execution.mode !== 'renderable' || items.length > 0, 'DIRECTOR_RENDER_PLAN_SFX_REQUIRED');
  const itemIds = new Set();
  const cueIds = new Set();
  for (const item of items) {
    safeId(item.id, 'sfx id');
    invariant(!itemIds.has(item.id), 'DIRECTOR_RENDER_PLAN_SFX_INVALID', `duplicate-file:${item.id}`);
    itemIds.add(item.id);
    invariant(path.isAbsolute(item.path), 'DIRECTOR_RENDER_PLAN_SFX_INVALID', `path:${item.id}`);
    invariant(
      path.basename(item.staticFileName) === item.staticFileName && item.staticFileName !== '.' && item.staticFileName !== '..',
      'DIRECTOR_RENDER_PLAN_SFX_INVALID',
      `staticFileName:${item.id}`,
    );
    invariant(SHA256_RE.test(item.sha256), 'DIRECTOR_RENDER_PLAN_SFX_INVALID', `sha256:${item.id}`);
    invariant(Array.isArray(item.cues) && item.cues.length > 0, 'DIRECTOR_RENDER_PLAN_SFX_INVALID', `cues:${item.id}`);
    for (const cue of item.cues) {
      safeId(cue.id, `sfx cue ${item.id}`);
      invariant(!cueIds.has(cue.id), 'DIRECTOR_RENDER_PLAN_SFX_INVALID', `duplicate-cue:${cue.id}`);
      cueIds.add(cue.id);
      invariant(Number.isFinite(cue.atSeconds) && cue.atSeconds >= 0 && cue.atSeconds < durationSeconds, 'DIRECTOR_RENDER_PLAN_SFX_INVALID', `cue-time:${cue.id}`);
      invariant(Number.isFinite(cue.volume) && cue.volume >= 0 && cue.volume <= 1, 'DIRECTOR_RENDER_PLAN_SFX_INVALID', `cue-volume:${cue.id}`);
    }
  }
}

function validateRequestVisualStateAssets(request, scenes, {repoRoot, render}) {
  const assets = request.media.visualStateAssets ?? [];
  invariant(Array.isArray(assets), 'DIRECTOR_VISUAL_STATE_ASSETS_INVALID');
  const byId = new Map();
  for (const asset of assets) {
    const id = safeId(asset.id, 'visual state asset id');
    invariant(!byId.has(id), 'DIRECTOR_VISUAL_STATE_ASSET_ID_DUPLICATE', id);
    nonEmpty(asset.path, `visual state asset ${id} path`);
    nonEmpty(asset.staticFileName, `visual state asset ${id} staticFileName`);
    invariant(path.basename(asset.staticFileName) === asset.staticFileName, 'DIRECTOR_PUBLIC_ASSET_NAME_INVALID', id);
    invariant(SHA256_RE.test(asset.sha256), 'DIRECTOR_REQUEST_SHA_INVALID', `visual-state:${id}`);
    invariant(
      ['base-state', 'revealed-state', 'occluder', 'motion-pose'].includes(asset.role),
      'DIRECTOR_VISUAL_STATE_ASSET_ROLE_INVALID',
      id,
    );
    if (asset.role === 'motion-pose') {
      invariant(
        path.extname(asset.staticFileName).toLowerCase() === '.png' &&
          path.extname(asset.path).toLowerCase() === '.png',
        'DIRECTOR_MOTION_POSE_PNG_REQUIRED',
        id,
      );
    }
    byId.set(id, asset);
  }
  validateMotionPoseAssetContract({
    assets,
    scenes,
    render,
    resolveAssetPath: (assetPath) => resolvePath(assetPath, repoRoot),
  });
}

function transcriptTextFromJson(transcript) {
  const candidates = [transcript.text, transcript.raw_text];
  if (Array.isArray(transcript.pages)) {
    candidates.push(transcript.pages.map((page) => page.zh ?? page.text ?? '').join(''));
  }
  return candidates.map(normalizeSpokenText).sort((a, b) => b.length - a.length)[0] ?? '';
}

function transcriptWords(transcript) {
  invariant(Array.isArray(transcript.words) && transcript.words.length > 0, 'DIRECTOR_AUTHORITY_WORDS_REQUIRED');
  return transcript.words.map((word, index) => {
    invariant(typeof word.text === 'string' && word.text.length > 0, 'DIRECTOR_AUTHORITY_WORD_TEXT_INVALID', String(index));
    invariant(Number.isFinite(word.start) && Number.isFinite(word.end) && word.end >= word.start, 'DIRECTOR_AUTHORITY_WORD_TIME_INVALID', String(index));
    return {text: word.text, start: word.start, end: word.end};
  });
}

function wordsNearRange(words, start, end, tolerance) {
  return words.filter((word) => word.end >= start - tolerance && word.start < end + tolerance);
}

function wordsInsideHalfOpenRange(words, start, end, startTolerance) {
  return words.filter((word) => word.start >= start - startTolerance && word.start < end - EPSILON);
}

function validateAuthorityWindow({request, transcript, durationSeconds}) {
  const window = request.authority.timelineWindow;
  finiteNumber(window.start, 'authority.timelineWindow.start');
  finiteNumber(window.end, 'authority.timelineWindow.end');
  invariant(window.end > window.start, 'DIRECTOR_AUTHORITY_WINDOW_INVALID');
  invariant(Math.abs(window.start - request.media.spoken.sourceIn) <= EPSILON, 'DIRECTOR_AUTHORITY_SPOKEN_START_MISMATCH');
  invariant(Math.abs(window.end - request.media.spoken.sourceOut) <= EPSILON, 'DIRECTOR_AUTHORITY_SPOKEN_END_MISMATCH');
  invariant(Math.abs(window.end - window.start - durationSeconds) <= EPSILON, 'DIRECTOR_AUTHORITY_WINDOW_MISMATCH');

  const tolerance = request.authority.wordTimeToleranceSeconds ?? 0.35;
  invariant(Number.isFinite(tolerance) && tolerance >= 0 && tolerance <= 0.5, 'DIRECTOR_AUTHORITY_TOLERANCE_INVALID');
  const words = transcriptWords(transcript);
  const authorityWindowText = normalizeSpokenText(
    wordsInsideHalfOpenRange(words, window.start, window.end, Math.min(tolerance, 0.08))
      .map((word) => word.text)
      .join(''),
  );
  const captionText = normalizeSpokenText(request.captions.map((cue) => cue.text).join(''));
  invariant(authorityWindowText.length > 0, 'DIRECTOR_AUTHORITY_WINDOW_WORDS_EMPTY');
  invariant(captionText === authorityWindowText, 'DIRECTOR_CAPTIONS_AUTHORITY_WINDOW_TEXT_MISMATCH');

  for (const cue of request.captions) {
    const cueStart = window.start + cue.start;
    const cueEnd = window.start + cue.end;
    const nearbyText = normalizeSpokenText(
      wordsNearRange(words, cueStart, cueEnd, tolerance)
        .map((word) => word.text)
        .join(''),
    );
    invariant(nearbyText.includes(normalizeSpokenText(cue.text)), 'DIRECTOR_CAPTION_NOT_AT_AUTHORITY_TIME', cue.id);
  }
  for (const beat of request.semanticBeats) {
    const beatStart = window.start + beat.start;
    const beatEnd = window.start + beat.end;
    const nearbyText = normalizeSpokenText(
      wordsNearRange(words, beatStart, beatEnd, tolerance)
        .map((word) => word.text)
        .join(''),
    );
    invariant(nearbyText.includes(normalizeSpokenText(beat.spokenLine)), 'DIRECTOR_SCENE_NOT_AT_AUTHORITY_TIME', beat.id);
  }

  return {
    coordinateSystem: nonEmpty(window.coordinateSystem, 'authority.timelineWindow.coordinateSystem'),
    start: window.start,
    end: window.end,
    wordTimeToleranceSeconds: tolerance,
    authorityWindowTextSha256: sha256Text(authorityWindowText),
    wordCount: wordsInsideHalfOpenRange(words, window.start, window.end, Math.min(tolerance, 0.08)).length,
  };
}

function validateContinuousRanges(items, duration, label) {
  invariant(Array.isArray(items) && items.length > 0, 'DIRECTOR_TIMELINE_EMPTY', label);
  let cursor = 0;
  for (const item of items) {
    finiteNumber(item.start, `${label}.${item.id}.start`);
    finiteNumber(item.end, `${label}.${item.id}.end`);
    invariant(Math.abs(item.start - cursor) <= EPSILON, 'DIRECTOR_TIMELINE_GAP_OR_OVERLAP', `${label}:${item.id}`);
    invariant(item.end > item.start, 'DIRECTOR_TIMELINE_RANGE_INVALID', `${label}:${item.id}`);
    cursor = item.end;
  }
  invariant(Math.abs(cursor - duration) <= EPSILON, 'DIRECTOR_TIMELINE_COVERAGE_INCOMPLETE', label);
}

function validateAssemblyStageOrder(stages, sceneId) {
  const seenTargets = new Set();
  for (const stage of stages) {
    for (const targetId of stage.targetIds) {
      invariant(!seenTargets.has(targetId), 'DIRECTOR_STAGE_TARGET_REUSED', `${sceneId}:${targetId}`);
      seenTargets.add(targetId);
    }
  }
  for (let index = 1; index < stages.length; index += 1) {
    invariant(
      stages[index].atSeconds > stages[index - 1].atSeconds + EPSILON,
      'DIRECTOR_STAGE_ORDER_INVALID',
      `${sceneId}:${stages[index - 1].id}->${stages[index].id}`,
    );
  }
}

function flattenComplexNodes(groups) {
  return groups.flatMap((group) =>
    group.items.map((item) => ({
      id: safeId(item.id, 'complex node id'),
      label: nonEmpty(item.label, `complex node ${item.id} label`),
      role: nonEmpty(item.role, `complex node ${item.id} role`),
      visualRole: controlledVisualRole(item.visualRole ?? item.role, `complex node ${item.id} visualRole`),
      groupId: group.id,
      metadata: item.metadata ?? {},
    })),
  );
}

export function compileProgressiveLocalMotion(value, {
  sceneId,
  stateId,
  index,
  render,
}) {
  const label = `${sceneId}:${stateId}`;
  invariant(
    render?.width === 1920 && render?.height === 1080,
    'DIRECTOR_PROGRESSIVE_LOCAL_MOTION_RENDER_DIMENSIONS_INVALID',
    `${label}:${render?.width}x${render?.height}`,
  );
  invariant(
    value && typeof value === 'object' && !Array.isArray(value),
    'DIRECTOR_PROGRESSIVE_LOCAL_MOTION_REQUIRED',
    label,
  );
  if (index === 0) {
    invariant(
      value.model === 'neutral/v1',
      'DIRECTOR_PROGRESSIVE_LOCAL_MOTION_INITIAL_NOT_NEUTRAL',
      label,
    );
    exactObjectKeys(
      value,
      ['model'],
      'DIRECTOR_PROGRESSIVE_LOCAL_MOTION_FIELDS_INVALID',
      label,
    );
    return {model: 'neutral/v1'};
  }

  invariant(
    value.model === 'authored-local-stop-motion/v1',
    'DIRECTOR_PROGRESSIVE_LOCAL_MOTION_AUTHORED_MODEL_REQUIRED',
    label,
  );
  exactObjectKeys(
    value,
    ['model', 'region', 'poseAssetIds'],
    'DIRECTOR_PROGRESSIVE_LOCAL_MOTION_FIELDS_INVALID',
    label,
  );
  exactObjectKeys(
    value.region,
    ['x', 'y', 'width', 'height'],
    'DIRECTOR_PROGRESSIVE_LOCAL_MOTION_REGION_FIELDS_INVALID',
    label,
  );
  const {x, y, width, height} = assertMotionPoseRegion(value.region, render, {
    label,
    renderCode: 'DIRECTOR_PROGRESSIVE_LOCAL_MOTION_RENDER_DIMENSIONS_INVALID',
    regionCode: 'DIRECTOR_PROGRESSIVE_LOCAL_MOTION_REGION_INVALID',
  });
  invariant(
    Array.isArray(value.poseAssetIds) && value.poseAssetIds.length === 3,
    'DIRECTOR_PROGRESSIVE_LOCAL_MOTION_POSE_ASSET_COUNT_INVALID',
    label,
  );
  const poseAssetIds = value.poseAssetIds.map((assetId, poseIndex) =>
    safeId(assetId, `${label}.localMotion.poseAssetIds.${poseIndex}`));
  invariant(
    new Set(poseAssetIds).size === poseAssetIds.length,
    'DIRECTOR_PROGRESSIVE_LOCAL_MOTION_POSE_ASSET_DUPLICATE',
    label,
  );
  return {
    model: 'authored-local-stop-motion/v1',
    region: {x, y, width, height},
    poseAssetIds,
  };
}

function compileStateReveal(value, beat, fps, assemblyStages, render) {
  if (value === undefined) return undefined;
  invariant(value && typeof value === 'object', 'DIRECTOR_STATE_REVEAL_METHOD_INVALID', beat.id);
  invariant(
    value.method === 'fully-occluded-hard-cut' ||
      value.method === 'progressive-local-assembly',
    'DIRECTOR_STATE_REVEAL_METHOD_INVALID',
    beat.id,
  );
  if (value.method === 'progressive-local-assembly') {
    invariant(beat.kind === 'complex-explanation', 'DIRECTOR_PROGRESSIVE_ASSEMBLY_SCENE_TYPE_INVALID', beat.id);
    invariant(fps === 30, 'DIRECTOR_PROGRESSIVE_ASSEMBLY_FPS_INVALID', beat.id);
    invariant(
      value.occluderAssetId === undefined && value.transitionFrames === undefined,
      'DIRECTOR_PROGRESSIVE_ASSEMBLY_FULL_FRAME_OCCLUDER_FORBIDDEN',
      beat.id,
    );
    invariant(Array.isArray(value.states) && value.states.length >= 4, 'DIRECTOR_PROGRESSIVE_ASSEMBLY_STATES_INSUFFICIENT', beat.id);
    const stageById = new Map(assemblyStages.map((stage) => [stage.id, stage]));
    const knownTargets = new Set(assemblyStages.flatMap((stage) => stage.targetIds));
    const states = value.states.map((state, index) => {
      const id = safeId(state.id, `${beat.id}.stateReveal.states.${index}.id`);
      const assetId = safeId(state.assetId, `${beat.id}.stateReveal.states.${index}.assetId`);
      const stageId = safeId(state.stageId, `${beat.id}.stateReveal.states.${index}.stageId`);
      const entityStateId = safeId(
        state.entityStateId,
        `${beat.id}.stateReveal.states.${index}.entityStateId`,
      );
      invariant(
        Array.isArray(state.changedEntityIds) && state.changedEntityIds.length > 0,
        'DIRECTOR_PROGRESSIVE_ASSEMBLY_CHANGED_ENTITIES_REQUIRED',
        `${beat.id}:${id}`,
      );
      const changedEntityIds = state.changedEntityIds.map((targetId, targetIndex) =>
        safeId(targetId, `${beat.id}.stateReveal.states.${index}.changedEntityIds.${targetIndex}`));
      invariant(
        new Set(changedEntityIds).size === changedEntityIds.length &&
          changedEntityIds.every((targetId) => knownTargets.has(targetId)),
        'DIRECTOR_PROGRESSIVE_ASSEMBLY_CHANGED_ENTITY_UNKNOWN',
        `${beat.id}:${id}`,
      );
      const transitionKind = state.transitionKind ?? 'visible-discrete-assembly';
      invariant(
        transitionKind === 'visible-discrete-assembly',
        'DIRECTOR_PROGRESSIVE_TRANSITION_KIND_INVALID',
        `${beat.id}:${id}`,
      );
      const stage = stageById.get(stageId);
      invariant(stage, 'DIRECTOR_STATE_REVEAL_STAGE_UNKNOWN', `${beat.id}:${stageId}`);
      invariant(
        changedEntityIds.every((targetId) => stage.targetIds.includes(targetId)),
        'DIRECTOR_PROGRESSIVE_ASSEMBLY_STAGE_TARGET_MISMATCH',
        `${beat.id}:${id}`,
      );
      finiteNumber(state.atSeconds, `${beat.id}.stateReveal.states.${index}.atSeconds`);
      invariant(Math.abs(state.atSeconds - stage.atSeconds) <= EPSILON, 'DIRECTOR_STATE_REVEAL_STAGE_TIME_MISMATCH', `${beat.id}:${id}`);
      invariant(state.atSeconds >= beat.start && state.atSeconds < beat.end, 'DIRECTOR_STATE_REVEAL_STATE_TIME_INVALID', `${beat.id}:${id}`);
      if (index === 0) invariant(Math.abs(state.atSeconds - beat.start) <= EPSILON, 'DIRECTOR_STATE_REVEAL_FIRST_STATE_NOT_AT_SCENE_START', beat.id);
      const localMotion = compileProgressiveLocalMotion(state.localMotion, {
        sceneId: beat.id,
        stateId: id,
        index,
        render,
      });
      return {
        id,
        assetId,
        stageId,
        atFrame: roundedFrame(state.atSeconds, fps),
        entityStateId,
        changedEntityIds,
        localMotion,
      };
    });
    invariant(new Set(states.map((state) => state.id)).size === states.length, 'DIRECTOR_STATE_REVEAL_STATE_ID_DUPLICATE', beat.id);
    invariant(new Set(states.map((state) => state.entityStateId)).size === states.length, 'DIRECTOR_PROGRESSIVE_ASSEMBLY_ENTITY_STATE_ID_DUPLICATE', beat.id);
    invariant(states.every((state, index) => index === 0 || state.atFrame > states[index - 1].atFrame), 'DIRECTOR_STATE_REVEAL_STATE_ORDER_INVALID', beat.id);
    const motionPoseIds = states.slice(1).flatMap(
      (state) => state.localMotion.poseAssetIds,
    );
    invariant(
      new Set(motionPoseIds).size === motionPoseIds.length,
      'DIRECTOR_PROGRESSIVE_LOCAL_MOTION_POSE_ASSET_DUPLICATE',
      beat.id,
    );
    invariant(
      states.slice(1).every(
        (state, index) => state.atFrame - states[index].atFrame >= 10,
      ),
      'DIRECTOR_PROGRESSIVE_LOCAL_MOTION_PREROLL_INSUFFICIENT',
      beat.id,
    );
    const sceneStartFrame = roundedFrame(beat.start, fps);
    const sceneEndFrame = roundedFrame(beat.end, fps);
    const auditWindowEndFrame = sceneStartFrame + 278;
    invariant(auditWindowEndFrame < sceneEndFrame, 'DIRECTOR_PROGRESSIVE_ASSEMBLY_AUDIT_WINDOW_OUTSIDE_SCENE', beat.id);
    const statesInAuditWindow = states.filter((state) => state.atFrame <= auditWindowEndFrame);
    invariant(statesInAuditWindow.length >= 4, 'DIRECTOR_PROGRESSIVE_ASSEMBLY_NAMED_STATES_INSUFFICIENT', beat.id);
    const firstChangeFrame = statesInAuditWindow[1]?.atFrame;
    invariant(
      Number.isInteger(firstChangeFrame) && firstChangeFrame - sceneStartFrame <= 30,
      'DIRECTOR_PROGRESSIVE_ASSEMBLY_FIRST_CHANGE_LATE',
      beat.id,
    );
    const auditPoints = [
      sceneStartFrame,
      ...statesInAuditWindow.slice(1).map((state) => state.atFrame),
      auditWindowEndFrame,
    ];
    const maximumUnchangedFrames = Math.max(
      ...auditPoints.slice(1).map((frame, index) => frame - auditPoints[index]),
      ...states.slice(1).map(
        (state, index) => state.atFrame - states[index].atFrame,
      ),
    );
    invariant(
      maximumUnchangedFrames <= 45,
      'DIRECTOR_PROGRESSIVE_ASSEMBLY_UNCHANGED_GAP_EXCEEDED',
      beat.id,
    );
    return {
      method: 'progressive-local-assembly',
      audit: {
        windowStartFrame: sceneStartFrame,
        windowEndFrame: auditWindowEndFrame,
        firstChangeFrame,
        namedEntityStateCount: statesInAuditWindow.length,
        maximumUnchangedFrames,
      },
      states,
      transitions: states.slice(1).map((state, index) => ({
        id: `${states[index].id}-to-${state.id}`,
        fromStateId: states[index].id,
        toStateId: state.id,
        kind: 'visible-discrete-assembly',
        swapFrame: state.atFrame,
      })),
    };
  }

  safeId(value.occluderAssetId, `${beat.id}.stateReveal.occluderAssetId`);
  invariant(Array.isArray(value.states) && value.states.length >= 2, 'DIRECTOR_STATE_REVEAL_STATES_INSUFFICIENT', beat.id);
  const stageById = new Map(assemblyStages.map((stage) => [stage.id, stage]));
  const closeFrames = Number(value.transitionFrames?.close);
  const occludedHoldFrames = Number(value.transitionFrames?.occludedHold);
  const openFrames = Number(value.transitionFrames?.open);
  invariant(Number.isInteger(closeFrames) && closeFrames >= 6, 'DIRECTOR_STATE_REVEAL_TIMING_INVALID', `${beat.id}:close`);
  invariant(Number.isInteger(occludedHoldFrames) && occludedHoldFrames >= 2, 'DIRECTOR_STATE_REVEAL_TIMING_INVALID', `${beat.id}:hold`);
  invariant(Number.isInteger(openFrames) && openFrames >= 6, 'DIRECTOR_STATE_REVEAL_TIMING_INVALID', `${beat.id}:open`);
  const states = value.states.map((state, index) => {
    const id = safeId(state.id, `${beat.id}.stateReveal.states.${index}.id`);
    const assetId = safeId(state.assetId, `${beat.id}.stateReveal.states.${index}.assetId`);
    const stageId = safeId(state.stageId, `${beat.id}.stateReveal.states.${index}.stageId`);
    const stage = stageById.get(stageId);
    invariant(stage, 'DIRECTOR_STATE_REVEAL_STAGE_UNKNOWN', `${beat.id}:${stageId}`);
    finiteNumber(state.atSeconds, `${beat.id}.stateReveal.states.${index}.atSeconds`);
    invariant(Math.abs(state.atSeconds - stage.atSeconds) <= EPSILON, 'DIRECTOR_STATE_REVEAL_STAGE_TIME_MISMATCH', `${beat.id}:${id}`);
    invariant(state.atSeconds >= beat.start && state.atSeconds < beat.end, 'DIRECTOR_STATE_REVEAL_STATE_TIME_INVALID', `${beat.id}:${id}`);
    if (index === 0) invariant(Math.abs(state.atSeconds - beat.start) <= EPSILON, 'DIRECTOR_STATE_REVEAL_FIRST_STATE_NOT_AT_SCENE_START', beat.id);
    return {id, assetId, stageId, atFrame: roundedFrame(state.atSeconds, fps)};
  });
  invariant(new Set(states.map((state) => state.id)).size === states.length, 'DIRECTOR_STATE_REVEAL_STATE_ID_DUPLICATE', beat.id);
  invariant(states.every((state, index) => index === 0 || state.atFrame > states[index - 1].atFrame), 'DIRECTOR_STATE_REVEAL_STATE_ORDER_INVALID', beat.id);
  const transitions = states.slice(1).map((state, index) => {
    const from = states[index];
    const swapFrame = state.atFrame;
    return {
      id: `${from.id}-to-${state.id}`,
      fromStateId: from.id,
      toStateId: state.id,
      closeStartFrame: swapFrame - closeFrames,
      fullyOccludedFromFrame: swapFrame - 1,
      swapFrame,
      firstRevealFrame: swapFrame + occludedHoldFrames,
      revealCompleteFrame: swapFrame + occludedHoldFrames + openFrames,
    };
  });
  const sceneStartFrame = roundedFrame(beat.start, fps);
  const sceneEndFrame = roundedFrame(beat.end, fps);
  for (const [index, transition] of transitions.entries()) {
    invariant(transition.closeStartFrame >= sceneStartFrame, 'DIRECTOR_STATE_REVEAL_TRANSITION_BEFORE_SCENE', `${beat.id}:${transition.id}`);
    invariant(transition.revealCompleteFrame < sceneEndFrame, 'DIRECTOR_STATE_REVEAL_TRANSITION_AFTER_SCENE', `${beat.id}:${transition.id}`);
    if (index > 0) invariant(transition.closeStartFrame > transitions[index - 1].revealCompleteFrame, 'DIRECTOR_STATE_REVEAL_TRANSITION_OVERLAP', `${beat.id}:${transition.id}`);
  }
  return {
    method: 'fully-occluded-hard-cut',
    occluderAssetId: value.occluderAssetId,
    states,
    transitions,
  };
}

function compileComplexScene(beat, fps, render) {
  const visual = beat.visualization;
  invariant(visual && visual.layout === 'converging-workbench', 'DIRECTOR_COMPLEX_LAYOUT_INVALID', beat.id);
  invariant(Array.isArray(visual.objectGroups), 'DIRECTOR_COMPLEX_GROUPS_INVALID', beat.id);
  invariant(visual.objectGroups.length >= 5 && visual.objectGroups.length <= 6, 'DIRECTOR_COMPLEX_GROUP_COUNT_INVALID', beat.id);

  const objectGroups = visual.objectGroups.map((group) => ({
    id: safeId(group.id, 'complex group id'),
    label: nonEmpty(group.label, `complex group ${group.id} label`),
    material: nonEmpty(group.material, `complex group ${group.id} material`),
    visualPrimitive: controlledPrimitiveFor(group.visualPrimitive, 'complex', `complex group ${group.id} visualPrimitive`),
    visualRole: controlledVisualRoleFor(group.visualRole, 'complex', `complex group ${group.id} visualRole`),
    nodeIds: group.items.map((item) => item.id),
    metadata: group.metadata ?? {},
  }));
  const nodes = flattenComplexNodes(visual.objectGroups);
  invariant(nodes.length >= 9 && nodes.length <= 13, 'DIRECTOR_COMPLEX_NODE_COUNT_INVALID', beat.id);
  invariant(new Set(nodes.map((node) => node.id)).size === nodes.length, 'DIRECTOR_NODE_ID_DUPLICATE', beat.id);
  invariant(Number.isInteger(visual.layers) && visual.layers >= 3, 'DIRECTOR_SCENE_LAYERS_INSUFFICIENT', beat.id);
  invariant(Array.isArray(visual.assemblyStages) && visual.assemblyStages.length >= 5, 'DIRECTOR_COMPLEX_STAGE_COUNT_INVALID', beat.id);

  const targetIds = new Set([...objectGroups.map((group) => group.id), ...nodes.map((node) => node.id)]);
  const assemblyStages = visual.assemblyStages.map((stage, index) => {
    invariant(stage.atSeconds >= beat.start && stage.atSeconds < beat.end, 'DIRECTOR_STAGE_TIME_OUTSIDE_SCENE', `${beat.id}:${stage.id}`);
    invariant(Array.isArray(stage.targetIds) && stage.targetIds.length > 0, 'DIRECTOR_STAGE_TARGETS_EMPTY', `${beat.id}:${stage.id}`);
    invariant(stage.targetIds.every((id) => targetIds.has(id)), 'DIRECTOR_STAGE_TARGET_UNKNOWN', `${beat.id}:${stage.id}`);
    return {
      id: safeId(stage.id ?? `${beat.id}-stage-${index + 1}`, 'complex stage id'),
      atSeconds: stage.atSeconds,
      action: nonEmpty(stage.action, `complex stage ${stage.id} action`),
      targetIds: [...stage.targetIds],
    };
  });
  validateAssemblyStageOrder(assemblyStages, beat.id);
  for (const group of objectGroups) {
    invariant(
      assemblyStages.some((stage) => stage.targetIds.includes(group.id) || group.nodeIds.some((id) => stage.targetIds.includes(id))),
      'DIRECTOR_GROUP_STAGE_MISSING',
      `${beat.id}:${group.id}`,
    );
  }

  const scene = {
    id: beat.id,
    type: 'complex-explanation',
    start: beat.start,
    end: beat.end,
    spokenLine: beat.spokenLine,
    cognitiveIncrement: beat.cognitiveIncrement,
    camera: nonEmpty(visual.camera, `${beat.id}.camera`),
    layers: visual.layers,
    assemblyStages,
    objectGroups,
    nodes,
    relations: compileRelations(visual.relations, targetIds, beat.id),
    screenPlacements: [],
    stateReveal: compileStateReveal(visual.stateReveal, beat, fps, assemblyStages, render),
  };
  assertComplexVisualRoleOrder(scene);
  return scene;
}

function compileMechanicalScene(beat) {
  const visual = beat.visualization;
  invariant(visual && visual.layout === 'single-action-machine', 'DIRECTOR_MECHANICAL_LAYOUT_INVALID', beat.id);
  invariant(Number.isInteger(visual.layers) && visual.layers >= 3, 'DIRECTOR_SCENE_LAYERS_INSUFFICIENT', beat.id);
  const input = visual.input;
  const action = visual.action;
  const outputs = visual.outputs;
  invariant(input && action && Array.isArray(outputs) && outputs.length > 0, 'DIRECTOR_MECHANISM_CORE_MISSING', beat.id);
  invariant(action.kind === 'mechanical-action', 'DIRECTOR_MECHANISM_ACTION_INVALID', beat.id);
  invariant(Array.isArray(visual.assemblyStages) && visual.assemblyStages.length >= 3, 'DIRECTOR_MECHANICAL_STAGE_COUNT_INVALID', beat.id);
  invariant(visual.assemblyStages.filter((stage) => stage.action === 'mechanical-action').length === 1, 'DIRECTOR_MECHANICAL_ACTION_COUNT_INVALID', beat.id);

  const coreNodes = [
    {id: safeId(input.id, 'mechanical input id'), label: nonEmpty(input.label, 'mechanical input label'), role: 'input', visualRole: controlledVisualRoleFor(input.visualRole, 'mechanicalInput', 'mechanical input visualRole'), groupId: `${beat.id}-input`, metadata: input.metadata ?? {}},
    {id: safeId(action.id, 'mechanical action id'), label: nonEmpty(action.label, 'mechanical action label'), role: 'mechanical-action', visualRole: controlledVisualRoleFor(action.visualRole, 'mechanicalAction', 'mechanical action visualRole'), groupId: `${beat.id}-mechanism`, metadata: action.metadata ?? {}},
    ...outputs.map((output) => ({id: safeId(output.id, 'mechanical output id'), label: nonEmpty(output.label, 'mechanical output label'), role: 'output', visualRole: controlledVisualRole(output.visualRole, `mechanical output ${output.id} visualRole`), groupId: `${beat.id}-output`, metadata: output.metadata ?? {}})),
  ];
  const supportGroups = Array.isArray(visual.supportGroups) ? visual.supportGroups : [];
  invariant(supportGroups.length === 1, 'DIRECTOR_SUPPORT_GROUP_COUNT_INVALID', beat.id);
  const supportNodes = supportGroups.flatMap((group) =>
    group.items.map((item) => ({id: safeId(item.id, 'mechanical support node id'), label: nonEmpty(item.label, 'mechanical support node label'), role: item.role ?? 'support', visualRole: controlledVisualRole(item.visualRole ?? item.role ?? 'support', `mechanical support ${item.id} visualRole`), groupId: group.id, metadata: item.metadata ?? {}})),
  );
  const nodes = [...coreNodes, ...supportNodes];
  invariant(new Set(nodes.map((node) => node.id)).size === nodes.length, 'DIRECTOR_NODE_ID_DUPLICATE', beat.id);
  const objectGroups = [
    {id: `${beat.id}-input`, label: input.groupLabel ?? '输入', material: input.material, visualPrimitive: controlledPrimitiveFor(input.visualPrimitive, 'mechanicalInput', 'mechanical input visualPrimitive'), visualRole: controlledVisualRoleFor(input.visualRole, 'mechanicalInput', 'mechanical input visualRole'), nodeIds: [input.id], metadata: {}},
    {id: `${beat.id}-mechanism`, label: action.groupLabel ?? '机械动作', material: action.material, visualPrimitive: controlledPrimitiveFor(action.visualPrimitive, 'mechanicalAction', 'mechanical action visualPrimitive'), visualRole: controlledVisualRoleFor(action.visualRole, 'mechanicalAction', 'mechanical action visualRole'), nodeIds: [action.id], metadata: {}},
    {id: `${beat.id}-output`, label: visual.outputGroupLabel ?? '输出', material: visual.outputMaterial, visualPrimitive: controlledPrimitiveFor(visual.outputVisualPrimitive, 'mechanicalOutput', 'mechanical output visualPrimitive'), visualRole: controlledVisualRoleFor(visual.outputVisualRole, 'mechanicalOutput', 'mechanical output visualRole'), nodeIds: outputs.map((output) => output.id), metadata: {}},
    ...supportGroups.map((group) => ({id: group.id, label: group.label, material: group.material, visualPrimitive: controlledPrimitiveFor(group.visualPrimitive, 'mechanicalSupport', `mechanical support ${group.id} visualPrimitive`), visualRole: controlledVisualRoleFor(group.visualRole, 'mechanicalSupport', `mechanical support ${group.id} visualRole`), nodeIds: group.items.map((item) => item.id), metadata: group.metadata ?? {}})),
  ];
  const targetIds = new Set([...objectGroups.map((group) => group.id), ...nodes.map((node) => node.id)]);
  const assemblyStages = visual.assemblyStages.map((stage, index) => {
    invariant(stage.atSeconds >= beat.start && stage.atSeconds < beat.end, 'DIRECTOR_STAGE_TIME_OUTSIDE_SCENE', `${beat.id}:${stage.id}`);
    invariant(Array.isArray(stage.targetIds) && stage.targetIds.length > 0, 'DIRECTOR_STAGE_TARGETS_EMPTY', `${beat.id}:${stage.id}`);
    invariant(stage.targetIds.every((id) => targetIds.has(id)), 'DIRECTOR_STAGE_TARGET_UNKNOWN', `${beat.id}:${stage.id}`);
    return {id: safeId(stage.id ?? `${beat.id}-stage-${index + 1}`, 'mechanical stage id'), atSeconds: stage.atSeconds, action: stage.action, targetIds: [...stage.targetIds]};
  });
  validateAssemblyStageOrder(assemblyStages, beat.id);
  for (const requiredNodeId of [input.id, action.id, ...outputs.map((output) => output.id)]) {
    invariant(
      assemblyStages.some((stage) => stage.targetIds.includes(requiredNodeId)),
      'DIRECTOR_MECHANISM_NODE_STAGE_MISSING',
      `${beat.id}:${requiredNodeId}`,
    );
  }
  for (const group of supportGroups) {
    invariant(
      assemblyStages.some((stage) => stage.targetIds.includes(group.id) || group.items.some((item) => stage.targetIds.includes(item.id))),
      'DIRECTOR_GROUP_STAGE_MISSING',
      `${beat.id}:${group.id}`,
    );
  }

  return {
    id: beat.id,
    type: 'mechanical-causality',
    start: beat.start,
    end: beat.end,
    spokenLine: beat.spokenLine,
    cognitiveIncrement: beat.cognitiveIncrement,
    camera: nonEmpty(visual.camera, `${beat.id}.camera`),
    layers: visual.layers,
    assemblyStages,
    objectGroups,
    nodes,
    relations: compileRelations(visual.relations, targetIds, beat.id),
    mechanism: {inputNodeId: input.id, actionNodeId: action.id, outputNodeIds: outputs.map((output) => output.id)},
    screenPlacements: [],
  };
}

function compileOccludedStateRevealScene(beat, fps, render) {
  const visual = beat.visualization;
  invariant(visual && visual.layout === 'occluded-state-reveal', 'DIRECTOR_OCCLUDED_REVEAL_LAYOUT_INVALID', beat.id);
  invariant(Number.isInteger(visual.layers) && visual.layers >= 3, 'DIRECTOR_SCENE_LAYERS_INSUFFICIENT', beat.id);
  const input = visual.input;
  const occluder = visual.occluder;
  const output = visual.output;
  const support = visual.support;
  invariant(input && occluder && output && support, 'DIRECTOR_OCCLUDED_REVEAL_CORE_MISSING', beat.id);
  const nodeDefinitions = [
    {value: input, suffix: 'input', role: 'input', capability: 'occludedInput'},
    {value: occluder, suffix: 'occluder', role: 'occluder', capability: 'occludedOccluder'},
    {value: output, suffix: 'output', role: 'output', capability: 'occludedOutput'},
    {value: support, suffix: 'support', role: 'support', capability: 'occludedSupport'},
  ];
  const nodes = nodeDefinitions.map(({value, suffix, role}) => ({
    id: safeId(value.id, `${beat.id}.${suffix}.id`),
    label: nonEmpty(value.label, `${beat.id}.${suffix}.label`),
    role,
    visualRole: controlledVisualRoleFor(value.visualRole, `occluded${suffix[0].toUpperCase()}${suffix.slice(1)}`, `${beat.id}.${suffix}.visualRole`),
    groupId: `${beat.id}-${suffix}`,
    metadata: value.metadata ?? {},
  }));
  const objectGroups = nodeDefinitions.map(({value, suffix, capability}) => ({
    id: `${beat.id}-${suffix}`,
    label: value.groupLabel ?? value.label,
    material: nonEmpty(value.material, `${beat.id}.${suffix}.material`),
    visualPrimitive: controlledPrimitiveFor(value.visualPrimitive, capability, `${beat.id}.${suffix}.visualPrimitive`),
    visualRole: controlledVisualRoleFor(value.visualRole, capability, `${beat.id}.${suffix}.visualRole`),
    nodeIds: [value.id],
    metadata: value.metadata ?? {},
  }));
  invariant(new Set(nodes.map((node) => node.id)).size === nodes.length, 'DIRECTOR_NODE_ID_DUPLICATE', beat.id);
  invariant(Array.isArray(visual.assemblyStages) && visual.assemblyStages.length >= 3, 'DIRECTOR_OCCLUDED_REVEAL_STAGE_COUNT_INVALID', beat.id);
  invariant(!visual.assemblyStages.some((stage) => stage.action === 'mechanical-action'), 'DIRECTOR_STATE_REVEAL_MECHANICAL_CLAIM_FORBIDDEN', beat.id);
  const targetIds = new Set([...objectGroups.map((group) => group.id), ...nodes.map((node) => node.id)]);
  const assemblyStages = visual.assemblyStages.map((stage, index) => {
    invariant(stage.atSeconds >= beat.start && stage.atSeconds < beat.end, 'DIRECTOR_STAGE_TIME_OUTSIDE_SCENE', `${beat.id}:${stage.id}`);
    invariant(Array.isArray(stage.targetIds) && stage.targetIds.length > 0, 'DIRECTOR_STAGE_TARGETS_EMPTY', `${beat.id}:${stage.id}`);
    invariant(stage.targetIds.every((id) => targetIds.has(id)), 'DIRECTOR_STAGE_TARGET_UNKNOWN', `${beat.id}:${stage.id}`);
    return {
      id: safeId(stage.id ?? `${beat.id}-stage-${index + 1}`, 'occluded reveal stage id'),
      atSeconds: stage.atSeconds,
      action: nonEmpty(stage.action, `${beat.id}.${stage.id}.action`),
      targetIds: [...stage.targetIds],
    };
  });
  validateAssemblyStageOrder(assemblyStages, beat.id);
  for (const node of nodes) {
    invariant(assemblyStages.some((stage) => stage.targetIds.includes(node.id) || stage.targetIds.includes(node.groupId)), 'DIRECTOR_MECHANISM_NODE_STAGE_MISSING', `${beat.id}:${node.id}`);
  }
  const stateReveal = compileStateReveal(visual.stateReveal, beat, fps, assemblyStages, render);
  invariant(stateReveal, 'DIRECTOR_STATE_REVEAL_REQUIRED', beat.id);
  return {
    id: beat.id,
    type: 'occluded-state-reveal',
    start: beat.start,
    end: beat.end,
    spokenLine: beat.spokenLine,
    cognitiveIncrement: beat.cognitiveIncrement,
    camera: nonEmpty(visual.camera, `${beat.id}.camera`),
    layers: visual.layers,
    assemblyStages,
    objectGroups,
    nodes,
    relations: compileRelations(visual.relations, targetIds, beat.id),
    screenPlacements: [],
    stateReveal,
  };
}

function compileScenes(request, duration, fps) {
  invariant(Array.isArray(request.semanticBeats) && request.semanticBeats.length >= 2, 'DIRECTOR_SEMANTIC_BEATS_INSUFFICIENT');
  validateContinuousRanges(request.semanticBeats, duration, 'semanticBeats');
  const scenes = request.semanticBeats.map((beat) => {
    safeId(beat.id, 'semantic beat id');
    nonEmpty(beat.spokenLine, `${beat.id}.spokenLine`);
    nonEmpty(beat.cognitiveIncrement, `${beat.id}.cognitiveIncrement`);
    if (beat.kind === 'complex-explanation') return compileComplexScene(beat, fps, request.render);
    if (beat.kind === 'mechanical-causality') return compileMechanicalScene(beat);
    if (beat.kind === 'occluded-state-reveal') return compileOccludedStateRevealScene(beat, fps, request.render);
    invariant(false, 'DIRECTOR_SCENE_KIND_UNKNOWN', beat.kind);
  });
  invariant(scenes.some((scene) => scene.type === 'complex-explanation'), 'DIRECTOR_COMPLEX_SCENE_MISSING');
  invariant(scenes.some((scene) => scene.type === 'mechanical-causality' || scene.type === 'occluded-state-reveal'), 'DIRECTOR_CAUSAL_SCENE_MISSING');
  for (const scene of scenes) {
    const requiredStageIds = scene.assemblyStages.map((stage) => stage.id);
    scene.completion = sceneCompletionWindow(scene, fps, requiredStageIds);
  }
  return scenes;
}

function compileScreenMedia(request, render, scenes, repoRoot) {
  const screen = request.media.screen;
  if (!screen) {
    return {screenClips: [], screenExcludedRanges: []};
  }
  const excludedRanges = Array.isArray(screen.excludedRanges) ? screen.excludedRanges.map((range, index) => {
    finiteNumber(range.sourceIn, `media.screen.excludedRanges.${index}.sourceIn`);
    finiteNumber(range.sourceOut, `media.screen.excludedRanges.${index}.sourceOut`);
    invariant(range.sourceOut > range.sourceIn, 'DIRECTOR_SCREEN_EXCLUDED_RANGE_INVALID', String(index));
    return {sourceIn: range.sourceIn, sourceOut: range.sourceOut, reason: nonEmpty(range.reason, `media.screen.excludedRanges.${index}.reason`)};
  }) : [];

  const screenPath = resolvePath(screen.path, repoRoot);
  const clips = screen.clips.map((clip) => {
    safeId(clip.id, 'screen clip id');
    finiteNumber(clip.sourceIn, `${clip.id}.sourceIn`);
    finiteNumber(clip.sourceOut, `${clip.id}.sourceOut`);
    finiteNumber(clip.outputIn, `${clip.id}.outputIn`);
    finiteNumber(clip.outputOut, `${clip.id}.outputOut`);
    invariant(clip.sourceOut > clip.sourceIn, 'DIRECTOR_SCREEN_SOURCE_RANGE_INVALID', clip.id);
    invariant(clip.outputIn >= 0 && clip.outputOut <= render.durationSeconds && clip.outputOut > clip.outputIn, 'DIRECTOR_SCREEN_OUTPUT_RANGE_INVALID', clip.id);
    invariant(!excludedRanges.some((range) => halfOpenRangesOverlap(clip, range)), 'DIRECTOR_SCREEN_CLIP_EXCLUDED_OVERLAP', clip.id);
    const trimBeforeFrame = roundedFrame(clip.sourceIn, render.fps);
    const trimAfterFrame = roundedFrame(clip.sourceOut, render.fps);
    const outputInFrame = roundedFrame(clip.outputIn, render.fps);
    const outputOutFrame = roundedFrame(clip.outputOut, render.fps);
    invariant(trimAfterFrame > trimBeforeFrame && outputOutFrame > outputInFrame, 'DIRECTOR_SCREEN_FRAME_RANGE_INVALID', clip.id);
    const playbackRate = (trimAfterFrame - trimBeforeFrame) / (outputOutFrame - outputInFrame);
    invariant(playbackRate >= MIN_SCREEN_PLAYBACK_RATE && playbackRate <= MAX_SCREEN_PLAYBACK_RATE, 'DIRECTOR_SCREEN_PLAYBACK_RATE_OUT_OF_BOUNDS', clip.id);
    const ownerScene = scenes.find((scene) =>
      (scene.type === 'mechanical-causality' || scene.type === 'occluded-state-reveal') &&
      clip.outputIn >= scene.start - EPSILON && clip.outputOut <= scene.end + EPSILON
    );
    invariant(ownerScene, 'DIRECTOR_SCREEN_CLIP_SCENE_MISSING', clip.id);
    const compiledClip = {
      ...clip,
      path: screenPath,
      staticFileName: screen.staticFileName,
      sha256: screen.sha256,
      trimBeforeFrame,
      trimAfterFrame,
      outputInFrame,
      outputOutFrame,
      playbackRate,
      placementId: `${ownerScene.id}-screen-evidence`,
    };
    validateScreenClipFrameLifecycle(compiledClip, excludedRanges, render.fps);
    return compiledClip;
  });
  invariant(new Set(clips.map((clip) => clip.id)).size === clips.length, 'DIRECTOR_SCREEN_CLIP_ID_DUPLICATE');

  for (const scene of scenes.filter((item) => item.type === 'mechanical-causality' || item.type === 'occluded-state-reveal')) {
    const sceneClips = clips.filter((clip) => clip.outputIn >= scene.start - EPSILON && clip.outputOut <= scene.end + EPSILON);
    if (sceneClips.length === 0) continue;
    const outputGroup = scene.objectGroups.find((group) => ['evidence-output', 'human-decision-output'].includes(group.visualRole));
    invariant(outputGroup?.visualPrimitive === 'screen-proof-strip', 'DIRECTOR_SCREEN_PLACEMENT_PARENT_INVALID', scene.id);
    const visibleFrom = Math.min(...sceneClips.map((clip) => clip.outputIn));
    const visibleTo = Math.max(...sceneClips.map((clip) => clip.outputOut));
    const placementId = `${scene.id}-screen-evidence`;
    invariant(sceneClips.every((clip) => clip.placementId === placementId), 'DIRECTOR_SCREEN_PLACEMENT_ID_MISMATCH', scene.id);
    scene.screenPlacements = [{
      id: placementId,
      clipIds: sceneClips.map((clip) => clip.id),
      parentGroupId: outputGroup.id,
      visibleFrom,
      visibleTo,
    }];
  }
  return {screenClips: clips, screenExcludedRanges: excludedRanges};
}

function expectedRuntimeDefinitions(request, repoRoot, render) {
  const definitions = request.execution.mode === 'renderable'
    ? [...DIRECTOR_RUNTIME_COMMON_FILES, ...DIRECTOR_RUNTIME_RENDERABLE_FILES]
    : [...DIRECTOR_RUNTIME_COMMON_FILES];
  const fixed = definitions.map((item) => ({
    id: item.id,
    path: resolvePath('executionField' in item ? request.execution[item.executionField] : item.path, repoRoot),
  }));
  if (request.execution.mode !== 'renderable') return fixed;
  return [
    ...fixed,
    {
      id: 'public-spoken',
      path: resolvePublicAsset(render.publicDir, request.media.spoken.staticFileName, 'public-spoken'),
    },
    ...(request.media.screen ? [{
      id: 'public-screen',
      path: resolvePublicAsset(render.publicDir, request.media.screen.staticFileName, 'public-screen'),
    }] : []),
    ...(request.media.sfx ?? []).map((item) => ({
      id: `public-sfx-${item.id}`,
      path: resolvePublicAsset(render.publicDir, item.staticFileName, `public-sfx-${item.id}`),
    })),
    ...(request.media.visualStateAssets ?? []).map((item) => ({
      id: `public-visual-state-${item.id}`,
      path: resolvePublicAsset(render.publicDir, item.staticFileName, `public-visual-state-${item.id}`),
    })),
  ];
}

export function validateRuntimeFileContract(request, {repoRoot, render}) {
  invariant(request.execution?.runtimeContractId === DIRECTOR_RUNTIME_FILE_CONTRACT_ID, 'DIRECTOR_RUNTIME_CONTRACT_ID_INVALID');
  invariant(Array.isArray(request.execution.runtimeFiles), 'DIRECTOR_RUNTIME_FILES_REQUIRED');
  const expected = expectedRuntimeDefinitions(request, repoRoot, render);
  const expectedById = new Map(expected.map((item) => [item.id, item]));
  invariant(expectedById.size === expected.length, 'DIRECTOR_RUNTIME_CONTRACT_DUPLICATE_ID');
  const declaredById = new Map();
  for (const item of request.execution.runtimeFiles) {
    safeId(item.id, 'runtime file id');
    invariant(!declaredById.has(item.id), 'DIRECTOR_RUNTIME_BINDING_DUPLICATE', item.id);
    invariant(expectedById.has(item.id), 'DIRECTOR_RUNTIME_BINDING_UNKNOWN', item.id);
    declaredById.set(item.id, item);
  }
  invariant(declaredById.size === expectedById.size, 'DIRECTOR_RUNTIME_BINDING_COUNT_INVALID', `${declaredById.size}/${expectedById.size}`);
  const verified = [];
  for (const [id, definition] of expectedById) {
    const declared = declaredById.get(id);
    invariant(declared, 'DIRECTOR_RUNTIME_BINDING_REQUIRED', id);
    invariant(resolvePath(declared.path, repoRoot) === definition.path, 'DIRECTOR_RUNTIME_BINDING_PATH_INVALID', id);
    verified.push(verifyFile({
      role: 'runtime',
      id,
      declaredPath: declared.path,
      expectedSha256: declared.sha256,
    }, repoRoot));
  }
  return verified.sort((left, right) => `${left.id}\0${left.path}`.localeCompare(`${right.id}\0${right.path}`));
}

function buildFileBindings(
  request,
  repoRoot,
  render,
  runtimeBindings,
  authorityReceiptBindings,
  requestIsolation,
) {
  const bindings = [
    verifyFile({role: 'reference', id: 'selected-reference', declaredPath: request.reference.path, expectedSha256: request.reference.sha256}, repoRoot),
    verifyFile({role: 'style', id: request.style.id, declaredPath: request.style.path, expectedSha256: request.style.sha256}, repoRoot),
    verifyFile({role: 'transcript', id: 'spoken-authority', declaredPath: request.authority.transcriptPath, expectedSha256: request.authority.transcriptSha256}, repoRoot),
    verifyFile({role: 'spoken-proxy', id: request.media.spoken.staticFileName, declaredPath: request.media.spoken.path, expectedSha256: request.media.spoken.sha256}, repoRoot),
    verifyFile({role: 'spoken-original', id: 'authoritative-original', declaredPath: request.media.spoken.authoritativeOriginal.path, expectedSha256: request.media.spoken.authoritativeOriginal.sha256}, repoRoot),
    verifyFile({role: 'compiler', id: 'compile-director-plan', declaredPath: scriptPath, expectedSha256: sha256File(scriptPath)}, repoRoot),
    ...authorityReceiptBindings,
    ...(requestIsolation?.checked ? [
      verifyFile({
        role: 'request-isolation-registry-integrity',
        id: 'actual',
        declaredPath: requestIsolation.listPath,
        expectedSha256: requestIsolation.listActualSha256,
      }, repoRoot),
      verifyFile({
        role: 'request-isolation-registry-integrity',
        id: 'external-expected',
        declaredPath: requestIsolation.listPath,
        expectedSha256: requestIsolation.listExpectedSha256,
      }, repoRoot),
    ] : []),
  ];
  if (request.media.screen) {
    bindings.push(verifyFile({role: 'screen-proxy', id: request.media.screen.staticFileName, declaredPath: request.media.screen.path, expectedSha256: request.media.screen.sha256}, repoRoot));
  }
  for (const item of request.media.sfx ?? []) {
    bindings.push(verifyFile({role: 'sfx', id: item.id, declaredPath: item.path, expectedSha256: item.sha256}, repoRoot));
  }
  for (const item of request.media.visualStateAssets ?? []) {
    bindings.push(verifyFile({role: 'visual-state', id: item.id, declaredPath: item.path, expectedSha256: item.sha256}, repoRoot));
  }
  bindings.push(...runtimeBindings);
  if (request.execution.mode === 'renderable') {
    invariant(
      existsSync(render.publicDir) && statSync(render.publicDir).isDirectory(),
      'DIRECTOR_PUBLIC_DIR_MISSING',
      render.publicDir,
    );
    const publicAssets = [
      {id: 'public-spoken', staticFileName: request.media.spoken.staticFileName, sha256: request.media.spoken.sha256},
      ...(request.media.screen ? [{id: 'public-screen', staticFileName: request.media.screen.staticFileName, sha256: request.media.screen.sha256}] : []),
      ...(request.media.sfx ?? []).map((item) => ({id: `public-sfx-${item.id}`, staticFileName: item.staticFileName, sha256: item.sha256})),
      ...(request.media.visualStateAssets ?? []).map((item) => ({id: `public-visual-state-${item.id}`, staticFileName: item.staticFileName, sha256: item.sha256})),
    ];
    for (const asset of publicAssets) {
      bindings.push(verifyFile({
        role: 'public-media',
        id: asset.id,
        declaredPath: resolvePublicAsset(render.publicDir, asset.staticFileName, asset.id),
        expectedSha256: asset.sha256,
      }, repoRoot));
    }
  }
  return bindings.sort((a, b) => `${a.role}\0${a.id}\0${a.path}`.localeCompare(`${b.role}\0${b.id}\0${b.path}`));
}

export function revalidatePlanFileBindings(plan, {phase = 'revalidate'} = {}) {
  const bindings = plan?.provenance?.fileBindings;
  invariant(Array.isArray(bindings), 'DIRECTOR_PLAN_FILE_BINDINGS_REQUIRED', phase);
  const sorted = [...bindings].sort((left, right) =>
    `${left.role}\0${left.id}\0${left.path}`.localeCompare(
      `${right.role}\0${right.id}\0${right.path}`,
    ));
  invariant(
    stableStringify(sorted) === stableStringify(bindings),
    'DIRECTOR_PLAN_FILE_BINDINGS_ORDER_DRIFT',
    phase,
  );
  invariant(
    sha256Text(stableStringify(sorted)) === plan.provenance.fileBindingsSha256,
    'DIRECTOR_PLAN_FILE_BINDINGS_AGGREGATE_SHA_DRIFT',
    phase,
  );
  const sha256ByPath = new Map();
  for (const binding of sorted) {
    invariant(
      path.isAbsolute(binding.path) &&
        path.normalize(binding.path) === binding.path &&
        SHA256_RE.test(binding.sha256 ?? '') &&
        existsSync(binding.path),
      'DIRECTOR_PLAN_FILE_BINDING_INVALID',
      `${phase}:${binding?.role}:${binding?.id}`,
    );
    const previouslyDeclaredSha256 = sha256ByPath.get(binding.path);
    invariant(
      previouslyDeclaredSha256 === undefined || previouslyDeclaredSha256 === binding.sha256,
      'DIRECTOR_PLAN_FILE_BINDING_PATH_SHA_CONFLICT',
      `${phase}:${binding.path}`,
    );
    sha256ByPath.set(binding.path, binding.sha256);
  }
  const actualSha256ByPath = new Map();
  for (const binding of sorted) {
    if (!actualSha256ByPath.has(binding.path)) {
      actualSha256ByPath.set(binding.path, sha256File(binding.path));
    }
    invariant(
      actualSha256ByPath.get(binding.path) === binding.sha256,
      'DIRECTOR_PLAN_FILE_BINDING_SHA_DRIFT',
      `${phase}:${binding.role}:${binding.id}`,
    );
  }
  return sorted;
}

export function revalidateDirectorPlanPublicationInputs({
  request,
  requestPath,
  plan,
  repoRoot,
  expectedRequestSnapshot,
  expectedIntegrityFileSnapshots,
  phase = 'revalidate',
}) {
  const requestSnapshot = revalidateRequestForPublication(
    request,
    requestPath,
    expectedRequestSnapshot,
    {phase},
  );
  invariant(
    sha256Text(stableStringify(request)) === plan.provenance.requestCanonicalSha256,
    'DIRECTOR_PLAN_REQUEST_CANONICAL_SHA_DRIFT',
    phase,
  );
  revalidateExecutionIntegrityAnchors(request, {
    repoRoot,
    expectedSnapshot: plan.provenance.integrityAnchors,
    expectedFileSnapshots: expectedIntegrityFileSnapshots,
    phase,
  });
  const fileBindings = revalidatePlanFileBindings(plan, {phase});
  const runtimeBindings = validateRuntimeFileContract(request, {
    repoRoot,
    render: plan.render,
  });
  const planRuntimeBindings = fileBindings
    .filter((binding) => binding.role === 'runtime')
    .sort((left, right) =>
      `${left.id}\0${left.path}`.localeCompare(`${right.id}\0${right.path}`));
  invariant(
    stableStringify(planRuntimeBindings) === stableStringify(runtimeBindings),
    'DIRECTOR_PLAN_RUNTIME_BINDINGS_DRIFT',
    phase,
  );
  return {requestSnapshot, fileBindings, runtimeBindings};
}

function lstatOrNull(filePath) {
  try {
    return lstatSync(filePath);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

function fileIdentity(stat) {
  return {device: stat.dev, inode: stat.ino};
}

function sameFileIdentity(left, right) {
  return left?.device === right?.dev && left?.inode === right?.ino;
}

function readDescriptorExactly(descriptor, size) {
  const bytes = Buffer.alloc(size);
  let offset = 0;
  while (offset < size) {
    const count = readSync(descriptor, bytes, offset, size - offset, offset);
    invariant(count > 0, 'DIRECTOR_PLAN_TEMP_READBACK_SHORT', `${offset}/${size}`);
    offset += count;
  }
  return bytes;
}

function writeDescriptorExactly(descriptor, bytes) {
  let offset = 0;
  while (offset < bytes.length) {
    const count = writeSync(descriptor, bytes, offset, bytes.length - offset, offset);
    invariant(count > 0, 'DIRECTOR_PLAN_TEMP_WRITE_SHORT', `${offset}/${bytes.length}`);
    offset += count;
  }
}

function assertDirectoryIdentity(
  directoryPath,
  directoryDescriptor,
  expectedIdentity,
  phase,
) {
  const descriptorStatBefore = fstatSync(directoryDescriptor);
  const pathStat = lstatSync(directoryPath);
  const descriptorStatAfter = fstatSync(directoryDescriptor);
  invariant(
    descriptorStatBefore.isDirectory() &&
      descriptorStatAfter.isDirectory() &&
      pathStat.isDirectory() &&
      !pathStat.isSymbolicLink() &&
      sameFileIdentity(expectedIdentity, descriptorStatBefore) &&
      sameFileIdentity(expectedIdentity, descriptorStatAfter) &&
      sameFileIdentity(expectedIdentity, pathStat) &&
      realpathSync(directoryPath) === directoryPath,
    'DIRECTOR_PLAN_PUBLICATION_DIRECTORY_DRIFT',
    `${phase}:${directoryPath}`,
  );
}

function readOwnedPublicationDescriptor(
  descriptor,
  expectedIdentity,
  expectedBytes,
  phase,
  {allowPrefix = false} = {},
) {
  const descriptorStatBefore = fstatSync(descriptor);
  invariant(
    descriptorStatBefore.isFile() && sameFileIdentity(expectedIdentity, descriptorStatBefore),
    'DIRECTOR_PLAN_PUBLICATION_DESCRIPTOR_DRIFT',
    phase,
  );
  const actualBytes = readDescriptorExactly(descriptor, descriptorStatBefore.size);
  const descriptorStatAfter = fstatSync(descriptor);
  invariant(
    descriptorStatAfter.isFile() &&
      sameFileIdentity(expectedIdentity, descriptorStatAfter) &&
      descriptorStatAfter.size === descriptorStatBefore.size &&
      descriptorStatAfter.mtimeMs === descriptorStatBefore.mtimeMs &&
      descriptorStatAfter.ctimeMs === descriptorStatBefore.ctimeMs,
    'DIRECTOR_PLAN_PUBLICATION_DESCRIPTOR_DRIFT',
    phase,
  );
  const contentMatches = allowPrefix
    ? actualBytes.length <= expectedBytes.length &&
      actualBytes.equals(expectedBytes.subarray(0, actualBytes.length))
    : actualBytes.length === expectedBytes.length && actualBytes.equals(expectedBytes);
  invariant(
    contentMatches,
    'DIRECTOR_PLAN_PUBLICATION_CONTENT_DRIFT',
    phase,
  );
  return actualBytes;
}

function assertOwnedPublicationPath({
  filePath,
  descriptor,
  expectedIdentity,
  expectedBytes,
  phase,
  allowPrefix = false,
  expectedMode,
}) {
  const pathStatBefore = lstatOrNull(filePath);
  invariant(
    pathStatBefore?.isFile() &&
      !pathStatBefore.isSymbolicLink() &&
      sameFileIdentity(expectedIdentity, pathStatBefore) &&
      (expectedMode === undefined || (pathStatBefore.mode & 0o7777) === expectedMode) &&
      realpathSync(filePath) === filePath,
    'DIRECTOR_PLAN_PUBLICATION_OWNERSHIP_DRIFT',
    `${phase}:${filePath}`,
  );
  const pathDescriptor = openSync(
    filePath,
    fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW,
  );
  try {
    const ownerBytes = readOwnedPublicationDescriptor(
      descriptor,
      expectedIdentity,
      expectedBytes,
      `${phase}:owner-descriptor`,
      {allowPrefix},
    );
    const pathBytes = readOwnedPublicationDescriptor(
      pathDescriptor,
      expectedIdentity,
      expectedBytes,
      `${phase}:path-descriptor`,
      {allowPrefix},
    );
    invariant(
      pathBytes.equals(ownerBytes),
      'DIRECTOR_PLAN_PUBLICATION_CONTENT_DRIFT',
      `${phase}:descriptor-mismatch:${filePath}`,
    );
  } finally {
    closeSync(pathDescriptor);
  }
  const pathStatAfter = lstatOrNull(filePath);
  invariant(
    pathStatAfter?.isFile() &&
      !pathStatAfter.isSymbolicLink() &&
      sameFileIdentity(expectedIdentity, pathStatAfter) &&
      (expectedMode === undefined || (pathStatAfter.mode & 0o7777) === expectedMode) &&
      realpathSync(filePath) === filePath,
    'DIRECTOR_PLAN_PUBLICATION_OWNERSHIP_DRIFT',
    `${phase}:post-read:${filePath}`,
  );
}

function fsyncDirectory(
  directoryPath,
  directoryDescriptor,
  directoryIdentity,
  phase,
  hooks,
) {
  const descriptorStatBefore = fstatSync(directoryDescriptor);
  invariant(
    descriptorStatBefore.isDirectory() &&
      sameFileIdentity(directoryIdentity, descriptorStatBefore),
    'DIRECTOR_PLAN_PUBLICATION_DIRECTORY_DRIFT',
    `${phase}:descriptor:${directoryPath}`,
  );
  fsyncSync(directoryDescriptor);
  const descriptorStatAfter = fstatSync(directoryDescriptor);
  invariant(
    descriptorStatAfter.isDirectory() &&
      sameFileIdentity(directoryIdentity, descriptorStatAfter),
    'DIRECTOR_PLAN_PUBLICATION_DIRECTORY_DRIFT',
    `${phase}:descriptor-post-fsync:${directoryPath}`,
  );
  hooks.afterDirectoryFsync?.({
    descriptor: directoryDescriptor,
    phase,
    device: directoryIdentity.device,
    inode: directoryIdentity.inode,
  });
}

export const DIRECTOR_PLAN_PUBLICATION_JOURNAL_DIRECTORY_NAME =
  '.director-plan-publication-journal';
export const DIRECTOR_PLAN_PUBLICATION_RECEIPT_SCHEMA =
  'director-plan-publication-receipt/v1';

export function deriveDirectorPlanPublicationPaths(outputPath, bytes) {
  invariant(
    path.isAbsolute(outputPath) && path.normalize(outputPath) === outputPath,
    'DIRECTOR_OUTPUT_PATH_INVALID',
    outputPath,
  );
  invariant(Buffer.isBuffer(bytes) && bytes.length > 0, 'DIRECTOR_OUTPUT_BYTES_INVALID');
  const publicationId = sha256Text(bytes);
  const outputKey = sha256Text(Buffer.from(outputPath, 'utf8'));
  const journalRoot = path.join(
    path.dirname(outputPath),
    DIRECTOR_PLAN_PUBLICATION_JOURNAL_DIRECTORY_NAME,
  );
  const outputJournalDirectory = path.join(journalRoot, outputKey);
  return {
    outputPath,
    journalRoot,
    outputKey,
    publicationId,
    outputJournalDirectory,
    stagePath: path.join(outputJournalDirectory, `${publicationId}.stage`),
    committedPath: path.join(outputJournalDirectory, `${publicationId}.committed`),
  };
}

function assertPrivateJournalDirectory({
  directoryPath,
  directoryDescriptor,
  directoryIdentity,
  expectedDevice,
  phase,
}) {
  assertDirectoryIdentity(
    directoryPath,
    directoryDescriptor,
    directoryIdentity,
    phase,
  );
  const descriptorStat = fstatSync(directoryDescriptor);
  const pathStat = lstatSync(directoryPath);
  const currentUid = process.getuid?.();
  invariant(
    Number.isInteger(currentUid) &&
      descriptorStat.uid === currentUid &&
      pathStat.uid === currentUid &&
      (descriptorStat.mode & 0o7777) === 0o700 &&
      (pathStat.mode & 0o7777) === 0o700 &&
      descriptorStat.dev === expectedDevice &&
      pathStat.dev === expectedDevice,
    'DIRECTOR_PLAN_PUBLICATION_JOURNAL_DIRECTORY_INVALID',
    `${phase}:${directoryPath}`,
  );
}

function openBoundDirectory(directoryPath, {
  expectedDevice,
  phase,
  privateJournal = false,
} = {}) {
  let descriptor;
  try {
    descriptor = openSync(
      directoryPath,
      fsConstants.O_RDONLY | fsConstants.O_DIRECTORY | fsConstants.O_NOFOLLOW,
    );
    const descriptorStat = fstatSync(descriptor);
    invariant(
      descriptorStat.isDirectory(),
      'DIRECTOR_PLAN_PUBLICATION_DIRECTORY_INVALID',
      directoryPath,
    );
    const identity = fileIdentity(descriptorStat);
    if (privateJournal) {
      assertPrivateJournalDirectory({
        directoryPath,
        directoryDescriptor: descriptor,
        directoryIdentity: identity,
        expectedDevice,
        phase,
      });
    } else {
      assertDirectoryIdentity(directoryPath, descriptor, identity, phase);
      invariant(
        expectedDevice === undefined || descriptorStat.dev === expectedDevice,
        'DIRECTOR_PLAN_PUBLICATION_DIRECTORY_DEVICE_MISMATCH',
        `${phase}:${directoryPath}`,
      );
    }
    return {descriptor, identity};
  } catch (error) {
    if (descriptor !== undefined) closeSync(descriptor);
    throw error;
  }
}

function ensurePrivateJournalDirectory(directoryPath, {
  parentPath,
  parentDescriptor,
  parentIdentity,
  expectedDevice,
  phase,
  hooks,
}) {
  let created = false;
  if (lstatOrNull(directoryPath) === null) {
    try {
      mkdirSync(directoryPath, {mode: 0o700});
      created = true;
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
    }
  }
  const bound = openBoundDirectory(directoryPath, {
    expectedDevice,
    phase,
    privateJournal: !created,
  });
  try {
    if (created) {
      fchmodSync(bound.descriptor, 0o700);
      assertPrivateJournalDirectory({
        directoryPath,
        directoryDescriptor: bound.descriptor,
        directoryIdentity: bound.identity,
        expectedDevice,
        phase: `${phase}:post-chmod`,
      });
      fsyncDirectory(
        parentPath,
        parentDescriptor,
        parentIdentity,
        `${phase}:created`,
        hooks,
      );
    }
    return {...bound, created};
  } catch (error) {
    closeSync(bound.descriptor);
    throw error;
  }
}

function assertPublicationDirectories({
  paths,
  outputDirectoryDescriptor,
  outputDirectoryIdentity,
  journalRootDescriptor,
  journalRootIdentity,
  outputJournalDescriptor,
  outputJournalIdentity,
  phase,
}) {
  assertDirectoryIdentity(
    path.dirname(paths.outputPath),
    outputDirectoryDescriptor,
    outputDirectoryIdentity,
    `${phase}:output-directory`,
  );
  assertPrivateJournalDirectory({
    directoryPath: paths.journalRoot,
    directoryDescriptor: journalRootDescriptor,
    directoryIdentity: journalRootIdentity,
    expectedDevice: outputDirectoryIdentity.device,
    phase: `${phase}:journal-root`,
  });
  assertPrivateJournalDirectory({
    directoryPath: paths.outputJournalDirectory,
    directoryDescriptor: outputJournalDescriptor,
    directoryIdentity: outputJournalIdentity,
    expectedDevice: outputDirectoryIdentity.device,
    phase: `${phase}:output-journal`,
  });
}

function publicationReceipt(paths, bytes, identity) {
  return {
    schemaVersion: DIRECTOR_PLAN_PUBLICATION_RECEIPT_SCHEMA,
    state: 'committed-candidate',
    ...paths,
    sha256: paths.publicationId,
    bytes: bytes.length,
    device: identity.device,
    inode: identity.inode,
  };
}

function validateDirectorPlanPublicationJournalCore({
  outputPath,
  expectedBytes,
  heldFinalSnapshot,
}) {
  const paths = deriveDirectorPlanPublicationPaths(outputPath, expectedBytes);
  invariant(
    lstatOrNull(paths.committedPath) !== null,
    'DIRECTOR_PLAN_PUBLICATION_COMMIT_MISSING',
    paths.committedPath,
  );
  invariant(
    lstatOrNull(paths.stagePath) !== null,
    'DIRECTOR_PLAN_PUBLICATION_STAGE_MISSING',
    paths.stagePath,
  );
  invariant(
    lstatOrNull(paths.outputPath) !== null,
    'DIRECTOR_PLAN_PUBLICATION_FINAL_MISSING',
    paths.outputPath,
  );

  let outputDirectory;
  let journalRoot;
  let outputJournal;
  const publicationDescriptors = [];
  try {
    outputDirectory = openBoundDirectory(path.dirname(paths.outputPath), {
      phase: 'consumer-open-output-directory',
    });
    journalRoot = openBoundDirectory(paths.journalRoot, {
      expectedDevice: outputDirectory.identity.device,
      phase: 'consumer-open-journal-root',
      privateJournal: true,
    });
    outputJournal = openBoundDirectory(paths.outputJournalDirectory, {
      expectedDevice: outputDirectory.identity.device,
      phase: 'consumer-open-output-journal',
      privateJournal: true,
    });
    assertPublicationDirectories({
      paths,
      outputDirectoryDescriptor: outputDirectory.descriptor,
      outputDirectoryIdentity: outputDirectory.identity,
      journalRootDescriptor: journalRoot.descriptor,
      journalRootIdentity: journalRoot.identity,
      outputJournalDescriptor: outputJournal.descriptor,
      outputJournalIdentity: outputJournal.identity,
      phase: 'consumer-pre-read',
    });

    if (heldFinalSnapshot) {
      invariant(
        heldFinalSnapshot.path === paths.outputPath &&
          Buffer.isBuffer(heldFinalSnapshot.bytes) &&
          heldFinalSnapshot.bytes.equals(expectedBytes) &&
          heldFinalSnapshot.sha256 === paths.publicationId,
        'DIRECTOR_PLAN_PUBLICATION_HELD_FINAL_INVALID',
        paths.outputPath,
      );
      const heldFinalEntry = {
        label: 'final',
        filePath: paths.outputPath,
        descriptor: heldFinalSnapshot.descriptor,
        identity: {
          device: heldFinalSnapshot.device,
          inode: heldFinalSnapshot.inode,
        },
        closeOnReturn: false,
      };
      publicationDescriptors.push(heldFinalEntry);
      assertOwnedPublicationPath({
        filePath: heldFinalEntry.filePath,
        descriptor: heldFinalEntry.descriptor,
        expectedIdentity: heldFinalEntry.identity,
        expectedBytes,
        expectedMode: 0o400,
        phase: 'consumer-final-entry-held',
      });
    }

    const pathsToOpen = heldFinalSnapshot
      ? [
          ['stage', paths.stagePath],
          ['committed', paths.committedPath],
        ]
      : [
          ['final', paths.outputPath],
          ['stage', paths.stagePath],
          ['committed', paths.committedPath],
        ];
    for (const [label, filePath] of pathsToOpen) {
      const descriptor = openSync(
        filePath,
        fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW,
      );
      const descriptorEntry = {
        label,
        filePath,
        descriptor,
        identity: null,
        closeOnReturn: true,
      };
      publicationDescriptors.push(descriptorEntry);
      const descriptorStat = fstatSync(descriptor);
      const identity = fileIdentity(descriptorStat);
      descriptorEntry.identity = identity;
      assertOwnedPublicationPath({
        filePath,
        descriptor,
        expectedIdentity: identity,
        expectedBytes,
        expectedMode: 0o400,
        phase: `consumer-${label}-entry`,
      });
    }
    const publicationIdentity = publicationDescriptors[0].identity;
    invariant(
      publicationDescriptors.every(
        ({identity}) =>
          identity.device === publicationIdentity.device &&
          identity.inode === publicationIdentity.inode,
      ) && publicationIdentity.device === outputDirectory.identity.device,
      'DIRECTOR_PLAN_PUBLICATION_IDENTITY_MISMATCH',
      outputPath,
    );
    assertPublicationDirectories({
      paths,
      outputDirectoryDescriptor: outputDirectory.descriptor,
      outputDirectoryIdentity: outputDirectory.identity,
      journalRootDescriptor: journalRoot.descriptor,
      journalRootIdentity: journalRoot.identity,
      outputJournalDescriptor: outputJournal.descriptor,
      outputJournalIdentity: outputJournal.identity,
      phase: 'consumer-terminal',
    });
    for (const {label, filePath, descriptor} of [...publicationDescriptors].reverse()) {
      assertOwnedPublicationPath({
        filePath,
        descriptor,
        expectedIdentity: publicationIdentity,
        expectedBytes,
        expectedMode: 0o400,
        phase: `consumer-${label}-terminal`,
      });
    }
    return publicationReceipt(paths, expectedBytes, publicationIdentity);
  } finally {
    for (const {descriptor, closeOnReturn} of publicationDescriptors.reverse()) {
      if (closeOnReturn) closeSync(descriptor);
    }
    if (outputJournal?.descriptor !== undefined) closeSync(outputJournal.descriptor);
    if (journalRoot?.descriptor !== undefined) closeSync(journalRoot.descriptor);
    if (outputDirectory?.descriptor !== undefined) closeSync(outputDirectory.descriptor);
  }
}

export function validateDirectorPlanPublicationJournal({outputPath, expectedBytes}) {
  return validateDirectorPlanPublicationJournalCore({outputPath, expectedBytes});
}

export function consumeCommittedDirectorPlanSnapshot(
  outputPath,
  consumer,
  {phase = 'consumer-return'} = {},
) {
  invariant(
    path.isAbsolute(outputPath) && path.normalize(outputPath) === outputPath,
    'DIRECTOR_OUTPUT_PATH_INVALID',
    outputPath,
  );
  invariant(
    typeof consumer === 'function',
    'DIRECTOR_PLAN_PUBLICATION_CONSUMER_REQUIRED',
  );
  const heldFinalSnapshot = openVerifiedFileSnapshot(outputPath);
  try {
    const entryReceipt = validateDirectorPlanPublicationJournalCore({
      outputPath,
      expectedBytes: heldFinalSnapshot.bytes,
      heldFinalSnapshot,
    });
    invariant(
      heldFinalSnapshot.device === entryReceipt.device &&
        heldFinalSnapshot.inode === entryReceipt.inode &&
        heldFinalSnapshot.sha256 === entryReceipt.sha256,
      'DIRECTOR_PLAN_PUBLICATION_IDENTITY_MISMATCH',
      outputPath,
    );
    const {descriptor: _descriptor, ...closedShape} = heldFinalSnapshot;
    const entrySnapshot = {...closedShape, publicationReceipt: entryReceipt};
    const value = consumer(entrySnapshot);
    invariant(
      !value || typeof value.then !== 'function',
      'DIRECTOR_PLAN_PUBLICATION_ASYNC_CONSUMER_FORBIDDEN',
    );
    const terminalReceipt = validateDirectorPlanPublicationJournalCore({
      outputPath,
      expectedBytes: heldFinalSnapshot.bytes,
      heldFinalSnapshot,
    });
    invariant(
      stableStringify(terminalReceipt) === stableStringify(entryReceipt),
      'DIRECTOR_PLAN_PUBLICATION_SNAPSHOT_DRIFT',
      `${phase}:${outputPath}`,
    );
    return {
      value,
      snapshot: {...closedShape, publicationReceipt: terminalReceipt},
    };
  } finally {
    closeSync(heldFinalSnapshot.descriptor);
  }
}

export function readCommittedDirectorPlanSnapshot(outputPath) {
  return consumeCommittedDirectorPlanSnapshot(
    outputPath,
    (snapshot) => snapshot,
    {phase: 'read-committed-return'},
  ).snapshot;
}

export function revalidateCommittedDirectorPlanSnapshot(expectedSnapshot, {
  phase = 'revalidate',
} = {}) {
  const actual = readCommittedDirectorPlanSnapshot(expectedSnapshot?.path);
  invariant(
    stableStringify(verifiedFileIdentity(actual)) ===
      stableStringify(verifiedFileIdentity(expectedSnapshot)) &&
      actual.bytes.equals(expectedSnapshot.bytes) &&
      stableStringify(actual.publicationReceipt) ===
        stableStringify(expectedSnapshot.publicationReceipt),
    'DIRECTOR_PLAN_PUBLICATION_SNAPSHOT_DRIFT',
    `${phase}:${expectedSnapshot?.path}`,
  );
  return actual;
}

function ambiguousPublicationError(error, publicationState, paths) {
  if (error?.code === 'DIRECTOR_PLAN_PUBLICATION_STATE_AMBIGUOUS') return error;
  const ambiguous = new Error(
    `DIRECTOR_PLAN_PUBLICATION_STATE_AMBIGUOUS:${error?.code ?? error?.message}`,
    {cause: error},
  );
  ambiguous.code = 'DIRECTOR_PLAN_PUBLICATION_STATE_AMBIGUOUS';
  ambiguous.publicationState = publicationState;
  ambiguous.publicationPaths = paths;
  return ambiguous;
}

function publishDirectorPlanExclusiveCore({
  outputPath,
  bytes,
  revalidate,
  hooks = {},
}) {
  invariant(
    path.isAbsolute(outputPath) && path.normalize(outputPath) === outputPath,
    'DIRECTOR_OUTPUT_PATH_INVALID',
    outputPath,
  );
  invariant(Buffer.isBuffer(bytes) && bytes.length > 0, 'DIRECTOR_OUTPUT_BYTES_INVALID');
  invariant(typeof revalidate === 'function', 'DIRECTOR_OUTPUT_REVALIDATE_REQUIRED');
  const directoryPath = path.dirname(outputPath);
  const paths = deriveDirectorPlanPublicationPaths(outputPath, bytes);
  let outputDirectory;
  let journalRoot;
  let outputJournal;
  let stageDescriptor;
  let stageIdentity;
  let finalLinked = false;
  let committedLinked = false;
  try {
    outputDirectory = openBoundDirectory(directoryPath, {phase: 'publisher-open-output'});
    invariant(lstatOrNull(outputPath) === null, 'DIRECTOR_OUTPUT_ALREADY_EXISTS', outputPath);

    journalRoot = ensurePrivateJournalDirectory(paths.journalRoot, {
      parentPath: directoryPath,
      parentDescriptor: outputDirectory.descriptor,
      parentIdentity: outputDirectory.identity,
      expectedDevice: outputDirectory.identity.device,
      phase: 'journal-root',
      hooks,
    });
    outputJournal = ensurePrivateJournalDirectory(paths.outputJournalDirectory, {
      parentPath: paths.journalRoot,
      parentDescriptor: journalRoot.descriptor,
      parentIdentity: journalRoot.identity,
      expectedDevice: outputDirectory.identity.device,
      phase: 'output-journal',
      hooks,
    });
    assertPublicationDirectories({
      paths,
      outputDirectoryDescriptor: outputDirectory.descriptor,
      outputDirectoryIdentity: outputDirectory.identity,
      journalRootDescriptor: journalRoot.descriptor,
      journalRootIdentity: journalRoot.identity,
      outputJournalDescriptor: outputJournal.descriptor,
      outputJournalIdentity: outputJournal.identity,
      phase: 'publisher-journal-open',
    });

    try {
      stageDescriptor = openSync(
        paths.stagePath,
        fsConstants.O_CREAT |
          fsConstants.O_EXCL |
          fsConstants.O_RDWR |
          fsConstants.O_NOFOLLOW,
        0o600,
      );
    } catch (error) {
      if (error?.code === 'EEXIST') {
        invariant(false, 'DIRECTOR_PLAN_PUBLICATION_STAGE_ALREADY_EXISTS', paths.stagePath);
      }
      throw error;
    }
    const openedStat = fstatSync(stageDescriptor);
    invariant(openedStat.isFile(), 'DIRECTOR_PLAN_STAGE_NOT_REGULAR', paths.stagePath);
    stageIdentity = fileIdentity(openedStat);
    try {
      assertPublicationDirectories({
        paths,
        outputDirectoryDescriptor: outputDirectory.descriptor,
        outputDirectoryIdentity: outputDirectory.identity,
        journalRootDescriptor: journalRoot.descriptor,
        journalRootIdentity: journalRoot.identity,
        outputJournalDescriptor: outputJournal.descriptor,
        outputJournalIdentity: outputJournal.identity,
        phase: 'stage-open',
      });
      const stageStat = lstatSync(paths.stagePath);
      invariant(
        stageStat.isFile() &&
          !stageStat.isSymbolicLink() &&
          sameFileIdentity(stageIdentity, stageStat) &&
          (stageStat.mode & 0o7777) === 0o600 &&
          realpathSync(paths.stagePath) === paths.stagePath,
        'DIRECTOR_PLAN_STAGE_OWNERSHIP_INVALID',
        paths.stagePath,
      );

      if (hooks.writeToDescriptor) hooks.writeToDescriptor(stageDescriptor, bytes);
      else writeDescriptorExactly(stageDescriptor, bytes);
      fsyncSync(stageDescriptor);
      const writtenStat = fstatSync(stageDescriptor);
      invariant(
        writtenStat.size === bytes.length && sameFileIdentity(stageIdentity, writtenStat),
        'DIRECTOR_PLAN_STAGE_WRITE_INCOMPLETE',
        `${writtenStat.size}/${bytes.length}`,
      );
      const descriptorReadback = readDescriptorExactly(stageDescriptor, bytes.length);
      invariant(
        descriptorReadback.equals(bytes),
        'DIRECTOR_PLAN_STAGE_READBACK_MISMATCH',
        paths.stagePath,
      );
      fchmodSync(stageDescriptor, 0o400);
      fsyncSync(stageDescriptor);
      assertOwnedPublicationPath({
        filePath: paths.stagePath,
        descriptor: stageDescriptor,
        expectedIdentity: stageIdentity,
        expectedBytes: bytes,
        expectedMode: 0o400,
        phase: 'stage-pre-publish',
      });
      fsyncDirectory(
        paths.outputJournalDirectory,
        outputJournal.descriptor,
        outputJournal.identity,
        'stage-prepared',
        hooks,
      );
      assertPublicationDirectories({
        paths,
        outputDirectoryDescriptor: outputDirectory.descriptor,
        outputDirectoryIdentity: outputDirectory.identity,
        journalRootDescriptor: journalRoot.descriptor,
        journalRootIdentity: journalRoot.identity,
        outputJournalDescriptor: outputJournal.descriptor,
        outputJournalIdentity: outputJournal.identity,
        phase: 'pre-publish',
      });
      invariant(lstatOrNull(outputPath) === null, 'DIRECTOR_OUTPUT_ALREADY_EXISTS', outputPath);
      revalidate('pre-publish');
      assertPublicationDirectories({
        paths,
        outputDirectoryDescriptor: outputDirectory.descriptor,
        outputDirectoryIdentity: outputDirectory.identity,
        journalRootDescriptor: journalRoot.descriptor,
        journalRootIdentity: journalRoot.identity,
        outputJournalDescriptor: outputJournal.descriptor,
        outputJournalIdentity: outputJournal.identity,
        phase: 'post-pre-publish-revalidate',
      });
      assertOwnedPublicationPath({
        filePath: paths.stagePath,
        descriptor: stageDescriptor,
        expectedIdentity: stageIdentity,
        expectedBytes: bytes,
        expectedMode: 0o400,
        phase: 'stage-post-revalidate',
      });
      invariant(lstatOrNull(outputPath) === null, 'DIRECTOR_OUTPUT_ALREADY_EXISTS', outputPath);
      hooks.beforeFinalLink?.(paths);

      try {
        linkSync(paths.stagePath, outputPath);
      } catch (error) {
        if (error?.code === 'EEXIST') {
          invariant(false, 'DIRECTOR_OUTPUT_ALREADY_EXISTS', outputPath);
        }
        throw error;
      }
      finalLinked = true;
      fsyncDirectory(
        directoryPath,
        outputDirectory.descriptor,
        outputDirectory.identity,
        'final-linked',
        hooks,
      );
      hooks.afterFinalLink?.(paths);
      assertPublicationDirectories({
        paths,
        outputDirectoryDescriptor: outputDirectory.descriptor,
        outputDirectoryIdentity: outputDirectory.identity,
        journalRootDescriptor: journalRoot.descriptor,
        journalRootIdentity: journalRoot.identity,
        outputJournalDescriptor: outputJournal.descriptor,
        outputJournalIdentity: outputJournal.identity,
        phase: 'post-final-link',
      });
      assertOwnedPublicationPath({
        filePath: outputPath,
        descriptor: stageDescriptor,
        expectedIdentity: stageIdentity,
        expectedBytes: bytes,
        expectedMode: 0o400,
        phase: 'final-post-link',
      });
      assertOwnedPublicationPath({
        filePath: paths.stagePath,
        descriptor: stageDescriptor,
        expectedIdentity: stageIdentity,
        expectedBytes: bytes,
        expectedMode: 0o400,
        phase: 'stage-post-link',
      });
      revalidate('post-publish');
      assertPublicationDirectories({
        paths,
        outputDirectoryDescriptor: outputDirectory.descriptor,
        outputDirectoryIdentity: outputDirectory.identity,
        journalRootDescriptor: journalRoot.descriptor,
        journalRootIdentity: journalRoot.identity,
        outputJournalDescriptor: outputJournal.descriptor,
        outputJournalIdentity: outputJournal.identity,
        phase: 'post-publish-revalidate',
      });
      assertOwnedPublicationPath({
        filePath: outputPath,
        descriptor: stageDescriptor,
        expectedIdentity: stageIdentity,
        expectedBytes: bytes,
        expectedMode: 0o400,
        phase: 'final-post-revalidate',
      });
      assertOwnedPublicationPath({
        filePath: paths.stagePath,
        descriptor: stageDescriptor,
        expectedIdentity: stageIdentity,
        expectedBytes: bytes,
        expectedMode: 0o400,
        phase: 'stage-post-revalidate',
      });
      hooks.beforeCommitLink?.(paths);
      try {
        linkSync(paths.stagePath, paths.committedPath);
      } catch (error) {
        if (error?.code === 'EEXIST') {
          invariant(
            false,
            'DIRECTOR_PLAN_PUBLICATION_COMMIT_ALREADY_EXISTS',
            paths.committedPath,
          );
        }
        throw error;
      }
      committedLinked = true;
      hooks.afterCommitLink?.(paths);
      assertPublicationDirectories({
        paths,
        outputDirectoryDescriptor: outputDirectory.descriptor,
        outputDirectoryIdentity: outputDirectory.identity,
        journalRootDescriptor: journalRoot.descriptor,
        journalRootIdentity: journalRoot.identity,
        outputJournalDescriptor: outputJournal.descriptor,
        outputJournalIdentity: outputJournal.identity,
        phase: 'post-commit-link',
      });
      for (const [label, filePath] of [
        ['stage', paths.stagePath],
        ['final', paths.outputPath],
        ['committed', paths.committedPath],
      ]) {
        assertOwnedPublicationPath({
          filePath,
          descriptor: stageDescriptor,
          expectedIdentity: stageIdentity,
          expectedBytes: bytes,
          expectedMode: 0o400,
          phase: `${label}-post-commit-link`,
        });
      }
      fsyncDirectory(
        paths.outputJournalDirectory,
        outputJournal.descriptor,
        outputJournal.identity,
        'journal-committed',
        hooks,
      );
      assertPublicationDirectories({
        paths,
        outputDirectoryDescriptor: outputDirectory.descriptor,
        outputDirectoryIdentity: outputDirectory.identity,
        journalRootDescriptor: journalRoot.descriptor,
        journalRootIdentity: journalRoot.identity,
        outputJournalDescriptor: outputJournal.descriptor,
        outputJournalIdentity: outputJournal.identity,
        phase: 'publication-terminal',
      });
      const receipt = validateDirectorPlanPublicationJournal({
        outputPath,
        expectedBytes: bytes,
      });
      invariant(
        receipt.device === stageIdentity.device && receipt.inode === stageIdentity.inode,
        'DIRECTOR_PLAN_PUBLICATION_IDENTITY_MISMATCH',
        outputPath,
      );
      for (const [label, filePath] of [
        ['stage', paths.stagePath],
        ['final', paths.outputPath],
        ['committed', paths.committedPath],
      ]) {
        assertOwnedPublicationPath({
          filePath,
          descriptor: stageDescriptor,
          expectedIdentity: stageIdentity,
          expectedBytes: bytes,
          expectedMode: 0o400,
          phase: `${label}-publication-return`,
        });
      }
      return {
        outputPath,
        sha256: sha256Text(bytes),
        bytes: bytes.length,
        device: stageIdentity.device,
        inode: stageIdentity.inode,
        publicationReceipt: receipt,
      };
    } catch (error) {
      if (
        finalLinked ||
        error?.code === 'DIRECTOR_PLAN_PUBLICATION_DIRECTORY_DRIFT' ||
        error?.code === 'DIRECTOR_PLAN_PUBLICATION_JOURNAL_DIRECTORY_INVALID'
      ) {
        throw ambiguousPublicationError(
          error,
          finalLinked
            ? (committedLinked ? 'commit-linked-ambiguous' : 'linked-uncommitted')
            : 'stage-only-directory-ambiguous',
          paths,
        );
      }
      throw error;
    } finally {
      if (stageDescriptor !== undefined) {
        closeSync(stageDescriptor);
        stageDescriptor = undefined;
      }
    }
  } finally {
    if (outputJournal?.descriptor !== undefined) closeSync(outputJournal.descriptor);
    if (journalRoot?.descriptor !== undefined) closeSync(journalRoot.descriptor);
    if (outputDirectory?.descriptor !== undefined) closeSync(outputDirectory.descriptor);
  }
}

export function publishDirectorPlanExclusive({outputPath, bytes, revalidate}) {
  return publishDirectorPlanExclusiveCore({outputPath, bytes, revalidate});
}

export function publishDirectorPlanExclusiveForTest({
  outputPath,
  bytes,
  revalidate,
  hooks,
}) {
  const temporaryRoot = realpathSync(tmpdir());
  const outputDirectory = realpathSync(path.dirname(outputPath));
  invariant(
    isInside(temporaryRoot, outputDirectory),
    'DIRECTOR_PLAN_PUBLICATION_TEST_PATH_INVALID',
    outputPath,
  );
  return publishDirectorPlanExclusiveCore({outputPath, bytes, revalidate, hooks});
}

function buildCommands({request, repoRoot, outputPath, plan}) {
  const cwd = resolvePath(request.execution.cwd, repoRoot);
  const nodeBinary = resolvePath(request.execution.nodeBinary, repoRoot);
  const validator = resolvePath('skills/koubo-remotion-director/scripts/validate-director-output.mjs', repoRoot);
  const commands = [
    {id: 'validate-plan', cwd, argv: [nodeBinary, validator, '--plan', outputPath, '--request', plan.provenance.requestPath, '--repo-root', repoRoot]},
  ];
  if (plan.executionMode === 'plan-only') return commands;
  const entry = resolvePath(request.execution.entry, repoRoot);
  const remotionCli = resolvePath(request.execution.remotionCli, repoRoot);
  const browserExecutable = resolvePath(request.execution.browserExecutable, repoRoot);
  const abPackager = resolvePath(
    'skills/koubo-remotion-director/scripts/package-and-qa-director-ab.mjs',
    repoRoot,
  );
  const ffmpegBinary = resolvePath(request.execution.ffmpegBinary, repoRoot);
  const ffprobeBinary = resolvePath(request.execution.ffprobeBinary, repoRoot);
  invariant(isInside(repoRoot, cwd) && isInside(repoRoot, entry) && isInside(repoRoot, remotionCli) && isInside(repoRoot, browserExecutable), 'DIRECTOR_EXECUTION_PATH_OUTSIDE_ISOLATED_ROOT');
  const browserArgs = ['--browser-executable', browserExecutable, '--chrome-mode', 'headless-shell', '--bundle-cache=false', '--overwrite=false'];
  commands.push(
    {
      id: 'render-visual-master',
      cwd,
      argv: [
        nodeBinary,
        remotionCli,
        'render',
        entry,
        plan.samplePlan.withSfxComposition,
        plan.samplePlan.outputs.visualMaster,
        '--props',
        outputPath,
        '--public-dir',
        plan.render.publicDir,
        '--codec',
        'h264',
        '--pixel-format',
        'yuv420p',
        '--crf',
        '18',
        '--muted',
        ...browserArgs,
      ],
    },
    {
      id: 'package-and-qa-ab',
      cwd,
      argv: [
        nodeBinary,
        abPackager,
        '--plan',
        outputPath,
        '--visual-master',
        plan.samplePlan.outputs.visualMaster,
        '--output-dir',
        path.dirname(plan.samplePlan.outputs.withSfx),
        '--ffmpeg',
        ffmpegBinary,
        '--ffprobe',
        ffprobeBinary,
        '--receipt',
        plan.samplePlan.outputs.abQaReceipt,
      ],
    },
  );
  for (const still of plan.stillPlan) {
    commands.push({
      id: `render-still-${still.id}`,
      cwd,
      argv: [nodeBinary, remotionCli, 'still', entry, plan.samplePlan.stillComposition, path.join(plan.samplePlan.outputs.stillDirectory, `${still.id}.png`), '--frame', String(still.frame), '--props', outputPath, '--public-dir', plan.render.publicDir, '--image-format', 'png', ...browserArgs],
    });
  }
  return commands;
}

export function compileDirectorPlan(request, options = {}) {
  const repoRoot = path.resolve(options.repoRoot ?? request?.projectRoot ?? defaultRepoRoot);
  const entryIntegrityState = captureExecutionIntegrityAnchorState(request, {repoRoot});
  const entryIntegrityAnchors = entryIntegrityState.anchors;
  const executionMode = request?.execution?.mode;
  const actualRequestPath = options.requestPath ??
    (executionMode === 'plan-only' ? request?.execution?.requestPath : undefined);
  const requestPathFromDisk = resolvePath(actualRequestPath, repoRoot);
  if (executionMode === 'renderable') {
    const declaredExecutionRequestPath = resolvePath(request.execution?.requestPath, repoRoot);
    invariant(
      requestPathFromDisk === declaredExecutionRequestPath,
      'DIRECTOR_REQUEST_ACTUAL_PATH_MISMATCH',
      `${requestPathFromDisk}:${declaredExecutionRequestPath}`,
    );
  }
  const entryRequestSnapshot = options.requestSnapshot ?? readVerifiedJsonSnapshot(
    requestPathFromDisk,
    {jsonErrorCode: 'DIRECTOR_REQUEST_ACTUAL_JSON_INVALID'},
  );
  invariant(
    entryRequestSnapshot.path === requestPathFromDisk &&
      stableStringify(entryRequestSnapshot.value) === stableStringify(request),
    'DIRECTOR_REQUEST_ACTUAL_CONTENT_MISMATCH',
    requestPathFromDisk,
  );
  const requestIsolation = enforceRequestIsolation(request, {
    repoRoot,
    requestPath: actualRequestPath,
    registrySnapshot: entryIntegrityState.fileSnapshots.requestIsolationRegistry,
  });
  invariant(
    options.requestIsolationListPath === undefined,
    'DIRECTOR_REQUEST_ISOLATION_REGISTRY_OVERRIDE_FORBIDDEN',
  );
  invariant(request?.schemaVersion === REQUEST_SCHEMA, 'DIRECTOR_REQUEST_SCHEMA_UNSUPPORTED');
  invariant(request.productionEligible === false, 'DIRECTOR_REQUEST_MUST_BE_CANDIDATE_ONLY');
  invariant(request.status === 'candidate', 'DIRECTOR_REQUEST_STATUS_INVALID');
  invariant(executionMode === 'renderable' || executionMode === 'plan-only', 'DIRECTOR_EXECUTION_MODE_INVALID');
  if (executionMode === 'renderable') {
    nonEmpty(request.execution.ffmpegBinary, 'execution.ffmpegBinary');
    nonEmpty(request.execution.ffprobeBinary, 'execution.ffprobeBinary');
    invariant(
      path.isAbsolute(request.execution.ffmpegBinary) &&
        path.isAbsolute(request.execution.ffprobeBinary),
      'DIRECTOR_EXECUTION_MEDIA_TOOL_PATH_NOT_ABSOLUTE',
    );
  }
  const requestPath = requestPathFromDisk;
  const outputPath = resolvePath(options.outputPath ?? request.execution?.outputPlanPath, repoRoot);
  const fps = request.render.fps;
  invariant(Number.isInteger(fps) && fps > 0, 'DIRECTOR_RENDER_FPS_INVALID');
  invariant(Number.isInteger(request.render.width) && request.render.width > 0, 'DIRECTOR_RENDER_WIDTH_INVALID');
  invariant(Number.isInteger(request.render.height) && request.render.height > 0, 'DIRECTOR_RENDER_HEIGHT_INVALID');
  const durationSeconds = Number((request.media.spoken.sourceOut - request.media.spoken.sourceIn).toFixed(6));
  invariant(durationSeconds >= 20 && durationSeconds <= 30, 'DIRECTOR_SAMPLE_DURATION_OUT_OF_RANGE');
  if (executionMode === 'renderable') {
    invariant(Math.abs(durationSeconds - 30) <= 1e-6, 'DIRECTOR_RENDERABLE_DURATION_NOT_EXACT_30');
  }
  if (request.render.durationSeconds !== undefined) {
    invariant(Math.abs(request.render.durationSeconds - durationSeconds) <= EPSILON, 'DIRECTOR_RENDER_DURATION_MISMATCH');
  }

  validateContinuousRanges(request.captions, durationSeconds, 'captions');
  const transcriptPath = resolvePath(request.authority.transcriptPath, repoRoot);
  const transcript = JSON.parse(readFileSync(transcriptPath, 'utf8'));
  const captionText = normalizeSpokenText(request.captions.map((cue) => cue.text).join(''));
  invariant(captionText.length > 0 && transcriptTextFromJson(transcript).includes(captionText), 'DIRECTOR_CAPTIONS_NOT_IN_AUTHORITY');
  const authorityWindowBinding = validateAuthorityWindow({request, transcript, durationSeconds});

  const scenes = compileScenes(request, durationSeconds, fps);
  validateRequestVisualStateAssets(request, scenes, {
    repoRoot,
    render: request.render,
  });
  for (const scene of scenes) {
    const overlapping = request.captions.filter((cue) => cue.start < scene.end && cue.end > scene.start);
    invariant(normalizeSpokenText(overlapping.map((cue) => cue.text).join('')).includes(normalizeSpokenText(scene.spokenLine)), 'DIRECTOR_SCENE_LINE_NOT_BOUND_TO_CAPTIONS', scene.id);
  }

  const render = {
    width: request.render.width,
    height: request.render.height,
    fps,
    durationSeconds,
    durationInFrames: Math.round(durationSeconds * fps),
    publicDir: request.render.publicDir,
  };
  invariant(path.isAbsolute(render.publicDir), 'DIRECTOR_PUBLIC_DIR_NOT_ABSOLUTE');
  validateRequestSfx(request, durationSeconds);
  const runtimeBindings = validateRuntimeFileContract(request, {repoRoot, render});
  const authorityReceiptBindings = validateAuthorityReceiptDeclarations(
    request,
    scenes,
    repoRoot,
    requestPath,
    entryIntegrityState.fileSnapshots.supervisorAcceptanceRegistry,
  );
  const fileBindings = buildFileBindings(
    request,
    repoRoot,
    render,
    runtimeBindings,
    authorityReceiptBindings,
    requestIsolation,
  );
  const completionLockContext = {
    executionMode,
    durationSeconds,
    requestPath,
    fileBindings,
    visualStateAssets: (request.media.visualStateAssets ?? []).map((item) => ({
      ...item,
      path: resolvePath(item.path, repoRoot),
    })),
  };
  for (const scene of scenes) {
    const requiredStageIds = scene.assemblyStages.map((stage) => stage.id);
    scene.completion = lockedSceneCompletionWindow(
      scene,
      fps,
      requiredStageIds,
      completionLockContext,
    );
  }
  const screenMedia = compileScreenMedia(request, render, scenes, repoRoot);
  const stillPlan = request.stills.map((still) => {
    const frame = Math.round(still.atSeconds * fps);
    invariant(frame >= 0 && frame < render.durationInFrames, 'DIRECTOR_STILL_FRAME_OUT_OF_RANGE', still.id);
    const scene = scenes.find((item) => item.id === still.sceneId);
    invariant(scene, 'DIRECTOR_STILL_SCENE_UNKNOWN', still.id);
    const sceneStartFrame = roundedFrame(scene.start, fps);
    const sceneEndFrame = roundedFrame(scene.end, fps);
    invariant(frame >= sceneStartFrame && frame < sceneEndFrame, 'DIRECTOR_STILL_OUTSIDE_SCENE', still.id);
    invariant(Array.isArray(still.requiredStageIds) && still.requiredStageIds.length > 0, 'DIRECTOR_STILL_REQUIRED_STAGES_EMPTY', still.id);
    const requiredMinimumSettledFrames = sceneCompletionMinimumLockFrames(
      scene,
      fps,
      still.requiredStageIds,
      completionLockContext,
    );
    invariant(
      Number.isInteger(still.minimumSettledFrames) &&
        still.minimumSettledFrames >= requiredMinimumSettledFrames,
      'DIRECTOR_STILL_SETTLED_FRAMES_INSUFFICIENT',
      still.id,
    );
    invariant(new Set(still.requiredStageIds).size === still.requiredStageIds.length, 'DIRECTOR_STILL_REQUIRED_STAGE_DUPLICATE', still.id);
    const completion = lockedSceneCompletionWindow(
      scene,
      fps,
      still.requiredStageIds,
      completionLockContext,
    );
    invariant(completion.availableSettledFrames >= still.minimumSettledFrames, 'DIRECTOR_STILL_SETTLED_WINDOW_INSUFFICIENT', still.id);
    invariant(frame >= completion.actualCompletionFrame && frame < completion.lockEndExclusiveFrame, 'DIRECTOR_STILL_NOT_SETTLED', still.id);
    if (scene.screenPlacements.length > 0) {
      const legalScreenState = screenMedia.screenClips.some((clip) => {
        if (!scene.screenPlacements.some((placement) => placement.clipIds.includes(clip.id))) return false;
        const state = screenClipFrameState(clip, frame, screenMedia.screenExcludedRanges, fps);
        return state.visible && !state.excluded;
      });
      invariant(legalScreenState, 'DIRECTOR_STILL_SCREEN_CONTENT_MISSING', still.id);
    }
    return {
      id: still.id,
      frame,
      sceneId: still.sceneId,
      purpose: still.purpose,
      referenceFrameIds: still.referenceFrameIds ?? [],
      requiredStageIds: [...still.requiredStageIds],
      minimumSettledFrames: still.minimumSettledFrames,
      completion,
    };
  });
  invariant(stillPlan.length >= 3, 'DIRECTOR_STILL_PLAN_INSUFFICIENT');

  const outputDirectory = resolvePath(request.render.outputDirectory, repoRoot);
  const abDeliveryDirectory = path.join(outputDirectory, 'ab-delivery');
  const samplePlan = {
    withSfxComposition: request.execution.compositions.withSfx,
    noSfxComposition: request.execution.compositions.noSfx,
    stillComposition: request.execution.compositions.still,
    outputs: executionMode === 'renderable' ? {
      visualMaster: path.join(outputDirectory, `${request.requestId}-visual-master-muted.mp4`),
      withSfx: path.join(abDeliveryDirectory, 'director-30s-with-sfx.mp4'),
      noSfx: path.join(abDeliveryDirectory, 'director-30s-no-sfx.mp4'),
      abQaReceipt: path.join(abDeliveryDirectory, `${request.requestId}-ab-package-qa-receipt.json`),
      stillDirectory: path.join(outputDirectory, 'stills'),
      contactSheet: path.join(outputDirectory, `${request.requestId}-contact-sheet.png`),
    } : null,
  };
  const plan = {
    schemaVersion: OUTPUT_SCHEMA,
    requestId: safeId(request.requestId, 'requestId'),
    status: 'candidate-awaiting-visible-review',
    productionEligible: false,
    executionMode,
    render,
    media: {
      spoken: {
        path: resolvePath(request.media.spoken.path, repoRoot),
        staticFileName: request.media.spoken.staticFileName,
        sourceIn: request.media.spoken.sourceIn,
        sourceOut: request.media.spoken.sourceOut,
        sha256: request.media.spoken.sha256,
        authoritativeOriginal: {
          path: resolvePath(request.media.spoken.authoritativeOriginal.path, repoRoot),
          sha256: request.media.spoken.authoritativeOriginal.sha256,
        },
      },
      screenClips: screenMedia.screenClips,
      screenExcludedRanges: screenMedia.screenExcludedRanges,
      sfx: (request.media.sfx ?? []).map((item) => ({...item, path: resolvePath(item.path, repoRoot)})),
      visualStateAssets: (request.media.visualStateAssets ?? []).map((item) => ({...item, path: resolvePath(item.path, repoRoot)})),
    },
    captions: request.captions.map((cue) => ({id: cue.id, start: cue.start, end: cue.end, text: cue.text})),
    scenes,
    stillPlan,
    samplePlan,
    commands: [],
    provenance: {
      requestPath,
      requestCanonicalSha256: sha256Text(stableStringify(request)),
      referenceSha256: request.reference.sha256,
      styleSha256: request.style.sha256,
      authorityTranscriptSha256: request.authority.transcriptSha256,
      authorityWindowBinding,
      integrityAnchors: entryIntegrityAnchors,
      fileBindings,
      fileBindingsSha256: sha256Text(stableStringify(fileBindings)),
    },
  };
  plan.commands = buildCommands({request, repoRoot, outputPath, plan});
  const planPayloadSha256 = sha256Text(stableStringify(plan));
  const chainBase = {
    schemaVersion: 'koubo-director-chain/v1',
    requestCanonicalSha256: plan.provenance.requestCanonicalSha256,
    styleSha256: plan.provenance.styleSha256,
    referenceSha256: plan.provenance.referenceSha256,
    authorityTranscriptSha256: plan.provenance.authorityTranscriptSha256,
    fileBindingsSha256: plan.provenance.fileBindingsSha256,
    planPayloadSha256,
  };
  plan.chain = {...chainBase, chainSha256: sha256Text(stableStringify(chainBase))};
  validateDirectorPlanStructure(plan);
  revalidateDirectorPlanPublicationInputs({
    request,
    requestPath,
    plan,
    repoRoot,
    expectedRequestSnapshot: entryRequestSnapshot,
    expectedIntegrityFileSnapshots: entryIntegrityState.fileSnapshots,
    phase: 'compile-return',
  });
  attachDirectorPlanPublicationInputSnapshots(plan, {
    request: entryRequestSnapshot,
    integrityFiles: entryIntegrityState.fileSnapshots,
  });
  return plan;
}

function parseCli(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    values[token.slice(2)] = argv[index + 1];
    index += 1;
  }
  invariant(
    values.request && values.output,
    'DIRECTOR_COMPILE_USAGE',
    '--request <json> --output <json> [--repo-root <path>]',
  );
  return values;
}

async function main() {
  const args = parseCli(process.argv.slice(2));
  const repoRoot = path.resolve(args['repo-root'] ?? defaultRepoRoot);
  const requestPath = resolvePath(args.request, repoRoot);
  const outputPath = resolvePath(args.output, repoRoot);
  const requestSnapshot = readVerifiedJsonSnapshot(requestPath, {
    jsonErrorCode: 'DIRECTOR_REQUEST_ACTUAL_JSON_INVALID',
  });
  const request = requestSnapshot.value;
  const plan = compileDirectorPlan(request, {
    repoRoot,
    requestPath,
    requestSnapshot,
    outputPath,
    requestIsolationListPath: args['request-isolation-list'],
  });
  const publicationSnapshots = plan[PLAN_PUBLICATION_INPUT_SNAPSHOTS];
  invariant(
    publicationSnapshots?.request && publicationSnapshots?.integrityFiles,
    'DIRECTOR_PLAN_PUBLICATION_INPUT_SNAPSHOTS_MISSING',
  );
  const planBytes = Buffer.from(`${JSON.stringify(plan, null, 2)}\n`);
  const publication = publishDirectorPlanExclusive({
    outputPath,
    bytes: planBytes,
    revalidate: (publicationPhase) => revalidateDirectorPlanPublicationInputs({
      request,
      requestPath,
      plan,
      repoRoot,
      expectedRequestSnapshot: publicationSnapshots.request,
      expectedIntegrityFileSnapshots: publicationSnapshots.integrityFiles,
      phase: publicationPhase === 'pre-publish' ? 'cli-pre-write' : 'cli-post-write',
    }),
  });
  process.stdout.write(`${JSON.stringify({
    ok: true,
    outputPath,
    chainSha256: plan.chain.chainSha256,
    publicationReceipt: publication.publicationReceipt,
  })}\n`);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  main().catch((error) => {
    process.stderr.write(`${error.code ?? 'DIRECTOR_COMPILE_FAILED'}: ${error.message}\n`);
    process.exitCode = 1;
  });
}
