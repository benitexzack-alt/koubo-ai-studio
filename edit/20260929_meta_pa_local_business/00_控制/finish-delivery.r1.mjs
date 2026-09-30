// 仅本期真实成片抽帧与发布包归档；不发布、不修改任何源素材。
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {validateKnowledgeContextForProductionV2} from '../../../tools/knowledge-context-production-gate.mjs';

const root=path.resolve(import.meta.dirname,'../../..');
const base='edit/20260929_meta_pa_local_business';
const dir=path.join(root,base,'12_正式成片');
const video=path.join(dir,'Meta个人AI助理与本地商家_V8_R1_1080P.mp4');
const frame=path.join(dir,'本条成片真人截图.png');
const receipt=path.join(dir,'本条成片真人截图回执.r1.json');
const mode=process.argv[2];assert(['frame','audio','append-audio','archive'].includes(mode));
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const rel=p=>path.relative(root,p).split(path.sep).join('/');
const run=(exe,args,cwd=root)=>{const result=spawnSync(exe,args,{cwd,encoding:'utf8',maxBuffer:20e6});assert.equal(result.status,0,result.stderr||result.stdout);return result;};
assert(fs.existsSync(video)&&fs.statSync(video).size>0,'必须先取得真实完整MP4');
const jobPath=path.join(root,base,'10_剪辑准备/完整视听小样R1/preview-job.json');
const job=JSON.parse(fs.readFileSync(jobPath,'utf8'));
assert.equal(path.resolve(root,job.outputs.fullPreview),video);
const contextProof=validateKnowledgeContextForProductionV2({projectRoot:root,jobPath,job,command:mode==='audio'?'qa':'release-validation'});
assert.equal(contextProof.required,true);assert.equal(contextProof.validationStatus,'context-valid');
if(mode==='frame'){
 const timestampSeconds=116;
 assert(!fs.existsSync(frame)&&!fs.existsSync(receipt),'不覆盖已有成片截图及回执');
 run('ffmpeg',['-hide_banner','-loglevel','error','-n','-ss',String(timestampSeconds),'-i',video,'-frames:v','1',frame]);
 assert.equal(fs.readFileSync(frame).subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 const proof={schema:'current-final-video-real-frame/v1',sourceFinalVideo:{path:rel(video),sha256:sha(video)},timestampSeconds,frame:{path:rel(frame),sha256:sha(frame)},method:'FFmpeg从本期最终有声MP4实际提取，未重绘真人',fullWatchConfirmed:false,publishAuthorized:false};
 fs.writeFileSync(receipt,JSON.stringify(proof,null,2)+'\n');
 console.log('本条最终成片116秒真人截图及来源回执已生成');
}else if(mode==='audio'){
 const result=run('ffmpeg',['-hide_banner','-nostats','-i',video,'-map','0:a:0','-af','loudnorm=I=-17.5:TP=-1.5:LRA=11:print_format=json','-f','null','-']);
 const measurementBlock=result.stderr.match(/\{\s*"input_i"[\s\S]*?\}/u);
 assert(measurementBlock,'实际AAC测量必须返回完整响度JSON');
 const measurement=JSON.parse(measurementBlock[0]);
 assert(Number(measurement.input_tp)<0,'导出AAC真峰必须低于0dBTP');
 fs.writeFileSync(path.join(dir,'导出AAC响度检查.r1.json'),JSON.stringify({sourceFinalVideo:{path:rel(video),sha256:sha(video)},contextProof,integratedLufs:Number(measurement.input_i),truePeakDbtp:Number(measurement.input_tp),loudnessRangeLu:Number(measurement.input_lra),method:'测量实际最终MP4的AAC输入，滤镜输出到null；不修改媒体',humanListeningPerformed:false,publishAuthorized:false},null,2)+'\n');
 console.log(JSON.stringify({integratedLufs:Number(measurement.input_i),truePeakDbtp:Number(measurement.input_tp)}));
}else if(mode==='append-audio'){
 const pkg=path.join(root,base,'11_发布包候选');
 const source=path.join(dir,'导出AAC响度检查.r1.json'),dest=path.join(pkg,'导出AAC响度检查.r1.json');
 const measured=JSON.parse(fs.readFileSync(source,'utf8'));
 assert.equal(measured.sourceFinalVideo.sha256,sha(video));
 if(fs.existsSync(dest))assert.equal(sha(dest),sha(source));
 else fs.copyFileSync(source,dest,fs.constants.COPYFILE_EXCL);
 const metaPath=path.join(pkg,'发布记录.r1.json'),meta=JSON.parse(fs.readFileSync(metaPath,'utf8'));
 assert.equal(meta.packageComplete,true);assert.equal(meta.production.canonicalFinalFile.sha256,sha(video));
 meta.production.exportedAacQa={path:rel(dest),sha256:sha(dest)};
 fs.writeFileSync(metaPath,JSON.stringify(meta,null,2)+'\n');
 const files=fs.readdirSync(pkg).filter(name=>fs.statSync(path.join(pkg,name)).isFile()&&name!=='完整包文件回执.r1.json').map(name=>({name,bytes:fs.statSync(path.join(pkg,name)).size,sha256:sha(path.join(pkg,name))}));
 fs.writeFileSync(path.join(pkg,'完整包文件回执.r1.json'),JSON.stringify({status:'ready-for-user-review',packageComplete:true,fullWatchConfirmed:false,publishAuthorized:false,files},null,2)+'\n');
 console.log('本期实际AAC响度报告已同哈希纳入完整发布包');
}else{
 const pkg=path.join(root,base,'11_发布包候选');
 const meta=JSON.parse(fs.readFileSync(path.join(pkg,'发布记录.r1.json'),'utf8'));
 assert.equal(meta.packageComplete,true);assert.equal(meta.publishAuthorized,false);assert.equal(meta.production.canonicalFinalFile.sha256,sha(video));
 assert.equal(sha(path.resolve(root,meta.production.exportedAacQa.path)),meta.production.exportedAacQa.sha256);
 const manifest=JSON.parse(fs.readFileSync(path.join(pkg,'完整包文件回执.r1.json'),'utf8'));
 for(const file of manifest.files)assert.equal(sha(path.join(pkg,file.name)),file.sha256,`包内文件变化:${file.name}`);
 const archive=path.join(dir,'Meta个人AI助理与本地商家_V8_R1_完整发布包.zip');
 assert(!fs.existsSync(archive),'不覆盖已有发布压缩包');
 const files=[...manifest.files.map(file=>file.name),'完整包文件回执.r1.json'];
 run('zip',['-0','-q',archive,...files],pkg);
 run('unzip',['-t',archive]);
 fs.writeFileSync(path.join(dir,'完整发布包压缩回执.r1.json'),JSON.stringify({archive:{path:rel(archive),sha256:sha(archive),bytes:fs.statSync(archive).size},contextProof,files,zipIntegrityVerified:true,status:'ready-for-user-review',fullWatchConfirmed:false,publishAuthorized:false},null,2)+'\n');
 console.log('完整发布包已归档且压缩完整性检查通过；未发布');
}
