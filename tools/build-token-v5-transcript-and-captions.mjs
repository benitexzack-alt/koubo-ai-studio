import fs from 'node:fs';
import path from 'node:path';

const [rawPath, cleanedPath, captionsPath, bilingualPath, textPath] = process.argv.slice(2);

if (!rawPath || !cleanedPath || !captionsPath || !bilingualPath || !textPath) {
  console.error(
    '用法：node tools/build-token-v5-transcript-and-captions.mjs <raw.json> <cleaned.json> <captions.json> <bilingual.json> <transcript.txt>',
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

// 只修正能由锁定稿、上下文和专名共同确认的识别错误；不删除口头停顿或改写原声。
replaceSequence(['声', '誉'], ['生', '意']);
replaceSequence(['你', '要', '豆', '包'], ['你', '让', '豆', '包']);
replaceSequence(['DeepThink'], ['DeepSeek']);
replaceSequence(['电', '网'], ['电', '脑']);
replaceSequence(['光', '伏', '块'], ['光', '模', '块']);
replaceSequence(['大', '型', '的', '服', '务'], ['大', '模', '型', '服', '务']);
replaceSequence(['聋', '小', '糖'], ['陇', '小', '郎']);
replaceSequence(['守', '门', '的'], ['首', '轮', '的']);
replaceSequence(['能', '进', '取'], ['能', '进', '去']);
replaceSequence(['教', '得', '出', '去'], ['交', '得', '出', '去']);

const speechWords = words.filter(
  (word) => word?.type === 'word' && String(word.text ?? '').trim().length > 0,
);
const transcriptText = speechWords.map((word) => String(word.text)).join('');

const captions = speechWords.map((word) => {
  const startMs = Math.max(0, Math.round(Number(word.start ?? 0) * 1000));
  const endMs = Math.max(startMs + 60, Math.round(Number(word.end ?? word.start ?? 0) * 1000));
  return {
    text: String(word.text),
    startMs,
    endMs,
    timestampMs: startMs,
    confidence:
      typeof word.logprob === 'number' ? Math.max(0, Math.min(1, 1 + word.logprob)) : null,
  };
});

const pageSpecs = [
  {end: '开始运转。', zh: '你问豆包一句话，背后就有一整条产业链开始运转。', en: 'Ask Doubao one question, and an entire industrial chain starts running.', highlights: ['一整条产业链']},
  {end: '石油推动机器。', zh: '工业时代，石油推动机器。', en: 'In the industrial age, oil powered machines.', highlights: ['石油']},
  {end: '流量推动了生意。', zh: '互联网时代，流量推动了生意。', en: 'In the internet age, traffic powered business.', highlights: ['流量']},
  {end: '叫做Token。', zh: '到了 AI 时代，最基础的一种消耗叫做 Token。', en: 'In the AI age, a basic unit of consumption is the token.', highlights: ['Token']},
  {end: '有什么关系？', zh: '可这跟我们普通人又有什么关系？', en: 'But what does this have to do with ordinary people?', highlights: ['普通人']},
  {end: '这条链理清楚。', zh: '今天，就把 Token 背后这条链理清楚。', en: 'Today, let us map the chain behind tokens.', highlights: ['这条链']},
  {end: '能站在哪儿。', zh: '听完你再判断，自己能站在哪儿。', en: 'Then decide where you can stand in it.', highlights: ['站在哪儿']},
  {end: 'Token到底是什么？', zh: 'Token 到底是什么？', en: 'What exactly is a token?', highlights: ['Token']},
  {end: '也不是算力。', zh: '它不是虚拟货币，也不是算力。', en: 'It is neither virtual currency nor computing power.', highlights: ['不是虚拟货币', '不是算力']},
  {end: '计量单位。', zh: '说简单点，它是大模型处理信息时的计量单位。', en: 'Simply put, it measures information processed by a large model.', highlights: ['计量单位']},
  {end: '回复一段话，', zh: '你让豆包回复一段话。', en: 'You ask Doubao to reply with a paragraph.', highlights: ['豆包']},
  {end: '写一份文案，', zh: 'DeepSeek 写一份文案。', en: 'DeepSeek writes a piece of copy.', highlights: ['DeepSeek']},
  {end: '分析一份文件，', zh: 'Kimi 分析一份文件。', en: 'Kimi analyzes a document.', highlights: ['Kimi']},
  {end: '都会拆成Token。', zh: '输入和输出，都会拆成 Token。', en: 'Both input and output are broken into tokens.', highlights: ['输入', '输出', 'Token']},
  {end: 'AI应用，', zh: '企业只要在用大模型、智能体或者 AI 应用。', en: 'Whenever a company uses models, agents, or AI applications,', highlights: ['大模型', '智能体', 'AI 应用']},
  {end: '持续消耗。', zh: 'Token 和背后的算力就在持续消耗。', en: 'tokens and the computing power behind them are continuously consumed.', highlights: ['持续消耗']},
  {end: '这条产业链。', zh: '如果你只在聊天框里用 AI，很容易看不到这条产业链。', en: 'Using AI only in a chat box can hide the industrial chain behind it.', highlights: ['聊天框', '产业链']},
  {end: '各种智能终端，', zh: '等它接入手机、电脑、企业系统和各种智能终端。', en: 'As AI enters phones, computers, business systems, and smart devices,', highlights: ['手机', '电脑', '企业系统']},
  {end: '往外长。', zh: '围绕 Token 的生意还会继续往外长。', en: 'the businesses around tokens will keep expanding.', highlights: ['继续往外长']},
  {end: '光模块、', zh: '先看上游：芯片、服务器、光模块。', en: 'Start upstream with chips, servers, and optical modules.', highlights: ['上游', '芯片', '服务器', '光模块']},
  {end: '基础建设。', zh: '数据中心、电力、网络、冷却系统，共同构成大模型服务背后的基础建设。', en: 'Data centers, power, networks, and cooling form the infrastructure behind model services.', highlights: ['数据中心', '电力', '冷却系统']},
  {end: '这些东西和算力。', zh: '上游卖的就是这些东西和算力。', en: 'The upstream sells infrastructure and computing power.', highlights: ['上游', '算力']},
  {end: '云平台、', zh: '再往中间走，就是大模型公司、云平台。', en: 'In the middle are large-model companies and cloud platforms.', highlights: ['中间', '大模型公司', '云平台']},
  {end: 'AI开发工具，', zh: '还有智能体平台和 AI 开发工具。', en: 'They also include agent platforms and AI development tools.', highlights: ['智能体平台', 'AI 开发工具']},
  {end: '直接调用的能力。', zh: '它们把底层算力封装成企业可以直接调用的能力。', en: 'They package computing power into capabilities companies can call directly.', highlights: ['封装', '直接调用']},
  {end: '平台和服务。', zh: '中游卖模型，也卖平台和服务。', en: 'The midstream sells models, platforms, and services.', highlights: ['中游', '模型', '平台和服务']},
  {end: '最近的下游。', zh: '链条最后一段，才是离普通人最近的下游。', en: 'The last link, downstream applications, is closest to ordinary people.', highlights: ['下游']},
  {end: '本地服务，', zh: '医疗、教育、制造、农业、内容、电商和本地服务。', en: 'Healthcare, education, manufacturing, agriculture, content, e-commerce, and local services.', highlights: ['医疗', '制造', '农业', '本地服务']},
  {end: '下游应用。', zh: '只要把 AI 接进一项真实业务，都算下游应用。', en: 'Connecting AI to a real workflow creates a downstream application.', highlights: ['真实业务', '下游应用']},
  {end: '不一定是模型，', zh: '它不一定训练大模型，客户最后买的也不一定是模型。', en: 'It may not train a model, and a model is not necessarily what customers buy.', highlights: ['不一定']},
  {end: '有用的结果。', zh: '客户买的是一个有用的结果。', en: 'Customers buy a useful result.', highlights: ['有用的结果']},
  {end: '下游卖结果。', zh: '上游卖算力，中游卖模型，下游卖结果。', en: 'Upstream sells compute, midstream sells models, downstream sells results.', highlights: ['卖算力', '卖模型', '卖结果']},
  {end: '很容易听歪，', zh: '还有“Token 出海”，这个词很容易听歪。', en: 'The phrase token export is also easy to misunderstand.', highlights: ['Token 出海', '听歪']},
  {end: '装车运送，', zh: '它不是把 Token 像石油一样装车运送。', en: 'It does not mean loading tokens onto trucks like oil.', highlights: ['不是装车运送']},
  {end: '变成算力，', zh: '而是把电力、服务器和数据中心变成算力。', en: 'It means turning power, servers, and data centers into computing services.', highlights: ['变成算力']},
  {end: '服务送出去。', zh: '再通过网络，把算力和模型服务送出去。', en: 'Then delivering compute and model services through networks.', highlights: ['通过网络', '送出去']},
  {end: '这条链上。', zh: '甘肃已经在这条链上。', en: 'Gansu is already on this chain.', highlights: ['甘肃']},
  {end: '国家枢纽节点，', zh: '国家已经批复甘肃建设全国一体化算力网络国家枢纽节点。', en: 'China approved Gansu as a national hub node of the integrated computing network.', highlights: ['甘肃', '国家枢纽节点']},
  {end: '数据中心集群，', zh: '庆阳正在建设数据中心集群。', en: 'Qingyang is building a data-center cluster.', highlights: ['庆阳', '数据中心集群']},
  {end: '算力保障能力。', zh: '目标之一是形成面向全国的算力保障能力。', en: 'One goal is to provide computing support for the country.', highlights: ['面向全国', '算力保障能力']},
  {end: '研发的陇小郎，', zh: '甘肃省中医院研发的“陇小郎”。', en: 'Longxiaolang was developed by Gansu Provincial Hospital of Traditional Chinese Medicine.', highlights: ['陇小郎']},
  {end: 'AI结合，', zh: '把中医舌诊经验和 AI 结合。', en: 'It combines AI with experience in traditional Chinese tongue diagnosis.', highlights: ['AI 结合']},
  {end: '首轮的成果转化。', zh: '已经完成独家授权和首轮成果转化。', en: 'It has completed exclusive authorization and its first result transfer.', highlights: ['独家授权', '首轮成果转化']},
  {end: '行业应用。', zh: '这就是一个发生在甘肃的行业应用。', en: 'This is an industry application happening in Gansu.', highlights: ['甘肃', '行业应用']},
  {end: '比较清楚了。', zh: '说到这里，普通人的位置就比较清楚了。', en: 'At this point, the position for ordinary people is clearer.', highlights: ['普通人的位置']},
  {end: '技术团队。', zh: '建数据中心需要资本，训练大模型需要技术团队。', en: 'Data centers need capital; training models needs a technical team.', highlights: ['资本', '技术团队']},
  {end: '就是下游。', zh: '对普通人和本地创业者来说，能进去的地方就是下游。', en: 'For ordinary people and local founders, downstream is the accessible layer.', highlights: ['下游']},
  {end: '门店、财务，', zh: '你懂餐饮、制造、农业、销售、门店或财务。', en: 'You may know restaurants, manufacturing, agriculture, sales, retail, or finance.', highlights: ['你懂']},
  {end: '业务流程，', zh: '哪怕只吃透一条具体的业务流程。', en: 'Even mastering one specific business workflow can be enough.', highlights: ['一条业务流程']},
  {end: '现成的模型和算力，', zh: '都有机会借助现成的模型和算力。', en: 'You can build on models and computing power that already exist.', highlights: ['现成的模型和算力']},
  {end: '能交付的系统。', zh: '把它做成 AI 应用、服务，或者一个能交付的系统。', en: 'Turn it into an AI application, a service, or a deliverable system.', highlights: ['能交付']},
  {end: '企业AI的原因。', zh: '这就是我留在兰州做企业 AI 的原因。', en: 'That is why I stayed in Lanzhou to work on enterprise AI.', highlights: ['兰州', '企业 AI']},
  {end: '本地企业的业务里，', zh: '我想把上游算力、中游模型，接到甘肃本地企业的业务里。', en: 'I want to connect upstream compute and midstream models to local Gansu businesses.', highlights: ['甘肃本地企业']},
  {end: '交得出去的应用。', zh: '最后做成有人用、交得出去的应用。', en: 'The goal is an application people use and that can actually be delivered.', highlights: ['有人用', '交得出去']},
  {end: 'Token红利，', zh: '普通人想抓住 Token 红利。', en: 'If ordinary people want to seize the token opportunity,', highlights: ['Token 红利']},
  {end: '猜哪家公司会上，上涨。', zh: '别着急追名词，也别着急猜哪家公司会涨、上涨。', en: 'do not rush after buzzwords or guess which company will rise.', highlights: ['别着急']},
  {end: '站在哪里。', zh: '先把这条链看清楚，再决定自己站在哪里。', en: 'See the chain clearly first, then decide where you can stand.', highlights: ['看清楚', '站在哪里']},
  {end: '记录AI创业。', zh: '关注我，我是超哥，在兰州记录 AI 创业。', en: 'Follow me. I am Chao, documenting AI entrepreneurship in Lanzhou.', highlights: ['超哥', '兰州']},
];

const spans = [];
let charOffset = 0;
for (const word of speechWords) {
  const text = String(word.text);
  spans.push({
    charStart: charOffset,
    charEnd: charOffset + text.length,
    startMs: Math.round(Number(word.start ?? 0) * 1000),
    endMs: Math.max(
      Math.round(Number(word.start ?? 0) * 1000) + 60,
      Math.round(Number(word.end ?? word.start ?? 0) * 1000),
    ),
  });
  charOffset += text.length;
}

const bilingual = [];
let cursor = 0;
for (const spec of pageSpecs) {
  const foundAt = transcriptText.indexOf(spec.end, cursor);
  if (foundAt < 0) {
    throw new Error(`未找到双语字幕终点：${spec.end}`);
  }

  const pageEndChar = foundAt + spec.end.length;
  const pageSpans = spans.filter((span) => span.charEnd > cursor && span.charStart < pageEndChar);
  if (pageSpans.length === 0) {
    throw new Error(`双语字幕没有词级时间：${spec.zh}`);
  }

  bilingual.push({
    startMs: pageSpans[0].startMs,
    endMs: pageSpans[pageSpans.length - 1].endMs,
    zh: spec.zh,
    en: spec.en,
    highlights: spec.highlights,
  });
  cursor = pageEndChar;
}

if (cursor !== transcriptText.length) {
  throw new Error(`仍有未覆盖转写文本：${transcriptText.slice(cursor)}`);
}

const cleaned = {
  ...raw,
  text: transcriptText,
  words,
  correction_note:
    '仅机械修正：生意、你让豆包、DeepSeek、电脑、光模块、大模型服务、陇小郎、首轮、能进去、交得出去；未删除或重排原声。',
};

for (const target of [cleanedPath, captionsPath, bilingualPath, textPath]) {
  fs.mkdirSync(path.dirname(target), {recursive: true});
}

fs.writeFileSync(cleanedPath, `${JSON.stringify(cleaned, null, 2)}\n`, 'utf8');
fs.writeFileSync(captionsPath, `${JSON.stringify(captions, null, 2)}\n`, 'utf8');
fs.writeFileSync(bilingualPath, `${JSON.stringify(bilingual, null, 2)}\n`, 'utf8');
fs.writeFileSync(textPath, `${transcriptText}\n`, 'utf8');

console.log(`已生成校正转写：${cleanedPath}`);
console.log(`已生成词级字幕：${captionsPath}（${captions.length} 条）`);
console.log(`已生成双语句群字幕：${bilingualPath}（${bilingual.length} 页）`);
console.log(`已生成校正全文：${textPath}`);
