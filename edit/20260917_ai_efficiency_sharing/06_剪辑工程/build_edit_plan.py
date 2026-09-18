from pathlib import Path
import json,hashlib,math
root=Path.cwd(); base=Path('edit/20260917_ai_efficiency_sharing'); dest=base/'06_剪辑工程'
def read(p):return json.loads(Path(p).read_text())
def bind(p):return {'path':str(p),'sha256':hashlib.sha256(Path(p).read_bytes()).hexdigest()}
def write(p,j):Path(p).write_text(json.dumps(j,ensure_ascii=False,indent=2)+'\n')
cues=read(base/'03_导演拆解/director-cues.v2.json'); actual=read(base/'05_实录与字幕/employee-ai-efficiency.actual.cleaned.v1.json')['words']
windows=[(0,1),(2,3),(4,5),(6,9),(10,10),(10,11),(12,13),(14,16),(17,19),(20,21),(22,24),(25,28),(29,31),(32,34),(35,36),(37,38),(39,42),(43,47),(48,49),(50,52),(53,53),(54,57),(58,61),(62,65),(66,68),(69,76),(77,78),(79,81),(82,85),(86,87)]
beats=[]
for c,(a,z) in zip(cues['semanticBeats'],windows):
 st,en=actual[a]['start'],actual[z]['end'];q=''.join(x['text'] for x in actual[a:z+1])
 if c['id']=='B05':en=21.1;q='可背地里'
 if c['id']=='B06':st=21.1;q=q.removeprefix('可背地里')
 beats.append({'id':c['id'],'scriptQuoteComparisonOnly':c['scriptQuote'],'quote':q,'start':st,'end':en,'startFrame':round(st*30),'endFrameExclusive':round(en*30),'sourceSegments':[a,z],'route':c['primaryRoute'],'cueId':c['routeCueId'],'reason':c['decisionReason']})
probes=read(base/'07_预览与质检/素材核验/media-probes.v1.json');bykey={p['key']:p for p in probes}
# 每段只播一次，实际声音始终连续。只截取原有动态，不循环、不定格、不慢放。
mapping=[('G01','B04','03_1',449,603,0.0333333333),('G02','B07','03_2',748,823,2.6333333333),('P01','B14','04_4',1815,1970,0),('P02','B23','04_2',3218,3369,0.1333333333),('P03','B24','04_1',3417,3572,0),('P04','B26','04_3',3794,3949,0)]
media=[]
for cid,bid,key,start,end,trim in mapping:
 p=bykey[key];dur=float(p['probe']['format']['duration']);vs=next(x for x in p['probe']['streams'] if x['codec_type']=='video')
 assert trim+(end-start)/30<=dur+1/30
 media.append({'id':cid,'beatId':bid,'route':'ai-generated-video' if cid[0]=='G' else 'paper-editorial','original':{'path':p['path'],'sha256':p['sha256']},'src':f'media/{cid}.mp4','startFrame':start,'endFrameExclusive':end,'sourceStartSeconds':trim,'sourceDurationSeconds':dur,'playbackRate':1,'muted':True,'loop':False,'freeze':False,'fullDecodePassed':p['fullDecodeExit']==0,'visualReview':'首中尾抽帧核对对应动作及文字；不等于全程动态人工验收','width':vs['width'],'height':vs['height'],'label':'AI情景演绎' if cid[0]=='G' else 'AI纸艺示意'})
policy=read(base/'05_实录与字幕/employee-ai-efficiency.spoken-source-policy.v1.json')
plan={'schemaVersion':'employee-ai-efficiency-edit-plan/v1','status':'prepared-awaiting-render-gate' if policy['compliance']['status']=='passed' else 'prepared-awaiting-audio-and-render-gate','videoId':'AI_EFFICIENCY_SHARING_20260917','source':bind(bykey['01_1']['path']),'sourceDurationSeconds':155.633333,'durationInFrames':4669,'fps':30,'width':1920,'height':1080,'sourcePolicy':'完整原声；不删改、不变速、不重排','captions':bind(base/'05_实录与字幕/employee-ai-efficiency.actual.bilingual.v1.json'),'preshootDirector':bind(base/'03_导演拆解/director-cues.v2.json'),'beats':beats,'insertions':media,'protectedRegions':{'face':{'x':630,'y':70,'width':780,'height':730},'hands':{'x':0,'y':520,'width':1920,'height':390},'subtitles':{'x':0,'y':900,'width':1920,'height':180}},'overlayRegion':{'x':80,'y':150,'width':470,'height':230},'previewRanges':[{'start':4.2,'end':20.2,'purpose':'钩子、真人、AI情景'},{'start':46,'end':49.4,'purpose':'机制判断'},{'start':81.2,'end':85.5,'purpose':'分配主问题'},{'start':107.2,'end':119.4,'purpose':'工时余量、反哺团队纸艺'},{'start':126.467,'end':131.634,'purpose':'共同流程纸艺终态'}],'userPreviewApproved':False,'fullWatchConfirmed':False,'factsVerified':False,'formalEnabled':False}
write(dest/'postshoot-edit-plan.v1.json',plan)
intents={'B02':(['emphasis'],['装不会']),'B11':(['emphasis'],['机制']),'B13':(['question','list'],['加薪','减负']),'B18':(['question','emphasis'],['怎么分配']),'B21':(['list'],['三个建议']),'B28':(['conclusion','transformation'],['共赢的生产力'])}
req={'schemaVersion':'koubo-shotcraft-auto-match-request/v1','taskId':cues['taskId'],'revisionId':'ai-efficiency-sharing-edit-release-r1','directorProfile':{'profileId':'paper-editorial-director-v9','profileVersion':'9.1.0'},'subtitleAuthority':'actual-recording','canvas':{'width':1920,'height':1080,'fps':30,'durationInFrames':4669},'captions':plan['captions'],'beats':[]}
for k,p in {'registry':'registry.v1.json','library':'upstream/gallery/api/library.json','capabilityIndex':'card-capability-index.v2.json','experienceLedger':'experience/shotcraft-acceptance-ledger.v1.json','componentModule':'assets/ShotcraftEffects.tsx'}.items():req[k]=bind(Path('skills/koubo-shotcraft-library')/p)
for b in beats:
 if b['route']!='speaker':continue
 intent,phrases=intents.get(b['id'],([],[]))
 req['beats'].append({'beatId':b['id'],'mainVisual':'speaker','frames':{'startFrame':b['startFrame'],'endFrameExclusive':b['endFrameExclusive']},'quote':b['quote'],'purpose':b['reason'],'semanticIntents':intent,'keyPhrases':phrases,'materialClass':'talking-head','energy':'low','existingVisualSufficiency':'medium' if intent else 'high','region':plan['overlayRegion'],'protectedRegions':list(plan['protectedRegions'].values())})
write(dest/'shotcraft-auto-match-request.v1.json',req)
print('实录30段、6镜映射、24真人段请求已建立；预览计划',round(sum(x['end']-x['start'] for x in plan['previewRanges']),3),'秒')
