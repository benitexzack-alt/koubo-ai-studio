import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';

const projectRoot = path.resolve('edit/20260912_ai_no_new_business_model');
const assetRoot = path.join(projectRoot, '01_素材投放区', '05_公开素材_Codex准备');
const workRoot = path.join(projectRoot, '00_工程控制', 'v8-candidate-r1', 'public-assets');
const runtimeMediaRoot = path.resolve('remotion/public-ai-no-new-business-model-v8-r1/media');
const fontRegular = '/Users/pc/Library/Fonts/NotoSansCJKsc-Regular.otf';
const fontMedium = '/Users/pc/Library/Fonts/NotoSansCJKsc-Medium.otf';
const fontBold = '/Users/pc/Library/Fonts/NotoSansCJKsc-Bold.otf';
const fontBlack = '/Users/pc/Library/Fonts/NotoSansCJKsc-Black.otf';
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

mkdirSync(workRoot, {recursive: true});
mkdirSync(runtimeMediaRoot, {recursive: true});

const palette = {
  paper: '#f4eee3',
  paper2: '#e9dfcf',
  ink: '#152436',
  muted: '#637080',
  red: '#e85f45',
  blue: '#2d5f89',
  cream: '#fffaf1',
  dark: '#0f1d2b',
  green: '#4d7e6a',
  gold: '#c18b3b',
};

function esc(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function tspans(lines, x, dy = 1.25) {
  return lines.map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : dy}em">${esc(line)}</tspan>`).join('');
}

function baseSvg(content, title, kicker, footer) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <defs>
    <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${palette.cream}"/>
      <stop offset="1" stop-color="${palette.paper2}"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="16" stdDeviation="18" flood-color="#0b1620" flood-opacity="0.13"/>
    </filter>
    <pattern id="fibres" width="42" height="42" patternUnits="userSpaceOnUse">
      <path d="M0 15 Q12 11 24 16 T48 16" fill="none" stroke="#9d8d77" stroke-width="1" opacity="0.12"/>
      <path d="M7 34 Q18 29 31 35" fill="none" stroke="#ffffff" stroke-width="1" opacity="0.22"/>
    </pattern>
  </defs>
  <rect width="1920" height="1080" fill="url(#paper)"/>
  <rect width="1920" height="1080" fill="url(#fibres)"/>
  <rect x="0" y="0" width="28" height="1080" fill="${palette.red}"/>
  <text x="96" y="88" font-family="Noto Sans CJK SC" font-size="28" font-weight="600" fill="${palette.red}" letter-spacing="3">${esc(kicker)}</text>
  <text x="96" y="175" font-family="Noto Sans CJK SC" font-size="68" font-weight="900" fill="${palette.ink}">${esc(title)}</text>
  ${content.trim()}
  <line x1="96" y1="1004" x2="1824" y2="1004" stroke="#b5aa99" stroke-width="2"/>
  <text x="96" y="1045" font-family="Noto Sans CJK SC" font-size="23" fill="${palette.muted}">${esc(footer)}</text>
</svg>`;
}

function renderSvg(relativeOutput, svg) {
  const pngPath = path.join(assetRoot, relativeOutput);
  const svgPath = path.join(workRoot, `${path.basename(relativeOutput, '.png')}.svg`);
  const chromeProfile = mkdtempSync(path.join(tmpdir(), 'koubo-public-assets-chrome-'));
  mkdirSync(path.dirname(pngPath), {recursive: true});
  writeFileSync(svgPath, svg, 'utf8');
  let chromeResult;
  try {
    chromeResult = spawnSync(chrome, [
      '--headless=new',
      `--user-data-dir=${chromeProfile}`,
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-background-mode',
      '--disable-component-update',
      '--disable-default-apps',
      '--no-first-run',
      '--no-default-browser-check',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--window-size=1920,1080',
      `--screenshot=${pngPath}`,
      `file://${svgPath}`,
    ], {stdio: 'inherit', timeout: 12000, killSignal: 'SIGKILL'});
  } finally {
    rmSync(chromeProfile, {recursive: true, force: true});
  }
  if (!existsSync(pngPath)) {
    throw new Error(`Chrome screenshot failed for ${relativeOutput}: ${chromeResult.error ?? chromeResult.status}`);
  }
  return pngPath;
}

function run(command, args) {
  const result = spawnSync(command, args, {stdio: 'inherit'});
  if (result.status !== 0) {
    throw new Error(`${command} failed with status ${result.status}`);
  }
}

const r01 = baseSvg(`
  <g filter="url(#shadow)">
    <rect x="96" y="250" width="540" height="620" rx="34" fill="#fffaf2"/>
    <rect x="690" y="250" width="540" height="620" rx="34" fill="#fffaf2"/>
    <rect x="1284" y="250" width="540" height="620" rx="34" fill="#fffaf2"/>
  </g>
  <text x="140" y="320" font-family="Noto Sans CJK SC" font-size="26" font-weight="700" fill="${palette.blue}">国家信息中心 · 2026-07-13</text>
  <text x="140" y="425" font-family="Noto Sans CJK SC" font-size="50" font-weight="900" fill="${palette.ink}">${tspans(['颠覆式革新', '模式的重塑'], 140, 1.35)}</text>
  <text x="140" y="655" font-family="Noto Sans CJK SC" font-size="29" fill="${palette.muted}">${tspans(['标题：以“人工智能+”', '开拓产业未来发展新赛道'], 140, 1.45)}</text>

  <text x="734" y="320" font-family="Noto Sans CJK SC" font-size="26" font-weight="700" fill="${palette.blue}">北京市政府 · 2026-08-26</text>
  <text x="734" y="425" font-family="Noto Sans CJK SC" font-size="50" font-weight="900" fill="${palette.ink}">${tspans(['冲击范式基础', '重塑叙事体系'], 734, 1.35)}</text>
  <text x="734" y="655" font-family="Noto Sans CJK SC" font-size="29" fill="${palette.muted}">${tspans(['标题：人工智能正从根基上', '冲击主流经济学的范式基础', '和叙事体系'], 734, 1.38)}</text>

  <text x="1328" y="320" font-family="Noto Sans CJK SC" font-size="26" font-weight="700" fill="${palette.blue}">湖北省科技厅 · 2023-10-23</text>
  <text x="1328" y="425" font-family="Noto Sans CJK SC" font-size="50" font-weight="900" fill="${palette.ink}">${tspans(['人工智能', '开启新时代'], 1328, 1.35)}</text>
  <text x="1328" y="655" font-family="Noto Sans CJK SC" font-size="29" fill="${palette.muted}">${tspans(['标题：武汉获颁国家级', '人工智能商用平台牌照'], 1328, 1.45)}</text>
  <rect x="96" y="906" width="1728" height="66" rx="20" fill="${palette.ink}"/>
  <text x="960" y="950" text-anchor="middle" font-family="Noto Sans CJK SC" font-size="27" font-weight="700" fill="#fff">仅展示3个公开页面示例，不代表所有AI文章</text>
`, 'AI叙事中的关键词', '宏大叙事，真实存在', '来源：国家信息中心 · 北京市政府 · 湖北省科技厅');

const r02 = baseSvg(`
  <g filter="url(#shadow)">
    <rect x="96" y="250" width="396" height="620" rx="34" fill="#fffaf2"/>
    <rect x="530" y="250" width="396" height="620" rx="34" fill="#fffaf2"/>
    <rect x="964" y="250" width="396" height="620" rx="34" fill="#fffaf2"/>
    <rect x="1398" y="250" width="426" height="620" rx="34" fill="#fffaf2"/>
  </g>
  <circle cx="172" cy="330" r="38" fill="${palette.red}"/><text x="172" y="342" text-anchor="middle" font-family="Noto Sans CJK SC" font-size="34" font-weight="900" fill="#fff">1</text>
  <text x="142" y="420" font-family="Noto Sans CJK SC" font-size="35" font-weight="900" fill="${palette.ink}">${tspans(['按需运力', 'Uber'], 142, 1.35)}</text>
  <text x="142" y="560" font-family="Noto Sans CJK SC" font-size="27" fill="${palette.muted}">${tspans(['发出行程请求', '↓', '平台匹配司机'], 142, 1.45)}</text>

  <circle cx="606" cy="330" r="38" fill="${palette.gold}"/><text x="606" y="342" text-anchor="middle" font-family="Noto Sans CJK SC" font-size="34" font-weight="900" fill="#fff">2</text>
  <text x="576" y="420" font-family="Noto Sans CJK SC" font-size="35" font-weight="900" fill="${palette.ink}">${tspans(['空间供给', 'Airbnb'], 576, 1.35)}</text>
  <text x="576" y="560" font-family="Noto Sans CJK SC" font-size="27" fill="${palette.muted}">${tspans(['房东发布空间', '↓', '房客预订住宿'], 576, 1.45)}</text>

  <circle cx="1040" cy="330" r="38" fill="${palette.blue}"/><text x="1040" y="342" text-anchor="middle" font-family="Noto Sans CJK SC" font-size="34" font-weight="900" fill="#fff">3</text>
  <text x="1010" y="420" font-family="Noto Sans CJK SC" font-size="35" font-weight="900" fill="${palette.ink}">${tspans(['软件订阅', 'SaaS'], 1010, 1.35)}</text>
  <text x="1010" y="560" font-family="Noto Sans CJK SC" font-size="27" fill="${palette.muted}">${tspans(['云端软件服务', '↓', '按年/月订阅'], 1010, 1.45)}</text>

  <circle cx="1474" cy="330" r="38" fill="${palette.green}"/><text x="1474" y="342" text-anchor="middle" font-family="Noto Sans CJK SC" font-size="34" font-weight="900" fill="#fff">4</text>
  <text x="1444" y="420" font-family="Noto Sans CJK SC" font-size="35" font-weight="900" fill="${palette.ink}">${tspans(['社交拼购', '京喜拼购'], 1444, 1.35)}</text>
  <text x="1444" y="560" font-family="Noto Sans CJK SC" font-size="27" fill="${palette.muted}">${tspans(['发起/参与拼购', '↓', '共享活动入口'], 1444, 1.45)}</text>
  <rect x="96" y="906" width="1728" height="66" rx="20" fill="${palette.ink}"/>
  <text x="960" y="950" text-anchor="middle" font-family="Noto Sans CJK SC" font-size="27" font-weight="700" fill="#fff">这些页面只说明案例机制，不单独证明“全新商业模式”</text>
`, '商业模式案例', '改变“谁来提供”和“怎么付费”', '来源：Uber · Airbnb · 腾讯云 SaaS · 京喜拼购官方页面');

const r03 = baseSvg(`
  <g filter="url(#shadow)">
    <rect x="96" y="270" width="820" height="560" rx="38" fill="#fffaf2"/>
    <rect x="1004" y="270" width="820" height="560" rx="38" fill="#fffaf2"/>
  </g>
  <text x="150" y="350" font-family="Noto Sans CJK SC" font-size="30" font-weight="700" fill="${palette.blue}">码头装卸生产率</text>
  <text x="150" y="510" font-family="Noto Sans CJK SC" font-size="88" font-weight="900" fill="${palette.ink}">1.4</text>
  <path d="M385 480 H555" stroke="${palette.red}" stroke-width="16" stroke-linecap="round"/><path d="M555 480 l-36 -27 v54 z" fill="${palette.red}"/>
  <text x="610" y="510" font-family="Noto Sans CJK SC" font-size="88" font-weight="900" fill="${palette.ink}">30</text>
  <text x="150" y="590" font-family="Noto Sans CJK SC" font-size="32" fill="${palette.muted}">吨 / 人时</text>
  <text x="150" y="700" font-family="Noto Sans CJK SC" font-size="58" font-weight="900" fill="${palette.red}">约 21 倍</text>
  <text x="150" y="775" font-family="Noto Sans CJK SC" font-size="23" fill="${palette.muted}">美国联邦上诉法院判决记录中引用的估算</text>

  <text x="1058" y="350" font-family="Noto Sans CJK SC" font-size="30" font-weight="700" fill="${palette.blue}">一次历史案例的装船处理成本</text>
  <text x="1058" y="510" font-family="Noto Sans CJK SC" font-size="78" font-weight="900" fill="${palette.ink}">$5.83</text>
  <path d="M1360 480 H1500" stroke="${palette.red}" stroke-width="16" stroke-linecap="round"/><path d="M1500 480 l-36 -27 v54 z" fill="${palette.red}"/>
  <text x="1540" y="510" font-family="Noto Sans CJK SC" font-size="78" font-weight="900" fill="${palette.ink}">$0.158</text>
  <text x="1058" y="590" font-family="Noto Sans CJK SC" font-size="32" fill="${palette.muted}">美元 / 吨</text>
  <text x="1058" y="700" font-family="Noto Sans CJK SC" font-size="58" font-weight="900" fill="${palette.red}">约下降 97%</text>
  <text x="1058" y="775" font-family="Noto Sans CJK SC" font-size="23" fill="${palette.muted}">USC Sea Grant 文章引用 Levinson（2006）</text>
  <rect x="96" y="870" width="1728" height="102" rx="24" fill="${palette.ink}"/>
  <text x="960" y="914" text-anchor="middle" font-family="Noto Sans CJK SC" font-size="29" font-weight="900" fill="#fff">装船处理成本 ≠ 整体运输成本</text>
  <text x="960" y="954" text-anchor="middle" font-family="Noto Sans CJK SC" font-size="25" fill="#fff">这些数据能支持码头效率与装船处理成本改善，不能等同于整体运输成本下降 90%</text>
`, '集装箱效率与成本', '码头装卸效率 · 装船处理成本', '来源：美国联邦上诉法院判决文书 · USC Sea Grant');

const r05 = baseSvg(`
  <g filter="url(#shadow)">
    <rect x="96" y="270" width="490" height="560" rx="36" fill="#fffaf2"/>
    <rect x="715" y="270" width="490" height="560" rx="36" fill="#fffaf2"/>
    <rect x="1334" y="270" width="490" height="560" rx="36" fill="#fffaf2"/>
  </g>
  <text x="150" y="350" font-family="Noto Sans CJK SC" font-size="27" font-weight="700" fill="${palette.blue}">01 · 广告主给输入</text>
  <text x="150" y="445" font-family="Noto Sans CJK SC" font-size="40" font-weight="900" fill="${palette.ink}">${tspans(['业务目标', '预算与出价', '素材与转化数据'], 150, 1.45)}</text>
  <text x="150" y="690" font-family="Noto Sans CJK SC" font-size="25" fill="${palette.muted}">${tspans(['转化跟踪和回传数据', '是模型学习的重要基础'], 150, 1.45)}</text>

  <path d="M608 550 H688" stroke="${palette.red}" stroke-width="16" stroke-linecap="round"/><path d="M688 550 l-34 -26 v52 z" fill="${palette.red}"/>
  <text x="769" y="350" font-family="Noto Sans CJK SC" font-size="27" font-weight="700" fill="${palette.blue}">02 · AI 做优化</text>
  <text x="769" y="445" font-family="Noto Sans CJK SC" font-size="40" font-weight="900" fill="${palette.ink}">${tspans(['评估更多信号', '预测转化概率', '逐次竞价调整'], 769, 1.45)}</text>
  <text x="769" y="690" font-family="Noto Sans CJK SC" font-size="25" fill="${palette.muted}">${tspans(['可以超出已填写的受众信号', '寻找更可能转化的人群'], 769, 1.45)}</text>

  <path d="M1227 550 H1307" stroke="${palette.red}" stroke-width="16" stroke-linecap="round"/><path d="M1307 550 l-34 -26 v52 z" fill="${palette.red}"/>
  <text x="1388" y="350" font-family="Noto Sans CJK SC" font-size="27" font-weight="700" fill="${palette.blue}">03 · 产出可验证</text>
  <text x="1388" y="445" font-family="Noto Sans CJK SC" font-size="40" font-weight="900" fill="${palette.ink}">${tspans(['更多匹配机会', '更准的出价', '报表与实验'], 1388, 1.45)}</text>
  <text x="1388" y="690" font-family="Noto Sans CJK SC" font-size="25" fill="${palette.muted}">${tspans(['用真实转化和长周期数据', '判断是否真正提效'], 1388, 1.45)}</text>
  <rect x="96" y="870" width="1728" height="102" rx="24" fill="${palette.ink}"/>
  <text x="960" y="914" text-anchor="middle" font-family="Noto Sans CJK SC" font-size="29" font-weight="900" fill="#fff">不是“一键找到所有客户”</text>
  <text x="960" y="954" text-anchor="middle" font-family="Noto Sans CJK SC" font-size="25" fill="#fff">效果依赖数据、素材、预算和业务基础，不保证覆盖扩大或成本下降</text>
`, '广告投放机制', '从人工假设，到数据驱动的优化', '来源：巨量引擎 · Google Ads 官方说明');

const r01Png = renderSvg('R01_宏大叙事/R01_宏大叙事_引用卡_1920x1080.png', r01);
const r02Png = renderSvg('R02_商业模式案例/R02_商业模式案例_机制卡_1920x1080.png', r02);
const r03Png = renderSvg('R03_集装箱数字口径/R03_集装箱效率成本_口径卡_1920x1080.png', r03);
const r05Png = renderSvg('R05_广告投放机制/R05_广告投放机制_边界卡_1920x1080.png', r05);

for (const [source, runtimeName] of [
  [r01Png, 'R01.png'],
  [r02Png, 'R02.png'],
  [r03Png, 'R03.png'],
  [r05Png, 'R05.png'],
]) {
  copyFileSync(source, path.join(runtimeMediaRoot, runtimeName));
}

const cardsOnly = process.argv.includes('--cards-only');

const r04Dir = path.join(assetRoot, 'R04_授权档案');
const shipOriginal = path.join(r04Dir, 'R04A_containership_santa_clara_original.ogv');
const shipClip = path.join(r04Dir, 'R04A_containership_28-34s_1920x1080.mp4');
const shipPreview = path.join(r04Dir, 'R04A_containership_31s_preview_1920x1080.png');
const naraOriginal = path.join(r04Dir, 'R04B_port_newark_containers_NARA_555270_original.jpg');
const naraFramed = path.join(r04Dir, 'R04B_port_newark_1974_framed_1920x1080.png');
const shenzhenOriginal = path.join(r04Dir, 'R04C_shenzhen_skyline_at_night_original.jpeg');
const shenzhenFramed = path.join(r04Dir, 'R04C_shenzhen_skyline_framed_1920x1080.png');

if (!cardsOnly) {
  const shipFilter = [
    '[0:v]split=2[bg][fg]',
    '[bg]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,gblur=sigma=26,eq=brightness=-0.20:saturation=0.72[bg2]',
    '[fg]scale=1440:1080:force_original_aspect_ratio=decrease[fg2]',
    '[bg2][fg2]overlay=(W-w)/2:(H-h)/2[v]'
  ].join(';');
  run('ffmpeg', ['-y', '-ss', '28', '-i', shipOriginal, '-t', '6', '-filter_complex', shipFilter, '-map', '[v]', '-an', '-r', '30', '-c:v', 'libx264', '-crf', '18', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', shipClip]);
  run('ffmpeg', ['-y', '-ss', '3', '-i', shipClip, '-frames:v', '1', shipPreview]);

  run('magick', [naraOriginal, '-auto-orient', '-resize', '1920x1080^', '-gravity', 'center', '-extent', '1920x1080', '-fill', '#0f1d2bcc', '-draw', 'rectangle 0,944 1920,1080', '-font', fontMedium, '-fill', 'white', '-pointsize', '34', '-gravity', 'southwest', '-annotate', '+72+77', '纽瓦克港码集装箱 · 1974年3月', '-font', fontRegular, '-pointsize', '25', '-annotate', '+72+34', '摄影：Dan McCoy · 美国国家档案馆（NARA） · 公有领域 · 已中心裁切', naraFramed]);
  run('magick', [shenzhenOriginal, '-auto-orient', '-resize', '1920x1080^', '-gravity', 'center', '-extent', '1920x1080', '-fill', '#0f1d2bcc', '-draw', 'rectangle 0,944 1920,1080', '-font', fontMedium, '-fill', 'white', '-pointsize', '34', '-gravity', 'southwest', '-annotate', '+72+77', '深圳城市夜景 · 历史语境画面', '-font', fontRegular, '-pointsize', '25', '-annotate', '+72+34', '摄影：Andreas Bunen · CC BY 3.0 · Wikimedia Commons · 已中心裁切', shenzhenFramed]);
}

const contactInputs = [
  r01Png,
  r02Png,
  r03Png,
  shipPreview,
  naraFramed,
  shenzhenFramed,
  r05Png,
];
const montagePath = path.join(workRoot, 'contact-montage.png');
run('magick', ['montage', '-font', fontRegular, ...contactInputs, '-thumbnail', '430x242', '-tile', '4x2', '-geometry', '+18+18', '-background', palette.dark, montagePath]);
const contactPath = path.join(assetRoot, '视觉复核', '公开素材接触表_1920x1080.png');
run('magick', ['-size', '1920x1080', `canvas:${palette.dark}`, '-font', fontBold, '-fill', 'white', '-pointsize', '48', '-gravity', 'northwest', '-annotate', '+72+48', '公开素材接触表 · R01–R05', montagePath, '-gravity', 'center', '-geometry', '+0+40', '-composite', '-font', fontRegular, '-fill', '#c6d0db', '-pointsize', '23', '-gravity', 'southwest', '-annotate', '+72+34', '用途：视觉复核 · 发布前仍需按实际口播时点重绑并保留来源标记', contactPath]);

console.log(cardsOnly
  ? `Built four public information cards, runtime copies, and current review sheet under ${assetRoot}`
  : `Built public assets under ${assetRoot}`);
