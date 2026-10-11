"""本期原声完整保留、纸艺原声与既有本地动作音的任务级混音。"""

import argparse
from collections import Counter
import datetime
import hashlib
import json
import math
from pathlib import Path
import re
import subprocess

import numpy as np


ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
EPISODE = HERE.parent
OUTPUT = HERE / "audio"
SOURCE = EPISODE / "01_素材投放区/01_口播原片/copy_6040572B-1985-4C66-842D-0F3B63C6E29C.MOV"
EXPECTED_SHA = "6547a15055ec44a5765f054816e2f9555ce1524b4f8664dbbeb6bce1fa8712bb"
EVENT_PATH = EPISODE / "09_渲染素材/visual-action-events.v1.json"
MANIFEST_PATH = ROOT / "assets/sfx/koubo-sfx-v8/manifest.json"
FFMPEG = "/opt/homebrew/bin/ffmpeg"
SR = 48000
FPS = 30
TOTAL_FRAMES = 4385
TOTAL_SAMPLES = TOTAL_FRAMES * SR // FPS
VOICE_GAIN = 4.0
ASSIGNMENTS = [
    ("waic-thesis-impact", 0.0, 0.52, -10),
    ("v1-keyword-tick", 0.0, 0.16, -17),
    ("v1-section-air", 0.015, 0.264417, -17),
    ("v3-list-tick-b", 0.0, 0.14, -17),
    ("v3-soft-card-pop-a", 0.0, 0.245, -17),
    ("v2-card-slide", 0.0, 0.275, -17),
    ("v3-soft-card-pop-b", 0.0, 0.22, -16),
    ("v2-keyword-select", 0.0, 0.155, -15),
    ("v3-chapter-sweep-a", 0.155, 0.455, -17),
    ("v1-keyword-tick", 0.0, 0.16, -16),
    ("v1-section-air", 0.015, 0.264417, -17),
    ("v3-soft-card-pop-a", 0.0, 0.245, -17),
    ("v2-card-slide", 0.0, 0.275, -17),
    ("v3-list-tick-b", 0.0, 0.14, -16),
    ("v3-soft-card-pop-b", 0.0, 0.22, -17),
    ("v2-keyword-select", 0.0, 0.155, -16),
    ("v3-chapter-sweep-a", 0.155, 0.455, -17),
    ("v1-card-reveal", 0.0, 0.30, -17),
    ("v1-confirm-soft", 0.005, 0.21, -15),
]


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def sha(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def run(command):
    result = subprocess.run(command, capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr.decode("utf-8", errors="replace"))
    return result


def amplitude(db):
    return 10 ** (db / 20)


def db(value):
    return float(20 * np.log10(max(float(value), 1e-15)))


def pcm(path):
    result = run([FFMPEG, "-nostdin", "-v", "error", "-i", str(path), "-map", "0:a:0", "-vn", "-ac", "2", "-ar", str(SR), "-c:a", "pcm_f32le", "-f", "f32le", "-"])
    return np.frombuffer(result.stdout, dtype="<f4").reshape(-1, 2).copy()


def metrics(samples):
    count = len(samples)
    frames = int(math.ceil(count / 240))
    blocks = np.pad(samples, ((0, frames * 240 - count), (0, 0))).reshape(frames, 240, 2)
    powers = np.mean(blocks.astype(np.float64) ** 2, axis=(1, 2))
    peak_block = int(np.argmax(powers))
    active = np.flatnonzero(powers > np.max(powers) * 0.01)
    return {"sampleRate": SR, "channels": 2, "durationSeconds": count / SR,
            "samplePeakDbfs": db(np.max(np.abs(samples))), "rmsDbfs": db(np.sqrt(np.mean(samples.astype(np.float64) ** 2))),
            "rmsPeakSeconds": peak_block * 0.005,
            "effectiveOnsetSeconds": int(active[0]) * 0.005 if len(active) else None,
            "effectiveTailSeconds": min(count / SR, (int(active[-1]) + 1) * 0.005) if len(active) else None,
            "onsetDefinition": "5ms块RMS大于最大块RMS减20dB；仅技术瞬态，非听感证明"}


def loudness(path):
    command = [FFMPEG, "-nostdin", "-hide_banner", "-nostats", "-i", str(path), "-map", "0:a:0", "-af", "loudnorm=I=-16.5:TP=-1.8:LRA=11:print_format=json", "-f", "null", "-"]
    raw = run(command).stderr.decode("utf-8", errors="replace")
    meter = json.loads(re.findall(r'\{\s*"input_i"\s*:[\s\S]*?\}', raw)[-1])
    return {"integratedLufs": float(meter["input_i"]), "truePeakDbtp": float(meter["input_tp"]),
            "loudnessRangeLu": float(meter["input_lra"]), "raw": meter, "command": command, "measurementOnly": True}


def paper_source(scene):
    return EPISODE / "01_素材投放区/04_纸艺视频" / f"20261011_{scene}_待确认生成.mp4"


def measure():
    assert sha(SOURCE) == EXPECTED_SHA
    report = {"schemaVersion": "enterprise-ai-organization-audio-measurements/v1", "createdAt": now(),
              "source": {"path": str(SOURCE), "sha256": sha(SOURCE), "loudness": loudness(SOURCE)},
              "nativePaper": [], "sfxCandidates": [], "humanListeningPerformed": False, "userAudibilityConfirmed": False}
    print("原声量测", report["source"]["loudness"]["integratedLufs"], flush=True)
    for index in range(1, 6):
        scene = f"P{index:02d}"
        path = paper_source(scene)
        report["nativePaper"].append({"id": scene, "path": str(path), "sha256": sha(path), "loudness": loudness(path), "metrics": metrics(pcm(path)),
                                     "permissionBasis": "本期用户提供纸艺视频，用户明确要求保留原生动作声",
                                     "voiceOrMusicRisk": "本轮机器量测未识别人声或配乐语义，不能据此排除；待正常速度试听"})
        print(scene, report["nativePaper"][-1]["loudness"]["integratedLufs"], flush=True)
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    selected_ids = {item[0] for item in ASSIGNMENTS}
    for item in manifest["items"]:
        if item["id"] not in selected_ids:
            continue
        path = ROOT / item["output"]
        license_path = ROOT / item["licenseReference"]
        assert item["eligibleForSfx"] and sha(path) == item["outputSha256"] and license_path.is_file()
        report["sfxCandidates"].append({**item, "path": str(path), "sha256": sha(path), "licenseReferenceSha256": sha(license_path), "metrics": metrics(pcm(path)),
                                        "licenseEvidenceLevel": "既有本地许可登记及哈希实测；非本轮重新法律审查"})
    assert len(report["sfxCandidates"]) == len(selected_ids)
    write_json(HERE / "音频源与瞬态量测.v1.json", report)
    return report


def plan(measurements):
    events = json.loads(EVENT_PATH.read_text(encoding="utf-8"))
    assert events["fps"] == FPS and events["durationInFrames"] == TOTAL_FRAMES and len(events["events"]) == len(ASSIGNMENTS)
    sources = {item["id"]: item for item in measurements["sfxCandidates"]}
    cues = []
    previous = {}
    for event, (source_id, trim_start, trim_end, target_peak) in zip(events["events"], ASSIGNMENTS):
        source = sources[source_id]
        raw = pcm(source["path"])
        trim_end = min(trim_end, len(raw) / SR)
        selected = raw[round(trim_start * SR):round(trim_end * SR)]
        before = metrics(selected)
        if before["effectiveOnsetSeconds"] > 0.003:
            trim_start += before["effectiveOnsetSeconds"]
            selected = raw[round(trim_start * SR):round(trim_end * SR)]
        length = len(selected)
        env = np.minimum(1, np.arange(length) / (0.003 * SR)) * np.minimum(1, np.arange(length, 0, -1) / (0.025 * SR))
        selected = selected * env[:, None]
        met = metrics(selected)
        transient = met["rmsPeakSeconds"]
        sample_delay = round(event["visualFrame"] / FPS * SR - transient * SR)
        start_frame = sample_delay / SR * FPS
        gain = target_peak - met["samplePeakDbfs"]
        cue = {**event, "eventId": event["id"], "sourceId": source_id, "source": source["path"], "sourceSha256": source["sha256"],
               "license": source["license"], "licenseReference": source["licenseReference"],
               "trimStart": trim_start, "trimEnd": trim_end, "durationSeconds": length / SR,
               "frame": start_frame, "sampleDelay": sample_delay, "effectiveTransientOffsetSeconds": transient,
               "actualTransientFrame": (sample_delay / SR + transient) * FPS,
               "actualSyncErrorFrames": (sample_delay / SR + transient) * FPS - event["visualFrame"],
               "gainDb": gain, "targetSamplePeakDbfsBeforeDucking": target_peak,
               "fadeInSeconds": 0.003, "fadeOutSeconds": 0.025, "trimmedMetrics": met}
        prior = previous.setdefault(source_id, [])
        assert not prior or event["visualFrame"] - prior[-1] >= 750, source_id
        prior.append(event["visualFrame"])
        assert len(prior) <= 3
        assert sample_delay >= 0
        assert not cues or cues[-1]["sourceId"] != source_id
        assert not cues or sample_delay >= cues[-1]["sampleDelay"] + round(cues[-1]["durationSeconds"] * SR)
        for paper in events["paperClips"]:
            assert not (sample_delay < paper["to"] * SR / FPS and sample_delay + length > paper["from"] * SR / FPS)
        cues.append(cue)
    paper_by_id = {item["id"]: item for item in measurements["nativePaper"]}
    voice_lufs = measurements["source"]["loudness"]["integratedLufs"] + VOICE_GAIN
    papers = []
    for item in events["paperClips"]:
        source = paper_by_id[item["id"]]
        gain = voice_lufs - 9 - source["loudness"]["integratedLufs"]
        # 原生轨仅降低高峰需要的量；保留自然动态，不给每源统一极快压缩。
        gain = min(gain, -12 - source["metrics"]["samplePeakDbfs"])
        papers.append({**item, "source": source["path"], "sourceSha256": source["sha256"], "startFrame": item["from"], "endFrameExclusive": item["to"],
                       "sourceStartSeconds": item["sourceInFrame"] / item["sourceFps"], "speed": 1, "loop": False,
                       "gainDb": gain, "sampleDelay": item["from"] * SR // FPS, "retainOriginalNativeAudio": True,
                       "nativeAudioPreserved": True, "sourceIntegratedLufs": source["loudness"]["integratedLufs"]})
    result = {"schemaVersion": "enterprise-ai-organization-visual-sound-plan/v1", "createdAt": now(), "eventPath": str(EVENT_PATH), "eventSha256": sha(EVENT_PATH),
              "fps": FPS, "durationInFrames": TOTAL_FRAMES, "voiceGainDbBeforeMaster": VOICE_GAIN, "paper": papers, "sfx": cues,
              "sourceCount": len(previous), "sourceUsage": dict(Counter(cue["sourceId"] for cue in cues)),
              "foregroundCueOverlap": False, "sfxInPaperWindows": False, "humanListeningPerformed": False, "userAudibilityConfirmed": False}
    write_json(HERE / "视觉声音规划.v1.json", result)
    return result


def validate_context(path):
    command = ["python3", "/Users/pc/Documents/个人知识库/04_Claude Code日常操作/scripts/opc_rag.py", "validate-context", "--context", str(path)]
    result = json.loads(run(command).stdout)
    if result.get("status") != "context-valid" or not result.get("gate", {}).get("formal_execution_allowed"):
        raise RuntimeError("本期上下文复检不允许执行: " + json.dumps(result, ensure_ascii=False))
    return {"path": str(Path(path).resolve()), "sha256": sha(path), "validationCommand": command, "validation": result}


def mix(sound_plan, measurements, context_path):
    context = validate_context(context_path)
    assert sha(SOURCE) == EXPECTED_SHA
    OUTPUT.mkdir(exist_ok=True)
    original = OUTPUT / "original.v1.wav"
    extraction = [FFMPEG, "-nostdin", "-v", "error", "-n", "-i", str(SOURCE), "-map", "0:a:0", "-vn", "-ar", str(SR), "-ac", "2", "-c:a", "pcm_f32le", str(original)]
    run(extraction)
    write_json(HERE / "原口播音轨提取回执.v1.json", {"sourcePath": str(SOURCE), "sourceSha256": EXPECTED_SHA, "outputPath": str(original), "outputSha256": sha(original), "command": extraction, "cut": False, "speedChanged": False, "voiceGainDb": 0})
    papers, cues = sound_plan["paper"], sound_plan["sfx"]
    command = [FFMPEG, "-nostdin", "-v", "error", "-n", "-i", str(original)]
    for item in papers + cues:
        command.extend(["-i", item["source"]])
    filters = [f"[0:a]aresample={SR},aformat=sample_fmts=fltp:channel_layouts=stereo,apad=whole_len={TOTAL_SAMPLES},atrim=end_sample={TOTAL_SAMPLES},volume={VOICE_GAIN}dB,asplit=4[vn][vf][pk][sk]"]
    for index, item in enumerate(papers, 1):
        duration = (item["to"] - item["from"]) / FPS
        filters.append(f"[{index}:a]aresample={SR},aformat=sample_fmts=fltp:channel_layouts=stereo,atrim=start={item['sourceStartSeconds']}:duration={duration},asetpts=PTS-STARTPTS,volume={item['gainDb']}dB,afade=t=in:d=0.008,afade=t=out:st={duration-0.040}:d=0.040,adelay={item['sampleDelay']}S:all=1,apad=whole_len={TOTAL_SAMPLES},atrim=end_sample={TOTAL_SAMPLES}[p{index}]")
    filters.append("".join(f"[p{index}]" for index in range(1, 6)) + "amix=inputs=5:normalize=0[pbus]")
    filters.append("[pbus][pk]sidechaincompress=threshold=0.065:ratio=2:attack=35:release=160:makeup=1:detection=rms:link=maximum:mix=1,asplit=2[pn][pf]")
    for index, cue in enumerate(cues):
        duration = cue["durationSeconds"]
        filters.append(f"[{index+6}:a]aresample={SR},aformat=sample_fmts=fltp:channel_layouts=stereo,atrim=start={cue['trimStart']}:end={cue['trimEnd']},asetpts=PTS-STARTPTS,volume={cue['gainDb']}dB,afade=t=in:d=0.003,afade=t=out:st={duration-0.025}:d=0.025,adelay={cue['sampleDelay']}S:all=1,apad=whole_len={TOTAL_SAMPLES},atrim=end_sample={TOTAL_SAMPLES}[s{index}]")
    filters.append("".join(f"[s{index}]" for index in range(len(cues))) + f"amix=inputs={len(cues)}:normalize=0[sbus]")
    filters.append("[sbus][sk]sidechaincompress=threshold=0.06:ratio=2:attack=8:release=85:makeup=1:detection=rms:link=maximum:mix=1[sd]")
    filters.extend([f"[vn][pn]amix=inputs=2:normalize=0,atrim=end_sample={TOTAL_SAMPLES}[no]", f"[vf][pf][sd]amix=inputs=3:normalize=0,atrim=end_sample={TOTAL_SAMPLES}[yes]"])
    graph = ";".join(filters)
    native_pre, final_pre = OUTPUT / "_native-premix.v1.f32.wav", OUTPUT / "_withsfx-premix.v1.f32.wav"
    command.extend(["-filter_complex", graph, "-map", "[no]", "-ar", str(SR), "-c:a", "pcm_f32le", str(native_pre), "-map", "[yes]", "-ar", str(SR), "-c:a", "pcm_f32le", str(final_pre)])
    run(command)
    first_meter = loudness(final_pre)
    meter = first_meter["raw"]
    master_filter = f"loudnorm=I=-16.5:TP=-1.8:LRA=11:measured_I={meter['input_i']}:measured_LRA={meter['input_lra']}:measured_TP={meter['input_tp']}:measured_thresh={meter['input_thresh']}:offset={meter['target_offset']}:linear=false,aresample={SR},apad=whole_len={TOTAL_SAMPLES},atrim=end_sample={TOTAL_SAMPLES}"
    outputs, master_commands = [], []
    for source, destination in [(native_pre, OUTPUT / "native-mix.v1.wav"), (final_pre, OUTPUT / "final-mix.v1.wav")]:
        master = [FFMPEG, "-nostdin", "-hide_banner", "-nostats", "-n", "-i", str(source), "-af", master_filter, "-ar", str(SR), "-ac", "2", "-c:a", "pcm_s16le", str(destination)]
        run(master)
        master_commands.append(master)
        outputs.append({"path": str(destination), "sha256": sha(destination), "loudness": loudness(destination), "samples": len(pcm(destination))})
    receipt = {"schemaVersion": "enterprise-ai-organization-audio-mix-receipt/v1", "createdAt": now(), "status": "technical-audio-candidate-pending-listening", "context": context,
               "sourcePath": str(SOURCE), "sourceSha256": EXPECTED_SHA, "originalAudioPath": str(original), "originalAudioSha256": sha(original),
               "planPath": str(HERE / "视觉声音规划.v1.json"), "planSha256": sha(HERE / "视觉声音规划.v1.json"), "fps": FPS, "durationInFrames": TOTAL_FRAMES,
               "audioSamples": TOTAL_SAMPLES, "audioDurationSeconds": TOTAL_SAMPLES / SR, "voiceGainDbBeforeMaster": VOICE_GAIN,
               "spokenContentChanged": False, "originalVoiceCut": False, "originalVoiceSpeedChanged": False, "voiceSidechainDucked": False,
               "sidechainTarget": "native-paper-and-added-SFX-only; original voice never ducked", "nativePaper": papers, "sfx": cues,
               "sourceCount": sound_plan["sourceCount"], "foregroundCueOverlap": False, "sfxInPaperWindows": False,
               "actualTransientSyncWithinTwoFrames": all(abs(cue["actualSyncErrorFrames"]) <= 2 for cue in cues),
               "filterComplex": graph, "premixCommand": command, "mastering": {"firstPass": first_meter, "filter": master_filter, "commands": master_commands, "sameParametersBothVariants": True},
               "intermediateOutputs": [{"path": str(path), "sha256": sha(path)} for path in [native_pre, final_pre]], "outputs": outputs,
               "humanListeningPerformed": False, "userAudibilityConfirmed": False, "sourceSha256After": sha(SOURCE)}
    write_json(HERE / "mixreceipt.v1.json", receipt)
    verify(receipt)
    assert all(item["loudness"]["truePeakDbtp"] <= -1.5 for item in outputs)
    assert abs(outputs[-1]["loudness"]["integratedLufs"] + 16.5) <= 0.7
    print(json.dumps({"outputs": outputs, "sfxCount": len(cues)}, ensure_ascii=False), flush=True)


def verify(receipt):
    native, final = [pcm(item["path"]) for item in receipt["intermediateOutputs"]]
    original = pcm(receipt["originalAudioPath"])
    expected = np.zeros_like(native)
    expected[:len(original)] = original * amplitude(VOICE_GAIN)
    protected = np.ones(len(native), dtype=bool)
    for item in receipt["nativePaper"]:
        protected[item["from"] * SR // FPS:item["to"] * SR // FPS] = False
    error = native[protected] - expected[protected]
    results = []
    for cue in receipt["sfx"]:
        first = cue["sampleDelay"]
        length = round(cue["durationSeconds"] * SR)
        delta = final[first:first+length] - native[first:first+length]
        met = metrics(delta)
        actual = (first / SR + met["rmsPeakSeconds"]) * FPS
        results.append({"id": cue["id"], "visualFrame": cue["visualFrame"], "actualPremixPeakFrame": actual,
                        "actualPremixPeakErrorFrames": actual-cue["visualFrame"], "actualPremixPeakWithinTwoFrames": abs(actual-cue["visualFrame"]) <= 2,
                        "addedSfxDifferenceRmsDbfs": met["rmsDbfs"]})
    report = {"schemaVersion": "enterprise-ai-organization-premix-numerical-check/v1", "createdAt": now(), "mixReceiptPath": str(HERE / "mixreceipt.v1.json"),
              "wholeTimelineSampleCount": TOTAL_SAMPLES, "nativeAndWithSfxSampleCountsEqual": len(native) == len(final) == TOTAL_SAMPLES,
              "cues": results, "allAddedSfxNonSilent": all(item["addedSfxDifferenceRmsDbfs"] > -100 for item in results),
              "actualPremixAllPeaksWithinTwoFrames": all(item["actualPremixPeakWithinTwoFrames"] for item in results),
              "actualPremixMaxPeakErrorFrames": max(abs(item["actualPremixPeakErrorFrames"]) for item in results),
              "voicePathCheck": {"checkedOutsidePaperWindows": True, "maximumAbsoluteFloatError": float(np.max(np.abs(error))), "passesFloatTolerance": float(np.max(np.abs(error))) < 1e-6},
              "humanListeningPerformed": False, "userAudibilityConfirmed": False, "sourceUnchanged": sha(SOURCE) == EXPECTED_SHA}
    write_json(HERE / "预混音差分与人声路径核对.v1.json", report)
    assert report["actualPremixAllPeaksWithinTwoFrames"] and report["voicePathCheck"]["passesFloatTolerance"]


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--measure", action="store_true")
    parser.add_argument("--mix", action="store_true")
    parser.add_argument("--context")
    args = parser.parse_args()
    measurements = measure() if args.measure else json.loads((HERE / "音频源与瞬态量测.v1.json").read_text(encoding="utf-8"))
    sound_plan = plan(measurements)
    print("声音计划已核对", len(sound_plan["sfx"]), "事件，", sound_plan["sourceCount"], "个合法本地源", flush=True)
    if args.mix:
        assert args.context, "混音前必须提供并复检当前任务context"
        mix(sound_plan, measurements, args.context)
