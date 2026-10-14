"""离线转写录屏音轨，仅生成待校读研究材料。"""

import hashlib
import json
import os
from pathlib import Path
import socket
import subprocess

ROOT = Path(__file__).resolve().parent
SOURCE = Path("/Users/pc/Downloads/ScreenRecording_10-14-2026 11-04-37_1.MP4")
MODEL = Path("/Users/pc/.cache/huggingface/hub/models--mlx-community--whisper-large-v3-turbo/snapshots/a4aaeec0636e6fef84abdcbe3544cb2bf7e9f6fb")
AUDIO = ROOT / "audio.16k-mono.wav"
OUTPUT = ROOT / "asr.raw.json"

for key in ("HF_HUB_OFFLINE", "TRANSFORMERS_OFFLINE", "HF_HUB_DISABLE_TELEMETRY"):
    os.environ[key] = "1"


def reject_network(*args, **kwargs):
    raise RuntimeError("本地转写禁用网络")


socket.socket.connect = reject_network
socket.socket.connect_ex = reject_network
socket.create_connection = reject_network
socket.getaddrinfo = reject_network

if OUTPUT.exists():
    raise SystemExit("已有转写，不覆盖")
if not (MODEL / "weights.safetensors").is_file():
    raise SystemExit("缺少本地模型，不下载")

source_sha = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
if not AUDIO.exists():
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-n", "-i", str(SOURCE),
        "-vn", "-ac", "1", "-ar", "16000", str(AUDIO),
    ], check=True)

import mlx_whisper

result = mlx_whisper.transcribe(
    str(AUDIO), path_or_hf_repo=str(MODEL), language="zh", task="transcribe",
    word_timestamps=True, initial_prompt=None, condition_on_previous_text=False,
    temperature=0.0, verbose=True,
)
payload = {
    "status": "candidate-unreviewed",
    "source": str(SOURCE), "source_sha256": source_sha,
    "local_model": str(MODEL), "network_disabled": True,
    "external_upload": False, "result": result,
}
with OUTPUT.open("x", encoding="utf-8") as handle:
    json.dump(payload, handle, ensure_ascii=False, indent=2,
              default=lambda value: value.item())
    handle.write("\n")
print(json.dumps({"output": str(OUTPUT), "source_sha256": source_sha}, ensure_ascii=False))
