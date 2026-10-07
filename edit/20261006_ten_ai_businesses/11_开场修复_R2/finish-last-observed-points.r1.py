"""将同一已观察的背景独立点覆盖到最后三帧；不修改人体轮廓。"""
from pathlib import Path
import hashlib,json,subprocess
import numpy as np
from PIL import Image
ROOT=Path.cwd(); OUT=ROOT/'edit/20261006_ten_ai_businesses/11_开场修复_R2'
SOURCE=ROOT/'edit/20261006_ten_ai_businesses/04_Claude小样/takes/take_title.mp4'
INPUT=OUT/'vision-alpha.manual.r2g.gray'; DEST=OUT/'vision-alpha.final.r2h.gray'
assert not DEST.exists()
old=np.memmap(INPUT,dtype=np.uint8,mode='r',shape=(162,1080,1920))
with DEST.open('xb') as s:
    for f in range(162):s.write(old[f].tobytes())
new=np.memmap(DEST,dtype=np.uint8,mode='r+',shape=old.shape);counts=[]
for f in range(159,162):
    counts.append({'frame':f,'removedAlphaPixels':int(np.count_nonzero(old[f,232:264,951:958]))})
    new[f,232:264,951:958]=0
new.flush()
for f in range(162):
    allowed=np.zeros((1080,1920),dtype=bool)
    if 159<=f<162:allowed[232:264,951:958]=True
    assert not np.any((new[f]!=old[f])&~allowed)
decoded=subprocess.run(['ffmpeg','-v','error','-i',str(SOURCE),'-an','-vf','scale=960:540','-f','rawvideo','-pix_fmt','rgb24','-'],capture_output=True,check=True)
rgb=np.frombuffer(decoded.stdout,np.uint8).reshape(162,540,960,3)
for f in range(159,162):
    a=np.asarray(Image.fromarray(new[f]).resize((960,540),Image.Resampling.LANCZOS)).astype(np.float32)/255
    pic=Image.fromarray(np.uint8(np.clip(rgb[f]*a[:,:,None]+90*(1-a[:,:,None]),0,255)))
    pic.crop((430,80,560,170)).resize((780,540),Image.Resampling.LANCZOS).save(OUT/f'最终头部_F{f:03d}.png')
report={'status':'本期已观察背景点全部按实际帧范围清除，待实际Remotion合成复核','sourceSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    'inputAlphaSha256':hashlib.sha256(INPUT.read_bytes()).hexdigest(),'outputAlphaSha256':hashlib.sha256(DEST.read_bytes()).hexdigest(),
    'alphaPath':str(DEST.relative_to(ROOT)),'records':counts,'allOtherAlphaPixelsUnchanged':True,'rgbModified':False,'frames':162,'width':1920,'height':1080,
    'sourceDiagnostics':['独立木框点清除回执.r2f.json','三帧定点清理回执.r2g.json'],'userAcceptance':False,'normalSpeedListening':False}
(OUT/'最后三帧背景点回执.r2h.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'alphaSha256':report['outputAlphaSha256'],'records':counts},ensure_ascii=False))
