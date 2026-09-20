"""仅对本期原声争议片段做本地离线复核；不注入原稿，不声称人工听审。"""
import os
import socket
import json
from pathlib import Path

os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'
def reject(*args, **kwargs):
    raise RuntimeError('禁止网络访问')
socket.socket.connect = reject
socket.create_connection = reject
socket.getaddrinfo = reject
import mlx_whisper
from mlx_whisper.audio import load_audio

base = Path(__file__).resolve().parent
audio = load_audio(str(base / '原片音频16k.wav'))
results = []
for start, end in [(8, 12), (21, 29), (75, 81), (92, 100), (120, 125), (169, 174), (183, 193), (200, 210), (278, 305.1667)]:
    result = mlx_whisper.transcribe(
        audio[round(start * 16000):round(end * 16000)],
        path_or_hf_repo='/Users/pc/.cache/huggingface/hub/models--mlx-community--whisper-large-v3-turbo/snapshots/a4aaeec0636e6fef84abdcbe3544cb2bf7e9f6fb',
        language='zh', initial_prompt=None, temperature=0.0,
        word_timestamps=True, condition_on_previous_text=False, verbose=False,
    )
    results.append({'sourceStart': start, 'sourceEnd': end, 'result': result})
    print(start, end, result['text'], flush=True)
with (base / 'final-r1-local-recheck.json').open('x') as file:
    json.dump({'humanListeningPerformed': False, 'networkDisabled': True, 'scriptProvided': False, 'clips': results}, file, ensure_ascii=False, indent=2, default=lambda v: v.item())
