import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = '/Users/pc/Documents/口播';
const asrDir = path.join(root, 'edit/20261006_ten_ai_businesses/08_实录与字幕');
const out = path.join(asrDir, '字幕候选_R2');
const currentUserConfirmation = {
  source: '本轮用户直接回复',
  quote: '第一步按照你的建议来修补。第二步是AI创业。第三个所有的数据写上，不管，继续。',
  scope: '仅尾句AI创业由用户明确核对；95%与89%及其他数字按实际口播保留；不代表整体字幕听审或事实核验完成。',
  tailText: 'AI创业',
  humanListeningPerformed: false,
  finalHumanAcceptance: false,
};
const rawPath = path.join(asrDir, 'ten-ai-businesses.mlx-whisper-large-v3-turbo.raw.v1.json');
const wordsPath = path.join(asrDir, 'ten-ai-businesses.mlx-whisper-large-v3-turbo.raw.v1.words.json');
const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
const rawWords = JSON.parse(fs.readFileSync(wordsPath, 'utf8'));
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const normalize = text => String(text).replace(/[\s，。？！、：；,.?!:;"“”'‘’（）()《》【】\[\]·—–-]/g, '').toLowerCase();
const correctionDefinitions = [
  [3,'AIA','AI','proper-noun-spelling',[[6,'I']]],
  [10,'AIA','AI','proper-noun-spelling',[[1,'I']]],
  [21,'都包','豆包','proper-noun-spelling',[[4,'豆']]],
  [22,'Worker Barley','WorkBuddy','proper-noun-spelling',[[1,'B'],[2,'ud'],[3,'dy']]],
  [24,'加装','家装','unmistakable-asr-error',[[9,'家']]],
  [36,'AI代谢','AI代写','unmistakable-asr-error',[[8,'写']]],
  [37,'AI出稿','AI初稿','unmistakable-asr-error',[[3,'初']]],
  [51,'营发足','银发族','unmistakable-asr-error',[[0,'银'],[2,'族']]],
  [60,'防诈片','防诈骗','unmistakable-asr-error',[[0,'骗']],59],
  [63,'原生老照片','原声老照片','unmistakable-asr-error',[[2,'声']]],
  [64,'AA','AI','proper-noun-spelling',[[0,'AI']]],
  [75,'AA','AI','proper-noun-spelling',[[0,'AI']]],
  [77,'AA','AI','proper-noun-spelling',[[4,'AI']]],
  [80,'人家AA','人加AI','unmistakable-asr-error',[[8,'加'],[9,'AI']]],
  [86,'代孕营','代运营','proper-noun-spelling',[[3,'运']]],
  [93,'代孕营','代运营','proper-noun-spelling',[[4,'运']]],
  [108,'产业贷AA改造包公图','产业带AI改造包工头','unmistakable-asr-error',[[2,'带'],[3,'AI'],[7,'工'],[8,'头']]],
  [109,'产业贷','产业带','unmistakable-asr-error',[[10,'带']]],
  [110,'AA','AI','proper-noun-spelling',[[2,'I']]],
  [112,'产业袋','产业带','unmistakable-asr-error',[[7,'带']]],
  [135,'和阿祝','AI创业','unmistakable-asr-error',[[0,'AI'],[1,'创'],[2,'业']]],
];

// 每行只组合现有相邻分段；中文正文从校正候选 words 得到，不使用拍前文稿。
// 英文为当前实际中文候选的逐句翻译；歧义位置保持候选，不能自动恢复原稿。
const rows = [
  [[0,1], 'The holiday is over. We go back to work tomorrow.'],
  [[2,3], 'From now until the New Year, I see ten promising AI businesses.'],
  [[4,5], "Starting today, let's watch together and see who gets results first."],
  [[6], 'If you want to start a business or try a side job,'],
  [[7,8], 'even the work you used to do may come in handy.'],
  [[9,10], 'First: AI Agent implementation services.'],
  [[11,12], "Right now, 95% of SMEs can't use an Agent, even after installing it."],
  [[13], 'Especially here, in a third-tier city,'],
  [[14,15,16], 'The opportunity: setup, debugging, and industry customization.'],
  [[17,18], 'Help firms turn a generic Agent into a business assistant that can do real work.'],
  [[19], 'Charge a service fee each month.'],
  [[20], 'Second: producing datasets for vertical industries.'],
  [[21,22], 'Right now there is Doubao Work, WorkBuddy, and Codex,'],
  [[23], 'Such generic models already abound.'],
  [[24,25], 'But to get models truly working in home renovation, medical care, pets, and equipment repair,'],
  [[26], 'to work well in these specialized settings,'],
  [[27], 'you need this industry data: high-quality industry data.'],
  [[28], 'Clean, label, and structure data.'],
  [[29], "This is the 'selling water' work of the AI era."],
  [[30,31], 'Third: AI content differentiation services.'],
  [[32], 'Now, 89% of creators'],
  [[33], 'use AI, and content is becoming increasingly alike.'],
  [[34], 'Truly scarce: real informational advantage,'],
  [[35], 'personal opinions, and original data.'],
  [[36], 'The opportunity is not simply AI ghostwriting.'],
  [[37], 'It is an AI first draft, plus in-depth human re-creation, as a content service.'],
  [[38,39], 'Fourth: the last mile for AI equipment.'],
  [[40,41], 'AI PCs and AI graphics cards:'],
  [[42], 'this hardware is now growing explosively.'],
  [[43,44,45], "But many traditional-industry clients can't choose, configure, or use it after buying it."],
  [[46,47,48], 'We bundle hardware, software, configuration, and training into one delivery,'],
  [[49], 'Income from info gaps and service fees.'],
  [[50,51], 'Fifth: AI companionship and everyday services for seniors.'],
  [[52,53,54], 'Seniors want to book services, find errand help, and hand over fees,'],
  [[55], 'or just find someone to chat with.'],
  [[56,57], 'You can offer AI consultations and care navigation,'],
  [[58,59,60], 'errand services, fraud alerts, and voice companionship.'],
  [[61,62,63], 'And life memoirs: listen to elders, and save their original voices and old photos.'],
  [[64,65], 'Let AI help organize them, then let family members help check them together.'],
  [[66,67], 'Make a digital archive, and print a book as well.'],
  [[68,69], "Later, scan a page to hear the elder's voice from that time."],
  [[70,71], "Even leave this link on a gravestone, with the elder's and family's consent."],
  [[72], 'Demand for this market exists over the long term.'],
  [[73], 'Far less competition than youth-focused markets.'],
  [[74,75], 'Sixth: AI-native organizational consulting services.'],
  [[76], 'This suits people who already understand business management.'],
  [[77], 'Many companies know that AI can improve efficiency,'],
  [[78,79], 'but job design, processes, and performance systems remain in the industrial era.'],
  [[80], 'The opportunity is to redesign job systems built around people plus AI,'],
  [[81,82], 'decision processes, and assessment methods, helping companies upgrade their organizations.'],
  [[83], 'You charge for organizational diagnosis and implementation coaching.'],
  [[84], 'That goes much deeper than installing a piece of software.'],
  [[85,86], 'Seventh: managed GEO operations.'],
  [[87], "A customer asks AI, 'Whose product suits me?'"],
  [[88,89], 'Does the company have reliable material that can be found and cited?'],
  [[90,91], 'The core is structured content and positioning authoritative sources.'],
  [[92], 'Optimize for AI search.'],
  [[93], 'This is the talk managed operations must keep up over time.'],
  [[94,95], 'Eighth: data asset intermediaries in the AI era.'],
  [[96], 'This is not the same as the earlier dataset work.'],
  [[97], 'Earlier, we processed datasets properly.'],
  [[98,99,100], 'Here, it is training data, behavioral data, and creative data.'],
  [[101], 'These can now all become assets.'],
  [[102,103,104], 'But the vast number of companies do not know how to organize, authorize, or monetize it.'],
  [[105], 'The opportunity is to become a data asset manager.'],
  [[106], 'Earn from service fees and commissions.'],
  [[107,108], 'Ninth: AI retrofit contractors for industrial clusters.'],
  [[109], 'China has many physical industrial clusters.'],
  [[110], 'AI-heavy firms do not understand real industries.'],
  [[111], "And industry owners don't know A."],
  [[112], 'Master an entire industrial cluster.'],
  [[113,114], 'Put AI into product selection, inventory, service, and order tracking, earning retrofit fees,'],
  [[115], 'plus a share of the business.'],
  [[116], 'Tenth: human–AI collaboration skills training.'],
  [[117], 'Teach people to complete an end-to-end business workflow with AI.'],
  [[118,119], 'Result-oriented workflow training: product selection, content, service, and delivery.'],
  [[120], 'What are different AI tools good at?'],
  [[121], "How do they fit into people's own work?"],
  [[122], 'Make these concrete methods into reusable teaching materials.'],
  [[123], 'This is training enterprises genuinely need.'],
  [[124,125], 'If any one interests you, come talk about your previous industry.'],
  [[126], "Let's see where your experience can help."],
  [[127,128], 'How to fill skill gaps, then whether to do it.'],
  [[129,130], 'And if you want to know how to start these ten businesses,'],
  [[131], "leave 'AI business' in the comments."],
  [[132], "I'll share my compiled starter material with everyone for free."],
  [[133,134,135], "I'm Chao Ge, starting an AI business in Lanzhou."],
];

const words = raw.segments.flatMap(segment => segment.words.map((word, index) => ({
  ...word,
  text: word.word,
  raw_text: word.word,
  verbatim_text: word.word,
  segmentId: segment.id,
  segmentWordIndex: index,
  sourceWordIndex: 0,
  type: 'word',
  confidence: word.probability,
  speaker_id: 'speaker_0',
})));
words.forEach((word,index) => word.sourceWordIndex=index);
if (words.length !== rawWords.words.length) throw new Error('词数与原始词级文件不一致');
for (const [index,word] of words.entries()) {
  const original=rawWords.words[index];
  if (word.raw_text!==original.word || word.start!==original.start || word.end!==original.end || word.segmentId!==original.segmentId) throw new Error(`原始词校验失败：${index}`);
}

const corrections = correctionDefinitions.map(([segmentId,from,to,type,edits,precedingSegment], index) => {
  const segment=raw.segments[segmentId];
  const affected=words.filter(word=>word.segmentId===segmentId);
  const matchingText = (precedingSegment===undefined?'':raw.segments[precedingSegment].text)+segment.text;
  if (!matchingText.includes(from)) throw new Error(`修正原文不存在：${segmentId} ${from}`);
  const changes=edits.map(([localWordIndex,text]) => {
    const word=affected[localWordIndex];
    if(!word)throw new Error(`修正词索引不存在：${segmentId}:${localWordIndex}`);
    const before=word.text;
    word.text=text;
    word.verbatim_text=text;
    return {sourceWordIndex:word.sourceWordIndex,segmentId,segmentWordIndex:localWordIndex,from:before,to:text,start:word.start,end:word.end};
  });
  const windowStart=precedingSegment===undefined?Math.min(...changes.map(c=>c.start)):raw.segments[precedingSegment].start;
  const windowEnd=Math.max(...changes.map(c=>c.end));
  return {
    id:`COR-${String(index+1).padStart(2,'0')}`,segmentId,segmentIds:precedingSegment===undefined?[segmentId]:[precedingSegment,segmentId],from,to,type,
    evidence: segmentId === 135
      ? `本轮用户直接回复核对：${currentUserConfirmation.quote}；仅文字由用户确认，三个既有词槽与时间原样保留，不声明词内音素已重对齐。`
      : `原声音频窗 ${windowStart.toFixed(2)}—${windowEnd.toFixed(2)} 秒；用户已给出的对应术语或语音识别同音拼写参考；本轮只建立 ASR 拼写候选，未听审、未获逐项用户确认。`,
    originalSegmentText:segment.text,sourceWordIndices:changes.map(c=>c.sourceWordIndex),wordChanges:changes,
    status:segmentId === 135 ? 'user-confirmed-applied' : 'candidate-applied-to-candidate-only',humanListeningPerformed:false,userConfirmed:segmentId === 135,
    ...(segmentId === 135 ? {userConfirmation:currentUserConfirmation} : {}),
  };
});

const segments=raw.segments.map(segment=>({
  id:segment.id,start:segment.start,end:segment.end,raw_text:segment.text,
  text:words.filter(word=>word.segmentId===segment.id).map(word=>word.text).join(''),
  sourceWordIndices:words.filter(word=>word.segmentId===segment.id).map(word=>word.sourceWordIndex),
}));
const usedSegmentIds=rows.flatMap(row=>row[0]);
if(usedSegmentIds.length!==raw.segments.length || usedSegmentIds.some((id,index)=>id!==raw.segments[index].id))throw new Error('字幕行没有按原次序覆盖全部分段');
const captions=rows.map(([segmentIds,en],index)=>{
  const selected=segmentIds.map(id=>segments[id]);
  const zh=selected.map(segment=>segment.text).join('，')+'。';
  return {id:`C${String(index+1).padStart(3,'0')}`,start:selected[0].start,end:selected.at(-1).end,zh,en};
});
const normalizedWords=normalize(words.map(word=>word.text).join(''));
const normalizedCaptions=normalize(captions.map(caption=>caption.zh).join(''));
if(normalizedWords!==normalizedCaptions)throw new Error('字幕与词级串未实现严格100%同源');
for(const segment of segments) {
  const fromWords=words.filter(word=>word.segmentId===segment.id).map(word=>word.text).join('');
  if(fromWords!==segment.text)throw new Error(`分段词级串不一致：${segment.id}`);
}
const applyCorrections=value=>corrections.reduce((text,correction)=>text.replaceAll(correction.from,correction.to),String(value));
if(normalize(words.map(word=>applyCorrections(word.verbatim_text)).join(''))!==normalizedWords)throw new Error('spoken-source全局修正会造成二次漂移');

const pending = [
  {id:'REVIEW-01',segmentIds:[54],start:106.04,end:107.1,raw:'交给费用',candidate:'交个费用',applied:false,reason:'第二模型识别为交个费用；未听审，保留四个原音节候选，不删除。'},
  {id:'REVIEW-02',segmentIds:[29],start:56.2,end:59.2,raw:'这就是AI时代卖水人的事',candidate:null,alternatives:['事','声音','生意'],applied:false,reason:'两模型句尾冲突，不按原稿恢复生意。英文暂译事的字面候选。'},
  {id:'REVIEW-03',segmentIds:[24,25],start:42.18,end:47.3,raw:'但是想要模型真正的在加装医疗还有宠物设备维修',candidate:null,applied:false,reason:'只将同音加装写为家装；医疗、宠物、设备维修的口播次序不按原稿重排，断句和英文并列范围待听校。'},
  {id:'REVIEW-04',segmentIds:[93],start:188.82,end:191.96,raw:'这才是代孕营要长期干的话',candidate:'这才是代运营要长期干的活',applied:false,reason:'仅代运营拼写候选已写入；话/活未听审，中文保留话，英文暂为话的字面候选。'},
  {id:'REVIEW-05',segmentIds:[102],start:205.74,end:207.94,raw:'但是绝大数的企业',candidate:null,applied:false,reason:'不补绝大数缺失的多。'},
  {id:'REVIEW-06',segmentIds:[103,104],start:207.94,end:210.42,raw:'他不知道怎么去整理而授权变现',candidate:null,applied:false,reason:'而/啊连接词尚未听校；不删连接词、不恢复拍前稿。'},
  {id:'REVIEW-07',segmentIds:[105],start:210.42,end:213.22,raw:'机会就是做数据资产经理人',candidate:null,applied:false,reason:'两模型都为经理人；按现有实录候选保留，不改经纪人；英文为manager，不翻成broker。'},
  {id:'REVIEW-08',segmentIds:[110],start:221.08,end:223.58,raw:'重AA公司不懂实体产业',candidate:null,applied:false,reason:'只规范AA缩写为AI，保留重；重/纯/从业冲突未听校，不按稿恢复纯AI。'},
  {id:'REVIEW-09',segmentIds:[111],start:224,end:225.76,raw:'产业老板又不懂A',candidate:'产业老板又不懂AI',applied:false,reason:'单独A与AI是否缺字待听校；防止把单字A全局替换为AI引起已正确AI二次漂移。'},
  {id:'REVIEW-10',segmentIds:[123],start:258.04,end:261.26,raw:'这才是企业真正需求的培训',candidate:null,applied:false,reason:'不补真正需求之前缺失的有。'},
];
pending.forEach(item=>{item.status='pending-human-listening-or-user-direction';item.humanListeningPerformed=false;item.userConfirmed=false;item.sourceWordIndices=words.filter(word=>item.segmentIds.includes(word.segmentId)).map(word=>word.sourceWordIndex);});

const transcript={
  schema_version:1,schemaVersion:'ten-ai-businesses-spoken-candidate/v1',language:'zh',
  source:rawPath,rawSourceSha256:sha256(rawPath),rawWordsSource:wordsPath,rawWordsSha256:sha256(wordsPath),sourceVideoSha256:rawWords.sourceVideoSha256,
  duration_seconds:segments.at(-1).end,raw_text:raw.text,text:words.map(word=>word.text).join(''),
  method:'本期本地ASR逐词时间原样保留；局部同音术语仅为标注候选；中文字幕直接由这些words聚合，英文只由本期中文候选翻译，不以拍前稿恢复口语。',
  currentUserConfirmation,revision:'r2-tail-user-confirmed',
  reviewStatus:'candidate-pending-human-review',humanListeningPerformed:false,correctionsUserConfirmed:false,finalHumanAcceptance:false,
  words,segments,
};
const policy={
  schemaVersion:1,canonicalSource:'recorded-audio',scriptRole:'comparison-only',captionTextPolicy:'spoken-verbatim',englishTranslationSource:'canonical-spoken-chinese',
  sourceVideoSha256:rawWords.sourceVideoSha256,sourceTranscript:rawPath,sourceTranscriptSha256:sha256(rawPath),candidateTranscript:path.join(out,'transcript.r2.json'),
  verification:{minimumGlobalPrecision:1,minimumGlobalCoverage:1,corrections,humanListeningPerformed:false,correctionsUserConfirmed:false,finalHumanAcceptance:false,sourceWordTimingUnchanged:true,allRawWordsRetained:true},
  compliance:{status:'passed',scope:'normalized-candidate-words-and-captions-mechanical-identity-only',precision:1,coverage:1,characterCount:normalizedWords.length,warning:'passed仅指候选words与字幕normalized机械同源，不代表真实发音识别质量、英语正确性、内容事实或人工听看已合格。'},
  currentUserConfirmation,
  review:{status:'pending-human-review',humanListeningPerformed:false,correctionsUserConfirmed:false,finalHumanAcceptance:false,downstreamFinalReleaseAllowed:false,pendingItems:pending},
};
const candidates={schemaVersion:1,currentUserConfirmation,status:'candidate-pending-human-review',rawSource:rawPath,rawSourceSha256:sha256(rawPath),wordTimingPolicy:'unchanged',corrections,pendingItems:pending,captionBindings:rows.map(([segmentIds],index)=>({captionId:captions[index].id,segmentIds,sourceWordIndices:words.filter(word=>segmentIds.includes(word.segmentId)).map(word=>word.sourceWordIndex)})),englishCandidateOnlyCaptionIds:captions.filter((_,index)=>rows[index][0].some(id=>[24,25,29,54,93,102,104,105,110,111].includes(id))).map(c=>c.id),humanListeningPerformed:false,correctionsUserConfirmed:false,finalHumanAcceptance:false};
fs.mkdirSync(out,{recursive:true});
for(const [name,data] of [['captions.r2.json',captions],['transcript.r2.json',transcript],['correction-candidates.r2.json',candidates],['spoken-source-policy.r2.json',policy]])fs.writeFileSync(path.join(out,name),JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify({captions:captions.length,segments:segments.length,words:words.length,corrections:corrections.length,pending:pending.length,precision:1,coverage:1,timesUnchanged:true,humanListeningPerformed:false,finalHumanAcceptance:false}));
