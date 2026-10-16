"""只从原音频独立分窗复核，不读取拍前稿，不改写首轮 raw。"""
import datetime
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import socket
import sys
import time
import wave

BASE = Path(__file__).resolve().parent
OUT = BASE / "focus_crosscheck_v1"
OUT.mkdir(exist_ok=True)
MODEL = Path("/Users/pc/.cache/huggingface/hub/models--mlx-community--whisper-large-v3-turbo/snapshots/a4aaeec0636e6fef84abdcbe3544cb2bf7e9f6fb")
AUDIO = BASE / "musk-grok-business-ai.original.16k-mono.wav"
WINDOWS = [
    {"id": "F01", "requested": [18, 23], "actual": [18, 23], "reason": "推进系统专名"},
    {"id": "F02", "requested": [25, 31], "actual": [25, 31], "reason": "直接起势识别疑点"},
    {"id": "F03", "requested": [41, 47], "actual": [41, 47], "reason": "产品专名"},
    {"id": "F04", "requested": [55, 68], "actual": [55, 68.6], "reason": "绘图服务、编码工具、模型及调度用词；末端扩0.6秒避免原始段落到68.16秒被截断"},
    {"id": "F05", "requested": [85, 100], "actual": [85, 100.5], "reason": "万能及画图用词；末端扩0.5秒覆盖100.1秒结束段落"},
    {"id": "F06", "requested": [111, 130], "actual": [111, 133], "reason": "工作环节及岗位用词；原始业务岗段落到131.88秒，扩窗避免截断"},
    {"id": "F07", "requested": [143, 150], "actual": [143, 154], "reason": "试了工具用词；原始疑点在150.62–151.78秒，原请求窗未包含，扩窗覆盖完整句"},
]
for key, value in {
    "HF_HUB_OFFLINE": "1", "TRANSFORMERS_OFFLINE": "1",
    "HF_HUB_DISABLE_TELEMETRY": "1", "PYTHONDONTWRITEBYTECODE": "1",
    "NUMBA_CACHE_DIR": str(BASE / "numba-cache"),
}.items():
    os.environ[key] = value
sys.dont_write_bytecode = True

def reject_network(*args, **kwargs):
    raise RuntimeError("本次分窗复核禁用网络，不下载或上传")

socket.socket.connect = reject_network
socket.socket.connect_ex = reject_network
socket.create_connection = reject_network
socket.getaddrinfo = reject_network

def digest(p):
    with Path(p).open("rb") as f:
        return hashlib.file_digest(f, "sha256").hexdigest()

def dump(p, d):
    with p.open("x", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False, indent=2, default=lambda x: x.item())
        f.write("\n")

import numpy as np
import mlx_whisper
started = time.monotonic()
receipt = {
    "startedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "command": [sys.executable, *sys.argv], "modelPath": str(MODEL),
    "modelVersion": importlib.metadata.version("mlx-whisper"),
    "audioPath": str(AUDIO), "audioSha256": digest(AUDIO),
    "scriptProvidedToAsr": False, "initialPrompt": None,
    "networkDisabled": True, "audioUploadPerformed": False,
    "sameModelAsPrimaryPass": True, "humanListeningPerformed": False,
    "limitations": ["同模型独立分窗不等于独立模型或人工听审", "所有结果保持raw，仅供识别候选比较", "不能根据事实核验或拍前稿倒改实录", "词级时间均为ASR估计"],
    "runs": [],
}
with wave.open(str(AUDIO), "rb") as f:
    assert (f.getnchannels(), f.getsampwidth(), f.getframerate()) == (1, 2, 16000)
    samples = np.frombuffer(f.readframes(f.getnframes()), dtype="<i2").astype(np.float32) / 32768.0
options = {"path_or_hf_repo": str(MODEL), "language": "zh", "task": "transcribe", "word_timestamps": True, "initial_prompt": None, "condition_on_previous_text": False, "temperature": 0.0, "verbose": False}
receipt["options"] = options
for window in WINDOWS:
    a, b = window["actual"]
    result = mlx_whisper.transcribe(samples[int(a*16000):int(b*16000)], **options)
    path = OUT / f"{window['id']}_{a:g}-{b:g}s.raw.json"
    dump(path, result)
    row = {**window, "rawPath": str(path), "rawSha256": digest(path), "rawText": result["text"], "globalTimestampRule": "globalSeconds = localSeconds + actual[0]", "segments": [{"id": s["id"], "localStart": s["start"], "localEnd": s["end"], "globalStart": round(a+s["start"], 3), "globalEnd": round(a+s["end"], 3), "text": s["text"], "words": [{**w, "globalStart": round(a+w["start"],3), "globalEnd": round(a+w["end"],3)} for w in s.get("words",[])]} for s in result["segments"]]}
    receipt["runs"].append(row)
    print(json.dumps({"id": window["id"], "actual": window["actual"], "text": result["text"]}, ensure_ascii=False), flush=True)
receipt["endedAt"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
receipt["durationSeconds"] = round(time.monotonic()-started, 3)
receipt["audioHashUnchanged"] = digest(AUDIO) == receipt["audioSha256"]
receipt["scriptSha256"] = digest(Path(__file__))
dump(OUT / "focus-crosscheck.receipt.v1.json", receipt)
