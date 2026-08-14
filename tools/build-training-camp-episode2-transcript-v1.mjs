import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const rawPath = path.join(root, 'edit/transcripts/20260814_training_camp_ep2/TRAINING_CAMP_EP2_talk01_local.json');
const outDir = path.join(root, 'edit/transcripts/20260814_training_camp_ep2');
const publicDir = path.join(root, 'remotion/public/data');
const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
const segments = raw.transcription ?? [];

const replacements = [
  ['给大家教一下', '给大家交一下'],
  ['两个企业的参访', '两个企业参访'],
  ['兰州市的信创产业园', '兰州市信创产业园'],
  ['对标的英伟达A100', '对标英伟达A100'],
  ['权链条', '全链条'],
  ['服务器产现', '服务器产线'],
  ['数据源区', '数据园区'],
  ['多少个源区和企业', '多少园区和企业'],
  ['有人赚出来', '有人站出来'],
  ['数据编辑', '数据边界'],
  ['装配前侧老化，附件', '装配、前测、老化、复检'],
  ['谁来都得', '谁来兜底'],
  ['永兴国信数据要素产业人', '永新国信数据要素产业园'],
  ['采集整理', '采集、整理'],
  ['安全的管理', '安全管理'],
  ['除了问题还能溯源', '出了问题还能追溯'],
  ['客户表格', '客户表'],
  ['要不要拖敏', '要不要脱敏'],
  ['错误的结果时候', '错误结果时'],
  ['掩饰的阶段', '演示阶段'],
  ['走近本地企业', '走进本地企业'],
  ['这几天的客', '这几天的课'],
  ['知识库客', '知识库课'],
  ['知识产权客', '知识产权课'],
  ['企业AI落地客', '企业AI落地课'],
  ['接近真实的业务流程', '接进真实业务流程'],
  ['AIJC', 'AIGC'],
  ['这些客看起来', '这些课看起来'],
  ['谁来演述', '谁来验收'],
  ['用最小范围的数据', '用小范围的数据'],
  ['国产化遷移', '国产化迁移'],
  ['后期运为', '后期运维'],
  ['承担后果责任', '承担售后责任'],
  ['要有结果，谁来提出', '业务结果，谁来提出'],
  ['数据全限', '数据权限'],
  ['蓝州已经有了国产性偏身弹', '兰州已经有了国产芯片生态'],
  ['验书条件', '验收条件'],
  ['履行清楚', '捋清楚'],
  ['长期运为', '长期运维'],
  ['最后评不前的你', '最后，屏幕前的你'],
  ['准备用哪些工具', '准备用哪个工具'],
  ['这五个责任写出来', '这五个责任人写出来'],
  ['蓝州AA创业', '兰州AI创业'],
];

const english = [
  'How far have Chinese AI chips caught up with NVIDIA?',
  'Today is the final day of this AI entrepreneurship training camp.',
  'This video is my answer to the question I left earlier.',
  'The camp included two company visits.',
  'Our first stop was Lanzhou Xinchuang Industrial Park,',
  'also the Gansu Xinchuang Adaptation Base.',
  'There I saw Hygon DCU compared with NVIDIA A100,',
  'with performance described at around eighty percent.',
  'The real value is that domestic computing power',
  'can now be discussed through real products and use cases.',
  'The competition has moved beyond a single chip',
  'to servers, software ecosystems and industry delivery.',
  'The server production line behind these domestic AI chips,',
  'and the ecosystem adaptation center, are here in Lanzhou.',
  'Lanzhou now has domestic chips and server production lines,',
  'as well as a data park.',
  'Even practical AI implementation courses are now available.',
  'So why do many local firms still struggle',
  'to connect these pieces into a usable project?',
  'After five days, the most valuable thing I took away',
  'was not another tool or a list of parks and companies.',
  'I summarized it in four words: a chain of responsibility.',
  'Industrial capability does not automatically become business results.',
  'Someone must translate the business, define data boundaries and test the process,',
  'then own acceptance, delivery and long-term maintenance.',
  'Start with hardware: a server goes from parts to final delivery',
  'through assembly, pre-test, aging, re-test, system setup and packing.',
  'Putting the chip in the chassis is only the first step.',
  'Can drivers run? Can software adapt? Who takes over when it fails?',
  'Miss one link and the company will not dare to use it.',
  'On the data side, our second stop was Yongxin Guoxin Data Element Industrial Park.',
  'The key question was how data is collected, organized and authorized,',
  'evaluated and secured, then made genuinely usable,',
  'traceable production material when something goes wrong.',
  'Many owners think having contracts,',
  'customer lists, product files and procedures means AI can use them directly.',
  'It does not. Which file version is valid?',
  'Who may view it? What enters the model? Must sensitive data be masked?',
  'Who catches AI errors, and how does the process roll back?',
  'Without answers, even stronger servers and newer models',
  'remain demonstrations instead of working systems.',
  'For domestic AI capability to enter local companies,',
  'what is missing is a complete chain of responsibility,',
  'with a clear collaboration position at every link.',
  'Every course these days was asking the same question.',
  'The knowledge-base course asked what information AI works with.',
  'The IP course warned that access does not equal permission.',
  'The enterprise AI course asked how systems enter real workflows',
  'and how errors are handled.',
  'Digital marketing and AIGC still have to answer one thing:',
  'does anyone genuinely need the content or service?',
  'These courses may look separate,',
  'but inside a company they become four questions:',
  'what do we use, and do we have the right to use it?',
  'Which workflow does it enter, and who accepts the result?',
  'So what should companies and AI implementers do?',
  'Companies must lay out the real problem,',
  'define usable information and what counts as a qualified result.',
  'People building AI applications and implementation services',
  'must translate business needs into executable workflows,',
  'test checkable results with a small data scope,',
  'then connect systems, people and partners.',
  'When domestic migration and hardware-software adaptation are involved,',
  'along with legal compliance and later maintenance,',
  'the work needs teams with testing capability and verified authorization,',
  'that can take responsibility for support.',
  'Collaboration never means responsibility can remain empty.',
  'At every handoff, a specific person must take it over.',
  'Here is a method you can use immediately:',
  'write a responsibility chain for the project you are discussing.',
  'Who defines the business result? Who approves data access?',
  'Who builds the AI workflow? Who takes over when the system fails?',
  'Who accepts the result and owns long-term maintenance?',
  'If one box still says “we will decide later,”',
  'the project is not actually ready.',
  'Back to the assignment left in episode one:',
  'I can now give an answer.',
  'What I learned is that when AI enters a company,',
  'scenario, data, process and responsibility must stay connected.',
  'I also saw Lanzhou build a domestic chip ecosystem,',
  'server manufacturing and testing, data services and implementation training.',
  'These are real industrial entry points. I will keep helping local firms',
  'clarify business problems, information boundaries and process standards,',
  'then define acceptance conditions step by step.',
  'We start with one result that can be implemented and checked.',
  'For professional adaptation and long-term maintenance,',
  'I am also looking for qualified teams that can work with me.',
  'Leave a comment and let us talk.',
  'If you are considering an enterprise AI project now,',
  'do not start by telling me which tool you want to use.',
  'Write down these five responsible people.',
  'See which one is missing.',
  'Put the empty role in the comments.',
  'I will keep breaking this down through real projects.',
  'I am Chao, building an AI business in Lanzhou.',
];

if (segments.length !== english.length) {
  throw new Error(`segment/translation mismatch: ${segments.length}/${english.length}`);
}

const fix = (input) => {
  let text = String(input).trim().replaceAll(',', '，').replaceAll('?', '？');
  for (const [from, to] of replacements) text = text.replaceAll(from, to);
  return text;
};

const highlights = ['国产AI芯片', '英伟达', '海光DCU', 'A100', '八成', '兰州', '责任链条', '永新国信数据要素产业园', '数据权限', 'AIGC', '五个责任人'];
const correctedBase = segments.map((segment, index) => ({
  startMs: segment.offsets.from,
  endMs: segment.offsets.to,
  zh: fix(segment.text),
  en: english[index],
}));
const corrected = [];
for (const page of correctedBase) {
  const duration = page.endMs - page.startMs;
  if (duration <= 6000 || [...page.zh].length < 22) {
    corrected.push(page);
    continue;
  }
  const zhChars = [...page.zh];
  const candidates = zhChars
    .map((char, index) => (char === '，' || char === '、' ? index + 1 : -1))
    .filter((index) => index > 6 && index < zhChars.length - 6);
  const zhCut = candidates.sort((a, b) => Math.abs(a - zhChars.length / 2) - Math.abs(b - zhChars.length / 2))[0] ?? Math.floor(zhChars.length / 2);
  const enCutCandidate = page.en.indexOf(',', Math.floor(page.en.length * 0.3));
  const enCut = enCutCandidate > 0 && enCutCandidate < page.en.length * 0.8 ? enCutCandidate + 1 : Math.floor(page.en.length / 2);
  const middle = Math.round(page.startMs + duration * (zhCut / zhChars.length));
  corrected.push({startMs: page.startMs, endMs: middle, zh: zhChars.slice(0, zhCut).join(''), en: page.en.slice(0, enCut).trim()});
  corrected.push({startMs: middle, endMs: page.endMs, zh: zhChars.slice(zhCut).join(''), en: page.en.slice(enCut).trim()});
}

const words = [];
for (const page of corrected) {
  const chars = [...page.zh].filter((char) => !/[\s，。？！、：；,.?!]/u.test(char));
  const step = (page.endMs - page.startMs) / Math.max(1, chars.length);
  chars.forEach((char, index) => {
    const start = (page.startMs + step * index) / 1000;
    const end = (page.startMs + step * (index + 1)) / 1000;
    words.push({type: 'word', text: char, start, end, confidence: 0.9});
  });
}

const captions = words.map((word) => ({
  text: word.text,
  startMs: Math.round(word.start * 1000),
  endMs: Math.round(word.end * 1000),
  timestampMs: Math.round(word.start * 1000),
  confidence: word.confidence,
}));
const bilingual = corrected.map((page) => ({
  ...page,
  highlights: highlights.filter((item) => page.zh.includes(item)),
}));
const cleaned = {language_code: 'zh', source: 'whisper-cpp small local + orthographic correction', words};

fs.mkdirSync(outDir, {recursive: true});
fs.mkdirSync(publicDir, {recursive: true});
fs.writeFileSync(path.join(outDir, 'TRAINING_CAMP_EP2_talk01.cleaned.v1.json'), `${JSON.stringify(cleaned, null, 2)}\n`);
fs.writeFileSync(path.join(outDir, 'TRAINING_CAMP_EP2_talk01.cleaned.v1.txt'), `${corrected.map((page) => page.zh).join('')}\n`);
fs.writeFileSync(path.join(publicDir, 'TRAINING_CAMP_EP2_talk01.captions.v1.json'), `${JSON.stringify(captions, null, 2)}\n`);
fs.writeFileSync(path.join(publicDir, 'TRAINING_CAMP_EP2_talk01.bilingual.v1.json'), `${JSON.stringify(bilingual, null, 2)}\n`);
console.log(`segments=${corrected.length} words=${words.length} duration=${corrected.at(-1)?.endMs}`);
