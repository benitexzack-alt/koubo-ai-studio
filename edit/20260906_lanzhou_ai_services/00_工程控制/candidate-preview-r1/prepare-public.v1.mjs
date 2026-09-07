import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const root = path.resolve(import.meta.dirname, '../../../..');
const base = 'edit/20260906_lanzhou_ai_services';
const publicDir = 'remotion/public/lanzhou-services-candidate-r1';
const out = `${base}/00_工程控制/candidate-preview-r1/public-assets.v1.json`;
assert(!fs.existsSync(path.join(root, publicDir)), 'publicDir已存在，不覆盖');
assert(!fs.existsSync(path.join(root, out)), '回执已存在，不覆盖');
const mapping = [
  ['R01.mp4', `${base}/07_预览与质检/host-intake-r1/R01_960x540_响度处理代理.mp4`],
  ['U01.mp4', `${base}/06_补充实拍素材/开头引用_v1/stodownload.MP4`],
  ['P01.mp4', `${base}/05_纸艺视频/视频_5.mp4`], ['P02.mp4', `${base}/05_纸艺视频/视频_2.mp4`],
  ['P03.mp4', `${base}/05_纸艺视频/视频.mp4`], ['P04.mp4', `${base}/05_纸艺视频/视频_4.mp4`],
  ['P05.mp4', `${base}/05_纸艺视频/视频_3.mp4`],
  ['O01-title.png', `${base}/03_官方素材/O01_通知标题与日期.png`],
  ['O01-onsite.png', `${base}/03_官方素材/O01_扎根用户现场_原文段落.png`],
  ['captions.json', `${base}/04_导演拆解/candidate-preview-r1/captions.json`],
  ['fonts/STHeiti-Medium.ttc', 'remotion/public/fonts/STHeiti-Medium.ttc'],
  ['sfx/card.wav', 'remotion/public/audio/koubo-sfx-v8/v3-soft-card-pop-a.wav'],
  ['sfx/tick.wav', 'remotion/public/audio/koubo-sfx-v8/v3-list-tick-a.wav'],
];
for (const [, source] of mapping) {
  const abs = path.join(root,source);
  assert(fs.lstatSync(abs).isFile() && !fs.lstatSync(abs).isSymbolicLink(), `源必须是普通文件:${source}`);
}
const bindings = [];
for (const [name, source] of mapping) {
  const from = path.join(root, source), to = path.join(root, publicDir, name);
  fs.mkdirSync(path.dirname(to), {recursive:true});
  fs.linkSync(from, to);
  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(to)).digest('hex');
  assert.equal(fs.statSync(from).ino, fs.statSync(to).ino);
  bindings.push({source, publicPath: `${publicDir}/${name}`, sha256, bytes:fs.statSync(to).size, method:'same-file-hardlink-not-symlink'});
}
fs.writeFileSync(path.join(root,out), `${JSON.stringify({schemaVersion:'lanzhou-candidate-public-assets/v1',
  publicDir, localOnly:true, originalsModified:false, bindings},null,2)}\n`,{flag:'wx'});
console.log(JSON.stringify({publicDir, bindings:bindings.length, receipt:out}));
