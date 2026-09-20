"""只读正式MP4的AAC音轨交叉核验，不修改已绑定素材、不声称人工试听。"""
from pathlib import Path
import json,hashlib,subprocess
import numpy as np
ROOT=Path('/Users/pc/Documents/口播')
BASE=ROOT/'edit/20260919_ai_training_methods'
FINAL=BASE/'08_正式成片/AI八种训练方法_V8_R1_1080P_正式候选.mp4'
PLAN=ROOT/'remotion/src/ai-training-final-r1/runtime-plan.r1.json'
PUB=ROOT/'remotion/public-ai-training-final-r1'
PRIOR=BASE/'07_预览与质检/全片声音R1/audio-event-qa.json'
OUT=BASE/'07_预览与质检/正式R1/final-aac-audio-qa.json'
def sha(p):
    h=hashlib.sha256()
    with p.open('rb') as f:
        for b in iter(lambda:f.read(4*1024*1024),b''):h.update(b)
    return h.hexdigest()
def audio(p):
    raw=subprocess.check_output(['ffmpeg','-v','error','-threads','1','-i',str(p),'-map','0:a:0','-vn','-f','f32le','-acodec','pcm_f32le','-ar','48000','-ac','2','-'])
    return np.frombuffer(raw,dtype='<f4').reshape(-1,2).copy()
def dot(a,b):return float(np.sum(a.astype(np.float64)*b.astype(np.float64)))
def corr(a,b):
    den=(dot(a,a)*dot(b,b))**.5
    return dot(a,b)/den if den else 0.
def db(x):return round(float(20*np.log10(max(float(x),1e-12))),5)
def stats(x):return {'peakDbfs':db(np.max(np.abs(x))),'rmsDbfs':db(np.sqrt(np.mean(x.astype(np.float64)**2)))}
def delay_corr(reference,actual,lag):
    a=reference[max(0,-lag):min(len(reference),len(actual)-lag)]
    b=actual[max(0,lag):max(0,lag)+len(a)]
    return corr(a,b)
if not FINAL.is_file():raise SystemExit('正式候选尚未出现；停止，不生成假报告。')
if OUT.exists():raise SystemExit('已有最终AAC报告，拒绝静默覆盖证据。')
paths=[FINAL,PLAN,PUB/'audio/final-mix.wav',PUB/'audio/voice-normalized.wav',PRIOR]
bindings=[{'path':str(p.relative_to(ROOT)),'sha256':sha(p)} for p in paths]
plan=json.loads(PLAN.read_text());prior=json.loads(PRIOR.read_text())
for p in paths[1:4]:
    old=next((b for b in prior['bindings'] if b['path']==str(p.relative_to(ROOT))),None)
    assert old and old['sha256']==sha(p),'本期预混音QA绑定漂移'
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(FINAL)]))
aac=audio(FINAL);mix=audio(PUB/'audio/final-mix.wav');voice=audio(PUB/'audio/voice-normalized.wav')
# 前15秒先以8采样步长搜索±50毫秒，再在最佳点附近逐采样复核。
r=mix[:15*48000].mean(axis=1);a=aac[:15*48000].mean(axis=1)
coarse=max((delay_corr(r[::8],a[::8],lag),lag*8) for lag in range(-300,301))
fine=max((delay_corr(r,a,lag),lag) for lag in range(coarse[1]-8,coarse[1]+9))
lag=fine[1]
start=max(0,-lag);end=min(len(mix),len(aac)-lag,len(voice))
ref=mix[start:end];actual=aac[start+lag:end+lag];v=voice[start:end]
events=[]
for c in plan['sfxCues']:
    lo=c['frame']*1600;hi=min(len(mix),lo+round(c['durationSeconds']*48000));left=max(lo,start);right=min(hi,end)
    rm=mix[left:right];rv=voice[left:right];aa=aac[left+lag:right+lag]
    expected=rm-rv;observed=aa-rv
    gain=dot(observed,expected)/max(dot(expected,expected),1e-24)
    correlation=corr(expected,observed)
    events.append({'eventId':c['eventId'],'frame':c['frame'],'startSample':lo,'evaluatedSamples':right-left,'decodedAacVsPcmMixCorrelation':round(corr(aa,rm),8),'sfxResidualCorrelation':round(correlation,8),'sfxResidualGainRatio':round(gain,6),'expectedResidual':stats(expected),'actualResidual':stats(observed),'retained':bool(correlation>.90 and .8<gain<1.2)})
log=subprocess.run(['ffmpeg','-hide_banner','-nostats','-threads','1','-i',str(FINAL),'-map','0:a:0','-vn','-af','loudnorm=I=-17:TP=-2:LRA=11:print_format=json','-f','null','-'],stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,text=True,check=True).stderr
loud=json.loads(log[log.rfind('{'):log.rfind('}')+1])
audio_streams=[s for s in probe['streams'] if s.get('codec_type')=='audio']
suspects=[e['eventId'] for e in events if not e['retained']]
unchanged=all(sha(p)==b['sha256'] for p,b in zip(paths,bindings))
passed=(len(events)==92 and not suspects and abs(lag)<=48 and corr(actual[::16],ref[::16])>.995 and float(loud['input_tp'])<=-1 and unchanged)
result={'schemaVersion':'ai-training-final-aac-audio-qa/v1','scope':'实际正式MP4解码AAC与已核验PCM混音交叉比对；不修改媒体；不声称人工试听','status':'machine-audio-passed' if passed else 'machine-audio-needs-review','audioListened':False,'fullWatchConfirmed':False,'publishAuthorized':False,'bindings':bindings,'audioStreams':[{'codec':s.get('codec_name'),'sampleRate':s.get('sample_rate'),'channels':s.get('channels'),'duration':s.get('duration'),'startTime':s.get('start_time'),'bitRate':s.get('bit_rate')} for s in audio_streams],'decodedSampleRate':48000,'decodedSamplesPerChannel':len(aac),'referencePcmSamplesPerChannel':len(mix),'aacPaddingSamples':len(aac)-len(mix),'alignment':{'bestDelaySamples':lag,'bestDelayMs':lag/48,'first15SecondsCorrelation':fine[0],'allAudioSampledCorrelation':corr(actual[::16],ref[::16]),'searchRangeMs':50,'fineResolutionSamples':1},'aacEncodingDifference':stats(actual-ref),'loudness':loud,'sampleClippingDetected':bool(np.max(np.abs(aac))>=1),'truePeakWithinMinus1Dbtp':float(loud['input_tp'])<=-1,'eventCount':len(events),'retainedEventCount':sum(e['retained'] for e in events),'suspectEvents':suspects,'hookEvent':events[0],'events':events,'inputsUnchangedDuringAnalysis':unchanged,'limitations':['AAC有损压缩使逐样本值不可能与PCM完全相同，因此使用相关性、残差和增益区间核验，不以字节一致作为标准。','逐cue残差来自实际AAC减标准化人声，可受同窗其他音效、压缩噪声与限幅影响；同时对照已验收PCM同窗残差。','通过只证明导出保留已核验混音及92个事件，不证明审美听感或用户完整观看通过。']}
OUT.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:result[k] for k in ['status','alignment','eventCount','retainedEventCount','suspectEvents','loudness','inputsUnchangedDuringAnalysis']},ensure_ascii=False,indent=2))
