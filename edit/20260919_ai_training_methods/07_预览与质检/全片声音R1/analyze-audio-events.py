"""只读音频取样分析：不修改混音，不声称人工试听。"""
from pathlib import Path
import hashlib,json,subprocess,wave
import numpy as np

ROOT=Path('/Users/pc/Documents/口播')
OUT=ROOT/'edit/20260919_ai_training_methods/07_预览与质检/全片声音R1/audio-event-qa.json'
PLAN=ROOT/'remotion/src/ai-training-final-r1/runtime-plan.r1.json'
PUB=ROOT/'remotion/public-ai-training-final-r1'
def sha(p):
    h=hashlib.sha256()
    with p.open('rb') as f:
        for b in iter(lambda:f.read(4*1024*1024),b''):h.update(b)
    return h.hexdigest()
def audio(p):
    raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(p),'-f','f32le','-acodec','pcm_f32le','-ar','48000','-ac','2','-'])
    return np.frombuffer(raw,dtype='<f4').reshape(-1,2).copy()
def db(x):return round(float(20*np.log10(max(float(x),1e-12))),4)
def stats(x):
    return {'peakDbfs':db(np.max(np.abs(x))),'rmsDbfs':db(np.sqrt(np.mean(x.astype(np.float64)**2))),'nonzeroSamples':int(np.count_nonzero(np.abs(x)>2**-22))}
def corr(a,b):
    a=a.astype(np.float64).ravel();b=b.astype(np.float64).ravel()
    den=np.sqrt(np.dot(a,a)*np.dot(b,b))
    return round(float(np.dot(a,b)/den),8) if den else None
def ref(p):return {'path':str(p.relative_to(ROOT)),'sha256':sha(p)}
plan=json.loads(PLAN.read_text())
paths=[PLAN,PUB/'audio/final-mix.wav',PUB/'audio/voice-normalized.wav',PUB/'audio/original.wav']
bindings=[ref(p) for p in paths]
mix,voice,original=[audio(p) for p in paths[1:]]
assert len(mix)==len(voice)==len(original),'三路长度不一致'
n=len(mix); residual=mix-voice
expected=np.zeros_like(mix); cache={}; ranges=[]
for cue in plan['sfxCues']:
    file=PUB/cue['file']
    if str(file) not in cache:cache[str(file)]=audio(file)
    s=cache[str(file)]*cue['volume'];start=cue['frame']*1600;end=min(n,start+len(s));s=s[:end-start]
    expected[start:end]+=s;ranges.append((cue,start,end,s))
events=[]
for cue,start,end,s in ranges:
    observed=residual[start:end]
    isolated=observed-(expected[start:end]-s)
    den=float(np.sum(s.astype(np.float64)**2))
    gain=float(np.sum(isolated.astype(np.float64)*s)/den) if den else None
    overlaps=[c['eventId'] for c,a,b,_ in ranges if c['eventId']!=cue['eventId'] and a<end and b>start]
    events.append({'eventId':cue['eventId'],'frame':cue['frame'],'startSample':start,'sampleCount':end-start,'file':cue['file'],'gain':cue['volume'],'residual':stats(observed),'isolatedAfterSubtractingOtherScheduledCues':stats(isolated),'expectedSfx':stats(s),'isolatedCorrelation':corr(isolated,s),'estimatedActualToScheduledGain':round(gain,6) if gain is not None else None,'overlappingCueIds':overlaps,'actualNonzeroSoundPresent':bool(np.count_nonzero(np.abs(observed)>2**-22)>0),'sourceHashMatchesRuntime':sha(PUB/cue['file'])==cue['sha256']})
safe=np.ones(n,dtype=bool)
for _,start,end,_ in ranges:safe[max(0,start-480):min(n,end+4800)]=False
quietidx=np.flatnonzero(safe)[::32]
outside=residual[quietidx]
# 原始与标准化人声仅按同位置取样，另做±10毫秒离散互相关检查；不推断逐字内容。
o=original.mean(axis=1)[::16].astype(np.float64);v=voice.mean(axis=1)[::16].astype(np.float64)
o=o[:min(len(o),48000*30//16)];v=v[:len(o)]
lagScores=[]
for lag in range(-30,31):
    a=o[max(0,-lag):min(len(o),len(o)-lag)];b=v[max(0,lag):min(len(v),len(v)+lag)]
    lagScores.append((float(np.dot(a,b)/np.sqrt(np.dot(a,a)*np.dot(b,b))),lag))
best=max(lagScores)
unexplained=residual-expected
overlap=np.zeros(n,dtype=np.int16)
for _,a,b,_ in ranges:overlap[a:b]+=1
log=subprocess.run(['ffmpeg','-hide_banner','-nostats','-i',str(PUB/'audio/final-mix.wav'),'-af','loudnorm=I=-17:TP=-2:LRA=11:print_format=json','-f','null','-'],stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,text=True,check=True).stderr
at=log.rfind('{'); loud=json.loads(log[at:log.rfind('}')+1])
problems=[]
for e in events:
    if not e['actualNonzeroSoundPresent'] or not e['sourceHashMatchesRuntime'] or e['isolatedCorrelation'] is None or e['isolatedCorrelation']<.97 or not(.9<=e['estimatedActualToScheduledGain']<=1.1):problems.append(e['eventId'])
result={'schemaVersion':'ai-training-audio-events-machine-qa/v1','scope':'只读实际PCM采样与逐cue残差重建，未人工试听，未修改混音','audioListened':False,'fullWatchConfirmed':False,'bindings':bindings,'sampleRate':48000,'channels':2,'samplesPerChannel':n,'durationSeconds':n/48000,'voiceOriginalLengthMatchesMix':True,'originalVsNormalizedVoice':{'samePositionCorrelation':corr(o,v),'bestLagSamplesAt16SampleResolution':best[1]*16,'bestLagCorrelation':best[0]},'voiceOutsideScheduledSound':{'sampledFrames':len(quietidx),'correlation':corr(mix[quietidx],voice[quietidx]),'difference':stats(outside)},'wholeMix':stats(mix),'wholeSfxResidual':stats(residual),'scheduledSfxReconstructionError':stats(unexplained),'loudnormReadOnlyMeasurement':loud,'peakSafety':{'measuredTruePeakDbtp':float(loud['input_tp']),'noSampleClipping':bool(np.max(np.abs(mix))<1),'belowMinus1Dbtp':float(loud['input_tp'])<=-1,'maximumSimultaneousScheduledSfx':int(overlap.max()),'overlapFramesCount':int(np.count_nonzero(overlap>1))},'eventCount':len(events),'eventsWithActualNonzeroSfx':sum(e['actualNonzeroSoundPresent'] for e in events),'suspectEvents':problems,'hookEvent':events[0],'events':events,'inputFilesUnchangedDuringAnalysis':all(sha(p)==b['sha256'] for p,b in zip(paths,bindings)),'limitations':['声学相关与样本对齐不等于逐字听审。','若限幅器压低峰值，重建残差会含少量非线性误差。','机器响度与每段残差存在不能替代正常音量的人声清晰度和音效审美试听。']}
OUT.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:result[k] for k in ['eventCount','eventsWithActualNonzeroSfx','suspectEvents','originalVsNormalizedVoice','voiceOutsideScheduledSound','scheduledSfxReconstructionError','peakSafety','inputFilesUnchangedDuringAnalysis']},ensure_ascii=False,indent=2))
