import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root=path.resolve(import.meta.dirname,'../../..');
const base='edit/20260917_ai_efficiency_sharing';
const folder=`${base}/05_实录与字幕`;
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const write=(p,j)=>fs.writeFileSync(path.join(root,p),JSON.stringify(j,null,2)+'\n');
const sourcePath=`${folder}/employee-ai-efficiency.turbo.raw.json`;
const raw=read(sourcePath);
const decisionPath=`${folder}/听辨确认.v1.json`;
const decision=fs.existsSync(path.join(root,decisionPath))?read(decisionPath):null;
const corrections=[
 ['COSA','Cursor','proper-noun-spelling','两套 ASR 分别为 COSA/Closer；用户原稿提供同音产品名 Cursor，仅校正专名拼写。'],
 ['深藏工具名','深藏功与名','unmistakable-asr-error','小模型为深藏公寓名；依据两套识别的音节与固定成语进行机械校正。'],
 ['偷偷提诉','偷偷提速','unmistakable-asr-error','小模型独立识别为偷偷提速。'],
 ['给所以','给所有','unmistakable-asr-error','小模型独立识别为给所有；保留两模型共同识别的想做AI。'],
 ['反补团队','反哺团队','unmistakable-asr-error','反哺为同音词的规范用字；保留拿出一部分来中的来。'],
 ['工具跟先进','工具更先进','unmistakable-asr-error','小模型独立识别为工具更先进。'],
 ['观众超哥','关注超哥','proper-noun-spelling','用户本人已提供账号称呼超哥，行动引导同音识别规范化；不是音频内容改写。'],
 ['最后活越干越多','最后呢活越干越多','unmistakable-asr-error','小模型在66.02–66.74秒独立检出最后呢，保留实际口头连接词。'],
];
if(decision?.confirmed){
 corrections.push(['荣誉',decision.includeLiu?'留冗余':'冗余','unmistakable-asr-error',`用户听辨确认：${decision.userQuote}`]);
 corrections.push(['无限对话','无限堆活','unmistakable-asr-error',`用户听辨确认：${decision.userQuote}`]);
}
const clean=t=>corrections.reduce((v,[a,b])=>v.replaceAll(a,b),t.replace(/\s/g,''));
// 字幕候选直接派生自本机大模型的实际词序，不恢复拍摄前原稿。
const groups=[
 [0,0,'I have been implementing AI in businesses for a while.'],
 [1,1,'I have noticed an interesting workplace understanding.'],
 [2,2,'In a company, those who really know how to use AI'],
 [3,3,'all pretend that they do not.'],
 [4,4,'On the surface, everyone just gets by.'],
 [5,5,'They write code and revise proposals by hand.'],
 [6,7,'When the boss holds an AI seminar, everyone shakes their head.'],
 [8,9,'“It is unreliable, inaccurate, and impractical.”'],
 [10,10,'But privately, they go home and practice Z6,'],
 [11,11,'Cursor, and Codex.'],
 [12,13,'At work, they open the tools as soon as the boss turns away.'],
 [14,14,'They finish a day’s work in ten minutes,'],
 [15,16,'then stay quiet and keep their achievements hidden.'],
 [17,18,'Everyone understands: publicly, they say AI is no good.'],
 [19,19,'Privately, they are all quietly speeding up.'],
 [20,21,'Many bosses see this as laziness and a lack of cooperation.'],
 [22,22,'Let me tell you honestly:'],
 [23,24,'this is not a people problem; it is a problem with the system.'],
 [25,25,'Think about it from another angle.'],
 [26,26,'An employee uses AI'],
 [27,28,'and becomes three times as efficient. What happens?'],
 [29,31,'A raise? Less work? Neither.'],
 [32,33,'Most likely, the boss says, “You are so efficient,'],
 [34,34,'take on two more projects.”'],
 [35,36,'The workload grows, but the pay does not rise by a cent.'],
 [37,38,'You would keep it to yourself too.'],
 [39,40,'So when we implement AI in a business,'],
 [41,42,'buying tools and issuing a notice is not enough.'],
 [43,44,'There is one central question to resolve.'],
 [45,45,'Once efficiency improves,'],
 [46,47,'how will the time and capacity saved be shared?'],
 [48,48,'Will it all become more work,'],
 [49,49,'or will employees share in the gains?'],
 [50,50,'Will AI become another way to squeeze employees,'],
 [51,52,'or help the whole organization cut costs and grow revenue?'],
 [53,53,'Three suggestions for bosses who want to implement AI.'],
 [54,55,'First, avoid this equation:'],
 [56,57,'AI efficiency means more work for the same pay.'],
 [58,60,decision?.confirmed?'The hours saved should give employees some slack,':'The hours saved should give employees recognition,'],
 [61,61,decision?.confirmed?'rather than endless extra work.':'rather than endless dialogue.'],
 [62,63,'Second, create a system for sharing productivity gains.'],
 [64,65,'Return some of the costs saved through AI to the team.'],
 [66,68,'That gives people a reason to use it openly and support it.'],
 [69,71,'Third, turn the AI skills people use privately'],
 [72,72,'into standardized workflows for the organization:'],
 [73,75,'shared training, shared tools, and shared delivery standards,'],
 [76,76,'instead of leaving employees to compete privately.'],
 [77,78,'AI implementation is not about having the most advanced tools.'],
 [79,79,'Can you turn a tool employees quietly use to slack off'],
 [80,81,'into productivity that benefits both the company and its people?'],
 [82,83,'When the system works, you do not need to push people.'],
 [84,85,'They will take the initiative to use AI.'],
 [86,87,'Follow Chao Ge for the underlying logic of AI implementation.'],
];
const words=raw.segments.map((s,i)=>({text:clean(s.text),raw_text:s.text.trim(),start:s.start,end:s.end,type:'word',segmentIndex:i}));
const captions=groups.map(([first,last,en],i)=>({id:`C${String(i+1).padStart(3,'0')}`,startMs:Math.round(raw.segments[first].start*1000),endMs:Math.round(raw.segments[last].end*1000),zh:words.slice(first,last+1).map(w=>w.text).join(''),en,sourceSegments:[first,last],highlights:[]}));
const transcriptPath=`${folder}/employee-ai-efficiency.actual.cleaned.v1.json`;
const captionsPath=`${folder}/employee-ai-efficiency.actual.bilingual.v1.json`;
write(transcriptPath,{schemaVersion:1,canonicalSource:'recorded-audio',source:{path:sourcePath,sha256:sha(sourcePath)},method:'本机 large-v3-turbo 无文稿提示识别；small 独立比对；机械字形校正；无人类听辨声明。',humanListeningPerformed:false,words});
write(captionsPath,captions);
write(`${folder}/employee-ai-efficiency.spoken-source-policy.v1.json`,{schemaVersion:1,canonicalSource:'recorded-audio',scriptRole:'comparison-only',captionTextPolicy:'spoken-verbatim',englishTranslationSource:'canonical-spoken-chinese',originalVideo:`${base}/01_素材投放区/01_口播原片/copy_A5DE456A-4712-4A6D-8425-FFB1EE24D2C9.MOV`,transcript:{path:transcriptPath,sha256:sha(transcriptPath)},captions:{path:captionsPath,sha256:sha(captionsPath)},verification:{corrections:corrections.map(([from,to,type,evidence])=>({from,to,type,evidence})),humanListeningPerformed:false,minimumGlobalPrecision:0.99,minimumGlobalCoverage:0.99},compliance:{status:decision?.confirmed?'passed':'pending-audio-review',meaning:'passed 只表明字幕遵从所绑定识别及已记录校正，机器文本对照不等于人耳确认。'},unresolved:decision?.confirmed?[]:[{start:107.24,end:112.3,question:'给员工冗余/留冗余；无限堆活，等待用户听辨。'}]});
fs.writeFileSync(path.join(root,`${folder}/employee-ai-efficiency.actual.cleaned.v1.txt`),captions.map(c=>`${(c.startMs/1000).toFixed(2)}–${(c.endMs/1000).toFixed(2)}  ${c.zh}`).join('\n')+'\n');
write(`${folder}/employee-ai-efficiency.script-comparison.v1.json`,{scriptRole:'comparison-only',changesRetained:[{script:'员工公开用AI',actual:'员工会用AI',evidence:'两套无提示本机识别一致'},{script:'想推AI',actual:'想做AI',evidence:'两套无提示本机识别一致'},{script:'AI提速',actual:'AI提效',evidence:'两套无提示本机识别一致'},{script:'第一/第二/第三',actual:'第一呢/第二呢/第三呢',evidence:'大模型检出，保留连接词'},{script:'拿出一部分反哺团队',actual:'拿出一部分来反哺团队',evidence:'两模型检出来'},{script:'机制顺了',actual:'那么机制顺了',evidence:'两模型检出那么'}],unresolved:decision?.confirmed?[]:['工时与冗余句'],corrections});
console.log(JSON.stringify({segments:words.length,captionPages:captions.length,pendingAudioReview:!decision?.confirmed,lastEndMs:captions.at(-1).endMs}));
