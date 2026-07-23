#!/usr/bin/env python3
"""Regression tests for the content-brain gate validator."""

from __future__ import annotations

import copy
import importlib.util
import json
import unittest
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
    def validate(self, card: dict, name: str) -> dict:
        return MODULE.GateValidator(card, SKILL_ROOT / "fixtures" / name).run()

    def test_old_waic_sample_still_fails(self) -> None:
        result = self.validate(load_fixture("waic-old-fail.json"), "waic-old-fail.json")
        self.assertEqual(result["status"], "blocked")
        self.assertTrue(result["errors"])

    def test_new_waic_direction_still_passes(self) -> None:
        result = self.validate(load_fixture("waic-new-pass.json"), "waic-new-pass.json")
        self.assertEqual(result["status"], "ready-for-draft")
        self.assertFalse(result["errors"])

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
        card["draft"] = {
            "path": str(SKILL_ROOT / "fixtures" / "section-scan.md"),
            "content_start_marker": "## 口播正文",
            "content_end_marker": "## 审计附录",
            "phrase_exemptions": [],
        }
        result = self.validate(card, "section-marker-pass.json")
        self.assertEqual(result["status"], "ready-for-draft")
        self.assertFalse(result["errors"])

    def test_without_markers_appendix_is_scanned(self) -> None:
        card = load_fixture("waic-new-pass.json")
        card["draft"] = {
            "path": str(SKILL_ROOT / "fixtures" / "section-scan.md"),
            "phrase_exemptions": [],
        }
        result = self.validate(card, "section-marker-missing.json")
        self.assertEqual(result["status"], "blocked")
        self.assertTrue(any("repeat-small-task" in error for error in result["errors"]))
        self.assertTrue(any("lanzhou-ai-identity" in error for error in result["errors"]))

    def test_marker_pair_is_required(self) -> None:
        card = copy.deepcopy(load_fixture("waic-new-pass.json"))
        card["draft"] = {
            "path": str(SKILL_ROOT / "fixtures" / "section-scan.md"),
            "content_start_marker": "## 口播正文",
            "phrase_exemptions": [],
        }
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
        result = self.validate(card, "douyin-quality-human-review-fail.json")
        self.assertEqual(result["status"], "blocked")
        self.assertTrue(any("review_status 必须为 human-reviewed" in error for error in result["errors"]))


if __name__ == "__main__":
    unittest.main(verbosity=2)
