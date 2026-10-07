"""只读检查本期字幕修正版；复用原媒体量测，额外核对完整原音轨与87页字幕。"""

import argparse
from contextlib import redirect_stdout
from datetime import datetime, timezone
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import shutil
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
BASE = ROOT / "edit/20261006_ten_ai_businesses"
FILM = BASE / "08_正式成片/10个AI生意_V8_R2_1080P_字幕修正版.mp4"
PRIOR_FILM = BASE / "08_正式成片/10个AI生意_V8_R1_1080P_成片.mp4"
PRIOR_FILM_SHA256 = "1b42b91c4299f0fb8b8f1d7c98dc4492915d7f24553222c3437e7d59bd5f5352"
PRIOR_RUNTIME = ROOT / "remotion/src/ten-ai-businesses-final-r1/runtime-plan.r1.json"
RUNTIME = ROOT / "remotion/src/ten-ai-businesses-final-r2/runtime-plan.r2.json"
EMPHASIS = ROOT / "remotion/src/ten-ai-businesses-final-r2/caption-emphasis.r2.json"
BASE_CHECKER = BASE / "13_成片质检/媒体检查.r1.py"
SAMPLE_RATE = 48000
CHANNELS = 2
PCM_BYTES_PER_SAMPLE = 4


def digest(path):
    value = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(8 * 1024 * 1024), b""):
            value.update(block)
    return value.hexdigest()


def local(path):
    return str(path.relative_to(ROOT))


def regular(path):
    if not path.is_file() or path.is_symlink() or path.resolve() != path:
        raise RuntimeError(f"输入缺失或不是本项目普通文件：{path}")


def run(command):
    result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode:
        raise RuntimeError(result.stderr.decode("utf-8", errors="replace")[-5000:])
    return result.stdout


def stable_digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True,
                                     separators=(",", ":")).encode("utf-8")).hexdigest()


def encoded_audio(path):
    stream_command = [shutil.which("ffmpeg"), "-nostdin", "-v", "error", "-i", str(path),
                      "-map", "0:a:0", "-c:a", "copy", "-f", "streamhash", "-hash", "sha256", "pipe:1"]
    stream_result = run(stream_command).decode("ascii").strip()
    if not stream_result.startswith("0,a,SHA256="):
        raise RuntimeError("未取得AAC压缩码流SHA256")
    packet_command = [shutil.which("ffprobe"), "-v", "error", "-select_streams", "a:0", "-show_packets",
                      "-show_entries", "packet=pts,dts,duration,size,flags,side_data_list", "-of", "json", str(path)]
    packets = json.loads(run(packet_command)).get("packets", [])
    if not packets or any(not {"pts", "dts", "duration", "size"}.issubset(packet) for packet in packets):
        raise RuntimeError("未取得全部音频包的PTS、DTS、duration及size")
    stream_info_command = [shutil.which("ffprobe"), "-v", "error", "-select_streams", "a:0", "-show_streams",
                           "-show_entries", "stream=codec_name,sample_rate,channels,time_base,start_pts,duration_ts,extradata_size",
                           "-of", "json", str(path)]
    streams = json.loads(run(stream_info_command)).get("streams", [])
    if len(streams) != 1:
        raise RuntimeError("音频流元数据异常")
    stream_fields = ("codec_name", "sample_rate", "channels", "time_base", "start_pts", "duration_ts", "extradata_size")
    stream_info = {field: streams[0].get(field) for field in stream_fields}
    return {"streamSha256": stream_result.split("=", 1)[1], "packetCount": len(packets),
            "packetTimingAndSizesSha256": stable_digest(packets), "firstPackets": packets[:3],
            "lastPackets": packets[-3:], "streamInfo": stream_info,
            "commands": {"streamHash": stream_command, "allPackets": packet_command, "streamInfo": stream_info_command}}


def pcm_audio(path):
    # 完整解码到规范48k双声道float32，边读取边摘要，不落盘音频或更改原片。
    command = [shutil.which("ffmpeg"), "-nostdin", "-hide_banner", "-v", "error", "-i", str(path),
               "-map", "0:a:0", "-ac", str(CHANNELS), "-ar", str(SAMPLE_RATE),
               "-c:a", "pcm_f32le", "-f", "f32le", "pipe:1"]
    process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    value = hashlib.sha256()
    byte_count = 0
    while True:
        block = process.stdout.read(1024 * 1024)
        if not block:
            break
        byte_count += len(block)
        value.update(block)
    error = process.stderr.read()
    if process.wait() != 0:
        raise RuntimeError(error.decode("utf-8", errors="replace")[-5000:])
    frame_bytes = CHANNELS * PCM_BYTES_PER_SAMPLE
    if not byte_count or byte_count % frame_bytes:
        raise RuntimeError("完整PCM样本数不合法")
    return {"sha256": value.hexdigest(), "bytes": byte_count, "samplesPerChannel": byte_count // frame_bytes,
            "sampleRate": SAMPLE_RATE, "channels": CHANNELS, "format": "float32-le", "command": command}


def caption_check():
    before = json.loads(PRIOR_RUNTIME.read_text(encoding="utf-8"))
    after = json.loads(RUNTIME.read_text(encoding="utf-8"))
    emphasis = json.loads(EMPHASIS.read_text(encoding="utf-8"))
    old_captions, captions = before.pop("captions"), after.pop("captions")
    without_highlights = [{key: value for key, value in caption.items() if key != "highlights"} for caption in captions]
    page_ids = [caption["id"] for caption in captions]
    all_pages_match = len(set(page_ids)) == len(page_ids) and sorted(emphasis) == sorted(page_ids)
    literal = True
    highlight_count = 0
    highlighted_pages = 0
    for caption in captions:
        words = caption.get("highlights")
        valid_list = isinstance(words, list) and all(isinstance(word, str) and word for word in words)
        all_pages_match = all_pages_match and valid_list and words == emphasis.get(caption["id"])
        literal = literal and valid_list and len(words) == len(set(words)) and all(word in caption["chinese"] for word in words)
        if valid_list:
            highlight_count += len(words)
            highlighted_pages += bool(words)
    return {"priorPageCount": len(old_captions), "pageCount": len(captions),
            "captionsExceptHighlightsEqual": old_captions == without_highlights,
            "nonCaptionRuntimeEqual": before == after, "allPagesMatchEmphasis": bool(all_pages_match),
            "allHighlightsAreLiteralSubstrings": bool(literal), "highlightCount": highlight_count,
            "highlightedPageCount": highlighted_pages,
            "meaning": "只验证原文字、英文、时点和重点词数据；实际颜色、实心字观感另看输出画面。"}


def inspect():
    for tool in ("ffmpeg", "ffprobe"):
        if not shutil.which(tool):
            raise RuntimeError(f"本机缺少{tool}；不安装依赖")
    sources = (FILM, PRIOR_FILM, PRIOR_RUNTIME, RUNTIME, EMPHASIS, BASE_CHECKER)
    for path in sources:
        regular(path)
    report_json = OUT / "最终字幕修正版媒体检查.r2.json"
    report_md = OUT / "最终字幕修正版媒体检查.r2.md"
    if report_json.exists() or report_md.exists():
        raise RuntimeError("R2检查报告已存在，禁止静默覆盖")
    start = datetime.now(timezone.utc).isoformat()
    before_hashes = {local(path): digest(path) for path in sources}
    if before_hashes[local(PRIOR_FILM)] != PRIOR_FILM_SHA256:
        raise RuntimeError("R1已对齐成片SHA变化，不能作为原声音轨参照")
    captions = caption_check()
    current_audio = {"encoded": encoded_audio(FILM), "pcm": pcm_audio(FILM)}
    prior_audio = {"encoded": encoded_audio(PRIOR_FILM), "pcm": pcm_audio(PRIOR_FILM)}
    audio_checks = {
        "audioEncodedBytesIdenticalToR1": current_audio["encoded"]["streamSha256"] == prior_audio["encoded"]["streamSha256"],
        "audioPacketTimingAndSizesIdenticalToR1": current_audio["encoded"]["packetTimingAndSizesSha256"] == prior_audio["encoded"]["packetTimingAndSizesSha256"],
        "audioStreamTimeBaseAndMetadataIdenticalToR1": current_audio["encoded"]["streamInfo"] == prior_audio["encoded"]["streamInfo"],
        "audioDecodedSamplesIdenticalToR1": current_audio["pcm"]["sha256"] == prior_audio["pcm"]["sha256"] and current_audio["pcm"]["samplesPerChannel"] == prior_audio["pcm"]["samplesPerChannel"],
    }
    # 在内存中改报告输出目录和本轮输入；原R1脚本和全部报告保持原样。
    spec = importlib.util.spec_from_file_location("ten_ai_media_measurement_r1", BASE_CHECKER)
    checker = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(checker)
    checker.OUT = OUT
    measurement_stdout = io.StringIO()
    with redirect_stdout(measurement_stdout):
        media_exit = checker.inspect(film=FILM, revision="subtitle-r2")
    base_report_path = OUT / "媒体检查.subtitle-r2.json"
    base_report = json.loads(base_report_path.read_text(encoding="utf-8"))
    after_hashes = {local(path): digest(path) for path in sources}
    extra_checks = {**audio_checks,
        "captions87Pages": captions["priorPageCount"] == 87 and captions["pageCount"] == 87,
        "captionTextAndTimingUnchanged": captions["captionsExceptHighlightsEqual"],
        "nonCaptionRuntimeUnchanged": captions["nonCaptionRuntimeEqual"],
        "emphasisMatchesAll87Pages": captions["allPagesMatchEmphasis"],
        "emphasisLiteralSubstrings": captions["allHighlightsAreLiteralSubstrings"],
        "allComparedInputsUnchangedDuringCheck": before_hashes == after_hashes}
    checks = {**base_report["checks"], **extra_checks}
    report = {**base_report, "schemaVersion": "ten-ai-businesses-final-subtitle-media-check/r2",
              "startedAt": start, "finishedAt": datetime.now(timezone.utc).isoformat(),
              "status": "技术检查通过，待用户观看" if all(checks.values()) else "技术检查发现疑点，待主任务处理",
              "sourceHashes": before_hashes, "checks": checks,
              "baseMeasurement": {"report": local(base_report_path), "sha256": digest(base_report_path),
                                  "readOnlyChecker": local(BASE_CHECKER), "exitCode": media_exit},
              "audioIdentityAgainstR1": {"current": current_audio, "prior": prior_audio, "checks": audio_checks},
              "captionPreservation": captions,
              "humanListeningPerformed": False, "humanVisualReviewPerformed": False,
              "userAudibilityConfirmed": False, "fullWatchConfirmed": False, "publishAuthorized": False}
    with report_json.open("x", encoding="utf-8") as stream:
        stream.write(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    labels = {
        "audioEncodedBytesIdenticalToR1": "AAC压缩码流与R1完全一致",
        "audioPacketTimingAndSizesIdenticalToR1": "全部音频包时点、时长、大小与R1一致",
        "audioStreamTimeBaseAndMetadataIdenticalToR1": "音频时基及流元数据与R1一致",
        "audioDecodedSamplesIdenticalToR1": "完整PCM逐样本与R1一致",
        "captions87Pages": "87页字幕完整",
        "captionTextAndTimingUnchanged": "中文、英文、入出帧及非重点字段未改",
        "nonCaptionRuntimeUnchanged": "非字幕运行态不变",
        "emphasisMatchesAll87Pages": "逐页重点词与已绑定词表一致",
        "emphasisLiteralSubstrings": "全部重点词来自当前原句",
        "allComparedInputsUnchangedDuringCheck": "检查期间所有对比输入未改动",
    }
    markdown = ["# 《10个AI生意》字幕修正版完整成片检查 R2", "", report["status"], "",
                f"文件：`{local(FILM)}`", f"SHA256：`{before_hashes[local(FILM)]}`", "",
                f"完整解码：{base_report['fullDecode']['decodedFrames']}帧，1080P/30fps；持续黑帧{len(base_report['blackIntervals'])}段，长静音{len(base_report['silenceIntervals'])}段。",
                f"最终AAC：{base_report['encodedAacLoudness']['integratedLufs']} LUFS，{base_report['encodedAacLoudness']['truePeakDbtp']} dBTP。",
                f"R2实际PCM每声道样本数：{current_audio['pcm']['samplesPerChannel']}；87页字幕、{captions['highlightedPageCount']}页标黄、{captions['highlightCount']}个重点词。", "",
                "| 字幕及原声保真检查 | 结果 |", "|---|---|"]
    markdown.extend(f"| {labels[key]} | {'通过' if value else '未通过'} |" for key, value in extra_checks.items())
    markdown.extend(["", "## 五窗实际混音同步", "", "| 起点（秒） | 新增延迟（毫秒） | 相关度 |", "|---:|---:|---:|"])
    markdown.extend(f"| {value['startSeconds']} | {value['delayMilliseconds']:.4f} | {value['correlation']:.6f} |" for value in base_report["audioCorrelation"]["windows"])
    markdown.extend(["", "完整量测及命令见同名JSON；基础全量解码日志保存在本目录媒体检查.subtitle-r2.log。",
                     "机器检查不替代实际字体/标黄观感、完整听审或用户终验。所有人工观看、听感及发布状态保持未确认。", ""])
    with report_md.open("x", encoding="utf-8") as stream:
        stream.write("\n".join(markdown))
    print(json.dumps({"status": report["status"], "report": local(report_json), "checks": checks,
                      "audioIdentityChecks": audio_checks, "captionPreservation": captions}, ensure_ascii=False))
    return 0 if all(checks.values()) else 2


def main():
    parser = argparse.ArgumentParser(description="本期字幕修正版只读检查，默认不解码或写报告。")
    parser.add_argument("--run", action="store_true", help="主任务确认最终MP4完成后再执行")
    args = parser.parse_args()
    if not args.run:
        print(json.dumps({"status": "检查脚本已准备，尚未检查成片", "film": local(FILM),
                          "filmExists": FILM.is_file(), "humanListeningPerformed": False}, ensure_ascii=False))
        return 0
    return inspect()


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as error:
        print(f"本期字幕修正版媒体检查停止：{error}", file=sys.stderr)
        sys.exit(1)
