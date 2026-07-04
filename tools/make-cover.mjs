import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const requireFromRemotion = createRequire(new URL('../remotion/package.json', import.meta.url));
const sharp = requireFromRemotion('sharp');

const [baseImage, title = '甘肃企业', subtitle = '别错过 AI 这波机会', outName = 'cover.png'] =
  process.argv.slice(2);

if (!baseImage) {
  console.error('用法：node tools/make-cover.mjs 底图.png 主标题 副标题 输出名.png');
  process.exit(1);
}

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const assetPath = path.join(projectRoot, 'assets/covers', outName);
const publicPath = path.join(projectRoot, 'remotion/public/covers', outName);

await fs.mkdir(path.dirname(assetPath), {recursive: true});
await fs.mkdir(path.dirname(publicPath), {recursive: true});

const escapeXml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const svg = `
<svg width="1920" height="1080" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="shade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#050A12" stop-opacity="0.96"/>
      <stop offset="0.62" stop-color="#050A12" stop-opacity="0.58"/>
      <stop offset="1" stop-color="#050A12" stop-opacity="0.84"/>
    </linearGradient>
  </defs>
  <rect width="1920" height="1080" fill="url(#shade)"/>
  <rect x="78" y="82" rx="14" ry="14" width="138" height="64" fill="#FFD23F"/>
  <text x="102" y="126" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="34" font-weight="900" fill="#050A12">第一集</text>
  <text x="78" y="360" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="144" font-weight="900" fill="#F7FAFF">${escapeXml(title)}</text>
  <rect x="82" y="455" width="16" height="112" fill="#19D3FF"/>
  <text x="122" y="540" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="76" font-weight="900" fill="#FFD23F">${escapeXml(subtitle)}</text>
  <text x="84" y="990" font-family="Arial Unicode MS, PingFang SC, sans-serif" font-size="34" font-weight="800" fill="#B8C1D1">兰州 AI 创业者 · AI 落地观察</text>
</svg>`;

const buffer = await sharp(baseImage)
  .resize(1920, 1080, {fit: 'cover'})
  .modulate({saturation: 0.9, brightness: 0.82})
  .composite([{input: Buffer.from(svg), top: 0, left: 0}])
  .png()
  .toBuffer();

await fs.writeFile(assetPath, buffer);
await fs.copyFile(assetPath, publicPath);

console.log(`已生成封面：${assetPath}`);
console.log(`已同步到 Remotion：${publicPath}`);
