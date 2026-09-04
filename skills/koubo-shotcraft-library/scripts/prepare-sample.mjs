import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const repo=path.resolve(import.meta.dirname,'../../..');
const skill=path.join(repo,'skills/koubo-shotcraft-library');
const target=path.join(repo,'remotion/src/shotcraft-candidate-v1');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const binding=p=>({path:p,sha256:sha(path.join(repo,p)),publicPath:p.replace(/^remotion\/public\//,'')});
const write=(p,data)=>fs.writeFileSync(p,`${JSON.stringify(data,null,2)}\n`);
const protect=[{x:770,y:60,width:1150,height:820},{x:0,y:900,width:1920,height:180}];
const region={x:60,y:170,width:650,height:580};
const events=[
  {id:'topic',effectId:'marker-underline',from:63,duration:99,quote:'AI家庭故事动画、婚礼定制短片',texts:['AI家庭故事动画','婚礼定制短片'],purpose:'强调正在说的两个定制方向'},
  {id:'case-pin',effectId:'paper-tape-pin',from:162,duration:138,quote:'抖音上面大家应该都刷到过',texts:['抖音上面'],purpose:'用已提供案例视频接住正在介绍的作品，不证明收入或客户关系'},
  {id:'case-focus',effectId:'evidence-scan',from:300,duration:65,quote:'做了一个动画短片',texts:['动画短片'],purpose:'只标识用户提供案例中上方动画区域，不推导商业结果',mainVisual:'real-evidence',region:{x:430,y:90,width:1040,height:545},protectedRegions:[{x:1552,y:596,width:296,height:296},{x:0,y:900,width:1920,height:180}],evidence:{assetId:'family',rect:{x:8,y:8,width:1024,height:420},scope:'user-provided-work-not-commercial-proof'}},
  {id:'life-list',effectId:'keyword-reveal',from:365,duration:121,quote:'读书、相遇、工作、结婚生子',texts:['读书','相遇','工作','结婚生子'],purpose:'随实录逐项点名人生经历，不扩展为因果或纸艺流程'},
  {id:'story-link',effectId:'line-carry',from:486,duration:96,quote:'这一生的点点滴滴，整理成故事脚本',texts:['点点滴滴','故事脚本'],purpose:'局部线条连接实录中的素材与故事脚本，不移动人物或替换纸艺'},
].map(e=>({mainVisual:'speaker',region,protectedRegions:protect,...e}));
const plan={schemaVersion:'shotcraft-candidate/v1',revisionId:'20260904-shotcraft-candidate-v1',status:'candidate-preview-required',renderState:'blocked-existing-production-gates',formalEnabled:false,productionEligible:false,subtitleAuthority:'actual-recording',width:1920,height:1080,fps:30,durationInFrames:930,sourceStartFrame:1278,
  source:binding('remotion/public/media/local-ai-services-20260902-r1/R01_talk_normalized_1920x1080.mp4'),
  captions:binding('remotion/public/data/LOCAL_AI_SERVICES_20260902.actual.bilingual.v1.json'),
  assets:{family:binding('remotion/public/media/local-ai-services-20260902-r1/proxies/U02_family_composite_1920x1080.mp4'),pop:binding('remotion/public/audio/koubo-sfx-v8/v3-soft-card-pop-a.wav'),tick:binding('remotion/public/audio/koubo-sfx-v8/v3-list-tick-a.wav'),line:binding('remotion/public/audio/koubo-sfx-v8/v3-line-connect-a.wav')},
  effects:events,
  listItems:[{text:'读书',atFrame:40},{text:'相遇',atFrame:58},{text:'工作',atFrame:81},{text:'结婚生子',atFrame:103}],
  timingStatus:'sentence-times-bound-word-cues-from-raw-asr-awaiting-listening',
  mediaWindows:[{from:300,duration:65,mediaStartFrame:138},{from:582,duration:192,mediaStartFrame:203}],
  sfx:[{id:'topic',frame:95,assetId:'pop',gain:0.10},{id:'pin',frame:244,assetId:'pop',gain:0.08},...[405,423,446,468].map((frame,i)=>({id:`list-${i}`,frame,assetId:'tick',gain:0.07})),{id:'link',frame:500,assetId:'line',gain:0.08}],
  review:{userApproved:false,visualAndAudioReview:'not-run',notes:['词级卡点来自原ASR，需人耳复听，不将按字均分的时间冒充声学对齐','纯样片，不修改已交付全片','动画作为用户提供的作品展示，不是付费效果或客户关系的证据']}};
write(path.join(target,'candidate-plan.v1.json'),plan);
fs.copyFileSync(path.join(repo,plan.captions.path),path.join(target,'captions.generated.json'));
fs.copyFileSync(path.join(skill,'assets/ShotcraftEffects.tsx'),path.join(target,'ShotcraftEffects.generated.tsx'));
write(path.join(target,'component-sync.v1.json'),{source:'skills/koubo-shotcraft-library/assets/ShotcraftEffects.tsx',sha256:sha(path.join(skill,'assets/ShotcraftEffects.tsx')),reason:'受控Remotion导入图留在remotion根内，按源SHA同步而非独立维护副本'});
console.log(JSON.stringify({plan:path.relative(repo,path.join(target,'candidate-plan.v1.json')),durationSeconds:31,rendered:false}));
