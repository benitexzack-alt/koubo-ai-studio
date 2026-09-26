#!/usr/bin/env python3
"""只读音频技术检查。只生成本目录 JSON；不作人耳听审结论。"""
from __future__ import annotations

import hashlib
import json
import re
import subprocess
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import numpy as np
from scipy import signal

ROOT = Path(__file__).resolve().parent
ORIGINAL = Path("/Users/pc/Downloads/9月26日.mp3")
ASSET = ROOT / "public/music-pilot.wav"
FINAL = ROOT / "exports/工业革命_电气到数字_28秒试片_R1.mp4"
REPORT = ROOT / "音频与卡点技术检查.json"
SAMPLE_RATE = 22050
SOURCE_START = 72.0
SOURCE_END = 100.0
FPS = 30.0


def r(value: float, digits: int = 8) -> float:
    return round(float(value), digits)


def sha(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for data in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(data)
    return digest.hexdigest()


def probe(path: Path) -> dict:
    raw = subprocess.check_output([
        "ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", str(path)
    ])
    return json.loads(raw)


def decode(path: Path, trim: tuple[float, float] | None = None) -> np.ndarray:
    command = ["ffmpeg", "-v", "error", "-i", str(path), "-vn"]
    if trim is not None:
        command += ["-af", f"atrim=start={trim[0]}:end={trim[1]},asetpts=PTS-STARTPTS"]
    command += ["-ac", "1", "-ar", str(SAMPLE_RATE), "-f", "f32le", "pipe:1"]
    return np.frombuffer(subprocess.check_output(command), dtype=np.float32).copy()


def compare(actual: np.ndarray, expected: np.ndarray) -> dict:
    """正延迟代表成片声音晚于源音频，对应事件应加上这个延迟。"""
    stride = 4
    cross = signal.correlate(actual[::stride], expected[::stride], mode="full", method="fft")
    lag_values = signal.correlation_lags(len(actual[::stride]), len(expected[::stride]), mode="full")
    allowed = np.abs(lag_values) <= SAMPLE_RATE / stride * .75
    approximate = int(lag_values[allowed][np.argmax(cross[allowed])]) * stride
    margin = round(.20 * SAMPLE_RATE)

    def aligned(lag: int):
        a = actual[max(lag, 0):]
        b = expected[max(-lag, 0):]
        count = min(len(a), len(b))
        a = a[margin:count - margin].astype(np.float64)
        b = b[margin:count - margin].astype(np.float64)
        return a, b

    options = []
    for lag in range(approximate - stride, approximate + stride + 1):
        a, b = aligned(lag)
        options.append((float(np.corrcoef(a, b)[0, 1]), lag))
    correlation, lag = max(options)
    a, b = aligned(lag)
    gain = np.dot(a, b) / np.dot(b, b)
    residual = a - b * gain
    windows = []
    for start in range(0, len(a), 4 * SAMPLE_RATE):
        stop = min(start + 4 * SAMPLE_RATE, len(a))
        left, right = a[start:stop], b[start:stop]
        windows.append({
            "aligned_start_s": r(.2 + start / SAMPLE_RATE),
            "aligned_end_s": r(.2 + stop / SAMPLE_RATE),
            "correlation": r(np.corrcoef(left, right)[0, 1]),
        })
    return {
        "method": "单声道解码波形互相关；搜索正负0.75秒，采样级细化；两端各排除0.2秒淡化区域",
        "comparison_sample_rate_hz": SAMPLE_RATE,
        "actual_delay_relative_to_expected_samples": lag,
        "actual_delay_relative_to_expected_s": r(lag / SAMPLE_RATE),
        "delay_sign_explanation": "正值表示成片声音相对期望源音频延后，负值表示提前",
        "aligned_correlation": r(correlation),
        "least_squares_gain_ratio": r(gain),
        "least_squares_gain_db": r(20 * np.log10(abs(gain))),
        "gain_compensated_residual_rms_ratio": r(np.sqrt(np.mean(residual ** 2) / np.mean(a ** 2))),
        "compared_duration_s": r(len(a) / SAMPLE_RATE),
        "four_second_windows": windows,
    }


def loudness(path: Path) -> dict:
    process = subprocess.run([
        "ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-vn", "-af",
        "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"
    ], capture_output=True, text=True, check=True)
    data = json.loads(re.findall(r"\{[^{}]*\}", process.stderr)[-1])
    return {
        "method": "FFmpeg loudnorm 输入测量，输出丢弃，不保存归一化音频",
        "integrated_lufs": float(data["input_i"]),
        "true_peak_dbtp": float(data["input_tp"]),
        "loudness_range_lu": float(data["input_lra"]),
        "gated_threshold_lufs": float(data["input_thresh"]),
    }


def main() -> None:
    for path in (ORIGINAL, ASSET, FINAL):
        if not path.is_file():
            raise FileNotFoundError(f"等待主代理确认最终产物生成后再运行，当前文件缺失：{path}")

    source_probe, asset_probe, final_probe = probe(ORIGINAL), probe(ASSET), probe(FINAL)
    source_audio = decode(ORIGINAL, (SOURCE_START, SOURCE_END))
    asset_audio, final_audio = decode(ASSET), decode(FINAL)
    source_match = compare(final_audio, source_audio)
    asset_match = compare(final_audio, asset_audio)
    asset_source_match = compare(asset_audio, source_audio)
    final_loudness, asset_loudness = loudness(FINAL), loudness(ASSET)
    audio = next(s for s in final_probe["streams"] if s["codec_type"] == "audio")
    video = next(s for s in final_probe["streams"] if s["codec_type"] == "video")
    expected_duration = SOURCE_END - SOURCE_START
    delay = source_match["actual_delay_relative_to_expected_s"]
    hit_points = []
    for frame, source_time in [(170, 77.682358), (649, 93.622857)]:
        visual_time = frame / FPS
        expected_music_time = source_time - SOURCE_START
        aligned_music_time = expected_music_time + delay
        error = visual_time - aligned_music_time
        hit_points.append({
            "declared_visual_frame": frame,
            "declared_source_music_time_s": source_time,
            "visual_time_s": r(visual_time),
            "source_event_relative_time_s": r(expected_music_time),
            "music_event_time_after_measured_delay_s": r(aligned_music_time),
            "visual_minus_audio_s": r(error),
            "visual_minus_audio_frames": r(error * FPS),
            "absolute_error_within_one_frame": abs(error) <= 1 / FPS,
            "interpretation": "仅验证主代理提供的事件帧与音乐时间戳在时间轴上是否对齐，未判定声画审美或人耳卡点效果",
        })

    output = {
        "schema": "industrial-pilot-audio-qa/v1",
        "status": "技术测量完成，未做人耳听审或用户验收",
        "measured_at": datetime.now(ZoneInfo("Asia/Shanghai")).isoformat(),
        "files": [{"role": role, "path": str(path), "sha256": sha(path), "probe": metadata}
                  for role, path, metadata in [("原始音乐", ORIGINAL, source_probe), ("剪裁后制作音频", ASSET, asset_probe), ("最终试片", FINAL, final_probe)]],
        "expected": {
            "source_trim_start_s": SOURCE_START, "source_trim_end_s": SOURCE_END,
            "duration_s": expected_duration, "fps": FPS, "frame_count": 840,
            "speed": 1, "asset_gain_db": -3, "fade_in_s": .030, "fade_out_s": .080,
            "alignment_tolerance_frames": 1,
        },
        "observed": {
            "container_duration_s": float(final_probe["format"]["duration"]),
            "video_duration_s": float(video["duration"]),
            "audio_duration_s": float(audio["duration"]),
            "video_frame_count": int(video["nb_frames"]) if "nb_frames" in video else None,
            "video_avg_frame_rate": video["avg_frame_rate"],
            "audio_codec": audio["codec_name"],
            "audio_sample_rate_hz": int(audio["sample_rate"]),
            "audio_channels": audio["channels"],
            "decoded_mono_duration_s": r(len(final_audio) / SAMPLE_RATE),
        },
        "final_vs_original_72_100s": source_match,
        "final_vs_production_wav": asset_match,
        "production_wav_vs_original_72_100s": asset_source_match,
        "loudness": {"final": final_loudness, "production_wav": asset_loudness},
        "declared_cue_alignment": hit_points,
        "technical_checks": {
            "video_duration_within_one_frame": abs(float(video["duration"]) - expected_duration) <= 1 / FPS,
            "declared_hit_points_within_one_frame": all(p["absolute_error_within_one_frame"] for p in hit_points),
            "waveform_correlation_at_least_0_98": source_match["aligned_correlation"] >= .98,
            "production_wav_gain_within_0_25db_of_minus3": abs(asset_source_match["least_squares_gain_db"] + 3) <= .25,
            "final_gain_within_0_25db_of_production_wav": abs(asset_match["least_squares_gain_db"]) <= .25,
            "final_true_peak_at_most_minus1_dbtp": final_loudness["true_peak_dbtp"] <= -1,
            "criteria_scope": "波形相关与增益阈值是本次技术诊断标准，不代表听感、内容或用户验收。淡入淡出参数来自既定制作方案，未单独反演其包络曲线。",
        },
        "human_listening_performed": False,
        "user_acceptance_recorded": False,
        "limitations": [
            "单声道相关性用于识别时间轴和匹配关系，不单独证明立体声像正确。",
            "不判定原始曲名、曲风、授权或最终审美质量。",
            "采样级对齐为整体固定延迟估计；四秒窗口相关性辅助发现内容差异，不等于独立动态速度测量。",
        ],
    }
    REPORT.write_text(json.dumps(output, ensure_ascii=False, indent=2, allow_nan=False) + "\n")
    print(json.dumps({"report": str(REPORT), "source_match": source_match, "loudness": final_loudness,
                      "hit_points": hit_points, "technical_checks": output["technical_checks"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
