import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const context=path.dirname(fileURLToPath(import.meta.url));
const control=path.dirname(context);
const project=path.resolve(control,'../../../..');
const evidencePath=path.join(control,'independent-review-evidence.v1.md');
const evidence=fs.readFileSync(evidencePath,'utf8');
const quote='本次候选执行保持阻断，仅有一项P1：runner真实知识复检在只读沙箱内无法打开当前SQLite索引；不构成stills或render放行。';
if(!evidence.includes(quote))throw new Error('证据原文不匹配');
const now=new Date();
const receipt={
  schemaVersion:'koubo-lanzhou-candidate-code-review/v1',
  episodeId:'20260906_lanzhou_ai_services',
  revisionId:'20260907-lanzhou-services-candidate-preview-r1',
  decision:'blocked',
  reviewerId:'independent-context-reviewer',
  implementerId:'Linnaeus-runner-and-parent-composition',
  requestIntentSha256:'3c92ccf6e95c492b405385a4dcc08f7296679b36c474bce20cb60ff350b68f8d',
  runtimeSha256:'35bc5b4a7f35ebe9c71aded1c5a6503f50e52d6882a5674fb490a3a92f1a76ba',
  reviewedAt:now.toISOString(),expiresAt:new Date(now.getTime()+6*60*60*1000).toISOString(),
  evidence:{path:path.relative(project,evidencePath),sha256:crypto.createHash('sha256').update(evidence).digest('hex')},
  quote,cryptographicProductionAuthorization:false,formalEnabled:false,productionEligible:false,userPreviewApproved:false,publishAuthorized:false,
  allowedCommands:[],allowedScopeAfterNewReviewOnly:['stills','render'],
  findings:[{severity:'P1',file:'edit/20260906_lanzhou_ai_services/00_工程控制/candidate-preview-r1/runner.mjs',line:32,
    code:'KNOWLEDGE_SQLITE_READONLY_SANDBOX_FAILURE',message:'真实validateKnowledge调用在SQLite SELECT meta阶段报unable to open database file；当前不放行候选执行。'}],
  note:'结构沿用runner评审回执字段；decision=blocked将被validateRequest拒绝，不能为了满足allow检查伪造放行。没有修改request的独立审查占位SHA。'
};
fs.writeFileSync(path.join(control,'independent-review.v1.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({path:path.join(control,'independent-review.v1.json'),decision:receipt.decision,evidence:receipt.evidence,requestIntentSha256:receipt.requestIntentSha256,runtimeSha256:receipt.runtimeSha256},null,2));
