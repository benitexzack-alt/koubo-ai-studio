import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validatePreproductionRequest} from '../../../skills/koubo-remotion-director/scripts/preproduction-director-core.mjs';

const episode=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const repo=path.resolve(episode,'../..');
const source=path.join(episode,'04_导演拆解/v9.1-r1/director-preproduction-request.v1.json');
const request=JSON.parse(readFileSync(source));
request.requestId='20260906-lanzhou-ai-services-v91-pre-shoot-r2';
for(const key of Object.keys(request.outputs))request.outputs[key]=request.outputs[key].replace('v9.1-r1/','v9.1-r2/');
for(const beat of request.beats.filter(b=>b.paperScene)){
  beat.paperScene.postShootTiming.firstFrameBakedLabelsVisibleFromFrame0=true;
  beat.paperScene.postShootTiming.enterStageMeaning='物件动作落位的绑定，不是纸面文字首次出现的时间证据';
}
const last=request.beats.find(b=>b.id==='B18').paperScene;
const before='G2有空白咨询纸页，G3托盘为空';
if(!last.prompt.firstFrame.includes(before))throw new Error('待修正句不符');
last.prompt.firstFrame=last.prompt.firstFrame.replace(before,'同一批三张完全空白咨询纸页叠放在G1入口左侧等待，G2三格分类槽为空，G3托盘为空');
last.prompt.motion=last.prompt.motion.replace('2.5至4.5秒空白咨询页沿路进入G2三格槽','2.5至4.5秒G1入口原有的同一批三张空白咨询页沿路进入G2三格槽，全程不新增、不复制纸页');
last.stages[1].action='G1入口原有的同一批三张完全空白咨询纸页从底座移到空的分类槽，按位置分入三格，不凭空增页。';
const profile=JSON.parse(readFileSync(path.join(repo,'workflow/active-director-profile.v1.json')));
const check=validatePreproductionRequest({request,projectRoot:repo,profile});
if(!check.ok)throw new Error(check.errors.join('\n'));
const dir=path.join(episode,'04_导演拆解/v9.1-r2');mkdirSync(dir,{recursive:true});
const target=path.join(dir,'director-preproduction-request.v1.json');
if(existsSync(target))throw new Error('R2已有请求，禁止覆盖');
writeFileSync(target,JSON.stringify(request,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({ok:true,target,changes:['B18同一批三张纸页统一从G1入口等待','纸面中文从首帧可见，阶段仅表示物件动作落位'],r1Preserved:true}));
