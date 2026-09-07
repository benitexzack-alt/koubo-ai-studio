import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const read = (name) => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
const sha = (name) => crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, name))).digest('hex');
const write = (name, value) => fs.writeFileSync(path.join(dir, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
const originalHashes = {
  'host_16k.wav': '5ebf79c578ba8941ab692c34e64d6ca84144ad80bec01f59dd492c38aac06add',
  'host_whisper_small_raw_v1.json': 'd319e760846b810fff4b507d47daa49c1c8dcb77f88ea0d5cf32c066784e99ed',
  'host_whisper_small_raw_v1.txt': '9cca0d0561fcf2aaeafd3cae6202ba6327966b7a911d6010bd62cac79a4e9e22',
  'host_whisper_small_raw_v1.srt': 'bb7b47669c16f7e02fe9bd30e461705de4d624a544d71e019f637b590cc1a38f',
};
for (const [name, hash] of Object.entries(originalHashes)) assert.equal(sha(name), hash, `原始文件发生变化: ${name}`);
const baselineName = 'host_whisper_small_raw_v1.json';
const baseline = read(baselineName);
const runs = read('asr-review-runs.v1.json');
const sourceOffsets = Object.fromEntries(runs.runs.map((r) => [path.basename(r.jsonPath), r.sourceStartMs]));
const filenames = [baselineName, 'asr_review_base_terms_v1.json', 'asr_review_small_terms_v1.json', ...Object.keys(sourceOffsets)];
const evidenceFiles = Object.fromEntries(filenames.map((name) => [name, read(name)]));
const fullSmall = 'asr_review_small_terms_v1.json';
const fullBase = 'asr_review_base_terms_v1.json';
const focus = (name) => `asr_review_focus_${name}_v1.json`;
const clean = (text) => text.replace(/[\s，。？！、：；,.?!:;“”"‘’'（）()【】\[\]]/gu, '');

const correctionPlan = [
  [2, '货客', '获客', '术语正字候选', '三次识别保留 huoke 音近写法，父任务将该词列为疑似识别错误；获客为上下文正字候选，不是用户逐项听验或确认的结论。', [fullBase, fullSmall, focus('opening')]],
  [3, '手花', '少花', '近音错字候选', '多模型仍写手花，父任务将该词列为疑似识别错误；少花点时间是上下文候选，尚无用户逐项听验，仍须听原声核定。', [fullBase, fullSmall, focus('opening')]],
  [4, '资讯', '咨询', '同音正字候选', '该时段局部模型识别为资寻，客户提问语境支持咨询；不是依照预拍稿。', [fullBase, fullSmall, focus('opening')]],
  [8, '既有', 'GEO', '专有名词拼写候选', '本句模型仍为既有；父任务将该词列为疑似识别错误，后文同一服务被独立识别为GEO/Gio。GEO为术语上下文候选，不是用户逐项听验；早段读法仍单列待核。', [fullBase, fullSmall, focus('opening')]],
  [11, '激烈', '积累', '模型对照错字修正', '带限定术语的small全文将同一时段识别为积累；术语提示未含该词。保留前面的的字和连接词。', [fullSmall]],
  [25, '工薪部', '工信部', '专有名词拼写', '限定术语small全文在同一时段识别为工信部；提示影响已明示，未核验通知事实。', [fullSmall]],
  [40, '设计', '涉及', '模型对照错字修正', 'base和限定术语small全文均识别为涉及。', [fullBase, fullSmall]],
  [46, '其AI', '企业AI', '局部模型补字候选', '129秒起的局部音频识别为企业AI培训和陪跑；全文识别仅其AI，差异仍待听验。', [focus('training'), fullSmall]],
  [49, '资讯', '咨询', '同音正字', '局部模型同一时段输出整理一次咨询。', [focus('training')]],
  [60, 'GO', 'GEO', '专有名词拼写', 'small全文同一时段输出GEO，base输出Gio；仅统一术语拼写。', [fullSmall, fullBase]],
  [68, '资讯', '咨询', '同音正字', '限定术语small同一时段输出繁体諮詢，按简体字幕写咨询。', [fullSmall]],
  [71, '他', '它', '同音正字', 'small同一时段为它有机会，指代前文AI，不改变音节。', [fullSmall]],
  [73, '带跟进', '待跟进', '同音正字候选', '带/待同音；根据列出事项的实录上下文选择待，模型并未输出待，不宣称模型证实。', [fullSmall, fullBase]],
  [75, '出流', '处理', '模型对照错字修正', 'base与限定术语small全文同一时段均输出处理。', [fullBase, fullSmall]],
  [77, '退到', '推倒', '模型对照错字修正', 'base与限定术语small全文同一时段均输出推倒。', [fullBase, fullSmall]],
];

const uncertaintyPlan = [
  ['U01', [6], '今年', ['今天'], '全文small为今年，base和开头局部为今天；保留原识别今年。'],
  ['U02', [11], '经验的也还在积累', ['经验呢也还在积累', '经验也还在积累'], '连接词有分歧；只修正取得模型支持的积累，的不擅自删改。'],
  ['U03', [18], '经理', ['经营'], 'base全文为经营，small全文与局部均为经理；保留经理，不凭顺口替换。'],
  ['U04', [36], '整理已经企业知识', ['整理进去的企业知识库', '整理性企业之手', '整理已经企业之手'], '识别未收敛，涉及实质正文；保留原始候选，不补进、的或库。'],
  ['U05', [86], '时间过的方法', ['实践过的方法'], '所有本地识别均为时间过；实践过只是上下文疑问，没有模型支持，未应用。'],
  ['U06', [2], '获客', ['货客', '或客'], '正字候选，模型未直接识别为获客；需对照原声确认。'],
  ['U07', [3], '少花', ['手花'], '多轮识别仍为手花；少花仅为父任务疑点提醒后的上下文暂定候选，不代表用户逐项听验或确认。'],
  ['U08', [4], '咨询', ['资讯', '资寻'], '同音词的文字选择来自上下文，需用户确认所指是客户咨询。'],
  ['U09', [8], 'GEO', ['既有'], '早段缩略词始终被识别为既有；后文术语证据不能代替本时点听验。'],
  ['U10', [46], '企业AI', ['其AI', '且AI'], '局部模型识别出企业AI，全文模型存在缺字；补字候选待核。'],
  ['U11', [43], '就到员工手里以后', ['交到员工手里以后'], '模型一致为就到，疑似口语或近音；不凭语法改成交到。'],
  ['U12', [24], '这些活', ['这些活儿'], '限定术语small多一个儿，其他全文无；保留原识别，不主动增减儿化。'],
  ['U13', [73], '待跟进', ['带跟进'], '仅上下文同音正字，不是声音确认。'],
];

function getEvidence(name, startMs, endMs) {
  const offset = sourceOffsets[name] ?? 0;
  const segments = evidenceFiles[name].transcription.flatMap((s, i) => {
    const start = s.offsets.from + offset;
    const end = s.offsets.to + offset;
    return start < endMs && end > startMs ? [{segmentIndex: i, localStartMs: s.offsets.from, localEndMs: s.offsets.to, sourceStartMs: start, sourceEndMs: end, text: s.text}] : [];
  });
  return {file: path.join(dir, name), sha256: sha(name), sourceOffsetMs: offset, segments};
}

const words = [];
const segments = [];
const corrections = [];
for (const [segmentIndex, segment] of baseline.transcription.entries()) {
  let cursor = 0;
  const units = segment.tokens.flatMap((token, tokenIndex) => {
    if (token.id >= 50257) return [];
    const start = cursor;
    cursor += token.text.length;
    return [{text: token.text, rawText: token.text, charStart: start, charEnd: cursor, startMs: token.offsets.from, endMs: token.offsets.to, sourceTokens: [{segmentIndex, tokenIndex, tokenId: token.id, text: token.text, startMs: token.offsets.from, endMs: token.offsets.to, probability: token.p}], correctionIds: []}];
  });
  assert.equal(units.map((w) => w.text).join(''), segment.text);
  for (const [s, from, to, type, reason, sources] of correctionPlan.filter((c) => c[0] === segmentIndex)) {
    const fromIndex = segment.text.indexOf(from);
    assert(fromIndex >= 0 && segment.text.lastIndexOf(from) === fromIndex);
    const toIndex = fromIndex + from.length;
    const first = units.findIndex((w) => w.charEnd > fromIndex);
    const last = units.findLastIndex((w) => w.charStart < toIndex);
    const selected = units.slice(first, last + 1);
    const rawText = selected.map((w) => w.rawText).join('');
    const text = rawText.slice(0, fromIndex - selected[0].charStart) + to + rawText.slice(toIndex - selected[0].charStart);
    const startMs = Math.min(...selected.map((w) => w.startMs));
    const endMs = Math.max(...selected.map((w) => w.endMs));
    const id = `C${String(corrections.length + 1).padStart(2, '0')}`;
    const sourceTokens = selected.flatMap((w) => w.sourceTokens);
    units.splice(first, selected.length, {text, rawText, charStart: selected[0].charStart, charEnd: selected.at(-1).charEnd, startMs, endMs, sourceTokens, correctionIds: [id]});
    corrections.push({id, segmentIndex: s, from, to, type, startMs, endMs, status: 'candidate-not-human-verified', reason, audioEvidence: {file: path.join(dir, 'host_16k.wav'), sha256: originalHashes['host_16k.wav'], startMs, endMs, humanListeningPerformed: false}, originalEvidence: getEvidence(baselineName, segment.offsets.from, segment.offsets.to), comparisonEvidence: sources.map((name) => getEvidence(name, segment.offsets.from, segment.offsets.to)), timingMethod: '沿用覆盖原识别的真实ASR词元时间包络；不拆分替换文字，不按字数分摊。'});
  }
  const startWordIndex = words.length;
  for (const unit of units) {
    words.push({id: `w${String(words.length + 1).padStart(4, '0')}`, text: unit.text, raw_text: unit.rawText, startMs: unit.startMs, endMs: unit.endMs, start: unit.startMs / 1000, end: unit.endMs / 1000, sourceSegmentIndex: segmentIndex, sourceFile: path.join(dir, baselineName), sourceTokenReferences: unit.sourceTokens, correctionIds: unit.correctionIds, timingPrecision: unit.sourceTokens.length === 1 ? 'asr-token-estimate' : 'asr-token-span-estimate', timingResolutionMs: 10, timingAccuracyMs: null, zeroDurationFromASR: unit.endMs === unit.startMs});
  }
  segments.push({segmentIndex, startMs: segment.offsets.from, endMs: segment.offsets.to, rawText: segment.text, text: units.map((w) => w.text).join(''), startWordIndex, endWordIndex: words.length - 1});
}

const uncertainty = uncertaintyPlan.map(([id, indexes, retained, alternatives, reason]) => {
  const selected = segments.filter((s) => indexes.includes(s.segmentIndex));
  const startMs = Math.min(...selected.map((s) => s.startMs));
  const endMs = Math.max(...selected.map((s) => s.endMs));
  return {id, sourceSegmentIndices: indexes, startMs, endMs, retained, alternatives, reason, status: 'needs-user-audio-review', humanListeningPerformed: false, evidence: filenames.map((name) => getEvidence(name, startMs, endMs)).filter((e) => e.segments.length > 0)};
});

if (process.argv.includes('--inspect-words')) {
  console.log(JSON.stringify(words.map((w) => w.text)));
  process.exit(0);
}
if (process.argv.includes('--inspect')) {
  console.log(segments.map((s) => `${s.segmentIndex}\t${s.text}`).join('\n'));
  process.exit(0);
}

const pages = read('actual-caption-plan.v1.json');
assert.equal(clean(pages.map((p) => p.zh).join('')), clean(words.map((w) => w.text).join('')), '分页不得删改实录文字');
let wordCursor = 0;
const captions = pages.map((page, i) => {
  let text = '';
  const selected = [];
  const target = clean(page.zh);
  while (text.length < target.length) {
    const word = words[wordCursor++];
    assert(word, '字幕页超出识别词元');
    selected.push(word);
    text += clean(word.text);
  }
  assert.equal(text, target, `第${i + 1}页必须在真实ASR词元或替换词元组边界分页`);
  const startMs = Math.min(...selected.map((w) => w.startMs));
  const endMs = Math.max(...selected.map((w) => w.endMs));
  assert(endMs > startMs && startMs >= 0 && endMs <= 271633.333);
  const uncertainIds = uncertainty.filter((u) => selected.some((w) => u.sourceSegmentIndices.includes(w.sourceSegmentIndex))).map((u) => u.id);
  return {id: `c${String(i + 1).padStart(3, '0')}`, startMs, endMs, zh: page.zh, en: page.en, wordIds: selected.map((w) => w.id), timingPrecision: 'asr-token-boundary-estimate', uncertainIds, reviewRequired: uncertainIds.length > 0, paginationNote: clean(page.zh).length < 18 ? page.shortPageReason : null};
});
assert.equal(wordCursor, words.length);
for (const c of captions) {
  assert(clean(c.zh).length <= 24, `字幕超过24字: ${c.id}`);
  assert(c.en.trim(), `英文缺失: ${c.id}`);
  if (clean(c.zh).length < 18) assert(c.paginationNote, `短页缺少语义理由: ${c.id}`);
}
for (let i = 1; i < captions.length; i++) assert(captions[i].startMs >= captions[i - 1].endMs, `分页时间重叠: ${captions[i].id}`);
assert.equal(captions.at(-1).zh.replace(/[。！]$/, ''), '可以来找我');
assert.equal(words.map((w) => w.raw_text).join(''), baseline.transcription.map((s) => s.text).join(''), '原识别文字必须完整可恢复');
const source = {audioPath: path.join(dir, 'host_16k.wav'), audioSha256: originalHashes['host_16k.wav'], baselineASRPath: path.join(dir, baselineName), baselineASRSha256: originalHashes[baselineName], recordingDurationMs: 271633.333, recordingDurationEvidence: '父任务提供271.633333秒；本子任务未重新读取原视频', audioDurationMs: 271625.563, audioDurationEvidence: '本轮ffprobe读取16kHz单声道PCM文件', audioVideoDurationDifferenceMs: 7.770, originOffsetMs: 0};
const common = {schemaVersion: 1, taskId: '20260906_lanzhou_ai_services', createdAt: new Date().toISOString(), status: 'needs-user-audio-review', permittedUse: 'local-low-resolution-candidate-only', formalAllowed: false, canonicalSource: 'recorded-audio', scriptRole: 'comparison-only', preshootScriptReadInThisSubtask: false, captionTextPolicy: 'spoken-verbatim-candidate-with-explicit-asr-corrections', englishTranslationSource: 'canonical-spoken-chinese', source, humanListeningPerformed: false, audioPerceptionPerformed: false, userAudioReviewConfirmed: false, reviewPath: path.join(dir, 'transcription-review.v1.json')};
const timing = {unit: 'milliseconds', resolutionMs: 10, measuredAccuracyMs: null, phonemeLevel: false, characterProportionalTimingUsed: false, wordUnit: '原始ASR词元；更正覆盖多个词元时作为整体时间包络，不宣称自然词或音素级精度。', zeroDurationPolicy: '保留原模型零时长词元；字幕页使用整页词元的最小起点和最大终点，不补造单词时长。', sourceAlignment: '原音频连续时基，无剪辑、变速或长度比例映射。'};
const canonical = {...common, timing, captions: captions.map(({en, ...c}) => c), words, segments, uncertainCaptionIds: captions.filter((c) => c.reviewRequired).map((c) => c.id)};
const bilingual = {...common, timing, translationStatus: 'candidate-translation-from-provisional-spoken-chinese', translationNote: '英文由本轮助手仅依据本文件中文翻译；未决实质文字以unclear wording显式保留，不从预拍稿恢复内容。', captions};
const verification = {schemaVersion: 1, result: 'structural-checks-only', audioFidelityStatus: 'not-verified', originalFilesUnchanged: true, originalHashes, exactCaptionWordTextMatch: true, originalASRRecoverableFromWords: true, bilingualIdsAndTimingMatch: true, captionsCount: captions.length, wordsCount: words.length, correctionsCount: corrections.length, uncertainItemsCount: uncertainty.length, uncertainCaptionsCount: captions.filter((c) => c.reviewRequired).length, maxCaptionCharactersExcludingPunctuation: Math.max(...captions.map((c) => clean(c.zh).length)), shortCaptionIds: captions.filter((c) => clean(c.zh).length < 18).map((c) => c.id), zeroDurationASRUnits: words.filter((w) => w.zeroDurationFromASR).length, negativeOrReversedWordSpans: words.filter((w) => w.startMs < 0 || w.endMs < w.startMs).length, lastSpokenText: captions.at(-1).zh, lastCaptionEndMs: captions.at(-1).endMs, noScriptTailAdded: true, noHumanListeningClaim: true, strictSpokenSourcePolicyCheckerRun: false, strictCheckerNotRunReason: '尚有正文疑点且未人工听验，不制造compliance.status=passed来运行严格发布门禁。'};
const report = {...common, scope: {writeDirectory: dir, networkUsed: false, paidServicesUsed: false, formalRendered: false, gitCommitPerformed: false, originalAudioModified: false}, timing, verification, corrections, uncertain: uncertainty.map((u) => ({...u, captionIds: captions.filter((c) => c.uncertainIds.includes(u.id)).map((c) => c.id)})), punctuationAndPagination: '仅增补阅读标点并在真实ASR词元边界合并或分页，未将分页断句当作音频删改。', preservedNonstandardSpeech: ['今年开始学习和实践了AI', '经验的也还在积累', '员工提问时让AI去把这些资料里找相关的一些内容整理成答复', '就到员工手里以后', '会越来越贴近这些日常生活', '我把我自己学到的和时间过的方法拿出来', '员工正在用AI', '可以来找我'], fullPassRuns: [{file: path.join(dir, fullBase), model: '/Users/pc/.cache/whisper-cpp/ggml-base.bin', prompt: '兰州，企业AI，GEO，工信部，知识库', carryInitialPrompt: false, outputSha256: sha(fullBase), exitCode: 0}, {file: path.join(dir, fullSmall), model: '/Users/pc/.cache/whisper-cpp/ggml-small.bin', prompt: '兰州，企业AI，GEO，工信部，知识库', carryInitialPrompt: true, outputSha256: sha(fullSmall), exitCode: 0}], focusedRunsReceipt: path.join(dir, 'asr-review-runs.v1.json'), limitations: ['没有人工或模型音频感知听验，只进行了本地ASR交叉识别和文字证据复核。', '同一家族模型可能共有同一种识别偏差；一致结果也不等于已确认实际说法。', '术语提示仅使用父任务限定的五项；这不是用户对词语的逐项听验或确认，没有向模型输入预拍稿或整篇文本。', '英文基于尚有疑点的中文候选，不能视为正式可发布译文。', '本报告只证明文件内部一致和来源可追踪，不能证明字幕跟嘴、音素时间或整段语音准确。'], nextGate: '用户对uncertain时段听原声核验；父任务保留低清候选限制，不得升级formal或passed。'};
write('canonical-spoken.v1.json', canonical);
write('actual-bilingual.v1.json', bilingual);
write('actual-spoken.v1.txt', captions.map((c) => c.zh).join('\n') + '\n');
write('actual-spoken.review-marked.v1.txt', '实录识别候选；待核编号不是说话内容，不得当字幕正文导入。\n\n' + captions.map((c) => `${c.zh}${c.uncertainIds.length ? ` 〔待核：${c.uncertainIds.join('、')}〕` : ''}`).join('\n') + '\n');
write('transcription-review.v1.json', report);
write('transcription-validation.v1.json', verification);
console.log(JSON.stringify(verification, null, 2));
