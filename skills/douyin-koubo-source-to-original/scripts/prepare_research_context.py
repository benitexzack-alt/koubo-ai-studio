#!/usr/bin/env python3
"""Compile auditable inputs for a Douyin oral-script research task."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_OPCD_ROOT = PROJECT_ROOT.parent / "个人知识库"
SOURCE_COMPLETENESS = re.compile(r'^source_completeness:\s*"?([^"\n]+)"?\s*$', re.MULTILINE)
SOURCE_RIGHTS = re.compile(r'^rights_status:\s*"?([^"\n]+)"?\s*$', re.MULTILINE)
SOURCE_ALLOWED = {"complete", "primary-source"}
EVIDENCE_TYPES = {"user-confirmed-script", "complete-transcript"}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"JSON 顶层不是对象：{path}")
    return value


def text_file(path: Path, label: str) -> dict[str, str]:
    if not path.is_file() or not path.stat().st_size:
        raise ValueError(f"{label} 缺失或为空：{path}")
    return {"path": str(path), "sha256": sha256(path)}


def load_source_evidence(path: Path | None) -> tuple[dict[str, dict[str, Any]], dict[str, str] | None]:
    if path is None:
        return {}, None
    payload = read_json(path)
    if payload.get("schema_version") != 1:
        raise ValueError("样本证据清单 schema_version 必须为 1")
    records = payload.get("records")
    if not isinstance(records, list):
        raise ValueError("样本证据清单 records 必须是数组")
    indexed: dict[str, dict[str, Any]] = {}
    for index, record in enumerate(records):
        prefix = f"样本证据清单 records[{index}]"
        if not isinstance(record, dict) or not isinstance(record.get("path"), str):
            raise ValueError(f"{prefix}.path 不能为空")
        source_path = str(Path(record["path"]).expanduser().resolve())
        if source_path in indexed:
            raise ValueError(f"样本证据清单重复记录来源：{source_path}")
        if not isinstance(record.get("sha256"), str) or len(record["sha256"]) != 64:
            raise ValueError(f"{prefix}.sha256 必须是当前来源哈希")
        if record.get("source_completeness") not in SOURCE_ALLOWED:
            raise ValueError(f"{prefix}.source_completeness 必须是 complete 或 primary-source")
        if record.get("evidence_type") not in EVIDENCE_TYPES:
            raise ValueError(f"{prefix}.evidence_type 无效")
        if not isinstance(record.get("allowed_use"), str) or not record["allowed_use"].strip():
            raise ValueError(f"{prefix}.allowed_use 不能为空")
        indexed[source_path] = record
    return indexed, text_file(path, "样本证据清单")


def source_record(
    path: Path,
    evidence_records: dict[str, dict[str, Any]],
    evidence_manifest: dict[str, str] | None,
) -> dict[str, Any]:
    if not path.is_file() or not path.stat().st_size:
        raise ValueError(f"来源文件缺失或为空：{path}")
    text = path.read_text(encoding="utf-8")
    current_sha = sha256(path)
    evidence = evidence_records.get(str(path.resolve()))
    if evidence is not None:
        if evidence["sha256"] != current_sha:
            raise ValueError(f"样本证据清单哈希已过期：{path}")
        return {
            "id": f"source:{current_sha[:16]}",
            "path": str(path),
            "sha256": current_sha,
            "source_completeness": evidence["source_completeness"],
            "rights_status": "user-confirmed-source-boundary",
            "allowed_use": evidence["allowed_use"],
            "evidence_type": evidence["evidence_type"],
            "evidence_manifest": evidence_manifest,
        }
    completeness_match = SOURCE_COMPLETENESS.search(text[:8192])
    completeness = completeness_match.group(1).strip() if completeness_match else "unknown"
    if completeness not in SOURCE_ALLOWED:
        raise ValueError(
            f"来源不是完整可分析材料：{path}（source_completeness={completeness}）；"
            "本人确认稿需通过 --source-evidence 提供哈希绑定的样本证据清单"
        )
    rights_match = SOURCE_RIGHTS.search(text[:8192])
    return {
        "id": f"source:{current_sha[:16]}",
        "path": str(path),
        "sha256": current_sha,
        "source_completeness": completeness,
        "rights_status": rights_match.group(1).strip() if rights_match else "unknown",
        "allowed_use": "research-only-until-fact-and-rights-check",
        "evidence_type": "source-frontmatter",
    }


def retrieve_opcd(query: str, opcd_root: Path) -> dict[str, Any]:
    if not query.strip():
        raise ValueError("Obsidian 检索问题不能为空")
    command = [
        sys.executable,
        str(opcd_root / "04_Claude Code日常操作/scripts/opc_rag.py"),
        "search",
        "--query",
        query,
        "--limit",
        "5",
    ]
    completed = subprocess.run(command, text=True, capture_output=True, check=False)
    if completed.returncode != 0:
        raise ValueError(f"Obsidian 检索失败：{completed.stderr.strip() or completed.stdout.strip()}")
    payload = json.loads(completed.stdout)
    if payload.get("status") != "sufficient" or not isinstance(payload.get("results"), list) or not payload["results"]:
        raise ValueError("Obsidian 检索未返回足够的当前候选")
    results = []
    for item in payload["results"]:
        if not isinstance(item, dict):
            continue
        results.append({
            "path": item.get("path"),
            "line_start": item.get("line_start"),
            "line_end": item.get("line_end"),
            "heading": item.get("heading"),
            "status": item.get("status"),
            "authority": item.get("authority"),
            "lifecycle_layer": item.get("lifecycle_layer"),
            "document_sha256": item.get("document_sha256"),
            "score": item.get("score"),
        })
    if not results:
        raise ValueError("Obsidian 检索结果格式无效")
    return {"query": query, "status": payload["status"], "results": results, "use_boundary": "仅为候选召回；拟使用前必须读取原文并按当前事实、来源和内容门禁核验。"}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--task-id", required=True)
    parser.add_argument("--preflight", type=Path, required=True)
    parser.add_argument("--opcd-query", required=True)
    parser.add_argument("--source", action="append", type=Path, required=True)
    parser.add_argument("--source-evidence", type=Path)
    parser.add_argument("--opcd-root", type=Path, default=DEFAULT_OPCD_ROOT)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    try:
        if not args.opcd_root.is_dir():
            raise ValueError(f"Obsidian 个人知识库不存在：{args.opcd_root}")
        preflight = read_json(args.preflight)
        if preflight.get("taskId") != args.task_id:
            raise ValueError("账号预检回执 taskId 与当前任务不一致")
        if preflight.get("status") != "ready-current":
            raise ValueError(f"账号预检不是 ready-current：{preflight.get('status')}")
        learning = preflight.get("learningCard")
        if not isinstance(learning, dict) or not isinstance(learning.get("path"), str):
            raise ValueError("账号预检缺少 learningCard.path")
        learning_path = Path(learning["path"])
        learning_info = text_file(learning_path, "当前账号学习卡")
        if learning.get("sha256") != learning_info["sha256"]:
            raise ValueError("账号学习卡哈希已变化，需要重新生成账号预检")

        voice = text_file(PROJECT_ROOT / "knowledge/14-超哥口播声音档案.md", "声音档案")
        history = text_file(PROJECT_ROOT / "workflow/recent-content-history.v1.json", "最近内容历史")
        strategy = text_file(PROJECT_ROOT / "knowledge/01-账号战略与事业主线.md", "账号事业主线")
        evidence_records, evidence_manifest = load_source_evidence(args.source_evidence)
        sources = [source_record(source.expanduser().resolve(), evidence_records, evidence_manifest) for source in args.source]
        opcd_retrieval = retrieve_opcd(args.opcd_query, args.opcd_root)
    except (OSError, UnicodeError, ValueError, json.JSONDecodeError) as exc:
        print(f"任务上下文编译失败：{exc}", file=sys.stderr)
        return 1

    output = args.output or PROJECT_ROOT / "workflow/koubo-research-contexts" / f"{args.task_id}.json"
    receipt = {
        "schema_version": 1,
        "task_id": args.task_id,
        "status": "ready-for-candidate-review",
        "generated_at": datetime.now(timezone.utc).astimezone().isoformat(),
        "public_copy_generation": False,
        "opcd": {
            "meaning": "Obsidian 个人知识库（兼容字段名：opcd）",
            "root": str(args.opcd_root.resolve()),
            "learning_card": learning_info,
            "retrieval": opcd_retrieval,
        },
        "account_performance_preflight": {
            "path": str(args.preflight.resolve()),
            "sha256": sha256(args.preflight),
            "snapshot_path": preflight["accountContext"].get("snapshotPath"),
            "snapshot_sha256": preflight["accountContext"].get("snapshotSha256"),
        },
        "project_inputs": {"strategy": strategy, "voice": voice, "recent_history": history},
        "sources": sources,
        "next_gate": "候选包通过用户选择后，进入 source-essence-synthesis 和 content-brain-gate。",
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": receipt["status"], "output": str(output), "source_count": len(sources)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
