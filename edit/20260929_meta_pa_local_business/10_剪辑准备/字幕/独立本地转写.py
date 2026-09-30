import os
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
import json
from pathlib import Path
import mlx_whisper

out = Path(__file__).resolve().parent
source = out.parents[1] / '06_实录核对' / '原片_16k.wav'
model = '/Users/pc/.cache/huggingface/hub/models--mlx-community--whisper-small-mlx/snapshots/45f3915923c7a79a5a5b5a7d909d39aeb0e5630e'
result = mlx_whisper.transcribe(str(source), path_or_hf_repo=model, language='zh', word_timestamps=True, verbose=False, condition_on_previous_text=False)
with (out / 'whisper-small.独立识别.r1.json').open('x') as f:
    json.dump(result, f, ensure_ascii=False, indent=2)
print(json.dumps({'segments': len(result['segments']), 'humanListeningPerformed': False}, ensure_ascii=False))
