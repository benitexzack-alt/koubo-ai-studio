#!/usr/bin/env python3
"""仅为用户已授权的本期R2制作三段可追溯宣传视频代理。"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import subprocess

episode = Path(__file__).resolve().parent.parent
r2 = Path(__file__).resolve().parent
root = episode.parents[1]
public = episode / '05_后期工程/public'
source = episode / '01_素材投放区/05_公开素材_Codex准备/原始官方视频/Tesla_X_2110913252045545472.mp4'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
windows = [('R06',600,776,84,'坡面连续上行'),('R07',776,905,432,'离坡腾空与喷流'),('R08',905,1083,720,'场地行驶及坡面宽景')]

def make(item):
    name,start,end,source_frame,purpose = item
    duration = (end-start)/30
    source_start = source_frame*1001/24000
    video = public / f'evidence/{name}-car-r2.mp4'
    audio = public / f'audio/{name}-native-r2.m4a'
    command = ['ffmpeg','-v','error','-nostdin','-n','-ss',str(source_start),'-i',str(source),
        '-t',str(duration),'-map','0:v:0','-map','0:a:0','-vf','scale=1920:1080:flags=lanczos,fps=30',
        '-frames:v',str(end-start),'-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p',
        '-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart',str(video)]
    result = subprocess.run(command,capture_output=True,text=True)
    if result.returncode:
        raise RuntimeError(result.stderr)
    audio_command = ['ffmpeg','-v','error','-nostdin','-n','-i',str(video),'-map','0:a:0','-c:a','copy',str(audio)]
    subprocess.run(audio_command,check=True)
    return {'id':name,'kind':'real-evidence','runtimeWindow':{'from':start,'to':end},
        'source':{'path':str(source.relative_to(root)),'sha256':sha(source)},
        'sourceWindow':{'fromFrame':source_frame,'fps':'24000/1001','fromSeconds':source_start,'toSeconds':source_start+duration},
        'renderAsset':{'path':str(video.relative_to(root)),'sha256':sha(video)},
        'nativeAudio':{'path':str(audio.relative_to(root)),'sha256':sha(audio),'gain':0.07},
        'command':command,'exitCode':result.returncode,'audioExtractionCommand':audio_command,
        'purpose':purpose,'sourceUrl':'https://x.com/Tesla/status/2110913252045545472',
        'evidenceScope':'官方宣传画面的视觉背景；不由画面证明A71名称、底盘机构、任意墙面吸附或1.7秒/483公里/370公里参数',
        'humanAccepted':False}

with ThreadPoolExecutor(max_workers=3) as pool:
    records = list(pool.map(make,windows))
report={'schemaVersion':'musk-grok-r2-car-clips/v1','sourceUnchanged':sha(source)==records[0]['source']['sha256'],
    'clips':records,'noSourceSpeedChange':True,'reviewAccepted':False,'publishAuthorized':False}
(r2/'汽车裁切与来源映射.v1.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'created':[x['renderAsset']['path'] for x in records],'sourceUnchanged':report['sourceUnchanged']},ensure_ascii=False))
