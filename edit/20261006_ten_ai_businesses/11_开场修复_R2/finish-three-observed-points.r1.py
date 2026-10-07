"""F137–139逐帧源像素明确标定的七列边界；不使用轮廓插值。"""
from pathlib import Path
import hashlib,json,subprocess
import numpy as np
from PIL import Image
ROOT=Path.cwd();OUT=ROOT/'edit/20261006_ten_ai_businesses/11_开场修复_R2'
SOURCE=ROOT/'edit/20261006_ten_ai_businesses/04_Claude小样/takes/take_title.mp4'
INPUT=OUT/'vision-alpha.manual.r2f.gray';DEST=OUT/'vision-alpha.manual.r2g.gray'
assert not DEST.exists()
old=np.memmap(INPUT,dtype=np.uint8,mode='r',shape=(162,1080,1920))
with DEST.open('xb') as s:
    for f in range(162):s.write(old[f].tobytes())
new=np.memmap(DEST,dtype=np.uint8,mode='r+',shape=old.shape)
# 源RGB放大图和逐列原像素已读：F137的皮肤自266/264/262起，
# F138自270/268/266起；F139人体边界更低。只排除上方已观察的木框。
points={137:[265,264,264,263,262,262,261],138:[269,269,268,267,267,266,265],139:[272,272,271,270,270,269,268]}
raw=subprocess.run(['ffmpeg','-v','error','-i',str(SOURCE),'-an','-vf','select=between(n\\,137\\,139),format=rgb24,crop=7:42:951:230','-fps_mode','passthrough','-f','rawvideo','-pix_fmt','rgb24','-'],capture_output=True,check=True)
rgb=np.frombuffer(raw.stdout,np.uint8).reshape(3,42,7,3);records=[]
for f,limits in points.items():
    for col,limit in enumerate(limits):new[f,232:limit,951+col]=0
    delta=new[f,230:272,951:958]!=old[f,230:272,951:958]
    skin=(rgb[f-137,:,:,0]>90)&(rgb[f-137,:,:,1]>65)&(rgb[f-137,:,:,2]>45)
    assert not np.any(delta&skin),'不得清除已观察的皮肤像素'
    records.append({'frame':f,'boundaryYByX951to957':limits,'changedPixels':int(np.count_nonzero(delta)),'observedSkinPixelsUnchanged':True})
new.flush()
for f in range(162):
    allowed=np.zeros((1080,1920),dtype=bool)
    if f in points:allowed[232:272,951:958]=True
    assert not np.any((new[f]!=old[f])&~allowed)
out=OUT/'最终三帧定点复核_R2g';out.mkdir(exist_ok=False)
decoded=subprocess.run(['ffmpeg','-v','error','-i',str(SOURCE),'-an','-vf','scale=960:540','-f','rawvideo','-pix_fmt','rgb24','-'],capture_output=True,check=True)
full=np.frombuffer(decoded.stdout,np.uint8).reshape(162,540,960,3)
for f in [137,138,139,144,150,158,161]:
    a=np.asarray(Image.fromarray(new[f]).resize((960,540),Image.Resampling.LANCZOS)).astype(np.float32)/255
    pic=Image.fromarray(np.uint8(np.clip(full[f]*a[:,:,None]+90*(1-a[:,:,None]),0,255)))
    pic.save(out/f'F{f:03d}.png')
    pic.crop((430,80,560,170)).resize((780,540),Image.Resampling.LANCZOS).save(out/f'头部_F{f:03d}.png')
digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
report={'status':'三帧定点已完成，待实际同源合成核对','inputSha256':digest(INPUT),'outputAlphaSha256':digest(DEST),'outputAlphaPath':str(DEST.relative_to(ROOT)),
    'records':records,'allOtherAlphaPixelsUnchanged':True,'rgbModified':False,'noInterpolation':True,'noColorDiff':True,'userAcceptance':False}
(OUT/'三帧定点清理回执.r2g.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'alphaSha256':report['outputAlphaSha256'],'records':records},ensure_ascii=False))
