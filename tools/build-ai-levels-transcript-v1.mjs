import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const root = path.resolve(import.meta.dirname, '..');
const rawPath = path.join(
  root,
  'edit/20260820_ai_levels/transcripts/AI_LEVELS_20260820_talk01_whisper-small-v1.json',
);
const scriptPath = path.join(
  root,
  'notes/2026-08-20-六层AI能力地图-用户最终锁定稿-v3.md',
);
const cleanedPath = path.join(
  root,
  'edit/20260820_ai_levels/transcripts/AI_LEVELS_20260820_talk01.cleaned.v1.json',
);
const comparisonPath = path.join(
  root,
  'edit/20260820_ai_levels/transcripts/AI_LEVELS_20260820_talk01.script-comparison.v1.json',
);
const bilingualPath = path.join(
  root,
  'remotion/public/data/AI_LEVELS_20260820_talk01.bilingual.v1.json',
);
const textPath = path.join(
  root,
  'edit/20260820_ai_levels/transcripts/AI_LEVELS_20260820_talk01.cleaned.v1.txt',
);

// 1-based inclusive Whisper segment ranges. Chinese follows the recorded voice;
// punctuation and product spelling are corrected against the user-locked script.
const rows = [
  [1, 1, '咱们用AI的时候，有没有这种感觉？', 'Do you ever get this feeling when using AI?', ['AI']],
  [2, 4, '客户要得特别着急，你让AI帮你写回复，它写得特别快。', 'A client needs an urgent reply, and AI writes one very quickly.', ['特别着急', '特别快']],
  [5, 6, '你让它做一个方案，它也能给你一大段。', 'Ask it for a proposal, and it can produce a long draft too.', ['方案']],
  [7, 8, '可你关掉对话框以后，资料还得自己找。', 'But once you close the chat, you still have to find the materials.', ['资料还得自己找']],
  [9, 10, '表格还得自己填，客户还得自己回。', 'You still fill in the sheet and reply to the client yourself.', ['自己填', '自己回']],
  [11, 12, '真出了问题，还得是你兜着。', 'And if something goes wrong, you are still accountable.', ['你兜着']],
  [13, 13, 'AI确实帮你把最开始那一下做掉了。', 'AI really did handle that first step for you.', ['最开始那一下']],
  [14, 15, '只是你以为后面也被它做了，实际上还没有。', 'You may think it handled everything after that, but it did not.', ['实际上还没有']],
  [16, 17, '问题来了：豆包、DeepSeek、Kimi、千问这些你都会用。', 'Here is the question: you can use Doubao, DeepSeek, Kimi, and Qwen.', ['豆包', 'DeepSeek', 'Kimi', '千问']],
  [18, 18, '那么，你算不算会用AI？', 'Does that mean you truly know how to use AI?', ['会用AI']],
  [19, 22, '先别急着问算不算，看看AI后面的工作是不是还由你接着干。', 'Before answering, see how much work after AI still has to be carried by you.', ['后面的工作', '你接着干']],
  [23, 24, '今天我就把用AI分成六个段位，你们看我说得对不对。', 'Today I will divide AI use into six levels. See whether this makes sense.', ['六个段位']],
  [25, 25, '第一层：问答。', 'Level one: question and answer.', ['第一层', '问答']],
  [26, 27, '手机里常用的豆包、DeepSeek、Kimi、千问，大多先解决问答。', 'Doubao, DeepSeek, Kimi, and Qwen on our phones mainly start with Q and A.', ['豆包', 'DeepSeek', 'Kimi', '千问']],
  [28, 30, '你问一句，它答一句；改文案、查思路、想标题，它很快给你参考。', 'You ask, it answers. It quickly suggests copy, ideas, or titles.', ['问一句', '答一句']],
  [31, 32, '最大的好处，是人不容易卡在空白页上。', 'The biggest benefit is that you are less likely to get stuck on a blank page.', ['空白页']],
  [33, 34, '但边界也很清楚：答案停在聊天框里。', 'But the boundary is clear: the answer stays inside the chat box.', ['答案停在聊天框']],
  [35, 38, '后面怎么改、怎么发、发给谁，发错了怎么办，还是你自己处理。', 'You still decide how to edit it, send it, who receives it, and fix mistakes.', ['你自己处理']],
  [39, 41, '别因为会提几个问题，就觉得用上Agent了；它只是反应很快的助手。', 'Asking a few questions does not mean you use an Agent. It is only a fast assistant.', ['Agent', '助手']],
  [42, 43, '那怎么到第二层？第二层就是任务。', 'How do you reach level two? Level two is a task.', ['第二层', '任务']],
  [44, 46, '它不再是一句“帮我想想”，而是有资料、有要求、有交付物的一件事。', 'It is no longer "help me think," but a task with inputs, requirements, and a deliverable.', ['资料', '要求', '交付物']],
  [47, 48, '比如把上周十几条客户咨询整理成一张跟进表。', 'For example, turn last week\'s client inquiries into a follow-up sheet.', ['跟进表']],
  [49, 49, '把一堆会议记录变成老板看得懂的简报。', 'Turn a pile of meeting notes into a briefing the boss can understand.', ['简报']],
  [50, 51, '把已有资料按固定格式整理成一份文档。', 'Organize existing material into a document with a fixed format.', ['固定格式', '文档']],
  [52, 55, 'Kimi文档、飞书表格、千问办公、WorkBuddy，', 'Kimi Docs, Feishu Sheets, Qwen Office, and WorkBuddy', ['Kimi', '飞书表格', '千问办公', 'WorkBuddy']],
  [56, 58, '还有通用助手的任务功能，都能从这一层进。', 'plus task features in general assistants can all enter from this level.', ['任务功能']],
  [59, 61, '把资料、目标和最终交付都给它，让它把具体办公任务往前推。', 'Give it the material, goal, and desired output so it can advance a concrete office task.', ['资料', '目标', '最终交付']],
  [62, 64, '到第二层，要学的不是提示词多花，而是把活说清楚。', 'At level two, the skill is not fancy prompts but describing the work clearly.', ['把活说清楚']],
  [65, 68, '给它什么资料、做成什么样、哪几步不能错。', 'Specify the inputs, the required result, and which steps must not be wrong.', ['不能错']],
  [69, 69, '别把“能下载一个文件”当成任务完成。', 'Do not treat a downloadable file as proof that the task is done.', ['任务完成']],
  [70, 73, '名字对不对、数字有没有错、结论能不能发，还是得你看。', 'You must still verify names, numbers, and whether the conclusion can be sent.', ['名字', '数字', '结论']],
  [74, 76, 'AI帮你把毛坯搭起来，最后交付的责任还在你手上。', 'AI builds the rough draft, but responsibility for delivery remains with you.', ['责任还在你手上']],
  [77, 81, '第三层才是流程，因为有些事情根本不是做一次。', 'Level three is a workflow, because some work is never done only once.', ['第三层', '流程']],
  [82, 85, '每天有咨询、整理表格、提醒跟进，这些事一直重复。', 'Inquiries, spreadsheets, and follow-up reminders repeat every day.', ['每天', '重复']],
  [86, 88, '再靠手动复制、粘贴、转发，人很快就烦，也容易漏。', 'Manual copying, pasting, and forwarding soon becomes tiring and error-prone.', ['复制', '粘贴', '转发']],
  [89, 93, 'n8n、Dify、Zapier这类工具，主要是把几步事串起来。', 'Tools such as n8n, Dify, and Zapier mainly connect several steps.', ['n8n', 'Dify', 'Zapier']],
  [94, 99, '表单进来后分类、写入表格、提醒负责人，需要人看就停下来让人接。', 'A form is classified, written to a sheet, and assigned; it pauses when a person must review.', ['分类', '写入表格', '让人接']],
  [100, 101, '这才叫流程，不是某一次AI帮你做得快。', 'That is a workflow, not AI completing one isolated task faster.', ['流程']],
  [102, 104, '流程越往外连，越不能图省事。', 'The farther a workflow reaches, the less you can cut corners.', ['不能图省事']],
  [105, 107, '客户回复、订单、钱和敏感资料，只要自动往外发，', 'Whenever customer replies, orders, money, or sensitive data are sent automatically,', ['订单', '钱', '敏感资料']],
  [108, 111, '就要先想好谁有权限、谁点确认，跑错了谁来停。', 'decide who has permission, who confirms, and who stops it when it fails.', ['权限', '确认', '谁来停']],
  [112, 118, '第四层是组装：读本地文件、改网站、接接口，或拼成自己的小系统。', 'Level four is assembly: read local files, edit sites, connect APIs, or build a small system.', ['第四层', '组装']],
  [119, 120, 'Codex、Claude Code、Cursor，还有这类编码Agent，', 'Codex, Claude Code, Cursor, and coding Agents of this kind', ['Codex', 'Claude Code', 'Cursor', 'Agent']],
  [121, 121, 'Agent Harness也常见在这一层。', 'including Agent Harness are common at this level.', ['Agent Harness']],
  [122, 127, '它已经不只是聊天框，而是工具怎么接、工作区怎么放、任务怎么协同。', 'It is no longer just chat, but how tools connect, workspaces are organized, and tasks cooperate.', ['工具怎么接', '工作区', '任务协同']],
  [128, 131, '它们能看代码、改文件、跑命令，但新的门槛也出现了：', 'They can inspect code, edit files, and run commands, but new barriers appear:', ['看代码', '改文件', '跑命令']],
  [132, 136, '文件在哪、环境怎么配、接口怎么接、权限怎么给、报错怎么查。', 'Where are files, how is the environment set up, how do APIs and permissions work, and how are errors traced?', ['环境', '接口', '权限', '报错']],
  [137, 143, '我自己感受很深：别人看着一句话做出来，真跑起来是一个报错接一个报错。', 'I know this well: it looks like one sentence built it, but running it brings error after error.', ['一个报错接一个报错']],
  [144, 146, '所以不只看提示词，要看它改了什么，结果是不是真的跑通。', 'So do not judge the prompt alone. Inspect what changed and whether it truly runs.', ['改了什么', '真的跑通']],
  [147, 147, '第五层：开源改造。', 'Level five: open-source modification.', ['第五层', '开源改造']],
  [148, 150, 'GitHub、Gitee第一次打开，很多人会觉得又是看不懂的网站。', 'When people first open GitHub or Gitee, many see another confusing website.', ['GitHub', 'Gitee']],
  [151, 152, '它不是聊天软件，里面放的是公开项目和零件。', 'It is not chat software; it hosts public projects and reusable parts.', ['公开项目', '零件']],
  [153, 155, '把代码拉下来，配合Git、Docker去安装、部署和修改。', 'You pull the code and use Git and Docker to install, deploy, and modify it.', ['Git', 'Docker', '部署']],
  [156, 156, '但别把“下载成功”理解成“我有产品了”。', 'But do not mistake a successful download for owning a product.', ['下载成功', '有产品了']],
  [157, 162, '项目跑起来后，更新、漏洞、数据和故障恢复，这些活不会消失。', 'After launch, updates, vulnerabilities, data, and recovery work do not disappear.', ['更新', '漏洞', '恢复']],
  [163, 165, '真正看的是能不能接住后续维护，而不是会不会点星。', 'What matters is whether you can maintain it, not whether you can click Star.', ['后续维护']],
  [166, 168, '第六层叫系统经营，没有什么“第六层神器”。', 'Level six is system operation. There is no magical level-six tool.', ['第六层', '系统经营']],
  [169, 171, '企业把AI接进多人协作、资料和业务时，通常是一套东西一起工作。', 'When AI enters team collaboration, data, and operations, a whole stack works together.', ['多人协作', '资料', '业务']],
  [172, 174, '模型或API提供能力，Dify、n8n组织流程，知识库放资料；', 'Models or APIs provide capability, Dify and n8n organize workflows, and a knowledge base stores data;', ['API', 'Dify', 'n8n', '知识库']],
  [175, 176, '代码仓库和部署工具记录版本，再加权限、日志、备份和人工审核。', 'repositories and deployment tools track versions, alongside permissions, logs, backups, and human review.', ['权限', '日志', '备份', '人工审核']],
  [177, 177, '最难的已经不是选哪个模型。', 'The hardest part is no longer choosing a model.', ['不是选哪个模型']],
  [178, 179, '资料谁维护、哪些人能看、AI说错了谁接住？', 'Who maintains the data, who may see it, and who catches AI mistakes?', ['谁维护', '谁接住']],
  [180, 181, '钱花到哪儿、哪一步出错，能不能找到记录并恢复？', 'Where was money spent, where did it fail, and can records be found and restored?', ['记录', '恢复']],
  [182, 182, '企业真把AI用进去，最后绕不开这些事。', 'A company truly using AI cannot avoid these responsibilities.', ['绕不开']],
  [183, 184, '别因为接了知识库、连了几个Agent，就觉得企业完成AI转型。', 'Connecting a knowledge base and several Agents does not complete an AI transformation.', ['知识库', 'Agent', 'AI转型']],
  [185, 185, '工具堆在一起，不等于系统能在真实业务里跑下去。', 'A pile of tools is not a system that can keep running in real operations.', ['工具堆在一起', '真实业务']],
  [186, 186, '看到这，来说说你现在在哪一层？', 'So, which level are you at now?', ['哪一层']],
  [187, 189, '回想最近一件事：AI给完答案后，哪一步最费时、最容易错，还必须你接住？', 'Think of one recent task: after AI answers, which step is slowest, riskiest, and still yours to catch?', ['最费时', '最容易错', '你接住']],
  [190, 190, '如果是整理资料，就先把第二层学明白。', 'If it is organizing information, first master level two.', ['第二层']],
  [191, 191, '如果是每天重复搬运，就去看第三层。', 'If it is repetitive transfer every day, look at level three.', ['第三层']],
  [192, 194, '如果准备接文件、接口和真实业务，再去碰第四层以后的东西。', 'If you are connecting files, APIs, and real operations, then move to level four and beyond.', ['第四层以后']],
  [195, 196, '先看AI已经替你干到哪儿，你准备在哪儿把它接住。', 'See how far AI already works for you, then decide where you will take over.', ['干到哪儿', '在哪儿接住']],
  [197, 198, '不管你在哪一层，有问题或工具不会用，留下困惑，我来一一解答。', 'Whatever your level, leave your questions or tool problems and I will answer them.', ['留下困惑']],
  [199, 199, '我是超哥，在兰州AI创业。', 'I am Chao Ge, building an AI business in Lanzhou.', ['超哥', '兰州AI创业']],
];

const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
const transcription = raw.transcription ?? [];
if (transcription.length !== 199) {
  throw new Error(`预期199个转写分段，实际${transcription.length}个`);
}

let expectedStart = 1;
const pages = rows.map(([from, to, zh, en, highlights]) => {
  if (from !== expectedStart || to < from) {
    throw new Error(`字幕范围不连续：预期${expectedStart}，收到${from}-${to}`);
  }
  expectedStart = to + 1;
  const first = transcription[from - 1];
  const last = transcription[to - 1];
  return {
    startMs: Number(first.offsets.from),
    endMs: Number(last.offsets.to),
    zh,
    en,
    highlights,
    rawSegmentRange: [from, to],
  };
});

if (expectedStart !== transcription.length + 1) {
  throw new Error(`字幕范围只覆盖到${expectedStart - 1}，原始分段共${transcription.length}`);
}

for (const page of pages) {
  if ([...page.zh].length > 39) {
    throw new Error(`中文字幕超过39字符：${page.zh}`);
  }
  if (page.en.length > 110) {
    throw new Error(`英文字幕过长：${page.en}`);
  }
}

const rawText = transcription.map((segment) => segment.text).join('');
const correctedText = pages.map((page) => page.zh).join('');
const cleaned = {
  schema_version: 1,
  source: path.relative(root, rawPath),
  approved_script: path.relative(root, scriptPath),
  method:
    '本机whisper.cpp逐段时间轴 + 用户锁定稿术语核对 + 人工字幕页。已知问题：本任务字幕页存在压缩、顺句和向锁定稿靠拢，不属于实录逐字稿；只保留为已验收历史成片的可追溯构建文件。',
  spoken_source_compliance: {
    status: 'known-nonverbatim-user-accepted',
    canonical_source: 'recorded-audio',
    script_role: 'comparison-only',
    reusable_for_future_production: false,
  },
  language: 'zh',
  duration_seconds: pages.at(-1)?.endMs / 1000,
  raw_text: rawText,
  text: correctedText,
  words: pages.map((page) => ({
    text: page.zh,
    raw_text: transcription
      .slice(page.rawSegmentRange[0] - 1, page.rawSegmentRange[1])
      .map((segment) => String(segment.text ?? '').trim())
      .join(''),
    start: page.startMs / 1000 + 0.06,
    end: Math.max(page.startMs / 1000 + 0.12, page.endMs / 1000 - 0.06),
    type: 'word',
    confidence: null,
    speaker_id: 'speaker_0',
  })),
  pages,
};

const comparison = {
  schema_version: 1,
  source_transcript: path.relative(root, rawPath),
  approved_script: path.relative(root, scriptPath),
  policy:
    '历史构建记录：时间窗来自真人原片，但字幕文字曾被压缩和顺句。不得把本比较结果写成逐字保真通过，也不得复用于下一条。',
  raw_duration_seconds: cleaned.duration_seconds,
  raw_segment_count: transcription.length,
  corrected_page_count: pages.length,
  protected_terms: [
    'AI',
    'DeepSeek',
    'Kimi',
    '千问',
    'WorkBuddy',
    'n8n',
    'Dify',
    'Zapier',
    'Codex',
    'Claude Code',
    'Cursor',
    'Agent Harness',
    'GitHub',
    'Gitee',
    'Git',
    'Docker',
  ],
  asset_exclusions: [
    path.resolve(
      process.env.KOUBO_MATERIALS_ROOT || path.join(os.homedir(), 'Desktop', '口播素材'),
      '2026-08-20_AI六层能力地图/04_参考图',
    ),
  ],
  notes: [
    '三条用户生成AI视频仅作为情景演绎，统一静音，保留真人口播主音轨。',
    '原片包含自然改述和语气词，字幕按实际声音校正，未用锁定稿强行覆盖时间轴。',
    '正式成片仍需用户完整观看确认。',
  ],
};

for (const target of [cleanedPath, comparisonPath, bilingualPath, textPath]) {
  fs.mkdirSync(path.dirname(target), {recursive: true});
}
fs.writeFileSync(cleanedPath, `${JSON.stringify(cleaned, null, 2)}\n`, 'utf8');
fs.writeFileSync(comparisonPath, `${JSON.stringify(comparison, null, 2)}\n`, 'utf8');
fs.writeFileSync(
  bilingualPath,
  `${JSON.stringify(
    pages.map(({startMs, endMs, zh, en, highlights}) => ({
      startMs,
      endMs,
      zh,
      en,
      highlights,
    })),
    null,
    2,
  )}\n`,
  'utf8',
);
fs.writeFileSync(textPath, `${correctedText}\n`, 'utf8');

console.log(
  JSON.stringify(
    {
      durationSeconds: cleaned.duration_seconds,
      pages: pages.length,
      cleanedPath,
      comparisonPath,
      bilingualPath,
    },
    null,
    2,
  ),
);
