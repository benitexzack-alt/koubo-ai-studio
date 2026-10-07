"""只读检查已生成预混音：附加音效差分的瞬态、人声路径与完整样本数。"""

from array import array
import importlib.util
import json
import math
from pathlib import Path


BASE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("ten_ai_prepare", BASE / "prepare-audio.v1.py")
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)


def power(samples):
    return sum(value * value for value in samples) / max(1, len(samples))


def db(value):
    return 10 * math.log10(max(value, 1e-30))


def verify():
    receipt_path = BASE / "mixreceipt.r1.json"
    receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
    source_before = helper.sha(helper.SOURCE)
    if source_before != receipt["sourceSha256"]:
        raise RuntimeError("原口播来源变化，停止只读核对")
    tracks = {}
    for item in receipt["intermediateOutputs"]:
        path = Path(item["path"])
        if helper.sha(path) != item["sha256"]:
            raise RuntimeError("预混音哈希与回执不同")
        tracks[path.name] = helper.pcm(path)
    native = tracks["_native-premix.f32.wav"]
    added = tracks["_withsfx-premix.f32.wav"]
    expected = receipt["audioSamples"] * 2
    if len(native) != expected or len(added) != expected:
        raise RuntimeError("两版预混音样本数不是本期完整时间轴")
    cues = []
    block = 240 * 2
    for cue in receipt["sfx"]:
        first = cue["sampleDelay"] * 2
        length = round((cue["trimEnd"] - cue["trimStart"]) * helper.SR) * 2
        difference = array("f", (added[index] - native[index]
                                 for index in range(first, first + length)))
        energies = [power(difference[start:start + block])
                    for start in range(0, len(difference), block)]
        peak_index = max(range(len(energies)), key=lambda index: energies[index])
        actual_frame = cue["frame"] + peak_index * 0.005 * receipt["fps"]
        cues.append({
            "id": cue["id"], "eventId": cue["eventId"],
            "source": cue["source"], "frame": cue["frame"],
            "visualFrame": cue["visualFrame"],
            "addedSfxDifferenceRmsDbfs": db(power(difference)),
            "actualPremixPeakFrame": actual_frame,
            "actualPremixPeakErrorFrames": actual_frame - cue["visualFrame"],
            "actualPremixPeakWithinTwoFrames": abs(actual_frame - cue["visualFrame"]) <= 2,
            "sidechainTarget": receipt["sidechainTarget"],
        })
    original = helper.pcm(Path(receipt["originalAudioPath"]))
    gain = 10 ** (receipt["voiceGainDbBeforeMaster"] / 20)
    paper_intervals = [(item["startFrame"] * helper.SR // receipt["fps"],
                        item["endFrameExclusive"] * helper.SR // receipt["fps"])
                       for item in receipt["nativePaper"]]
    squared_error = squared_voice = 0.0
    maximum_error = 0.0
    sample_count = 0
    for index, sample in enumerate(original):
        sample_frame = index // 2
        if any(start <= sample_frame < end for start, end in paper_intervals):
            continue
        expected_voice = sample * gain
        error = native[index] - expected_voice
        squared_error += error * error
        squared_voice += expected_voice * expected_voice
        maximum_error = max(maximum_error, abs(error))
        sample_count += 1
    source_after = helper.sha(helper.SOURCE)
    report = {
        "schemaVersion": "ten-ai-businesses-premix-numerical-check/r1",
        "createdAt": helper.now(), "mixReceiptPath": str(receipt_path),
        "mixReceiptSha256": helper.sha(receipt_path),
        "scope": "对已生成预混音的只读数值检查，不是试听和听感验收",
        "wholeTimelineSampleCount": receipt["audioSamples"],
        "wholeTimelineDurationSeconds": receipt["audioDurationSeconds"],
        "nativeAndWithSfxSampleCountsEqual": len(native) == len(added),
        "cues": cues,
        "allAddedSfxNonSilent": all(item["addedSfxDifferenceRmsDbfs"] > -100 for item in cues),
        "actualPremixAllPeaksWithinTwoFrames": all(item["actualPremixPeakWithinTwoFrames"] for item in cues),
        "actualPremixMaxPeakErrorFrames": max(abs(item["actualPremixPeakErrorFrames"]) for item in cues),
        "voicePathCheck": {
            "checkedOutsidePaperWindows": True,
            "reference": "提取原声乘固定+4dB与NoSfx预混音逐样本比较；纸艺窗外不应有其他声源",
            "channelSampleCount": sample_count,
            "maximumAbsoluteFloatError": maximum_error,
            "errorRmsDbfs": db(squared_error / sample_count),
            "relativeErrorDb": db(squared_error / max(squared_voice, 1e-30)),
            "passesFloatTolerance": maximum_error < 1e-6,
            "doesNotClaimMasteredVariantsSampleIdentical": True,
        },
        "sourceSha256Before": source_before, "sourceSha256After": source_after,
        "sourceUnchanged": source_before == source_after,
        "humanListeningPerformed": False, "userAudibilityConfirmed": False,
        "status": "数值检查通过待试听" if all(item["actualPremixPeakWithinTwoFrames"] for item in cues)
                  and maximum_error < 1e-6 else "数值检查发现疑点待核对",
    }
    helper.write_json(BASE / "预混音差分与人声路径核对.r1.json", report)
    print(json.dumps({key: report[key] for key in (
        "status", "actualPremixMaxPeakErrorFrames", "allAddedSfxNonSilent", "voicePathCheck")}, ensure_ascii=False))


if __name__ == "__main__":
    verify()
