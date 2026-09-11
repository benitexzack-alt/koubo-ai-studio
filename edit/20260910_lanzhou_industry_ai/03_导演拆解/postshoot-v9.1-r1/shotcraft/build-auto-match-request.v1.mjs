#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const args = process.argv.slice(2);
const outputOptionIndex = args.indexOf('--output');
const outputPath = outputOptionIndex >= 0
  ? args[outputOptionIndex + 1]
  : 'edit/20260910_lanzhou_industry_ai/03_导演拆解/postshoot-v9.1-r1/shotcraft/auto-match-request.v1.json';

const bindings = Object.freeze({
  registry: {
    path: 'skills/koubo-shotcraft-library/registry.v1.json',
    sha256: '27ccd156ace2a95533e9e255b27592cadf838658010fcb03c04f7e61317efd61',
  },
  library: {
    path: 'skills/koubo-shotcraft-library/upstream/gallery/api/library.json',
    sha256: 'ee26285c40774272d7782f6d8ff28a8f7b559f13cdf6f5641eac1463417190e4',
  },
  capabilityIndex: {
    path: 'skills/koubo-shotcraft-library/card-capability-index.v2.json',
    sha256: '5a0cb31e1c7f2e8f5c51b2d5f98a36c29e2b07ecad0c7f179529254cdce78441',
  },
  experienceLedger: {
    path: 'skills/koubo-shotcraft-library/experience/shotcraft-acceptance-ledger.v1.json',
    sha256: '6b1750e42b5e9eb78a68a0ff52649d5295643108df781d1c16795feae879e19a',
  },
  componentModule: {
    path: 'skills/koubo-shotcraft-library/assets/ShotcraftEffects.tsx',
    sha256: '9f87cac6a7d1ac1246cce996a21735c663b898ca09f5ebbf38967b77e1588ba4',
  },
  captions: {
    path: 'edit/20260910_lanzhou_industry_ai/05_实录与字幕/actual-spoken.bilingual.candidate.v1.json',
    sha256: '1e0401c5edd119581d38f8ee83f3bcba3aafcaa31fddd370ed51477a5e9a8914',
  },
  postShootPlan: {
    path: 'edit/20260910_lanzhou_industry_ai/03_导演拆解/postshoot-v9.1-r1/director-postshoot-rebind-plan.v1.json',
    sha256: '055bd70d502107c6d22538238f71c843a6012bcb10cc2c20b901c1ca482c7390',
  },
  postShootValidation: {
    path: 'edit/20260910_lanzhou_industry_ai/03_导演拆解/postshoot-v9.1-r1/director-postshoot-validation-receipt.v1.json',
    sha256: null,
  },
  recordedMedia: {
    path: 'edit/20260910_lanzhou_industry_ai/01_原始口播/copy_B71E2E7B-29AC-4653-AC9C-9D4A3C3D3AB6.MOV',
    sha256: 'f5469a24278c333c00b4517c853958954a09cce8772a86231197e1966647d98f',
  },
});

const phraseMap = Object.freeze({
  B01: ['最后一次创业风口'],
  B02: ['熟悉的行业', '服务本地'],
  B03: ['不会自动消失', '收入上的差距'],
  B05: ['品质好服务好', '为什么选这家'],
  B06: ['价格不一样', '什么人适合这个产品'],
  B08: ['没有来过的人也看到', '找到他的介绍'],
  B09: ['先看懂的是你的产品', '有机会进去他的选择'],
  B12: ['不是AI才发明的', '作品和服务'],
  B13: ['留在兰州', '外地有没有人需要'],
  B14: ['搬迁和生活开支', '多留一点时间'],
  B16: ['客户如果自己也会用AI了', '还需要你做什么'],
  B18: ['工具越来越容易用', '没有办法持续做下去'],
  B19: ['去店里聊', '按照实际情况改'],
  B20: ['付费项目', '服务怎么做好'],
  B21: ['熟悉的业务', '别因为AI能给方案'],
  B22: ['留在兰州', '当面说清楚'],
});

const intentMap = Object.freeze({
  B01: ['opening', 'emphasis'],
  B02: ['selection', 'comparison'],
  B03: ['comparison', 'causal', 'correction'],
  B05: ['correction', 'question'],
  B06: ['list', 'question'],
  B08: ['comparison', 'reveal'],
  B09: ['process', 'selection'],
  B12: ['correction', 'causal'],
  B13: ['question', 'selection'],
  B14: ['causal', 'process', 'data'],
  B16: ['question', 'transition'],
  B18: ['comparison', 'causal'],
  B19: ['process', 'correction'],
  B20: ['evidence', 'correction', 'process'],
  B21: ['process', 'correction'],
  B22: ['outro', 'conclusion'],
});

const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const readLocked = (binding, parseJson = true) => {
  const absolute = path.resolve(repoRoot, binding.path);
  const bytes = fs.readFileSync(absolute);
  const actual = sha256(bytes);
  if (binding.sha256 && actual !== binding.sha256) {
    throw new Error(`INPUT_HASH_MISMATCH:${binding.path}:${actual}`);
  }
  return {body: parseJson ? JSON.parse(bytes) : null, sha256: actual};
};

const loaded = Object.fromEntries(Object.entries(bindings).map(([name, binding]) => [
  name,
  readLocked(binding, !['componentModule', 'recordedMedia'].includes(name)),
]));
const captions = loaded.captions.body;
const postShootPlan = loaded.postShootPlan.body;
const postShootValidation = loaded.postShootValidation.body;
const fps = 30;
const durationInFrames = 10091;

if (captions.status !== 'needs-user-audio-review' || captions.userAudioReviewConfirmed !== false || captions.humanListeningPerformed !== false) {
  throw new Error('BILINGUAL_CAPTION_REVIEW_STATE_INVALID');
}
if (captions.captions.length !== 96 || postShootPlan.beats.length !== 22) {
  throw new Error('EXPECTED_96_CAPTION_PAGES_AND_22_BEATS');
}
if (postShootValidation.status !== 'validated-candidate-preview-required') {
  throw new Error('POSTSHOOT_VALIDATION_REQUIRED');
}

const speakerRegion = Object.freeze({x: 72, y: 120, width: 680, height: 640});
const protectedRegions = Object.freeze([
  {x: 820, y: 40, width: 820, height: 800},
  {x: 0, y: 820, width: 1920, height: 260},
  {x: 1640, y: 0, width: 280, height: 820},
]);

const beats = postShootPlan.beats.map((beat) => {
  const startMs = Math.round(beat.startSeconds * 1000);
  const endMs = Math.round(beat.endSeconds * 1000);
  const sameWindowPages = captions.captions.filter((caption) => caption.startMs < endMs && caption.endMs > startMs);
  if (!sameWindowPages.length) throw new Error(`NO_SAME_WINDOW_CAPTION:${beat.id}`);
  const quote = sameWindowPages.map((caption) => caption.zh).join('');
  const mainVisual = beat.visualDecision.class;
  const requestBeat = {
    beatId: beat.id,
    mainVisual,
    frames: {
      startFrame: Math.floor(startMs / 1000 * fps),
      endFrameExclusive: Math.ceil(endMs / 1000 * fps),
    },
    quote,
    purpose: beat.coreMeaning,
    semanticIntents: intentMap[beat.id] ?? ['process'],
    materialClass: mainVisual === 'speaker' ? 'talking-head' : 'generic',
    energy: ['B01', 'B16', 'B22'].includes(beat.id) ? 'high' : 'medium',
    existingVisualSufficiency: mainVisual === 'speaker' ? 'low' : 'high',
    keyPhrases: phraseMap[beat.id] ?? [],
    actualCaptionPageIds: sameWindowPages.map((caption) => caption.id),
    captionWindow: {startMs, endMs, matchRule: 'overlap'},
  };
  for (const phrase of requestBeat.keyPhrases) {
    if (!quote.includes(phrase)) throw new Error(`KEY_PHRASE_NOT_IN_SAME_WINDOW_QUOTE:${beat.id}:${phrase}`);
  }
  if (mainVisual === 'speaker') {
    requestBeat.region = speakerRegion;
    requestBeat.protectedRegions = protectedRegions;
  }
  return requestBeat;
});

const paperBeatIds = beats.filter((beat) => beat.mainVisual === 'paper-editorial').map((beat) => beat.beatId);
const speakerBeatIds = beats.filter((beat) => beat.mainVisual === 'speaker').map((beat) => beat.beatId);
if (paperBeatIds.join(',') !== 'B04,B07,B10,B11,B15,B17' || speakerBeatIds.length !== 16) {
  throw new Error(`MAIN_VISUAL_CONTRACT_INVALID:${paperBeatIds.join(',')}:${speakerBeatIds.length}`);
}

const request = {
  schemaVersion: 'koubo-shotcraft-auto-match-request/v1',
  taskId: postShootPlan.taskId,
  revisionId: '20260911-lanzhou-industry-ai-shotcraft-v9.1-r1',
  directorProfile: {profileId: 'paper-editorial-director-v9', profileVersion: '9.1.0'},
  subtitleAuthority: 'actual-recording',
  registry: bindings.registry,
  library: bindings.library,
  capabilityIndex: bindings.capabilityIndex,
  experienceLedger: bindings.experienceLedger,
  componentModule: bindings.componentModule,
  captions: bindings.captions,
  canvas: {width: 1920, height: 1080, fps, durationInFrames},
  beats,
  sourceContract: {
    postShootPlan: bindings.postShootPlan,
    postShootValidation: {...bindings.postShootValidation, sha256: loaded.postShootValidation.sha256},
    recordedMedia: bindings.recordedMedia,
    captionState: captions.status,
    captionPageCount: captions.captions.length,
    userAudioReviewConfirmed: captions.userAudioReviewConfirmed,
    humanListeningPerformed: captions.humanListeningPerformed,
  },
  libraryScope: {
    cardCount: loaded.capabilityIndex.body.stats.cardCount,
    candidateRenderableCardCount: loaded.capabilityIndex.body.stats.candidateRenderableCount,
    adaptationRequiredCardCount: loaded.capabilityIndex.body.stats.adaptationRequiredCount,
    paperBeatIds,
    speakerBeatIds,
    mechanicalQuotaForbidden: true,
  },
};

const absoluteOutput = path.resolve(repoRoot, outputPath);
const bytes = Buffer.from(`${JSON.stringify(request, null, 2)}\n`, 'utf8');
fs.writeFileSync(absoluteOutput, bytes, {flag: 'wx'});
console.log(JSON.stringify({
  status: 'shotcraft-auto-match-request-written',
  path: outputPath,
  sha256: sha256(bytes),
  beatCount: beats.length,
  speakerBeatCount: speakerBeatIds.length,
  paperBeatCount: paperBeatIds.length,
  captionPageCount: captions.captions.length,
  libraryCardCount: request.libraryScope.cardCount,
}, null, 2));
