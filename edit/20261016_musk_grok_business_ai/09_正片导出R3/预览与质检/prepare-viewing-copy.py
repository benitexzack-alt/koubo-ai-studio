#!/usr/bin/env python3
"""先测量受控R3的固定时差，再生成保留全部编码包的内部观看副本。"""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import numpy as np

qa = Path(__file__).resolve().parent
episode = qa.parents[1]
parent = qa / '受控正片候选_R3_1080p_有音效.mp4'
output = episode / '10_正片交付_R3/飞车与企业AI_V9正片_R3_1080p_有音效.mp4'
voice = episode / '05_后期工程/public/audio/voice.m4a'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
assert parent.is_file() and not output.exists()
receipts = [p for p in qa.glob('.'+parent.name+'.production-receipt.*.json')
    if json.loads(p.read_text()).get('output',{}).get('sha256') == sha(parent)]
assert len(receipts)==1, '受控父片与唯一渲染回执须匹配'

def pcm(path):
    return np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-nostdin','-i',str(path),
        '-map','0:a:0','-ac','1','-ar','16000','-f','f32le','-']),dtype='<f4')

a,b = pcm(voice),pcm(parent)
windows = []
for start,end in [(14,17),(36.8,39.8),(80,82),(137.7,140),(165,167.8)]:
    x=a[round(start*16000):round(end*16000)].astype('float64')
    y=b[round(start*16000):round(end*16000)].astype('float64')
    x-=x.mean(); y-=y.mean()
    n=1<<(len(x)+len(y)-2).bit_length()
    c=np.fft.irfft(np.conj(np.fft.rfft(x,n))*np.fft.rfft(y,n),n)
    lags=np.arange(-3200,3201);lag=int(lags[np.argmax(c[lags%n])])
    xx=x[max(0,-lag):len(x)-max(0,lag)]; yy=y[max(0,lag):len(y)-max(0,-lag)]
    windows.append({'startSeconds':start,'endSeconds':end,'lagSamples16k':lag,'lagMs':lag/16,
        'alignedCorrelation':float(np.corrcoef(xx,yy)[0,1])})
(qa/'受控父片同步检查.v1.json').write_text(json.dumps(windows,ensure_ascii=False,indent=2)+'\n')
assert all(w['alignedCorrelation']>.98 for w in windows), '无叠声窗不匹配，不能自动校时'
if all(abs(w['lagMs'])<1 for w in windows):
    offset=0;command=None;shutil.copyfile(parent,output)
elif all(abs(w['lagMs']-2048/48)<.1 for w in windows):
    offset=-2048/48000
    command=['ffmpeg','-v','error','-nostdin','-n','-i',str(parent),'-itsoffset',str(offset),'-i',str(parent),
        '-map','0:v:0','-map','1:a:0','-c','copy','-avoid_negative_ts','disabled','-use_editlist','1','-movflags','+faststart',str(output)]
    subprocess.run(command,check=True)
else:
    raise RuntimeError('本期偏移并非已识别的一致时差，保留父片停止自动封装')
receipt={'schemaVersion':'internal-preview-timing-derivative/v1',
    'parent':{'path':str(parent),'sha256':sha(parent),'controlledReceipt':str(receipts[0])},
    'output':{'path':str(output),'sha256':sha(output)},'audioOffsetSeconds':offset,
    'command':command,'commandExitCode':0,'parentMeasuredWindows':windows,
    'controlledDirectOutput':False,'formalRelease':False,'userAccepted':False,'publicationAuthorized':False,
    'scope':'本期1080p正片观看候选；受控父片保留；编码包一致性与校时结果须由check-viewing-copy.py实际验证',
    'pass':False}
(qa/'内部观看副本校时回执.v1.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'output':str(output),'measuredOffsetSeconds':offset,'next':'check-viewing-copy.py'},ensure_ascii=False))
