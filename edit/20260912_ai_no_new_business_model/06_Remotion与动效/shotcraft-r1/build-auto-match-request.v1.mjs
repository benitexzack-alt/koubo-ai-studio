#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const outputDir = 'edit/20260912_ai_no_new_business_model/06_Remotion与动效/shotcraft-r1';
const timelinePath = 'edit/20260912_ai_no_new_business_model/05_实录与字幕/canonical-r1/spoken-timeline.candidate.v1.json';
const bilingualPath = 'edit/20260912_ai_no_new_business_model/05_实录与字幕/canonical-r1/actual-spoken.bilingual.candidate.v1.json';
const captionsPath = `${outputDir}/captions-for-shotcraft.v1.json`;
const requestPath = `${outputDir}/auto-match-request.v1.json`;

const canonical = Object.freeze({
  registry: 'skills/koubo-shotcraft-library/registry.v1.json',
  library: 'skills/koubo-shotcraft-library/upstream/gallery/api/library.json',
  capabilityIndex: 'skills/koubo-shotcraft-library/card-capability-index.v2.json',
  experienceLedger: 'skills/koubo-shotcraft-library/experience/shotcraft-acceptance-ledger.v1.json',
  componentModule: 'skills/koubo-shotcraft-library/assets/ShotcraftEffects.tsx',
});

const assetByBeat = Object.freeze({
  B02: 'remotion/public-ai-no-new-business-model-v8-r1/media/R01.png',
  B06: 'remotion/public-ai-no-new-business-model-v8-r1/media/R02.png',
  B13: 'remotion/public-ai-no-new-business-model-v8-r1/media/R03.png',
  B14: 'remotion/public-ai-no-new-business-model-v8-r1/media/R04_nara.jpg',
  B19: 'remotion/public-ai-no-new-business-model-v8-r1/media/R05.png',
});

const keyPhrases = Object.freeze({
  B01: ['新的商业模式'],
  B02: ['宏大叙事'],
  B03: ['令人兴奋', '朴素的真相'],
  B05: ['过去二十年', '新商业模式'],
  B06: ['按需经济', '社交电商'],
  B08: ['当下的AI', '做了什么'],
  B09: ['供给形态', '交易方式'],
  B10: ['两个小时', '两分钟'],
  B11: ['只改变效率', '新的秩序'],
  B13: ['数十倍', '90%以上'],
  B14: ['全球贸易', '世界工厂'],
  B15: ['成本结构', '经济地理'],
  B17: ['人工假设', '机器推理'],
  B19: ['曝光和点击', '水分'],
  B20: ['知识工作领域'],
  B22: ['几十万', '上百万美元'],
  B23: ['几个小时', '报告初稿'],
  B25: ['一个量级', '人力成本'],
  B27: ['人类判断'],
  B28: ['效率和成本', '红海'],
  B29: ['港口收费趋同', '更大吞吐量'],
  B31: ['低价获得', '新的维度'],
  B32: ['被AI取代', '一夜暴富'],
  B33: ['水流本身', '谁在游泳'],
  B34: ['我是超哥', '在兰州'],
});

const semanticIntents = Object.freeze({
  B01: ['opening', 'emphasis'],
  B02: ['evidence', 'comparison'],
  B03: ['correction', 'reveal'],
  B05: ['transition', 'question'],
  B06: ['evidence', 'list', 'comparison'],
  B08: ['question', 'transition'],
  B09: ['list', 'correction'],
  B10: ['comparison', 'data', 'transformation'],
  B11: ['correction', 'causal'],
  B13: ['evidence', 'data'],
  B14: ['evidence', 'causal', 'timeline'],
  B15: ['causal', 'comparison'],
  B17: ['comparison', 'transformation'],
  B19: ['evidence', 'causal', 'data'],
  B20: ['transition'],
  B22: ['data'],
  B23: ['evidence', 'process', 'data'],
  B25: ['data', 'causal'],
  B27: ['transformation', 'conclusion'],
  B28: ['question', 'correction'],
  B29: ['correction', 'data', 'causal'],
  B31: ['causal', 'conclusion'],
  B32: ['comparison', 'correction'],
  B33: ['conclusion'],
  B34: ['outro'],
});

const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const readBytes = (relativePath) => fs.readFileSync(path.resolve(repoRoot, relativePath));
const readJson = (relativePath) => JSON.parse(readBytes(relativePath));
const binding = (relativePath) => ({path: relativePath, sha256: sha256(readBytes(relativePath))});
const writeExclusive = (relativePath, value) => {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.resolve(repoRoot, relativePath), bytes, {flag: 'wx'});
  return {path: relativePath, sha256: sha256(bytes)};
};
const compact = (value) => String(value ?? '').replace(/[\p{P}\p{Z}\s]/gu, '');
const overlaps = (page, beat) => page.startMs < beat.endMs && page.endMs > beat.startMs;

const timeline = readJson(timelinePath);
const bilingual = readJson(bilingualPath);
if (timeline.beats?.length !== 34 || bilingual.pages?.length !== 132) {
  throw new Error(`EXPECTED_34_BEATS_AND_132_CAPTIONS:${timeline.beats?.length}:${bilingual.pages?.length}`);
}
if (timeline.formalAllowed !== false || bilingual.formalAllowed !== false) {
  throw new Error('CANDIDATE_REVIEW_BOUNDARY_REQUIRED');
}

const captionsAdapter = {
  schemaVersion: 'koubo-shotcraft-caption-adapter/v1',
  taskId: timeline.taskId,
  episodeId: timeline.episodeId,
  authority: 'actual-recording-candidate',
  source: binding(bilingualPath),
  formalAllowed: false,
  humanListeningPerformed: false,
  captions: bilingual.pages,
};
const captionsBinding = writeExclusive(captionsPath, captionsAdapter);

const speakerRegion = Object.freeze({x: 72, y: 126, width: 548, height: 286});
const evidenceRegion = Object.freeze({x: 260, y: 120, width: 1400, height: 540});
const speakerProtected = Object.freeze([
  {x: 650, y: 20, width: 760, height: 810},
  {x: 0, y: 840, width: 1920, height: 240},
  {x: 1420, y: 0, width: 500, height: 830},
]);
const evidenceProtected = Object.freeze([
  {x: 0, y: 0, width: 220, height: 830},
  {x: 1700, y: 0, width: 220, height: 830},
  {x: 0, y: 840, width: 1920, height: 240},
]);

const routeMap = Object.freeze({
  speaker: 'speaker',
  'real-evidence': 'real-evidence',
  'paper-editorial': 'paper-editorial',
  'ai-generated-video': 'generated-video',
});
const durationInFrames = 11603;
const fps = 30;

const beats = timeline.beats.map((beat) => {
  const pages = bilingual.pages.filter((page) => overlaps(page, beat));
  if (!pages.length) throw new Error(`NO_CAPTION_FOR_BEAT:${beat.beatId}`);
  const quote = pages.map((page) => page.zh).join('');
  const phrases = keyPhrases[beat.beatId] ?? [];
  for (const phrase of phrases) {
    if (!compact(quote).includes(compact(phrase))) throw new Error(`KEY_PHRASE_NOT_IN_AUDIO_WINDOW:${beat.beatId}:${phrase}`);
  }
  const mainVisual = routeMap[beat.route];
  if (!mainVisual) throw new Error(`UNKNOWN_ROUTE:${beat.beatId}:${beat.route}`);
  const requestBeat = {
    beatId: beat.beatId,
    mainVisual,
    frames: {
      startFrame: Math.floor(beat.startMs / 1000 * fps),
      endFrameExclusive: Math.ceil(beat.endMs / 1000 * fps),
    },
    quote,
    purpose: beat.actualChinese,
    semanticIntents: semanticIntents[beat.beatId] ?? ['process'],
    materialClass: mainVisual === 'speaker'
      ? 'talking-head'
      : mainVisual === 'real-evidence'
        ? 'document'
        : 'generic',
    energy: ['B01', 'B10', 'B13', 'B31', 'B33', 'B34'].includes(beat.beatId) ? 'high' : 'medium',
    existingVisualSufficiency: mainVisual === 'real-evidence' ? 'high' : ['B01', 'B08', 'B10', 'B17', 'B20', 'B22', 'B27', 'B28', 'B31', 'B33', 'B34'].includes(beat.beatId) ? 'low' : 'high',
    keyPhrases: phrases,
    actualCaptionPageIds: pages.map((page) => page.id),
    captionWindow: {startMs: beat.startMs, endMs: beat.endMs, matchRule: 'overlap'},
  };
  if (mainVisual === 'speaker' || mainVisual === 'real-evidence') {
    requestBeat.region = mainVisual === 'speaker' ? speakerRegion : evidenceRegion;
    requestBeat.protectedRegions = mainVisual === 'speaker' ? speakerProtected : evidenceProtected;
  }
  const assetPath = assetByBeat[beat.beatId];
  if (mainVisual === 'real-evidence' && assetPath && fs.existsSync(path.resolve(repoRoot, assetPath))) {
    requestBeat.evidence = {
      asset: binding(assetPath),
      rect: {x: 80, y: 60, width: 1240, height: 400},
      claimBoundary: beat.beatId === 'B13'
        ? '仅展示有明确口径的装卸效率和装卸成本历史案例，不把它表述为全部运输成本'
        : '公开来源只支持画面所标示的机制或背景，不提供普遍结果保证',
    };
  }
  return requestBeat;
});

const request = {
  schemaVersion: 'koubo-shotcraft-auto-match-request/v1',
  taskId: timeline.taskId,
  revisionId: '20260913-ai-no-new-business-model-shotcraft-r1',
  directorProfile: {profileId: 'paper-editorial-director-v9', profileVersion: '9.1.0'},
  subtitleAuthority: 'actual-recording',
  registry: binding(canonical.registry),
  library: binding(canonical.library),
  capabilityIndex: binding(canonical.capabilityIndex),
  experienceLedger: binding(canonical.experienceLedger),
  componentModule: binding(canonical.componentModule),
  captions: captionsBinding,
  canvas: {width: 1920, height: 1080, fps, durationInFrames},
  beats,
  sourceContract: {
    timeline: binding(timelinePath),
    bilingual: binding(bilingualPath),
    captionState: bilingual.status,
    captionPageCount: bilingual.pages.length,
    formalAllowed: false,
    humanListeningPerformed: false,
  },
  libraryScope: {
    cardCount: readJson(canonical.capabilityIndex).stats.cardCount,
    styleCount: readJson(canonical.capabilityIndex).stats.styleCount,
    mechanicalQuotaForbidden: true,
  },
};
const requestBinding = writeExclusive(requestPath, request);

console.log(JSON.stringify({
  status: 'shotcraft-auto-match-request-written',
  captions: captionsBinding,
  request: requestBinding,
  beatCount: beats.length,
  eligibleBeatCount: beats.filter((beat) => ['speaker', 'real-evidence'].includes(beat.mainVisual)).length,
  candidateOnly: true,
  formalAllowed: false,
}, null, 2));
