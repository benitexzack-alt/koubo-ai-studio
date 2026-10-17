// 真实聊天许可与本次文件闭包绑定，不生成独立签名或正式验收。
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {computeFirstCandidatePreviewBindingV2} from '../../../../skills/koubo-remotion-director/scripts/director-production-preflight-v2.mjs';
const out=dirname(fileURLToPath(import.meta.url)),root=resolve(out,'../../../..');
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const ref=p=>({path:relative(root,p),sha256:createHash('sha256').update(readFileSync(p)).digest('hex')});
const jobPath=resolve(out,'production-job.full-candidate.v1.json'),job=read(jobPath);
if(existsSync(resolve(root,job.preview.output)))throw new Error('已有输出，禁止覆盖重新绑定');
const input=read(resolve(root,job.productionGate.firstCandidateInput.path));
job.productionGate.localChatPreviewAuthorization=null;
const binding=computeFirstCandidatePreviewBindingV2({projectRoot:root,job});
const authPath=resolve(out,'本期整片候选聊天授权.v1.json');
const authorization={schema:'episode-local-chat-preview-authorization/v1',
 episodeId:input.episodeId,taskId:input.taskId,jobId:input.jobId,revisionId:input.revisionId,
 authorizationMethod:'current-chat-verbatim',decision:'allow-episode-internal-review-preview',role:'user',
 authorizedUserId:input.authorizedUserId,executionGroupId:input.executionGroupId,recordedAt:new Date().toISOString(),
 allowedCommands:['direct-remotion-preview'],sourceMessages:ref(resolve(out,'本轮整片与发布包导出授权原话.v1.json')),
 binding,independentSignature:false,humanAcceptancePerformed:false,productionEligible:false,formalEnabled:false,
 candidateAccepted:false,userPreviewApproved:false,fullWatchConfirmed:false,publishAuthorized:false};
writeFileSync(authPath,JSON.stringify(authorization,null,2)+'\n',{flag:'wx'});
job.productionGate.localChatPreviewAuthorization=ref(authPath);
writeFileSync(jobPath,JSON.stringify(job,null,2)+'\n');
writeFileSync(resolve(out,'聊天绑定实测.v1.json'),JSON.stringify({createdAt:new Date().toISOString(),
 job:ref(jobPath),authorization:ref(authPath),boundFiles:binding.boundFiles.length,gateClosureSha256:binding.gateClosureSha256,
 independentSignature:false,renderInvoked:false,previousBindingDisposition:'R2/R3完整保留；小样验收只绑定23秒，R4全长候选另建实际文件闭包。'},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({boundFiles:binding.boundFiles.length,job:ref(jobPath),renderInvoked:false}));
