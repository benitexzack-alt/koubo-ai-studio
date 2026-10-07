"""本期仅人工几何轮廓修补；原片RGB、旧alpha和失败cleaned保持只读。"""
from pathlib import Path
import argparse
import hashlib
import json
import subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path.cwd()
BASE = ROOT / 'edit/20261006_ten_ai_businesses'
OUT = BASE / '11_开场修复_R2'
SOURCE = BASE / '04_Claude小样/takes/take_title.mp4'
ALPHA = BASE / '11_开场修复_R1/vision-alpha.r1.gray'
WIDTH, HEIGHT, FRAMES = 1920, 1080, 162
FONT = ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc', 17)

def sha256(path):
    digest = hashlib.sha256()
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()

def source_rgb(frame, full=False):
    vf = f'select=eq(n\\,{frame})'
    if not full:
        vf += ',crop=640:350:720:130'
    result = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(SOURCE), '-vf', vf,
        '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
        capture_output=True, check=True)
    shape = (HEIGHT, WIDTH, 3) if full else (350, 640, 3)
    return np.frombuffer(result.stdout, np.uint8).reshape(shape)

def prepare_grid():
    masks = np.memmap(ALPHA, dtype=np.uint8, mode='r', shape=(FRAMES, HEIGHT, WIDTH))
    for frame in [0, 60, 96, 108, 120, 132, 139, 144, 152, 161]:
        rgb = source_rgb(frame)
        alpha = np.asarray(masks[frame, 130:480, 720:1360], dtype=np.float32) / 255
        gray = np.clip(rgb * alpha[:, :, None] + 90 * (1-alpha[:, :, None]), 0, 255).astype(np.uint8)
        canvas = Image.new('RGB', (1280, 380), '#222')
        canvas.paste(Image.fromarray(rgb), (0, 30))
        canvas.paste(Image.fromarray(gray), (640, 30))
        draw = ImageDraw.Draw(canvas)
        for panel in [0, 640]:
            for x in range(900, 1261, 20):
                px = panel + x - 720
                draw.line([(px, 30), (px, 380)], fill='#6CBAC2', width=1)
                draw.text((px+1, 32), str(x), font=FONT, fill='yellow')
            for y in range(170, 331, 20):
                py = 30 + y - 130
                draw.line([(panel, py), (panel+640, py)], fill='#6CBAC2', width=1)
                draw.text((panel+3, py+1), str(y), font=FONT, fill='yellow')
        draw.text((5, 3), f'F{frame:03d} 原RGB源坐标网格', font=FONT, fill='white')
        draw.text((645, 3), f'F{frame:03d} 未清理系统alpha／灰底', font=FONT, fill='white')
        canvas.save(OUT / f'关键帧网格_F{frame:03d}.jpg', quality=95)

# 人工从源RGB网格确定的头顶左侧轮廓。坐标全为1920×1080源坐标。
# 每点向外保留5像素缓冲，避免把贴相框的真实发丝/额头当作背景。
# 只改100—161帧，局部宽120像素；不是颜色diff、模型重试或全人像重抠。
KEY_X = np.array([920, 940, 960, 980, 1000, 1020, 1040], dtype=np.float32)
KEY_TOP = {
    96: [297, 269, 247, 228, 211, 200, 195],
    108: [319, 292, 266, 244, 225, 212, 200],
    120: [291, 267, 247, 231, 217, 208, 200],
    132: [313, 283, 256, 237, 218, 207, 200],
    139: [324, 293, 270, 250, 234, 222, 212],
    144: [335, 311, 284, 263, 245, 230, 218],
    152: [334, 306, 279, 259, 242, 225, 214],
    161: [330, 300, 273, 249, 232, 215, 202],
}

def top_curve(frame):
    keys = sorted(KEY_TOP)
    left = max(k for k in keys if k <= frame)
    right = min((k for k in keys if k >= frame), default=keys[-1])
    blend = 0 if left == right else (frame-left)/(right-left)
    curve = np.asarray(KEY_TOP[left], dtype=np.float32)*(1-blend) + np.asarray(KEY_TOP[right], dtype=np.float32)*blend - 5
    # 首次全图复核只在末段看到残留小楔尖；根据该段实际边缘局部收回。
    # F139前完全不改既已恢复的轮廓，右端真实头发也不收缩。
    if frame > 139:
        correction = np.interp(frame, [139, 144, 152, 158, 161], [0, 8, 6, 12, 20])
        curve += np.asarray([0, 0, 1, 1, 1, .5, 0])*correction
    return curve

def prepare_alpha():
    destination = OUT / 'vision-alpha.manual.r2d.gray'
    if destination.exists():
        raise RuntimeError('R2 alpha已存在，拒绝覆盖；只可明确返修失败帧后另存新文件')
    original = np.memmap(ALPHA, dtype=np.uint8, mode='r', shape=(FRAMES, HEIGHT, WIDTH))
    final = np.memmap(destination, dtype=np.uint8, mode='w+', shape=(FRAMES, HEIGHT, WIDTH))
    records = []
    xs = np.arange(920, 1040)
    ys = np.arange(140, 340)[:, None]
    for frame in range(FRAMES):
        final[frame] = original[frame]
        if frame >= 100:
            boundary = np.interp(xs, KEY_X, top_curve(frame))
            permit = np.clip((ys-boundary[None, :])/2, 0, 1)
            final[frame, 140:340, 920:1040] = np.rint(
                original[frame, 140:340, 920:1040].astype(np.float32)*permit).astype(np.uint8)
        changed = np.count_nonzero(final[frame] != original[frame])
        records.append({'frame': frame, 'changedAlphaPixels': int(changed),
            'allPixelsBelowY340Unchanged': bool(np.array_equal(final[frame, 340:], original[frame, 340:])),
            'allPixelsLeftOfX920Unchanged': bool(np.array_equal(final[frame, :, :920], original[frame, :, :920])),
            'allPixelsRightOfX1040Unchanged': bool(np.array_equal(final[frame, :, 1040:], original[frame, :, 1040:]))})
    final.flush()
    plan = {'method': '人工关键帧轮廓线性插值，仅alpha几何相交',
        'originalRgbModified': False, 'sourceRgbSha256': sha256(SOURCE),
        'inputAlphaSha256': sha256(ALPHA), 'outputAlphaSha256': sha256(destination),
        'frameCount': FRAMES, 'roi': [920, 140, 1040, 340],
        'modifiedFrameWindow': [100, 162], 'featherPixels': 2,
        'outwardHairMarginPixels': 5, 'keyX': KEY_X.astype(int).tolist(),
        'keyTopY': KEY_TOP, 'records': records,
        'humanAcceptance': False, 'status': '待逐帧视觉复核'}
    plan['onlyFailedTailRefined'] = {'from': 140, 'toExclusive': 162,
        'maxExtraClipPixels': 20, 'purpose': '去除首轮末段残留相框小楔尖；末5帧按转头后的实际曲线局部补点'}
    (OUT/'人工轮廓修补记录.r2d.json').write_text(json.dumps(plan, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({'alphaFrames': FRAMES, 'changedFrames': sum(r['changedAlphaPixels']>0 for r in records),
        'protectedRegionsUnchanged': all(r['allPixelsBelowY340Unchanged'] and r['allPixelsLeftOfX920Unchanged']
            and r['allPixelsRightOfX1040Unchanged'] for r in records)}, ensure_ascii=False))

def prepare_review():
    # 透明边缘诊断的同帧合成：文字内容、宽度、基线和前后层关系跟随组件。
    # 本机Pillow不支持woff2且未装fontTools，禁止为诊断新增依赖。
    # 仅此复核图使用本地黑体代理；不是Remotion实渲字体、尺度动画或电子运镜验收。
    title_font = ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc', 200)
    title_layer = Image.new('RGBA', (960, 540), (0, 0, 0, 0))
    glyphs = Image.new('RGBA', (1800, 420), (0, 0, 0, 0))
    draw = ImageDraw.Draw(glyphs)
    draw.text((0, 250), '10个AI赚钱生意', font=title_font, anchor='ls', fill=(245,245,245,255))
    bbox = glyphs.getbbox()
    trimmed = glyphs.crop(bbox)
    glyphs = trimmed.resize((865, trimmed.height), Image.Resampling.LANCZOS)
    title_layer.paste(glyphs, (48, int(260-250+bbox[1])), glyphs)
    title = np.asarray(title_layer).astype(np.float32)
    alpha = np.memmap(OUT/'vision-alpha.manual.r2e.gray', dtype=np.uint8, mode='r', shape=(FRAMES,HEIGHT,WIDTH))
    source = subprocess.run(['ffmpeg','-v','error','-i',str(SOURCE),'-an','-vf','scale=960:540',
        '-f','rawvideo','-pix_fmt','rgb24','-'], capture_output=True, check=True)
    rgbs = np.frombuffer(source.stdout,np.uint8).reshape(FRAMES,540,960,3)
    labels = ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc', 18)
    gray_pages=[]; title_pages=[]
    (OUT/'逐帧灰底').mkdir(exist_ok=True)
    (OUT/'逐帧题字').mkdir(exist_ok=True)
    for frame in range(FRAMES):
        a = np.asarray(Image.fromarray(alpha[frame]).resize((960,540),Image.Resampling.LANCZOS)).astype(np.float32)/255
        rgb = rgbs[frame].astype(np.float32)
        gray = rgb*a[:,:,None] + 90*(1-a[:,:,None])
        global_frame = frame+132
        punch = 1-2**(-10*np.clip((global_frame-144)/8,0,1))
        opacity = punch*(1-np.clip((global_frame-280)/4,0,1))
        t = title[:,:,3:4]/255*opacity
        behind = rgb*(1-opacity*.30)
        behind = behind*(1-t)+title[:,:,:3]*t
        composite = rgb*a[:,:,None] + behind*(1-a[:,:,None])
        for kind,pixels,pages in [('灰底',gray,gray_pages),('题字',composite,title_pages)]:
            pic = Image.fromarray(np.uint8(np.clip(pixels,0,255)))
            pic.save(OUT/f'逐帧{kind}'/f'F{frame:03d}.jpg',quality=94)
            pages.append(pic)
            if frame%9==8:
                canvas = Image.new('RGB',(1920,1152),'#161616')
                d=ImageDraw.Draw(canvas)
                for slot,p in enumerate(pages[-9:]):
                    k=frame-8+slot; x=(slot%3)*640; y=(slot//3)*384
                    canvas.paste(p.resize((640,360),Image.Resampling.LANCZOS),(x,y+24))
                    d.text((x+7,y+2),f'F{k:03d} 全片帧{k+132} {kind}',font=labels,fill='white')
                canvas.save(OUT/f'{kind}联系表_{frame-8:03d}_{frame:03d}.jpg',quality=94)
    for frame in [108,120,139,144,152,161]:
        pic = Image.open(OUT/'逐帧灰底'/f'F{frame:03d}.jpg')
        pic.crop((430,80,560,170)).resize((780,540),Image.Resampling.LANCZOS).save(OUT/f'头顶修补_F{frame:03d}.png')
    print('162帧灰底与题字合成复核图已生成；尚未编码最终webm。')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--grid-only', action='store_true')
    parser.add_argument('--prepare-alpha', action='store_true')
    parser.add_argument('--prepare-review', action='store_true')
    args = parser.parse_args()
    if args.grid_only:
        prepare_grid()
        print('已生成10张人工定轮廓网格，未改alpha。')
    if args.prepare_alpha:
        prepare_alpha()
    if args.prepare_review:
        prepare_review()
