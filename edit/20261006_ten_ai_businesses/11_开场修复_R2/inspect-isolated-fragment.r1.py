"""只读检查人工候选中已观察到的独立木框残点，不改变轮廓。"""
from pathlib import Path
from collections import deque
import json
import numpy as np

root = Path.cwd()
source = root / 'edit/20261006_ten_ai_businesses/11_开场修复_R2/vision-alpha.manual.r2e.gray'
alpha = np.memmap(source, dtype=np.uint8, mode='r', shape=(162,1080,1920))
X0,Y0,X1,Y1 = 900,170,1040,340
report=[]
for f in range(137,159):
    a=np.asarray(alpha[f,Y0:Y1,X0:X1]); active=a>0; seen=np.zeros_like(active)
    comps=[]
    for sy,sx in np.argwhere(active):
        if seen[sy,sx]: continue
        seen[sy,sx]=True; queue=deque([(int(sy),int(sx))]); pts=[]
        while queue:
            y,x=queue.popleft();pts.append((y,x))
            for dy in (-1,0,1):
                for dx in (-1,0,1):
                    yy,xx=y+dy,x+dx
                    if 0<=yy<active.shape[0] and 0<=xx<active.shape[1] and active[yy,xx] and not seen[yy,xx]:
                        seen[yy,xx]=True;queue.append((yy,xx))
        ys,xs=zip(*pts);box=[min(xs)+X0,min(ys)+Y0,max(xs)+X0+1,max(ys)+Y0+1]
        touch=min(xs)==0 or max(xs)==a.shape[1]-1 or min(ys)==0 or max(ys)==a.shape[0]-1
        comps.append({'area':len(pts),'bbox':box,'touchesRoiBoundary':touch,'maxAlpha':int(max(a[y,x] for y,x in pts))})
    report.append({'frame':f,'components':sorted(comps,key=lambda c:-c['area'])[:12]})
print(json.dumps(report,ensure_ascii=False,indent=2))
