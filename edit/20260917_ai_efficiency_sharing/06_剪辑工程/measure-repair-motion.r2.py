from pathlib import Path
import hashlib
import io
import json
import subprocess

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT / 'edit/20260917_ai_efficiency_sharing'
QA = BASE / '07_预览与质检/repair-r2-v2'
VIDEO = BASE / '07_预览与质检/员工AI增效分配_返修R2_观看版_有附加音效_v2.mp4'
HOST = ROOT / 'remotion/public-employee-ai-efficiency-v8-r1/media/host.MOV'
PLAN = json.loads((ROOT / 'remotion/src/employee-ai-efficiency-v8-r2/runtime-plan.v2.json').read_text())
REGIONS = [(305, 430, 190, 150), (520, 40, 280, 110), (1720, 180, 120, 200)]


def frame(path, index):
    data = subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(index/30), '-i', str(path), '-frames:v', '1',
        '-f', 'image2pipe', '-vcodec', 'png', '-'], check=True, capture_output=True).stdout
    return Image.open(io.BytesIO(data)).convert('L')


def planned(index):
    cfg = PLAN['motion']
    cuts = sorted(set([0, *cfg['cuts'], PLAN['durationInFrames']/30]))
    time = index/30
    i = next(i for i in range(len(cuts)-1) if cuts[i] <= time < cuts[i+1])
    duration = max(.6, cuts[i+1]-cuts[i])
    progress = (time-cuts[i])/duration
    accent = min(.32, max(.16, 1.45/duration))
    settle = max(accent+.18, .76)
    def ease(x):
        return 4*x*x*x if x < .5 else 1-((-2*x+2)**3)/2
    if progress <= accent:
        intensity = 1-(1-progress/accent)**3
    elif progress <= settle:
        intensity = 1-.28*ease((progress-accent)/(settle-accent))
    else:
        intensity = .72*(1-ease((progress-settle)/(1-settle)))
    return [cfg['baseScale']+(cfg['peakScales'][i % 4]-cfg['baseScale'])*intensity,
            cfg['peakX'][i % 4]*intensity, cfg['peakY'][i % 4]*intensity]


def score(source, target, scale, dx, dy):
    # Separated background patches resolve ambiguity between scale and translation.
    stride = 3
    ox, oy = 1920*.53, 1080*.38
    patches = []
    for left, top, width, height in REGIONS:
        patch = source.transform((len(range(0,width,stride)), len(range(0,height,stride))), Image.Transform.AFFINE,
            (stride/scale, 0, (left-dx-ox)/scale+ox, 0, stride/scale, (top-dy-oy)/scale+oy), Image.Resampling.BILINEAR)
        a = np.asarray(patch, dtype=np.float32).ravel()
        patches.append(a-a.mean())
    a = np.concatenate(patches)
    b = target
    return float(np.dot(a, b) / max(1e-9, np.linalg.norm(a)*np.linalg.norm(b)))


rows = []
for output_index in [0, 12, 40, 76, 180, 235, 257]:
    source_index = 126+output_index
    source, output = frame(HOST, source_index), frame(VIDEO, output_index)
    target_patches = []
    for left, top, width, height in REGIONS:
        patch = np.asarray(output, dtype=np.float32)[top:top+height:3, left:left+width:3].ravel().copy()
        target_patches.append(patch-patch.mean())
    target = np.concatenate(target_patches)
    candidates = [(score(source, target, scale, dx, dy), scale, dx, dy)
        for scale in np.arange(1., 1.101, .005) for dx in range(-20, 21, 5) for dy in range(-6, 9, 2)]
    coarse = max(candidates)
    candidates = [(score(source, target, scale, dx, dy), scale, dx, dy)
        for scale in np.arange(coarse[1]-.004, coarse[1]+.0041, .001)
        for dx in np.arange(coarse[2]-4, coarse[2]+4.1, 1)
        for dy in np.arange(coarse[3]-2, coarse[3]+2.1, .5)]
    fit = max(candidates)
    expected = planned(source_index)
    rows.append({'outputFrame': output_index, 'sourceFrame': source_index, 'measuredScale': float(fit[1]),
        'measuredX': float(fit[2]), 'measuredY': float(fit[3]), 'correlation': fit[0],
        'identityCorrelation': score(source, target, 1, 0, 0),
        'plannedScale': expected[0], 'plannedX': expected[1], 'plannedY': expected[2]})
    print(json.dumps(rows[-1]), flush=True)

assert min(r['correlation'] for r in rows) > .96, rows
assert max(r['measuredScale'] for r in rows)-min(r['measuredScale'] for r in rows) > .045, rows
assert abs(rows[-1]['measuredScale']-rows[0]['measuredScale']) < .006, rows
assert all(abs(r['measuredScale']-r['plannedScale']) <= .005 for r in rows), rows
receipt = {'schema': 'employee-ai-repair-motion-measurement/v1', 'output': str(VIDEO.relative_to(ROOT)),
    'sha256': hashlib.sha256(VIDEO.read_bytes()).hexdigest(), 'method': '原片与输出同时间背景区域的灰度仿射配准；先独立搜索，再与工程计划比较',
    'regions': REGIONS, 'rows': rows,
    'status': 'measured-push-hold-return', 'limitation': '量化一个代表语义段，不能替代全片正常速度人工验收。'}
(QA / 'motion-measurement.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2)+'\n')
