import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const [releasePath, baselinePath = 'workflow/production-baseline.v1.json'] = process.argv.slice(2);

if (!releasePath) {
  console.error('用法：node tools/validate-release.mjs <release.json> [production-baseline.json]');
  process.exit(1);
}

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const release = readJson(releasePath);
const baseline = readJson(baselinePath);
const activeProfile = readJson('workflow/active-production-profile.v1.json');
const errors = [];
const warnings = [];

const exists = (relativePath) => isNonEmpty(relativePath) && fs.existsSync(path.resolve(relativePath));
const isNonEmpty = (value) => typeof value === 'string' && value.trim().length > 0;
const passed = (value) => value?.status === 'passed';
const run = (command, args) => spawnSync(command, args, {encoding: 'utf8'});
const isActiveProfileRelease =
  release.productionProfile?.id === activeProfile.profileId &&
  release.productionProfile?.version === activeProfile.profileVersion;

const probeVideo = (relativePath) => {
  const result = run('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration:stream=codec_type,codec_name,width,height,r_frame_rate',
    '-of', 'json',
    relativePath
  ]);

  if (result.status !== 0) {
    return {error: result.stderr.trim() || 'ffprobe 无法读取成片'};
  }

  try {
    return JSON.parse(result.stdout);
  } catch {
    return {error: 'ffprobe 输出不是有效 JSON'};
  }
};

for (const key of ['releaseId', 'status', 'videoId', 'baselineId']) {
  if (!isNonEmpty(release[key])) {
    errors.push(`缺少必填字段：${key}`);
  }
}

if (release.schemaVersion !== 1) {
  errors.push('release 必须使用 schemaVersion=1。');
}

if (release.baselineId !== baseline.baselineId) {
  errors.push(`release 基线=${release.baselineId} 与当前基线=${baseline.baselineId} 不一致。`);
}

for (const key of ['sourceVideo', 'transcript', 'bilingualCaptions', 'visualPlan']) {
  if (!exists(release.inputs?.[key])) {
    errors.push(`输入文件不存在：inputs.${key}=${release.inputs?.[key] ?? ''}`);
  }
}

for (const asset of release.inputs?.assets ?? []) {
  const assetPath = asset.startsWith('media/') ? path.join('remotion/public', asset) : asset;
  if (!exists(assetPath)) {
    errors.push(`视觉素材不存在：${asset}`);
  }
}

if (!exists(release.production?.formalOutput)) {
  errors.push(`正式输出不存在：${release.production?.formalOutput ?? ''}`);
}

if (!exists(release.production?.previewOutput)) {
  errors.push(`预览输出不存在：${release.production?.previewOutput ?? ''}`);
}

let formalDuration = null;
if (exists(release.production?.formalOutput)) {
  const mediaInfo = probeVideo(release.production.formalOutput);
  if (mediaInfo.error) {
    errors.push(`正式输出无法探测：${mediaInfo.error}`);
  } else {
    const video = mediaInfo.streams?.find((stream) => stream.codec_type === 'video');
    const audio = mediaInfo.streams?.find((stream) => stream.codec_type === 'audio');
    const expected = baseline.production ?? {};
    formalDuration = Number(mediaInfo.format?.duration ?? 0);

    if (video?.width !== expected.width || video?.height !== expected.height) {
      errors.push(`正式输出画幅不符合基线：${video?.width ?? '?'}x${video?.height ?? '?'}。`);
    }
    if (video?.codec_name !== expected.videoCodec) {
      errors.push(`正式输出视频编码不符合基线：${video?.codec_name ?? '缺失'}。`);
    }
    if (audio?.codec_name !== expected.audioCodec) {
      errors.push(`正式输出音频编码不符合基线：${audio?.codec_name ?? '缺失'}。`);
    }
    if (video?.r_frame_rate !== `${expected.fps}/1`) {
      errors.push(`正式输出帧率不符合基线：${video?.r_frame_rate ?? '缺失'}。`);
    }
    if (!Number.isFinite(formalDuration) || formalDuration <= 0) {
      errors.push('正式输出时长无效。');
    }
  }
}

if (isActiveProfileRelease) {
  const requirements = activeProfile.requirements?.finalDeliveryPackage;
  const delivery = release.deliveryPackage;
  const cover = delivery?.cover;
  const titles = delivery?.titles;
  const douyin = delivery?.douyin;
  const expectedCover = requirements?.cover ?? {};
  const expectedDouyin = requirements?.douyin ?? {};

  if (delivery?.status !== 'ready-for-delivery') {
    errors.push(
      `V8完整交付包状态必须为 ready-for-delivery；缺项时应保持 ${requirements?.missingStatus ?? 'incomplete-delivery'}。`,
    );
  }

  if (cover?.aspectRatio !== expectedCover.aspectRatio) {
    errors.push(`V8封面提示词画幅必须为 ${expectedCover.aspectRatio ?? '3:4'}。`);
  }
  if (!exists(cover?.recommendedFrame)) {
    errors.push(`V8缺少从本条正式成片截取的推荐封面人物图：${cover?.recommendedFrame ?? ''}`);
  }
  if (cover?.sourceVideo !== release.production?.formalOutput) {
    errors.push('V8推荐封面人物图的 sourceVideo 必须与本条正式成片路径一致。');
  }
  if (cover?.sourceType !== expectedCover.recommendedFrameSource) {
    errors.push(
      `V8推荐封面人物图来源必须为 ${expectedCover.recommendedFrameSource ?? 'current-final-video-real-frame'}。`,
    );
  }
  if (
    !Number.isFinite(cover?.sourceTimeSeconds) ||
    cover.sourceTimeSeconds < 0 ||
    (formalDuration !== null && cover.sourceTimeSeconds > formalDuration)
  ) {
    errors.push('V8推荐封面人物图必须记录正式成片范围内的有效截取时间点。');
  }
  if (!exists(cover?.prompt)) {
    errors.push(`V8缺少可直接复制的3:4真人截图合成封面提示词：${cover?.prompt ?? ''}`);
  }

  if (expectedDouyin.primaryTitleRequired && !isNonEmpty(titles?.primary)) {
    errors.push('V8完整交付包缺少抖音主标题。');
  }
  const alternativeTitles = (titles?.alternatives ?? []).filter(isNonEmpty);
  if (alternativeTitles.length < Number(expectedDouyin.minimumAlternativeTitles ?? 2)) {
    errors.push(`V8完整交付包至少需要 ${expectedDouyin.minimumAlternativeTitles ?? 2} 个抖音备选标题。`);
  }
  if (new Set([titles?.primary, ...alternativeTitles]).size !== 1 + alternativeTitles.length) {
    errors.push('V8主标题和备选标题不得重复。');
  }
  if (expectedDouyin.publishCopyRequired && !isNonEmpty(douyin?.publishCopy)) {
    errors.push('V8完整交付包缺少抖音发布文案。');
  }
  const topics = (douyin?.topics ?? []).filter(isNonEmpty);
  if (topics.length < Number(expectedDouyin.minimumTopics ?? 1)) {
    errors.push(`V8完整交付包至少需要 ${expectedDouyin.minimumTopics ?? 1} 个抖音话题。`);
  }
  if (new Set(topics).size !== topics.length) {
    errors.push('V8抖音话题不得重复。');
  }
  if (!exists(delivery?.copyReview)) {
    errors.push(`V8标题、发布文案和话题缺少双Skill审稿记录：${delivery?.copyReview ?? ''}`);
  }
}

const modules = new Set(release.production?.modules ?? []);
for (const required of baseline.requiredModules ?? []) {
  if (!modules.has(required)) {
    errors.push(`正式片缺少基线模块：${required}`);
  }
}

if (!passed(release.qa?.technical)) {
  errors.push('技术质检未通过。');
}

if (!passed(release.qa?.captionSync)) {
  errors.push('字幕同步质检未通过。');
} else if (Number(release.qa.captionSync.minimumScore) < Number(baseline.captionPolicy?.minimumSyncScore ?? 0)) {
  errors.push(`字幕同步分低于基线：${release.qa.captionSync.minimumScore}`);
}

if (exists(release.inputs?.transcript) && exists(release.inputs?.bilingualCaptions)) {
  const captionVerifier = release.qa?.captionSync?.verifier ?? 'legacy-lcs';
  const captionCheckArgs =
    captionVerifier === 'verbatim-v1'
      ? [
          'tools/check-verbatim-caption-sync.mjs',
          release.inputs.transcript,
          release.inputs.bilingualCaptions,
        ]
      : [
          'tools/check-bilingual-caption-sync.mjs',
          release.inputs.transcript,
          release.inputs.bilingualCaptions,
          String(baseline.captionPolicy?.minimumSyncScore ?? 0.62),
        ];
  const captionCheck = run(process.execPath, captionCheckArgs);
  if (captionCheck.status !== 0) {
    errors.push(`字幕同步子校验失败：${captionCheck.stderr.trim() || captionCheck.stdout.trim()}`);
  }
}

if (!passed(release.qa?.visualPlan)) {
  errors.push('视觉方案校验未通过。');
}

if (!passed(release.qa?.keyframeReview)) {
  errors.push('关键帧质检未通过。');
} else if ((release.qa.keyframeReview.frames ?? []).length < Number(baseline.formalQa?.keyframeReview?.minimumCount ?? 0)) {
  errors.push(`关键帧少于基线要求：${release.qa.keyframeReview.frames?.length ?? 0}`);
} else if (formalDuration !== null && (release.qa.keyframeReview.frames ?? []).some((frame) => !Number.isFinite(frame) || frame < 0 || frame > formalDuration)) {
  errors.push('关键帧时间存在负数、非数字或超出正式成片时长的值。');
}

if (exists(release.inputs?.visualPlan)) {
  const planCheck = spawnSync(process.execPath, ['tools/validate-visual-plan.mjs', release.inputs.visualPlan, baselinePath], {
    encoding: 'utf8'
  });
  if (planCheck.status !== 0) {
    errors.push(`视觉方案子校验失败：${planCheck.stderr.trim() || planCheck.stdout.trim()}`);
  }
}

const directFinalAuthorized = release.userReview?.directFinalAuthorized === true;
if (!release.userReview?.previewApproved && !directFinalAuthorized) {
  errors.push('用户尚未确认预览，也未授权完整口播直接成片，不能进入正式状态。');
} else if (directFinalAuthorized && !release.userReview?.previewApproved) {
  warnings.push('用户已授权完整口播直接成片；未单独执行中间预览确认。');
}

if (release.status === 'verified' && !release.userReview?.fullWatchConfirmed) {
  errors.push('用户尚未完整观看，release.status 不能标记为 verified。');
}

if (exists(release.production?.formalOutput)) {
  const decodeCheck = run('ffmpeg', ['-v', 'error', '-i', release.production.formalOutput, '-f', 'null', '-']);
  if (decodeCheck.status !== 0) {
    errors.push(`正式输出完整解码失败：${decodeCheck.stderr.trim() || 'ffmpeg 返回错误'}`);
  }
}

if (!Array.isArray(release.upgradeDecisions) || release.upgradeDecisions.length === 0) {
  warnings.push('本条没有记录升级任务决策；请明确哪些升级被应用、延后或拒绝。');
}

if (release.publish?.status === 'not-published') {
  warnings.push('尚未发布；24 小时数据回填后才能评价内容与封面的真实效果。');
}

for (const warning of warnings) {
  console.warn(`警告：${warning}`);
}

if (errors.length > 0) {
  console.error(`发布记录校验失败：${errors.length} 项`);
  for (const item of errors) {
    console.error(`- ${item}`);
  }
  process.exit(1);
}

console.log(`发布记录校验通过：${release.releaseId}，状态=${release.status}`);
