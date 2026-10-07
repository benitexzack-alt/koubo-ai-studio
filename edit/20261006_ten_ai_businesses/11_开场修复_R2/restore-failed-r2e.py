"""仅返修已发现的边缘缺口：恢复正确原alpha，排除区限于木框接触侧。"""
from pathlib import Path
import hashlib
import json
import numpy as np

root=Path.cwd()
base=root/'edit/20261006_ten_ai_businesses'
out=base/'11_开场修复_R2'
shape=(162,1080,1920)
old=np.memmap(base/'11_开场修复_R1/vision-alpha.r1.gray',dtype=np.uint8,mode='r',shape=shape)
candidate=np.memmap(out/'vision-alpha.manual.r2d.gray',dtype=np.uint8,mode='r',shape=shape)
destination=out/'vision-alpha.manual.r2e.gray'
if destination.exists():
    raise RuntimeError('拒绝覆盖已存在候选')
final=np.memmap(destination,dtype=np.uint8,mode='w+',shape=shape)
records=[]
for frame in range(162):
    final[frame]=old[frame]
    # 原图并排已确认100-106、122-136不能使用宽区插值，恢复原有真实轮廓。
    # 仅107-121、137-161保留木框接触侧；958左侧不再排除，避免额头边缘缺口。
    if 107<=frame<=121 or 137<=frame<=161:
        final[frame,140:340,958:1040]=candidate[frame,140:340,958:1040]
    records.append({'frame':frame,'changedAlphaPixels':int(np.count_nonzero(final[frame]!=old[frame])),
        'skinLeftEdgeRestored':bool(np.array_equal(final[frame,:,:958],old[frame,:,:958])),
        'belowY340Unchanged':bool(np.array_equal(final[frame,340:],old[frame,340:])),
        'rightOfX1040Unchanged':bool(np.array_equal(final[frame,:,1040:],old[frame,:,1040:]))})
final.flush()
def sha(p):
    h=hashlib.sha256()
    with p.open('rb') as f:
        for chunk in iter(lambda:f.read(1048576),b''): h.update(chunk)
    return h.hexdigest()
receipt={'status':'候选，待最终逐帧复核','revision':'r2e','sourceRgbModified':False,
    'sourceRgbSha256':sha(base/'04_Claude小样/takes/take_title.mp4'),
    'outputAlphaSha256':sha(destination),'frameCount':162,'modifiedRoi':[958,140,1040,340],
    'modifiedWindows':[[107,122],[137,162]],'restoredFailedFrames':list(range(100,107))+list(range(122,137)),
    'records':records,'userAcceptance':False}
(out/'失败帧恢复记录.r2e.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'changedFrames':sum(r['changedAlphaPixels']>0 for r in records),'alphaSha':receipt['outputAlphaSha256'],'leftSkinEdgeRestored':all(r['skinLeftEdgeRestored'] for r in records)},ensure_ascii=False))
