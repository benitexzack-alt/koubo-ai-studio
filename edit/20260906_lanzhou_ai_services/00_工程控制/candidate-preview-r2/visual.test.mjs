import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve(import.meta.dirname, '../../../..');
const base = 'edit/20260906_lanzhou_ai_services';
const read = p => JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const data = read(`${base}/04_导演拆解/candidate-preview-r1/data.v1.json`);
const plan = read('remotion/src/lanzhou-services-v91-candidate-r2/visual-plan.v1.json');
const oldPlan = read('remotion/src/lanzhou-services-v91-candidate-r1/visual-plan.v1.json');
const canonical = read(`${base}/09_实录与字幕/canonical-spoken.v1.json`);
const selection = read(plan.shotcraftSelection.path);
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
test('只生成本条960低清候选，未获得formal',()=>{
  assert.equal(plan.formal,false); assert.equal(data.formalAllowed,false);
  assert.deepEqual(plan.canvas,{width:1920,height:1080,fps:30,durationInFrames:8393});
});
test('完整口播加新闻，8393帧的时间映射没有丢字',()=>{
  assert.equal(data.captions.length,canonical.captions.length);
  for (const [index,c] of data.captions.entries()) {
    const raw=canonical.captions[index];
    assert.equal(c.zh,raw.zh);
    assert(Math.abs(c.startMs-raw.startMs-(raw.startMs>=2300?244/30*1000:0))<.001);
    assert(Math.abs(c.endMs-raw.endMs-(raw.startMs>=2300?244/30*1000:0))<.001);
    assert.deepEqual(c.uncertainIds,raw.uncertainIds);
  }
  assert.equal(8149+244,8393);
});
test('五段均完整播放、未拉伸、没有末帧补长',()=>{
  assert.deepEqual(data.papers.map(p=>p.id),['P01','P02','P03','P04','P05']);
  for(const p of data.papers){
    assert.equal(p.sourceInFrame,0); assert.equal(p.playbackRate,1);
    assert.equal(p.loop,false); assert.equal(p.freezeExtensionFrames,0);
    assert.equal(p.durationInFrames,Math.ceil(p.sourceVideoFrameCount/p.sourceVideoFps.numerator*30));
    assert.equal(p.outputStartFrame-p.sourceStartFrame,244);
    assert.equal(p.firstReadableFrame,0);assert.equal(p.perWordLabelEntryClaimed,false);
  }
});
test('V8文字只摘取实录，未使用预拍稿恢复',()=>{
  for(const s of plan.semantic){
    const c=canonical.captions.find(c=>c.id===s.sourceCaptionId);
    assert(c); for(const text of [s.title,s.detail,...s.items].filter(Boolean))assert(c.zh.includes(text),text);
  }
});
test('纸艺段无语义卡、Shotcraft和新增卡点声',()=>{
  for(const p of data.papers){
    const end=p.outputStartFrame+p.durationInFrames;
    for(const s of [...plan.semantic,...plan.effects]) assert(s.to<=p.outputStartFrame || s.from>=end,s.id);
    for(const s of plan.sfx)assert(s.frame<p.outputStartFrame || s.frame>=end,s.id);
  }
});
test('15项选择衍生记录全部消费，不伪称重新自动匹配',()=>{
  const chosen=selection.beats.filter(b=>b.decision==='apply');assert.equal(plan.effects.length,chosen.length);
  for(const e of plan.effects){const b=chosen.find(b=>b.beatId===e.id);assert(b);
    assert.equal(e.from,b.frames.startFrame);assert.equal(e.to,b.frames.endFrameExclusive);
    assert.deepEqual(e.props,b.componentProps);assert.deepEqual(e.words,b.texts);
  }
});
test('完整原始Shotcraft组件按字节复用',()=>{
  assert.equal(sha('skills/koubo-shotcraft-library/assets/ShotcraftEffects.tsx'),sha('remotion/src/lanzhou-services-v91-candidate-r2/ShotcraftEffects.generated.tsx'));
});
test('R2不修改实录语义摘句、原片时点、纸艺或R1文件',()=>{
  assert.deepEqual(plan.semantic,oldPlan.semantic);
  assert.deepEqual(plan.official,oldPlan.official);
  assert.deepEqual(plan.data,oldPlan.data);
  assert.deepEqual(plan.canonical,oldPlan.canonical);
  assert.equal(plan.parentRevision.sha256,sha(plan.parentRevision.path));
});
test('重点和辅助字号确实增大且分级，真人区域边界固定',()=>{
  assert.equal(plan.typography.title,76);assert.equal(plan.typography.detail,40);
  assert.equal(plan.typography.markerKeyword,88);assert.equal(plan.typography.keyword,70);
  assert.equal(plan.typography.openingTitle,112);
  assert(plan.typography.hostRegion.x+plan.typography.hostRegion.width<=800);
  assert(plan.typography.hostRegion.y+plan.typography.hostRegion.height<930);
  assert.notEqual(plan.typography.emphasis,plan.typography.supporting);
});
test('新增音效完整落在对应可见层，不越入新闻或纸艺',()=>{
  const blocked=[{from:69,to:313},...data.papers.map(p=>({from:p.outputStartFrame,to:p.outputStartFrame+p.durationInFrames}))];
  const ids=new Set();
  for(const c of plan.sfx){
    assert(!ids.has(c.id));ids.add(c.id);
    assert(c.gain>0&&c.gain<=1);assert(Number.isInteger(c.durationInFrames)&&c.durationInFrames>0);
    assert(c.frame>=0&&c.frame+c.durationInFrames<=8393);
    assert([...plan.semantic,...plan.effects].some(s=>s.id===c.visualId));
    for(const w of blocked)assert(c.frame+c.durationInFrames<=w.from||c.frame>=w.to,c.id);
  }
  assert(new Set(plan.sfx.map(c=>c.publicPath)).size>2);
  assert.equal(plan.audio.audibilityConfirmedByUser,false);
});
test('画面主层半开区间不重叠，音效每卡反向绑定',()=>{
  const rows=[...plan.semantic,...plan.effects].sort((a,b)=>a.from-b.from);
  for(let i=1;i<rows.length;i++)assert(rows[i-1].to<=rows[i].from,`${rows[i-1].id}/${rows[i].id}`);
  const audio=read(plan.sfxPlan.path);
  for(const row of rows)assert(plan.sfx.some(c=>c.visualId===row.id)||audio.noCue.some(c=>c.visualId===row.id&&c.reason),row.id);
});
test('真人小窗在平台头像和字幕之外，只有声音主轨发声',()=>{
  const safe=read('skills/koubo-remotion-director/references/platform-safe-areas.v1.json').profiles[0];
  const r=safe.presenter.slots.default.expectedRect;
  assert(r.x+r.width<=1600);assert(r.y+r.height+32<=930);
  assert.equal(plan.audio.presenterInsetMuted,true);assert.equal(plan.audio.duplicateNewsCropMuted,true);
  assert.equal(plan.audio.hostProxyGain,1);assert(plan.audio.paperGain>0);assert(plan.audio.newsGain>0);
});
