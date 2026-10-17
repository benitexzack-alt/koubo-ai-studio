"""本期 R2 成片技术检查；只读取候选片，不渲染、不校时、不改变原件。

用法：python3 check-video.py /绝对路径/候选片.mp4 --tag 首次1080p
每次必须使用新 tag；已存在的质检目录不会被覆盖。
"""

from pathlib import Path
from fractions import Fraction
import argparse
import hashlib
import json
import math
import re
import subprocess
import sys

import numpy as np


EXPECTED_FRAMES = 4126
EXPECTED_FPS = 30
AUDIO_WINDOWS = [(14, 17), (37, 40), (77, 80), (101, 104), (133, 136)]
FRAME_TIMES = [
    1, 10, 12.5, 22.5, 52, 55, 66.5, 66.6, 66.8, 67,
    69, 71, 73.9, 74.2, 74.4, 74.6, 90, 119.5, 136,
]


def run(args):
    result = subprocess.run(args, capture_output=True, check=False)
    if result.returncode:
        raise RuntimeError(
            f"命令失败（{result.returncode}）：{args!r}\n"
            + result.stderr.decode(errors="replace")
        )
    return result


def sha(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def pcm(path):
    result = run([
        "ffmpeg", "-v", "error", "-nostdin", "-i", str(path),
        "-map", "0:a:0", "-ac", "1", "-ar", "16000", "-f", "f32le", "-",
    ])
    return np.frombuffer(result.stdout, dtype="<f4")


def correlation(x, y):
    if x.size == 0 or y.size == 0 or x.std() == 0 or y.std() == 0:
        return None
    value = float(np.corrcoef(x, y)[0, 1])
    return value if math.isfinite(value) else None


def check_sync(reference, rendered):
    original_audio, output_audio = pcm(reference), pcm(rendered)
    results = []
    for start, end in AUDIO_WINDOWS:
        x = original_audio[start * 16000:end * 16000].astype("float64")
        y = output_audio[start * 16000:end * 16000].astype("float64")
        if len(x) != len(y) or len(x) != (end - start) * 16000:
            raise RuntimeError(f"音频窗口不完整：{start}–{end} 秒")
        x -= x.mean()
        y -= y.mean()
        size = 1 << (len(x) + len(y) - 2).bit_length()
        values = np.fft.irfft(
            np.conj(np.fft.rfft(x, size)) * np.fft.rfft(y, size), size
        )
        lags = np.arange(-3200, 3201)
        lag = int(lags[np.argmax(values[lags % size])])
        xx = x[max(0, -lag):len(x) - max(0, lag)]
        yy = y[max(0, lag):len(y) - max(0, -lag)]
        aligned = correlation(xx, yy)
        same_timestamp = correlation(x, y)
        results.append({
            "start": start,
            "end": end,
            "lagSamples16k": lag,
            "lagMs": lag / 16,
            "alignedCorrelation": aligned,
            "sameTimestampCorrelation": same_timestamp,
            "pass": abs(lag / 16) < 1 and aligned is not None and aligned > 0.98,
        })
    return results


def loudness_from_log(log):
    # loudnorm 的 input_* 是实际输入测量；output_* 只是 null 输出测量，
    # 不能写成候选片已经被响度标准化。
    for candidate in reversed(re.findall(r"\{[^{}]*\}", log, re.DOTALL)):
        try:
            parsed = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if "input_i" in parsed and "input_tp" in parsed:
            return {
                "integratedLufs": float(parsed["input_i"]),
                "truePeakDbtp": float(parsed["input_tp"]),
                "rangeLu": float(parsed["input_lra"]),
                "measurementOnly": True,
                "candidateAudioModified": False,
            }
    raise RuntimeError("未读到候选片的响度测量结果")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("video", type=Path, help="已导出的本期完整候选片路径")
    parser.add_argument("--tag", required=True, help="本次唯一标签；拒绝覆盖已有质检目录")
    folder = Path(__file__).resolve().parent
    episode = folder.parent.parent
    parser.add_argument(
        "--voice", type=Path,
        default=episode / "05_剪辑工程/public/audio/voice.m4a",
        help="本期原声参考；默认使用工程 voice.m4a",
    )
    args = parser.parse_args()
    if not re.fullmatch(r"[\w\-\u4e00-\u9fff]{1,80}", args.tag, flags=re.UNICODE):
        parser.error("tag 只能使用 1–80 个中文、字母、数字、下划线或短横线")
    video = args.video.expanduser().resolve()
    voice = args.voice.expanduser().resolve()
    if not video.is_file() or not voice.is_file():
        parser.error(f"视频或原声参考不存在：{video}；{voice}")
    qa = folder / ("质检_" + args.tag)
    if qa.exists():
        parser.error(f"质检目录已存在，请使用新 tag，旧结果未覆盖：{qa}")
    qa.mkdir(exist_ok=False)
    report_path = qa / "技术检查.v1.json"
    report = {
        "schemaVersion": "small-business-ai-r2-video-qa/v1",
        "tag": args.tag,
        "video": {"path": str(video), "sha256": sha(video), "bytes": video.stat().st_size},
        "voiceReference": {"path": str(voice), "sha256": sha(voice)},
        "expectedFrames": EXPECTED_FRAMES,
        "expectedFps": EXPECTED_FPS,
        "technicalChecksComplete": False,
        "automaticChecksPassed": False,
        "humanFullWatchConfirmed": False,
        "visualReviewPerformed": False,
        "formalAccepted": False,
        "publishAuthorized": False,
        "scopeNote": "机器解码、黑帧、静音、响度和音频延迟检查；不代替内容、视觉、音效可感知或人审验收。",
    }
    try:
        probe = json.loads(run([
            "ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", str(video)
        ]).stdout)
        report["probe"] = probe
        stream = next(s for s in probe["streams"] if s["codec_type"] == "video")
        frame_count = int(stream.get("nb_frames", "0"))
        fps = Fraction(stream["avg_frame_rate"])
        duration = float(probe["format"]["duration"])
        metadata_pass = (
            (stream["width"], stream["height"]) in {(1920, 1080), (1280, 720)}
            and fps == EXPECTED_FPS
            and frame_count == EXPECTED_FRAMES
            and abs(duration - EXPECTED_FRAMES / EXPECTED_FPS) <= 0.1
        )
        report["metadataPass"] = metadata_pass
        report["durationSeconds"] = duration
        decode = ["ffmpeg", "-nostdin", "-v", "error", "-xerror", "-i", str(video), "-f", "null", "-"]
        decoded = run(decode)
        (qa / "完整解码日志.txt").write_text(decoded.stderr.decode(errors="replace"))
        report["decodeCommand"] = decode
        report["fullDecode"] = True
        checks = run([
            "ffmpeg", "-nostdin", "-hide_banner", "-i", str(video),
            "-vf", "blackdetect=d=0.15:pix_th=0.1:pic_th=0.98",
            "-af", "silencedetect=n=-50dB:d=2,loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json",
            "-f", "null", "-",
        ])
        diagnostics = checks.stderr.decode(errors="replace")
        (qa / "黑帧静音响度日志.txt").write_text(diagnostics)
        report["blackSegments"] = [line for line in diagnostics.splitlines() if "black_start:" in line]
        report["silenceSegments"] = [
            line for line in diagnostics.splitlines()
            if "silence_start:" in line or "silence_end:" in line
        ]
        report["loudness"] = loudness_from_log(diagnostics)
        loudness_finite = all(
            math.isfinite(report["loudness"][key])
            for key in ["integratedLufs", "truePeakDbtp", "rangeLu"]
        )
        if not loudness_finite:
            for key in ["integratedLufs", "truePeakDbtp", "rangeLu"]:
                if not math.isfinite(report["loudness"][key]):
                    report["loudness"][key] = None
            raise RuntimeError("候选片响度出现非有限值，请检查静音或损坏音轨")
        report["syncWindows"] = check_sync(voice, video)
        report["syncMethod"] = "16kHz单声道，五个避开纸艺原生音的窗口，±200毫秒互相关；正延迟表示成片相对原声滞后。"
        report["sameTimestampSyncPass"] = all(w["pass"] for w in report["syncWindows"])
        frames = []
        for index, time in enumerate(FRAME_TIMES):
            output = qa / f"{index:02d}_{time:.3f}s.jpg"
            run([
                "ffmpeg", "-nostdin", "-v", "error", "-n", "-ss", str(time),
                "-i", str(video), "-frames:v", "1", "-q:v", "2", str(output),
            ])
            frames.append(str(output))
        contact_sheet = qa / "关键帧联系表.jpg"
        run([
            "magick", "montage", "-font", "/System/Library/Fonts/Supplemental/Arial.ttf",
            "-pointsize", "16", "-label", "%f", *frames,
            "-geometry", "426x240+4+8", "-tile", "3x", "-background", "#222222", "-fill", "white",
            str(contact_sheet),
        ])
        report["frameContactSheet"] = str(contact_sheet)
        report["checkedFrames"] = FRAME_TIMES
        report["sourceFilesUnchanged"] = (
            sha(video) == report["video"]["sha256"]
            and sha(voice) == report["voiceReference"]["sha256"]
        )
        report["technicalChecksComplete"] = True
        report["automaticChecksPassed"] = all([
            metadata_pass,
            report["fullDecode"],
            not report["blackSegments"],
            not report["silenceSegments"],
            report["sameTimestampSyncPass"],
            report["sourceFilesUnchanged"],
            loudness_finite,
        ])
    except Exception as error:
        report["error"] = f"{type(error).__name__}: {error}"
        report["automaticChecksPassed"] = False
        (qa / "失败说明.txt").write_text(report["error"] + "\n")
    finally:
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False) + "\n")
    print(json.dumps({
        "report": str(report_path),
        "technicalChecksComplete": report["technicalChecksComplete"],
        "automaticChecksPassed": report["automaticChecksPassed"],
        "humanFullWatchConfirmed": False,
        "error": report.get("error"),
    }, ensure_ascii=False, indent=2))
    return 0 if report["automaticChecksPassed"] else 1


if __name__ == "__main__":
    sys.exit(main())
