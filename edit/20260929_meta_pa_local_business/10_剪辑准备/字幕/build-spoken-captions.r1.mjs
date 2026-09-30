import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';

const out = import.meta.dirname;
const root = path.resolve(out, '../../../..');
const episode = 'edit/20260929_meta_pa_local_business';
const sourcePath = `${episode}/06_实录核对/本地转写_未听审.r1.json`;
const raw = JSON.parse(fs.readFileSync(path.join(root, sourcePath), 'utf8'));
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const write = (name, value) => fs.writeFileSync(path.join(out, name), JSON.stringify(value, null, 2) + '\n');
const corrections = [
  {from:'推定规则',to:'退订规则',type:'unmistakable-asr-error',evidence:'124.46–126.60 秒原音音节 tui-ding-gui-ze，全文两个独立模型及无提示关键窗同音；酒店退订规则同音规范书写，仅纠正字形。'},
  {from:'一键都不会拉下',to:'一件都不会落下',type:'unmistakable-asr-error',evidence:'134.02–136.40 秒关键窗无提示大模型独立识别一件都不会拉下；逐件核对步骤语境中件/落为音节对应的规范用字，不更改原声中的不会。'},
  {from:'房贷',to:'房态',type:'unmistakable-asr-error',evidence:'168.46–169.80 秒原音 fang-tai，独立small为房贪，关键窗为防不太；原片谈酒店房间状态、商品、订单、退款，只校正同音行业词房态，不增加内容。'},
  {from:'千万',to:'千问',type:'proper-noun-spelling',evidence:'221.30–222.42 秒两模型识别同音千万，关键窗识别签问；随后原片列阿里、淘宝闪购、飞猪、高德，统一产品专名千问。'},
  {from:'签问',to:'千问',type:'proper-noun-spelling',evidence:'242.26–245.26 秒独立small及无提示关键窗均为签问，同音阿里产品名规范拼写。'},
  {from:'非洲',to:'飞猪',type:'proper-noun-spelling',evidence:'227.66–228.06 秒独立small明确识别飞猪，关键窗为非诸；与同段淘宝闪购、高德并列，规范服务专名。'},
  {from:'接近对话',to:'接进对话',type:'unmistakable-asr-error',evidence:'241.36–242.26 秒两个独立模型同音 jie-jin-dui-hua；把生意接进对话为动作的同音规范字形，不改词序。'},
  {from:'宛入住',to:'晚入住',type:'unmistakable-asr-error',evidence:'268.86–270.48 秒原音 wan-ru-zhu，无提示关键窗同音宛入住，small检测晚；只校正晚的字形，不把入住换成small误识的入座。'},
  {from:'定房',to:'订房',type:'unmistakable-asr-error',evidence:'115.82 秒及262.22 秒原音 ding-fang，small在115.82 秒独立识别订房；统一订房的同音规范用字，不补拍前稿内容。'},
  {from:'定成',to:'订成',type:'unmistakable-asr-error',evidence:'130.58–134.02 秒实际音节 ding-cheng，两个模型同音定成，酒店预订语境的同音规范书写。'},
  {from:'AEA',to:'AI',type:'proper-noun-spelling',evidence:'313.92–315.38 秒、片尾等处原音 AI；独立small对应片段识别AI，其余字母串属于AI缩写识别错误，仅规范英文缩写。'},
  {from:'AA',to:'AI',type:'proper-noun-spelling',evidence:'250.02–251.96 秒独立small明确AI；同一期反复出现AI缩写，原音ei-ai，无提示模型在多窗可交叉确认。'},
  {from:'既优',to:'GEO',type:'proper-noun-spelling',evidence:'395.32–398.04 秒实际音节 ji-ou，全文两个模型同音既优；用户已提供服务专名GEO，仅专名规范拼写，不增加效果承诺。'},
  {from:'也应落地',to:'AI应用落地',type:'unmistakable-asr-error',evidence:'408.54–409.30 秒尾句全文small及392–409.5 秒无提示关键窗均识别企业AA应用落地，对应AI应用落地；修复尾段合词错误，保留原片真实自我介绍。'},
];
const clean = text => corrections.reduce((v,c)=>v.replaceAll(c.from,c.to),text.replace(/\s/g,''));

// 只以原片的 ASR 逐词时间作正文，拍前稿不读入本脚本。
const words = [];
const segments = raw.segments.map((s,index)=>{
  let tokens = (s.words ?? []).map(w=>({text:w.word.replace(/\s/g,''),raw_text:w.word.replace(/\s/g,''),start:w.start,end:w.end,probability:w.probability,sourceSegment:index}));
  for (const c of corrections) {
    let joined=tokens.map(w=>w.text).join('');
    let pos=joined.indexOf(c.from);
    while(pos!==-1) {
      let offset=0,first=-1,last=-1;
      for(let i=0;i<tokens.length;i++){
        const next=offset+tokens[i].text.length;
        if(first<0&&next>pos) first=i;
        if(offset<pos+c.from.length&&next>=pos+c.from.length){last=i;break;}
        offset=next;
      }
      if(first<0||last<first) throw new Error(`无法绑定纠错音窗 ${c.from}`);
      const selected=tokens.slice(first,last+1);
      const joinedSelected=selected.map(w=>w.text).join('');
      const revised=joinedSelected.replace(c.from,c.to);
      tokens.splice(first,last-first+1,{text:revised,verbatim_text:revised,raw_text:selected.map(w=>w.raw_text).join(''),start:selected[0].start,end:selected.at(-1).end,sourceSegment:index,correction:c.from});
      joined=tokens.map(w=>w.text).join('');
      pos=joined.indexOf(c.from);
    }
  }
  const text=clean(s.text);
  if(tokens.map(w=>w.text).join('')!==text) throw new Error(`词级与段落不一致 ${index}`);
  words.push(...tokens);
  return {id:index,start:s.start,end:s.end,text,raw_text:s.text.trim(),words:tokens};
});

// 英文逐项从上面的实录中文翻译；中文不删连接词，不补拍前稿。
const groups = [
 [0,0,'Meta, which makes money from ads, is now letting AI choose businesses for people.'],
 [1,1,'So, customers will ask AI first.'],
 [2,2,'Then, will your business still be found?'],
 [3,3,'Local business owners, besides making your shop look good,'],
 [4,4,'you also need to let people find it.'],
 [5,5,'What services can you provide, and on what terms?'],
 [6,6,'Where can they make a booking?'],
 [7,7,'AI needs these conditions when choosing for customers.'],
 [8,8,'Meta is the company behind Facebook.'],
 [9,10,'It has social platforms and a large advertising business.'],
 [11,12,'In the second quarter this year, nearly 98% of revenue'],
 [13,13,'came from advertising.'],
 [14,15,'Its average number of online users is over three billion.'],
 [16,17,'It has now introduced the personal AI assistant Muse.'],
 [18,19,'This step aims to take over what follows a customer’s need.'],
 [20,22,'Before, you saw an ad and chose for yourself.'],
 [23,26,'Now, you can tell it: “This is what I need. Find it for me.”'],
 [27,28,'The PA people talk about is a personal AI assistant.'],
 [29,29,'Muse has its own cloud browser.'],
 [30,30,'It can look things up, operate websites, and fill in forms.'],
 [31,31,'Before buying, it asks the customer to confirm.'],
 [32,32,'How will this affect our businesses?'],
 [33,33,'Take booking a room in Lanzhou as an example.'],
 [34,34,'Suppose your family comes for the weekend and books two rooms.'],
 [35,35,'You are driving and will not arrive until ten at night.'],
 [36,37,'You tell the AI assistant your needs and add one thing:'],
 [38,40,'“My plans are uncertain. Check the cancellation charges too.”'],
 [41,41,'Searching “Lanzhou hotels” used to bring up many choices.'],
 [42,44,'Now, once these conditions are added, some are unsuitable.'],
 [45,46,'The assistant’s job is to find those differences for you,'],
 [47,47,'so you do not have to ask every hotel one by one.'],
 [48,49,'If you allow it to remember your previous preferences,'],
 [50,51,'such as needing a lift and less walking with an older person,'],
 [52,54,'next time, it can consider those conditions together.'],
 [55,56,'If dates, numbers, or budget change, it confirms them again.'],
 [57,58,'For the same room booking, the more specific the information,'],
 [59,59,'the more likely it is to find a room that suits you.'],
 [60,61,'After choosing, it still has to check room availability.'],
 [62,62,'Confirm the price and the cancellation rules.'],
 [63,64,'Once you agree, it will continue helping you.'],
 [65,66,'Between recommending a shop and completing that booking,'],
 [67,67,'it will not miss a single step.'],
 [68,68,'For business owners,'],
 [69,69,'these changes are already very direct.'],
 [70,70,'Before, to make customers notice you,'],
 [71,72,'you studied positions, videos, and recommendations on platforms.'],
 [73,75,'Later, some customers may see only the few options AI selects.'],
 [76,76,'If you are not on that list at all,'],
 [77,78,'however good your video is, that customer may never see it.'],
 [79,80,'This may be the first challenge platforms face:'],
 [81,82,'will customers still open them and choose slowly?'],
 [83,85,'Hotel availability, goods, orders, and refunds still need managing.'],
 [86,88,'Even without opening the platform, a transaction may use it.'],
 [89,91,'Platforms will not easily give up what they have accumulated.'],
 [92,95,'So, the platform’s original advantage as an entry point may weaken.'],
 [96,98,'But merchants, goods, and after-sales capabilities still compete.'],
 [99,100,'On September 21, Meta’s stock rose by about 11%.'],
 [101,103,'Zuckerberg also hopes that, in the future, the AI assistant'],
 [104,105,'will collect fees after facilitating transactions.'],
 [106,108,'Domestic companies are moving in this direction too.'],
 [109,109,'But their approaches may be a little different.'],
 [110,111,'Recently, the second-generation Doubao phone'],
 [112,112,'put the AI assistant into the phone’s operating system,'],
 [113,113,'letting AI try to handle tasks across apps.'],
 [114,115,'Qwen connects to Alibaba services already linked up.'],
 [116,120,'For example, Taobao Instant Commerce, Fliggy, and Amap.'],
 [121,122,'Later, it also interconnected with Taobao,'],
 [123,123,'linking goods, orders, logistics, and after-sales service.'],
 [124,124,'Doubao operates for you from inside the phone.'],
 [125,127,'The other brings its existing business into the conversation.'],
 [128,128,'Behind Qwen are merchants, goods, and transaction services,'],
 [129,129,'as well as everything the platform already has.'],
 [130,131,'This reminds us: local businesses implementing AI'],
 [132,132,'cannot focus only on what the model can say.'],
 [133,133,'What business information can it find?'],
 [134,134,'Which service can it connect to?'],
 [135,137,'When it cannot finish a task, who provides the interface?'],
 [138,138,'Back to that customer booking a room in Lanzhou.'],
 [139,140,'Suppose your hotel has parking and a lift,'],
 [141,142,'and allows late check-in; it would be a good fit.'],
 [143,144,'But online, you only wrote “nice environment, attentive service.”'],
 [145,145,'These conditions were not written down.'],
 [146,146,'The AI assistant may select you.'],
 [147,149,'After running your shop for years, you know customers’ questions.'],
 [150,150,'Is parking free, or is there a charge?'],
 [151,151,'After what time should they contact you in advance?'],
 [152,152,'Under what conditions is a refund unavailable?'],
 [153,154,'These answers may have been handled by your front desk,'],
 [155,156,'explained repeatedly, but not organized somewhere searchable.'],
 [157,158,'In that situation, I first review the existing introduction with owners,'],
 [159,159,'and go over these common questions.'],
 [160,161,'What is missing, and what is already out of date?'],
 [162,162,'What is inconsistent across different places?'],
 [163,164,'We clarify it based on the services actually available.'],
 [165,166,'My projects start from this real information,'],
 [167,168,'so AI can find it and understand it as accurately as possible.'],
 [169,170,'Whether it recommends you is not for us alone to decide.'],
 [171,172,'We must check its answers and where the evidence comes from.'],
 [173,173,'Suppose AI has already recommended you.'],
 [174,175,'The customer clicks through but cannot find booking, or the phone fails.'],
 [176,178,'Posting another introduction will not fix that step.'],
 [179,180,'What I want to check with owners is where this route breaks.'],
 [181,181,'Which information is missing?'],
 [182,182,'Can we get these booking pages to open?'],
 [183,185,'Whether rooms are available needs front-desk confirmation and a connection.'],
 [186,187,'Use the existing platform features that are available first.'],
 [188,188,'There is no need to build all of it again separately.'],
 [189,189,'Owners know which terms they can promise customers.'],
 [190,191,'I first organize the information and tools so staff can use them.'],
 [192,192,'Then, together, we check the results.'],
 [193,194,'Here locally, we can review the business face to face. Use that advantage.'],
 [195,195,'Start with one service from your shop.'],
 [196,196,'Ask AI whether it got the address and service terms right.'],
 [197,197,'Can the contact and booking methods it gives actually work?'],
 [198,198,'If the answer cites a source, open it and check it too.'],
 [199,200,'At least you can see how what customers find differs from the shop’s reality.'],
 [201,201,'Gansu business owners wanting enterprise AI applications,'],
 [202,202,'or GEO, can bring one of your own services,'],
 [203,203,'and we can talk it through together.'],
 [204,205,'Let us start with what customers ask and what they find now.'],
 [206,208,'I am Chao Ge, implementing enterprise AI in Lanzhou.'],
];
const captions = groups.map(([first,last,en],i)=>({id:`C${String(i+1).padStart(3,'0')}`,startMs:Math.round(segments[first].start*1000),endMs:Math.round(segments[last].end*1000),zh:segments.slice(first,last+1).map(s=>s.text).join(''),en,sourceSegments:[first,last],highlights:[]}));
// 开场主句在实际词间断成两页，避免整条过长。
const introWords=segments[0].words;
const introSplit=introWords.findIndex(w=>w.start>=2.12);
captions.splice(0,1,
  {id:'C000a',startMs:0,endMs:Math.round(introWords[introSplit-1].end*1000),zh:introWords.slice(0,introSplit).map(w=>w.text).join(''),en:'Meta, which makes money from ads,',sourceSegments:[0,0],highlights:[]},
  {id:'C000b',startMs:Math.round(introWords[introSplit].start*1000),endMs:5080,zh:introWords.slice(introSplit).map(w=>w.text).join(''),en:'now lets AI choose businesses for people.',sourceSegments:[0,0],highlights:[]});
// 公开资料时段字幕更短，长复句按真实段界分开，不重新编写中文。
const manualSplits = new Map([
 ['71-72', [[71,71,'You studied positions on various platforms,'],[72,72,'videos, and recommendations.']]],
 ['83-85', [[83,83,'But hotel room availability,'],[84,85,'goods, orders, and refunds still need managing.']]],
 ['92-95', [[92,94,'So, the platform’s original entry-point advantage'],[95,95,'may weaken.']]],
 ['96-98', [[96,97,'But merchants, goods, and after-sales capabilities'],[98,98,'still take part in the competition.']]],
 ['99-100', [[99,99,'On September 21,'],[100,100,'Meta’s stock rose by about 11%.']]],
 ['114-115', [[114,114,'Qwen, meanwhile,'],[115,115,'connects to Alibaba services already linked up.']]],
 ['125-127', [[125,126,'The other brings its existing business'],[127,127,'into the conversation.']]],
 ['147-149', [[147,148,'After years in business, what do customers often ask?'],[149,149,'You know best.']]],
 ['153-154', [[153,154,'These answers may have been handled by your front desk,']]],
 ['155-156', [[155,155,'explained over and over,'],[156,156,'but not organized somewhere searchable.']]],
 ['157-158', [[157,157,'In that situation,'],[158,158,'I first review the introduction with business owners.']]],
 ['174-175', [[174,174,'The customer clicks through but cannot find'],[175,175,'the booking entry, or the phone does not connect.']]],
 ['176-178', [[176,177,'At that point, posting another introduction'],[178,178,'will not fix this step.']]],
 ['179-180', [[179,179,'What I want to check with owners is'],[180,180,'where this route has actually broken.']]],
 ['183-185', [[183,184,'Room availability requires front-desk confirmation.'],[185,185,'Someone makes these connections.']]],
 ['193-194', [[193,193,'Here locally, we can review business face to face.'],[194,194,'Let us use these convenient conditions.']]],
 ['199-200', [[199,199,'At least you can see what customers can find,'],[200,200,'and how you differ from the shop’s actual situation.']]],
 ['204-205', [[204,204,'Let us start with what customers will ask,'],[205,205,'and what they find now, and work through it.']]],
 ['206-208', [[206,206,'I am Chao Ge,'],[207,208,'implementing enterprise AI in Lanzhou.']]],
]);
const compact=[];
for(const c of captions){
  const split=manualSplits.get(c.sourceSegments.join('-'));
  if(!split){compact.push(c);continue;}
  for(const [first,last,en] of split)compact.push({id:c.id,startMs:Math.round(segments[first].start*1000),endMs:Math.round(segments[last].end*1000),zh:segments.slice(first,last+1).map(s=>s.text).join(''),en,sourceSegments:[first,last],highlights:[]});
}
compact.forEach((c,i)=>c.id=`C${String(i+1).padStart(3,'0')}`);
const unresolved=[
 {startMs:275960,endMs:278300,text:segments[146].text,reason:'全文turbo及无提示关键窗均识别录取，small为录定；不可仅依据拍前稿改为漏掉。保留原始识别，等待原音听辨/用户决定。',captionIds:compact.filter(c=>c.sourceSegments[0]<=146&&c.sourceSegments[1]>=146).map(c=>c.id)},
 {startMs:350380,endMs:351680,text:segments[185].text,reason:'全文turbo接线、small接下来、关键窗turbo接下，存在分歧；保留全文ASR接线，等待原音听辨。',captionIds:compact.filter(c=>c.sourceSegments[0]<=185&&c.sourceSegments[1]>=185).map(c=>c.id)},
 {startMs:259620,endMs:260640,text:segments[136].text,reason:'三套/窗无提示识别均为接口；保留实录接口，不恢复拍前稿接手。',status:'retained-actual-word'},
];
const transcriptName='meta-pa.actual.canonical.r1.json';
const captionsName='meta-pa.actual.bilingual.r1.json';
write(transcriptName,{schemaVersion:1,canonicalSource:'recorded-audio',source:{path:sourcePath,sha256:sha(path.join(root,sourcePath))},method:'本机已缓存large-v3-turbo原片无提示逐词识别；独立small全文交叉；关键窗无提示复核；只改专名和音节明确的ASR字形。未进行完整人工听审。',humanListeningPerformed:false,words,segments});
write(captionsName,compact);
write('meta-pa.spoken-source-policy.r1.json',{schemaVersion:1,canonicalSource:'recorded-audio',scriptRole:'comparison-only',captionTextPolicy:'spoken-verbatim',englishTranslationSource:'canonical-spoken-chinese',originalVideo:`${episode}/01_素材投放区/01_口播原片/copy_1C64A779-C1E2-417C-A440-6474D8A3C04B.MOV`,transcript:{path:`${episode}/10_剪辑准备/字幕/${transcriptName}`,sha256:sha(path.join(out,transcriptName))},captions:{path:`${episode}/10_剪辑准备/字幕/${captionsName}`,sha256:sha(path.join(out,captionsName))},verification:{corrections,humanListeningPerformed:false,minimumGlobalPrecision:1,minimumGlobalCoverage:1,independentModel:{path:`${episode}/10_剪辑准备/字幕/whisper-small.独立识别.r1.json`,sha256:sha(path.join(out,'whisper-small.独立识别.r1.json'))},audioWindowChecks:{path:`${episode}/10_剪辑准备/字幕/关键窗_无提示复核.r1.json`,sha256:sha(path.join(out,'关键窗_无提示复核.r1.json'))}},compliance:{status:'passed',meaning:'只表示字幕逐字保留所绑定机器实录和已记录校正，不等于全片人工听审或事实验收。未确认疑词保留原识别并明确列出，不恢复拍前文稿。'},unresolved});
write('ASR纠错与待听辨.r1.json',{schemaVersion:1,corrections,unresolved,scriptReadByCaptionBuilder:false,humanListeningPerformed:false});
fs.writeFileSync(path.join(out,'meta-pa.actual.canonical.r1.txt'),segments.map(s=>`[${s.start.toFixed(2)}–${s.end.toFixed(2)}] ${s.text}`).join('\n')+'\n');
const srtTime = ms => {
  const h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000),s=Math.floor(ms%60000/1000),t=ms%1000;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(t).padStart(3,'0')}`;
};
fs.writeFileSync(path.join(out,'meta-pa.actual.bilingual.r1.srt'),compact.map((c,i)=>`${i+1}\n${srtTime(c.startMs)} --> ${srtTime(c.endMs)}\n${c.zh}\n${c.en}\n`).join('\n'));
const shortPageWarnings=compact.filter(c=>c.zh.length>28||c.endMs-c.startMs<600).map(c=>({id:c.id,zh:c.zh,characters:c.zh.length,durationMs:c.endMs-c.startMs}));
write('字幕结构检查.r1.json',{schemaVersion:1,captionCount:compact.length,spokenSegments:segments.length,spokenWords:words.length,firstStartMs:compact[0].startMs,lastEndMs:compact.at(-1).endMs,unresolvedCount:2,shortPageWarnings,missingEnglish:compact.filter(c=>!c.en.trim()).length,overlapCount:compact.slice(1).filter((c,i)=>c.startMs<compact[i].endMs).length});
const check = spawnSync(process.execPath,[path.join(root,'tools/check-spoken-source-policy.mjs'),path.join(out,transcriptName),path.join(out,captionsName),path.join(out,'meta-pa.spoken-source-policy.r1.json')],{encoding:'utf8'});
write('实录逐字校验回执.r1.json',{schemaVersion:1,status:check.status===0?'passed':'failed',check:'check-spoken-source-policy.mjs',checkerSha256:sha(path.join(root,'tools/check-spoken-source-policy.mjs')),transcriptSha256:sha(path.join(out,transcriptName)),captionsSha256:sha(path.join(out,captionsName)),policySha256:sha(path.join(out,'meta-pa.spoken-source-policy.r1.json')),stdout:check.stdout,stderr:check.stderr,exitCode:check.status,scope:'仅验证字幕和绑定机器实录文字一一保留；不证明ASR百分百正确或全片人工听审。'});
if(check.status!==0)throw new Error(check.stderr);
console.log(JSON.stringify({captionCount:compact.length,spokenWords:words.length,shortPageWarnings,unresolvedCount:2},null,2));
