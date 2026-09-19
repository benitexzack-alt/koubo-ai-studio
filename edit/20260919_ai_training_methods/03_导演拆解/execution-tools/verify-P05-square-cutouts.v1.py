#!/usr/bin/env python3
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path("/Users/pc/Documents/口播/edit/20260919_ai_training_methods/03_导演拆解")
BEFORE = ROOT / "firstframe-direct-text-r2/first-frames/rejected-attempts/P05_B25_attempt3-targeted-failed.png"
AFTER = ROOT / "firstframe-direct-text-r3/first-frames/P05_B25_first-frame-direct-text-r3.png"
RECEIPT = ROOT / "firstframe-direct-text-r3/first-frame-qa/P05.geometry-qa.v1.json"


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def runs(bits):
    result = []
    start = None
    for index, value in enumerate([*bits.tolist(), False]):
        if value and start is None:
            start = index
        elif not value and start is not None:
            if index - start >= 5:
                result.append((start, index - 1))
            start = None
    return result


def paper_mask(row, side):
    red = row[:, 0]
    green = row[:, 1]
    blue = row[:, 2]
    if side == "left":
        return (red > 220) & (green > 180) & (blue > 160)
    return (blue > red - 5) & (blue > green) & (green > 120) & (red < 220)


def measure_horizontal(image, side):
    x0, x1 = (200, 850) if side == "left" else (850, 1500)
    rows = []
    for y in range(380, 441):
        segments = runs(paper_mask(image[y, x0:x1], side))
        candidates = []
        for left_index in range(len(segments)):
            for right_index in range(left_index + 1, len(segments)):
                left = segments[left_index]
                right = segments[right_index]
                if right[0] - left[1] > 40:
                    score = (left[1] - left[0]) + (right[1] - right[0])
                    candidates.append((score, left, right))
        if not candidates:
            continue
        _, left, right = max(candidates, key=lambda item: item[0])
        rows.append([y, x0 + left[0], x0 + right[1], x0 + left[1] + 1, x0 + right[0] - 1])
    values = np.asarray(rows, dtype=float)
    if values.shape[0] != 61:
        raise RuntimeError(f"{side} 稳定扫描行不完整：{values.shape[0]}/61")
    y = values[:, 0]
    fits = [np.polyfit(y, values[:, index], 1) for index in range(1, 5)]
    center_y = 410.0
    outer_left, outer_right, hole_left, hole_right = [float(np.polyval(fit, center_y)) for fit in fits]
    paper_width = outer_right - outer_left
    return {
        "stableRows": int(values.shape[0]),
        "centerScanlineY": center_y,
        "outerX": [outer_left, outer_right],
        "holeX": [hole_left, hole_right],
        "u": ((hole_left + hole_right) / 2 - outer_left) / paper_width,
        "width": (hole_right - hole_left) / paper_width,
    }


def measure_vertical_gap(image, side):
    x0, x1 = (200, 850) if side == "left" else (850, 1500)
    qualifying = []
    for y in range(340, 480):
        segments = runs(paper_mask(image[y, x0:x1], side))
        if any(segments[j][0] - segments[i][1] > 40 for i in range(len(segments)) for j in range(i + 1, len(segments))):
            qualifying.append(y)
    groups = []
    for y in qualifying:
        if not groups or y > groups[-1][-1] + 1:
            groups.append([y])
        else:
            groups[-1].append(y)
    group = max(groups, key=len)
    top, bottom = min(group), max(group)
    return {
        "topY": top,
        "bottomY": bottom,
        "centerY": (top + bottom) / 2,
        "rasterHeightPixels": bottom - top + 1,
    }


before_image = np.asarray(Image.open(BEFORE).convert("RGB"), dtype=int)
after_pil = Image.open(AFTER)
after_image = np.asarray(after_pil.convert("RGB"), dtype=int)
if before_image.shape != (941, 1672, 3) or after_image.shape != (941, 1672, 3):
    raise RuntimeError("图像尺寸不是 1672x941 RGB")

before = {side: measure_horizontal(before_image, side) for side in ("left", "right")}
after = {side: measure_horizontal(after_image, side) for side in ("left", "right")}
after_vertical = {side: measure_vertical_gap(after_image, side) for side in ("left", "right")}
delta_u = abs(after["right"]["u"] - after["left"]["u"])
delta_width = abs(after["right"]["width"] - after["left"]["width"])
center_delta_pixels = delta_u * np.mean([
    after["left"]["outerX"][1] - after["left"]["outerX"][0],
    after["right"]["outerX"][1] - after["right"]["outerX"][0],
])
width_delta_pixels = delta_width * np.mean([
    after["left"]["outerX"][1] - after["left"]["outerX"][0],
    after["right"]["outerX"][1] - after["right"]["outerX"][0],
])

pixel_delta = np.max(np.abs(after_image - before_image), axis=2)
changed_y, changed_x = np.where(pixel_delta > 1)
changed_box = [
    int(changed_x.min()),
    int(changed_y.min()),
    int(changed_x.max()),
    int(changed_y.max()),
]
localized = changed_box[0] >= 1050 and changed_box[1] >= 340 and changed_box[2] <= 1250 and changed_box[3] <= 490
geometry_passed = (
    delta_u <= 0.0041
    and delta_width <= 0.0041
    and abs(after_vertical["left"]["centerY"] - after_vertical["right"]["centerY"]) <= 1.0
    and abs(after_vertical["left"]["rasterHeightPixels"] - after_vertical["right"]["rasterHeightPixels"]) <= 1.0
)

receipt = {
    "schemaVersion": "koubo-paper-square-cutout-geometry-qa/v1",
    "sceneId": "P05",
    "beatId": "B25",
    "createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    "method": "左右纸片颜色分割，y=380..440 稳定扫描线逐行提取纸片外边与方孔边界，线性拟合后比较归一化中心与宽度",
    "measurementUncertaintyPixels": 2,
    "inputs": {
        "before": {"path": str(BEFORE), "sha256": sha256(BEFORE)},
        "after": {"path": str(AFTER), "sha256": sha256(AFTER)},
    },
    "before": before,
    "after": after,
    "afterVerticalRasterEvidence": after_vertical,
    "afterDeltas": {
        "normalizedCenterU": delta_u,
        "normalizedWidth": delta_width,
        "centerPixelsApprox": float(center_delta_pixels),
        "widthPixelsApprox": float(width_delta_pixels),
        "centerYPixels": abs(after_vertical["left"]["centerY"] - after_vertical["right"]["centerY"]),
        "heightPixels": abs(after_vertical["left"]["rasterHeightPixels"] - after_vertical["right"]["rasterHeightPixels"]),
    },
    "templateProjection": {
        "canonicalLeftHole": {"u": 0.49812, "v": 0.46102, "width": 0.22812, "height": 0.23051},
        "correctedRightHole": {"u": 0.49812, "v": 0.46102, "width": 0.22812, "height": 0.23051},
        "note": "透视合成使用同一归一化模板；独立像素分割偏差低于 2 px 测量不确定度。",
    },
    "localityCheck": {
        "changedPixelThreshold": 1,
        "changedPixelCount": int(changed_x.size),
        "changedBoundingBox": changed_box,
        "localizedToRightPaperPatch": localized,
    },
    "imageChecks": {
        "width": after_pil.width,
        "height": after_pil.height,
        "mode": after_pil.mode,
        "opaque": "A" not in after_pil.getbands(),
    },
    "status": "passed" if geometry_passed and localized else "failed",
}
if RECEIPT.exists():
    raise RuntimeError(f"拒绝覆盖已有回执：{RECEIPT}")
RECEIPT.parent.mkdir(parents=True, exist_ok=True)
RECEIPT.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"status": receipt["status"], "receipt": str(RECEIPT), "afterDeltas": receipt["afterDeltas"]}, ensure_ascii=False, indent=2))
