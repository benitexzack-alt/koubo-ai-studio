#!/usr/bin/env python3
"""Validate the six-sample oral-video analysis pilot without generating copy."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


VALID_ROLES = {"account", "reference"}
VALID_REVIEW = {"pending-user-review", "approved", "rework"}
REQUIRED_MECHANICS = (
    "hook_function",
    "audience_conflict",
    "reversal_or_correction",
    "evidence_mode",
    "callback_or_closure",
    "account_alignment",
)


def nonempty(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def resolve_path(value: str, card_path: Path) -> Path:
    path = Path(value).expanduser()
    return path if path.is_absolute() else card_path.parent / path


class PilotValidator:
    def __init__(self, card: dict[str, Any], card_path: Path) -> None:
        self.card = card
        self.card_path = card_path
        self.errors: list[str] = []
        self.warnings: list[str] = []
        self.passed: list[str] = []

    def error(self, message: str) -> None:
        self.errors.append(message)

    def check_header(self) -> None:
        if self.card.get("schema_version") != 1:
            self.error("schema_version 必须为 1")
        if not nonempty(self.card.get("task_id")):
            self.error("task_id 不能为空")
        mission = self.card.get("account_mission")
        if not isinstance(mission, dict):
            self.error("account_mission 必须是对象")
            return
        for field in ("account", "primary_goal", "audience", "commercial_boundary"):
            if not nonempty(mission.get(field)):
                self.error(f"account_mission.{field} 不能为空")

    def check_samples(self) -> tuple[int, int, int]:
        samples = self.card.get("samples")
        if not isinstance(samples, list):
            self.error("samples 必须是数组")
            return 0, 0, 0
        if len(samples) != 6:
            self.error("自动化准入必须恰好包含 6 条样本")

        account_count = 0
        reference_count = 0
        jiang_count = 0
        other_reference_count = 0
        seen_ids: set[str] = set()

        for index, sample in enumerate(samples):
            prefix = f"samples[{index}]"
            if not isinstance(sample, dict):
                self.error(f"{prefix} 必须是对象")
                continue
            sample_id = sample.get("id")
            if not nonempty(sample_id):
                self.error(f"{prefix}.id 不能为空")
            elif sample_id in seen_ids:
                self.error(f"样本 id 重复：{sample_id}")
            else:
                seen_ids.add(sample_id)

            role = sample.get("role")
            if role not in VALID_ROLES:
                self.error(f"{prefix}.role 必须是 account 或 reference")
                continue
            if role == "account":
                account_count += 1
                if not nonempty(sample.get("performance_lens")):
                    self.error(f"{prefix}.performance_lens 不能为空")
            else:
                reference_count += 1
                if sample.get("author") == "姜胡说":
                    jiang_count += 1
                else:
                    other_reference_count += 1

            for field in ("title", "source_path", "source_completeness", "allowed_use"):
                if not nonempty(sample.get(field)):
                    self.error(f"{prefix}.{field} 不能为空")
            if sample.get("source_completeness") not in {"complete", "primary-source"}:
                self.error(f"{prefix}.source_completeness 必须是 complete 或 primary-source")
            if nonempty(sample.get("source_path")):
                source_path = resolve_path(sample["source_path"], self.card_path)
                if not source_path.is_file() or not source_path.stat().st_size:
                    self.error(f"{prefix}.source_path 不存在或为空：{source_path}")

            mechanics = sample.get("mechanics_card")
            if not isinstance(mechanics, dict):
                self.error(f"{prefix}.mechanics_card 必须是对象")
            else:
                for field in REQUIRED_MECHANICS:
                    if not nonempty(mechanics.get(field)):
                        self.error(f"{prefix}.mechanics_card.{field} 不能为空")
                for field in ("transferable_functions", "non_transferable_content"):
                    value = mechanics.get(field)
                    if not isinstance(value, list) or not value or not all(nonempty(item) for item in value):
                        self.error(f"{prefix}.mechanics_card.{field} 必须是非空字符串数组")

            review = sample.get("manual_review")
            if not isinstance(review, dict):
                self.error(f"{prefix}.manual_review 必须是对象")
            elif review.get("status") not in VALID_REVIEW:
                self.error(f"{prefix}.manual_review.status 无效")
            elif not nonempty(review.get("question")):
                self.error(f"{prefix}.manual_review.question 不能为空")

        if account_count != 3:
            self.error(f"必须有 3 条账号样本，当前为 {account_count}")
        if reference_count != 3:
            self.error(f"必须有 3 条外部参考，当前为 {reference_count}")
        if jiang_count < 2:
            self.error(f"外部参考至少两条来自姜胡说，当前为 {jiang_count}")
        if other_reference_count < 1:
            self.error("外部参考至少一条必须来自其他创作者")
        return account_count, reference_count, jiang_count

    def check_automation_boundary(self) -> bool:
        boundary = self.card.get("automation_boundary")
        if not isinstance(boundary, dict):
            self.error("automation_boundary 必须是对象")
            return False
        allowed = boundary.get("allowed_outputs")
        forbidden = boundary.get("forbidden_outputs")
        if not isinstance(allowed, list) or not allowed or not all(nonempty(item) for item in allowed):
            self.error("automation_boundary.allowed_outputs 必须是非空字符串数组")
        if not isinstance(forbidden, list) or not forbidden or not all(nonempty(item) for item in forbidden):
            self.error("automation_boundary.forbidden_outputs 必须是非空字符串数组")
        forbidden_text = " ".join(forbidden)
        for required in ("完整公开稿", "自动发布", "虚构"):
            if required not in forbidden_text:
                self.error(f"automation_boundary.forbidden_outputs 必须明确禁止：{required}")
        return not self.errors

    def result(self) -> dict[str, Any]:
        self.check_header()
        account_count, reference_count, jiang_count = self.check_samples()
        self.check_automation_boundary()
        reviews = [
            item.get("manual_review", {}).get("status")
            for item in self.card.get("samples", [])
            if isinstance(item, dict)
        ]
        if self.errors:
            status = "blocked"
        elif reviews and all(item == "approved" for item in reviews):
            status = "ready-for-analysis-automation"
        else:
            status = "ready-for-manual-review"
        return {
            "status": status,
            "errors": self.errors,
            "warnings": self.warnings,
            "summary": {
                "sample_count": len(self.card.get("samples", [])) if isinstance(self.card.get("samples"), list) else 0,
                "account_samples": account_count,
                "reference_samples": reference_count,
                "jiang_references": jiang_count,
                "manual_reviews": reviews,
                "generates_public_copy": False,
            },
        }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("card", type=Path)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    try:
        card = json.loads(args.card.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        print(f"无法读取准入卡：{exc}", file=sys.stderr)
        return 2
    if not isinstance(card, dict):
        print("准入卡顶层必须是对象", file=sys.stderr)
        return 2
    result = PilotValidator(card, args.card).result()
    serialized = json.dumps(result, ensure_ascii=False, indent=2)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(serialized + "\n", encoding="utf-8")
    print(serialized)
    return 0 if result["status"] != "blocked" else 1


if __name__ == "__main__":
    raise SystemExit(main())
