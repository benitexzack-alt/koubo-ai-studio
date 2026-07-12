import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const defaultProjectRoot = path.resolve(scriptRoot, '../../..');
const args = process.argv.slice(2);
const taskArg = args.find((arg) => !arg.startsWith('--'));

const readArg = (name, fallback = '') => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : (args[index + 1] ?? fallback);
};

if (!taskArg) {
  console.error('用法：node render-cover-set.mjs <cover-task.json> --mode <grid|final> [--selected 1] [--project-root 路径]');
  process.exit(1);
}

const projectRoot = path.resolve(readArg('project-root', defaultProjectRoot));
const taskPath = path.resolve(projectRoot, taskArg);
const mode = readArg('mode', 'grid');
const selectedArg = readArg('selected');
const requireFromRemotion = createRequire(path.join(projectRoot, 'remotion/package.json'));
const sharp = requireFromRemotion('sharp');

if (!['grid', 'final'].includes(mode)) {
  throw new Error(`未知模式：${mode}，只能使用 grid 或 final。`);
}

const task = JSON.parse(fs.readFileSync(taskPath, 'utf8'));
const width = Number(task.canvas?.width ?? 1080);
const height = Number(task.canvas?.height ?? 1440);
const gridMargin = Number(task.canvas?.gridMargin ?? 20);
const gridGap = Number(task.canvas?.gridGap ?? 40);
const gridWidth = width * 2 + gridMargin * 2 + gridGap;
const gridHeight = height * 2 + gridMargin * 2 + gridGap;
const candidates = task.grid?.candidates ?? [];
const warnings = [];

if (width !== 1080 || height !== 1440) {
  throw new Error(`单张封面必须为 1080×1440，当前为 ${width}×${height}。`);
}

if (candidates.length !== 4) {
  throw new Error(`四宫格必须恰好包含 4 个候选，当前为 ${candidates.length}。`);
}

const resolveProjectPath = (relativePath) => path.resolve(projectRoot, relativePath);
const ensureParent = (filePath) => fs.mkdirSync(path.dirname(filePath), {recursive: true});
const escapeXml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;');

const ffmpegCandidates = [
  process.env.FFMPEG_PATH,
  '/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg',
  'ffmpeg',
].filter(Boolean);

const findFfmpeg = () => {
  for (const candidate of ffmpegCandidates) {
    if (candidate.includes('/') && !fs.existsSync(candidate)) {
      continue;
    }
    const result = spawnSync(candidate, ['-version'], {encoding: 'utf8'});
    if (result.status === 0) {
      return candidate;
    }
  }
  throw new Error('未找到可用 FFmpeg。');
};

const ffmpeg = findFfmpeg();

const renderBackgroundSvg = (candidate) => {
  const palette = candidate.palette ?? {};
  const base = palette.base ?? '#06101F';
  const secondary = palette.secondary ?? '#12325B';
  const accent = palette.accent ?? '#42D8FF';
  const warm = palette.warm ?? '#F5BE45';
  const motif = candidate.background?.motif ?? 'route';

  const motifs = {
    route: `
      <path d="M90 1050 C320 820, 420 620, 850 220" fill="none" stroke="${accent}" stroke-width="13" opacity="0.32"/>
      <path d="M90 1050 C340 850, 520 640, 960 350" fill="none" stroke="${warm}" stroke-width="4" opacity="0.55"/>
      <circle cx="180" cy="940" r="24" fill="${accent}" opacity="0.75"/>
      <circle cx="505" cy="650" r="18" fill="${warm}" opacity="0.9"/>
      <circle cx="880" cy="295" r="28" fill="${accent}" opacity="0.8"/>
    `,
    steps: `
      <g opacity="0.22">
        <rect x="95" y="610" width="890" height="148" rx="42" fill="${accent}"/>
        <rect x="155" y="790" width="780" height="148" rx="42" fill="${warm}"/>
        <rect x="225" y="970" width="640" height="148" rx="42" fill="${secondary}" stroke="${accent}" stroke-width="5"/>
      </g>
      <path d="M540 520 L540 1110" stroke="${accent}" stroke-width="6" stroke-dasharray="16 22" opacity="0.35"/>
    `,
    evidence: `
      <g fill="none" stroke="${accent}" opacity="0.38">
        <rect x="580" y="520" width="400" height="155" rx="28" stroke-width="5"/>
        <rect x="580" y="720" width="400" height="155" rx="28" stroke-width="5"/>
        <rect x="580" y="920" width="400" height="155" rx="28" stroke-width="5"/>
        <path d="M780 675 L780 720 M780 875 L780 920" stroke-width="8"/>
      </g>
      <circle cx="780" cy="597" r="18" fill="${warm}" opacity="0.75"/>
      <circle cx="780" cy="797" r="18" fill="${accent}" opacity="0.75"/>
      <circle cx="780" cy="997" r="18" fill="${warm}" opacity="0.75"/>
    `,
    local: `
      <path d="M-80 930 C220 670, 630 710, 1160 310" fill="none" stroke="${warm}" stroke-width="8" opacity="0.34"/>
      <path d="M-90 1010 C250 760, 680 800, 1180 390" fill="none" stroke="${accent}" stroke-width="4" opacity="0.35" stroke-dasharray="22 24"/>
      <g fill="${accent}" opacity="0.72">
        <circle cx="210" cy="810" r="20"/><circle cx="430" cy="720" r="16"/><circle cx="680" cy="645" r="22"/><circle cx="915" cy="475" r="18"/>
      </g>
      <g stroke="${accent}" opacity="0.16">
        <path d="M80 1180 H1000 M80 1240 H1000"/><path d="M220 1080 V1320 M420 1080 V1320 M620 1080 V1320 M820 1080 V1320"/>
      </g>
    `,
  };

  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${base}"/>
          <stop offset="0.58" stop-color="${secondary}"/>
          <stop offset="1" stop-color="${base}"/>
        </linearGradient>
        <radialGradient id="glow" cx="75%" cy="28%" r="68%">
          <stop offset="0" stop-color="${accent}" stop-opacity="0.34"/>
          <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
        </radialGradient>
        <filter id="blur"><feGaussianBlur stdDeviation="26"/></filter>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#bg)"/>
      <rect width="${width}" height="${height}" fill="url(#glow)"/>
      <circle cx="900" cy="230" r="210" fill="${accent}" opacity="0.11" filter="url(#blur)"/>
      ${motifs[motif] ?? motifs.route}
      <rect x="34" y="34" width="1012" height="1372" rx="42" fill="none" stroke="${accent}" stroke-width="2" opacity="0.12"/>
    </svg>
  `);
};

const loadBackground = async (candidate) => {
  const backgroundMode = candidate.background?.mode;
  const backgroundPath = candidate.background?.path;

  if (backgroundMode === 'generated') {
    if (!backgroundPath) {
      throw new Error(`候选 ${candidate.id} 声明使用 AI 背景，但没有填写 background.path。`);
    }
    const absolute = resolveProjectPath(backgroundPath);
    if (!fs.existsSync(absolute)) {
      throw new Error(`候选 ${candidate.id} 的 AI 背景文件不存在：${backgroundPath}`);
    }
    return sharp(absolute).resize(width, height, {fit: 'cover'}).png().toBuffer();
  }

  if (backgroundMode !== 'deterministic') {
    throw new Error(`候选 ${candidate.id} 的 background.mode 必须是 generated 或 deterministic。`);
  }

  return sharp(renderBackgroundSvg(candidate)).png().toBuffer();
};

const extractFrame = (candidate) => {
  const configured = candidate.portrait?.framePath;
  if (configured && fs.existsSync(resolveProjectPath(configured))) {
    return resolveProjectPath(configured);
  }

  const sourceVideo = resolveProjectPath(task.source?.portraitVideo || task.source?.video || '');
  if (!fs.existsSync(sourceVideo)) {
    throw new Error(`人物抽帧视频不存在：${task.source?.portraitVideo || task.source?.video || ''}`);
  }

  const frameRelative = configured || path.join(
    task.evidenceDir ?? `edit/verify/covers/${task.coverId}`,
    'frames',
    `candidate-${candidate.id}.png`,
  );
  const framePath = resolveProjectPath(frameRelative);
  ensureParent(framePath);
  const result = spawnSync(ffmpeg, [
    '-y', '-ss', String(candidate.portrait?.frameSecond ?? 0), '-i', sourceVideo,
    '-frames:v', '1', '-an', '-vf', 'scale=1920:-2', framePath,
  ], {encoding: 'utf8'});

  if (result.status !== 0 || !fs.existsSync(framePath)) {
    throw new Error(`候选 ${candidate.id} 抽帧失败：${result.stderr?.trim() || 'FFmpeg 返回错误'}`);
  }
  return framePath;
};

const roundedMask = (maskWidth, maskHeight, radius = 38) => Buffer.from(`
  <svg width="${maskWidth}" height="${maskHeight}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${maskWidth}" height="${maskHeight}" rx="${radius}" fill="white"/>
  </svg>
`);

const panelFadeMask = (maskWidth, maskHeight) => Buffer.from(`
  <svg width="${maskWidth}" height="${maskHeight}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="white" stop-opacity="0"/>
        <stop offset="0.2" stop-color="white" stop-opacity="0.52"/>
        <stop offset="0.38" stop-color="white" stop-opacity="1"/>
        <stop offset="1" stop-color="white" stop-opacity="1"/>
      </linearGradient>
    </defs>
    <rect width="${maskWidth}" height="${maskHeight}" rx="42" fill="url(#fade)"/>
  </svg>
`);

const portraitBaseFadeMask = (maskWidth, maskHeight) => Buffer.from(`
  <svg width="${maskWidth}" height="${maskHeight}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="white" stop-opacity="1"/>
        <stop offset="0.86" stop-color="white" stop-opacity="1"/>
        <stop offset="1" stop-color="white" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect width="${maskWidth}" height="${maskHeight}" fill="url(#fade)"/>
  </svg>
`);

const opacityMask = (maskWidth, maskHeight, opacity) => Buffer.from(`
  <svg width="${maskWidth}" height="${maskHeight}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${maskWidth}" height="${maskHeight}" fill="white" fill-opacity="${opacity}"/>
  </svg>
`);

const matteLayoutConfig = {
  'workbench-right': {left: 170, top: 500, width: 600, height: 920},
  'blueprint-right': {left: 170, top: 510, width: 595, height: 900},
  'evidence-left': {left: -60, top: 555, width: 600, height: 860},
  'local-left': {left: -40, top: 500, width: 650, height: 915},
};

const makeMattePortraitLayers = async (candidate) => {
  const configured = candidate.portrait?.mattePath;
  if (!configured) {
    return null;
  }

  const mattePath = resolveProjectPath(configured);
  if (!fs.existsSync(mattePath)) {
    throw new Error(`候选 ${candidate.id} 的人物透明抠像不存在：${configured}`);
  }

  const fallback = matteLayoutConfig[candidate.layout];
  if (!fallback) {
    throw new Error(`候选 ${candidate.id} 的真实人物抠像使用未知布局：${candidate.layout}`);
  }
  const placement = {...fallback, ...(candidate.portrait?.placement ?? {})};
  for (const key of ['left', 'top', 'width', 'height']) {
    if (!Number.isFinite(Number(placement[key]))) {
      throw new Error(`候选 ${candidate.id} 的 portrait.placement.${key} 必须是数字。`);
    }
    placement[key] = Math.round(Number(placement[key]));
  }
  if (placement.top < 0 || placement.width < 1 || placement.height < 1) {
    throw new Error(`候选 ${candidate.id} 的人物抠像位置或尺寸无效。`);
  }

  const trimmed = await sharp(mattePath)
    .ensureAlpha()
    .trim({background: {r: 0, g: 0, b: 0, alpha: 0}, threshold: 8})
    .png()
    .toBuffer();
  const scaled = await sharp(trimmed)
    .resize({height: placement.height, withoutEnlargement: false})
    .modulate({brightness: Number(candidate.portrait?.brightness ?? 1.03), saturation: Number(candidate.portrait?.saturation ?? 0.94)})
    .png()
    .toBuffer({resolveWithObject: true});

  const cropLeft = Math.max(0, -placement.left);
  const outputLeft = Math.max(0, placement.left);
  const visibleWidth = Math.min(scaled.info.width - cropLeft, width - outputLeft);
  const visibleHeight = Math.min(scaled.info.height, height - placement.top);
  if (visibleWidth < 1 || visibleHeight < 1) {
    throw new Error(`候选 ${candidate.id} 的人物抠像完全落在画布之外。`);
  }
  const portrait = await sharp(scaled.data)
    .extract({left: cropLeft, top: 0, width: visibleWidth, height: visibleHeight})
    .composite([{input: portraitBaseFadeMask(visibleWidth, visibleHeight), blend: 'dest-in'}])
    .png()
    .toBuffer();

  const accent = candidate.palette?.accent ?? '#2FD4FF';
  const shadow = await sharp(portrait)
    .tint('#020711')
    .blur(Number(candidate.portrait?.shadowBlur ?? 16))
    .composite([{input: opacityMask(visibleWidth, visibleHeight, Number(candidate.portrait?.shadowOpacity ?? 0.38)), blend: 'dest-in'}])
    .png()
    .toBuffer();
  const rim = await sharp(portrait)
    .tint(accent)
    .blur(Number(candidate.portrait?.rimBlur ?? 3.2))
    .modulate({brightness: 1.18, saturation: 1.1})
    .composite([{input: opacityMask(visibleWidth, visibleHeight, Number(candidate.portrait?.rimOpacity ?? 0.3)), blend: 'dest-in'}])
    .png()
    .toBuffer();

  return [
    {input: shadow, top: placement.top, left: outputLeft, blend: 'over'},
    {input: rim, top: placement.top, left: outputLeft, blend: 'screen'},
    {input: portrait, top: placement.top, left: outputLeft, blend: 'over'},
  ];
};

const makePortraitLayers = async (candidate, framePath) => {
  const matteLayers = await makeMattePortraitLayers(candidate);
  if (matteLayers) {
    return matteLayers;
  }

  const layout = candidate.layout;
  const cropPosition = candidate.portrait?.cropPosition ?? 'attention';
  const layers = [];

  if (layout === 'cinematic-right') {
    const panelWidth = 700;
    const panelHeight = 1120;
    const frame = await sharp(framePath)
      .resize(panelWidth, panelHeight, {fit: 'cover', position: cropPosition})
      .modulate({brightness: 0.9, saturation: 0.92})
      .composite([{input: panelFadeMask(panelWidth, panelHeight), blend: 'dest-in'}])
      .png().toBuffer();
    layers.push({input: frame, top: 250, left: 380});
  } else if (layout === 'clean-center') {
    const panelWidth = 920;
    const panelHeight = 720;
    const frame = await sharp(framePath)
      .resize(panelWidth, panelHeight, {fit: 'cover', position: cropPosition})
      .modulate({brightness: 1.04, saturation: 0.9})
      .composite([{input: roundedMask(panelWidth, panelHeight, 44), blend: 'dest-in'}])
      .png().toBuffer();
    layers.push({input: frame, top: 620, left: 80});
  } else if (layout === 'evidence-split') {
    const panelWidth = 510;
    const panelHeight = 950;
    const frame = await sharp(framePath)
      .resize(panelWidth, panelHeight, {fit: 'cover', position: cropPosition})
      .modulate({brightness: 0.94, saturation: 0.9})
      .composite([{input: roundedMask(panelWidth, panelHeight, 42), blend: 'dest-in'}])
      .png().toBuffer();
    layers.push({input: frame, top: 390, left: 38});
  } else if (layout === 'local-story') {
    const frame = await sharp(framePath)
      .resize(width, height, {fit: 'cover', position: cropPosition})
      .modulate({brightness: 0.78, saturation: 0.86})
      .png().toBuffer();
    layers.push({input: frame, top: 0, left: 0});
  } else {
    throw new Error(`候选 ${candidate.id} 使用未知布局：${layout}`);
  }

  return layers;
};

const layoutConfig = {
  'cinematic-right': {x: 78, y: 280, anchor: 'start', defaultSize: 146, maxWidth: 650, subtitleY: 700},
  'clean-center': {x: 540, y: 300, anchor: 'middle', defaultSize: 142, maxWidth: 930, subtitleY: 565},
  'evidence-split': {x: 575, y: 170, anchor: 'start', defaultSize: 120, maxWidth: 445, subtitleY: 620},
  'local-story': {x: 78, y: 895, anchor: 'start', defaultSize: 146, maxWidth: 920, subtitleY: 1215},
  'workbench-right': {x: 62, y: 258, anchor: 'start', defaultSize: 126, maxWidth: 660, subtitleY: 610},
  'blueprint-right': {x: 62, y: 260, anchor: 'start', defaultSize: 122, maxWidth: 700, subtitleY: 590},
  'evidence-left': {x: 62, y: 255, anchor: 'start', defaultSize: 126, maxWidth: 720, subtitleY: 600},
  'local-left': {x: 1015, y: 255, anchor: 'end', defaultSize: 126, maxWidth: 680, subtitleY: 610},
};

const renderCompositionShadeSvg = (candidate) => {
  const palette = candidate.palette ?? {};
  const baseConfig = layoutConfig[candidate.layout];
  if (!baseConfig) {
    throw new Error(`候选 ${candidate.id} 使用未知排版布局：${candidate.layout}`);
  }
  const anchor = candidate.typography?.anchor ?? baseConfig.anchor;
  const isLightSurface = candidate.typography?.surface === 'light' || candidate.layout === 'blueprint-right';
  const shadeDirection = anchor === 'end' ? {x1: '1', x2: '0'} : {x1: '0', x2: '1'};
  const shadeColor = isLightSurface ? '#F7FBFF' : '#020711';
  const shadeOpacity = Number(candidate.typography?.shadeOpacity ?? (isLightSurface ? 0.76 : 0.72));

  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="headlineShade" x1="${shadeDirection.x1}" y1="0" x2="${shadeDirection.x2}" y2="0">
          <stop offset="0" stop-color="${shadeColor}" stop-opacity="${shadeOpacity}"/>
          <stop offset="0.55" stop-color="${shadeColor}" stop-opacity="${shadeOpacity * 0.52}"/>
          <stop offset="1" stop-color="${shadeColor}" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="shadeFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="white" stop-opacity="1"/>
          <stop offset="0.7" stop-color="white" stop-opacity="1"/>
          <stop offset="1" stop-color="white" stop-opacity="0"/>
        </linearGradient>
        <mask id="headlineShadeMask"><rect width="1080" height="800" fill="url(#shadeFade)"/></mask>
      </defs>
      <rect x="0" y="0" width="1080" height="800" fill="url(#headlineShade)" mask="url(#headlineShadeMask)"/>
    </svg>
  `);
};

const renderTextSvg = (candidate, {showNumber}) => {
  const palette = candidate.palette ?? {};
  const baseConfig = layoutConfig[candidate.layout];
  if (!baseConfig) {
    throw new Error(`候选 ${candidate.id} 使用未知排版布局：${candidate.layout}`);
  }
  const config = {
    ...baseConfig,
    x: Number(candidate.typography?.x ?? baseConfig.x),
    y: Number(candidate.typography?.y ?? baseConfig.y),
    anchor: candidate.typography?.anchor ?? baseConfig.anchor,
    maxWidth: Number(candidate.typography?.maxWidth ?? baseConfig.maxWidth),
    subtitleY: Number(candidate.typography?.subtitleY ?? baseConfig.subtitleY),
  };
  const lines = candidate.copy?.headlineLines ?? [];
  const requestedFontSize = Number(candidate.typography?.headlineSize ?? config.defaultSize);
  const measureUnits = (value) => Array.from(String(value ?? '')).reduce((total, character) => {
    if (/\s/.test(character)) return total + 0.35;
    if (/[\x00-\x7F]/.test(character)) return total + 0.62;
    return total + 1;
  }, 0);
  const longestLineUnits = Math.max(1, ...lines.map((line) => measureUnits(typeof line === 'string' ? line : line.text)));
  const fontSize = Math.min(requestedFontSize, Math.floor(config.maxWidth / longestLineUnits));
  const requestedLineHeight = Number(candidate.typography?.lineHeight ?? Math.round(fontSize * 0.98));
  const lineHeight = Math.min(requestedLineHeight, Math.round(fontSize * 1.06));
  const isLightSurface = candidate.typography?.surface === 'light' || candidate.layout === 'blueprint-right';
  const colors = {
    white: palette.text ?? '#F7FAFF',
    primary: palette.accent ?? '#42D8FF',
    accent: palette.warm ?? '#F5BE45',
    danger: palette.danger ?? '#FF5B4D',
  };
  const headline = lines.map((line, index) => {
    const text = typeof line === 'string' ? line : line.text;
    const role = typeof line === 'string' ? 'white' : (line.role ?? 'white');
    const y = config.y + index * lineHeight;
    const stroke = candidate.typography?.stroke ?? (isLightSurface ? '#F7FAFF' : '#02060D');
    const strokeWidth = Number(candidate.typography?.strokeWidth ?? (isLightSurface ? 1.4 : 2.2));
    return `<text x="${config.x}" y="${y}" text-anchor="${config.anchor}" font-family="Noto Sans CJK SC, Source Han Sans SC, PingFang SC, sans-serif" font-size="${fontSize}" font-weight="900" fill="${colors[role] ?? colors.white}" stroke="${stroke}" stroke-width="${strokeWidth}" paint-order="stroke" letter-spacing="-4" filter="url(#textShadow)">${escapeXml(text)}</text>`;
  }).join('\n');
  const lastHeadlineY = config.y + Math.max(0, lines.length - 1) * lineHeight;
  const subtitleY = Math.max(config.subtitleY, lastHeadlineY + 82);
  const subtitle = candidate.copy?.subtitle
    ? `<text x="${config.x}" y="${subtitleY}" text-anchor="${config.anchor}" font-family="Noto Sans CJK SC, Source Han Sans SC, PingFang SC, sans-serif" font-size="${Number(candidate.typography?.subtitleSize ?? 39)}" font-weight="800" fill="${palette.muted ?? '#C4CFDD'}" stroke="${isLightSurface ? '#F7FAFF' : '#02060D'}" stroke-width="1.2" paint-order="stroke" letter-spacing="0">${escapeXml(candidate.copy.subtitle)}</text>`
    : '';
  const kickerX = showNumber ? 153 : 62;
  const kicker = task.brand?.kicker
    ? `<circle cx="${kickerX}" cy="82" r="5" fill="${palette.warm ?? '#F5BE45'}"/><text x="${kickerX + 16}" y="91" text-anchor="start" font-family="Noto Sans CJK SC, Source Han Sans SC, PingFang SC, sans-serif" font-size="27" font-weight="700" fill="${isLightSurface ? (palette.base ?? '#07111F') : (palette.text ?? '#F7FAFF')}" letter-spacing="1">${escapeXml(task.brand.kicker)}</text>`
    : '';
  const numberBadge = showNumber
    ? `<rect x="48" y="46" width="72" height="72" rx="19" fill="${palette.warm ?? '#F5BE45'}"/><text x="84" y="99" text-anchor="middle" font-family="Arial, sans-serif" font-size="48" font-weight="900" fill="#07111F">${escapeXml(candidate.id)}</text>`
    : '';
  const defaultTagX = candidate.layout === 'evidence-left' ? 624 : 62;
  const defaultTagY = candidate.layout === 'evidence-left' ? 800 : 1110;
  const tagStartX = Number(candidate.typography?.tagStartX ?? defaultTagX);
  const tagStartY = Number(candidate.typography?.tagStartY ?? defaultTagY);
  const tagDirection = candidate.typography?.tagDirection ?? (candidate.layout === 'evidence-left' ? 'vertical' : 'horizontal');
  const tags = (candidate.copy?.tags ?? []).slice(0, 3).map((tag, index) => {
    const tagWidth = Math.max(174, Math.min(238, 78 + Array.from(String(tag)).length * 28));
    const x = tagDirection === 'vertical' ? tagStartX : tagStartX + index * (tagWidth + 18);
    const y = tagDirection === 'vertical' ? tagStartY + index * 82 : tagStartY;
    return `<rect x="${x}" y="${y}" width="${tagWidth}" height="62" rx="18" fill="${palette.base ?? '#07111F'}" fill-opacity="0.88" stroke="${palette.accent ?? '#2FD4FF'}" stroke-width="1.6"/><text x="${x + tagWidth / 2}" y="${y + 42}" text-anchor="middle" font-family="Noto Sans CJK SC, Source Han Sans SC, PingFang SC, sans-serif" font-size="27" font-weight="800" fill="${palette.text ?? '#F7FAFF'}">${escapeXml(tag)}</text>`;
  }).join('\n');
  const disclosure = task.aiDisclosure?.required && task.aiDisclosure?.renderLabel === true
    ? `<text x="1018" y="1270" text-anchor="end" font-family="Noto Sans CJK SC, Source Han Sans SC, PingFang SC, sans-serif" font-size="22" font-weight="700" fill="${palette.muted ?? '#C4CFDD'}" opacity="0.82">${escapeXml(task.aiDisclosure.label ?? '部分画面由 AI 生成')}</text>`
    : '';
  const bigNumber = candidate.visualAccent?.bigNumber
    ? `<text x="${Number(candidate.visualAccent?.x ?? 790)}" y="${Number(candidate.visualAccent?.y ?? 1010)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Number(candidate.visualAccent?.size ?? 520)}" font-weight="900" fill="${candidate.visualAccent?.color ?? palette.warm ?? '#F5BE45'}" opacity="${Number(candidate.visualAccent?.opacity ?? 0.13)}">${escapeXml(candidate.visualAccent.bigNumber)}</text>`
    : '';

  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="textShadow" x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#020711" flood-opacity="0.45"/>
        </filter>
      </defs>
      ${bigNumber}
      ${kicker}
      ${numberBadge}
      ${headline}
      ${subtitle}
      ${tags}
      ${disclosure}
      <text x="62" y="1344" font-family="Noto Sans CJK SC, Source Han Sans SC, PingFang SC, sans-serif" font-size="27" font-weight="700" fill="${palette.muted ?? '#C4CFDD'}" opacity="0.78">${escapeXml(task.brand?.signature ?? '超哥 AI 创业记')}</text>
    </svg>
  `);
};

const renderCandidate = async (candidate, outputPath, {showNumber}) => {
  const framePath = extractFrame(candidate);
  const background = await loadBackground(candidate);
  const shadeLayer = renderCompositionShadeSvg(candidate);
  const portraitLayers = await makePortraitLayers(candidate, framePath);
  const textLayer = renderTextSvg(candidate, {showNumber});
  ensureParent(outputPath);
  await sharp(background)
    .composite([{input: shadeLayer, top: 0, left: 0}, ...portraitLayers, {input: textLayer, top: 0, left: 0}])
    .png({compressionLevel: 9})
    .toFile(outputPath);

  const thumbnailPath = resolveProjectPath(path.join(
    task.evidenceDir ?? `edit/verify/covers/${task.coverId}`,
    'thumbnails',
    `${showNumber ? `candidate-${candidate.id}` : 'final'}-270x360.png`,
  ));
  ensureParent(thumbnailPath);
  await sharp(outputPath).resize(270, 360, {fit: 'fill'}).png().toFile(thumbnailPath);
  const grayscalePath = resolveProjectPath(path.join(
    task.evidenceDir ?? `edit/verify/covers/${task.coverId}`,
    'grayscale',
    `${showNumber ? `candidate-${candidate.id}` : 'final'}-270x360-gray.png`,
  ));
  ensureParent(grayscalePath);
  await sharp(outputPath).resize(270, 360, {fit: 'fill'}).grayscale().png().toFile(grayscalePath);
  return {
    outputPath,
    framePath,
    mattePath: candidate.portrait?.mattePath ? resolveProjectPath(candidate.portrait.mattePath) : null,
    thumbnailPath,
    grayscalePath,
  };
};

const deepMergeCandidate = (candidate, overrides = {}) => ({
  ...candidate,
  ...overrides,
  copy: {...candidate.copy, ...(overrides.copy ?? {})},
  palette: {...candidate.palette, ...(overrides.palette ?? {})},
  portrait: {...candidate.portrait, ...(overrides.portrait ?? {})},
  background: {...candidate.background, ...(overrides.background ?? {})},
  typography: {...candidate.typography, ...(overrides.typography ?? {})},
});

const results = [];

if (mode === 'grid') {
  for (const candidate of candidates) {
    const outputPath = resolveProjectPath(candidate.output);
    results.push(await renderCandidate(candidate, outputPath, {showNumber: true}));
  }

  const gridOutput = resolveProjectPath(task.grid.output);
  ensureParent(gridOutput);
  const positions = [
    {left: gridMargin, top: gridMargin},
    {left: gridMargin + width + gridGap, top: gridMargin},
    {left: gridMargin, top: gridMargin + height + gridGap},
    {left: gridMargin + width + gridGap, top: gridMargin + height + gridGap},
  ];
  await sharp({create: {width: gridWidth, height: gridHeight, channels: 4, background: '#0B101A'}})
    .composite(results.map((item, index) => ({input: item.outputPath, ...positions[index]})))
    .png({compressionLevel: 9})
    .toFile(gridOutput);

  console.log(JSON.stringify({
    ok: true,
    mode,
    coverId: task.coverId,
    candidates: results,
    gridOutput,
    gridSize: `${gridWidth}x${gridHeight}`,
    warnings,
  }, null, 2));
} else {
  const selectedId = String(selectedArg || task.selection?.candidateId || '');
  const selected = candidates.find((candidate) => String(candidate.id) === selectedId);
  if (!selected) {
    throw new Error('最终精修必须提供用户选中的编号 1、2、3 或 4。');
  }
  if (!task.final?.output) {
    throw new Error('任务单缺少 final.output。');
  }
  const finalCandidate = deepMergeCandidate(selected, task.final?.overrides ?? {});
  const finalOutput = resolveProjectPath(task.final.output);
  const result = await renderCandidate(finalCandidate, finalOutput, {showNumber: false});
  console.log(JSON.stringify({
    ok: true,
    mode,
    coverId: task.coverId,
    selectedId,
    finalOutput,
    result,
    warnings,
  }, null, 2));
}
