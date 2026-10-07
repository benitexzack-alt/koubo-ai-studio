from pathlib import Path
import subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont

base=Path('edit/20261006_ten_ai_businesses')
out=base/'11_开场修复_R2'
shape=(162,1080,1920)
old=np.memmap(base/'11_开场修复_R1/vision-alpha.r1.gray',dtype=np.uint8,mode='r',shape=shape)
new=np.memmap(out/'vision-alpha.manual.r2d.gray',dtype=np.uint8,mode='r',shape=shape)
raw=subprocess.run(['ffmpeg','-v','error','-i',str(base/'04_Claude小样/takes/take_title.mp4'),'-an','-f','rawvideo','-pix_fmt','rgb24','-'],capture_output=True,check=True).stdout
rgb=np.frombuffer(raw,np.uint8).reshape(162,1080,1920,3)
font=ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc',20)
frames=list(range(99,139))
for start in range(0,len(frames),4):
    canvas=Image.new('RGB',(1680,1720),'#161616')
    draw=ImageDraw.Draw(canvas)
    for row,f in enumerate(frames[start:start+4]):
        source=rgb[f,150:350,850:1130].astype(np.float32)
        views=[source]
        for masks in [old,new]:
            alpha=masks[f,150:350,850:1130].astype(np.float32)[:,:,None]/255
            views.append(source*alpha+90*(1-alpha))
        for col,v in enumerate(views):
            image=Image.fromarray(np.uint8(np.clip(v,0,255))).resize((560,400),Image.Resampling.NEAREST)
            x=col*560;y=row*430
            canvas.paste(image,(x,y+30))
            draw.text((x+4,y+3),f'F{f:03d} '+['原RGB','系统未清理','候选d'][col],font=font,fill='white')
    canvas.save(out/f'失败边缘对照_{frames[start]:03d}_{frames[min(start+3,len(frames)-1)]:03d}.png')
print('已生成40帧原图/旧alpha/候选边缘对照。')
