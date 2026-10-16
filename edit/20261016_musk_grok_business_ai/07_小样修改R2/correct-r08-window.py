#!/usr/bin/env python3
"""将第三窗移到744号原帧，避开720号帧残留的上一机位；旧代理保留。"""
from pathlib import Path
import hashlib
import json
import subprocess

r2 = Path(__file__).resolve().parent
root = r2.parents[2]
mapping = r2 / '汽车裁切与来源映射.v1.json'
report = json.loads(mapping.read_text())
clip = next(x for x in report['clips'] if x['id']=='R08')
original = json.loads(json.dumps(clip))
source = root / clip['source']['path']
video = root / clip['renderAsset']['path'].replace('R08-car-r2.mp4','R08-car-r2b.mp4')
audio = root / clip['nativeAudio']['path'].replace('R08-native-r2.m4a','R08-native-r2b.m4a')
source_start = 744*1001/24000
duration = 178/30
command = clip['command'].copy()
command[command.index('-ss')+1] = str(source_start)
command[-1] = str(video)
subprocess.run(command,check=True)
audio_command = ['ffmpeg','-v','error','-nostdin','-n','-i',str(video),'-map','0:a:0','-c:a','copy',str(audio)]
subprocess.run(audio_command,check=True)
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
clip.update({'sourceWindow':{'fromFrame':744,'fps':'24000/1001','fromSeconds':source_start,'toSeconds':source_start+duration},
    'renderAsset':{'path':str(video.relative_to(root)),'sha256':sha(video)},
    'nativeAudio':{'path':str(audio.relative_to(root)),'sha256':sha(audio),'gain':0.07},
    'command':command,'audioExtractionCommand':audio_command,
    'purpose':'高位全景坡面演示；前景车辆停驻，不声明巡航或测速'})
(r2/'第三窗机位修订.v1.json').write_text(json.dumps({'old':original,'new':clip,'sourceUnchanged':sha(source)==clip['source']['sha256']},ensure_ascii=False,indent=2)+'\n')
mapping.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
# 只替换本轮拥有的媒体字段，保留并行动效调整。
runtime = r2 / 'runtime-plan.r2.json'
data = json.loads(runtime.read_text())
slot = next(x for x in data['mediaSlots'] if x['id']=='R08')
slot['asset']['src'] = 'evidence/R08-car-r2b.mp4'
slot['asset']['nativeAudio']['src'] = 'audio/R08-native-r2b.m4a'
runtime.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
print('第三窗已从744原帧起裁切，旧代理保留。')
