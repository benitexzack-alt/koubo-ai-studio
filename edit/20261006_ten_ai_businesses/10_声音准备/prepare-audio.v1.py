"""本期只读量测、原声提取与受控混音；不改字幕，不联网。"""

import argparse
from array import array
import datetime
import hashlib
import json
import math
from pathlib import Path
import re
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[3]
REPORT = Path(__file__).resolve().parent
EPISODE = REPORT.parent
SOURCE = EPISODE / "01_素材投放区/01_口播原片/copy_49E4F13A-70AB-4E11-92B2-545146690784.MOV"
EXPECTED_SOURCE_SHA = "8ae23618f2860d1a0fcf034055c8eec9232cd6a7d5abda4207af287cf6157ad0"
OUTPUT = ROOT / "remotion/public-ten-ai-businesses-final-r1/ten-ai-businesses-final-r1/audio"
SFX_MANIFEST = ROOT / "assets/sfx/koubo-sfx-v8/manifest.json"
FFMPEG = "/opt/homebrew/bin/ffmpeg"
FFPROBE = "/opt/homebrew/bin/ffprobe"
SR = 48000
R2_INFO = {
    "hook": (0, 0.340), "confirm": (0, 0.160), "keyword": (0, 0.250),
    "sweep": (0.4333333333, 0.172667), "click": (0.0333333333, 0.300),
    "slide": (0.0666666667, 0.400), "connect": (0.100, 0.400),
}


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def sha(path):
    with Path(path).open("rb") as handle:
        return hashlib.file_digest(handle, "sha256").hexdigest()


def write_json(path, value):
    with Path(path).open("w", encoding="utf-8") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def run(command):
    result = subprocess.run(command, capture_output=True)
    if result.returncode:
        raise RuntimeError((result.stderr or result.stdout).decode("utf-8", errors="replace"))
    return result


def probe(path):
    result = run([FFPROBE, "-v", "error", "-show_entries",
                  "format=duration:stream=index,codec_type,codec_name,sample_rate,channels,duration,start_time",
                  "-of", "json", str(path)])
    return json.loads(result.stdout)


def amplitude(db):
    return 10 ** (float(db) / 20)


def db(value):
    return round(20 * math.log10(value), 6) if value > 0 else None


def pcm(path):
    result = run([FFMPEG, "-nostdin", "-hide_banner", "-loglevel", "error", "-i", str(path),
                  "-map", "0:a:0", "-vn", "-ac", "2", "-ar", str(SR),
                  "-c:a", "pcm_f32le", "-f", "f32le", "-"])
    samples = array("f")
    samples.frombytes(result.stdout)
    if sys.byteorder != "little":
        samples.byteswap()
    return samples


def transient_metrics(samples):
    frames = len(samples) // 2
    peak = max(abs(value) for value in samples) if samples else 0
    peak_index = max(range(len(samples)), key=lambda index: abs(samples[index])) if peak else 0
    rms = math.sqrt(sum(value * value for value in samples) / len(samples)) if samples else 0
    block_frames = 240  # 5 ms blocks; technical onset only, not a listening claim.
    energy = []
    for frame in range(0, frames, block_frames):
        chunk = samples[frame * 2:min((frame + block_frames) * 2, len(samples))]
        energy.append(math.sqrt(sum(value * value for value in chunk) / len(chunk)))
    max_energy = max(energy) if energy else 0
    threshold = max_energy * amplitude(-20)
    onset = next((index for index, value in enumerate(energy) if value > threshold), None)
    tail = next((index for index in range(len(energy) - 1, -1, -1) if energy[index] > threshold), None)
    return {
        "sampleRate": SR, "channels": 2, "durationSeconds": frames / SR,
        "samplePeakDbfs": db(peak), "rmsDbfs": db(rms),
        "peakAtSeconds": peak_index // 2 / SR, "peakAtFrames30fps": peak_index // 2 / SR * 30,
        "effectiveOnsetSeconds": onset * block_frames / SR if onset is not None else None,
        "effectiveTailSeconds": min(frames / SR, (tail + 1) * block_frames / SR) if tail is not None else None,
        "onsetDefinition": "first 5ms RMS block above max-block-RMS minus 20dB; not a perceptual certification",
    }


def loudness(path):
    command = [FFMPEG, "-nostdin", "-hide_banner", "-nostats", "-i", str(path), "-map", "0:a:0",
               "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"]
    result = run(command)
    text = result.stderr.decode("utf-8", errors="replace")
    blocks = re.findall(r'\{\s*"input_i"\s*:[\s\S]*?\}', text)
    if not blocks:
        raise RuntimeError("未取得 loudnorm 量测 JSON")
    measurement = json.loads(blocks[-1])
    return {
        "integratedLufs": float(measurement["input_i"]),
        "truePeakDbtp": float(measurement["input_tp"]),
        "loudnessRangeLu": float(measurement["input_lra"]),
        "thresholdLufs": float(measurement["input_thresh"]),
        "measurementOnly": True, "command": command,
        "note": "输出到 null；loudnorm 建议输出不是已改变的音轨",
    }


def validate_context(context_path):
    context_path = Path(context_path).resolve()
    context = json.loads(context_path.read_text(encoding="utf-8"))
    if context.get("status") != "context-ready" or context.get("task", {}).get("project") != "口播":
        raise RuntimeError("上下文不属于当前口播项目或尚未准备好")
    if not context.get("task", {}).get("important") or not context.get("gate", {}).get("formal_execution_allowed"):
        raise RuntimeError("重要任务上下文未允许执行")
    if Path(context["task"]["cwd"]).resolve() != ROOT.resolve():
        raise RuntimeError("上下文项目目录不匹配")
    validator = "/Users/pc/Documents/个人知识库/04_Claude Code日常操作/scripts/opc_rag.py"
    command = ["/opt/homebrew/bin/python3", validator, "validate-context", "--context", str(context_path)]
    result = run(command)
    validation = json.loads(result.stdout)
    if validation.get("status") != "context-valid" or not validation.get("gate", {}).get("formal_execution_allowed"):
        raise RuntimeError("上下文实际复检未通过：" + result.stdout.decode("utf-8", errors="replace"))
    return {"path": str(context_path), "sha256": sha(context_path), "taskId": context["task"]["id"],
            "validation": validation, "validationCommand": command}


def measure():
    manifest = json.loads(SFX_MANIFEST.read_text(encoding="utf-8"))
    source_hash = sha(SOURCE)
    if source_hash != EXPECTED_SOURCE_SHA:
        raise RuntimeError("原片哈希变化，停止")
    report = {
        "schemaVersion": "ten-ai-businesses-audio-measurements/v1", "measuredAt": now(),
        "source": {"path": str(SOURCE), "sha256": source_hash, "probe": probe(SOURCE),
                   "loudness": loudness(SOURCE)},
        "nativePaper": [], "sfxCandidates": [], "r2DerivedCandidates": [],
        "humanListeningPerformed": False, "userAudibilityConfirmed": False,
        "createdMedia": False,
    }
    for index in range(1, 7):
        item = EPISODE / f"01_素材投放区/04_纸艺视频/20261006_P{index:02d}_待确认生成.mp4"
        report["nativePaper"].append({
            "id": f"P{index:02d}", "path": str(item), "sha256": sha(item), "probe": probe(item),
            "loudness": loudness(item), "metrics": transient_metrics(pcm(item)),
            "requiresPeakLimiter": index in (2, 5),
            "permissionBasis": "本期用户提供的原始生成素材；原生声按本期要求保留",
        })
    catalogue_pcm = {}
    for item in manifest["items"]:
        if not item.get("eligibleForSfx"):
            continue
        path = ROOT / item["output"]
        digest = sha(path)
        if digest != item["outputSha256"]:
            raise RuntimeError(f"V8 音效哈希不符：{item['id']}")
        if not (ROOT / item["licenseReference"]).is_file():
            raise RuntimeError(f"许可记录缺失：{item['id']}")
        samples = pcm(path)
        catalogue_pcm[item["id"]] = samples
        report["sfxCandidates"].append({
            "id": item["id"], "path": str(path), "sha256": digest,
            "license": item["license"], "licenseReference": item["licenseReference"],
            "licenseReferenceSha256": sha(ROOT / item["licenseReference"]),
            "sourcePath": item["source"], "sourceSha256": item["sourceSha256"],
            "metrics": transient_metrics(samples), "eligibleForSfx": True,
            "licenseEvidenceLevel": "existing-local-source-record-not-new-live-legal-validation",
        })
    for name, (offset, length) in R2_INFO.items():
        path = ROOT / f"remotion/public/motion-upgrade-r1/sfx/{name}.wav"
        target = pcm(path)
        target_energy = sum(value * value for value in target)
        correlations = []
        for item in report["sfxCandidates"]:
            source = catalogue_pcm[item["id"]]
            first = round(offset * SR) * 2
            selected = source[first:first + len(target)]
            if len(selected) != len(target):
                continue
            # Match the documented R1 5ms attack / 30ms release processing.
            frames = len(selected) // 2
            rendered = array("f")
            for index, value in enumerate(selected):
                frame = index // 2
                fade = min(1.0, frame / (0.005 * SR), (frames - frame) / (0.030 * SR))
                rendered.append(value * max(0, fade))
            energy = sum(value * value for value in rendered)
            correlation = sum(a * b for a, b in zip(target, rendered)) / math.sqrt(target_energy * energy) if energy and target_energy else 0
            correlations.append({"id": item["id"], "correlation": correlation})
        correlations.sort(key=lambda item: item["correlation"], reverse=True)
        best = correlations[0] if correlations else None
        parent = next((item for item in report["sfxCandidates"] if best and item["id"] == best["id"]), None)
        report["r2DerivedCandidates"].append({
            "id": f"r2-{name}", "path": str(path), "sha256": sha(path),
            "metrics": transient_metrics(target), "documentedSourceOffsetSeconds": offset,
            "documentedTrimDurationSeconds": length, "topSourceMatches": correlations[:3],
            "fingerprintMatchedSource": parent["id"] if best and best["correlation"] > 0.999 else None,
            "license": parent["license"] if best and best["correlation"] > 0.999 else None,
            "licenseReference": parent["licenseReference"] if best and best["correlation"] > 0.999 else None,
            "eligibleForSfx": bool(best and best["correlation"] > 0.999),
            "sourceMatchIsSignalEvidenceNotListening": True,
        })
    report["sourceSha256After"] = sha(SOURCE)
    assert report["sourceSha256After"] == source_hash
    write_json(REPORT / "音频源与瞬态量测.v1.json", report)
    return report


def extract_original(context_path):
    context = validate_context(context_path)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    path = OUTPUT / "original.wav"
    if path.exists():
        raise RuntimeError("original.wav 已存在；不覆盖，先核对既有提取回执")
    if sha(SOURCE) != EXPECTED_SOURCE_SHA:
        raise RuntimeError("原片哈希变化，停止")
    command = [FFMPEG, "-nostdin", "-hide_banner", "-loglevel", "error", "-n", "-i", str(SOURCE),
               "-map", "0:a:0", "-vn", "-ac", "2", "-ar", str(SR), "-c:a", "pcm_s16le", str(path)]
    run(command)
    receipt = {
        "schemaVersion": "ten-ai-businesses-original-audio-extraction/v1", "createdAt": now(),
        "context": context, "sourcePath": str(SOURCE), "sourceSha256": EXPECTED_SOURCE_SHA,
        "outputPath": str(path), "outputSha256": sha(path), "probe": probe(path),
        "command": command, "cut": False, "speedChanged": False, "voiceGainDb": 0,
        "humanListeningPerformed": False, "userAudibilityConfirmed": False,
        "sourceSha256After": sha(SOURCE),
    }
    assert receipt["sourceSha256After"] == EXPECTED_SOURCE_SHA
    write_json(REPORT / "原口播音轨提取回执.v1.json", receipt)
    return receipt


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--measure", action="store_true")
    parser.add_argument("--extract-original", action="store_true")
    parser.add_argument("--context")
    arguments = parser.parse_args()
    if not arguments.measure and not arguments.extract_original:
        parser.error("选择 --measure 或 --extract-original；本阶段尚不按临时窗混音")
    if arguments.measure:
        report = measure()
        print(json.dumps({"status": "read-only-measured", "source": report["source"]["loudness"],
                          "paperCount": len(report["nativePaper"]), "sfxCount": len(report["sfxCandidates"]),
                          "r2Matches": [{"id": item["id"], "source": item["fingerprintMatchedSource"]}
                                        for item in report["r2DerivedCandidates"]]}, ensure_ascii=False))
    if arguments.extract_original:
        if not arguments.context:
            parser.error("提取实际音轨前必须给 --context 并复检")
        print(json.dumps(extract_original(arguments.context), ensure_ascii=False))


if __name__ == "__main__":
    main()
