"""从实际导出的AAC验证音效保留及采样延迟；不冒充人耳听审。"""
from pathlib import Path
import hashlib,json,subprocess
import numpy as np
root=Path('/Users/pc/Documents/口播')
base=root/'edit/20260926_industry_ai_no_anxiety'
pub=root/'remotion/public-industry-ai-no-anxiety-final-r1'
final=base/'08_正式成片/行业经验配AI_V8_R1_1080P_正式候选.mp4'
plan=json.loads((root/'remotion/src/industry-ai-no-anxiety-final-r1/runtime-plan.r1.json').read_text())
def audio(p):
    b=subprocess.check_output(['ffmpeg','-v','error','-threads','1','-i',str(p),'-map','0:a:0','-vn','-f','f32le','-ar','48000','-ac','2','-'])
    return np.frombuffer(b,dtype='<f4').reshape(-1,2).copy()
def dot(a,b):return float(np.sum(a.astype(np.float64)*b.astype(np.float64)))
def corr(a,b):return dot(a,b)/max((dot(a,a)*dot(b,b))**.5,1e-24)
def dc(r,a,d):
    lo=max(0,-d);hi=min(len(r),len(a)-d)
    return corr(r[lo:hi],a[lo+d:hi+d])
def db(v):return round(20*np.log10(max(float(v),1e-12)),3)
aac=audio(final);mix=audio(pub/'audio/final-mix.wav');native=audio(pub/'audio/native-mix.wav');voice=audio(pub/'audio/original.wav')*3.16227766
r=mix[:48000*15].mean(axis=1);a=aac[:48000*15].mean(axis=1)
coarse=max((dc(r[::8],a[::8],d),d*8) for d in range(-300,301))
fine=max((dc(r,a,d),d) for d in range(coarse[1]-8,coarse[1]+9));lag=fine[1]
events=[]
for cue in plan['sfxCues']:
    start=cue['frame']*1600;dur=len(audio(pub/cue['file']));stop=min(start+dur,len(mix),len(aac)-lag)
    expected=mix[start:stop]-native[start:stop];observed=aac[start+lag:stop+lag]-native[start:stop]
    gain=dot(expected,observed)/max(dot(expected,expected),1e-24);c=corr(expected,observed)
    events.append({'id':cue['eventId'],'frame':cue['frame'],'residualCorrelation':c,'gainRatio':gain,'peakDbfs':db(np.max(np.abs(observed))),'retained':c>.90 and .8<gain<1.2})
paper=[]
for p in plan['paper']:
    lo=p['startFrame']*1600;hi=p['endFrameExclusive']*1600
    residual=mix[lo:hi]-voice[lo:hi]
    paper.append({'id':p['id'],'gain':plan['paperGains'][p['id']],'residualRmsDbfs':db(np.sqrt(np.mean(residual**2))),'residualPeakDbfs':db(np.max(np.abs(residual))),'nativeAudioRetained':bool(np.max(np.abs(residual))>.00001)})
lo=max(0,-lag);hi=min(len(mix),len(aac)-lag);whole=corr(mix[lo:hi:16],aac[lo+lag:hi+lag:16]);passed=abs(lag)<=48 and whole>.995 and all(e['retained'] for e in events) and all(p['nativeAudioRetained'] for p in paper)
report={'status':'machine-audio-passed' if passed else 'machine-audio-needs-review','finalSha256':hashlib.sha256(final.read_bytes()).hexdigest(),'alignment':{'bestDelaySamples':lag,'bestDelayMs':lag/48,'first15SecondsCorrelation':fine[0],'wholeTrackCorrelation':whole},'eventCount':len(events),'retainedEventCount':sum(e['retained'] for e in events),'events':events,'paper':paper,'audioListenedByAssistant':False,'userFullWatchConfirmed':False,'publishAuthorized':False}
out=base/'07_预览与质检/正式R1/final-aac-audio-qa.json'
with out.open('x') as f:json.dump(report,f,ensure_ascii=False,indent=2)
print(json.dumps(report,ensure_ascii=False,indent=2))
if not passed:raise SystemExit(1)
