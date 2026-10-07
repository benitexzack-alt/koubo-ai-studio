"""本期完整候选的只读机器媒体检查；没有试听、观看或发布验收权限。"""

import argparse
from datetime import datetime, timezone
from fractions import Fraction
import hashlib
import json
import math
from pathlib import Path
import re
import shutil
import subprocess
import sys

import numpy as np


ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
FILM = ROOT / "edit/20261006_ten_ai_businesses/08_正式成片/10个AI生意_V8_R1_1080P_完整候选.mp4"
ALIGNED_FILM = ROOT / "edit/20261006_ten_ai_businesses/08_正式成片/10个AI生意_V8_R1_1080P_成片.mp4"
REFERENCE = ROOT / "remotion/public-ten-ai-businesses-final-r1/ten-ai-businesses-final-r1/audio/final-mix.r2.wav"
MIX_RECEIPT = ROOT / "edit/20261006_ten_ai_businesses/10_声音准备/mixreceipt.r2.json"
FRAMES = 8534
FPS = 30
DURATION = FRAMES / FPS
SR = 16000
WINDOWS = (2.0, 60.0, 140.0, 205.0, 278.0)
WINDOW_DURATION = 4.0
SEARCH_PADDING = 0.2
MAX_DELAY_SECONDS = 0.002
MIN_CORRELATION = 0.97


def sha(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(8 * 1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def local(path):
    return str(path.relative_to(ROOT))


def require_regular(path):
    if not path.is_file() or path.is_symlink() or path.resolve() != path:
        raise RuntimeError(f"输入不存在或不是本期普通文件：{path}")


def run(command):
    result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode != 0:
        detail = result.stderr.decode("utf-8", errors="replace")[-6000:]
        raise RuntimeError(f"只读媒体命令失败，退出码{result.returncode}：{detail}")
    return result


def probe(path):
    command = [shutil.which("ffprobe"), "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)]
    return json.loads(run(command).stdout), command


def pcm_window(path, start, duration):
    command = [shutil.which("ffmpeg"), "-nostdin", "-hide_banner", "-loglevel", "error", "-i", str(path),
               "-ss", str(start), "-t", str(duration), "-map", "0:a:0", "-ac", "1", "-ar", str(SR),
               "-c:a", "pcm_f32le", "-f", "f32le", "pipe:1"]
    samples = np.frombuffer(run(command).stdout, dtype="<f4").astype(np.float64)
    return samples, command


def correlate(reference, padded_output, padding_samples):
    # 正延迟表示MP4声音较参考预混音晚；只在±0.2秒窗内搜索，不把采样误差当新剪辑点。
    count = len(reference)
    if count < SR or len(padded_output) < count:
        raise RuntimeError("交叉相关窗口没有完整可解码音频")
    a = reference - np.mean(reference)
    b = padded_output - np.mean(padded_output)
    energy_a = float(np.dot(a, a))
    if energy_a < 1e-10:
        raise RuntimeError("交叉相关参考窗接近静音，不能证明延时")
    limit = len(b) - count
    fft_size = 1 << (len(b) + count - 2).bit_length()
    products = np.fft.irfft(np.fft.rfft(b, fft_size) * np.conj(np.fft.rfft(a, fft_size)), fft_size)[:limit + 1]
    cumulative = np.concatenate(([0.0], np.cumsum(b)))
    cumulative_sq = np.concatenate(([0.0], np.cumsum(b * b)))
    sums = cumulative[count:] - cumulative[:-count]
    energies = cumulative_sq[count:] - cumulative_sq[:-count] - sums * sums / count
    scores = products / np.sqrt(np.maximum(energies * energy_a, 1e-30))
    best = int(np.argmax(scores))
    correlation = float(scores[best])
    delay_samples = best - padding_samples
    return {"lagSamplesAt16k": delay_samples, "delayMilliseconds": delay_samples / SR * 1000,
            "correlation": correlation, "bestFitGain": float(products[best] / energy_a),
            "delayWithinTwoMilliseconds": abs(delay_samples / SR) <= MAX_DELAY_SECONDS,
            "correlationAtLeast097": correlation >= MIN_CORRELATION}


def self_test():
    rng = np.random.default_rng(20261006)
    reference = rng.normal(0, 0.1, SR * 2)
    padding = round(SEARCH_PADDING * SR)
    found = []
    for shift in (-17, 0, 23):
        output = np.zeros(len(reference) + 2 * padding)
        output[padding + shift:padding + shift + len(reference)] = reference * 0.95
        result = correlate(reference, output, padding)
        if result["lagSamplesAt16k"] != shift or result["correlation"] < 0.9999:
            raise RuntimeError("FFT交叉相关自检失败")
        found.append({"expectedSamples": shift, **result})
    print(json.dumps({"status": "计算函数自检通过；不是成片检查", "cases": found}, ensure_ascii=False))


def finite_number(value):
    parsed = float(value)
    return parsed if math.isfinite(parsed) else None


def write_exclusive(path, value):
    with path.open("x", encoding="utf-8") as stream:
        stream.write(value)


def inspect(film=FILM, revision="r1"):
    for tool in ("ffmpeg", "ffprobe"):
        if not shutil.which(tool):
            raise RuntimeError(f"本机缺少{tool}；不安装依赖")
    for path in (film, REFERENCE, MIX_RECEIPT):
        require_regular(path)
    report_paths = [OUT / f"媒体检查.{revision}.{suffix}" for suffix in ("json", "md", "log")]
    if any(path.exists() for path in report_paths):
        raise RuntimeError("本期检查报告已存在，禁止静默覆盖；如需重查由主任务选择新修订")
    started = datetime.now(timezone.utc).isoformat()
    film_sha_before, reference_sha_before = sha(film), sha(REFERENCE)
    mix_receipt = json.loads(MIX_RECEIPT.read_text(encoding="utf-8"))
    expected_reference = next((item for item in mix_receipt["outputs"] if Path(item["path"]) == REFERENCE), None)
    if expected_reference is None or expected_reference["sha256"] != reference_sha_before:
        raise RuntimeError("参考混音与R2真实混音回执不一致，停止检查")
    if len(mix_receipt.get("nativePaper", [])) != 6:
        raise RuntimeError("R2混音回执没有完整六镜纸艺原声绑定，不能登记保留")
    metadata, probe_command = probe(film)
    video = next((item for item in metadata["streams"] if item["codec_type"] == "video"), {})
    audio = next((item for item in metadata["streams"] if item["codec_type"] == "audio"), {})
    if not video or not audio:
        raise RuntimeError("成片缺少视频或音频轨")
    decode_command = [shutil.which("ffmpeg"), "-nostdin", "-hide_banner", "-nostats", "-err_detect", "explode",
                      "-i", str(film), "-map", "0:v:0", "-map", "0:a:0",
                      "-vf", "blackdetect=d=0.2:pix_th=0.10:pic_th=0.98",
                      "-af", "silencedetect=noise=-50dB:d=2,loudnorm=I=-16.5:TP=-1.8:LRA=11:print_format=json",
                      "-fps_mode", "passthrough", "-progress", "pipe:1", "-stats_period", "1", "-f", "null", "-"]
    decoded = run(decode_command)
    stdout = decoded.stdout.decode("utf-8", errors="replace")
    stderr = decoded.stderr.decode("utf-8", errors="replace")
    decoded_frames = [int(value) for value in re.findall(r"^frame=(\d+)\s*$", stdout, re.MULTILINE)]
    loudness_blocks = re.findall(r'\{\s*"input_i".*?\}', stderr, re.DOTALL)
    if not decoded_frames or not loudness_blocks or "progress=end" not in stdout:
        raise RuntimeError("全量解码未形成帧数、终止回执或响度量测")
    loudness_raw = json.loads(loudness_blocks[-1])
    loudness = {"integratedLufs": finite_number(loudness_raw["input_i"]),
                "truePeakDbtp": finite_number(loudness_raw["input_tp"]),
                "loudnessRangeLu": finite_number(loudness_raw["input_lra"]),
                "measurementOnly": True, "filterOutputDiscarded": True}
    black = [{"startSeconds": float(a), "endSeconds": float(b), "durationSeconds": float(c)}
             for a, b, c in re.findall(r"black_start:([\d.]+)\s+black_end:([\d.]+)\s+black_duration:([\d.]+)", stderr)]
    starts = [float(value) for value in re.findall(r"silence_start:\s*([\d.]+)", stderr)]
    ends = [float(value) for value in re.findall(r"silence_end:\s*([\d.]+)", stderr)]
    silence = [{"startSeconds": start, "endSeconds": ends[index] if index < len(ends) else DURATION,
                "durationSeconds": (ends[index] if index < len(ends) else DURATION) - start}
               for index, start in enumerate(starts)]
    correlations, window_commands = [], []
    padding_samples = round(SEARCH_PADDING * SR)
    for start in WINDOWS:
        a, command_a = pcm_window(REFERENCE, start, WINDOW_DURATION)
        b, command_b = pcm_window(film, start - SEARCH_PADDING, WINDOW_DURATION + 2 * SEARCH_PADDING)
        result = correlate(a, b, padding_samples)
        correlations.append({"startSeconds": start, "durationSeconds": WINDOW_DURATION, **result})
        window_commands.append({"reference": command_a, "encoded": command_b})
    film_sha_after, reference_sha_after = sha(film), sha(REFERENCE)
    checks = {
        "decoded8534Frames": decoded_frames[-1] == FRAMES,
        "metadataFrames8534": int(video.get("nb_frames", 0)) == FRAMES,
        "frameRate30": Fraction(video.get("avg_frame_rate", "0/1")) == FPS,
        "size1920x1080": video.get("width") == 1920 and video.get("height") == 1080,
        "durationWithinOneFrame": abs(float(metadata["format"]["duration"]) - DURATION) <= 1 / FPS,
        "audioAacPresent": audio.get("codec_name") == "aac",
        "audioNonSilent": loudness["integratedLufs"] is not None,
        "noSustainedBlackAtLeast02Seconds": len(black) == 0,
        "noSilenceAtLeastTwoSecondsBelowMinus50Db": len(silence) == 0,
        "integratedLoudnessWithinMinus18ToMinus15": loudness["integratedLufs"] is not None and -18 <= loudness["integratedLufs"] <= -15,
        "truePeakAtMostMinusOneDbtp": loudness["truePeakDbtp"] is not None and loudness["truePeakDbtp"] <= -1,
        "fiveAudioWindowsNoAddedDelay": all(value["delayWithinTwoMilliseconds"] for value in correlations),
        "fiveAudioWindowsCorrelated": all(value["correlationAtLeast097"] for value in correlations),
        "sourceFilesUnchangedDuringCheck": film_sha_before == film_sha_after and reference_sha_before == reference_sha_after,
    }
    report = {
        "schemaVersion": f"ten-ai-businesses-film-media-check/{revision}", "startedAt": started,
        "finishedAt": datetime.now(timezone.utc).isoformat(),
        "status": "技术检查通过，待人工观看与试听" if all(checks.values()) else "技术检查发现疑点，待主任务核对",
        "scope": "只读本期已导出的完整候选；不渲染、不改字幕、原声、纸艺、混音或发布状态。",
        "film": {"path": local(film), "sha256": film_sha_before, "bytes": film.stat().st_size, "probe": metadata},
        "reference": {"path": local(REFERENCE), "sha256": reference_sha_before,
                      "mixReceiptPath": local(MIX_RECEIPT), "mixReceiptSha256": sha(MIX_RECEIPT)},
        "checks": checks,
        "fullDecode": {"exitCode": decoded.returncode, "decodedFrames": decoded_frames[-1], "progressEnded": True},
        "blackThreshold": {"minimumSeconds": 0.2, "blackPixelThreshold": 0.1, "pictureBlackRatio": 0.98},
        "blackIntervals": black,
        "silenceThreshold": {"minimumSeconds": 2, "noiseDb": -50}, "silenceIntervals": silence,
        "encodedAacLoudness": loudness,
        "audioCorrelation": {"method": "16k单声道FFT规范化交叉相关；参考4秒、MP4额外±0.2秒搜索；不改音轨",
                             "positiveLagMeansEncodedAudioLate": True, "maximumAcceptedDelayMilliseconds": 2,
                             "minimumAcceptedCorrelation": MIN_CORRELATION, "windows": correlations},
        "paperNativeAudio": {"boundR2MixHasSixNativePaperTracks": True, "remixedAgain": False,
                             "meaning": "这里只验证最终AAC对R2全混音的五窗同步，不单独证明每镜正常速度听感。"},
        "humanListeningPerformed": False, "humanVisualReviewPerformed": False,
        "userAudibilityConfirmed": False, "fullWatchConfirmed": False, "publishAuthorized": False,
        "limitations": ["机器有声检测不证明音效贴合、清楚或不抢人声。", "黑帧检查不证明字体可读、遮罩无幻影或导演审美合格。",
                        "五窗交叉相关不代替完整语音听审。", "技术通过不构成用户终验或发布许可。"],
        "commands": {"probe": probe_command, "decodeAndMeasure": decode_command, "audioWindows": window_commands},
    }
    if revision == "r2":
        prior_report_path = OUT / "媒体检查.r1.json"
        require_regular(prior_report_path)
        prior_report = json.loads(prior_report_path.read_text(encoding="utf-8"))
        packet_command = [shutil.which("ffprobe"), "-v", "error", "-select_streams", "a:0", "-read_intervals", "%+#3",
                          "-show_packets", "-show_entries", "packet=pts,dts,pts_time,dts_time,duration_time,side_data_list",
                          "-of", "json", str(FILM)]
        prior_packets = json.loads(run(packet_command).stdout).get("packets", [])
        report["priorCandidateEncodingEvidence"] = {
            "priorReportPath": local(prior_report_path), "priorReportSha256": sha(prior_report_path),
            "priorFilmPath": prior_report["film"]["path"], "priorFilmSha256": prior_report["film"]["sha256"],
            "firstThreeAudioPackets": prior_packets,
            "skipSamplesSideDataReturned": any("skip_samples" in data for packet in prior_packets for data in packet.get("side_data_list", [])),
            "priorFiveWindowDelayMilliseconds": [value["delayMilliseconds"] for value in prior_report["audioCorrelation"]["windows"]],
            "observation": "R1前三包PTS/DTS从0起、每包约21.333毫秒；ffprobe未返回skip_samples；五窗均延后42.6875毫秒。",
            "inferenceOnly": "稳定延迟约等于48k下2048个样本，支持起始编码延迟未补偿这一候选原因；不是普遍根因证明。",
            "r1ReportsPreserved": True, "packetProbeCommand": packet_command,
        }
    markdown = [f"# 《10个AI生意》{'完整候选' if revision == 'r1' else '完整成片'}媒体检查 {revision.upper()}", "", f"状态：{report['status']}", "",
                f"成片：`{local(film)}`", f"实际解码：{decoded_frames[-1]}帧；目标8534帧／30fps／1920×1080。",
                f"AAC综合响度：{loudness['integratedLufs']} LUFS；真峰：{loudness['truePeakDbtp']} dBTP。", "",
                "| 检查 | 结果 |", "|---|---|"]
    labels = {
        "decoded8534Frames": "全量解码8534帧", "metadataFrames8534": "容器记录8534帧", "frameRate30": "帧率30fps",
        "size1920x1080": "画幅1920×1080", "durationWithinOneFrame": "全片时长误差不超过1帧", "audioAacPresent": "AAC音轨存在",
        "audioNonSilent": "全片有声", "noSustainedBlackAtLeast02Seconds": "无持续0.2秒黑帧", "noSilenceAtLeastTwoSecondsBelowMinus50Db": "无低于−50dB的2秒长静音",
        "integratedLoudnessWithinMinus18ToMinus15": "综合响度处于−18至−15LUFS", "truePeakAtMostMinusOneDbtp": "真峰不超过−1dBTP",
        "fiveAudioWindowsNoAddedDelay": "首中尾五窗新增延迟不超过2毫秒", "fiveAudioWindowsCorrelated": "五窗与R2混音相关度≥0.97",
        "sourceFilesUnchangedDuringCheck": "只读检查期间输入未变化",
    }
    markdown.extend(f"| {labels[key]} | {'通过' if value else '待核对'} |" for key, value in checks.items())
    markdown.extend(["", "## 首、中、尾五窗音频同步", "", "| 起点（秒） | 延迟（毫秒） | 相关度 |", "|---:|---:|---:|"])
    markdown.extend(f"| {value['startSeconds']} | {value['delayMilliseconds']:.4f} | {value['correlation']:.6f} |" for value in correlations)
    markdown.extend(["", f"持续黑帧：{len(black)}段；长静音：{len(silence)}段。详细区间保存在同名JSON。", "",
                     "没有试听或人工完整观看；不声称用户可感，不重复混音纸艺原声。技术检查不是导演审美、字幕内容或用户终验。",
                     "正式人审、完整观看与公开发布状态全部保持未确认。", ""])
    if revision == "r2":
        diagnosis = report["priorCandidateEncodingEvidence"]
        markdown.extend(["## R1编码延迟溯源边界", "", diagnosis["observation"], "", diagnosis["inferenceOnly"], "",
                         "R1失败报告原样保留；本次R2是否同步通过仅按新成片实际量测判断，不由修正命令成功推出。", ""])
    write_exclusive(report_paths[0], json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    write_exclusive(report_paths[1], "\n".join(markdown))
    write_exclusive(report_paths[2], "[解码进度]\n" + stdout + "\n[解码、黑帧、静音与响度量测]\n" + stderr)
    print(json.dumps({"status": report["status"], "report": local(report_paths[0]), "checks": checks,
                      "loudness": loudness, "correlations": correlations}, ensure_ascii=False))
    return 0 if all(checks.values()) else 2


def main():
    parser = argparse.ArgumentParser(description="本期只读媒体检查；默认只显示准备状态，不解码成片。")
    parser.add_argument("--run", action="store_true", help="根任务确认实际MP4完成后才运行")
    parser.add_argument("--self-test", action="store_true", help="仅测试交叉相关计算，不读取成片")
    parser.add_argument("--final-audio-aligned", action="store_true", help="只选择本期新成片固定路径与R2报告；不预设其实际同步通过")
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return 0
    film, revision = (ALIGNED_FILM, "r2") if args.final_audio_aligned else (FILM, "r1")
    if not args.run:
        print(json.dumps({"status": "检查脚本已准备，尚未检查成片", "film": local(film), "filmExists": film.is_file(),
                          "reportRevision": revision,
                          "humanListeningPerformed": False, "runOnlyAfterActualRenderCompletes": True}, ensure_ascii=False))
        return 0
    return inspect(film, revision)


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as error:
        print(f"本期只读媒体检查停止：{error}", file=sys.stderr)
        sys.exit(1)
