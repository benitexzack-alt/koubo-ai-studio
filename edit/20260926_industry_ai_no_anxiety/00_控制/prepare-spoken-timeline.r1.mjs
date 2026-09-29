// 本期实录候选：只消费本地 ASR，拍摄前文稿不参与字幕生成。
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const base='edit/20260926_industry_ai_no_anxiety';
const dir=`${base}/06_实录与字幕`;
const input=`${dir}/原片_FunASR独立交叉识别.json`;
const raw=JSON.parse(fs.readFileSync(input)).result[0];
const tokens=raw.text.split(' ');
assert.equal(tokens.length,raw.timestamp.length);
const binding=p=>({path:p,sha256:createHash('sha256').update(fs.readFileSync(p)).digest('hex')});
const write=(p,o)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(o,null,2)+'\n',{flag:'wx'});};
const correctionRows=[
 [130,'篇','unmistakable-asr-error','教程的篇章量词，同音字修正，不添加原稿未说内容'],
 [302,'赚','unmistakable-asr-error','两版Whisper均为“钱赚到手”，中文模型误识为“钱战斗士”；保留“手”'],
 [303,'到','unmistakable-asr-error','同上，“赚到手”实录跨模型核对'],
 [304,'手','unmistakable-asr-error','同上，“赚到手”实录跨模型核对'],
 [339,'死','unmistakable-asr-error','两版Whisper均识别AOL死；用户已批准保留原声并另加更正'],
 [358,'页','proper-noun-spelling','黄页是本句所指目录名称，黄叶为同音误识'],
 [407,'终','unmistakable-asr-error','原始Whisper为“自己没走到终局”，中文模型为“中去”；只修同音词'],
 [408,'局','unmistakable-asr-error','同上；不改其余口语'],
 [465,'Open','proper-noun-spelling','统一公司名称OpenAI的拼写'],
 [466,'AI','proper-noun-spelling','术语增强Whisper识别open AI；中文模型英语拼写修正'],
 [479,'托','unmistakable-asr-error','“托你一把”同音字修正；不改原口语结构'],
 [497,'正','unmistakable-asr-error','“现金流为正”同音字修正，仍保留实际“保证、嗯”'],
 [527,'超','proper-noun-spelling','本人署名超哥，术语增强Whisper亦为超哥'],
];
const corrections=correctionRows.map(([index,to,type,evidence])=>({index,from:tokens[index],to,type,evidence,startMs:raw.timestamp[index][0],endMs:raw.timestamp[index][1]}));
const byIndex=new Map(corrections.map(c=>[c.index,c.to]));
const words=tokens.map((text,i)=>({text:byIndex.get(i)??text,raw_text:text,start:raw.timestamp[i][0]/1000,end:raw.timestamp[i][1]/1000,startMs:raw.timestamp[i][0],endMs:raw.timestamp[i][1],timestampMs:raw.timestamp[i][0],confidence:null}));
const ends=[9,23,40,54,62,72,85,94,107,120,124,135,145,151,157,164,174,186,196,200,207,219,228,238,248,254,263,268,274,283,294,304,309,320,330,335,340,348,355,364,368,382,389,401,408,417,424,435,444,453,466,473,482,489,497,507,518,524,534];
const english=[
 'Business owners, stop worrying about AI.',
 "Do not pit your weaknesses against someone else's strengths.",
 'There are people everywhere who understand AI, but not your industry.',
 'They put a wrapper on it and claim they will disrupt your industry.',
 'What they know how to use are tools.',
 'And what you have, in this industry,',
 'is hands-on experience earned the hard way.',
 'Why do customers actually pay?',
 'Which part keeps you awake at night?',
 'Where is the padding hidden in a quote?',
 'These things',
 'are not in any AI tutorial.',
 'You learned them by stumbling through them yourself.',
 'The future winners',
 'combine application insight',
 'with skills and capability.',
 'For ordinary people like us,',
 'what is so grand about application insight?',
 'It is being in an industry',
 'for ten years,',
 'and the scars you have accumulated.',
 'Pair that industry foundation with AI.',
 'You are the one who understands prospecting',
 'and gets a shovel first.',
 'Forget grand narratives.',
 'Right now, in one...',
 'in the smallest possible scenario,',
 'get the money back.',
 'That is more useful than anything else.',
 'Here is something counterintuitive.',
 'Do not always think about surviving until the end.',
 'First, earn the money from these ten years.',
 'Many people say,',
 'well, the AI companies we are building now',
 'will probably not survive.',
 'So what about that?',
 'Say AOL died.',
 'That does not mean that, in 1995,',
 'people running internet cafes or building websites',
 'and selling Yellow Pages did not earn money.',
 'BlackBerry lost.',
 'That does not mean the earliest mobile app',
 'teams did not benefit.',
 'Business history has many companies like this.',
 'They did not make it to the end.',
 'But their founders, in that wave,',
 'earned their first pot of gold,',
 'and accumulated knowledge, a team and courage.',
 'Then they invested in the next step.',
 'The goal for ordinary people like us',
 'has never been to become the next OpenAI.',
 'It is to let this wave',
 'give you a real lift.',
 'Travel light.',
 'Make sure, um, your cash flow is positive.',
 'Then use the money you earn to gain knowledge,',
 'and use that knowledge to catch the next wave.',
 'It is that simple.',
 'I am Chao, building an AI business in Lanzhou.',
];
assert.equal(ends.length,english.length);
let start=0;
const captions=ends.map((end,i)=>{
 const from=start;start=end+1;
 return {id:`C${String(i+1).padStart(2,'0')}`,tokenRange:[from,end+1],startMs:words[from].startMs,endMs:words[end].endMs,zh:words.slice(from,end+1).map(w=>w.text).join(''),en:english[i]};
});
assert.equal(start,words.length);
assert.equal(captions.map(c=>c.zh).join(''),words.map(w=>w.text).join(''));
for(let i=1;i<captions.length;i++)assert(captions[i].startMs>=captions[i-1].endMs);
const userConfirmation={quote:'这两个你按照转写出来的结果走吧，就按我原篇转写出来是什么就是什么。',retained:['技能能力','下一步'],scope:'仅两处歧义按转写结果保留；不冒充全片听审'};
write(`${dir}/实录逐词_候选.r1.json`,{schemaVersion:1,status:'candidate-for-preview',source:binding(input),canonicalSource:'recorded-audio',words,corrections,userConfirmation,humanListeningPerformed:false});
write(`${dir}/实录双语字幕_候选.r1.json`,captions);
write(`${dir}/字幕核对记录.r1.json`,{schemaVersion:1,status:'candidate-not-human-verified',input:binding(input),transcript:binding(`${dir}/实录逐词_候选.r1.json`),captions:binding(`${dir}/实录双语字幕_候选.r1.json`),userConfirmation,corrections,checks:{all535TokensCovered:true,noTimeOverlap:true,captionPageCount:captions.length,scriptUsedAsSubtitleInput:false},remainingListeningNotes:[{seconds:[55.66,58.24],text:'就是现在一件最小的一个场景里面',treatment:'保留识别结果，未替换成拍前“先在”'},{seconds:[70.73,72.97],text:'其实说现在我做AI的公司',treatment:'保留中文模型实录候选，不静默顺句'}],humanListeningPerformed:false,formalRenderAllowed:false});
const cues=JSON.parse(fs.readFileSync(`${base}/02_导演方案/director-cues.v2.json`));
const starts=[0,10,24,55,86,95,108,121,146,165,187,208,239,275,284,305,331,336,365,390,402,445,467,483,519];
const boundaries=starts.map((v,i)=>i===0?0:Math.round(words[v].start*30));boundaries.push(3687);
const beats=cues.semanticBeats.map((b,i)=>({...b,scriptQuote:undefined,recordedQuote:words.slice(starts[i],starts[i+1]??words.length).map(w=>w.text).join(''),frames:{startFrame:boundaries[i],endFrameExclusive:boundaries[i+1]},timeAuthority:'local-asr-word-timing',timingStatus:'candidate-awaiting-dynamic-review'}));
assert.equal(beats.length,25);
write(`${base}/04_Remotion准备/实录重绑时间线.r1.json`,{schemaVersion:1,status:'postshoot-timing-candidate',fps:30,durationInFrames:3687,preserveFullRecording:true,sourceDirector:binding(`${base}/02_导演方案/director-cues.v2.json`),sourceTranscript:binding(`${dir}/实录逐词_候选.r1.json`),beats,formalEligible:false});
console.log(JSON.stringify({subtitlePages:captions.length,tokens:words.length,beats:beats.length,seconds:3687/30,userRetained:userConfirmation.retained}));
