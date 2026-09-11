import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const base="/Users/pc/Documents/口播/edit/20260910_lanzhou_industry_ai/03_导演拆解";
const r4=path.join(base,'paper-v9.1-r4');
const out=path.join(r4,'first-frame-review-20260911-r1');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const json=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const ref=p=>({path:p,sha256:sha(p),bytes:fs.statSync(p).size});
const save=(name,v)=>fs.writeFileSync(path.join(out,name),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const expectedInputs={
 'first-frame-prompts.v1.json':'d871ae2f51fed2d28d9e912c0ac0896108165d1cf8c6374576c511ffd72fd2a0',
 'validation-receipt.v1.json':'3d72adddb8809d895b6c4a93e0888d3d846ffd395c07d0f1eb9993fa1ceea335',
 'director-plan.v1.json':'46efff271cccf4cb145bf8d50f0aaab65d8365bb90d757abe66260757bf7058a'
};
for(const [f,h] of Object.entries(expectedInputs))assert.equal(sha(path.join(r4,f)),h,f);
const sceneSpecs=[
 ['P01','B04',path.join(r4,'first-frame-local-reframe-P01-r1'),'passed','af96747aed643c5b7effd6401793669643b3a1a50c8feca30d296368a6cf5527'],
 ['P02','B07',path.join(base,'paper-v9.1-r3/first-frame-production-r1'),'passed','35f7a03b0d5b1867efc9770c84ae2ac16df6021e30405aa5218169258fdafb25'],
 ['P03','B10',path.join(r4,'first-frame-local-reframe-P03-r1'),'passed','75689b5e2b7addcd168152aee699a4cfcccd55031ad28bb3ceef5696bb180815'],
 ['P04','B11',path.join(r4,'first-frame-remaining-production-r1'),'passed','cf828eeaa6a03b6b9a07cdede223a44bf7a1b70f147fa273c0568d8a2bdaf468'],
 ['P05','B15',path.join(r4,'first-frame-remaining-production-r1'),'revision-required',null],
 ['P06','B17',path.join(r4,'first-frame-remaining-production-r1'),'revision-required',null]
];
const sourceManifest=json(path.join(r4,'first-frame-prompts.v1.json'));
const scenes=sceneSpecs.map(([id,beat,dir,status,bakedHash])=>{
 const raw=path.join(dir,'first-frames',id+'_'+beat+'_first-frame.png');
 const qaPath=path.join(dir,'first-frame-qa',id+'.visual-review.v1.json');
 const qa=json(qaPath);
 assert.equal(qa.imageSha256,sha(raw),id+' raw hash');
 assert.equal(qa.status,status,id+' raw status');
 assert.equal(qa.physicalObservations.imageSha256,sha(raw),id+' observations');
 const s={sceneId:id,pairId:id+'-'+beat,sourceRevision:id==='P02'?'paper-v9.1-r3':'paper-v9.1-r4',status,raw:ref(raw),rawVisualReview:ref(qaPath),currentPairSha256:sourceManifest.scenes.find(x=>x.sceneId===id).pairSha256,findings:qa.findings||[],dynamicAccepted:false,userAcceptance:'pending'};
 if(id==='P02')s.retentionReceipt=ref(path.join(r4,'P02-保留原始来源回执.v1.json'));
 if(status==='passed'){
  assert.ok(Object.values(qa.criteria).every(v=>v==='passed'),id+' raw criteria');
  const baked=path.join(dir,'text-baked-first-frames',id+'_'+beat+'_first-frame-text-baked.png');
  assert.equal(sha(baked),bakedHash,id+' baked hash');
  const tqPath=path.join(dir,'first-frame-qa',id+'.text-baked-visual-review.v1.json'),tq=json(tqPath);
  assert.equal(tq.imageSha256,bakedHash,id+' visual binding');
  assert.equal(tq.status,'passed');
  assert.ok(Object.values(tq.criteria).every(v=>v==='passed'));
  const ocrPath=path.join(dir,'first-frame-qa/sample-text-bake-receipt.v1.json');
  const ocr=json(ocrPath).scenes.find(x=>x.sceneId===id);
  assert.equal(ocr.outputImage.sha256,bakedHash);
  assert.equal(ocr.sourceImage.sha256,s.raw.sha256);
  assert.ok(ocr.ocr.every(x=>x.matched && x.expected===x.recognized && x.inputImageSha256===bakedHash));
  s.baked=ref(baked);s.bakedVisualReview=ref(tqPath);s.ocrReceipt=ref(ocrPath);
  s.ocrNodes=ocr.ocr.map(x=>({nodeId:x.nodeId,text:x.expected,engine:x.preprocessing.selectedEngine,matched:x.matched}));
  s.originalBakePairSha256=ocr.pairSha256;
  s.anchorCalibration=ref(path.join(dir,'first-frame-qa/anchor-calibrations',id+'.v1.json'));
 }else{
  assert.equal(qa.criteria.videoReadiness,'failed');
  assert.ok(s.findings.some(x=>x.priority==='P0'));
  assert.ok(!fs.existsSync(path.join(dir,'text-baked-first-frames',id+'_'+beat+'_first-frame-text-baked.png')),'failed scene must not be baked');
 }
 return s;
});
if (!process.argv.includes('--inventory-only')) {
const contacts={};
for(const [name,which,selected] of [
 ['六镜原图状态联系表.v1.jpg','raw',scenes],
 ['四张带字候选联系表.v1.jpg','baked',scenes.filter(s=>s.status==='passed')]
]){
 const dest=path.join(out,name);assert.ok(!fs.existsSync(dest));
 const args=['montage','-font','/Users/pc/Library/Fonts/NotoSansCJKsc-Regular.otf','-pointsize','22','-background','#173149','-fill','#ffffff'];
 for(const s of selected)args.push('-label',s.sceneId+' '+(s.status==='passed'?'静态与中文通过':'结构失败，不可提交'),s[which].path);
 args.push('-geometry','640x360+12+12','-tile','2x',dest);
 execFileSync('/opt/homebrew/bin/magick',args);
 contacts[which]=ref(dest);
}
const receipt={
 schemaVersion:'koubo-paper-firstframe-six-scene-status/v1',createdAt:new Date().toISOString(),
 status:'blocked-by-P05-P06-physical-structure',sourceInputs:Object.keys(expectedInputs).map(f=>ref(path.join(r4,f))),
 counts:{total:6,staticAndChinesePassed:4,structuralFailed:2,ocrExactMatches:scenes.reduce((n,s)=>n+(s.ocrNodes?.length||0),0)},
 scope:'首帧与文字候选；不代表用户整批审美或动态验收',
 scenes,contacts,executionScope:ref(path.join(out,'execution-scope.v1.json')),
 nextAction:'只修P05/P06局部机构；新修订需用户确认，不覆盖既有图。',
 sourceDirectorIndependentReview:{threadId:'019f3383-706c-78f3-9dbe-6c6b20affb59',receivedInCurrentTurn:true,agreedFailedSceneIds:['P05','P06'],authorizesRetry:false},
 actualMillimetreClearanceVerified:false,dynamicAccepted:false,
 readyPackCreated:false,canvasPreparationPackCreated:false,runninghubUploads:0,runninghubConfiguration:0,videoSubmissions:0,payments:0,
 recordedVideo:{userReportsAlreadyRecorded:true,pathVerified:false,postShootRebindingVerified:false}
};
save('six-scene-status.v1.json',receipt);
}
const roots=[path.join(r4,'first-frame-local-reframe-P03-r1'),path.join(r4,'first-frame-remaining-production-r1'),out];
const files=[];const walk=p=>{for(const e of fs.readdirSync(p,{withFileTypes:true})){const f=path.join(p,e.name);if(e.isDirectory())walk(f);else if(e.isFile())files.push(ref(f));}};
roots.forEach(walk);
files.push(ref(path.join(base,'execution-tools/reframe-P03-local.v1.mjs')),ref(fileURLToPath(import.meta.url)));
save('artifact-sha256-manifest.v1.json',{schemaVersion:'koubo-paper-artifact-sha256/v1',createdAt:new Date().toISOString(),selfExcluded:true,files});
const finalReceipt=json(path.join(out,'six-scene-status.v1.json'));
console.log(JSON.stringify({verification:'evidence-bindings-verified',productionStatus:finalReceipt.status,counts:finalReceipt.counts,statusPath:path.join(out,'six-scene-status.v1.json'),contacts:finalReceipt.contacts},null,2));
