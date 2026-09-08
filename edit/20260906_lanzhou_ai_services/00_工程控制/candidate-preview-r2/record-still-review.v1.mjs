import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'../../../..');
const out=path.join(root,'edit/20260906_lanzhou_ai_services/07_预览与质检/candidate-preview-r2');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const stills=read(path.join(out,'stills/receipt.json'));
assert.equal(stills.outputs.length,62);
const coverage=read(path.join(import.meta.dirname,'still-coverage.v1.json'));
const individual=[58,2498,2610];
const receipt={schemaVersion:'lanzhou-r2-parent-still-review/v1',reviewedAt:new Date().toISOString(),
  reviewer:'parent-assistant-actual-image-inspection',scope:'62帧经8页联系表逐张检查，58/2498/2610另以960x540单图检查；未声称全帧动态或人耳审查。',
  requestIntentSha256:stills.requestIntentSha256,
  contactSheets:Array.from({length:8},(_,i)=>path.join(out,`contact-${String(i+1).padStart(2,'0')}.jpg`)).map(p=>({path:p,sha256:hash(p)})),
  frames:stills.outputs.map(s=>({...s,inspection:individual.includes(s.frame)?'contact-and-individual':'contact-sheet'})),
  coverage:coverage.coverage.map(c=>({...c,reviewed:true})),
  observations:['文件标题与原文摘录放大可读；官方原文未加口播中的“的”，底部口播标签另作区分。',
    '2498帧扫描线处于标题行间，未遮字；2610帧强调框围住扎根用户现场，未挡真人小窗。',
    '36项V8及15项动效全部抽到中后段状态，没有看到溢出、挡脸或字幕容器裁字。',
    '标题暖黄色，辅助文字白色及青色；长标题保持原话，自动换行。'],
  remainingP2:[{id:'MARKER_PUNCTUATION_WRAP',description:'个别长马克笔句出现独立标点行或短尾行（如6360帧）；文字完整、无重叠，但排版仍可改进。'}],
  sourcePaperExceptions:'源片既有瑕疵仍按本条用户决定保留，不计为通过。',unresolvedAsrItems:13,
  actionDecision:'allow-full-length-local-low-resolution-candidate-render',
  parentStillReviewComplete:true,allPlannedStillFramesReviewed:true,fullDynamicReviewPerformed:false,humanListeningPerformed:false,
  userPreviewApproved:false,formalEnabled:false,publishAuthorized:false};
fs.writeFileSync(path.join(out,'keyframe-visual-review.v1.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({reviewed:62,blockingVisualFindings:0,remainingP2:receipt.remainingP2,formalEnabled:false}));
