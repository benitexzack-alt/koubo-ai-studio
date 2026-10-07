"""R2仅提前两个音效入点；保留R1所有文件、完整原口播及六镜原生音。"""

import argparse
import importlib.util
import json
import math
from pathlib import Path
import re
import subprocess
import sys


HELPER_PATH = Path(__file__).resolve().parent / "prepare-audio.v1.py"
spec = importlib.util.spec_from_file_location("ten_ai_audio_prepare", HELPER_PATH)
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)
ROOT, REPORT, OUTPUT = helper.ROOT, helper.REPORT, helper.OUTPUT
SR, FFMPEG = helper.SR, helper.FFMPEG


def resolve_source(value):
    candidate = Path(value)
    return candidate if candidate.is_absolute() else ROOT / candidate


def master_measurement(path):
    command = [FFMPEG, "-nostdin", "-hide_banner", "-nostats", "-i", str(path), "-map", "0:a:0",
               "-af", "loudnorm=I=-16.5:TP=-1.8:LRA=11:print_format=json", "-f", "null", "-"]
    result = helper.run(command)
    text = result.stderr.decode("utf-8", errors="replace")
    blocks = re.findall(r'\{\s*"input_i"\s*:[\s\S]*?\}', text)
    if not blocks:
        raise RuntimeError("无法取得主混音第一遍量测")
    return {"command": command, "loudnorm": json.loads(blocks[-1])}


def rms_peak_seconds(samples):
    block = 240 * 2  # 5ms, 48000Hz stereo; same independent technical definition.
    energies = [sum(value * value for value in samples[start:start + block]) /
                max(1, len(samples[start:start + block]))
                for start in range(0, len(samples), block)]
    if not energies or max(energies) == 0:
        raise RuntimeError("音效裁切范围中没有有效声音")
    return max(range(len(energies)), key=lambda index: energies[index]) * 0.005


def validate_plan(plan_path, measurements):
    plan = json.loads(Path(plan_path).read_text(encoding="utf-8"))
    if plan.get("schemaVersion") != "ten-ai-businesses-visual-sound-plan/r2":
        raise RuntimeError("不接受其他任务或未明确绑定的声音计划")
    if plan.get("fps") != 30 or plan.get("durationInFrames") != 8534:
        raise RuntimeError("本期完整原片时间轴必须为30fps、8534帧")
    if [item["id"] for item in plan["paper"]] != [f"P{index:02d}" for index in range(1, 7)]:
        raise RuntimeError("必须显式保留本期全部六镜纸艺原音")
    total_seconds = plan["durationInFrames"] / plan["fps"]
    native_by_id = {item["id"]: item for item in measurements["nativePaper"]}
    allowed = {item["path"]: item for item in measurements["sfxCandidates"]}
    sources, cues = {}, []
    for item in plan["paper"]:
        path = resolve_source(item["source"])
        if helper.sha(path) != native_by_id[item["id"]]["sha256"]:
            raise RuntimeError(f"纸艺拷贝与原始输入哈希不同：{item['id']}")
        if item.get("sourceStartSeconds") != 0 or item.get("speed") != 1 or item.get("loop"):
            raise RuntimeError("本期六镜原音必须原速完整使用，不循环、不开头裁切")
        if not item.get("retainOriginalNativeAudio"):
            raise RuntimeError("纸艺原音保留字段不能为false")
        duration = (item["endFrameExclusive"] - item["startFrame"]) / plan["fps"]
        measured_duration = native_by_id[item["id"]]["metrics"]["durationSeconds"]
        if duration + 0.015 < measured_duration:
            raise RuntimeError(f"正式窗口过短，会截掉原生音：{item['id']}")
        if item["startFrame"] < 0 or item["endFrameExclusive"] > plan["durationInFrames"]:
            raise RuntimeError("纸艺窗越界")
    sorted_sfx = sorted(plan["sfx"], key=lambda item: item["frame"])
    prior_source = None
    for item in sorted_sfx:
        path = resolve_source(item["source"]).resolve()
        if str(path) not in allowed:
            raise RuntimeError("音效不在已核对的V8允许清单：" + str(path))
        provenance = allowed[str(path)]
        if helper.sha(path) != provenance["sha256"]:
            raise RuntimeError("音效源哈希在量测后发生变化：" + item["id"])
        start, end = float(item["trimStart"]), float(item["trimEnd"])
        if start < 0 or end <= start or end > provenance["metrics"]["durationSeconds"] + 1 / SR:
            raise RuntimeError("音效裁切窗越界：" + item["id"])
        timeline_start = item["frame"] / plan["fps"]
        timeline_end = timeline_start + end - start
        if timeline_start < 0 or timeline_end > total_seconds:
            raise RuntimeError("音效时间轴越界：" + item["id"])
        if any(timeline_start < paper["endFrameExclusive"] / plan["fps"] and
               timeline_end > paper["startFrame"] / plan["fps"] for paper in plan["paper"]):
            raise RuntimeError("纸艺原生动作窗中禁止再叠普通Remotion音效：" + item["id"])
        if item["source"] == prior_source:
            raise RuntimeError("相邻事件重复同一音效源：" + item["id"])
        prior_source = item["source"]
        previous = sources.setdefault(str(path), [])
        if previous and item["frame"] - previous[-1] < 750:
            raise RuntimeError("同源25秒内重复：" + item["id"])
        previous.append(item["frame"])
        if len(previous) > 3:
            raise RuntimeError("同源全片超过三次：" + item["id"])
        samples = helper.pcm(path)
        first, last = round(start * SR) * 2, round(end * SR) * 2
        trimmed = samples[first:last]
        actual_offset = rms_peak_seconds(trimmed)
        actual_transient_frame = item["frame"] + actual_offset * plan["fps"]
        error = actual_transient_frame - item["visualFrame"]
        if abs(error) > 2:
            raise RuntimeError(f"裁切后有效瞬态偏离视觉超过2帧：{item['id']}，{error:.3f}帧")
        if abs(actual_offset - item["transientOffsetSeconds"]) > 2 / plan["fps"]:
            raise RuntimeError("计划瞬态偏移与实测不符：" + item["id"])
        cues.append({
            **item, "resolvedSource": str(path), "sourceSha256": provenance["sha256"],
            "license": provenance["license"], "licenseReference": provenance["licenseReference"],
            "licenseReferenceSha256": provenance["licenseReferenceSha256"],
            "measuredTrimmedTransientOffsetSeconds": actual_offset,
            "measuredTransientTimelineFrame": actual_transient_frame,
            "actualSyncErrorFrames": error, "sampleDelay": round(timeline_start * SR),
            "gainIsCandidateNotListeningAcceptance": True,
        })
    for previous, current in zip(cues, cues[1:]):
        previous_end = previous["frame"] / 30 + previous["trimEnd"] - previous["trimStart"]
        if previous_end > current["frame"] / 30:
            raise RuntimeError("附加前景主音效重叠：" + previous["id"] + "/" + current["id"])
    return plan, cues


def validate_revision(plan_path):
    prior_path = REPORT / "视觉声音规划.r1.json"
    prior = json.loads(prior_path.read_text(encoding="utf-8"))
    current = json.loads(Path(plan_path).read_text(encoding="utf-8"))
    expected = json.loads(json.dumps(prior))
    expected["schemaVersion"] = "ten-ai-businesses-visual-sound-plan/r2"
    advance = {"elder-needs": 1, "customer-question": 2}
    for cue in expected["sfx"]:
        if cue["id"] in advance:
            cue["frame"] -= advance[cue["id"]]
            cue["predictedSyncErrorFrames"] = round(cue["predictedSyncErrorFrames"] - advance[cue["id"]], 3)
    if current != expected:
        raise RuntimeError("R2越过两处音点提前边界，停止")
    return {"priorPlanPath": str(prior_path), "priorPlanSha256": helper.sha(prior_path),
            "fileEntryAdvanceFrames": advance, "visualTimesUnchanged": True,
            "gainTrimAndOtherCuesUnchanged": True}



def mix(context_path, plan_path):
    revision = validate_revision(plan_path)
    context = helper.validate_context(context_path)
    measurement_path = REPORT / "音频源与瞬态量测.v1.json"
    measurements = json.loads(measurement_path.read_text(encoding="utf-8"))
    plan, cues = validate_plan(plan_path, measurements)
    source_hash = helper.sha(helper.SOURCE)
    if source_hash != helper.EXPECTED_SOURCE_SHA:
        raise RuntimeError("原口播输入变化，停止")
    original = OUTPUT / "original.wav"
    original_receipt = json.loads((REPORT / "原口播音轨提取回执.v1.json").read_text(encoding="utf-8"))
    if helper.sha(original) != original_receipt["outputSha256"]:
        raise RuntimeError("已提取的完整原声音轨变化，停止")
    for name in ("native-mix.r2.wav", "final-mix.r2.wav", "_native-premix.r2.f32.wav", "_withsfx-premix.r2.f32.wav"):
        if (OUTPUT / name).exists():
            raise RuntimeError("不覆盖已有音轨：" + name)
    total_samples = plan["durationInFrames"] * SR // plan["fps"]
    total_seconds = total_samples / SR
    voice_gain = 4.0
    voice_lufs = measurements["source"]["loudness"]["integratedLufs"] + voice_gain
    target_native_lufs = voice_lufs - 10
    native_by_id = {item["id"]: item for item in measurements["nativePaper"]}
    paper = []
    command = [FFMPEG, "-nostdin", "-hide_banner", "-loglevel", "error", "-n", "-i", str(original)]
    for item in plan["paper"]:
        command.extend(["-i", str(resolve_source(item["source"]))])
        native = native_by_id[item["id"]]
        gain = round(target_native_lufs - native["loudness"]["integratedLufs"], 3)
        paper.append({**item, "gainDb": gain, "sourceSha256": native["sha256"],
                      "sourceIntegratedLufs": native["loudness"]["integratedLufs"],
                      "targetNativeIntegratedLufsBeforeMaster": target_native_lufs,
                      "limiterCeilingDbfs": -12 if item["id"] in ("P02", "P05") else None,
                      "sampleDelay": item["startFrame"] * SR // plan["fps"],
                      "sourceStartSeconds": 0, "nativeAudioPreserved": True})
    for cue in cues:
        command.extend(["-i", cue["resolvedSource"]])
    filters = [
        f"[0:a]aresample={SR},aformat=sample_fmts=fltp:channel_layouts=stereo,"
        f"apad=whole_len={total_samples},atrim=end_sample={total_samples},volume={voice_gain}dB,"
        "asplit=3[vn][vf][voicekey]"
    ]
    for index, item in enumerate(paper, 1):
        duration = (item["endFrameExclusive"] - item["startFrame"]) / plan["fps"]
        processing = f"[{index}:a]aresample={SR},aformat=sample_fmts=fltp:channel_layouts=stereo,"
        processing += f"atrim=start=0:duration={duration:.9f},asetpts=PTS-STARTPTS,volume={item['gainDb']}dB"
        if item["limiterCeilingDbfs"] is not None:
            processing += f",alimiter=limit={helper.amplitude(item['limiterCeilingDbfs']):.12f}:attack=5:release=50:level=0:latency=1"
        processing += f",afade=t=in:d=0.005,afade=t=out:st={max(0,duration-0.030):.9f}:d=0.030"
        processing += f",apad=whole_len={round(duration*SR)},adelay={item['sampleDelay']}S:all=1,"
        processing += f"apad=whole_len={total_samples},atrim=end_sample={total_samples}[p{index}]"
        filters.append(processing)
    filters.append("".join(f"[p{index}]" for index in range(1, 7)) +
                   "amix=inputs=6:duration=longest:normalize=0,asplit=2[pn][pf]")
    for index, cue in enumerate(cues):
        input_index = 7 + index
        length = cue["trimEnd"] - cue["trimStart"]
        filters.append(
            f"[{input_index}:a]aresample={SR},aformat=sample_fmts=fltp:channel_layouts=stereo,"
            f"atrim=start={cue['trimStart']:.9f}:end={cue['trimEnd']:.9f},asetpts=PTS-STARTPTS,"
            f"volume={cue['gainDb']}dB,afade=t=in:d=0.003,"
            f"afade=t=out:st={max(0,length-0.025):.9f}:d=0.025,"
            f"adelay={cue['sampleDelay']}S:all=1,apad=whole_len={total_samples},"
            f"atrim=end_sample={total_samples}[s{index}]"
        )
    filters.append("".join(f"[s{index}]" for index in range(len(cues))) +
                   f"amix=inputs={len(cues)}:duration=longest:normalize=0[sfxbus]")
    filters.append("[sfxbus][voicekey]sidechaincompress=threshold=0.05:ratio=3:attack=5:release=70:"
                   "makeup=1:detection=rms:link=maximum:mix=1[sfxducked]")
    filters.extend([
        f"[vn][pn]amix=inputs=2:normalize=0,atrim=end_sample={total_samples}[nativeout]",
        f"[vf][pf][sfxducked]amix=inputs=3:normalize=0,atrim=end_sample={total_samples}[without]",
    ])
    graph = ";".join(filters)
    native_premix, with_premix = OUTPUT / "_native-premix.r2.f32.wav", OUTPUT / "_withsfx-premix.r2.f32.wav"
    command.extend(["-filter_complex", graph, "-map", "[nativeout]", "-ar", str(SR), "-ac", "2",
                    "-c:a", "pcm_f32le", str(native_premix), "-map", "[without]", "-ar", str(SR), "-ac", "2",
                    "-c:a", "pcm_f32le", str(with_premix)])
    helper.run(command)
    first_pass = master_measurement(with_premix)
    meter = first_pass["loudnorm"]
    master_filter = (
        "loudnorm=I=-16.5:TP=-1.8:LRA=11:"
        f"measured_I={meter['input_i']}:measured_LRA={meter['input_lra']}:"
        f"measured_TP={meter['input_tp']}:measured_thresh={meter['input_thresh']}:"
        f"offset={meter['target_offset']}:linear=false:print_format=json,aresample={SR},"
        f"apad=whole_len={total_samples},atrim=end_sample={total_samples}"
    )
    master_commands, outputs = [], []
    for source, destination in ((with_premix, OUTPUT / "final-mix.r2.wav"),
                                (native_premix, OUTPUT / "native-mix.r2.wav")):
        mastering = [FFMPEG, "-nostdin", "-hide_banner", "-nostats", "-n", "-i", str(source),
                     "-af", master_filter, "-ar", str(SR), "-ac", "2", "-c:a", "pcm_s16le", str(destination)]
        helper.run(mastering)
        master_commands.append(mastering)
        meter_result = helper.loudness(destination)
        outputs.append({"path": str(destination), "sha256": helper.sha(destination),
                        "probe": helper.probe(destination), "loudness": meter_result})
    if any(item["loudness"]["truePeakDbtp"] > -1.5 for item in outputs):
        raise RuntimeError("实际输出峰值未通过安全线；保留候选，不标记通过，不修改原口播")
    if abs(outputs[0]["loudness"]["integratedLufs"] + 16.5) > 0.7:
        raise RuntimeError("有附加音效候选整体响度未接近目标；不得假称通过")
    receipt = {
        "schemaVersion": "ten-ai-businesses-audio-mix-receipt/r2", "createdAt": helper.now(),
        "status": "technical-audio-candidate-generated-pending-listening",
        "revision": revision, "context": context, "planPath": str(Path(plan_path).resolve()), "planSha256": helper.sha(plan_path),
        "sourcePath": str(helper.SOURCE), "sourceSha256": source_hash,
        "originalAudioPath": str(original), "originalAudioSha256": helper.sha(original),
        "measurementPath": str(measurement_path), "measurementSha256": helper.sha(measurement_path),
        "fps": plan["fps"], "durationInFrames": plan["durationInFrames"], "audioSamples": total_samples,
        "audioDurationSeconds": total_seconds, "voiceGainDbBeforeMaster": voice_gain,
        "spokenContentChanged": False, "originalVoiceCut": False, "originalVoiceSpeedChanged": False,
        "voiceSidechainDucked": False, "sidechainTarget": "added-Remotion-SFX-only",
        "sidechain": {"threshold": 0.05, "ratio": 3, "attackMs": 5, "releaseMs": 70, "makeup": 1},
        "nativePaper": paper, "sfx": cues, "sourceCount": len(set(cue["source"] for cue in cues)),
        "actualTransientSyncWithinTwoFrames": all(abs(cue["actualSyncErrorFrames"]) <= 2 for cue in cues),
        "foregroundCueOverlap": False, "sfxInPaperWindows": False,
        "excludedR2Sources": ["motion-upgrade-r1/sfx/hook.wav", "motion-upgrade-r1/sfx/confirm.wav"],
        "filterComplex": graph, "premixCommand": command,
        "mastering": {"targetIntegratedLufs": -16.5, "targetTruePeakDbtp": -1.8,
                      "firstPassFromWithSfx": first_pass, "sameMeasuredParametersForBothVariants": True,
                      "filter": master_filter, "commands": master_commands,
                      "mode": "dynamic-common-mastering-not-voice-sidechain",
                      "note": "两版本复用同一参数集和混音关系；动态主混音会改变整体振幅，不声称两版人声样本严格相同"},
        "intermediateOutputs": [{"path": str(path), "sha256": helper.sha(path)}
                                for path in (native_premix, with_premix)],
        "outputs": outputs, "humanListeningPerformed": False, "userAudibilityConfirmed": False,
        "sourceSha256After": helper.sha(helper.SOURCE),
    }
    assert receipt["sourceSha256After"] == source_hash
    helper.write_json(REPORT / "mixreceipt.r2.json", receipt)
    print(json.dumps({"status": receipt["status"], "outputs": outputs,
                      "nativeGains": [{"id": item["id"], "gainDb": item["gainDb"]} for item in paper],
                      "sfxCount": len(cues), "sourceCount": receipt["sourceCount"],
                      "maxSyncErrorFrames": max(abs(cue["actualSyncErrorFrames"]) for cue in cues)}, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--context", required=True)
    parser.add_argument("--plan", required=True)
    arguments = parser.parse_args()
    mix(arguments.context, arguments.plan)
