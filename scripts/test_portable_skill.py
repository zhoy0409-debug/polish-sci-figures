#!/usr/bin/env python3
"""Unpack the portable skill and exercise its novice raw-table workflow."""
from __future__ import annotations

import csv
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
import tempfile
from urllib.parse import unquote
import zipfile

from build_portable_skill import ENTRYPOINT, ROOT, SKILL_NAME, VERSION, build, suite_files, portable_name, portable_bytes
from build_release import SUPPORT_FILES, archive_bytes


def run(args, cwd):
    env = dict(os.environ, PYTHONIOENCODING="utf-8")
    result = subprocess.run([sys.executable, *map(str, args)], cwd=cwd,
                            text=True, encoding="utf-8", stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, env=env)
    assert result.returncode == 0, (args, result.stdout, result.stderr)
    return result.stdout


def relative_links(document, boundary):
    text = document.read_text(encoding="utf-8")
    checked = 0
    for target in re.findall(r"\]\(([^)\s]+)\)", text):
        if target.startswith(("#", "https:", "http:", "mailto:")):
            continue
        path = (document.parent / unquote(target.split("#")[0])).resolve()
        assert path.is_relative_to(boundary.resolve()) and path.is_file(), (document, target)
        checked += 1
    return checked


def bundled_markdown_links(skill):
    """Check the actual extracted documents, including nested workflow guides."""
    suite = skill / "suite"
    documents = sorted(path for path in skill.rglob("*")
                       if path.is_file() and path.suffix.lower() == ".md")
    checked = sum(relative_links(document, suite if document.is_relative_to(suite) else skill)
                  for document in documents)
    return {"markdown_files": len(documents), "relative_links": checked}


def main():
    cache = (ROOT / ".cache/portable-skill-test").resolve()
    assert cache.is_relative_to(ROOT.resolve())
    cache.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=cache) as temporary:
        workspace = Path(temporary)
        archive = build(outdir=workspace / "dist")
        assert archive.name == f"{SKILL_NAME}-{VERSION}-skill.zip"
        originals = {p.relative_to(ROOT).as_posix(): p for p in suite_files()}
        expected = {f"{SKILL_NAME}/SKILL.md"} | {
            f"{SKILL_NAME}/suite/{portable_name(name)}" for name in originals}
        extracted = workspace / "extracted"
        with zipfile.ZipFile(archive) as handle:
            names = handle.namelist()
            assert [name for name in names if PurePosixPath(name).name.casefold() == 'skill.md'] == [f'{SKILL_NAME}/SKILL.md'], 'Claude requires exactly one SKILL.md across the entire archive'
            assert len(names) == len(set(names))
            assert set(names) == expected
            for name in names:
                path = PurePosixPath(name)
                assert path.parts[0] == SKILL_NAME and not path.is_absolute() and ".." not in path.parts
                assert not set(path.parts) & {".git", ".cache", ".venv", "__pycache__", "examples"}
                relative = "/".join(path.parts[2:])
                assert not (path.suffix.lower() in {".pyc", ".pyo", ".csv", ".tsv", ".xlsx", ".zip", ".png", ".jpg", ".pdf"}
                            and relative not in SUPPORT_FILES), name
                assert not path.name.startswith(".env")
            for name, path in originals.items():
                assert handle.read(f"{SKILL_NAME}/suite/{portable_name(name)}") == portable_bytes(path, set(originals), VERSION)
                if path.suffix != '.md':
                    assert handle.read(f"{SKILL_NAME}/suite/{portable_name(name)}") == path.read_bytes()
            assert handle.read(f"{SKILL_NAME}/SKILL.md") == ENTRYPOINT.read_bytes()
            handle.extractall(extracted)

        skill = extracted / SKILL_NAME
        suite = skill / "suite"
        entry = (skill / "SKILL.md").read_text(encoding="utf-8")
        front = re.match(r"^---\n(.*?)\n---", entry, flags=re.S).group(1)
        assert re.search(r"^name: polish-sci-figures$", front, flags=re.M)
        description = re.search(r"^description: (.+)$", front, flags=re.M).group(1)
        assert 0 < len(description) <= 200
        for token in ("doctor", "localhost", "2–3", "1–2", "experimental-unit", "host permissions"):
            assert token in entry, token
        bundled_markdown_links(skill)
        assert "Copyright (c) 2026 Wenting Zhou" in (suite / "LICENSE").read_text(encoding="utf-8")
        assert "usage:" in run([suite / "sci_figures.py", "--help"], workspace).lower()
        doctor = json.loads(run([suite / "sci_figures.py", "doctor", "--font", "DejaVu Sans", "--json"], workspace))
        assert doctor["summary"]["blocking"] == 0, doctor

        # Start from an ordinary raw table, not a saved Studio project or fixture bundle.
        # The user has explicitly confirmed these 16 objects are independent units.
        rows = [["group", "value", "unit"]]
        for group, values in (("Control", [1, 2, 2.5, 3, 4, 4.5, 5, 6]),
                              ("Treatment", [2, 3, 3.5, 4, 5, 5.5, 6, 7])):
            rows.extend([[group, str(value), f"{group}-{i}"] for i, value in enumerate(values)])
        table = workspace / "synthetic observations.csv"
        with table.open("w", newline="", encoding="utf-8") as stream:
            csv.writer(stream).writerows(rows)
        source_hash = hashlib.sha256(table.read_bytes()).hexdigest()
        inspection = json.loads(run([suite / "sci_figures.py", "inspect", table, "--json"], workspace))
        assert inspection["rows"] == 16 and set(inspection["columns"]) == set(rows[0]), inspection
        assert "group-comparison" in inspection["candidate_structures"], inspection

        bundle = workspace / "generated"
        run([suite / "skills/make-sci-data-figures/scripts/gallery_cli.py",
             "--view", "compare_box_points", "--input", table, "--out", bundle,
             "--font", "DejaVu Sans"], workspace)
        recipe = json.loads((bundle / "figure_recipe.json").read_text(encoding="utf-8"))
        analysis = json.loads((bundle / "analysis_plan.json").read_text(encoding="utf-8"))
        assert (bundle / recipe["input"]).resolve() == table.resolve()
        assert analysis["source_sha256"] == source_hash
        assert hashlib.sha256(table.read_bytes()).hexdigest() == source_hash
        assert "primary_test" not in analysis, "Descriptive candidates must not fabricate inferential results"
        # Present a short candidate set from the generated compatible alternatives.
        candidates = [bundle / (view + ".svg") for view in
                      ("compare_box_points", "compare_raincloud", "compare_violin")]
        for candidate in candidates:
            assert candidate.is_file(), candidate
            svg = candidate.read_text(encoding="utf-8")
            assert "<svg" in svg and "<text" in svg and "Control" in svg and "Treatment" in svg

        page = workspace / "figure-studio.html"
        run([suite / "sci_figures.py", "studio", bundle, "--out", page, "--columns", "1"], workspace)
        html = page.read_text(encoding="utf-8")
        match = re.search(r'<script type="application/json" id="project">(.*?)</script>', html, re.S)
        assert match, "Embedded editable project is missing"
        project = json.loads(match.group(1))
        assert project["panels"][0]["table"]["rows"] == rows
        assert project["panels"][0]["table"]["sha256"] == source_hash
        assert "StudioRichText" in html and "StudioWorkspace" in html
        assert "__STUDIO_" not in html
        report = {"archive": archive.name, "files": len(expected), "top_folder": SKILL_NAME,
                  "raw_rows": len(rows) - 1, "candidate_previews": len(candidates),
                  "doctor": "passed", "editable_page": "passed", "source_unchanged": True}
    print("Portable skill extraction and raw-table workflow passed:", json.dumps(report))


if __name__ == "__main__":
    main()
