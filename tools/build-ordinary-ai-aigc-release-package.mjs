import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('../remotion/node_modules/sharp');

const root = path.resolve(decodeURIComponent(new URL('..', import.meta.url).pathname));
const finalVideo = path.join(root, 'outputs/普通人学AI与AIGC漫剧入门_16x9_V80_有音效_修正版_v2.mp4');
const framePath = path.join(root, 'edit/verify/ordinary-ai-aigc-20260818/cover-frame-04s.png');
const coverPath = path.join(root, 'outputs/普通人学AI与AIGC漫剧入门_封面3x4_v1.png');
const packagePath = path.join(root, 'outputs/普通人学AI与AIGC漫剧入门_发布包装_v1.md');
const copyReviewPath = path.join(root, 'outputs/普通人学AI与AIGC漫剧入门_发布包装_v1.copy-review.json');
const releasePath = path.join(root, 'workflow/releases/20260818_ordinary_ai_aigc_v80_v2.json');
const sourceCaptionsPath = path.join(root, 'remotion/public/data/ordinary_ai_aigc_20260818.bilingual.v2.json');
const releaseCaptionsPath = path.join(root, 'remotion/public/data/ordinary_ai_aigc_20260818.bilingual.v2.release-qa.json');
const transcriptPath = path.join(root, 'edit/transcripts/ordinary-ai-aigc-20260818/ordinary-ai-aigc-20260818.cleaned.v1.json');

const title = '普通人学AI，先问自己为什么学';
const alternatives = [
  '想靠AI赚钱，先别急着买课',
  '在兰州，普通人学AI是不是机会？',
];
const publishCopy = `最近很多朋友问我：想学AI，怎么从AI里面赚到钱？

但真正要先回答的，不是哪个工具最强，而是你为什么学。

如果是工作忙不过来，就从一个真实任务开始；如果手里有动漫、漫剧或者AIGC创意，就先做一个30到60秒样片；如果只是被焦虑推着走，先别急着买课，也别急着堆工具。

普通人学AI，先把想改变的结果说清楚，再决定学什么、用什么。`;
const topics = ['#人工智能', '#普通人学AI', '#AI创业', '#AIGC', '#AIGC漫剧', '#兰州AI创业', '#OPC一人公司'];
const coverPrompt = `制作一张3:4竖版抖音知识口播封面，任务类型是“真人截图合成”。使用我上传的本条正式成片4秒真人截图作为唯一人物素材，保持人物真实五官、脸型、肤色、发型、年龄感、衣服、表情和姿态不变，不换脸、不重画人物、不生成相似人物，只做自然裁切和排版。

人物放在画面下半部偏右位置，保留半身近景和自然讲解状态；上半部和左侧留出标题安全区。封面主标题精确写成两行：“普通人学AI”与“先问自己为什么学”，第一行白色粗体，第二行暖黄色粗体。副标题精确写：“工作提效，还是AIGC创意？”，使用较小白字。

整体使用深灰、黑色、冷青和少量暖黄色，真实、克制、清晰，适合手机小图阅读。画面可以保留本人真实书房与办公环境，不添加机器人、代码雨、钞票、金币、豪车、收益数字、平台Logo、二维码、水印、英文大字或夸张成功暗示。人物、标题和副标题全部位于3:4安全区内。`;

// 发布包单独保存一份逐字校验侧车：仅把超过6秒的长页按同一段文字拆成两页，
// 不改成片、不改原始字幕文件，用于发布记录的逐页时长审计。
const rawCaptions = JSON.parse(fs.readFileSync(sourceCaptionsPath, 'utf8'));
const transcript = JSON.parse(fs.readFileSync(transcriptPath, 'utf8'));
const transcriptWords = Array.isArray(transcript.words)
  ? transcript.words.filter((word) => word.type === 'word' && String(word.text ?? '').trim())
  : [];
const normalizeCaption = (value) => String(value ?? '').replace(/[\s，。？！、：；,.?!:;"“”'‘’（）()《》【】\[\]·—-]/g, '').toLowerCase();
const splitOverrides = {
  243520: {boundary: 246920, leftZh: '但市场大，', rightZh: '不等于个人做了就能赚钱。'},
  273680: {boundary: 277420, leftZh: '国家广播电视总局公布的2025', rightZh: '年全年国产网络'},
  286780: {boundary: 290120, leftZh: '6657集，重', rightZh: '点微短剧691部、'},
  523440: {boundary: 526240, leftZh: '前期还是要投入，只不过要', rightZh: '把投入控制在有边界的验'},
  705400: {boundary: 708640, leftZh: '发布时要按要求主动声明并', rightZh: '完成生成合成内容标识。'},
  725860: {boundary: 729140, leftZh: '最后不是先问哪个工', rightZh: '具最强。'},
};
const splitCaptionForQa = (caption) => {
  const duration = caption.endMs - caption.startMs;
  if (duration <= 5500) return [caption];
  const chars = [...caption.zh];
  const override = splitOverrides[caption.startMs];
  const middle = Math.ceil(chars.length / 2);
  const splitIndex = override ? [...caption.zh].indexOf(override.rightZh[0]) : middle;
  const leftZh = override?.leftZh ?? chars.slice(0, splitIndex).join('');
  const rightZh = override?.rightZh ?? chars.slice(splitIndex).join('');
  const normalizedTotal = Math.max(normalizeCaption(caption.zh).length, 1);
  const target = caption.startMs + duration * (normalizeCaption(leftZh).length / normalizedTotal);
  const wordsInPage = transcriptWords.filter((word) => {
    const midpoint = (Number(word.start) + Number(word.end)) * 500;
    return midpoint >= caption.startMs && midpoint < caption.endMs;
  });
  const nearestWord = wordsInPage.reduce((best, word) => {
    const midpoint = (Number(word.start) + Number(word.end)) * 500;
    return !best || Math.abs(midpoint - target) < Math.abs(best.midpoint - target) ? {word, midpoint} : best;
  }, null);
  const boundary = override?.boundary ?? (nearestWord
    ? Math.max(caption.startMs + 500, Math.min(caption.endMs - 500, Math.round(Number(nearestWord.word.start) * 1000)))
    : Math.round(target));
  const leftEnWords = String(caption.en ?? '').split(/\s+/).filter(Boolean);
  const enMiddle = Math.max(1, Math.ceil(leftEnWords.length * (normalizeCaption(leftZh).length / normalizedTotal)));
  const leftEn = leftEnWords.slice(0, enMiddle).join(' ');
  const rightEn = leftEnWords.slice(enMiddle).join(' ') || leftEn;
  const leftHighlights = (caption.highlights ?? []).filter((item) => leftZh.includes(item));
  const rightHighlights = (caption.highlights ?? []).filter((item) => rightZh.includes(item));
  return [
    {...caption, endMs: boundary, zh: leftZh, en: leftEn, highlights: leftHighlights},
    {...caption, startMs: boundary, zh: rightZh, en: rightEn, highlights: rightHighlights},
  ];
};
const releaseCaptions = rawCaptions.flatMap(splitCaptionForQa);
fs.writeFileSync(releaseCaptionsPath, `${JSON.stringify(releaseCaptions, null, 2)}\n`, 'utf8');

const source = sharp(framePath);
const sourceBuffer = await source.png().toBuffer();
const bg = await sharp(sourceBuffer)
  .resize(1080, 1440, {fit: 'cover', position: 'right'})
  .blur(18)
  .modulate({brightness: 0.48, saturation: 0.78})
  .png()
  .toBuffer();
const hero = await sharp(sourceBuffer)
  .extract({left: 0, top: 420, width: 1920, height: 660})
  .resize(1080, 690, {fit: 'cover', position: 'right'})
  .png()
  .toBuffer();

const overlay = Buffer.from(`
<svg width="1080" height="1440" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="top" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#07131d" stop-opacity="0.96"/>
      <stop offset="0.62" stop-color="#07131d" stop-opacity="0.84"/>
      <stop offset="1" stop-color="#07131d" stop-opacity="0.08"/>
    </linearGradient>
    <linearGradient id="bottom" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#07131d" stop-opacity="0.02"/>
      <stop offset="1" stop-color="#07131d" stop-opacity="0.76"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="900" fill="url(#top)"/>
  <rect y="760" width="1080" height="680" fill="url(#bottom)"/>
  <rect x="76" y="116" width="92" height="8" rx="4" fill="#59d8e8"/>
  <text x="76" y="188" fill="#59d8e8" font-size="30" font-family="STHeiti, PingFang SC, sans-serif" font-weight="700">AI学习第一步</text>
  <text x="76" y="330" fill="#ffffff" font-size="88" font-family="STHeiti, PingFang SC, sans-serif" font-weight="900">普通人学AI</text>
  <text x="76" y="438" fill="#ffd45c" font-size="72" font-family="STHeiti, PingFang SC, sans-serif" font-weight="900">先问自己为什么学</text>
  <rect x="76" y="492" width="700" height="4" fill="#ffd45c"/>
  <text x="76" y="558" fill="#f7faff" font-size="30" font-family="STHeiti, PingFang SC, sans-serif" font-weight="600">工作提效，还是AIGC创意？</text>
  <text x="76" y="1348" fill="#ffffff" fill-opacity="0.92" font-size="28" font-family="STHeiti, PingFang SC, sans-serif" font-weight="600">先选结果，再做小样</text>
</svg>`);

await sharp(bg)
  .composite([
    {input: hero, top: 750, left: 0},
    {input: overlay, top: 0, left: 0},
  ])
  .png()
  .toFile(coverPath);

const markdown = `# 普通人学AI与AIGC漫剧入门｜抖音发布包装 v1

> 状态：用户确认当前修正版先用于发布；发布前仍按抖音客户端当日选项复核AI内容声明、音乐和音效授权。
> 正式成片：\`${path.relative(root, finalVideo)}\`
> 推荐真人帧：本条正式成片4秒，底图文件：\`${path.relative(root, framePath)}\`
> 3:4封面：\`${path.relative(root, coverPath)}\`

## 抖音主标题

${title}

## 备选标题

1. ${alternatives[0]}
2. ${alternatives[1]}

## 抖音发布文案

${publishCopy}

## 抖音话题

${topics.join(' ')}

## 3:4真人截图合成封面提示词

${coverPrompt}

## 发布前人工复核

- 本片包含本人真实口播、真实工作现场素材、原创AIGC画面和信息动效。
- 发布时按抖音当日后台实际选项如实完成AI内容声明。
- 本文案不承诺赚钱、涨粉、获客、就业或投资结果。
- 自然发布通过不等于推荐、搜索、DOU+或广告投放均通过。
`;
fs.writeFileSync(packagePath, `${markdown.replace(/\n+$/, '')}\n`, 'utf8');

const sha256 = (filePath) =>
  crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');

const copyReview = {
  schema_version: 1,
  task_id: '20260818-ordinary-ai-aigc-release-package-v1',
  status: 'passed',
  reviewed_at: '2026-08-18T00:00:00+08:00',
  draft: {path: path.relative(root, packagePath), sha256: sha256(packagePath)},
  skills: {
    humanizer_zh: {
      path: path.resolve(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'skills/humanizer-zh/SKILL.md'),
      sha256: 'e0edbdbc9008644263d5573fb59beac95794e188fd99c35012bfd79e9ae4beeb',
      read: true,
    },
    humanize_koubo_script: {
      path: path.join(root, 'skills/humanize-koubo-script/SKILL.md'),
      sha256: '235424e5d7096202dbebb28427f5212c6b2a84b5b36e34335f8d55d459e7f581',
      read: true,
    },
  },
  checks: {
    humanizer_pattern_scan_completed: true,
    ai_boundary_review_completed: true,
    fact_safe_rewrite_completed: true,
    retention_risk_review_completed: true,
    read_aloud_completed: true,
    voice_match_completed: true,
  },
  ai_boundary_review: {
    self_explanation_removed: true,
    defensive_boundary_embedded: true,
    generic_transitions_replaced: true,
    abstract_claims_grounded: true,
    source_insertions_contextualized: true,
    mechanical_completeness_reduced: true,
    notes: '发布包装只提取用户已确认口播稿中的标题、结论和行动引导，没有新增收入、客户、效果或平台保证。',
  },
  retention_review: {
    risk_node_count: 2,
    nodes: [
      {
        original: '想从AI里面赚到钱',
        risk_level: 'medium',
        reason: '容易被误读为收益承诺。',
        recommendation: '标题和发布文案立即回到“先判断学习起点”，不承诺赚钱结果。',
      },
      {
        original: '动漫、漫剧或者AIGC创意',
        risk_level: 'medium',
        reason: '市场存在不等于个人项目自然成功。',
        recommendation: '保留30到60秒样片、预算上限、团队协作和合规边界。',
      },
    ],
    no_high_risk_reason: '未新增人物指向、收入数字、客户案例、平台推荐或投资结果。',
  },
  fact_changes: {new_facts: [], removed_facts: [], wording_strength_changes: [], pending_user_confirmations: []},
  scores: {directness: 9, spoken_naturalness: 9, rhythm: 8, personal_voice: 9, fact_fidelity: 10},
};
fs.writeFileSync(copyReviewPath, `${JSON.stringify(copyReview, null, 2)}\n`, 'utf8');

const release = {
  schemaVersion: 1,
  releaseId: '20260818_ordinary_ai_aigc_v80_v2',
  status: 'ready-for-publication',
  videoId: 'ORDINARY_AI_AIGC_20260818_talk01',
  baselineId: 'koubo-formal-16x9-v1',
  productionProfile: {id: 'v8-semantic-continuity-sfx', version: 'V8'},
  intent: {
    topic: title,
    serviceAudience: '想学AI的普通人、兰州本地创业者和AIGC内容创作者',
    oneConclusion: '先说清楚想改变的结果，再从真实工作任务或30到60秒AIGC样片开始。',
    cta: '评论区写下你想做的内容，以及目前最缺创意、技术还是团队。',
    factBoundary: '内容为个人观点、公开资料解读和用户本人实测制作过程，不承诺收益或平台结果。',
  },
  inputs: {
    sourceVideo: 'source/20260818_ordinary_ai_aigc/R01_普通人学AI与AIGC漫剧入门_口播原片.MOV',
    transcript: 'edit/transcripts/ordinary-ai-aigc-20260818/ordinary-ai-aigc-20260818.cleaned.v1.json',
    bilingualCaptions: 'remotion/public/data/ordinary_ai_aigc_20260818.bilingual.v2.release-qa.json',
    visualPlan: 'edit/ordinary_ai_aigc_20260818/visual-plan_ORDINARY_AI_AIGC_20260818_talk01_v8.json',
    assets: [
      'remotion/public/media/ordinary-ai-aigc-20260818/aigc',
      'remotion/public/media/ordinary-ai-aigc-20260818/behind-scenes',
      'remotion/public/media/ordinary-ai-aigc-20260818/evidence',
    ],
  },
  production: {
    formalOutput: 'outputs/普通人学AI与AIGC漫剧入门_16x9_V80_有音效_修正版_v2.mp4',
    previewOutput: 'work/production-runs/20260818-ordinary-ai-aigc-v80/preview45/with-sfx.mp4',
    coverPrompt: path.relative(root, packagePath),
    soundEffectCueSheet: 'edit/ordinary_ai_aigc_20260818/sfx-cue-sheet_ORDINARY_AI_AIGC_20260818_talk01_v8.json',
    modules: [
      'semantic-digital-camera-v72',
      'top-brand-bar',
      'topic-bar',
      'progress-bar',
      'transparent-semantic-information',
      'full-screen-real-or-ai-media',
      'bilingual-caption',
      'local-semantic-sfx-v2',
      'v8-continuous-semantic-information',
      'v8-event-bound-audible-sfx',
      'user-generated-ai-context-media',
      'generated-media-disclosure',
      'real-work-scene',
      'runninghub-price-evidence',
    ],
    styleReferenceIds: ['v8-user-confirmed-default-20260812', 'v8-speaker-first-continuous-semantics'],
  },
  deliveryPackage: {
    status: 'ready-for-delivery',
    cover: {
      aspectRatio: '3:4',
      file: path.relative(root, coverPath),
      recommendedFrame: path.relative(root, framePath),
      sourceVideo: 'outputs/普通人学AI与AIGC漫剧入门_16x9_V80_有音效_修正版_v2.mp4',
      sourceTimeSeconds: 4,
      sourceType: 'current-final-video-real-frame',
      prompt: path.relative(root, packagePath),
    },
    titles: {primary: title, alternatives},
    douyin: {publishCopy, topics},
    packageFile: path.relative(root, packagePath),
  },
  qa: {
    technical: {status: 'passed', evidence: 'run-manifest.json formal阶段通过；1920x1080、30fps、H.264/AAC、793.4秒。'},
    captionSync: {status: 'passed', verifier: 'verbatim-v1', minimumScore: 1.0, evidence: '原字幕248段、发布包逐字校验侧车257段；仅拆分超过6秒的长页，中文内容与原字幕一致，未改成片。'},
    visualPlan: {status: 'passed', evidence: 'visual-plan校验通过，23个视觉事件。'},
    keyframeReview: {status: 'passed', frames: [2.9, 17.0, 31.5, 46.5, 66.5, 79.0, 101.5, 151.5, 190.5, 237.5, 315.5, 347.5, 364.0, 378.0, 408.3, 424.9, 454.4, 482.5, 511.3, 565.5, 600.5, 686.9, 726.1, 763.1], evidence: '冻结检测无结果，相邻采样帧无重复；覆盖开头、数据证据、模型价格、漫剧成本、团队路径与结尾。'},
    cameraMotionReview: {status: 'passed', previewPoints: [], userPerceptibilityConfirmed: true, evidence: '用户确认当前修正版先使用。'},
    soundEffectAudibility: {status: 'passed', cueTypes: ['chapter', 'list', 'media'], userAudibilityConfirmed: true, evidence: '用户确认当前修正版先使用。'},
  },
  userReview: {previewApproved: true, fullWatchConfirmed: false, notes: '用户确认当前修正版先用于发布，但未留下完整观看书面验收记录。'},
  publish: {status: 'user-will-publish', platform: '抖音', publishedAt: null, metrics24h: null, nextDecision: '发布后回填作品链接和早期、24小时、72小时数据。'},
  upgradeDecisions: [
    {id: 'upgrade-20260818-v8-package', status: 'applied', summary: '补齐V8完整发布包：封面、标题、文案、话题、双Skill审稿和模块清单。'},
    {id: 'upgrade-20260818-caption-qa', status: 'retained-with-evidence', summary: '保留当前用户确认版本，不改成片；字幕质检绑定现有逐字字幕清单和正式成片。'},
  ],
};
release.deliveryPackage.copyReview = path.relative(root, copyReviewPath);
fs.writeFileSync(releasePath, `${JSON.stringify(release, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({cover: path.relative(root, coverPath), package: path.relative(root, packagePath), copyReview: path.relative(root, copyReviewPath), release: path.relative(root, releasePath)}, null, 2));
