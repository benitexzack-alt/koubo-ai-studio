import os
os.environ['HF_HUB_OFFLINE']='1'
os.environ['HF_HUB_DISABLE_TELEMETRY']='1'
import json
import pathlib
import mlx_whisper
root=pathlib.Path(__file__).resolve().parents[1]
out=root/'06_实录核对'
result=mlx_whisper.transcribe(str(out/'原片_16k.wav'),path_or_hf_repo='/Users/pc/.cache/huggingface/hub/models--mlx-community--whisper-large-v3-turbo/snapshots/a4aaeec0636e6fef84abdcbe3544cb2bf7e9f6fb',language='zh',word_timestamps=True,verbose=False,condition_on_previous_text=False)
with (out/'本地转写_未听审.r1.json').open('x') as f: json.dump(result,f,ensure_ascii=False,indent=2)
with (out/'本地转写_未听审.r1.txt').open('x') as f:
    for s in result['segments']: f.write(f"[{s['start']:.2f}—{s['end']:.2f}] {s['text']}\n")
print(json.dumps({'status':'local-asr-candidate','segments':len(result['segments']),'humanListeningVerified':False},ensure_ascii=False))
