import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const requireFromRemotion = createRequire(new URL('../remotion/package.json', import.meta.url));
const {chromium} = requireFromRemotion('playwright');

const [url, name = 'evidence', needle, offsetRaw = '-180'] = process.argv.slice(2);

if (!url || !needle) {
  console.error('用法：node tools/capture-evidence-viewport.mjs <URL> <文件名> <定位文字> [纵向偏移]');
  process.exit(1);
}

const safeName = name.replace(/[^\p{Script=Han}\w.-]+/gu, '_');
const offsetY = Number(offsetRaw);
const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const assetPath = path.join(projectRoot, 'assets/screenshots', `${safeName}.png`);
const publicPath = path.join(projectRoot, 'remotion/public/screenshots', `${safeName}.png`);
const sourcePath = path.join(projectRoot, 'assets/screenshots', `${safeName}.source.json`);

await fs.mkdir(path.dirname(assetPath), {recursive: true});
await fs.mkdir(path.dirname(publicPath), {recursive: true});

const browser = await chromium.launch({headless: true});
const page = await browser.newPage({viewport: {width: 1440, height: 1080}, deviceScaleFactor: 1});
await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 60000});
await page.waitForTimeout(1200);

const match = page.getByText(needle, {exact: false}).first();
if ((await match.count()) === 0) {
  throw new Error(`页面中未找到定位文字：${needle}`);
}

await match.scrollIntoViewIfNeeded();
await page.evaluate((offset) => window.scrollBy(0, offset), Number.isFinite(offsetY) ? offsetY : -180);
await page.waitForTimeout(300);
await page.screenshot({path: assetPath, fullPage: false});

const metadata = {
  schemaVersion: 1,
  url,
  title: await page.title(),
  locatorText: needle,
  capturedAt: new Date().toISOString(),
  viewport: {width: 1440, height: 1080},
  output: path.relative(projectRoot, assetPath),
};

await fs.writeFile(sourcePath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
await fs.copyFile(assetPath, publicPath);
await browser.close();

console.log(`已保存证据截图：${assetPath}`);
console.log(`已保存来源元数据：${sourcePath}`);
console.log(`已同步到 Remotion：${publicPath}`);
