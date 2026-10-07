"""清除已逐帧观察并量测的独立木框点；不再插值或修改人体主轮廓。"""
from collections import deque
from pathlib import Path
import hashlib, json, subprocess
import numpy as np
from PIL import Image,ImageDraw,ImageFont

ROOT=Path.cwd(); BASE=ROOT/'edit/20261006_ten_ai_businesses'
OUT=BASE/'11_开场修复_R2'; REVIEW=OUT/'最终局部点清理复核_R2f'
SOURCE=BASE/'04_Claude小样/takes/take_title.mp4'
INPUT=OUT/'vision-alpha.manual.r2e.gray'; OUTPUT=OUT/'vision-alpha.manual.r2f.gray'
W,H,N=1920,1080,162
def sha(p):
    h=hashlib.sha256()
    with p.open('rb') as s:
        for b in iter(lambda:s.read(1024*1024),''):h.update(b)
    return h.hexdigest()

assert not OUTPUT.exists(), '禁止覆盖已存在候选'
assert hashlib.sha256(INPUT.read_bytes()).hexdigest()=='852c57a2a96f39512d0b2a1345fe7894d08b1f1178f09eccf293da32eae37d37'
old=np.memmap(INPUT,dtype=np.uint8,mode='r',shape=(N,H,W))
with OUTPUT.open('xb') as s:
    for f in range(N):s.write(old[f].tobytes())
new=np.memmap(OUTPUT,dtype=np.uint8,mode='r+',shape=(N,H,W)); records=[]
for f in range(140,159):
    x0,y0,x1,y1=900,170,1040,340
    a=np.asarray(old[f,y0:y1,x0:x1]);active=a>0;seen=np.zeros_like(active); selected=[]
    for sy,sx in np.argwhere(active):
        if seen[sy,sx]:continue
        queue=deque([(int(sy),int(sx))]);seen[sy,sx]=True;pts=[]
        while queue:
            y,x=queue.popleft();pts.append((y,x))
            for dy in (-1,0,1):
                for dx in (-1,0,1):
                    yy,xx=y+dy,x+dx
                    if 0<=yy<a.shape[0] and 0<=xx<a.shape[1] and active[yy,xx] and not seen[yy,xx]:
                        seen[yy,xx]=True;queue.append((yy,xx))
        ys,xs=zip(*pts);bbox=[min(xs)+x0,min(ys)+y0,max(xs)+x0+1,max(ys)+y0+1]
        boundary=min(xs)==0 or max(xs)==a.shape[1]-1 or min(ys)==0 or max(ys)==a.shape[0]-1
        if not boundary and 60<=len(pts)<=200 and bbox[0]>=951 and bbox[2]<=958 and bbox[1]>=232 and bbox[3]<=264:
            selected.append((pts,bbox))
    assert len(selected)==1, f'F{f}不符合已观察单一独立木框点，停止'
    pts,bbox=selected[0]
    for y,x in pts:new[f,y+y0,x+x0]=0
    records.append({'frame':f,'removedAlphaPixels':len(pts),'bbox':bbox,'disconnectedFromMainHead':True})
new.flush()
unchanged=True
for f in range(N):
    delta=new[f]!=old[f]
    permitted=np.zeros((H,W),dtype=bool)
    if 140<=f<159:permitted[232:264,951:958]=True
    assert not np.any(delta&~permitted), '超出已观察背景点范围'
    unchanged &= bool(np.array_equal(new[f][~permitted],old[f][~permitted]))
REVIEW.mkdir(exist_ok=False)
decoded=subprocess.run(['ffmpeg','-v','error','-i',str(SOURCE),'-an','-vf','scale=960:540','-f','rawvideo','-pix_fmt','rgb24','-'],capture_output=True,check=True)
rgb=np.frombuffer(decoded.stdout,np.uint8).reshape(N,540,960,3)
font=ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc',18)
for f in range(N):
    m=np.asarray(Image.fromarray(new[f]).resize((960,540),Image.Resampling.LANCZOS)).astype(np.float32)/255
    pic=Image.fromarray(np.uint8(np.clip(rgb[f]*m[:,:,None]+90*(1-m[:,:,None]),0,255)))
    pic.save(REVIEW/f'F{f:03d}.jpg',quality=95)
    if f%9==8:
        canvas=Image.new('RGB',(1920,1152),'#161616');draw=ImageDraw.Draw(canvas)
        for j in range(9):
            k=f-8+j;x=j%3*640;y=j//3*384
            p=Image.open(REVIEW/f'F{k:03d}.jpg')
            canvas.paste(p.resize((640,360),Image.Resampling.LANCZOS),(x,y+24))
            draw.text((x+7,y+2),f'F{k:03d} 全片帧{k+132} 最终灰底',font=font,fill='white')
        canvas.save(REVIEW/f'联系表_{f-8:03d}_{f:03d}.jpg',quality=95)
    if f in [100,103,108,120,126,137,139,144,150,158,161]:
        pic.crop((430,80,560,170)).resize((780,540),Image.Resampling.LANCZOS).save(REVIEW/f'头部_F{f:03d}.png')
report={'status':'已观察局部背景点清除；待实际Remotion合成复核','input':{'path':str(INPUT.relative_to(ROOT)),'sha256':hashlib.sha256(INPUT.read_bytes()).hexdigest()},
    'output':{'path':str(OUTPUT.relative_to(ROOT)),'sha256':hashlib.sha256(OUTPUT.read_bytes()).hexdigest(),'frames':N},
    'scope':'仅F140–158、x951–957/y232–263中单个不连接人物的木框碎点；不删除其他小透明发丝',
    'allOtherAlphaPixelsUnchanged':unchanged,'rgbModified':False,'records':records,
    'methodReference':'https://docs.opencv.org/5.0/main_modules/imgproc_shape.html',
    'implementation':'本地8邻域像素连通性检查，无安装、无模型、无颜色diff，无头部重画',
    'renderedOpeningReviewed':False,'humanListeningPerformed':False,'userAcceptance':False}
(OUT/'独立木框点清除回执.r2f.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'frames':N,'changedFrames':len(records),'removedAlphaPixels':sum(r['removedAlphaPixels'] for r in records),'allOtherAlphaPixelsUnchanged':unchanged,'alphaSha256':report['output']['sha256']},ensure_ascii=False))
