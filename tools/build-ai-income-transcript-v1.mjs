import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const rawPath = path.join(
  root,
  'edit/20260819_ai_income/transcripts/AI_INCOME_20260819_talk01_whisper-small-v1.json',
);
const scriptPath = path.join(
  root,
  'notes/2026-08-19-学AI到底能不能多挣一点钱-用户最终口播稿-v1.md',
);
const cleanedPath = path.join(
  root,
  'edit/20260819_ai_income/transcripts/AI_INCOME_20260819_talk01.cleaned.v1.json',
);
const comparisonPath = path.join(
  root,
  'edit/20260819_ai_income/transcripts/AI_INCOME_20260819_talk01.script-comparison.v1.json',
);
const bilingualPath = path.join(
  root,
  'remotion/public/data/AI_INCOME_20260819_talk01.bilingual.v1.json',
);
const textPath = path.join(
  root,
  'edit/20260819_ai_income/transcripts/AI_INCOME_20260819_talk01.cleaned.v1.txt',
);

const rows = [
  // 01-10
  ['最近大家问得最多的一句话就是：', 'The question I hear most often lately is this:', ['问得最多']],
  ['超哥，现在学AI，到底能不能多挣一点钱？', 'Chao Ge, can learning AI actually help me earn more?', ['学AI', '多挣一点钱']],
  ['有上班的朋友说，工资就那样，', 'Some employed friends say their salary is just so-so,', ['工资']],
  ['想下班以后学点AI，看看能不能多一份收入。', 'so they want to learn AI after work and add another income stream.', ['下班以后', '多一份收入']],
  ['也有暂时没有上班的朋友，觉得AI现在这么热，', 'Others are currently between jobs and see how hot AI is,', ['AI现在这么热']],
  ['是不是干脆换一条路，专门做这个？', 'and wonder whether they should switch paths and do this full-time.', ['换一条路']],
  ['大家既怕错过AI，又怕花钱和花时间，', 'People fear missing AI, but also fear spending money and time', ['怕错过AI', '花钱', '花时间']],
  ['以后没有结果，于是在冲进去和干脆不碰之间摇摆。', 'without results, so they swing between rushing in and staying away.', ['没有结果', '摇摆']],
  ['我先把我的答案放前面。', 'Let me put my answer up front.', ['答案放前面']],
  ['AI值得学，但不同处境不能走同一条路。', 'AI is worth learning, but different situations require different paths.', ['AI值得学', '不同处境']],
  // 11-20
  ['有工作的人，先把AI放进现有工作里验证。', 'If you have a job, test AI inside the work you already do.', ['现有工作', '验证']],
  ['准备靠它谋生的人，先把成本、作品和真实交付周期，', 'If you plan to make a living from it, first examine the costs, portfolio, and real delivery cycle,', ['成本', '作品', '真实交付周期']],
  ['先想清楚。这不是我站在外面劝大家保守。', 'and think them through. I am not saying this as an outsider urging caution.', ['想清楚']],
  ['这是我大量花费和每天凌晨3点熬出来的感受。', 'This comes from substantial spending and many nights working until 3 a.m.', ['大量花费', '凌晨3点']],
  ['今年年初，我开始系统接触AI。', 'At the start of this year, I began studying AI systematically.', ['系统接触AI']],
  ['证书要花钱，课要花钱，工具订阅要花钱。', 'Certificates cost money, courses cost money, and tool subscriptions cost money.', ['证书', '课程', '工具订阅']],
  ['API、做图做视频的积分、资料和社群，零零散散都要花钱。', 'APIs, image and video credits, materials, and communities all add up.', ['API', '积分', '社群']],
  ['时间更不用说，每天晚上和周末基本都搭进去了。', 'And then there is time: most evenings and weekends went into it.', ['晚上', '周末']],
  ['后来我和合伙人一起做企业AI落地和GEO。', 'Later, my partner and I started working on enterprise AI implementation and GEO.', ['企业AI落地', 'GEO']],
  ['也有付费项目在做，也有交付，现在也还在接单。', 'We have paid projects, deliveries, and are still taking work.', ['付费项目', '交付', '接单']],
  // 21-30
  ['可我不会把这就说成“我已经跑通了”。', 'But I will not call that proof that I have fully figured it out.', ['已经跑通了']],
  ['因为项目在做，和这条路已经跑顺，是两回事。', 'Having projects underway and having a proven path are two different things.', ['项目在做', '跑顺']],
  ['到今天，我自己的投入和回报也还没有成正比。', 'Even today, my own input and return are still not proportional.', ['投入', '回报']],
  ['所以我现在不敢劝你辞职干AI。', 'So I cannot tell you to quit your job for AI.', ['辞职干AI']],
  ['因为我也还在用投入、项目和交付，一段一段验证这条路。', 'I am still validating this path, step by step, through investment, projects, and delivery.', ['一段一段验证']],
  ['这不是说AI没有用，恰恰相反。', 'That does not mean AI is useless. Quite the opposite.', ['恰恰相反']],
  ['AI很可能帮你把费时间的事，做得快一点、清楚一点。', 'AI can very likely make time-consuming work faster and clearer.', ['快一点', '清楚一点']],
  ['但它得先落到你手里那件真事上。', 'But it must first land on a real task in your hands.', ['真事']],
  ['你现在有工作，就先别急着把自己想成AI从业者。', 'If you have a job, do not rush to label yourself an AI professional.', ['有工作', 'AI从业者']],
  ['你每天干的事，不管是写材料、整理客户，', 'In your daily work, whether you write documents or organize customer information,', ['写材料', '整理客户']],
  // 31-40
  ['还有这些报表，', 'or prepare reports,', ['报表']],
  ['还有做内容，总有一件事是你反复在做的。', 'or create content, there is always one task you repeat again and again.', ['做内容', '反复在做']],
  ['先拿这一件去练。', 'Start by practicing on that one task.', ['这一件']],
  ['豆包、DeepSeek、WorkBuddy给的免费额度也好，', 'Use the free quotas from Doubao, DeepSeek, or WorkBuddy,', ['豆包', 'DeepSeek', 'WorkBuddy']],
  ['或者自己小额充一点会员，先把它用起来。', 'or buy a small membership and start using it.', ['小额', '用起来']],
  ['不是让AI替你糊弄过去。', 'The goal is not to let AI bluff its way through the task.', ['不是糊弄']],
  ['你要盯着看：它整理出来的东西，你自己能不能看懂？', 'Watch closely: can you understand what it produces?', ['能不能看懂']],
  ['交出去会不会出错？', 'Will it cause errors when you hand it over?', ['会不会出错']],
  ['你是不是少绕了一圈、少返了几次工？', 'Did it save you a detour or several rounds of rework?', ['少绕一圈', '少返工']],
  ['要是这你都用不顺，', 'If you still cannot use it smoothly,', ['用不顺']],
  // 41-50
  ['就先别急着谈副业了。', 'do not rush into talking about a side business.', ['别急着谈副业']],
  ['先把这些工具用顺。', 'First, learn to use these tools reliably.', ['工具用顺']],
  ['这本身就在给你的工作能力加分。', 'That alone adds value to your professional ability.', ['工作能力加分']],
  ['准备全职进入这个行业的人，情况又不一样。', 'For people preparing to enter this field full-time, the situation is different.', ['全职进入']],
  ['你面对的不是会不会用一个工具，', 'Your question is not whether you can use one tool,', ['一个工具']],
  ['而是要不要拿时间和成本，去换一个还没验证的机会。', 'but whether to trade time and money for an opportunity that is not yet proven.', ['时间和成本', '还没验证']],
  ['你先别看别人做一张图、做一个短剧，', 'Do not focus on someone making one image or one short drama,', ['一张图', '一个短剧']],
  ['一下就爆火了，一个月能接多少单。', 'going viral overnight, or claiming many orders in a month.', ['爆火', '接多少单']],
  ['先问自己：我能承受多久没有收入？', 'Ask yourself: how long can I live without income?', ['没有收入']],
  ['我能拿出什么样的作品？', 'What work can I actually show?', ['作品']],
  // 51-60
  ['我手上有没有一个真实的问题？', 'Do I have a real problem in front of me?', ['真实的问题']],
  ['有没有愿意让我反复做、反复改，直到能用的需求方？', 'Is there a real client who will let me iterate until the result works?', ['反复做', '反复改', '需求方']],
  ['没有这些，买再多课、开再多会员，', 'Without these, buying more courses and memberships', ['买再多课', '开再多会员']],
  ['最后很容易只剩几个账号，', 'often leaves you with only a few accounts', ['几个账号']],
  ['和一堆没用完的积分。', 'and a pile of unused credits.', ['没用完的积分']],
  ['像AIGC做图、做视频、做漫剧，', 'AIGC images, videos, and animated dramas', ['AIGC', '做图', '做视频', '做漫剧']],
  ['这些方向当然可以研究，我自己也在持续做。', 'are all worth exploring, and I continue to work on them too.', ['持续在做']],
  ['但越往深处走，你越会发现，', 'But the deeper you go, the clearer it becomes:', ['越往深处']],
  ['它不是点两下就能挣钱。', 'you do not earn money simply by clicking twice.', ['不是点两下']],
  ['投入、作品质量、素材权利、内容规则和反复修改，都会摆在面前。', 'Investment, quality, asset rights, content rules, and repeated revisions all matter.', ['作品质量', '素材权利', '内容规则', '反复修改']],
  // 61-70
  ['尤其是完全没有接触过的小白，', 'Especially for complete beginners,', ['小白']],
  ['一上来就把所有时间和钱压进去，', 'putting all your time and money in from day one', ['所有时间和钱']],
  ['我真不建议。', 'is something I genuinely do not recommend.', ['不建议']],
  ['先把AI用在一件真实的事上。', 'First use AI on one real task.', ['一件真实的事']],
  ['能帮你把事做好一点，哪怕一点点，', 'If it helps you do that task even slightly better,', ['做好一点']],
  ['才值得继续往里投时间和钱。', 'then it may deserve more time and money.', ['继续投入']],
  ['现在我们在兰州，也还在对接一些企业，', 'Here in Lanzhou, we are also talking with businesses', ['兰州', '企业']],
  ['愿意把自己的业务拿出来聊。', 'that are willing to put their real operations on the table.', ['真实业务']],
  ['看看流程里哪些地方AI能帮上忙，', 'We examine where AI can help inside their processes,', ['AI能帮上忙']],
  ['哪些地方根本不能乱动。', 'and which parts must not be changed carelessly.', ['不能乱动']],
  // 71-80
  ['有些事情已经有人愿意付费。', 'Some tasks already have people willing to pay.', ['愿意付费']],
  ['有些事情还在验证。', 'Others are still being validated.', ['还在验证']],
  ['这个过程不快，', 'This process is not fast,', ['不快']],
  ['也没有短视频里讲得那么轻松。', 'and it is not as easy as short videos make it look.', ['没那么轻松']],
  ['但我不想因为还没拿到大结果，就告诉大家，', 'I do not want to say, just because I lack a major result,', ['还没拿到大结果']],
  ['学AI没用。', 'that learning AI is useless.', ['学AI没用']],
  ['更不想因为有人晒了一张收款图，', 'Nor do I want one payment screenshot', ['收款图']],
  ['就让大家一头扎进去。', 'to make everyone dive in blindly.', ['一头扎进去']],
  ['学AI，不是为了把自己变成又一个焦虑的人。', 'Learning AI is not about becoming one more anxious person.', ['不是为了焦虑']],
  ['先让它帮你把手里的真实工作，', 'First let it help with the real work already in your hands,', ['真实工作']],
  // 81-90
  ['先做扎实。', 'and make that work solid.', ['做扎实']],
  ['能做出东西，能解决问题，', 'Produce something and solve a problem.', ['做出东西', '解决问题']],
  ['能让别人愿意用，', 'Make something others are willing to use.', ['愿意用']],
  ['后面的收入才有可能慢慢长出来。', 'Only then can income gradually grow from it.', ['收入慢慢长出来']],
  ['如果你已经在真实工作里用过AI，', 'If you have already used AI in real work,', ['真实工作', '用过AI']],
  ['或者也在做这类尝试，', 'or are making similar attempts,', ['尝试']],
  ['把你遇到的难处和结果，', 'share the difficulties and results you encountered.', ['难处', '结果']],
  ['发出来，', 'Put them out there,', []],
  ['让我们大家一起讨论。', 'and let us discuss them together.', ['一起讨论']],
  ['我们一起把那些好看、热闹的东西，', 'Together, let us turn the flashy and exciting things', ['好看', '热闹']],
  // 91-102
  ['慢慢做成对普通人真正有用的东西。', 'into things that are genuinely useful to ordinary people.', ['真正有用']],
  ['都说创业九死一生。', 'People say entrepreneurship is a one-in-ten chance.', ['九死一生']],
  ['我这已经是第九回了，也该生了。', 'This is my ninth attempt, so perhaps it is finally time to survive.', ['第九回']],
  ['现在能够借助AI提升自己的，', 'If you can improve yourself with AI now,', ['借助AI提升']],
  ['或者真的在某个环节有一技之长，', 'or already have a real skill in one part of the process,', ['一技之长']],
  ['先去面试这些岗位。', 'start by interviewing for relevant roles.', ['先去面试']],
  ['先去实战，磨练磨练。', 'Get real practice and build your ability.', ['实战']],
  ['不要轻易创业。', 'Do not start a business lightly.', ['不要轻易创业']],
  ['试错就交给我。', 'Leave the trial and error to me.', ['试错']],
  ['成了，我再把经验分享给大家。', 'If it works, I will share the experience with everyone.', ['分享经验']],
  ['我是超哥，', 'I am Chao Ge,', ['超哥']],
  ['在兰州AI创业。', 'building an AI business in Lanzhou.', ['兰州AI创业']],
];

const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
const transcription = raw.transcription ?? [];
if (transcription.length !== rows.length) {
  throw new Error(
    `字幕校正行数 ${rows.length} 与原始转写分段 ${transcription.length} 不一致`,
  );
}

const pages = transcription.map((segment, index) => {
  const [zh, en, highlights] = rows[index];
  return {
    startMs: Number(segment.offsets.from),
    endMs: Number(segment.offsets.to),
    zh,
    en,
    highlights,
  };
});

const rawText = transcription.map((segment) => segment.text).join('');
const correctedText = pages.map((page) => page.zh).join('');
const words = transcription.map((segment, index) => ({
  text: pages[index].zh,
  raw_text: String(segment.text ?? '').trim(),
  start: Number(segment.offsets.from) / 1000 + 0.11,
  end: Math.max(
    Number(segment.offsets.from) / 1000 + 0.12,
    Number(segment.offsets.to) / 1000 - 0.11,
  ),
  type: 'word',
  confidence: null,
  speaker_id: 'speaker_0',
}));
const cleaned = {
  schema_version: 1,
  source: path.relative(root, rawPath),
  approved_script: path.relative(root, scriptPath),
  method:
    '本机 whisper.cpp 分段时间轴 + 用户锁定稿人工核对校正；raw_text保留原始识别，words/text作为正式字幕规范文本。该机器对齐只验证时间窗与规范文本一致，不能替代用户完整听看。',
  language: 'zh',
  duration_seconds: pages.at(-1)?.endMs / 1000,
  raw_text: rawText,
  text: correctedText,
  words,
  pages,
};
const comparison = {
  schema_version: 1,
  source_transcript: path.relative(root, rawPath),
  approved_script: path.relative(root, scriptPath),
  policy:
    '完整保留真人原片；字幕以实际声音为时间基准，参照用户锁定稿校正明显识别错误，不以锁定稿覆盖真实口语差异。',
  raw_duration_seconds: cleaned.duration_seconds,
  raw_segment_count: transcription.length,
  corrected_page_count: pages.length,
  protected_terms: ['AI', 'API', 'AIGC', 'DeepSeek', 'WorkBuddy', 'GEO', '兰州', '超哥'],
  visual_evidence_limits: [
    '用户本轮未提供项目交付证据，因此不制作交付证明画面。',
    'Codex 117.8亿 Token 只作为使用强度记录，不表述为订阅金额。',
    '充值价目表不作为历史消费证据。',
    '证书仅展示培训内容和印章所在右页，排除姓名、照片、身份证号、证书号和二维码。',
  ],
  notes: [
    '原片实际口播在少数句子上有自然改述，已按实际声音保留。',
    '正式成片仍需人工完整观看，机器转写和对齐不能替代真人验收。',
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
fs.writeFileSync(bilingualPath, `${JSON.stringify(pages, null, 2)}\n`, 'utf8');
fs.writeFileSync(textPath, `${correctedText}\n`, 'utf8');

console.log(
  JSON.stringify(
    {
      durationSeconds: cleaned.duration_seconds,
      pages: pages.length,
      cleanedPath,
      bilingualPath,
    },
    null,
    2,
  ),
);
