#!/usr/bin/env node

import {copyFileSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {deepStrictEqual} from 'node:assert/strict';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {
  buildDirectorSubprocessEnv,
  buildExpectedIdentitiesForFreezeJob,
  classifyFreezeHits,
  executeFreezeEvidenceWork,
  finalizeFreezeClassification,
  measureAlignedPearson,
  measureEffectiveSignalCoverage,
  measureOutsideWindowDifference,
  packageAndQaDirectorAb,
  parseFreezeDetectLog,
  parseDirectorAbCliArgs,
  planFreezeEvidenceWork,
  revalidateDirectorInputSnapshot,
  runDirectorRestrictedSubprocess,
  buildExpectedSfxMix,
  sha256File,
  sha256Text,
  stableStringify,
  validateFreezeClassificationPlan,
  validateAacStreamContract,
  validateCoverageGate,
  validateCueEnergyQa,
  validateDecodedAudioTailMetrics,
  validateDeliveryTimeline,
  validateExpectedSfxAacIdentity,
  validateExpectedSfxPcmIdentity,
  validateFormalInvocationBinding,
  validateFormalPlanOnlyRecompilePathForTest,
  validateOutsideWindowDifferenceGate,
  measureSfxEffectiveEnvelope,
  validateSfxWindowCoverage,
  validateSpokenFidelityGate,
  validateTimelineMetrics,
} from './package-and-qa-director-ab.mjs';
import {compileDirectorPlan, publishDirectorPlanExclusiveForTest} from './compile-director-plan.mjs';
import {
  DIRECTOR_RUNTIME_COMMON_FILES,
  DIRECTOR_RUNTIME_FILE_CONTRACT_ID,
} from '../assets/remotion-paper-editorial/style.ts';

const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const expectCode = (expectedCode, action) => {
  let actualCode = null;
  try {
    action();
  } catch (error) {
    actualCode = error?.code;
  }
  invariant(actualCode === expectedCode, `expected ${expectedCode}, received ${actualCode}`);
};

const expectCodeAndMessage = (expectedCode, expectedMessage, action) => {
  let actualCode = null;
  let actualMessage = '';
  try {
    action();
  } catch (error) {
    actualCode = error?.code;
    actualMessage = String(error?.message ?? '');
  }
  invariant(actualCode === expectedCode, `expected ${expectedCode}, received ${actualCode}`);
  invariant(
    actualMessage.includes(expectedMessage),
    `expected ${expectedMessage} in failure, received ${actualMessage}`,
  );
};

const stereoSignal = (frames, sample) => {
  const signal = new Float32Array(frames * 2);
  for (let frame = 0; frame < frames; frame += 1) {
    const value = sample(frame);
    signal[frame * 2] = value;
    signal[(frame * 2) + 1] = value;
  }
  return signal;
};

const freezeRgbFrame = ({width, height, region, value = 0, outsideValue = 0, isolated = false}) => {
  const frame = Buffer.alloc(width * height * 3);
  if (value > 0) {
    let written = 0;
    for (let y = region.y + 2; y < region.y + region.height - 2; y += 1) {
      for (let x = region.x + 2; x < region.x + region.width - 2; x += 1) {
        if (isolated && ((x + y) % 3 !== 0)) continue;
        const offset = (y * width + x) * 3;
        frame[offset] = value;
        frame[offset + 1] = value;
        frame[offset + 2] = value;
        written += 1;
        if (written >= 200) break;
      }
      if (written >= 200) break;
    }
  }
  if (outsideValue > 0) {
    for (let y = 70; y < 82; y += 1) {
      for (let x = 70; x < 82; x += 1) {
        const offset = (y * width + x) * 3;
        frame[offset] = outsideValue;
        frame[offset + 1] = outsideValue;
        frame[offset + 2] = outsideValue;
      }
    }
  }
  return frame;
};

const cropFreezeRgbFrame = (frame, width, region) => {
  const cropped = Buffer.alloc(region.area * 3);
  for (let y = 0; y < region.height; y += 1) {
    const start = ((region.y + y) * width + region.x) * 3;
    frame.copy(cropped, y * region.width * 3, start, start + region.width * 3);
  }
  return cropped;
};

const denseRandomFreezeFrame = ({width, height, region, seed}) => {
  const frame = Buffer.alloc(width * height * 3);
  let state = seed >>> 0;
  for (let y = region.y; y < region.y + region.height; y += 1) {
    for (let x = region.x; x < region.x + region.width; x += 1) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      const value = state & 0x80000000 ? 220 : 30;
      const offset = (y * width + x) * 3;
      frame[offset] = value;
      frame[offset + 1] = value;
      frame[offset + 2] = value;
    }
  }
  return frame;
};

const freezeClassifierFixture = ({mode = 'valid', maximumUnchangedFrames = 42, regionSize = 30} = {}) => {
  const width = 100;
  const height = 100;
  const fps = 30;
  const region = {x: 10, y: 10, width: regionSize, height: regionSize, area: regionSize ** 2};
  const events = [
    {id: 'a-state-1:pose-1', sceneId: 'a', stateId: 'a-state-1', assetId: 'pose-1', baseAssetId: 'base-state', targetAssetId: 'state-1', kind: 'authored-pose', poseIndex: 0, frame: 3, holdFrames: 3, region},
    {id: 'a-state-1:pose-2', sceneId: 'a', stateId: 'a-state-1', assetId: 'pose-2', baseAssetId: 'base-state', targetAssetId: 'state-1', kind: 'authored-pose', poseIndex: 1, frame: 6, holdFrames: 3, region},
    {id: 'a-state-1:pose-3', sceneId: 'a', stateId: 'a-state-1', assetId: 'pose-3', baseAssetId: 'base-state', targetAssetId: 'state-1', kind: 'authored-pose', poseIndex: 2, frame: 9, holdFrames: 3, region},
    {id: 'a-state-1:authority-state', sceneId: 'a', stateId: 'a-state-1', assetId: 'state-1', baseAssetId: 'base-state', targetAssetId: 'state-1', kind: 'authority-state', poseIndex: null, frame: 12, holdFrames: null, region},
  ];
  const contract = {
    schema: 'koubo-director-freeze-qa/v2',
    width,
    height,
    fps,
    durationSeconds: 2,
    boundAssets: [
      {id: 'base-state', role: 'base-state', sourcePath: '/fixture/base-state.png', sha256: '1'.repeat(64)},
      {id: 'state-1', role: 'revealed-state', sourcePath: '/fixture/state-1.png', sha256: '2'.repeat(64)},
      {id: 'pose-1', role: 'motion-pose', sourcePath: '/fixture/pose-1.png', sha256: '3'.repeat(64)},
      {id: 'pose-2', role: 'motion-pose', sourcePath: '/fixture/pose-2.png', sha256: '4'.repeat(64)},
      {id: 'pose-3', role: 'motion-pose', sourcePath: '/fixture/pose-3.png', sha256: '5'.repeat(64)},
    ],
    scenes: [
      {id: 'a', type: 'complex-explanation', method: 'progressive-local-assembly', start: 0, end: 1, explainStart: 0, explainEnd: 0.5, eligible: true, maximumUnchangedFrames, events},
      {id: 'b', type: 'occluded-state-reveal', method: 'fully-occluded-hard-cut', start: 1, end: 1.5, eligible: false, events: []},
      {id: 'c', type: 'occluded-state-reveal', method: 'fully-occluded-hard-cut', start: 1.5, end: 2, eligible: false, events: []},
    ],
  };
  const frames = new Map();
  for (let frame = 0; frame <= 15; frame += 1) {
    let value = frame < 3 ? 0 : frame < 6 ? 40 : frame < 9 ? 90 : 140;
    if (mode === 'static') value = 0;
    if (mode === 'timing-drift') value = frame < 4 ? 0 : frame < 7 ? 40 : frame < 10 ? 90 : 140;
    if (mode === 'swapped-pose') value = frame < 3 ? 0 : frame < 6 ? 90 : frame < 9 ? 40 : 140;
    const isolated = mode === 'micro-noise';
    const outsideValue = mode === 'outside-roi' && frame >= 6 && frame < 9
      || mode === 'hold-outside' && frame >= 4
      || mode === 'authority-outside' && frame >= 12
      ? 200
      : 0;
    if (mode === 'dense-random' && frame >= 3) {
      const seed = frame < 6 ? 0x12345678 : frame < 9 ? 0x9abcdef0 : 0x0badc0de;
      frames.set(frame, denseRandomFreezeFrame({width, height, region, seed}));
    } else if (mode === 'pure-color') {
      const pure = Buffer.alloc(width * height * 3);
      for (let y = region.y; y < region.y + region.height; y += 1) {
        for (let x = region.x; x < region.x + region.width; x += 1) {
          const offset = (y * width + x) * 3;
          pure[offset] = value;
          pure[offset + 1] = value;
          pure[offset + 2] = value;
        }
      }
      frames.set(frame, pure);
    } else {
      frames.set(frame, freezeRgbFrame({width, height, region, value, outsideValue, isolated}));
    }
  }
  if (mode === 'hold-random-128') {
    const corrupted = Buffer.from(frames.get(10));
    let changed = 0;
    for (let y = region.y; y < region.y + region.height && changed < 128; y += 1) {
      for (let x = region.x; x < region.x + region.width && changed < 128; x += 1) {
        const offset = (y * width + x) * 3;
        const value = corrupted[offset] < 128 ? 220 : 30;
        corrupted[offset] = value;
        corrupted[offset + 1] = value;
        corrupted[offset + 2] = value;
        changed += 1;
      }
    }
    invariant(changed === 128, 'hold-random-128 fixture did not corrupt exactly 128 pixels');
    frames.set(10, corrupted);
  }
  if (mode === 'hold-neighbor-pose') frames.set(10, Buffer.from(frames.get(6)));
  if (mode === 'hold-pure-color') {
    const corrupted = Buffer.from(frames.get(10));
    for (let y = region.y; y < region.y + region.height; y += 1) {
      for (let x = region.x; x < region.x + region.width; x += 1) {
        const offset = (y * width + x) * 3;
        corrupted[offset] = 200;
        corrupted[offset + 1] = 200;
        corrupted[offset + 2] = 200;
      }
    }
    frames.set(10, corrupted);
  }
  return {contract, frames};
};

const freezeFixtureExpectedIdentities = (fixture) => {
  const scene = fixture.contract.scenes[0];
  const poseEvents = scene.events.filter((event) => event.kind === 'authored-pose');
  const authorityEvent = scene.events.find((event) => event.kind === 'authority-state');
  const crop = (frame) => cropFreezeRgbFrame(fixture.frames.get(frame), fixture.contract.width, authorityEvent.region);
  const base = crop(0);
  const poseFrames = poseEvents.map((event) => crop(event.frame));
  const target = crop(authorityEvent.frame);
  const poseCandidates = [
    {id: 'base-state', frame: base},
    ...poseEvents.map((event, index) => ({id: event.assetId, frame: poseFrames[index]})),
  ];
  const map = new Map();
  poseEvents.forEach((event, index) => map.set(event.id, {
    kind: 'authored-pose',
    expectedBefore: index === 0 ? base : poseFrames[index - 1],
    expectedAfter: poseFrames[index],
    candidates: poseCandidates,
    expectedCandidateId: event.assetId,
    pose3ToTargetAssetPsnrDb: null,
    boundAssetEvidence: {fixture: true},
  }));
  map.set(authorityEvent.id, {
    kind: 'authority-state',
    expectedFrame: target,
    candidates: [
      {id: 'base-state', frame: base},
      ...poseEvents.slice(0, -1).map((event, index) => ({id: event.assetId, frame: poseFrames[index]})),
      {id: authorityEvent.assetId, frame: target},
    ],
    expectedCandidateId: authorityEvent.assetId,
    pose3ToTargetAssetPsnrDb: null,
    boundAssetEvidence: {fixture: true},
  });
  return map;
};

const opaqueRgbaFromRgb = (rgb) => {
  const rgba = Buffer.alloc((rgb.length / 3) * 4);
  for (let rgbOffset = 0, rgbaOffset = 0; rgbOffset < rgb.length; rgbOffset += 3, rgbaOffset += 4) {
    rgba[rgbaOffset] = rgb[rgbOffset];
    rgba[rgbaOffset + 1] = rgb[rgbOffset + 1];
    rgba[rgbaOffset + 2] = rgb[rgbOffset + 2];
    rgba[rgbaOffset + 3] = 255;
  }
  return rgba;
};

const fixtureAssetDecoder = (fixture) => ({asset, pixelFormat}) => {
  if (fixture.assetRgbById?.has(asset.id)) {
    const rgb = fixture.assetRgbById.get(asset.id);
    return pixelFormat === 'rgba' ? opaqueRgbaFromRgb(rgb) : Buffer.from(rgb);
  }
  const eventByAssetId = new Map(fixture.contract.scenes.flatMap((scene) => scene.events ?? []).map((event) => [event.assetId, event]));
  const region = fixture.contract.scenes.flatMap((scene) => scene.events ?? []).find((event) => event.kind === 'authority-state').region;
  const crop = (frame) => cropFreezeRgbFrame(fixture.frames.get(frame), fixture.contract.width, region);
  let rgb;
  if (asset.role === 'base-state') rgb = crop(0);
  else if (asset.role === 'revealed-state') rgb = crop(eventByAssetId.get(asset.id).frame);
  else rgb = crop(eventByAssetId.get(asset.id).frame);
  return pixelFormat === 'rgba' ? opaqueRgbaFromRgb(rgb) : rgb;
};

const containsBuffer = (value, seen = new Set()) => {
  if (Buffer.isBuffer(value)) return true;
  if (value === null || typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  if (value instanceof Map) return [...value.entries()].some(([key, item]) => containsBuffer(key, seen) || containsBuffer(item, seen));
  if (Array.isArray(value)) return value.some((item) => containsBuffer(item, seen));
  return Object.values(value).some((item) => containsBuffer(item, seen));
};

const multiStateFreezeFixture = ({corruptFrame = null} = {}) => {
  const width = 100;
  const height = 100;
  const fps = 30;
  const region = {x: 10, y: 10, width: 12, height: 12, area: 144};
  const stateDefinitions = [
    {stateId: 'state-1', baseAssetId: 'state-0', targetAssetId: 'state-1', poseFrames: [3, 6, 9], authorityFrame: 12, poseValues: [40, 90, 140]},
    {stateId: 'state-2', baseAssetId: 'state-1', targetAssetId: 'state-2', poseFrames: [18, 21, 24], authorityFrame: 27, poseValues: [160, 190, 220]},
  ];
  const events = stateDefinitions.flatMap((state) => [
    ...state.poseFrames.map((frame, poseIndex) => ({
      id: `${state.stateId}:pose-${poseIndex + 1}`,
      sceneId: 'a',
      stateId: state.stateId,
      assetId: `${state.stateId}-pose-${poseIndex + 1}`,
      baseAssetId: state.baseAssetId,
      targetAssetId: state.targetAssetId,
      kind: 'authored-pose',
      poseIndex,
      frame,
      holdFrames: 3,
      region,
    })),
    {
      id: `${state.stateId}:authority-state`,
      sceneId: 'a',
      stateId: state.stateId,
      assetId: state.targetAssetId,
      baseAssetId: state.baseAssetId,
      targetAssetId: state.targetAssetId,
      kind: 'authority-state',
      poseIndex: null,
      frame: state.authorityFrame,
      holdFrames: null,
      region,
    },
  ]);
  const boundAssets = [
    {id: 'state-0', role: 'base-state', sourcePath: '/fixture/state-0.png', sha256: '1'.repeat(64)},
    {id: 'state-1', role: 'revealed-state', sourcePath: '/fixture/state-1.png', sha256: '2'.repeat(64)},
    {id: 'state-2', role: 'revealed-state', sourcePath: '/fixture/state-2.png', sha256: '3'.repeat(64)},
    ...stateDefinitions.flatMap((state, stateIndex) => state.poseFrames.map((_frame, poseIndex) => ({
      id: `${state.stateId}-pose-${poseIndex + 1}`,
      role: 'motion-pose',
      sourcePath: `/fixture/${state.stateId}-pose-${poseIndex + 1}.png`,
      sha256: String(4 + stateIndex * 3 + poseIndex).repeat(64).slice(0, 64),
    }))),
  ];
  const contract = {
    schema: 'koubo-director-freeze-qa/v2',
    width,
    height,
    fps,
    durationSeconds: 2,
    boundAssets,
    scenes: [{
      id: 'a',
      type: 'complex-explanation',
      method: 'progressive-local-assembly',
      start: 0,
      end: 1.5,
      explainStart: 0,
      explainEnd: 1.2,
      eligible: true,
      maximumUnchangedFrames: 42,
      events,
    }],
  };
  const valueAtFrame = (frame) => frame < 3 ? 0
    : frame < 6 ? 40
      : frame < 9 ? 90
        : frame < 18 ? 140
          : frame < 21 ? 160
            : frame < 24 ? 190
              : 220;
  const frames = new Map();
  for (let frame = 0; frame <= 30; frame += 1) frames.set(frame, freezeRgbFrame({width, height, region, value: valueAtFrame(frame)}));
  const assetFrameNumbers = new Map([
    ['state-0', 0],
    ['state-1', 12],
    ['state-2', 27],
    ...stateDefinitions.flatMap((state) => state.poseFrames.map((frame, poseIndex) => [`${state.stateId}-pose-${poseIndex + 1}`, frame])),
  ]);
  const assetRgbById = new Map([...assetFrameNumbers].map(([assetId, frame]) => [assetId, cropFreezeRgbFrame(frames.get(frame), width, region)]));
  if (corruptFrame !== null) {
    const corrupted = Buffer.from(frames.get(corruptFrame));
    let changed = 0;
    for (let y = region.y; y < region.y + region.height && changed < 128; y += 1) {
      for (let x = region.x; x < region.x + region.width && changed < 128; x += 1) {
        const offset = (y * width + x) * 3;
        const value = corrupted[offset] < 128 ? 220 : 30;
        corrupted[offset] = value;
        corrupted[offset + 1] = value;
        corrupted[offset + 2] = value;
        changed += 1;
      }
    }
    invariant(changed === 128, 'multi-state hold corruption did not change 128 pixels');
    frames.set(corruptFrame, corrupted);
  }
  return {contract, frames, assetRgbById, region};
};

const multiStateAssetDecoder = (fixture, callLog = []) => ({asset, pixelFormat, kind}) => {
  callLog.push({assetId: asset.id, kind, pixelFormat});
  const rgb = fixture.assetRgbById.get(asset.id);
  invariant(Buffer.isBuffer(rgb), `missing fixture asset ${asset.id}`);
  return pixelFormat === 'rgba' ? opaqueRgbaFromRgb(rgb) : Buffer.from(rgb);
};

const expectedIdentitiesForWork = (fixture, work, callLog = []) => {
  const combined = new Map();
  for (const job of work.jobs) {
    const built = buildExpectedIdentitiesForFreezeJob({
      contract: fixture.contract,
      job,
      decodeBoundAsset: multiStateAssetDecoder(fixture, callLog),
    });
    for (const [eventId, identity] of built.identities) combined.set(eventId, identity);
  }
  return combined;
};

const boundFreezePlanFixture = (root) => {
  const assetDefinitions = [
    ['state-0', 'base-state'],
    ['state-1', 'revealed-state'],
    ['pose-1', 'motion-pose'],
    ['pose-2', 'motion-pose'],
    ['pose-3', 'motion-pose'],
  ];
  const assets = assetDefinitions.map(([id, role], index) => {
    const filePath = path.join(root, `${id}.png`);
    writeFileSync(filePath, `bound-freeze-asset-${index}\n`, {flag: 'wx'});
    return {id, role, path: filePath, staticFileName: path.basename(filePath), sha256: sha256File(filePath)};
  });
  const bindings = assets.flatMap((asset) => [
    {role: 'visual-state', id: asset.id, path: asset.path, sha256: asset.sha256},
    {role: 'public-media', id: `public-visual-state-${asset.id}`, path: asset.path, sha256: asset.sha256},
  ]);
  return {
    schemaVersion: 'koubo-director-output/v1',
    render: {width: 1920, height: 1080, fps: 30, durationInFrames: 900, durationSeconds: 30},
    media: {visualStateAssets: assets},
    provenance: {fileBindings: bindings},
    scenes: [{
      id: 'a', type: 'complex-explanation', start: 0, end: 2,
      stateReveal: {
        method: 'progressive-local-assembly',
        audit: {windowStartFrame: 0, windowEndFrame: 42, firstChangeFrame: 12, namedEntityStateCount: 2, maximumUnchangedFrames: 30},
        states: [
          {id: 'a-state-0', assetId: 'state-0', atFrame: 0, entityStateId: 'entity-0', localMotion: {model: 'neutral/v1'}},
          {id: 'a-state-1', assetId: 'state-1', atFrame: 12, entityStateId: 'entity-1', localMotion: {model: 'authored-local-stop-motion/v1', region: {x: 10, y: 10, width: 12, height: 12}, poseAssetIds: ['pose-1', 'pose-2', 'pose-3']}},
        ],
        transitions: [{id: 'a-transition', fromStateId: 'a-state-0', toStateId: 'a-state-1', kind: 'visible-discrete-assembly', swapFrame: 12}],
      },
    }],
  };
};

const runFreezeQaUnitGates = () => {
  invariant(parseFreezeDetectLog('').length === 0, 'zero freeze log did not remain empty');
  const parsed = parseFreezeDetectLog('freeze_start: 0\nfreeze_duration: 4.2\nfreeze_end: 4.2\nfreeze_start: 4.2', {durationSeconds: 8.333333});
  invariant(parsed.length === 2 && parsed[0].closedBy === 'freeze_end' && parsed[1].closedBy === 'eof', 'structured freeze/EOF parsing failed');
  expectCode('DIRECTOR_AB_FREEZE_LOG_ORDER_INVALID', () => parseFreezeDetectLog('freeze_end: 1'));
  expectCode('DIRECTOR_AB_FREEZE_LOG_ORDER_INVALID', () => parseFreezeDetectLog('freeze_start: 0\nfreeze_start: 1'));
  expectCode('DIRECTOR_AB_FREEZE_LOG_ORDER_INVALID', () => parseFreezeDetectLog('freeze_start: 1\nfreeze_end: 3\nfreeze_start: 2.5'));
  expectCode('DIRECTOR_AB_FREEZE_LOG_BOUNDS_INVALID', () => parseFreezeDetectLog('freeze_start: 29\nfreeze_end: 31'));
  expectCode('DIRECTOR_AB_FREEZE_LOG_HIT_BELOW_DETECTOR_THRESHOLD', () => parseFreezeDetectLog('freeze_start: 0\nfreeze_end: 1.49'));

  const valid = freezeClassifierFixture();
  const validExpectedIdentities = freezeFixtureExpectedIdentities(valid);
  const zero = classifyFreezeHits({rawHits: [], contract: valid.contract, framesByNumber: new Map()});
  invariant(zero.gateSummary.passed && zero.classifiedHits.length === 0, 'zero-hit freeze classification failed');
  const local = classifyFreezeHits({rawHits: [{start: 0, end: 0.5, duration: 0.5}], contract: valid.contract, framesByNumber: valid.frames, expectedIdentitiesByEvent: validExpectedIdentities});
  invariant(local.gateSummary.passed && local.classifiedHits[0].eventEvidence.length === 4, 'planned A local motion was not explained');
  invariant(local.classifiedHits[0].eventEvidence.filter((event) => event.kind === 'authored-pose').every((event) => event.contentIdentity?.frame?.bestCandidateId === event.assetId && event.contentIdentity?.fullRoi), 'planned A pose did not prove bound-asset frame identity');

  const missingIdentity = classifyFreezeHits({rawHits: [{start: 0, end: 0.5, duration: 0.5}], contract: valid.contract, framesByNumber: valid.frames});
  invariant(!missingIdentity.gateSummary.passed && missingIdentity.gateSummary.failureCodes.includes('bound-asset-content-evidence-missing'), 'missing bound asset content evidence was not rejected');

  for (const [mode, expectedFailure] of [
    ['static', 'planned-roi-change-missing'],
    ['timing-drift', 'pose-hold-timing-drift'],
    ['outside-roi', 'change-outside-declared-roi'],
    ['authority-outside', 'change-outside-declared-roi'],
    ['hold-outside', 'pose-hold-outside-declared-roi'],
    ['micro-noise', 'random-or-incoherent-micro-change'],
    ['dense-random', 'pose-asset-identity-mismatch'],
    ['pure-color', 'pose-asset-identity-mismatch'],
    ['swapped-pose', 'pose-asset-identity-mismatch'],
  ]) {
    const fixture = freezeClassifierFixture({mode});
    const result = classifyFreezeHits({rawHits: [{start: 0, end: 0.5, duration: 0.5}], contract: fixture.contract, framesByNumber: fixture.frames, expectedIdentitiesByEvent: validExpectedIdentities});
    invariant(!result.gateSummary.passed && result.gateSummary.failureCodes.includes(expectedFailure), `${mode} freeze negative was not rejected`);
  }
  const authorityOutsideFixture = freezeClassifierFixture({mode: 'authority-outside'});
  const authorityOutside = classifyFreezeHits({rawHits: [{start: 0, end: 0.5, duration: 0.5}], contract: authorityOutsideFixture.contract, framesByNumber: authorityOutsideFixture.frames, expectedIdentitiesByEvent: validExpectedIdentities});
  const authorityOutsideEvidence = authorityOutside.classifiedHits[0].eventEvidence.find((event) => event.kind === 'authority-state');
  invariant(authorityOutsideEvidence.transition.outsideChangedPixels === 144 && authorityOutsideEvidence.failureCodes.includes('change-outside-declared-roi'), 'authority ROI-external change did not remain explicit failure evidence');
  const holdOutsideFixture = freezeClassifierFixture({mode: 'hold-outside'});
  const holdOutside = classifyFreezeHits({rawHits: [{start: 0, end: 0.5, duration: 0.5}], contract: holdOutsideFixture.contract, framesByNumber: holdOutsideFixture.frames, expectedIdentitiesByEvent: validExpectedIdentities});
  const firstPoseHold = holdOutside.classifiedHits[0].eventEvidence.find((event) => event.poseIndex === 0).holds[0];
  invariant(firstPoseHold.outsideChangedPixels === 144 && !firstPoseHold.passed && holdOutside.gateSummary.failureCodes.includes('pose-hold-outside-declared-roi'), 'pose hold ROI-external change did not remain explicit failure evidence');
  const denseRandomFixture = freezeClassifierFixture({mode: 'dense-random'});
  const denseRandom = classifyFreezeHits({rawHits: [{start: 0, end: 0.5, duration: 0.5}], contract: denseRandomFixture.contract, framesByNumber: denseRandomFixture.frames, expectedIdentitiesByEvent: validExpectedIdentities});
  const denseRandomPose = denseRandom.classifiedHits[0].eventEvidence.find((event) => event.kind === 'authored-pose' && event.transition.roiChangedPixels >= 400);
  invariant(denseRandomPose && denseRandomPose.transition.coherentRatio >= 0.9 && denseRandomPose.failureCodes.includes('pose-asset-identity-mismatch'), 'dense coherent random texture bypassed bound-asset identity');
  const targetAssetDriftIdentities = new Map([...validExpectedIdentities].map(([id, identity]) => [id, {...identity, pose3ToTargetAssetPsnrDb: 40}]));
  const targetAssetDrift = classifyFreezeHits({rawHits: [{start: 0, end: 0.5, duration: 0.5}], contract: valid.contract, framesByNumber: valid.frames, expectedIdentitiesByEvent: targetAssetDriftIdentities});
  invariant(!targetAssetDrift.gateSummary.passed && targetAssetDrift.gateSummary.failureCodes.includes('authority-asset-identity-mismatch'), 'pose3-to-bound-target asset drift was not rejected');

  const smallValid = freezeClassifierFixture({regionSize: 12});
  const smallExpectedIdentities = freezeFixtureExpectedIdentities(smallValid);
  const smallPositive = classifyFreezeHits({rawHits: [{start: 0, end: 0.5, duration: 0.5}], contract: smallValid.contract, framesByNumber: smallValid.frames, expectedIdentitiesByEvent: smallExpectedIdentities});
  invariant(smallPositive.gateSummary.passed, 'formally reachable 12x12 bound pose fixture did not pass');
  for (const mode of ['hold-random-128', 'hold-neighbor-pose', 'hold-pure-color']) {
    const fixture = freezeClassifierFixture({mode, regionSize: 12});
    const result = classifyFreezeHits({rawHits: [{start: 0, end: 0.5, duration: 0.5}], contract: fixture.contract, framesByNumber: fixture.frames, expectedIdentitiesByEvent: smallExpectedIdentities});
    invariant(!result.gateSummary.passed && result.gateSummary.failureCodes.includes('pose-hold-asset-identity-mismatch'), `${mode} hold frame did not fail bound pose identity`);
    const pose3 = result.classifiedHits[0].eventEvidence.find((event) => event.poseIndex === 2);
    invariant(pose3.holds.some((hold) => hold.contentIdentityPassed === false && hold.toFrameContentIdentity), `${mode} hold receipt omitted per-frame identity evidence`);
  }
  const highDensityHoldFixture = freezeClassifierFixture({mode: 'hold-random-128', regionSize: 12});
  const highDensityHold = classifyFreezeHits({rawHits: [{start: 0, end: 0.5, duration: 0.5}], contract: highDensityHoldFixture.contract, framesByNumber: highDensityHoldFixture.frames, expectedIdentitiesByEvent: smallExpectedIdentities});
  const corruptedHold = highDensityHold.classifiedHits[0].eventEvidence.find((event) => event.poseIndex === 2).holds[0];
  invariant(corruptedHold.roiChangedPixels === 128 && corruptedHold.maximumHoldChangedPixels === 2 && !corruptedHold.motionPassed && !corruptedHold.contentIdentityPassed, '12x12 128/144 hold bypass was not closed by both adaptive motion and identity gates');

  const multiClean = multiStateFreezeFixture();
  const exactStartRawHits = [{start: 9 / 30, end: 1, duration: 1 - (9 / 30)}];
  const exactStartWork = planFreezeEvidenceWork({rawHits: exactStartRawHits, contract: multiClean.contract});
  const exactStartIdentities = expectedIdentitiesForWork(multiClean, exactStartWork);
  const exactStartCorruptedFixture = multiStateFreezeFixture({corruptFrame: 10});
  const exactStartCorrupted = classifyFreezeHits({rawHits: exactStartRawHits, contract: exactStartCorruptedFixture.contract, framesByNumber: exactStartCorruptedFixture.frames, expectedIdentitiesByEvent: exactStartIdentities});
  const boundaryPoseCorrupted = exactStartCorrupted.classifiedHits[0].eventEvidence.find((event) => event.eventId === 'state-1:pose-3');
  invariant(!exactStartCorrupted.gateSummary.passed && boundaryPoseCorrupted.transitionEligible === false && boundaryPoseCorrupted.transition === null && boundaryPoseCorrupted.auditedHoldDestinationFrames.join(',') === '10,11' && boundaryPoseCorrupted.failureCodes.includes('pose-hold-asset-identity-mismatch'), 'exact-start pose hold corruption escaped when a later state supplied valid transitions');
  invariant(exactStartCorrupted.classifiedHits[0].eventEvidence.some((event) => event.stateId === 'state-2' && event.kind === 'authored-pose' && event.passed), 'exact-start corruption fixture lacked a later valid state');

  const remainingHoldRawHits = [{start: 10 / 30, end: 1, duration: 1 - (10 / 30)}];
  const remainingHoldWork = planFreezeEvidenceWork({rawHits: remainingHoldRawHits, contract: multiClean.contract});
  const remainingHoldIdentities = expectedIdentitiesForWork(multiClean, remainingHoldWork);
  const remainingHoldCorruptedFixture = multiStateFreezeFixture({corruptFrame: 11});
  const remainingHoldCorrupted = classifyFreezeHits({rawHits: remainingHoldRawHits, contract: remainingHoldCorruptedFixture.contract, framesByNumber: remainingHoldCorruptedFixture.frames, expectedIdentitiesByEvent: remainingHoldIdentities});
  const remainingBoundaryPose = remainingHoldCorrupted.classifiedHits[0].eventEvidence.find((event) => event.eventId === 'state-1:pose-3');
  invariant(!remainingHoldCorrupted.gateSummary.passed && remainingBoundaryPose.transitionEligible === false && remainingBoundaryPose.auditedHoldDestinationFrames.join(',') === '11' && remainingBoundaryPose.holds[0].toFrame === 11 && remainingBoundaryPose.failureCodes.includes('pose-hold-asset-identity-mismatch'), 'raw hit beginning at f+1 skipped the remaining internal hold destination');

  const exactStartClean = classifyFreezeHits({rawHits: exactStartRawHits, contract: multiClean.contract, framesByNumber: multiClean.frames, expectedIdentitiesByEvent: exactStartIdentities});
  const cleanBoundaryPose = exactStartClean.classifiedHits[0].eventEvidence.find((event) => event.eventId === 'state-1:pose-3');
  invariant(exactStartClean.gateSummary.passed && cleanBoundaryPose.passed && cleanBoundaryPose.transitionEligible === false && cleanBoundaryPose.transitionPassed === null && cleanBoundaryPose.holds.length === 2, 'clean exact-start holds were not audited independently from transition eligibility');

  const boundaryOnlyRawHits = [{start: 9 / 30, end: 12 / 30, duration: 3 / 30}];
  const boundaryOnlyWork = planFreezeEvidenceWork({rawHits: boundaryOnlyRawHits, contract: multiClean.contract});
  const boundaryOnly = classifyFreezeHits({rawHits: boundaryOnlyRawHits, contract: multiClean.contract, framesByNumber: multiClean.frames, expectedIdentitiesByEvent: expectedIdentitiesForWork(multiClean, boundaryOnlyWork)});
  invariant(!boundaryOnly.gateSummary.passed && boundaryOnly.gateSummary.failureCodes.includes('no-verified-authored-pose-event') && boundaryOnly.classifiedHits[0].eventEvidence.length === 1 && boundaryOnly.classifiedHits[0].eventEvidence[0].holds.length === 2, 'clean boundary holds incorrectly counted as a verified transition');

  const streamingRawHits = [{start: 0, end: 1, duration: 1}];
  const streamingWork = planFreezeEvidenceWork({rawHits: streamingRawHits, contract: multiClean.contract});
  const decodedFullFrameRgbBytesPerFrame = multiClean.contract.width * multiClean.contract.height * 3;
  const maximumRetainedDecodedFullFrameRgbBytes = 11 * decodedFullFrameRgbBytesPerFrame;
  const maximumPlanRegionAreaPixels = 12 * 12;
  const maximumTheoreticalApplicationBufferBytes = maximumRetainedDecodedFullFrameRgbBytes + (28 * maximumPlanRegionAreaPixels);
  invariant(
    streamingWork.jobs.length === 2
      && streamingWork.resourceBounds.maxFramesPerStateJob === 11
      && streamingWork.resourceBounds.decodedFullFrameRgbBytesPerFrame === decodedFullFrameRgbBytesPerFrame
      && streamingWork.resourceBounds.maximumRetainedDecodedFullFrameRgbBytes === maximumRetainedDecodedFullFrameRgbBytes
      && streamingWork.resourceBounds.maximumPlanRegionAreaPixels === maximumPlanRegionAreaPixels
      && streamingWork.resourceBounds.maximumPerStateRoiWorkingBufferBytes === 28 * maximumPlanRegionAreaPixels
      && streamingWork.resourceBounds.maximumTheoreticalApplicationBufferBytes === maximumTheoreticalApplicationBufferBytes
      && streamingWork.resourceBounds.maximumTheoreticalApplicationBufferBytesFormula === 'maximumRetainedDecodedFullFrameRgbBytes+(28*maximumPlanRegionAreaPixels)'
      && streamingWork.resourceBounds.maximumTheoreticalApplicationBufferBytesScope === 'node-buffer-payloads-retained-by-one-state-evidence-job;excludes-v8-object-overhead-and-ffmpeg-subprocess-memory',
    'streaming resource bounds were not plan-derived or were described as total application memory',
  );
  const mapAdapterResult = classifyFreezeHits({rawHits: streamingRawHits, contract: multiClean.contract, framesByNumber: multiClean.frames, expectedIdentitiesByEvent: expectedIdentitiesForWork(multiClean, streamingWork)});
  const streamingAssetCalls = [];
  const streamed = executeFreezeEvidenceWork({
    work: streamingWork,
    contract: multiClean.contract,
    decodeFramesForJob: (job) => new Map(job.requiredFrames.map((frame) => [frame, Buffer.from(multiClean.frames.get(frame))])),
    buildExpectedIdentitiesForJob: (job) => buildExpectedIdentitiesForFreezeJob({contract: multiClean.contract, job, decodeBoundAsset: multiStateAssetDecoder(multiClean, streamingAssetCalls)}),
  });
  const streamingResult = finalizeFreezeClassification({segments: streamingWork.segments, contract: multiClean.contract, eventEvidenceBySegment: streamed.eventEvidenceBySegment});
  deepStrictEqual(streamingResult, mapAdapterResult, 'Map adapter and state-streaming classification drifted');
  invariant(
    streamed.diagnostics.totalDecodedRgbFrames === streamingWork.jobs.reduce((total, job) => total + job.requiredFrames.length, 0)
      && streamed.diagnostics.peakRetainedRgbFrames === 11
      && streamed.diagnostics.maximumRetainedDecodedFullFrameRgbBytes === maximumRetainedDecodedFullFrameRgbBytes
      && streamed.diagnostics.maximumPlanRegionAreaPixels === maximumPlanRegionAreaPixels
      && streamed.diagnostics.maximumPerStateRoiWorkingBufferBytes === 28 * maximumPlanRegionAreaPixels
      && streamed.diagnostics.maximumTheoreticalApplicationBufferBytes === maximumTheoreticalApplicationBufferBytes
      && streamed.diagnostics.jobBoundaryRetainedRgbFrames.every((count) => count === 0),
    'state streaming retained RGB frames across job boundaries or reported an ambiguous memory bound',
  );
  invariant(streamed.diagnostics.assetDecodeCountsByJob.every((counts) => counts.base === 1 && counts.target === 1 && counts.poses === 3 && counts.total === 5), 'state streaming did not decode exactly base1/target1/pose3 per state');
  invariant(streamingAssetCalls.length === 10 && !containsBuffer(streamed.eventEvidenceBySegment) && !containsBuffer(streamingResult), 'streaming evidence retained asset or RGB buffers');

  let streamingFailure = null;
  try {
    executeFreezeEvidenceWork({
      work: streamingWork,
      contract: multiClean.contract,
      decodeFramesForJob: (job) => new Map(job.requiredFrames.map((frame) => [frame, Buffer.from(multiClean.frames.get(frame))])),
      buildExpectedIdentitiesForJob: () => { throw new Error('synthetic-state-builder-failure'); },
    });
  } catch (error) {
    streamingFailure = error;
  }
  invariant(streamingFailure?.message === 'synthetic-state-builder-failure' && streamingFailure.freezeEvidenceStreamingDiagnostics.jobBoundaryRetainedRgbFrames.at(-1) === 0, 'state streaming did not release RGB frames in exceptional finally path');

  let retainedIdentityMap = null;
  let identityMeasurementFailure = null;
  try {
    executeFreezeEvidenceWork({
      work: streamingWork,
      contract: multiClean.contract,
      decodeFramesForJob: (job) => new Map(job.requiredFrames.map((frame) => [frame, Buffer.from(multiClean.frames.get(frame))])),
      buildExpectedIdentitiesForJob: (job) => {
        const built = buildExpectedIdentitiesForFreezeJob({contract: multiClean.contract, job, decodeBoundAsset: multiStateAssetDecoder(multiClean, [])});
        retainedIdentityMap = built.identities;
        const firstAssignment = job.assignments[0];
        retainedIdentityMap.get(firstAssignment.event.id).expectedAfter = Buffer.alloc(1);
        return built;
      },
    });
  } catch (error) {
    identityMeasurementFailure = error;
  }
  invariant(identityMeasurementFailure?.code === 'DIRECTOR_AB_FREEZE_IDENTITY_BUFFER_INVALID' && retainedIdentityMap?.size === 0 && identityMeasurementFailure.freezeEvidenceStreamingDiagnostics.jobBoundaryRetainedRgbFrames.at(-1) === 0, 'state streaming did not clear expected identity buffers after measurement failure');

  expectCode('DIRECTOR_AB_FREEZE_STREAM_FRAME_SET_INVALID', () => executeFreezeEvidenceWork({
    work: streamingWork,
    contract: multiClean.contract,
    decodeFramesForJob: (job) => new Map([...job.requiredFrames, 99].map((frame) => [frame, Buffer.alloc(multiClean.contract.width * multiClean.contract.height * 3)])),
    buildExpectedIdentitiesForJob: () => new Map(),
  }));
  expectCode('DIRECTOR_AB_FREEZE_STREAM_FRAME_SET_INVALID', () => executeFreezeEvidenceWork({
    work: streamingWork,
    contract: multiClean.contract,
    decodeFramesForJob: (job) => new Map(job.requiredFrames.slice(1).map((frame) => [frame, Buffer.alloc(multiClean.contract.width * multiClean.contract.height * 3)])),
    buildExpectedIdentitiesForJob: () => new Map(),
  }));
  const b = classifyFreezeHits({rawHits: [{start: 1, end: 1.2, duration: 0.2}], contract: valid.contract, framesByNumber: valid.frames});
  invariant(!b.gateSummary.passed && b.gateSummary.failureCodes.includes('scene-or-state-reveal-not-eligible'), 'B hard-cut freeze was not rejected');
  const c = classifyFreezeHits({rawHits: [{start: 1.5, end: 1.8, duration: 0.3}], contract: valid.contract, framesByNumber: valid.frames});
  invariant(!c.gateSummary.passed, 'C hard-cut freeze was not rejected');
  const exactBoundary = classifyFreezeHits({rawHits: [{start: 0.4, end: 0.5, duration: 0.1}], contract: valid.contract, framesByNumber: valid.frames, expectedIdentitiesByEvent: validExpectedIdentities});
  invariant(!exactBoundary.gateSummary.passed && exactBoundary.gateSummary.failureCodes.includes('no-planned-local-motion-event') && exactBoundary.classifiedHits[0].eventEvidence.every((event) => event.kind !== 'authority-state'), 'authority transition at freeze start boundary incorrectly explained the hit');
  const cross = classifyFreezeHits({rawHits: [{start: 0.4, end: 1.1, duration: 0.7}], contract: valid.contract, framesByNumber: valid.frames, expectedIdentitiesByEvent: validExpectedIdentities});
  invariant(!cross.gateSummary.passed && cross.classifiedHits.length === 3, 'cross-boundary residual freeze was not split and rejected');
  const lateA = classifyFreezeHits({rawHits: [{start: 0.6, end: 0.8, duration: 0.2}], contract: valid.contract, framesByNumber: valid.frames});
  invariant(!lateA.gateSummary.passed, 'A freeze outside bound audit window was not rejected');
  const gapFixture = freezeClassifierFixture({maximumUnchangedFrames: 4});
  const gap = classifyFreezeHits({rawHits: [{start: 0, end: 0.5, duration: 0.5}], contract: gapFixture.contract, framesByNumber: gapFixture.frames, expectedIdentitiesByEvent: validExpectedIdentities});
  invariant(!gap.gateSummary.passed && gap.gateSummary.failureCodes.includes('actual-maximum-gap-exceeds-plan'), 'actual max gap did not stay bounded by plan');

  const root = mkdtempSync(path.join(os.tmpdir(), 'director-freeze-plan-test-'));
  try {
    const plan = boundFreezePlanFixture(root);
    const contract = validateFreezeClassificationPlan(plan);
    invariant(contract.boundAssets.length === 5 && contract.scenes[0].events.length === 4, 'bound freeze plan positive failed');
    const missingBinding = structuredClone(plan);
    missingBinding.provenance.fileBindings = missingBinding.provenance.fileBindings.filter((item) => !(item.role === 'visual-state' && item.id === 'pose-1'));
    expectCode('DIRECTOR_AB_FREEZE_SOURCE_BINDING_INVALID', () => validateFreezeClassificationPlan(missingBinding));
    const shaDrift = structuredClone(plan);
    shaDrift.media.visualStateAssets.find((item) => item.id === 'pose-1').sha256 = '0'.repeat(64);
    shaDrift.provenance.fileBindings.filter((item) => item.id === 'pose-1' || item.id === 'public-visual-state-pose-1').forEach((item) => { item.sha256 = '0'.repeat(64); });
    expectCode('DIRECTOR_AB_FREEZE_ASSET_SHA_MISMATCH', () => validateFreezeClassificationPlan(shaDrift));
    const region = structuredClone(plan);
    region.scenes[0].stateReveal.states[1].localMotion.region = {x: 0, y: 0, width: 1920, height: 400};
    expectCode('DIRECTOR_AB_FREEZE_REGION_INVALID', () => validateFreezeClassificationPlan(region));
    const gapPlan = structuredClone(plan);
    gapPlan.scenes[0].stateReveal.audit.windowEndFrame = 57;
    gapPlan.scenes[0].stateReveal.audit.maximumUnchangedFrames = 45;
    expectCode('DIRECTOR_AB_FREEZE_PLAN_GAP_INVALID', () => validateFreezeClassificationPlan(gapPlan));
    const poseTiming = structuredClone(plan);
    poseTiming.scenes[0].stateReveal.states[1].atFrame = 9;
    poseTiming.scenes[0].stateReveal.transitions[0].swapFrame = 9;
    poseTiming.scenes[0].stateReveal.audit.firstChangeFrame = 9;
    poseTiming.scenes[0].stateReveal.audit.maximumUnchangedFrames = 33;
    expectCode('DIRECTOR_AB_FREEZE_POSE_PREROLL_INVALID', () => validateFreezeClassificationPlan(poseTiming));
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
};

const runThresholdUnitGates = () => {
  runFreezeQaUnitGates();
  const aac = {codec_name: 'aac', profile: 'LC', sample_rate: '48000', channels: 2, time_base: '1/48000'};
  validateAacStreamContract(aac);
  expectCode('DIRECTOR_AB_DELIVERY_AUDIO_CODEC_INVALID', () => validateAacStreamContract({...aac, codec_name: 'mp3'}));
  expectCode('DIRECTOR_AB_DELIVERY_AUDIO_PROFILE_INVALID', () => validateAacStreamContract({...aac, profile: 'HE-AAC'}));
  expectCode('DIRECTOR_AB_DELIVERY_AUDIO_SAMPLE_RATE_INVALID', () => validateAacStreamContract({...aac, sample_rate: '44100'}));
  expectCode('DIRECTOR_AB_DELIVERY_AUDIO_CHANNELS_INVALID', () => validateAacStreamContract({...aac, channels: 1}));
  expectCode('DIRECTOR_AB_DELIVERY_AUDIO_TIME_BASE_INVALID', () => validateAacStreamContract({...aac, time_base: '1/90000'}));

  const timelineMedia = {
    format: {start_time: '0.000000'},
    streams: [
      {codec_type: 'video', time_base: '1/90000', start_pts: 0, start_time: '0.000000'},
      {codec_type: 'audio', time_base: '1/48000', start_pts: 0, start_time: '0.000000'},
    ],
  };
  validateTimelineMetrics({
    media: timelineMedia,
    videoFirstPacket: {pts: 0, pts_time: '0.000000'},
    audioFirstPacket: {
      pts: -768,
      pts_time: '-0.016000',
      side_data_list: [{side_data_type: 'Skip Samples', skip_samples: 768}],
    },
  });
  expectCode('DIRECTOR_AB_AUDIO_NEGATIVE_FIRST_PACKET_WITHOUT_SKIP_SAMPLES', () => validateTimelineMetrics({
    media: timelineMedia,
    videoFirstPacket: {pts: 0, pts_time: '0.000000'},
    audioFirstPacket: {pts: -2, pts_time: '-0.000042'},
  }));
  expectCode('DIRECTOR_AB_AUDIO_STREAM_START_PTS_INVALID', () => validateTimelineMetrics({
    media: {...timelineMedia, streams: [timelineMedia.streams[0], {...timelineMedia.streams[1], start_pts: 2}]},
    videoFirstPacket: {pts: 0, pts_time: '0.000000'},
    audioFirstPacket: {pts: 0, pts_time: '0.000000'},
  }));
  expectCode('DIRECTOR_AB_VIDEO_FIRST_PACKET_PTS_INVALID', () => validateTimelineMetrics({
    media: timelineMedia,
    videoFirstPacket: {pts: 2, pts_time: '0.000022'},
    audioFirstPacket: {pts: 0, pts_time: '0.000000'},
  }));

  validateDecodedAudioTailMetrics({decodedSamplesPerChannel: 1441024, codecPaddingPeakDbfs: -81});
  expectCode('DIRECTOR_AB_DELIVERY_AUDIO_DECODE_TOO_SHORT', () => validateDecodedAudioTailMetrics({decodedSamplesPerChannel: 1439999, codecPaddingPeakDbfs: -300}));
  expectCode('DIRECTOR_AB_DELIVERY_AUDIO_TAIL_TOO_LONG', () => validateDecodedAudioTailMetrics({decodedSamplesPerChannel: 1441025, codecPaddingPeakDbfs: -300}));
  expectCode('DIRECTOR_AB_DELIVERY_AUDIO_TAIL_NOT_SILENT', () => validateDecodedAudioTailMetrics({decodedSamplesPerChannel: 1441024, codecPaddingPeakDbfs: -79.99}));

  const frames = 8192;
  const reference = stereoSignal(frames, (frame) => 0.4 * Math.sin((2 * Math.PI * frame) / 97));
  const delayed = stereoSignal(frames, (frame) => frame < 3 ? 0 : reference[(frame - 3) * 2]);
  const aligned = measureAlignedPearson({reference, candidate: delayed, maxDelaySamples: 8, searchStrideFrames: 17});
  validateSpokenFidelityGate(aligned);
  invariant(aligned.candidateOffsetSamples === 3, `delay correction mismatch: ${aligned.candidateOffsetSamples}`);
  const scaled072 = stereoSignal(frames, (frame) => 0.72 * reference[frame * 2]);
  expectCode('DIRECTOR_AB_NO_SFX_SPOKEN_GAIN_FAILED', () => validateSpokenFidelityGate(measureAlignedPearson({reference, candidate: scaled072, maxDelaySamples: 0})));
  const scaled0001 = stereoSignal(frames, (frame) => 0.001 * reference[frame * 2]);
  expectCode('DIRECTOR_AB_NO_SFX_SPOKEN_GAIN_FAILED', () => validateSpokenFidelityGate(measureAlignedPearson({reference, candidate: scaled0001, maxDelaySamples: 0})));
  const nearSilent = stereoSignal(frames, (frame) => 0.0001 * Math.sin((2 * Math.PI * frame) / 97));
  expectCode('DIRECTOR_AB_NO_SFX_SPOKEN_REFERENCE_ENERGY_TOO_LOW', () => validateSpokenFidelityGate(measureAlignedPearson({reference: nearSilent, candidate: nearSilent, maxDelaySamples: 0})));
  const dcShifted = stereoSignal(frames, (frame) => reference[frame * 2] + 0.001);
  expectCode('DIRECTOR_AB_NO_SFX_SPOKEN_DC_OFFSET_FAILED', () => validateSpokenFidelityGate(measureAlignedPearson({reference, candidate: dcShifted, maxDelaySamples: 0})));
  const rmsInflated = stereoSignal(frames, (frame) => reference[frame * 2] + 0.12);
  expectCode('DIRECTOR_AB_NO_SFX_SPOKEN_RMS_RATIO_FAILED', () => validateSpokenFidelityGate(measureAlignedPearson({reference, candidate: rmsInflated, maxDelaySamples: 0})));
  const residualDistorted = stereoSignal(frames, (frame) => reference[frame * 2] + (0.016 * Math.sin((2 * Math.PI * frame) / 71)));
  expectCode('DIRECTOR_AB_NO_SFX_SPOKEN_RESIDUAL_FAILED', () => validateSpokenFidelityGate(measureAlignedPearson({reference, candidate: residualDistorted, maxDelaySamples: 0})));
  const unrelated = stereoSignal(frames, (frame) => 0.4 * Math.sin((2 * Math.PI * frame) / 71));
  const unrelatedMeasurement = measureAlignedPearson({reference, candidate: unrelated, maxDelaySamples: 8, searchStrideFrames: 17});
  expectCode('DIRECTOR_AB_NO_SFX_SPOKEN_CORRELATION_FAILED', () => validateSpokenFidelityGate(unrelatedMeasurement));
  expectCode('DIRECTOR_AB_WITH_SFX_VOICE_CORRELATION_FAILED', () => validateSpokenFidelityGate(unrelatedMeasurement, {correlationMinimum: 0.99, codePrefix: 'DIRECTOR_AB_WITH_SFX_VOICE'}));

  const mostlySilent = stereoSignal(1440000, (frame) => frame < 48000 ? 0.2 * Math.sin((2 * Math.PI * frame) / 83) : 0);
  expectCode('DIRECTOR_AB_SPOKEN_SOURCE_ACTIVE_BLOCKS_FAILED', () => validateCoverageGate(measureEffectiveSignalCoverage({samples: mostlySilent})));
  const narrowMask = new Uint8Array(1440000);
  narrowMask.fill(1, 0, 144000);
  expectCode('DIRECTOR_AB_OUTSIDE_SFX_VOICE_INCLUDED_FRAME_RATIO_FAILED', () => validateCoverageGate(measureEffectiveSignalCoverage({samples: mostlySilent, includeMask: narrowMask}), {
    minimumActiveBlocks: 1,
    minimumActiveBlockRatio: 0,
    minimumIncludedFrameRatio: 0.60,
    codePrefix: 'DIRECTOR_AB_OUTSIDE_SFX_VOICE',
  }));
  expectCode('DIRECTOR_AB_OUTSIDE_SFX_VOICE_ACTIVE_BLOCKS_FAILED', () => validateCoverageGate(measureEffectiveSignalCoverage({samples: mostlySilent}), {
    minimumActiveBlocks: 100,
    minimumActiveBlockRatio: 0.10,
    minimumIncludedFrameRatio: 0.60,
    codePrefix: 'DIRECTOR_AB_OUTSIDE_SFX_VOICE',
  }));
  expectCode('DIRECTOR_AB_SFX_ALLOWED_WINDOWS_TOO_BROAD', () => validateSfxWindowCoverage([{startSample: 0, endSampleExclusive: 1000000}]));

  const silentWith = new Float32Array(1440000 * 2);
  const silentNo = new Float32Array(1440000 * 2);
  const cueSource = stereoSignal(4800, (frame) => 0.2 * Math.sin((2 * Math.PI * frame) / 53));
  const unitPlanInfo = {sfx: [{id: 'unit-sfx', cues: [{id: 'unit-cue', atSeconds: 0, volume: 0.5}]}]};
  const unitSfxSourceQa = {byId: new Map([['unit-sfx', {
    samples: cueSource,
    decodedSamplesPerChannel: 4800,
    envelope: measureSfxEffectiveEnvelope(cueSource),
  }]])};
  const unitExpectedSfx = buildExpectedSfxMix({planInfo: unitPlanInfo, sfxSourceQa: unitSfxSourceQa});
  validateExpectedSfxPcmIdentity({expectedSfx: unitExpectedSfx, withSfx: unitExpectedSfx.samples, noSfx: silentNo});
  validateExpectedSfxAacIdentity({expectedSfx: unitExpectedSfx, withSfx: unitExpectedSfx.samples, noSfx: silentNo});
  validateCueEnergyQa({
    planInfo: unitPlanInfo,
    sfxSourceQa: unitSfxSourceQa,
    expectedSfx: unitExpectedSfx,
    withSfx: unitExpectedSfx.samples,
    noSfx: silentNo,
  });
  expectCode('DIRECTOR_AB_SFX_CUE_OBSERVED_ENERGY_TOO_LOW', () => validateCueEnergyQa({
    planInfo: unitPlanInfo,
    sfxSourceQa: unitSfxSourceQa,
    expectedSfx: unitExpectedSfx,
    withSfx: silentWith,
    noSfx: silentNo,
  }));
  const overLoudCue = new Float32Array(unitExpectedSfx.samples.length);
  for (let index = 0; index < overLoudCue.length; index += 1) overLoudCue[index] = unitExpectedSfx.samples[index] * 2;
  expectCode('DIRECTOR_AB_SFX_CUE_OBSERVED_ENERGY_TOO_HIGH', () => validateCueEnergyQa({
    planInfo: unitPlanInfo,
    sfxSourceQa: unitSfxSourceQa,
    expectedSfx: unitExpectedSfx,
    withSfx: overLoudCue,
    noSfx: silentNo,
  }));
  const wrongCue = new Float32Array(unitExpectedSfx.samples.length);
  for (let frame = 0; frame < 4800; frame += 1) {
    const value = 0.1 * Math.sin((2 * Math.PI * frame) / 71);
    wrongCue[frame * 2] = value;
    wrongCue[(frame * 2) + 1] = value;
  }
  expectCode('DIRECTOR_AB_SFX_CUE_WAVEFORM_CORRELATION_FAILED', () => validateCueEnergyQa({
    planInfo: unitPlanInfo,
    sfxSourceQa: unitSfxSourceQa,
    expectedSfx: unitExpectedSfx,
    withSfx: wrongCue,
    noSfx: silentNo,
  }));
  const cueResidualDistortion = new Float32Array(unitExpectedSfx.samples);
  for (let frame = 0; frame < 4800; frame += 1) {
    const distortion = 0.012 * Math.sin((2 * Math.PI * frame) / 71);
    cueResidualDistortion[frame * 2] += distortion;
    cueResidualDistortion[(frame * 2) + 1] += distortion;
  }
  expectCode('DIRECTOR_AB_SFX_CUE_WAVEFORM_RESIDUAL_FAILED', () => validateCueEnergyQa({
    planInfo: unitPlanInfo,
    sfxSourceQa: unitSfxSourceQa,
    expectedSfx: unitExpectedSfx,
    withSfx: cueResidualDistortion,
    noSfx: silentNo,
  }));
  const quietCuePlan = {sfx: [{id: 'unit-sfx', cues: [{id: 'quiet-cue', atSeconds: 0, volume: 0.005}]}]};
  const quietCueExpected = buildExpectedSfxMix({planInfo: quietCuePlan, sfxSourceQa: unitSfxSourceQa});
  expectCode('DIRECTOR_AB_SFX_CUE_EXPECTED_ENERGY_TOO_LOW', () => validateCueEnergyQa({
    planInfo: quietCuePlan,
    sfxSourceQa: unitSfxSourceQa,
    expectedSfx: quietCueExpected,
    withSfx: quietCueExpected.samples,
    noSfx: silentNo,
  }));
  const scaledExpected = new Float32Array(unitExpectedSfx.samples.length);
  for (let index = 0; index < scaledExpected.length; index += 1) scaledExpected[index] = unitExpectedSfx.samples[index] * 0.72;
  expectCode('DIRECTOR_AB_EXPECTED_SFX_PCM_GAIN_FAILED', () => validateExpectedSfxPcmIdentity({
    expectedSfx: unitExpectedSfx,
    withSfx: scaledExpected,
    noSfx: silentNo,
  }));
  expectCode('DIRECTOR_AB_EXPECTED_SFX_AAC_CORRELATION_FAILED', () => validateExpectedSfxAacIdentity({
    expectedSfx: unitExpectedSfx,
    withSfx: wrongCue,
    noSfx: silentNo,
  }));
  const expectedGain104 = new Float32Array(unitExpectedSfx.samples.length);
  for (let index = 0; index < expectedGain104.length; index += 1) expectedGain104[index] = unitExpectedSfx.samples[index] * 1.04;
  expectCode('DIRECTOR_AB_EXPECTED_SFX_AAC_GAIN_FAILED', () => validateExpectedSfxAacIdentity({
    expectedSfx: unitExpectedSfx,
    withSfx: expectedGain104,
    noSfx: silentNo,
  }));
  const expectedWithDc = new Float32Array(unitExpectedSfx.samples);
  for (let frame = 0; frame < 4800; frame += 1) {
    expectedWithDc[frame * 2] += 0.001;
    expectedWithDc[(frame * 2) + 1] += 0.001;
  }
  expectCode('DIRECTOR_AB_EXPECTED_SFX_AAC_DC_OFFSET_FAILED', () => validateExpectedSfxAacIdentity({
    expectedSfx: unitExpectedSfx,
    withSfx: expectedWithDc,
    noSfx: silentNo,
  }));
  const expectedRmsInflated = new Float32Array(unitExpectedSfx.samples);
  for (let frame = 0; frame < 4800; frame += 1) {
    expectedRmsInflated[frame * 2] += 0.03;
    expectedRmsInflated[(frame * 2) + 1] += 0.03;
  }
  expectCode('DIRECTOR_AB_EXPECTED_SFX_AAC_RMS_RATIO_FAILED', () => validateExpectedSfxAacIdentity({
    expectedSfx: unitExpectedSfx,
    withSfx: expectedRmsInflated,
    noSfx: silentNo,
  }));
  const expectedResidual = new Float32Array(unitExpectedSfx.samples);
  for (let frame = 0; frame < 4800; frame += 1) {
    const distortion = 0.009 * Math.sin((2 * Math.PI * frame) / 71);
    expectedResidual[frame * 2] += distortion;
    expectedResidual[(frame * 2) + 1] += distortion;
  }
  expectCode('DIRECTOR_AB_EXPECTED_SFX_AAC_RESIDUAL_FAILED', () => validateExpectedSfxAacIdentity({
    expectedSfx: unitExpectedSfx,
    withSfx: expectedResidual,
    noSfx: silentNo,
  }));
  expectCode('DIRECTOR_AB_SFX_CUE_TRUNCATED', () => buildExpectedSfxMix({
    planInfo: {sfx: [{id: 'unit-sfx', cues: [{id: 'truncated-cue', atSeconds: 29.95, volume: 0.5}]}]},
    sfxSourceQa: unitSfxSourceQa,
  }));
  const overlongSfx = stereoSignal((2 * 48000) + 100, (frame) => 0.2 * Math.sin((2 * Math.PI * frame) / 53));
  expectCode('DIRECTOR_AB_SFX_EFFECTIVE_DURATION_TOO_LONG', () => measureSfxEffectiveEnvelope(overlongSfx));

  const noSfx = stereoSignal(frames, (frame) => 0.2 * Math.sin((2 * Math.PI * frame) / 83));
  const onlyInsideAllowed = new Float32Array(noSfx);
  for (let frame = 1000; frame < 1200; frame += 1) {
    onlyInsideAllowed[frame * 2] += 0.1;
    onlyInsideAllowed[(frame * 2) + 1] += 0.1;
  }
  validateOutsideWindowDifferenceGate(measureOutsideWindowDifference({
    withSfx: onlyInsideAllowed,
    noSfx,
    allowedWindows: [{startSample: 1000, endSampleExclusive: 1200}],
  }));
  const leakedOutside = new Float32Array(onlyInsideAllowed);
  leakedOutside[4000] += 0.1;
  leakedOutside[4001] += 0.1;
  expectCode('DIRECTOR_AB_SFX_OUTSIDE_WINDOW_RMS_FAILED', () => validateOutsideWindowDifferenceGate(measureOutsideWindowDifference({
    withSfx: leakedOutside,
    noSfx,
    allowedWindows: [{startSample: 1000, endSampleExclusive: 1200}],
  })));
};

const fixturePlanPath = fileURLToPath(new URL('../tests/fixtures/exact30-ab-synthetic-plan.json', import.meta.url));

const command = (executable, args) => {
  const result = spawnSync(executable, args, {
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
    env: {PATH: path.dirname(executable), LANG: 'C', LC_ALL: 'C'},
  });
  invariant(result.status === 0, `fixture command failed: ${executable} ${args.join(' ')}\n${result.stderr}`);
};

const parseArgs = (argv) => {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 2) {
    invariant(argv[index]?.startsWith('--') && argv[index + 1], `invalid argument ${argv[index] ?? ''}`);
    parsed[argv[index].slice(2)] = argv[index + 1];
  }
  return parsed;
};

const sealPlan = (plan) => {
  const sealed = structuredClone(plan);
  delete sealed.chain;
  sealed.provenance.fileBindings = [...sealed.provenance.fileBindings].sort((left, right) =>
    `${left.role}\0${left.id}\0${left.path}`.localeCompare(`${right.role}\0${right.id}\0${right.path}`));
  sealed.provenance.fileBindingsSha256 = sha256Text(stableStringify(sealed.provenance.fileBindings));
  const planPayloadSha256 = sha256Text(stableStringify(sealed));
  const chainBase = {
    schemaVersion: 'koubo-director-chain/v1',
    requestCanonicalSha256: sealed.provenance.requestCanonicalSha256,
    styleSha256: sealed.provenance.styleSha256,
    referenceSha256: sealed.provenance.referenceSha256,
    authorityTranscriptSha256: sealed.provenance.authorityTranscriptSha256,
    fileBindingsSha256: sealed.provenance.fileBindingsSha256,
    planPayloadSha256,
  };
  sealed.chain = {...chainBase, chainSha256: sha256Text(stableStringify(chainBase))};
  return sealed;
};

const binding = (role, id, filePath) => ({role, id, path: filePath, sha256: sha256File(filePath)});

const writePlan = (filePath, plan) => writeFileSync(filePath, `${JSON.stringify(plan, null, 2)}\n`, {flag: 'wx'});

const runFormalSupervisorAnchorEnvGates = () => {
  const packagerPath = fileURLToPath(new URL('./package-and-qa-director-ab.mjs', import.meta.url));
  const skillRoot = path.resolve(path.dirname(packagerPath), '..');
  const repoRoot = path.resolve(skillRoot, '../..');
  const compilerPath = path.join(skillRoot, 'scripts/compile-director-plan.mjs');
  const requestRegistryPath = path.join(skillRoot, 'registries/request-isolation-registry.v1.json');
  const acceptanceRegistryPath = path.join(skillRoot, 'registries/supervisor-acceptance-anchor-registry.v1.json');
  const requestAnchorKey = 'KOUBO_DIRECTOR_REQUEST_ISOLATION_REGISTRY_SHA256';
  const acceptanceAnchorKey = 'KOUBO_DIRECTOR_SUPERVISOR_ACCEPTANCE_REGISTRY_SHA256';
  const correctAnchors = {
    [requestAnchorKey]: sha256File(requestRegistryPath),
    [acceptanceAnchorKey]: sha256File(acceptanceRegistryPath),
  };
  const childSource = [
    `import {enforceRequestIsolation, validateSupervisorAIndependentAcceptanceGate} from ${JSON.stringify(pathToFileURL(compilerPath).href)};`,
    `const repoRoot = ${JSON.stringify(repoRoot)};`,
    "const request = {requestId: 'exact30-supervisor-anchor-env-probe', execution: {mode: 'plan-only'}};",
    "if (process.env.UNRELATED_SECRET_FOR_QA !== undefined) throw new Error('DIRECTOR_AB_UNRELATED_ENV_LEAKED');",
    'const isolation = enforceRequestIsolation(request, {repoRoot});',
    'const acceptance = validateSupervisorAIndependentAcceptanceGate({request, scenes: [], repoRoot});',
    "process.stdout.write(JSON.stringify({isolationAnchor: isolation.listExpectedSha256, acceptanceBindings: acceptance.verifiedBindings.length}));",
  ].join('\n');
  const childArgs = ['--input-type=module', '--eval', childSource];
  const probe = (sourceEnv) => runDirectorRestrictedSubprocess(
    process.execPath,
    childArgs,
    {captureStdout: true, allowFailure: true, sourceEnv},
  );

  const restrictedEnv = buildDirectorSubprocessEnv({
    executable: process.execPath,
    sourceEnv: {...correctAnchors, UNRELATED_SECRET_FOR_QA: 'must-not-cross'},
  });
  invariant(restrictedEnv[requestAnchorKey] === correctAnchors[requestAnchorKey], 'request isolation anchor was not relayed');
  invariant(restrictedEnv[acceptanceAnchorKey] === correctAnchors[acceptanceAnchorKey], 'supervisor acceptance anchor was not relayed');
  invariant(restrictedEnv.UNRELATED_SECRET_FOR_QA === undefined, 'unrelated environment variable leaked');
  invariant(
    Object.keys(restrictedEnv).sort().join(',') === [
      'LANG',
      'LC_ALL',
      'PATH',
      acceptanceAnchorKey,
      requestAnchorKey,
    ].sort().join(','),
    'restricted subprocess environment key set mismatch',
  );

  const positive = probe({...correctAnchors, UNRELATED_SECRET_FOR_QA: 'must-not-cross'});
  invariant(positive.status === 0, `formal anchor relay positive failed: ${positive.stderr.toString('utf8')}`);
  const positiveReceipt = JSON.parse(positive.stdout.toString('utf8'));
  invariant(
    positiveReceipt.isolationAnchor === correctAnchors[requestAnchorKey] && positiveReceipt.acceptanceBindings === 2,
    'formal anchor relay receipt mismatch',
  );

  const negativeCases = [
    {
      id: 'request-anchor-missing',
      sourceEnv: {[acceptanceAnchorKey]: correctAnchors[acceptanceAnchorKey]},
      expectedCode: 'DIRECTOR_REQUEST_ISOLATION_REGISTRY_SHA_REQUIRED',
    },
    {
      id: 'request-anchor-wrong',
      sourceEnv: {...correctAnchors, [requestAnchorKey]: '0'.repeat(64)},
      expectedCode: 'DIRECTOR_REQUEST_ISOLATION_REGISTRY_SHA_MISMATCH',
    },
    {
      id: 'acceptance-anchor-missing',
      sourceEnv: {[requestAnchorKey]: correctAnchors[requestAnchorKey]},
      expectedCode: 'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_REGISTRY_SHA_REQUIRED',
    },
    {
      id: 'acceptance-anchor-wrong',
      sourceEnv: {...correctAnchors, [acceptanceAnchorKey]: '0'.repeat(64)},
      expectedCode: 'DIRECTOR_SUPERVISOR_A_ACCEPTANCE_REGISTRY_SHA_MISMATCH',
    },
    {
      id: 'synthetic-bypass-forbidden',
      sourceEnv: {
        [acceptanceAnchorKey]: correctAnchors[acceptanceAnchorKey],
        KOUBO_DIRECTOR_SYNTHETIC_FIXTURE_FOR_TEST: 'true',
      },
      expectedCode: 'DIRECTOR_REQUEST_ISOLATION_REGISTRY_SHA_REQUIRED',
    },
  ];
  for (const candidate of negativeCases) {
    const result = probe(candidate.sourceEnv);
    const stderr = result.stderr.toString('utf8');
    invariant(result.status !== 0, `${candidate.id} unexpectedly passed`);
    invariant(stderr.includes(candidate.expectedCode), `${candidate.id} wrong failure: ${stderr}`);
  }
  return {
    requestIsolationRegistrySha256: correctAnchors[requestAnchorKey],
    supervisorAcceptanceRegistrySha256: correctAnchors[acceptanceAnchorKey],
    positiveChildStatus: positive.status,
    negativeCaseCount: negativeCases.length,
    unrelatedEnvironmentInherited: false,
  };
};

const withExactSupervisorAnchorEnvironment = (anchors, action) => {
  const previous = Object.fromEntries(
    Object.keys(anchors).map((key) => [key, process.env[key]]),
  );
  try {
    for (const [key, value] of Object.entries(anchors)) process.env[key] = value;
    return action();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
};

const runFormalPlanOnlyRecompilePathGates = ({root}) => {
  const packagePath = fileURLToPath(new URL('./package-and-qa-director-ab.mjs', import.meta.url));
  const skillRoot = path.resolve(path.dirname(packagePath), '..');
  const repoRoot = path.resolve(skillRoot, '../..');
  const validatorPath = path.join(skillRoot, 'scripts/validate-director-output.mjs');
  const compilerPath = path.join(skillRoot, 'scripts/compile-director-plan.mjs');
  const stylePath = path.join(skillRoot, 'references/paper-editorial-style.v1.json');
  const requestRegistryPath = path.join(skillRoot, 'registries/request-isolation-registry.v1.json');
  const acceptanceRegistryPath = path.join(skillRoot, 'registries/supervisor-acceptance-anchor-registry.v1.json');
  const requestAnchorKey = 'KOUBO_DIRECTOR_REQUEST_ISOLATION_REGISTRY_SHA256';
  const acceptanceAnchorKey = 'KOUBO_DIRECTOR_SUPERVISOR_ACCEPTANCE_REGISTRY_SHA256';
  const correctAnchors = {
    [requestAnchorKey]: sha256File(requestRegistryPath),
    [acceptanceAnchorKey]: sha256File(acceptanceRegistryPath),
  };
  const formalRoot = path.join(realpathSync(root), 'formal-plan-only-recompile');
  mkdirSync(formalRoot);
  const publicDir = path.join(formalRoot, 'public');
  mkdirSync(publicDir);
  const requestPath = path.join(formalRoot, 'director-request.v1.json');
  const planPath = path.join(formalRoot, 'director-output.v1.json');
  const referencePath = path.join(formalRoot, 'synthetic-reference.dat');
  const transcriptPath = path.join(formalRoot, 'synthetic-transcript.json');
  const spokenPath = path.join(formalRoot, 'synthetic-spoken-proxy.dat');
  const originalPath = path.join(formalRoot, 'synthetic-spoken-original.dat');
  writeFileSync(referencePath, 'synthetic reference bytes for formal plan-only validation\n', {flag: 'wx'});
  writeFileSync(spokenPath, 'synthetic spoken proxy bytes; never decoded\n', {flag: 'wx'});
  writeFileSync(originalPath, 'synthetic spoken authority bytes; never decoded\n', {flag: 'wx'});

  const lineOne = '合成口播第一段用于验证复杂纸艺解释';
  const lineTwo = '合成口播第二段用于验证单一因果动作';
  const transcript = {
    text: `${lineOne}${lineTwo}`,
    words: [
      {text: lineOne, start: 1, end: 15.8},
      {text: lineTwo, start: 16, end: 30.8},
    ],
  };
  writeFileSync(transcriptPath, `${JSON.stringify(transcript, null, 2)}\n`, {flag: 'wx'});

  const runtimeFiles = DIRECTOR_RUNTIME_COMMON_FILES.map((definition) => {
    const filePath = 'executionField' in definition
      ? process.execPath
      : path.resolve(repoRoot, definition.path);
    return {id: definition.id, path: filePath, sha256: sha256File(filePath)};
  });
  const request = {
    schemaVersion: 'koubo-director-request/v1',
    requestId: 'exact30-formal-recompile-synthetic',
    status: 'candidate',
    productionEligible: false,
    projectRoot: repoRoot,
    reference: {path: referencePath, sha256: sha256File(referencePath)},
    style: {
      id: 'paper-editorial-constructive-narrative-v1',
      path: stylePath,
      sha256: sha256File(stylePath),
    },
    authority: {
      transcriptPath,
      transcriptSha256: sha256File(transcriptPath),
      timelineWindow: {
        start: 1,
        end: 31,
        coordinateSystem: 'authoritative-timeline',
      },
      receipts: [],
      wordTimeToleranceSeconds: 0.35,
    },
    media: {
      spoken: {
        path: spokenPath,
        staticFileName: 'synthetic-spoken-proxy.dat',
        sha256: sha256File(spokenPath),
        sourceIn: 1,
        sourceOut: 31,
        authoritativeOriginal: {
          path: originalPath,
          sha256: sha256File(originalPath),
        },
      },
      screen: null,
      sfx: [],
      visualStateAssets: [],
    },
    captions: [
      {id: 'cue-001', start: 0, end: 15, text: lineOne},
      {id: 'cue-002', start: 15, end: 30, text: lineTwo},
    ],
    semanticBeats: [
      {
        id: 'complex-scene',
        kind: 'complex-explanation',
        start: 0,
        end: 15,
        spokenLine: lineOne,
        cognitiveIncrement: '将一个输入拆为四路证据再汇合',
        visualization: {
          layout: 'converging-workbench',
          camera: 'oblique-top-down',
          layers: 4,
          objectGroups: [
            {id: 'g1', label: '输入', material: '撕边卡纸', visualPrimitive: 'request-tray', visualRole: 'context-input', items: [
              {id: 'n1', label: '问题', role: 'input'},
              {id: 'n2', label: '边界', role: 'constraint'},
            ]},
            {id: 'g2', label: '路径一', material: '打印胶片', visualPrimitive: 'film-reel', visualRole: 'source-channel', items: [
              {id: 'n3', label: '动作一', role: 'action'},
              {id: 'n4', label: '证据一', role: 'evidence'},
            ]},
            {id: 'g3', label: '路径二', material: '折叠地图', visualPrimitive: 'folded-map', visualRole: 'source-channel', items: [
              {id: 'n5', label: '动作二', role: 'action'},
              {id: 'n6', label: '证据二', role: 'evidence'},
            ]},
            {id: 'g4', label: '路径三', material: '压印纸签', visualPrimitive: 'comment-magnifier', visualRole: 'source-channel', items: [
              {id: 'n7', label: '动作三', role: 'action'},
              {id: 'n8', label: '证据三', role: 'evidence'},
            ]},
            {id: 'g6', label: '路径四', material: '纤维纸', visualPrimitive: 'friend-bubble', visualRole: 'source-channel', items: [
              {id: 'n10', label: '动作四', role: 'action'},
              {id: 'n11', label: '证据四', role: 'evidence'},
            ]},
            {id: 'g5', label: '汇合', material: '纸雕托盘', visualPrimitive: 'convergence-tray', visualRole: 'result-convergence', items: [
              {id: 'n9', label: '共同结果', role: 'result'},
            ]},
          ],
          assemblyStages: [
            {id: 's1', atSeconds: 0.2, action: '建立输入', targetIds: ['g1']},
            {id: 's2', atSeconds: 2.2, action: '展开路径一', targetIds: ['g2']},
            {id: 's3', atSeconds: 4.4, action: '展开路径二', targetIds: ['g3']},
            {id: 's4', atSeconds: 6.6, action: '展开路径三', targetIds: ['g4']},
            {id: 's5', atSeconds: 8.8, action: '展开路径四', targetIds: ['g6']},
            {id: 's6', atSeconds: 11, action: '汇入结果', targetIds: ['g5']},
          ],
          relations: [
            {from: 'g1', to: 'g2'},
            {from: 'g1', to: 'g3'},
            {from: 'g1', to: 'g4'},
            {from: 'g1', to: 'g6'},
            {from: 'g2', to: 'g5'},
            {from: 'g3', to: 'g5'},
            {from: 'g4', to: 'g5'},
            {from: 'g6', to: 'g5'},
          ],
        },
      },
      {
        id: 'mechanical-scene',
        kind: 'mechanical-causality',
        start: 15,
        end: 30,
        spokenLine: lineTwo,
        cognitiveIncrement: '用单一动作将输入转成可见证据',
        visualization: {
          layout: 'single-action-machine',
          camera: 'macro-oblique-paper-miniature',
          layers: 4,
          input: {id: 'mechanical-input-node', label: '输入', groupLabel: '输入票据', material: '纤维纸', visualPrimitive: 'answer-tickets', visualRole: 'causal-input'},
          action: {id: 'mechanical-action-node', label: '压下', groupLabel: '动作', material: '瓦楞纸板', visualPrimitive: 'locator-press', visualRole: 'single-causal-action', kind: 'mechanical-action'},
          outputs: [{id: 'mechanical-output-node', label: '结果', visualRole: 'evidence-output'}],
          outputGroupLabel: '输出证据',
          outputMaterial: '照片纸',
          outputVisualPrimitive: 'screen-proof-strip',
          outputVisualRole: 'evidence-output',
          supportGroups: [{
            id: 'mechanical-support',
            label: '承载面',
            material: '厚卡纸',
            visualPrimitive: 'path-base',
            visualRole: 'causal-support',
            items: [{id: 'mechanical-support-node', label: '边界', role: 'support', visualRole: 'causal-support'}],
          }],
          assemblyStages: [
            {id: 'm1', atSeconds: 15.2, action: '输入进入', targetIds: ['mechanical-scene-input', 'mechanical-input-node']},
            {id: 'm2', atSeconds: 20, action: 'mechanical-action', targetIds: ['mechanical-scene-mechanism', 'mechanical-action-node']},
            {id: 'm3', atSeconds: 23, action: '显示结果', targetIds: ['mechanical-scene-output', 'mechanical-output-node']},
            {id: 'm4', atSeconds: 24, action: '锁定承载面', targetIds: ['mechanical-support', 'mechanical-support-node']},
          ],
          relations: [
            {from: 'mechanical-input-node', to: 'mechanical-action-node'},
            {from: 'mechanical-action-node', to: 'mechanical-output-node'},
            {from: 'mechanical-output-node', to: 'mechanical-support'},
          ],
        },
      },
    ],
    stills: [
      {id: 'complex-complete', atSeconds: 13.5, sceneId: 'complex-scene', purpose: '复杂场景完成态', referenceFrameIds: ['synthetic-ref-a'], requiredStageIds: ['s1', 's2', 's3', 's4', 's5', 's6'], minimumSettledFrames: 30},
      {id: 'mechanical-complete', atSeconds: 26.5, sceneId: 'mechanical-scene', purpose: '因果场景完成态', referenceFrameIds: ['synthetic-ref-b'], requiredStageIds: ['m1', 'm2', 'm3', 'm4'], minimumSettledFrames: 30},
      {id: 'sample-complete', atSeconds: 28.5, sceneId: 'mechanical-scene', purpose: '样片锁定态', referenceFrameIds: ['synthetic-ref-c'], requiredStageIds: ['m1', 'm2', 'm3', 'm4'], minimumSettledFrames: 30},
    ],
    render: {
      width: 1920,
      height: 1080,
      fps: 30,
      durationSeconds: 30,
      publicDir,
      outputDirectory: path.join(formalRoot, 'render'),
    },
    execution: {
      mode: 'plan-only',
      runtimeContractId: DIRECTOR_RUNTIME_FILE_CONTRACT_ID,
      requestPath,
      outputPlanPath: planPath,
      cwd: formalRoot,
      nodeBinary: process.execPath,
      integrityAnchors: {
        compiler: {
          path: 'skills/koubo-remotion-director/scripts/compile-director-plan.mjs',
          sha256: sha256File(compilerPath),
        },
        requestIsolationRegistry: {
          path: 'skills/koubo-remotion-director/registries/request-isolation-registry.v1.json',
          sha256: sha256File(requestRegistryPath),
        },
        supervisorAcceptanceRegistry: {
          path: 'skills/koubo-remotion-director/registries/supervisor-acceptance-anchor-registry.v1.json',
          sha256: sha256File(acceptanceRegistryPath),
        },
      },
      compositions: {
        withSfx: 'PaperEditorialDirector-Sample-WithSfx',
        noSfx: 'PaperEditorialDirector-Sample-NoSfx',
        still: 'PaperEditorialDirector-Still',
      },
      runtimeFiles,
    },
  };
  writeFileSync(requestPath, `${JSON.stringify(request, null, 2)}\n`, {flag: 'wx'});
  const plan = withExactSupervisorAnchorEnvironment(correctAnchors, () =>
    compileDirectorPlan(request, {repoRoot, requestPath, outputPath: planPath}));
  publishDirectorPlanExclusiveForTest({
    outputPath: planPath,
    bytes: Buffer.from(`${JSON.stringify(plan, null, 2)}\n`),
    revalidate: () => undefined,
  });

  const positive = validateFormalPlanOnlyRecompilePathForTest({
    planPath,
    requestPath,
    sourceEnv: correctAnchors,
  });
  invariant(positive.result?.ok === true, 'formal plan-only recompile path did not return validator success');
  invariant(positive.result.chainSha256 === plan.chain.chainSha256, 'formal plan-only recompile chain mismatch');
  invariant(positive.validatorPath === validatorPath, 'formal plan-only path did not use authoritative validator');
  invariant(positive.expectedInvocation.compiler.canonicalPath === compilerPath, 'formal plan-only path did not bind authoritative compiler');
  invariant(positive.expectedInvocation.isolatedPlanOnlyTest === true, 'formal plan-only isolation receipt missing');

  const anchorNegativeCases = [
    {id: 'request-missing', sourceEnv: {[acceptanceAnchorKey]: correctAnchors[acceptanceAnchorKey]}, expected: 'DIRECTOR_EXECUTION_INTEGRITY_ANCHOR_REQUEST_ISOLATION_REGISTRY_ENV_SHA_INVALID'},
    {id: 'request-wrong', sourceEnv: {...correctAnchors, [requestAnchorKey]: '0'.repeat(64)}, expected: 'DIRECTOR_EXECUTION_INTEGRITY_ANCHOR_REQUEST_ISOLATION_REGISTRY_REQUEST_ENV_MISMATCH'},
    {id: 'acceptance-missing', sourceEnv: {[requestAnchorKey]: correctAnchors[requestAnchorKey]}, expected: 'DIRECTOR_EXECUTION_INTEGRITY_ANCHOR_SUPERVISOR_ACCEPTANCE_REGISTRY_ENV_SHA_INVALID'},
    {id: 'acceptance-wrong', sourceEnv: {...correctAnchors, [acceptanceAnchorKey]: '0'.repeat(64)}, expected: 'DIRECTOR_EXECUTION_INTEGRITY_ANCHOR_SUPERVISOR_ACCEPTANCE_REGISTRY_REQUEST_ENV_MISMATCH'},
  ];
  for (const candidate of anchorNegativeCases) {
    expectCodeAndMessage(
      'DIRECTOR_AB_AUTHORITATIVE_PLAN_VALIDATION_FAILED',
      candidate.expected,
      () => validateFormalPlanOnlyRecompilePathForTest({
        planPath,
        requestPath,
        sourceEnv: candidate.sourceEnv,
      }),
    );
  }

  expectCode('DIRECTOR_AB_FORMAL_TEST_ENV_KEY_FORBIDDEN', () =>
    validateFormalPlanOnlyRecompilePathForTest({
      planPath,
      requestPath,
      sourceEnv: {...correctAnchors, KOUBO_DIRECTOR_SYNTHETIC_FIXTURE_FOR_TEST: 'true'},
    }));

  const fakeExecutablePath = path.join(formalRoot, 'fake-validator-or-compiler.mjs');
  writeFileSync(fakeExecutablePath, 'process.stdout.write("fake must never execute");\n', {flag: 'wx'});
  const forgedValidatorPlanPath = path.join(formalRoot, 'forged-validator-plan.json');
  const forgedValidatorPlan = structuredClone(plan);
  forgedValidatorPlan.commands[0].argv[1] = fakeExecutablePath;
  forgedValidatorPlan.commands[0].argv[3] = forgedValidatorPlanPath;
  const forgedValidatorBinding = forgedValidatorPlan.provenance.fileBindings.find(
    (item) => item.role === 'runtime' && item.id === 'validator',
  );
  forgedValidatorBinding.path = fakeExecutablePath;
  forgedValidatorBinding.sha256 = sha256File(fakeExecutablePath);
  writePlan(forgedValidatorPlanPath, sealPlan(forgedValidatorPlan));
  expectCode('DIRECTOR_AB_FORMAL_TEST_COMMAND_INVALID', () =>
    validateFormalPlanOnlyRecompilePathForTest({
      planPath: forgedValidatorPlanPath,
      requestPath,
      sourceEnv: correctAnchors,
    }));

  const forgedCompilerPlanPath = path.join(formalRoot, 'forged-compiler-plan.json');
  const forgedCompilerPlan = structuredClone(plan);
  forgedCompilerPlan.commands[0].argv[3] = forgedCompilerPlanPath;
  const forgedCompilerBinding = forgedCompilerPlan.provenance.fileBindings.find(
    (item) => item.role === 'compiler' && item.id === 'compile-director-plan',
  );
  forgedCompilerBinding.path = fakeExecutablePath;
  forgedCompilerBinding.sha256 = sha256File(fakeExecutablePath);
  writePlan(forgedCompilerPlanPath, sealPlan(forgedCompilerPlan));
  expectCode('DIRECTOR_AB_FORMAL_TEST_COMPILER_BINDING_INVALID', () =>
    validateFormalPlanOnlyRecompilePathForTest({
      planPath: forgedCompilerPlanPath,
      requestPath,
      sourceEnv: correctAnchors,
    }));

  const syntheticSchemaPlan = structuredClone(plan);
  syntheticSchemaPlan.schemaVersion = 'koubo-director-ab-synthetic-fixture/v1';
  const syntheticSchemaPlanPath = path.join(formalRoot, 'synthetic-schema-plan.json');
  writePlan(syntheticSchemaPlanPath, sealPlan(syntheticSchemaPlan));
  expectCode('DIRECTOR_AB_FORMAL_PLAN_SCHEMA_INVALID', () =>
    validateFormalPlanOnlyRecompilePathForTest({
      planPath: syntheticSchemaPlanPath,
      requestPath,
      sourceEnv: correctAnchors,
    }));

  expectCode('DIRECTOR_AB_FORMAL_TEST_PATH_FORBIDDEN', () =>
    validateFormalPlanOnlyRecompilePathForTest({
      planPath: packagePath,
      requestPath,
      sourceEnv: correctAnchors,
    }));
  expectCode('DIRECTOR_AB_FORMAL_TEST_OPTIONS_INVALID', () =>
    validateFormalPlanOnlyRecompilePathForTest({
      planPath,
      requestPath,
      sourceEnv: correctAnchors,
      validatorPath: fakeExecutablePath,
    }));

  return {
    positiveValidatorStatus: positive.result.ok,
    chainSha256: positive.result.chainSha256,
    validatorSha256: positive.validatorSha256,
    compilerSha256: positive.expectedInvocation.compiler.sha256,
    sourceIn: plan.media.spoken.sourceIn,
    sourceOut: plan.media.spoken.sourceOut,
    anchorNegativeCaseCount: anchorNegativeCases.length,
    substitutionNegativeCaseCount: 6,
    productionCliTestSwitchExposed: false,
  };
};

const runPrepublishBindingDriftGates = ({
  inputDir,
  planPath,
  visualMasterPath,
  spokenPath,
  sfxPath,
  ffmpeg,
  ffprobe,
}) => {
  const bindingSpecs = [
    ['request-isolation-registry-integrity', 'actual'],
    ['supervisor-acceptance-anchor-registry-integrity', 'actual'],
    ['supervisor-acceptance-receipt', 'supervisor-a'],
    ['compiler', 'compile-director-plan'],
    ['runtime', 'validator'],
    ['runtime', 'node-binary'],
    ['runtime', 'ab-packager'],
  ];
  const bindings = bindingSpecs.map(([role, id], index) => {
    const filePath = path.join(inputDir, `drift-binding-${index}.txt`);
    writeFileSync(filePath, `${role}:${id}:stable\n`, {flag: 'wx'});
    return binding(role, id, filePath);
  });
  const controlPlaneSnapshot = {};
  for (const label of ['request', 'authoritativeValidator', 'nodeBinary', 'packager']) {
    const filePath = path.join(inputDir, `drift-control-${label}.txt`);
    writeFileSync(filePath, `${label}:stable\n`, {flag: 'wx'});
    controlPlaneSnapshot[label] = {path: filePath, sha256: sha256File(filePath)};
  }
  const input = {
    planPath,
    visualMasterPath,
    initialInputSha256: {
      plan: sha256File(planPath),
      visualMaster: sha256File(visualMasterPath),
    },
    planInfo: {
      spoken: {path: spokenPath, sha256: sha256File(spokenPath)},
      sfx: [{id: 'synthetic-paper-tick', path: sfxPath, sha256: sha256File(sfxPath)}],
      integrity: {fileBindings: bindings},
    },
    ffmpeg: {realPath: ffmpeg, sha256: sha256File(ffmpeg)},
    ffprobe: {realPath: ffprobe, sha256: sha256File(ffprobe)},
    controlPlaneSnapshot,
  };
  const positive = revalidateDirectorInputSnapshot(input);
  invariant(positive.passed === true && positive.fileBindingCount === bindings.length, 'prepublish drift positive failed');

  const mutateAndExpect = (snapshot, expectedCode) => {
    const original = readFileSync(snapshot.path);
    writeFileSync(snapshot.path, Buffer.concat([original, Buffer.from('drift\n')]));
    expectCode(expectedCode, () => revalidateDirectorInputSnapshot(input));
    writeFileSync(snapshot.path, original);
    revalidateDirectorInputSnapshot(input);
  };
  for (const bound of bindings) {
    mutateAndExpect(bound, 'DIRECTOR_AB_BOUND_INPUT_CHANGED_DURING_QA');
  }
  for (const control of Object.values(controlPlaneSnapshot)) {
    mutateAndExpect(control, 'DIRECTOR_AB_CONTROL_PLANE_CHANGED_DURING_QA');
  }
  return {
    bindingDriftNegativeCount: bindings.length,
    controlPlaneDriftNegativeCount: Object.keys(controlPlaneSnapshot).length,
    categories: bindings.map(({role, id}) => `${role}:${id}`),
    passed: true,
  };
};

const runFormalInvocationBindingGates = ({
  planPath,
  visualMasterPath,
  outputDirectory,
  receiptPath,
  ffmpeg,
  ffprobe,
  alternateExistingFile,
}) => {
  const packagerPath = fileURLToPath(new URL('./package-and-qa-director-ab.mjs', import.meta.url));
  const testScriptPath = fileURLToPath(import.meta.url);
  const argv = [
    process.execPath,
    packagerPath,
    '--plan',
    planPath,
    '--visual-master',
    visualMasterPath,
    '--output-dir',
    outputDirectory,
    '--ffmpeg',
    ffmpeg,
    '--ffprobe',
    ffprobe,
    '--receipt',
    receiptPath,
  ];
  const formalPlan = {
    commands: [{id: 'package-and-qa-ab', cwd: process.cwd(), argv}],
    provenance: {
      fileBindings: [
        binding('runtime', 'node-binary', process.execPath),
        binding('runtime', 'ab-packager', packagerPath),
        binding('runtime', 'ffmpeg-binary', ffmpeg),
        binding('runtime', 'ffprobe-binary', ffprobe),
      ],
    },
  };
  const invocation = {
    plan: formalPlan,
    planPath,
    visualMasterPath,
    outputDirectory,
    receiptPath,
    ffmpegPath: ffmpeg,
    ffprobePath: ffprobe,
  };
  const receipt = validateFormalInvocationBinding(invocation);
  invariant(receipt.invocationMatchesCompilerBoundCommand === true, 'formal invocation binding positive failed');
  invariant(receipt.runtime.packager.sha256 === sha256File(packagerPath), 'formal packager SHA receipt mismatch');
  invariant(receipt.runtime.ffmpeg.sha256 === sha256File(ffmpeg), 'formal ffmpeg SHA receipt mismatch');
  invariant(receipt.runtime.ffprobe.sha256 === sha256File(ffprobe), 'formal ffprobe SHA receipt mismatch');
  const rawCliArgv = argv.slice(2);
  const parsedCli = parseDirectorAbCliArgs(rawCliArgv);
  invariant(parsedCli.plan === planPath && parsedCli.receipt === receiptPath, 'formal raw CLI positive mismatch');

  expectCode('DIRECTOR_AB_FORMAL_INVOCATION_FILE_MISMATCH', () => validateFormalInvocationBinding({
    ...invocation,
    ffmpegPath: ffprobe,
  }));
  expectCode('DIRECTOR_AB_FORMAL_INVOCATION_FILE_MISMATCH', () => validateFormalInvocationBinding({
    ...invocation,
    ffprobePath: ffmpeg,
  }));
  expectCode('DIRECTOR_AB_FORMAL_INVOCATION_OUTPUT_MISMATCH', () => validateFormalInvocationBinding({
    ...invocation,
    outputDirectory: `${outputDirectory}-wrong`,
  }));
  expectCode('DIRECTOR_AB_FORMAL_INVOCATION_OUTPUT_MISMATCH', () => validateFormalInvocationBinding({
    ...invocation,
    receiptPath: path.join(outputDirectory, 'wrong-receipt.json'),
  }));
  expectCode('DIRECTOR_AB_FORMAL_INVOCATION_INPUT_MISMATCH', () => validateFormalInvocationBinding({
    ...invocation,
    visualMasterPath: alternateExistingFile,
  }));
  expectCode('DIRECTOR_AB_FORMAL_INVOCATION_FILE_MISMATCH', () => validateFormalInvocationBinding({
    ...invocation,
    currentScriptPath: testScriptPath,
  }));
  expectCode('DIRECTOR_AB_FORMAL_INVOCATION_FILE_MISMATCH', () => validateFormalInvocationBinding({
    ...invocation,
    currentNodePath: ffmpeg,
  }));
  expectCode('DIRECTOR_AB_FORMAL_INVOCATION_CWD_MISMATCH', () => validateFormalInvocationBinding({
    ...invocation,
    currentCwd: path.dirname(process.cwd()),
  }));
  const forgedRuntimePlan = structuredClone(formalPlan);
  forgedRuntimePlan.provenance.fileBindings.find((item) => item.id === 'ffprobe-binary').sha256 = '0'.repeat(64);
  expectCode('DIRECTOR_AB_FORMAL_RUNTIME_BINDING_SHA_MISMATCH', () => validateFormalInvocationBinding({
    ...invocation,
    plan: forgedRuntimePlan,
  }));
  const extraArgumentPlan = structuredClone(formalPlan);
  extraArgumentPlan.commands[0].argv.push('--unexpected');
  expectCode('DIRECTOR_AB_FORMAL_PACKAGE_COMMAND_ARGV_INVALID', () => validateFormalInvocationBinding({
    ...invocation,
    plan: extraArgumentPlan,
  }));
  expectCode('DIRECTOR_AB_FORMAL_UNBOUND_OPTION_FORBIDDEN', () => validateFormalInvocationBinding({
    ...invocation,
    historicalV5WithPath: alternateExistingFile,
  }));
  expectCode('DIRECTOR_AB_ARGUMENT_COUNT_INVALID', () => parseDirectorAbCliArgs([
    ...rawCliArgv,
    '--unexpected',
    'value',
  ]));
  const reorderedCli = [...rawCliArgv];
  [reorderedCli[0], reorderedCli[2]] = [reorderedCli[2], reorderedCli[0]];
  [reorderedCli[1], reorderedCli[3]] = [reorderedCli[3], reorderedCli[1]];
  expectCode('DIRECTOR_AB_ARGUMENT_ORDER_INVALID', () => parseDirectorAbCliArgs(reorderedCli));
  const historicalCli = [...rawCliArgv, '--historical-v5-with', alternateExistingFile];
  expectCode('DIRECTOR_AB_ARGUMENT_COUNT_INVALID', () => parseDirectorAbCliArgs(historicalCli));
  const unknownCli = [...rawCliArgv];
  unknownCli[8] = '--unexpected';
  expectCode('DIRECTOR_AB_ARGUMENT_ORDER_INVALID', () => parseDirectorAbCliArgs(unknownCli));
  const formalTestSwitchCli = [...rawCliArgv];
  formalTestSwitchCli[0] = '--formal-plan-only-recompile-test';
  expectCode('DIRECTOR_AB_ARGUMENT_ORDER_INVALID', () => parseDirectorAbCliArgs(formalTestSwitchCli));
  const duplicateCli = [...rawCliArgv];
  duplicateCli[10] = '--ffprobe';
  expectCode('DIRECTOR_AB_ARGUMENT_ORDER_INVALID', () => parseDirectorAbCliArgs(duplicateCli));
  expectCode('DIRECTOR_AB_ARGUMENT_COUNT_INVALID', () => parseDirectorAbCliArgs(rawCliArgv.slice(0, -2)));
};

const runFixture = ({ffmpeg, ffprobe, historicalWith, historicalNo}) => {
  runThresholdUnitGates();
  const supervisorAnchorEnvQa = runFormalSupervisorAnchorEnvGates();
  const root = mkdtempSync(path.join(os.tmpdir(), 'koubo-director-ab-test-'));
  try {
    const inputDir = path.join(root, 'inputs');
    const outputParent = path.join(root, 'outputs');
    mkdirSync(inputDir);
    mkdirSync(outputParent);
    const formalPlanOnlyRecompileQa = runFormalPlanOnlyRecompilePathGates({root});
    const visualMaster = path.join(inputDir, 'visual-master-muted.mp4');
    const spoken = path.join(inputDir, 'spoken.wav');
    const sfx = path.join(inputDir, 'sfx.wav');
    const requestEvidence = path.join(inputDir, 'request-evidence.json');
    const styleEvidence = path.join(inputDir, 'style-evidence.json');
    const referenceEvidence = path.join(inputDir, 'reference-evidence.txt');
    const transcriptEvidence = path.join(inputDir, 'transcript-evidence.json');
    const requestObject = {request: 'synthetic exact30', testOnly: true};
    writeFileSync(requestEvidence, `${JSON.stringify(requestObject)}\n`, {flag: 'wx'});
    writeFileSync(styleEvidence, '{"style":"synthetic paper"}\n', {flag: 'wx'});
    writeFileSync(referenceEvidence, 'synthetic visual reference\n', {flag: 'wx'});
    writeFileSync(transcriptEvidence, '{"transcript":"synthetic authority"}\n', {flag: 'wx'});
    command(ffmpeg, [
      '-nostdin', '-hide_banner', '-v', 'error', '-n',
      '-f', 'lavfi', '-i', 'testsrc2=size=1920x1080:rate=30:duration=30',
      '-frames:v', '900',
      '-an', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '30', '-pix_fmt', 'yuv420p',
      '-video_track_timescale', '90000',
      visualMaster,
    ]);
    command(ffmpeg, [
      '-nostdin', '-hide_banner', '-v', 'error', '-n',
      '-f', 'lavfi', '-i', 'sine=frequency=330:sample_rate=48000:duration=32',
      '-f', 'lavfi', '-i', 'sine=frequency=4000:sample_rate=48000:duration=0.021333333333',
      '-filter_complex', '[0:a]volume=0.5[base];[1:a]volume=1.5,adelay=1486976S:all=1[marker];[base][marker]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,aformat=channel_layouts=stereo[out]',
      '-map', '[out]',
      '-c:a', 'pcm_s24le', spoken,
    ]);
    command(ffmpeg, [
      '-nostdin', '-hide_banner', '-v', 'error', '-n',
      '-f', 'lavfi', '-i', 'sine=frequency=880:sample_rate=48000:duration=0.18',
      '-filter:a', 'aformat=channel_layouts=stereo',
      '-c:a', 'pcm_s24le', sfx,
    ]);
    const planPath = path.join(inputDir, 'synthetic-plan.json');
    const planDraft = JSON.parse(readFileSync(fixturePlanPath, 'utf8'));
    planDraft.media.spoken.path = spoken;
    planDraft.media.spoken.sha256 = sha256File(spoken);
    planDraft.media.sfx[0].path = sfx;
    planDraft.media.sfx[0].sha256 = sha256File(sfx);
    planDraft.samplePlan.outputs.visualMaster = visualMaster;
    planDraft.provenance.requestPath = requestEvidence;
    planDraft.provenance.requestCanonicalSha256 = sha256Text(stableStringify(requestObject));
    planDraft.provenance.styleSha256 = sha256File(styleEvidence);
    planDraft.provenance.referenceSha256 = sha256File(referenceEvidence);
    planDraft.provenance.authorityTranscriptSha256 = sha256File(transcriptEvidence);
    planDraft.provenance.fileBindings = [
      binding('request', 'synthetic-request', requestEvidence),
      binding('style', 'synthetic-style', styleEvidence),
      binding('reference', 'synthetic-reference', referenceEvidence),
      binding('transcript', 'synthetic-transcript', transcriptEvidence),
      binding('spoken-proxy', 'synthetic-spoken', spoken),
      binding('sfx', 'synthetic-paper-tick', sfx),
    ];
    const plan = sealPlan(planDraft);
    writePlan(planPath, plan);
    const prepublishBindingDriftQa = runPrepublishBindingDriftGates({
      inputDir,
      planPath,
      visualMasterPath: visualMaster,
      spokenPath: spoken,
      sfxPath: sfx,
      ffmpeg,
      ffprobe,
    });
    const outputDirectory = path.join(outputParent, 'package');
    const receiptPath = path.join(outputDirectory, 'qa-receipt.json');
    runFormalInvocationBindingGates({
      planPath,
      visualMasterPath: visualMaster,
      outputDirectory,
      receiptPath,
      ffmpeg,
      ffprobe,
      alternateExistingFile: spoken,
    });
    const forbiddenOutputDirectory = path.join(outputParent, 'synthetic-production-path-must-not-exist');
    expectCode('DIRECTOR_AB_SYNTHETIC_FIXTURE_FORBIDDEN', () => packageAndQaDirectorAb({
      planPath,
      visualMasterPath: visualMaster,
      outputDirectory: forbiddenOutputDirectory,
      receiptPath: path.join(forbiddenOutputDirectory, 'qa-receipt.json'),
      ffmpegPath: ffmpeg,
      ffprobePath: ffprobe,
    }));

    const staticMaster = path.join(inputDir, 'visual-master-static-muted.mp4');
    command(ffmpeg, [
      '-nostdin', '-hide_banner', '-v', 'error', '-n',
      '-f', 'lavfi', '-i', 'color=c=0x7a6d5d:size=1920x1080:rate=30:duration=30',
      '-frames:v', '900',
      '-an', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '30', '-pix_fmt', 'yuv420p',
      '-video_track_timescale', '90000',
      staticMaster,
    ]);
    const freezeFailurePlanPath = path.join(inputDir, 'synthetic-plan-static-freeze.json');
    const freezeFailureDraft = structuredClone(planDraft);
    freezeFailureDraft.samplePlan.outputs.visualMaster = staticMaster;
    writePlan(freezeFailurePlanPath, sealPlan(freezeFailureDraft));
    const freezeFailureOutput = path.join(outputParent, 'freeze-failure-terminal');
    const freezeFailureReceiptPath = path.join(freezeFailureOutput, 'qa-receipt.json');
    let freezeFailureError = null;
    try {
      packageAndQaDirectorAb({
        planPath: freezeFailurePlanPath,
        visualMasterPath: staticMaster,
        outputDirectory: freezeFailureOutput,
        receiptPath: freezeFailureReceiptPath,
        ffmpegPath: ffmpeg,
        ffprobePath: ffprobe,
        allowSyntheticFixtureForTest: true,
      });
    } catch (error) {
      freezeFailureError = error;
    }
    invariant(freezeFailureError?.code === 'DIRECTOR_AB_FREEZE_GATE_FAILED', `static master freeze gate returned ${freezeFailureError?.code}`);
    invariant(readdirSync(freezeFailureOutput).join(',') === 'qa-receipt.json', 'freeze failure terminal published media or intermediate files');
    const freezeFailureReceipt = JSON.parse(readFileSync(freezeFailureReceiptPath, 'utf8'));
    invariant(freezeFailureReceipt.schema === 'koubo-director-exact30-ab-package-qa/v2' && freezeFailureReceipt.freezePolicySchema === 'koubo-director-freeze-qa/v2', 'freeze failure v2 schema missing');
    invariant(freezeFailureReceipt.productionEligible === false && freezeFailureReceipt.automationFreezeMustRemain === true && freezeFailureReceipt.automationHandoffAllowed === false && freezeFailureReceipt.abOutputsPublished === false, 'freeze failure terminal authority flags invalid');
    invariant(freezeFailureReceipt.qa.videoScan.rawHits.length > 0 && freezeFailureReceipt.qa.videoScan.rawHits.every((hit) => Number.isFinite(hit.start) && Number.isFinite(hit.end) && Number.isFinite(hit.duration)), 'freeze failure raw hits missing');
    invariant(freezeFailureReceipt.qa.videoScan.detector.stderrSha256Scope === 'single-scan-run-only-not-cross-run-stable' && freezeFailureReceipt.qa.videoScan.detector.rawHitSequenceSha256Scope === 'canonical-structured-hit-sequence-cross-run-anchor', 'freeze detector hash scope was not explicit');
    invariant(freezeFailureReceipt.qa.videoScan.gateSummary.passed === false && freezeFailureReceipt.qa.videoScan.classifiedHits.length > 0, 'freeze failure classification evidence missing');
    invariant(!Object.hasOwn(freezeFailureReceipt.qa.videoScan, 'streamingDiagnostics') && !containsBuffer(freezeFailureReceipt.qa.videoScan), 'freeze failure public videoScan leaked internal streaming telemetry or buffers');
    invariant(Object.keys(freezeFailureReceipt.outputs).length === 0, 'freeze failure receipt declared A/B outputs');
    expectCode('DIRECTOR_AB_OUTPUT_DIRECTORY_EXISTS', () => packageAndQaDirectorAb({
      planPath: freezeFailurePlanPath,
      visualMasterPath: staticMaster,
      outputDirectory: freezeFailureOutput,
      receiptPath: freezeFailureReceiptPath,
      ffmpegPath: ffmpeg,
      ffprobePath: ffprobe,
      allowSyntheticFixtureForTest: true,
    }));

    const result = packageAndQaDirectorAb({
      planPath,
      visualMasterPath: visualMaster,
      outputDirectory,
      receiptPath,
      ffmpegPath: ffmpeg,
      ffprobePath: ffprobe,
      historicalV5WithPath: historicalWith,
      historicalV5NoPath: historicalNo,
      allowSyntheticFixtureForTest: true,
    });
    invariant(result.status === 'synthetic-technical-qa-passed-test-only', 'status mismatch');
    invariant(!Object.hasOwn(result.qa.videoScan, 'streamingDiagnostics') && !containsBuffer(result.qa.videoScan), 'successful public videoScan leaked internal streaming telemetry or buffers');
    invariant(result.outputs.withSfxPcm.samplesPerChannel === 1440000, 'with PCM sample count mismatch');
    invariant(result.outputs.noSfxPcm.samplesPerChannel === 1440000, 'no PCM sample count mismatch');
    invariant(result.qa.noSfxPcmSourcePreservation.correlation >= 0.99999999, 'NoSfx PCM source preservation correlation mismatch');
    invariant(result.qa.noSfxPcmSourcePreservation.declaredTail.maximumAbsoluteDifference <= 0.000001, 'NoSfx PCM declared tail was modified');
    invariant(result.plan.chainSha256 === plan.chain.chainSha256, 'plan chain SHA mismatch');
    invariant(result.plan.authoritativeValidation.mode === 'synthetic-test-only-no-production-authority', 'synthetic authority boundary mismatch');
    invariant(Object.keys(plan.chain).sort().join(',') === 'authorityTranscriptSha256,chainSha256,fileBindingsSha256,planPayloadSha256,referenceSha256,requestCanonicalSha256,schemaVersion,styleSha256', 'chain key set drifted from compiler');
    invariant(new Set(Object.values(result.qa.h264ElementarySha256)).size === 1, 'H264 identity mismatch');
    invariant(result.qa.decodedFrameComparison.same === 900 && result.qa.decodedFrameComparison.different === 0, 'decoded frame identity mismatch');
    invariant(result.qa.pcmTracksDifferent === true, 'audio difference missing');
    invariant(result.qa.videoScan.blackHits.length === 0, 'black frame scan failed');
    invariant(result.qa.videoScan.whiteHits.length === 0, 'white frame scan failed');
    invariant(result.qa.videoScan.freezeStarts.length === 0, 'freeze scan failed');
    invariant(result.schema === 'koubo-director-exact30-ab-package-qa/v2' && result.freezePolicySchema === 'koubo-director-freeze-qa/v2', 'success freeze v2 schema missing');
    invariant(result.qa.videoScan.detector.noiseDb === -60 && result.qa.videoScan.detector.durationSeconds === 1.5 && /^[a-f0-9]{64}$/.test(result.qa.videoScan.detector.stderrSha256), 'freeze detector contract drifted');
    invariant(result.qa.videoScan.rawHits.length === 0 && result.qa.videoScan.classifiedHits.length === 0 && result.qa.videoScan.gateSummary.passed === true, 'zero-hit v2 freeze receipt invalid');
    for (const delivery of ['withSfx', 'noSfx']) {
      const contract = result.qa.deliveryAudioContract[delivery];
      invariant(contract.codecName === 'aac' && contract.profile === 'LC', `${delivery} AAC-LC contract mismatch`);
      invariant(contract.sampleRate === 48000 && contract.channels === 2 && contract.timeBase === '1/48000', `${delivery} audio format contract mismatch`);
      const tail = result.qa.audioTail[delivery];
      invariant(tail.decodedSamplesPerChannel >= 1440000 && tail.decodedSamplesPerChannel <= 1441024, `${delivery} AAC decoded sample count mismatch`);
      invariant(tail.codecPaddingPeakDbfs <= -80, `${delivery} AAC padding is not silent`);
    }
    invariant(result.qa.audioSimilarity.noSfxAgainstAuthoritativeSpoken.correlation >= 0.999, 'NoSfx spoken correlation gate mismatch');
    invariant(result.qa.audioSimilarity.noSfxAgainstAuthoritativeSpoken.gain >= 0.97 && result.qa.audioSimilarity.noSfxAgainstAuthoritativeSpoken.gain <= 1.03, 'NoSfx gain gate mismatch');
    invariant(result.qa.audioSimilarity.noSfxAgainstAuthoritativeSpoken.residualToReferenceRmsRatio <= 0.03, 'NoSfx residual gate mismatch');
    invariant(result.qa.audioSimilarity.withSfxAgainstNoSfxVoiceOutsideAllowedSfx.correlation >= 0.99, 'WithSfx voice correlation gate mismatch');
    invariant(result.qa.audioSimilarity.outsideAllowedSfxDifference.rmsDbfs < -70, 'outside-SFX RMS gate mismatch');
    invariant(result.qa.expectedSfxPcmIdentity.correlation >= 0.999999, 'expected SFX PCM identity mismatch');
    invariant(result.qa.audioSimilarity.expectedSfxAacIdentity.correlation >= 0.995, 'expected SFX AAC identity mismatch');
    invariant(result.qa.audioSimilarity.expectedSfxAacIdentity.gain >= 0.97 && result.qa.audioSimilarity.expectedSfxAacIdentity.gain <= 1.03, 'expected SFX AAC gain mismatch');
    invariant(result.qa.sourcePreflight.spoken.sourceIn === 1 && result.qa.sourcePreflight.spoken.sourceOut === 31, 'non-zero source window was not preserved');
    invariant(result.qa.sourcePreflight.spoken.decodedSamplesPerChannel === 1440000 && result.qa.sourcePreflight.spoken.paddingUsed === false, 'spoken source coverage gate mismatch');
    invariant(result.qa.sourcePreflight.sfx[0].decodedSamplesPerChannel === 8640, 'SFX decoded/resampled sample count mismatch');
    invariant(result.qa.audioSimilarity.declaredTailPreservation.status === 'energy-qualified-and-passed', 'declared tail marker was not verified');
    invariant(result.qa.audioSimilarity.declaredTailPreservation.correlation >= 0.98, 'declared tail marker correlation mismatch');
    invariant(result.qa.audioSimilarity.cueEnergy.length === 4, 'per-cue energy receipt count mismatch');
    invariant(result.qa.audioSimilarity.cueEnergy.every((cue) => cue.retainedRatio === 1 && cue.observedToExpectedRmsRatio >= 0.90 && cue.observedToExpectedRmsRatio <= 1.10), 'per-cue retained energy gate mismatch');
    invariant(result.qa.audioSimilarity.cueEnergy.every((cue) => cue.waveform.correlation >= 0.99), 'per-cue waveform identity gate mismatch');
    invariant(result.qa.audioSimilarity.cueEnergy.some((cue) => cue.id === 'tick-head' && cue.startSample === 0), 'head cue receipt missing');
    invariant(result.qa.audioSimilarity.cueEnergy.some((cue) => cue.id === 'tick-tail' && cue.retainedRatio === 1 && cue.startSample + cue.decodedSourceSamples === 1440000), 'full-retention tail cue receipt missing');
    invariant(result.qa.audioSimilarity.cueEnergy.some((cue) => cue.id === 'tick-overlap'), 'overlap cue receipt missing');
    invariant(result.qa.audioSimilarity.allowedSfxWindows.allowedWindowRatio <= 0.35, 'allowed SFX windows are too broad');
    invariant(result.qa.audioSimilarity.allowedSfxWindows.sourceDurations[0].effectiveEnvelope.activeDurationSeconds <= 2, 'SFX effective envelope duration gate mismatch');
    invariant(result.qa.audioSimilarity.outsideAllowedSfxVoiceCoverage.includedFrameRatio >= 0.60, 'outside-SFX voice frame ratio mismatch');
    invariant(result.commands.withSfxAacEncode.includes('-profile:a') && result.commands.withSfxAacEncode.includes('aac_low'), 'WithSfx encoder did not force AAC-LC');
    invariant(result.commands.noSfxAacEncode.includes('-profile:a') && result.commands.noSfxAacEncode.includes('aac_low'), 'NoSfx encoder did not force AAC-LC');
    invariant(result.commands.withSfxMux.includes('-c:v') && result.commands.withSfxMux.includes('copy'), 'WithSfx mux did not copy video');
    invariant(result.commands.noSfxMux.includes('-c:v') && result.commands.noSfxMux.includes('copy'), 'NoSfx mux did not copy video');
    for (const delivery of ['visualMaster', 'withSfx', 'noSfx']) {
      const timeline = result.qa.deliveryTimeline[delivery];
      invariant(Math.abs(timeline.video.firstPacketPts) <= 1, `${delivery} video first PTS mismatch`);
      if (delivery !== 'visualMaster') {
        invariant(timeline.audio.firstPacketPts === -768, `${delivery} raw AAC first packet PTS mismatch`);
        invariant(timeline.audio.firstPacketSkipSideDataPresent === true, `${delivery} AAC skip_samples side data missing`);
        invariant(timeline.audio.firstPacketSkipSamples === 768, `${delivery} AAC skip_samples mismatch`);
        invariant(Math.abs(timeline.audio.effectiveFirstSample) <= 1, `${delivery} effective first audio sample mismatch`);
      }
    }
    if (historicalWith || historicalNo) {
      invariant(result.qa.historicalV5Negative?.frameComparison.same === 405, 'historical v5 same count mismatch');
      invariant(result.qa.historicalV5Negative?.frameComparison.different === 495, 'historical v5 mismatch count mismatch');
    }
    const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
    invariant(receipt.qa.decodedFrameComparison.total === 900, 'receipt frame total mismatch');
    invariant(receipt.plan.chainSha256 === plan.chain.chainSha256, 'receipt chain SHA mismatch');
    invariant(
      receipt.qa.inputSnapshotRevalidatedBeforePublish.fileBindingCount === plan.provenance.fileBindings.length,
      'receipt full file-binding revalidation count mismatch',
    );
    invariant(
      receipt.qa.inputSnapshotRevalidatedBeforePublish.validationPassesRequired === 2 &&
        receipt.qa.inputSnapshotRevalidatedBeforePublish.secondPassImmediatelyBeforeAtomicPublish === true,
      'receipt dual prepublish revalidation contract mismatch',
    );
    invariant(
      Object.keys(receipt.qa.inputSnapshotRevalidatedBeforePublish.controlPlane).sort().join(',') ===
        'authoritativeValidator,nodeBinary,packager,request',
      'receipt control-plane revalidation coverage mismatch',
    );

    const shiftedAudioDelivery = path.join(inputDir, 'delivery-audio-start-shifted.mp4');
    command(ffmpeg, [
      '-nostdin', '-hide_banner', '-v', 'error', '-n',
      '-i', result.outputs.noSfx.path,
      '-itsoffset', '0.1', '-i', result.outputs.noSfx.path,
      '-map', '0:v:0', '-map', '1:a:0',
      '-c', 'copy', '-t', '30', '-avoid_negative_ts', 'disabled',
      shiftedAudioDelivery,
    ]);
    expectCode('DIRECTOR_AB_AUDIO_STREAM_START_PTS_INVALID', () => validateDeliveryTimeline(ffprobe, shiftedAudioDelivery));

    const wrongButIdenticalVisualMaster = path.join(inputDir, 'wrong-path-visual-master-muted.mp4');
    copyFileSync(visualMaster, wrongButIdenticalVisualMaster);
    const wrongVisualOutput = path.join(outputParent, 'wrong-visual-path-must-not-exist');
    expectCode('DIRECTOR_AB_VISUAL_MASTER_PLAN_PATH_MISMATCH', () => packageAndQaDirectorAb({
      planPath,
      visualMasterPath: wrongButIdenticalVisualMaster,
      outputDirectory: wrongVisualOutput,
      receiptPath: path.join(wrongVisualOutput, 'qa-receipt.json'),
      ffmpegPath: ffmpeg,
      ffprobePath: ffprobe,
      allowSyntheticFixtureForTest: true,
    }));

    let negativePlanIndex = 0;
    const expectPlanFailure = (label, candidatePlan, expectedCode) => {
      negativePlanIndex += 1;
      const candidatePath = path.join(inputDir, `${label}.json`);
      writePlan(candidatePath, candidatePlan);
      const candidateOutput = path.join(outputParent, `negative-${negativePlanIndex}-${label}`);
      expectCode(expectedCode, () => packageAndQaDirectorAb({
        planPath: candidatePath,
        visualMasterPath: visualMaster,
        outputDirectory: candidateOutput,
        receiptPath: path.join(candidateOutput, 'qa-receipt.json'),
        ffmpegPath: ffmpeg,
        ffprobePath: ffprobe,
        allowSyntheticFixtureForTest: true,
      }));
    };

    const tamperedCue = structuredClone(plan);
    tamperedCue.media.sfx[0].cues[2].atSeconds = 10.1;
    expectPlanFailure('tampered-cue', tamperedCue, 'DIRECTOR_AB_PLAN_PAYLOAD_SHA_MISMATCH');
    const selfSealedFakeFormalPlan = structuredClone(plan);
    selfSealedFakeFormalPlan.schemaVersion = 'koubo-director-output/v1';
    expectPlanFailure(
      'self-sealed-fake-formal-plan',
      sealPlan(selfSealedFakeFormalPlan),
      'DIRECTOR_AB_FORMAL_PACKAGE_COMMAND_INVALID',
    );
    const tamperedMediaSha = structuredClone(plan);
    tamperedMediaSha.media.spoken.sha256 = '0'.repeat(64);
    expectPlanFailure('tampered-media-sha', tamperedMediaSha, 'DIRECTOR_AB_PLAN_PAYLOAD_SHA_MISMATCH');
    const resealedForgedMediaSha = structuredClone(plan);
    resealedForgedMediaSha.media.spoken.sha256 = '0'.repeat(64);
    expectPlanFailure('resealed-forged-media-sha', sealPlan(resealedForgedMediaSha), 'DIRECTOR_AB_PLAN_SPOKEN_BINDING_MISSING');
    const tamperedRender = structuredClone(plan);
    tamperedRender.render.width = 1919;
    expectPlanFailure('tampered-render', tamperedRender, 'DIRECTOR_AB_PLAN_PAYLOAD_SHA_MISMATCH');
    const forgedLiveBinding = structuredClone(plan);
    forgedLiveBinding.provenance.fileBindings.find((item) => item.role === 'style').sha256 = 'f'.repeat(64);
    expectPlanFailure('forged-live-binding', sealPlan(forgedLiveBinding), 'DIRECTOR_AB_PLAN_BOUND_FILE_SHA_MISMATCH');

    const extraChainKey = structuredClone(plan);
    extraChainKey.chain.requestIsolationRegistrySha256 = null;
    const extraChainBase = {...extraChainKey.chain};
    delete extraChainBase.chainSha256;
    extraChainKey.chain.chainSha256 = sha256Text(stableStringify(extraChainBase));
    expectPlanFailure('extra-chain-key', extraChainKey, 'DIRECTOR_AB_PLAN_CHAIN_KEYS_INVALID');

    const truncatedTailCue = structuredClone(plan);
    truncatedTailCue.media.sfx[0].cues.find((cue) => cue.id === 'tick-tail').atSeconds = 29.95;
    expectPlanFailure('truncated-tail-cue', sealPlan(truncatedTailCue), 'DIRECTOR_AB_SFX_CUE_TRUNCATED');

    const duplicateSfxId = structuredClone(plan);
    duplicateSfxId.media.sfx.push({
      ...structuredClone(duplicateSfxId.media.sfx[0]),
      cues: [{id: 'duplicate-file-cue', atSeconds: 20, volume: 0.1}],
    });
    expectPlanFailure('duplicate-sfx-id', sealPlan(duplicateSfxId), 'DIRECTOR_AB_SFX_FILE_ID_DUPLICATE');

    const negativeSourceIn = structuredClone(plan);
    negativeSourceIn.media.spoken.sourceIn = -0.1;
    negativeSourceIn.media.spoken.sourceOut = 29.9;
    expectPlanFailure('negative-source-in', sealPlan(negativeSourceIn), 'DIRECTOR_AB_SPOKEN_SOURCE_IN_NEGATIVE');

    const shortSpoken = path.join(inputDir, 'spoken-too-short.wav');
    command(ffmpeg, [
      '-nostdin', '-hide_banner', '-v', 'error', '-n',
      '-f', 'lavfi', '-i', 'sine=frequency=330:sample_rate=48000:duration=30',
      '-filter:a', 'aformat=channel_layouts=stereo',
      '-c:a', 'pcm_s24le', shortSpoken,
    ]);
    const shortSourcePlan = structuredClone(plan);
    shortSourcePlan.media.spoken.path = shortSpoken;
    shortSourcePlan.media.spoken.sha256 = sha256File(shortSpoken);
    const shortBinding = shortSourcePlan.provenance.fileBindings.find((item) => item.role === 'spoken-proxy');
    shortBinding.path = shortSpoken;
    shortBinding.sha256 = sha256File(shortSpoken);
    expectPlanFailure('short-source', sealPlan(shortSourcePlan), 'DIRECTOR_AB_SPOKEN_SOURCE_COVERAGE_INCOMPLETE');

    const mostlySilentSpoken = path.join(inputDir, 'spoken-one-second-only.wav');
    command(ffmpeg, [
      '-nostdin', '-hide_banner', '-v', 'error', '-n',
      '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000:duration=32',
      '-f', 'lavfi', '-i', 'sine=frequency=330:sample_rate=48000:duration=1',
      '-filter_complex', '[1:a]volume=0.5,adelay=48000S:all=1,aformat=channel_layouts=stereo[tone];[0:a][tone]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[out]',
      '-map', '[out]',
      '-c:a', 'pcm_s24le', mostlySilentSpoken,
    ]);
    const mostlySilentPlan = structuredClone(plan);
    mostlySilentPlan.media.spoken.path = mostlySilentSpoken;
    mostlySilentPlan.media.spoken.sha256 = sha256File(mostlySilentSpoken);
    const mostlySilentBinding = mostlySilentPlan.provenance.fileBindings.find((item) => item.role === 'spoken-proxy');
    mostlySilentBinding.path = mostlySilentSpoken;
    mostlySilentBinding.sha256 = sha256File(mostlySilentSpoken);
    expectPlanFailure('mostly-silent-source', sealPlan(mostlySilentPlan), 'DIRECTOR_AB_SPOKEN_SOURCE_ACTIVE_BLOCKS_FAILED');

    const missingChainPlanPath = path.join(inputDir, 'synthetic-plan-missing-chain.json');
    const missingChainPlan = structuredClone(plan);
    delete missingChainPlan.chain.chainSha256;
    writeFileSync(missingChainPlanPath, `${JSON.stringify(missingChainPlan, null, 2)}\n`, {flag: 'wx'});
    expectCode('DIRECTOR_AB_PLAN_CHAIN_KEYS_INVALID', () => packageAndQaDirectorAb({
      planPath: missingChainPlanPath,
      visualMasterPath: visualMaster,
      outputDirectory: path.join(outputParent, 'missing-chain-must-not-exist'),
      receiptPath: path.join(outputParent, 'missing-chain-must-not-exist', 'qa-receipt.json'),
      ffmpegPath: ffmpeg,
      ffprobePath: ffprobe,
      allowSyntheticFixtureForTest: true,
    }));

    const notMutedMaster = path.join(inputDir, 'visual-master-with-audio.mp4');
    command(ffmpeg, [
      '-nostdin', '-hide_banner', '-v', 'error', '-n',
      '-i', visualMaster,
      '-i', spoken,
      '-map', '0:v:0', '-map', '1:a:0',
      '-c:v', 'copy', '-c:a', 'aac', '-t', '30',
      notMutedMaster,
    ]);
    const notMutedPlanPath = path.join(inputDir, 'synthetic-plan-not-muted-master.json');
    const notMutedPlan = structuredClone(plan);
    notMutedPlan.samplePlan.outputs.visualMaster = notMutedMaster;
    writePlan(notMutedPlanPath, sealPlan(notMutedPlan));
    let mutedGateCode = null;
    try {
      packageAndQaDirectorAb({
        planPath: notMutedPlanPath,
        visualMasterPath: notMutedMaster,
        outputDirectory: path.join(outputParent, 'must-not-exist'),
        receiptPath: path.join(outputParent, 'must-not-exist', 'qa-receipt.json'),
        ffmpegPath: ffmpeg,
        ffprobePath: ffprobe,
        allowSyntheticFixtureForTest: true,
      });
    } catch (error) {
      mutedGateCode = error?.code;
    }
    invariant(mutedGateCode === 'DIRECTOR_AB_VISUAL_MASTER_NOT_MUTED', `muted master negative gate mismatch: ${mutedGateCode}`);
    return {
      status: 'PASS',
      receiptSha256: sha256File(receiptPath),
      historicalV5Checked: Boolean(historicalWith && historicalNo),
      supervisorAnchorEnvQa,
      formalPlanOnlyRecompileQa,
      prepublishBindingDriftQa,
      syntheticAudioMetrics: {
        noSfxPcmCorrelation: result.qa.noSfxPcmSourcePreservation.correlation,
        noSfxPcmTailMaximumAbsoluteDifference: result.qa.noSfxPcmSourcePreservation.declaredTail.maximumAbsoluteDifference,
        noSfxSpokenCorrelation: result.qa.audioSimilarity.noSfxAgainstAuthoritativeSpoken.correlation,
        noSfxGain: result.qa.audioSimilarity.noSfxAgainstAuthoritativeSpoken.gain,
        noSfxRmsRatio: result.qa.audioSimilarity.noSfxAgainstAuthoritativeSpoken.rmsRatio,
        noSfxDcOffset: result.qa.audioSimilarity.noSfxAgainstAuthoritativeSpoken.offset,
        noSfxResidualToReferenceRmsRatio: result.qa.audioSimilarity.noSfxAgainstAuthoritativeSpoken.residualToReferenceRmsRatio,
        withSfxVoiceCorrelation: result.qa.audioSimilarity.withSfxAgainstNoSfxVoiceOutsideAllowedSfx.correlation,
        outsideSfxDifferenceRmsDbfs: result.qa.audioSimilarity.outsideAllowedSfxDifference.rmsDbfs,
        outsideSfxIncludedFrameRatio: result.qa.audioSimilarity.outsideAllowedSfxVoiceCoverage.includedFrameRatio,
        allowedSfxWindowRatio: result.qa.audioSimilarity.allowedSfxWindows.allowedWindowRatio,
        expectedSfxPcmCorrelation: result.qa.expectedSfxPcmIdentity.correlation,
        expectedSfxPcmGain: result.qa.expectedSfxPcmIdentity.gain,
        expectedSfxPcmRmsRatio: result.qa.expectedSfxPcmIdentity.rmsRatio,
        expectedSfxPcmResidualRatio: result.qa.expectedSfxPcmIdentity.residualToReferenceRmsRatio,
        expectedSfxAacCorrelation: result.qa.audioSimilarity.expectedSfxAacIdentity.correlation,
        expectedSfxAacGain: result.qa.audioSimilarity.expectedSfxAacIdentity.gain,
        expectedSfxAacRmsRatio: result.qa.audioSimilarity.expectedSfxAacIdentity.rmsRatio,
        expectedSfxAacResidualRatio: result.qa.audioSimilarity.expectedSfxAacIdentity.residualToReferenceRmsRatio,
        minimumCueWaveformCorrelation: Math.min(...result.qa.audioSimilarity.cueEnergy.map((cue) => cue.waveform.correlation)),
        minimumCueWaveformGain: Math.min(...result.qa.audioSimilarity.cueEnergy.map((cue) => cue.waveform.gain)),
        maximumCueWaveformGain: Math.max(...result.qa.audioSimilarity.cueEnergy.map((cue) => cue.waveform.gain)),
        maximumCueWaveformResidualRatio: Math.max(...result.qa.audioSimilarity.cueEnergy.map((cue) => cue.waveform.residualToReferenceRmsRatio)),
        declaredTailCorrelation: result.qa.audioSimilarity.declaredTailPreservation.correlation,
        declaredTailRmsRatio: result.qa.audioSimilarity.declaredTailPreservation.rmsRatio,
        cueCount: result.qa.audioSimilarity.cueEnergy.length,
        withSfxDecodedSamplesPerChannel: result.qa.audioTail.withSfx.decodedSamplesPerChannel,
        noSfxDecodedSamplesPerChannel: result.qa.audioTail.noSfx.decodedSamplesPerChannel,
        withSfxPaddingPeakDbfs: result.qa.audioTail.withSfx.codecPaddingPeakDbfs,
        noSfxPaddingPeakDbfs: result.qa.audioTail.noSfx.codecPaddingPeakDbfs,
        withSfxEffectiveFirstAudioSample: result.qa.deliveryTimeline.withSfx.audio.effectiveFirstSample,
        noSfxEffectiveFirstAudioSample: result.qa.deliveryTimeline.noSfx.audio.effectiveFirstSample,
      },
    };
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
};

const main = () => {
  const args = parseArgs(process.argv.slice(2));
  invariant(args.ffmpeg && path.isAbsolute(args.ffmpeg), '--ffmpeg absolute path required');
  invariant(args.ffprobe && path.isAbsolute(args.ffprobe), '--ffprobe absolute path required');
  invariant(Boolean(args['historical-v5-with']) === Boolean(args['historical-v5-no']), 'historical v5 pair must be complete');
  const result = runFixture({
    ffmpeg: args.ffmpeg,
    ffprobe: args.ffprobe,
    historicalWith: args['historical-v5-with'],
    historicalNo: args['historical-v5-no'],
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error?.stack ?? error}\n`);
    process.exitCode = 1;
  }
}
