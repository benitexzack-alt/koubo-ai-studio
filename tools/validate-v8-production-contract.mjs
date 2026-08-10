import {existsSync, readFileSync} from 'node:fs';
import {dirname, isAbsolute, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

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

let job;
let plan;
let cueSheet;
try {
  job = readJson(jobArgument, '生产任务');
  plan = readJson(job.inputs?.visualPlan, '视觉方案');
  cueSheet = readJson(job.inputs?.sfxCueSheet, '音效点位表');
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
const cues = Array.isArray(cueSheet.cues) ? cueSheet.cues : [];
const eventIds = new Set();
const cueById = new Map();
const cueIds = new Set();

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
      errors.push(`${label} 的用户生成视频必须使用 media-fullscreen。`);
    }
    if (!isText(layer.asset?.source) || !existsSync(toAbsolute(layer.asset.source))) {
      errors.push(`${label} 的用户生成视频不存在。`);
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
