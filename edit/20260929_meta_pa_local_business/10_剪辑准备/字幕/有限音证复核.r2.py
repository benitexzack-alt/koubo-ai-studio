import os
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
import json
import subprocess
from pathlib import Path
import mlx_whisper

out = Path(__file__).resolve().parent
small = '/Users/pc/.cache/huggingface/hub/models--mlx-community--whisper-small-mlx/snapshots/45f3915923c7a79a5a5b5a7d909d39aeb0e5630e'
turbo = '/Users/pc/.cache/huggingface/hub/models--mlx-community--whisper-large-v3-turbo/snapshots/a4aaeec0636e6fef84abdcbe3544cb2bf7e9f6fb'
windows = [('录取',272,280),('接线',347,355)]
results = []
for label,start,end in windows:
    source = out / f'试听_{label}_{start}-{end}s.wav'
    first = mlx_whisper.transcribe(str(source),path_or_hf_repo=small,language='zh',word_timestamps=True,verbose=False,condition_on_previous_text=False,temperature=0.0)
    results.append({'method':'原始八秒音频_独立small_无提示','sourceStartSeconds':start,'sourceEndSeconds':end,'source':str(source),'audioFilters':None,'model':small,'result':first})
    print(json.dumps({'label':label,'method':'原始八秒音频_独立small_无提示','text':first['text']},ensure_ascii=False),flush=True)
    auxiliary = out / f'辅证_轻度降噪慢速_{label}_{start}-{end}s.r2.wav'
    filters = 'highpass=f=80,lowpass=f=7500,afftdn=nr=8:nf=-25,atempo=0.88'
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-n','-i',str(source),'-af',filters,'-ac','1','-ar','16000','-c:a','pcm_s16le',str(auxiliary)],check=True)
    second = mlx_whisper.transcribe(str(auxiliary),path_or_hf_repo=turbo,language='zh',word_timestamps=True,verbose=False,condition_on_previous_text=False,temperature=0.0)
    results.append({'method':'轻度降噪_0.88倍速_turbo_无提示','sourceStartSeconds':start,'sourceEndSeconds':end,'source':str(source),'auxiliary':str(auxiliary),'audioFilters':filters,'timestampScale':0.88,'model':turbo,'result':second})
    print(json.dumps({'label':label,'method':'轻度降噪_0.88倍速_turbo_无提示','text':second['text']},ensure_ascii=False),flush=True)
with (out/'两种方法_剩余疑词有限复核.r2.json').open('x') as f:
    json.dump({'schemaVersion':1,'maximumMethods':2,'actualMethods':2,'noLexicalPrompt':True,'humanListeningPerformed':False,'originalAudioModified':False,'cloudUpload':False,'results':results},f,ensure_ascii=False,indent=2)
