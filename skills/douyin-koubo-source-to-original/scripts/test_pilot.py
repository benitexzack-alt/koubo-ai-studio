#!/usr/bin/env python3
"""Regression tests for the six-sample pilot validator."""

from __future__ import annotations

import copy
import json
import subprocess
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
CARD = ROOT / "notes/2026-08-19-口播源头拆解六样本-自动化准入卡-v1.json"
VALIDATOR = Path(__file__).with_name("validate_pilot.py")


def run(card_path: Path) -> tuple[int, dict]:
    completed = subprocess.run(
        [sys.executable, str(VALIDATOR), str(card_path)],
        check=False,
        text=True,
        capture_output=True,
    )
    return completed.returncode, json.loads(completed.stdout)


def main() -> int:
    exit_code, result = run(CARD)
    assert exit_code == 0, result
    assert result["status"] == "ready-for-manual-review", result

    invalid = json.loads(CARD.read_text(encoding="utf-8"))
    invalid["samples"] = invalid["samples"][:-1]
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", suffix=".json", delete=False) as handle:
        json.dump(invalid, handle, ensure_ascii=False)
        invalid_path = Path(handle.name)
    try:
        exit_code, result = run(invalid_path)
        assert exit_code == 1, result
        assert result["status"] == "blocked", result
    finally:
        invalid_path.unlink(missing_ok=True)
    print("六样本自动化准入校验：通过")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
