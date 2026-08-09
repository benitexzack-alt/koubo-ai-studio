#!/usr/bin/env python3
"""Validate source-essence extraction and outline coverage cards."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any


VALID_STAGES = {"extraction", "outline"}
VALID_MODES = {"deep-explainer", "single-claim"}
VALID_COMPLETENESS = {"complete", "primary-source"}
VALID_FUNCTIONS = {
    "hook", "tension", "mechanism", "evidence", "example",
    "transition", "implication", "action", "boundary",
}
VALID_IMPORTANCE = {"must-preserve", "supporting", "optional"}
VALID_VERIFICATION = {"source-backed", "verified", "partial", "interpretation"}
VALID_RELATIONS = {"why", "therefore", "but", "example", "limit", "enables"}
VALID_CORRECTION_ACTIONS = {"replace", "qualify", "remove"}
SKILL_ROOT = Path(__file__).resolve().parent.parent


def nonempty(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def discover_project_root(anchor: Path) -> Path | None:
    configured = os.environ.get("KOUBO_PROJECT_ROOT")
    if configured:
        candidate = Path(configured).expanduser().resolve()
        if (candidate / "AGENTS.md").is_file() and (candidate / "skills").is_dir():
            return candidate
    for start in (anchor.resolve().parent, Path.cwd().resolve()):
        for candidate in (start, *start.parents):
            if (candidate / "AGENTS.md").is_file() and (candidate / "skills").is_dir():
                return candidate
    return None


def resolve_input_path(value: Any, anchor: Path) -> Path | None:
    if not nonempty(value):
        return None
    text = value.strip()
    if text == "<skill-root>":
        return SKILL_ROOT
    if text.startswith("<skill-root>/"):
        return SKILL_ROOT / text.removeprefix("<skill-root>/")
    if text == "<project-root>" or text.startswith("<project-root>/"):
        root = discover_project_root(anchor)
        if root is None:
            return None
        return root if text == "<project-root>" else root / text.removeprefix("<project-root>/")
    path = Path(text).expanduser()
    return path if path.is_absolute() else anchor.resolve().parent / path


def read_nonempty_file(value: Any, anchor: Path) -> tuple[Path | None, str | None]:
    path = resolve_input_path(value, anchor)
    if path is None:
        return None, None
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeError):
        return path, None
    return path, text if text.strip() else None


class SourceEssenceValidator:
    def __init__(self, card: dict[str, Any], card_path: Path):
        self.card = card
        self.card_path = card_path
        self.errors: list[str] = []
        self.warnings: list[str] = []
        self.passed: list[str] = []
        self.node_ids: set[str] = set()
        self.must_ids: set[str] = set()
        self.node_by_id: dict[str, dict[str, Any]] = {}
        self.covered_ids: set[str] = set()

    def error(self, message: str) -> None:
        self.errors.append(message)

    def pass_check(self, message: str) -> None:
        self.passed.append(message)

    def validate_header(self) -> tuple[str, str]:
        if self.card.get("schema_version") != 1:
            self.error("schema_version 必须为 1")
        if not nonempty(self.card.get("task_id")):
            self.error("task_id 不能为空")
        stage = self.card.get("target_stage")
        if stage not in VALID_STAGES:
            self.error("target_stage 必须是 extraction 或 outline")
            stage = "extraction"
        mode = self.card.get("mode")
        if mode not in VALID_MODES:
            self.error("mode 必须是 deep-explainer 或 single-claim")
            mode = "deep-explainer"
        if not self.errors:
            self.pass_check("任务标识、模式和目标阶段有效")
        return stage, mode

    def validate_source(self) -> None:
        source = self.card.get("source")
        if not isinstance(source, dict):
            self.error("source 必须是对象")
            return
        for field in ("title", "path", "verification_scope"):
            if not nonempty(source.get(field)):
                self.error(f"source.{field} 不能为空")
        if source.get("completeness") not in VALID_COMPLETENESS:
            self.error("source.completeness 必须是 complete 或 primary-source")
        _, source_text = read_nonempty_file(source.get("path"), self.card_path)
        if source_text is None:
            self.error(f"source.path 文件不存在、为空或不是UTF-8文本：{source.get('path')}")
        if not any(error.startswith("source.") for error in self.errors):
            self.pass_check("完整来源与核验范围有效")

    def validate_reader_brief(self) -> None:
        brief = self.card.get("reader_brief")
        if not isinstance(brief, dict):
            self.error("reader_brief 必须是对象")
            return
        for field in ("audience", "existing_belief", "desired_change"):
            if not nonempty(brief.get(field)):
                self.error(f"reader_brief.{field} 不能为空")
        leave_with = brief.get("leave_with")
        if not isinstance(leave_with, list) or len(leave_with) < 2 or not all(nonempty(x) for x in leave_with):
            self.error("reader_brief.leave_with 至少包含两条非空认知所得")
        else:
            self.pass_check("读者现状、目标变化和带走内容已锁定")

    def validate_nodes(self, mode: str) -> None:
        nodes = self.card.get("insight_nodes")
        if not isinstance(nodes, list):
            self.error("insight_nodes 必须是数组")
            return
        minimum_nodes, minimum_must = (6, 5) if mode == "deep-explainer" else (2, 1)
        if len(nodes) < minimum_nodes:
            self.error(f"{mode} 至少需要 {minimum_nodes} 个认知节点")
        for index, node in enumerate(nodes):
            prefix = f"insight_nodes[{index}]"
            if not isinstance(node, dict):
                self.error(f"{prefix} 必须是对象")
                continue
            node_id = node.get("id")
            if not nonempty(node_id):
                self.error(f"{prefix}.id 不能为空")
                continue
            if node_id in self.node_ids:
                self.error(f"认知节点 id 重复：{node_id}")
                continue
            self.node_ids.add(node_id)
            self.node_by_id[node_id] = node
            for field in ("label", "source_ref", "source_claim", "viewer_gain", "emotional_function"):
                if not nonempty(node.get(field)):
                    self.error(f"{prefix}.{field} 不能为空")
            if node.get("structural_function") not in VALID_FUNCTIONS:
                self.error(f"{prefix}.structural_function 无效")
            importance = node.get("importance")
            if importance not in VALID_IMPORTANCE:
                self.error(f"{prefix}.importance 无效")
            elif importance == "must-preserve":
                self.must_ids.add(node_id)
            verification = node.get("verification")
            if not isinstance(verification, dict):
                self.error(f"{prefix}.verification 必须是对象")
                continue
            status = verification.get("status")
            if status not in VALID_VERIFICATION:
                self.error(f"{prefix}.verification.status 无效")
            evidence_ids = verification.get("evidence_ids")
            if not isinstance(evidence_ids, list) or not all(nonempty(x) for x in evidence_ids):
                self.error(f"{prefix}.verification.evidence_ids 必须是字符串数组，可为空数组")
            if status in {"partial", "interpretation"} and not nonempty(verification.get("accurate_replacement")):
                self.error(f"{prefix} 为 {status}，必须填写 accurate_replacement")
        if len(self.must_ids) < minimum_must:
            self.error(f"{mode} 至少需要 {minimum_must} 个 must-preserve 节点")
        if mode == "deep-explainer" and self.node_by_id:
            functions = {node.get("structural_function") for node in self.node_by_id.values()}
            required_groups = [
                ({"hook", "tension"}, "冲突或张力"),
                ({"mechanism"}, "机制"),
                ({"evidence", "example"}, "证据或例子"),
                ({"implication"}, "影响"),
                ({"action", "boundary"}, "行动或边界"),
            ]
            for options, label in required_groups:
                if not functions.intersection(options):
                    self.error(f"deep-explainer 缺少{label}功能节点")
        if self.node_ids and len(self.must_ids) >= minimum_must:
            self.pass_check(f"已建立 {len(self.node_ids)} 个认知节点，其中 {len(self.must_ids)} 个必须保留")

    def validate_thesis(self) -> None:
        thesis = self.card.get("mother_thesis")
        if not isinstance(thesis, dict):
            self.error("mother_thesis 必须是对象")
            return
        for field in ("statement", "scope_boundary"):
            if not nonempty(thesis.get(field)):
                self.error(f"mother_thesis.{field} 不能为空")
        supporting = thesis.get("supporting_node_ids")
        if not isinstance(supporting, list) or len(supporting) < 2:
            self.error("mother_thesis.supporting_node_ids 至少包含两个节点")
        else:
            unknown = [node_id for node_id in supporting if node_id not in self.node_ids]
            if unknown:
                self.error(f"mother_thesis 引用了未知节点：{', '.join(unknown)}")
            else:
                self.pass_check("母命题有边界且由多个认知节点支撑")

    def validate_chain(self) -> None:
        chain = self.card.get("argument_chain")
        if not isinstance(chain, list):
            self.error("argument_chain 必须是数组")
            return
        adjacency = {node_id: set() for node_id in self.must_ids}
        for index, edge in enumerate(chain):
            prefix = f"argument_chain[{index}]"
            if not isinstance(edge, dict):
                self.error(f"{prefix} 必须是对象")
                continue
            start, end = edge.get("from"), edge.get("to")
            if start not in self.node_ids or end not in self.node_ids:
                self.error(f"{prefix} 引用了未知节点")
                continue
            if start == end:
                self.error(f"{prefix} 不能连接同一节点")
            if edge.get("relation") not in VALID_RELATIONS:
                self.error(f"{prefix}.relation 无效")
            if not nonempty(edge.get("bridge")):
                self.error(f"{prefix}.bridge 不能为空")
            if start in adjacency and end in adjacency:
                adjacency[start].add(end)
                adjacency[end].add(start)
        if self.must_ids:
            visited: set[str] = set()
            pending = [next(iter(self.must_ids))]
            while pending:
                current = pending.pop()
                if current in visited:
                    continue
                visited.add(current)
                pending.extend(adjacency[current] - visited)
            missing = sorted(self.must_ids - visited)
            if missing:
                self.error(f"must-preserve 论证链不连通，孤立节点：{', '.join(missing)}")
            else:
                self.pass_check("全部必须节点形成连通论证链")

    def validate_corrections(self) -> None:
        ledger = self.card.get("correction_ledger")
        if not isinstance(ledger, list):
            self.error("correction_ledger 必须是数组")
            return
        corrected_ids: set[str] = set()
        for index, item in enumerate(ledger):
            prefix = f"correction_ledger[{index}]"
            if not isinstance(item, dict):
                self.error(f"{prefix} 必须是对象")
                continue
            node_id = item.get("node_id")
            if node_id not in self.node_ids:
                self.error(f"{prefix}.node_id 引用了未知节点")
                continue
            corrected_ids.add(node_id)
            for field in ("source_expression", "issue", "accurate_replacement"):
                if not nonempty(item.get(field)):
                    self.error(f"{prefix}.{field} 不能为空")
            action = item.get("action")
            if action not in VALID_CORRECTION_ACTIONS:
                self.error(f"{prefix}.action 无效")
            if item.get("insight_preserved") is not True:
                self.error(f"{prefix}.insight_preserved 必须为 true")
            if node_id in self.must_ids and action == "remove":
                self.error(f"{prefix} 不得删除 must-preserve 节点 {node_id} 的完整洞察")
        for node_id, node in self.node_by_id.items():
            status = (node.get("verification") or {}).get("status")
            if status in {"partial", "interpretation"} and node_id not in corrected_ids:
                self.error(f"节点 {node_id} 为 {status}，但 correction_ledger 没有对应记录")
        self.pass_check("纠偏账本保留洞察并锁定准确表达")

    def validate_gains(self) -> None:
        gains = self.card.get("ordinary_person_gains")
        if not isinstance(gains, dict):
            self.error("ordinary_person_gains 必须是对象")
            return
        for layer in ("explanation", "judgment", "action"):
            item = gains.get(layer)
            if not isinstance(item, dict):
                self.error(f"ordinary_person_gains.{layer} 必须是对象")
                continue
            if not nonempty(item.get("statement")):
                self.error(f"ordinary_person_gains.{layer}.statement 不能为空")
            node_ids = item.get("node_ids")
            if not isinstance(node_ids, list) or not node_ids:
                self.error(f"ordinary_person_gains.{layer}.node_ids 不能为空")
            else:
                unknown = [node_id for node_id in node_ids if node_id not in self.node_ids]
                if unknown:
                    self.error(f"ordinary_person_gains.{layer} 引用了未知节点：{', '.join(unknown)}")
        if not any(error.startswith("ordinary_person_gains") for error in self.errors):
            self.pass_check("普通人已获得解释、判断和行动三层交付")

    def extract_adaptation_body(self, adaptation: dict[str, Any]) -> str | None:
        _, text = read_nonempty_file(adaptation.get("path"), self.card_path)
        if text is None:
            self.error(f"adaptation.path 文件不存在、为空或不是UTF-8文本：{adaptation.get('path')}")
            return None
        start_marker = adaptation.get("content_start_marker")
        end_marker = adaptation.get("content_end_marker")
        if bool(nonempty(start_marker)) != bool(nonempty(end_marker)):
            self.error("adaptation 的正文起止标记必须同时填写或同时省略")
            return text
        if nonempty(start_marker) and nonempty(end_marker):
            start = text.find(start_marker)
            end = text.find(end_marker, start + len(start_marker)) if start >= 0 else -1
            if start < 0 or end < 0 or end <= start:
                self.error("adaptation 正文起止标记不存在或顺序错误")
                return text
            return text[start + len(start_marker):end]
        return text

    def validate_adaptation(self, stage: str) -> None:
        adaptation = self.card.get("adaptation")
        if stage == "extraction":
            if adaptation not in ({}, None):
                self.warnings.append("extraction 阶段的 adaptation 不参与通过判定")
            return
        if not isinstance(adaptation, dict):
            self.error("outline 阶段必须填写 adaptation")
            return
        body = self.extract_adaptation_body(adaptation)
        mappings = adaptation.get("mappings")
        if not isinstance(mappings, list):
            self.error("adaptation.mappings 必须是数组")
            return
        counts: dict[str, int] = {}
        for index, mapping in enumerate(mappings):
            prefix = f"adaptation.mappings[{index}]"
            if not isinstance(mapping, dict):
                self.error(f"{prefix} 必须是对象")
                continue
            node_id = mapping.get("node_id")
            if node_id not in self.node_ids:
                self.error(f"{prefix}.node_id 引用了未知节点")
                continue
            counts[node_id] = counts.get(node_id, 0) + 1
            draft_ref = mapping.get("draft_ref")
            if not nonempty(draft_ref) or len(draft_ref.strip()) < 6:
                self.error(f"{prefix}.draft_ref 至少包含6个字符")
            elif body is not None and draft_ref.strip() not in body:
                self.error(f"节点 {node_id} 的 draft_ref 未在真实提纲正文中找到")
            elif node_id in self.must_ids:
                self.covered_ids.add(node_id)
            if mapping.get("function_preserved") is not True:
                self.error(f"{prefix}.function_preserved 必须为 true")
                self.covered_ids.discard(node_id)
        duplicate_must = sorted(node_id for node_id in self.must_ids if counts.get(node_id, 0) > 1)
        if duplicate_must:
            self.error(f"must-preserve 节点只能映射一次，重复：{', '.join(duplicate_must)}")
        missing = sorted(self.must_ids - self.covered_ids)
        if missing:
            self.error(f"提纲缺少 must-preserve 节点真实映射：{', '.join(missing)}")
        else:
            self.pass_check(f"提纲真实覆盖全部 {len(self.must_ids)} 个必须节点")

    def run(self) -> dict[str, Any]:
        stage, mode = self.validate_header()
        self.validate_source()
        self.validate_reader_brief()
        self.validate_nodes(mode)
        self.validate_thesis()
        self.validate_chain()
        self.validate_corrections()
        self.validate_gains()
        self.validate_adaptation(stage)
        status = "blocked"
        if not self.errors:
            status = "ready-for-outline" if stage == "extraction" else "ready-for-draft"
        return {
            "task_id": self.card.get("task_id"),
            "target_stage": stage,
            "status": status,
            "passed": self.passed,
            "warnings": self.warnings,
            "errors": self.errors,
            "coverage": {
                "must_preserve_count": len(self.must_ids),
                "covered_count": len(self.covered_ids) if stage == "outline" else None,
                "covered_node_ids": sorted(self.covered_ids),
                "missing_node_ids": sorted(self.must_ids - self.covered_ids) if stage == "outline" else [],
            },
        }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="校验源头精髓提炼与提纲覆盖")
    parser.add_argument("card", type=Path, help="源头精髓卡 JSON")
    parser.add_argument("--report", type=Path, help="保存机器校验报告")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        card = json.loads(args.card.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        print(json.dumps({"status": "blocked", "errors": [f"无法读取卡片：{error}"]}, ensure_ascii=False, indent=2))
        return 1
    if not isinstance(card, dict):
        print(json.dumps({"status": "blocked", "errors": ["卡片顶层必须是对象"]}, ensure_ascii=False, indent=2))
        return 1
    result = SourceEssenceValidator(card, args.card.resolve()).run()
    output = json.dumps(result, ensure_ascii=False, indent=2)
    print(output)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(output + "\n", encoding="utf-8")
    return 0 if result["status"] != "blocked" else 1


if __name__ == "__main__":
    sys.exit(main())
