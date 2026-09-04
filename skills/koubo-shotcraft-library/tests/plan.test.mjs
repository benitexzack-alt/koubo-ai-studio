import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import {validatePlan,validateFiles} from '../scripts/validate-plan.mjs';
const captions = [{startMs:0,endMs:40000,zh:'真实照片和口述故事，整理成故事脚本。'}];
const fixture = () => ({schemaVersion:'shotcraft-candidate/v1',status:'candidate-preview-required',formalEnabled:false,productionEligible:false,subtitleAuthority:'actual-recording',width:1920,height:1080,fps:30,durationInFrames:1200,sourceStartFrame:0,effects:[{id:'e1',effectId:'marker-underline',mainVisual:'speaker',from:0,duration:90,region:{x:60,y:140,width:620,height:250},protectedRegions:[{x:800,y:0,width:900,height:850},{x:0,y:900,width:1920,height:180}],purpose:'强调实录关键词',quote:'真实照片和口述故事',texts:['真实照片']}]});
test('合法样片计划',()=>assert.deepEqual(validatePlan(fixture(),captions),[]));
for (const [name,modify,code] of [
  ['未知效果',p=>p.effects[0].effectId='remote-effect','UNKNOWN_EFFECT'],
  ['不能用于纸艺',p=>p.effects[0].mainVisual='paper-editorial','MAIN_VISUAL_FORBIDDEN'],
  ['不能用于生成视频',p=>p.effects[0].mainVisual='generated-video','MAIN_VISUAL_FORBIDDEN'],
  ['不能越权正式',p=>p.formalEnabled=true,'CANDIDATE_ONLY'],
  ['不能借旧稿',p=>p.subtitleAuthority='script','SPOKEN_SOURCE_REQUIRED'],
  ['不能捏造文字',p=>p.effects[0].texts=['已获收入'],'TEXT_NOT_SPOKEN'],
  ['不能脱离时间',p=>p.effects[0].quote='已经结婚','QUOTE_NOT_IN_WINDOW'],
  ['纯标点不算引文',p=>p.effects[0].quote='。','QUOTE_NOT_IN_WINDOW'],
  ['不能遮脸',p=>p.effects[0].region.x=700,'OCCLUSION'],
  ['不能越界',p=>p.effects[0].region.width=2000,'REGION_INVALID'],
  ['不能循环',p=>p.effects[0].loop=true,'MEDIA_MANIPULATION_FORBIDDEN'],
  ['不能冻帧',p=>p.effects[0].freezeToFill=true,'MEDIA_MANIPULATION_FORBIDDEN'],
  ['必须避让',p=>p.effects[0].protectedRegions=[],'PROTECTED_REGIONS_REQUIRED'],
  ['必须声明证据',p=>{p.effects[0].effectId='evidence-scan';p.effects[0].mainVisual='real-evidence';},'EVIDENCE_REQUIRED'],
]) test(name,()=>{const p=fixture();modify(p);assert.ok(validatePlan(p,captions).some(e=>e.startsWith(code)));});
test('倒序字幕不能参与匹配',()=>assert.deepEqual(validatePlan(fixture(),[{startMs:2000,endMs:1000,zh:captions[0].zh}]),['CAPTIONS_INVALID']));
test('素材必须为自有绑定，原型属性不算证据',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'shotcraft-test-'));
  try {
    const bind=(name,data)=>{fs.writeFileSync(path.join(dir,name),data);return {path:name,sha256:crypto.createHash('sha256').update(data).digest('hex')};};
    const p=fixture();p.source=bind('source.txt','test-source');p.captions=bind('captions.json',JSON.stringify(captions));p.assets={};
    Object.assign(p.effects[0],{effectId:'evidence-scan',mainVisual:'real-evidence',evidence:{assetId:'toString',rect:{x:10,y:10,width:100,height:100}}});
    assert.ok(validateFiles(p,dir).some(e=>e.startsWith('UNKNOWN_EVIDENCE')));
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
test('上游快照哈希与数量',()=>{
  const root=path.resolve(import.meta.dirname,'..');
  const lock=JSON.parse(fs.readFileSync(path.join(root,'upstream-lock.v1.json')));
  for(const e of lock.entries) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,e.path))).digest('hex'),e.sha256);
  const catalog=JSON.parse(fs.readFileSync(path.join(root,'upstream/gallery/api/library.json')));
  assert.equal(catalog.cards.length,157);
  const registry=JSON.parse(fs.readFileSync(path.join(root,'registry.v1.json')));
  assert.equal(registry.defaultEnabled,false);
  for(const effect of registry.effects) assert.ok(catalog.cards.some(c=>c.name===effect.upstream));
});
