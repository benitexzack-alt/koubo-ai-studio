"""本期实录离线转写；不注入文稿，不联网，不冒充人工听审。"""
import os
import socket
import json
from pathlib import Path

os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"
def reject(*args, **kwargs):
    raise RuntimeError("本期转写禁止网络访问")
socket.socket.connect = reject
socket.create_connection = reject
socket.getaddrinfo = reject
import mlx_whisper

base = Path(__file__).resolve().parent
result = mlx_whisper.transcribe(
    str(base / "原片音频16k.wav"),
    path_or_hf_repo="/Users/pc/.cache/huggingface/hub/models--mlx-community--whisper-large-v3-turbo/snapshots/a4aaeec0636e6fef84abdcbe3544cb2bf7e9f6fb",
    language="zh", word_timestamps=True, initial_prompt=None,
    temperature=0.0, verbose=False,
)
with (base / "turbo.actual.raw.json").open("x") as f:
    json.dump(result, f, ensure_ascii=False, indent=2, default=lambda v: v.item())
print(json.dumps({"status": "机器转写完成，待核对", "networkDisabled": True,
                  "scriptProvided": False, "humanListeningPerformed": False,
                  "segments": len(result["segments"])}, ensure_ascii=False))
