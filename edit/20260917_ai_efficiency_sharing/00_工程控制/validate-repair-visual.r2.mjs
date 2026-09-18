import assert from 'node:assert/strict';
export function validateRepairVisual(runtime, original, selection){
  const fail=message=>{throw Object.assign(new Error(message),{code:'EAR_VISUAL'});};
  assert.deepEqual(runtime.insertions,original.insertions,'素材与入出点必须保持');
  assert.deepEqual(runtime.sfxCues,original.sfxCues,'原音效安排必须保持');
  for(const key of ['sourceVideo','captionsSrc','durationInFrames','fps','width','height'])assert.equal(runtime[key],original[key]);
  const kinds=new Set(runtime.layers?.map(x=>x.params.component));
  if(!['statement','comparison','process','node-map'].every(x=>kinds.has(x)))fail('返修未恢复完整语义组件族');
  if(runtime.motion.peakScales.some(x=>x-runtime.motion.baseScale<0.045)||runtime.motion.peakX.every(x=>x===0))fail('返修运镜退回不可感知参数');
  let previousEnd=0;
  for(const layer of runtime.layers){
    const start=Math.round(layer.start*30),end=Math.round(layer.end*30);
    if(start<previousEnd||end<=start||end>4669)fail('语义层交叠或越界');
    previousEnd=end;
    if(runtime.insertions.some(x=>start<x.endFrameExclusive&&end>x.startFrame))fail('语义层不得进入已确认的生成镜头');
    if(layer.items.length!==layer.params.itemFrames.length||layer.params.itemFrames.some(x=>x<0||x>=end-start))fail('节点没有绑定实际帧窗');
  }
  const selected=selection.beats.filter(x=>x.decision==='apply');
  if(selected.length!==2)fail('本次两处实际选卡必须逐项接入');
  for(const item of selected){
    const layer=runtime.layers.find(x=>x.id===(item.beatId==='B02'?'L01':item.beatId==='B11'?'L06':''));
    const marker=layer?.params.marker;
    if(!marker||marker.keyword!==item.componentProps.keyword||marker.startFrame+Math.round(layer.start*30)!==item.frames.startFrame||marker.durationInFrames!==item.frames.endFrameExclusive-item.frames.startFrame)fail('选卡与实际组件消费不一致');
  }
  return {ok:true,semanticLayers:runtime.layers.length,componentFamilies:[...kinds],shotcraftApplied:selected.length,staticChecksOnly:true};
}
