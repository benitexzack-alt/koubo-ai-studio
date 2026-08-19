#!/usr/bin/env python3
"""Validate candidate review packs while preventing direct public-copy generation."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any


VALID_REVIEW = {"pending-user-selection", "approved", "rework"}
VALID_FUNCTIONS = {"hook", "correction", "mechanism", "evidence", "boundary", "action", "callback"}
FORBIDDEN_HOOKS = ("今天我讲", "AI时代已经到来", "未来已来", "抓住时代红利")
INTERNAL_TOPIC_TERMS = ("这条 Skill", "这条skill", "口播工作流", "内容门禁", "候选包", "自动化准入")
PUBLIC_VALUE_FIELDS = (
    "external_audience",
    "present_situation",
    "viewer_decision",
    "account_strategy_link",
)


def nonempty(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


class Validator:
    def __init__(self, pack: dict[str, Any], pack_path: Path) -> None:
        self.pack = pack
        self.pack_path = pack_path
        self.errors: list[str] = []
        self.passed: list[str] = []

    def error(self, message: str) -> None:
        self.errors.append(message)

    def context(self) -> dict[str, Any] | None:
        context = self.pack.get("research_context")
        if not isinstance(context, dict):
            self.error("research_context 必须是对象")
            return None
        path_value = context.get("path")
        if not nonempty(path_value):
            self.error("research_context.path 不能为空")
            return None
        path = Path(path_value).expanduser()
        if not path.is_file():
            self.error(f"research_context.path 不存在：{path}")
            return None
        if context.get("sha256") != sha256(path):
            self.error("research_context.sha256 与当前回执不一致，需要重新生成候选包")
            return None
        value = json.loads(path.read_text(encoding="utf-8"))
        if value.get("status") != "ready-for-candidate-review":
            self.error("任务上下文尚未达到 ready-for-candidate-review")
            return None
        if value.get("public_copy_generation") is not False:
            self.error("任务上下文必须明确禁止公开稿生成")
            return None
        return value

    def run(self) -> dict[str, Any]:
        if self.pack.get("schema_version") != 1:
            self.error("schema_version 必须为 1")
        if not nonempty(self.pack.get("task_id")):
            self.error("task_id 不能为空")
        if self.pack.get("public_copy_generated") is not False:
            self.error("public_copy_generated 必须为 false")
        context = self.context()
        if context and self.pack.get("task_id") != context.get("task_id"):
            self.error("候选包 task_id 与任务上下文不一致")
        context_source_ids = {item.get("id") for item in context.get("sources", [])} if context else set()
        retrieval_items = context.get("opcd", {}).get("retrieval", {}).get("results", []) if context else []
        retrieval_by_path = {item.get("path"): item for item in retrieval_items if isinstance(item, dict)}
        candidates = self.pack.get("candidates")
        reviews: list[str] = []
        if not isinstance(candidates, list) or not 1 <= len(candidates) <= 3:
            self.error("candidates 必须包含 1 到 3 个候选")
            candidates = []
        for index, candidate in enumerate(candidates):
            prefix = f"candidates[{index}]"
            if not isinstance(candidate, dict):
                self.error(f"{prefix} 必须是对象")
                continue
            for field in ("id", "topic", "real_scene", "audience_conflict", "original_judgment", "evidence_gap", "long_term_trust_path"):
                if not nonempty(candidate.get(field)):
                    self.error(f"{prefix}.{field} 不能为空")
            topic = candidate.get("topic", "")
            if isinstance(topic, str) and any(term in topic for term in INTERNAL_TOPIC_TERMS):
                self.error(f"{prefix}.topic 不能把内部 Skill、门禁或工作流当作公开口播主角")
            public_value = candidate.get("public_value_contract")
            if not isinstance(public_value, dict):
                self.error(f"{prefix}.public_value_contract 必须是对象，实验候选不能只服务内部流程")
            else:
                for field in PUBLIC_VALUE_FIELDS:
                    if not nonempty(public_value.get(field)):
                        self.error(f"{prefix}.public_value_contract.{field} 不能为空")
                if public_value.get("internal_process_is_not_topic") is not True:
                    self.error(f"{prefix}.public_value_contract.internal_process_is_not_topic 必须为 true")
            source_ids = candidate.get("source_ids")
            if not isinstance(source_ids, list) or not source_ids or not all(item in context_source_ids for item in source_ids):
                self.error(f"{prefix}.source_ids 必须引用任务上下文中的完整来源")
            opcd_refs = candidate.get("opcd_read_refs")
            if not isinstance(opcd_refs, list) or not opcd_refs:
                self.error(f"{prefix}.opcd_read_refs 必须至少记录一条实际读取的OPCD召回")
            else:
                for ref_index, ref in enumerate(opcd_refs):
                    ref_prefix = f"{prefix}.opcd_read_refs[{ref_index}]"
                    if not isinstance(ref, dict):
                        self.error(f"{ref_prefix} 必须是对象")
                        continue
                    path = ref.get("path")
                    retrieved = retrieval_by_path.get(path)
                    if not retrieved:
                        self.error(f"{ref_prefix}.path 必须来自本任务OPCD召回结果")
                        continue
                    if ref.get("document_sha256") != retrieved.get("document_sha256"):
                        self.error(f"{ref_prefix}.document_sha256 与当前OPCD召回不一致")
                    if not nonempty(ref.get("application")):
                        self.error(f"{ref_prefix}.application 不能为空")
            hooks = candidate.get("hook_options")
            if not isinstance(hooks, list) or len(hooks) != 3:
                self.error(f"{prefix}.hook_options 必须恰好包含 3 个钩子")
            else:
                for hook_index, hook in enumerate(hooks):
                    hook_prefix = f"{prefix}.hook_options[{hook_index}]"
                    if not isinstance(hook, dict):
                        self.error(f"{hook_prefix} 必须是对象")
                        continue
                    for field in ("id", "text", "concrete_anchor", "promise"):
                        if not nonempty(hook.get(field)):
                            self.error(f"{hook_prefix}.{field} 不能为空")
                    text = hook.get("text", "")
                    if isinstance(text, str) and len(text) > 120:
                        self.error(f"{hook_prefix}.text 超过 120 字")
                    if isinstance(text, str) and any(value in text for value in FORBIDDEN_HOOKS):
                        self.error(f"{hook_prefix}.text 命中项目禁用的泛AI开头")
            spine = candidate.get("outline_spine")
            if not isinstance(spine, list) or len(spine) < 5:
                self.error(f"{prefix}.outline_spine 至少需要 5 个功能段")
            else:
                functions = set()
                for part_index, part in enumerate(spine):
                    if not isinstance(part, dict) or part.get("function") not in VALID_FUNCTIONS or not nonempty(part.get("statement")):
                        self.error(f"{prefix}.outline_spine[{part_index}] 必须包含有效 function 和 statement")
                    else:
                        functions.add(part["function"])
                if not {"hook", "mechanism", "evidence", "callback"}.issubset(functions):
                    self.error(f"{prefix}.outline_spine 缺少 hook、mechanism、evidence 或 callback")
            non_claims = candidate.get("non_claims")
            if not isinstance(non_claims, list) or not non_claims or not all(nonempty(item) for item in non_claims):
                self.error(f"{prefix}.non_claims 必须是非空字符串数组")
            review = candidate.get("manual_selection")
            if not isinstance(review, dict) or review.get("status") not in VALID_REVIEW:
                self.error(f"{prefix}.manual_selection.status 无效")
            else:
                reviews.append(review["status"])
                if review["status"] == "approved" and not nonempty(review.get("selected_hook_id")):
                    self.error(f"{prefix} 已批准时必须填写 selected_hook_id")

        if self.errors:
            status = "blocked"
        elif reviews and all(item == "approved" for item in reviews):
            status = "ready-for-outline-gate"
        else:
            status = "ready-for-manual-selection"
        return {"status": status, "errors": self.errors, "candidate_count": len(candidates), "public_copy_generated": False}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("pack", type=Path)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    try:
        pack = json.loads(args.pack.read_text(encoding="utf-8"))
        if not isinstance(pack, dict):
            raise ValueError("候选包顶层必须是对象")
        result = Validator(pack, args.pack).run()
    except (OSError, UnicodeError, ValueError, json.JSONDecodeError) as exc:
        print(f"候选包校验失败：{exc}", file=sys.stderr)
        return 2
    serialized = json.dumps(result, ensure_ascii=False, indent=2)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(serialized + "\n", encoding="utf-8")
    print(serialized)
    return 0 if result["status"] != "blocked" else 1


if __name__ == "__main__":
    raise SystemExit(main())
