import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const rawPath = path.join(root, 'edit/transcripts/ordinary-ai-aigc-20260818/mlx-output/ordinary-ai-aigc-20260818.json');
const scriptPath = path.join(root, 'notes/2026-08-18-普通人学AI与AIGC漫剧入门-用户锁定最终口播稿-v1.md');
const outDir = path.join(root, 'edit/transcripts/ordinary-ai-aigc-20260818');
const outPath = path.join(outDir, 'ordinary-ai-aigc-20260818.cleaned.v1.json');
const captionsPath = path.join(root, 'remotion/public/data/ordinary_ai_aigc_20260818.captions.v1.json');
const bilingualPath = path.join(root, 'remotion/public/data/ordinary_ai_aigc_20260818.bilingual.v1.json');
const textPath = path.join(outDir, 'ordinary-ai-aigc-20260818.cleaned.v1.txt');
const comparisonPath = path.join(outDir, 'ordinary-ai-aigc-20260818.script-comparison.v1.json');

const normalize = (value) => [...String(value ?? '')].filter((c) => /[\p{L}\p{N}]/u.test(c)).map((c) => c.toLowerCase());
const cleanPage = (value) => String(value).replace(/\s+/gu, '').trim();
const cleanDisplayPage = (value) => String(value).replace(/\s+/gu, ' ').trim();

const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
const markdown = fs.readFileSync(scriptPath, 'utf8');
const body = markdown.match(/<!-- CONTENT_START -->([\s\S]*?)<!-- CONTENT_END -->/)?.[1] ?? '';
const paragraphs = body.split(/\n\s*\n/u).map(cleanPage).filter((value) => value && !value.startsWith('#'));
const displayParagraphs = body.split(/\n\s*\n/u).map(cleanDisplayPage).filter((value) => value && !value.startsWith('#'));
const spokenAddition = '现在咱们兰州本地市场做这些OPC的，或者是AIGC这一块的人，其实还是蛮多的。';
const spokenClosing = '如果你也在考虑做AI工作流、动漫、漫剧或者AIGC内容，可以在评论区写下：你现在在做什么内容，现在最缺创意、技术、团队还是资金，以及你准备先拿多少预算做样片。';
const spokenParagraphs = paragraphs.flatMap((paragraph) => {
  const rows = [paragraph];
  if (paragraph === '如果自己懂故事、导演或者某个行业内容，但缺技术执行和后期，可以找人合作。') rows.push(spokenAddition);
  if (paragraph.startsWith('如果你也在考虑做AI工作流、动漫、漫剧或者AIGC内容，可以在评论区写下：')) rows[0] = spokenClosing;
  return rows;
});
const spokenDisplayParagraphs = displayParagraphs.flatMap((paragraph) => {
  const rows = [paragraph];
  if (paragraph === '如果自己懂故事、导演或者某个行业内容，但缺技术执行和后期，可以找人合作。') rows.push(spokenAddition);
  if (paragraph.startsWith('如果你也在考虑做AI工作流、动漫、漫剧或者AIGC内容，可以在评论区写下：')) rows[0] = spokenClosing;
  return rows;
});
const targetText = spokenParagraphs.join('');
const targetChars = normalize(targetText);
const targetDisplayChars = [...targetText].filter((c) => /[\p{L}\p{N}]/u.test(c));

const rawUnits = (raw.segments ?? []).flatMap((segment, segmentIndex) => (segment.words ?? []).flatMap((word) => {
  const chars = normalize(word.word);
  if (!chars.length) return [];
  const start = Number(word.start ?? segment.start ?? 0) * 1000;
  const end = Math.max(start + 20, Number(word.end ?? segment.end ?? start / 1000 + 0.1) * 1000);
  return chars.map((text, index) => ({
    text,
    startMs: start + ((end - start) * index) / chars.length,
    endMs: start + ((end - start) * (index + 1)) / chars.length,
    confidence: Number.isFinite(Number(word.probability)) ? Number(word.probability) : null,
    segmentIndex,
  }));
}));
const sourceChars = rawUnits.map((unit) => unit.text);

const rows = sourceChars.length + 1;
const cols = targetChars.length + 1;
const distance = Array.from({length: rows}, () => new Uint16Array(cols));
for (let row = 0; row < rows; row += 1) distance[row][0] = row;
for (let col = 0; col < cols; col += 1) distance[0][col] = col;
for (let row = 1; row < rows; row += 1) {
  for (let col = 1; col < cols; col += 1) {
    const substitute = distance[row - 1][col - 1] + (sourceChars[row - 1] === targetChars[col - 1] ? 0 : 1);
    distance[row][col] = Math.min(substitute, distance[row - 1][col] + 1, distance[row][col - 1] + 1);
  }
}

const mapped = Array(targetChars.length).fill(null);
let row = sourceChars.length;
let col = targetChars.length;
while (row > 0 || col > 0) {
  if (row > 0 && col > 0 && distance[row][col] === distance[row - 1][col - 1] + (sourceChars[row - 1] === targetChars[col - 1] ? 0 : 1)) {
    mapped[col - 1] = rawUnits[row - 1];
    row -= 1;
    col -= 1;
  } else if (row > 0 && distance[row][col] === distance[row - 1][col] + 1) {
    row -= 1;
  } else {
    col -= 1;
  }
}

const durationMs = Math.round(Math.max(...(raw.segments ?? []).map((segment) => Number(segment.end ?? 0))) * 1000);
for (let index = 0; index < mapped.length; index += 1) {
  if (mapped[index]) continue;
  const previous = mapped[index - 1]?.endMs ?? 0;
  let nextIndex = index + 1;
  while (nextIndex < mapped.length && !mapped[nextIndex]) nextIndex += 1;
  const next = mapped[nextIndex]?.startMs ?? durationMs;
  const count = nextIndex - index;
  for (let offset = 0; offset < count; offset += 1) {
    mapped[index + offset] = {
      text: targetChars[index + offset],
      startMs: previous + ((next - previous) * offset) / count,
      endMs: previous + ((next - previous) * (offset + 1)) / count,
      confidence: null,
      segmentIndex: null,
    };
  }
}

let cursorMs = 0;
const words = targetChars.map((text, index) => {
  const unit = mapped[index];
  const startMs = Math.max(cursorMs, Math.round(unit.startMs));
  const endMs = Math.max(startMs + 20, Math.round(unit.endMs));
  cursorMs = endMs;
  return {text: targetDisplayChars[index], start: startMs / 1000, end: endMs / 1000, type: 'word', speaker_id: 'speaker_0', confidence: unit.confidence, raw_segment_index: unit.segmentIndex};
});
const captionWords = words.map(({text, start, end, confidence}) => ({
  text,
  startMs: Math.round(start * 1000),
  endMs: Math.round(end * 1000),
  timestampMs: null,
  confidence,
}));

const highlights = ['学AI', '赚到钱', '兰州', '三种情况', '真实任务', '小样片', '五件事', '最小闭环', '6.02亿', '42.8%', '80.9%', '6.26亿', '1000亿元', '35万家', '603部', '6657集', '20秒', '4乘9.15', '36.60元', '146.40元', 'Seedance 2.0', 'Seedance 2.5', '75.60元', '439.20元', '1317.60元', '四条路', '预算上限', '工作室', '小团队', '平台、扶持或者资方', '版权边界'];
const englishTranslations = [
  'Many friends ask me: I want to learn AI too. How can I make money with AI?',
  'But what people really want to know is this: we are here in northwest China, here in Lanzhou. For many people, AI has not yet exploded like it has in coastal cities. Should we learn it? Where do we start? And how do we use AI in work and life?',
  'More realistically, is learning AI still an opportunity for ordinary people?',
  'First, I will help you identify your starting point, then share two practical paths: use AI to improve your current work, or use AI to create animation, short animation dramas, and AIGC content.',
  'Ask yourself: are you learning AI because your work is too much and you need to solve a real skill gap? Or are you anxious because everyone online seems to be learning AI, while you still cannot say what problem you want to solve?',
  'There is another group: they already have a viable animation, short drama, or AIGC idea and want to bring it to life with AI.',
  'All three situations sound like “I want to learn AI,” but the starting points are completely different. Start with a real task, a small sample, or first clarify the result you want to change.',
  'Let us start with work.',
  'By December 2025, China had 602 million generative AI users, with a 42.8% penetration rate. An earlier report showed that answering questions was still the main use, at 80.9%.',
  'Together, these numbers show that many people have met AI, but asking questions and having AI reliably participate in real work are still very different things.',
  'The same is true for companies. The Ministry of Industry and Information Technology lists real steps such as R&D, maintenance, quality inspection, procurement, sales, after-sales service, and operations.',
  'So the foundation for ordinary people is not necessarily code, or memorizing a hundred prompts.',
  'We need to learn five things: what problem to solve, what the input and judgment steps are, what data can be shared, how success is checked, and how mistakes become reusable templates or routines.',
  'For example, if you want AI to organize customer inquiries, do not just say “make me more efficient.” Define the source, the deliverables, the privacy boundary, and the final human check.',
  'That creates a minimum loop: raw input, an AI first draft, human review, delivery, and an error record.',
  'Repeat it until the standard is stable, then consider templates, skills, agents, automation, or code. Without a real task, collecting tools only adds learning burden.',
  'What if you want to make animation, short dramas, or AIGC content?',
  'It is a market worth studying, but a big market does not mean an individual will automatically make money.',
  'A CNNIC report says that China had 626 million short-drama users in the first half of 2025.',
  'A 2025 Beijing report estimates China’s annual short-drama output at about 100 billion yuan, with more than 350,000 active related companies.',
  'In 2025, approved online animation reached 603 titles and 6,657 episodes; key short dramas reached 691 titles and 19,848 episodes.',
  'These figures prove that users, companies, works, and an industry chain exist. They do not prove that one idea will naturally get views, revenue sharing, recommendations, or investment.',
  'Many people start AIGC short dramas the wrong way: they generate beautiful pictures first and think the drama has already begun.',
  'The minimum deliverable is not a few beautiful images. It is an understandable sample: a one-line story, character design, six to twelve shots, sound, editing, and one complete action.',
  'In the first stage, make 30 to 60 seconds. Do not start with dozens of episodes.',
  'The test is simple: can viewers understand it, do characters remain consistent, do shots connect, is the sound clear, and are costs and revisions recorded?',
  'One principle first: prices cannot be compared across platforms, models, and resolutions with one universal rate. Here are two common models on RunningHub.',
  'Seedance 2.0, 4K, 5 seconds, no audio, 16:9: one generation shows 9.15 yuan.',
  'For a 20-second result split into four 5-second shots, one successful generation per shot costs 4 times 9.15, or 36.60 yuan.',
  'But short dramas rarely succeed on the first try. At four attempts per shot, the video model cost is 4 shots times 4 attempts times 9.15, or 146.40 yuan.',
  'That is only the Seedance 2.0 video-model cost. It excludes keyframes, character images, voice, music, editing, captions, storage, and failed revisions.',
  'Seedance 2.5 has a different model and pricing system. A RunningHub example shows 4K, 30 seconds, no audio, 16:9, at 75.60 yuan per generation.',
  'For a 60-second sample with Seedance 2.0, using twelve 5-second shots and four attempts per shot means 48 generations, costing about 439.20 yuan.',
  'For a 3-minute pilot, using 36 five-second shots and four attempts each means 144 generations, costing about 1,317.60 yuan.',
  'This still excludes images, sound, editing, copyright, review, and labor. Character consistency, shot design, action retries, voice, sound effects, and post-production often cause the budget to grow.',
  'If you understand directing, shots, rhythm, or content judgment in an industry, your advantage is more than knowing which button to press.',
  'You know why a scene is shot this way, when a character enters, how to cut, and what viewers should understand in a few seconds. That changes your trial direction and revision count.',
  'This does not mean you can spend nothing. You still invest early, but keep it inside a bounded validation instead of making the whole series at once.',
  'For ordinary people, there are roughly four ways into this market.',
  'First: make a sample at home.',
  'This suits people with ideas, a willingness to learn, and limited budgets. Start with a one-line story, character design, six to twelve shots, and a 30-to-60-second sample. Set a budget ceiling and stop to review when you reach it.',
  'Second: work with a studio.',
  'If you have an idea or IP but lack storyboards, character assets, generation, and post-production skills, buy a sample or a small pilot first.',
  'Do not ask only “how much per episode?” Ask about seconds, shots, revision rounds, asset ownership, commercial rights, voice and music, rework responsibility, and final review.',
  'Third: build a small team.',
  'If you understand stories, directing, or an industry but lack technical execution and post-production, find collaborators.',
  'There are already quite a few OPC and AIGC practitioners in Lanzhou’s local market.',
  'The team need not be large, but every action needs an owner: concept, writing, directing, storyboards, character assets, generation, editing, sound, publishing, and compliance.',
  'Use a small sample to test communication and revisions. Do not judge only by a portfolio.',
  'Fourth: look for platforms, support programs, or investors.',
  'There may be opportunities, but “I have a great idea” is usually not enough. Prepare the story, sample, target audience, budget, rights proof, execution team, and release plan.',
  'Some support programs require an original project in development, planning and filing, plus a draft, sample, or main character designs. Local policies also have eligibility conditions.',
  'Support programs exist, but that does not mean a personal idea automatically receives funding.',
  'Remember two boundaries. A short drama cannot be published freely just because it was generated. Check licensing, filing, review, and the responsible party. AI-generated content must also be declared and labeled as required.',
  'Do not use unauthorized novels, games, anime characters, real-person likenesses, music, or fonts in a commercial sample.',
  'So ordinary people should not start by asking which tool is strongest.',
  'If you want to improve work, complete one minimum loop for a real task.',
  'If you want to make an AIGC short drama, complete a 30-to-60-second sample and record generations, model costs, labor time, rework, and rights boundaries.',
  'After the sample passes, decide whether to work alone, use a studio, build a team, or take the project to a platform, support program, or investor.',
  'Choose the result first, make a small sample, record costs before scaling, and validate the idea and collaboration before spending more.',
  'If you are considering AI workflows, animation, short dramas, or AIGC content, tell me what you are making, what you lack most, and your sample budget.',
  'I am Chao Ge, building an AI business in Lanzhou.'
];
const pages = [];
let charCursor = 0;
for (let paragraphIndex = 0; paragraphIndex < spokenParagraphs.length; paragraphIndex += 1) {
  const paragraph = spokenParagraphs[paragraphIndex];
  const chars = normalize(paragraph);
  if (!chars.length) continue;
  const startIndex = charCursor;
  const endIndex = charCursor + chars.length - 1;
  const startMs = Math.round((words[startIndex]?.start ?? 0) * 1000);
  const endMs = Math.round((words[endIndex]?.end ?? durationMs / 1000) * 1000);
  const displayParagraph = spokenDisplayParagraphs[paragraphIndex] ?? paragraph;
  pages.push({startMs, endMs: Math.max(startMs + 180, endMs), zh: displayParagraph, en: englishTranslations[paragraphIndex] ?? '', highlights: highlights.filter((item) => displayParagraph.includes(item))});
  charCursor += chars.length;
}

const cleaned = {
  schema_version: 1,
  source: path.relative(root, rawPath),
  approved_script: path.relative(root, scriptPath),
  method: '本机MLX Whisper词级转写 + 用户锁定最终稿字符对齐；只用于字幕时间轴，不以ASR原文替代用户稿。',
  language: 'zh',
  duration_seconds: durationMs / 1000,
  text: targetText,
  words,
  pages,
  alignment_edit_distance: distance.at(-1).at(-1),
};
const comparison = {
  schema_version: 1,
  source_transcript: path.relative(root, rawPath),
  approved_script: path.relative(root, scriptPath),
  policy: '口播内容以用户锁定稿为正文；真人原片以实际声音为准；字幕只校正明显ASR识别错误和标点，不新增未说内容、不删除已录内容。',
  raw_duration_seconds: durationMs / 1000,
  approved_character_count: targetChars.length,
  raw_character_count: sourceChars.length,
  alignment_edit_distance: distance.at(-1).at(-1),
  ending_check: targetText.endsWith('我是超哥，在兰州AI创业。'),
  spoken_additions: [spokenAddition, '结尾实际口播加入“你现在在做什么内容”和“资金”；字幕按真实原片保留。'],
  notes: ['ASR存在兰州、AIGC、RunningHub、Seedance、返工、扶持、资方等识别错误，按用户锁定稿和真实口播上下文回填字幕。', '正式成片仍需人工完整观看，不能用机器对齐结果替代真人复核。'],
};

for (const file of [outDir, path.dirname(captionsPath), path.dirname(bilingualPath)]) fs.mkdirSync(file, {recursive: true});
fs.writeFileSync(outPath, `${JSON.stringify(cleaned, null, 2)}\n`, 'utf8');
fs.writeFileSync(captionsPath, `${JSON.stringify(captionWords, null, 2)}\n`, 'utf8');
fs.writeFileSync(bilingualPath, `${JSON.stringify(pages, null, 2)}\n`, 'utf8');
fs.writeFileSync(textPath, `${targetText}\n`, 'utf8');
fs.writeFileSync(comparisonPath, `${JSON.stringify(comparison, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({pages: pages.length, words: words.length, rawChars: sourceChars.length, approvedChars: targetChars.length, editDistance: comparison.alignment_edit_distance, durationSeconds: cleaned.duration_seconds, outPath}, null, 2));
