import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const base = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(base, '../../..');
const rawPath = path.join(base, 'turbo.actual.raw.json');
const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
const smallPath = path.join(base, 'whisper-small.actual.raw.json');
const recheckPath = path.join(base, 'final-r1-local-recheck.json');
const approvedPath = path.resolve(base, '../07_预览与质检/录屏小样R2/captions.json');
const approved = JSON.parse(fs.readFileSync(approvedPath, 'utf8'));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

// 只修拼写与明确识别错词。所有依据均为机器转写/原声音频分段复核，未声称人工听审。
const correctionRows = [
  ['顶贴', '顶替', '8–12秒离线片段与两份整段识别均为同音；职场替代语境确定为顶替。'],
  ['屁毛', '皮毛', '21–29秒离线片段和small整段均识别为皮毛。'],
  ['低层', '底层', '知识教学语境的同音正字；不增加底层之后的词。'],
  ['AI里外', 'AI例外', '21–29秒离线片段保留li-wai发音；上下句为所有人/唯独的例外关系。'],
  ['两次根', '两次坑', 'small原声识别为最少让你踩两次坑。'],
  ['不是被答是脸判断力', '不是背答案是练判断力', '75–81秒独立原声片段识别为不是被答案是练判断力；仅同音正字。'],
  ['检验体', '检验题', '92–100秒独立原声片段与两份整段识别均为检验ti；三道题语境正字。'],
  ['应讨所有人', '硬套所有人', '120–125秒独立原声片段为同音ying-tao；一套方案的搭配，不恢复原稿其他词。'],
  ['浅长遮止', '浅尝辄止', '沿用用户已认可的R2字幕，原识别为成语同音错误。'],
  ['最坏情景较量', '最坏情景教练', '169–174秒独立原声片段明确识别为最坏情景教练。'],
  ['薄热环节', '薄弱环节', '183–193秒独立原声片段及small薄肉缓解为薄弱环节的近音错误。'],
  ['提前演练分析', '提前演练风险', '183–193秒独立原声片段明确识别为提前演练风险。'],
  ['靠拆', '靠猜', '200–210秒独立原声片段明确识别为如果你是靠猜。'],
  ['死记忆被', '死记硬背', 'small原声死机硬被与200–210秒片段死记硬被交叉支持。保留后文拿来的结果。'],
  ['要按例', '要案例', '两份原声转写均为同音an-li；要求实例解释语境正字。'],
  ['一好AI', '一号AI', 'small整段识别为一号AI；保留turbo识别出的语气词呢。'],
  ['二好AI', '二号AI', 'small整段识别为二号AI。'],
  ['三好AI', '三号AI', 'small整段识别为三号AI。'],
  ['最有答案', '最优答案', '278–305秒独立原声片段为最优大案；合并同音正字为最优答案。'],
  ['因实力', '硬实力', '两份原声转写与尾段复核均为yin-shi-li近音，安身立命的硬实力语境正字。'],
  ['蓝整提示词', '完整提示词', '278–305秒独立原声片段明确识别为完整提示词。保留整段识别的呢。'],
  ['评论区制定', '评论区置顶', '278–305秒独立原声片段明确识别为评论区置顶。'],
  ['兰州美业创业', '兰州AI创业', '278–305秒独立原声片段明确识别为在兰州AI创业。'],
];
const corrections = correctionRows.map(([from,to,evidence]) => ({from,to,type:from.includes('兰州')?'proper-noun-spelling':'unmistakable-asr-error',evidence}));
const clean = text => corrections.reduce((value,c) => value.replaceAll(c.from,c.to),text.trim());

// 起止编号指向未经改写的本地ASR段。合页只用于同窗排版，不删字、不调整语序。
const rows = [
  [0,0,'What is the most painful truth of adulthood?'],
  [1,1,'No one will teach you without holding something back.'],
  [2,2,'At work, seniors teach you three parts and keep seven back,'],
  [3,3,'afraid you will surpass or replace them.'],
  [4,4,'Industry veterans keep the core know-how to themselves.'],
  [5,5,'There are always more tactics than honest answers.'],
  [6,6,'You pay for courses or seek a mentor,'],
  [7,7,'but most people still teach selectively.'],
  [8,8,'They only teach the surface, not the fundamentals.'],
  [9,9,'Everyone fears you becoming stronger,'],
  [10,10,'except AI.'],
  [11,11,'Only AI is the one teacher in this world'],
  [12,12,'that holds nothing back, has no limit and no selfish motives,'],
  [13,13,'and takes no emotional toll.'],
  [14,14,'Today I will break down the eight AI training methods I use,'],
  [15,15,'all of them, for you.'],
  [16,16,'At the end, I will share the complete set of prompts.'],
  [17,17,'First: a realistic mistake simulator.'],
  [18,18,'It does not just give you the right answer.'],
  [19,19,'Give it your business problem.'],
  [20,20,'Ask AI to build a realistic scenario'],
  [21,21,'and deliberately set traps.'],
  [22,23,'You make plans, write SOPs or plan marketing.'],
  [24,25,'If you make a mistake, AI does not correct you directly.'],
  [26,26,'It keeps guiding you to find the gaps yourself.'],
  [27,27,'It lets you fall into at least two traps'],
  [28,28,'before revealing where the problem lies.'],
  [29,30,'Practice repeatedly until you get it right on your own.'],
  [31,31,'It is not memorizing answers; it is training judgment.'],
  [32,32,'Second: a confusion breaker.'],
  [33,33,'When you encounter a difficult specialist concept,'],
  [34,34,'do not let AI throw jargon at you.'],
  [35,35,'Ask for a key sentence using an everyday analogy first.'],
  [36,36,'Then it gives you three test questions.'],
  [37,37,'You must get all three right before choosing what comes next.'],
  [38,38,'Avoid only half-understanding.'],
  [39,40,'You may understand what you read but still cannot apply it.'],
  [41,42,'Third: a customized learning path.'],
  [43,44,'Give AI your goal and your current foundation,'],
  [45,45,'and how much time you can invest each week.'],
  [46,46,'AI produces a seven-day learning plan.'],
  [47,47,'Set aside 45 minutes each day.'],
  [48,48,'Make clear what you should do today,'],
  [49,49,'what counts as completion,'],
  [50,50,'and where the likely pitfalls are.'],
  [51,52,'If you cannot keep up, adjust the plan immediately.'],
  [53,54,'Do not force one plan on everyone.'],
  [55,56,'Fourth: a hidden-gap detector.'],
  // 57–76逐页直接采用已确认R2，时间轴平移至原片。
  [77,78,'Sixth: a worst-case scenario coach.'],
  [79,79,'Simulate a high-pressure unexpected situation,'],
  [80,80,'without providing any reference material.'],
  [81,81,'For example, a client changes requirements at the last minute,'],
  [82,82,'or your plan is challenged on the spot.'],
  [83,83,'You respond on the spot. Afterwards,'],
  [84,84,'AI reviews your weak points'],
  [85,85,'and tells you which areas to target.'],
  [86,86,'Rehearse the risks in advance.'],
  [87,90,'Seventh: a mental-shortcut checker.'],
  [91,91,'After you solve a business problem,'],
  [92,92,'ask AI to trace your entire thinking process.'],
  [93,94,'If you relied on guessing or templates,'],
  [95,95,'or arrived at the result through rote memorization,'],
  [96,96,'it sends it back for a rewrite.'],
  [97,97,'You must explain clearly'],
  [98,98,'why you made each judgment.'],
  [99,102,'Only sound logic counts as real mastery.'],
  [103,104,'No relying on luck.'],
  [105,107,'Eighth: a reverse-teaching simulator.'],
  [108,109,'Reverse the roles: let AI be a beginner student,'],
  [110,111,'and you teach it the knowledge.'],
  [112,112,'Whenever you use a technical term,'],
  [113,113,'AI immediately asks follow-up questions,'],
  [114,115,'asking for examples and plain-language explanations.'],
  [116,116,'If your logic is wrong,'],
  [117,118,'AI follows that mistaken reasoning'],
  [119,119,'until it reaches an absurd result.'],
  [120,120,'It helps reveal the flaws in your understanding,'],
  [121,121,'until you can explain things clearly.'],
  [122,123,'Finally, the ultimate method that applies to all learning:'],
  [124,125,'Experts do not use just one AI tool.'],
  [126,126,'For the same business problem,'],
  [127,127,'you can assign different roles to multiple AIs.'],
  [128,128,'AI number one:'],
  [129,129,'a mistake simulator that creates scenarios'],
  [130,130,'and lets you try, fail and encounter pitfalls.'],
  [131,132,'AI number two: a gap detector'],
  [133,133,'that finds problems in the plan.'],
  [134,134,'AI number three:'],
  [135,135,'cross-check all the results'],
  [136,136,'and compare different approaches.'],
  [137,138,'Multiple AIs cross-check one another,'],
  [139,139,'challenge one another,'],
  [140,140,'and refine the work layer by layer,'],
  [141,142,'finally selecting the best answer.'],
  [143,144,'The highest form of adult self-discipline'],
  [145,145,'is using AI that holds nothing back'],
  [146,146,'to take skills others cannot learn or fully understand,'],
  [147,147,'or cannot learn completely,'],
  [148,148,'and turn them into solid skills you can rely on.'],
  [149,149,'What you receive is always the best answer for you right now.'],
  [150,151,'I will pin the complete prompts in the comments.'],
  [152,153,'I am Chao, building an AI business in Lanzhou.'],
];
const captions = rows.map(([first,last,en]) => ({
  startMs: Math.round(raw.segments[first].start * 1000),
  endMs: Math.round(raw.segments[last].end * 1000),
  zh: clean(raw.segments.slice(first,last+1).map(s=>s.text).join('')),
  en,
}));
captions.push(...approved.map(c=>({...c,startMs:c.startMs+128200,endMs:c.endMs+128200})));
captions.sort((a,b)=>a.startMs-b.startMs);
for (let i=0;i<captions.length;i++) {
  const c=captions[i];
  if (!(c.startMs>=0 && c.endMs>c.startMs && c.endMs<=305167 && c.zh && c.en)) throw new Error(`无效字幕${i}`);
  if (i && captions[i-1].endMs>c.startMs) throw new Error(`字幕重叠${i}`);
}
const correctionPath = path.join(base,'final-r1-correction-log.json');
const transcriptPath = path.join(base,'final-r1-actual-transcript.json');
const captionsPath = path.join(base,'final-r1-bilingual-captions.json');
const policyPath = path.join(base,'final-r1-spoken-source-policy.json');
const sourceVideo = path.resolve(base,'../01_素材投放区/01_口播原片/copy_8757A6D8-5512-41B6-AE11-BA9F629D6616.MOV');
const sourceBindings = [rawPath,smallPath,recheckPath,approvedPath].map(file=>({path:path.relative(root,file),sha256:hash(file)}));
const transcript = {
  schemaVersion:1, canonicalSource:'recorded-audio', scriptProvidedToASR:false,
  sourceVideo:path.relative(root,sourceVideo), durationSeconds:305.166667,
  sourceBindings,
  wordArrayGranularity:'source-ASR-segments; not fabricated per-character forced alignment',
  words:raw.segments.slice(0,154).map((s,i)=>({start:s.start,end:s.end,text:clean(s.text),raw_text:s.text,verbatim_text:clean(s.text),sourceSegmentIndex:i})),
  discardedASRSegments:[{index:154,start:305.06,end:305.10,text:raw.segments[154].text,reason:'40毫秒内不可能出现九字重复句，small及尾段独立转写均无该重复；判定为尾部ASR幻觉。没有剪除任何原声音频。'}],
};
const preserved = [
  {time:'31.66–34.72',text:'无限次数',reason:'两份原声转写一致，不恢复原稿不限次数。'},
  {time:'95.42–98.92',text:'才能往下选',reason:'两份原声转写与92–100秒离线片段均为选，保留，不擅自改成学。'},
  {time:'163.74–165.98',text:'如果停止不前，直接点名',reason:'原声双识别一致，R2已认可，原样沿用。'},
  {time:'186.68–190.18',text:'告诉你要针对性的哪些地方',reason:'两份原声转写与离线片段一致，未补入原稿训练二字。'},
  {time:'204.82–207.70',text:'靠模板，死记硬背拿来的结果',reason:'保留原声靠和拿来，不恢复原稿套与拿到。'},
  {time:'270.58–273.60',text:'交叉校验所有结果',reason:'保留原声结果，不恢复原稿结论。'},
];
const write = (file,value) => fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');
write(transcriptPath,transcript);
write(captionsPath,captions);
const srtTime = ms => {
  const value = Math.round(ms);
  return `${String(Math.floor(value/3600000)).padStart(2,'0')}:${String(Math.floor(value/60000)%60).padStart(2,'0')}:${String(Math.floor(value/1000)%60).padStart(2,'0')},${String(value%1000).padStart(3,'0')}`;
};
fs.writeFileSync(path.join(base,'final-r1-bilingual-captions.srt'),captions.map((c,i)=>`${i+1}\n${srtTime(c.startMs)} --> ${srtTime(c.endMs)}\n${c.zh}\n${c.en}\n`).join('\n'));
write(correctionPath,{
  schemaVersion:1, scope:'本期原声全量保留字幕', humanListeningPerformed:false,
  verificationMethod:'两份独立离线ASR交叉核对，10处原声片段无提示词离线复核，R2已认可段逐字沿用。',
  sources:sourceBindings,corrections,spellingOnly:false,retainedSpokenVariants:preserved,
  discardedASRSegments:transcript.discardedASRSegments,
  uncertainty:'选/学、停止/停滞、点名/点明等同音或近音歧义保持当前实录及已认可R2结果，不声称完成真人听审。',
  approvalBoundary:'技术一致性不等于最终人工验收；保留用户整片终验。',
});
write(policyPath,{
  schemaVersion:1,canonicalSource:'recorded-audio',scriptRole:'comparison-only',captionTextPolicy:'spoken-verbatim',englishTranslationSource:'canonical-spoken-chinese',
  source:{video:sourceVideo,sha256:hash(sourceVideo),durationSeconds:305.166667},
  transcript:{path:transcriptPath,sha256:hash(transcriptPath)},captions:{path:captionsPath,sha256:hash(captionsPath)},
  verification:{minimumGlobalPrecision:1,minimumGlobalCoverage:1,corrections,correctionLog:correctionPath,humanListeningPerformed:false,sourceBindings,
    acceptedPreview:{path:approvedPath,sha256:hash(approvedPath),sourceOffsetMs:128200,wordingUnchanged:true}},
  compliance:{status:'passed',scope:'实录文本与字幕逐字一致及时间窗结构检查；不代表已完成全片人工观看',finalHumanAcceptance:false},
  unchangedAudio:true,actualSpokenVariantsPreserved:preserved,
});
console.log(JSON.stringify({captions:captions.length,transcript:transcriptPath,captionsPath,policyPath,correctionPath},null,2));
