#!/usr/bin/env python3
"""仅为本期原素材建立只读验收派生图与实际检测回执。"""

import hashlib
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


HERE = Path(__file__).resolve().parent
EPISODE = HERE.parent
INTAKE = EPISODE / "01_素材投放区"
FONT = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 22)
FILES = [
    ("speaker", INTAKE / "01_口播原片" / "copy_6040572B-1985-4C66-842D-0F3B63C6E29C.MOV", None),
    *[(f"P{index:02d}", INTAKE / "04_纸艺视频" / f"20261011_P{index:02d}_待确认生成.mp4", beat)
      for index, beat in enumerate(["B04", "B07", "B12", "B16", "B18"], 1)],
]


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(8 * 1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def run(command):
    return subprocess.run(command, capture_output=True, text=True, check=False)


def contact_sheet(scene, frames, columns, cell_width):
    cell_height = int(cell_width * 9 / 16)
    caption_height = 42
    rows = (len(frames) + columns - 1) // columns
    sheet = Image.new("RGB", (columns * cell_width, rows * (cell_height + caption_height)), "#18212a")
    draw = ImageDraw.Draw(sheet)
    for order, (timestamp, image_path) in enumerate(frames):
        source = Image.open(image_path).convert("RGB")
        source.thumbnail((cell_width, cell_height), Image.Resampling.LANCZOS)
        left = (order % columns) * cell_width
        top = (order // columns) * (cell_height + caption_height)
        sheet.paste(source, (left + (cell_width - source.width) // 2, top + (cell_height - source.height) // 2))
        draw.text((left + 12, top + cell_height + 8), f"{scene} | {order + 1:02d} | {timestamp:.3f}s", fill="white", font=FONT)
    path = HERE / f"{scene}_contact.jpg"
    sheet.save(path, quality=94)
    return path


def main():
    report = {
        "schemaVersion": "koubo-original-media-inspection/v1",
        "taskId": "20261011_enterprise_ai_organization",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "scope": "original-media-only; no production render; no uploads; no source modifications",
        "visualAcceptance": "pending-human-review",
        "audioAudition": "not-performed-by-this-script",
        "items": [],
    }
    for scene, source, beat in FILES:
        print(f"开始检测 {scene}", flush=True)
        probe_command = ["ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", str(source)]
        probe = run(probe_command)
        if probe.returncode:
            raise RuntimeError(f"{scene} ffprobe失败: {probe.stderr}")
        metadata = json.loads(probe.stdout)
        (HERE / f"{scene}_ffprobe.json").write_text(probe.stdout, encoding="utf-8")
        duration = float(metadata["format"]["duration"])
        decode_command = ["ffmpeg", "-hide_banner", "-v", "error", "-xerror", "-i", str(source), "-f", "null", "-"]
        decode = run(decode_command)
        log_path = HERE / f"{scene}_decode.stderr.txt"
        log_path.write_text(decode.stderr, encoding="utf-8")
        timestamps = [2, 40, 90, 140] if scene == "speaker" else [0.15, duration / 4, duration / 2, duration * 3 / 4, duration - 0.2]
        frame_directory = HERE / "frames" / scene
        frame_directory.mkdir(parents=True, exist_ok=True)
        frames = []
        extraction_records = []
        for order, timestamp in enumerate(timestamps, 1):
            output = frame_directory / f"{scene}_{order:02d}_{timestamp:.3f}s.png"
            command = ["ffmpeg", "-hide_banner", "-v", "error", "-y", "-ss", f"{timestamp:.6f}", "-i", str(source), "-frames:v", "1", str(output)]
            result = run(command)
            extraction_records.append({"targetSeconds": timestamp, "command": command, "exitCode": result.returncode, "stderr": result.stderr, "output": str(output)})
            if result.returncode:
                raise RuntimeError(f"{scene}取帧失败: {result.stderr}")
            frames.append((timestamp, output))
        contact = contact_sheet(scene, frames, 2 if scene == "speaker" else 3, 960 if scene == "speaker" else 672)
        item = {
            "id": scene,
            "beatId": beat,
            "source": str(source),
            "sha256": sha256(source),
            "sizeBytes": source.stat().st_size,
            "metadataPath": str(HERE / f"{scene}_ffprobe.json"),
            "durationSeconds": duration,
            "streams": metadata["streams"],
            "probe": {"command": probe_command, "exitCode": probe.returncode},
            "fullDecode": {"command": decode_command, "exitCode": decode.returncode, "stderrLog": str(log_path), "stderrBytes": len(decode.stderr.encode("utf-8")), "passed": decode.returncode == 0},
            "frames": extraction_records,
            "contactSheet": str(contact),
        }
        report["items"].append(item)
        print(f"{scene}: 解码退出码={decode.returncode}，SHA256={item['sha256']}，联系图={contact.name}", flush=True)
    report["allSourcesFullyDecoded"] = all(item["fullDecode"]["passed"] for item in report["items"])
    (HERE / "原素材验收技术回执.v1.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("本期原素材技术回执已写入；视觉与音频质量不由本脚本冒充验收。", flush=True)


if __name__ == "__main__":
    main()
