#!/usr/bin/env python3
"""Validate a public-content gate card and emit a deterministic stage status."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from datetime import datetime
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
SEMANTIC_CONTRACT_FIELDS = (
    "audience_conflict",
    "core_judgment",
    "training_interpretation",
    "ordinary_person_value",
)
SEMANTIC_ALIGNMENT_KEYS = SEMANTIC_CONTRACT_FIELDS
VALID_MATERIAL_ROLES = {
    "hook-evidence",
    "mechanism-evidence",
    "local-proof",
    "boundary",
    "action-support",
}
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
VALID_SELECTION_MODES = {
    "explicit-topic-request",
    "explicit-candidate-choice",
    "user-confirmed-assistant-candidate",
}
SKILL_ROOT = Path(__file__).resolve().parent.parent
RECENT_FIELDS = (
    "title",
    "date",
    "audience_problem",
    "main_claim",
    "evidence",
    "deliverable",
    "cta",
)
CANDIDATE_VALIDATION_CHECKS = (
    "audience_problem_confirmed",
    "recent_six_increment_confirmed",
    "evidence_or_personal_fact_confirmed",
    "account_stage_fit_confirmed",
    "deliverable_confirmed",
)
PRODUCTION_CHECKS = (
    "fact_lock_passed",
    "humanize_passed",
    "read_aloud_passed",
    "voice_match_passed",
    "recent_six_recheck_passed",
    "performance_feedback_recheck_passed",
    "compliance_passed",
    "user_script_approved",
)
COPY_REVIEW_CHECKS = (
    "humanizer_pattern_scan_completed",
    "ai_boundary_review_completed",
    "fact_safe_rewrite_completed",
    "retention_risk_review_completed",
    "read_aloud_completed",
    "voice_match_completed",
)
AI_BOUNDARY_REVIEW_FIELDS = (
    "self_explanation_removed",
    "defensive_boundary_embedded",
    "generic_transitions_replaced",
    "abstract_claims_grounded",
    "source_insertions_contextualized",
    "mechanical_completeness_reduced",
)
COPY_REVIEW_SCORES = (
    "directness",
    "spoken_naturalness",
    "rhythm",
    "personal_voice",
    "fact_fidelity",
)
COPY_REVIEW_FACT_CHANGE_FIELDS = (
    "new_facts",
    "removed_facts",
    "wording_strength_changes",
    "pending_user_confirmations",
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
PROJECT_STYLE_GATE_PATH = "knowledge/21-超哥口播语言与重复硬门禁.json"
VALIDATOR_VERSION = "content-brain-gate/1.3"


def nonempty(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def meaningful_text(value: Any, minimum_characters: int) -> bool:
    if not nonempty(value):
        return False
    return len(re.sub(r"\s+", "", value)) >= minimum_characters


def value_at_path(value: Any, dotted_path: Any) -> Any:
    if not nonempty(dotted_path):
        return None
    current = value
    for part in dotted_path.split("."):
        if not isinstance(current, dict) or part not in current:
            return None
        current = current[part]
    return current


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


def discover_personal_kb(anchor: Path) -> Path | None:
    candidates: list[Path] = []
    configured = os.environ.get("KOUBO_PERSONAL_KB")
    if configured:
        candidates.append(Path(configured).expanduser().resolve())
    project_root = discover_project_root(anchor)
    if project_root is not None:
        candidates.append((project_root.parent / "个人知识库").resolve())
    for candidate in candidates:
        if (candidate / "AGENTS.md").is_file():
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
    if text == "<codex-home>" or text.startswith("<codex-home>/"):
        codex_home = Path(os.environ.get("CODEX_HOME", Path.home() / ".codex")).expanduser()
        if text == "<codex-home>":
            return codex_home
        return codex_home / text.removeprefix("<codex-home>/")
    if text == "<project-root>" or text.startswith("<project-root>/"):
        project_root = discover_project_root(anchor)
        if project_root is None:
            return None
        if text == "<project-root>":
            return project_root
        return project_root / text.removeprefix("<project-root>/")
    if text == "<personal-kb>" or text.startswith("<personal-kb>/"):
        personal_kb = discover_personal_kb(anchor)
        if personal_kb is None:
            return None
        if text == "<personal-kb>":
            return personal_kb
        return personal_kb / text.removeprefix("<personal-kb>/")
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


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


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
        if self.card.get("schema_version") != 6:
            self.error(
                "schema_version 必须为 6；历史卡重新进入选题、写稿或制作时必须补齐全量账号数据自动预检回执"
            )
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
                evidence_ids = source.get("evidence_ids")
                if not isinstance(evidence_ids, list) or not evidence_ids or not all(
                    nonempty(item) for item in evidence_ids
                ):
                    self.error(f"{label} 作为成稿证据时必须提供非空 evidence_ids")
                if not nonempty(source.get("canonical_ref")):
                    self.error(f"{label} 作为成稿证据时必须提供 canonical_ref")
        if deep_source_count == 0 and evidence_source_count == 0:
            self.error("没有一条来源具备深度分析或成稿证据资格")
        else:
            self.pass_check("来源完整度与用途匹配")

    def validate_recent_six(self) -> None:
        recent = self.card.get("recent_six")
        if not isinstance(recent, list) or len(recent) < 6:
            self.error("recent_six 至少需要最近六条真实内容")
            return
        resolved_paths: set[Path] = set()
        for index, item in enumerate(recent[:6]):
            if not isinstance(item, dict):
                self.error(f"recent_six[{index}] 必须是对象")
                continue
            for field in RECENT_FIELDS:
                if not nonempty(item.get(field)):
                    self.error(f"recent_six[{index}].{field} 不能为空")
            if not nonempty(item.get("claim_id")):
                self.error(f"recent_six[{index}].claim_id 不能为空")
            evidence_ids = item.get("evidence_ids")
            if not isinstance(evidence_ids, list) or not all(nonempty(value) for value in evidence_ids):
                self.error(f"recent_six[{index}].evidence_ids 必须是仅含非空字符串的数组")
            content_path = resolve_input_path(item.get("content_path"), self.card_path)
            if content_path is None or not content_path.is_file() or content_path.stat().st_size == 0:
                self.error(f"recent_six[{index}].content_path 必须指向真实非空正文")
                continue
            resolved = content_path.resolve()
            if resolved in resolved_paths:
                self.error(f"recent_six[{index}].content_path 与其他最近内容重复，不能用同一篇正文冒充六条")
            resolved_paths.add(resolved)
            if item.get("sha256") != file_sha256(content_path):
                self.error(f"recent_six[{index}].sha256 与当前正文不一致")
            start_marker = item.get("content_start_marker")
            end_marker = item.get("content_end_marker")
            if not nonempty(start_marker) or not nonempty(end_marker):
                self.error(f"recent_six[{index}] 必须同时提供正文起止标记")
                continue
            body = content_path.read_text(encoding="utf-8")
            start = body.find(start_marker)
            end = body.find(end_marker, start + len(start_marker)) if start >= 0 else -1
            if start < 0 or end < 0:
                self.error(f"recent_six[{index}] 的正文起止标记未在真实文件中找到")
        if not any(error.startswith("recent_six") for error in self.errors):
            self.pass_check("最近六条真实正文、哈希、主张、证据和行动引导已绑定")

    def validate_topic_authorization(self, stage: str) -> None:
        if stage == "outline":
            return
        authorization = self.card.get("topic_authorization")
        if not isinstance(authorization, dict):
            self.error("topic_authorization 必须是对象；未取得用户明确选题授权不得进入写稿")
            return
        if authorization.get("status") != "user-selected":
            self.error("topic_authorization.status 必须为 user-selected")
        if authorization.get("selected_by") != "user":
            self.error("topic_authorization.selected_by 必须为 user")
        if authorization.get("selection_mode") not in VALID_SELECTION_MODES:
            self.error("topic_authorization.selection_mode 取值无效")
        topic = self.card.get("topic")
        selected_topic = authorization.get("selected_topic")
        if not nonempty(selected_topic):
            self.error("topic_authorization.selected_topic 不能为空")
        elif isinstance(topic, dict) and selected_topic.strip() != str(topic.get("novel_claim") or "").strip():
            self.error("topic_authorization.selected_topic 必须与 topic.novel_claim 完全一致")
        instruction = authorization.get("user_instruction")
        if not nonempty(instruction) or len(instruction.strip()) < 8:
            self.error("topic_authorization.user_instruction 必须记录可审计的用户原始指令")
        if not nonempty(authorization.get("source_ref")):
            self.error("topic_authorization.source_ref 不能为空")
        if not nonempty(authorization.get("confirmed_at")):
            self.error("topic_authorization.confirmed_at 不能为空")
        if authorization.get("candidate_only") is not False:
            self.error("topic_authorization.candidate_only 必须为 false")
        if not any(error.startswith("topic_authorization") for error in self.errors):
            self.pass_check("用户已明确选择当前主题，候选题未越权进入写稿")

    def validate_candidate_generation(self) -> None:
        candidate = self.card.get("candidate_generation")
        if candidate is None:
            return
        if not isinstance(candidate, dict):
            self.error("candidate_generation 必须是对象")
            return
        if candidate.get("used") is not True:
            self.error("candidate_generation.used 必须为 true；未使用候选生成工具时应省略该对象")
        if not nonempty(candidate.get("method")):
            self.error("candidate_generation.method 不能为空")
        if not nonempty(candidate.get("selected_candidate")):
            self.error("candidate_generation.selected_candidate 必须记录唯一进入验证的候选题")
        basis = candidate.get("combination_basis")
        if not isinstance(basis, list) or len(basis) < 3:
            self.error("candidate_generation.combination_basis 至少需要行业内容、人群和场景三个要素")
        elif not all(nonempty(item) for item in basis):
            self.error("candidate_generation.combination_basis 不能包含空要素")
        if candidate.get("generation_is_not_validation") is not True:
            self.error("candidate_generation.generation_is_not_validation 必须为 true；候选生成不能冒充选题验证")
        checks = candidate.get("validation_checks")
        if not isinstance(checks, dict):
            self.error("candidate_generation.validation_checks 必须是对象")
        else:
            for field in CANDIDATE_VALIDATION_CHECKS:
                if checks.get(field) is not True:
                    self.error(f"candidate_generation.validation_checks.{field} 必须为 true")
        deferred = candidate.get("rejected_or_deferred")
        if not isinstance(deferred, list):
            self.error("candidate_generation.rejected_or_deferred 必须是数组")
        if not any(error.startswith("candidate_generation") for error in self.errors):
            self.pass_check("候选生成已与选题验证分离，并完成五项验证记录")

    def validate_brief_contract(self, stage: str) -> None:
        sources = self.card.get("sources")
        uses_reference_structure = isinstance(sources, list) and any(
            isinstance(source, dict)
            and isinstance(source.get("intended_uses"), list)
            and "talking-structure" in source["intended_uses"]
            for source in sources
        )
        contract = self.card.get("brief_contract")
        if not isinstance(contract, dict):
            self.error(
                "brief_contract 必须是对象；公开内容进入提纲前必须锁定用户目标、材料角色和故事线"
            )
            return
        if not uses_reference_structure:
            self.error(
                "sources 必须至少登记一条 talking-structure 完整来源；"
                "不得只读取事实材料和账号指标后直接写公开口播"
            )
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

        semantic = contract.get("semantic_contract")
        if not isinstance(semantic, dict):
            self.error("brief_contract.semantic_contract 必须是对象，用于锁定观众矛盾、核心判断和普通人价值")
        else:
            for field in SEMANTIC_CONTRACT_FIELDS:
                value = semantic.get(field)
                if not nonempty(value) or len(value.strip()) < 20:
                    self.error(f"brief_contract.semantic_contract.{field} 必须是至少20字的具体判断")
            if semantic.get("chronology_is_not_main_arc") is not True:
                self.error("brief_contract.semantic_contract.chronology_is_not_main_arc 必须为 true")
            material_roles = semantic.get("material_role_map")
            if not isinstance(material_roles, list) or len(material_roles) < 3:
                self.error("brief_contract.semantic_contract.material_role_map 至少需要三项材料角色")
            else:
                for index, item in enumerate(material_roles):
                    label = f"brief_contract.semantic_contract.material_role_map[{index}]"
                    if not isinstance(item, dict):
                        self.error(f"{label} 必须是对象")
                        continue
                    if not nonempty(item.get("material")):
                        self.error(f"{label}.material 不能为空")
                    if item.get("role") not in VALID_MATERIAL_ROLES:
                        self.error(f"{label}.role 不能把现场材料设为主主题或时间线驱动")
                    supports = item.get("supports")
                    if not nonempty(supports) or len(supports.strip()) < 12:
                        self.error(f"{label}.supports 必须说明材料在证明什么")
            draft = self.card.get("draft")
            has_written_draft = isinstance(draft, dict) and nonempty(draft.get("path"))
            if stage == "production" or has_written_draft:
                refs = semantic.get("alignment_refs")
                if not isinstance(refs, dict):
                    self.error("brief_contract.semantic_contract.alignment_refs 必须绑定当前正文真实句子")
                else:
                    for key in SEMANTIC_ALIGNMENT_KEYS:
                        ref = refs.get(key)
                        if not nonempty(ref) or len(ref.strip()) < 8:
                            self.error(f"brief_contract.semantic_contract.alignment_refs.{key} 不能为空")

        if not any(error.startswith("brief_contract") for error in self.errors):
            self.pass_check("参考结构、用户原始目标、材料角色、故事线和语义合同已锁定")

    def validate_semantic_alignment(self, text: str, stage: str) -> None:
        if stage not in {"draft", "production"}:
            return
        contract = self.card.get("brief_contract")
        semantic = contract.get("semantic_contract") if isinstance(contract, dict) else None
        refs = semantic.get("alignment_refs") if isinstance(semantic, dict) else None
        if not isinstance(refs, dict):
            return
        error_count_before = len(self.errors)
        for key in SEMANTIC_ALIGNMENT_KEYS:
            ref = refs.get(key)
            if nonempty(ref) and ref not in text:
                self.error(f"brief_contract.semantic_contract.alignment_refs.{key} 未在当前正文中找到")
        opening_ref = refs.get("audience_conflict")
        if nonempty(opening_ref):
            opening_position = text.find(opening_ref)
            if opening_position < 0 or opening_position > 320:
                self.error("观众矛盾必须在正文前320个字符内出现，不能先写活动背景或参访流水账")
        opening = text[:360]
        diary_patterns = (
            r"隔了.{0,8}(?:天|一段时间).{0,16}(?:又|再).{0,8}(?:去|参观|来到)",
            r"第一天.{0,120}第二天",
            r"先去了.{0,120}(?:又|再)去了",
        )
        if any(re.search(pattern, opening, re.DOTALL) for pattern in diary_patterns):
            self.error("正文开头命中参访时间线：现场材料必须服务观众问题，不能用行程顺序组织开场")
        if len(self.errors) == error_count_before:
            self.pass_check("观众矛盾、核心判断、培训解读和普通人价值已绑定当前正文")

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
        claim_id = topic.get("claim_id")
        if not nonempty(claim_id):
            self.error("topic.claim_id 不能为空")
        primary_evidence_ids = topic.get("primary_evidence_ids")
        if not isinstance(primary_evidence_ids, list) or not primary_evidence_ids or not all(
            nonempty(item) for item in primary_evidence_ids
        ):
            self.error("topic.primary_evidence_ids 必须是至少含一项非空证据 ID 的数组")
        else:
            source_evidence_ids = {
                evidence_id
                for source in self.card.get("sources", [])
                if isinstance(source, dict)
                for evidence_id in (
                    source.get("evidence_ids")
                    if isinstance(source.get("evidence_ids"), list)
                    else []
                )
                if nonempty(evidence_id)
            }
            unknown_ids = sorted(set(primary_evidence_ids) - source_evidence_ids)
            if unknown_ids:
                self.error(f"topic.primary_evidence_ids 未在 sources 中登记：{'、'.join(unknown_ids)}")

        recent = self.card.get("recent_six")
        if isinstance(recent, list):
            recent_claim_ids = {
                item.get("claim_id")
                for item in recent[:6]
                if isinstance(item, dict) and nonempty(item.get("claim_id"))
            }
            if nonempty(claim_id) and claim_id in recent_claim_ids:
                self.error(f"topic.claim_id 与最近六条重复：{claim_id}")
            recent_evidence_ids = {
                evidence_id
                for item in recent[:6]
                if isinstance(item, dict)
                for evidence_id in (
                    item.get("evidence_ids")
                    if isinstance(item.get("evidence_ids"), list)
                    else []
                )
                if nonempty(evidence_id)
            }
            duplicated_evidence = sorted(set(primary_evidence_ids or []) & recent_evidence_ids)
            if duplicated_evidence and not self.valid_evidence_reuse_authorization(duplicated_evidence):
                self.error(
                    "topic.primary_evidence_ids 与最近六条重复且无用户复用授权："
                    + "、".join(duplicated_evidence)
                )
        if not any(error.startswith("topic.") for error in self.errors):
            self.pass_check("第一性原理选题卡完整")

    def valid_evidence_reuse_authorization(self, duplicated_evidence: list[str]) -> bool:
        authorization = self.card.get("evidence_reuse_authorization")
        if not isinstance(authorization, dict):
            return False
        authorized_ids = authorization.get("evidence_ids")
        return (
            authorization.get("status") == "user-approved"
            and isinstance(authorized_ids, list)
            and all(nonempty(item) for item in authorized_ids)
            and set(duplicated_evidence) <= set(authorized_ids)
            and nonempty(authorization.get("source_ref"))
            and nonempty(authorization.get("reason"))
            and len(authorization["reason"].strip()) >= 20
            and nonempty(authorization.get("new_contribution"))
            and len(authorization["new_contribution"].strip()) >= 20
        )

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

    def validate_performance_feedback(self) -> None:
        feedback = self.card.get("performance_feedback")
        if not isinstance(feedback, dict):
            self.error("performance_feedback 必须是对象；未读取账号实测学习卡不得进入选题或写稿")
            return

        preflight = feedback.get("account_data_preflight")
        preflight_path: Path | None = None
        preflight_receipt: dict[str, Any] | None = None
        context_snapshot: dict[str, Any] | None = None
        if not isinstance(preflight, dict):
            self.error(
                "performance_feedback.account_data_preflight 必须是对象；"
                "每次选题、改稿或重新制作前必须自动生成全量账号数据回执"
            )
        else:
            preflight_path_value = preflight.get("receipt_path")
            preflight_path = resolve_input_path(preflight_path_value, self.card_path)
            if preflight.get("read") is not True:
                self.error("performance_feedback.account_data_preflight.read 必须为 true")
            if preflight_path is None or not existing_nonempty_file(
                preflight_path_value, self.card_path
            ):
                self.error(
                    "performance_feedback.account_data_preflight.receipt_path 文件不存在或为空："
                    f"{preflight_path_value}"
                )
            else:
                expected_preflight_hash = preflight.get("receipt_sha256")
                if not nonempty(expected_preflight_hash) or not re.fullmatch(
                    r"[0-9a-f]{64}", expected_preflight_hash
                ):
                    self.error(
                        "performance_feedback.account_data_preflight.receipt_sha256 "
                        "必须是64位小写SHA-256"
                    )
                elif file_sha256(preflight_path) != expected_preflight_hash:
                    self.error(
                        "performance_feedback.account_data_preflight.receipt_sha256 与当前回执不一致"
                    )
                try:
                    loaded_preflight = json.loads(
                        preflight_path.read_text(encoding="utf-8")
                    )
                except (OSError, json.JSONDecodeError) as error:
                    self.error(f"performance_feedback 账号数据回执无法读取：{error}")
                else:
                    if isinstance(loaded_preflight, dict):
                        preflight_receipt = loaded_preflight
                    else:
                        self.error("performance_feedback 账号数据回执顶层必须是对象")

        if preflight_receipt is not None:
            if preflight_receipt.get("schemaVersion") != "koubo-account-performance-preflight/1.1":
                self.error("performance_feedback 账号数据回执 schemaVersion 无效")
            if preflight_receipt.get("taskId") != self.card.get("task_id"):
                self.error("performance_feedback 账号数据回执 taskId 必须与内容门禁卡一致")
            if preflight_receipt.get("status") not in {
                "ready-current",
                "ready-historical-stale",
            }:
                self.error("performance_feedback 账号数据回执状态不可用")
            account_context = preflight_receipt.get("accountContext")
            if not isinstance(account_context, dict):
                self.error("performance_feedback 账号数据回执缺少 accountContext")
            else:
                if account_context.get("allAcceptedHistoryUsed") is not True:
                    self.error("performance_feedback 账号数据回执未覆盖全部已接纳历史")
                if account_context.get("allPublishedWorksIncluded") is not True:
                    self.error("performance_feedback 账号数据回执未覆盖全部已发布作品")
                published_count = account_context.get("publishedWorkCount")
                accepted_run_count = account_context.get("acceptedRunCount")
                recent_six_count = account_context.get("recentSixCount")
                if not isinstance(published_count, int) or isinstance(published_count, bool) or published_count < 1:
                    self.error("performance_feedback 账号数据回执 publishedWorkCount 无效")
                if not isinstance(accepted_run_count, int) or isinstance(accepted_run_count, bool) or accepted_run_count < 1:
                    self.error("performance_feedback 账号数据回执 acceptedRunCount 无效")
                if not isinstance(recent_six_count, int) or isinstance(recent_six_count, bool) or recent_six_count < 1:
                    self.error("performance_feedback 账号数据回执 recentSixCount 无效")
                snapshot_path_value = account_context.get("snapshotPath")
                snapshot_path = resolve_input_path(snapshot_path_value, preflight_path or self.card_path)
                snapshot_hash = account_context.get("snapshotSha256")
                if snapshot_path is None or not existing_nonempty_file(
                    snapshot_path_value, preflight_path or self.card_path
                ):
                    self.error("performance_feedback 账号数据证据快照不存在或为空")
                elif not nonempty(snapshot_hash) or not re.fullmatch(r"[0-9a-f]{64}", snapshot_hash):
                    self.error("performance_feedback 账号数据证据快照哈希无效")
                elif file_sha256(snapshot_path) != snapshot_hash:
                    self.error("performance_feedback 账号数据证据快照已被修改")
                else:
                    try:
                        context_snapshot = json.loads(snapshot_path.read_text(encoding="utf-8"))
                    except (OSError, json.JSONDecodeError) as error:
                        self.error(f"performance_feedback 账号数据证据快照无法读取：{error}")
                    else:
                        if not isinstance(context_snapshot, dict):
                            self.error("performance_feedback 账号数据证据快照顶层必须是对象")
                            context_snapshot = None
                        else:
                            if context_snapshot.get("schemaVersion") != "douyin-account-performance-context/1.0":
                                self.error("performance_feedback 账号数据证据快照 schemaVersion 无效")
                            coverage = context_snapshot.get("coverage")
                            all_works = context_snapshot.get("allPublishedWorks")
                            accepted_history = context_snapshot.get("acceptedHistory")
                            accepted_snapshots = (
                                accepted_history.get("snapshots")
                                if isinstance(accepted_history, dict)
                                else None
                            )
                            recent_six = context_snapshot.get("recentSix")
                            if not isinstance(coverage, dict):
                                self.error("performance_feedback 账号数据证据快照缺少 coverage")
                            else:
                                if coverage.get("allAcceptedHistoryUsed") is not True:
                                    self.error("performance_feedback 账号数据证据快照未覆盖全部历史")
                                if coverage.get("allPublishedWorksIncluded") is not True:
                                    self.error("performance_feedback 账号数据证据快照未覆盖全部作品")
                            if not isinstance(all_works, list) or len(all_works) != published_count:
                                self.error("performance_feedback 账号数据证据快照作品数量与回执不一致")
                            if not isinstance(accepted_snapshots, list) or len(accepted_snapshots) != accepted_run_count:
                                self.error("performance_feedback 账号数据证据快照历史批次数与回执不一致")
                            if not isinstance(recent_six, list) or len(recent_six) != recent_six_count:
                                self.error("performance_feedback 账号数据证据快照最近六条与回执不一致")
                            boundary = context_snapshot.get("interpretationBoundary")
                            if not isinstance(boundary, dict) or (
                                boundary.get("descriptiveFactsOnly") is not True
                                or boundary.get("causalLessonsRequireHumanConfirmation") is not True
                                or boundary.get("staleDataCannotBeDescribedAsCurrent") is not True
                            ):
                                self.error("performance_feedback 账号数据证据快照缺少事实与因果边界")
                if (
                    preflight_receipt.get("requiresCurrentAccountData") is True
                    and (
                        preflight_receipt.get("status") != "ready-current"
                        or account_context.get("stale") is not False
                    )
                ):
                    self.error("performance_feedback 本任务要求当前数据，但回执只包含过期历史数据")
            automatic_contract = preflight_receipt.get("automaticUseContract")
            if not isinstance(automatic_contract, dict) or any(
                automatic_contract.get(field) is not True
                for field in (
                    "generatedBeforeTopicOrDraft",
                    "descriptiveFactsLoadedAutomatically",
                    "humanConfirmedLessonsLoadedAutomatically",
                    "appliedLessonSelectionStillRequiredInContentGate",
                    "causalLessonsNotAutoGenerated",
                    "staleDataCannotBeDescribedAsCurrent",
                )
            ):
                self.error("performance_feedback 账号数据回执缺少自动使用与因果边界合同")
            automatic_reference = preflight_receipt.get("automaticReference")
            if not isinstance(automatic_reference, dict):
                self.error("performance_feedback 账号数据回执缺少 automaticReference")
            elif context_snapshot is not None:
                accepted_history = context_snapshot.get("acceptedHistory")
                expected_reference = {
                    "accountBaseline": context_snapshot.get("accountBaseline"),
                    "contentTypeBaselines": context_snapshot.get("contentTypeBaselines"),
                    "recentSix": context_snapshot.get("recentSix"),
                    "acceptedHistorySignals": {
                        "status": accepted_history.get("status"),
                        "periods": accepted_history.get("periods"),
                        "latestVideoChanges": accepted_history.get("latestVideoChanges"),
                        "anomalies": accepted_history.get("anomalies"),
                        "boundary": accepted_history.get("boundary"),
                    } if isinstance(accepted_history, dict) else None,
                }
                if automatic_reference != expected_reference:
                    self.error("performance_feedback 账号数据回执 automaticReference 与全量证据快照不一致")

        data_application = feedback.get("account_data_application")
        if not isinstance(data_application, dict):
            self.error(
                "performance_feedback.account_data_application 必须是对象；"
                "必须说明本条具体使用了哪些账号数据，不能只声明已读回执"
            )
        elif preflight_receipt is not None:
            automatic_reference = preflight_receipt.get("automaticReference")
            if isinstance(automatic_reference, dict):
                baseline = automatic_reference.get("accountBaseline")
                recent_works = automatic_reference.get("recentSix")
                baseline_evidence = data_application.get("account_baseline_evidence")
                recent_evidence = data_application.get("recent_work_evidence")
                if not isinstance(baseline_evidence, dict):
                    self.error(
                        "performance_feedback.account_data_application.account_baseline_evidence "
                        "必须是对象"
                    )
                elif not isinstance(baseline, dict):
                    self.error("performance_feedback 账号数据回执缺少全账号基线")
                else:
                    metric = baseline_evidence.get("metric")
                    actual_value = value_at_path(baseline, metric)
                    if not nonempty(metric) or actual_value is None:
                        self.error("performance_feedback 全账号基线证据 metric 不存在")
                    elif baseline_evidence.get("value") != actual_value:
                        self.error("performance_feedback 全账号基线证据 value 与回执不一致")
                    if not meaningful_text(baseline_evidence.get("use"), 8):
                        self.error("performance_feedback 全账号基线证据必须说明本条如何使用")
                if not isinstance(recent_evidence, dict):
                    self.error(
                        "performance_feedback.account_data_application.recent_work_evidence "
                        "必须是对象"
                    )
                elif not isinstance(recent_works, list):
                    self.error("performance_feedback 账号数据回执缺少最近六条")
                else:
                    video_key = recent_evidence.get("video_key")
                    recent_work = next(
                        (
                            work
                            for work in recent_works
                            if isinstance(work, dict) and work.get("videoKey") == video_key
                        ),
                        None,
                    )
                    metric = recent_evidence.get("metric")
                    actual_value = value_at_path(recent_work or {}, metric)
                    if recent_work is None:
                        self.error("performance_feedback 最近作品证据 video_key 不在回执最近六条中")
                    elif not nonempty(metric) or actual_value is None:
                        self.error("performance_feedback 最近作品证据 metric 不存在")
                    elif recent_evidence.get("value") != actual_value:
                        self.error("performance_feedback 最近作品证据 value 与回执不一致")
                    if not meaningful_text(recent_evidence.get("use"), 8):
                        self.error("performance_feedback 最近作品证据必须说明本条如何使用")
                if not meaningful_text(data_application.get("planned_change"), 12):
                    self.error("performance_feedback.account_data_application.planned_change 必须说明本条的具体改动")
                if data_application.get("causal_claim") not in {"none", "human-confirmed-lesson-only"}:
                    self.error(
                        "performance_feedback.account_data_application.causal_claim "
                        "只能是 none 或 human-confirmed-lesson-only"
                    )

        learning_card_path_value = feedback.get("learning_card_path")
        learning_card_path = resolve_input_path(learning_card_path_value, self.card_path)
        if feedback.get("read") is not True:
            self.error("performance_feedback.read 必须为 true")
        if learning_card_path is None or not existing_nonempty_file(
            learning_card_path_value, self.card_path
        ):
            self.error(
                f"performance_feedback.learning_card_path 文件不存在或为空：{learning_card_path_value}"
            )
            return

        expected_hash = feedback.get("learning_card_sha256")
        if not nonempty(expected_hash) or not re.fullmatch(r"[0-9a-f]{64}", expected_hash):
            self.error("performance_feedback.learning_card_sha256 必须是64位小写SHA-256")
        elif file_sha256(learning_card_path) != expected_hash:
            self.error("performance_feedback.learning_card_sha256 已过期，必须重新读取当前账号实测学习卡")

        try:
            learning_card = json.loads(learning_card_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            self.error(f"performance_feedback 学习卡无法读取：{error}")
            return
        if not isinstance(learning_card, dict):
            self.error("performance_feedback 学习卡顶层必须是对象")
            return

        if learning_card.get("schema_version") != 1:
            self.error("performance_feedback 学习卡 schema_version 必须为 1")
        if learning_card.get("type") != "douyin-account-performance-learning":
            self.error("performance_feedback 学习卡 type 无效")
        if learning_card.get("status") != "current":
            self.error("performance_feedback 学习卡必须是 current 状态")
        if preflight_receipt is not None:
            receipt_learning_card = preflight_receipt.get("learningCard")
            if not isinstance(receipt_learning_card, dict):
                self.error("performance_feedback 账号数据回执缺少 learningCard")
            else:
                if receipt_learning_card.get("sha256") != expected_hash:
                    self.error("performance_feedback 账号数据回执与当前学习卡哈希不一致")
                if receipt_learning_card.get("snapshotAt") != learning_card.get("snapshot_at"):
                    self.error("performance_feedback 账号数据回执与当前学习卡快照时间不一致")
        snapshot_at = learning_card.get("snapshot_at")
        if not nonempty(snapshot_at) or feedback.get("snapshot_at") != snapshot_at:
            self.error("performance_feedback.snapshot_at 必须与当前学习卡一致")
        else:
            try:
                snapshot_date = datetime.fromisoformat(
                    snapshot_at.replace("Z", "+00:00")
                ).date()
            except ValueError:
                self.error("performance_feedback 学习卡 snapshot_at 必须是 ISO 8601 时间")
            else:
                project_root = discover_project_root(self.card_path)
                history_path = (
                    project_root / "workflow/recent-content-history.v1.json"
                    if project_root is not None
                    else None
                )
                if history_path is not None and history_path.is_file():
                    try:
                        history = json.loads(history_path.read_text(encoding="utf-8"))
                    except (OSError, json.JSONDecodeError) as error:
                        self.error(f"performance_feedback 无法读取最近内容台账：{error}")
                    else:
                        newer_ids: list[str] = []
                        for item in history.get("items", []) if isinstance(history, dict) else []:
                            if not isinstance(item, dict) or not nonempty(item.get("date")):
                                continue
                            try:
                                item_date = datetime.fromisoformat(item["date"]).date()
                            except ValueError:
                                self.error(
                                    "performance_feedback 最近内容台账存在无效 date："
                                    f"{item.get('id', '未命名')}"
                                )
                                continue
                            if item_date > snapshot_date and nonempty(item.get("id")):
                                newer_ids.append(item["id"])
                        if newer_ids:
                            acknowledged_ids = feedback.get("newer_content_ids")
                            missing_ids = sorted(
                                set(newer_ids)
                                - set(acknowledged_ids if isinstance(acknowledged_ids, list) else [])
                            )
                            if feedback.get("newer_content_acknowledged") is not True:
                                self.error(
                                    "performance_feedback 学习卡快照后已有新口播，"
                                    "newer_content_acknowledged 必须为 true"
                                )
                            if missing_ids:
                                self.error(
                                    "performance_feedback.newer_content_ids 未覆盖学习卡之后的内容："
                                    + "、".join(missing_ids)
                                )
                            metric_status = feedback.get("newer_content_metric_status")
                            if not nonempty(metric_status) or len(metric_status.strip()) < 20:
                                self.error(
                                    "performance_feedback.newer_content_metric_status 必须说明新内容"
                                    "有无完整观察窗口，不得让旧学习卡冒充已覆盖新作品"
                                )

        active_lesson_ids = {
            lesson.get("id")
            for lesson in learning_card.get("lessons", [])
            if isinstance(lesson, dict)
            and lesson.get("status") == "active"
            and nonempty(lesson.get("id"))
        }
        applied_lesson_ids = feedback.get("applied_lesson_ids")
        if not isinstance(applied_lesson_ids, list) or not applied_lesson_ids or not all(
            nonempty(item) for item in applied_lesson_ids
        ):
            self.error("performance_feedback.applied_lesson_ids 至少需要一条有效学习ID")
        else:
            unknown_lesson_ids = sorted(set(applied_lesson_ids) - active_lesson_ids)
            if unknown_lesson_ids:
                self.error(
                    "performance_feedback.applied_lesson_ids 不在当前学习卡："
                    + "、".join(unknown_lesson_ids)
                )

        contract = learning_card.get("active_content_contract")
        if not isinstance(contract, dict):
            self.error("performance_feedback 学习卡缺少 active_content_contract")
            return

        opening_contract = contract.get("opening")
        opening_plan = feedback.get("opening_plan")
        opening_fields = {
            "answer_or_conflict_by_second": "answer_or_conflict_by_second_max",
            "proof_or_real_scene_by_second": "proof_or_real_scene_by_second_max",
            "audience_relevance_by_second": "audience_relevance_by_second_max",
            "first_viewer_value_by_second": "first_viewer_value_by_second_max",
            "title_answer_by_second": "title_answer_by_second_max",
        }
        if not isinstance(opening_contract, dict) or not isinstance(opening_plan, dict):
            self.error("performance_feedback.opening_plan 必须对应学习卡开头合同")
        else:
            for field, max_field in opening_fields.items():
                value = opening_plan.get(field)
                maximum = opening_contract.get(max_field)
                if (
                    not isinstance(value, (int, float))
                    or isinstance(value, bool)
                    or value < 0
                ):
                    self.error(f"performance_feedback.opening_plan.{field} 必须是非负秒数")
                elif (
                    not isinstance(maximum, (int, float))
                    or isinstance(maximum, bool)
                    or maximum < 0
                ):
                    self.error(f"performance_feedback 学习卡开头上限 {max_field} 无效")
                elif value > maximum:
                    self.error(
                        f"performance_feedback.opening_plan.{field} 超过当前学习卡上限 {maximum} 秒"
                    )
            if opening_plan.get("delayed_payoff_risk_checked") is not True:
                self.error("performance_feedback.opening_plan.delayed_payoff_risk_checked 必须为 true")

        duration_plan = feedback.get("duration_plan")
        if not isinstance(duration_plan, dict):
            self.error("performance_feedback.duration_plan 必须是对象")
        else:
            planned_seconds = duration_plan.get("planned_seconds")
            if (
                not isinstance(planned_seconds, (int, float))
                or isinstance(planned_seconds, bool)
                or planned_seconds <= 0
            ):
                self.error("performance_feedback.duration_plan.planned_seconds 必须是正数")
            if not nonempty(duration_plan.get("single_core_problem")):
                self.error("performance_feedback.duration_plan.single_core_problem 不能为空")
            justification = duration_plan.get("justification")
            if not nonempty(justification) or len(justification.strip()) < 30:
                self.error("performance_feedback.duration_plan.justification 必须用数据、证据和交付解释时长")
            if duration_plan.get("evidence_based_justification") is not True:
                self.error("performance_feedback.duration_plan.evidence_based_justification 必须为 true")

        metrics_contract = contract.get("metrics")
        metric_plan = feedback.get("metric_plan")
        if not isinstance(metrics_contract, dict) or not isinstance(metric_plan, dict):
            self.error("performance_feedback.metric_plan 必须对应学习卡指标合同")
        else:
            required_metrics_raw = metrics_contract.get("required_metrics")
            if not isinstance(required_metrics_raw, list) or not all(
                nonempty(item) for item in required_metrics_raw
            ):
                self.error("performance_feedback 学习卡 required_metrics 必须是非空字符串数组")
                required_metrics: set[str] = set()
            else:
                required_metrics = set(required_metrics_raw)
            primary_metric = metric_plan.get("primary_metric")
            secondary_metrics = metric_plan.get("secondary_metrics")
            if primary_metric not in required_metrics:
                self.error("performance_feedback.metric_plan.primary_metric 不在学习卡指标范围")
            if (
                not isinstance(secondary_metrics, list)
                or len(secondary_metrics) < 2
                or not all(nonempty(item) for item in secondary_metrics)
            ):
                self.error("performance_feedback.metric_plan.secondary_metrics 至少需要两项")
            elif not all(item in required_metrics for item in secondary_metrics):
                self.error("performance_feedback.metric_plan.secondary_metrics 含未知指标")
            required_windows_raw = metrics_contract.get("required_observation_windows")
            if not isinstance(required_windows_raw, list) or not all(
                nonempty(item) for item in required_windows_raw
            ):
                self.error(
                    "performance_feedback 学习卡 required_observation_windows 必须是非空字符串数组"
                )
                required_windows: set[str] = set()
            else:
                required_windows = set(required_windows_raw)
            observation_windows = metric_plan.get("observation_windows")
            if (
                not isinstance(observation_windows, list)
                or not all(nonempty(item) for item in observation_windows)
                or not required_windows <= set(observation_windows)
            ):
                self.error("performance_feedback.metric_plan.observation_windows 必须覆盖学习卡全部观察窗口")
            hypothesis = metric_plan.get("hypothesis")
            if not nonempty(hypothesis) or len(hypothesis.strip()) < 30:
                self.error("performance_feedback.metric_plan.hypothesis 必须写清本条数据假设")
            if metric_plan.get("early_vs_mature_windows_acknowledged") is not True:
                self.error(
                    "performance_feedback.metric_plan.early_vs_mature_windows_acknowledged 必须为 true"
                )

        if not any(error.startswith("performance_feedback") for error in self.errors):
            self.pass_check("全量账号数据回执、当前学习卡、开头合同、时长理由和发布指标假设已绑定")

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
                draft_text = self.extract_draft_text(resolved_draft_path, draft)
                if draft_text is not None:
                    self.validate_semantic_alignment(draft_text, stage)
                    self.scan_frozen_phrases(draft_text, draft)
                    self.scan_project_style_gate(draft_text, resolved_draft_path, draft)
                self.validate_copy_review(resolved_draft_path, draft)
        if stage != "production":
            return
        if not existing_nonempty_file(draft_path, self.card_path):
            self.error("production 阶段必须提供非空 draft.path")
        for field in PRODUCTION_CHECKS:
            if draft.get(field) is not True:
                self.error(f"production 阶段 {field} 必须为 true")

        read_aloud_evidence = draft.get("read_aloud_evidence")
        if not isinstance(read_aloud_evidence, dict):
            self.error("production 阶段 read_aloud_evidence 必须是对象")
        else:
            mode = read_aloud_evidence.get("mode")
            if mode not in {"user-read", "human-listen"}:
                self.error(
                    "production 阶段 read_aloud_evidence.mode 必须为 user-read 或 "
                    "human-listen；TTS 只能做时长检查"
                )
            if read_aloud_evidence.get("status") != "confirmed":
                self.error("production 阶段 read_aloud_evidence.status 必须为 confirmed")
            if not nonempty(read_aloud_evidence.get("evidence_ref")):
                self.error("production 阶段 read_aloud_evidence.evidence_ref 不能为空")

        language_approval = draft.get("user_language_approval")
        if not isinstance(language_approval, dict):
            self.error("production 阶段 user_language_approval 必须是对象")
        else:
            if language_approval.get("status") != "approved":
                self.error("production 阶段 user_language_approval.status 必须为 approved")
            if language_approval.get("approved_by") != "user":
                self.error("production 阶段 user_language_approval.approved_by 必须为 user")
            if not nonempty(language_approval.get("approval_ref")):
                self.error("production 阶段 user_language_approval.approval_ref 不能为空")
            approved_at = language_approval.get("approved_at")
            if not nonempty(approved_at):
                self.error("production 阶段 user_language_approval.approved_at 不能为空")
            else:
                try:
                    datetime.fromisoformat(approved_at.replace("Z", "+00:00"))
                except ValueError:
                    self.error("production 阶段 user_language_approval.approved_at 必须是 ISO 8601 时间")
        if not any(error.startswith("production 阶段") for error in self.errors):
            self.pass_check(
                "事实锁、去 AI 味、真人朗读、本人声音、查重、合规"
                "和用户语言确认均通过"
            )

    def validate_copy_review(self, draft_path: Path, draft: dict[str, Any]) -> None:
        copy_review = draft.get("copy_review")
        if not isinstance(copy_review, dict):
            self.error(
                "draft.copy_review 必须是对象；实际文稿必须自动调阅 humanizer-zh 与 "
                "humanize-koubo-script"
            )
            return
        if copy_review.get("required") is not True:
            self.error("draft.copy_review.required 必须为 true")

        report_value = copy_review.get("report_path")
        report_path = resolve_input_path(report_value, self.card_path)
        if report_path is None or not existing_nonempty_file(report_value, self.card_path):
            self.error(f"draft.copy_review.report_path 文件不存在或为空：{report_value}")
            return

        try:
            report = json.loads(report_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            self.error(f"draft.copy_review 报告无法读取：{error}")
            return
        if not isinstance(report, dict):
            self.error("draft.copy_review 报告顶层必须是对象")
            return

        if report.get("schema_version") != 1:
            self.error("draft.copy_review.schema_version 必须为 1")
        if report.get("task_id") != self.card.get("task_id"):
            self.error("draft.copy_review.task_id 必须与内容门禁卡一致")
        if report.get("status") != "passed":
            self.error("draft.copy_review.status 必须为 passed")
        reviewed_at = report.get("reviewed_at")
        if not nonempty(reviewed_at):
            self.error("draft.copy_review.reviewed_at 不能为空")
        else:
            try:
                datetime.fromisoformat(reviewed_at.replace("Z", "+00:00"))
            except ValueError:
                self.error("draft.copy_review.reviewed_at 必须是 ISO 8601 时间")

        report_draft = report.get("draft")
        if not isinstance(report_draft, dict):
            self.error("draft.copy_review.draft 必须是对象")
        else:
            bound_path = resolve_input_path(report_draft.get("path"), report_path)
            if bound_path is None or bound_path.resolve() != draft_path.resolve():
                self.error("draft.copy_review.draft.path 没有绑定当前稿件")
            actual_draft_sha = file_sha256(draft_path)
            if report_draft.get("sha256") != actual_draft_sha:
                self.error("draft.copy_review.draft.sha256 与当前稿件不一致，必须重新审稿")

        project_root = discover_project_root(self.card_path)
        codex_home = Path(os.environ.get("CODEX_HOME", Path.home() / ".codex")).expanduser().resolve()
        expected_skill_paths = {
            "humanizer_zh": codex_home / "skills" / "humanizer-zh" / "SKILL.md",
            "humanize_koubo_script": (
                project_root / "skills" / "humanize-koubo-script" / "SKILL.md"
                if project_root is not None
                else None
            ),
        }
        skills = report.get("skills")
        if not isinstance(skills, dict):
            self.error("draft.copy_review.skills 必须是对象")
        else:
            for skill_name, expected_path in expected_skill_paths.items():
                skill = skills.get(skill_name)
                label = f"draft.copy_review.skills.{skill_name}"
                if not isinstance(skill, dict):
                    self.error(f"{label} 必须是对象")
                    continue
                if skill.get("read") is not True:
                    self.error(f"{label}.read 必须为 true")
                skill_path = resolve_input_path(skill.get("path"), report_path)
                if expected_path is None or skill_path is None:
                    self.error(f"{label}.path 无法解析")
                    continue
                if skill_path.resolve() != expected_path.resolve():
                    self.error(f"{label}.path 必须指向当前规定的 Skill")
                    continue
                if not skill_path.is_file():
                    self.error(f"{label}.path 文件不存在")
                    continue
                if skill.get("sha256") != file_sha256(skill_path):
                    self.error(f"{label}.sha256 已过期，必须重新调阅当前 Skill")

        checks = report.get("checks")
        if not isinstance(checks, dict):
            self.error("draft.copy_review.checks 必须是对象")
        else:
            for field in COPY_REVIEW_CHECKS:
                if checks.get(field) is not True:
                    self.error(f"draft.copy_review.checks.{field} 必须为 true")

        ai_boundary_review = report.get("ai_boundary_review")
        if not isinstance(ai_boundary_review, dict):
            self.error("draft.copy_review.ai_boundary_review 必须是对象")
        else:
            for field in AI_BOUNDARY_REVIEW_FIELDS:
                if ai_boundary_review.get(field) is not True:
                    self.error(f"draft.copy_review.ai_boundary_review.{field} 必须为 true")
            notes = ai_boundary_review.get("notes")
            if not nonempty(notes) or len(notes.strip()) < 30:
                self.error("draft.copy_review.ai_boundary_review.notes 必须具体说明 AI 味边界处理结果")

        retention_review = report.get("retention_review")
        if not isinstance(retention_review, dict):
            self.error("draft.copy_review.retention_review 必须是对象")
        else:
            node_count = retention_review.get("risk_node_count")
            nodes = retention_review.get("nodes")
            if isinstance(node_count, bool) or not isinstance(node_count, int) or not 0 <= node_count <= 3:
                self.error("draft.copy_review.retention_review.risk_node_count 必须是 0 至 3")
            if not isinstance(nodes, list):
                self.error("draft.copy_review.retention_review.nodes 必须是数组")
            elif isinstance(node_count, int) and len(nodes) != node_count:
                self.error("draft.copy_review.retention_review.nodes 数量必须与 risk_node_count 一致")
            elif isinstance(nodes, list):
                for index, node in enumerate(nodes):
                    label = f"draft.copy_review.retention_review.nodes[{index}]"
                    if not isinstance(node, dict):
                        self.error(f"{label} 必须是对象")
                        continue
                    for field in ("original", "reason", "fact_difference", "recommendation"):
                        if not nonempty(node.get(field)):
                            self.error(f"{label}.{field} 不能为空")
                    if node.get("risk_level") not in {"high", "medium", "low"}:
                        self.error(f"{label}.risk_level 必须是 high、medium 或 low")
                    candidates = node.get("candidates")
                    if not isinstance(candidates, dict):
                        self.error(f"{label}.candidates 必须是对象")
                    else:
                        for candidate in ("conservative", "direct", "vivid"):
                            if not nonempty(candidates.get(candidate)):
                                self.error(f"{label}.candidates.{candidate} 不能为空")
            if node_count == 0 and not nonempty(retention_review.get("no_high_risk_reason")):
                self.error(
                    "draft.copy_review.retention_review 没有风险节点时必须填写 no_high_risk_reason"
                )

        fact_changes = report.get("fact_changes")
        if not isinstance(fact_changes, dict):
            self.error("draft.copy_review.fact_changes 必须是对象")
        else:
            for field in COPY_REVIEW_FACT_CHANGE_FIELDS:
                if not isinstance(fact_changes.get(field), list):
                    self.error(f"draft.copy_review.fact_changes.{field} 必须是数组")

        scores = report.get("scores")
        if not isinstance(scores, dict):
            self.error("draft.copy_review.scores 必须是对象")
        else:
            for field in COPY_REVIEW_SCORES:
                score = scores.get(field)
                if isinstance(score, bool) or not isinstance(score, (int, float)) or not 0 <= score <= 10:
                    self.error(f"draft.copy_review.scores.{field} 必须是 0 至 10")
            if scores.get("fact_fidelity") != 10:
                self.error("draft.copy_review.scores.fact_fidelity 必须为 10")

        copy_review_errors = [
            error for error in self.errors if error.startswith("draft.copy_review")
        ]
        if not copy_review_errors:
            self.pass_check(
                "copy_review 的稿件与 Skill 哈希、字段和事实保真凭证完整；"
                "该结果不代表正文语义通过，仍须接受项目语言与历史锚点扫描"
            )

    def extract_draft_text(self, draft_path: Path, draft: dict[str, Any]) -> str | None:
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
                return None
            text = text[content_start:end_index]
        return text

    def scan_frozen_phrases(self, text: str, draft: dict[str, Any]) -> None:
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

    def scan_project_style_gate(
        self,
        text: str,
        draft_path: Path,
        draft: dict[str, Any],
    ) -> None:
        project_root = discover_project_root(self.card_path)
        if project_root is None:
            self.error("draft.style_gate 无法定位项目根目录")
            return
        rule_path = project_root / PROJECT_STYLE_GATE_PATH
        if not rule_path.is_file():
            self.error(f"draft.style_gate 规则文件不存在：{rule_path}")
            return
        try:
            rules = json.loads(rule_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            self.error(f"draft.style_gate 规则文件无法读取：{error}")
            return
        if not isinstance(rules, dict) or rules.get("schema_version") != 1:
            self.error("draft.style_gate schema_version 必须为 1")
            return

        error_count_before = len(self.errors)
        tone_exemptions = {
            item.get("rule_id"): item
            for item in draft.get("ai_tone_exemptions", [])
            if isinstance(item, dict) and nonempty(item.get("rule_id"))
        }
        for index, rule in enumerate(rules.get("ai_tone_rules", [])):
            if not isinstance(rule, dict):
                self.error(f"draft.style_gate.ai_tone_rules[{index}] 必须是对象")
                continue
            rule_id = rule.get("id")
            pattern_text = rule.get("pattern")
            description = rule.get("description")
            if not all(nonempty(value) for value in (rule_id, pattern_text, description)):
                self.error(f"draft.style_gate.ai_tone_rules[{index}] 字段不完整")
                continue
            try:
                matched = re.search(pattern_text, text, re.DOTALL)
            except re.error as error:
                self.error(f"draft.style_gate.ai_tone_rules[{index}] 正则无效：{error}")
                continue
            if not matched:
                continue
            exemption = tone_exemptions.get(rule_id)
            approved = (
                isinstance(exemption, dict)
                and exemption.get("user_approved") is True
                and nonempty(exemption.get("approval_ref"))
                and nonempty(exemption.get("reason"))
                and len(exemption["reason"].strip()) >= 20
            )
            if not approved:
                self.error(
                    f"draft 命中 {rule_id}：{description}；"
                    "不能用 copy_review 自报通过绕过正文机器扫描"
                )
            else:
                self.warnings.append(
                    f"draft 命中 {rule_id}，已绑定用户明确豁免：{exemption['approval_ref']}"
                )

        history_value = rules.get("history_manifest")
        history_path = resolve_input_path(history_value, draft_path)
        if history_path is None or not history_path.is_file():
            self.error(f"draft.style_gate 历史台账不存在：{history_value}")
            return
        try:
            history = json.loads(history_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            self.error(f"draft.style_gate 历史台账无法读取：{error}")
            return
        items = history.get("items") if isinstance(history, dict) else None
        if not isinstance(history, dict) or history.get("schema_version") != 1:
            self.error("draft.style_gate 历史台账 schema_version 必须为 1")
            return
        if not isinstance(items, list) or not items:
            self.error("draft.style_gate 历史台账 items 不能为空")
            return

        history_texts: list[tuple[str, str]] = []
        for index, item in enumerate(items):
            label = f"draft.style_gate.history.items[{index}]"
            if not isinstance(item, dict) or not nonempty(item.get("id")):
                self.error(f"{label} 必须是带 id 的对象")
                continue
            content_path = resolve_input_path(item.get("path"), history_path)
            if content_path is None or not content_path.is_file():
                self.error(f"{label}.path 文件不存在：{item.get('path')}")
                continue
            if item.get("sha256") != file_sha256(content_path):
                self.error(f"{label}.sha256 已过期，必须重建真实口播历史台账")
                continue
            history_text = content_path.read_text(encoding="utf-8")
            start_marker = item.get("content_start_marker")
            end_marker = item.get("content_end_marker")
            if start_marker or end_marker:
                if not nonempty(start_marker) or not nonempty(end_marker):
                    self.error(f"{label} 正文标记必须成对提供")
                    continue
                start = history_text.find(start_marker)
                end = history_text.find(end_marker, start + len(start_marker)) if start >= 0 else -1
                if start < 0 or end < 0:
                    self.error(f"{label} 正文标记未在历史稿件中找到")
                    continue
                history_text = history_text[start + len(start_marker):end]
            history_texts.append((item["id"], history_text))

        anchor_exemptions = {
            item.get("anchor_id"): item
            for item in draft.get("anchor_exemptions", [])
            if isinstance(item, dict) and nonempty(item.get("anchor_id"))
        }
        for index, rule in enumerate(rules.get("anchor_rules", [])):
            if not isinstance(rule, dict):
                self.error(f"draft.style_gate.anchor_rules[{index}] 必须是对象")
                continue
            anchor_id = rule.get("id")
            pattern_text = rule.get("pattern")
            description = rule.get("description")
            if not all(nonempty(value) for value in (anchor_id, pattern_text, description)):
                self.error(f"draft.style_gate.anchor_rules[{index}] 字段不完整")
                continue
            try:
                pattern = re.compile(pattern_text, re.DOTALL)
            except re.error as error:
                self.error(f"draft.style_gate.anchor_rules[{index}] 正则无效：{error}")
                continue
            if not pattern.search(text):
                continue
            matched_history_ids = [item_id for item_id, body in history_texts if pattern.search(body)]
            latest_matches = bool(history_texts and pattern.search(history_texts[0][1]))
            if not rule.get("block_if_latest_match") or not latest_matches:
                if matched_history_ids:
                    self.warnings.append(
                        f"draft 命中历史锚点 {anchor_id}；已有 {len(matched_history_ids)} 条跟踪稿使用"
                    )
                continue
            exemption = anchor_exemptions.get(anchor_id)
            approved = (
                isinstance(exemption, dict)
                and exemption.get("user_approved") is True
                and nonempty(exemption.get("approval_ref"))
                and nonempty(exemption.get("new_contribution"))
                and len(exemption["new_contribution"].strip()) >= 20
            )
            if not approved:
                self.error(
                    f"draft 命中 {anchor_id}：{description}；与最近一条真实口播连续复用，"
                    f"当前可追踪历史中已有 {len(matched_history_ids)} 条命中，且缺少用户批准的新贡献"
                )
            else:
                self.warnings.append(
                    f"draft 连续复用 {anchor_id}，已绑定用户批准：{exemption['approval_ref']}"
                )

        if len(self.errors) == error_count_before:
            self.pass_check("项目语言失败样本与历史锚点机器扫描已通过")

    def run(self) -> dict[str, Any]:
        stage = self.validate_header()
        self.validate_rules()
        self.validate_sources()
        self.validate_brief_contract(stage)
        self.validate_recent_six()
        self.validate_candidate_generation()
        self.validate_topic()
        self.validate_topic_authorization(stage)
        self.validate_frozen_topics()
        self.validate_audience_fit()
        self.validate_performance_feedback()
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
        draft = self.card.get("draft") if isinstance(self.card.get("draft"), dict) else {}
        script_path = resolve_input_path(draft.get("path"), self.card_path)
        script_is_file = script_path is not None and script_path.is_file()
        return {
            "ok": not self.errors,
            "status": status,
            "validator_version": VALIDATOR_VERSION,
            "task_id": self.card.get("task_id"),
            "target_stage": stage,
            "card_path": str(self.card_path),
            "card_sha256": file_sha256(self.card_path) if self.card_path.is_file() else None,
            "script_path": str(script_path.resolve()) if script_is_file else None,
            "script_sha256": file_sha256(script_path) if script_is_file else None,
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
