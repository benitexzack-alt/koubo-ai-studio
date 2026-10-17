from pathlib import Path
import json, hashlib, shutil, wave, struct, math
R=Path(__file__).resolve().parents[3]
E=R/'edit/20261017_small_business_ai_agility'
D=Path(__file__).resolve().parent
P=D/'public'
C=R/'remotion/src/small-business-ai-agility-20261017'
def write(path,data): path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def fr(t): return round(t*30)
pages=json.loads((E/'04_实录与字幕/captions.bilingual.v1.json').read_text())['pages']
layout_pages=json.loads((E/'04_实录与字幕/captions.bilingual.layout.v1.json').read_text())['pages']
highlights=['小公司','怎么干','组织灵敏性','定方向','全员大改造','系统升级','销售','运营','行政','客服','剪辑','文案','调整迭代','真实的业务问题','行业','兰州']
plan={'schemaVersion':'small-business-ai-agility-v9/v1','width':1920,'height':1080,'fps':30,'durationInFrames':4126,'assetPrefix':'','fonts':{'displaySrc':'fonts/smiley-sans.woff2','captionSrc':'fonts/STHeiti-Medium.ttc'},'host':{'src':'media/host.mp4','trimBeforeFrame':0,'trimAfterFrame':4126},'voice':{'src':'audio/voice.m4a','trimBeforeFrame':0,'trimAfterFrame':4126,'gain':1,'playbackRate':1,'reviewStatus':'pending'},'captions':[{'id':p['id'],'from':fr(p['start']),'to':fr(p['end']),'chinese':p['zh'],'english':p['en'],'highlights':[x for x in highlights if x in p['zh']]} for p in layout_pages],'events':[],'overlays':[],'mediaSlots':[{'id':'P01','kind':'paper','window':{'from':1998,'to':2238},'state':'pending','reviewStatus':'pending','asset':None,'displayTitle':'','sourceLabel':'AI生成·纸艺示意'}],'avoidanceWindows':[],'cameraWindows':[],'sfx':[],'review':dict.fromkeys(['captions','timing','visual','audio','safeAreas'],'pending')}
def event(id,t,reason):
    plan['events'].append({'id':id,'frame':fr(t),'sound':'silent','reason':reason})
    return id
# Entry times follow user SRT; intra-line word positions are candidates until playback review.
event('question-late',9.666,'S006问句开始，先出现第一问；候选时点待正常速度观看。')
event('question-how',11.866,'S007承接第二问，保留第一问，不改成前后优劣。')
event('question-how-focus',12.2,'第二问10帧移动落定；正常速度试听待确认。')
plan['overlays'].append({'id':'two-questions','kind':'comparison','from':fr(9.666),'to':fr(14.1),'items':[{'text':'还来得及吗','eventId':'question-late'},{'text':'到底该怎么干','eventId':'question-how'}],'emphasisEventId':'question-how-focus','region':{'x':64,'y':110,'width':580,'height':340}})
event('agility-word',21.8,'S013开始说组织灵敏性；采用用户SRT实际字词，不改成拍前稿。')
event('agility-focus',22.2,'关键词12帧揭示完成，动作与阅读停留分开。')
plan['overlays'].append({'id':'agility-word','kind':'hook-reveal','from':fr(21.8),'to':fr(25.0),'items':[{'text':'组织灵敏性','eventId':'agility-word'}],'emphasisEventId':'agility-focus'})
roles=[('销售',51.5),('运营',52.0),('行政',52.5),('客服',53.1),('剪辑',53.8),('文案',54.35)]
items=[]
for n,(name,t) in enumerate(roles):
    key=f'role-{n+1}'
    event(key,t,'岗位并列逐项出现；S032/033句内候选词点，非词级强制对齐。')
    event(key+'-settle',t+7/30,'本期role-grid 7帧落定事件；不把六岗位画成六步流程。')
    items.append({'text':name,'eventId':key})
plan['overlays'].append({'id':'six-parallel-roles','kind':'role-grid','from':fr(51),'to':fr(58.1),'items':items,'region':{'x':64,'y':110,'width':580,'height':340}})
event('real-work',89.133,'S054业务问题句开始，先聚焦目标，不把提效省钱增收画成兑现结果。')
event('real-work-focus',89.533,'关键词12帧揭示后读稳，随后回真人。')
plan['overlays'].append({'id':'real-work','kind':'hook-reveal','from':fr(89.133),'to':fr(93.3),'items':[{'text':'真实的业务问题','eventId':'real-work'}],'emphasisEventId':'real-work-focus'})
event('industry',119.0,'S072回应邀请，不生成假评论。')
event('industry-settle',119+7/30,'行业标签7帧落定，原话持续。')
plan['overlays'].append({'id':'industry','kind':'cta','from':fr(119),'to':fr(123.8),'items':[{'text':'行业','eventId':'industry'}]})
# Mild, perceptible pushes follow separate semantic emphasis windows.
for start,settle,end,peak in [(4.9,10.0,14.1,1.06),(20.3,22.3,25.0,1.055),(38.8,40.8,43.2,1.06),(47.267,52.5,58.1,1.055),(87.9,91.1,96.867,1.06),(107.7,113.7,118.8,1.05),(119,125.0,130.7,1.055)]:
    plan['cameraWindows'].append({'from':fr(start),'to':fr(end),'peakScale':peak,'motion':'push-hold','settleFrame':fr(settle),'releaseFrames':15,'origin':{'x':55,'y':44}})
# Each source is local and carries its own source transient; candidate gains await listening.
sound_specs=[('question-late','remotion-whoosh.wav',0,5,-19.5,'assets/sfx/koubo-sfx-v1/manifest.json'),('question-how-focus','v2-keyword-select.wav',0,10,-20,'assets/sfx/koubo-sfx-v2/manifest.json'),('agility-focus','v1-keyword-tick.wav',0,7,-20,'assets/sfx/koubo-sfx-v1/manifest.json'),('role-1-settle','v3-list-tick-a.wav',0,9,-21,'assets/sfx/koubo-sfx-v3-candidates/manifest.json'),('role-3-settle','v3-list-tick-b.wav',0,9,-21,'assets/sfx/koubo-sfx-v3-candidates/manifest.json'),('role-6-settle','v1-confirm-soft.wav',0,7,-20.5,'assets/sfx/koubo-sfx-v1/manifest.json'),('real-work-focus','v2-keyword-select.wav',0,10,-19.5,'assets/sfx/koubo-sfx-v2/manifest.json'),('industry-settle','v3-cta-confirm-a.wav',0,12,-20.5,'assets/sfx/koubo-sfx-v3-candidates/manifest.json')]
sound_notes=[]
for eid,name,a,b,target,licensepath in sound_specs:
    src=R/'remotion/public/audio/koubo-sfx-v8'/name
    with wave.open(str(src),'rb') as w:
        assert w.getsampwidth()==2
        sr=w.getframerate(); channels=w.getnchannels(); n=w.getnframes()
        vals=struct.unpack('<'+'h'*(n*channels),w.readframes(n))
    start=round(a/30*sr);stop=min(n,round(b/30*sr)); mono=[max(abs(vals[i*channels+j]) for j in range(channels)) for i in range(start,stop)]
    peak=max(mono); offset=mono.index(peak)/sr
    db=20*math.log10(peak/32768); gain=10**((target-db)/20)
    duration=b-a; transient=min(duration-1,max(0,round(offset*30)))
    targetpath=P/'sfx'/name
    if not targetpath.exists(): shutil.copy2(src,targetpath)
    ev=next(x for x in plan['events'] if x['id']==eid);ev['sound']='added'
    cue={'id':'SFX-'+eid,'eventId':eid,'src':'sfx/'+name,'trimBeforeFrame':a,'trimAfterFrame':b,'transientOffsetFrames':transient,'gain':min(1,gain),'fadeInFrames':0 if transient==0 else 1,'fadeOutFrames':2,'reviewStatus':'pending'}
    plan['sfx'].append(cue)
    sound_notes.append({**cue,'source':str(src.relative_to(R)),'sha256':sha(src),'licenseReference':licensepath,'peakSampleWithinTrim':mono.index(peak),'sourceSampleRate':sr,'sourcePeakDbfs':db,'candidatePeakDbfs':target,'roundedTransientErrorFrames':transient-offset*30,'eventFrame':ev['frame'],'humanAudition':False})
write(D/'runtime-plan.v1.json',plan); C.mkdir(exist_ok=True); write(C/'runtime-plan.snapshot.json',plan)
write(D/'声音候选与瞬态.v1.json',{'status':'prepared-not-auditioned','actualMixRendered':False,'voiceGain':1,'voiceLufs':-23.8,'voiceTruePeakDbfs':-3.9,'paperNativeAudio':'未到件，未假定静音或增益','cues':sound_notes})
# Rebind all original beats to actual SRT sequence, without editing the pre-shoot table.
groups=[(1,3),(4,7),(8,10),(11,11),(12,13),(14,20),(21,22),(23,26),(27,28),(29,29),(30,31),(32,34),(35,36),(37,37),(38,38),(39,43),(44,45),(46,49),(50,52),(53,57),(58,65),(66,67),(68,71),(72,72),(73,74),(75,77),(78,79),(80,81)]
old=json.loads((E/'03_导演规划/director-cues.v2.json').read_text());bound=[]
for b,(start,end) in zip(old['semanticBeats'],groups):
    pp=pages[start-1:end]
    bound.append({'beatId':b['id'],'mainVisual':b['primaryRoute'],'srtIds':[x['id'] for x in pp],'start':pp[0]['start'],'end':pp[-1]['end'],'frames':{'startFrame':fr(pp[0]['start']),'endFrameExclusive':fr(pp[-1]['end'])},'quote':''.join(x['zh'] for x in pp),'purpose':b['decisionReason'],'sourceFactCheckId':b['factCheckId']})
assert ''.join(x['quote'] for x in bound)==''.join(p['zh'] for p in pages)
write(D/'实录导演重绑.v1.json',{'status':'timing-candidate-from-user-srt','source':str((E/'04_实录与字幕/captions.bilingual.v1.json').relative_to(R)),'fullAudioReview':False,'beats':bound,'paperSlot':{'id':'P01','fromSeconds':66.6,'toSeconds':74.6,'reason':'8秒候选覆盖试用到调整；只跟踪同一任务，不证明全员当天采用。收到素材后按真实动作重新核定，不拉伸原声或循环冻结纸艺。','state':'awaiting-user-video'},'wordTiming':'句内六岗位时间只作候选，待画面与音频正常速度精核。'})
write(D/'captions.for-shotcraft.v1.json',{'captions':[{'id':p['id'],'startMs':p['start']*1000,'endMs':p['end']*1000,'zh':p['zh']} for p in pages]})
print(json.dumps({'frames':4126,'captions':len(plan['captions']),'overlays':len(plan['overlays']),'cameraWindows':len(plan['cameraWindows']),'sfx':len(plan['sfx']),'boundBeats':len(bound),'paperState':'pending'},ensure_ascii=False))
