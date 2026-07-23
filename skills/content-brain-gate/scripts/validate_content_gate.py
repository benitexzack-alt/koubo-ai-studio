#!/usr/bin/env python3
"""Validate a public-content gate card and emit a deterministic stage status."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any


VALID_STAGES = {"outline", "draft", "production"}
VALID_COMPLETENESS = {"metadata-only", "partial", "complete", "primary-source"}
VALID_QUALITY_TARGETS = {"primary", "supporting", "not-targeted"}
VALID_QUALITY_REVIEW_STATUSES = {"planned", "self-reviewed", "human-reviewed"}
METADATA_USES = {"title-clue", "source-index"}
PARTIAL_USES = METADATA_USES | {"partial-context"}
DEEP_USES = {"viewpoint", "talking-structure"}
ALL_USES = PARTIAL_USES | DEEP_USES | {"draft-evidence"}
DOUYIN_QUALITY_TRAITS = ("gain", "surprise", "expression", "resonance")
DOUYIN_QUALITY_FIELDS = ("target", "script_evidence", "viewer_test")
BRIEF_CONTRACT_FIELDS = (
    "user_goal",
    "reference_role",
    "reference_forbidden_role",
    "alignment_evidence",
)
MECHANISM_FIELDS = (
    "name",
    "problem",
    "bottleneck",
    "mechanism",
    "observable_change",
    "evidence",
    "evidence_proves",
    "evidence_does_not_prove",
    "audience_relevance",
    "boundary",
)
TOPIC_FIELDS = (
    "audience",
    "problem",
    "desired_change",
    "novel_claim",
    "difference_from_recent",
    "evidence_proves",
    "evidence_does_not_prove",
    "audience_takeaway",
    "boundary",
)
AUDIENCE_FIT_FIELDS = (
    "account_stage",
    "speaker_position",
    "first_20s_connection",
    "high_level_material_role",
    "audience_gain",
    "authority_boundary",
)
VALID_ACCOUNT_STAGES = {"调查", "试验", "结果", "方法", "复制"}
VALID_HIGH_LEVEL_ROLES = {"evidence", "background", "none"}
SKILL_ROOT = Path(__file__).resolve().parent.parent
RECENT_FIELDS = (
    "title",
    "audience_problem",
    "main_claim",
    "evidence",
    "deliverable",
    "cta",
)
PRODUCTION_CHECKS = (
    "fact_lock_passed",
    "humanize_passed",
    "read_aloud_passed",
    "voice_match_passed",
    "recent_six_recheck_passed",
    "compliance_passed",
    "user_script_approved",
)
FROZEN_PATTERNS = (
    (
        "first-not-buy-system",
        re.compile(r"第一步.{0,8}不是.{0,8}(买|上|选).{0,8}(系统|软件|工具)"),
        "再次使用“第一步不是买系统/工具”的冻结母题",
    ),
    (
        "repeat-small-task",
        re.compile(r"(高频.{0,6}重复|重复.{0,6}高频|重复.{0,8}(小事|任务|动作|流程))"),
        "再次使用“高频重复小任务”的冻结母题",
    ),
    (
        "run-seven-days",
        re.compile(r"(试跑|先跑|跑).{0,5}(一周|七天|7天)"),
        "再次使用“跑一周/七天”的冻结母题",
    ),
    (
        "standardize-then-copy",
        re.compile(r"标准化.{0,10}(再|然后).{0,6}(复制|规模)"),
        "再次使用“标准化再复制”的冻结母题",
    ),
    (
        "lanzhou-ai-identity",
        re.compile(r"(我在兰州|在兰州).{0,15}(记录|做).{0,8}(AI|人工智能).{0,8}(创业|创新|落地)?"),
        "再次使用兰州 AI 创业身份句作为固定收尾",
    ),
)


def nonempty(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def discover_project_root(anchor: Path) -> Path | None:
    configured = os.environ.get("KOUBO_PROJECT_ROOT")
    if configured:
        candidate = Path(configured).expanduser().resolve()
        if (candidate / "AGENTS.md").is_file() and (candidate / "knowledge").is_dir():
            return candidate
    starts = [anchor.resolve().parent, Path.cwd().resolve()]
    for start in starts:
        for candidate in (start, *start.parents):
            if (candidate / "AGENTS.md").is_file() and (candidate / "knowledge").is_dir():
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
        project_root = discover_project_root(anchor)
        if project_root is None:
            return None
        if text == "<project-root>":
            return project_root
        return project_root / text.removeprefix("<project-root>/")
    path = Path(text).expanduser()
    if not path.is_absolute():
        path = anchor.resolve().parent / path
    return path


def existing_nonempty_file(value: Any, anchor: Path) -> bool:
    path = resolve_input_path(value, anchor)
    if path is None:
        return False
    try:
        return path.is_file() and path.stat().st_size > 0
    except OSError:
        return False


class GateValidator:
    def __init__(self, card: dict[str, Any], card_path: Path):
        self.card = card
        self.card_path = card_path
        self.errors: list[str] = []
        self.warnings: list[str] = []
        self.passed: list[str] = []

    def error(self, message: str) -> None:
        self.errors.append(message)

    def pass_check(self, message: str) -> None:
        self.passed.append(message)

    def validate_header(self) -> str:
        if self.card.get("schema_version") != 2:
            self.error("schema_version 必须为 2；历史卡重新进入写稿或制作时必须升级精选质量验收")
        if not nonempty(self.card.get("task_id")):
            self.error("task_id 不能为空")
        stage = self.card.get("target_stage")
        if stage not in VALID_STAGES:
            self.error("target_stage 必须是 outline、draft 或 production")
            return "outline"
        self.pass_check("任务标识与目标阶段有效")
        return stage

    def validate_rules(self) -> None:
        rules = self.card.get("required_rules")
        if not isinstance(rules, list) or len(rules) < 2:
            self.error("required_rules 至少包含全局内容硬门禁和项目内容规范")
            return
        has_global_gate = False
        for index, item in enumerate(rules):
            if not isinstance(item, dict):
                self.error(f"required_rules[{index}] 必须是对象")
                continue
            path = item.get("path")
            if item.get("read") is not True:
                self.error(f"required_rules[{index}] 尚未确认完整读取")
            if not existing_nonempty_file(path, self.card_path):
                self.error(f"required_rules[{index}] 文件不存在或为空：{path}")
            if nonempty(path) and (
                "公开内容生产大脑硬门禁" in path
                or path.endswith("public-content-gate.md")
            ):
                has_global_gate = True
        if not has_global_gate:
            self.error("required_rules 缺少全局《公开内容生产大脑硬门禁》")
        if not any(error.startswith("required_rules") for error in self.errors) and has_global_gate:
            self.pass_check("全局和项目规则已实际读取")

    def validate_sources(self) -> None:
        sources = self.card.get("sources")
        if not isinstance(sources, list) or not sources:
            self.error("sources 至少需要一条真实来源")
            return
        deep_source_count = 0
        evidence_source_count = 0
        for index, source in enumerate(sources):
            label = f"sources[{index}]"
            if not isinstance(source, dict):
                self.error(f"{label} 必须是对象")
                continue
            completeness = source.get("completeness")
            if completeness not in VALID_COMPLETENESS:
                self.error(f"{label}.completeness 取值无效")
                continue
            uses = source.get("intended_uses")
            if not isinstance(uses, list) or not uses:
                self.error(f"{label}.intended_uses 不能为空")
                continue
            unknown_uses = sorted(set(uses) - ALL_USES)
            if unknown_uses:
                self.error(f"{label} 存在未知用途：{'、'.join(unknown_uses)}")
            use_set = set(uses)
            if completeness == "metadata-only" and not use_set <= METADATA_USES:
                self.error(
                    f"{label} 只有 metadata-only，却用于观点、结构或成稿证据；必须补完整内容或降级用途"
                )
            if completeness == "partial" and not use_set <= PARTIAL_USES:
                self.error(f"{label} 只有 partial，却被用于完整观点、Talking 结构或成稿证据")
            if use_set & DEEP_USES:
                if completeness != "complete" or not existing_nonempty_file(source.get("content_path"), self.card_path):
                    self.error(f"{label} 用于观点或 Talking 结构时，必须有完整且非空的 content_path")
                else:
                    deep_source_count += 1
            if "draft-evidence" in use_set:
                if completeness not in {"complete", "primary-source"}:
                    self.error(f"{label} 作为成稿证据时完整度不足")
                if not existing_nonempty_file(source.get("content_path"), self.card_path):
                    self.error(f"{label} 作为成稿证据时缺少非空 content_path")
                if source.get("verification_status") == "待核验":
                    self.error(f"{label} 仍是待核验，不能直接作为公开成稿证据")
                else:
                    evidence_source_count += 1
        if deep_source_count == 0 and evidence_source_count == 0:
            self.error("没有一条来源具备深度分析或成稿证据资格")
        else:
            self.pass_check("来源完整度与用途匹配")

    def validate_recent_six(self) -> None:
        recent = self.card.get("recent_six")
        if not isinstance(recent, list) or len(recent) < 6:
            self.error("recent_six 至少需要最近六条真实内容")
            return
        for index, item in enumerate(recent[:6]):
            if not isinstance(item, dict):
                self.error(f"recent_six[{index}] 必须是对象")
                continue
            for field in RECENT_FIELDS:
                if not nonempty(item.get(field)):
                    self.error(f"recent_six[{index}].{field} 不能为空")
        if not any(error.startswith("recent_six") for error in self.errors):
            self.pass_check("最近六条主张、证据、交付物和行动引导已建台账")

    def validate_brief_contract(self) -> None:
        sources = self.card.get("sources")
        uses_reference_structure = isinstance(sources, list) and any(
            isinstance(source, dict)
            and isinstance(source.get("intended_uses"), list)
            and "talking-structure" in source["intended_uses"]
            for source in sources
        )
        if not uses_reference_structure:
            return

        contract = self.card.get("brief_contract")
        if not isinstance(contract, dict):
            self.error(
                "brief_contract 必须是对象；使用参考内容的 Talking 结构前必须锁定用户目标和参考内容角色"
            )
            return
        for field in BRIEF_CONTRACT_FIELDS:
            value = contract.get(field)
            if not nonempty(value):
                self.error(f"brief_contract.{field} 不能为空")
            elif len(value.strip()) < 20:
                self.error(f"brief_contract.{field} 过于空泛，必须具体对应本轮用户要求")

        required_arc = contract.get("required_arc")
        if not isinstance(required_arc, list) or len(required_arc) < 3:
            self.error("brief_contract.required_arc 至少需要三段用户要求的故事线")
        elif not all(nonempty(item) and len(item.strip()) >= 8 for item in required_arc):
            self.error("brief_contract.required_arc 不能包含空白或占位故事线")

        forbidden_reframes = contract.get("forbidden_reframes")
        if not isinstance(forbidden_reframes, list) or len(forbidden_reframes) < 2:
            self.error("brief_contract.forbidden_reframes 至少需要两个禁止擅自改写的主题")
        elif not all(nonempty(item) and len(item.strip()) >= 4 for item in forbidden_reframes):
            self.error("brief_contract.forbidden_reframes 不能包含空白或占位主题")

        if contract.get("status") != "locked":
            self.error("brief_contract.status 必须为 locked，未锁定用户原始意图时不得写稿")

        if not any(error.startswith("brief_contract") for error in self.errors):
            self.pass_check("参考内容角色、用户原始目标、故事线和禁止改写主题已锁定")

    def validate_topic(self) -> None:
        topic = self.card.get("topic")
        if not isinstance(topic, dict):
            self.error("topic 必须是对象")
            return
        for field in TOPIC_FIELDS:
            if not nonempty(topic.get(field)):
                self.error(f"topic.{field} 不能为空")
        difference = str(topic.get("difference_from_recent") or "")
        if len(difference.strip()) < 40:
            self.error("topic.difference_from_recent 过于空泛，必须写清新问题、新信息、新证据和新交付物")
        delete_candidates = topic.get("delete_candidates")
        if not isinstance(delete_candidates, list):
            self.error("topic.delete_candidates 必须是数组，用于证明已执行删除动作")
        if not any(error.startswith("topic.") for error in self.errors):
            self.pass_check("第一性原理选题卡完整")

    def validate_frozen_topics(self) -> None:
        hits = self.card.get("frozen_topic_hits", [])
        if not isinstance(hits, list):
            self.error("frozen_topic_hits 必须是数组")
            return
        for index, hit in enumerate(hits):
            if not isinstance(hit, dict):
                self.error(f"frozen_topic_hits[{index}] 必须是对象")
                continue
            if not nonempty(hit.get("topic")):
                self.error(f"frozen_topic_hits[{index}].topic 不能为空")
            usage = hit.get("usage")
            if usage not in {"background", "main-claim"}:
                self.error(f"frozen_topic_hits[{index}].usage 必须是 background 或 main-claim")
            if usage == "main-claim" and not any(
                nonempty(hit.get(field))
                for field in ("new_evidence", "new_counterexample", "conclusion_change")
            ):
                self.error(
                    f"frozen_topic_hits[{index}] 把冻结母题作为主结论，却没有新证据、反例或结论变化"
                )
        if not any(error.startswith("frozen_topic_hits") for error in self.errors):
            self.pass_check("冻结母题使用边界有效")

    def validate_audience_fit(self) -> None:
        audience_fit = self.card.get("audience_fit")
        if not isinstance(audience_fit, dict):
            self.error("audience_fit 必须是对象，用于验证观众距离和账号阶段")
            return
        for field in AUDIENCE_FIT_FIELDS:
            if not nonempty(audience_fit.get(field)):
                self.error(f"audience_fit.{field} 不能为空")
        if audience_fit.get("account_stage") not in VALID_ACCOUNT_STAGES:
            self.error("audience_fit.account_stage 必须是调查、试验、结果、方法或复制")
        if audience_fit.get("high_level_material_role") not in VALID_HIGH_LEVEL_ROLES:
            self.error("audience_fit.high_level_material_role 只能是 evidence、background 或 none，不能让高层技术继续做主角")
        ordinary_scenes = audience_fit.get("ordinary_scenes")
        if not isinstance(ordinary_scenes, list) or len(ordinary_scenes) < 2:
            self.error("audience_fit.ordinary_scenes 至少需要两个普通人可感知的工作或生活场景")
        elif not all(nonempty(scene) for scene in ordinary_scenes):
            self.error("audience_fit.ordinary_scenes 不能包含空场景")
        if audience_fit.get("requires_expert_authority") is not False:
            self.error("audience_fit.requires_expert_authority 必须为 false，当前表达不能依赖不存在的专家身份")
        first_connection = str(audience_fit.get("first_20s_connection") or "")
        if len(first_connection.strip()) < 30:
            self.error("audience_fit.first_20s_connection 过于空泛，必须写出观众在前20秒如何认出自己的具体场景")
        if not any(error.startswith("audience_fit") for error in self.errors):
            self.pass_check("观众距离、账号阶段、普通人场景和讲述身份匹配")

    def validate_douyin_quality(self, stage: str) -> None:
        quality = self.card.get("douyin_quality")
        if not isinstance(quality, dict):
            self.error("douyin_quality 必须是对象，用于登记抖音精选内容四项质量目标")
            return
        if quality.get("source_scope") != "quality-guidance-not-selection-guarantee":
            self.error(
                "douyin_quality.source_scope 必须明确为 quality-guidance-not-selection-guarantee"
            )
        if quality.get("selection_not_guaranteed") is not True:
            self.error("douyin_quality.selection_not_guaranteed 必须为 true，内部验收不能冒充平台精选结果")

        primary_traits: set[str] = set()
        for trait in DOUYIN_QUALITY_TRAITS:
            item = quality.get(trait)
            label = f"douyin_quality.{trait}"
            if not isinstance(item, dict):
                self.error(f"{label} 必须是对象")
                continue
            for field in DOUYIN_QUALITY_FIELDS:
                if not nonempty(item.get(field)):
                    self.error(f"{label}.{field} 不能为空")
            script_evidence = str(item.get("script_evidence") or "").strip()
            viewer_test = str(item.get("viewer_test") or "").strip()
            if script_evidence and len(script_evidence) < 30:
                self.error(f"{label}.script_evidence 过于空泛，必须指向具体正文、事实或表达结构")
            if viewer_test and len(viewer_test) < 20:
                self.error(f"{label}.viewer_test 过于空泛，必须说明目标观众如何验收")
            target = item.get("target")
            if target not in VALID_QUALITY_TARGETS:
                self.error(f"{label}.target 只能是 primary、supporting 或 not-targeted")
            elif target == "primary":
                primary_traits.add(trait)

        for required_trait in ("gain", "expression"):
            if required_trait not in primary_traits:
                self.error(f"douyin_quality.{required_trait}.target 必须为 primary，作为本账号精品基线")

        integrity_boundary = quality.get("integrity_boundary")
        if not nonempty(integrity_boundary) or len(integrity_boundary.strip()) < 30:
            self.error("douyin_quality.integrity_boundary 必须具体说明不得怎样制造惊喜感和感染力")

        review_status = quality.get("review_status")
        if review_status not in VALID_QUALITY_REVIEW_STATUSES:
            self.error("douyin_quality.review_status 只能是 planned、self-reviewed 或 human-reviewed")
        elif stage == "production" and review_status != "human-reviewed":
            self.error("production 阶段 douyin_quality.review_status 必须为 human-reviewed")

        if not any(error.startswith("douyin_quality") or "douyin_quality" in error for error in self.errors):
            self.pass_check("抖音精选质量目标、正文证据、验收方式和非保证边界已登记")

    def validate_mechanisms(self, stage: str) -> None:
        cards = self.card.get("mechanism_cards")
        if stage in {"draft", "production"} and (not isinstance(cards, list) or not cards):
            self.error("draft 或 production 阶段至少需要一张完整机制卡")
            return
        if not isinstance(cards, list):
            self.error("mechanism_cards 必须是数组")
            return
        for index, card in enumerate(cards):
            if not isinstance(card, dict):
                self.error(f"mechanism_cards[{index}] 必须是对象")
                continue
            for field in MECHANISM_FIELDS:
                if not nonempty(card.get(field)):
                    self.error(f"mechanism_cards[{index}].{field} 不能为空")
        if cards and not any(error.startswith("mechanism_cards") for error in self.errors):
            self.pass_check("核心对象的问题、瓶颈、机制、证据、关系和边界已讲清")

    def validate_voice(self) -> None:
        voice = self.card.get("voice")
        if not isinstance(voice, dict):
            self.error("voice 必须是对象")
            return
        if voice.get("read") is not True:
            self.error("声音档案尚未确认读取")
        if not existing_nonempty_file(voice.get("profile_path"), self.card_path):
            self.error("声音档案文件不存在或为空")
        if not any("声音档案" in error for error in self.errors):
            self.pass_check("本人声音档案已实际读取")

    def validate_draft(self, stage: str) -> None:
        draft = self.card.get("draft", {})
        if not isinstance(draft, dict):
            self.error("draft 必须是对象")
            return
        draft_path = draft.get("path")
        if draft_path:
            if not existing_nonempty_file(draft_path, self.card_path):
                self.error(f"draft.path 文件不存在或为空：{draft_path}")
            else:
                resolved_draft_path = resolve_input_path(draft_path, self.card_path)
                assert resolved_draft_path is not None
                self.scan_frozen_phrases(resolved_draft_path, draft)
        if stage != "production":
            return
        if not existing_nonempty_file(draft_path, self.card_path):
            self.error("production 阶段必须提供非空 draft.path")
        for field in PRODUCTION_CHECKS:
            if draft.get(field) is not True:
                self.error(f"production 阶段 {field} 必须为 true")
        if not any(error.startswith("production 阶段") for error in self.errors):
            self.pass_check("事实锁、去 AI 味、朗读、本人声音、查重、合规和用户确认均通过")

    def scan_frozen_phrases(self, draft_path: Path, draft: dict[str, Any]) -> None:
        text = draft_path.read_text(encoding="utf-8")
        start_marker = draft.get("content_start_marker")
        end_marker = draft.get("content_end_marker")
        if start_marker or end_marker:
            if not nonempty(start_marker) or not nonempty(end_marker):
                self.error("draft 正文范围必须同时提供 content_start_marker 和 content_end_marker")
                return
            start_index = text.find(start_marker)
            if start_index < 0:
                self.error("draft.content_start_marker 未在稿件中找到")
                return
            content_start = start_index + len(start_marker)
            end_index = text.find(end_marker, content_start)
            if end_index < 0:
                self.error("draft.content_end_marker 未在起始标记之后找到")
                return
            text = text[content_start:end_index]
        exemptions = draft.get("phrase_exemptions", [])
        exemption_map = {
            item.get("pattern_id"): item.get("reason")
            for item in exemptions
            if isinstance(item, dict) and nonempty(item.get("pattern_id"))
        }
        for pattern_id, pattern, description in FROZEN_PATTERNS:
            if not pattern.search(text):
                continue
            reason = exemption_map.get(pattern_id)
            if not nonempty(reason) or len(reason.strip()) < 20:
                self.error(f"draft 命中 {pattern_id}：{description}；没有具体的新证据豁免理由")
            else:
                self.warnings.append(f"draft 命中 {pattern_id}，已记录人工豁免：{reason}")

    def run(self) -> dict[str, Any]:
        stage = self.validate_header()
        self.validate_rules()
        self.validate_sources()
        self.validate_brief_contract()
        self.validate_recent_six()
        self.validate_topic()
        self.validate_frozen_topics()
        self.validate_audience_fit()
        self.validate_douyin_quality(stage)
        self.validate_mechanisms(stage)
        self.validate_voice()
        self.validate_draft(stage)
        status = "blocked"
        if not self.errors:
            status = {
                "outline": "ready-for-outline",
                "draft": "ready-for-draft",
                "production": "ready-for-production",
            }[stage]
        return {
            "ok": not self.errors,
            "status": status,
            "task_id": self.card.get("task_id"),
            "target_stage": stage,
            "card_path": str(self.card_path),
            "passed": self.passed,
            "errors": self.errors,
            "warnings": self.warnings,
        }


def main() -> int:
    parser = argparse.ArgumentParser(description="校验公开内容生产门禁卡")
    parser.add_argument("card", help="内容门禁卡 JSON 路径")
    parser.add_argument("--report", help="可选：保存 JSON 报告的路径")
    args = parser.parse_args()

    card_path = Path(args.card).expanduser().resolve()
    try:
        with card_path.open("r", encoding="utf-8") as handle:
            card = json.load(handle)
        if not isinstance(card, dict):
            raise ValueError("内容门禁卡顶层必须是对象")
        result = GateValidator(card, card_path).run()
    except (OSError, json.JSONDecodeError, ValueError) as error:
        result = {
            "ok": False,
            "status": "blocked",
            "card_path": str(card_path),
            "passed": [],
            "errors": [f"无法读取内容门禁卡：{error}"],
            "warnings": [],
        }

    output = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    sys.stdout.write(output)
    if args.report:
        report_path = Path(args.report).expanduser().resolve()
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(output, encoding="utf-8")
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
