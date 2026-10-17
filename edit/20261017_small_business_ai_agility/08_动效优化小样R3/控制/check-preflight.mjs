// 只读受控前置复检；不调用渲染器、不登记人审。
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertProductionEntryPreflightV2} from '../../../../skills/koubo-remotion-director/scripts/director-production-preflight-v2.mjs';
import {buildControlledRemotionRenderArgsV2} from '../../../../skills/koubo-remotion-director/scripts/remotion-production-command-v2.mjs';
const out=dirname(fileURLToPath(import.meta.url)),root=resolve(out,'../../../..');
const jobPath=resolve(out,'production-job.sample.v1.json'),job=JSON.parse(readFileSync(jobPath,'utf8'));
const preflight=assertProductionEntryPreflightV2({projectRoot:root,jobPath,job,
 command:'direct-remotion-preview',entrypoint:'skills/koubo-remotion-director/scripts/run-remotion-production-v2.mjs'});
const args=buildControlledRemotionRenderArgsV2({entryRelative:job.remotion.entry,composition:job.remotion.compositionWithSfx,
 output:resolve(root,job.preview.output),publicDir:resolve(root,job.remotion.publicDir),previewRenderSettings:job.preview.renderSettings,
 renderContext:{mode:'preview',command:'direct-remotion-preview',preflightRoute:preflight.route,episodeId:job.videoId,
 jobId:job.jobId,revisionId:job.productionGate.revisionId,inputFormat:job.director.inputFormat,width:1920,height:1080,fps:30,durationSeconds:4126/30}});
writeFileSync(resolve(out,'受控前置复检.v1.json'),JSON.stringify({checkedAt:new Date().toISOString(),preflight,
 renderArgs:args,renderInvoked:false,humanAcceptancePerformed:false,publishAuthorized:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({ok:preflight.ok,code:preflight.code,route:preflight.route,frameRange:job.preview.renderSettings.frames,renderInvoked:false}));
