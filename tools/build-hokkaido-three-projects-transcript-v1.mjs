import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const rawPath =
  process.argv[2] ??
  path.join(
    projectRoot,
    'edit/transcripts/HOKKAIDO3_20260725_talk01_whisper-small.json',
  );
const cleanedPath =
  process.argv[3] ??
  path.join(
    projectRoot,
    'edit/transcripts/HOKKAIDO3_20260725_talk01.cleaned.v1.json',
  );
const captionsPath =
  process.argv[4] ??
  path.join(
    projectRoot,
    'remotion/public/data/HOKKAIDO3_20260725_talk01.captions.v1.json',
  );
const bilingualPath =
  process.argv[5] ??
  path.join(
    projectRoot,
    'remotion/public/data/HOKKAIDO3_20260725_talk01.bilingual.v1.json',
  );
const textPath =
  process.argv[6] ??
  path.join(
    projectRoot,
    'edit/transcripts/HOKKAIDO3_20260725_talk01.cleaned.v1.txt',
  );
const reviewPath =
  process.argv[7] ??
  path.join(
    projectRoot,
    'edit/transcripts/HOKKAIDO3_20260725_talk01.script-comparison.v1.json',
  );

const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
const rawSegments = Array.isArray(raw.transcription) ? raw.transcription : [];

const correctedSegments = [
  '最近看到一个AI落地案例，对我启发特别大。',
  '一个学社会学、没有受过专业编程训练的北海道农民，',
  '怎么把AI真正接进了温室？',
  '他不是问AI：“你怎么帮我把农场管起来？”',
  '他先说清楚了一个每天都在发生的麻烦。',
  '这个农场里面有好几座温室，温度一高，',
  '工作人员就得一座一座地去看，然后再手动开窗。',
  '于是他就想要一个结果。什么结果呢？',
  '然后他就问ChatGPT：能不能让大家平时在一个聊天群里面，',
  '看到每座温室的温度上升之后，只需要发一句话，就把窗户打开？',
  'ChatGPT就帮他拆解方案、列部件。',
  '然后他照着买了温度计、小型控制器和电机。',
  '不会接线，他就把部件拍下来，继续一步一步地问。',
  'Codex再帮他写代码，把传感器、聊天工具和电机接起来。',
  '然后他自己进到温室里面安装、测试，报错了，回来再继续改。',
  '这套远程开窗，他前后大概做了两个月的时间。',
  '后来员工只需要在群里发一句“温度”，数据就能出来。',
  '发出开窗指令，电机就会动作。',
  '多语言消息转换、手机定位记录农活，也是一点点这样做出来的。',
  '所以AI在这里干了什么？',
  '它没有替农民懂农业，它更像多了一个会写代码、',
  '会帮忙查错的搭档，把农民脑子里已经说得清楚的现场经验，',
  '慢慢变成了能运行的工具。',
  '我看到这里，一下子就想到我自己做的三个项目。',
  '一个跟石头有关，一个跟漫展有关，还有一个跟设计师的灵感有关。',
  '看起来离得很远，可它们的起点其实一样。',
  '有一群人一直想做一件事，只是被流量、技术或者流程卡住了。',
  '先说今石缘。玩石头的人，谁不想把自己的好东西拿出来，让更多人看看？',
  '可每个人自己的朋友圈、群和账号流量都有限。',
  '一块好石头发出去之后，可能热闹两天，很快就沉下去了。',
  '所以我们想搭一个持续运行的线上石展。',
  '石友把图片、尺寸、石种和作品故事传来。',
  '后台由人工审核，入选之后，系统给它一个独立编号，',
  '再放到线上展厅，后面还能继续被找到。',
  'AI在这里不负责鉴定，也不替人判断石头值多少钱。',
  '它负责根据审核过的原图和真实资料，辅助美化图片，',
  '然后整理赏析内容，统一制作展示海报。',
  '平台再把这些作品发到今石缘的账号、朋友圈和群里，',
  '用平台已有的流量，帮个人的好东西被更多石友看见。',
  '后面每一期，我们还准备做线上评选。',
  '给获奖作品发数字证书，按当期规则设置奖品。',
  '这样大家不只是来看一眼，而是愿意把全国各地真正喜欢的石头拿出来，',
  '一起展示、一起交流。',
  '再看Bo2漫展。卖票、出票、现场验票，这些都是基本功能。',
  '但一场漫展结束以后，观众真正愿意带走、愿意分享的，往往还有自己当天的照片。',
  '所以我们要把这两件事接起来。',
  '观众购票、现场核验入场以后，系统给他一份免费的AI海报积分。',
  '他把当天拍的角色扮演照片上传，选择喜欢的风格。',
  'AI再把这张现场照片做成一张属于他自己的漫展纪念海报。',
  '票证明他真实来过，照片是他的输入，风格由他自己选。',
  'AI负责完成中间的视觉转换，周边产品也可以在同一个入口里展示和销售。',
  '还有一个，就是之前我们提到的大志设计师灵感项目。',
  '大志不缺灵感。真正麻烦的是，一个想法冒出来以后，',
  '怎么尽快把它看见、选定，再一步步推到能沟通、能修改、能继续使用。',
  '我们把他的文字、草图、平面图或者参考资料留住。',
  '整理成灵感卡，再让AI显影出几个真正不同的方向，大志自己选。',
  '哪里不对，就继续改。每一次为什么选、为什么删，都留下来。',
  '选定以后，还可以往下做不同视角、不同光线、软装和硬装的调整。',
  '画面里的家具、灯具和其他元素，也可以继续拆出来单独研究。',
  '再往后，施工草图和平面图可以进入效果图、多角度高清图和动画这条深化链。',
  '图片想看哪个角度，视频想做四秒、八秒，还是更长一点，都不必从头再来。',
  '现在已经内部验证过的，是灵感记录、三个方向、连续细化、快速多视角。',
  '不同长度的概念视频和本地知识回写。',
  '把这三个项目放回北海道那个农场，我现在看得更清楚了。',
  'AI真正有用的地方，不是给原来的页面多加一个“生成”按钮。',
  '它要接进一条真实的参与过程：谁有需求，谁来提供资料。',
  'AI具体处理哪一步，最后由谁来确认。',
  '结果放在哪里，下一次还能不能继续使用。',
  '你也可以看看自己最熟的行业。',
  '有没有一群人一直想做一件事，却被流量、技术或者流程卡住？',
  '如果把它做成一条链，哪些事可以交给AI，哪些判断必须留在人的手里？',
  '我现在做的，就是把这些问题放进一个个本地项目里面去跑。',
  '如果这期视频对你的行业有所启发，评论区留下你的行业和你想解决的问题，我给出方案。',
  '关注我，我是超哥。我在兰州搞AI创业。',
];

const englishSegments = [
  'I recently saw an AI implementation case that really inspired me.',
  'A Hokkaido farmer who studied sociology and had no formal programming training',
  'managed to connect AI to his greenhouses.',
  'He did not ask AI, "How can you run my farm for me?"',
  'He first described a problem that happened every day.',
  'The farm had several greenhouses. When temperatures rose,',
  'staff had to inspect them one by one and open the windows by hand.',
  'So he defined the result he wanted. What was it?',
  'He asked ChatGPT: Can everyone use their usual group chat',
  'to see each greenhouse temperature and open a window with one message?',
  'ChatGPT broke down the solution and listed the components.',
  'He bought thermometers, small controllers, and motors.',
  'When wiring confused him, he photographed the parts and kept asking.',
  'Codex helped write the code linking sensors, chat, and motors.',
  'Then he installed and tested it himself, returning to fix every error.',
  'The remote window system took him about two months.',
  'Later, staff typed "temperature" in the group and the readings appeared.',
  'A window-open command made the motor move.',
  'Message translation and phone-based field logging were built the same way.',
  'So what did AI actually do here?',
  'It did not understand farming for him. It acted more like a coding',
  'and debugging partner, turning his clearly expressed field experience',
  'into a tool that could actually run.',
  'That immediately reminded me of the three projects I am building.',
  'One involves stones, one a convention, and one a designer’s inspiration.',
  'They look unrelated, but they begin in the same place.',
  'A group wants to do something but is blocked by reach, technology, or process.',
  'First, Jinshiyuan. Stone collectors want more people to see their best pieces.',
  'But each person’s Moments, groups, and account reach are limited.',
  'A fine stone may attract attention for two days, then disappear.',
  'So we want to build an ongoing online stone exhibition.',
  'Collectors submit photos, dimensions, stone type, and the work’s story.',
  'People review each entry first. Selected works receive a unique number',
  'and enter the online gallery, where they remain discoverable.',
  'AI does not authenticate the stone or decide its price.',
  'Using approved original photos and factual material, it helps enhance images',
  'and organize appreciation copy into a consistent exhibition poster.',
  'The platform then shares the works through Jinshiyuan’s account, Moments, and groups.',
  'Its existing reach helps more collectors discover each person’s best pieces.',
  'In future rounds, we also plan online judging.',
  'Winning works can receive digital certificates and rule-based prizes.',
  'The goal is to get collectors nationwide to share pieces they truly love,',
  'for exhibition and exchange.',
  'Next is the Bo2 convention. Ticket sales, issue, and entry checks are basic functions.',
  'After the event, what attendees want to keep and share is often their own photo.',
  'So we want to connect those two experiences.',
  'After purchase and verified entry, the system gives them free AI poster credits.',
  'They upload a cosplay photo from the day and choose a visual style.',
  'AI turns that real photo into their own convention souvenir poster.',
  'The ticket proves they attended; the photo is their input; they choose the style.',
  'AI handles the visual change, while merchandise can be shown and sold in the same place.',
  'The third is Dazhi’s designer inspiration project, which I mentioned before.',
  'Dazhi does not lack ideas. The real challenge begins when an idea appears:',
  'how to see it, choose it, and develop it into something discussable, editable, and reusable.',
  'We preserve his text, sketches, floor plans, and references.',
  'They become inspiration cards, and AI reveals different directions for Dazhi to choose.',
  'He keeps revising, recording why each option was kept or removed.',
  'The chosen direction can be refined through viewpoints, lighting, furnishings, and finishes.',
  'Furniture, lighting, and other elements can also be separated for further study.',
  'Sketches and floor plans can later feed renderings, multi-angle images, and animation.',
  'A new angle or a four-, eight-, or longer video does not require starting over.',
  'Internally verified so far: idea capture, three directions, refinement, and rapid multi-view concepts.',
  'We have also tested different video lengths and local knowledge write-back.',
  'Putting these projects beside the Hokkaido farm makes the pattern clearer.',
  'AI’s real value is not adding another "Generate" button to a page.',
  'It must join a real participation chain: who needs it, and who provides the material?',
  'Which step does AI handle, and who makes the final decision?',
  'Where does the result live, and can it be reused next time?',
  'Look at the industry you know best.',
  'Is a group being blocked by reach, technology, or process?',
  'If it became a chain, what could AI handle, and what judgment must remain human?',
  'I am testing these questions through one local project at a time.',
  'If this inspires your industry, comment with your field and problem. I will offer a direction.',
  'Follow me. I am Chao, building an AI venture in Lanzhou.',
];

const highlights = {
  0: ['AI落地案例'],
  2: ['AI', '温室'],
  8: ['ChatGPT'],
  10: ['ChatGPT', '列部件'],
  13: ['Codex', '写代码'],
  15: ['两个月'],
  18: ['手机定位', '农活'],
  23: ['三个项目'],
  26: ['流量', '技术', '流程'],
  27: ['今石缘'],
  30: ['线上石展'],
  32: ['人工审核', '独立编号'],
  34: ['不负责鉴定', '不替人判断'],
  39: ['线上评选'],
  40: ['数字证书', '奖品'],
  43: ['Bo2漫展'],
  46: ['核验入场', 'AI海报积分'],
  48: ['漫展纪念海报'],
  51: ['大志', '灵感项目'],
  55: ['不同的方向', '大志自己选'],
  57: ['不同视角', '不同光线', '软装', '硬装'],
  61: ['内部验证过'],
  64: ['不是', '生成'],
  65: ['真实的参与过程'],
  69: ['流量', '技术', '流程'],
  70: ['交给AI', '留在人的手里'],
  73: ['超哥', '兰州', 'AI创业'],
};

if (
  rawSegments.length !== correctedSegments.length ||
  rawSegments.length !== englishSegments.length
) {
  throw new Error(
    `段落数量不一致：raw=${rawSegments.length} zh=${correctedSegments.length} en=${englishSegments.length}`,
  );
}

const splitTokenCharacters = (segment) => {
  const units = [];
  for (const token of segment.tokens ?? []) {
    const tokenText = String(token.text ?? '');
    if (!tokenText || tokenText.startsWith('[_')) {
      continue;
    }
    const characters = [...tokenText.replace(/\s+/gu, '')];
    if (characters.length === 0) {
      continue;
    }
    const tokenStart = Number(token.offsets?.from ?? segment.offsets.from);
    const tokenEnd = Math.max(
      tokenStart + 20,
      Number(token.offsets?.to ?? tokenStart + 20),
    );
    characters.forEach((character, index) => {
      const start = tokenStart + ((tokenEnd - tokenStart) * index) / characters.length;
      const end =
        tokenStart +
        ((tokenEnd - tokenStart) * (index + 1)) / characters.length;
      units.push({
        text: character,
        start,
        end,
        probability: Number.isFinite(Number(token.p)) ? Number(token.p) : null,
      });
    });
  }
  return units;
};

const alignCharacters = (rawUnits, correctedText, segmentStart, segmentEnd) => {
  const target = [...correctedText.replace(/\s+/gu, '')];
  const source = rawUnits.map((unit) => unit.text);
  const rows = source.length + 1;
  const columns = target.length + 1;
  const distance = Array.from({length: rows}, () => Array(columns).fill(0));

  for (let row = 0; row < rows; row += 1) {
    distance[row][0] = row;
  }
  for (let column = 0; column < columns; column += 1) {
    distance[0][column] = column;
  }

  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const substitution = distance[row - 1][column - 1] +
        (source[row - 1] === target[column - 1] ? 0 : 1);
      distance[row][column] = Math.min(
        substitution,
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
        distance[row - 1][column - 1] +
          (source[row - 1] === target[column - 1] ? 0 : 1)
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
    const blockStart = cursor;
    while (cursor < mapped.length && !mapped[cursor]) {
      cursor += 1;
    }
    const blockEnd = cursor;
    const previousEnd =
      blockStart > 0 && mapped[blockStart - 1]
        ? mapped[blockStart - 1].end
        : segmentStart;
    const nextStart =
      blockEnd < mapped.length && mapped[blockEnd]
        ? mapped[blockEnd].start
        : segmentEnd;
    const available = Math.max(20 * (blockEnd - blockStart), nextStart - previousEnd);
    for (let index = blockStart; index < blockEnd; index += 1) {
      const offset = index - blockStart;
      mapped[index] = {
        text: target[index],
        start:
          previousEnd + (available * offset) / Math.max(1, blockEnd - blockStart),
        end:
          previousEnd +
          (available * (offset + 1)) / Math.max(1, blockEnd - blockStart),
        probability: null,
      };
    }
  }

  let monotonicStart = segmentStart;
  return target.map((text, index) => {
    const sourceUnit = mapped[index];
    const start = Math.max(monotonicStart, Math.min(segmentEnd, sourceUnit.start));
    const end = Math.max(start + 20, Math.min(segmentEnd, sourceUnit.end));
    monotonicStart = Math.min(segmentEnd, end);
    return {
      text,
      start: start / 1000,
      end: end / 1000,
      type: 'word',
      speaker_id: 'speaker_0',
      confidence: sourceUnit.probability,
      corrected: source[index] !== text,
      segment_index: null,
    };
  });
};

const words = [];
const segments = [];
const bilingual = [];

rawSegments.forEach((segment, segmentIndex) => {
  const startMs = Number(segment.offsets?.from ?? 0);
  const endMs = Number(segment.offsets?.to ?? startMs + 1);
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
    text: correctedText,
    raw_text: String(segment.text ?? ''),
  });
  bilingual.push({
    startMs,
    endMs,
    zh: correctedText,
    en: englishSegments[segmentIndex],
    highlights: highlights[segmentIndex] ?? [],
  });
});

const transcriptText = correctedSegments.join('');
const captions = words.map((word) => ({
  text: word.text,
  startMs: Math.round(word.start * 1000),
  endMs: Math.max(
    Math.round(word.start * 1000) + 20,
    Math.round(word.end * 1000),
  ),
  timestampMs: Math.round(word.start * 1000),
  confidence: word.confidence,
}));

const cleaned = {
  schema_version: 1,
  source: path.relative(projectRoot, rawPath),
  method: 'whisper.cpp small 本机离线转写 + 锁定稿和上下文机械校正 + 字符级时间映射',
  language: 'zh',
  duration_seconds: 386.9,
  text: transcriptText,
  words,
  segments,
  correction_policy:
    '只修正可由原声上下文、用户确认稿和专有名词共同确认的识别错误；不删除原声，不补入未口播段落。',
};

const comparison = {
  schema_version: 1,
  source_video:
    'source/HOKKAIDO3_20260725_talk01_16x9.MOV',
  approved_script:
    'notes/2026-07-24-北海道农场与三个AI项目-口播稿-v7.md',
  policy:
    '正片全量保留原声；对已省略的事实边界只用明确的画面状态标注兜底，不伪造为口播字幕。',
  observed_differences: [
    {
      type: 'added_spoken_opening',
      spoken: '最近看到一个AI落地案例，对我启发特别大。',
      action: '保留',
    },
    {
      type: 'omitted_script_boundary',
      section: '今石缘',
      omitted:
        '报名、人工审核和线上展厅已有；评选、证书、奖品和完整运营仍待首期活动验证。',
      action: '相关画面持续标注“下一步·待首期活动验证”',
    },
    {
      type: 'omitted_script_boundary',
      section: 'Bo2漫展',
      omitted:
        '已有票务原型和海报视觉方向；支付、出票、核验、积分和真实生图尚未完整跑通。',
      action: '相关画面持续标注“票务原型·待端到端验收”',
    },
    {
      type: 'omitted_script_boundary',
      section: '大志灵感系统',
      omitted:
        '严格一致的专业多视角、施工级图纸和正式交付仍需下一阶段验证。',
      action: '相关画面持续标注“概念演示·非施工交付”',
    },
    {
      type: 'changed_closing',
      spoken:
        '如果这期视频对你的行业有所启发，评论区留下你的行业和你想解决的问题，我给出方案。关注我，我是超哥。我在兰州搞AI创业。',
      action: '按原声保留',
    },
  ],
};

for (const targetPath of [
  cleanedPath,
  captionsPath,
  bilingualPath,
  textPath,
  reviewPath,
]) {
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
console.log(`校正转写：${cleanedPath}`);
console.log(`脚本差异：${reviewPath}`);
