import os
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
import json
from pathlib import Path
import subprocess
import mlx_whisper

out = Path(__file__).resolve().parent
source = out.parents[1] / '06_实录核对' / '原片_16k.wav'
model = '/Users/pc/.cache/huggingface/hub/models--mlx-community--whisper-large-v3-turbo/snapshots/a4aaeec0636e6fef84abdcbe3544cb2bf7e9f6fb'
windows = [(11,17), (120,138), (166,174), (218,248), (254,279), (338,354), (392,409.5)]
results = []
for start, end in windows:
    clip = out / f'音证_{start}-{end}s.wav'
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-ss', str(start), '-t', str(end-start), '-i', str(source), '-ac', '1', '-ar', '16000', str(clip)], check=True)
    result = mlx_whisper.transcribe(str(clip), path_or_hf_repo=model, language='zh', word_timestamps=True, verbose=False, condition_on_previous_text=False)
    results.append({'start': start, 'end': end, 'audio': str(clip), 'result': result})
    print(json.dumps({'start': start, 'end': end, 'text': result['text']}, ensure_ascii=False), flush=True)
with (out / '关键窗_无提示复核.r1.json').open('x') as f:
    json.dump(results, f, ensure_ascii=False, indent=2)
