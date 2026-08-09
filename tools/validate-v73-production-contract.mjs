import {existsSync, readFileSync} from 'node:fs';
import {dirname, isAbsolute, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const [jobArgument] = process.argv.slice(2);

if (!jobArgument) {
  console.error('用法：node tools/validate-v73-production-contract.mjs <production-job.json>');
  process.exit(1);
}

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const toAbsolute = (filePath) =>
  isAbsolute(filePath) ? filePath : resolve(projectRoot, filePath);
const readJson = (filePath, label) => {
  const absolutePath = toAbsolute(filePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`${label}不存在：${filePath}`);
  }
  try {
    return JSON.parse(readFileSync(absolutePath, 'utf8'));
  } catch (error) {
    throw new Error(
      `${label}无法解析：${filePath}（${error instanceof Error ? error.message : String(error)}）`,
    );
  }
};

const errors = [];
const warnings = [];
const isText = (value) => typeof value === 'string' && value.trim().length > 0;
const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);

let job;
let plan;
let cueSheet;
let recordedSourceAudit;

try {
  job = readJson(jobArgument, '生产任务');
  plan = readJson(job.inputs?.visualPlan, '视觉方案');
  cueSheet = readJson(job.inputs?.sfxCueSheet, '音效点位表');
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

if (job.schemaVersion === 2) {
  if (!isText(job.inputs?.recordedSourceAudit)) {
    errors.push('schemaVersion=2 的生产任务必须绑定 inputs.recordedSourceAudit。');
  } else {
    try {
      recordedSourceAudit = readJson(
        job.inputs.recordedSourceAudit,
        '实拍源审计',
      );
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
}

if (recordedSourceAudit) {
  if (recordedSourceAudit.schema_version !== 1) {
    errors.push('实拍源审计只支持 schema_version=1。');
  }
  if (recordedSourceAudit.video_id !== job.videoId) {
    errors.push('实拍源审计的 video_id 与生产任务不一致。');
  }
  if (recordedSourceAudit.recorded_source?.path !== job.inputs?.source) {
    errors.push('实拍源审计绑定的原片与生产任务 inputs.source 不一致。');
  }
  if (recordedSourceAudit.recorded_source?.full_decode !== 'passed') {
    errors.push('实拍源审计未通过原片完整解码。');
  }
  if (recordedSourceAudit.locked_script?.policy !== 'verbatim-lock') {
    errors.push('实拍源审计未声明 verbatim-lock 锁稿策略。');
  }
  if (recordedSourceAudit.status !== 'passed') {
    errors.push(`实拍源审计未通过：${recordedSourceAudit.status ?? '状态缺失'}。`);
  }
  const sourceMismatches = Array.isArray(recordedSourceAudit.blocking_mismatches)
    ? recordedSourceAudit.blocking_mismatches
    : [];
  if (sourceMismatches.length > 0) {
    errors.push(`实拍源审计仍有 ${sourceMismatches.length} 个阻断差异。`);
  }
}

if (job.experiment?.id !== 'v73-media-sfx-speed') {
  errors.push('生产任务必须声明 experiment.id=v73-media-sfx-speed。');
}
if (job.experiment?.status !== 'ready-for-next-video-validation') {
  errors.push('生产任务的 experiment.status 必须为 ready-for-next-video-validation。');
}
if (plan.schemaVersion !== 3 || plan.experiment?.id !== job.experiment?.id) {
  errors.push('视觉方案必须为与生产任务一致的 V7.3 schemaVersion=3 实验方案。');
}
if (job.videoId !== plan.videoId || cueSheet.videoId !== plan.videoId) {
  errors.push('production job、visual plan 和 sfx cue sheet 的 videoId 必须完全一致。');
}

const fps = Number(job.remotion?.fps ?? plan.target?.fps);
if (!Number.isInteger(fps) || fps <= 0) {
  errors.push('生产任务缺少有效的整数 fps。');
}
if (!isText(job.reports?.timingReport)) {
  errors.push('生产任务必须预先声明 reports.timingReport 路径。');
}
if (job.experiment?.fullLengthLowResPreview?.enabled === true) {
  if (!isText(job.experiment.fullLengthLowResPreview.reason)) {
    errors.push('启用全长低清预览时必须写明 reason。');
  }
} else if (job.experiment?.fullLengthLowResPreview?.enabled !== false) {
  errors.push('V7.3 生产任务必须明确声明 fullLengthLowResPreview.enabled=false，或开启并写明原因。');
}

const previewRanges = Array.isArray(job.preview?.ranges) ? job.preview.ranges : [];
if (previewRanges.length === 0) {
  errors.push('生产任务必须配置代表性预览区间。');
}
const inPreview = (time) =>
  previewRanges.some(
    (range) =>
      isNumber(range.startSeconds) &&
      isNumber(range.endSeconds) &&
      time >= range.startSeconds &&
      time <= range.endSeconds,
  );

const layers = Array.isArray(plan.layers) ? plan.layers : [];
const cues = Array.isArray(cueSheet.cues) ? cueSheet.cues : [];
const silentLayerKinds = new Set([
  'speaker-base',
  'camera-only',
  'subtitle-only',
  'ambient-overlay',
]);
const eventIds = new Set();
const cueIds = new Set();
const cueById = new Map();

for (const cue of cues) {
  if (!isText(cue.id)) {
    errors.push('音效点存在缺失 id 的项目。');
    continue;
  }
  if (cueIds.has(cue.id)) {
    errors.push(`音效点 id 重复：${cue.id}`);
  }
  cueIds.add(cue.id);
  cueById.set(cue.id, cue);
}

let primaryCount = 0;
let coveredPrimaryCount = 0;
const roleCounts = new Map();

for (const [index, layer] of layers.entries()) {
  const label = `layers[${index}](${layer.id ?? '未命名'})`;
  const event = layer.visualEvent;
  const sound = layer.sound;

  if (!isText(event?.id)) {
    errors.push(`${label} 缺少 visualEvent.id。`);
    continue;
  }
  if (eventIds.has(event.id)) {
    errors.push(`visualEvent.id 重复：${event.id}`);
  }
  eventIds.add(event.id);

  if (!isNumber(event.enterAt)) {
    errors.push(`${label} 缺少有效的 visualEvent.enterAt。`);
  }

  if (layer.assetDecision?.class === 'generated-video') {
    if (layer.assetDecision?.producer !== 'user') {
      errors.push(`${label} 的叙事生成视频不得交给 Remotion 制作。`);
    }
    if (!isText(layer.assetDecision?.requestId)) {
      errors.push(`${label} 的用户生成视频缺少 requestId。`);
    }
    if (!isText(layer.asset?.source) || !existsSync(toAbsolute(layer.asset.source))) {
      errors.push(`${label} 的用户生成视频尚未放入指定 asset.source。`);
    }
  }
  if (
    layer.assetDecision?.class === 'remotion-information' &&
    layer.assetDecision?.producer !== 'codex-remotion'
  ) {
    errors.push(`${label} 的 Remotion 信息动画制作责任错误。`);
  }

  if (!silentLayerKinds.has(layer.kind) && event.primary !== true) {
    errors.push(`${label} 是可见信息或媒体单元，不得标记为非主事件逃避音效。`);
  }

  if (!event.primary) {
    continue;
  }
  primaryCount += 1;

  if (sound?.policy !== 'required') {
    errors.push(`${label} 是主视觉单元，但未声明必需音效。`);
    continue;
  }
  const cue = cueById.get(sound.cueId);
  if (!cue) {
    errors.push(`${label} 绑定的音效点不存在：${sound.cueId ?? '未填'}`);
    continue;
  }
  if (cue.visualEventId !== event.id) {
    errors.push(`${label} 与音效点 ${cue.id} 的 visualEventId 不一致。`);
    continue;
  }
  if (cue.role !== sound.role) {
    errors.push(`${label} 与音效点 ${cue.id} 的 role 不一致。`);
    continue;
  }
  if (!isNumber(cue.start)) {
    errors.push(`音效点 ${cue.id} 缺少有效的 start。`);
    continue;
  }
  if (!isText(cue.source) || !existsSync(toAbsolute(cue.source))) {
    errors.push(`音效点 ${cue.id} 的 source 不存在。`);
    continue;
  }

  const offsetFrames = Number.isInteger(sound.offsetFrames)
    ? sound.offsetFrames
    : 0;
  const expectedFrame = Math.round(event.enterAt * fps) + offsetFrames;
  const actualFrame = Math.round(cue.start * fps);
  const deltaFrames = Math.abs(actualFrame - expectedFrame);
  const tolerance = Number.isInteger(sound.maxSyncErrorFrames)
    ? sound.maxSyncErrorFrames
    : 2;
  if (deltaFrames > tolerance || deltaFrames > 2) {
    errors.push(
      `${label} 的音效 ${cue.id} 与入场偏差 ${deltaFrames} 帧，超过允许的 ${Math.min(tolerance, 2)} 帧。`,
    );
    continue;
  }

  coveredPrimaryCount += 1;
  roleCounts.set(cue.role, (roleCounts.get(cue.role) ?? 0) + 1);
}

const auditionRoles = Array.isArray(job.experiment?.previewAuditionRoles)
  ? job.experiment.previewAuditionRoles
  : [];
for (const role of auditionRoles) {
  const matchingCues = cues.filter((cue) => cue.role === role);
  if (matchingCues.length === 0) {
    errors.push(`试听角色没有对应音效点：${role}`);
  } else if (!matchingCues.some((cue) => isNumber(cue.start) && inPreview(cue.start))) {
    errors.push(`试听角色未被代表性预览覆盖：${role}`);
  }
}

if (primaryCount === 0) {
  errors.push('视觉方案没有任何 primary=true 的主视觉单元。');
}

const generatedVideoLayers = layers.filter(
  (layer) => layer.assetDecision?.class === 'generated-video',
);
if (generatedVideoLayers.length > 0) {
  if (!isText(job.experiment?.userMediaRequest)) {
    errors.push('存在用户生成视频，但生产任务没有绑定 userMediaRequest 执行单。');
  } else if (!existsSync(toAbsolute(job.experiment.userMediaRequest))) {
    errors.push(`用户素材执行单不存在：${job.experiment.userMediaRequest}`);
  }
}

for (const cue of cues) {
  if (isText(cue.visualEventId) && !eventIds.has(cue.visualEventId)) {
    warnings.push(`音效点 ${cue.id} 绑定了不存在的 visualEventId=${cue.visualEventId}。`);
  }
}

const coverage = primaryCount > 0 ? coveredPrimaryCount / primaryCount : 0;
if (coverage !== 1) {
  errors.push(
    `主视觉音效覆盖率为 ${(coverage * 100).toFixed(1)}%` +
      `（${coveredPrimaryCount}/${primaryCount}），要求 100%。`,
  );
}

for (const warning of warnings) {
  console.warn(`警告：${warning}`);
}

if (errors.length > 0) {
  console.error(`V7.3 生产合同校验失败：${errors.length} 项`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(
  `V7.3 生产合同校验通过：${plan.videoId}，` +
    `${primaryCount} 个主视觉单元音效覆盖 100%，` +
    `${roleCounts.size} 种实际音效角色。`,
);
