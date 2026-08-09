#!/usr/bin/env python3
"""Regression tests for source-essence synthesis."""

from __future__ import annotations

import copy
import importlib.util
import json
import unittest
from pathlib import Path


SKILL_ROOT = Path(__file__).resolve().parent.parent
VALIDATOR_PATH = SKILL_ROOT / "scripts" / "validate_source_essence.py"
SPEC = importlib.util.spec_from_file_location("source_essence_validator", VALIDATOR_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def load_fixture(name: str) -> dict:
    return json.loads((SKILL_ROOT / "fixtures" / name).read_text(encoding="utf-8"))


class SourceEssenceRegressionTests(unittest.TestCase):
    def validate(self, card: dict, name: str) -> dict:
        return MODULE.SourceEssenceValidator(card, SKILL_ROOT / "fixtures" / name).run()

    def test_ai007_v1_fails_for_missing_must_preserve_nodes(self) -> None:
        result = self.validate(load_fixture("ai007-v1-fail.json"), "ai007-v1-fail.json")
        self.assertEqual(result["status"], "blocked")
        self.assertEqual(result["coverage"]["covered_count"], 3)
        self.assertEqual(
            result["coverage"]["missing_node_ids"],
            ["I02", "I03", "I05", "I06", "I07", "I09", "I10"],
        )

    def test_complete_ai007_outline_passes(self) -> None:
        result = self.validate(load_fixture("ai007-outline-pass.json"), "ai007-outline-pass.json")
        self.assertEqual(result["status"], "ready-for-draft")
        self.assertEqual(result["coverage"]["covered_count"], 10)
        self.assertFalse(result["errors"])

    def test_extraction_stage_can_pass_without_outline(self) -> None:
        card = load_fixture("ai007-outline-pass.json")
        card["target_stage"] = "extraction"
        card["adaptation"] = {}
        result = self.validate(card, "ai007-extraction.json")
        self.assertEqual(result["status"], "ready-for-outline")
        self.assertFalse(result["errors"])

    def test_manual_coverage_claim_cannot_replace_real_mapping(self) -> None:
        card = load_fixture("ai007-v1-fail.json")
        card["coverage"] = {
            "claimed_ratio": 1.0,
            "claimed_status": "pass",
        }
        result = self.validate(card, "ai007-fake-coverage.json")
        self.assertEqual(result["status"], "blocked")
        self.assertEqual(result["coverage"]["covered_count"], 3)

    def test_draft_ref_must_exist_in_real_outline(self) -> None:
        card = load_fixture("ai007-outline-pass.json")
        card["adaptation"]["mappings"][0]["draft_ref"] = "这句话并不存在于提纲正文当中"
        result = self.validate(card, "ai007-missing-ref.json")
        self.assertEqual(result["status"], "blocked")
        self.assertTrue(any("draft_ref 未在真实提纲正文中找到" in error for error in result["errors"]))

    def test_deep_explainer_cannot_be_reduced_to_one_claim(self) -> None:
        card = load_fixture("ai007-outline-pass.json")
        card["insight_nodes"] = card["insight_nodes"][:1]
        card["mother_thesis"]["supporting_node_ids"] = ["I01"]
        card["argument_chain"] = []
        card["ordinary_person_gains"] = {
            key: {"statement": value["statement"], "node_ids": ["I01"]}
            for key, value in card["ordinary_person_gains"].items()
        }
        card["adaptation"]["mappings"] = card["adaptation"]["mappings"][:1]
        result = self.validate(card, "ai007-one-claim.json")
        self.assertEqual(result["status"], "blocked")
        self.assertTrue(any("至少需要 6 个认知节点" in error for error in result["errors"]))

    def test_interpretation_requires_correction_ledger(self) -> None:
        card = copy.deepcopy(load_fixture("ai007-outline-pass.json"))
        card["correction_ledger"] = [
            item for item in card["correction_ledger"] if item["node_id"] != "I03"
        ]
        result = self.validate(card, "ai007-missing-correction.json")
        self.assertEqual(result["status"], "blocked")
        self.assertTrue(any("I03" in error and "correction_ledger" in error for error in result["errors"]))


if __name__ == "__main__":
    unittest.main()
