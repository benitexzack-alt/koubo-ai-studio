import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const rawPath = path.join(
  projectRoot,
  'edit/20260811_training_camp/transcripts/TRAINING_CAMP_20260811_talk01_whisper-small-v1.json',
);
const cleanedPath = path.join(
  projectRoot,
  'edit/20260811_training_camp/transcripts/TRAINING_CAMP_20260811_talk01.cleaned.v1.json',
);
const captionsPath = path.join(
  projectRoot,
  'remotion/public/data/TRAINING_CAMP_20260811_talk01.captions.v1.json',
);
const bilingualPath = path.join(
  projectRoot,
  'remotion/public/data/TRAINING_CAMP_20260811_talk01.bilingual.v1.json',
);
const textPath = path.join(
  projectRoot,
  'edit/20260811_training_camp/transcripts/TRAINING_CAMP_20260811_talk01.cleaned.v1.txt',
);
const reviewPath = path.join(
  projectRoot,
  'edit/20260811_training_camp/transcripts/TRAINING_CAMP_20260811_talk01.script-comparison.v1.json',
);

const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
const rawSegments = Array.isArray(raw.transcription) ? raw.transcription : [];

// 用户已锁定主稿；这里按真实原声保留自然口语，只机械修复 ASR 同音字。
// 唯一内容剪辑是删除 211.28-211.56 秒多说的“会”，把“它会不会”恢复为“它不会”。
const correctedSegments = [
  '在咱们甘肃做企业，你是不是也觉得，算力、信创、人工智能离自己还很远？这几天，兰州有50名创业者和从业者，带着电脑坐进了同一间教室。',
  '我也坐在现场，但最在意的不是课程有多少，而是咱们本地企业能不能把自己的问题说清楚。',
  '平时的工作和业务中哪一步最费时间？资料放在哪里？AI做错了，谁能看得出来？',
  '现场我们是早上听课，下午动手，晚上还有作业。',
  '这次的主题是“信创驱动数字中国·AI赋能创业创新——创业能力提升训练营”。',
  '是由咱们城关区人社部门组织，从8月9号到15号。',
  '训练还没有结束，所以这一集我先留一份开场记录。等后面的课程和研学走完，我会再做第二集，把真正看到的结果拿出来。',
  '哪些东西能用，哪些还停留在设想里面，哪些必须找专业的团队。',
  '开营时，相关负责人反复提到了实操、应用和协同。',
  '老师也要求大家带电脑现场动手，课后还要交作业。学到的工具，得到的一些心法，要用到创业和工作里面。',
  '为什么本地企业现在开始做这样的训练呢？',
  '甘肃已经有了庆阳国家算力枢纽这样的一个基础建设。',
  '今年省里的“人工智能+”行动方案，又把场景应用和能力培训写了进去。',
  '但算力不会自己走进一家餐馆、一个工厂或者是一个人的工作室。',
  '那么中间还缺一段，得有人听懂企业每天怎么干活的，知道资料在哪里，再把工具接进去。',
  '最后还要有人检查结果。',
  'AI课上的一位老师讲了他的一个调研观察，有些企业员工说不清楚AI到底能做什么。',
  '真让他提需求，也不知道该往哪里说起。',
  '我觉得这句话很真实。很多企业还没走到选哪个AI工具这一步，就已经卡住了。',
  '工作怎么做没有写清楚，资料散在不同人的手里，出了错也不知道该让谁去检查。',
  '信创也一样，它不只是换一批国产电脑，实际还会碰到应用开发、系统迁移、兼容适配、安全和后期运维等。',
  '咱们听到这里，不用马上去研究这些操作系统，也别看到迁移、',
  '运维这几个词，就觉得这个项目已经摆在这了。咱们不一定会去做信创项目。',
  '但只要想把AI或国产化的系统接进一家企业，就绕不开几个日常问题。',
  '任务能不能说清楚，资料能不能用，到底结果谁来负责。',
  '所以，先看自己手里的那项工作，拿出一张纸问自己四个问题。',
  '第一，哪一步最耗时间，而且每天都在重复？',
  '第二，就是完成它需要哪些资料，这些资料现在能不能拿出来？',
  '第三，如果AI做错了，谁能看出来，最后谁负责？',
  '第四，这项工作有没有国产系统、数据安全和兼容适配的要求？',
  '四个答案会把这项工作分到不同的路上。',
  '资料还散着，流程也说不清，先补数字化基础。',
  '任务比较明确，资料也能用，也有人验收，',
  '那么就可以先做一个很小的AI测试，看看结果到底能不能用。',
  '如果涉及国产环境、系统迁移或者是数据安全，',
  '就不要自己硬扛，去找有产品、有授权、能够承担售后的专业团队配合。',
  '这四张问卡呢，我会完整地放在画面上，',
  '然后方便你存下来，对照自己的一项工作。',
  '它不会替你找到项目，但能帮你少走一步错路。',
  '听到这呢，我也重新看了一下自己现在能做什么。',
  '我不会因为听了几天课，就把自己说成信创专家。',
  '我更愿意的是继续做自己现在能做的事。',
  '先陪本地企业把问题说清，把资料和流程整理出来。',
  '再用知识库、工作流和一些小的工具，',
  '做出一个能够复核的小结果。',
  '真的碰到国产化迁移和专业适配，',
  '我负责把需求讲明白，再和能够承担责任的团队一起做。',
  '这场训练到底会给本地留下什么？',
  '现在还不能着急下结论。',
  '等咱们课程全部结束之后，我会用第二集来做交付。',
  '实际学到了什么，研学现场看到了哪些，',
  '然后哪些对甘肃本地企业真的有用，哪些还要继续进行验证。',
  '你也可以拿自己的一项工作，把这四个问题过一遍。',
  '最卡的是哪一步，留在评论区。',
  '后面我会从这些真实的问题里面继续拆。',
  '我是超哥，在兰州AI创业。',
];

const englishSegments = [
  'If you run a business in Gansu, do compute, Xinchuang and AI still feel far away? In Lanzhou, 50 entrepreneurs and professionals have entered one classroom with their computers.',
  'I was there too, but what matters most to me is whether local businesses can first explain their own problems clearly.',
  'Which step takes the most time? Where is the information? If AI gets it wrong, who can tell?',
  'We attend lessons in the morning, practise in the afternoon, and still have homework at night.',
  'The program is titled “Xinchuang Drives Digital China, AI Empowers Entrepreneurship and Innovation.”',
  'It is organized by the Chengguan District human-resources authority and runs from August 9 to 15.',
  'The program is not over, so this episode is an opening record. After the later courses and study visits, I will make episode two with the results we actually see.',
  'What works, what remains an idea, and what requires a professional team.',
  'At the opening, the organizers repeatedly stressed practice, application and collaboration.',
  'Teachers asked everyone to bring computers, work hands-on and submit homework. The tools and lessons need to enter real work and entrepreneurship.',
  'Why are local businesses starting this kind of training now?',
  'Gansu already has the Qingyang national computing hub as infrastructure.',
  'This year, the provincial “AI Plus” action plan also included scenario application and capability training.',
  'But computing power does not walk into a restaurant, factory or personal studio by itself.',
  'A bridge is still missing: someone must understand the work, locate the information and connect the tools.',
  'Someone must also check the result.',
  'In the AI class, a teacher shared a field observation: some employees cannot explain what AI can do.',
  'When asked for a requirement, they do not know where to begin.',
  'That feels very real. Many businesses get stuck before they even choose an AI tool.',
  'The work is undocumented, information is scattered, and nobody knows who should check mistakes.',
  'Xinchuang is similar. It is not just replacing computers; it also involves development, migration, compatibility, security and operations.',
  'You do not need to study operating systems immediately, or see migration',
  'and operations and assume a project is already in front of you. You may never take on a Xinchuang project.',
  'But connecting AI or a domestic system to a business still raises several everyday questions.',
  'Can the task be explained? Is the information usable? Who is responsible for the result?',
  'Start with one task in your own hands and ask four questions.',
  'First, which step takes the most time and repeats every day?',
  'Second, what information does it need, and can you retrieve it now?',
  'Third, if AI is wrong, who can spot it and who is finally responsible?',
  'Fourth, does the task require a domestic system, data security or compatibility?',
  'The four answers send the task down different paths.',
  'If information is scattered and the process is unclear, build the digital foundation first.',
  'If the task is clear, the information is usable and someone can review it,',
  'start with a small AI test and see whether the result is actually usable.',
  'If it involves a domestic environment, migration or data security,',
  'do not carry it alone. Work with a professional team with products, authorization and support responsibility.',
  'I will place these four questions clearly on screen',
  'so you can save them and compare them with one task of your own.',
  'They will not find a project for you, but they can help you avoid one wrong turn.',
  'This also made me look again at what I can do now.',
  'A few days of classes do not make me a Xinchuang expert.',
  'I would rather continue doing what I can already do.',
  'Help local businesses clarify problems and organize their information and processes.',
  'Then use a knowledge base, workflow or small tool',
  'to produce a small result that can be reviewed.',
  'When domestic migration or professional adaptation is involved,',
  'I can clarify the requirement and work with a team that can take responsibility.',
  'What will this program leave for the local community?',
  'It is still too early to conclude.',
  'After all courses end, episode two will deliver the follow-up.',
  'What we learned and what we saw during the study visits,',
  'what is genuinely useful for local Gansu businesses, and what still needs validation.',
  'Take one task of your own and run through these four questions.',
  'Which step blocks you most? Leave it in the comments.',
  'I will keep unpacking these real problems.',
  'I am Chao, building an AI venture in Lanzhou.',
];

if (rawSegments.length !== correctedSegments.length || rawSegments.length !== englishSegments.length) {
  throw new Error(
    `段落数量不一致：raw=${rawSegments.length} zh=${correctedSegments.length} en=${englishSegments.length}`,
  );
}

const edit = {
  cutStartMs: 211280,
  cutEndMs: 211560,
  removedDurationMs: 280,
};
const sourceDurationMs = 279667;

const mapSourceMsToOutputMs = (value) => {
  if (value <= edit.cutStartMs) return value;
  if (value >= edit.cutEndMs) return value - edit.removedDurationMs;
  return edit.cutStartMs;
};

const splitTokenCharacters = (segment) => {
  const units = [];
  for (const token of segment.tokens ?? []) {
    const tokenText = String(token.text ?? '');
    if (!tokenText || tokenText.startsWith('[_')) continue;
    const characters = [...tokenText.replace(/\s+/gu, '')];
    if (characters.length === 0) continue;
    const rawStart = Number(token.offsets?.from ?? segment.offsets.from);
    const rawEnd = Math.min(
      sourceDurationMs,
      Math.max(rawStart + 20, Number(token.offsets?.to ?? rawStart + 20)),
    );
    if (rawStart >= edit.cutStartMs && rawEnd <= edit.cutEndMs) continue;
    const tokenStart = mapSourceMsToOutputMs(rawStart);
    const tokenEnd = Math.max(tokenStart + 20, mapSourceMsToOutputMs(rawEnd));
    characters.forEach((character, index) => {
      units.push({
        text: character,
        start: tokenStart + ((tokenEnd - tokenStart) * index) / characters.length,
        end: tokenStart + ((tokenEnd - tokenStart) * (index + 1)) / characters.length,
        probability: Number.isFinite(Number(token.p)) ? Number(token.p) : null,
      });
    });
  }
  return units;
};

const alignCharacters = (rawUnits, correctedText, segmentStart, segmentEnd) => {
  const target = [...correctedText.replace(/\s+/gu, '')];
  const source = rawUnits.map((unit) => unit.text);
  const distance = Array.from({length: source.length + 1}, () =>
    Array(target.length + 1).fill(0),
  );
  for (let row = 0; row <= source.length; row += 1) distance[row][0] = row;
  for (let column = 0; column <= target.length; column += 1) distance[0][column] = column;
  for (let row = 1; row <= source.length; row += 1) {
    for (let column = 1; column <= target.length; column += 1) {
      distance[row][column] = Math.min(
        distance[row - 1][column - 1] + (source[row - 1] === target[column - 1] ? 0 : 1),
        distance[row - 1][column] + 1,
        distance[row][column - 1] + 1,
      );
    }
  }

  const mapped = Array(target.length).fill(null);
  let row = source.length;
  let column = target.length;
  while (row > 0 || column > 0) {
    if (
      row > 0 &&
      column > 0 &&
      distance[row][column] ===
        distance[row - 1][column - 1] + (source[row - 1] === target[column - 1] ? 0 : 1)
    ) {
      mapped[column - 1] = rawUnits[row - 1];
      row -= 1;
      column -= 1;
    } else if (row > 0 && distance[row][column] === distance[row - 1][column] + 1) {
      row -= 1;
    } else {
      column -= 1;
    }
  }

  let cursor = 0;
  while (cursor < mapped.length) {
    if (mapped[cursor]) {
      cursor += 1;
      continue;
    }
    const blockStart = cursor;
    while (cursor < mapped.length && !mapped[cursor]) cursor += 1;
    const blockEnd = cursor;
    const previousEnd =
      blockStart > 0 && mapped[blockStart - 1] ? mapped[blockStart - 1].end : segmentStart;
    const nextStart = blockEnd < mapped.length && mapped[blockEnd] ? mapped[blockEnd].start : segmentEnd;
    const available = Math.max(20 * (blockEnd - blockStart), nextStart - previousEnd);
    for (let index = blockStart; index < blockEnd; index += 1) {
      const offset = index - blockStart;
      mapped[index] = {
        text: target[index],
        start: previousEnd + (available * offset) / Math.max(1, blockEnd - blockStart),
        end: previousEnd + (available * (offset + 1)) / Math.max(1, blockEnd - blockStart),
        probability: null,
      };
    }
  }

  let monotonicStart = segmentStart;
  return target.map((text, index) => {
    const unit = mapped[index];
    const start = Math.max(
      segmentStart,
      Math.min(Math.max(segmentStart, segmentEnd - 20), Math.max(monotonicStart, unit.start)),
    );
    const end = Math.min(segmentEnd, Math.max(start + 20, unit.end));
    monotonicStart = Math.min(segmentEnd, end);
    return {
      text,
      start: start / 1000,
      end: end / 1000,
      type: 'word',
      speaker_id: 'speaker_0',
      confidence: unit.probability,
      corrected: source[index] !== text,
      segment_index: null,
    };
  });
};

const splitChinesePages = (text, maxLength = 24) => {
  const clauses = text.split(/(?<=[，。？！；：])/u).filter(Boolean);
  const pages = [];
  let current = '';
  for (const clause of clauses) {
    if ([...current, ...clause].length <= maxLength || !current) {
      current += clause;
      continue;
    }
    pages.push(current);
    current = clause;
  }
  if (current) pages.push(current);
  return pages.flatMap((page) => {
    if ([...page].length <= maxLength + 6) return [page];
    const chars = [...page];
    const result = [];
    for (let index = 0; index < chars.length; index += maxLength) {
      result.push(chars.slice(index, index + maxLength).join(''));
    }
    return result;
  });
};

const splitEnglishPages = (text, ratios) => {
  const words = text.split(/\s+/u).filter(Boolean);
  const totalRatio = ratios.reduce((sum, value) => sum + value, 0);
  const pages = [];
  let cursor = 0;
  ratios.forEach((ratio, index) => {
    const remainingPages = ratios.length - index;
    const remainingWords = words.length - cursor;
    const count =
      index === ratios.length - 1
        ? remainingWords
        : Math.max(1, Math.min(remainingWords - (remainingPages - 1), Math.round((words.length * ratio) / totalRatio)));
    pages.push(words.slice(cursor, cursor + count).join(' '));
    cursor += count;
  });
  return pages;
};

const words = [];
const segments = [];
const bilingual = [];

const highlightCandidates = [
  '庆阳国家算力枢纽', '创业能力提升训练营', '训练还没有结束', '不会替你找到项目',
  '人工智能+', '场景应用', '能力培训', '应用开发', '系统迁移', '兼容适配',
  '数据安全', '后期运维', '数字化基础', '专业团队', '专业适配', '承担责任',
  '50名创业者', '本地企业', '普通企业', '人工智能', '信创项目', '选哪个AI工具',
  '工作没写清', '资料散', '谁能看出来', '最后谁负责', '四个问题', '四问卡',
  '最耗时间', '每天重复', '很小的AI测试', '少走一步错路', '信创专家',
  '知识库', '工作流', '小工具', '能复核', '不能急着下结论', '课程全部结束',
  '实际学到了什么', '真正有用', '继续验证', '评论区', '兰州AI创业',
  '早上听课', '下午动手', '晚上作业', '第一集', '第二集', '实操', '应用',
  '协同', '带电脑', '课后作业', '创业和工作', '餐馆', '工厂', '工作室',
  '检查结果', '提需求', '很真实', '换电脑', '一张纸', '国产系统',
  '算力', '信创', 'AI', '兰州', '资料', '验收',
];

const highlightsFor = (text) => {
  const selected = [];
  for (const candidate of highlightCandidates) {
    if (!text.includes(candidate)) continue;
    if (selected.some((item) => item.includes(candidate) || candidate.includes(item))) continue;
    selected.push(candidate);
    if (selected.length === 2) break;
  }
  return selected;
};

rawSegments.forEach((segment, segmentIndex) => {
  const sourceStartMs = Math.min(sourceDurationMs, Number(segment.offsets?.from ?? 0));
  const sourceEndMs = Math.min(
    sourceDurationMs,
    Number(segment.offsets?.to ?? sourceStartMs + 1),
  );
  const startMs = mapSourceMsToOutputMs(sourceStartMs);
  const endMs = mapSourceMsToOutputMs(sourceEndMs);
  const correctedText = correctedSegments[segmentIndex];
  const alignedWords = alignCharacters(
    splitTokenCharacters(segment),
    correctedText,
    startMs,
    endMs,
  ).map((word) => ({...word, segment_index: segmentIndex}));
  words.push(...alignedWords);
  segments.push({
    index: segmentIndex,
    startMs,
    endMs,
    sourceStartMs,
    sourceEndMs,
    text: correctedText,
    raw_text: String(segment.text ?? ''),
  });

  const zhPages = splitChinesePages(correctedText);
  const ratios = zhPages.map((page) => [...page.replace(/\s+/gu, '')].length);
  const enPages = splitEnglishPages(englishSegments[segmentIndex], ratios);
  let characterCursor = 0;
  let pageStartMs = startMs;
  zhPages.forEach((zh, pageIndex) => {
    characterCursor += [...zh.replace(/\s+/gu, '')].length;
    const lastCharacter = alignedWords[Math.max(0, characterCursor - 1)];
    const pageEndMs =
      pageIndex === zhPages.length - 1
        ? endMs
        : Math.max(pageStartMs + 160, Math.round(lastCharacter.end * 1000));
    bilingual.push({
      startMs: pageStartMs,
      endMs: pageEndMs,
      zh,
      en: enPages[pageIndex] ?? '',
      highlights: highlightsFor(zh),
    });
    pageStartMs = pageEndMs;
  });
});

const transcriptText = correctedSegments.join('');
const captions = words.map((word) => ({
  text: word.text,
  startMs: Math.round(word.start * 1000),
  endMs: Math.max(Math.round(word.start * 1000) + 20, Math.round(word.end * 1000)),
  timestampMs: Math.round(word.start * 1000),
  confidence: word.confidence,
}));

const cleaned = {
  schema_version: 1,
  source: path.relative(projectRoot, rawPath),
  method: 'whisper.cpp small本机离线词级转写 + 用户锁定稿对照 + 实际口语机械校正 + 单一口误EDL映射',
  language: 'zh',
  source_duration_seconds: 279.666667,
  output_duration_seconds: 279.386667,
  text: transcriptText,
  words,
  segments,
  edit,
  correction_policy:
    '保留真实口语顺序和自然增减；只修正可由锁定稿、原声上下文和专有名词确认的ASR错误；删除一处改变句意的多余“会”，不删除其他原声。',
};

const comparison = {
  schema_version: 1,
  source_video: 'source/20260811_training_camp/copy_B33B0DA5-B1F9-4F4F-A313-55AAF01A5424.MOV',
  approved_script: 'notes/2026-08-11-创业能力训练营信创与AI-第一集完整口播稿-v2.md',
  policy: '主体全量保留；真实口语优先；只处理一处改变句意的口误。',
  observed_differences: [
    {
      type: 'natural_spoken_variants',
      spoken: '增加“现场我们是”“得到的一些心法”“一个基础建设”等自然连接词，并把“交作业”说成“做交付”。',
      action: '全部保留，以真实原声制作字幕，不用书面稿覆盖实际口语。',
    },
    {
      type: 'minor_card_word_order',
      source_window_ms: [203100, 204370],
      spoken: '这四张问卡呢',
      action: '保留原声；画面统一使用“四问卡”，不做高风险音频重排。',
    },
    {
      type: 'meaning_changing_extra_word',
      source_window_ms: [211280, 211560],
      spoken: '它会不会替你找到项目',
      intended: '它不会替你找到项目',
      action: '删除多出的第一个“会”，在四问卡遮罩下隐藏0.28秒画面跳切。',
    },
  ],
  retake_required: false,
  cut_required: true,
};

for (const targetPath of [cleanedPath, captionsPath, bilingualPath, textPath, reviewPath]) {
  fs.mkdirSync(path.dirname(targetPath), {recursive: true});
}
fs.writeFileSync(cleanedPath, `${JSON.stringify(cleaned, null, 2)}\n`, 'utf8');
fs.writeFileSync(captionsPath, `${JSON.stringify(captions, null, 2)}\n`, 'utf8');
fs.writeFileSync(bilingualPath, `${JSON.stringify(bilingual, null, 2)}\n`, 'utf8');
fs.writeFileSync(textPath, `${transcriptText}\n`, 'utf8');
fs.writeFileSync(reviewPath, `${JSON.stringify(comparison, null, 2)}\n`, 'utf8');

console.log(`校正段落：${segments.length}`);
console.log(`词级条目：${words.length}`);
console.log(`双语字幕页：${bilingual.length}`);
console.log(`输出时长：${cleaned.output_duration_seconds.toFixed(3)} 秒`);
console.log(`校正转写：${path.relative(projectRoot, cleanedPath)}`);
