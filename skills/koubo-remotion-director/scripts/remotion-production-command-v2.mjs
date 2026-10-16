const text = (value, label) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label}不能为空。`);
  return value;
};

const previewSettingsArgs = (settings, context) => {
  if (settings === undefined) return [];
  const reject = (code) => { throw Object.assign(new Error(`本期低清预览参数拒绝：${code}`), {code}); };
  if (context?.mode !== 'preview' || context?.command !== 'direct-remotion-preview' ||
      context?.preflightRoute !== 'musk-grok-current-chat-review' ||
      context?.episodeId !== 'musk-grok-business-ai-20261016' ||
      context?.jobId !== '20261016_musk_grok_business_ai_v9_candidate' ||
      context?.revisionId !== 'musk-grok-business-ai-v9-preview-r1-20261016' ||
      context?.inputFormat !== 'director-cues-v2-surface-bound' ||
      context?.width !== 1920 || context?.height !== 1080 || context?.fps !== 30 ||
      context?.durationSeconds !== 5035 / 30) reject('RRPV2_PREVIEW_SETTINGS_SCOPE_INVALID');
  if (!settings || Array.isArray(settings) || typeof settings !== 'object' ||
      Object.keys(settings).length !== 3 ||
      settings.concurrency !== 1 || settings.timeoutInMilliseconds !== 120000 || settings.scale !== 2 / 3) {
    reject('RRPV2_PREVIEW_SETTINGS_INVALID');
  }
  return ['--concurrency=1', '--timeout=120000', '--scale=0.6666666666666666'];
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
