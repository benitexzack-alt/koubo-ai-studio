import fs from 'node:fs';
import path from 'node:path';

const [rawPath, cleanedPath, bilingualPath, textPath] = process.argv.slice(2);

if (!rawPath || !cleanedPath || !bilingualPath || !textPath) {
  console.error(
    '用法：node tools/build-digital1-transcript-and-bilingual.mjs <raw.json> <cleaned.json> <bilingual.json> <transcript.txt>',
  );
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
const words = Array.isArray(raw.words) ? raw.words.map((word) => ({...word})) : [];

const replaceSequence = (from, to) => {
  if (from.length !== to.length) {
    throw new Error(`校正序列长度不一致：${from.join('')} -> ${to.join('')}`);
  }

  for (let index = 0; index <= words.length - from.length; index += 1) {
    const matched = from.every((text, offset) => words[index + offset]?.text === text);
    if (!matched) {
      continue;
    }

    to.forEach((text, offset) => {
      words[index + offset].text = text;
      words[index + offset].corrected = true;
    });
    return;
  }

  throw new Error(`未找到待校正词序列：${from.join('')}`);
};

const replaceAllSequences = (from, to) => {
  if (from.length !== to.length) {
    throw new Error(`校正序列长度不一致：${from.join('')} -> ${to.join('')}`);
  }

  let count = 0;
  for (let index = 0; index <= words.length - from.length; index += 1) {
    const matched = from.every((text, offset) => words[index + offset]?.text === text);
    if (!matched) {
      continue;
    }

    to.forEach((text, offset) => {
      words[index + offset].text = text;
      words[index + offset].corrected = true;
    });
    count += 1;
    index += from.length - 1;
  }

  return count;
};

// 只校正与锁定脚本、上下文和同音口误能够相互印证的词，不改写实录表达。
replaceSequence(['截', '止'], ['截', '至']);
replaceSequence(['记', '录', '报', '价'], ['进', '入', '报', '价']);
replaceSequence(['最', '好', '时', '间'], ['最', '耗', '时', '间']);
replaceSequence(['资', '料', '通', '明', '后'], ['资', '料', '脱', '敏', '后']);
replaceSequence(['要', '门', '量'], ['样', '本', '量']);
// Scribe v2 对同一音轨的数字和同音词可能采用不同表记；只做可被脚本与语境印证的机械归一。
replaceAllSequences(['官', '腔'], ['官', '方']);
replaceAllSequences(['一', '点', '零'], ['1', '.', '0']);
replaceAllSequences(['1', '.', '0', '，', '它'], ['1', '.', '0', '。', '它']);

const speechWords = words.filter(
  (word) => word?.type === 'word' && String(word.text ?? '').trim().length > 0,
);
const transcriptText = speechWords.map((word) => String(word.text)).join('');

const cleaned = {
  ...raw,
  text: transcriptText,
  words,
  correction_note:
    '基于锁定脚本、上下文和词级时间轴校正：截至、进入报价、最耗时间、资料脱敏、样本量、官方术语、数字化1.0；不删除原声中的短停顿和“呃”。',
};

const pageSpecs = [
  {
    end: '有没有用上AI的？',
    zh: '我想问一下屏幕前的老板们：现在有没有用上 AI？',
    en: 'A question for business owners: are you using AI yet?',
    highlights: ['老板们', 'AI'],
  },
  {
    end: '是不是没有提效？',
    zh: '用上之后发现，是不是没有提效？',
    en: 'After using it, did you find that efficiency did not improve?',
    highlights: ['没有提效'],
  },
  {
    end: '那到底问题出在哪里？',
    zh: '那到底，问题出在哪里？',
    en: 'So where is the real problem?',
    highlights: ['问题'],
  },
  {
    end: 'AI根本看不见？',
    zh: '到底是 AI 不够强，还是你的生意，AI 根本看不见？',
    en: 'Is AI too weak, or can AI simply not see your business?',
    highlights: ['AI 不够强', '根本看不见'],
  },
  {
    end: '售后靠员工记性，',
    zh: '如果客户在微信里，报价在老板脑子里，库存记在本子上，售后靠员工记性。',
    en: 'Customers sit in chats, quotes in the owner\'s head, stock on paper, and service in memory.',
    highlights: ['微信里', '脑子里', '本子上', '员工记性'],
  },
  {
    end: '你让AI怎么帮你？',
    zh: '你让 AI 怎么帮你？',
    en: 'How can AI help under those conditions?',
    highlights: ['怎么帮你'],
  },
  {
    end: '它连真实经营数据都看不见。',
    zh: '它连真实经营数据都看不见。',
    en: 'It cannot even see your real operating data.',
    highlights: ['真实经营数据'],
  },
  {
    end: '企业用AI第一步不是买系统，',
    zh: '我前面一直说，企业用 AI 第一步不是买系统。',
    en: 'I have said the first step in enterprise AI is not buying a system.',
    highlights: ['不是买系统'],
  },
  {
    end: '否则AI最后只能写文案。',
    zh: '但资料不能一直散着，否则 AI 最后只能写文案。',
    en: 'But information cannot stay scattered, or AI will only write copy.',
    highlights: ['资料不能一直散着', '只能写文案'],
  },
  {
    end: '我把这一步叫数字化1.0。',
    zh: '我把这一步叫“数字化 1.0”。',
    en: 'I call this step Digitalization 1.0.',
    highlights: ['数字化 1.0'],
  },
  {
    end: '也不是花几十万上系统，',
    zh: '它不是官方术语，也不是花几十万上系统。',
    en: 'It is not an official term or a costly system.',
    highlights: ['不是官方术语', '不是上大系统'],
  },
  {
    end: '个人脑子里',
    zh: '就是把一条关键业务，从纸上、微信和个人脑子里——',
    en: 'Take one key process out of paper, chats, and personal memory.',
    highlights: ['纸上', '微信', '个人脑子里'],
  },
  {
    end: '可溯源的记录。',
    zh: '变成能找到、能更新、可溯源的记录。',
    en: 'Make it findable, updateable, and traceable.',
    highlights: ['能找到', '能更新', '可溯源'],
  },
  {
    end: '也体现了这个顺序。',
    zh: '工信部 2024 年中小企业数字化评测，也体现了这个顺序。',
    en: "MIIT's 2024 SME digital assessment follows the same order.",
    highlights: ['工信部', '2024 年'],
  },
  {
    end: '人工智能驱动。',
    zh: '先是工具辅助和在线采集，更高阶段才是人工智能驱动。',
    en: 'Tools and online data collection come before AI-driven operations.',
    highlights: ['工具辅助', '在线采集', '人工智能驱动'],
  },
  {
    end: '至少得有数字记录和流程。',
    zh: 'AI 可以先用；但要进入报价、跟单、库存、交付，至少得有数字记录和流程。',
    en: 'AI can start now, but core operations need digital records and a process.',
    highlights: ['可以先用', '数字记录和流程'],
  },
  {
    end: '完成数字化改造，',
    zh: '截至“十四五”末，甘肃公开口径是超两千家规上工业企业完成数字化改造。',
    en: 'Gansu reported digital upgrades at over 2,000 above-scale industrial firms.',
    highlights: ['超两千家', '规上工业企业'],
  },
  {
    end: '覆盖率约七成。',
    zh: '覆盖率约七成。',
    en: 'Reported coverage was about 70%.',
    highlights: ['约七成'],
  },
  {
    end: '这些小微企业。',
    zh: '但这是规上工业口径，不代表餐饮、装修、民宿、美业这些小微企业。',
    en: 'This covers above-scale industry, not all small firms in local services.',
    highlights: ['规上工业口径', '不代表'],
  },
  {
    end: '所以这件事不能靠猜。',
    zh: '公开资料里还没有全省小微企业的统一调查，所以这件事不能靠猜。',
    en: 'I found no province-wide survey for small firms, so we cannot guess.',
    highlights: ['统一调查', '不能靠猜'],
  },
  {
    end: '老板呢，先问自己三个问题，',
    zh: '老板呢，先问自己三个问题。',
    en: 'Owners should ask three questions.',
    highlights: ['三个问题'],
  },
  {
    end: '能不能马上找到，',
    zh: '客户资料和订单记录，能不能马上找到？',
    en: 'Can customer and order records be found immediately?',
    highlights: ['客户资料', '订单记录'],
  },
  {
    end: '是不是同一个最新版本，',
    zh: '产品、价格、库存，是不是同一个最新版本？',
    en: 'Are product, price, and stock records on the same latest version?',
    highlights: ['同一个最新版本'],
  },
  {
    end: '有没有留下记录？',
    zh: '谁来更新，谁来确认，有没有留下记录？',
    en: 'Who updates, who confirms, and is there a record?',
    highlights: ['更新', '确认', '记录'],
  },
  {
    end: '可能只是让混乱跑得更快。',
    zh: '这几件事说不清，AI 用得越快，可能只是让混乱跑得更快。',
    en: 'If these are unclear, faster AI may only make the chaos run faster.',
    highlights: ['混乱跑得更快'],
  },
  {
    end: '最耗时间的流程，',
    zh: '先挑一条最容易漏、最耗时间的流程。',
    en: 'Start with one process that leaks easily and wastes the most time.',
    highlights: ['最容易漏', '最耗时间'],
  },
  {
    end: '客户从哪里来，',
    zh: '比如从咨询到报价，连续七天记下：客户从哪里来？',
    en: 'For seven days, track one process: where did the lead come from?',
    highlights: ['咨询到报价', '连续七天'],
  },
  {
    end: '结果怎么样。',
    zh: '问了什么，谁跟进，给了什么方案，结果怎么样？',
    en: 'What did they ask, who followed up, what was offered, and what happened?',
    highlights: ['谁跟进', '结果'],
  },
  {
    end: '提醒漏单。',
    zh: '资料脱敏后，再让 AI 找高频问题、整理回复、提醒漏单。',
    en: 'After anonymizing data, let AI find common questions, draft replies, and flag missed leads.',
    highlights: ['资料脱敏', '提醒漏单'],
  },
  {
    end: '结果准不准。',
    zh: '最后只看：省没省时间、少没少漏单、结果准不准。',
    en: 'Measure only time saved, missed leads reduced, and result accuracy.',
    highlights: ['省时间', '少漏单', '结果准'],
  },
  {
    end: '这就是数字化1.0。',
    zh: '这就是数字化 1.0。',
    en: 'That is Digitalization 1.0.',
    highlights: ['数字化 1.0'],
  },
  {
    end: '再看AI能不能接进去。',
    zh: '先让一条真实流程留下来，再看 AI 能不能接进去。',
    en: 'Keep one real process as data first, then see whether AI can connect.',
    highlights: ['真实流程', 'AI 接进去'],
  },
  {
    end: '甘肃本地企业的一个真实摸底。',
    zh: '接下来，我想做一次甘肃本地企业的真实摸底。',
    en: 'Next, I want to run a real survey of local businesses in Gansu.',
    highlights: ['甘肃本地企业', '真实摸底'],
  },
  {
    end: '评论区留下行业，',
    zh: '如果你是本地老板，评论区留下行业。',
    en: 'If you are a local owner, comment with your industry.',
    highlights: ['本地老板', '行业'],
  },
  {
    end: '最乱、最靠人记的环节，',
    zh: '再说一个最乱、最靠人记的环节。',
    en: 'Then name one process that is most chaotic and relies on memory.',
    highlights: ['最乱', '最靠人记'],
  },
  {
    end: '再挑一个行业，',
    zh: '我会公开样本量和行业分布，再挑一个行业。',
    en: 'I will publish the sample size and industry mix, then select one industry.',
    highlights: ['样本量', '行业分布'],
  },
  {
    end: '把数字化1.0到AI落地的过程做给大家看。',
    zh: '把数字化 1.0 到 AI 落地的过程做给大家看。',
    en: 'I will show the full path from Digitalization 1.0 to practical AI.',
    highlights: ['数字化 1.0', 'AI 落地'],
  },
  {
    end: '我在兰州记录AI怎么真正地落到本地企业里。',
    zh: '我是超哥，我在兰州记录 AI 怎么真正落到本地企业里。',
    en: 'I am Chao. In Lanzhou, I document how AI truly enters local businesses.',
    highlights: ['超哥', '兰州', '本地企业'],
  },
];

const spans = [];
let charOffset = 0;
for (const word of speechWords) {
  const text = String(word.text);
  spans.push({
    charStart: charOffset,
    charEnd: charOffset + text.length,
    start: Number(word.start ?? 0),
    end: Number(word.end ?? word.start ?? 0),
    text,
  });
  charOffset += text.length;
}

const spanAt = (offset) => {
  const span = spans.find((item) => offset >= item.charStart && offset < item.charEnd);
  if (!span) {
    throw new Error(`找不到字符 ${offset} 对应的词级时间戳`);
  }
  return span;
};

let cursor = 0;
const bilingual = pageSpecs.map((page, index) => {
  const punctuationPattern = /[，。？！,.?!]+$/u;
  const bareEnd = page.end.replace(punctuationPattern, '');
  let matchedEnd = page.end;
  let endStart = transcriptText.indexOf(matchedEnd, cursor);
  if (endStart < 0 && bareEnd !== page.end) {
    matchedEnd = bareEnd;
    endStart = transcriptText.indexOf(matchedEnd, cursor);
  }
  if (endStart < 0) {
    throw new Error(`第 ${index + 1} 页找不到结束锚点：${page.end}`);
  }

  let endOffset = endStart + matchedEnd.length;
  while (endOffset < transcriptText.length && /[，。？！,.?!]/u.test(transcriptText[endOffset])) {
    endOffset += 1;
  }
  const first = spanAt(cursor);
  const last = spanAt(endOffset - 1);
  cursor = endOffset;

  return {
    startMs: Math.max(0, Math.round(first.start * 1000)),
    endMs: Math.max(Math.round(first.start * 1000) + 120, Math.round(last.end * 1000) + 100),
    zh: page.zh,
    en: page.en,
    highlights: page.highlights,
  };
});

const trailing = transcriptText.slice(cursor).replace(/[\s，。？！、：；,.?!:;]/g, '');
if (trailing.length > 0) {
  throw new Error(`仍有未分配的实录文本：${trailing}`);
}

for (let index = 0; index < bilingual.length - 1; index += 1) {
  bilingual[index].endMs = Math.min(
    bilingual[index].endMs,
    Math.max(bilingual[index].startMs + 120, bilingual[index + 1].startMs - 40),
  );
}

for (const target of [cleanedPath, bilingualPath, textPath]) {
  fs.mkdirSync(path.dirname(target), {recursive: true});
}

fs.writeFileSync(cleanedPath, `${JSON.stringify(cleaned, null, 2)}\n`, 'utf8');
fs.writeFileSync(bilingualPath, `${JSON.stringify(bilingual, null, 2)}\n`, 'utf8');
fs.writeFileSync(textPath, `${transcriptText}\n`, 'utf8');

console.log(`已生成校正转写：${cleanedPath}`);
console.log(`已生成 ${bilingual.length} 页中英同窗字幕：${bilingualPath}`);
console.log(`实录字符：${transcriptText.length}；词级条目：${speechWords.length}`);
