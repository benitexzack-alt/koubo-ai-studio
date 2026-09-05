import crypto from 'node:crypto';
import {
  contextFingerprint,
  experienceSignalForCandidate,
  normalizeContextSignature,
} from './experience-ledger-core.mjs';

export const CAPABILITY_INDEX_SCHEMA = 'koubo-shotcraft-card-capability-index/v2';
export const AUTO_MATCH_REQUEST_SCHEMA = 'koubo-shotcraft-auto-match-request/v1';
export const AUTO_MATCH_RECEIPT_SCHEMA = 'koubo-shotcraft-auto-match-receipt/v1';
export const EXPERIENCE_LOOKUP_RECEIPT_SCHEMA = 'koubo-shotcraft-experience-lookup-receipt/v1';
export const V91_DIRECTOR_PROFILE = Object.freeze({profileId: 'paper-editorial-director-v9', profileVersion: '9.1.0'});

const ELIGIBLE_MAIN_VISUALS = new Set(['speaker', 'real-evidence']);
const SHA256_RE = /^[a-f0-9]{64}$/u;
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim().length > 0;
const normalizeText = (value) => String(value ?? '').normalize('NFKC').toLowerCase();
const compactText = (value) => normalizeText(value).replace(/[\p{P}\p{Z}\s]/gu, '');
const uniqueSorted = (values) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const INTENT_RULES = Object.freeze({
  emphasis: ['核心', '关键', '重点', '最重要', '必须', '记住', '唯一', '真正'],
  correction: ['搞错', '误区', '不是', '而是', '纠偏', '别把', '不要以为'],
  list: ['第一', '第二', '第三', '几个', '几类', '分别', '包括', '逐项', '列表', '清单'],
  process: ['先', '然后', '接下来', '最后', '流程', '步骤', '跑完', '工作流', '一段活'],
  evidence: ['证据', '官方', '截图', '录屏', '界面', '按钮', '页面', '画面', '显示', '数据'],
  comparison: ['以前', '现在', '未来', '对比', '差别', '相比', '从来不是', '越来越'],
  causal: ['因为', '所以', '导致', '意味着', '本质', '原因', '带来'],
  transformation: ['变成', '转化', '重构', '改造', '从零到', '从无到有', '接管'],
  selection: ['选择', '筛选', '匹配', '收窄', '选一个', '二选一'],
  hierarchy: ['层级', '底层', '上层', '基础设施', '结构', '体系', '六边形'],
  timeline: ['时间线', '以前', '今天', '未来', '之后', '发展史', '里程碑'],
  conclusion: ['总结', '一句话', '结论', '终局', '最终', '归根到底'],
  question: ['为什么', '是不是', '到底', '有没有', '能不能', '什么是'],
  data: ['数据', '成本', '价格', '比例', '百分比', '报表', '指标', '数字'],
  convergence: ['汇入', '收束', '合并', '整合', '串联', '闭环', '集中'],
  reveal: ['揭示', '出现', '打开', '展开', '亮相', '呈现', '弹出'],
  transition: ['转场', '切换', '进入', '交接', '翻页', '换景'],
  opening: ['开场', '一开始', '今天聊', '发生了', '很多人'],
  outro: ['最后', '关注', '评论区', '我是超哥', '收尾', '结束'],
  voice: ['语音', '按住说话', '声纹', '说一句', '录音'],
});

const CATEGORY_INTENTS = Object.freeze({
  interaction: ['process'],
  effects: ['emphasis'],
  'ui-entrance': ['reveal'],
  data: ['data'],
  camera: ['emphasis'],
  rhythm: ['emphasis'],
  typography: ['emphasis'],
  transition: ['transition'],
  opening: ['opening'],
  outro: ['outro'],
});

const STOP_TOKENS = new Set(['一个', '一种', '这个', '那个', '可以', '需要', '用于', '画面', '镜头', '内容', '效果', '方式', '然后', '最后', '通过', '进行', '整个', '本段']);

export const sha256Bytes = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

export function extractSemanticTokens(value) {
  const text = normalizeText(value);
  const tokens = [];
  for (const word of text.match(/[a-z0-9][a-z0-9._+-]*/gu) ?? []) if (word.length > 1) tokens.push(word);
  for (const run of text.match(/\p{Script=Han}+/gu) ?? []) {
    const chars = [...run];
    if (chars.length <= 5) tokens.push(run);
    for (const size of [2, 3, 4]) {
      for (let index = 0; index + size <= chars.length; index += 1) tokens.push(chars.slice(index, index + size).join(''));
    }
  }
  return uniqueSorted(tokens.filter((token) => token.length > 1 && !STOP_TOKENS.has(token))).slice(0, 220);
}

export function inferSemanticIntents(value, explicit = []) {
  const text = normalizeText(Array.isArray(value) ? value.join(' ') : value);
  const intents = [...explicit];
  for (const [intent, cues] of Object.entries(INTENT_RULES)) {
    if (cues.some((cue) => text.includes(cue))) intents.push(intent);
  }
  return uniqueSorted(intents);
}

function inferMaterialClasses(card, adapter) {
  if (Array.isArray(adapter?.materialClasses) && adapter.materialClasses.length) return uniqueSorted(adapter.materialClasses);
  const text = normalizeText([card.name, card.summary, card.use, card.intention].join(' '));
  const classes = ['generic'];
  if (/界面|页面|ui|面板|按钮|输入框|仪表盘|网页|应用/u.test(text)) classes.push('interface');
  if (/截图|录屏|证据|框选|扫描|文档|报告|资料/u.test(text)) classes.push('screen-recording', 'document');
  if (/照片|图片|海报|图卡/u.test(text)) classes.push('image');
  if (/数据|图表|指标|数字|计数|报表/u.test(text)) classes.push('data-visualization');
  if (/真人|人物|口播|标题|关键词|文字|字幕/u.test(text)) classes.push('talking-head');
  return uniqueSorted(classes);
}

function parseDurationSeconds(value) {
  const text = String(value ?? '');
  const declaredSeconds = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(?:s|秒)/giu)].map((match) => Number(match[1]));
  if (declaredSeconds.length) return {minimum: Math.min(...declaredSeconds), maximum: Math.max(...declaredSeconds)};
  const declaredFrames = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(?:f|帧)/giu)].map((match) => Number(match[1]) / 30);
  if (declaredFrames.length) return {minimum: Math.min(...declaredFrames), maximum: Math.max(...declaredFrames)};
  const numbers = [...text.matchAll(/\d+(?:\.\d+)?/gu)].map((match) => Number(match[0]));
  if (!numbers.length) return {minimum: 1, maximum: 8};
  const seconds = numbers;
  return {minimum: Math.min(...seconds), maximum: Math.max(...seconds)};
}

function normalizeEnergy(value) {
  const text = String(value ?? '中');
  if (/低/u.test(text) && /高/u.test(text)) return 'variable';
  if (/高/u.test(text)) return 'high';
  if (/低/u.test(text)) return 'low';
  return 'medium';
}

export function buildCardCapabilityIndex({library, registry, libraryBinding, registryBinding, upstreamCommit}) {
  const effectsByUpstream = new Map((registry.effects ?? []).map((effect) => [effect.upstream, effect]));
  const cards = (library.cards ?? []).map((card) => {
    const adapter = effectsByUpstream.get(card.name) ?? null;
    const searchable = [card.name, card.summary, card.use, card.intention, card.category, ...(card.tags ?? [])].join(' ');
    return {
      cardName: card.name,
      category: card.category,
      tags: uniqueSorted(card.tags ?? []),
      summary: card.summary,
      use: card.use,
      intention: card.intention,
      duration: parseDurationSeconds(card.duration),
      energy: normalizeEnergy(card.energy),
      semanticIntents: inferSemanticIntents(searchable, [
        ...(CATEGORY_INTENTS[card.category] ?? []),
        ...(adapter?.semanticIntents ?? []),
      ]),
      semanticTokens: extractSemanticTokens(searchable),
      materialClasses: inferMaterialClasses(card, adapter),
      compatibleMainVisuals: adapter ? uniqueSorted(adapter.contexts ?? []) : ['real-evidence', 'speaker'],
      renderability: adapter ? 'candidate-renderable' : 'adaptation-required',
      adapter: adapter ? {
        effectId: adapter.id,
        component: adapter.component,
        status: adapter.status,
        minimumDurationSeconds: adapter.minimumDurationSeconds,
        maximumDurationSeconds: adapter.maximumDurationSeconds,
      } : null,
    };
  });
  return {
    schemaVersion: CAPABILITY_INDEX_SCHEMA,
    source: {
      upstreamCommit,
      library: libraryBinding,
      registry: registryBinding,
      catalogRevision: library.revision,
    },
    stats: {
      cardCount: cards.length,
      styleCount: cards.reduce((sum, card) => sum + (library.cards.find((item) => item.name === card.cardName)?.styles?.length ?? 0), 0),
      candidateRenderableCount: cards.filter((card) => card.renderability === 'candidate-renderable').length,
      adaptationRequiredCount: cards.filter((card) => card.renderability === 'adaptation-required').length,
    },
    cards,
  };
}

export function validateCapabilityIndex(index, library, registry) {
  const errors = [];
  if (!isRecord(index) || index.schemaVersion !== CAPABILITY_INDEX_SCHEMA) return ['SHOTCRAFT_CAPABILITY_INDEX_SCHEMA_INVALID'];
  if (!Array.isArray(index.cards) || index.cards.length !== library?.cards?.length || index.stats?.cardCount !== library?.cards?.length) errors.push('SHOTCRAFT_CAPABILITY_INDEX_CARD_COUNT_MISMATCH');
  if (index.stats?.styleCount !== library?.cards?.reduce((sum, card) => sum + (card.styles?.length ?? 0), 0)) errors.push('SHOTCRAFT_CAPABILITY_INDEX_STYLE_COUNT_MISMATCH');
  const names = new Set();
  const libraryNames = new Set((library?.cards ?? []).map((card) => card.name));
  for (const card of index.cards ?? []) {
    if (!isText(card.cardName) || names.has(card.cardName) || !libraryNames.has(card.cardName)) errors.push('SHOTCRAFT_CAPABILITY_INDEX_CARD_INVALID');
    names.add(card.cardName);
    if (!Array.isArray(card.semanticIntents) || !Array.isArray(card.semanticTokens) || !Array.isArray(card.materialClasses)) errors.push(`SHOTCRAFT_CAPABILITY_INDEX_METADATA_INVALID:${card.cardName}`);
    if (!['candidate-renderable', 'adaptation-required'].includes(card.renderability)) errors.push(`SHOTCRAFT_CAPABILITY_INDEX_RENDERABILITY_INVALID:${card.cardName}`);
    if (card.renderability === 'candidate-renderable') {
      const effect = (registry?.effects ?? []).find((item) => item.upstream === card.cardName);
      if (!effect || card.adapter?.effectId !== effect.id || card.adapter?.component !== effect.component || effect.status !== 'candidate-only') errors.push(`SHOTCRAFT_CAPABILITY_INDEX_ADAPTER_INVALID:${card.cardName}`);
    }
  }
  if (names.size !== libraryNames.size) errors.push('SHOTCRAFT_CAPABILITY_INDEX_COVERAGE_INCOMPLETE');
  return [...new Set(errors)];
}

function validRect(rect) {
  return isRecord(rect) && ['x', 'y', 'width', 'height'].every((key) => Number.isFinite(rect[key])) && rect.x >= 0 && rect.y >= 0 && rect.width > 0 && rect.height > 0;
}

export function validateAutoMatchRequest(request) {
  const errors = [];
  const binding = (value) => isRecord(value) && isText(value.path) && SHA256_RE.test(String(value.sha256 ?? ''));
  if (!isRecord(request) || request.schemaVersion !== AUTO_MATCH_REQUEST_SCHEMA) return ['SHOTCRAFT_AUTO_MATCH_REQUEST_SCHEMA_INVALID'];
  if (!isText(request.taskId)) errors.push('SHOTCRAFT_AUTO_MATCH_TASK_ID_REQUIRED');
  if (!isText(request.revisionId)) errors.push('SHOTCRAFT_AUTO_MATCH_REVISION_ID_REQUIRED');
  if (request.directorProfile?.profileId !== V91_DIRECTOR_PROFILE.profileId || request.directorProfile?.profileVersion !== V91_DIRECTOR_PROFILE.profileVersion) errors.push('SHOTCRAFT_AUTO_MATCH_V91_PROFILE_REQUIRED');
  if (request.subtitleAuthority !== 'actual-recording') errors.push('SHOTCRAFT_AUTO_MATCH_ACTUAL_RECORDING_REQUIRED');
  for (const key of ['registry', 'library', 'capabilityIndex', 'experienceLedger', 'captions', 'componentModule']) if (!binding(request[key])) errors.push(`SHOTCRAFT_AUTO_MATCH_BINDING_INVALID:${key}`);
  if (!isRecord(request.canvas) || !['width', 'height', 'fps', 'durationInFrames'].every((key) => Number.isInteger(request.canvas[key]) && request.canvas[key] > 0)) errors.push('SHOTCRAFT_AUTO_MATCH_CANVAS_INVALID');
  if (!Array.isArray(request.beats)) return [...errors, 'SHOTCRAFT_AUTO_MATCH_BEATS_REQUIRED'];
  const ids = new Set();
  for (const beat of request.beats) {
    const id = beat?.beatId;
    if (!isText(id) || ids.has(id)) errors.push(`SHOTCRAFT_AUTO_MATCH_BEAT_ID_INVALID:${id ?? 'missing'}`);
    ids.add(id);
    if (!isText(beat?.mainVisual) || !isRecord(beat?.frames) || !Number.isInteger(beat.frames.startFrame) || !Number.isInteger(beat.frames.endFrameExclusive) || beat.frames.startFrame < 0 || beat.frames.endFrameExclusive <= beat.frames.startFrame || beat.frames.endFrameExclusive > request.canvas.durationInFrames) errors.push(`SHOTCRAFT_AUTO_MATCH_BEAT_INVALID:${id ?? 'missing'}`);
    if (!isText(beat?.quote)) errors.push(`SHOTCRAFT_AUTO_MATCH_QUOTE_REQUIRED:${id ?? 'missing'}`);
    if (beat?.keyPhrases != null && (!Array.isArray(beat.keyPhrases) || beat.keyPhrases.some((phrase) => !isText(phrase) || !compactText(beat.quote).includes(compactText(phrase))))) errors.push(`SHOTCRAFT_AUTO_MATCH_KEY_PHRASE_INVALID:${id ?? 'missing'}`);
    if (ELIGIBLE_MAIN_VISUALS.has(beat?.mainVisual)) {
      if (!validRect(beat.region) || !Array.isArray(beat.protectedRegions) || !beat.protectedRegions.length || beat.protectedRegions.some((rect) => !validRect(rect))) errors.push(`SHOTCRAFT_AUTO_MATCH_LAYOUT_REQUIRED:${id ?? 'missing'}`);
    }
  }
  return [...new Set(errors)];
}

function queryTokensForBeat(beat) {
  return extractSemanticTokens([beat.quote, beat.purpose, ...(beat.keyPhrases ?? []), ...(beat.semanticIntents ?? []), beat.materialClass].join(' '));
}

function idfMap(index) {
  const counts = new Map();
  for (const card of index.cards) for (const token of new Set(card.semanticTokens)) counts.set(token, (counts.get(token) ?? 0) + 1);
  return new Map([...counts].map(([token, count]) => [token, Math.log((index.cards.length + 1) / (count + 1)) + 1]));
}

function overlapScore(query, candidate, weights) {
  if (!query.length) return 0;
  const candidateSet = new Set(candidate);
  let total = 0;
  let matched = 0;
  for (const token of query) {
    const weight = weights.get(token) ?? 1;
    total += weight;
    if (candidateSet.has(token)) matched += weight;
  }
  return total ? matched / total : 0;
}

function intentScore(beatIntents, cardIntents) {
  if (!beatIntents.length) return 0;
  const cardSet = new Set(cardIntents);
  return beatIntents.filter((intent) => cardSet.has(intent)).length / beatIntents.length;
}

function energyScore(beatEnergy, cardEnergy) {
  if (!beatEnergy || beatEnergy === 'any' || cardEnergy === 'variable') return 1;
  if (beatEnergy === cardEnergy) return 1;
  if ((beatEnergy === 'high' && cardEnergy === 'low') || (beatEnergy === 'low' && cardEnergy === 'high')) return 0.25;
  return 0.65;
}

function durationScore(seconds, card, adapter) {
  const minimum = adapter?.minimumDurationSeconds ?? card.duration.minimum;
  const maximum = adapter?.maximumDurationSeconds ?? card.duration.maximum;
  if (seconds >= minimum && seconds <= maximum) return 1;
  const distance = seconds < minimum ? minimum - seconds : seconds - maximum;
  return clamp(1 - distance / Math.max(1, maximum));
}

function materialScore(materialClass, card) {
  if (!materialClass || materialClass === 'generic') return card.materialClasses.includes('generic') ? 1 : 0.7;
  if (card.materialClasses.includes(materialClass)) return 1;
  return card.materialClasses.includes('generic') ? 0.45 : 0;
}

function requirementsMet(card, beat) {
  if (!card.adapter) return true;
  const phrases = beat.keyPhrases ?? [];
  if (card.adapter.effectId === 'keyword-reveal' || card.adapter.effectId === 'line-carry') return phrases.length >= 2;
  if (card.adapter.effectId === 'evidence-scan') return beat.mainVisual === 'real-evidence' && isRecord(beat.evidence) && isRecord(beat.evidence.asset) && validRect(beat.evidence.rect) && isText(beat.evidence.claimBoundary);
  return phrases.length >= 1;
}

function buildComponentProps(effectId, beat, fps) {
  const phrases = beat.keyPhrases ?? [];
  const duration = beat.frames.endFrameExclusive - beat.frames.startFrame;
  if (effectId === 'marker-underline') {
    const keyword = phrases[0];
    const index = beat.quote.indexOf(keyword);
    return {before: index >= 0 ? beat.quote.slice(0, index) : '', keyword, after: index >= 0 ? beat.quote.slice(index + keyword.length) : ''};
  }
  if (effectId === 'keyword-reveal') {
    const start = Math.min(Math.round(fps * 0.2), Math.max(0, duration - 1));
    const span = Math.max(1, Math.floor((duration - start - 1) / Math.max(1, phrases.length - 1)));
    return {items: phrases.map((text, index) => ({text, atFrame: Math.min(duration - 1, start + span * index)}))};
  }
  if (effectId === 'evidence-scan') return {width: beat.region.width, height: beat.region.height, rect: beat.evidence.rect, label: phrases[0]};
  if (effectId === 'line-carry') return {fromLabel: phrases[0], toLabel: phrases[1], width: beat.region.width};
  if (effectId === 'paper-tape-pin') return {width: Math.min(beat.region.width, 760)};
  return {};
}

function scoreCards({beat, index, registry, ledger, componentSha256, registrySha256, weights}) {
  const inferredIntents = inferSemanticIntents([beat.quote, beat.purpose, ...(beat.keyPhrases ?? [])].join(' '), beat.semanticIntents ?? []);
  const context = normalizeContextSignature({
    mainVisual: beat.mainVisual,
    materialClass: beat.materialClass ?? 'generic',
    semanticIntents: inferredIntents,
    keyTerms: beat.keyPhrases ?? [],
  });
  const queryTokens = queryTokensForBeat({...beat, semanticIntents: inferredIntents});
  const seconds = (beat.frames.endFrameExclusive - beat.frames.startFrame) / beat.fps;
  return index.cards.map((card) => {
    const adapter = card.adapter ? registry.effects.find((effect) => effect.id === card.adapter.effectId) : null;
    const visual = card.compatibleMainVisuals.includes(beat.mainVisual) ? 1 : 0;
    const base =
      0.42 * intentScore(inferredIntents, card.semanticIntents) +
      0.18 * overlapScore(queryTokens, card.semanticTokens, weights) +
      0.14 * materialScore(context.materialClass, card) +
      0.1 * visual +
      0.08 * energyScore(beat.energy ?? 'medium', card.energy) +
      0.08 * durationScore(seconds, card, adapter);
    const experience = adapter ? experienceSignalForCandidate({
      ledger,
      context,
      effectId: adapter.id,
      cardName: card.cardName,
      registrySha256,
      componentSha256,
    }) : null;
    let bonus = 0;
    if (experience?.exactAccepted) bonus += 0.28;
    if (experience?.reusablePatternId) bonus += 0.18;
    if (experience?.bestSimilarAccepted) bonus += 0.1 * experience.bestSimilarAccepted.similarity;
    if (experience?.bestSimilarRejected) bonus -= 0.12 * experience.bestSimilarRejected.similarity;
    if (experience?.exactRejected) bonus -= 0.8;
    return {
      cardName: card.cardName,
      category: card.category,
      renderability: card.renderability,
      adapterId: adapter?.id ?? null,
      component: adapter?.component ?? null,
      score: Number(clamp(base + bonus).toFixed(6)),
      scoreBreakdown: {
        semanticIntent: Number(intentScore(inferredIntents, card.semanticIntents).toFixed(4)),
        lexical: Number(overlapScore(queryTokens, card.semanticTokens, weights).toFixed(4)),
        material: Number(materialScore(context.materialClass, card).toFixed(4)),
        mainVisual: visual,
        energy: Number(energyScore(beat.energy ?? 'medium', card.energy).toFixed(4)),
        duration: Number(durationScore(seconds, card, adapter).toFixed(4)),
        experienceBonus: Number(bonus.toFixed(4)),
      },
      requirementsMet: requirementsMet(card, beat),
      contextCompatible: visual === 1,
      experience: experience ? {
        exactAccepted: experience.exactAccepted,
        exactRejected: experience.exactRejected,
        exactCaseId: experience.exactCaseId,
        reusablePatternId: experience.reusablePatternId,
        similarAcceptedCaseId: experience.bestSimilarAccepted?.entry.caseId ?? null,
        staleCaseIds: experience.staleCaseIds,
      } : null,
      context,
    };
  }).sort((a, b) => b.score - a.score || a.cardName.localeCompare(b.cardName, 'en'));
}

const summarizeCandidate = (candidate) => ({
  cardName: candidate.cardName,
  category: candidate.category,
  renderability: candidate.renderability,
  adapterId: candidate.adapterId,
  score: candidate.score,
  scoreBreakdown: candidate.scoreBreakdown,
  experience: candidate.experience,
});

export function matchDirectorEffects({request, captions, index, registry, ledger}) {
  const weights = idfMap(index);
  const matches = [];
  const selectionBeats = [];
  for (const rawBeat of request.beats) {
    const beat = {...rawBeat, fps: request.canvas.fps};
    if (!ELIGIBLE_MAIN_VISUALS.has(beat.mainVisual)) {
      const reason = beat.mainVisual === 'paper-editorial'
        ? '本段由纸艺主画面完整承担机制解释，禁止再叠加 Shotcraft 信息层'
        : '本段由生成视频承担完整情景演绎，禁止再叠加 Shotcraft 信息层';
      selectionBeats.push({beatId: beat.beatId, mainVisual: beat.mainVisual, frames: beat.frames, decision: 'not-needed', reason});
      matches.push({beatId: beat.beatId, decision: 'not-needed', reason, rankedCandidates: [], adaptationCandidates: []});
      continue;
    }

    const ranked = scoreCards({
      beat,
      index,
      registry,
      ledger,
      componentSha256: request.componentModule.sha256,
      registrySha256: request.registry.sha256,
      weights,
    });
    const topOverall = ranked.find((candidate) => candidate.contextCompatible && candidate.requirementsMet) ?? null;
    const topRenderable = ranked.find((candidate) => candidate.renderability === 'candidate-renderable' && candidate.contextCompatible && candidate.requirementsMet && !candidate.experience?.exactRejected) ?? null;
    const adaptationCandidates = ranked.filter((candidate) => candidate.renderability === 'adaptation-required' && candidate.contextCompatible).slice(0, 3).map(summarizeCandidate);
    const threshold = beat.existingVisualSufficiency === 'high' ? 0.7 : 0.58;
    const semanticGap = topOverall && topRenderable && topOverall.renderability === 'adaptation-required' ? topOverall.score - topRenderable.score : 0;
    const validatedReuse = topRenderable?.experience?.exactAccepted || topRenderable?.experience?.reusablePatternId;
    const maximumSemanticGap = validatedReuse ? 0.12 : 0.06;
    const canApply = topRenderable && topRenderable.score >= threshold && semanticGap <= maximumSemanticGap;

    if (!canApply) {
      const reason = topOverall?.renderability === 'adaptation-required' && topOverall.score >= threshold
        ? `最匹配卡片 ${topOverall.cardName} 尚未完成本地适配，保留当前主画面并进入适配候选，避免用低相关效果替代`
        : '本段没有达到可执行组件的语义匹配阈值，保留真人或真实素材以避免错配';
      selectionBeats.push({beatId: beat.beatId, mainVisual: beat.mainVisual, frames: beat.frames, decision: 'not-needed', reason});
      matches.push({beatId: beat.beatId, decision: 'not-needed', reason, threshold, maximumSemanticGap, semanticGap: Number(semanticGap.toFixed(6)), rankedCandidates: ranked.slice(0, 5).map(summarizeCandidate), adaptationCandidates});
      continue;
    }

    const effect = registry.effects.find((item) => item.id === topRenderable.adapterId);
    const context = topRenderable.context;
    const origin = topRenderable.experience?.exactAccepted
      ? 'validated-case'
      : topRenderable.experience?.reusablePatternId
        ? 'reusable-pattern'
        : 'catalog-match';
    const selectionBeat = {
      beatId: beat.beatId,
      mainVisual: beat.mainVisual,
      frames: beat.frames,
      decision: 'apply',
      effectId: effect.id,
      purpose: beat.purpose ?? `用 ${effect.name} 帮助观众读懂本段实录重点`,
      quote: beat.quote,
      texts: beat.keyPhrases,
      region: beat.region,
      protectedRegions: beat.protectedRegions,
      fallback: 'blocked',
      sourceCard: {cardName: topRenderable.cardName, category: topRenderable.category},
      matchContext: {...context, fingerprint: contextFingerprint(context), origin},
      componentProps: buildComponentProps(effect.id, beat, request.canvas.fps),
    };
    if (beat.evidence) selectionBeat.evidence = beat.evidence;
    selectionBeats.push(selectionBeat);
    matches.push({
      beatId: beat.beatId,
      decision: 'apply',
      effectId: effect.id,
      cardName: topRenderable.cardName,
      component: effect.component,
      origin,
      confidence: topRenderable.score,
      threshold,
      maximumSemanticGap,
      semanticGap: Number(semanticGap.toFixed(6)),
      rankedCandidates: ranked.slice(0, 5).map(summarizeCandidate),
      adaptationCandidates,
      staleExperienceCaseIds: topRenderable.experience?.staleCaseIds ?? [],
    });
  }

  const selection = {
    schemaVersion: 'koubo-shotcraft-director-selection/v1',
    taskId: request.taskId,
    revisionId: request.revisionId,
    directorProfile: V91_DIRECTOR_PROFILE,
    subtitleAuthority: 'actual-recording',
    registry: request.registry,
    captions: request.captions,
    canvas: request.canvas,
    beats: selectionBeats,
  };
  return {
    selection,
    matches,
    summary: {
      analyzedCardCount: index.stats.cardCount,
      candidateRenderableCardCount: index.stats.candidateRenderableCount,
      adaptationRequiredCardCount: index.stats.adaptationRequiredCount,
      applyCount: selectionBeats.filter((beat) => beat.decision === 'apply').length,
      notNeededCount: selectionBeats.filter((beat) => beat.decision === 'not-needed').length,
      adaptationQueue: uniqueSorted(matches.flatMap((match) => match.adaptationCandidates.map((candidate) => candidate.cardName))),
    },
  };
}
