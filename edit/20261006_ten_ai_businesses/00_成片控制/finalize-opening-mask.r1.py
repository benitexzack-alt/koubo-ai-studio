"""本期视频alpha局部背景清理：仅静止棕色相框，不改人物RGB/原片。"""
from pathlib import Path
import json, subprocess
import numpy as np
from PIL import Image
root=Path.cwd(); base=root/'edit/20261006_ten_ai_businesses'; out=base/'11_开场修复_R1'
raw=out/'vision-alpha.r1.gray'; target=out/'vision-alpha.cleaned.r1.gray'
if target.exists(): raise RuntimeError('禁止覆盖已有清理遮罩')
result=subprocess.run(['ffmpeg','-v','error','-i',str(base/'04_Claude小样/takes/take_title.mp4'),'-an','-vf','scale=960:540','-f','rawvideo','-pix_fmt','rgb24','-'],capture_output=True,check=True)
rgb=np.frombuffer(result.stdout,np.uint8).reshape(162,540,960,3)
mask=np.memmap(raw,dtype=np.uint8,mode='r',shape=(162,1080,1920))
yy,xx=np.mgrid[0:540,0:960]
box=(xx>=470)&(xx<=680)&(yy<=180)
reference=rgb[0].astype(np.int16)
counts=[]
with open(target,'xb') as file:
  for i in range(162):
    color=rgb[i].astype(np.int16)
    # 框边暖棕且与首帧已观察的固定背景颜色一致；肤色虽暖但运动差分不满足此条件。
    fixed=np.max(np.abs(color-reference),axis=2)<12
    brown=(color[:,:,0]-color[:,:,1]>7)&(color[:,:,0]-color[:,:,2]>14)
    exclude=box&fixed&brown
    expanded=np.asarray(Image.fromarray(np.uint8(exclude)*255).resize((1920,1080),Image.Resampling.NEAREST))>0
    alpha=np.array(mask[i],copy=True); counts.append(int(((alpha>0)&expanded).sum())); alpha[expanded]=0
    file.write(alpha.tobytes())
    if i in [26,96,144,161]:
      small=np.asarray(Image.fromarray(alpha).resize((960,540),Image.Resampling.LANCZOS)).astype(np.float32)/255
      diagnostic=rgb[i]*small[:,:,None]+90*(1-small[:,:,None])
      Image.fromarray(np.uint8(np.clip(diagnostic,0,255))).save(out/f'清理后_F{i:03d}.png')
(out/'固定相框局部清理记录.r1.json').write_text(json.dumps({'scope':'仅同源视频静态棕色相框，系统alpha不含人物RGB改动','frames':162,'removedPixelCounts':counts,'humanAcceptance':False},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'status':'local-mask-background-cleanup-candidate','frames':162,'removedFrames':sum(v>0 for v in counts)}))
