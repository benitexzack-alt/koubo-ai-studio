// 实算本期输入、代码与当前人类问答的绑定；不是独立签名或正式放行。
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {computeFirstCandidatePreviewBindingV2} from '../../../../skills/koubo-remotion-director/scripts/director-production-preflight-v2.mjs';
const out=dirname(fileURLToPath(import.meta.url)),root=resolve(out,'../../../..');
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const ref=p=>({path:relative(root,p),sha256:createHash('sha256').update(readFileSync(p)).digest('hex')});
for(const [jobName,tag] of [['production-job.first-candidate.v1.json','完整'],['production-job.no-sfx-first35s.v1.json','无附加音效']]){
const jobPath=resolve(out,jobName),job=read(jobPath);
if(existsSync(resolve(root,job.preview.output)))throw new Error('已有输出，禁止重新绑定覆盖');
const input=read(resolve(root,job.productionGate.firstCandidateInput.path));
job.productionGate.localChatPreviewAuthorization=null;
const binding=computeFirstCandidatePreviewBindingV2({projectRoot:root,job});
const authPath=resolve(out,`本期内部预览聊天授权_${tag}.v1.json`);
if(existsSync(authPath))throw new Error('已存在本期绑定，变更后须保留旧版另存');
const authorization={schema:'episode-local-chat-preview-authorization/v1',
  episodeId:input.episodeId,taskId:input.taskId,jobId:input.jobId,revisionId:input.revisionId,
  authorizationMethod:'current-chat-verbatim',decision:'allow-episode-internal-review-preview',role:'user',
  authorizedUserId:input.authorizedUserId,executionGroupId:input.executionGroupId,recordedAt:new Date().toISOString(),
  allowedCommands:['direct-remotion-preview'],sourceMessages:ref(resolve(out,'本轮视频候选导出请求.v1.json')),
  binding,independentSignature:false,humanAcceptancePerformed:false,productionEligible:false,formalEnabled:false,
  candidateAccepted:false,userPreviewApproved:false,fullWatchConfirmed:false,publishAuthorized:false};
writeFileSync(authPath,JSON.stringify(authorization,null,2)+'\n',{flag:'wx'});
job.productionGate.localChatPreviewAuthorization=ref(authPath);
writeFileSync(jobPath,JSON.stringify(job,null,2)+'\n');
writeFileSync(resolve(out,`聊天绑定实测_${tag}.v1.json`),JSON.stringify({createdAt:new Date().toISOString(),
  job:ref(jobPath),authorization:ref(authPath),boundFiles:binding.boundFiles.length,
  gateClosureSha256:binding.gateClosureSha256,independentSignature:false,renderInvoked:false,
  previousBindingDisposition:'新建本期视频R2绑定；保留静图R1原文件与历史结果。'},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({boundFiles:binding.boundFiles.length,job:ref(jobPath),renderInvoked:false},null,2));

}
