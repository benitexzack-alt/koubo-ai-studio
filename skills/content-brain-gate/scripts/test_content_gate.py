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


if __name__ == "__main__":
    unittest.main(verbosity=2)
