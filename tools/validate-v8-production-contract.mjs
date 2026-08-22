import {existsSync, readFileSync, realpathSync} from 'node:fs';
import {dirname, isAbsolute, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  generatedVideoRenderSourceFor,
  loadPlanAndStyle,
  validateGeneratedVideoPlan,
} from './generated-video-plan-core.mjs';

const [jobArgument] = process.argv.slice(2);

if (!jobArgument) {
  console.error('用法：node tools/validate-v8-production-contract.mjs <production-job.json>');
  process.exit(1);
}

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const toAbsolute = (filePath) =>
  isAbsolute(filePath) ? filePath : resolve(projectRoot, filePath);
const readJson = (filePath, label) => {
  const absolutePath = toAbsolute(filePath);
  if (!existsSync(absolutePath)) throw new Error(`${label}不存在：${filePath}`);
  return JSON.parse(readFileSync(absolutePath, 'utf8'));
};
const isText = (value) => typeof value === 'string' && value.trim().length > 0;
const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const generatedProviderPathInfo = (value) => {
  if (!isText(value)) {
    return {isGenerated: false, isExact: true, usesSymlink: false};
  }
  const absolutePath = toAbsolute(value);
  const projectRelative = relative(projectRoot, absolutePath);
  const insideProject =
    projectRelative !== '' &&
    projectRelative !== '..' &&
    !projectRelative.startsWith(`..${sep}`) &&
    !isAbsolute(projectRelative);
  if (!insideProject) {
    return {isGenerated: false, isExact: true, usesSymlink: false};
  }
  const canonicalRelative = projectRelative.split(sep).join('/');
  let realRelative = canonicalRelative;
  let usesSymlink = false;
  if (existsSync(absolutePath)) {
    const realAbsolute = realpathSync(absolutePath);
    usesSymlink = realAbsolute !== absolutePath;
    const relation = relative(projectRoot, realAbsolute);
    if (
      relation !== '' &&
      relation !== '..' &&
      !relation.startsWith(`..${sep}`) &&
      !isAbsolute(relation)
    ) {
      realRelative = relation.split(sep).join('/');
    }
  }
  const fixedPattern =
    /^remotion\/public\/media\/[^/]+\/generated-video\/[^/]+\/G\d{2}\.mp4$/u;
  return {
    isGenerated:
      fixedPattern.test(canonicalRelative) || fixedPattern.test(realRelative),
    isExact:
      !isAbsolute(value) && value.replaceAll('\\', '/') === canonicalRelative,
    usesSymlink,
  };
};
const isProviderGeneratedLayer = (layer) =>
  (layer.assetDecision?.class === 'generated-video' &&
    layer.assetDecision?.producer === 'codex-provider') ||
  layer.asset?.sourceType === 'provider-generated-video' ||
  generatedProviderPathInfo(layer.asset?.source).isGenerated;

let job;
let plan;
let cueSheet;
let sfxManifest;
try {
  job = readJson(jobArgument, '生产任务');
  plan = readJson(job.inputs?.visualPlan, '视觉方案');
  cueSheet = readJson(job.inputs?.sfxCueSheet, '音效点位表');
  sfxManifest = readJson(
    job.inputs?.sfxManifest ?? 'assets/sfx/koubo-sfx-v8/manifest.json',
    'V8音效审核清单',
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const errors = [];
const warnings = [];
const experimentId = 'v8-semantic-continuity-sfx';
const previewRequiredStatus = 'candidate-preview-required';
const previewApprovedStatus = 'candidate-preview-approved';
const previewApproved = job.experiment?.status === previewApprovedStatus;

if (job.experiment?.id !== experimentId) {
  errors.push(`生产任务必须声明 experiment.id=${experimentId}。`);
}
if (![previewRequiredStatus, previewApprovedStatus].includes(job.experiment?.status)) {
  errors.push(
    `V8 候选任务状态必须为 ${previewRequiredStatus} 或 ${previewApprovedStatus}。`,
  );
}
if (plan.schemaVersion !== 4 || plan.experiment?.id !== experimentId) {
  errors.push('视觉方案必须为 schemaVersion=4 的 V8 连续语义方案。');
}
if (cueSheet.schemaVersion !== 3 || cueSheet.experimentId !== experimentId) {
  errors.push('音效点位表必须为 schemaVersion=3 的 V8 音效方案。');
}
if (job.videoId !== plan.videoId || cueSheet.videoId !== plan.videoId) {
  errors.push('生产任务、视觉方案和音效点位表的 videoId 必须一致。');
}
if (previewApproved) {
  if (
    job.formal?.enabled !== true ||
    job.experiment?.userPreviewApproved !== true ||
    !isText(job.experiment?.userPreviewApprovedAt)
  ) {
    errors.push(
      'V8 预览通过后必须同时记录 formal.enabled=true、userPreviewApproved=true 和确认时间。',
    );
  }
} else if (
  job.formal?.enabled !== false ||
  job.experiment?.userPreviewApproved !== false
) {
  errors.push(
    'V8 候选预览在用户确认前必须保持 formal.enabled=false 且 userPreviewApproved=false。',
  );
}

const previewRanges = Array.isArray(job.preview?.ranges) ? job.preview.ranges : [];
const continuousPreview = previewRanges.find(
  (range) =>
    isNumber(range.startSeconds) &&
    isNumber(range.endSeconds) &&
    range.endSeconds - range.startSeconds >= 30 &&
    range.endSeconds - range.startSeconds <= 45.1,
);
if (!continuousPreview) {
  errors.push('V8 必须提供同一连续画面的 30–45 秒动态试听预览。');
}
if (job.preview?.renderWithoutSfxComparison !== true) {
  errors.push('V8 预览必须生成完全同画面的无音效对照。');
}
const inPreview = (time) =>
  previewRanges.some(
    (range) =>
      isNumber(range.startSeconds) &&
      isNumber(range.endSeconds) &&
      time >= range.startSeconds &&
      time <= range.endSeconds,
  );

const requiredCoverage = [
  'speaker-overlay',
  'media-fullscreen',
  'progressive-process',
  'source-evidence',
  'hero-emphasis',
  'sfx-ab',
];
for (const item of requiredCoverage) {
  if (!plan.previewCoverage?.includes(item)) {
    errors.push(`V8 预览覆盖缺少：${item}`);
  }
}

const layers = Array.isArray(plan.layers) ? plan.layers : [];
const providerLayers = layers.filter(isProviderGeneratedLayer);
const cues = Array.isArray(cueSheet.cues) ? cueSheet.cues : [];
const auditedSfxByOutput = new Map(
  (Array.isArray(sfxManifest.items) ? sfxManifest.items : []).map((item) => [
    item.output,
    item,
  ]),
);
const eventIds = new Set();
const cueById = new Map();
const cueIds = new Set();

if (providerLayers.length > 0) {
  for (const layer of providerLayers) {
    const providerPath = generatedProviderPathInfo(layer.asset?.source);
    if (
      providerPath.isGenerated &&
      (!providerPath.isExact || providerPath.usesSymlink)
    ) {
      errors.push(
        `图层 ${layer.id ?? '未命名'} 的自动生成视频必须使用项目内固定规范路径，不得使用等价别名或符号链接。`,
      );
    }
    if (
      layer.assetDecision?.class !== 'generated-video' ||
      layer.assetDecision?.producer !== 'codex-provider'
    ) {
      errors.push(
        `图层 ${layer.id ?? '未命名'} 引用了自动生成视频类型或固定路径，必须声明 generated-video + codex-provider。`,
      );
    }
    if (layer.asset?.sourceType !== 'provider-generated-video') {
      errors.push(
        `图层 ${layer.id ?? '未命名'} 的自动生成插片 asset.sourceType 必须为 provider-generated-video。`,
      );
    }
  }
  const generatedPlanPath = job.inputs?.generatedVideoPlan;
  if (!isText(generatedPlanPath)) {
    errors.push('V8 自动生成插片必须提供 job.inputs.generatedVideoPlan。');
  } else {
    try {
      const loaded = loadPlanAndStyle(generatedPlanPath);
      const generatedPlan = loaded.plan;
      const validation = validateGeneratedVideoPlan(generatedPlan, loaded.style, {
        phase: 'materialized',
      });
      for (const error of validation.errors) {
        errors.push(`生成视频计划未通过 materialized 校验：${error.code} ${error.message}`);
      }
      if (generatedPlan.productionStatus !== 'qa-passed') {
        errors.push(
          '生成视频计划 productionStatus 必须为 qa-passed，才能进入 V8 生产。',
        );
      }
      if (
        !isText(generatedPlan.visualPlan) ||
        toAbsolute(generatedPlan.visualPlan) !== toAbsolute(job.inputs.visualPlan)
      ) {
        errors.push('生成视频计划 visualPlan 必须精确绑定当前 V8 视觉方案。');
      }
      if (generatedPlan.videoId !== plan.videoId) {
        errors.push('生成视频计划与 V8 视觉方案的 videoId 必须一致。');
      }

      const shots = Array.isArray(generatedPlan.shots) ? generatedPlan.shots : [];
      if (shots.length !== providerLayers.length) {
        errors.push(
          `V8 自动生成图层数 ${providerLayers.length} 与拆镜数 ${shots.length} 不一致。`,
        );
      }
      const providerLayerById = new Map(
        providerLayers.map((layer) => [layer.id, layer]),
      );
      const seenLayerIds = new Set();
      const seenRequestIds = new Set();
      for (const shot of shots) {
        if (seenLayerIds.has(shot.layerId)) {
          errors.push(`生成视频镜头 layerId 重复：${shot.layerId}`);
        }
        if (seenRequestIds.has(shot.requestId)) {
          errors.push(`生成视频镜头 requestId 重复：${shot.requestId}`);
        }
        seenLayerIds.add(shot.layerId);
        seenRequestIds.add(shot.requestId);
        const layer = providerLayerById.get(shot.layerId);
        if (!layer) {
          errors.push(`生成视频镜头 ${shot.id ?? '未命名'} 找不到图层 ${shot.layerId ?? '未填写'}。`);
          continue;
        }
        if (layer.assetDecision?.requestId !== shot.requestId) {
          errors.push(
            `图层 ${layer.id} 与生成镜头 ${shot.id ?? '未命名'} 的 requestId 不一致。`,
          );
        }
        if (
          !isText(shot.output?.videoPath) ||
          !isText(layer.asset?.source) ||
          toAbsolute(shot.output.videoPath) !== toAbsolute(layer.asset.source)
        ) {
          errors.push(`图层 ${layer.id} 的视频路径与生成镜头产物不一致。`);
        }
        const expectedRenderSource = generatedVideoRenderSourceFor(
          generatedPlan.videoId,
          generatedPlan.planId,
          shot.id,
        );
        if (
          layer.params?.src !== expectedRenderSource ||
          (Array.isArray(layer.params?.mediaClips) &&
            layer.params.mediaClips.length > 0)
        ) {
          errors.push(
            `图层 ${layer.id} 的实际 Remotion 渲染源必须唯一绑定已QA视频 ${expectedRenderSource}。`,
          );
        }
      }

      const requiredFingerprintPaths = [
        generatedPlanPath,
        generatedPlan.styleReference?.path,
        generatedPlan.outputs?.approvalReceiptPath,
        generatedPlan.outputs?.ledgerPath,
        generatedPlan.outputs?.contactSheetPath,
        generatedPlan.outputs?.qaReportPath,
        ...shots.flatMap((shot) => [
          shot.output?.videoPath,
          shot.qa?.contactSheetPath,
          shot.qa?.reportPath,
        ]),
      ].filter(isText);
      const fingerprintPaths = Array.isArray(job.inputs?.fingerprintPaths)
        ? job.inputs.fingerprintPaths.filter(isText)
        : [];
      const fingerprintSet = new Set(fingerprintPaths.map(toAbsolute));
      if (!Array.isArray(job.inputs?.fingerprintPaths)) {
        errors.push('V8 自动生成插片必须提供 job.inputs.fingerprintPaths。');
      }
      for (const requiredPath of requiredFingerprintPaths) {
        if (!fingerprintSet.has(toAbsolute(requiredPath))) {
          errors.push(`自动生成插片产物未纳入 fingerprintPaths：${requiredPath}`);
        }
      }
    } catch (error) {
      errors.push(
        `生成视频计划读取失败：${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

for (const cue of cues) {
  if (!isText(cue.id)) {
    errors.push('音效点存在缺失 id 的项目。');
    continue;
  }
  if (cueIds.has(cue.id)) errors.push(`音效点 id 重复：${cue.id}`);
  cueIds.add(cue.id);
  cueById.set(cue.id, cue);
  if (!isText(cue.source) || !existsSync(toAbsolute(cue.source))) {
    errors.push(`音效点 ${cue.id} 的 source 不存在。`);
  }
  if (
    /\/(?:[^/]+-)?(?:correction-not-equal|voice[-_ ]?patch|speech[-_ ]?patch)\.wav$/i.test(
      cue.source,
    )
  ) {
    errors.push(`音效点 ${cue.id} 引用了人声补丁，禁止作为动效音效：${cue.source}`);
  }
  if (cue.source.includes('/koubo-sfx-v8/')) {
    const auditedItem = auditedSfxByOutput.get(cue.source);
    if (!auditedItem) {
      errors.push(`音效点 ${cue.id} 未进入 V8 音效审核清单：${cue.source}`);
    } else if (
      auditedItem.contentKind !== 'sound-effect' ||
      auditedItem.eligibleForSfx !== true
    ) {
      errors.push(`音效点 ${cue.id} 的来源未获准作为音效：${cue.source}`);
    }
  }
  if (!isNumber(cue.volume) || cue.volume < 0.2 || cue.volume > 0.55) {
    errors.push(`音效点 ${cue.id} 的候选音量必须在 0.20–0.55。`);
  }
  const expectedAudibility = previewApproved && inPreview(cue.start);
  if (cue.userAudibilityConfirmed !== expectedAudibility) {
    errors.push(
      `音效点 ${cue.id} 的 userAudibilityConfirmed 必须与实际预览覆盖范围一致。`,
    );
  }
}

let previousFamily = null;
let repeatedFamilyCount = 0;
let primaryCount = 0;
let coveredPrimaryCount = 0;
const fps = Number(job.remotion?.fps ?? plan.target?.fps);

for (const [index, layer] of layers.entries()) {
  const label = `layers[${index}](${layer.id ?? '未命名'})`;
  const presentation = layer.presentation;
  const event = layer.visualEvent;

  if (!isText(presentation?.semanticFamily)) {
    errors.push(`${label} 缺少 presentation.semanticFamily。`);
  }
  if (!['speaker-overlay', 'media-fullscreen'].includes(presentation?.renderMode)) {
    errors.push(`${label} 缺少有效的 presentation.renderMode。`);
  }
  if (!isNumber(presentation?.coverageRatio) || presentation.coverageRatio <= 0) {
    errors.push(`${label} 缺少有效的 presentation.coverageRatio。`);
  }
  if (presentation?.semanticFamily === previousFamily) repeatedFamilyCount += 1;
  else repeatedFamilyCount = 1;
  previousFamily = presentation?.semanticFamily;
  if (repeatedFamilyCount > 2) {
    errors.push(`${label} 造成同一布局族连续出现超过 2 次。`);
  }

  if (layer.assetDecision?.class === 'remotion-information') {
    if (presentation?.renderMode !== 'speaker-overlay') {
      errors.push(`${label} 的 Remotion 信息动画必须保留人物主画面。`);
    }
    if (presentation?.coverageRatio > 0.42) {
      errors.push(`${label} 的局部覆盖率超过 42%。`);
    }
    if (layer.zone === 'full-screen' || layer.background === 'opaque') {
      errors.push(`${label} 的说明型 Remotion 场景禁止全屏或不透明背景。`);
    }
    if (layer.params?.component === 'call-demo') {
      errors.push(`${label} 仍使用被退回的全屏 call-demo 组件。`);
    }
    if (
      !isNumber(layer.checks?.continuousReviewIntervalSeconds) ||
      layer.checks.continuousReviewIntervalSeconds > 0.5
    ) {
      errors.push(`${label} 必须按不高于 0.5 秒间隔执行连续人物安全检查。`);
    }
  }

  if (layer.assetDecision?.class === 'generated-video') {
    if (presentation?.renderMode !== 'media-fullscreen') {
      errors.push(`${label} 的生成视频必须使用 media-fullscreen。`);
    }
    if (!isText(layer.asset?.source) || !existsSync(toAbsolute(layer.asset.source))) {
      errors.push(`${label} 的生成视频不存在。`);
    }
    if (layer.assetDecision?.producer === 'codex-provider') {
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
    }
  }

  if (!isText(event?.id) || eventIds.has(event?.id)) {
    errors.push(`${label} 缺少唯一 visualEvent.id。`);
    continue;
  }
  eventIds.add(event.id);
  if (event.primary !== true) continue;
  primaryCount += 1;

  const cue = cueById.get(layer.sound?.cueId);
  if (layer.sound?.policy !== 'required' || !cue) {
    errors.push(`${label} 的主视觉没有绑定必需音效。`);
    continue;
  }
  if (cue.visualEventId !== event.id || cue.role !== layer.sound.role) {
    errors.push(`${label} 的声画事件绑定不一致。`);
    continue;
  }
  const expectedFrame = Math.round(event.enterAt * fps) + (layer.sound.offsetFrames ?? 0);
  const actualFrame = Math.round(cue.start * fps);
  if (Math.abs(expectedFrame - actualFrame) > 2) {
    errors.push(`${label} 的音效与视觉入场偏差超过 2 帧。`);
    continue;
  }
  coveredPrimaryCount += 1;
}

const orderedCues = [...cues].sort((left, right) => left.start - right.start);
const sourceUse = new Map();
const roleSources = new Map();
for (let index = 0; index < orderedCues.length; index += 1) {
  const cue = orderedCues[index];
  const previous = orderedCues[index - 1];
  if (previous?.source === cue.source) {
    errors.push(`连续音效不得复用同一文件：${cue.source}`);
  }
  const times = sourceUse.get(cue.source) ?? [];
  if (times.some((time) => Math.abs(cue.start - time) < 25)) {
    errors.push(`同一音效文件 25 秒内重复：${cue.source}`);
  }
  times.push(cue.start);
  sourceUse.set(cue.source, times);
  const sources = roleSources.get(cue.role) ?? new Set();
  sources.add(cue.source);
  roleSources.set(cue.role, sources);
}
for (const [source, times] of sourceUse) {
  if (times.length > 3) errors.push(`单一音效文件全片使用超过 3 次：${source}`);
}
for (const [role, sources] of roleSources) {
  const roleCount = cues.filter((cue) => cue.role === role).length;
  if (roleCount >= 3 && sources.size < 3) {
    errors.push(`高频音效角色 ${role} 使用 ${roleCount} 次，却不足 3 个实际音色。`);
  }
}

for (const role of job.experiment?.previewAuditionRoles ?? []) {
  const matching = cues.filter((cue) => cue.role === role);
  if (!matching.some((cue) => inPreview(cue.start))) {
    errors.push(`试听角色未进入代表性预览：${role}`);
  }
}

if (primaryCount === 0 || coveredPrimaryCount !== primaryCount) {
  errors.push(`主视觉音效覆盖 ${coveredPrimaryCount}/${primaryCount}，要求 100%。`);
}
if (layers.length > 0 && layers.filter((layer) => inPreview(layer.start)).length < 5) {
  warnings.push('连续预览内少于 5 个视觉事件，可能不足以判断节奏层级。');
}

for (const warning of warnings) console.warn(`警告：${warning}`);
if (errors.length > 0) {
  console.error(`V8 生产合同校验失败：${errors.length} 项`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `V8 生产合同校验通过：${plan.videoId}，${layers.length} 个视觉事件，` +
    `${roleSources.size} 类音效，${
      previewApproved
        ? '用户预览已通过，完整候选片渲染已解锁'
        : '正式渲染仍被用户预览门禁锁定'
    }。`,
);
