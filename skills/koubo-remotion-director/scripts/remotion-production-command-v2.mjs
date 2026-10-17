const text = (value, label) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label}不能为空。`);
  return value;
};

const previewSettingsArgs = (settings, context) => {
  if (settings === undefined) return [];
  const reject = (code) => { throw Object.assign(new Error(`本期候选导出参数拒绝：${code}`), {code}); };
  // 本期静图兼容许可仅允许1280x720内部预览；不复用或放宽上一期规则。
  if (context?.preflightRoute === 'small-business-ai-agility-current-chat-review') {
    const videoR2 = context?.revisionId === 'small-business-ai-agility-v9-video-candidate-r2-20261017';
    const motionR3 = context?.revisionId === 'small-business-ai-agility-v9-motion-sample-r3-20261017';
    if (context?.mode !== 'preview' || context?.command !== 'direct-remotion-preview' ||
        context?.episodeId !== 'small-business-ai-agility-20261017' ||
        context?.jobId !== '20261017_small_business_ai_agility_v9_candidate' ||
        (!videoR2 && !motionR3 && context?.revisionId !== 'small-business-ai-agility-v9-static-preview-r1-20261017') ||
        context?.inputFormat !== 'director-cues-v2-surface-bound' ||
        context?.width !== 1920 || context?.height !== 1080 || context?.fps !== 30 ||
        context?.durationSeconds !== 4126 / 30) reject('RRPV2_PREVIEW_SETTINGS_SCOPE_INVALID');
    const hasFrames = settings && Object.hasOwn(settings, 'frames');
    if (motionR3) {
      if (!settings || Array.isArray(settings) || Object.keys(settings).length !== 4 ||
          Object.keys(settings).some(key => !['concurrency', 'timeoutInMilliseconds', 'scale', 'frames'].includes(key)) ||
          settings.concurrency !== 1 || settings.timeoutInMilliseconds !== 120000 || settings.scale !== 1 ||
          !hasFrames || !settings.frames || Array.isArray(settings.frames) || Object.keys(settings.frames).length !== 2 ||
          settings.frames.start !== 720 || settings.frames.end !== 1409) reject('RRPV2_PREVIEW_SETTINGS_INVALID');
      return ['--concurrency=1', '--timeout=120000', '--scale=1', '--frames=720-1409'];
    }
    if (!settings || Array.isArray(settings) || typeof settings !== 'object' ||
        Object.keys(settings).length !== (videoR2 && hasFrames ? 4 : 3) ||
        Object.keys(settings).some(key => !['concurrency', 'timeoutInMilliseconds', 'scale', ...(videoR2 ? ['frames'] : [])].includes(key)) ||
        settings.concurrency !== 1 || settings.timeoutInMilliseconds !== 120000 ||
        (videoR2 ? ![1, 2 / 3].includes(settings.scale) : settings.scale !== 2 / 3)) {
      reject('RRPV2_PREVIEW_SETTINGS_INVALID');
    }
    if (hasFrames && (!videoR2 || settings.scale !== 2 / 3 || !settings.frames ||
        Array.isArray(settings.frames) || Object.keys(settings.frames).length !== 2 ||
        !Number.isInteger(settings.frames.start) || !Number.isInteger(settings.frames.end) ||
        settings.frames.start < 0 || settings.frames.end < settings.frames.start || settings.frames.end >= 4126)) {
      reject('RRPV2_PREVIEW_SETTINGS_INVALID');
    }
    return ['--concurrency=1', '--timeout=120000', `--scale=${settings.scale}`,
      ...(hasFrames ? [`--frames=${settings.frames.start}-${settings.frames.end}`] : [])];
  }
  const fullCandidate = context?.revisionId === 'musk-grok-business-ai-v9-full-candidate-r3-20261016';
  if (context?.mode !== 'preview' || context?.command !== 'direct-remotion-preview' ||
      context?.preflightRoute !== 'musk-grok-current-chat-review' ||
      context?.episodeId !== 'musk-grok-business-ai-20261016' ||
      context?.jobId !== '20261016_musk_grok_business_ai_v9_candidate' ||
      !['musk-grok-business-ai-v9-preview-r1-20261016', 'musk-grok-business-ai-v9-preview-r2-20261016',
        'musk-grok-business-ai-v9-full-candidate-r3-20261016'].includes(context?.revisionId) ||
      context?.inputFormat !== 'director-cues-v2-surface-bound' ||
      context?.width !== 1920 || context?.height !== 1080 || context?.fps !== 30 ||
      context?.durationSeconds !== 5035 / 30) reject('RRPV2_PREVIEW_SETTINGS_SCOPE_INVALID');
  if (!settings || Array.isArray(settings) || typeof settings !== 'object' ||
      Object.keys(settings).length !== 3 ||
      settings.concurrency !== 1 || settings.timeoutInMilliseconds !== 120000 || settings.scale !== (fullCandidate ? 1 : 2 / 3)) {
    reject('RRPV2_PREVIEW_SETTINGS_INVALID');
  }
  return ['--concurrency=1', '--timeout=120000', fullCandidate ? '--scale=1' : '--scale=0.6666666666666666'];
};

export const buildControlledRemotionRenderArgsV2 = ({
  entryRelative,
  composition,
  output,
  publicDir,
  previewRenderSettings,
  renderContext,
}) => [
  'render',
  text(entryRelative, 'Remotion entry'),
  text(composition, 'Remotion composition'),
  text(output, 'Remotion output'),
  '--codec=h264',
  '--pixel-format=yuv420p',
  `--public-dir=${text(publicDir, 'Remotion publicDir')}`,
  ...previewSettingsArgs(previewRenderSettings, renderContext),
];
