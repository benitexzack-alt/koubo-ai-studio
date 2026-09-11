import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
const root="/Users/pc/Documents/口播/edit/20260910_lanzhou_industry_ai/03_导演拆解/paper-v9.1-r4",out="/Users/pc/Documents/口播/edit/20260910_lanzhou_industry_ai/03_导演拆解/paper-v9.1-r4/first-frame-final-preparation-r1";
const jpath=path.join(out,'first-frame-batch.v1.json'),j=JSON.parse(fs.readFileSync(jpath));const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');const read=p=>JSON.parse(fs.readFileSync(p));
const mappings={P01:path.join(root,'first-frame-local-reframe-P01-r1'),P02:path.resolve(root,'../paper-v9.1-r3/first-frame-production-r1'),P03:path.join(root,'first-frame-local-reframe-P03-r1'),P04:path.join(root,'first-frame-remaining-production-r1')};
j.textBakeReceipts??=[];const imported=[];
for(const [id,d]of Object.entries(mappings)){const priorPath=path.join(d,'first-frame-batch.v1.json'),prior=read(priorPath),s=prior.scenes.find(s=>s.sceneId===id),target=j.scenes.find(s=>s.sceneId===id);if(target.result)throw Error('已导入：'+id);
for(const k of ['pairSha256','textPlanSha256'])if(s[k]!==target[k])throw Error('配对变化：'+id+':'+k);
if(s.deterministicTextBake.labelsSha256!==target.deterministicTextBake.labelsSha256)throw Error('标签变化：'+id);
if(sha(s.result.imagePath)!==s.result.imageSha256)throw Error('原图变化：'+id);
target.outputPath=s.outputPath;target.result={...s.result};const rv=path.join(d,'first-frame-qa',id+'.visual-review.v1.json');target.result.visualReview={path:rv,sha256:sha(rv)};
target.deterministicTextBake.outputPath=s.deterministicTextBake.outputPath;target.deterministicTextBake.calibrationPath=s.deterministicTextBake.calibrationPath;
const bq=path.join(d,'first-frame-qa',id+'.text-baked-visual-review.v1.json');fs.copyFileSync(bq,path.join(j.output.qaRoot,id+'.text-baked-visual-review.v1.json'),fs.constants.COPYFILE_EXCL);
for(const r of prior.textBakeReceipts??[]){if(r.sceneIds.includes(id)&&!j.textBakeReceipts.some(x=>x.receipt.path===r.receipt.path))j.textBakeReceipts.push(r);}
imported.push({sceneId:id,priorJob:{path:priorPath,sha256:sha(priorPath)},image:{path:s.result.imagePath,sha256:s.result.imageSha256},baked:{path:s.deterministicTextBake.outputPath,sha256:sha(s.deterministicTextBake.outputPath)},sourceRevisionPreserved:prior.revisionId});}
j.fullBatchAuthorized=true;j.userAcceptance='pending';j.dynamicAccepted=false;j.executionMode='user-authorized-full-canvas-preparation';j.events.push({type:'preserved-approved-static-candidates-imported',at:new Date().toISOString(),sceneIds:Object.keys(mappings)});
fs.writeFileSync(jpath,JSON.stringify(j,null,2)+'\n');fs.writeFileSync(path.join(out,'preserved-four-scenes-import.v1.json'),JSON.stringify({createdAt:new Date().toISOString(),imported,oldFilesOverwritten:false},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({imported:imported.map(x=>x.sceneId)}));
