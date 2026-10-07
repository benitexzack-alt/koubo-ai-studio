"""只读诊断开场162帧，所有输出位于当前诊断目录；不改变生产素材或代码。"""
from pathlib import Path
import hashlib
import json
import subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path('/Users/pc/Documents/口播')
OUT = Path(__file__).resolve().parent
BASE = ROOT / 'remotion/public/motion-upgrade-r2/title-take.mp4'
MATTE = ROOT / 'remotion/public/motion-upgrade-r2/presenter-matte.webm'
W, H, N, FPS = 960, 540, 162, 30

def decode(path, alpha=False):
    command = ['ffmpeg', '-v', 'error']
    if alpha:
        command += ['-c:v', 'libvpx-vp9']
    command += ['-i', str(path), '-an', '-vf', f'scale={W}:{H}', '-frames:v', str(N),
                '-fps_mode', 'passthrough', '-f', 'rawvideo', '-pix_fmt', 'rgba' if alpha else 'rgb24', '-']
    result = subprocess.run(command, capture_output=True, check=True)
    channels = 4 if alpha else 3
    frames = np.frombuffer(result.stdout, dtype=np.uint8).reshape(-1, H, W, channels)
    if len(frames) != N:
        raise ValueError(f'{path.name}仅解出{len(frames)}帧')
    return frames

def pts(path):
    output = subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0',
        '-show_frames', '-show_entries', 'frame=best_effort_timestamp_time,pkt_duration_time',
        '-of', 'json', str(path)])
    return json.loads(output)['frames']

def title_opacity(frame):
    p = max(0., min(1., (frame - 25.5) / (33.6 - 25.5)))
    punch = 1. if p == 1. else 1. - 2. ** (-10. * p)
    clear = max(0., min(1., (frame - 141.6) / (145.2 - 141.6)))
    return punch * (1. - clear)

def sha(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()

OUT.mkdir(exist_ok=True)
for name in ('frames', 'contacts'):
    (OUT / name).mkdir(exist_ok=True)
base, matte = decode(BASE), decode(MATTE, True)
records = []
font = ImageFont.truetype('/System/Library/Fonts/Monaco.ttf', 18)
gray = np.full((H, W, 3), 90., dtype=np.float32)
for index in range(N):
    b = base[index].astype(np.float32)
    m = matte[index, :, :, :3].astype(np.float32)
    a = matte[index, :, :, 3].astype(np.float32) / 255.
    visible_alpha = a[:, :, None]
    # 不含标题的真实叠层重建，用于直接看RGB是否重影；不是候选视频渲染。
    reconstructed = b * (1. - .30 * title_opacity(index)) * (1. - visible_alpha) + m * visible_alpha
    on_gray = m * visible_alpha + gray * (1. - visible_alpha)
    strong = a > .94
    moving = np.zeros((H, W), bool)
    if index > 0:
        moving = np.mean(np.abs(b - base[index - 1].astype(np.float32)), axis=2) > 6.
    sample = strong & moving
    if sample.sum() < 500:
        sample = strong
    offset_mae = {}
    for offset in range(-3, 4):
        if 0 <= index + offset < N:
            errors = np.mean(np.abs(m - base[index + offset].astype(np.float32)), axis=2)
            offset_mae[str(offset)] = round(float(errors[sample].mean()), 4)
    best = min(offset_mae, key=offset_mae.get)
    record = {'frame': index, 'seconds': round(index / FPS, 6),
        'samplePixels': int(sample.sum()), 'alphaFractionAbove0_01': round(float((a > .01).mean()), 6),
        'alphaFractionSoft': round(float(((a > .05) & (a < .95)).mean()), 6),
        'movingForegroundRGBMAEByOffset': offset_mae,
        'bestRGBSourceOffset': int(best), 'sameFrameRGBMAE': offset_mae['0'],
        'bestOffsetImprovement': round(offset_mae['0'] - offset_mae[best], 4),
        'titleOpacity': round(title_opacity(index), 6)}
    records.append(record)
    panels = [base[index], np.clip(on_gray, 0, 255).astype(np.uint8),
              np.clip(reconstructed, 0, 255).astype(np.uint8)]
    canvas = Image.new('RGB', (W * 3, H + 36), '#161616')
    draw = ImageDraw.Draw(canvas)
    labels = ['SOURCE', 'MATTE ON GRAY', 'SAME-FRAME LAYER / NO TITLE']
    for column, (pixels, label) in enumerate(zip(panels, labels)):
        canvas.paste(Image.fromarray(pixels), (W * column, 36))
        draw.text((W * column + 12, 8), f'F{index:03d} {index / FPS:.3f}s  {label}', font=font, fill='white')
    canvas.save(OUT / 'frames' / f'f{index:03d}.jpg', quality=94)
    if index % 9 == 8:
        first = index - 8
        # 每格包含整幅叠层画面及帧号，162帧全部进入18张联系表。
        contact = Image.new('RGB', (W * 3, (H + 28) * 3), '#151515')
        labeldraw = ImageDraw.Draw(contact)
        for j in range(9):
            k = first + j
            rgb = base[k].astype(np.float32)
            foreground = matte[k, :, :, :3].astype(np.float32)
            alpha = matte[k, :, :, 3:4].astype(np.float32) / 255.
            mix = rgb * (1. - .30 * title_opacity(k)) * (1. - alpha) + foreground * alpha
            x, y = (j % 3) * W, (j // 3) * (H + 28)
            contact.paste(Image.fromarray(np.clip(mix, 0, 255).astype(np.uint8)), (x, y + 28))
            labeldraw.text((x + 10, y + 4), f'F{k:03d} {k / FPS:.3f}s', font=font, fill='white')
        contact.save(OUT / 'contacts' / f'f{first:03d}-f{index:03d}.jpg', quality=93)

source_pts, matte_pts = pts(BASE), pts(MATTE)
differences = [round(float(m['best_effort_timestamp_time']) - float(b['best_effort_timestamp_time']), 6)
    for b, m in zip(source_pts, matte_pts)]
report = {'scope': '仅开场逐帧诊断；不修改素材/代码、不导出正式候选',
    'source': str(BASE), 'sourceSha256': sha(BASE), 'matte': str(MATTE), 'matteSha256': sha(MATTE),
    'sourceFrameCount': len(source_pts), 'matteFrameCount': len(matte_pts), 'visualPanelsCount': len(records),
    'analysisScale': [W, H], 'fps': FPS, 'maximumPTSDeltaSeconds': max(map(abs, differences)),
    'rgbBestOffsetDistribution': {str(k): sum(r['bestRGBSourceOffset'] == k for r in records) for k in range(-3, 4)},
    'limitation': 'RGB相似度与PTS只能排查时序/源帧，不证明alpha边缘合格；需看162帧以及真实Studio字层遮挡',
    'records': records}
(OUT / 'frame-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({key: report[key] for key in ['sourceFrameCount', 'matteFrameCount', 'visualPanelsCount',
    'maximumPTSDeltaSeconds', 'rgbBestOffsetDistribution']}, ensure_ascii=False))
