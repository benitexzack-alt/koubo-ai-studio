import fs from 'node:fs';

const [planPath, baselinePath = 'workflow/production-baseline.v1.json'] = process.argv.slice(2);

if (!planPath) {
  console.error('用法：node tools/validate-visual-plan.mjs <visual-plan.json> [production-baseline.json]');
  process.exit(1);
}

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const plan = readJson(planPath);
const baseline = readJson(baselinePath);
const errors = [];
const warnings = [];

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;
const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);

if (![2, 3, 4].includes(plan.schemaVersion)) {
  errors.push('visual-plan 必须使用 schemaVersion=2、3 或 4。');
}

if (plan.schemaVersion === 3) {
  if (plan.experiment?.id !== 'v73-media-sfx-speed') {
    errors.push('schemaVersion=3 必须声明 experiment.id=v73-media-sfx-speed。');
  }
  if (plan.experiment?.status !== 'ready-for-next-video-validation') {
    errors.push('V7.3 实验状态必须为 ready-for-next-video-validation。');
  }
}

if (plan.schemaVersion === 4) {
  if (plan.experiment?.id !== 'v8-semantic-continuity-sfx') {
    errors.push('schemaVersion=4 必须声明 experiment.id=v8-semantic-continuity-sfx。');
  }
  if (plan.experiment?.status !== 'candidate-preview-required') {
    errors.push('V8 实验状态必须为 candidate-preview-required。');
  }
}

for (const key of ['videoId', 'videoTitle', 'sourceVideo', 'baselineId']) {
  if (!isNonEmptyString(plan[key])) {
    errors.push(`缺少必填字段：${key}`);
  }
}

if (plan.baselineId !== baseline.baselineId) {
  errors.push(`visual-plan 的 baselineId=${plan.baselineId} 与当前基线=${baseline.baselineId} 不一致。`);
}

if (!Array.isArray(plan.styleReferenceIds)) {
  errors.push('styleReferenceIds 必须是数组。');
}

if (!Array.isArray(plan.previewCoverage)) {
  errors.push('previewCoverage 必须是数组。');
} else {
  for (const required of baseline.previewGate.minimumCoverage ?? []) {
    if (!plan.previewCoverage.includes(required)) {
      errors.push(`预览覆盖缺少：${required}`);
    }
  }
}

const layers = Array.isArray(plan.layers) ? plan.layers : null;
if (!layers) {
  errors.push('layers 必须是数组。');
}

const titleLayers = [];
const reviewLayers = [];

for (const [index, layer] of (layers ?? []).entries()) {
  const label = `layers[${index}]`;
  for (const key of ['id', 'spokenLine', 'purpose', 'kind', 'overlapGroup', 'zone']) {
    if (!isNonEmptyString(layer[key])) {
      errors.push(`${label} 缺少必填字段：${key}`);
    }
  }

  if (!isNumber(layer.start) || !isNumber(layer.end) || layer.end <= layer.start) {
    errors.push(`${label} 的 start/end 必须是有效且递增的秒数。`);
  }

  if (typeof layer.titleOwner !== 'boolean') {
    errors.push(`${label} 必须声明 titleOwner=true 或 false。`);
  }

  if (!layer.asset || !isNonEmptyString(layer.asset.sourceType)) {
    errors.push(`${label} 缺少 asset.sourceType。`);
  }

  if (!layer.checks || typeof layer.checks.needsFrameReview !== 'boolean') {
    errors.push(`${label} 必须声明 checks.needsFrameReview。`);
  }

  if (plan.schemaVersion >= 3) {
    const assetClasses = new Set([
      'speaker',
      'real-evidence',
      'generated-video',
      'remotion-information',
    ]);
    const producers = new Set(['existing', 'user', 'codex-remotion']);
    const soundPolicies = new Set(['required', 'optional', 'none']);
    const silentLayerKinds = new Set([
      'speaker-base',
      'camera-only',
      'subtitle-only',
      'ambient-overlay',
    ]);

    if (!assetClasses.has(layer.assetDecision?.class)) {
      errors.push(`${label} 缺少有效的 assetDecision.class。`);
    }
    if (!producers.has(layer.assetDecision?.producer)) {
      errors.push(`${label} 缺少有效的 assetDecision.producer。`);
    }
    if (!isNonEmptyString(layer.assetDecision?.fallback)) {
      errors.push(`${label} 缺少 assetDecision.fallback。`);
    }
    if (
      layer.assetDecision?.class === 'generated-video' &&
      layer.assetDecision?.producer !== 'user'
    ) {
      errors.push(`${label} 的 generated-video 必须由 user 负责制作。`);
    }
    if (
      layer.assetDecision?.class === 'remotion-information' &&
      layer.assetDecision?.producer !== 'codex-remotion'
    ) {
      errors.push(`${label} 的 remotion-information 必须由 codex-remotion 负责。`);
    }
    if (
      layer.assetDecision?.class === 'generated-video' &&
      !isNonEmptyString(layer.assetDecision?.requestId)
    ) {
      errors.push(`${label} 的 generated-video 必须绑定用户素材执行单 requestId。`);
    }

    if (!isNonEmptyString(layer.visualEvent?.id)) {
      errors.push(`${label} 缺少 visualEvent.id。`);
    }
    if (
      !isNumber(layer.visualEvent?.enterAt) ||
      layer.visualEvent.enterAt < layer.start ||
      layer.visualEvent.enterAt > layer.end
    ) {
      errors.push(`${label} 的 visualEvent.enterAt 必须落在图层时间范围内。`);
    }
    if (typeof layer.visualEvent?.primary !== 'boolean') {
      errors.push(`${label} 必须声明 visualEvent.primary。`);
    }
    if (
      !silentLayerKinds.has(layer.kind) &&
      layer.visualEvent?.primary !== true
    ) {
      errors.push(
        `${label} 是可见信息或媒体单元，visualEvent.primary 必须为 true。`,
      );
    }

    if (!soundPolicies.has(layer.sound?.policy)) {
      errors.push(`${label} 缺少有效的 sound.policy。`);
    }
    if (layer.visualEvent?.primary && layer.sound?.policy !== 'required') {
      errors.push(`${label} 是主视觉单元，sound.policy 必须为 required。`);
    }
    if (layer.sound?.policy === 'required') {
      if (!isNonEmptyString(layer.sound?.role)) {
        errors.push(`${label} 的必需音效缺少 sound.role。`);
      }
      if (!isNonEmptyString(layer.sound?.cueId)) {
        errors.push(`${label} 的必需音效缺少 sound.cueId。`);
      }
      if (!Number.isInteger(layer.sound?.offsetFrames)) {
        errors.push(`${label} 的 sound.offsetFrames 必须是整数。`);
      }
      if (
        !Number.isInteger(layer.sound?.maxSyncErrorFrames) ||
        layer.sound.maxSyncErrorFrames < 0 ||
        layer.sound.maxSyncErrorFrames > 2
      ) {
        errors.push(`${label} 的 sound.maxSyncErrorFrames 必须是 0–2 的整数。`);
      }
    }
  }

  if (layer.checks?.needsFrameReview) {
    if (!isNumber(layer.checks.reviewAt) || layer.checks.reviewAt < layer.start || layer.checks.reviewAt > layer.end) {
      errors.push(`${label} 的 reviewAt 必须落在该图层时间范围内。`);
    }
    reviewLayers.push(layer);
  }

  if (layer.titleOwner) {
    titleLayers.push(layer);
  }

  if (layer.kind === 'full-screen-asset' && !isNonEmptyString(layer.asset.source)) {
    errors.push(`${label} 是全屏素材，但没有 asset.source。`);
  }
}

for (let left = 0; left < titleLayers.length; left += 1) {
  for (let right = left + 1; right < titleLayers.length; right += 1) {
    const a = titleLayers[left];
    const b = titleLayers[right];
    const overlaps = a.start < b.end && b.start < a.end;
    if (overlaps && a.overlapGroup === b.overlapGroup) {
      errors.push(`标题冲突：${a.id} 与 ${b.id} 在 overlapGroup=${a.overlapGroup} 同时拥有标题。`);
    }
  }
}

if ((layers ?? []).some((layer) => layer.kind === 'full-screen-asset') && !plan.previewCoverage?.includes('full-screen-asset')) {
  errors.push('存在全屏素材，但预览没有覆盖 full-screen-asset。');
}

if (reviewLayers.length < 4) {
  warnings.push('风险抽帧少于 4 个；正式长视频建议至少覆盖首屏、复杂叠层、全屏素材和结尾。');
}

for (const item of warnings) {
  console.warn(`警告：${item}`);
}

if (errors.length > 0) {
  console.error(`视觉方案校验失败：${errors.length} 项`);
  for (const item of errors) {
    console.error(`- ${item}`);
  }
  process.exit(1);
}

console.log(`视觉方案校验通过：${plan.videoId}，${layers.length} 个图层，${reviewLayers.length} 个风险抽帧。`);
