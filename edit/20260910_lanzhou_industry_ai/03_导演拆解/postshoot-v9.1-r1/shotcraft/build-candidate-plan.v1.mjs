#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const outputPath = 'edit/20260910_lanzhou_industry_ai/03_导演拆解/postshoot-v9.1-r1/shotcraft/candidate-plan.v1.json';
const sources = Object.freeze({
  captions: {
    path: 'edit/20260910_lanzhou_industry_ai/05_实录与字幕/actual-spoken.bilingual.candidate.v1.json',
    sha256: '1e0401c5edd119581d38f8ee83f3bcba3aafcaa31fddd370ed51477a5e9a8914',
  },
  aggregateTimeline: {
    path: 'edit/20260910_lanzhou_industry_ai/05_实录与字幕/spoken-timeline.candidate.v1.json',
    sha256: 'be4a59f697cabd520c0219cef782cc7d779fdd129ab2c8633aad9e202ebeefa2',
  },
  postShootPlan: {
    path: 'edit/20260910_lanzhou_industry_ai/03_导演拆解/postshoot-v9.1-r1/director-postshoot-rebind-plan.v1.json',
    sha256: '055bd70d502107c6d22538238f71c843a6012bcb10cc2c20b901c1ca482c7390',
  },
  postShootValidation: {
    path: 'edit/20260910_lanzhou_industry_ai/03_导演拆解/postshoot-v9.1-r1/director-postshoot-validation-receipt.v1.json',
    sha256: '04544e9d36e5a87fdaa9fae96fe38e72f74efc5eca3b9d54c498c74e03347c5f',
  },
  autoMatchRequest: {
    path: 'edit/20260910_lanzhou_industry_ai/03_导演拆解/postshoot-v9.1-r1/shotcraft/auto-match-request.v1.json',
    sha256: 'e24426ab9c20be48fabcc35ea9cdd87ea1a15c0387db8fdb4beccd51462e720d',
  },
  autoSelection: {
    path: 'edit/20260910_lanzhou_industry_ai/03_导演拆解/postshoot-v9.1-r1/shotcraft/director-selection.v1.json',
    sha256: '67e90b59132301836b8e413dbef37576e5e9031e337057efa6876c6cdf89b5c3',
  },
  autoMatchReceipt: {
    path: 'edit/20260910_lanzhou_industry_ai/03_导演拆解/postshoot-v9.1-r1/shotcraft/auto-match-receipt.v1.json',
    sha256: '19756cb9f19de6835137ca65b0907d0fcf0d7c7306dae66d01815a0ae45a678e',
  },
  experienceLookup: {
    path: 'edit/20260910_lanzhou_industry_ai/03_导演拆解/postshoot-v9.1-r1/shotcraft/experience-lookup-receipt.v1.json',
    sha256: '3e440c38e47a3d024bcc3626d63c8d1fb0b1b21cf7952b7e94ce66ac4565d103',
  },
  autoSelectionValidation: {
    path: 'edit/20260910_lanzhou_industry_ai/03_导演拆解/postshoot-v9.1-r1/shotcraft/selection-validation-output.v1.json',
    sha256: '9b29cef6e6ade782d0bb97aa5b549463ecf76c9275b6810dc9851758ed99e262',
  },
  registry: {
    path: 'skills/koubo-shotcraft-library/registry.v1.json',
    sha256: '27ccd156ace2a95533e9e255b27592cadf838658010fcb03c04f7e61317efd61',
  },
  componentModule: {
    path: 'skills/koubo-shotcraft-library/assets/ShotcraftEffects.tsx',
    sha256: '9f87cac6a7d1ac1246cce996a21735c663b898ca09f5ebbf38967b77e1588ba4',
  },
  recordedMedia: {
    path: 'edit/20260910_lanzhou_industry_ai/01_原始口播/copy_B71E2E7B-29AC-4653-AC9C-9D4A3C3D3AB6.MOV',
    sha256: 'f5469a24278c333c00b4517c853958954a09cce8772a86231197e1966647d98f',
  },
});

const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const readLocked = (binding, parseJson = true) => {
  const bytes = fs.readFileSync(path.resolve(repoRoot, binding.path));
  const actual = sha256(bytes);
  if (actual !== binding.sha256) throw new Error(`INPUT_HASH_MISMATCH:${binding.path}:${actual}`);
  return parseJson ? JSON.parse(bytes) : null;
};

const captions = readLocked(sources.captions);
const aggregateTimeline = readLocked(sources.aggregateTimeline);
const postShootPlan = readLocked(sources.postShootPlan);
const postShootValidation = readLocked(sources.postShootValidation);
const autoMatchRequest = readLocked(sources.autoMatchRequest);
const autoSelection = readLocked(sources.autoSelection);
const autoMatchReceipt = readLocked(sources.autoMatchReceipt);
const experienceLookup = readLocked(sources.experienceLookup);
const autoSelectionValidation = readLocked(sources.autoSelectionValidation);
const registry = readLocked(sources.registry);
readLocked(sources.componentModule, false);
readLocked(sources.recordedMedia, false);

if (captions.status !== 'needs-user-audio-review' || captions.captions.length !== 96) throw new Error('CAPTION_CANDIDATE_STATE_INVALID');
if (postShootValidation.status !== 'validated-candidate-preview-required' || postShootValidation.skillExecuted !== true) throw new Error('POSTSHOOT_VALIDATION_INVALID');
if (autoMatchReceipt.summary.analyzedCardCount !== 157 || autoMatchReceipt.summary.applyCount !== 0 || autoMatchReceipt.summary.notNeededCount !== 22) throw new Error('AUTO_MATCH_BASELINE_INVALID');
if (autoSelectionValidation.status !== 'director-selection-valid') throw new Error('AUTO_SELECTION_VALIDATION_INVALID');
if (experienceLookup.caseCount !== 0 || experienceLookup.reusablePatternCount !== 0) throw new Error('EXPERIENCE_LEDGER_STATE_CHANGED');

const fps = 30;
const durationInFrames = 10091;
const toFrames = (startMs, endMs) => ({
  startFrame: Math.floor(startMs / 1000 * fps),
  endFrameExclusive: Math.ceil(endMs / 1000 * fps),
});
const aggregateById = new Map(aggregateTimeline.captions.map((caption) => [caption.id.replace('cap-', '').toUpperCase(), caption]));
const postShootById = new Map(postShootPlan.beats.map((beat) => [beat.id, beat]));

const mainVisualBeats = [...postShootById.values()].map((beat) => {
  const aggregate = aggregateById.get(beat.id);
  if (!aggregate) throw new Error(`AGGREGATE_BEAT_MISSING:${beat.id}`);
  const captionPages = captions.captions.filter((page) => page.beatId === beat.id);
  const spokenFrames = toFrames(aggregate.startMs, aggregate.endMs);
  const postShootPlacementFrames = toFrames(Math.round(beat.startSeconds * 1000), Math.round(beat.endSeconds * 1000));
  const availableSeconds = beat.endSeconds - beat.startSeconds;
  const requestedSeconds = beat.paperScene?.durationSeconds ?? null;
  return {
    beatId: beat.id,
    order: beat.order,
    mainVisual: beat.visualDecision.class,
    spokenFrames,
    postShootPlacementFrames,
    aggregateCaptionId: aggregate.id,
    actualCaptionPageIds: captionPages.map((page) => page.id),
    coreMeaning: beat.coreMeaning,
    candidateDisposition: beat.visualDecision.class === 'paper-editorial' && requestedSeconds > availableSeconds
      ? 'blocked-paper-window-too-short-replan-required'
      : beat.visualDecision.class === 'paper-editorial'
        ? 'paper-candidate-window-available'
        : 'speaker-source',
    paperTiming: beat.visualDecision.class === 'paper-editorial' ? {
      requestedSeconds,
      availableSeconds,
      firstFrameLabelsRequireAllTermsSpoken: true,
      speedupForbidden: true,
      freezeExtensionForbidden: true,
    } : null,
  };
});

const paperIds = mainVisualBeats.filter((beat) => beat.mainVisual === 'paper-editorial').map((beat) => beat.beatId);
if (paperIds.join(',') !== 'B04,B07,B10,B11,B15,B17') throw new Error('PAPER_BEAT_SET_INVALID');

const b21Auto = autoMatchReceipt.matches.find((match) => match.beatId === 'B21');
const lineCandidate = b21Auto?.rankedCandidates.find((candidate) => candidate.cardName === 'line-carry-transition');
if (!lineCandidate || lineCandidate.adapterId !== 'line-carry' || lineCandidate.score !== 0.617778 || b21Auto.semanticGap !== 0.125163) {
  throw new Error('B21_LINE_CARRY_AUTO_EVIDENCE_INVALID');
}
const b21Pages = captions.captions.filter((page) => ['cap-b21-p03', 'cap-b21-p04'].includes(page.id));
const b21Quote = b21Pages.map((page) => page.zh).join('');
const b21Texts = ['了解实际工作', 'AI能给方案'];
if (b21Texts.some((text) => !b21Quote.includes(text))) throw new Error('B21_EFFECT_TEXT_NOT_IN_SAME_WINDOW_CAPTIONS');

const registryInventory = registry.effects.map((effect) => ({
  cardId: effect.upstream,
  cardName: effect.upstream,
  effectId: effect.id,
  component: effect.component,
  registeredContexts: effect.contexts,
  localStatus: effect.status,
  currentCandidateDisposition: effect.id === 'line-carry' ? 'candidate-applied-on-B21' : 'not-applied',
  currentCandidateBeatIds: effect.id === 'line-carry' ? ['B21'] : [],
  reason: effect.id === 'evidence-scan'
    ? '本条22个主画面只有speaker与paper-editorial，没有real-evidence，不伪造证据类主画面'
    : effect.id === 'line-carry'
      ? 'B21作为人工导演候选覆盖，仅用于低清候选片验收'
      : '原始157卡自动匹配未给出可应用决策，本轮不强行凑效果',
}));

const candidateEffect = {
  beatId: 'B21',
  decision: 'apply',
  decisionOrigin: 'human-director-candidate-override',
  candidateOnly: true,
  cardId: 'line-carry-transition',
  cardName: 'line-carry-transition',
  effectId: 'line-carry',
  component: 'LineCarry',
  frames: toFrames(b21Pages[0].startMs, b21Pages.at(-1).endMs),
  localDurationInFrames: toFrames(b21Pages[0].startMs, b21Pages.at(-1).endMs).endFrameExclusive - toFrames(b21Pages[0].startMs, b21Pages.at(-1).endMs).startFrame,
  sourceCaptionPageIds: b21Pages.map((page) => page.id),
  quote: b21Quote,
  texts: b21Texts,
  purpose: '把“先了解实际工作”与“AI能给方案”的先后关系做成单线接力，不表达AI方案已经适用',
  region: {x: 72, y: 120, width: 680, height: 640},
  protectedRegions: [
    {x: 820, y: 40, width: 820, height: 800},
    {x: 0, y: 820, width: 1920, height: 260},
    {x: 1640, y: 0, width: 280, height: 820},
  ],
  componentProps: {fromLabel: b21Texts[0], toLabel: b21Texts[1], width: 680},
  timingPropsSource: 'remotion-local-frame-fps-duration',
  fallback: 'blocked',
  autoMatchEvidence: {
    originalDecision: b21Auto.decision,
    reason: b21Auto.reason,
    cardScore: lineCandidate.score,
    threshold: b21Auto.threshold,
    semanticGap: b21Auto.semanticGap,
    maximumSemanticGap: b21Auto.maximumSemanticGap,
    overrideDoesNotAlterAutoMatchReceipt: true,
  },
  acceptance: {
    renderStatus: 'planned-not-yet-rendered',
    requiresLowResolutionCandidatePlayback: true,
    requiresUserApproval: true,
    formalUseApproved: false,
  },
};

const plan = {
  schemaVersion: 'lanzhou-industry-ai-remotion-candidate-plan/v1',
  status: 'candidate-plan-ready-with-blockers',
  taskId: postShootPlan.taskId,
  revisionId: '20260911-lanzhou-industry-ai-remotion-v9.1-r1',
  generatedAt: new Date().toISOString(),
  canvas: {width: 1920, height: 1080, fps, durationInFrames},
  sourceMedia: sources.recordedMedia,
  sources,
  subtitleTrack: {
    authority: 'actual-recording-candidate-from-local-asr',
    status: captions.status,
    pageCount: captions.captions.length,
    pages: captions.captions,
    renderContract: {
      bilingualSameWindow: true,
      chineseMustRemainExact: true,
      englishTranslatedOnlyFromSameChinesePage: true,
      whiteSpace: 'normal',
      overflowWrap: 'anywhere',
      nowrapForbidden: true,
      scriptTextForbidden: true,
    },
  },
  mainVisualBeats,
  shotcraft: {
    matcherVersion: 'v9.1',
    fullLibraryCoverage: {
      analyzedCardCount: autoMatchReceipt.summary.analyzedCardCount,
      candidateRenderableCardCount: autoMatchReceipt.summary.candidateRenderableCardCount,
      adaptationRequiredCardCount: autoMatchReceipt.summary.adaptationRequiredCardCount,
      autoApplyCount: autoMatchReceipt.summary.applyCount,
      autoNotNeededCount: autoMatchReceipt.summary.notNeededCount,
    },
    autoSelectionPreserved: true,
    adapterInventory: registryInventory,
    candidateEffects: [candidateEffect],
    effectApplicationCount: 1,
  },
  gates: {
    candidatePreviewAllowed: true,
    formalRenderAllowed: false,
    publicationApproved: false,
    userAudioReviewConfirmed: false,
    shotcraftCandidateAccepted: false,
    paperDynamicCandidateAccepted: false,
    paperBeatReplanRequired: paperIds,
    paperReason: '六个纸艺首帧带字镜头在实录术语全部说完后只剩约0.3秒，不足以容纳6至7秒动态候选，禁止加速或冻结延长冒充合格',
  },
  expectedApplicationReceiptPath: 'edit/20260910_lanzhou_industry_ai/03_导演拆解/postshoot-v9.1-r1/shotcraft/application-receipt.v1.json',
};

const bytes = Buffer.from(`${JSON.stringify(plan, null, 2)}\n`, 'utf8');
fs.writeFileSync(path.resolve(repoRoot, outputPath), bytes, {flag: 'wx'});
console.log(JSON.stringify({
  status: plan.status,
  path: outputPath,
  sha256: sha256(bytes),
  captionPageCount: plan.subtitleTrack.pageCount,
  beatCount: plan.mainVisualBeats.length,
  analyzedCardCount: plan.shotcraft.fullLibraryCoverage.analyzedCardCount,
  autoApplyCount: plan.shotcraft.fullLibraryCoverage.autoApplyCount,
  humanOverrideCandidateApplyCount: plan.shotcraft.effectApplicationCount,
  selectedCardIds: plan.shotcraft.candidateEffects.map((effect) => effect.cardId),
}, null, 2));
