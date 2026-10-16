"""仅生成本期原片的离线转写候选；不读取拍前稿、不生成最终字幕。"""

import datetime
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import time
import traceback
import wave


OUT = Path(__file__).resolve().parent
EPISODE = OUT.parents[1]
SOURCE = EPISODE / "01_素材投放区/01_口播原片/copy_7BB13FE6-D6AA-467C-9A11-D944F0BD6F88.MOV"
AUDIO = OUT / "musk-grok-business-ai.original.16k-mono.wav"
MODEL = Path("/Users/pc/.cache/huggingface/hub/models--mlx-community--whisper-large-v3-turbo/snapshots/a4aaeec0636e6fef84abdcbe3544cb2bf7e9f6fb")
EXPECTED_SOURCE_SHA = "b1902425762e49aedfc62ff717393351e6573c5af6c0cd06a7babf571af89bf6"
PREFIX = "musk-grok-business-ai.mlx-whisper-large-v3-turbo.raw.v1"
STARTED = time.monotonic()

for key, value in {
    "HF_HUB_OFFLINE": "1",
    "TRANSFORMERS_OFFLINE": "1",
    "HF_HUB_DISABLE_TELEMETRY": "1",
    "PYTHONDONTWRITEBYTECODE": "1",
    "NUMBA_CACHE_DIR": str(OUT / "numba-cache"),
}.items():
    os.environ[key] = value
sys.dont_write_bytecode = True


def reject_network(*args, **kwargs):
    raise RuntimeError("本轮本地转写禁用网络，不得下载或上传")


socket.socket.connect = reject_network
socket.socket.connect_ex = reject_network
socket.create_connection = reject_network
socket.getaddrinfo = reject_network


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def sha(path):
    with Path(path).open("rb") as handle:
        return hashlib.file_digest(handle, "sha256").hexdigest()


def json_default(value):
    if hasattr(value, "item"):
        return value.item()
    raise TypeError(type(value).__name__)


def write_json(path, value, mode="x"):
    with path.open(mode, encoding="utf-8") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2, default=json_default)
        handle.write("\n")


def srt_time(seconds):
    milliseconds = max(0, round(float(seconds) * 1000))
    hours, milliseconds = divmod(milliseconds, 3600000)
    minutes, milliseconds = divmod(milliseconds, 60000)
    seconds, milliseconds = divmod(milliseconds, 1000)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d},{milliseconds:03d}"


receipt = {
    "schemaVersion": "local-whisper-asr-candidate/v1",
    "status": "initializing",
    "startedAt": now(),
    "command": [sys.executable, *sys.argv],
    "sourceVideoPath": str(SOURCE),
    "sourceDurationSeconds": 167.833333,
    "audioPath": str(AUDIO),
    "audioScope": "entire-original-no-cuts-no-normalization-no-speed-change",
    "modelPath": str(MODEL),
    "initialPrompt": None,
    "prefix": None,
    "hotwords": None,
    "scriptProvidedToAsr": False,
    "existingClaudeAsrProvidedToAsr": False,
    "networkDisabled": True,
    "modelDownloaded": False,
    "dependenciesInstalled": False,
    "humanListeningPerformed": False,
    "implementationReusedFrom": '/Users/pc/Documents/口播/edit/20261011_enterprise_ai_organization/04_实录与字幕/run-local-asr.v1.py',
    "noAudioUploadPerformed": True,
    "reviewStatus": "candidate-unreviewed",
    "finalSubtitleApproved": False,
    "events": [],
}


def emit(phase, **data):
    event = {
        "at": now(),
        "elapsedSeconds": round(time.monotonic() - STARTED, 3),
        "phase": phase,
        **data,
    }
    receipt["events"].append(event)
    receipt["status"] = phase
    write_json(OUT / "local-asr.receipt.v1.json", receipt, mode="w")
    print(json.dumps(event, ensure_ascii=False, default=json_default), flush=True)


try:
    receipt["sourceSha256Before"] = sha(SOURCE)
    if receipt["sourceSha256Before"] != EXPECTED_SOURCE_SHA:
        raise RuntimeError("原片哈希与本轮指定输入不符，停止转写")
    for name in ("config.json", "weights.safetensors"):
        if not (MODEL / name).is_file():
            raise RuntimeError(f"本地模型文件缺失：{name}；本轮不下载")
    receipt["localModelFiles"] = [
        {
            "path": str(MODEL / name),
            "resolvedPath": str((MODEL / name).resolve()),
            "bytes": (MODEL / name).stat().st_size,
            "sha256": sha(MODEL / name),
        }
        for name in ("config.json", "weights.safetensors")
    ]
    emit("probing-and-checking-full-decode")
    probe_command = ["/opt/homebrew/bin/ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", str(SOURCE)]
    receipt["mediaProbeCommand"] = probe_command
    probe_result = subprocess.run(probe_command, check=True, capture_output=True, text=True)
    write_json(OUT / "source.ffprobe.json", json.loads(probe_result.stdout))
    decode_command = ["/opt/homebrew/bin/ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-xerror", "-err_detect", "explode", "-i", str(SOURCE), "-map", "0:v:0", "-map", "0:a:0", "-f", "null", "-"]
    receipt["fullDecodeCommand"] = decode_command
    decode_start = time.monotonic()
    with (OUT / "source.full-decode.log.txt").open("x") as handle:
        decoded = subprocess.run(decode_command, stdout=handle, stderr=handle)
    receipt["fullDecode"] = {"exitCode": decoded.returncode, "passed": decoded.returncode == 0, "durationSeconds": round(time.monotonic() - decode_start, 3), "logPath": str(OUT / "source.full-decode.log.txt"), "scope": "all-video-and-audio-no-cuts"}
    decoded.check_returncode()
    receipt["ffmpegVersion"] = subprocess.run(["/opt/homebrew/bin/ffmpeg", "-version"], check=True, capture_output=True, text=True).stdout.splitlines()[0]
    emit("extracting-original-audio")
    command = [
        "/opt/homebrew/bin/ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error",
        "-n", "-i", str(SOURCE), "-map", "0:a:0", "-vn", "-ac", "1", "-ar",
        "16000", "-c:a", "pcm_s16le", str(AUDIO),
    ]
    receipt["audioExtractionCommand"] = command
    subprocess.run(command, check=True)
    receipt["audioSha256Before"] = sha(AUDIO)
    import numpy as np
    import mlx.core as mx
    import mlx_whisper
    receipt["pythonVersion"] = sys.version
    receipt["packages"] = {
        name: importlib.metadata.version(name)
        for name in ("mlx-whisper", "mlx", "numpy", "torch", "numba", "tiktoken", "huggingface-hub")
    }
    receipt["metalAvailable"] = mx.metal.is_available()
    with wave.open(str(AUDIO), "rb") as handle:
        assert handle.getnchannels() == 1
        assert handle.getsampwidth() == 2
        assert handle.getframerate() == 16000
        frames = handle.getnframes()
        samples = np.frombuffer(handle.readframes(frames), dtype="<i2").astype(np.float32) / 32768.0
        receipt["audioFrames"] = frames
        receipt["audioDurationSeconds"] = frames / 16000
    options = {
        "path_or_hf_repo": str(MODEL),
        "language": "zh",
        "task": "transcribe",
        "word_timestamps": True,
        "initial_prompt": None,
        "condition_on_previous_text": False,
        "temperature": 0.0,
        "verbose": True,
    }
    receipt["options"] = options
    emit("transcribing-offline")
    result = mlx_whisper.transcribe(samples, **options)
    raw_path = OUT / f"{PREFIX}.json"
    write_json(raw_path, result)
    with (OUT / f"{PREFIX}.txt").open("x", encoding="utf-8") as handle:
        handle.write(result["text"] + "\n")
    with (OUT / f"{PREFIX}.srt").open("x", encoding="utf-8") as handle:
        for index, segment in enumerate(result["segments"], 1):
            handle.write(f"{index}\n{srt_time(segment['start'])} --> {srt_time(segment['end'])}\n")
            handle.write(segment["text"].strip() + "\n\n")
    words = [
        {"segmentId": segment["id"], **word}
        for segment in result["segments"]
        for word in segment.get("words", [])
    ]
    write_json(OUT / f"{PREFIX}.words.json", {
        "schemaVersion": "local-whisper-words-candidate/v1",
        "sourceVideoSha256": EXPECTED_SOURCE_SHA,
        "rawResultSha256": sha(raw_path),
        "reviewStatus": "candidate-unreviewed",
        "words": words,
    })
    receipt.update({
        "outputs": [
            {"path": str(path), "sha256": sha(path), "bytes": path.stat().st_size}
            for path in (raw_path, OUT / f"{PREFIX}.txt", OUT / f"{PREFIX}.srt", OUT / f"{PREFIX}.words.json")
        ],
        "segmentCount": len(result["segments"]),
        "wordCount": len(words),
        "firstSegmentStart": result["segments"][0]["start"],
        "lastSegmentEnd": result["segments"][-1]["end"],
        "sourceSha256After": sha(SOURCE),
        "audioSha256After": sha(AUDIO),
        "endedAt": now(),
        "runDurationSeconds": round(time.monotonic() - STARTED, 3),
        "zeroDurationWordCount": sum(float(w["end"]) <= float(w["start"]) for w in words),
        "wordTimestampsAreAsrEstimates": True,
    })
    assert receipt["sourceSha256Before"] == receipt["sourceSha256After"]
    assert receipt["audioSha256Before"] == receipt["audioSha256After"]
    emit("completed-candidate-unreviewed")
except BaseException as error:
    receipt["error"] = {
        "type": type(error).__name__,
        "message": str(error),
        "traceback": traceback.format_exc(),
    }
    emit("failed")
    raise
