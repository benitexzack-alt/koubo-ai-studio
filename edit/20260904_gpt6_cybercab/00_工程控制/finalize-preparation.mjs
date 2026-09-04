import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const parentPath = path.join(root,'00_工程控制/preparation-receipt.v1.json');
const parent = JSON.parse(fs.readFileSync(parentPath));
const out = path.join(root,'00_工程控制/current-status.v1.json');
assert.equal(fs.existsSync(out),false,'不能覆盖当前状态');
assert.equal(parent.productionEligible,false);
assert.equal(parent.formalEnabled,false);
assert.equal(parent.directorSkillExecuted,false);
assert.equal(parent.sourceFilesUnchanged,true);
assert.equal(parent.assets.length,4);
for (const a of parent.assets) {
  assert.equal(hash(a.absolutePath),a.sha256,`${a.id}: 哈希`);
  assert.equal(a.fullDecodeExitCode,0,`${a.id}: 解码`);
}
for (const item of parent.bindings) assert.equal(hash(path.join(root,item.file)),item.sha256,item.file);
assert.equal(fs.realpathSync(parent.desktopPath),root);
const documents = ['先看这里.md','03_事实与来源核验/事实核验与待裁决.md','03_事实与来源核验/U01官方来源补充.md',
  '04_导演拆解/全片结构与纸艺审阅草案.md'];
const current = {schemaVersion:'koubo-preparation-status/v1', taskId:parent.taskId, updatedAt:new Date().toISOString(),
  parentReceipt:{path:parentPath,sha256:hash(parentPath)}, state:parent.status,
  completed:['两份用户素材副本及原文件哈希一致','两份Tesla官方短片已下载','四份视频完整解码通过','原口播及参考片本机ASR','全片结构与6段纸艺审阅草案'],
  sourceUpdate:{assetId:'U01',originalUrl:'https://www.youtube.com/watch?v=1QNsdr-Qx_I',
    status:'official-origin-matched-by-content-sequence-and-duration',frameExactMatchVerified:false,
    embeddedTranslationRightsVerified:false,receipt:'03_事实与来源核验/U01官方来源补充.md'},
  paperSceneCountProposed:6,requiredAdditionalIllustrationVideosProposed:0,
  directorSkillExecuted:false,firstFramePromptsReady:false,imageToVideoPromptsReady:false,formalEnabled:false,published:false,
  awaitingUserDecision:'是否只对已定位的绝对化事实/效果承诺做最小剪除或补录方案，其余实录保持原顺序',
  remaining:parent.blockers.filter(b=>!b.startsWith('U01官方原始出处')).concat('U01逐帧与内嵌翻译/原声采用边界仍需审阅'),
  documents:documents.map(file=>({file,sha256:hash(path.join(root,file))})),
  evidenceFiles:['R01-contact.jpg','U01-contact.jpg','T01-contact.jpg','T02-contact.jpg'].map(file=>({file:`08_预览与质检/${file}`,sha256:hash(path.join(root,'08_预览与质检',file))})),
};
fs.writeFileSync(out,JSON.stringify(current,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({checks:'通过',path:out,sha256:hash(out),state:current.state},null,2));
