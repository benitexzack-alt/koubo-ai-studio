#!/usr/bin/env python3
"""纸媒叙事参考片的可复现逐帧审计。

只读输入视频，把探测、逐帧指标、音频指标、场景分数、NMS 边界、代表帧、
边界候选页、联系表和 OCR 结果写入指定证据目录。人工镜头语义表依然是独立证据，
本脚本不会伪造人工视觉结论。
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import os
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import numpy as np
from PIL import Image, ImageDraw, ImageFont


FPS = 30.0
ANALYSIS_WIDTH = 320
ANALYSIS_HEIGHT = 180
SCENE_THRESHOLD = 0.20
NMS_WINDOW_SECONDS = 0.50
AUDIO_SAMPLE_RATE = 16_000
ALGORITHM_ID = "paper-editorial-reference-audit/2026-08-24-s16-center1024-v1"


def fail(message: str) -> None:
    raise RuntimeError(message)


def sha256_file(file_path: Path) -> str:
    digest = hashlib.sha256()
    with file_path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def stable_json_sha256(value: object) -> str:
    encoded = json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def run(command: list[str], *, capture: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(
        command,
        check=True,
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.PIPE if capture else None,
    )


def ffprobe(source: Path) -> dict:
    result = run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration,size,bit_rate:stream=index,codec_type,codec_name,width,height,r_frame_rate,avg_frame_rate,nb_frames,sample_rate,channels",
            "-of",
            "json",
            str(source),
        ]
    )
    return json.loads(result.stdout.decode("utf-8"))


def lower_percentile(values: np.ndarray, percentile: float) -> float:
    """固定使用 floor((n-1)*p) 口径，避免 NumPy 版本默认插值漂移。"""
    if values.size == 0:
        fail("空数组不能计算百分位。")
    ordered = np.sort(values)
    index = int(math.floor((ordered.size - 1) * percentile))
    return float(ordered[index])


def nearest_rank_percentile(values: np.ndarray, percentile: float) -> float:
    """固定使用 ceil(n*p)-1 的 nearest-rank 口径。"""
    if values.size == 0:
        fail("空数组不能计算百分位。")
    ordered = np.sort(values)
    index = max(0, min(ordered.size - 1, int(math.ceil(ordered.size * percentile)) - 1))
    return float(ordered[index])


def write_scene_scores(source: Path, output_path: Path) -> None:
    command = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        str(source),
        "-map",
        "0:v:0",
        "-vf",
        (
            f"scale={ANALYSIS_WIDTH}:{ANALYSIS_HEIGHT},"
            f"select='gte(scene,0)',metadata=print:file={output_path}"
        ),
        "-an",
        "-f",
        "null",
        "-",
    ]
    run(command)


@dataclass(frozen=True)
class SceneScore:
    frame: int
    time_seconds: float
    score: float


def parse_scene_scores(file_path: Path) -> list[SceneScore]:
    rows: list[SceneScore] = []
    frame: int | None = None
    time_seconds: float | None = None
    for line in file_path.read_text("utf-8").splitlines():
        frame_match = re.search(r"frame:(\d+).*pts_time:([0-9.]+)", line)
        if frame_match:
            frame = int(frame_match.group(1))
            time_seconds = float(frame_match.group(2))
            continue
        score_match = re.search(r"lavfi\.scene_score=([0-9.]+)", line)
        if score_match and frame is not None and time_seconds is not None:
            rows.append(SceneScore(frame, time_seconds, float(score_match.group(1))))
    if not rows:
        fail(f"未能从 {file_path} 解析场景分数。")
    return rows


def nms_boundaries(rows: list[SceneScore], manual_boundaries: Iterable[float]) -> list[dict]:
    candidates = [row for row in rows if row.score >= SCENE_THRESHOLD]
    groups: list[list[SceneScore]] = []
    for candidate in candidates:
        if not groups or candidate.time_seconds - groups[-1][-1].time_seconds > NMS_WINDOW_SECONDS:
            groups.append([candidate])
        else:
            groups[-1].append(candidate)
    selected = [max(group, key=lambda item: item.score) for group in groups]
    boundaries = [
        {
            "timeSeconds": round(item.time_seconds, 6),
            "frame": item.frame,
            "sceneScore": item.score,
            "provenance": "machine-scene-score+nms",
        }
        for item in selected
    ]
    for boundary in manual_boundaries:
        if any(abs(item["timeSeconds"] - boundary) <= 1.0 / FPS for item in boundaries):
            continue
        frame = int(round(boundary * FPS))
        score_row = min(rows, key=lambda item: abs(item.time_seconds - boundary))
        boundaries.append(
            {
                "timeSeconds": round(boundary, 6),
                "frame": frame,
                "sceneScore": score_row.score,
                "provenance": "manual-semantic-reset-below-threshold",
            }
        )
    return sorted(boundaries, key=lambda item: item["timeSeconds"])


def entropy_256(luma: np.ndarray) -> float:
    quantized = np.clip(luma, 0, 255).astype(np.uint8)
    histogram = np.bincount(quantized.ravel(), minlength=256)
    probabilities = histogram[histogram > 0].astype(np.float64) / histogram.sum()
    return float(-(probabilities * np.log2(probabilities)).sum())


def frame_metric_rows(
    source: Path,
    output_csv: Path,
    frames_to_keep: set[int],
) -> tuple[int, dict[int, Image.Image]]:
    command = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        str(source),
        "-map",
        "0:v:0",
        "-vf",
        f"scale={ANALYSIS_WIDTH}:{ANALYSIS_HEIGHT}",
        "-pix_fmt",
        "rgb24",
        "-f",
        "rawvideo",
        "-",
    ]
    process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if process.stdout is None:
        fail("ffmpeg 逐帧输出管道不可用。")
    frame_bytes = ANALYSIS_WIDTH * ANALYSIS_HEIGHT * 3
    kept: dict[int, Image.Image] = {}
    previous: np.ndarray | None = None
    count = 0
    with output_csv.open("w", encoding="utf-8", newline="") as target:
        writer = csv.writer(target, lineterminator="\n")
        writer.writerow(
            [
                "frame",
                "time_s",
                "luma_mean",
                "luma_std",
                "r_mean",
                "g_mean",
                "b_mean",
                "entropy",
                "edge_strength",
                "mad_prev",
                "motion_frac",
            ]
        )
        while True:
            raw = process.stdout.read(frame_bytes)
            if len(raw) == 0:
                break
            if len(raw) != frame_bytes:
                fail(f"逐帧解码末尾不完整：{len(raw)}/{frame_bytes} 字节。")
            frame = np.frombuffer(raw, dtype=np.uint8).reshape(
                ANALYSIS_HEIGHT, ANALYSIS_WIDTH, 3
            )
            floating = frame.astype(np.float64)
            luma = (
                floating[:, :, 0] * 0.2126
                + floating[:, :, 1] * 0.7152
                + floating[:, :, 2] * 0.0722
            )
            horizontal = float(np.abs(np.diff(luma, axis=1)).mean())
            vertical = float(np.abs(np.diff(luma, axis=0)).mean())
            if previous is None:
                mad = 0.0
                motion_fraction = 0.0
            else:
                difference = np.abs(floating - previous)
                mad = float(difference.mean())
                motion_fraction = float((difference > 12.0).mean())
            writer.writerow(
                [
                    count,
                    count / FPS,
                    float(luma.mean()),
                    float(luma.std()),
                    float(floating[:, :, 0].mean()),
                    float(floating[:, :, 1].mean()),
                    float(floating[:, :, 2].mean()),
                    entropy_256(luma),
                    (horizontal + vertical) / 2.0,
                    mad,
                    motion_fraction,
                ]
            )
            if count in frames_to_keep:
                kept[count] = Image.fromarray(frame.copy(), "RGB")
            previous = floating
            count += 1
    stderr = process.stderr.read().decode("utf-8", errors="replace") if process.stderr else ""
    return_code = process.wait()
    if return_code != 0:
        fail(f"ffmpeg 逐帧解码失败，退出码 {return_code}：{stderr[-1000:]}")
    return count, kept


def audio_metric_rows(source: Path, frame_count: int, output_csv: Path) -> None:
    result = run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(source),
            "-map",
            "0:a:0",
            "-ac",
            "1",
            "-ar",
            str(AUDIO_SAMPLE_RATE),
            "-acodec",
            "pcm_s16le",
            "-f",
            "s16le",
            "-",
        ]
    )
    samples = np.frombuffer(result.stdout, dtype="<i2").astype(np.float64) / 32768.0
    fft_size = 1024
    window = np.hanning(fft_size)
    frequencies = np.fft.rfftfreq(fft_size, 1.0 / AUDIO_SAMPLE_RATE)
    previous_spectrum: np.ndarray | None = None
    with output_csv.open("w", encoding="utf-8", newline="") as target:
        writer = csv.writer(target, lineterminator="\n")
        writer.writerow(["frame", "time_s", "rms", "peak", "spectral_flux", "centroid_hz"])
        for frame in range(frame_count):
            # 每个视频帧使用以该帧中点为中心的 1024 样本音频窗。
            # floor 口径与历史 CSV 一致，禁止换成 Python round 造成半偶舍入漂移。
            center = int(math.floor((frame + 0.5) * AUDIO_SAMPLE_RATE / FPS))
            start = center - fft_size // 2
            end = start + fft_size
            spectrum_slice = np.zeros(fft_size, dtype=np.float64)
            source_start = max(0, start)
            source_end = min(samples.size, end)
            if source_end > source_start:
                target_start = source_start - start
                spectrum_slice[target_start : target_start + (source_end - source_start)] = (
                    samples[source_start:source_end]
                )
            rms = float(np.sqrt(np.mean(spectrum_slice * spectrum_slice) + 1e-12))
            peak = float(np.max(np.abs(spectrum_slice)))
            magnitude = np.abs(np.fft.rfft(spectrum_slice * window))
            magnitude_sum = float(magnitude.sum())
            normalized = magnitude / magnitude_sum if magnitude_sum > 1e-12 else np.zeros_like(magnitude)
            if previous_spectrum is None:
                spectral_flux = 0.0
            else:
                spectral_flux = float(
                    np.maximum(normalized - previous_spectrum, 0.0).sum()
                )
            centroid = (
                float((frequencies * magnitude).sum() / magnitude_sum)
                if magnitude_sum > 1e-12
                else 0.0
            )
            writer.writerow([frame, frame / FPS, rms, peak, spectral_flux, centroid])
            previous_spectrum = normalized


def read_numeric_column(file_path: Path, column: str) -> np.ndarray:
    with file_path.open("r", encoding="utf-8", newline="") as source:
        rows = list(csv.DictReader(source))
    return np.array([float(row[column]) for row in rows], dtype=np.float64)


def boundary_audio_summary(audio_csv: Path, boundaries: list[dict]) -> dict:
    with audio_csv.open("r", encoding="utf-8", newline="") as source:
        rows = list(csv.DictReader(source))
    times = np.array([float(row["time_s"]) for row in rows], dtype=np.float64)
    flux = np.array([float(row["spectral_flux"]) for row in rows], dtype=np.float64)
    result: dict[str, object] = {
        "algorithm": "nearest-rank global threshold; max spectral_flux within inclusive +/-100ms",
        "boundaryCount": len(boundaries),
    }
    for percentile in (0.75, 0.90):
        threshold = nearest_rank_percentile(flux, percentile)
        matched: list[dict] = []
        for boundary in boundaries:
            boundary_time = float(boundary["timeSeconds"])
            window = flux[np.abs(times - boundary_time) <= 0.1000001]
            maximum = float(window.max()) if window.size else -1.0
            matched.append(
                {
                    "timeSeconds": boundary_time,
                    "maximumFlux": maximum,
                    "passed": maximum >= threshold,
                }
            )
        count = sum(1 for item in matched if item["passed"])
        result[f"p{int(percentile * 100)}"] = {
            "threshold": threshold,
            "passed": count,
            "total": len(matched),
            "ratio": count / len(matched) if matched else 0.0,
            "boundaries": matched,
        }
    return result


def select_representative_times(
    duration_seconds: float,
    boundaries: list[dict],
    shot_table: Path,
) -> list[dict]:
    starts = [0.0] + [float(item["timeSeconds"]) for item in boundaries]
    ends = [float(item["timeSeconds"]) for item in boundaries] + [duration_seconds]
    with shot_table.open("r", encoding="utf-8", newline="") as source:
        table_rows = list(csv.DictReader(source))
    if len(table_rows) != len(starts):
        fail(
            f"人工镜头表 {shot_table} 有 {len(table_rows)} 行，"
            f"但机器分段有 {len(starts)} 段。"
        )
    output: list[dict] = []
    for index, (start, end) in enumerate(zip(starts, ends), start=1):
        expected_shot = f"S{index:02d}"
        table_row = table_rows[index - 1]
        if table_row.get("shot") != expected_shot:
            fail(
                f"人工镜头表行 {index} 的 shot 应为 {expected_shot}，"
                f"实际为 {table_row.get('shot')!r}。"
            )
        representative = float(table_row["rep_s"])
        if not (start <= representative < end):
            fail(
                f"{expected_shot} 代表时刻 {representative:.6f}s 不在机器分段 "
                f"[{start:.6f}, {end:.6f}) 内。"
            )
        for column, expected in (("start_s", start), ("end_s", end)):
            if column in table_row and table_row[column].strip():
                observed = float(table_row[column])
                if abs(observed - expected) > 1.0 / FPS:
                    fail(
                        f"{expected_shot} {column}={observed:.6f} 与机器分段 "
                        f"{expected:.6f} 偏差超过一帧。"
                    )
        representative_frame = int(round(representative * FPS))
        start_frame = int(math.floor(start * FPS + 1e-6))
        end_frame_exclusive = int(math.ceil(end * FPS - 1e-6))
        if not (start_frame <= representative_frame < end_frame_exclusive):
            fail(
                f"{expected_shot} 代表帧 {representative_frame} 不在分段帧范围 "
                f"[{start_frame}, {end_frame_exclusive}) 内。"
            )
        output.append(
            {
                "shot": expected_shot,
                "startSeconds": start,
                "endSeconds": end,
                "durationSeconds": end - start,
                "representativeSeconds": representative,
                "representativeFrame": representative_frame,
            }
        )
    return output


def build_artifact_manifest(output_root: Path) -> dict:
    entries: list[dict] = []
    excluded = {"artifact-manifest.json", "audit-summary.json"}
    for file_path in sorted(output_root.rglob("*")):
        if not file_path.is_file() or file_path.name in excluded:
            continue
        entries.append(
            {
                "path": file_path.relative_to(output_root).as_posix(),
                "bytes": file_path.stat().st_size,
                "sha256": sha256_file(file_path),
            }
        )
    manifest = {
        "schemaVersion": "paper-editorial-reference-artifact-manifest/v1",
        "scope": "all generated evidence except this manifest and audit-summary.json",
        "manifestSha256Semantics": (
            "SHA-256 of canonical UTF-8 JSON (sorted keys, compact separators, "
            "ensure_ascii=false) before manifestSha256 is added; this is not the "
            "byte SHA-256 of artifact-manifest.json"
        ),
        "entryCount": len(entries),
        "entries": entries,
    }
    manifest["manifestSha256"] = stable_json_sha256(manifest)
    return manifest


def font(size: int) -> ImageFont.ImageFont:
    candidates = [
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Light.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            try:
                return ImageFont.truetype(candidate, size=size)
            except OSError:
                continue
    return ImageFont.load_default()


def contact_sheet(
    items: list[tuple[str, Image.Image]],
    output_path: Path,
    *,
    columns: int,
    cell_width: int = 360,
    cell_height: int = 238,
) -> None:
    rows = int(math.ceil(len(items) / columns))
    canvas = Image.new("RGB", (columns * cell_width, rows * cell_height), (29, 27, 24))
    draw = ImageDraw.Draw(canvas)
    label_font = font(18)
    for index, (label, image) in enumerate(items):
        column = index % columns
        row = index // columns
        resized = image.resize((cell_width, 202), Image.Resampling.LANCZOS)
        x = column * cell_width
        y = row * cell_height
        canvas.paste(resized, (x, y))
        draw.rectangle((x, y + 202, x + cell_width, y + cell_height), fill=(236, 229, 212))
        draw.text((x + 8, y + 208), label, fill=(25, 28, 31), font=label_font)
    canvas.save(output_path, quality=92)


def write_images(
    kept: dict[int, Image.Image],
    shots: list[dict],
    boundaries: list[dict],
    second_frames: list[int],
    output_root: Path,
) -> None:
    shot_root = output_root / "shot_reps"
    candidate_root = output_root / "candidate_pages"
    shot_root.mkdir(parents=True, exist_ok=True)
    candidate_root.mkdir(parents=True, exist_ok=True)
    primary_items: list[tuple[str, Image.Image]] = []
    for shot in shots:
        frame = shot["representativeFrame"]
        image = kept.get(frame)
        if image is None:
            fail(f"缺少代表帧 {frame}。")
        file_name = f"{shot['shot']}_{shot['representativeSeconds']:.3f}.jpg"
        image.resize((960, 540), Image.Resampling.LANCZOS).save(shot_root / file_name, quality=94)
        shot["representativeFile"] = f"shot_reps/{file_name}"
        primary_items.append((f"{shot['shot']}  {shot['representativeSeconds']:.3f}s", image))
    contact_sheet(primary_items, output_root / "primary_shots_contact_sheet.jpg", columns=4)

    second_contact_root = output_root / "contact_pages"
    second_contact_root.mkdir(parents=True, exist_ok=True)
    second_items = [
        (f"{frame / FPS:.0f}s  f={frame}", kept[frame]) for frame in second_frames
    ]
    for page, offset in enumerate(range(0, len(second_items), 24), start=1):
        contact_sheet(
            second_items[offset : offset + 24],
            second_contact_root / f"contact_{page:03d}.jpg",
            columns=4,
        )

    for index, boundary in enumerate(boundaries, start=1):
        center = int(boundary["frame"])
        items: list[tuple[str, Image.Image]] = []
        for offset in range(-3, 4):
            frame = max(0, center + offset)
            image = kept.get(frame)
            if image is None:
                fail(f"缺少边界候选帧 {frame}。")
            items.append((f"f={frame}  {frame / FPS:.3f}s  {offset:+d}", image))
        contact_sheet(
            items,
            candidate_root / f"B{index:02d}_{boundary['timeSeconds']:.3f}.jpg",
            columns=4,
        )


def write_shot_table(shots: list[dict], output_path: Path) -> None:
    with output_path.open("w", encoding="utf-8", newline="") as target:
        writer = csv.DictWriter(
            target,
            fieldnames=list(shots[0].keys()),
            lineterminator="\n",
        )
        writer.writeheader()
        writer.writerows(shots)


def run_ocr(output_root: Path, shots: list[dict]) -> dict:
    if shutil.which("tesseract") is None:
        return {"status": "blocked-missing-tesseract", "shots": []}
    languages = run(["tesseract", "--list-langs"]).stdout.decode("utf-8", errors="replace")
    language = "chi_sim+eng" if "chi_sim" in languages else "eng"
    rows: list[dict] = []
    for shot in shots:
        image_path = output_root / shot["representativeFile"]
        result = subprocess.run(
            ["tesseract", str(image_path), "stdout", "-l", language, "--psm", "11"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )
        rows.append(
            {
                "shot": shot["shot"],
                "image": shot["representativeFile"],
                "exitCode": result.returncode,
                "text": result.stdout.decode("utf-8", errors="replace").strip(),
            }
        )
    return {
        "status": "machine-ocr-only-not-human-text-approval",
        "engine": "tesseract",
        "language": language,
        "shots": rows,
    }


def frame_summary(frame_csv: Path) -> dict:
    columns = {
        name: read_numeric_column(frame_csv, name)
        for name in ("luma_mean", "entropy", "edge_strength", "mad_prev", "motion_frac")
    }
    return {
        "frameCount": int(columns["luma_mean"].size),
        "algorithm": {
            "luma": "Rec.709 RGB coefficients on ffmpeg scale=320:180 rgb24",
            "entropy": "Shannon entropy of uint8-truncated Rec.709 luma, 256 bins",
            "edgeStrength": "mean(abs horizontal difference) and mean(abs vertical difference), averaged",
            "madPrev": "mean absolute RGB-channel difference from previous frame",
            "motionFraction": "fraction of RGB channel values with absolute difference > 12",
            "percentile": "floor((n-1)*p), no interpolation",
        },
        "meanLuma": float(columns["luma_mean"].mean()),
        "meanEntropy": float(columns["entropy"].mean()),
        "medianEntropy": lower_percentile(columns["entropy"], 0.50),
        "meanEdgeStrength": float(columns["edge_strength"].mean()),
        "medianEdgeStrength": lower_percentile(columns["edge_strength"], 0.50),
        "meanMadPrev": float(columns["mad_prev"].mean()),
        "p90MadPrev": lower_percentile(columns["mad_prev"], 0.90),
        "p99MadPrev": lower_percentile(columns["mad_prev"], 0.99),
        "meanMotionFraction": float(columns["motion_frac"].mean()),
    }


def validate_dependencies() -> None:
    for command in ("ffmpeg", "ffprobe"):
        if shutil.which(command) is None:
            fail(f"PATH 中缺少 {command}。")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--expected-sha256")
    parser.add_argument("--manual-boundary", action="append", type=float, default=[])
    parser.add_argument("--shot-table", required=True, type=Path)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    validate_dependencies()
    source = args.source.expanduser().resolve()
    output = args.output.expanduser().resolve()
    shot_table = args.shot_table.expanduser().resolve()
    if not source.is_file():
        fail(f"参考片不存在：{source}")
    if not shot_table.is_file():
        fail(f"人工镜头表不存在：{shot_table}")
    if output.exists() and any(output.iterdir()) and not args.force:
        fail(f"输出目录非空，拒绝覆盖：{output}")
    output.mkdir(parents=True, exist_ok=True)

    source_sha256 = sha256_file(source)
    if args.expected_sha256 and source_sha256 != args.expected_sha256.lower():
        fail(
            f"参考片 SHA-256 不匹配：{source_sha256} != {args.expected_sha256.lower()}"
        )
    probe = ffprobe(source)
    (output / "probe.json").write_text(
        json.dumps(probe, ensure_ascii=False, indent=2) + "\n", "utf-8"
    )
    duration_seconds = float(probe["format"]["duration"])
    expected_frames = int(
        next(
            stream["nb_frames"]
            for stream in probe["streams"]
            if stream.get("codec_type") == "video" and stream.get("nb_frames")
        )
    )

    scene_path = output / "scene_scores.txt"
    write_scene_scores(source, scene_path)
    scene_rows = parse_scene_scores(scene_path)
    boundaries = nms_boundaries(scene_rows, args.manual_boundary)
    for manual_boundary in args.manual_boundary:
        matching = [
            boundary
            for boundary in boundaries
            if abs(float(boundary["timeSeconds"]) - manual_boundary) <= 1.0 / FPS
        ]
        if not matching or matching[0]["provenance"] != "manual-semantic-reset-below-threshold":
            fail(f"人工边界 {manual_boundary:.6f}s 未保留人工语义重置来源。")
    shots = select_representative_times(duration_seconds, boundaries, shot_table)

    second_frames = list(range(0, expected_frames, int(FPS)))
    frames_to_keep: set[int] = {int(shot["representativeFrame"]) for shot in shots}
    frames_to_keep.update(second_frames)
    for boundary in boundaries:
        center = int(boundary["frame"])
        frames_to_keep.update(max(0, center + offset) for offset in range(-3, 4))

    frame_csv = output / "frame_metrics.csv"
    frame_count, kept = frame_metric_rows(source, frame_csv, frames_to_keep)
    if frame_count != expected_frames:
        fail(f"逐帧覆盖不完整：{frame_count}/{expected_frames}")

    audio_csv = output / "audio_frame_metrics.csv"
    audio_metric_rows(source, frame_count, audio_csv)
    write_images(kept, shots, boundaries, second_frames, output)
    write_shot_table(shots, output / "primary_shots.machine.csv")

    ocr = run_ocr(output, shots)
    (output / "ocr.json").write_text(
        json.dumps(ocr, ensure_ascii=False, indent=2) + "\n", "utf-8"
    )

    artifact_manifest = build_artifact_manifest(output)
    (output / "artifact-manifest.json").write_text(
        json.dumps(artifact_manifest, ensure_ascii=False, indent=2) + "\n",
        "utf-8",
    )

    script_path = Path(__file__).resolve()
    audio_alignment = boundary_audio_summary(audio_csv, boundaries)
    p75_alignment = float(audio_alignment["p75"]["ratio"])
    summary = {
        "schemaVersion": "paper-editorial-reference-audit/v1",
        "status": "blocked-reference-below-existing-threshold",
        "definitionSha256Semantics": (
            "SHA-256 of canonical UTF-8 JSON (sorted keys, compact separators, "
            "ensure_ascii=false) before definitionSha256 is added; this is not "
            "the byte SHA-256 of audit-summary.json"
        ),
        "implementation": {
            "algorithmId": ALGORITHM_ID,
            "scriptPath": str(script_path),
            "scriptSha256": sha256_file(script_path),
            "audio": (
                "ffmpeg mono 16000Hz pcm_s16le; each 30fps video frame uses a "
                "1024-sample Hann window centered at floor((frame+0.5)*16000/30); "
                "positive normalized-magnitude spectral flux; nearest-rank global "
                "threshold; inclusive +/-100ms boundary maximum"
            ),
        },
        "source": {
            "path": str(source),
            "sha256": source_sha256,
            "bytes": source.stat().st_size,
        },
        "humanShotTable": {
            "path": str(shot_table),
            "sha256": sha256_file(shot_table),
            "rowCount": len(shots),
            "boundary": "人工语义复核证据；不由机器 OCR 或场景分数代替。",
        },
        "coverage": {
            "decodedFrames": frame_count,
            "expectedFrames": expected_frames,
            "ratio": frame_count / expected_frames,
        },
        "sceneBoundaryAlgorithm": {
            "threshold": SCENE_THRESHOLD,
            "nmsWindowSeconds": NMS_WINDOW_SECONDS,
            "manualBoundaries": args.manual_boundary,
            "machineBoundaryCount": sum(
                1 for boundary in boundaries if boundary["provenance"].startswith("machine")
            ),
            "totalBoundaryCount": len(boundaries),
            "boundaries": boundaries,
        },
        "representativeShots": [
            {
                "shot": shot["shot"],
                "startSeconds": shot["startSeconds"],
                "endSeconds": shot["endSeconds"],
                "representativeSeconds": shot["representativeSeconds"],
                "representativeFrame": shot["representativeFrame"],
            }
            for shot in shots
        ],
        "machineShotTableSha256": sha256_file(
            output / "primary_shots.machine.csv"
        ),
        "artifactManifest": artifact_manifest,
        "frameMetrics": frame_summary(frame_csv),
        "audioBoundaryAlignment": audio_alignment,
        "existingPolicyEvaluation": {
            "audioP75BoundaryAlignmentMinimum": 0.90,
            "observed": p75_alignment,
            "passed": p75_alignment >= 0.90,
            "status": (
                "passed"
                if p75_alignment >= 0.90
                else "blocked-reference-below-existing-threshold"
            ),
            "boundary": "保留原 90% 门槛，不因参考片未达标而下调。",
        },
        "ocr": {
            "status": ocr["status"],
            "shotCount": len(ocr["shots"]),
            "boundary": "机器 OCR 只作索引，不等于准确中文或人工验收。",
        },
    }
    summary["definitionSha256"] = stable_json_sha256(summary)
    (output / "audit-summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n", "utf-8"
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (RuntimeError, subprocess.CalledProcessError, json.JSONDecodeError) as error:
        print(f"参考片审计失败：{error}", file=sys.stderr)
        sys.exit(1)
