#!/usr/bin/env python3
"""为 Henri 风格代码动画合成本地音乐与动作音效，不含旁白。"""

from array import array
import json
import math
from pathlib import Path
import random
import sys
import wave


RATE = 48_000
DURATION = 26.0
FRAMES = int(RATE * DURATION)
TAU = math.tau
OUT_DIR = Path(__file__).resolve().parent
RNG = random.Random(20261003)
music_l = array("f", [0.0]) * FRAMES
music_r = array("f", [0.0]) * FRAMES
effects_l = array("f", [0.0]) * FRAMES
effects_r = array("f", [0.0]) * FRAMES

EVENTS = [
    {"id": "paper_open", "time": 0.5, "duration": 0.72, "action": "纸页展开", "sound": "柔和纸张摩擦与掀开"},
    {"id": "bulb_on", "time": 2.0, "duration": 0.66, "action": "灯泡点亮", "sound": "轻咔哒与两音暖铃"},
    {"id": "bridge_board", "time": 4.4, "duration": 0.42, "action": "桥板落位", "sound": "纸板落位与木质轻敲"},
    {"id": "cart_test", "time": 6.3, "duration": 1.10, "action": "小车试走", "sound": "轻轮声与稀疏像素短音"},
    {"id": "collapse", "time": 8.4, "duration": 1.12, "action": "坍塌与轻微出错", "sound": "纸板散落、低落地声与温和下行音"},
    {"id": "page_turn", "time": 10.7, "duration": 0.72, "action": "纸页掀动转场", "sound": "纸张翻动"},
    {"id": "pillar_one", "time": 12.0, "duration": 0.42, "action": "第一根支柱落位", "sound": "轻敲与低音木琴"},
    {"id": "pillar_two", "time": 13.1, "duration": 0.42, "action": "第二根支柱落位", "sound": "轻敲与中音木琴"},
    {"id": "pillar_three", "time": 14.2, "duration": 0.42, "action": "第三根支柱落位", "sound": "轻敲与高音木琴"},
    {"id": "connection", "time": 15.5, "duration": 0.35, "action": "连接咔哒", "sound": "两次温和卡扣声"},
    {"id": "cart_launch", "time": 17.0, "duration": 2.75, "action": "试车出发", "sound": "轻轮声与缓慢上行短音"},
    {"id": "arrival", "time": 20.4, "duration": 0.84, "action": "到达与灯亮", "sound": "落位咔哒与明亮暖铃"},
    {"id": "final_scene", "time": 22.3, "duration": 0.62, "action": "向终景切换", "sound": "柔和纸张擦动"},
    {"id": "success", "time": 24.4, "duration": 1.12, "action": "短成功音", "sound": "克制的三音上行与尾音"},
]


def midi(number):
    return 440.0 * 2.0 ** ((number - 69.0) / 12.0)


def add(start, duration, signal, amp, pan=0.0, effect=True):
    """采用等功率声像；时间由样本索引固定，便于画面同步。"""
    left, right = (effects_l, effects_r) if effect else (music_l, music_r)
    first = max(0, round(start * RATE))
    length = min(round(duration * RATE), FRAMES - first)
    gain_l = math.cos((pan + 1.0) * math.pi / 4.0) * amp
    gain_r = math.sin((pan + 1.0) * math.pi / 4.0) * amp
    for i in range(length):
        value = signal(i / RATE, i)
        left[first + i] += value * gain_l
        right[first + i] += value * gain_r


def pluck(start, note, duration=0.6, amp=0.04, pan=0.0, effect=True, pixel=False):
    freq = midi(note)

    def signal(t, _):
        attack = min(1.0, t / 0.006)
        tail = min(1.0, max(0.0, (duration - t) / 0.06))
        envelope = attack * tail * math.exp(-t * 5.0 / duration)
        phase = TAU * freq * t
        # 正弦为主，少量奇次谐波给出轻巧像素感，避免尖锐方波。
        timbre = math.sin(phase) + (0.10 if pixel else 0.05) * math.sin(3.0 * phase)
        timbre += 0.08 * math.sin(2.01 * phase) * math.exp(-t * 12.0)
        return envelope * timbre

    add(start, duration, signal, amp, pan, effect)


def paper(start, duration=0.6, amp=0.18, pan=0.0):
    low = 0.0
    smoother = 0.0
    last = 0.0

    def signal(t, _):
        nonlocal low, smoother, last
        noise = RNG.uniform(-1.0, 1.0)
        low += 0.045 * (noise - low)
        smoother += 0.21 * (noise - smoother)
        last += 0.018 * (smoother - last)
        # 中低频带通噪声，淡化刮擦的高频。
        texture = 1.6 * (smoother - last) + 0.25 * low
        progress = t / duration
        envelope = math.sin(math.pi * progress) ** 1.8
        flutter = 0.76 + 0.24 * math.sin(TAU * 8.0 * t)
        return texture * envelope * flutter

    add(start, duration, signal, amp, pan)


def tap(start, amp=0.13, pitch=190.0, duration=0.22, pan=0.0):
    low = 0.0

    def signal(t, _):
        nonlocal low
        low += 0.10 * (RNG.uniform(-1.0, 1.0) - low)
        envelope = min(1.0, t / 0.002) * math.exp(-t * 25.0)
        tail = min(1.0, max(0.0, (duration - t) / 0.04))
        body = math.sin(TAU * pitch * t) * math.exp(-t * 14.0)
        return tail * envelope * (0.68 * body + 0.9 * low)

    add(start, duration, signal, amp, pan)


def wheels(start, duration, amp=0.085, end_pan=0.42):
    low = 0.0

    def signal(t, _):
        nonlocal low
        low += 0.032 * (RNG.uniform(-1.0, 1.0) - low)
        edge = min(1.0, t / 0.13, (duration - t) / 0.22)
        pulses = 0.55 + 0.45 * math.sin(TAU * (9.0 * t + 0.9 * t * t)) ** 2
        return max(0.0, edge) * (low * 1.8 + 0.08 * math.sin(TAU * 115.0 * t)) * pulses

    add(start, duration, signal, amp, end_pan)
    for i in range(int(duration * 6)):
        when = start + 0.04 + i / 6.0
        tap(when, amp=amp * 0.30, pitch=260.0 + i * 3.0, duration=0.075, pan=end_pan)


def build_music():
    # 温暖、稀疏的 C 大调音乐底，84 BPM；动画动作始终高于伴奏。
    chord_blocks = [(0.0, 4.4, (48, 55, 64)), (4.4, 6.3, (45, 52, 60)),
                    (6.3, 4.0, (53, 60, 65)), (10.3, 5.2, (48, 55, 64)),
                    (15.5, 5.1, (43, 55, 62)), (20.6, 5.4, (48, 55, 64))]
    for start, duration, notes in chord_blocks:
        for voice, note in enumerate(notes):
            freq = midi(note)

            def pad(t, _, frequency=freq, length=duration, offset=voice * 0.31):
                envelope = min(1.0, t / 0.6, (length - t) / 0.85)
                wave_value = math.sin(TAU * frequency * t + offset)
                wave_value += 0.11 * math.sin(TAU * 2.0 * frequency * t + offset)
                return max(0.0, envelope) * wave_value

            add(start, duration, pad, 0.014, (voice - 1) * 0.36, effect=False)

    beat = 60.0 / 84.0
    melody = [64, None, 67, 69, None, 67, 64, None, 62, None, 64, 67, None, 64, 60, None]
    for i in range(35):
        when = 0.2 + i * beat
        if 8.2 <= when <= 10.7 or when >= 24.0:
            continue
        note = melody[i % len(melody)]
        if note is not None:
            pluck(when, note, duration=0.72, amp=0.027, pan=0.22 if i % 2 else -0.22, effect=False, pixel=True)
        if i % 2 == 0:
            pluck(when, 48 if i % 8 < 4 else 53, duration=0.65, amp=0.019, pan=-0.1, effect=False)


def build_effects():
    paper(0.5, 0.72, 0.20, -0.2)
    tap(2.0, 0.085, 410.0, 0.12)
    pluck(2.045, 72, 0.55, 0.09, -0.08)
    pluck(2.17, 76, 0.46, 0.065, 0.08)
    tap(4.4, 0.19, 180.0, 0.3, -0.12)
    paper(4.41, 0.24, 0.07, -0.12)
    wheels(6.3, 1.1, 0.08, 0.12)
    pluck(6.31, 60, 0.3, 0.045, -0.12, pixel=True)
    pluck(6.75, 64, 0.3, 0.045, 0.1, pixel=True)
    for i, delay in enumerate((0.0, 0.095, 0.22, 0.36)):
        tap(8.4 + delay, 0.19 - i * 0.025, 180.0 - i * 21.0, 0.34, (i - 1.5) * 0.16)
    paper(8.44, 0.6, 0.15, 0.12)
    pluck(8.83, 59, 0.30, 0.064, pixel=True)
    pluck(9.02, 56, 0.49, 0.056, pixel=True)
    paper(10.7, 0.72, 0.20, 0.17)
    for when, note, pan in ((12.0, 60, -0.28), (13.1, 64, 0.0), (14.2, 67, 0.28)):
        tap(when, 0.14, 210.0, 0.25, pan)
        pluck(when + 0.025, note, 0.39, 0.072, pan)
    tap(15.5, 0.135, 330.0, 0.17, -0.08)
    tap(15.62, 0.10, 430.0, 0.16, 0.08)
    wheels(17.0, 2.75, 0.084, 0.35)
    for i, note in enumerate((60, 64, 67)):
        pluck(17.0 + i * 0.4, note, 0.42, 0.047, -0.18 + i * 0.18, pixel=True)
    tap(20.4, 0.11, 280.0, 0.22, 0.25)
    for i, note in enumerate((72, 76, 79)):
        pluck(20.43 + i * 0.105, note, 0.58, 0.058, 0.15 + i * 0.05)
    paper(22.3, 0.62, 0.14, -0.12)
    for i, note in enumerate((64, 67, 72)):
        pluck(24.4 + i * 0.16, note, 0.80, 0.067, -0.16 + i * 0.16, pixel=True)


def dbfs(value):
    return round(20.0 * math.log10(max(value, 1e-12)), 3)


def export():
    mix_l = array("f", [0.0]) * FRAMES
    mix_r = array("f", [0.0]) * FRAMES
    peak = 0.0
    music_energy = 0.0
    effect_energy = 0.0
    for i in range(FRAMES):
        t = i / RATE
        fade = max(0.0, min(1.0, t / 0.25, (DURATION - t) / 0.55))
        duck = 1.0
        for event in EVENTS:
            elapsed = t - event["time"]
            if -0.045 <= elapsed <= event["duration"] + 0.13:
                attack = min(1.0, max(0.0, (elapsed + 0.045) / 0.045))
                release = min(1.0, max(0.0, (event["duration"] + 0.13 - elapsed) / 0.13))
                duck = min(duck, 1.0 - 0.36 * attack * release)
        if 8.25 <= t <= 10.4:
            duck = min(duck, 0.48)
        ml, mr = music_l[i] * duck * fade, music_r[i] * duck * fade
        sl, sr = effects_l[i] * fade, effects_r[i] * fade
        mix_l[i], mix_r[i] = ml + sl, mr + sr
        peak = max(peak, abs(mix_l[i]), abs(mix_r[i]))
        music_energy += ml * ml + mr * mr
        effect_energy += sl * sl + sr * sr

    # 最高采样峰值固定在约 -6 dBFS，保留叠加和后期余量。
    gain = 0.5 / peak if peak else 1.0
    pcm = array("h")
    pcm_peak = 0
    energy = 0.0
    for left, right in zip(mix_l, mix_r):
        for sample in (left, right):
            value = round(sample * gain * 32767.0)
            value = max(-32768, min(32767, value))
            pcm.append(value)
            pcm_peak = max(pcm_peak, abs(value))
            energy += (value / 32768.0) ** 2
    if sys.byteorder != "little":
        pcm.byteswap()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    wav_path = OUT_DIR / "soundtrack.wav"
    with wave.open(str(wav_path), "wb") as target:
        target.setnchannels(2)
        target.setsampwidth(2)
        target.setframerate(RATE)
        target.writeframes(pcm.tobytes())
    for event in EVENTS:
        event["start_sample"] = round(event["time"] * RATE)
        event["end_time"] = round(event["time"] + event["duration"], 3)
    metadata = {
        "title": "暖纸面与轻巧像素动作音轨",
        "duration_seconds": DURATION,
        "sample_rate": RATE,
        "channels": 2,
        "sample_format": "PCM 16-bit little-endian",
        "seed": 20261003,
        "narration": False,
        "source": "仅 Python 标准库 wave、math、random 和 array，本地程序合成",
        "external_assets": [],
        "external_api_calls": [],
        "music": {"tempo_bpm": 84, "key": "C 大调", "notes": "暖正弦底、稀疏木琴和少量像素谐波；动作时伴奏自动降低"},
        "events": EVENTS,
        "diagnostics": {
            "frames": FRAMES,
            "peak_dbfs": dbfs(pcm_peak / 32768.0),
            "rms_dbfs": dbfs(math.sqrt(energy / (FRAMES * 2))),
            "music_rms_dbfs": dbfs(gain * math.sqrt(music_energy / (FRAMES * 2))),
            "effects_rms_dbfs": dbfs(gain * math.sqrt(effect_energy / (FRAMES * 2))),
            "clipped_samples": sum(value == -32768 or value == 32767 for value in pcm),
            "listening_status": "待正常音量、正常速度试听",
        },
    }
    (OUT_DIR / "audio-events.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"wav": str(wav_path), "events": str(OUT_DIR / "audio-events.json"), "diagnostics": metadata["diagnostics"]}, ensure_ascii=False))


if __name__ == "__main__":
    build_music()
    build_effects()
    export()
