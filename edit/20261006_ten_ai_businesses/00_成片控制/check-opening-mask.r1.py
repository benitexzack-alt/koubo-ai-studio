"""只处理本期视频人物遮罩候选，不覆盖视频源和旧alpha。"""
from pathlib import Path
import json, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont
ROOT=Path.cwd()
BASE=ROOT/'edit/20261006_ten_ai_businesses'
OUT=BASE/'11_开场修复_R1'
W,H,N=960,540,162
source=BASE/'04_Claude小样/takes/take_title.mp4'
result=subprocess.run(['ffmpeg','-v','error','-i',str(source),'-an','-vf','scale=960:540','-f','rawvideo','-pix_fmt','rgb24','-'],capture_output=True,check=True)
rgb=np.frombuffer(result.stdout,np.uint8).reshape(N,H,W,3)
masks=np.memmap(OUT/'vision-alpha.r1.gray',dtype=np.uint8,mode='r',shape=(N,1080,1920))
font=ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc',20)
records=[]
(OUT/'帧复核').mkdir(exist_ok=True)
for i in range(N):
    mask=np.asarray(Image.fromarray(masks[i]).resize((W,H),Image.Resampling.LANCZOS)).astype(np.float32)/255
    gray=np.full((H,W,3),90.,np.float32)
    ongray=rgb[i]*mask[:,:,None]+gray*(1-mask[:,:,None])
    rebuilt=rgb[i]*(1-mask[:,:,None])+rgb[i]*mask[:,:,None]
    canvas=Image.new('RGB',(W*3,H+32),'#141414'); draw=ImageDraw.Draw(canvas)
    for col,(pixels,label) in enumerate([(rgb[i],'原片'),(ongray,'系统人物层候选'),(rebuilt,'同帧重建 无字')]):
        canvas.paste(Image.fromarray(np.uint8(np.clip(pixels,0,255))),(col*W,32))
        draw.text((col*W+10,3),f'F{i:03d} {i/30:.3f}秒 {label}',fill='white',font=font)
    canvas.save(OUT/'帧复核'/f'f{i:03d}.jpg',quality=92)
    records.append({'frame':i,'alphaSleeveF26ROI':round(float(mask[475:495,140:160].mean()),4),'foregroundFraction':round(float((mask>.9).mean()),4)})
    if i%9==8:
        contact=Image.new('RGB',(W*3,(H+30)*3),'#141414'); labels=ImageDraw.Draw(contact)
        for j in range(9):
            k=i-8+j
            a=np.asarray(Image.fromarray(masks[k]).resize((W,H),Image.Resampling.LANCZOS)).astype(np.float32)/255
            pixels=rgb[k]*a[:,:,None]+gray*(1-a[:,:,None])
            x,y=(j%3)*W,(j//3)*(H+30)
            contact.paste(Image.fromarray(np.uint8(np.clip(pixels,0,255))),(x,y+30))
            labels.text((x+10,y+3),f'F{k:03d} {k/30:.3f}秒',fill='white',font=font)
        contact.save(OUT/f'联系表_{i-8:03d}_{i:03d}.jpg',quality=93)
(OUT/'遮罩探针.r1.json').write_text(json.dumps({'frames':N,'algorithm':'系统视频人物分割','status':'pending-visual-audit','records':records},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'frames':N,'F026SleeveAlpha':records[26]['alphaSleeveF26ROI'],'status':'awaiting-162-frame-visual-review'}))
