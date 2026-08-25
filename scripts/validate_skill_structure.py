#!/usr/bin/env python3
"""Validate the three installable Skill folders without external packages."""

from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SKILLS = ("make-sci-data-figures", "standardize-sci-images", "polish-sci-figures")
NAME_RE = re.compile(r"^[a-z0-9-]+$")


def parse_frontmatter(path: Path) -> dict[str, str]:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        raise ValueError("missing YAML frontmatter")
    end = text.find("\n---\n", 4)
    if end < 0:
        raise ValueError("frontmatter is not closed")
    data: dict[str, str] = {}
    for line in text[4:end].splitlines():
        if ":" in line:
            key, value = line.split(":", 1)
            data[key.strip()] = value.strip()
    return data


def main() -> int:
    errors: list[str] = []
    for skill in SKILLS:
        folder = ROOT / "skills" / skill
        skill_md = folder / "SKILL.md"
        agent = folder / "agents" / "openai.yaml"
        if not skill_md.is_file():
            errors.append(f"{skill}: missing SKILL.md")
            continue
        try:
            frontmatter = parse_frontmatter(skill_md)
        except ValueError as exc:
            errors.append(f"{skill}: {exc}")
            continue
        if frontmatter.get("name") != skill:
            errors.append(f"{skill}: name mismatch {frontmatter.get('name')!r}")
        if not NAME_RE.fullmatch(frontmatter.get("name", "")):
            errors.append(f"{skill}: invalid skill name")
        if len(frontmatter.get("description", "")) < 80:
            errors.append(f"{skill}: description is too short for reliable triggering")
        if not agent.is_file():
            errors.append(f"{skill}: missing agents/openai.yaml")
    if errors:
        for error in errors:
            print(f"[FAIL] {error}")
        return 1
    print("[PASS] all installable Skill folders are structurally valid")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
