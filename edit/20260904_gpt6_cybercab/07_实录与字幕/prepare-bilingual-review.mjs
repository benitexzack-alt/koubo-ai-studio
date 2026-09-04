import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, '..');
const read = (file) => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const draftFile = '剪后261秒_实录ASR待复听.v1.json';
const secondFile = 'R01.terms-pass.raw.v1.json';
const draft = read(draftFile);
const second = read(secondFile);
const fixes = [
  ['AGA', 'AGI'], ['GPT6,Astra', 'GPT-6 Astra'], ['GP6Astra', 'GPT-6 Astra'],
  ['GBT6、S2', 'GPT-6 Astra'], ['CyberCarp', 'Cybercab'], ['CyberCup', 'Cybercab'],
  ['Sebacar', 'Cybercab'], ['SEBACAR', 'Cybercab'], ['AA', 'AI'],
];
const unresolved = new Map([
  [2, '重爆发布：识别写法待听，不依据文稿自动改词'],
  [3, '落地入侧：路测等同音识别待听'], [4, '跌在一起/分水：尾词可能缺字'],
  [8, '完整业务工作人：尾词需确认'], [10, '校队/副盘及停顿：待听确认'],
  [12, '铲出货客文：词组及是否有“案”字待听'],
  [34, '两轮识别出现“决策全部/决策的全部”的差异'],
  [48, '舞曲：同音词待听'], [50, '小店们：是否为小门店待听'],
  [51, '有前人：两轮识别“有钱人”不同'], [54, '传统经济：尾词缺失或错识别'],
  [58, '输离：同音词待听'], [60, '平台流程：与第二轮“平台绿制”不一致'],
  [61, '争响：同音词待听'], [63, '负能力的生意：词组待听'],
  [64, '机器干重复的是：末字同音待听'], [76, '陪跑之心：第二轮识别执行'],
  [81, '门电货客：词组待听'], [84, '流程讲话：词组待听'],
  [89, '降本增效/降本增销：两轮不一致'], [93, '生根/深耕：两轮不一致'],
]);
const translations = [
  'Today, two era-defining events happened in the global technology world.',
  'They mark the arrival of AI implementation and AGI in the physical world.',
  null, null, null,
  'The key breakthrough in today\'s GPT-6 Astra is native computer operation.',
  'It no longer simply relies on you asking questions and getting answers.',
  'It can directly operate computers, browsers, and business software.',
  null,
  'Simply put, you give it a complex business task.',
  null,
  'And it delivers the finished result directly.',
  null,
  'Report analysis and process optimization.',
  'It never slacks off.',
  'It does not need rest.',
  'It does not need a salary.',
  'Most importantly, it greatly reduces labor costs.',
  'Efficiency increases exponentially.',
  'This means the repetitive work of ordinary workers,',
  'process-based and mechanical work, can all be completely replaced by AI.',
  'Now let\'s look at our second event: Tesla\'s Cybercab.',
  'A car with no steering wheel, accelerator, or brake pedal.',
  'A human cannot drive it at all.',
  'From birth, it is an AI robot on four wheels.',
  'Let\'s look back at a century of automotive history.',
  'From horse-drawn carriages to gasoline cars, and from gasoline to electric cars.',
  'All the designs serve human drivers.',
  'People drive, judge, take responsibility, and make decisions.',
  'Even with earlier driver assistance,',
  'the core logic was always people first, AI second.',
  'But Cybercab overturns a century of rules.',
  'No one driving, no one intervening.',
  'Its eyes are cameras, and its brain is the FSD model.',
  null,
  'It is no longer a means of transportation.',
  'It is an AI robot entering the physical world.',
  'GPT-6 Astra is the super-intelligent brain of the virtual world.',
  'It can complete an entire set of commercial tasks within software systems.',
  'Cybercab is the body carrying out actions in the real world.',
  'The brain and body are both fully mature.',
  'This is truly the era of artificial general intelligence.',
  'At the launch event, they directly proclaimed:',
  'Welcome to the AGI era.',
  'Starting today, AI moves beyond the screen,',
  'enters reality, takes over physical work,',
  'takes over business processes,',
  'and takes over every industry.',
  null,
  'These are matters for big cities and large companies.',
  null, null,
  'The first to be displaced are those who cannot understand the trend,',
  'who dare not put it into practice,',
  null,
  'GPT-6 Astra can now help you acquire customers automatically,',
  'do marketing automatically,',
  'do design automatically,',
  null,
  'analyze data automatically,',
  null, null,
  'In the future, it is no longer about how capable you are,',
  null, null,
  'People only handle decisions, judgment, resources, service, and business operations.',
  'AI is not the future.',
  'AI is now.',
  'Stop worrying about it.',
  'AI does not understand.',
  'You do not know how to use it.',
  'You cannot learn it.',
  'You do not need to understand the technology.',
  'You only need to understand your industry,',
  'and your business.',
  'All the remaining tedious work and implementation,',
  null,
  'leave it all to AI.',
  'Leave it to me to help you implement it.',
  'I am in Lanzhou, focused on AI for local businesses,',
  'with hands-on support throughout implementation.',
  null,
  'Marketing planning,',
  'visual design,',
  null,
  'SOP development,',
  'data review.',
  'Every problem can be solved by AI.',
  'If you do not want to be left behind,',
  null,
  'and want to leap ahead, leave “implementation” in the comments.',
  'I will take you into the era of doing business with AI.',
  'I am Chao.',
  null,
];
assert.equal(translations.length, draft.cues.length);
const corrections = [];
const captions = draft.cues.map((cue, index) => {
  let zh = cue.text;
  for (const [from, to] of fixes) {
    if (!zh.includes(from)) continue;
    corrections.push({cueId: cue.id, from, to, type: 'proper-noun-spelling',
      evidence: `专有名词规范化；本期已提供的名称和术语辅助第二遍本地ASR交叉核对。不是人耳复听，未改句式；原音频${cue.sourceStart.toFixed(2)}-${cue.sourceEnd.toFixed(2)}秒保留。`});
    zh = zh.replaceAll(from, to);
  }
  const peers = second.transcription.filter(s => s.offsets.from / 1000 < cue.sourceEnd && s.offsets.to / 1000 > cue.sourceStart)
    .map(s => ({start: s.offsets.from / 1000, end: s.offsets.to / 1000, text: s.text}));
  assert.equal(translations[index] === null, unresolved.has(index), `待听状态不同步:${index}`);
  return {id: cue.id, startMs: Math.round(cue.startFrame * 1000 / 30), endMs: Math.round(cue.endFrameExclusive * 1000 / 30),
    startFrame: cue.startFrame, endFrameExclusive: cue.endFrameExclusive, rawZh: cue.text, zh, en: translations[index],
    englishSource: 'same-page-spoken-chinese-draft-not-shooting-script',
    status: unresolved.has(index) ? 'audio-review-required-english-withheld' : 'machine-based-bilingual-draft-human-review-pending',
    issue: unresolved.get(index) ?? null, secondPassOverlap: peers};
});
assert(captions.every(c => c.endFrameExclusive <= 7830 && c.startFrame < c.endFrameExclusive));
assert(!captions.some(c => c.zh.includes('没有人负责')));
const write = (file, data) => fs.writeFileSync(path.join(dir, file), typeof data === 'string' ? data : JSON.stringify(data, null, 2) + '\n', {flag: 'wx'});
const outputFile = '中英字幕准备稿_待复听.v2.json';
write(outputFile, {schemaVersion: 'bilingual-preparation-draft/v2', status: 'not-renderable-transcript-review-required', captions,
  bindings: [{path: draftFile, sha256: hash(path.join(dir, draftFile))}, {path: secondFile, sha256: hash(path.join(dir, secondFile))}],
  captionsTotal: captions.length, englishDraftPages: captions.filter(c => c.en).length, unresolvedPages: unresolved.size,
  humanListeningCompleted: false, finalChineseConfirmed: false, formalEligible: false,
  note: '英文仅翻译当前实录识别草案，逐页绑定中文；词组不确定的页不猜译。翻译实录不等于赞同或核实实录中的事实与效果承诺。'});
write('字幕专名修正与待听清单.v2.json', {status: 'machine-review-only', audioPerceptionAvailable: false,
  secondAsr: {engine: 'whisper.cpp small', beamSize: 8, threads: 6, prompt: '简体中文。术语：OpenAI，GPT-6 Astra，Cybercab，FSD，AGI，AI，SOP，兰州。',
    scriptProvidedToEngine: false, source: 'R01_16k_mono.wav', sourceSha256: hash(path.join(dir, 'R01_16k_mono.wav'))},
  corrections, unresolved: captions.filter(c => c.issue).map(c => ({id: c.id, startMs: c.startMs, endMs: c.endMs, rawZh: c.rawZh, issue: c.issue, secondPassOverlap: c.secondPassOverlap}))});
write('字幕准备进度_先看这里.md', `# 字幕准备进度\n\n原音频已完成第二遍本地识别，只提供专有名词表，没有把拍摄文稿喂给识别器。剪后时间轴仍为261秒/7830帧。\n\n- 总计${captions.length}页草案；${captions.filter(c => c.en).length}页已有对应英文准备稿。\n- ${unresolved.size}页有同音错词、尾字遗漏或两遍不一致，英文暂不猜译。\n- 专名规范化${corrections.length}处，每处保留修改前后和时间。\n- 当前工具不能直接听取音频，未声称完成人耳复听；所有页仍须最终校对。\n- 未改正文观点和其他事实风险句，未用字幕替用户纠正说法；只同步此前已授权剪掉的句子。\n\n## 优先复听页\n\n|编号|剪后秒数|疑点|\n|---|---|---|\n${captions.filter(c => c.issue).map(c => `|${c.id}|${(c.startMs / 1000).toFixed(2)}-${(c.endMs / 1000).toFixed(2)}|${c.issue}|`).join('\n')}\n\n正式状态保持未通过，不把文件内部一致性当作实录已经正确。\n`);
write('spoken-source-policy.preparation.v2.json', {schemaVersion: 1, canonicalSource: 'recorded-audio', scriptRole: 'comparison-only',
  captionTextPolicy: 'spoken-verbatim', englishTranslationSource: 'canonical-spoken-chinese',
  compliance: {status: 'pending-audio-review', reason: '第二遍本地识别已完成；正文未逐句人工确认，21页词组不确定；严禁冒充passed'},
  verification: {corrections, humanListeningCompleted: false, rawAudio: path.join(dir, 'R01_16k_mono.wav'), originalVideo: path.join(root, '01_口播原片/R01_口播原片.MOV')},
  captionDraft: {path: outputFile, sha256: hash(path.join(dir, outputFile))}, formalEnabled: false});
console.log(JSON.stringify({pages: captions.length, englishPrepared: captions.filter(c => c.en).length, unresolved: unresolved.size, properNounCorrections: corrections.length, humanListeningCompleted: false}));
