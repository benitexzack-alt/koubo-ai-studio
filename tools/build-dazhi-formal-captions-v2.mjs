import fs from 'node:fs';
import path from 'node:path';

const outputPath =
  process.argv[2] ?? 'remotion/public/data/dazhi_20260721_formal.bilingual.v2.json';

const specs = [
  [0, 4120, '设计师是在帮客户花钱。', 'A designer helps the client spend money wisely.', ['设计师', '花钱']],
  [4120, 8630, '比如怎么装、怎么弄，选什么家具、什么东西。', 'How to fit it out, and what furniture and materials to choose.', ['怎么装', '选什么家具']],
  [8630, 11600, '其实设计师是帮客户花钱的。', 'In essence, a designer helps the client make those choices.', ['帮客户花钱']],
  [11600, 15830, '以前客户要什么，我们就给什么。', 'Before, we gave clients whatever they asked for.'],
  [16200, 19990, '现在我想让它产品化，因为我是做酒吧设计的。', 'Now I want to productize it, because I design bars.', ['产品化', '酒吧设计']],
  [20010, 23000, '我可能会研发很多酒吧设计方案。', 'I can develop many ready-made bar design concepts.', ['研发', '设计方案']],
  [23000, 26030, '比如说我的想法、我的 idea、我的东西。', 'For example, I start from my ideas and what I want to make.', ['想法', 'idea']],
  [26030, 29880, '客户看这个设计比较好，就可以选择适合自己的。', 'The client can choose the design that suits them.', ['选择适合自己的']],
  [29880, 32820, '就像买产品一样，我已经生产出来了。', 'It is like buying a product that has already been prepared.', ['买产品', '生产出来']],
  [32820, 36530, '比如说我要做研发，刚弄出一个酒吧空间。', 'For example, I develop a bar-space concept.', ['研发', '酒吧空间']],
  [36530, 40670, '针对300平、500平，我可以有几种风格。', 'For 300 or 500 square meters, I can prepare several styles.', ['300平', '500平', '几种风格']],
  [40680, 44380, '比如研发一套侘寂风，或者古堡风。', 'For example, a wabi-sabi style or a castle-inspired style.', ['侘寂风', '古堡风']],
  [44390, 49040, '或者波西米亚风、摩洛哥风格、现代风。', 'It could also be Bohemian, Moroccan, or modern.', ['波西米亚', '摩洛哥', '现代风']],
  [49040, 52220, '我自己平时就在研究，也会借助一些工具。', 'I study these styles and use tools to support the work.'],
  [52220, 54920, '以前我们自己做，成本会很高。', 'Doing all of this ourselves used to be expensive.', ['成本会很高']],
  [54920, 58680, '现在就是要借助新的AI。', 'Now we can draw on new AI capabilities.', ['新的AI']],
  [58680, 61280, '去实现我的想法，AI它只是工具。', 'AI helps realize my ideas, but it is only a tool.', ['实现我的想法', '只是工具']],
  [61280, 65540, '如何将你的灵感快速地实现。', 'How can your inspiration be realized quickly?', ['灵感', '快速实现']],
  [65540, 69110, '低成本地快速实现，先分两个版本。', 'We realize it quickly at low cost, starting with two versions.', ['低成本', '两个版本']],
  [69120, 73300, '如果一次性把全部功能实现，就太重了。', 'Building every feature at once would be too heavy.', ['全部功能', '太重']],
  [73300, 77680, '我们先按1.0版本来做。', 'We begin with version 1.0.', ['1.0版本']],
  [77680, 81180, '就是脑中一瞬间的这个想法。', 'It is the idea that flashes through your mind.', ['一瞬间的想法']],
  [81180, 84340, '快速变成能看、能选、能讲的视觉方案。', 'It quickly becomes a visual concept you can see, choose, and explain.', ['能看', '能选', '能讲']],
  [85280, 90840, '这里面很多东西，不能作为真正交付和落地施工。', 'Much of this cannot be final delivery or go straight into construction.', ['真正交付', '落地施工']],
  [91800, 95190, '概念展示，我们快速地先展示。', 'First, we quickly show the concept.', ['概念展示']],
  [95190, 100520, '确定真实方向后，再把方向转为真实项目。', 'Once the direction is confirmed, we turn it into a real project.', ['真实方向', '真实项目']],
  [100680, 103500, '专业设计。比如我今天在某个地方。', 'Then it enters professional design; for example, I may be somewhere.', ['专业设计']],
  [103600, 107360, '我去旅游也好，去某个地方玩也好。', 'I may be traveling or visiting a place.'],
  [107400, 111410, '平时刷短视频，或者看小红书。', 'Or I may be browsing short videos or Xiaohongshu.', ['短视频', '小红书']],
  [111410, 114800, '看到好看的东西，我会突然有一个灵感。', 'When I see something good, an idea may suddenly appear.', ['突然有一个灵感']],
  [114800, 117680, '这个地方能不能做成一个酒吧。', 'Could this place become a bar?', ['酒吧']],
  [117680, 120440, '或者做成餐饮、做成会所。', 'Or perhaps a restaurant or a private club?', ['餐饮', '会所']],
  [120440, 122320, '做成某一个空间，对不对？', 'It could become a particular kind of space.', ['空间']],
  [122320, 126880, '以前可能会用手画出来。', 'In the past, I might sketch it by hand.', ['手画']],
  [126880, 131230, '那个东西很考功底，也没有画得很具象化。', 'That takes skill and still may not look concrete enough.', ['考功底', '具象化']],
  [131230, 135650, '我想在这一瞬间，把这一刻的灵感和想法', 'I want to capture the inspiration and thought of that exact moment,', ['这一瞬间', '灵感']],
  [135650, 137600, '然后让它还原出来。', 'Then I make it visible.', ['还原出来']],
  [137600, 141450, '然后我就留存下来，在这个空间留存下来。', 'Then I preserve it and save it with that space.', ['留存下来']],
  [141490, 144480, '我的想法就保存在这里了。', 'The idea is now saved here.', ['保存在这里']],
  [144500, 148150, '遇到比较适合的客户，我就把它调出来。', 'When a suitable client appears, I retrieve it.', ['调出来']],
  [148150, 151840, '因为它只能是一个想法，它只是一个概念。', 'It is only an idea, still just a concept.', ['一个想法', '一个概念']],
  [151840, 155200, '它不能作为落地方案，真正的设计需要落地。', 'It is not a buildable plan; real design has to be executable.', ['落地方案', '设计需要落地']],
  [155200, 160570, '给客户完美的施工呈现，或者最终的效果呈现。', 'We give the client a complete construction and final-effect presentation.', ['施工呈现', '效果呈现']],
  [160710, 165870, '我会给你搭建一个属于自己的知识库。', 'I will build a personal knowledge base for you.', ['自己的知识库']],
  [165870, 169260, '把你现有的想法、灵感和过去的经验', 'It gathers your ideas, inspiration, and past experience,', ['想法', '灵感', '经验']],
  [169260, 173300, '还有以前的设计图，整理成数字资产。', 'along with earlier drawings, and turns them into digital assets.', ['设计图', '数字资产']],
  [173300, 176080, '全部放到你的知识库里面。', 'Everything goes into your knowledge base.', ['知识库']],
  [176080, 179200, '这是你未来最值钱、最有价值的东西。', 'This may become your most valuable asset in the future.', ['最有价值']],
  [179200, 183200, '也是你的第二大脑。', 'It becomes your second brain.', ['第二大脑']],
  [183200, 187580, '比如我们做商业，可能有应酬，也有其他事情处理。', 'In commercial work, there may be social engagements and other matters to handle.'],
  [187580, 193400, '项目处理和其他工作对接，人的大脑记忆有限。', 'With projects and other coordination, human memory is limited.', ['大脑记忆有限']],
  [193400, 196590, '比如说，我之前想过的东西。', 'For example, things I thought about before.', ['之前想过']],
  [196590, 201790, '它有时候会断层，就没有一个统一储存。', 'Sometimes those thoughts become disconnected without unified storage.', ['断层', '统一储存']],
  [201800, 205410, '比如说用什么样的材质，像这样一个房间。', 'For example, which material to use in a room like this.', ['材质', '房间']],
  [205410, 210000, '像现代流行的墙板，比如防撞板。', 'Such as current wall panels and impact-resistant panels.', ['墙板', '防撞板']],
  [210000, 213520, '冰火板、墙板，比如说不同的花色。', 'Fire-resistant panels, wall panels, and different finishes.', ['冰火板', '花色']],
  [213520, 217660, '我也会做储存，因为我要去给客户。', 'I also store these choices for future client work.', ['储存', '客户']],
  [217710, 222430, '比如说这个板子，客户调出来之后。', 'For example, after a client pulls up this panel option.', ['这个板子']],
  [222440, 226710, '客户整体预算不高，空间投资预算不高。', 'The client and the space may both have a limited budget.', ['预算不高']],
  [226720, 231130, '我就会考虑，既达到他想要的效果。', 'I consider how to achieve the effect the client wants,', ['想要的效果']],
  [231150, 235280, '又能选到好的材质，而且性价比高。', 'while choosing good materials with strong value for money.', ['好的材质', '性价比高']],
  [235280, 239320, '价格不高，还能快速实现这个空间。', 'The price stays reasonable and the space can be built quickly.', ['价格不高', '快速实现']],
  [239320, 241920, '这些都要储存，这就是我的材料库。', 'These choices are stored in my material library.', ['材料库']],
  [241920, 246060, '预算一选，立马就出来。', 'Once the option is selected, the budget appears immediately.', ['预算一选', '立马出来']],
  [246120, 250200, '客户觉得好看，但这个有点贵。', 'The client may like it but feel that it is too expensive.', ['有点贵']],
  [250200, 254280, '这个价格可以，虽然这个东西不是最完美。', 'This price works, even if the option is not perfect.', ['价格可以', '不是最完美']],
  [254280, 259240, '但是这个价格符合我的期待，它就有可选性。', 'But the price meets my expectations, so I have a real choice.', ['符合期待', '可选性']],
  [259240, 264510, '未来建立这样的数字库，让客户快速匹配。', 'We will build this digital library so clients can match options quickly.', ['数字库', '快速匹配']],
  [264520, 269050, '然后快速选择，但客户不是专业设计师。', 'They can choose quickly, but the client is not a professional designer.', ['快速选择', '专业设计师']],
  [269120, 273840, '它是散的，东一下、西一下、拼一下，都是散的。', 'The ideas are scattered, one piece here and another there.', ['东一下', '西一下', '拼一下']],
  [273840, 277760, '它也是散的，它想做一个什么东西。', 'It is still scattered around what the client wants to make.', ['也是散的']],
  [277760, 283010, '他能想到，但组织不起来；设计师就是组织者。', 'The client can imagine it but cannot organize it; the designer is the organizer.', ['组织不起来', '组织者']],
  [283010, 288240, '把客户的想法、我们的想法结合起来。', "We bring together the client's ideas and our own.", ['客户的想法', '我们的想法']],
  [288240, 292660, '结合实际情况，把它融合起来、整合起来。', 'We combine them with the real conditions and integrate everything.', ['实际情况', '融合', '整合']],
  [292660, 295840, '其实是这样一个东西，合适，合适。', 'That is how it works, and it needs to be the right fit.', ['合适']],
  [295840, 299690, '对，最好。因为这个东西说实话。', 'Yes, that is best, because to be honest about this work,', ['最好']],
  [299730, 304230, '要根据我的框架确定，再结合你们去整合。', 'it must follow my framework and then be integrated with your work.', ['我的框架', '整合']],
  [304240, 307440, '这样去建立，这样最好，因为有我的框架。', 'Building it this way is best because the framework is mine.', ['这样最好', '我的框架']],
  [307440, 309920, '我的设计流程是什么。', 'I define what my design process is.', ['设计流程']],
  [309920, 313660, '我会用文字性的文本把它写出来。', 'I write it out as a structured text document.', ['文字性的文本']],
  [313680, 318030, '这样做会更好。很多客户看到的并不一定真实。', 'That works better. What many clients see is not always real.', ['不一定真实']],
  [318030, 321480, '真实性的东西，客户往往没有看到。', 'Clients often do not see the work that reflects the real substance.', ['真实性', '没有看到']],
  [321480, 325910, '像我们一样，毕竟之前是靠圈层。', 'Like us, we previously relied on our existing circle.', ['靠圈层']],
  [326080, 329120, '圈层比较多，基本都是朋友介绍。', 'Most business came through introductions from friends.', ['朋友介绍']],
  [329120, 332180, '所以很多客户找不到我们。', 'So many potential clients could not find us.', ['找不到我们']],
  [332180, 335360, '找不到我们，因为我们是靠朋友介绍。', 'They could not find us because we relied on referrals from friends.'],
  [335360, 338520, '把我们的案例展示出来之后', 'Once we show our real project cases,', ['案例展示']],
  [338520, 343800, '就是要让更多客户能够看到我们的想法。', 'The point is to let more clients see how we think.', ['更多客户', '我们的想法']],
  [343800, 348360, '我们能够认真地为他落地，让他能看到我们。', 'We seriously deliver the work for them and let them see us doing it.', ['认真', '落地']],
  [348360, 352120, '只要你认真去做一件事情。', 'As long as you seriously commit to doing one thing well,', ['认真去做']],
  [352120, 358120, '真实地去展示一些东西，或者为客户做一些事情。', 'Show the work truthfully and do real things for the client.', ['真实地展示', '为客户做事']],
  [358280, 360360, '我觉得这个东西是没问题的。', 'I believe this approach can work.'],
  [360360, 364910, '这些回去以后，我们都可以去落地。', 'We can take these ideas back and put them into practice.', ['可以去落地']],
  [364920, 366520, '也可以马上开展。', 'We can start immediately.', ['马上开展']],
];

const pages = specs.map(([startMs, endMs, zh, en, highlights = []], index) => ({
  startMs,
  endMs,
  zh,
  en,
  highlights,
  index: index + 1,
}));

for (let index = 0; index < pages.length; index += 1) {
  const page = pages[index];
  const previous = pages[index - 1];
  if (!page.zh || !page.en || page.endMs <= page.startMs) {
    throw new Error(`第 ${index + 1} 页内容或时间无效`);
  }
  if ([...page.zh].length > 34) {
    throw new Error(`第 ${index + 1} 页中文超过 34 字：${page.zh}`);
  }
  if (previous && page.startMs < previous.endMs) {
    throw new Error(`第 ${index + 1} 页与上一页时间重叠`);
  }
}

fs.mkdirSync(path.dirname(outputPath), {recursive: true});
fs.writeFileSync(
  outputPath,
  `${JSON.stringify(
    pages.map(({index: _index, ...page}) => page),
    null,
    2,
  )}\n`,
  'utf8',
);

console.log(`已生成 ${pages.length} 页逐字双语字幕：${outputPath}`);
