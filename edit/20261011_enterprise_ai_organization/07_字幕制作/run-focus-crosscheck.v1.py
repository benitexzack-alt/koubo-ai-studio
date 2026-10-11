"""只读本期原声音频，独立短窗离线重识别；没有拍前稿或提示词。"""
import os, socket, json, time, wave, hashlib
from pathlib import Path
OUT = Path(__file__).resolve().parent
SOURCE = OUT.parent / '04_实录与字幕/enterprise-ai-organization.original.16k-mono.wav'
MODEL = '/Users/pc/.cache/huggingface/hub/models--mlx-community--whisper-large-v3-turbo/snapshots/a4aaeec0636e6fef84abdcbe3544cb2bf7e9f6fb'
for key in ('HF_HUB_OFFLINE', 'TRANSFORMERS_OFFLINE', 'HF_HUB_DISABLE_TELEMETRY', 'PYTHONDONTWRITEBYTECODE'):
    os.environ[key] = '1'
def blocked(*args, **kwargs):
    raise RuntimeError('离线复核禁止网络')
socket.socket.connect = blocked
socket.socket.connect_ex = blocked
socket.create_connection = blocked
socket.getaddrinfo = blocked
import numpy as np
import mlx_whisper
with wave.open(str(SOURCE), 'rb') as handle:
    rate = handle.getframerate()
    audio = np.frombuffer(handle.readframes(handle.getnframes()), dtype='<i2').astype(np.float32) / 32768
windows = [(14,23.1), (23.1,30.8), (30.6,37), (46.3,53.4), (62,70.7), (75.9,83.2), (86.5,93.3), (113.2,123.8), (123.8,129.6)]
receipt = {'schemaVersion':'offline-focus-asr-crosscheck/v1', 'sourceAudio':str(SOURCE), 'sourceAudioSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(), 'modelPath':MODEL, 'independentModel':False, 'independentWindows':True, 'networkDisabled':True, 'initialPrompt':None, 'scriptProvided':False, 'humanListeningPerformed':False, 'status':'candidate-unreviewed', 'windows':[]}
started = time.monotonic()
for index, (start, end) in enumerate(windows):
    result = mlx_whisper.transcribe(audio[int(start*rate):int(end*rate)], path_or_hf_repo=MODEL, language='zh', task='transcribe', word_timestamps=True, initial_prompt=None, condition_on_previous_text=False, temperature=0.0, verbose=False)
    item = {'id':f'W{index+1:02}', 'start':start, 'end':end, 'text':result['text'], 'result':result}
    receipt['windows'].append(item)
    print(json.dumps({k:item[k] for k in ('id','start','end','text')}, ensure_ascii=False), flush=True)
receipt['elapsedSeconds'] = round(time.monotonic()-started,3)
(OUT / 'focus-crosscheck.raw.v1.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2,default=lambda x:x.item())+'\n',encoding='utf-8')
