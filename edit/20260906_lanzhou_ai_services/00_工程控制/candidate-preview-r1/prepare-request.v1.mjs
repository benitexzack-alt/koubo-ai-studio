import fs from 'node:fs';
import path from 'node:path';
import {ROOT, CONTROL, ENTRY, PUBLIC, RENDER, COMPOSITION, collectRuntime, hashFile, readJson, requestIntentSha256} from './runner-core.mjs';

const version = process.argv[2] ?? 'v1';
if (!/^v[1-9][0-9]*$/.test(version)) throw new Error('无效回执版本');
const requestFile = path.join(ROOT, CONTROL, `request.${version}.json`);
if (fs.existsSync(requestFile)) throw new Error('请求已存在，不覆盖');
const contextVersion = process.argv[3] ?? 'v1';
if (!/^v[1-9][0-9]*$/.test(contextVersion)) throw new Error('无效上下文版本');
const contextBinding = readJson(path.join(ROOT,CONTROL,`context/context-binding.${contextVersion}.json`));
const runtime = collectRuntime(ROOT);
const src = 'remotion/src/lanzhou-services-v91-candidate-r1';
const base = 'edit/20260906_lanzhou_ai_services';
const publicFiles = readJson(path.join(ROOT,CONTROL,'public-assets.v1.json')).bindings;
const names = [
  `${src}/index.tsx`,`${src}/LanzhouServicesCandidate.tsx`,`${src}/ShotcraftEffects.generated.tsx`,`${src}/visual-plan.v1.json`,`${src}/tsconfig.json`,
  'remotion/src/components/AdaptiveBilingualCaptionOverlay.tsx','remotion/src/components/LocalFont.tsx',
  'remotion/src/components/V8SemanticStage.tsx','remotion/src/styles.ts',
  'skills/koubo-shotcraft-library/assets/ShotcraftEffects.tsx',
  `${base}/04_导演拆解/candidate-preview-r1/data.v1.json`,`${base}/04_导演拆解/candidate-preview-r1/captions.json`,
  `${base}/04_导演拆解/candidate-preview-r1/output-selection.derived.v2.json`,`${base}/04_导演拆解/candidate-preview-r1/final-consumption.v2.json`,
  `${base}/09_实录与字幕/canonical-spoken.v1.json`,`${base}/09_实录与字幕/actual-bilingual.v1.json`,
  `${base}/09_实录与字幕/transcription-review.v1.json`,`${base}/00_工程控制/paper-asset-intake.v1.json`,
  `${base}/02_原片/copy_3257E7D6-476D-4668-93F2-0CA1BD79F373.MOV`,
  `${CONTROL}/public-assets.v1.json`,
  ...publicFiles.flatMap(b=>[b.publicPath,b.source]).filter(n=>!n.startsWith('remotion/public/') || n.startsWith(`${PUBLIC}/`)),
];
const binding = relative => ({path:relative,sha256:hashFile(path.join(ROOT,relative))});
const request = {
  schemaVersion:'koubo-lanzhou-candidate-preview/v1',episodeId:'20260906_lanzhou_ai_services',revisionId:'20260907-lanzhou-services-candidate-preview-r1',
  permission:binding(`${CONTROL}/permission.v1.json`),entry:ENTRY,compositionId:COMPOSITION,publicDir:PUBLIC,render:RENDER,
  stillFrames:[30,68,84,153,300,313,370,710,1500,1625,2415,2540,2995,3640,3750,4200,4330,4650,4760,5350,5550,6290,6785,6980,7530,7880,8175,8370],
  knowledgeContext:contextBinding,runtimeSha256:runtime.sha256,
  bindings:[...new Set(names)].sort().map(binding),
  independentReview:{path:`${CONTROL}/independent-review.${version}.json`,sha256:null},
};
fs.writeFileSync(path.join(ROOT,CONTROL,`runtime-snapshot.${version}.json`),`${JSON.stringify(runtime,null,2)}\n`,{flag:'wx'});
fs.writeFileSync(requestFile,`${JSON.stringify(request,null,2)}\n`,{flag:'wx'});
fs.writeFileSync(path.join(ROOT,CONTROL,`review-request-intent.${version}.json`),`${JSON.stringify({requestPath:path.relative(ROOT,requestFile),
  requestIntentSha256:requestIntentSha256(request),runtimeSha256:runtime.sha256,reviewNotYetPerformed:true},null,2)}\n`,{flag:'wx'});
console.log(JSON.stringify({requestFile,bindings:request.bindings.length,runtimeSha256:runtime.sha256,readyToRender:false}));
