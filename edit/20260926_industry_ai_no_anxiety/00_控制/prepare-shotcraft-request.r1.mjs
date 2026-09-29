import fs from 'node:fs';
import {createHash} from 'node:crypto';
const base='edit/20260926_industry_ai_no_anxiety',out=`${base}/04_Remotion准备`;
const read=p=>JSON.parse(fs.readFileSync(p));
const binding=p=>({path:p,sha256:createHash('sha256').update(fs.readFileSync(p)).digest('hex')});
const timeline=read(`${out}/实录重绑时间线.r1.json`);
const sources=`${base}/01_素材投放区/05_公开素材_Codex准备/公开资料引文.r1.json`;
const selectedIntent={
 B01:{keyPhrases:['AI焦虑'],semanticIntents:['emphasis'],purpose:'开场只强调AI焦虑，重音与声音钩子同点，不遮挡表情'},
 B02:{keyPhrases:['短板','长板'],semanticIntents:['emphasis'],purpose:'强调短板与长板的实录对照，不做全屏说明'},
 B05:{keyPhrases:['为什么掏钱'],semanticIntents:['emphasis'],purpose:'突出客户为什么掏钱这一问题，让真人表演仍为主体'},
 B18:{keyPhrases:['AOL'],semanticIntents:['evidence','selection'],purpose:'聚焦AOL官方公开说明的服务持续事实，独立更正不替换实录字幕'},
 B19:{keyPhrases:['黑莓'],semanticIntents:['evidence','selection'],purpose:'将黑莓业务调整与应用开发者收益两项真实资料区分展示'},
 B22:{keyPhrases:['下一个OpenAI'],semanticIntents:['emphasis'],purpose:'强调本人目标不是成为下一个OpenAI，不暗示品牌关联'},
};
const eligible=new Set(['speaker','real-evidence']);
const beats=timeline.beats.map(b=>{
 const intent=selectedIntent[b.id],evidence=b.primaryRoute==='real-evidence';
 return {beatId:b.id,mainVisual:b.primaryRoute,frames:b.frames,quote:b.recordedQuote,
  purpose:intent?.purpose??b.decisionReason,semanticIntents:intent?.semanticIntents??[],keyPhrases:intent?.keyPhrases??[],
  materialClass:evidence?'document':'talking-head',energy:intent?'medium':'low',existingVisualSufficiency:intent?'low':'high',
  ...(eligible.has(b.primaryRoute)?{region:evidence?{x:430,y:130,width:1390,height:600}:{x:50,y:170,width:455,height:370},protectedRegions:evidence?[{x:60,y:610,width:330,height:250},{x:0,y:900,width:1920,height:180}]:[{x:530,y:0,width:1390,height:900},{x:0,y:900,width:1920,height:180}]}:{}),
  ...(evidence?{evidence:{asset:binding(sources),rect:{x:20,y:140,width:1350,height:140},claimBoundary:intent.purpose}}:{}),
 };
});
const inputs={registry:'skills/koubo-shotcraft-library/registry.v1.json',library:'skills/koubo-shotcraft-library/upstream/gallery/api/library.json',capabilityIndex:'skills/koubo-shotcraft-library/card-capability-index.v2.json',experienceLedger:'skills/koubo-shotcraft-library/experience/shotcraft-acceptance-ledger.v1.json',componentModule:'skills/koubo-shotcraft-library/assets/ShotcraftEffects.tsx',captions:`${base}/06_实录与字幕/实录双语字幕_候选.r1.json`};
const request={schemaVersion:'koubo-shotcraft-auto-match-request/v1',taskId:'industry-ai-no-anxiety-edit-20260929',revisionId:'industry-ai-preview-r1',directorProfile:{profileId:'paper-editorial-director-v9',profileVersion:'9.1.0'},subtitleAuthority:'actual-recording',...Object.fromEntries(Object.entries(inputs).map(([k,p])=>[k,binding(p)])),canvas:{width:1920,height:1080,fps:30,durationInFrames:3687},beats};
fs.writeFileSync(`${out}/动效自动匹配请求.r1.json`,JSON.stringify(request,null,2)+'\n',{flag:'wx'});
console.log('本期25段实录匹配请求已生成；未渲染。');
