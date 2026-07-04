import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const requireFromRemotion = createRequire(new URL('../remotion/package.json', import.meta.url));
const {chromium} = requireFromRemotion('playwright');

const [url, name = 'capture'] = process.argv.slice(2);

if (!url) {
  console.error('用法：node tools/capture-page.mjs https://example.com 文件名');
  process.exit(1);
}

const safeName = name.replace(/[^\p{Script=Han}\w.-]+/gu, '_');
const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const assetPath = path.join(projectRoot, 'assets/screenshots', `${safeName}.png`);
const publicPath = path.join(projectRoot, 'remotion/public/screenshots', `${safeName}.png`);

await fs.mkdir(path.dirname(assetPath), {recursive: true});
await fs.mkdir(path.dirname(publicPath), {recursive: true});

const browser = await chromium.launch({headless: true});
const page = await browser.newPage({viewport: {width: 1440, height: 1080}, deviceScaleFactor: 1});
await page.goto(url, {waitUntil: 'networkidle', timeout: 60000});
await page.screenshot({path: assetPath, fullPage: true});
await browser.close();
await fs.copyFile(assetPath, publicPath);

console.log(`已保存截图：${assetPath}`);
console.log(`已同步到 Remotion：${publicPath}`);
