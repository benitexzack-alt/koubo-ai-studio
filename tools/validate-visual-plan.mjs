import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const [planPath, baselinePath = 'workflow/production-baseline.v1.json'] = process.argv.slice(2);

if (!planPath) {
  console.error('用法：node tools/validate-visual-plan.mjs <visual-plan.json> [production-baseline.json]');
  process.exit(1);
}

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const plan = readJson(planPath);
const baseline = readJson(baselinePath);
const errors = [];
const warnings = [];

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;
const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const generatedProviderPathInfo = (value) => {
  if (!isNonEmptyString(value)) {
    return {isGenerated: false, isExact: true, usesSymlink: false};
  }
  const absolutePath = path.isAbsolute(value)
    ? path.resolve(value)
    : path.resolve(projectRoot, value);
  const projectRelative = path.relative(projectRoot, absolutePath);
  const insideProject =
    projectRelative !== '' &&
    projectRelative !== '..' &&
    !projectRelative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(projectRelative);
  if (!insideProject) {
    return {isGenerated: false, isExact: true, usesSymlink: false};
  }
  const canonicalRelative = projectRelative.split(path.sep).join('/');
  let realRelative = canonicalRelative;
  let usesSymlink = false;
  if (fs.existsSync(absolutePath)) {
    const realAbsolute = fs.realpathSync(absolutePath);
    usesSymlink = realAbsolute !== absolutePath;
    const relation = path.relative(projectRoot, realAbsolute);
    if (
      relation !== '' &&
      relation !== '..' &&
      !relation.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relation)
    ) {
      realRelative = relation.split(path.sep).join('/');
    }
  }
  const fixedPattern =
    /^remotion\/public\/media\/[^/]+\/generated-video\/[^/]+\/G\d{2}\.mp4$/u;
  const isGenerated =
    fixedPattern.test(canonicalRelative) || fixedPattern.test(realRelative);
  return {
    isGenerated,
    isExact:
      !path.isAbsolute(value) &&
      value.replaceAll('\\', '/') === canonicalRelative,
    usesSymlink,
  };
};

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
  if (
    !['candidate-preview-required', 'candidate-preview-approved'].includes(
      plan.experiment?.status,
    )
  ) {
    errors.push(
      'V8 实验状态必须为 candidate-preview-required 或 candidate-preview-approved。',
    );
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
  const declaresCodexProvider =
    layer.assetDecision?.class === 'generated-video' &&
    layer.assetDecision?.producer === 'codex-provider';
  const providerPath = generatedProviderPathInfo(layer.asset?.source);
  const carriesProviderGeneratedAsset =
    layer.asset?.sourceType === 'provider-generated-video' ||
    providerPath.isGenerated;
  if (
    providerPath.isGenerated &&
    (!providerPath.isExact || providerPath.usesSymlink)
  ) {
    errors.push(
      `${label} 的自动生成视频必须使用项目内固定规范路径，不得使用等价别名或符号链接。`,
    );
  }
  if (carriesProviderGeneratedAsset && !declaresCodexProvider) {
    errors.push(
      `${label} 引用了自动生成视频类型或固定路径，必须声明 class=generated-video 且 producer=codex-provider。`,
    );
  }
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
    const producers = new Set([
      'existing',
      'user',
      'codex-remotion',
      ...(plan.schemaVersion === 4 ? ['codex-provider'] : []),
    ]);
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
    if (layer.assetDecision?.class === 'generated-video') {
      const generatedProducer = layer.assetDecision?.producer;
      if (
        generatedProducer !== 'user' &&
        !(plan.schemaVersion === 4 && generatedProducer === 'codex-provider')
      ) {
        errors.push(
          `${label} 的 generated-video 只允许历史 user 路由，或在 schemaVersion=4 使用 codex-provider。`,
        );
      }
    }
    if (
      layer.assetDecision?.producer === 'codex-provider' &&
      layer.assetDecision?.class !== 'generated-video'
    ) {
      errors.push(`${label} 的 codex-provider 只能用于 generated-video。`);
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
      errors.push(`${label} 的 generated-video 必须绑定生成素材 requestId。`);
    }
    if (
      plan.schemaVersion === 4 &&
      declaresCodexProvider
    ) {
      const styleId = 'koubo-paper-construct-v1';
      if (layer.purpose !== 'concept-illustration') {
        errors.push(`${label} 的自动生成插片 purpose 必须为 concept-illustration。`);
      }
      if (layer.asset?.sourceType !== 'provider-generated-video') {
        errors.push(
          `${label} 的自动生成插片 asset.sourceType 必须为 provider-generated-video。`,
        );
      }
      if (layer.assetDecision?.evidenceUse !== 'illustration-only') {
        errors.push(
          `${label} 的自动生成插片 evidenceUse 必须为 illustration-only。`,
        );
      }
      if (layer.assetDecision?.styleReferenceId !== styleId) {
        errors.push(
          `${label} 的自动生成插片 styleReferenceId 必须为 ${styleId}。`,
        );
      }
      if (layer.assetDecision?.fallback !== 'speaker-plus-information') {
        errors.push(
          `${label} 的自动生成插片 fallback 必须为 speaker-plus-information。`,
        );
      }
      if (layer.params?.disclosure !== 'AI生成·概念演绎') {
        errors.push(
          `${label} 的自动生成插片必须显示 disclosure=AI生成·概念演绎。`,
        );
      }
      if (layer.params?.badge !== '非真实业务证据') {
        errors.push(
          `${label} 的自动生成插片必须显示 badge=非真实业务证据。`,
        );
      }
      const expectedRenderSource = isNonEmptyString(layer.asset?.source)
        ? layer.asset.source.replaceAll('\\', '/').replace(/^remotion\/public\//u, '')
        : null;
      if (
        !isNonEmptyString(expectedRenderSource) ||
        layer.params?.src !== expectedRenderSource ||
        (Array.isArray(layer.params?.mediaClips) &&
          layer.params.mediaClips.length > 0)
      ) {
        errors.push(
          `${label} 的自动生成插片必须用 params.src 唯一渲染 asset.source 对应的已QA视频，不得缺失或被 mediaClips 覆盖。`,
        );
      }
      if (!plan.styleReferenceIds?.includes(styleId)) {
        errors.push(`styleReferenceIds 必须包含自动插片风格 ${styleId}。`);
      }
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
