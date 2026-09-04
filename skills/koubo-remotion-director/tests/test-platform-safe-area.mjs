#!/usr/bin/env node

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  getPlatformSafeAreaProfile,
  resolvePresenterSlot,
  validatePlatformSafeAreasDocument,
  validatePresenterRect,
  validatePresenterSlot,
  validatePresenterTransition,
} from '../scripts/platform-safe-area-core.mjs';

const testPath = fileURLToPath(import.meta.url);
const skillRoot = path.resolve(path.dirname(testPath), '..');
const contractPath = path.join(
  skillRoot,
  'references/platform-safe-areas.v1.json',
);
const componentPath = path.join(
  skillRoot,
  'assets/remotion-presenter-media/PresenterMediaStage.tsx',
);
const document = JSON.parse(readFileSync(contractPath, 'utf8'));
const profile = getPlatformSafeAreaProfile(document);

assert.equal(validatePlatformSafeAreasDocument(document).passed, true);
assert.equal(profile.regions.reservedPresenterRightBand.x, 1600);
assert.equal(profile.regions.subtitle.y, 930);
assert.equal(profile.presenter.minimumSubtitleGapPixels, 32);
assert.equal(profile.presenter.slots.default.right, 360);
assert.equal(profile.presenter.slots.default.bottom, 202);
assert.equal(profile.presenter.slots.fallback.left, 64);
assert.equal(profile.presenter.slots.fallback.bottom, 202);
assert.equal(profile.presenter.transition.mode, 'fixed-slot-opacity-scale');
assert.deepEqual(resolvePresenterSlot(profile, 'default'), {
  x: 1282,
  y: 600,
  width: 278,
  height: 278,
});
assert.deepEqual(resolvePresenterSlot(profile, 'fallback'), {
  x: 64,
  y: 600,
  width: 278,
  height: 278,
});

const legacyAuditedPosition = {
  x: 1920 - 64 - 278,
  y: 1080 - 178 - 278,
  width: 278,
  height: 278,
};
const legacyResult = validatePresenterRect(profile, legacyAuditedPosition);
assert.equal(legacyResult.passed, false, '旧右下角位置必须失败');
assert.deepEqual(
  new Set(legacyResult.errors.map((error) => error.code)),
  new Set([
    'PRESENTER_IN_RESERVED_RIGHT_BAND',
    'PRESENTER_SUBTITLE_GAP_TOO_SMALL',
    'PRESENTER_INTERSECTS_PLATFORM_OVERLAY',
  ]),
);

const currentPreV9AssetPosition = {
  x: 1920 - 72 - 296,
  y: 1080 - 188 - 296,
  width: 296,
  height: 296,
};
assert.equal(
  validatePresenterRect(profile, currentPreV9AssetPosition).passed,
  false,
  'PresenterMediaStage 修复前的 296px 右下角位置也必须失败',
);

for (const slotName of ['default', 'fallback']) {
  const result = validatePresenterSlot(profile, slotName);
  assert.equal(result.passed, true, `${slotName} 安全槽必须通过`);
  assert.ok(result.metrics.subtitleGap >= 32);
  assert.ok(
    Object.values(result.metrics.overlayGaps).every((gap) => gap >= 0),
  );
}

const safeRect = resolvePresenterSlot(profile, 'default');
const fixedSlotTransition = validatePresenterTransition(profile, {
  slotName: 'default',
  samples: [
    {frame: 0, rect: safeRect, opacity: 0, scale: 0.92},
    {frame: 8, rect: safeRect, opacity: 0.5, scale: 0.96},
    {frame: 16, rect: safeRect, opacity: 1, scale: 1},
  ],
});
assert.equal(fixedSlotTransition.passed, true);

const fullScreenSweep = validatePresenterTransition(profile, {
  slotName: 'default',
  samples: [
    {
      frame: 0,
      rect: {x: 0, y: 0, width: 1920, height: 1080},
      opacity: 1,
      scale: 1,
    },
    {frame: 16, rect: safeRect, opacity: 1, scale: 1},
  ],
});
assert.equal(fullScreenSweep.passed, false, '全屏扫入安全槽必须失败');
assert.ok(
  fullScreenSweep.errors.some(
    (error) => error.code === 'PRESENTER_TRANSITION_POSITION_SWEEP',
  ),
);

const forbiddenTransitionDocument = structuredClone(document);
forbiddenTransitionDocument.profiles[0].presenter.transition.mode =
  'full-frame-to-slot-position';
const forbiddenTransitionContractResult = validatePlatformSafeAreasDocument(
  forbiddenTransitionDocument,
);
assert.equal(forbiddenTransitionContractResult.passed, false);
assert.ok(
  forbiddenTransitionContractResult.errors.some(
    (error) => error.code === 'PLATFORM_SAFE_AREA_TRANSITION_INVALID',
  ),
);

const componentSource = readFileSync(componentPath, 'utf8');
assert.match(componentSource, /platform-safe-areas\.v1\.json/);
assert.match(componentSource, /presenterPlacement = 'default'/);
assert.match(componentSource, /opacity: visibility/);
assert.match(componentSource, /transform: `scale\(\$\{scale\}\)`/);
assert.match(componentSource, /trimBefore=\{speakerStartFromFrame\}/);
assert.doesNotMatch(componentSource, /startFrom=\{speakerStartFromFrame\}/);
assert.doesNotMatch(componentSource, /\[1920,\s*targetSize\]/);
assert.doesNotMatch(componentSource, /\[1080,\s*targetHeight\]/);

console.log('platform-safe-area: 旧位置失败，新左右槽通过，扫掠转场失败。');
