#!/usr/bin/env python3
"""Regression tests for the content-brain gate validator."""

from __future__ import annotations

import copy
import importlib.util
import json
import os
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path


SKILL_ROOT = Path(__file__).resolve().parent.parent
VALIDATOR_PATH = SKILL_ROOT / "scripts" / "validate_content_gate.py"
SPEC = importlib.util.spec_from_file_location("content_gate_validator", VALIDATOR_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def load_fixture(name: str) -> dict:
    return json.loads((SKILL_ROOT / "fixtures" / name).read_text(encoding="utf-8"))


class ContentGateRegressionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir_context = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir_context.cleanup)
        self.temp_dir = Path(self.temp_dir_context.name)

    def validate(self, card: dict, name: str) -> dict:
        return MODULE.GateValidator(card, SKILL_ROOT / "fixtures" / name).run()

    def attach_copy_review(self, card: dict, draft_path: Path) -> Path:
        project_root = SKILL_ROOT.parent.parent
        humanizer_path = (
            Path(os.environ.get("CODEX_HOME", Path.home() / ".codex"))
            / "skills"
            / "humanizer-zh"
            / "SKILL.md"
        )
        project_skill_path = (
            project_root / "skills" / "humanize-koubo-script" / "SKILL.md"
        )
        report = {
            "schema_version": 1,
            "task_id": card["task_id"],
            "status": "passed",
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "draft": {
                "path": str(draft_path),
                "sha256": MODULE.file_sha256(draft_path),
            },
            "skills": {
                "humanizer_zh": {
                    "path": str(humanizer_path),
                    "sha256": MODULE.file_sha256(humanizer_path),
                    "read": True,
                },
                "humanize_koubo_script": {
                    "path": str(project_skill_path),
                    "sha256": MODULE.file_sha256(project_skill_path),
                    "read": True,
                },
            },
            "checks": {
                "humanizer_pattern_scan_completed": True,
                "ai_boundary_review_completed": True,
                "fact_safe_rewrite_completed": True,
                "retention_risk_review_completed": True,
                "read_aloud_completed": True,
                "voice_match_completed": True,
            },
            "ai_boundary_review": {
                "self_explanation_removed": True,
                "defensive_boundary_embedded": True,
                "generic_transitions_replaced": True,
                "abstract_claims_grounded": True,
                "source_insertions_contextualized": True,
                "mechanical_completeness_reduced": True,
                "notes": "测试稿已完成 AI 味边界审查，未保留自我说明、万能转场或资料插入式表达。",
            },
            "retention_review": {
                "risk_node_count": 0,
                "nodes": [],
                "no_high_risk_reason": "测试稿没有需要强行改写的高风险节点",
            },
            "fact_changes": {
                "new_facts": [],
                "removed_facts": [],
                "wording_strength_changes": [],
                "pending_user_confirmations": [],
            },
            "scores": {
                "directness": 9,
                "spoken_naturalness": 9,
                "rhythm": 9,
                "personal_voice": 9,
                "fact_fidelity": 10,
            },
        }
        report_path = self.temp_dir / f"{card['task_id']}-copy-review.json"
        report_path.write_text(
            json.dumps(report, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        card["draft"]["copy_review"] = {
            "required": True,
            "report_path": str(report_path),
        }
        return report_path

    def test_old_waic_sample_still_fails(self) -> None:
        result = self.validate(load_fixture("waic-old-fail.json"), "waic-old-fail.json")
        self.assertEqual(result["status"], "blocked")
        self.assertTrue(result["errors"])

    def test_new_waic_direction_still_passes(self) -> None:
        result = self.validate(load_fixture("waic-new-pass.json"), "waic-new-pass.json")
        self.assertEqual(result["status"], "ready-for-draft")
        self.assertFalse(result["errors"])

    def test_candidate_generation_cannot_claim_itself_as_validation(self) -> None:
        card = copy.deepcopy(load_fixture("waic-new-pass.json"))
        card["candidate_generation"] = {
            "used": True,
            "method": "25-grid",
            "selected_candidate": "AI大会与普通行业经验的关系",
            "combination_basis": ["行业内容", "目标人群", "具体场景"],
            "generation_is_not_validation": False,
            "validation_checks": {
                "audience_problem_confirmed": True,
                "recent_six_increment_confirmed": False,
                "evidence_or_personal_fact_confirmed": True,
                "account_stage_fit_confirmed": True,
                "deliverable_confirmed": True,
            },
            "rejected_or_deferred": [],
        }

        result = self.validate(card, "candidate-generation-self-validation.json")

        self.assertEqual(result["status"], "blocked")
        self.assertTrue(any(
            "generation_is_not_validation 必须为 true" in error
            for error in result["errors"]
        ))
        self.assertTrue(any(
            "recent_six_increment_confirmed 必须为 true" in error
            for error in result["errors"]
        ))

    def test_candidate_generation_with_five_gate_checks_can_continue(self) -> None:
        card = copy.deepcopy(load_fixture("waic-new-pass.json"))
        card["candidate_generation"] = {
            "used": True,
            "method": "25-grid",
            "selected_candidate": "AI大会与普通行业经验的关系",
            "combination_basis": ["行业内容", "目标人群", "具体场景"],
            "generation_is_not_validation": True,
            "validation_checks": {
                "audience_problem_confirmed": True,
                "recent_six_increment_confirmed": True,
                "evidence_or_personal_fact_confirmed": True,
                "account_stage_fit_confirmed": True,
                "deliverable_confirmed": True,
            },
            "rejected_or_deferred": ["只做产品盘点"],
        }

        result = self.validate(card, "candidate-generation-gate-checked.json")

        self.assertEqual(result["status"], "ready-for-draft")
        self.assertFalse(result["errors"])

    def test_draft_requires_explicit_user_topic_authorization(self) -> None:
        card = copy.deepcopy(load_fixture("waic-new-pass.json"))
        del card["topic_authorization"]

        result = self.validate(card, "missing-topic-authorization.json")

        self.assertEqual(result["status"], "blocked")
        self.assertTrue(any(
            "topic_authorization" in error
            for error in result["errors"]
        ))

    def test_reused_primary_evidence_from_recent_six_is_blocked(self) -> None:
        card = copy.deepcopy(load_fixture("waic-new-pass.json"))
        card["topic_authorization"] = {
            "status": "user-selected",
            "selected_by": "user",
            "selection_mode": "explicit-topic-request",
            "selected_topic": card["topic"]["novel_claim"],
            "user_instruction": "请围绕大会中AI开始理解非文字数据这个主题写一条口播。",
            "source_ref": "conversation:test:user-message-1",
            "confirmed_at": "2026-08-09T19:30:00+08:00",
            "candidate_only": False,
        }
        card["topic"]["claim_id"] = "claim:waic:non-text-world"
        card["topic"]["primary_evidence_ids"] = ["evidence:nber:w31161"]
        card["sources"][1]["evidence_ids"].append("evidence:nber:w31161")
        for index, item in enumerate(card["recent_six"]):
            item["claim_id"] = f"claim:recent:{index}"
            item["evidence_ids"] = []
        card["recent_six"][0]["evidence_ids"] = ["evidence:nber:w31161"]

        result = self.validate(card, "reused-primary-evidence.json")

        self.assertEqual(result["status"], "blocked")
        self.assertTrue(any(
            "evidence:nber:w31161" in error and "最近六条" in error
            for error in result["errors"]
        ))

    def test_malformed_evidence_ids_are_blocked_without_crashing(self) -> None:
        card = copy.deepcopy(load_fixture("waic-new-pass.json"))
        card["sources"][1]["evidence_ids"] = None
        card["recent_six"][0]["evidence_ids"] = None

        result = self.validate(card, "malformed-evidence-ids.json")

        self.assertEqual(result["status"], "blocked")
        self.assertTrue(any("evidence_ids" in error for error in result["errors"]))

    def test_reference_structure_requires_brief_contract(self) -> None:
        card = copy.deepcopy(load_fixture("waic-new-pass.json"))
        del card["brief_contract"]
        result = self.validate(card, "brief-contract-missing.json")
        self.assertEqual(result["status"], "blocked")
        self.assertTrue(any("brief_contract 必须是对象" in error for error in result["errors"]))

    def test_brief_contract_rejects_unlocked_or_empty_reframes(self) -> None:
        card = copy.deepcopy(load_fixture("waic-new-pass.json"))
        card["brief_contract"]["status"] = "planned"
        card["brief_contract"]["forbidden_reframes"] = []
        result = self.validate(card, "brief-contract-unlocked.json")
        self.assertEqual(result["status"], "blocked")
        self.assertTrue(any("forbidden_reframes" in error for error in result["errors"]))
        self.assertTrue(any("status 必须为 locked" in error for error in result["errors"]))

    def test_section_markers_ignore_audit_appendix(self) -> None:
        card = load_fixture("waic-new-pass.json")
        draft_path = SKILL_ROOT / "fixtures" / "section-scan.md"
        card["draft"] = {
            "path": str(draft_path),
            "content_start_marker": "## 口播正文",
            "content_end_marker": "## 审计附录",
            "phrase_exemptions": [],
        }
        self.attach_copy_review(card, draft_path)
        result = self.validate(card, "section-marker-pass.json")
        self.assertEqual(result["status"], "ready-for-draft")
        self.assertFalse(result["errors"])

    def test_without_markers_appendix_is_scanned(self) -> None:
        card = load_fixture("waic-new-pass.json")
        draft_path = SKILL_ROOT / "fixtures" / "section-scan.md"
        card["draft"] = {
            "path": str(draft_path),
            "phrase_exemptions": [],
        }
        self.attach_copy_review(card, draft_path)
        result = self.validate(card, "section-marker-missing.json")
        self.assertEqual(result["status"], "blocked")
        self.assertTrue(any("repeat-small-task" in error for error in result["errors"]))
        self.assertTrue(any("lanzhou-ai-identity" in error for error in result["errors"]))

    def test_user_rejected_ai_tone_patterns_are_blocked_even_when_review_self_reports_pass(self) -> None:
        card = copy.deepcopy(load_fixture("waic-new-pass.json"))
        draft_path = SKILL_ROOT / "fixtures" / "user-ai-tone-fail.md"
        card["draft"] = {
            "path": str(draft_path),
            "content_start_marker": "## 口播正文",
            "content_end_marker": "## 审计附录",
            "phrase_exemptions": [],
        }
        self.attach_copy_review(card, draft_path)

        result = self.validate(card, "user-ai-tone-fail.json")

        self.assertEqual(result["status"], "blocked")
        expected_rule_ids = {
            "editorial-capacity-boundary",
            "reported-source-scaffold",
            "stacked-onsite-attribution",
            "meta-rethink-scaffold",
            "meta-interpret-scaffold",
        }
        for rule_id in expected_rule_ids:
            self.assertTrue(
                any(rule_id in error for error in result["errors"]),
                f"未拦截用户明确否决的 AI 腔规则：{rule_id}",
            )

    def test_consecutive_qingyang_compute_anchor_is_blocked_without_user_approval(self) -> None:
        card = copy.deepcopy(load_fixture("waic-new-pass.json"))
        draft_path = self.temp_dir / "qingyang-anchor.md"
        draft_path.write_text(
            "## 口播正文\n\n甘肃现在已经有庆阳国家算力枢纽。\n\n## 审计附录\n",
            encoding="utf-8",
        )
        card["draft"] = {
            "path": str(draft_path),
            "content_start_marker": "## 口播正文",
            "content_end_marker": "## 审计附录",
            "phrase_exemptions": [],
            "anchor_exemptions": [],
        }
        self.attach_copy_review(card, draft_path)

        result = self.validate(card, "qingyang-anchor-repeat.json")

        self.assertEqual(result["status"], "blocked")
        self.assertTrue(any(
            "qingyang-compute" in error and "连续复用" in error
            for error in result["errors"]
        ))

    def test_marker_pair_is_required(self) -> None:
        card = copy.deepcopy(load_fixture("waic-new-pass.json"))
        draft_path = SKILL_ROOT / "fixtures" / "section-scan.md"
        card["draft"] = {
            "path": str(draft_path),
            "content_start_marker": "## 口播正文",
            "phrase_exemptions": [],
        }
        self.attach_copy_review(card, draft_path)
        result = self.validate(card, "section-marker-invalid.json")
        self.assertEqual(result["status"], "blocked")
        self.assertTrue(any("正文范围必须同时提供" in error for error in result["errors"]))

    def test_professional_distance_is_blocked(self) -> None:
        card = copy.deepcopy(load_fixture("waic-new-pass.json"))
        card["audience_fit"]["high_level_material_role"] = "main-subject"
        card["audience_fit"]["ordinary_scenes"] = ["大会上的科学基础模型"]
        card["audience_fit"]["requires_expert_authority"] = True
        result = self.validate(card, "professional-distance-fail.json")
        self.assertEqual(result["status"], "blocked")
        self.assertTrue(any("high_level_material_role" in error for error in result["errors"]))
        self.assertTrue(any("ordinary_scenes" in error for error in result["errors"]))
        self.assertTrue(any("requires_expert_authority" in error for error in result["errors"]))

    def test_performance_feedback_is_required(self) -> None:
        card = copy.deepcopy(load_fixture("waic-new-pass.json"))
        del card["performance_feedback"]

        result = self.validate(card, "performance-feedback-missing.json")

        self.assertEqual(result["status"], "blocked")
        self.assertTrue(any(
            "performance_feedback 必须是对象" in error
            for error in result["errors"]
        ))

    def test_stale_account_learning_card_hash_is_blocked(self) -> None:
        card = copy.deepcopy(load_fixture("waic-new-pass.json"))
        card["performance_feedback"]["learning_card_sha256"] = "0" * 64

        result = self.validate(card, "performance-feedback-stale-hash.json")

        self.assertEqual(result["status"], "blocked")
        self.assertTrue(any(
            "learning_card_sha256 已过期" in error
            for error in result["errors"]
        ))

    def test_learning_card_newer_content_requires_explicit_acknowledgement(self) -> None:
        card = copy.deepcopy(load_fixture("waic-new-pass.json"))
        card["performance_feedback"].pop("newer_content_acknowledged", None)
        card["performance_feedback"].pop("newer_content_ids", None)
        card["performance_feedback"].pop("newer_content_metric_status", None)

        result = self.validate(card, "performance-feedback-newer-content-unacknowledged.json")

        self.assertEqual(result["status"], "blocked")
        self.assertTrue(any(
            "newer_content_acknowledged" in error
            for error in result["errors"]
        ))
        self.assertTrue(any(
            "newer_content_ids" in error
            for error in result["errors"]
        ))

    def test_unknown_account_learning_id_is_blocked(self) -> None:
        card = copy.deepcopy(load_fixture("waic-new-pass.json"))
        card["performance_feedback"]["applied_lesson_ids"] = [
            "lesson:not-in-current-card"
        ]

        result = self.validate(card, "performance-feedback-unknown-lesson.json")

        self.assertEqual(result["status"], "blocked")
        self.assertTrue(any(
            "applied_lesson_ids 不在当前学习卡" in error
            for error in result["errors"]
        ))

    def test_delayed_title_answer_plan_is_blocked(self) -> None:
        card = copy.deepcopy(load_fixture("waic-new-pass.json"))
        card["performance_feedback"]["opening_plan"]["title_answer_by_second"] = 84
        card["performance_feedback"]["opening_plan"]["first_viewer_value_by_second"] = 90

        result = self.validate(card, "performance-feedback-delayed-payoff.json")

        self.assertEqual(result["status"], "blocked")
        self.assertTrue(any(
            "title_answer_by_second 超过当前学习卡上限" in error
            for error in result["errors"]
        ))
        self.assertTrue(any(
            "first_viewer_value_by_second 超过当前学习卡上限" in error
            for error in result["errors"]
        ))

    def test_malformed_performance_metric_arrays_are_blocked_without_crashing(self) -> None:
        card = copy.deepcopy(load_fixture("waic-new-pass.json"))
        card["performance_feedback"]["metric_plan"]["secondary_metrics"] = [
            {"metric": "average_watch_seconds"},
            "profile_visits",
        ]
        card["performance_feedback"]["metric_plan"]["observation_windows"] = [
            {"window": "early-within-3h"},
            "24h",
            "72h",
            "7d",
        ]

        result = self.validate(card, "performance-feedback-malformed-metrics.json")

        self.assertEqual(result["status"], "blocked")
        self.assertTrue(any(
            "secondary_metrics 至少需要两项" in error
            for error in result["errors"]
        ))
        self.assertTrue(any(
            "observation_windows 必须覆盖" in error
            for error in result["errors"]
        ))

    def test_douyin_quality_is_required_for_new_cards(self) -> None:
        card = copy.deepcopy(load_fixture("waic-new-pass.json"))
        del card["douyin_quality"]
        result = self.validate(card, "douyin-quality-missing.json")
        self.assertEqual(result["status"], "blocked")
        self.assertTrue(any("douyin_quality 必须是对象" in error for error in result["errors"]))

    def test_gain_and_expression_must_be_primary(self) -> None:
        card = copy.deepcopy(load_fixture("waic-new-pass.json"))
        card["douyin_quality"]["gain"]["target"] = "supporting"
        card["douyin_quality"]["expression"]["target"] = "not-targeted"
        result = self.validate(card, "douyin-quality-baseline-fail.json")
        self.assertEqual(result["status"], "blocked")
        self.assertTrue(any("gain.target 必须为 primary" in error for error in result["errors"]))
        self.assertTrue(any("expression.target 必须为 primary" in error for error in result["errors"]))

    def test_douyin_quality_cannot_claim_selection_guarantee(self) -> None:
        card = copy.deepcopy(load_fixture("waic-new-pass.json"))
        card["douyin_quality"]["selection_not_guaranteed"] = False
        result = self.validate(card, "douyin-quality-guarantee-fail.json")
        self.assertEqual(result["status"], "blocked")
        self.assertTrue(
            any("selection_not_guaranteed 必须为 true" in error for error in result["errors"])
        )

    def test_douyin_quality_rejects_placeholder_evidence(self) -> None:
        card = copy.deepcopy(load_fixture("waic-new-pass.json"))
        card["douyin_quality"]["surprise"]["script_evidence"] = "有反差"
        card["douyin_quality"]["resonance"]["viewer_test"] = "能共鸣"
        result = self.validate(card, "douyin-quality-placeholder-fail.json")
        self.assertEqual(result["status"], "blocked")
        self.assertTrue(any("script_evidence 过于空泛" in error for error in result["errors"]))
        self.assertTrue(any("viewer_test 过于空泛" in error for error in result["errors"]))

    def test_production_requires_human_quality_review(self) -> None:
        card = copy.deepcopy(load_fixture("waic-new-pass.json"))
        card["target_stage"] = "production"
        draft_path = SKILL_ROOT / "fixtures" / "section-scan.md"
        card["draft"] = {
            "path": str(draft_path),
            "content_start_marker": "## 口播正文",
            "content_end_marker": "## 审计附录",
            "fact_lock_passed": True,
            "humanize_passed": True,
            "read_aloud_passed": True,
            "voice_match_passed": True,
            "recent_six_recheck_passed": True,
            "compliance_passed": True,
            "user_script_approved": True,
            "phrase_exemptions": [],
        }
        self.attach_copy_review(card, draft_path)
        result = self.validate(card, "douyin-quality-human-review-fail.json")
        self.assertEqual(result["status"], "blocked")
        self.assertTrue(any("review_status 必须为 human-reviewed" in error for error in result["errors"]))

    def test_written_draft_requires_copy_review(self) -> None:
        card = copy.deepcopy(load_fixture("waic-new-pass.json"))
        card["draft"] = {
            "path": str(SKILL_ROOT / "fixtures" / "section-scan.md"),
            "content_start_marker": "## 口播正文",
            "content_end_marker": "## 审计附录",
            "phrase_exemptions": [],
        }
        result = self.validate(card, "copy-review-missing.json")
        self.assertEqual(result["status"], "blocked")
        self.assertTrue(any("draft.copy_review 必须是对象" in error for error in result["errors"]))

    def test_manual_humanize_boolean_without_receipt_is_blocked(self) -> None:
        card = copy.deepcopy(load_fixture("waic-new-pass.json"))
        card["target_stage"] = "production"
        card["douyin_quality"]["review_status"] = "human-reviewed"
        card["draft"] = {
            "path": str(SKILL_ROOT / "fixtures" / "section-scan.md"),
            "content_start_marker": "## 口播正文",
            "content_end_marker": "## 审计附录",
            "fact_lock_passed": True,
            "humanize_passed": True,
            "read_aloud_passed": True,
            "voice_match_passed": True,
            "recent_six_recheck_passed": True,
            "compliance_passed": True,
            "user_script_approved": True,
            "phrase_exemptions": [],
        }
        result = self.validate(card, "copy-review-manual-boolean.json")
        self.assertEqual(result["status"], "blocked")
        self.assertTrue(any("draft.copy_review 必须是对象" in error for error in result["errors"]))

    def test_copy_review_with_current_skill_and_draft_hashes_passes(self) -> None:
        card = copy.deepcopy(load_fixture("waic-new-pass.json"))
        draft_path = SKILL_ROOT / "fixtures" / "section-scan.md"
        card["draft"] = {
            "path": str(draft_path),
            "content_start_marker": "## 口播正文",
            "content_end_marker": "## 审计附录",
            "phrase_exemptions": [],
        }
        self.attach_copy_review(card, draft_path)
        result = self.validate(card, "copy-review-pass.json")
        self.assertEqual(result["status"], "ready-for-draft")
        self.assertFalse(result["errors"])
        self.assertTrue(any("copy_review" in item for item in result["passed"]))
        self.assertTrue(any("不代表正文语义通过" in item for item in result["passed"]))

    def test_copy_review_rejects_stale_draft_hash(self) -> None:
        card = copy.deepcopy(load_fixture("waic-new-pass.json"))
        draft_path = SKILL_ROOT / "fixtures" / "section-scan.md"
        card["draft"] = {
            "path": str(draft_path),
            "content_start_marker": "## 口播正文",
            "content_end_marker": "## 审计附录",
            "phrase_exemptions": [],
        }
        report_path = self.attach_copy_review(card, draft_path)
        report = json.loads(report_path.read_text(encoding="utf-8"))
        report["draft"]["sha256"] = "0" * 64
        report_path.write_text(
            json.dumps(report, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        result = self.validate(card, "copy-review-stale-draft.json")
        self.assertEqual(result["status"], "blocked")
        self.assertTrue(any("draft.sha256 与当前稿件不一致" in error for error in result["errors"]))

    def test_copy_review_rejects_stale_skill_hash(self) -> None:
        card = copy.deepcopy(load_fixture("waic-new-pass.json"))
        draft_path = SKILL_ROOT / "fixtures" / "section-scan.md"
        card["draft"] = {
            "path": str(draft_path),
            "content_start_marker": "## 口播正文",
            "content_end_marker": "## 审计附录",
            "phrase_exemptions": [],
        }
        report_path = self.attach_copy_review(card, draft_path)
        report = json.loads(report_path.read_text(encoding="utf-8"))
        report["skills"]["humanizer_zh"]["sha256"] = "0" * 64
        report_path.write_text(
            json.dumps(report, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        result = self.validate(card, "copy-review-stale-skill.json")
        self.assertEqual(result["status"], "blocked")
        self.assertTrue(any("sha256 已过期" in error for error in result["errors"]))

    def test_validation_report_binds_current_card_and_draft_hashes(self) -> None:
        card = copy.deepcopy(load_fixture("waic-new-pass.json"))
        draft_path = SKILL_ROOT / "fixtures" / "section-scan.md"
        card["draft"] = {
            "path": str(draft_path),
            "content_start_marker": "## 口播正文",
            "content_end_marker": "## 审计附录",
            "phrase_exemptions": [],
        }
        self.attach_copy_review(card, draft_path)
        card_path = self.temp_dir / "current-card.json"
        card_path.write_text(
            json.dumps(card, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        result = MODULE.GateValidator(card, card_path).run()

        self.assertEqual(result["validator_version"], "content-brain-gate/1.0")
        self.assertEqual(result["card_sha256"], MODULE.file_sha256(card_path))
        self.assertEqual(result["script_path"], str(draft_path.resolve()))
        self.assertEqual(result["script_sha256"], MODULE.file_sha256(draft_path))

    def test_retention_node_requires_three_candidates(self) -> None:
        card = copy.deepcopy(load_fixture("waic-new-pass.json"))
        draft_path = SKILL_ROOT / "fixtures" / "section-scan.md"
        card["draft"] = {
            "path": str(draft_path),
            "content_start_marker": "## 口播正文",
            "content_end_marker": "## 审计附录",
            "phrase_exemptions": [],
        }
        report_path = self.attach_copy_review(card, draft_path)
        report = json.loads(report_path.read_text(encoding="utf-8"))
        report["retention_review"] = {
            "risk_node_count": 1,
            "nodes": [
                {
                    "original": "原句",
                    "risk_level": "high",
                    "reason": "前置信息过多",
                    "candidates": {"direct": "直接版"},
                    "fact_difference": "无事实变化",
                    "recommendation": "推荐直接版",
                }
            ],
            "no_high_risk_reason": "",
        }
        report_path.write_text(
            json.dumps(report, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        result = self.validate(card, "copy-review-retention-candidates.json")
        self.assertEqual(result["status"], "blocked")
        self.assertTrue(any("candidates.conservative" in error for error in result["errors"]))
        self.assertTrue(any("candidates.vivid" in error for error in result["errors"]))


if __name__ == "__main__":
    unittest.main(verbosity=2)
