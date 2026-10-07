#!/usr/bin/env python3
import json
import math
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

manifest = json.loads(Path(sys.argv[1]).read_text())
output = Path(sys.argv[2])
root = Path(sys.argv[3])
font_path = '/System/Library/Fonts/STHeiti Medium.ttc'
font = ImageFont.truetype(font_path, 25)
font_small = ImageFont.truetype(font_path, 22)
contacts = []

def make_pages(items, name, columns, rows, tile_width, tile_height, header_height):
    capacity = columns * rows
    folder = output / name
    folder.mkdir(exist_ok=False)
    for offset in range(0, len(items), capacity):
        page = items[offset:offset+capacity]
        canvas = Image.new('RGB', (columns*tile_width, rows*(tile_height+header_height)), '#11151b')
        draw = ImageDraw.Draw(canvas)
        frame_indices = []
        for index, item in enumerate(page):
            frame = Image.open(root / item['path']).convert('RGB')
            if frame.size != (1920,1080):
                raise RuntimeError(f"实际PNG尺寸错误：{item['frame']}")
            frame.thumbnail((tile_width,tile_height), Image.Resampling.LANCZOS)
            x = index % columns * tile_width
            y = index // columns * (tile_height+header_height)
            label = f"F{item['frame']:06d} / {item['timeSeconds']:.3f}s"
            if 'localFrame' in item:
                label += f" / 开场本地{item['localFrame']:03d}"
                if item.get('knownRisk'):
                    label += ' / 风险边界'
            else:
                label += f" / {item['id']}"
            draw.text((x+10,y+6),label,font=font,fill='#ffcd77' if item.get('knownRisk') else '#f3f3f3')
            if 'label' in item:
                draw.text((x+10,y+37),item['label'],font=font_small,fill='#d1dfed')
            canvas.paste(frame,(x+(tile_width-frame.width)//2,y+header_height))
            frame_indices.append(item['frame'])
        filename = f'{name}_{offset:03d}_{offset+len(page)-1:03d}.jpg'
        target = folder / filename
        canvas.save(target,quality=94,subsampling=0)
        contacts.append({'path':str(target.relative_to(root)),'frames':frame_indices,'source':'actual-rendered-mp4-selected-png','thumbnailOnly':True,'headerOutsideFrame':True})

make_pages(manifest['opening'],'开场162帧联系表',3,3,640,360,48)
make_pages(manifest['risk'],'全片35风险帧联系表',2,3,960,540,76)
print(json.dumps(contacts,ensure_ascii=False))
