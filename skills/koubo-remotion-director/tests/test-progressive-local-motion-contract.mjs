#!/usr/bin/env node

import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {deflateSync} from 'node:zlib';
import Ajv2020 from '../assets/schema-validator-engine.mjs';
import {
  MOTION_POSE_PROFILE,
  compileProgressiveLocalMotion,
  inspectMotionPosePng,
  requestSemanticSha256,
  validateMotionPoseAssetContract,
} from '../scripts/compile-director-plan.mjs';
import {validateProgressiveLocalMotionContract} from '../scripts/validate-director-output.mjs';

const testPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(testPath), '../../..');
const render = {width: 1920, height: 1080};
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function expectCode(code, callback) {
  assert.throws(callback, (error) => error?.code === code, code);
}

function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

const crcTable = (() => {
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

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data = Buffer.alloc(0)) {
  const typeBytes = Buffer.from(type, 'ascii');
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBytes.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length);
  return chunk;
}

function encodeRgbaPng({width, height, rgba, compressionLevel = 9, text}) {
  assert.equal(rgba.length, width * height * 4);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const scanlines = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (1 + width * 4);
    scanlines[rowOffset] = 0;
    rgba.copy(scanlines, rowOffset + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', ihdr),
    ...(text ? [pngChunk('tEXt', Buffer.from(`fixture\0${text}`, 'latin1'))] : []),
    pngChunk('IDAT', deflateSync(scanlines, {level: compressionLevel})),
    pngChunk('IEND'),
  ]);
}

function posePixels(variant, {width = 20, height = 20} = {}) {
  const rgba = Buffer.alloc(width * height * 4);
  const xStart = 3 + (variant % 3);
  const yStart = 3 + (Math.floor(variant / 3) % 3);
  for (let y = yStart; y < yStart + 8; y += 1) {
    for (let x = xStart; x < xStart + 8; x += 1) {
      const offset = (y * width + x) * 4;
      rgba[offset] = 24 + (variant * 29) % 200;
      rgba[offset + 1] = 32 + (variant * 47) % 190;
      rgba[offset + 2] = 40 + (variant * 61) % 180;
      rgba[offset + 3] = 255;
    }
  }
  return rgba;
}

function writePng(filePath, rgba, options = {}) {
  const width = options.width ?? 20;
  const height = options.height ?? 20;
  const bytes = encodeRgbaPng({width, height, rgba, ...options});
  writeFileSync(filePath, bytes);
  return {bytes, sha256: sha256(bytes)};
}

function compile(value, index) {
  return compileProgressiveLocalMotion(value, {
    sceneId: 'scene-a',
    stateId: `a-state-${index}`,
    index,
    render,
  });
}

const authored = {
  model: 'authored-local-stop-motion/v1',
  region: {x: 100, y: 200, width: 20, height: 20},
  poseAssetIds: ['pose-a01-1', 'pose-a01-2', 'pose-a01-3'],
};

assert.deepEqual(compile({model: 'neutral/v1'}, 0), {model: 'neutral/v1'});
assert.deepEqual(compile(authored, 1), authored);
expectCode('DIRECTOR_PROGRESSIVE_LOCAL_MOTION_REQUIRED', () => compile(undefined, 1));
expectCode('DIRECTOR_PROGRESSIVE_LOCAL_MOTION_INITIAL_NOT_NEUTRAL', () =>
  compile(authored, 0));
expectCode('DIRECTOR_PROGRESSIVE_LOCAL_MOTION_AUTHORED_MODEL_REQUIRED', () =>
  compile({model: 'neutral/v1'}, 1));
expectCode('DIRECTOR_PROGRESSIVE_LOCAL_MOTION_FIELDS_INVALID', () =>
  compile({...authored, easing: 'forbidden'}, 1));
expectCode('DIRECTOR_PROGRESSIVE_LOCAL_MOTION_REGION_FIELDS_INVALID', () =>
  compile({...authored, region: {...authored.region, right: 120}}, 1));
expectCode('DIRECTOR_PROGRESSIVE_LOCAL_MOTION_REGION_INVALID', () =>
  compile({...authored, region: {...authored.region, width: 1345}}, 1));
expectCode('DIRECTOR_PROGRESSIVE_LOCAL_MOTION_REGION_INVALID', () =>
  compile({...authored, region: {...authored.region, height: 865}}, 1));
expectCode('DIRECTOR_PROGRESSIVE_LOCAL_MOTION_REGION_INVALID', () =>
  compile({...authored, region: {x: 0, y: 0, width: 1000, height: 800}}, 1));
expectCode('DIRECTOR_PROGRESSIVE_LOCAL_MOTION_REGION_INVALID', () =>
  compile({...authored, region: {...authored.region, width: 20.5}}, 1));
expectCode('DIRECTOR_PROGRESSIVE_LOCAL_MOTION_POSE_ASSET_COUNT_INVALID', () =>
  compile({...authored, poseAssetIds: authored.poseAssetIds.slice(0, 2)}, 1));
expectCode('DIRECTOR_PROGRESSIVE_LOCAL_MOTION_POSE_ASSET_DUPLICATE', () =>
  compile({...authored, poseAssetIds: ['pose-a01-1', 'pose-a01-1', 'pose-a01-3']}, 1));

assert.deepEqual(MOTION_POSE_PROFILE, {
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

const semanticBase = {
  schemaVersion: 'koubo-director-request/v1',
  render,
  semanticBeats: [{
    id: 'scene-a',
    visualization: {
      stateReveal: {
        method: 'progressive-local-assembly',
        states: [{id: 'a-state-1', assetId: 'a-state-full-1', localMotion: authored}],
      },
    },
  }],
};
const semanticPoseChanged = structuredClone(semanticBase);
semanticPoseChanged.semanticBeats[0].visualization.stateReveal.states[0]
  .localMotion.poseAssetIds[2] = 'pose-a01-3-revised';
assert.notEqual(
  requestSemanticSha256(semanticBase),
  requestSemanticSha256(semanticPoseChanged),
  'localMotion must participate in the request semantic hash',
);

const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'director-local-motion-'));
try {
  const poseIds = Array.from({length: 9}, (_, index) =>
    `pose-a${String(Math.floor(index / 3) + 1).padStart(2, '0')}-${index % 3 + 1}`);
  const poseRecords = poseIds.map((id, index) => {
    const filePath = path.join(fixtureRoot, `${id}.png`);
    const rgba = posePixels(index);
    const written = writePng(filePath, rgba);
    return {id, path: filePath, staticFileName: `${id}.png`, rgba, ...written};
  });
  const validInspection = inspectMotionPosePng(poseRecords[0].path);
  assert.equal(validInspection.width, 20);
  assert.equal(validInspection.height, 20);
  assert.equal(validInspection.bitDepth, 8);
  assert.equal(validInspection.colorType, 6);
  assert.equal(validInspection.visiblePixelCount, 64);
  assert.equal(validInspection.fileSha256, poseRecords[0].sha256);
  assert.equal(validInspection.rgbaPixelSha256, sha256(poseRecords[0].rgba));

  const truncatedPath = path.join(fixtureRoot, 'truncated.png');
  writeFileSync(truncatedPath, poseRecords[0].bytes.subarray(0, poseRecords[0].bytes.length - 7));
  expectCode('DIRECTOR_MOTION_POSE_PNG_INVALID', () => inspectMotionPosePng(truncatedPath));

  const transparentPath = path.join(fixtureRoot, 'transparent.png');
  writePng(transparentPath, Buffer.alloc(20 * 20 * 4));
  expectCode('DIRECTOR_MOTION_POSE_PNG_ALPHA_EMPTY_OR_SPARSE', () =>
    inspectMotionPosePng(transparentPath));

  const edgePixels = posePixels(20);
  edgePixels[3] = 255;
  const edgePath = path.join(fixtureRoot, 'opaque-edge.png');
  writePng(edgePath, edgePixels);
  expectCode('DIRECTOR_MOTION_POSE_PNG_ALPHA_BORDER_NOT_TRANSPARENT', () =>
    inspectMotionPosePng(edgePath));

  const denseWidth = 200;
  const denseHeight = 200;
  const densePixels = Buffer.alloc(denseWidth * denseHeight * 4);
  for (let y = 2; y < denseHeight - 2; y += 1) {
    for (let x = 2; x < denseWidth - 2; x += 1) {
      const offset = (y * denseWidth + x) * 4;
      densePixels[offset] = 90;
      densePixels[offset + 1] = 120;
      densePixels[offset + 2] = 150;
      densePixels[offset + 3] = 255;
    }
  }
  const densePath = path.join(fixtureRoot, 'excessive-alpha-coverage.png');
  writePng(densePath, densePixels, {width: denseWidth, height: denseHeight});
  expectCode('DIRECTOR_MOTION_POSE_PNG_ALPHA_COVERAGE_EXCESSIVE', () =>
    inspectMotionPosePng(densePath));

  const nonBinaryPixels = posePixels(21);
  nonBinaryPixels[(5 * 20 + 5) * 4 + 3] = 128;
  const nonBinaryPath = path.join(fixtureRoot, 'non-binary-alpha.png');
  writePng(nonBinaryPath, nonBinaryPixels);
  expectCode('DIRECTOR_MOTION_POSE_PNG_ALPHA_NON_BINARY', () =>
    inspectMotionPosePng(nonBinaryPath));

  const authoredForState = (stateIndex) => ({
    model: 'authored-local-stop-motion/v1',
    region: {x: 100, y: 200, width: 20, height: 20},
    poseAssetIds: poseIds.slice((stateIndex - 1) * 3, stateIndex * 3),
  });
  const assets = [
    {id: 'full-a00', path: poseRecords[0].path, staticFileName: 'full-a00.png', sha256: '0'.repeat(64), role: 'base-state'},
    {id: 'full-a01', path: poseRecords[0].path, staticFileName: 'full-a01.png', sha256: '1'.repeat(64), role: 'revealed-state'},
    {id: 'full-a02', path: poseRecords[0].path, staticFileName: 'full-a02.png', sha256: '2'.repeat(64), role: 'revealed-state'},
    {id: 'full-a03', path: poseRecords[0].path, staticFileName: 'full-a03.png', sha256: '3'.repeat(64), role: 'revealed-state'},
    ...poseRecords.map(({id, path: filePath, staticFileName, sha256: fileSha256}) => ({
      id,
      path: filePath,
      staticFileName,
      sha256: fileSha256,
      role: 'motion-pose',
    })),
  ];
  const scene = {
    id: 'scene-a',
    stateReveal: {
      method: 'progressive-local-assembly',
      states: [
        {id: 'a00', assetId: 'full-a00', atFrame: 0, localMotion: {model: 'neutral/v1'}},
        {id: 'a01', assetId: 'full-a01', atFrame: 12, localMotion: authoredForState(1)},
        {id: 'a02', assetId: 'full-a02', atFrame: 24, localMotion: authoredForState(2)},
        {id: 'a03', assetId: 'full-a03', atFrame: 36, localMotion: authoredForState(3)},
      ],
    },
  };
  const validate = (candidateScene = scene, candidateAssets = assets) =>
    validateMotionPoseAssetContract({
      assets: candidateAssets,
      scenes: [candidateScene],
      render,
      resolveAssetPath: (assetPath) => assetPath,
    });
  assert.deepEqual(validate(), {motionPoseIds: poseIds});
  assert.deepEqual(
    validateProgressiveLocalMotionContract(scene, {render}, assets),
    {motionPoseIds: poseIds},
  );

  const wrongDimensions = structuredClone(scene);
  wrongDimensions.stateReveal.states[1].localMotion.region.width = 21;
  expectCode('DIRECTOR_MOTION_POSE_DIMENSIONS_MISMATCH', () => validate(wrongDimensions));

  const wrongInitial = structuredClone(scene);
  wrongInitial.stateReveal.states[0].localMotion = authoredForState(1);
  expectCode('DIRECTOR_MOTION_POSE_INITIAL_NOT_NEUTRAL', () => validate(wrongInitial));

  const wrongRoleAssets = structuredClone(assets);
  wrongRoleAssets.find((asset) => asset.id === poseIds[0]).role = 'revealed-state';
  expectCode('DIRECTOR_MOTION_POSE_ASSET_ROLE_INVALID', () => validate(scene, wrongRoleAssets));

  const authorityBindsPose = structuredClone(scene);
  authorityBindsPose.stateReveal.states[1].assetId = poseIds[0];
  expectCode('DIRECTOR_MOTION_POSE_AUTHORITY_ROLE_INVALID', () =>
    validate(authorityBindsPose));

  const duplicatePose = structuredClone(scene);
  duplicatePose.stateReveal.states[2].localMotion.poseAssetIds[0] = poseIds[0];
  expectCode('DIRECTOR_MOTION_POSE_ASSET_CONSUMED_TWICE', () => validate(duplicatePose));

  const shortPreroll = structuredClone(scene);
  shortPreroll.stateReveal.states[1].atFrame = 9;
  expectCode('DIRECTOR_MOTION_POSE_PREROLL_INSUFFICIENT', () => validate(shortPreroll));

  const oversized = structuredClone(scene);
  oversized.stateReveal.states[1].localMotion.region = {x: 0, y: 0, width: 1000, height: 800};
  expectCode('DIRECTOR_MOTION_POSE_REGION_INVALID', () => validate(oversized));

  const duplicateIdAssets = structuredClone(assets);
  duplicateIdAssets.find((asset) => asset.id === poseIds[1]).id = poseIds[0];
  expectCode('DIRECTOR_MOTION_POSE_ASSET_ID_DUPLICATE', () =>
    validate(scene, duplicateIdAssets));

  const duplicatePathAssets = structuredClone(assets);
  duplicatePathAssets.find((asset) => asset.id === poseIds[1]).path = poseRecords[0].path;
  expectCode('DIRECTOR_MOTION_POSE_ASSET_PATH_DUPLICATE', () =>
    validate(scene, duplicatePathAssets));

  const duplicateStaticNameAssets = structuredClone(assets);
  duplicateStaticNameAssets.find((asset) => asset.id === poseIds[1]).staticFileName =
    poseRecords[0].staticFileName;
  expectCode('DIRECTOR_MOTION_POSE_STATIC_FILE_NAME_DUPLICATE', () =>
    validate(scene, duplicateStaticNameAssets));

  const duplicateBytesAssets = structuredClone(assets);
  const duplicateBytesPath = path.join(fixtureRoot, 'duplicate-bytes.png');
  copyFileSync(poseRecords[0].path, duplicateBytesPath);
  Object.assign(duplicateBytesAssets.find((asset) => asset.id === poseIds[1]), {
    path: duplicateBytesPath,
    sha256: poseRecords[0].sha256,
  });
  expectCode('DIRECTOR_MOTION_POSE_FILE_SHA256_DUPLICATE', () =>
    validate(scene, duplicateBytesAssets));

  const duplicatePixelsAssets = structuredClone(assets);
  const duplicatePixelsPath = path.join(fixtureRoot, 'duplicate-pixels-new-encoding.png');
  const duplicatePixels = writePng(duplicatePixelsPath, poseRecords[0].rgba, {
    compressionLevel: 1,
    text: 'different-encoding',
  });
  assert.notEqual(duplicatePixels.sha256, poseRecords[0].sha256);
  Object.assign(duplicatePixelsAssets.find((asset) => asset.id === poseIds[1]), {
    path: duplicatePixelsPath,
    sha256: duplicatePixels.sha256,
  });
  expectCode('DIRECTOR_MOTION_POSE_RGBA_PIXEL_SHA256_DUPLICATE', () =>
    validate(scene, duplicatePixelsAssets));

  const unusedAssets = structuredClone(assets);
  const unusedPath = path.join(fixtureRoot, 'unused-pose.png');
  const unused = writePng(unusedPath, posePixels(90));
  unusedAssets.push({
    id: 'pose-unused',
    path: unusedPath,
    staticFileName: 'pose-unused.png',
    sha256: unused.sha256,
    role: 'motion-pose',
  });
  expectCode('DIRECTOR_MOTION_POSE_ASSET_UNUSED', () => validate(scene, unusedAssets));

  const truncatedAssets = structuredClone(assets);
  Object.assign(truncatedAssets.find((asset) => asset.id === poseIds[0]), {
    path: truncatedPath,
    sha256: sha256(readFileSync(truncatedPath)),
  });
  expectCode('DIRECTOR_MOTION_POSE_PNG_INVALID', () => validate(scene, truncatedAssets));

  const transparentAssets = structuredClone(assets);
  Object.assign(transparentAssets.find((asset) => asset.id === poseIds[0]), {
    path: transparentPath,
    sha256: sha256(readFileSync(transparentPath)),
  });
  expectCode('DIRECTOR_MOTION_POSE_PNG_ALPHA_EMPTY_OR_SPARSE', () =>
    validate(scene, transparentAssets));

  const edgeAssets = structuredClone(assets);
  Object.assign(edgeAssets.find((asset) => asset.id === poseIds[0]), {
    path: edgePath,
    sha256: sha256(readFileSync(edgePath)),
  });
  expectCode('DIRECTOR_MOTION_POSE_PNG_ALPHA_BORDER_NOT_TRANSPARENT', () =>
    validate(scene, edgeAssets));

  const lowChangeAssets = structuredClone(assets);
  const lowChangePixels = Buffer.from(poseRecords[0].rgba);
  lowChangePixels[(5 * 20 + 5) * 4] = (lowChangePixels[(5 * 20 + 5) * 4] + 20) & 0xff;
  const lowChangePath = path.join(fixtureRoot, 'low-adjacent-change.png');
  const lowChange = writePng(lowChangePath, lowChangePixels);
  Object.assign(lowChangeAssets.find((asset) => asset.id === poseIds[1]), {
    path: lowChangePath,
    sha256: lowChange.sha256,
  });
  expectCode('DIRECTOR_MOTION_POSE_ADJACENT_CHANGE_INSUFFICIENT', () =>
    validate(scene, lowChangeAssets));

  assert.equal(463 - 9, 454, 'A16 authored poses must begin at F454');
  assert.equal(473 - 463, 10, 'A16 authority full state must retain the F463-F472 lock');

  const outputSchema = JSON.parse(readFileSync(
    path.join(repoRoot, 'skills/koubo-remotion-director/templates/director-output.v1.schema.json'),
    'utf8',
  ));
  const ajv = new Ajv2020({allErrors: true, strict: true});
  const validateLocalMotionSchema = ajv.compile({
    $schema: outputSchema.$schema,
    $defs: outputSchema.$defs,
    $ref: '#/$defs/progressiveLocalMotion',
  });
  assert.equal(validateLocalMotionSchema({model: 'neutral/v1'}), true);
  assert.equal(validateLocalMotionSchema(authored), true);
  assert.equal(validateLocalMotionSchema({...authored, easing: 'forbidden'}), false);
  assert.equal(validateLocalMotionSchema({
    ...authored,
    region: {...authored.region, width: 1345},
  }), false);
  assert.equal(validateLocalMotionSchema({
    ...authored,
    region: {...authored.region, height: 865},
  }), false);
  assert.equal(validateLocalMotionSchema({
    ...authored,
    poseAssetIds: authored.poseAssetIds.slice(0, 2),
  }), false);
  assert.equal(validateLocalMotionSchema({model: 'authored-local-stop-motion/v1'}), false);

  const validateVisualAssetSchema = ajv.compile({
    $schema: outputSchema.$schema,
    $defs: outputSchema.$defs,
    $ref: '#/$defs/visualStateAsset',
  });
  assert.equal(validateVisualAssetSchema({
    id: 'pose-schema',
    path: '/tmp/pose-schema.png',
    staticFileName: 'pose-schema.png',
    sha256: 'a'.repeat(64),
    role: 'motion-pose',
  }), true);
} finally {
  rmSync(fixtureRoot, {recursive: true, force: true});
}

process.stdout.write(`${JSON.stringify({
  ok: true,
  contract: 'authored-local-stop-motion/v1',
  pngContract: '8-bit-rgba-full-decode',
})}\n`);
