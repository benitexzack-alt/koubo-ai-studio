import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const rawPath = path.join(
  root,
  'edit/20260823_wechat_geo_aao/transcripts/WECHAT_GEO_AAO_20260823_talk01_whisper-small-split-v1.json',
);
const scriptPath = path.join(
  root,
  'notes/2026-08-22-GEO-AAO-微信变化到服务入口-正式口播稿-v2.md',
);
const cleanedPath = path.join(
  root,
  'edit/20260823_wechat_geo_aao/transcripts/WECHAT_GEO_AAO_20260823_talk01.cleaned.v1.json',
);
const comparisonPath = path.join(
  root,
  'edit/20260823_wechat_geo_aao/transcripts/WECHAT_GEO_AAO_20260823_talk01.script-comparison.v1.json',
);
const bilingualPath = path.join(
  root,
  'remotion/public/data/WECHAT_GEO_AAO_20260823.bilingual.v1.json',
);
const textPath = path.join(
  root,
  'edit/20260823_wechat_geo_aao/transcripts/WECHAT_GEO_AAO_20260823_talk01.cleaned.v1.txt',
);

// These are caption pages for the words actually spoken in the recording.
// The approved script is used only to resolve clear ASR spelling errors.
const pages = [
  ['有没有人发现，微信下面那个“按住说话”的框，', 'Have you noticed WeChat\'s hold-to-talk box', ['按住说话']],
  ['颜色跟以前不一样了？', 'now looks different?', ['颜色']],
  ['还有一个更惊人的功能啊。', 'There is an even more surprising feature.', ['更惊人的功能']],
  ['聊天里的图片，你点一下，', 'Tap an image in a chat,', ['聊天图片']],
  ['下面会出来一个“AI处理”。', 'and an AI Processing option appears.', ['AI处理']],
  ['美化、提取信息、修改图片，都在里面。', 'It can enhance, extract information, and edit the image.', ['美化', '提取信息', '修改图片']],
  ['它可以把一张图片的风格直接改掉。', 'It can directly change the style of an image.', ['改变风格']],
  ['然后这里面用到的，', 'The model used here', []],
  ['可能是腾讯的混元生图模型。', 'may be Tencent\'s Hunyuan image model.', ['可能', '混元生图']],
  ['那么再往下，我问它：', 'Then I asked it:', []],
  ['我现在在兰州中心附近，四个人，不吃辣，', 'We are four people near Lanzhou Center and do not eat spicy food.', ['兰州中心', '四个人', '不吃辣']],
  ['想吃清淡一点，最好就是减肥期也能吃。', 'We want something light that also fits a diet.', ['清淡', '减肥期']],
  ['以前碰到这种问题，我们四个人可能就要开始分工了。', 'Before, the four of us would split up the search.', ['四个人分工']],
  ['一个刷短视频，一个翻评论，', 'One checked short videos and another read reviews.', ['短视频', '评论']],
  ['一个打开地图，还有一个问朋友。', 'One opened a map, and another asked a friend.', ['地图', '朋友']],
  ['这次它先给到了几个方向，', 'This time, it first suggested a few directions,', ['几个方向']],
  ['然后直接把位置落到了地图上。', 'then placed the options directly on a map.', ['地图']],
  ['点进一家店，后面接着就是门店的小程序、', 'Open a store, and its mini program follows,', ['门店小程序']],
  ['菜单和点餐页面。', 'along with the menu and ordering page.', ['菜单', '点餐页面']],
  ['老板们，到这儿看明白了没有？', 'Business owners, do you see the point?', ['老板们']],
  ['这里最值得我们研究的，不是它推荐了哪家店，', 'What matters is not which store it recommended,', ['不是推荐哪家店']],
  ['是用户问完一句话之后，', 'but whether, after one request,', ['一句话']],
  ['他有没有一条路能继续地往店里面走。', 'the user has a path that continues toward the store.', ['继续往店里走']],
  ['这条路径对做餐饮、零售和本地服务的人，', 'For restaurants, retail, and local services,', ['餐饮', '零售', '本地服务']],
  ['已经够值得看了。', 'this path is already worth watching.', ['值得看']],
  ['以前，客户是在各个平台里面一点一点地找你。', 'Before, customers found you bit by bit across platforms.', ['各个平台']],
  ['以后，他可能把“我在哪儿、几个人、想吃什么、', 'In future, they may state their location, group size, and food preference,', ['在哪儿', '几个人', '想吃什么']],
  ['忌不忌口、预算大概多少”，', 'along with dietary restrictions and budget,', ['忌口', '预算']],
  ['一口气地说给AI。', 'all in one request to AI.', ['一口气', 'AI']],
  ['AI把范围收一收，给出几个能对上需求的选择，', 'AI narrows the range and offers matching options,', ['收窄范围', '匹配需求']],
  ['再把人带到地图和店铺页面。', 'then takes the user to the map and store page.', ['地图', '店铺页面']],
  ['抖音、小红书、评价当然都还会看。', 'People will still check Douyin, Xiaohongshu, and reviews.', ['抖音', '小红书', '评价']],
  ['不是说以后谁都没用了。', 'This does not make every other channel useless.', ['不是谁都没用']],
  ['只是用户多了一条更短的路：', 'Users simply gain a shorter route:', ['更短的路']],
  ['先问一问，再进去。', 'ask first, then enter.', ['先问再进']],
  ['GEO在这里面干什么？', 'What does GEO do here?', ['GEO']],
  ['别把GEO想得太玄了。', 'Do not make GEO sound mysterious.', ['别想太玄']],
  ['它其实就是，你理解成这样：', 'Think of it this way:', []],
  ['AI在回答别人的问题之前，', 'before AI answers someone,', ['回答之前']],
  ['能不能把你这家店认清楚。', 'can it correctly understand your store?', ['认清这家店']],
  ['你在哪儿、几点营业、主打什么、适合谁，', 'Where are you, when are you open, what do you offer, and for whom?', ['地点', '营业', '主打', '适合谁']],
  ['菜单还准不准、能不能订位，', 'Is the menu current, and can customers reserve?', ['菜单', '订位']],
  ['小程序能不能打开，这些东西是不是一回事。', 'Does the mini program open, and do all these details agree?', ['小程序', '信息一致']],
  ['如果地图写的是老地址，', 'If the map shows an old address,', ['老地址']],
  ['店里早就改了营业时间，', 'the store has changed its opening hours,', ['营业时间']],
  ['网上还是你去年的菜单，', 'and the web still shows last year\'s menu,', ['旧菜单']],
  ['客户点进来之后连入口都找不到，', 'customers may click in and fail to find an entry point.', ['找不到入口']],
  ['那么AI就算把你提出来了，', 'Even if AI mentions you,', ['AI提出来']],
  ['这一步你也接不住。', 'you still cannot receive the customer at this step.', ['接不住']],
  ['所以GEO不是让AI硬推你，', 'So GEO is not about forcing AI to promote you.', ['不是硬推']],
  ['是先把真实的你，', 'It first puts the real version of your business', ['真实的你']],
  ['放到AI能看懂、也能对得上的地方。', 'where AI can understand and verify it.', ['看懂', '对得上']],
  ['你再回头看看之前录屏里面的“AI处理”。', 'Look again at AI Processing in the recording.', ['AI处理']],
  ['就是图片以后，也不只是给人看了。', 'Images will no longer be only for people to view.', ['不只给人看']],
  ['你的菜单图、活动海报、门头介绍，', 'Your menu images, posters, and storefront introductions', ['菜单图', '活动海报', '门头介绍']],
  ['里面的地址、日期、价格写错了，', 'may contain incorrect addresses, dates, or prices.', ['地址', '日期', '价格']],
  ['工具读到的也可能就是错了。', 'Then the tool may also read the wrong information.', ['工具读错']],
  ['现在就是店里，别只盯着图漂不漂亮了。', 'Stores should not focus only on whether the image looks good.', ['别只看漂亮']],
  ['该更新的要更新，', 'Update what needs updating,', ['更新']],
  ['该统一的要统一。', 'and align what needs aligning.', ['统一']],
  ['接下来说AAO。', 'Now let us talk about AAO.', ['AAO']],
  ['我用大白话给大家解释一下：', 'In plain language:', ['大白话']],
  ['AI已经把人提前送到你的面前了。', 'AI has already brought the person to you earlier in the journey.', ['提前送到']],
  ['你有没有地方能让它继续办事？', 'Do you have somewhere for them to continue the task?', ['继续办事']],
  ['想找店，能进地图；', 'To find the store, they can open the map.', ['地图']],
  ['想看菜单，能看到真实的菜单；', 'To view the menu, they can see the real menu.', ['真实菜单']],
  ['然后想订位、点餐、问停车，', 'For reservations, ordering, or parking questions,', ['订位', '点餐', '停车']],
  ['能进到对应的页面，或者是有人接。', 'they reach the right page or a real person.', ['对应页面', '有人接']],
  ['这就是我这一次AAO想说的事。', 'That is what I mean by AAO here.', ['AAO']],
  ['它不是让AI替老板把整家店管了。', 'It does not mean AI runs the whole store for the owner.', ['不是管整家店']],
  ['它是把客人下一步要做的那件小事接住。', 'It catches the customer\'s next small task.', ['接住下一步']],
  ['未来这条路要是接得更顺，', 'If this route becomes smoother,', ['更顺']],
  ['用户可能不用再一个软件一个软件地翻了。', 'users may no longer need to browse app by app.', ['少翻软件']],
  ['AI会按照习惯和这次的需求，', 'AI can use habits and the current need', ['习惯', '当次需求']],
  ['然后把选择收窄。', 'to narrow the choices.', ['收窄选择']],
  ['最后确认一下，或者是输入一次支付密码，', 'The user confirms once, or enters a payment password,', ['用户确认', '支付密码']],
  ['这事就办成了。', 'and the task is done.', ['办成']],
  ['对消费者来说，少翻一点、少比一点，', 'For consumers, there is less browsing and comparison,', ['少翻', '少比']],
  ['找到的东西也更贴近自己这次真实要解决的问题。', 'and the result better matches the current real need.', ['真实问题']],
  ['那么对于商家来说，', 'For merchants,', ['商家']],
  ['你也别先被“Agent”“自动化”这些给唬住了。', 'do not be intimidated by words like Agent and automation.', ['Agent', '自动化']],
  ['你今天先把这四件事看一遍：', 'Start by checking four things today:', ['四件事']],
  ['地图定位准不准，', 'Is the map location accurate?', ['地图定位']],
  ['网上的信息是不是同一套，', 'Is the information online consistent?', ['信息一致']],
  ['小程序或者是预约点餐的入口能不能用，', 'Do the mini program, reservation, and ordering entry points work?', ['入口可用']],
  ['出了问题到底谁负责。', 'Who is responsible when something goes wrong?', ['谁负责']],
  ['先把一条路跑顺。', 'First, make one route work end to end.', ['一条路跑顺']],
  ['比如客户从地图进来，能不能找到你；', 'Can a customer entering from the map find you?', ['地图进店']],
  ['想订位的时候，能不能顺利地订上；', 'Can they successfully make a reservation?', ['顺利订位']],
  ['问到一个问题，店里有没有人能给他准话。', 'Can someone in the store give a definite answer?', ['给准话']],
  ['这些小事你都没有接住的话，', 'If these small tasks are not handled,', ['小事没接住']],
  ['上来就谈复杂的AI，', 'starting with complex AI', ['复杂AI']],
  ['花钱不一定少，但是客户也未必更方便。', 'may still cost a lot without making life easier for customers.', ['花钱不少', '未必方便']],
  ['所以这个GEO是让AI看见你、敢介绍你。', 'GEO helps AI see you and feel able to introduce you.', ['GEO', '看见', '敢介绍']],
  ['AAO是AI介绍完以后，客户别走丢。', 'AAO keeps the customer from getting lost after the introduction.', ['AAO', '别走丢']],
  ['讲到这儿，想必做AI应用落地的朋友们，', 'By now, people implementing AI applications', ['AI应用落地']],
  ['大概也看到了一个方向，', 'have probably seen a direction', ['方向']],
  ['也知道自己接下来该干什么。', 'and know what to do next.', ['下一步']],
  ['至于企业老板，我想也大概能看明白，', 'Business owners can probably also see', ['企业老板']],
  ['AI大爆发时代如何布局。', 'how to prepare in this AI boom.', ['AI大爆发时代', '布局']],
  ['我把GEO和AAO的整套讲解课程已经整理好了。', 'I have organized the complete GEO and AAO course materials.', ['GEO', 'AAO', '讲解课程']],
  ['做餐饮、零售、本地服务的朋友，', 'For people in restaurants, retail, and local services,', ['餐饮', '零售', '本地服务']],
  ['评论区留下“GEO”，我免费发给大家。', 'comment GEO and I will send it to you for free.', ['评论区', 'GEO', '免费']],
  ['我是超哥，在兰州AI创业。', 'I am Chao Ge, building an AI business in Lanzhou.', ['超哥', '兰州AI创业']],
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
const finalRawEndMs = Number(rawSegments.at(-1)?.offsets?.to ?? 330880);
while (cursor < mapped.length) {
  if (mapped[cursor]) {
    cursor += 1;
    continue;
  }
  const start = cursor;
  while (cursor < mapped.length && !mapped[cursor]) cursor += 1;
  const end = cursor;
  const previousEnd = start > 0 && mapped[start - 1] ? mapped[start - 1].endMs : 0;
  const nextStart =
    end < mapped.length && mapped[end]
      ? mapped[end].startMs
      : finalRawEndMs;
  const available = Math.max(20 * (end - start), nextStart - previousEnd);
  for (let index = start; index < end; index += 1) {
    const offset = index - start;
    mapped[index] = {
      text: targetCharacters[index],
      startMs: previousEnd + (available * offset) / Math.max(1, end - start),
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
      ? finalRawEndMs
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

const rawText = rawSegments.map((segment) => segment.text).join('');
const correctedText = pages.map((page) => page.zh).join('');
const cleaned = {
  schema_version: 1,
  source: path.relative(root, rawPath),
  approved_script: path.relative(root, scriptPath),
  method:
    '本机whisper.cpp分段与词级时间轴 + 用户锁定稿仅作术语和明确同音识别错误校正 + 实录口语逐句保留 + 全局字符时间映射。机器校正不能替代用户完整听看。',
  language: 'zh',
  duration_seconds: finalRawEndMs / 1000,
  raw_text: rawText,
  text: correctedText,
  words,
  pages: bilingual,
};
const comparison = {
  schema_version: 1,
  source_transcript: path.relative(root, rawPath),
  approved_script: path.relative(root, scriptPath),
  policy:
    '拍摄后以真人录音为唯一正文。拍摄前文稿只校正GEO、AAO、混元生图、营业时间、订位等明确识别错误，不补回未说内容，不把口语顺成文稿。',
  raw_duration_seconds: finalRawEndMs / 1000,
  raw_segment_count: rawSegments.length,
  corrected_page_count: bilingual.length,
  protected_terms: [
    '微信',
    'AI处理',
    '混元生图',
    '兰州中心',
    'GEO',
    'AAO',
    'Agent',
    '兰州AI创业',
  ],
  retained_spoken_differences: [
    '开头实际口播直接进入更惊人的图片AI处理功能，未补回拍摄前文稿中的过渡句。',
    '实际口播说“可能是腾讯的混元生图模型”，保留“可能”边界。',
    '实际口播说“把人提前送到你的面前”，未替换成拍摄前文稿的“把客人提到你面前”。',
    '实际结尾为“我是超哥，在兰州AI创业”，按实录保留。',
  ],
  corrected_asr_examples: [
    ['一个饭评论', '一个翻评论'],
    ['记不记口', '忌不忌口'],
    ['说给爷爷', '说给AI'],
    ['既有/既要', 'GEO'],
    ['太选', '太玄'],
    ['几点一夜', '几点营业'],
    ['音乐时间', '营业时间'],
    ['定位', '订位'],
    ['图票不票', '图漂不漂亮'],
    ['互助', '唬住'],
    ['除了问题', '出了问题'],
    ['给中话', '准话'],
    ['花钱不一定爽', '花钱不一定少'],
    ['AI大步发时代如何不举', 'AI大爆发时代如何布局'],
    ['做参与', '做餐饮'],
  ],
  notes: [
    '字幕页以语义完整和可读性分组，时间由原始词级时间轴映射，不按拍摄前文稿估时。',
    '正式成片仍需用户完整观看；机器对齐和术语校正不等于人工验收。',
  ],
};

for (const target of [cleanedPath, comparisonPath, bilingualPath, textPath]) {
  fs.mkdirSync(path.dirname(target), {recursive: true});
}
fs.writeFileSync(cleanedPath, `${JSON.stringify(cleaned, null, 2)}\n`, 'utf8');
fs.writeFileSync(
  comparisonPath,
  `${JSON.stringify(comparison, null, 2)}\n`,
  'utf8',
);
fs.writeFileSync(bilingualPath, `${JSON.stringify(bilingual, null, 2)}\n`, 'utf8');
fs.writeFileSync(textPath, `${correctedText}\n`, 'utf8');

console.log(
  JSON.stringify(
    {
      durationSeconds: cleaned.duration_seconds,
      rawSegments: rawSegments.length,
      pages: bilingual.length,
      finalCaptionEndMs: bilingual.at(-1)?.endMs,
      cleanedPath,
      bilingualPath,
    },
    null,
    2,
  ),
);
