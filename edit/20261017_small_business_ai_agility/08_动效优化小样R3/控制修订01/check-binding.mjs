// 对刚刚经过真实解码的绑定进行轻量范围复检；完整受控preflight仍由渲染入口执行。
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateAgilityChatPreviewAuthorization} from '../../../../skills/koubo-remotion-director/scripts/small-business-ai-agility-chat-preview-authorization.mjs';
import {computeProductionJobSnapshotSha256V2,computeProductionGateClosureV2} from '../../../../skills/koubo-remotion-director/scripts/director-production-preflight-v2.mjs';
import {buildControlledRemotionRenderArgsV2} from '../../../../skills/koubo-remotion-director/scripts/remotion-production-command-v2.mjs';
const out=dirname(fileURLToPath(import.meta.url)),root=resolve(out,'../../../..');
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const readBoundJson=(projectRoot,ref)=>{const p=resolve(projectRoot,ref.path);assert.equal(hash(p),ref.sha256);return {...ref,body:read(p)};};
const job=read(resolve(out,'production-job.sample.v1.json'));
const auth=readBoundJson(root,job.productionGate.localChatPreviewAuthorization).body,binding=auth.binding;
const input=readBoundJson(root,job.productionGate.firstCandidateInput).body;
assert.equal(binding.jobSnapshotSha256,computeProductionJobSnapshotSha256V2(job));
assert.equal(binding.gateClosureSha256,computeProductionGateClosureV2({projectRoot:root}).sha256);
for(const file of binding.boundFiles)assert.equal(hash(resolve(root,file.path)),file.sha256);
validateAgilityChatPreviewAuthorization({projectRoot:root,job,input,binding,command:'direct-remotion-preview',readBoundJson});
const args=buildControlledRemotionRenderArgsV2({entryRelative:job.remotion.entry,composition:job.remotion.compositionWithSfx,output:job.preview.output,
 publicDir:job.remotion.publicDir,previewRenderSettings:job.preview.renderSettings,
 renderContext:{mode:'preview',command:'direct-remotion-preview',preflightRoute:'small-business-ai-agility-current-chat-review',
 episodeId:job.videoId,jobId:job.jobId,revisionId:job.productionGate.revisionId,inputFormat:job.director.inputFormat,
 width:1920,height:1080,fps:30,durationSeconds:4126/30}});
const result={ok:true,checkedAt:new Date().toISOString(),boundFiles:binding.boundFiles.length,frameArgs:args.slice(-4),
 fullControlledPreflightPendingAtRender:true,renderInvoked:false,humanAcceptancePerformed:false,publishAuthorized:false};
writeFileSync(resolve(out,'绑定范围复检.v1.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(result));
