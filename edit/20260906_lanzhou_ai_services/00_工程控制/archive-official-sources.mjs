import {chromium} from '../../../remotion/node_modules/playwright/index.mjs';
import {mkdirSync, writeFileSync, existsSync, readFileSync, statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, '03_官方素材');
mkdirSync(out, {recursive: true});
const items = [];
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
function save(name, bytes, metadata) {
  const target = path.join(out, name);
  if (existsSync(target)) {
    if (!process.argv.includes('--recover')) throw new Error(`已有文件，禁止覆盖：${name}`);
    bytes = readFileSync(target);
    metadata = {...metadata, retrievedAt: statSync(target).mtime.toISOString(), recoveredExistingFile: true};
  } else writeFileSync(target, bytes, {flag: 'wx'});
  items.push({path: target, sha256: sha(bytes), ...metadata});
}

const sources = [
  {id: 'O01', name: '工信部通知原文', url: 'https://www.miit.gov.cn/zwgk/zcwj/wjfb/tz/art/2026/art_6fbc038bf15c445ab53b2a94a3f9d4e4.html', publicationDate: '2026-08-31', signedDate: '2026-08-27', publisher: '工业和信息化部办公厅', requiredText: '工信厅科函〔2026〕414号'},
  {id: 'O02', name: '七问一图_鄂尔多斯工信局官方转载', url: 'https://gxj.ordos.gov.cn/bsfw/bszn_126442/202609/t20260903_1934309.html', publicationDate: '2026-09-03', publisher: '鄂尔多斯市工业和信息化局', originalCredit: '工业和信息化部科技司', requiredText: '七问+一图'},
];
const browser = await chromium.launch({headless: true});
try {
  for (const source of sources) {
    const page = await browser.newPage({viewport: {width: 1440, height: 1080}, deviceScaleFactor: 1.5});
    const response = await page.goto(source.url, {waitUntil: 'domcontentloaded', timeout: 45000});
    await page.locator('body').filter({hasText: source.requiredText}).waitFor();
    const text = await page.locator('body').innerText();
    if (!response?.ok() || !text.includes(source.requiredText)) throw new Error(`来源内容不符：${source.id}`);
    const metadata = {...source, retrievedAt: new Date().toISOString(), finalUrl: page.url(), status: response.status()};
    save(`${source.id}_${source.name}.html`, await page.content(), {...metadata, kind: 'live-page-html'});
    save(`${source.id}_${source.name}.txt`, text, {...metadata, kind: 'live-page-text'});
    save(`${source.id}_官网完整页面.png`, await page.screenshot({fullPage: true}), {...metadata, kind: 'unaltered-live-page-screenshot'});
    if (source.id === 'O01') {
      save('O01_通知标题与日期.png', await page.screenshot(), {...metadata, kind: 'unaltered-viewport-screenshot'});
      for (const [key, needle] of [['服务商定义', '人工智能应用服务商（以下简称服务商）是指'], ['扎根用户现场', '任务四：加强服务商支撑保障']]) {
        const paragraph = page.locator('p').filter({hasText: needle}).first();
        await paragraph.scrollIntoViewIfNeeded();
        save(`O01_${key}_原文段落.png`, await paragraph.screenshot(), {...metadata, kind: 'unaltered-source-paragraph-screenshot', excerptLocator: `p contains ${needle}`});
      }
      const links = await page.locator('a').evaluateAll((nodes) => nodes.map(n => ({title: n.textContent.trim(), url: n.href})).filter(n => /\.wps($|\?)/i.test(n.url)));
      for (const [index, link] of links.entries()) {
        const download = await page.request.get(link.url, {timeout: 45000});
        if (!download.ok()) throw new Error(`附件下载失败：${link.url}`);
        const bytes = await download.body();
        if (bytes.length < 1000 || bytes.subarray(0, 200).toString().includes('<html')) throw new Error('附件不是预期文件');
        save(`附件${index + 1}_${link.title.replace(/^[0-9]+\./, '')}.wps`, bytes, {...metadata, downloadUrl: link.url, kind: 'official-original-attachment', use: '研究备查，不能当成本公司入选证明'});
      }
    } else {
      await page.waitForFunction(() => Array.from(document.images).some(n => n.naturalWidth > 800 && n.naturalHeight > 2000));
      const pictures = await page.locator('img').evaluateAll(ns => ns.map(n => ({url: n.src, width: n.naturalWidth, height: n.naturalHeight})).filter(n => n.width > 800 && n.height > 2000));
      if (pictures.length !== 1) throw new Error('解读长图必须唯一');
      const picture = pictures[0];
      const bytes = await page.evaluate(async (url) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error('官方长图下载失败');
        return Array.from(new Uint8Array(await response.arrayBuffer()));
      }, picture.url);
      save('O02_七问一图_官方原始长图.jpg', Buffer.from(bytes), {...metadata, ...picture, transport: 'browser-same-origin-fetch', kind: 'official-reposted-original-infographic', use: '按段取用并保留来源；不得整图缩成不可读的小图'});
    }
    await page.close();
  }
} finally {
  await browser.close();
}
save('official-source-manifest.v1.json', `${JSON.stringify({schemaVersion:'koubo-official-material-intake/v1', createdAt:new Date().toISOString(), items, linkBoundary:{url:'https://weixin.qq.com/sph/AYni8IHd5x', status:'unavailable', fullContentRead:false, policy:'不绕过站点限制，不声称还原该视频号内容；独立核对官方通知和官方转载解读'}, forbiddenUses:['暗示本公司已获工信部认证或资源池入选','拿附件表格冒充已获资质','用无关会议视频冒充本通知发布现场']},null,2)}\n`, {kind:'intake-receipt'});
console.log(JSON.stringify({ok:true, itemCount:items.length-1, manifest:path.join(out,'official-source-manifest.v1.json')}));
