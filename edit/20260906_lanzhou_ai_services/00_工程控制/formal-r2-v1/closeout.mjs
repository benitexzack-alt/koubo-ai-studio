import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {ROOT,CONTROL,hashFile,readJson,write,verifyJob} from './formal-core.mjs';
const dir=path.join(ROOT,'edit/20260906_lanzhou_ai_services/08_发布包/formal-r2-v1');
verifyJob(readJson(path.join(ROOT,CONTROL,'job.v2.json')));
const release=readJson(path.join(dir,'release.v1.json'));
const text=readJson(path.join(dir,'text-validation.v3.json'));
assert.equal(text.status,'passed');assert.equal(release.status,'ready-for-user-review');
for(const f of [...text.inputs,...text.evidence_sources])assert.equal(hashFile(f.path),f.sha256);
assert.equal(fs.statSync(release.video.path).ino,fs.statSync(release.packageVideo.path).ino);
assert.equal(fs.realpathSync(release.desktopEntry),dir);
const n=fs.readdirSync(dir).filter(s=>/\.(json|txt|png|mp4)$/.test(s)&&!s.includes('.stdout.')&&!s.includes('.stderr.')).sort();
const artifacts=n.map(s=>({path:path.join(dir,s),sha256:hashFile(path.join(dir,s)),bytes:fs.statSync(path.join(dir,s)).size}));
write(path.join(dir,'delivery-checksums.v2.json'),{schemaVersion:1,status:'files-and-bindings-verified',at:new Date().toISOString(),
  supersedes:{path:path.join(dir,'delivery-checksums.v1.json'),sha256:hashFile(path.join(dir,'delivery-checksums.v1.json'))},
  releaseId:release.releaseId,artifacts,finalStatus:'ready-for-user-review',notPublished:true,
  completeTechnicalQa:true,actualRiskFramesReviewed:24,localCopyReviewPassed:true,
  fullFinalUserWatchConfirmed:false,scope:release.scope,notes:'本次新增最终文字复核绑定；视频、图片、文案及旧回执不覆盖。'});
const sums=[...artifacts,{path:path.join(dir,'delivery-checksums.v2.json'),sha256:hashFile(path.join(dir,'delivery-checksums.v2.json'))}];
fs.writeFileSync(path.join(dir,'SHA256SUMS.txt'),sums.map(s=>`${s.sha256}  ${path.basename(s.path)}`).join('\n')+'\n',{flag:'wx'});
console.log(JSON.stringify({status:release.status,videoSha256:release.video.sha256,artifacts:sums.length,desktop:release.desktopEntry,
  finalReceiptSha256:hashFile(path.join(dir,'delivery-checksums.v2.json')),closedAt:new Date().toISOString()}));
