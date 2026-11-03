#!/usr/bin/env node
// 从本机授权资料和公开目录建立私用索引；不运行付费包，不下载预览媒体。
import { readFile, readdir, mkdir, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundle = process.env.MOTION_LIBRARY_PATH;
const pageCache = process.env.MOTION_PAGE_CACHE;
if (!bundle) throw new Error('请设置 MOTION_LIBRARY_PATH 指向自行取得使用许可的本地资料目录。');
const pageUrl = 'https://skillry.dev/zh/ai-videos/ai-motion-graphics';
const args = new Set(process.argv.slice(2));
const unknown = [...args].filter(a => !['--refresh', '--check-media'].includes(a));
if (unknown.length) throw new Error(`未知选项：${unknown.join('、')}`);

const categories = {
  split: '人物分屏', pip: '画中画', type: '文字动画', chapter: '章节卡',
  transition: '转场', spotlight: '局部聚焦', comparison: '对比图表',
  diagram: '流程图解', cards: '卡片清单', collage: '图片拼贴',
};
const sha = value => createHash('sha256').update(value).digest('hex');
const hasChinese = value => /[\u3400-\u9fff]/u.test(value);
const stringPattern = '"(?:\\\\.|[^"\\\\])*"';
const originalsPath = path.join(bundle, '02_原始Skill/bs-creatormotion/references/catalog.json');
const originalsBytes = await readFile(originalsPath);
const originals = JSON.parse(originalsBytes);
if (originals.effects?.length !== 122 || new Set(originals.effects.map(x => x.slug)).size !== 122) {
  throw new Error('原始目录必须是122个不重复效果；原包变化时请先复核。');
}

const reviewDir = path.join(bundle, '04_本期匹配与检查');
const reviewFiles = (await readdir(reviewDir)).filter(n => /^全库场景审查_R2_.*\.json$/u.test(n)).sort();
const reviews = new Map();
const sources = [{ path: originalsPath, sha256: sha(originalsBytes), purpose: '效果编号、分类、时长与素材类型' }];
for (const name of reviewFiles) {
  const file = path.join(reviewDir, name);
  const bytes = await readFile(file);
  for (const item of JSON.parse(bytes).records || []) {
    if (reviews.has(item.effectId)) throw new Error(`中文说明重复：${item.effectId}`);
    reviews.set(item.effectId, item);
  }
  sources.push({ path: file, sha256: sha(bytes), purpose: '仅复用动作签名和通用素材条件，不复用旧期选择' });
}

let html;
let pageEvidence;
if (args.has('--refresh')) {
  try {
    const response = await fetch(pageUrl, {
      signal: AbortSignal.timeout(20000), headers: { 'user-agent': 'Mozilla/5.0 (local motion catalog)' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    html = await response.text();
    pageEvidence = { url: pageUrl, mode: '公开页面实时读取', observedAt: new Date().toISOString() };
  } catch (error) {
    pageEvidence = { url: pageUrl, mode: '历史页面缓存', refreshError: String(error.message) };
  }
}
if (!html) {
  if (!pageCache) throw new Error('未获取页面：请使用 --refresh，或设置 MOTION_PAGE_CACHE 指向本机页面缓存。');
  html = await readFile(pageCache, 'utf8');
  pageEvidence = {
    ...pageEvidence, url: pageUrl, mode: '历史页面缓存', path: pageCache,
    cachedDate: path.basename(pageCache).match(/(20\d{6})/)?.[1]?.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') || null,
  };
}
pageEvidence.sha256 = sha(html);

// 只读取公开页面中的字符串字段，绝不 eval 或执行页面中的脚本。
function field(block, key) {
  const match = block.match(new RegExp(`(?:^|[,\\s{])${key}:(${stringPattern})`));
  return match ? JSON.parse(match[1]) : null;
}
function absoluteUrl(value, kind) {
  if (!value) throw new Error(`缺少${kind}地址`);
  const url = new URL(value.replaceAll('&amp;', '&'), pageUrl);
  if (url.protocol !== 'https:' || !['skillry.dev', 'media.skillry.dev'].includes(url.hostname)) {
    throw new Error(`不支持的${kind}地址：${url.origin}`);
  }
  return url.href;
}
const pageItems = new Map();
const objectStart = /\$R\[\d+\]=\{name:/g;
for (const start of html.matchAll(objectStart)) {
  const from = start.index + start[0].indexOf('{');
  // 下一条状态对象是结构边界；字符串字段本身由JSON字符串规则解码。
  const next = html.indexOf('},$R[', from);
  const block = html.slice(from, next < 0 ? from + 10000 : next + 1);
  const id = field(block, 'slug');
  if (!id?.startsWith('bs-creatormotion-')) continue;
  const preview = field(block, 'previewVideoUrl');
  const poster = field(block, 'posterUrl');
  if (!preview || !poster) continue;
  pageItems.set(id, {
    name: field(block, 'name')?.replace(/^自媒体视频动效\s*[·・]\s*/u, '').trim(),
    description: field(block, 'description'),
    previewUrl: absoluteUrl(preview, '视频'), posterUrl: absoluteUrl(poster, '图片'),
  });
}
const expectedIds = new Set(originals.effects.map(e => e.slug));
const missing = [...expectedIds].filter(id => !pageItems.has(id));
const extra = [...pageItems.keys()].filter(id => !expectedIds.has(id));
if (missing.length || extra.length || pageItems.size !== 122) {
  throw new Error(`页面与原包不一致，未改已有索引：缺少${missing.length}，新增${extra.length}，页面${pageItems.size}。${missing.join('、')}`);
}

const generalRequirements = {
  'type-behind-subject': ['连续真人原片', '与原片同帧同尺寸的人物抠像', '本期标题文字'],
  'transition-tile-dissolve': ['连续真人原片', '实际章节切换位置', '下一场景或本期章节标题'],
  'cards-foreground-row': ['连续真人原片', '本期提及对象的真实图片或授权图', '对应实录的出现时间'],
  'diagram-branch-reveal': ['正文支持的层级与分支；不需外部图片'],
  'diagram-input-convergence': ['正文支持的多个输入项', '相关结果图；原包最多5个输入'],
  'diagram-list-bridge': ['正文列举的项目与目标；不需外部图片'],
  'diagram-radial-branches': ['正文支持的中心和分支节点；不需外部图片'],
  'spotlight-voice-transcript': ['经同意的真实原声', '实录字词时点', '实际文档页面'],
  'cards-inspect-split': ['两侧主题的真实图片或授权说明图', '准确结果图'],
  'cards-status-row': ['已核实的对象定位与状态', '需要品牌时的真实标识素材'],
  'collage-dossier-role': ['经同意的肖像', '四份授权材料', '实际相关手机页面'],
  'collage-portrait-notes': ['经同意的出镜者肖像', '真实注释', '真实原话'],
};
const effects = originals.effects.map(effect => {
  const page = pageItems.get(effect.slug);
  const review = reviews.get(effect.slug);
  if (!review || !hasChinese(page.name) || !hasChinese(page.description) || !hasChinese(review.signature)) {
    throw new Error(`缺少中文资料：${effect.slug}`);
  }
  const short = effect.slug.replace('bs-creatormotion-', '');
  const requirements = generalRequirements[short] || review.dependencies;
  if (!Array.isArray(requirements) || !requirements.length || requirements.some(x => !hasChinese(x))) {
    throw new Error(`素材要求不完整：${effect.slug}`);
  }
  return {
    id: effect.slug, name: page.name, category: effect.category,
    categoryLabel: categories[effect.category], description: page.description,
    signature: review.signature.replaceAll('take', '原片').replaceAll('alpha', '抠像层'),
    duration: effect.durationSeconds, videoRequirement: effect.videoRequirement,
    presenterMatte: effect.presenterMatte ?? null, requirements,
    previewUrl: page.previewUrl, posterUrl: page.posterUrl,
    officialUrl: `https://skillry.dev/zh/skills/${effect.slug}`,
    readiness: '待按本期内容适配',
  };
});

const evidence = {
  schemaVersion: 1, generatedAt: new Date().toISOString(), sourceFiles: sources,
  page: pageEvidence,
  counts: { expected: 122, source: originals.effects.length, page: pageItems.size, output: effects.length, missing: [], extra: [], duplicates: [] },
  usage: '本机私用索引，仅含目录与公开预览链接；未复制源码、未下载媒体、未注册或运行效果。',
  historicalFieldsExcluded: ['scriptAnchor', 'fit', 'priority', 'reason', 'displayText', 'adaptationDifference', 'acceptance'],
  interpretation: '动效示例可访问与本期实际适配、成片质量、人工验收为不同状态。',
};

if (args.has('--check-media')) {
  const requests = effects.flatMap(e => [
    { effectId: e.id, kind: 'preview', url: e.previewUrl },
    { effectId: e.id, kind: 'poster', url: e.posterUrl },
  ]);
  let cursor = 0;
  const checks = new Array(requests.length);
  async function worker() {
    while (cursor < requests.length) {
      const index = cursor++;
      const request = requests[index];
      const checkedAt = new Date().toISOString();
      try {
        const response = await fetch(request.url, {
          method: 'HEAD', signal: AbortSignal.timeout(15000),
          headers: { 'user-agent': 'Mozilla/5.0 (local motion catalog check)' },
        });
        const contentType = response.headers.get('content-type') || '';
        const mediaTypeMatches = request.kind === 'preview' ? contentType.startsWith('video/') : contentType.startsWith('image/');
        checks[index] = {
          ...request, checkedAt, status: response.status, ok: response.ok && mediaTypeMatches,
          contentType, contentLength: response.headers.get('content-length'),
          acceptRanges: response.headers.get('accept-ranges'),
        };
        await response.body?.cancel();
      } catch (error) {
        checks[index] = { ...request, checkedAt, ok: false, error: String(error.message) };
      }
      if ((index + 1) % 40 === 0) console.log(`已检查${index + 1}/${requests.length}个媒体地址（仅HEAD）`);
    }
  }
  await Promise.all(Array.from({ length: 5 }, worker));
  const previewChecks = checks.filter(x => x.kind === 'preview');
  const posterChecks = checks.filter(x => x.kind === 'poster');
  evidence.media = {
    method: 'HEAD', concurrency: 5, previewOk: previewChecks.filter(x => x.ok).length,
    posterOk: posterChecks.filter(x => x.ok).length, total: checks.length,
    failures: checks.filter(x => !x.ok), checks,
    boundary: '仅验证HTTP响应及媒体类型；没有下载媒体，不能替代浏览器播放验证。',
  };
  for (const effect of effects) {
    const matching = checks.filter(x => x.effectId === effect.id);
    effect.mediaStatus = Object.fromEntries(matching.map(x => [x.kind, x.ok ? '链接可访问' : '链接待复核']));
  }
}

const catalog = {
  version: '1.0.0', generatedAt: evidence.generatedAt,
  source: { name: 'CreatorMotion 本机授权归档', catalogSha256: sha(originalsBytes), page: pageEvidence, licenseScope: '本机私用' },
  categoryCounts: originals.categoryCounts, effects,
};
await mkdir(path.join(root, '.local'), { recursive: true });
async function save(name, value) {
  const destination = path.join(root, '.local', name);
  const temporary = `${destination}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, destination);
}
await save('catalog-evidence.json', evidence);
await save('catalog.json', catalog);
console.log(JSON.stringify({
  effects: effects.length, categories: Object.keys(categories).length, page: pageEvidence.mode,
  previewOk: evidence.media?.previewOk ?? null, posterOk: evidence.media?.posterOk ?? null,
  failures: evidence.media?.failures.map(({ effectId, kind, status, error }) => ({ effectId, kind, status, error })) ?? [],
  output: path.join(root, '.local/catalog.json'),
}, null, 2));
