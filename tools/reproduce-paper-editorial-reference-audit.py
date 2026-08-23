#!/usr/bin/env python3
"""在两个全新临时目录重跑参考片审计并生成可追责运行回执。

本脚本不修改参考原片或人工镜头表。只有在两次运行均成功、完整输出逐字节
一致，且受控输出目录的文件集合与本次结果完全相同时，才会覆盖受控目录中
同名的机器派生产物。运行回执与机器审计结论相互独立：即使运行成功，参考片
仍可能因既有质量阈值未通过而保持 blocked。
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path


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


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace(
        "+00:00", "Z"
    )


def project_relative(project_root: Path, file_path: Path) -> str:
    try:
        return file_path.resolve().relative_to(project_root.resolve()).as_posix()
    except ValueError as error:
        raise RuntimeError(f"项目受控路径逃逸仓库：{file_path}") from error


def git_text(project_root: Path, arguments: list[str]) -> str:
    result = run_text(["git", "-C", str(project_root), *arguments])
    if result["exitCode"] != 0:
        raise RuntimeError(
            f"无法读取 Git 生成基点：git {' '.join(arguments)}：{result['stderr']}"
        )
    return result["stdout"].strip()


def run_text(command: list[str]) -> dict:
    result = subprocess.run(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    return {
        "command": command,
        "exitCode": result.returncode,
        "stdout": result.stdout.decode("utf-8", errors="replace"),
        "stderr": result.stderr.decode("utf-8", errors="replace"),
    }


def first_version_line(command: list[str]) -> str:
    result = run_text(command)
    if result["exitCode"] != 0:
        return f"unavailable (exit {result['exitCode']})"
    combined = f"{result['stdout']}\n{result['stderr']}".strip()
    return combined.splitlines()[0] if combined else "unknown"


def output_entries(root: Path) -> list[dict]:
    entries = []
    for file_path in sorted(root.rglob("*")):
        if not file_path.is_file():
            continue
        entries.append(
            {
                "path": file_path.relative_to(root).as_posix(),
                "bytes": file_path.stat().st_size,
                "sha256": sha256_file(file_path),
            }
        )
    return entries


def make_run(
    *,
    run_id: str,
    script: Path,
    source: Path,
    expected_source_sha256: str,
    shot_table: Path,
    manual_boundary: float,
    temp_parent: Path,
    project_root: Path,
) -> tuple[dict, Path, list[dict]]:
    run_root = Path(tempfile.mkdtemp(prefix=f"koubo-reference-audit-{run_id}-", dir=temp_parent))
    output = run_root / "output"
    existed_before = output.exists()
    entries_before = len(list(output.iterdir())) if existed_before else 0
    command = [
        sys.executable,
        str(script),
        "--source",
        str(source),
        "--output",
        str(output),
        "--expected-sha256",
        expected_source_sha256,
        "--manual-boundary",
        str(manual_boundary),
        "--shot-table",
        str(shot_table),
    ]
    started_at = utc_now()
    started = time.monotonic()
    result = run_text(command)
    elapsed = time.monotonic() - started
    finished_at = utc_now()
    if result["exitCode"] != 0:
        raise RuntimeError(
            f"{run_id} 审计失败，exit={result['exitCode']}：{result['stderr']}"
        )
    entries = output_entries(output)
    summary_path = output / "audit-summary.json"
    manifest_path = output / "artifact-manifest.json"
    if not summary_path.is_file() or not manifest_path.is_file():
        raise RuntimeError(f"{run_id} 缺少 audit-summary.json 或 artifact-manifest.json")
    summary = json.loads(summary_path.read_text("utf-8"))
    manifest = json.loads(manifest_path.read_text("utf-8"))
    run_receipt = {
        "runId": run_id,
        "freshTemporaryDirectory": True,
        "temporaryDirectoryPolicy": f"mkdtemp(koubo-reference-audit-{run_id}-*)",
        "outputDirectory": f"<fresh-temp-{run_id}>/output",
        "outputExistedBefore": existed_before,
        "outputEntryCountBefore": entries_before,
        "startedAt": started_at,
        "finishedAt": finished_at,
        "elapsedSeconds": round(elapsed, 6),
        "commandTemplate": [
            "<python>",
            f"<project-root>/{project_relative(project_root, script)}",
            "--source",
            "<external-reference-video>",
            "--output",
            f"<fresh-temp-{run_id}>/output",
            "--expected-sha256",
            expected_source_sha256,
            "--manual-boundary",
            str(manual_boundary),
            "--shot-table",
            f"<project-root>/{project_relative(project_root, shot_table)}",
        ],
        "resolvedAbsoluteCommandPersisted": False,
        "exitCode": result["exitCode"],
        "stdoutSha256": hashlib.sha256(result["stdout"].encode("utf-8")).hexdigest(),
        "stderrSha256": hashlib.sha256(result["stderr"].encode("utf-8")).hexdigest(),
        "outputFileCount": len(entries),
        "outputTreeCanonicalSha256": stable_json_sha256(entries),
        "auditSummaryFileByteSha256": sha256_file(summary_path),
        "auditDefinitionCanonicalJsonSha256": summary.get("definitionSha256"),
        "artifactManifestFileByteSha256": sha256_file(manifest_path),
        "artifactManifestCanonicalJsonSha256": manifest.get("manifestSha256"),
        "artifactManifestEntryCount": manifest.get("entryCount"),
        "auditStatus": summary.get("status"),
    }
    return run_receipt, output, entries


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--expected-source-sha256", required=True)
    parser.add_argument("--shot-table", required=True, type=Path)
    parser.add_argument("--controlled-output", required=True, type=Path)
    parser.add_argument("--receipt", required=True, type=Path)
    parser.add_argument("--manual-boundary", type=float, default=97.6)
    parser.add_argument("--temp-parent", type=Path, default=Path("/tmp"))
    args = parser.parse_args()

    project_root = Path(__file__).resolve().parent.parent
    reproducer = Path(__file__).resolve()
    script = project_root / "tools" / "audit-paper-editorial-reference.py"
    source = args.source.expanduser().resolve()
    shot_table = args.shot_table.expanduser().resolve()
    controlled_output = args.controlled_output.expanduser().resolve()
    receipt_path = args.receipt.expanduser().resolve()
    temp_parent = args.temp_parent.expanduser().resolve()

    git_commit = git_text(project_root, ["rev-parse", "HEAD"])
    git_tree = git_text(project_root, ["rev-parse", "HEAD^{tree}"])
    git_status = git_text(
        project_root,
        ["status", "--porcelain=v1", "--untracked-files=all"],
    )
    provenance = {
        "reproducer": {
            "path": project_relative(project_root, reproducer),
            "sha256": sha256_file(reproducer),
        },
        "gitCommit": git_commit,
        "gitTree": git_tree,
        "workingTreeDirtyAtStart": bool(git_status),
        "workingTreeStatusEntryCountAtStart": len(git_status.splitlines()) if git_status else 0,
        "workingTreeStatusPorcelainSha256AtStart": hashlib.sha256(
            git_status.encode("utf-8")
        ).hexdigest(),
        "generationBase": (
            "HEAD and HEAD^{tree} captured before the two audit runs, controlled-output "
            "synchronisation and receipt write"
        ),
    }

    for label, file_path in (
        ("审计脚本", script),
        ("参考片", source),
        ("人工镜头表", shot_table),
    ):
        if not file_path.is_file():
            raise RuntimeError(f"{label}不存在：{file_path}")
    if sha256_file(source) != args.expected_source_sha256.lower():
        raise RuntimeError("参考片 SHA-256 与预期不一致。")
    if not controlled_output.is_dir() or not any(controlled_output.iterdir()):
        raise RuntimeError("受控输出目录必须已存在且非空，拒绝误写新目标。")
    temp_parent.mkdir(parents=True, exist_ok=True)

    run_a, output_a, entries_a = make_run(
        run_id="A",
        script=script,
        source=source,
        expected_source_sha256=args.expected_source_sha256.lower(),
        shot_table=shot_table,
        manual_boundary=args.manual_boundary,
        temp_parent=temp_parent,
        project_root=project_root,
    )
    run_b, output_b, entries_b = make_run(
        run_id="B",
        script=script,
        source=source,
        expected_source_sha256=args.expected_source_sha256.lower(),
        shot_table=shot_table,
        manual_boundary=args.manual_boundary,
        temp_parent=temp_parent,
        project_root=project_root,
    )
    if entries_a != entries_b:
        raise RuntimeError("A/B 两次运行的文件集合、字节数或 SHA-256 不一致。")

    controlled_paths = {
        file_path.relative_to(controlled_output).as_posix()
        for file_path in controlled_output.rglob("*")
        if file_path.is_file()
    }
    generated_paths = {entry["path"] for entry in entries_a}
    if controlled_paths != generated_paths:
        missing = sorted(generated_paths - controlled_paths)
        unexpected = sorted(controlled_paths - generated_paths)
        raise RuntimeError(
            "受控输出文件集合与本次生成集合不一致，拒绝覆盖。"
            f" missing={missing} unexpected={unexpected}"
        )
    for entry in entries_a:
        source_file = output_a / entry["path"]
        target_file = controlled_output / entry["path"]
        shutil.copy2(source_file, target_file)
    controlled_entries = output_entries(controlled_output)
    if controlled_entries != entries_a:
        raise RuntimeError("受控输出同步后与 A/B 锁定结果不一致。")

    environment = {
        "python": first_version_line([sys.executable, "--version"]),
        "ffmpeg": first_version_line(["ffmpeg", "-version"]),
        "ffprobe": first_version_line(["ffprobe", "-version"]),
        "tesseract": first_version_line(["tesseract", "--version"]),
        "numpy": first_version_line(
            [sys.executable, "-c", "import numpy; print(numpy.__version__)"]
        ),
        "pillow": first_version_line(
            [sys.executable, "-c", "import PIL; print(PIL.__version__)"]
        ),
    }
    receipt = {
        "schemaVersion": "paper-editorial-reference-audit-run-receipt/v2",
        "status": "blocked-reference-below-existing-threshold",
        "createdAt": utc_now(),
        "scope": (
            "reproducibility and provenance only; this receipt does not override "
            "the failed P75>=90% reference threshold"
        ),
        "hashSemantics": {
            "fileByteSha256": "SHA-256 over exact file bytes",
            "canonicalJsonSha256": (
                "SHA-256 over UTF-8 JSON with sorted keys, compact separators and "
                "ensure_ascii=false, excluding the digest field itself"
            ),
        },
        "provenance": provenance,
        "inputs": {
            "source": {
                "logicalId": "external-reference-video",
                "basename": source.name,
                "sha256": sha256_file(source),
            },
            "script": {
                "path": project_relative(project_root, script),
                "sha256": sha256_file(script),
            },
            "shotTable": {
                "path": project_relative(project_root, shot_table),
                "sha256": sha256_file(shot_table),
            },
        },
        "environment": environment,
        "runs": [run_a, run_b],
        "comparison": {
            "runAOutput": "<fresh-temp-A>/output",
            "runBOutput": "<fresh-temp-B>/output",
            "fileCountEach": len(entries_a),
            "pathSetsEqual": True,
            "allFileBytesEqual": True,
            "outputTreeCanonicalSha256": stable_json_sha256(entries_a),
        },
        "controlledCopy": {
            "path": project_relative(project_root, controlled_output),
            "fileCount": len(controlled_entries),
            "matchesRunAAndRunB": True,
            "outputTreeCanonicalSha256": stable_json_sha256(controlled_entries),
        },
    }
    receipt["receiptDefinitionCanonicalJsonSha256"] = stable_json_sha256(receipt)
    receipt_path.parent.mkdir(parents=True, exist_ok=True)
    receipt_path.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", "utf-8")
    print(json.dumps(receipt, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (RuntimeError, OSError, json.JSONDecodeError) as error:
        print(f"参考片审计复现失败：{error}", file=sys.stderr)
        sys.exit(1)
