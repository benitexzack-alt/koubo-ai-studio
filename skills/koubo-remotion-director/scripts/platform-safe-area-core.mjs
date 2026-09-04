const PROFILE_SCHEMA_VERSION = 'koubo-platform-safe-areas/v1';

export const DEFAULT_PLATFORM_SAFE_AREA_PROFILE_ID =
  'douyin-feed-landscape-16x9-v1';

const finite = (value) => Number.isFinite(value);

const issue = (code, message, details = {}) => ({code, message, details});

const rectEquals = (left, right, epsilon = 1e-6) =>
  ['x', 'y', 'width', 'height'].every(
    (key) => Math.abs(left[key] - right[key]) <= epsilon,
  );

export function resolvePresenterSlot(profile, slotName = 'default') {
  const slot = profile?.presenter?.slots?.[slotName];
  if (!slot) {
    throw Object.assign(new Error(`未知人物安全槽：${slotName}`), {
      code: 'PLATFORM_SAFE_AREA_SLOT_UNKNOWN',
    });
  }

  const canvas = profile.coordinateSystem.canvas;
  const size = profile.presenter.size;
  const x = slot.anchor === 'bottom-right'
    ? canvas.width - slot.right - size.width
    : slot.left;
  const y = canvas.height - slot.bottom - size.height;
  const rect = {x, y, width: size.width, height: size.height};

  if (![rect.x, rect.y, rect.width, rect.height].every(finite)) {
    throw Object.assign(new Error(`人物安全槽 ${slotName} 的几何字段无效`), {
      code: 'PLATFORM_SAFE_AREA_SLOT_GEOMETRY_INVALID',
    });
  }
  return rect;
}

export function circleFromRect(rect) {
  return {
    cx: rect.x + rect.width / 2,
    cy: rect.y + rect.height / 2,
    radius: Math.min(rect.width, rect.height) / 2,
  };
}

export function rectanglesIntersect(left, right) {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

export function circleGap(left, right) {
  return Math.hypot(left.cx - right.cx, left.cy - right.cy) -
    left.radius - right.radius;
}

export function validatePresenterRect(profile, rect) {
  const errors = [];
  const canvas = profile.coordinateSystem.canvas;
  const rightBand = profile.regions.reservedPresenterRightBand;
  const subtitle = profile.regions.subtitle;
  const minimumSubtitleGap = profile.presenter.minimumSubtitleGapPixels;
  const presenterCircle = circleFromRect(rect);

  if (
    rect.x < 0 ||
    rect.y < 0 ||
    rect.x + rect.width > canvas.width ||
    rect.y + rect.height > canvas.height
  ) {
    errors.push(issue(
      'PRESENTER_OUTSIDE_CANVAS',
      '人物区域超出成片画布。',
      {rect, canvas},
    ));
  }

  if (rectanglesIntersect(rect, rightBand)) {
    errors.push(issue(
      'PRESENTER_IN_RESERVED_RIGHT_BAND',
      '人物区域进入抖音右侧保留带。',
      {rect, rightBand},
    ));
  }

  const subtitleGap = subtitle.y - (rect.y + rect.height);
  if (subtitleGap < minimumSubtitleGap) {
    errors.push(issue(
      'PRESENTER_SUBTITLE_GAP_TOO_SMALL',
      `人物区域与字幕顶部间距 ${subtitleGap}px，小于 ${minimumSubtitleGap}px。`,
      {rect, subtitle, subtitleGap, minimumSubtitleGap},
    ));
  }

  const overlayGaps = {};
  for (const overlay of profile.platformOverlays) {
    if (overlay.shape !== 'circle') continue;
    const gap = circleGap(presenterCircle, overlay.hardMaskCircle);
    overlayGaps[overlay.id] = gap;
    if (gap < 0) {
      errors.push(issue(
        'PRESENTER_INTERSECTS_PLATFORM_OVERLAY',
        `人物区域与平台覆盖层 ${overlay.id} 相交。`,
        {presenterCircle, platformCircle: overlay.hardMaskCircle, gap},
      ));
    }
  }

  return {
    passed: errors.length === 0,
    errors,
    metrics: {
      rect,
      presenterCircle,
      subtitleGap,
      overlayGaps,
    },
  };
}

export function validatePresenterSlot(profile, slotName = 'default') {
  const rect = resolvePresenterSlot(profile, slotName);
  const result = validatePresenterRect(profile, rect);
  const expectedRect = profile.presenter.slots[slotName].expectedRect;
  if (!rectEquals(rect, expectedRect)) {
    result.errors.push(issue(
      'PRESENTER_SLOT_EXPECTED_RECT_MISMATCH',
      `人物安全槽 ${slotName} 的锚点计算结果与 expectedRect 不一致。`,
      {rect, expectedRect},
    ));
    result.passed = false;
  }
  return result;
}

export function validatePresenterTransition(
  profile,
  {slotName = 'default', samples = []} = {},
) {
  const errors = [];
  const expectedRect = resolvePresenterSlot(profile, slotName);
  const transition = profile.presenter.transition;

  if (!Array.isArray(samples) || samples.length === 0) {
    errors.push(issue(
      'PRESENTER_TRANSITION_SAMPLES_REQUIRED',
      '人物转场必须提供逐帧或采样帧几何。',
    ));
  }

  for (const [index, sample] of samples.entries()) {
    const label = `samples[${index}]`;
    if (!sample?.rect || !rectEquals(sample.rect, expectedRect)) {
      errors.push(issue(
        'PRESENTER_TRANSITION_POSITION_SWEEP',
        `${label} 改变了人物槽位或尺寸；转场只允许 opacity 和 scale。`,
        {expectedRect, actualRect: sample?.rect ?? null},
      ));
      continue;
    }
    if (!finite(sample.opacity) || sample.opacity < 0 || sample.opacity > 1) {
      errors.push(issue(
        'PRESENTER_TRANSITION_OPACITY_INVALID',
        `${label} 的 opacity 必须位于 0 到 1。`,
        {opacity: sample.opacity},
      ));
    }
    if (
      !finite(sample.scale) ||
      sample.scale < transition.minimumScale ||
      sample.scale > transition.maximumScale
    ) {
      errors.push(issue(
        'PRESENTER_TRANSITION_SCALE_INVALID',
        `${label} 的 scale 超出固定槽位允许范围。`,
        {
          scale: sample.scale,
          minimumScale: transition.minimumScale,
          maximumScale: transition.maximumScale,
        },
      ));
    }
  }

  const slotResult = validatePresenterRect(profile, expectedRect);
  errors.push(...slotResult.errors);
  return {passed: errors.length === 0, errors, expectedRect};
}

export function validatePlatformSafeAreasDocument(document) {
  const errors = [];
  if (document?.schemaVersion !== PROFILE_SCHEMA_VERSION) {
    errors.push(issue(
      'PLATFORM_SAFE_AREA_SCHEMA_INVALID',
      `schemaVersion 必须为 ${PROFILE_SCHEMA_VERSION}。`,
    ));
  }
  if (!Array.isArray(document?.profiles) || document.profiles.length === 0) {
    errors.push(issue(
      'PLATFORM_SAFE_AREA_PROFILES_REQUIRED',
      '平台安全区合同必须至少包含一个 profile。',
    ));
    return {passed: false, errors};
  }

  const ids = new Set();
  for (const profile of document.profiles) {
    if (!profile?.id || ids.has(profile.id)) {
      errors.push(issue(
        'PLATFORM_SAFE_AREA_PROFILE_ID_INVALID',
        '平台安全区 profile id 缺失或重复。',
        {id: profile?.id ?? null},
      ));
      continue;
    }
    ids.add(profile.id);
    const canvas = profile?.coordinateSystem?.canvas;
    const presenter = profile?.presenter;
    const rightBand = profile?.regions?.reservedPresenterRightBand;
    const subtitle = profile?.regions?.subtitle;
    const transition = presenter?.transition;
    if (
      ![canvas?.width, canvas?.height, presenter?.size?.width,
        presenter?.size?.height, presenter?.minimumSubtitleGapPixels,
        rightBand?.width, rightBand?.height, subtitle?.width, subtitle?.height]
        .every((value) => finite(value) && value > 0) ||
      ![rightBand?.x, rightBand?.y, subtitle?.x, subtitle?.y]
        .every((value) => finite(value) && value >= 0)
    ) {
      errors.push(issue(
        'PLATFORM_SAFE_AREA_PROFILE_GEOMETRY_INVALID',
        `profile ${profile.id} 的画布或人物几何无效。`,
      ));
      continue;
    }
    if (
      transition?.mode !== 'fixed-slot-opacity-scale' ||
      !Array.isArray(transition.allowedAnimatedProperties) ||
      transition.allowedAnimatedProperties.some(
        (property) => !['opacity', 'scale'].includes(property),
      ) ||
      !finite(transition.minimumScale) ||
      !finite(transition.maximumScale) ||
      transition.minimumScale <= 0 ||
      transition.minimumScale > transition.maximumScale ||
      transition.maximumScale > 1
    ) {
      errors.push(issue(
        'PLATFORM_SAFE_AREA_TRANSITION_INVALID',
        `profile ${profile.id} 只允许固定槽位内的 opacity/scale 转场。`,
      ));
    }
    if (
      !Array.isArray(profile.platformOverlays) ||
      profile.platformOverlays.some((overlay) =>
        overlay?.shape !== 'circle' ||
        ![overlay?.hardMaskCircle?.cx, overlay?.hardMaskCircle?.cy,
          overlay?.hardMaskCircle?.radius]
          .every((value) => finite(value) && value > 0))
    ) {
      errors.push(issue(
        'PLATFORM_SAFE_AREA_OVERLAY_INVALID',
        `profile ${profile.id} 的平台覆盖层无效。`,
      ));
      continue;
    }
    for (const slotName of ['default', 'fallback']) {
      try {
        const result = validatePresenterSlot(profile, slotName);
        errors.push(...result.errors);
      } catch (error) {
        errors.push(issue(
          error.code ?? 'PLATFORM_SAFE_AREA_SLOT_INVALID',
          error.message,
          {profileId: profile.id, slotName},
        ));
      }
    }
  }
  return {passed: errors.length === 0, errors};
}

export function getPlatformSafeAreaProfile(
  document,
  profileId = DEFAULT_PLATFORM_SAFE_AREA_PROFILE_ID,
) {
  const documentResult = validatePlatformSafeAreasDocument(document);
  if (!documentResult.passed) {
    throw Object.assign(new Error('平台安全区合同无效。'), {
      code: 'PLATFORM_SAFE_AREA_DOCUMENT_INVALID',
      errors: documentResult.errors,
    });
  }
  const profile = document.profiles.find((item) => item.id === profileId);
  if (!profile) {
    throw Object.assign(new Error(`找不到平台安全区 profile：${profileId}`), {
      code: 'PLATFORM_SAFE_AREA_PROFILE_UNKNOWN',
    });
  }
  return profile;
}
