#!/usr/bin/env python3
"""Extract the director's exact global cue frames from the M1 sample."""

import json
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / "data" / "m1.json").read_text())
START = DATA["range"]["qaStart"]
FRAMES = [3603, 3644, 3699, 3740, 3754, 3781, 3809, 3863, 3891,
          3917, 3973, 4075, 4082, 4137, 4192, 4214, 4230]
VIDEO = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT / "verify" / "山河五百年_1898至1912_R5_监制样段.mp4"
DEST = VIDEO.with_name(f"{VIDEO.stem}_关键帧拼图.jpg")
TEMP = VIDEO.with_name(f"{VIDEO.stem}_关键帧")


def main():
    TEMP.mkdir(parents=True, exist_ok=True)
    expr = "+".join(f"eq(n\\,{frame - START})" for frame in FRAMES)
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(VIDEO),
        "-vf", f"select='{expr}',scale=480:270:flags=lanczos",
        "-vsync", "0", "-y", str(TEMP / "frame-%02d.jpg"),
    ], check=True)
    images = sorted(TEMP.glob("frame-*.jpg"))
    if len(images) != len(FRAMES):
        raise RuntimeError(f"抽帧数量不符：{len(images)} != {len(FRAMES)}")
    width, height, cols, gap, label = 480, 270, 4, 8, 28
    rows = (len(images) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * width + (cols - 1) * gap,
                              rows * (height + label) + (rows - 1) * gap), "#101715")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 20)
    for i, (frame, path) in enumerate(zip(FRAMES, images)):
        x = (i % cols) * (width + gap)
        y = (i // cols) * (height + label + gap)
        with Image.open(path) as image:
            sheet.paste(image, (x, y))
        draw.text((x + 9, y + height + 3), f"f{frame}", fill="#f2dfb5", font=font)
    sheet.save(DEST, quality=93, subsampling=0)
    print(DEST)


if __name__ == "__main__":
    main()
