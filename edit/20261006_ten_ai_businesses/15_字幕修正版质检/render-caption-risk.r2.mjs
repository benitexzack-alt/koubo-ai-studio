import {createHash} from 'node:crypto';
import {readFileSync, mkdirSync, writeFileSync, existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundle} from '../../../remotion/node_modules/@remotion/bundler/dist/index.js';
import {openBrowser, selectComposition, renderStill} from '../../../remotion/node_modules/@remotion/renderer/dist/index.js';
import {validateKnowledgeContextForProductionV2} from '../../../tools/knowledge-context-production-gate.mjs';

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const out = resolve(root, 'edit/20261006_ten_ai_businesses/15_字幕修正版质检');
const jobPath = resolve(root, 'edit/20261006_ten_ai_businesses/00_成片控制/subtitle-r2/production-full-candidate.r2.json');
const job = JSON.parse(readFileSync(jobPath, 'utf8'));
const context = validateKnowledgeContextForProductionV2({projectRoot: root, jobPath, job, command: 'risk-frames'});
const runtimePath = resolve(root, 'remotion/src/ten-ai-businesses-final-r2/runtime-plan.r2.json');
const plan = JSON.parse(readFileSync(runtimePath, 'utf8'));
const longestZh = [...plan.captions].sort((a,b) => [...b.chinese].length - [...a.chinese].length)[0];
const longestEn = [...plan.captions].sort((a,b) => b.english.length - a.english.length)[0];
const center = c => Math.floor((c.from + c.to) / 2);
const frames = [...new Set([150, 580, 1199, 1611, 2284, 6235, 8510, center(longestZh), center(longestEn)])].sort((a,b)=>a-b);
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const framesDir = resolve(out, '修正后原尺寸');
if (existsSync(framesDir)) throw new Error('诊断图已存在，禁止覆盖');
mkdirSync(framesDir, {recursive: true});
const serveUrl = await bundle({entryPoint: resolve(root, 'remotion/src/ten-ai-businesses-final-r2/index.tsx'),
  publicDir: resolve(root, job.remotion.publicDir), symlinkPublicDir: true, enableCaching: true});
const browser = await openBrowser('chrome', {logLevel: 'error'});
const images = [];
try {
  const composition = await selectComposition({serveUrl, id: 'TenAIBusinessesFinalR2WithSfx', puppeteerInstance: browser});
  for (const frame of frames) {
    const output = resolve(framesDir, `F${String(frame).padStart(6,'0')}.png`);
    await renderStill({composition, serveUrl, output, frame, puppeteerInstance: browser, imageFormat: 'png', overwrite: false, logLevel: 'error'});
    const caption = plan.captions.find(c => frame >= c.from && frame < c.to);
    images.push({frame, output, sha256: hash(output), captionId: caption?.id, chinese: caption?.chinese, highlights: caption?.highlights});
    console.log(`已生成字幕风险帧 ${frame}：${caption?.id}`);
  }
} finally { await browser.close({silent: true}); }
writeFileSync(resolve(out, '字幕风险帧回执.r2.json'), JSON.stringify({purpose: '本期字幕实心字与重点色诊断；不是完整成片验收',
  contextPassed: context.ok ?? context.required, runtime: {path: runtimePath, sha256: hash(runtimePath)},
  images, fullFilmReviewed: false, published: false}, null, 2) + '\n', {flag: 'wx'});
