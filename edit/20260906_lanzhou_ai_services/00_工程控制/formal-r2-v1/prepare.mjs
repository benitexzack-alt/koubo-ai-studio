import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import readline from 'node:readline';
import {ROOT,KB,CONTROL,OUTPUT,FINAL,PREVIEW,ORIGINAL,ORIGINAL_SHA,USER_QUOTE,MEDIA,AUDIO,ENTRY,PUBLIC,hashFile,readJson,collectRuntime,write} from './formal-core.mjs';
import {collectLocalImports,loadTypescript} from '../candidate-preview-r2/runner-core.mjs';
const here=path.join(ROOT,CONTROL);
assert(!fs.existsSync(path.join(here,'job.v1.json')));
const source='/Users/pc/.codex/sessions/2026/07/06/rollout-2026-07-06T02-21-19-019f3383-706c-78f3-9dbe-6c6b20affb59.jsonl';
let event=null;let number=0;
for await(const line of readline.createInterface({input:fs.createReadStream(source)})) {
  number++;if(number!==69913)continue;
  event=JSON.parse(line);break;
}
assert.equal(event?.payload?.role,'user');assert.equal(event.timestamp,'2026-09-08T03:11:09.437Z');
assert.equal(event.payload.content.map(c=>c.text||'').join('\n').trim(),USER_QUOTE);
write(path.join(here,'user-authorization.evidence.json'),{source,line:69913,event});
const old=readJson(path.join(ROOT,'edit/20260906_lanzhou_ai_services/00_工程控制/candidate-preview-r2/request.v3.json'));
for(const b of old.bindings)assert.equal(hashFile(path.join(ROOT,b.path)),b.sha256,b.path);
const permission=readJson(path.join(ROOT,old.permission.path));
const names=new Set([...old.bindings.map(b=>b.path),old.permission.path,ORIGINAL,PREVIEW,
  ...['formal-core.mjs','worker.mjs','run.mjs','prepare.mjs','start-context.mjs','test.mjs','user-authorization.evidence.json'].map(n=>`${CONTROL}/${n}`)]);
const bindings=[...names].sort().map(p=>({path:p,sha256:hashFile(path.join(ROOT,p))}));
const imports=collectLocalImports(ROOT,ENTRY,new Map(bindings.map(b=>[b.path,b.sha256])),loadTypescript());
const publicFiles=bindings.filter(b=>b.path.startsWith(PUBLIC+'/')).map(b=>b.path);
assert.equal(publicFiles.length,22);
const runtime=collectRuntime();write(path.join(here,'runtime-snapshot.v1.json'),runtime);
const job={schema:'lanzhou-r2-formal-scoped/v1',episodeId:'20260906_lanzhou_ai_services',revisionId:'formal-r2-v1',
  createdAt:new Date().toISOString(),scope:'current-episode-user-approved-local-formal-only',formalEnabled:true,publishAuthorized:false,externalActionsAllowed:false,
  authorization:{quote:USER_QUOTE,sourceTimestamp:event.timestamp,kind:'direct-user-current-conversation',evidence:`${CONTROL}/user-authorization.evidence.json`,
    visualAcceptance:true,skipAdditionalPreview:true,finalFullWatchAccepted:false,independentSignature:false},
  entry:ENTRY,publicDir:PUBLIC,render:MEDIA,audio:AUDIO,finalOutput:FINAL,
  source:{path:ORIGINAL,sha256:ORIGINAL_SHA},runtimeSha256:runtime.sha256,bindings,imports,publicFiles,
  unchangedVisualSource:true,unchangedSubtitleTiming:true,sourceVideoReplacement:'Only staged R01.mp4 uses original 1920x1080 MOV; muted render; mastered mix comes from R2',
  acceptedPaperExceptions:permission.acceptedPaperExceptions,currentSharedPostshootValidatorPassed:false,
  unresolvedAsrCount:13,subtitleAuthority:'actual-recording',scriptRole:'comparison-only',
  noGlobalGateChange:true,noHistoricalPermissionRewrite:true,finalStatusCeiling:'ready-for-user-review'};
write(path.join(here,'job.v1.json'),job);
console.log(JSON.stringify({job:path.join(here,'job.v1.json'),sha256:hashFile(path.join(here,'job.v1.json')),runtime:runtime.sha256}));
