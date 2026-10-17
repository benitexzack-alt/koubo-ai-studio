#!/usr/bin/env node

import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const EXPECTED = Object.freeze({
  spokenSourceSha256: 'a098a9e92bed474b56cecc2ca70cb1ba0b0d755a58d3318a2411965eff654ec4',
  spokenPreviewDerivativeSha256: '44ae76a81791f0fbd606e0a16d62606d101fb9e5d7be7dd8c6f24078ec687ca6',
  screenSourceSha256: '0a992254195c91eefebec1f0a8d1f91263890ec2910169470ec377a02640937e',
  nonLinearRetimedScreenSourceSha256: '3c1f91ad88577b951b20d341bace5893fbaaa3ba075b17360df1a09a8ce90355',
  legacyRetimedScreenProxySha256: 'c62481e12b095462748d216c71b45cf8d81fe495a25a52a28a9fe763d948ea6c',
  rawSpokenTranscriptSha256: 'f18642fac4061511bd254b48518be4469f9076562f75a22c548c88773256c046',
  cleanedSpokenTranscriptSha256: '4a53bd535fe90fd1f720e5f7533ad8fc558150bb31c92fd38f60c79c0c2ab5db',
  incompleteScreenTranscriptSha256: '71bc6d1f83264c2b21ce385a4128ce5cf0c1a38497c0f9bf91645037eb0a3a6a',
});

const SOURCES = Object.freeze({
  spokenSource: resolve(ROOT, 'source/20260823_wechat_geo_aao/copy_72D5690E-11F6-48D7-8B1B-67C9E1A0FD5F.MOV'),
  spokenPreviewDerivative: resolve(ROOT, 'remotion/public/media/wechat-geo-aao-20260823/main-30fps.mp4'),
  screenSource: '/Users/pc/Downloads/ScreenRecording_08-22-2026 15-36-53_1.MP4',
  nonLinearRetimedScreenSource: resolve(ROOT, 'source/20260823_wechat_geo_aao/copy_9AA2C74C-7E1B-40E7-8634-D6F4835F95CD.MOV'),
  legacyRetimedScreenProxy: resolve(ROOT, 'remotion/public/media/wechat-geo-aao-20260823/screen-30fps.mp4'),
  rawSpokenTranscript: resolve(ROOT, 'edit/20260823_wechat_geo_aao/transcripts/WECHAT_GEO_AAO_20260823_talk01_whisper-small-split-v1.json'),
  cleanedSpokenTranscript: resolve(ROOT, 'edit/20260823_wechat_geo_aao/transcripts/WECHAT_GEO_AAO_20260823_talk01.cleaned.v1.json'),
  incompleteScreenTranscript: resolve(ROOT, 'edit/20260823_wechat_geo_aao/transcripts/WECHAT_GEO_AAO_20260823_screen01_whisper-small-v1.json'),
});

const DEFAULT_OUT = resolve(ROOT, 'work/director-v2-e2e/20260823-wechat-geo-aao-candidate-01');

const semanticDefinitions = [
  ['sem-001-hook', 0, 6.31, '微信入口变化', 'speaker-with-small-callout'],
  ['sem-002-image-ai', 6.31, 23.32, '图片 AI 处理与风格转换', 'real-screen-first'],
  ['sem-003-query', 23.32, 33.96, '一句话说清餐饮需求', 'real-screen-first'],
  ['sem-004-old-search', 33.96, 47.07, '过去四个人分头搜索', 'original-paper-assembly'],
  ['sem-005-path-proof', 47.07, 59.96, '推荐到地图再到门店菜单', 'real-screen-first'],
  ['sem-006-path-meaning', 59.96, 82.96, '重点是能否继续走进店里', 'screen-plus-original-paper'],
  ['sem-007-shorter-path', 82.96, 117.92, '用户先问再进入的更短路径', 'screen-plus-original-paper'],
  ['sem-008-geo', 117.92, 164.88, 'GEO 是把真实经营信息对齐', 'screen-evidence-plus-checklist'],
  ['sem-009-image-consistency', 164.88, 193.84, '图片中的地址日期价格也要准确', 'real-screen-plus-original-paper'],
  ['sem-010-aao', 193.84, 220.88, 'AAO 是接住用户下一步', 'real-screen-first'],
  ['sem-011-small-action', 220.88, 248.88, '接住下一件小事而非代管全店', 'original-paper-assembly'],
  ['sem-012-consumer-value', 248.88, 255.88, '消费者少翻少比', 'speaker-with-small-callout'],
  ['sem-013-merchant-checks', 255.88, 278.88, '商家先检查四件事', 'screen-evidence-plus-checklist'],
  ['sem-014-run-one-path', 278.88, 304.88, '先把一条真实路径跑顺', 'screen-plus-original-paper'],
  ['sem-015-summary', 304.88, 317.88, 'GEO 与 AAO 的边界总结', 'speaker-with-small-callout'],
  ['sem-016-cta', 317.88, 330.88, '课程说明与结尾', 'real-document-plus-speaker'],
];

const screenDispositionSegments = [
  ['screen-001-image-menu-request', 0, 13, 'used', '照片操作菜单、AI处理入口与风格请求可见。'],
  ['screen-002-image-processing-wait', 13, 40, 'excluded', '长时间等待，界面几乎无认知增量。'],
  ['screen-003-image-result', 40, 53, 'used', '转换后的图片结果及返回聊天过程可见。'],
  ['screen-004-voice-input-wait', 53, 86, 'excluded', '大部分为按住说话与等待，缺少可读结果。'],
  ['screen-005-query-visible', 86, 98, 'used', '兰州中心、四人、不辣、清淡等条件及回复起点可见。'],
  ['screen-006-recommendation-map-cards', 98, 124, 'used', '候选方向与地图卡片在微信回答中可见。'],
  ['screen-007-map-app', 124, 132, 'used', '从回答进入地图详情的界面切换可见。'],
  ['screen-008-miniapp-entry-load', 132, 134, 'excluded', '小程序入口加载中，尚无可读门店内容。'],
  ['screen-009-privacy-policy', 134, 138, 'excluded', '服务协议与隐私政策页；不得冒充回答、地图或门店菜单。'],
  ['screen-010-service-load', 138, 140, 'excluded', '门店服务加载和首屏弹层切换，暂不作为语义完成态。'],
  ['screen-011-store-miniapp-menu', 140, 150, 'used', '门店小程序活动弹层、人数状态与真实菜单页可见。'],
  ['screen-012-alternate-map-details', 150, 178, 'used', '其他候选地图详情可作为字段一致性检查实例。'],
  ['screen-013-permission-ad-return', 178, 190, 'excluded', '权限页、广告与无关照片打断语义链。'],
  ['screen-014-second-voice-wait', 190, 210, 'excluded', '长时间语音输入等待，画面信息变化不足。'],
  ['screen-015-second-query', 210, 242, 'excluded', '重复提问与等待；不优先于第一条完整链路。'],
  ['screen-016-store-info-menu', 242, 266, 'used', '门店信息回答及真实菜单列表可见。'],
  ['screen-017-chat-return', 266, 272, 'used', '从菜单返回回答，可作为路径退出锚点。'],
  ['screen-018-unrelated-photo', 272, 274.243333, 'excluded', '无关照片，不属于餐饮路径证据。'],
];

const mappingDefinitions = [
  {
    id: 'map-001-image-menu-request', recordingSegmentId: 'screen-001-image-menu-request', sourceIn: 0, sourceOut: 13,
    semanticSegmentIds: ['sem-002-image-ai'], spokenRange: [6.31, 15.53],
    selectionReason: '口播说到聊天图片下方出现AI处理入口时，展示真实入口与请求；实录优先于重绘界面。',
    edit: '保留0–13秒顺序；去除原声；9:16完整contain置于16:9右侧，不裁文字与按钮。',
  },
  {
    id: 'map-002-image-result', recordingSegmentId: 'screen-003-image-result', sourceIn: 40, sourceOut: 53,
    semanticSegmentIds: ['sem-002-image-ai', 'sem-009-image-consistency'], spokenRange: [15.53, 23.32],
    selectionReason: '口播说到风格被改掉时，展示真实处理结果；13–40秒等待段没有认知增量，明确跳过。',
    edit: '从40秒结果出现处切入；完整contain；跳切需用“等待已省略”文字说明，不伪造实时速度。',
  },
  {
    id: 'map-003-restaurant-query', recordingSegmentId: 'screen-005-query-visible', sourceIn: 86, sourceOut: 98,
    semanticSegmentIds: ['sem-003-query'], spokenRange: [23.32, 33.96],
    selectionReason: '这一段真实显示地点、人数、忌口和饮食目标；旧方案错用23秒处，那里仍是图片处理等待。',
    edit: '按1.0–1.15倍播放；完整contain；局部放大只能复制叠加且不得替代完整界面。',
  },
  {
    id: 'map-004-recommendation-map', recordingSegmentId: 'screen-006-recommendation-map-cards', sourceIn: 98, sourceOut: 124,
    semanticSegmentIds: ['sem-005-path-proof', 'sem-006-path-meaning', 'sem-007-shorter-path'], spokenRange: [47.07, 55.16],
    selectionReason: '口播说到给出方向并把位置落到地图时，真实回答与地图卡片是不可替代证据。',
    edit: '只取回答出现、地图卡展开、候选切换三个动作点；每次跳切保留前后界面锚点并标注“过程节选”。',
  },
  {
    id: 'map-005-map-app', recordingSegmentId: 'screen-007-map-app', sourceIn: 124, sourceOut: 132,
    semanticSegmentIds: ['sem-005-path-proof', 'sem-006-path-meaning'], spokenRange: [52.24, 58.27],
    selectionReason: '口播说到点进一家店时，地图详情跳转是路径因果中的中间证据。',
    edit: '保持完整纵屏比例；不得cover裁掉返回键、店名、定位与底部动作按钮。',
  },
  {
    id: 'map-006-store-miniapp-menu', recordingSegmentId: 'screen-011-store-miniapp-menu', sourceIn: 140, sourceOut: 150,
    semanticSegmentIds: ['sem-005-path-proof', 'sem-006-path-meaning', 'sem-010-aao'], spokenRange: [55.16, 59.96],
    selectionReason: '口播说到门店小程序、菜单和点餐页面时，真实页面直接证明当次测试链路到达何处。',
    edit: '从140秒门店活动弹层和菜单已可见后切入；以弹层关闭、人数状态、菜单三个完成态组成连续动作链，并保留跳切说明。',
  },
  {
    id: 'map-007-map-fields', recordingSegmentId: 'screen-012-alternate-map-details', sourceIn: 150, sourceOut: 178,
    semanticSegmentIds: ['sem-008-geo', 'sem-013-merchant-checks'], spokenRange: [117.92, 164.88],
    selectionReason: '地图中的地址、营业信息和入口仅作为“需要核对哪些字段”的实例，不证明所有平台信息已一致。',
    edit: '只展示与口播检查项重合的字段；完整contain；加“当时界面实例，非全平台核验”边界标。',
  },
  {
    id: 'map-008-store-info-menu', recordingSegmentId: 'screen-016-store-info-menu', sourceIn: 242, sourceOut: 266,
    semanticSegmentIds: ['sem-010-aao', 'sem-013-merchant-checks', 'sem-014-run-one-path'], spokenRange: [193.84, 220.88],
    selectionReason: '真实回答到菜单列表可说明“介绍完以后还能继续做什么”；不外推自动下单或支付能力。',
    edit: '选择回答完成态与菜单滚动；完整contain；二维码、价格、按钮和店名不得被裁切。',
  },
  {
    id: 'map-009-chat-return', recordingSegmentId: 'screen-017-chat-return', sourceIn: 266, sourceOut: 272,
    semanticSegmentIds: ['sem-014-run-one-path'], spokenRange: [278.88, 304.88],
    selectionReason: '菜单返回回答是本次实测路径的退出锚点，可用于说明“跑顺一条路”，但不等于完成交易。',
    edit: '保持返回动作完整；不加伪按钮、不重绘UI、不声明已下单或付款。',
  },
];

const contactSheets = [
  {file: 'full-screen-contact-10s.jpg', framesDir: 'screen-10s-frames', start: null, duration: null, step: 10, frameCount: 27, tile: '5x6', expectedSha256: '73590e2e17ea53e302c3866790872d8c2fb894251ce98d8deb836c5d83339913'},
  {file: 'screen-000-090-contact-2s.jpg', framesDir: 'screen-000-090-2s', start: 0, duration: 90, step: 2, frameCount: 45, tile: '5x9', expectedSha256: 'f3654af3b9f392a048a313b42fc3cf3294f319b1a9c2b1823e44048e89a91258'},
  {file: 'screen-090-150-contact-2s.jpg', framesDir: 'screen-090-150-2s', start: 90, duration: 60, step: 2, frameCount: 30, tile: '5x6', expectedSha256: 'cbbc5eb27dade8e321eea78d7a9224fffe45e24c2dc725e9b0b7cf9b8f23befc'},
  {file: 'screen-150-210-contact-2s.jpg', framesDir: 'screen-150-210-2s', start: 150, duration: 60, step: 2, frameCount: 30, tile: '5x6', expectedSha256: '845c6b9a78ee85488c0dd5a6afc4225d7273a02ee113ae26a937560c91b5a3f9'},
  {file: 'screen-210-274-contact-2s.jpg', framesDir: 'screen-210-274-2s', start: 210, duration: 64, step: 2, frameCount: 32, tile: '4x8', expectedSha256: 'c3935b8fbea08d42d7ea4d725c8e1dd178cdcdffecc3538b92bb47406fd0838e'},
];

const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

const jsonSha256 = (value) => createHash('sha256')
  .update(`${JSON.stringify(value, null, 2)}\n`)
  .digest('hex');

const probe = (path) => JSON.parse(execFileSync('ffprobe', [
  '-v', 'error',
  '-show_entries', 'format=duration,size:stream=index,codec_type,codec_name,width,height,r_frame_rate,avg_frame_rate,nb_frames,sample_rate,channels',
  '-of', 'json',
  path,
], {encoding: 'utf8'}));

const parseOut = () => {
  const index = process.argv.indexOf('--out');
  if (index === -1) return DEFAULT_OUT;
  const value = process.argv[index + 1];
  if (!value) throw new Error('--out 缺少目录');
  return resolve(ROOT, value);
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const assertHash = (path, expected, label) => {
  assert(existsSync(path), `${label}不存在：${path}`);
  const actual = sha256(path);
  assert(actual === expected, `${label} SHA不匹配：expected=${expected} actual=${actual}`);
  return actual;
};

const ensureContactSheet = (evidenceDir, spec) => {
  const output = join(evidenceDir, spec.file);
  if (existsSync(output)) {
    assertHash(output, spec.expectedSha256, `联系表 ${spec.file}`);
    return output;
  }

  const framesDir = join(evidenceDir, spec.framesDir);
  mkdirSync(framesDir, {recursive: true});
  const framePattern = join(framesDir, 'frame-%02d.jpg');
  const inputArgs = ['-y', '-hide_banner', '-loglevel', 'error'];
  if (spec.start !== null) inputArgs.push('-ss', String(spec.start));
  if (spec.duration !== null) inputArgs.push('-t', String(spec.duration));
  inputArgs.push(
    '-i', SOURCES.screenSource,
    '-vf', `fps=1/${spec.step},scale=222:-2`,
    '-q:v', '2',
    framePattern,
  );
  execFileSync('ffmpeg', inputArgs, {stdio: 'inherit'});
  const frames = readdirSync(framesDir)
    .filter((file) => /^frame-\d+\.jpg$/.test(file))
    .sort()
    .map((file) => join(framesDir, file));
  assert(frames.length === spec.frameCount, `${spec.file}抽帧数异常：expected=${spec.frameCount} actual=${frames.length}`);
  execFileSync('magick', [
    'montage', ...frames,
    '-font', '/System/Library/Fonts/Supplemental/Arial.ttf',
    '-label', '%t',
    '-tile', spec.tile,
    '-geometry', '222x+8+24',
    '-background', 'white',
    '-fill', 'black',
    '-pointsize', '18',
    output,
  ], {stdio: 'inherit'});
  assertHash(output, spec.expectedSha256, `新生成联系表 ${spec.file}`);
  return output;
};

const overlaps = (start, end, targetStart, targetEnd) => start < targetEnd && end > targetStart;

const main = () => {
  const outDir = parseOut();
  const evidenceDir = join(outDir, 'evidence');

  const hashes = {
    spokenSource: assertHash(SOURCES.spokenSource, EXPECTED.spokenSourceSha256, '完整口播原片'),
    spokenPreviewDerivative: assertHash(SOURCES.spokenPreviewDerivative, EXPECTED.spokenPreviewDerivativeSha256, '口播30fps预览衍生片'),
    screenSource: assertHash(SOURCES.screenSource, EXPECTED.screenSourceSha256, '完整录屏原片'),
    nonLinearRetimedScreenSource: assertHash(SOURCES.nonLinearRetimedScreenSource, EXPECTED.nonLinearRetimedScreenSourceSha256, '历史非线性重定时录屏源'),
    legacyRetimedScreenProxy: assertHash(SOURCES.legacyRetimedScreenProxy, EXPECTED.legacyRetimedScreenProxySha256, '历史非线性重定时录屏代理'),
    rawSpokenTranscript: assertHash(SOURCES.rawSpokenTranscript, EXPECTED.rawSpokenTranscriptSha256, '原始机器转写'),
    cleanedSpokenTranscript: assertHash(SOURCES.cleanedSpokenTranscript, EXPECTED.cleanedSpokenTranscriptSha256, '实录校正逐字时间轴'),
    incompleteScreenTranscript: assertHash(SOURCES.incompleteScreenTranscript, EXPECTED.incompleteScreenTranscriptSha256, '不完整录屏语音转写'),
  };

  const probes = {
    spokenSource: probe(SOURCES.spokenSource),
    spokenPreviewDerivative: probe(SOURCES.spokenPreviewDerivative),
    screenSource: probe(SOURCES.screenSource),
    nonLinearRetimedScreenSource: probe(SOURCES.nonLinearRetimedScreenSource),
    legacyRetimedScreenProxy: probe(SOURCES.legacyRetimedScreenProxy),
  };
  const spokenDuration = Number(probes.spokenSource.format.duration);
  const screenDuration = Number(probes.screenSource.format.duration);
  const nonLinearRetimedScreenDuration = Number(probes.nonLinearRetimedScreenSource.format.duration);
  const legacyRetimedScreenProxyDuration = Number(probes.legacyRetimedScreenProxy.format.duration);
  assert(Math.abs(spokenDuration - 331.466667) < 0.01, `口播时长异常：${spokenDuration}`);
  assert(Math.abs(screenDuration - 274.243333) < 0.01, `录屏时长异常：${screenDuration}`);
  assert(Math.abs(nonLinearRetimedScreenDuration - 189.066667) < 0.01, '历史非线性重定时录屏源时长异常');
  assert(Math.abs(legacyRetimedScreenProxyDuration - 189.066667) < 0.01, '历史非线性重定时录屏代理时长异常');

  const sourceTranscript = JSON.parse(readFileSync(SOURCES.cleanedSpokenTranscript, 'utf8'));
  assert(Array.isArray(sourceTranscript.pages) && sourceTranscript.pages.length === 104, '实录校正页数不是已审计的104段');
  assert(Array.isArray(sourceTranscript.words) && sourceTranscript.words.length === 1321, '实录校正词数不是已审计的1321词');
  assert(Math.abs(Number(sourceTranscript.duration_seconds) - 330.88) < 0.001, '实录校正时间轴时长异常');

  const words = sourceTranscript.words.map((word, wordIndex) => {
    const start = Number(word.start);
    const end = Number(word.end);
    assert(Number.isFinite(start) && Number.isFinite(end) && end >= start, `word-${wordIndex + 1}含非法词时间`);
    return {
      id: `word-${String(wordIndex + 1).padStart(5, '0')}`,
      start,
      end,
      text: word.text,
      confidence: word.confidence ?? null,
      rawSegmentIndex: word.raw_segment_index ?? null,
    };
  });
  const segments = sourceTranscript.pages.map((page, segmentIndex) => {
    const segmentId = `spoken-segment-${String(segmentIndex + 1).padStart(3, '0')}`;
    const start = Number(page.startMs) / 1000;
    const end = Number(page.endMs) / 1000;
    assert(Number.isFinite(start) && Number.isFinite(end) && end >= start, `${segmentId}含非法时间`);
    const segmentWords = words.filter((word) => overlaps(word.start, word.end, start, end));
    segmentWords.forEach((word) => {
      if (word.segmentId && word.segmentId !== segmentId) {
        throw new Error(`${word.id}跨越多个校正分段，需人工裁决`);
      }
      word.segmentId = segmentId;
    });
    return {
      id: segmentId,
      start,
      end,
      text: page.zh,
      wordIds: segmentWords.map((word) => word.id),
    };
  });
  assert(words.every((word) => word.segmentId), '存在未绑定校正分段的词，禁止生成映射');
  for (let index = 1; index < words.length; index += 1) {
    assert(words[index].start >= words[index - 1].start, `词时间轴逆序：${words[index - 1].id}/${words[index].id}`);
  }

  const semanticSegments = semanticDefinitions.map(([id, start, end, title, strategy]) => ({
    id, start, end, title, strategy,
    spokenSegmentIds: segments.filter((segment) => overlaps(segment.start, segment.end, start, end)).map((segment) => segment.id),
    wordIds: words.filter((word) => overlaps(word.start, word.end, start, end)).map((word) => word.id),
  }));
  assert(semanticSegments[0].start === 0, '语义分段未从0开始');
  for (let index = 1; index < semanticSegments.length; index += 1) {
    assert(Math.abs(semanticSegments[index - 1].end - semanticSegments[index].start) < 0.000001, `语义分段不连续：${semanticSegments[index].id}`);
  }

  const screenSegments = screenDispositionSegments.map(([id, start, end, disposition, semanticReason]) => ({
    id, start, end, disposition, semanticReason,
  }));
  assert(screenSegments[0].start === 0, '录屏分段未从0开始');
  for (let index = 1; index < screenSegments.length; index += 1) {
    assert(Math.abs(screenSegments[index - 1].end - screenSegments[index].start) < 0.000001, `录屏分段不连续：${screenSegments[index].id}`);
  }
  assert(Math.abs(screenSegments.at(-1).end - screenDuration) < 0.01, '录屏分段未覆盖完整原片');

  const screenMappings = mappingDefinitions.map((mapping) => {
    const screenSegment = screenSegments.find((segment) => segment.id === mapping.recordingSegmentId);
    assert(screenSegment?.disposition === 'used', `${mapping.id}未绑定used录屏段`);
    const [spokenStart, spokenEnd] = mapping.spokenRange;
    return {
      ...mapping,
      recordingId: 'screen-full-001',
      spokenSegmentIds: segments.filter((segment) => overlaps(segment.start, segment.end, spokenStart, spokenEnd)).map((segment) => segment.id),
      wordIds: words.filter((word) => overlaps(word.start, word.end, spokenStart, spokenEnd)).map((word) => word.id),
      presentation: {
        sourceDimensions: {width: 888, height: 1920},
        targetDimensions: {width: 1920, height: 1080},
        fit: 'contain',
        crop: 'none',
        focus: 'none',
        safeArea: {preserveTop: true, preserveBottom: true, preserveLeft: true, preserveRight: true},
        risk: '任何cover裁切都可能丢失标题、返回键、按钮、二维码或价格，默认禁止。',
      },
    };
  });

  const normalizedTranscript = {
    schemaVersion: 'spoken-source-word-timeline/v1',
    authority: 'recorded-audio',
    sourceMedia: {path: SOURCES.spokenSource, sha256: hashes.spokenSource, durationSeconds: spokenDuration},
    sourceTranscript: {
      path: relative(ROOT, SOURCES.cleanedSpokenTranscript),
      sha256: hashes.cleanedSpokenTranscript,
      correctionMethod: sourceTranscript.method,
      rawSource: {
        path: relative(ROOT, SOURCES.rawSpokenTranscript),
        sha256: hashes.rawSpokenTranscript,
      },
    },
    note: '字幕正文采用已绑定的实录校正逐字时间轴；拍摄前稿只用于术语与可由音频确认的明确识别错误校正，不能替代实录。',
    durationSeconds: segments.at(-1).end,
    segments,
    words,
  };

  mkdirSync(evidenceDir, {recursive: true});
  const contactSheetReceipt = contactSheets.map((spec) => {
    const path = ensureContactSheet(evidenceDir, spec);
    return {
      path: relative(outDir, path),
      sha256: spec.expectedSha256,
      sampleStartSeconds: spec.start ?? 0,
      sampleStepSeconds: spec.step,
      frameCount: spec.frameCount,
      indexRule: 'frame-NN表示 sampleStartSeconds + (NN-1)*sampleStepSeconds；仅作人工导航。',
    };
  });

  const mapping = {
    schemaVersion: 'director-real-e2e-mapping/v1',
    taskId: '20260823-wechat-geo-aao-candidate-01',
    status: 'candidate-blocked',
    productionEligible: false,
    formal: {enabled: false},
    evidenceScope: 'real-source-read-only-analysis',
    spokenSource: {
      path: SOURCES.spokenSource,
      sha256: hashes.spokenSource,
      transcriptPath: 'normalized-spoken-timeline.json',
      transcriptSha256: jsonSha256(normalizedTranscript),
    },
    screenRecording: {
      id: 'screen-full-001',
      path: SOURCES.screenSource,
      sha256: hashes.screenSource,
      durationSeconds: screenDuration,
      sourceDimensions: {width: 888, height: 1920},
      completeness: 'full-recording',
      segments: screenSegments,
      navigationTranscript: {
        path: relative(ROOT, SOURCES.incompleteScreenTranscript),
        sha256: hashes.incompleteScreenTranscript,
        coverageEndSeconds: 185,
        status: 'incomplete-noisy-navigation-only',
        prohibition: '不得用于证明185秒后的内容，也不得作为字幕或语义结论。',
      },
    },
    semanticSegments,
    screenMappings,
    contactSheets: contactSheetReceipt,
    accidentFinding: {
      oldPlanPath: 'remotion/src/wechat-geo-aao-v8-production/WechatGeoAaoV80.visual-plan.preview.v1.json',
      oldRestaurantQueryTrimBeforeSeconds: 23,
      observedRestaurantQuerySourceRangeSeconds: [86, 98],
      result: 'blocked-invalid-nonlinear-timebase',
      legacySource: {
        path: relative(ROOT, SOURCES.nonLinearRetimedScreenSource),
        sha256: hashes.nonLinearRetimedScreenSource,
        durationSeconds: nonLinearRetimedScreenDuration,
      },
      legacyProxy: {
        path: relative(ROOT, SOURCES.legacyRetimedScreenProxy),
        sha256: hashes.legacyRetimedScreenProxy,
        durationSeconds: legacyRetimedScreenProxyDuration,
      },
      legacyProxyToFullSourceExamples: [
        [86, 160.9], [98, 174.2], [124, 202.7], [132, 211.6],
        [134, 213.8], [138, 217.9], [150, 231.1],
      ],
      fullSourceToLegacyProxyExamples: [
        [86, 26.5], [98, 28.8], [124, 52.6], [132, 59.8],
        [134, 61.7], [138, 65.2], [150, 76.2],
      ],
      conversionPolicy: 'forbidden-no-automatic-offset-or-speed-conversion',
      explanation: '历史189秒源是同一完整录屏经剪映二次导出的非线性压时编辑版；旧代理忠实继承其秒码。旧86–150秒映射不是完整原片时间，无法用截断偏移或恒定倍速修复，必须整体判废；现有成片不能证明各段具体采用删等待还是速度曲线。',
    },
    previewCandidate: {
      status: 'not-rendered',
      targetRangeInSpokenSourceSeconds: [23.32, 68.32],
      durationSeconds: 45,
      requiredWorlds: ['真实提问界面', '原创纸质四路搜索装配', '地图到门店菜单真实链路'],
      requiredScreenMappings: ['map-003-restaurant-query', 'map-004-recommendation-map', 'map-005-map-app', 'map-006-store-miniapp-menu'],
      normalSpeedFullWatch: 'pending',
      styleAcceptedByUser: false,
    },
    blockers: [
      '尚未把本映射渲染为独立V8动态预览。',
      '尚未生成同画面WithSfx/NoSfx并完成正常音量试听。',
      '校正时间轴已替换原始ASR，但用户仍未正常速度完整听看确认。',
      '录屏语义分段由2秒联系表人工导航，关键切点在渲染前仍需逐帧风险复核。',
      '用户未正常速度完整观看并接受。',
      '独立监督未签发交接回执。',
    ],
  };

  const mediaReceipt = {
    schemaVersion: 'director-real-media-receipt/v1',
    status: 'blocked-preproduction-evidence',
    sources: {
      spokenSource: {path: SOURCES.spokenSource, sha256: hashes.spokenSource, ffprobe: probes.spokenSource},
      spokenPreviewDerivative: {path: relative(ROOT, SOURCES.spokenPreviewDerivative), sha256: hashes.spokenPreviewDerivative, ffprobe: probes.spokenPreviewDerivative},
      screenSource: {path: SOURCES.screenSource, sha256: hashes.screenSource, ffprobe: probes.screenSource},
      nonLinearRetimedScreenSource: {
        path: relative(ROOT, SOURCES.nonLinearRetimedScreenSource),
        sha256: hashes.nonLinearRetimedScreenSource,
        ffprobe: probes.nonLinearRetimedScreenSource,
        provenance: 'jianying-secondary-export',
        timebase: 'nonlinear-compressed-189s-edit-of-same-full-recording',
        productionUse: 'forbidden',
      },
      legacyRetimedScreenProxy: {
        path: relative(ROOT, SOURCES.legacyRetimedScreenProxy),
        sha256: hashes.legacyRetimedScreenProxy,
        ffprobe: probes.legacyRetimedScreenProxy,
        timebase: 'inherits-nonlinear-retimed-189s-source',
        productionUse: 'forbidden',
      },
    },
    generatedEvidence: {
      normalizedTranscriptSha256: jsonSha256(normalizedTranscript),
      mappingSha256: jsonSha256(mapping),
    },
  };

  mkdirSync(outDir, {recursive: true});
  writeFileSync(join(outDir, 'normalized-spoken-timeline.json'), `${JSON.stringify(normalizedTranscript, null, 2)}\n`);
  writeFileSync(join(outDir, 'screen-semantic-mapping.json'), `${JSON.stringify(mapping, null, 2)}\n`);
  writeFileSync(join(outDir, 'media-receipt.json'), `${JSON.stringify(mediaReceipt, null, 2)}\n`);

  process.stdout.write(`${JSON.stringify({
    status: mapping.status,
    productionEligible: false,
    spokenSegments: segments.length,
    words: words.length,
    semanticSegments: semanticSegments.length,
    screenDispositionSegments: screenSegments.length,
    screenMappings: screenMappings.length,
    outputDirectory: outDir,
    normalizedTranscriptSha256: jsonSha256(normalizedTranscript),
    mappingSha256: jsonSha256(mapping),
  }, null, 2)}\n`);
};

try {
  main();
} catch (error) {
  process.stderr.write(`director-v2 real-e2e evidence blocked: ${error.message}\n`);
  process.exitCode = 1;
}
