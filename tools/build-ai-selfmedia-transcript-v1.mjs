import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const rawPath = path.join(
  projectRoot,
  'edit/20260808_ai_selfmedia_lowcost/transcripts/AI_SELFMEDIA_20260808_talk01_whisper-small-v1.json',
);
const cleanedPath = path.join(
  projectRoot,
  'edit/20260808_ai_selfmedia_lowcost/transcripts/AI_SELFMEDIA_20260808_talk01.cleaned.v1.json',
);
const bilingualPath = path.join(
  projectRoot,
  'remotion/public/data/AI_SELFMEDIA_20260808_talk01.bilingual.v1.json',
);
const textPath = path.join(
  projectRoot,
  'edit/20260808_ai_selfmedia_lowcost/transcripts/AI_SELFMEDIA_20260808_talk01.cleaned.v1.txt',
);
const comparisonPath = path.join(
  projectRoot,
  'edit/20260808_ai_selfmedia_lowcost/transcripts/AI_SELFMEDIA_20260808_talk01.script-comparison.v1.json',
);

const durationSeconds = 384.733333;
const durationMs = Math.round(durationSeconds * 1000);

const pages = [
  ['你是不是也一直觉得，自媒体是那种有团队、', 'Do you also think self-media is only for people with a team?', ['自媒体', '有团队']],
  ['口才好、敢出镜的人，才能干的事？', 'Only for people who speak well and dare to be on camera?', ['口才好', '敢出镜']],
  ['我今天必须给你说一句很扎心的话：', 'I need to tell you something blunt today.', ['扎心']],
  ['真正缺的根本不是设备，也不是露脸的勇气。', 'What you lack is not equipment or the courage to show your face.', ['不是设备', '露脸的勇气']],
  ['而是到现在都没看明白，', 'You still may not understand', ['没看明白']],
  ['平台到底为什么样的内容买单。', 'what kind of content platforms actually pay for.', ['平台', '内容买单']],
  ['我们直接看一个最硬核的例子。', 'Let us start with the clearest example.', ['硬核的例子']],
  ['YouTube为什么能成长为全球最大的视频平台之一？', 'Why did YouTube become one of the world’s largest video platforms?', ['YouTube', '全球最大']],
  ['不是因为它自己生产了所有视频，', 'It is not because YouTube produced every video itself.', ['不是因为']],
  ['而是因为它搭建了一个闭环。', 'It built a reinforcing loop.', ['闭环']],
  ['创作者持续生产内容，用户停留更久，', 'Creators keep publishing and users stay longer.', ['创作者', '用户停留']],
  ['商家愿意投广告，平台拿到广告和订阅收入之后，', 'Advertisers spend, and the platform earns ad and subscription revenue.', ['广告', '订阅收入']],
  ['再把一部分收益分给创作者。', 'Then part of that revenue is shared with creators.', ['分给创作者']],
  ['这个循环一旦转起来，优秀创作者就愿意留下来，', 'Once the loop works, strong creators stay.', ['循环', '创作者']],
  ['用户也愿意继续看，商家也愿意继续投。', 'Users keep watching, and advertisers keep spending.', ['继续看', '继续投']],
  ['YouTube官方披露过，过去四年，', 'YouTube has stated that over the past four years,', ['官方披露', '过去四年']],
  ['给创作者、艺术家和媒体公司支付超过1000亿美元。', 'it paid creators, artists, and media companies over 100 billion dollars.', ['1000亿美元']],
  ['Alphabet 2025年财报里也提到，', 'Alphabet’s 2025 results also stated that', ['Alphabet', '2025年财报']],
  ['YouTube广告和订阅年收入超过600亿美元。', 'YouTube annual ad and subscription revenue exceeded 60 billion dollars.', ['600亿美元']],
  ['这说明平台愿意为优质的注意力付钱。', 'Platforms are willing to pay for valuable attention.', ['优质的注意力', '付钱']],
  ['回到抖音，其实逻辑也类似，只是形式不一样。', 'Douyin follows a similar logic, though the formats differ.', ['抖音', '逻辑类似']],
  ['你能看到创作者伙伴计划、中视频相关收益、', 'There are creator programs and mid-length video revenue.', ['创作者伙伴计划', '中视频']],
  ['星图商单、全民任务、商品橱窗、', 'There are Xingtu deals, platform tasks, and product showcases.', ['星图商单', '全民任务']],
  ['精选联盟、直播带货。', 'There are affiliate programs and livestream commerce.', ['精选联盟', '直播带货']],
  ['这些不是让普通人躺着赚钱的按钮，', 'These are not buttons for effortless income.', ['不是', '躺着赚钱']],
  ['而是平台告诉你一件事：', 'They reveal one thing about the platform.', ['平台']],
  ['只要你能持续生产有价值的内容，', 'If you can consistently make valuable content,', ['持续', '有价值的内容']],
  ['平台、品牌、商家和用户之间，', 'the platform, brands, merchants, and users', ['平台', '品牌', '商家', '用户']],
  ['就存在一套可以分配收益的机制。', 'can participate in a mechanism that distributes revenue.', ['分配收益']],
  ['那么问题来了，过去普通人为什么很难做？', 'So why was this so difficult for ordinary people?', ['普通人', '为什么很难']],
  ['因为内容生产太贵了。', 'Because content production was too costly.', ['太贵了']],
  ['你要选题、查资料、写文案、拍摄、剪辑、', 'You need topics, research, copy, filming, and editing.', ['选题', '文案', '剪辑']],
  ['做封面、复盘数据等等。', 'You also need covers and data reviews.', ['封面', '复盘数据']],
  ['任何一个环节卡住，你就会停下来。', 'If any stage gets stuck, production stops.', ['卡住', '停下来']],
  ['很多人不是不想做自媒体，', 'Many people do want to create content.', ['不是不想做']],
  ['是一想到要露脸、要表达、要剪辑、要坚持，', 'But showing up, speaking, editing, and persisting feel overwhelming.', ['露脸', '表达', '剪辑', '坚持']],
  ['就已经放弃了。', 'So they give up before starting.', ['放弃']],
  ['但AI出来以后，这个门槛正在被压低。', 'AI is now lowering this barrier.', ['AI', '门槛', '压低']],
  ['你不会写文案，AI可以帮你整理逻辑。', 'AI can help structure your copy and reasoning.', ['写文案', '整理逻辑']],
  ['你不会找选题，AI可以帮你拆热点和同行。', 'AI can analyze trends and peer accounts for topics.', ['找选题', '拆热点']],
  ['你不会做脚本，AI可以把你的想法先变成提纲。', 'AI can turn your ideas into a script outline.', ['做脚本', '提纲']],
  ['你不想一开始出镜，可以先做图文、录屏、', 'If you do not want to appear at first, start with posts or screen recordings.', ['不出镜', '图文', '录屏']],
  ['口播字幕、知识卡片。', 'You can also make narrated captions or knowledge cards.', ['口播字幕', '知识卡片']],
  ['你不会复盘，AI可以帮你看评论、看数据，', 'AI can help review comments and performance data.', ['复盘', '评论', '数据']],
  ['找下一条怎么改。', 'Then it can suggest what to improve next.', ['下一条', '怎么改']],
  ['这就是我之前一直说的，', 'This is what I have been saying:', []],
  ['AI背后站着的是一整套文明级的认知能力。', 'AI is backed by accumulated, civilization-scale knowledge.', ['文明级', '认知能力']],
  ['但这里一定要说清楚：', 'But one point must be clear.', ['说清楚']],
  ['AI不是替你赚钱，AI是替你降低试错成本。', 'AI does not earn for you. It lowers the cost of experimentation.', ['不是替你赚钱', '降低试错成本']],
  ['真正要你做的是，把一个问题讲清楚，', 'Your job is to explain one problem clearly,', ['问题讲清楚']],
  ['把一个经验讲明白，把一个工具用给别人看，', 'make one experience understandable, and show a tool in use,', ['经验', '工具']],
  ['把这个过程持续地记录下来。', 'then keep documenting the process.', ['持续记录']],
  ['普通人今天最现实的路径，不是辞职All in，', 'The realistic path is not quitting your job and going all in.', ['不是辞职', 'All in']],
  ['也不是一上来就买课、囤工具、搞矩阵。', 'Nor is it buying courses, hoarding tools, or building account matrices.', ['买课', '囤工具', '搞矩阵']],
  ['更现实的是，先用AI跑一个30条内容的小闭环。', 'A better start is a 30-post experiment powered by AI.', ['30条内容', '小闭环']],
  ['第一步，选一个你能长期观察的人群。', 'Step one: choose a group you can observe for the long term.', ['第一步', '长期观察']],
  ['比如本地老板、设计师、宝妈、职场新人、', 'For example, local owners, designers, mothers, or new professionals.', ['本地老板', '设计师', '宝妈']],
  ['个体户、AI小白等等。', 'It could also be sole traders or AI beginners.', ['个体户', 'AI小白']],
  ['第二步，只解决他们的一个具体问题。', 'Step two: solve one specific problem for them.', ['第二步', '一个具体问题']],
  ['不要一上来就讲什么“AI改变世界”，', 'Do not begin with a vague claim that AI will change the world.', ['AI改变世界']],
  ['而是讲“不会写文案怎么办”，', 'Explain what to do when someone cannot write copy.', ['不会写文案']],
  ['“不敢出镜怎么做账号”，', 'Explain how to build an account without appearing on camera.', ['不敢出镜']],
  ['“一个人怎么低成本地开始记录”。', 'Explain how one person can start documenting at low cost.', ['低成本', '开始记录']],
  ['第三步，就是用AI把内容的成本降下来。', 'Step three: use AI to reduce production cost.', ['第三步', '成本降下来']],
  ['每天产出一个选题、一个脚本、', 'Produce one topic and one script each day.', ['选题', '脚本']],
  ['一张封面的思路和一个发布复盘。', 'Add one cover concept and one post review.', ['封面思路', '发布复盘']],
  ['第四步，看真实的反馈。', 'Step four: inspect real feedback.', ['第四步', '真实反馈']],
  ['有没有人看完？有没有人收藏？', 'Did anyone finish watching or save it?', ['看完', '收藏']],
  ['有没有人评论说“这个我用得上”？', 'Did anyone comment that it was useful?', ['我用得上']],
  ['有没有人私信问下一步？', 'Did anyone message you to ask what comes next?', ['私信', '下一步']],
  ['如果这四步跑不通，别着急谈变现。', 'If these four steps fail, do not rush to monetization.', ['跑不通', '别着急谈变现']],
  ['因为平台不是奖励你的努力，', 'The platform does not reward effort by itself.', ['不是奖励努力']],
  ['平台奖励的是用户愿意停留的内容。', 'It rewards content that users choose to stay with.', ['用户愿意停留']],
  ['但你只要持续跑，哪怕没赚到钱，', 'Keep running the experiment, even before it earns money.', ['持续跑', '没赚到钱']],
  ['你也已经在积累一个非常重要的东西：数字资产。', 'You are still building something important: a digital asset.', ['数字资产']],
  ['你的每一条内容，都是一次公开表达。', 'Every post is a public expression of your thinking.', ['公开表达']],
  ['你的每一次复盘，都是一次市场反馈。', 'Every review is a piece of market feedback.', ['市场反馈']],
  ['你的每一个案例、观点、方法、失败记录，', 'Every case, viewpoint, method, and failure record', ['案例', '观点', '方法', '失败记录']],
  ['都会变成别人判断你的材料。', 'becomes evidence others can use to assess you.', ['判断你的材料']],
  ['这比你把想法藏进脑子里，强得太多了。', 'That is far better than keeping every idea in your head.', ['藏进脑子里']],
  ['因为没人知道你会什么，机会就不会来找你。', 'If nobody knows what you can do, opportunities cannot find you.', ['机会', '不会来找你']],
  ['你不发布、不测试、不接受反馈，', 'If you never publish, test, or accept feedback,', ['发布', '测试', '反馈']],
  ['你永远不知道自己的判断到底对不对。', 'you will never know whether your judgment is right.', ['判断', '对不对']],
  ['所以作为普通人，我给大家的建议很简单：', 'So my advice to ordinary people is simple.', ['普通人', '建议']],
  ['不要先问AI能不能让你赚钱。', 'Do not first ask whether AI can make you money.', ['不要先问', '赚钱']],
  ['我们先问三个问题。', 'Ask these three questions first.', ['三个问题']],
  ['你能不能用AI，把一个具体的问题讲清楚？', 'Can you use AI to explain one specific problem clearly?', ['具体问题', '讲清楚']],
  ['你能不能用最低的成本，连续发30条内容？', 'Can you publish 30 posts continuously at minimal cost?', ['最低成本', '30条内容']],
  ['我能不能把这些内容，变成别人看得到、', 'Can I turn this content into something people can see,', ['看得到']],
  ['能判断、能信任我的数字资产？', 'evaluate, and use to decide whether to trust me?', ['能判断', '能信任', '数字资产']],
  ['这条路不保证你一定变现，', 'This path does not guarantee monetization.', ['不保证变现']],
  ['也不保证平台一定给你流量。', 'It does not guarantee platform traffic either.', ['不保证流量']],
  ['但是对于一个没有团队、没有资本、', 'But for someone without a team or capital,', ['没有团队', '没有资本']],
  ['没有现成资源的普通人来说，', 'and without ready-made resources,', ['没有现成资源', '普通人']],
  ['AI加自媒体，可能是目前最值得尝试的', 'AI plus self-media may be one of today’s most worthwhile', ['AI加自媒体', '值得尝试']],
  ['低成本路径之一。', 'low-cost paths to test.', ['低成本路径']],
  ['因为它花掉的不是你的全部身家，', 'It does not require risking everything you own.', ['不是全部身家']],
  ['而是你的认知、时间和持续的反馈能力。', 'It asks for your thinking, time, and ability to keep learning from feedback.', ['认知', '时间', '反馈能力']],
  ['你不需要一开始就成为一个大博主。', 'You do not need to begin as a major creator.', ['不需要', '大博主']],
  ['你先成为一个被看见的人。', 'First, become someone who can be seen.', ['被看见']],
  ['我从7月8号开始做这个口播视频到现在，', 'I started making these talking-head videos on July 8.', ['7月8号', '口播视频']],
  ['其实也就刚好一个月。', 'It has now been exactly one month.', ['一个月']],
  ['在这个过程当中，我是在不断地去验证，', 'Throughout this process, I have kept testing', ['不断验证']],
  ['AI通过所有的这些赋能，到底能带来什么。', 'what AI-enabled support can actually bring me.', ['AI赋能', '带来什么']],
  ['其实在这个短期当中，我也收获很多。', 'Even in this short period, I have gained a lot.', ['短期', '收获']],
  ['也加到了很多的一些粉丝，', 'I have also connected with a number of followers,', ['粉丝']],
  ['包括兰州本地的一些创业者。', 'including entrepreneurs here in Lanzhou.', ['兰州本地', '创业者']],
  ['我觉得这就是一个收获。', 'I see that as a real gain already.', ['收获']],
  ['至于它未来如何去变现、能不能变现，', 'As for how or whether it will monetize in the future,', ['未来', '变现']],
  ['我长期去做这样的一个数字资产的积累，', 'I will keep accumulating this kind of digital asset.', ['长期', '数字资产']],
  ['我相信它一定是有价值的。', 'I believe that long-term accumulation has value.', ['有价值']],
  ['所以作为普通人来说，我们第一步真的一定要开始。', 'For ordinary people, the first real step is simply to begin.', ['第一步', '一定要开始']],
  ['一定要开始。', 'You must begin.', ['开始']],
  ['我是超哥，我在兰州AI创业。', 'I am Chao, building an AI venture in Lanzhou.', ['超哥', '兰州AI创业']],
].map(([zh, en, highlights]) => ({zh, en, highlights}));

const normalizeCharacters = (text) =>
  [...String(text)]
    .filter((character) => /[\p{L}\p{N}]/u.test(character))
    .map((character) => character.toLowerCase());

const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
const rawSegments = Array.isArray(raw.transcription) ? raw.transcription : [];
const rawUnits = rawSegments.flatMap((segment, segmentIndex) => {
  const segmentStart = Number(segment.offsets?.from ?? 0);
  const segmentEnd = Number(segment.offsets?.to ?? segmentStart + 20);
  return (segment.tokens ?? []).flatMap((token) => {
    const rawText = String(token.text ?? '');
    if (!rawText || rawText.startsWith('[_')) return [];
    const characters = normalizeCharacters(rawText);
    if (characters.length === 0) return [];
    const tokenStart = Number(token.offsets?.from ?? segmentStart);
    const tokenEnd = Math.max(
      tokenStart + 20,
      Number(token.offsets?.to ?? segmentEnd),
    );
    return characters.map((character, index) => ({
      text: character,
      startMs:
        tokenStart + ((tokenEnd - tokenStart) * index) / characters.length,
      endMs:
        tokenStart +
        ((tokenEnd - tokenStart) * (index + 1)) / characters.length,
      confidence: Number.isFinite(Number(token.p)) ? Number(token.p) : null,
      segmentIndex,
    }));
  });
});

const targetCharacters = pages.flatMap((page) => normalizeCharacters(page.zh));
const sourceCharacters = rawUnits.map((unit) => unit.text);
const rows = sourceCharacters.length + 1;
const columns = targetCharacters.length + 1;
const distance = Array.from({length: rows}, () => new Uint16Array(columns));
for (let row = 0; row < rows; row += 1) distance[row][0] = row;
for (let column = 0; column < columns; column += 1) distance[0][column] = column;
for (let row = 1; row < rows; row += 1) {
  for (let column = 1; column < columns; column += 1) {
    const substitution =
      distance[row - 1][column - 1] +
      (sourceCharacters[row - 1] === targetCharacters[column - 1] ? 0 : 1);
    distance[row][column] = Math.min(
      substitution,
      distance[row - 1][column] + 1,
      distance[row][column - 1] + 1,
    );
  }
}

const mapped = Array(targetCharacters.length).fill(null);
let row = sourceCharacters.length;
let column = targetCharacters.length;
while (row > 0 || column > 0) {
  if (
    row > 0 &&
    column > 0 &&
    distance[row][column] ===
      distance[row - 1][column - 1] +
        (sourceCharacters[row - 1] === targetCharacters[column - 1] ? 0 : 1)
  ) {
    mapped[column - 1] = rawUnits[row - 1];
    row -= 1;
    column -= 1;
  } else if (
    row > 0 &&
    distance[row][column] === distance[row - 1][column] + 1
  ) {
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
  const start = cursor;
  while (cursor < mapped.length && !mapped[cursor]) cursor += 1;
  const end = cursor;
  const previousEnd =
    start > 0 && mapped[start - 1] ? mapped[start - 1].endMs : 0;
  const nextStart =
    end < mapped.length && mapped[end] ? mapped[end].startMs : durationMs;
  const available = Math.max(20 * (end - start), nextStart - previousEnd);
  for (let index = start; index < end; index += 1) {
    const offset = index - start;
    mapped[index] = {
      text: targetCharacters[index],
      startMs:
        previousEnd + (available * offset) / Math.max(1, end - start),
      endMs:
        previousEnd + (available * (offset + 1)) / Math.max(1, end - start),
      confidence: null,
      segmentIndex: null,
    };
  }
}

let monotonicMs = 0;
const words = targetCharacters.map((text, index) => {
  const unit = mapped[index];
  const startMs = Math.max(monotonicMs, Math.round(unit.startMs));
  const endMs = Math.max(startMs + 20, Math.round(unit.endMs));
  monotonicMs = endMs;
  return {
    text,
    start: startMs / 1000,
    end: endMs / 1000,
    type: 'word',
    speaker_id: 'speaker_0',
    confidence: unit.confidence,
    raw_segment_index: unit.segmentIndex,
  };
});

const bilingual = [];
let characterCursor = 0;
let pageStartMs = Math.round(words[0]?.start * 1000) || 0;
for (const [pageIndex, page] of pages.entries()) {
  characterCursor += normalizeCharacters(page.zh).length;
  const finalWord = words[Math.max(0, characterCursor - 1)];
  const naturalEndMs = Math.round(finalWord.end * 1000);
  const pageEndMs =
    pageIndex === pages.length - 1
      ? durationMs
      : Math.max(pageStartMs + 180, naturalEndMs);
  bilingual.push({
    startMs: pageStartMs,
    endMs: pageEndMs,
    zh: page.zh,
    en: page.en,
    highlights: page.highlights ?? [],
  });
  pageStartMs = pageEndMs;
}

const transcriptText = pages.map((page) => page.zh).join('');
const cleaned = {
  schema_version: 1,
  source: path.relative(projectRoot, rawPath),
  method:
    'whisper.cpp small本机离线词级转写 + 用户确认稿对照 + 实际口语上下文校正 + 结尾片段二次识别 + 全局字符时间映射',
  language: 'zh',
  duration_seconds: durationSeconds,
  text: transcriptText,
  words,
  pages: bilingual,
  correction_policy:
    '只修正可由原声上下文、用户确认稿或二次片段识别共同确认的ASR错字；保留实拍开头、口语变化和新增个人结尾，不删除、压缩或重排原声。',
};

const comparison = {
  schema_version: 1,
  source_video:
    'source/20260808_ai_selfmedia_lowcost/01_口播原片/R01_AI自媒体低成本起号_口播原片.MOV',
  approved_script:
    'notes/2026-08-08-AI自媒体低成本起号-用户最终确认稿-v1.md',
  policy:
    '正片完整保留真实原声，字幕按实际口播校正；个人观察不升级为统计结论，画面不添加虚构粉丝数、收益或流量。',
  observed_differences: [
    {
      type: 'stronger_spoken_hook',
      spoken:
        '你是不是也一直觉得，自媒体是那种有团队、口才好、敢出镜的人才能干的事？',
      action: '按真实口语完整保留，论点仍落在平台为什么样的内容买单。',
    },
    {
      type: 'spoken_wording_variants',
      spoken:
        '正文存在“硬核例子”“小闭环”“发布复盘”等自然口语变化。',
      action: '只校正明显ASR错字，不强行替换成书面稿。',
    },
    {
      type: 'personal_one_month_ending_added',
      spoken:
        '7月8日至8月8日持续验证AI赋能，并提到连接到粉丝和兰州本地创业者。',
      action:
        '完整保留为本人观察；不展示数量、收益或保证性数据，画面标明“个人实践记录”。',
    },
    {
      type: 'closing_identity_retained',
      spoken: '我是超哥，我在兰州AI创业。',
      action: '完整保留为真实结尾。',
    },
  ],
  omitted_core_sections: [],
  repeated_full_sections: [],
  ending_complete: true,
  retake_or_cut_required: false,
};

for (const targetPath of [cleanedPath, bilingualPath, textPath, comparisonPath]) {
  fs.mkdirSync(path.dirname(targetPath), {recursive: true});
}
fs.writeFileSync(cleanedPath, `${JSON.stringify(cleaned, null, 2)}\n`, 'utf8');
fs.writeFileSync(bilingualPath, `${JSON.stringify(bilingual, null, 2)}\n`, 'utf8');
fs.writeFileSync(textPath, `${transcriptText}\n`, 'utf8');
fs.writeFileSync(
  comparisonPath,
  `${JSON.stringify(comparison, null, 2)}\n`,
  'utf8',
);

console.log(`原始分段：${rawSegments.length}`);
console.log(`校正字符：${words.length}`);
console.log(`双语字幕页：${bilingual.length}`);
console.log(`全局编辑距离：${distance.at(-1).at(-1)}`);
console.log(`校正转写：${cleanedPath}`);
console.log(`脚本差异：${comparisonPath}`);
