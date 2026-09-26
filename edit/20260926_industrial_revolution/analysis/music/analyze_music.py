#!/usr/bin/env python3
"""Local, reproducible analysis. Beat/section outputs are unreviewed candidates."""
import csv
import hashlib
import json
import re
import subprocess
from pathlib import Path

import librosa
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from scipy import signal

ROOT = Path(__file__).resolve().parent
MUSIC = Path("/Users/pc/Downloads/9月26日.mp3")
REFERENCE = Path("/Users/pc/Downloads/v1e00fgi0000daposafog65oktmdto4g.MP4")
SR = 22050
HOP = 256
plt.rcParams["font.family"] = "PingFang SC"
plt.rcParams["axes.unicode_minus"] = False

def probe(path):
    return json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", str(path)
    ]))

def decode(path):
    return np.frombuffer(subprocess.check_output([
        "ffmpeg", "-v", "error", "-i", str(path), "-vn", "-ac", "1", "-ar", str(SR),
        "-f", "f32le", "pipe:1"
    ]), dtype=np.float32).copy()

def rounded(value):
    return round(float(value), 6)

def loudness(path):
    result = subprocess.run([
        "ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af",
        "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"
    ], capture_output=True, text=True, check=True)
    data = json.loads(re.findall(r"\{[^{}]*\}", result.stderr)[-1])
    return {
        "method": "FFmpeg loudnorm 第一遍输入测量；输出丢弃，没有修改原件",
        "integrated_loudness_lufs": float(data["input_i"]),
        "true_peak_dbtp": float(data["input_tp"]),
        "loudness_range_lu": float(data["input_lra"]),
        "gated_threshold_lufs": float(data["input_thresh"]),
        "measurement_only": True,
        "raw_ffmpeg_result": data,
        "note": "原始混音已接近或超过数字满刻度时，后续需预留混音余量；测量不能单独证明可闻削波。"
    }

def compare(a, b):
    # Find a constant encoding delay using 60 seconds, then test the entire track.
    stride = 4
    qa = a[:SR * 60:stride]
    qb = b[:SR * 60:stride]
    corr = signal.correlate(qa, qb, mode="full", method="fft")
    lags = signal.correlation_lags(len(qa), len(qb), mode="full")
    allowed = np.abs(lags) <= SR / stride * 2
    lag0 = int(lags[allowed][np.argmax(corr[allowed])]) * stride
    candidates = []
    for lag in range(lag0 - stride, lag0 + stride + 1):
        x = a[max(lag, 0):]
        y = b[max(-lag, 0):]
        n = min(len(x), len(y), SR * 30)
        candidates.append((float(np.corrcoef(x[:n], y[:n])[0, 1]), lag))
    _, lag = max(candidates)
    x = a[max(lag, 0):]
    y = b[max(-lag, 0):]
    n = min(len(x), len(y))
    x, y = x[:n].astype(np.float64), y[:n].astype(np.float64)
    gain = np.dot(x, y) / np.dot(y, y)
    residual = x - gain * y
    windows = []
    for start in range(0, n, SR * 10):
        stop = min(n, start + SR * 10)
        xs, ys = x[start:stop], y[start:stop]
        active = np.std(xs) > 1e-10 and np.std(ys) > 1e-10
        windows.append({"start_s": rounded(start / SR), "end_s": rounded(stop / SR),
                        "correlation": rounded(np.corrcoef(xs, ys)[0, 1]) if active else None,
                        "status": "compared" if active else "silence-not-correlated"})
    return {
        "method": "decoded mono waveform cross-correlation; constant delay compensation; whole-track and 10-second correlation",
        "music_delay_relative_to_reference_s": rounded(lag / SR),
        "aligned_duration_s": rounded(n / SR),
        "aligned_waveform_correlation": rounded(np.corrcoef(x, y)[0, 1]),
        "least_squares_music_gain_relative_to_reference": rounded(gain),
        "gain_compensated_residual_rms_relative_to_music_rms": rounded(np.sqrt(np.mean(residual ** 2) / np.mean(x ** 2))),
        "windows": windows,
        "interpretation": "High whole-track and window correlations support matching underlying audio; not a provenance or license determination."
    }

def main():
    a, b = decode(MUSIC), decode(REFERENCE)
    match = compare(a, b)
    print(json.dumps({"same_source_analysis": match}, ensure_ascii=False), flush=True)
    onset = librosa.onset.onset_strength(y=a, sr=SR, hop_length=HOP)
    tempo, beat_frames = librosa.beat.beat_track(onset_envelope=onset, sr=SR, hop_length=HOP, trim=False)
    beats = librosa.frames_to_time(beat_frames, sr=SR, hop_length=HOP)
    rms = librosa.feature.rms(y=a, frame_length=2048, hop_length=HOP)[0]
    times = librosa.frames_to_time(np.arange(len(rms)), sr=SR, hop_length=HOP)
    onset_times = librosa.frames_to_time(np.arange(len(onset)), sr=SR, hop_length=HOP)
    local_tempos = []
    for start in range(0, int(len(a) / SR), 15):
        seg = onset[(onset_times >= start) & (onset_times < start + 30)]
        if len(seg) >= 200:
            t = librosa.feature.tempo(onset_envelope=seg, sr=SR, hop_length=HOP)
            local_tempos.append({"start_s": start, "end_s": min(start + 30, rounded(len(a) / SR)), "tempo_bpm_candidate": rounded(t[0])})
    peaks, _ = signal.find_peaks(onset, distance=max(1, round(1.0 * SR / HOP)), prominence=np.percentile(onset, 65) * .5)
    strong = sorted(peaks, key=lambda i: float(onset[i]), reverse=True)[:45]
    transients = [{"time_s": rounded(onset_times[i]), "onset_strength": rounded(onset[i])} for i in sorted(strong)]
    energy = []
    for start in np.arange(0, len(a) / SR, 5):
        values = rms[(times >= start) & (times < start + 5)]
        energy.append({"start_s": rounded(start), "end_s": rounded(min(start + 5, len(a) / SR)),
                       "rms": rounded(np.sqrt(np.mean(values ** 2))),
                       "rms_dbfs_mono": rounded(20 * np.log10(max(1e-12, np.sqrt(np.mean(values ** 2)))) )})
    # Structural candidates: large changes in a smoothed spectral vector, not guaranteed bar lines.
    mel = librosa.feature.melspectrogram(y=a, sr=SR, hop_length=HOP, n_mels=32)
    logmel = librosa.power_to_db(mel, ref=np.max)
    window = max(1, round(2 * SR / HOP))
    smooth = np.stack([np.convolve(row, np.ones(window) / window, mode="same") for row in logmel])
    delta = np.sqrt(np.mean((smooth[:, window:] - smooth[:, :-window]) ** 2, axis=0))
    dtimes = librosa.frames_to_time(np.arange(len(delta)) + window // 2, sr=SR, hop_length=HOP)
    dp, _ = signal.find_peaks(delta, distance=round(8 * SR / HOP))
    dp = [i for i in dp if 5 < dtimes[i] < len(a) / SR - 5]
    dp = sorted(dp, key=lambda i: float(delta[i]), reverse=True)[:14]
    sections = [{"time_s": rounded(dtimes[i]), "spectral_change_score": rounded(delta[i])} for i in sorted(dp)]
    ibi = np.diff(beats)
    valid_grid = (beats >= 1) & (beats <= 176)
    slope, offset = np.polyfit(np.arange(len(beats))[valid_grid], beats[valid_grid], 1)
    grid_error = beats[valid_grid] - (offset + slope * np.arange(len(beats))[valid_grid])
    report = {
        "schema": "local-music-analysis/v1",
        "status": "algorithmic-candidates-awaiting-listening-review",
        "sources": [{"path": str(p), "sha256": hashlib.sha256(p.read_bytes()).hexdigest(), "probe": probe(p)} for p in [MUSIC, REFERENCE]],
        "analysis_sample_rate": SR, "hop_length": HOP,
        "decoded_music_duration_s": rounded(len(a) / SR),
        "same_source_analysis": match,
        "loudness": loudness(MUSIC),
        "tempo": {"global_bpm_candidate": rounded(np.asarray(tempo).reshape(-1)[0]),
                  "fitted_grid_bpm_candidate": rounded(60 / slope),
                  "fitted_grid_offset_s": rounded(offset),
                  "fitted_grid_median_absolute_error_s": rounded(np.median(np.abs(grid_error))),
                  "fitted_grid_window_s": [1, 176],
                  "beat_candidate_count": len(beats), "median_interbeat_s": rounded(np.median(ibi)),
                  "interbeat_p10_s": rounded(np.percentile(ibi, 10)), "interbeat_p90_s": rounded(np.percentile(ibi, 90)),
                  "local_windows": local_tempos,
                  "warning": "Beat tracker can choose half/double tempo and miss rubato, downbeats, or percussion-free passages. Never treat these as approved cut points."},
        "strong_onset_candidates": transients,
        "section_change_candidates": sections,
        "five_second_energy_windows": energy,
        "beat_candidates_s": [rounded(t) for t in beats],
        "editorial_boundaries": {"suggested_full_track_end_s": 180.4, "music_speed_change_needed": False,
                                 "listening_review_required": True, "bar_downbeats_confirmed": False,
                                 "music_identity_confirmed": False, "license_confirmed": False},
        "artifacts": ["beat-candidates.csv", "energy-and-onsets.png"]
    }
    speech = ROOT / "speech-check-full-track.json"
    if speech.exists():
        speech_result = json.loads(speech.read_text())
        report["speech_check"] = {
            "method": "本机 whisper.cpp small 全曲离线识别，指定中文，无提示词，无外传",
            "raw_result": str(speech),
            "segments": [{"from_ms": s["offsets"]["from"], "to_ms": s["offsets"]["to"], "text": s["text"]} for s in speech_result["transcription"]],
            "interpretation": "未检出连贯中文旁白。反复同文与末尾孤立短词疑似音乐识别幻觉，不能用作字幕、曲名或曲风证据。该结果不等于听审证实全程无人声。",
            "continuous_chinese_narration_detected": False,
            "absence_of_voice_confirmed": False,
            "human_listening_required": True
        }
    (ROOT / "music-analysis.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    with (ROOT / "beat-candidates.csv").open("w", newline="") as f:
        writer = csv.writer(f, lineterminator="\n")
        writer.writerow(["candidate_index", "time_seconds", "nearest_frame_30fps", "review_status"])
        writer.writerows((i + 1, rounded(t), round(t * 30), "algorithmic_candidate") for i, t in enumerate(beats))
    fig, axes = plt.subplots(3, 1, figsize=(16, 8), sharex=True, constrained_layout=True)
    take = max(1, SR // 250)
    axes[0].plot(np.arange(0, len(a), take) / SR, a[::take], lw=.25, color="#3574b8")
    axes[0].set_ylabel("单声道振幅")
    axes[0].set_title("用户指定音乐：波形、能量与瞬态候选（算法分析，待听审）")
    axes[1].plot(times, 20 * np.log10(np.maximum(rms, 1e-6)), color="#df7b25", lw=.8)
    axes[1].set_ylabel("均方根电平（dBFS）")
    axes[1].set_ylim(-60, 0)
    axes[2].plot(onset_times, onset, color="#8062bb", lw=.5)
    axes[2].scatter([x["time_s"] for x in transients], [x["onset_strength"] for x in transients], color="#de4747", s=14)
    for x in sections:
        axes[1].axvline(x["time_s"], color="#888888", alpha=.45, ls="--", lw=.6)
    axes[2].set_ylabel("瞬态强度")
    axes[2].set_xlabel("时间（秒）")
    for ax in axes:
        ax.set_xlim(0, 180.5)
        ax.set_xticks(np.arange(0, 181, 10))
        ax.grid(alpha=.2)
    fig.savefig(ROOT / "energy-and-onsets.png", dpi=140)
    print(json.dumps({"tempo": report["tempo"], "sections": sections, "strongest_onsets": sorted(transients, key=lambda x:x["onset_strength"], reverse=True)[:12], "artifacts_dir": str(ROOT)}, ensure_ascii=False), flush=True)

if __name__ == "__main__":
    main()
