import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(dir, '../../../..');
const project = path.resolve(dir, '..');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sha256Json = (value) => crypto.createHash('sha256').update(`${JSON.stringify(value, null, 2)}\n`).digest('hex');
const rel = (file) => path.relative(projectRoot, file);
const writeNew = (name, value) => fs.writeFileSync(
  path.join(dir, name),
  typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`,
  {encoding: 'utf8', flag: 'wx', mode: 0o600},
);
const clean = (text) => String(text).replace(/[\s，。？！、：；,.?!:;“”"‘’'（）()【】\[\]《》]/gu, '');

const files = {
  recordedMedia: path.join(project, '01_原始口播/copy_B71E2E7B-29AC-4653-AC9C-9D4A3C3D3AB6.MOV'),
  audio: path.join(dir, 'host_16k.v1.wav'),
  small: path.join(dir, 'host_whisper_small_raw_v1.json'),
  base: path.join(dir, 'host_whisper_base_raw_v1.json'),
  focusB04: path.join(dir, 'focus_b04_v1.json'),
  focusB10: path.join(dir, 'focus_b10_v1.json'),
  focusB11B12: path.join(dir, 'focus_b11_b12_v1.json'),
  focusB16B17: path.join(dir, 'focus_b16_b17_v1.json'),
  focusB19B20: path.join(dir, 'focus_b19_b20_v1.json'),
  focusB22: path.join(dir, 'focus_b22_v1.json'),
  script: path.join(project, '00_文稿与控制/用户确认原稿.txt'),
  preproductionPlan: path.join(project, '03_导演拆解/paper-v9.1-r4/director-plan.v1.json'),
};

const expectedHashes = {
  recordedMedia: 'f5469a24278c333c00b4517c853958954a09cce8772a86231197e1966647d98f',
  audio: 'ed43138c0994bc5ddae1c6772f67041a204361da5f9607a3301a81b43cd24f7f',
  small: '27a28f5c5b735f4e9b8fde74ac4fa877e771435579a83b0ac6593b064b6c909b',
  base: '4e20f8df8cb62b1eecf494f79d8be17299ef599f1a6a2d7f1da9664ed6dbc184',
  focusB04: 'b4b8622f1560a9e7456ea245e45ece2d184d075f7f3da48cfc9c7018dfa451e6',
  focusB10: '26ba3496a6a4d9648c2159882adb11b486f094f0964b0426845a5efdc02b2370',
  focusB11B12: '94c573c1bcdc644b2a9f5179d9cfe8f003a5077dc2455b15363c102e8248eadb',
  focusB16B17: '9c27bee87b30bfbdb1ca60de1aa5e06f7e83d97824dbf4c0e8c9f8e80f6eca7a',
  focusB19B20: 'a88a06c73aa14db04eb535dfc52244394da0404aa6c2b7f5cc3cb186da99facd',
  focusB22: 'c925299a5a4d08dc178faa887e53fdb6a7fb1f0f9b2aa968ab5a84bc121c9083',
  script: 'c1ebc6f3f9f82a405a1c7c7564097a62585601c31b3ee17edd07334695dcb3b9',
  preproductionPlan: '46efff271cccf4cb145bf8d50f0aaab65d8365bb90d757abe66260757bf7058a',
};
for (const [key, expected] of Object.entries(expectedHashes)) {
  assert.equal(sha256(files[key]), expected, `输入发生变化：${key}`);
}

const small = readJson(files.small);
const base = readJson(files.base);
const preproduction = readJson(files.preproductionPlan);
const scriptLines = fs.readFileSync(files.script, 'utf8').split(/\r?\n/u).filter(Boolean);
assert.equal(small.transcription.length, 96);
assert.equal(base.transcription.length, 138);
assert.equal(preproduction.beats.length, 22);
assert.equal(scriptLines.length, 22);
assert.deepEqual(
  preproduction.beats.map((beat) => beat.spokenLine),
  scriptLines,
  '预拍导演计划与用户确认原稿不一致',
);

const beatSpecs = [
  ['B01', 0, 0, 3_200, 'AI将成为普通人的最后一次创业风口。'],
  ['B02', 1, 3, 14_300, '我看好的是，在兰州这个三线城市，用自己熟悉的行业加上AI，就是降维打击，既能服务本地，也能尝试接外地的业务。'],
  ['B03', 4, 7, 24_500, '你以前干过什么，帮别人做到了哪一步，这些差别到AI这里不会自动消失，收入上的差距反而可能因此拉开。'],
  ['B04', 8, 12, 40_300, '所以，我以前做过销售、开过店，或者是在一个行业里面干了很多年，别觉得学AI了就要把这些全扔掉，从头转行。我对客户的了解，恰恰可能派上用场。'],
  ['B05', 13, 15, 52_100, '咱们就帮本地的老板做内容来说。你让AI写一句“品质好、服务好”，谁都能写。客户看完，还是不知道为什么选这家。'],
  ['B06', 16, 19, 66_000, '但老板平时怎么回答客户，他手里有哪些东西。为什么价格不一样，什么人适合这个产品，哪些要求确实做不到。这些问题，他可能已经解释过了很多遍。'],
  ['B07', 20, 25, 85_900, '你可以帮他把这些回答收集起来，用AI归类、理顺，然后改成适合拍视频的文稿，再由老板核对。配上能公开的产品和服务资料，一条条的讲出去。AI承担整理和制作的部分工作，内容的底子还是老板自己做过的生意。'],
  ['B08', 26, 28, 97_900, '以前这些经验，可能只有进过店、跟他聊过的客户才知道。现在有机会让没有来过的人也看到，搜相关问题的时候，也能找到他的介绍。'],
  ['B09', 29, 34, 114_000, '这种内容不一定每条都要追着爆。一个本地客户，先看懂的是你的产品，再看见你怎么处理问题，慢慢的对你有了印象。等他真有需要的时候，你才有机会进去他的选择。'],
  ['B10', 35, 40, 137_000, '这既是老板可以尝试的内容做法，也是懂这个行业的人留出了一种服务机会。你帮他把经验讲清楚，持续做成内容，省下他自己摸索和制作的功夫。但他本身没有能交给客户的产品和服务，光发内容也接不住生意。'],
  ['B11', 41, 44, 148_000, '如果你能听懂一个行业的问题，也能把约定的工作做好，就可以试着把这项服务介绍给外地同行。同样需要整理客户问题、制作产品内容的人。'],
  ['B12', 45, 50, 165_000, '远程接业务早就有了，不是AI才发明的。AI增加的可能性是帮一个人、一个小团队，多承担一些过去做不过来的整理和制作工作。至于客户怎么找到你，为什么信你，还得靠你自己的作品和服务。'],
  ['B13', 51, 53, 177_000, '这么一想，留在兰州就不止有“本地能给我多少岗位”这一个问题了。还可以想，我会做的这些事，外地有没有人需要？'],
  ['B14', 54, 59, 199_000, '如果你的住处、生活已经在这里了，留在本地能少一些搬迁和生活开支，那省下来的钱，就能给找客户、改作品、磨合服务多留一点时间。很多事情要做了、改了，才知道适合不适合继续。刚开始没有结果的时候，手里还有没有余地，很重要。'],
  ['B15', 60, 64, 218_000, '我自己学AI，课程、会员、调用费用，做图、做视频的成本都要花。做出来不适合，还得继续改。所以我不会把这条路讲成一台电脑、零成本创业。钱花的少一些，只是让你有机会多试几次。'],
  ['B16', 65, 65, 222_000, '客户如果自己也会用AI了，他还需要你做什么？'],
  ['B17', 66, 71, 245_000, '你得听懂老板说的麻烦，不能他一说生意不好，你就给他生成一份通用方案。AI给出的内容，也得看得出哪里不符合实际。到了收服务费的时候，还要把做哪些工作、谁配合、交什么东西讲清楚。客户拿到以后用不上，你得继续查问题。'],
  ['B18', 72, 75, 262_000, '而且，工具越来越容易用，只靠生成几段文字、几张图片收费，以后可能更难。老板自己也能试。你得比他自己试，多承担一些他没时间做、不会检查、没有办法持续做下去的工作。'],
  ['B19', 76, 79, 278_000, '咱们在本地可以去店里聊，看看他们平时到底怎么干。把这些情况问明白，才知道网上那些通用方案，哪些地方在这家店根本用不了。能不能帮上忙，得按照实际情况改。'],
  ['B20', 80, 83, 295_000, '我已经做过企业AI应用和GEO的付费项目，也做过交付。这是我愿意继续做下去的一个原因。但有个交付，不等于生意已经做完了。接下来就是服务怎么做好，客户能不能持续用，还得下工夫。'],
  ['B21', 84, 87, 311_000, '你有工作，就先在熟悉的业务里面。你已经做着生意，可以看看哪些经验还没让客户知道。完全没接触过一个行业的人，先去了解实际工作，别因为AI能给方案，就着急给老板当顾问。'],
  ['B22', 88, 95, 336_280, '我选择留在兰州做这件事。把本地企业的问题弄明白，把自己能承担的工作做好，再去争取更多的客户。咱们兰州的老板，需要做企业AI应用，可以来找我，带着实际碰到的问题，咱们聊一聊。我能参与哪一段，哪些还做不了，咱们当面说清楚。我是超哥，在兰州AI创业。'],
];

const corrections = [
  ['C01', 'B01', '创业封口', '创业风口', '同音正字；base 全量识别为“创业风口”。'],
  ['C02', 'B02', '将为打击', '降维打击', '领域词正字；small/base 原始结果均为近音误识别。'],
  ['C03', 'B02', '技能服务', '既能服务', '同音正字；与本句并列结构一致。'],
  ['C04', 'B04', '权扔掉', '全扔掉', '同音正字；base 识别为“全生掉”，两者均指向“全扔掉”。'],
  ['C05', 'B04', '用程', '用场', '近音正字；三轮识别均落在同一固定搭配。'],
  ['C06', 'B07', 'AI规律理顺', 'AI归类理顺', 'base 与局部上下文支持“归类、理顺”。'],
  ['C07', 'B07', '合对', '核对', '同音正字；所指为老板复核文稿。'],
  ['C08', 'B08', '静国店', '进过店', '近音正字候选；base 为“静过电”，语境支持“进过店”，仍待原声确认。'],
  ['C09', 'B09', '追着报', '追着爆', '同音正字候选；指视频播放表现，仍待原声确认。'],
  ['C10', 'B10', '这即使', '这既是', '同音正字；句法和完整语义一致。'],
  ['C11', 'B11', '外地同好', '外地同行', '近音正字；局部复核仍为同行语境。'],
  ['C12', 'B12', '远程街要不', '远程接业务', '连续近音误识别；base 亦为“皆要不”，上下文明确为远程业务。'],
  ['C13', 'B17', '教什么东西', '交什么东西', 'base 全量识别为“交什么东西”；指交付物。'],
  ['C14', 'B18', '老板自己也能是', '老板自己也能试', '“是/试”同音正字候选；需用户听校。'],
  ['C15', 'B18', '比他自己是', '比他自己试', '“是/试”同音正字候选；需用户听校。'],
  ['C16', 'B21', '交集给老板', '着急给老板', '局部复核识别为“着急给老板”。'],
].map(([id, beatId, from, to, reason]) => ({
  id,
  beatId,
  from,
  to,
  reason,
  status: 'candidate-not-human-verified',
}));

const uncertainties = [
  ['U01', 'B04', '学AI了就要', ['学AI就要', '学AI就得'], 'small 保留“了”，base 未识别“了”，预拍稿为“就得”；不擅自顺句。'],
  ['U02', 'B05', '咱们就帮本地的老板做内容来说', ['咱们就拿帮本地的老板做内容来说'], 'small 全量与局部缺“拿”，base 有“拿”；保留 small 基线。'],
  ['U03', 'B10', '也是懂这个行业的人留出了一种服务机会', ['也给懂这个行业的人留出了一种服务机会'], 'small、base 与局部复核一致缺“给”；保留实际识别的非标准说法。'],
  ['U04', 'B20', '有个交付', ['有过交付'], 'small、base 与局部复核均偏向“有个”，但“个/过”近音，待听原声。'],
  ['U05', 'B20', '生意已经做完了', ['生意已经做稳了', '生意已经做到了'], 'small 对“完了”置信度低，base 为“做到了”，预拍稿为“做稳了”；不以文稿恢复。'],
  ['U06', 'B21', '你有工作就先在熟悉的业务里面', ['你有工作就像在熟悉的业务里面', '你有工作就先在熟悉的业务里练'], 'small 与局部复核为“就先在”，base 为“就像在”，预拍稿多“练”；保留 small 基线。'],
  ['U07', 'B08', '进过店', ['静国店', '静过电'], '按语境做同音正字，尚未真人听校。'],
  ['U08', 'B18', '老板自己也能试；你得比他自己试', ['老板自己也能是；你得比他自己是'], '按上下文修正同音字，尚未真人听校。'],
].map(([id, beatId, retained, alternatives, reason]) => ({
  id,
  beatId,
  retained,
  alternatives,
  reason,
  status: 'needs-user-audio-review',
}));

const correctionsByBeat = new Map();
for (const correction of corrections) {
  if (!correctionsByBeat.has(correction.beatId)) correctionsByBeat.set(correction.beatId, []);
  correctionsByBeat.get(correction.beatId).push(correction);
}

const preBeatById = new Map(preproduction.beats.map((beat) => [beat.id, beat]));
const focusFiles = Object.entries(files)
  .filter(([key]) => key.startsWith('focus'))
  .map(([key, file]) => ({key, path: file, sha256: sha256(file), transcription: readJson(file).transcription}));

const captions = beatSpecs.map(([id, firstIndex, lastIndex, endOverrideMs], order) => {
  const selected = small.transcription.slice(firstIndex, lastIndex + 1);
  assert.equal(selected.length, lastIndex - firstIndex + 1);
  const rawText = selected.map((segment) => segment.text).join('');
  let corrected = rawText;
  for (const correction of correctionsByBeat.get(id) ?? []) {
    assert(corrected.includes(correction.from), `${id} 找不到更正原文：${correction.from}`);
    corrected = corrected.replace(correction.from, correction.to);
  }
  const finalText = beatSpecs[order][4];
  assert.equal(clean(finalText), clean(corrected), `${id} 候选正文不得增删基线实录文字`);
  const startMs = selected[0].offsets.from;
  const endMs = endOverrideMs;
  assert(endMs >= selected.at(-1).offsets.to);
  const baseEvidence = base.transcription.flatMap((segment, index) =>
    segment.offsets.from < endMs && segment.offsets.to > startMs
      ? [{index, startMs: segment.offsets.from, endMs: segment.offsets.to, text: segment.text}]
      : []);
  const focusedEvidence = focusFiles.flatMap((focus) => {
    const hits = focus.transcription.flatMap((segment, index) =>
      segment.offsets.from < endMs && segment.offsets.to > startMs
        ? [{index, startMs: segment.offsets.from, endMs: segment.offsets.to, text: segment.text}]
        : []);
    return hits.length ? [{file: rel(focus.path), sha256: focus.sha256, segments: hits}] : [];
  });
  const pre = preBeatById.get(id);
  const scriptLine = scriptLines[order];
  assert.equal(pre.spokenLine, scriptLine, `${id} 预拍导演计划未绑定用户确认原稿`);
  return {
    id: `cap-${id.toLowerCase()}`,
    beatId: id,
    order: order + 1,
    startMs,
    endMs,
    text: finalText,
    authority: 'recorded-audio-candidate-from-local-asr',
    timingPrecision: 'asr-segment-boundary-estimate',
    sourceSmallSegmentIndices: Array.from({length: selected.length}, (_, offset) => firstIndex + offset),
    rawSmallText: rawText,
    correctionIds: (correctionsByBeat.get(id) ?? []).map((item) => item.id),
    uncertaintyIds: uncertainties.filter((item) => item.beatId === id).map((item) => item.id),
    reviewRequired:
      (correctionsByBeat.get(id) ?? []).some((item) => item.status !== 'human-verified')
      || uncertainties.some((item) => item.beatId === id),
    comparisonOnly: {
      userConfirmedScriptLine: scriptLine,
      preproductionSpokenLine: pre.spokenLine,
      normalizedEqual: clean(scriptLine) === clean(finalText),
    },
    evidence: {
      small: selected.map((segment, offset) => ({
        index: firstIndex + offset,
        startMs: segment.offsets.from,
        endMs: segment.offsets.to,
        text: segment.text,
      })),
      base: baseEvidence,
      focused: focusedEvidence,
    },
  };
});

assert.equal(captions.length, 22);
for (let index = 0; index < captions.length; index += 1) {
  const caption = captions[index];
  assert.equal(caption.order, index + 1);
  assert(caption.endMs > caption.startMs);
  if (index > 0) assert.equal(caption.startMs, captions[index - 1].endMs);
}
assert.equal(captions[0].startMs, 0);
assert.equal(captions.at(-1).endMs, 336_280);

const createdAt = new Date().toISOString();
const common = {
  schemaVersion: 'koubo-authoritative-spoken-timeline-candidate/v1',
  taskId: preproduction.taskId,
  createdAt,
  status: 'needs-user-audio-review',
  formalAllowed: false,
  permittedUse: 'local-low-resolution-candidate-preparation-only',
  authority: 'recorded-audio',
  scriptRole: 'comparison-only',
  humanListeningPerformed: false,
  userAudioReviewConfirmed: false,
  source: {
    recordedMedia: {
      path: rel(files.recordedMedia),
      sha256: sha256(files.recordedMedia),
      durationMs: 336_366.667,
    },
    audio: {path: rel(files.audio), sha256: sha256(files.audio), durationMs: 336_362.813},
    baselineSmall: {path: rel(files.small), sha256: sha256(files.small)},
    comparisonBase: {path: rel(files.base), sha256: sha256(files.base)},
  },
};

const timeline = {
  ...common,
  captionTextPolicy: 'spoken-verbatim-candidate-with-explicit-asr-corrections-and-uncertainties',
  timelineFps: 30,
  captions,
  uncertainCaptionIds: captions.filter((caption) => caption.uncertaintyIds.length > 0).map((caption) => caption.id),
  reviewRequiredCaptionIds: captions.filter((caption) => caption.reviewRequired).map((caption) => caption.id),
};

const review = {
  ...common,
  schemaVersion: 'koubo-transcription-review/v1',
  corrections,
  uncertainties,
  preservedRecordedDifferences: [
    {beatId: 'B03', text: '帮别人做到了哪一步'},
    {beatId: 'B04', text: '我以前做过销售、开过店；我对客户的了解'},
    {beatId: 'B06', text: '他手里有哪些东西'},
    {beatId: 'B09', text: '先看懂的是你的产品'},
    {beatId: 'B10', text: '产品和服务'},
    {beatId: 'B14', text: '适合不适合继续'},
    {beatId: 'B15', text: '成本都要花；做出来不适合'},
    {beatId: 'B16', text: '客户如果自己也会用AI了'},
    {beatId: 'B17', text: '你得继续查问题'},
    {beatId: 'B18', text: '工具越来越容易用；几张图片'},
    {beatId: 'B19', text: '得按照实际情况改'},
    {beatId: 'B20', text: '这是我愿意继续做下去的一个原因'},
    {beatId: 'B22', text: '我选择留在兰州；咱们聊一聊'},
  ],
  limitations: [
    '本轮只有本地 ASR 交叉识别和文本证据复核，没有冒充真人听校。',
    'small 与 base 属于同一家族模型，一致也不等于用户已确认实际说法。',
    '不确定正文必须在正式字幕和正式渲染前由用户听原声确认。',
  ],
  nextGate: 'user-audio-review-before-formal-subtitles',
};

const comparison = {
  schemaVersion: 'koubo-script-recording-comparison/v1',
  taskId: preproduction.taskId,
  createdAt,
  status: 'comparison-only-not-authority',
  formalAllowed: false,
  script: {path: rel(files.script), sha256: sha256(files.script), role: 'comparison-only'},
  recordingTimeline: {
    path: rel(path.join(dir, 'spoken-timeline.candidate.v1.json')),
    sha256: sha256Json(timeline),
    role: 'recorded-audio-candidate-authority',
  },
  beats: captions.map((caption) => ({
    beatId: caption.beatId,
    recordedCandidate: caption.text,
    preproductionScript: caption.comparisonOnly.userConfirmedScriptLine,
    normalizedEqual: caption.comparisonOnly.normalizedEqual,
    decision: caption.comparisonOnly.normalizedEqual ? 'same-after-punctuation' : 'keep-recorded-candidate-pending-audio-review',
  })),
};

const validation = {
  schemaVersion: 'koubo-spoken-timeline-structural-validation/v1',
  taskId: preproduction.taskId,
  createdAt,
  result: 'structural-checks-passed-audio-fidelity-not-human-verified',
  formalAllowed: false,
  checks: {
    sourceHashesCurrent: true,
    recordedMediaHashCurrent: true,
    focusedB10HashCurrent: true,
    preproductionPlanHashCurrent: true,
    userConfirmedScriptMatchesPreproductionPlan: true,
    twentyTwoOrderedBeatCaptions: true,
    timelineContinuousFromZeroToLastSpeech: true,
    correctedTextExactlyRecoverableFromSmallBaseline: true,
    preproductionScriptOnlyComparison: true,
    noScriptTailAdded: true,
    uncertaintyRetained: true,
    humanListeningClaimed: false,
  },
  counts: {
    captions: captions.length,
    corrections: corrections.length,
    uncertainties: uncertainties.length,
    reviewRequiredCaptions: captions.filter((caption) => caption.reviewRequired).length,
  },
  lastSpeechEndMs: captions.at(-1).endMs,
  nextGate: 'user-audio-review-before-formal-subtitles',
};

writeNew('spoken-timeline.candidate.v1.json', timeline);
writeNew('actual-spoken.candidate.v1.txt', `${captions.map((caption) => caption.text).join('\n')}\n`);
writeNew('transcription-review.v1.json', review);
writeNew('spoken-script-comparison.v1.json', comparison);
writeNew('spoken-timeline-validation.v1.json', validation);

const outputNames = [
  'spoken-timeline.candidate.v1.json',
  'actual-spoken.candidate.v1.txt',
  'transcription-review.v1.json',
  'spoken-script-comparison.v1.json',
  'spoken-timeline-validation.v1.json',
];
console.log(JSON.stringify({
  ok: true,
  status: timeline.status,
  formalAllowed: false,
  outputs: outputNames.map((name) => ({path: path.join(dir, name), sha256: sha256(path.join(dir, name))})),
  counts: validation.counts,
}, null, 2));
