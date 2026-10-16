const text = (value, label) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label}不能为空。`);
  return value;
};

export const buildControlledRemotionRenderArgsV2 = ({
  entryRelative,
  composition,
  output,
  publicDir,
}) => [
  'render',
  text(entryRelative, 'Remotion entry'),
  text(composition, 'Remotion composition'),
  text(output, 'Remotion output'),
  '--codec=h264',
  '--pixel-format=yuv420p',
  `--public-dir=${text(publicDir, 'Remotion publicDir')}`,
];
