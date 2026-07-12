import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';

const requireFromRemotion = createRequire(new URL('../remotion/package.json', import.meta.url));
const {chromium} = requireFromRemotion('playwright');

const [sourcePageUrl, pdfUrl, outputPath] = process.argv.slice(2);

if (!sourcePageUrl || !pdfUrl || !outputPath) {
  console.error('用法：node tools/download-official-pdf.mjs <来源页URL> <PDF URL> <输出路径>');
  process.exit(1);
}

const browser = await chromium.launch({headless: true});
const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36',
});

const page = await context.newPage();
await page.goto(sourcePageUrl, {waitUntil: 'domcontentloaded', timeout: 60000});

const response = await context.request.get(pdfUrl, {
  headers: {
    Referer: sourcePageUrl,
    Accept: 'application/pdf,*/*',
  },
  timeout: 60000,
});

if (!response.ok()) {
  throw new Error(`PDF 下载失败：HTTP ${response.status()}`);
}

const body = await response.body();
await fs.mkdir(path.dirname(outputPath), {recursive: true});
await fs.writeFile(outputPath, body);
await browser.close();

console.log(`已保存官方 PDF：${outputPath}`);
