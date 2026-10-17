// 只接纳root指定的三条既有本地声材。实际probe/full decode，历史许可注明记录来源，不冒称当日联网核验。
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,relative,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {paperMediaTools} from '../../../../skills/koubo-remotion-director/scripts/paper-asset-intake-media.mjs';
const out=dirname(fileURLToPath(import.meta.url)),root=resolve(out,'../../../..');
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const ref=p=>({path:relative(root,p),sha256:createHash('sha256').update(readFileSync(p)).digest('hex')});
const write=(name,body)=>{const p=resolve(out,name);mkdirSync(dirname(p),{recursive:true});writeFileSync(p,JSON.stringify(body,null,2)+'\n',{flag:'wx'});return p;};
const measurement=resolve(out,'../质检/补充音效来源与实测.v1.json'),list=read(measurement).sources;
const expected={'v3-line-connect-a':'25cf2fb54fbe59d6cccd92a8a45a0d0f818b355000795e699b4b4334ef08e6b3',
 'v3-number-settle-a':'79458cf26da84c5233a7b7ad437c6ed872d593be61baba17f748b444bf10745f',
 'v2-zoom-out':'e8ad4a3f59ae91d50c9b3319c48553b29cb78f389402f550fed4eb6644bbe375'};
assert.deepEqual(list.map(x=>x.id).sort(),Object.keys(expected).sort());
const manifestPath=resolve(root,'assets/sfx/koubo-sfx-v8/manifest.json'),manifest=read(manifestPath);
const tools=paperMediaTools(['ffmpeg','ffprobe']);
const run=(tool,args)=>{const r=spawnSync(tool.path,args,{encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024});assert.equal(r.status,0,r.stderr||String(r.error));return r;};
const assets=[];
for(const item of list){
 const original=resolve(root,`remotion/public/audio/koubo-sfx-v8/${item.id}.wav`);
 const render=resolve(root,`edit/20261017_small_business_ai_agility/05_剪辑工程/public/sfx/${item.id}.wav`);
 assert.equal(item.output,relative(root,original));assert.equal(item.copiedTo,relative(root,render));
 assert.equal(ref(original).sha256,expected[item.id]);assert.equal(ref(render).sha256,expected[item.id]);
 const historical=manifest.items.find(x=>x.id===item.id);assert(historical);assert.equal(historical.outputSha256,expected[item.id]);
 const priorSource=resolve(root,historical.source);assert.equal(ref(priorSource).sha256,historical.sourceSha256);
 const provenance=write(`补充声材/${item.id}.source.json`,{createdAt:new Date().toISOString(),
  sourceLibrary:ref(original),priorProcessedSource:ref(priorSource),historicalV8Manifest:ref(manifestPath),
  historicalLicenseManifest:ref(resolve(root,historical.licenseReference)),licenseLabelFromHistoricalManifest:historical.license,
  licenseEvidenceKind:'historical-local-manifest',onlineLicenseReverificationPerformed:false,
  copiedPublicAsset:ref(render),currentMeasurement:ref(measurement),
  note:'本期核对真实本地文件及其历史来源链，未下载、未更改声音字节；历史许可记录不冒称本轮联网核验。'});
 const probe=JSON.parse(run(tools.ffprobe,['-v','error','-show_streams','-show_format','-of','json',render]).stdout);
 const stream=probe.streams.find(x=>x.codec_type==='audio');assert(stream);const duration=Number(stream.duration??probe.format.duration);
 assert(Math.abs(duration-item.durationSeconds)<0.01);
 write(`补充声材/${item.id}.ffprobe.json`,probe);
 const argv=['-nostdin','-v','error','-xerror','-i',render,'-map','0:a:0','-f','null','-'];const result=run(tools.ffmpeg,argv);
 assert.equal(ref(render).sha256,expected[item.id]);
 const decode=write(`补充声材/${item.id}.decode.json`,{source:ref(render),command:[tools.ffmpeg.path,...argv],exitCode:result.status,
  fullDecode:true,tool:tools.ffmpeg,stderr:result.stderr,checkedAt:new Date().toISOString(),humanListeningPerformed:false});
 assets.push({id:`r4-sfx-${item.id}`,kind:'sfx',source:ref(original),renderAsset:ref(render),sourceReceipt:ref(provenance),
  media:{type:'audio',durationSeconds:duration},decodeReceipt:ref(decode),reviewAccepted:false});
}
write('补充声材入库.v1.json',{createdAt:new Date().toISOString(),scope:'only-three-parent-selected-existing-local-sfx',assets,
 sourceMeasurement:ref(measurement),audioBytesChanged:false,onlineLicenseReverificationPerformed:false,humanAudibilityAccepted:false});
console.log(JSON.stringify({ok:true,assets:assets.length,probeAndFullDecode:true,audioBytesChanged:false}));
