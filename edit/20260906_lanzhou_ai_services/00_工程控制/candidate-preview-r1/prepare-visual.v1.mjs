import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const repo = path.resolve(import.meta.dirname, '../../../..');
const task = 'edit/20260906_lanzhou_ai_services';
const source = `${task}/09_实录与字幕/canonical-spoken.v1.json`;
const read = p => JSON.parse(fs.readFileSync(path.join(repo, p), 'utf8'));
const bind = p => ({path: p, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(repo, p))).digest('hex')});
const data = read(`${task}/04_导演拆解/candidate-preview-r1/data.v1.json`);
const canonical = read(source);
const selectionPath = `${task}/04_导演拆解/candidate-preview-r1/output-selection.derived.v2.json`;
const selection = read(selectionPath);
const outputFrame = milliseconds => Math.round(milliseconds * 30 / 1000) + (milliseconds >= 2300 ? 244 : 0);
const sourcePhrase = {
  c001: ['包容和支持'], c003: ['少花点时间'], c004: ['处理得更明白', '整理资料、整理报表'],
  c005: ['具体的麻烦'], c006: ['付出了不少的成本'], c007: ['企业AI应用和GEO'],
  c008: ['这条路我还在走'], c009: ['一个工具看着新鲜'], c010: ['到底能不能用'],
  c012: ['这些事都得说清楚'], c013: ['哪有那么多的时间'], c014: ['什么工具'],
  c015: ['把模型接到公司的资料里面'], c016: ['这些活也需要有人来做'], c019: ['一个方向'],
  c020: ['比如你做外贸', '产品资料'], c023: ['拿错版本'], c024: ['分清楚', '有效的资料', '已经作废的资料'],
  c025: ['然后再看哪些适合'], c026: ['找相关的一些内容'], c027: ['把依据也带出来', '顺着出处核对'],
  c028: ['确定后再发给客户', '价格', '交付', '售后承诺'], c029: ['资料里没有的就留给人来处理'],
  c030: ['每天遇到的问题来试'], c031: ['资料变了谁来更新'], c032: ['拿你们自己的工作'],
  c033: ['能不能自己整理一次咨询'], c034: ['核对一个结果', '比记住几个新名词实在'],
  c036: ['准确的信息'], c038: ['该从哪里联系'], c039: ['真实的信息'], c040: ['实际查', '持续看'],
  c041: ['日常生活'], c042: ['把这周客户咨询整理一下'], c044: ['查记录', '做归类', '列出待跟进事项'],
  c045: ['你拿到结果再决定'], c046: ['公司不会因为用了AI', '就把原来的业务全部推倒'],
  c047: ['原来费劲的那几步变得好做一点'], c049: ['面对面聊', '一起看业务'],
  c050: ['你熟悉你的生意'], c051: ['试出适合你的办法'], c057: ['可以来找我'],
};
const effects = selection.beats.filter(b => b.decision === 'apply').map(b => ({
  id: b.beatId, effectId: b.effectId, from: b.frames.startFrame, to: b.frames.endFrameExclusive,
  words: b.texts, region: b.region, props: b.componentProps,
  wordFrames: b.componentProps?.items?.map(i => i.atFrame) ?? [],
  rect: b.componentProps?.rect ?? {x: 12, y: 170, width: 1056, height: 150},
}));
const blockedWindows = [
  {from: 69, to: 313},
  ...data.papers.map(p => ({from: p.outputStartFrame, to: p.outputStartFrame + p.durationInFrames})),
  ...effects.map(e => ({from: e.from, to: e.to})),
];
function subtract(from, to, windows) {
  let ranges = [{from, to}];
  for (const w of windows) ranges = ranges.flatMap(r => w.to <= r.from || w.from >= r.to ? [r] :
    [{from: r.from, to: Math.min(w.from, r.to)}, {from: Math.max(w.to, r.from), to: r.to}].filter(v => v.to > v.from));
  return ranges;
}
const semantic = [];
for (const [index, caption] of canonical.captions.entries()) {
  const phrases = sourcePhrase[caption.id];
  if (!phrases) continue;
  for (const text of phrases) assert(caption.zh.includes(text), `${caption.id}:非实录文字:${text}`);
  const from = outputFrame(caption.startMs);
  const next = canonical.captions[index + 1];
  const to = caption.id === 'c001' ? 69 : next ? outputFrame(next.startMs) : 8393;
  for (const [part, range] of subtract(from, to, blockedWindows).entries()) {
    if (range.to - range.from < 15) continue;
    semantic.push({id: `${caption.id}-v8-${part}`, ...range, sourceCaptionId: caption.id,
      title: phrases[0], detail: phrases.length === 2 ? phrases[1] : '',
      items: phrases.length > 2 ? phrases.slice(1) : [], component: phrases.length > 2 ? 'questions' : 'statement',
      textProvenance: 'verbatim-excerpts-of-recording-derived-caption', reviewRequired: caption.reviewRequired});
  }
}
const official = ['c017', 'c018'].map((id, index) => {
  const c = canonical.captions.find(c => c.id === id);
  return {id, from: outputFrame(c.startMs), to: outputFrame(c.endMs), second: index === 1, sourceStartFrame: Math.round(c.startMs * .03)};
});
const sfx = [...semantic.map(s => ({id: `sfx-${s.id}`, frame: s.from + 2, visualId: s.id,
  publicPath: 'sfx/card.wav', gain: .13})), ...effects.map(e => ({id: `sfx-${e.id}`, frame: e.from + 2, visualId: e.id,
  publicPath: 'sfx/tick.wav', gain: .13}))];
for (const cue of sfx) assert(!data.papers.some(p => cue.frame >= p.outputStartFrame && cue.frame < p.outputStartFrame + p.durationInFrames));
const plan = {schemaVersion: 'lanzhou-services-isolated-visual/v1', revisionId: '20260907-lanzhou-services-candidate-preview-r1',
  status: 'candidate-preview-required', formal: false, canonical: bind(source), data: bind(`${task}/04_导演拆解/candidate-preview-r1/data.v1.json`),
  shotcraftSelection: bind(selectionPath), canvas: {width:1920,height:1080,fps:30,durationInFrames:8393},
  semantic, effects, official, sfx,
  chapters: [
    {sourceFrame:0,title:'包容和支持'},{sourceFrame:69,title:'在兰州把企业AI应用落地这件事做下去'},
    {sourceFrame:Math.round(84.07*30),title:'这种服务到底是怎么样的'},
    {sourceFrame:Math.round(158.44*30),title:'客户通过AI了解你的公司'},
    {sourceFrame:Math.round(194.92*30),title:'把这周客户咨询整理一下'},
    {sourceFrame:Math.round(248.64*30),title:'学习和改进'},
  ],
  audio: {hostProxyGain:1, newsGain:.62, paperGain:.1, attachedSfxGain:.13, microphoneSource:'R01',
    newsHostOverlap:false, presenterInsetMuted:true, duplicateNewsCropMuted:true, noSourceAudioRemoval:true},
  caveats: ['全部内容仅供有声低清观看；字幕仍有13项实录疑点', '源片已接受瑕疵不是语义全通过', '未通过正式V2生产授权，不得登记正式release'],
};
const out = path.join(repo, 'remotion/src/lanzhou-services-v91-candidate-r1/visual-plan.v1.json');
fs.writeFileSync(out, `${JSON.stringify(plan, null, 2)}\n`, {flag:'wx'});
console.log(JSON.stringify({out, semantic:semantic.length,effects:effects.length,sfx:sfx.length}));
