import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {BASE,CONTROL,JOB,OUTPUT,ROUTE} from './formal-adapter.v1.mjs';
const FINAL=`${BASE}/08_正式成片/员工AI增效分配_V8_1080P_正式候选_v1.mp4`;
const QA=`${BASE}/07_预览与质检/formal-v1`;
const PACKAGE=`${BASE}/09_发布包`;
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const check=(ok,message)=>{if(!ok)throw Object.assign(new Error(message),{code:'EAF_RELEASE'});};
export function validateEmployeeFormalRelease({projectRoot,release,preflight}){
  const root=path.resolve(projectRoot);
  const read=ref=>{
    const p=path.resolve(root,ref.path);
    const rel=path.relative(root,p);
    check(rel&&!rel.startsWith(`..${path.sep}`)&&!path.isAbsolute(rel)&&fs.lstatSync(p).isFile()&&
      fs.realpathSync(p)===p,'交付路径越界或不是普通文件');
    const bytes=fs.readFileSync(p);check(sha(bytes)===ref.sha256,`交付哈希失效：${ref.path}`);
    if(ref.bytes!==undefined)check(bytes.length===ref.bytes,`交付大小失效：${ref.path}`);
    return bytes;
  };
  const json=ref=>JSON.parse(read(ref));
  check(preflight.route===ROUTE&&preflight.userPreviewApproved===true,'缺少本期真实预览确认');
  check(release.releaseId==='20260918-ai-efficiency-sharing-v8-r1'&&release.videoId==='AI_EFFICIENCY_SHARING_20260917'&&
    release.status==='ready-for-user-review'&&release.userReview.fullWatchConfirmed===false&&
    release.publish.status==='not-published'&&release.publish.authorized===false,'不得冒充终验或发布');
  const gate=release.productionGate;
  check(gate.job.path===JOB&&gate.formalOutput.path===FINAL&&release.production.formalOutput===FINAL,'本期正式交付路径不符');
  read(gate.formalOutput);
  const render=json(gate.controlledRenderReceipt),initial=json(gate.renderPreflight);
  check(render.schema==='director-controlled-remotion-render-receipt/v2'&&render.mode==='formal'&&render.variant==='with-sfx'&&
    render.jobId==='20260917-ai-efficiency-sharing-v8-r1-formal'&&
    path.relative(root,render.output.path)===OUTPUT,'缺少本期受控正式渲染回执');
  read({...render.output,path:OUTPUT});
  check([render.preflightIntegritySealSha256,render.immediatelyBeforeSpawnIntegritySealSha256,render.afterRenderIntegritySealSha256]
    .every(x=>x===initial.integritySealSha256),'渲染前后执行状态不一致');
  for(const key of ['jobFileSha256','jobSnapshotSha256','scopedDirectExportSha256','boundFilesSha256','compositionBindingSha256'])
    check(initial[key]===preflight[key],`当前输入与实际渲染不一致：${key}`);
  const allowed=new Set(['tools/validate-release.mjs','tools/release-production-gate-v2.mjs']);
  const current=new Map(preflight.gateClosureFiles.map(x=>[x.path,x.sha256]));
  for(const f of initial.gateClosureFiles)if(!allowed.has(f.path))check(current.get(f.path)===f.sha256,`渲染闭包漂移：${f.path}`);
  const master=json(gate.audioMaster),qa=json(gate.technicalQa),frames=json(gate.riskFrames),visual=json(gate.visualReview);
  check(master.source.sha256===render.output.sha256&&master.output.sha256===gate.formalOutput.sha256&&
    master.videoCopiedWithoutReencoding===true&&qa.source.sha256===gate.formalOutput.sha256&&qa.status==='passed'&&
    qa.frames===4669&&qa.fullDecodeExit===0&&qa.blackEvents.length===0&&qa.silenceEvents.length===0,'正式音视频证据不完整');
  check(Math.abs(Number(master.measured.input_i)+16)<=.6&&Number(master.measured.input_tp)<=-1.5&&
    master.alignment.every(x=>Math.abs(x.sourceOffsetSamples)<=1),'响度、峰值或原声时间未通过');
  check(frames.sourceVideo.sha256===gate.formalOutput.sha256&&frames.frames.length>=30&&visual.status==='reviewed-sampled-frames'&&
    visual.fullWatchConfirmed===false,'缺少本条真实风险帧复核');
  for(const frame of frames.frames)read(frame);
  const delivery=release.deliveryPackage,cover=delivery.cover,approval=json(gate.userApproval);
  check(delivery.status==='ready-for-delivery'&&cover.aspectRatio==='4:3'&&approval.coverAspectRatio==='4:3','必须按用户本次4:3要求交付');
  const screenshot=json(gate.screenshotReceipt);
  check(screenshot.sourceVideo.sha256===gate.formalOutput.sha256&&screenshot.output.path===cover.recommendedFrame&&
    screenshot.sourceTimeSeconds===cover.sourceTimeSeconds,'人物截图来源不符');read(screenshot.output);
  const decodePixels=(p,t)=>{
    const r=spawnSync('ffmpeg',['-v','error','-ss',String(t),'-i',path.resolve(root,p),'-frames:v','1','-pix_fmt','rgb24','-f','rawvideo','-'],{maxBuffer:16*1024*1024});
    check(r.status===0,'截图像素读取失败');return sha(r.stdout);
  };
  check(decodePixels(FINAL,cover.sourceTimeSeconds)===decodePixels(cover.recommendedFrame,0),'人物截图必须来自正式成片实际像素');
  check(delivery.titles.primary&&delivery.titles.alternatives.length===2&&delivery.douyin.publishCopy&&delivery.douyin.topics.length>0,'标题、文案或话题缺失');
  const copy=json(gate.copyReview);
  check(copy.status==='passed'&&copy.scores.fact_fidelity===10,'发布文字审阅未通过');
  read(copy.draft);for(const ref of copy.additionalDrafts)read(ref);
  for(const skill of Object.values(copy.skills))check(skill.read===true&&sha(fs.readFileSync(skill.path))===skill.sha256,'双Skill未绑定当前版本');
  check(sha(fs.readFileSync(path.resolve(root,cover.prompt)))===copy.draft.sha256,'提示词审稿哈希失效');
  const captions=spawnSync(process.execPath,['tools/check-spoken-source-policy.mjs',release.inputs.transcript,
    release.inputs.bilingualCaptions,release.inputs.spokenSourcePolicy],{cwd:root,encoding:'utf8'});
  check(captions.status===0,'实录字幕校验失败');
  for(const asset of release.assetManifest)read(asset);
  return {ok:true,code:'RPG2_EMPLOYEE_FORMAL_OK',route:ROUTE,formalOutputSha256:gate.formalOutput.sha256,
    coverAspectRatio:'4:3',userPreviewApproved:true,fullWatchConfirmed:false,publishAuthorized:false,
    evidenceScope:'受控正式渲染、原声定位、全量解码、风险抽帧和发布包完整性；不等于全片人审或事实核验通过'};
}
