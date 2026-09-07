import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve(import.meta.dirname, '../../../..');
const base = 'edit/20260906_lanzhou_ai_services/07_预览与质检/candidate-preview-r1';
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const receipt = JSON.parse(fs.readFileSync(path.join(root,base,'stills/receipt.json')));
const details = [30,153,2415,2540,4330,4760];
const review = {
  schemaVersion: 'lanzhou-candidate-still-visual-review/v1',
  reviewedAt: new Date().toISOString(),
  reviewer: 'parent-assistant-actual-image-inspection',
  scope: '28张联系表全览；六张另以960x540单图检查。未冒称逐帧动态检查或人耳试听。',
  contact: {path:`${base}/keyframes-contact.jpg`,sha256:sha(`${base}/keyframes-contact.jpg`)},
  images: receipt.outputs.map(o=>({...o,inspection:details.includes(o.frame)?'contact-and-individual-image':'contact-sheet'})),
  observations: [
    '新闻竖屏原画面完整保留，同步标题局部放大完整可读，来源署名明确，未包装成工信部发言人。',
    '真人语义文字位于左侧，抽查没有覆盖脸部。官方证据段的圆形真人窗口收在右侧安全区内。',
    '五段纸艺保持原生画面；抽查中的核心节点没有被新增字幕覆盖。原片变形、遮挡和因果缺陷依旧按本条例外保留。',
    '官方长段落在低清中字号偏小，重点标签和文件标题可读，不声称低清手机尺寸下每个原文小字均清楚。',
    '抽查双语字幕处于底部安全区域，未见容器截字。13项实录识别疑点仍待核对。'
  ],
  addedCompositionP0Found: 0,
  addedCompositionP1Found: 0,
  acceptedSourceDefectsAreNotPassed: true,
  renderNext: 'authorized-low-resolution-candidate-only',
  fullDynamicReviewPerformed: false,
  humanListeningPerformed: false,
  userPreviewApproved: false,
  formalEnabled: false
};
const out=path.join(root,base,'keyframe-visual-review.v1.json');
fs.writeFileSync(out,JSON.stringify(review,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({path:out,sha256:sha(`${base}/keyframe-visual-review.v1.json`),images:review.images.length}));
