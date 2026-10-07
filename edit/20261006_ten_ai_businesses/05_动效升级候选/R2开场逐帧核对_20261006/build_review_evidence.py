"""只生成诊断证据；不修改原片、人物遮罩或Remotion代码。"""
from pathlib import Path
import json
import subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent
FONT = ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc', 28)
for frame, note in [(26, '衣袖被误删'), (96, '手部异常透明'), (144, '头顶带入相框背景')]:
    panels = Image.open(OUT / 'frames' / f'f{frame:03d}.jpg')
    canvas = Image.new('RGB', (1920, 600), '#181818')
    draw = ImageDraw.Draw(canvas)
    for column, label in [(0, '原片'), (1, '抠像层置于灰底')]:
        canvas.paste(panels.crop((column * 960, 36, (column + 1) * 960, 576)), (column * 960, 60))
        draw.text((column * 960 + 20, 14), f'第{frame}帧 · {frame / 30:.3f}秒 · {label} · {note}', font=FONT, fill='white')
    canvas.save(OUT / f'证据_F{frame:03d}.jpg', quality=95)

# 人工对照原片确认的衣袖内部小区块，不是手势运动模糊边界。
# 该探针只复现本次具体误删，不是通用抠像质量门。
matte = '/Users/pc/Documents/口播/remotion/public/motion-upgrade-r2/presenter-matte.webm'
command = ['ffmpeg', '-v', 'error', '-c:v', 'libvpx-vp9', '-i', matte,
    '-an', '-vf', "select=eq(n\\,26),scale=960:540", '-frames:v', '1',
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-']
pixels = np.frombuffer(subprocess.check_output(command), dtype=np.uint8).reshape(540, 960, 4)
region = pixels[475:495, 140:160, 3].astype(float) / 255.
probe = {'frame': 26, 'seconds': 26 / 30, 'analysisSize': [960, 540],
    'humanAnnotatedSleeveROI': [140, 475, 20, 20],
    'meanAlpha': float(region.mean()), 'minimumAlpha': float(region.min()),
    'fractionBelow0_90': float((region < .90).mean()),
    'scope': '仅本帧衣袖内部误删的可重复探针；不是完整视觉验收',
    'reproduced': bool(region.mean() < .90)}
(OUT / '衣袖误删复现.json').write_text(json.dumps(probe, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(probe, ensure_ascii=False))
if probe['reproduced']:
    raise SystemExit(1)
