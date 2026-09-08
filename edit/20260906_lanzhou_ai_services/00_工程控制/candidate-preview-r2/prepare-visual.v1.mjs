import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const root = path.resolve(import.meta.dirname, '../../../..');
const task = 'edit/20260906_lanzhou_ai_services';
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const bind = p => ({path: p, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, p))).digest('hex')});
const r1Path = 'remotion/src/lanzhou-services-v91-candidate-r1/visual-plan.v1.json';
const selectionPath = `${task}/04_导演拆解/candidate-preview-r2/output-selection.derived.v2.json`;
const sfxPath = `${task}/00_工程控制/candidate-preview-r2/sfx-plan.v1.json`;
const r1 = read(r1Path);
const selection = read(selectionPath);
const sfx = read(sfxPath);
const plan = structuredClone(r1);
plan.revisionId = '20260907-lanzhou-services-candidate-preview-r2';
plan.parentRevision = bind(r1Path);
plan.shotcraftSelection = bind(selectionPath);
plan.effects = selection.beats.filter(b => b.decision === 'apply').map(b => ({
  id: b.beatId, effectId: b.effectId, from: b.frames.startFrame, to: b.frames.endFrameExclusive,
  words: b.texts, region: b.region, props: b.componentProps,
  wordFrames: b.componentProps?.items?.map(i => i.atFrame) ?? [],
  rect: b.componentProps?.rect ?? {x: 12, y: 170, width: 1056, height: 150},
}));
plan.sfxPlan = bind(sfxPath);
plan.sfx = sfx.cues;
assert(Array.isArray(plan.sfx) && plan.sfx.length > 0);
plan.audio.attachedSfxGain = 'per-cue-measured';
plan.audio.audibilityConfirmedByUser = false;
plan.typography = {openingTitle:112, title:76, detail:40, item:46, marker:64, markerKeyword:88, keyword:70,
  hostRegion:{x:64,y:164,width:704,height:650}, emphasis:'#FFD068', supporting:'#FFFFFF', secondary:'#78DEED'};
plan.revisionScope = ['official-document-readable-excerpts', 'upper-left-text-hierarchy', 'attached-sfx-only'];
plan.unchanged = ['host-and-news-timeline', 'five-paper-sources-and-native-audio', 'actual-recorded-subtitles', 'source-audio-gains'];
plan.qaKeyframes = {
  openingWords:[{id:'opening-tolerance',text:'包容',frame:38},{id:'opening-support',text:'支持',frame:58}],
  officialReveals:[{id:'official-context',text:'原文摘录与来源',frame:2365},
    {id:'official-action',text:'关于开展',frame:2426},{id:'official-services',text:'人工智能应用服务商',frame:2436},
    {id:'official-cultivation',text:'培育专项行动的通知',frame:2498},{id:'official-team',text:'鼓励服务商搭建',frame:2518},
    {id:'official-fde',text:'前线部署工程师（FDE）团队',frame:2536},{id:'official-onsite',text:'扎根用户现场',frame:2566},
    {id:'official-delivery',text:'保障场景落地',frame:2587},{id:'official-final',text:'完整官方引文',frame:2610}],
};
const out = path.join(root, 'remotion/src/lanzhou-services-v91-candidate-r2/visual-plan.v1.json');
const text = `${JSON.stringify(plan,null,2)}\n`;
if (fs.existsSync(out)) assert.equal(fs.readFileSync(out,'utf8'), text, '已存在不同计划，请先审计差异而非覆盖');
else fs.writeFileSync(out,text,{flag:'wx'});
console.log(JSON.stringify({out,semantic:plan.semantic.length,effects:plan.effects.length,sfx:plan.sfx.length}));
