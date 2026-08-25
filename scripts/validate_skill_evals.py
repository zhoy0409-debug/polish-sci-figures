#!/usr/bin/env python3
"""Validate machine-readable skill behavior eval data."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


REQUIRED = {"id", "prompt", "should_trigger", "expected_skill", "must_do", "must_not_do"}


def validate(path: Path) -> list[str]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    errors: list[str] = []
    if not isinstance(payload, list):
        return ["top-level eval payload must be a list"]
    seen: set[str] = set()
    for index, item in enumerate(payload):
        if not isinstance(item, dict):
            errors.append(f"item {index} is not an object")
            continue
        missing = REQUIRED - set(item)
        if missing:
            errors.append(f"{item.get('id', index)} missing fields: {sorted(missing)}")
        if item.get("id") in seen:
            errors.append(f"duplicate id: {item.get('id')}")
        seen.add(item.get("id"))
        if not isinstance(item.get("prompt"), str) or not item.get("prompt", "").strip():
            errors.append(f"{item.get('id', index)} has empty prompt")
        if not isinstance(item.get("should_trigger"), bool):
            errors.append(f"{item.get('id', index)} should_trigger must be boolean")
        if item.get("should_trigger") and not item.get("expected_skill"):
            errors.append(f"{item.get('id', index)} triggered case needs expected_skill")
        for field in ("must_do", "must_not_do"):
            if not isinstance(item.get(field), list) or not item.get(field):
                errors.append(f"{item.get('id', index)} {field} must be a non-empty list")
    if len(payload) < 15:
        errors.append("at least 15 eval prompts are required")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path", nargs="?", default="evals/skill_behavior_v1_3.json")
    args = parser.parse_args()
    errors = validate(Path(args.path))
    if errors:
        for error in errors:
            print(f"[FAIL] {error}")
        return 1
    print("[PASS] skill eval data structure is valid")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
