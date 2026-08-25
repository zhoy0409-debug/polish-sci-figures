#!/usr/bin/env python3
"""Unified low-friction entry point for the SCI Figure Skills suite."""

from __future__ import annotations

import argparse
import importlib
import json
import os
import platform
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent
SKILLS = ROOT / "skills"
MAKE = SKILLS / "make-sci-data-figures"
STANDARDIZE = SKILLS / "standardize-sci-images"
POLISH = SKILLS / "polish-sci-figures"
SUPPORTED_PYTHON = ((3, 10), (3, 12))
CORE_DEPENDENCIES = {
    "matplotlib": "matplotlib",
    "numpy": "numpy",
    "openpyxl": "openpyxl",
    "pandas": "pandas",
    "Pillow": "PIL",
    "scipy": "scipy",
}
OPTIONAL_DEPENDENCIES = {
    "PyMuPDF": "fitz",
    "python-docx": "docx",
    "python-pptx": "pptx",
    "tifffile": "tifffile",
}


def status_line(status: str, name: str, detail: str = "") -> dict:
    print(f"[{status}] {name}" + (f": {detail}" if detail else ""))
    return {"status": status, "name": name, "detail": detail}


def version_of(module_name: str) -> str:
    module = importlib.import_module(module_name)
    return str(getattr(module, "__version__", "installed"))


def read_table(path: Path, sheet: str | int = 0):
    import pandas as pd

    suffix = path.suffix.lower()
    if suffix == ".csv":
        return pd.read_csv(path)
    if suffix in {".tsv", ".txt"}:
        return pd.read_csv(path, sep="\t")
    if suffix == ".xlsx":
        return pd.read_excel(path, sheet_name=sheet)
    if suffix == ".xls":
        raise ValueError("Legacy .xls is not a tested v1.3.0 input. Convert it to .xlsx, CSV, or TSV.")
    raise ValueError(f"Unsupported input type {suffix!r}. Use CSV, TSV, or XLSX.")


def ensure_mpl_config() -> tuple[bool, str]:
    if os.environ.get("MPLCONFIGDIR"):
        path = Path(os.environ["MPLCONFIGDIR"])
    else:
        path = ROOT / ".cache" / "matplotlib"
        os.environ["MPLCONFIGDIR"] = str(path)
    try:
        path.mkdir(parents=True, exist_ok=True)
        test = path / ".write-test"
        test.write_text("ok", encoding="utf-8")
        test.unlink()
        return True, str(path)
    except OSError as exc:
        fallback = Path(tempfile.gettempdir()) / "polish-sci-figures-mplconfig"
        try:
            fallback.mkdir(parents=True, exist_ok=True)
            os.environ["MPLCONFIGDIR"] = str(fallback)
            return True, f"{fallback} (project cache unavailable: {exc})"
        except OSError as fallback_exc:
            return False, str(fallback_exc)


def check_font(font: str) -> tuple[bool, str]:
    ensure_mpl_config()
    from matplotlib import font_manager

    try:
        path = font_manager.findfont(
            font_manager.FontProperties(family=font),
            fallback_to_default=False,
        )
        return True, path
    except ValueError as exc:
        return False, str(exc)


def command_exists(*names: str) -> str | None:
    for name in names:
        found = shutil.which(name)
        if found:
            return found
    return None


def doctor(args) -> int:
    checks: list[dict] = []
    current = sys.version_info[:2]
    min_py, max_py = SUPPORTED_PYTHON
    if min_py <= current <= max_py:
        checks.append(status_line("PASS", "Python version", platform.python_version()))
    else:
        checks.append(status_line(
            "FAIL", "Python version",
            f"{platform.python_version()} outside supported {min_py[0]}.{min_py[1]}-{max_py[0]}.{max_py[1]}",
        ))

    for label, module in CORE_DEPENDENCIES.items():
        try:
            checks.append(status_line("PASS", f"core dependency {label}", version_of(module)))
        except Exception as exc:
            checks.append(status_line("FAIL", f"core dependency {label}", str(exc)))

    for label, module in OPTIONAL_DEPENDENCIES.items():
        try:
            checks.append(status_line("PASS", f"optional dependency {label}", version_of(module)))
        except Exception:
            checks.append(status_line("WARN", f"optional dependency {label}", "not installed"))

    ok, detail = ensure_mpl_config()
    checks.append(status_line("PASS" if ok else "FAIL", "Matplotlib writable cache", detail))

    font_ok, font_detail = check_font(args.font)
    checks.append(status_line("PASS" if font_ok else "FAIL", f"font {args.font}", font_detail))

    libre = command_exists("soffice", "libreoffice")
    checks.append(status_line("PASS" if libre else "WARN", "LibreOffice", libre or "not found"))
    pdf = command_exists("pdftoppm", "mutool", "gs")
    checks.append(status_line("PASS" if pdf else "WARN", "PDF renderer", pdf or "not found"))

    checks.append(status_line("PASS", "platform", platform.platform()))

    for skill in (MAKE, STANDARDIZE, POLISH):
        missing = [str(part.relative_to(skill)) for part in (skill / "SKILL.md", skill / "agents" / "openai.yaml") if not part.is_file()]
        checks.append(status_line(
            "PASS" if not missing else "FAIL",
            f"skill {skill.name}",
            "complete" if not missing else f"missing {missing}",
        ))

    resources = [
        MAKE / "assets" / "palettes.json",
        POLISH / "assets" / "template_catalog.json",
        POLISH / "assets" / "sci_style.mplstyle",
        POLISH / "scripts" / "check_svg_canvas.py",
        POLISH / "scripts" / "check_svg_editability.py",
        POLISH / "scripts" / "figure_text_qa.py",
        POLISH / "scripts" / "figure_accessibility_qa.py",
        POLISH / "scripts" / "check_source_portability.py",
    ]
    missing_resources = [str(path.relative_to(ROOT)) for path in resources if not path.is_file()]
    checks.append(status_line(
        "PASS" if not missing_resources else "FAIL",
        "key resources",
        "present" if not missing_resources else ", ".join(missing_resources),
    ))
    return 1 if any(item["status"] == "FAIL" for item in checks) else 0


def column_candidates(columns: list[str]) -> dict[str, list[str]]:
    lowered = {column: column.lower().replace(" ", "_") for column in columns}
    groups = {
        "group": ("group", "condition", "treatment", "cohort", "arm", "class"),
        "value": ("value", "response", "signal", "count", "intensity", "score", "measurement"),
        "unit": ("unit", "sample", "subject", "patient", "mouse", "id", "replicate"),
        "time": ("time", "day", "week", "month", "follow"),
        "category": ("category", "cell_type", "term", "pathway", "feature", "class"),
        "x": ("x", "dose", "exposure", "concentration"),
        "y": ("y", "response", "signal", "value"),
        "row": ("row", "pathway", "gene", "feature", "term"),
        "column": ("column", "condition", "sample", "time", "group"),
    }
    result: dict[str, list[str]] = {}
    for role, tokens in groups.items():
        result[role] = [column for column, value in lowered.items() if any(token in value for token in tokens)]
    return result


def inspect_data(args) -> int:
    frame = read_table(Path(args.input), args.sheet)
    candidates = column_candidates([str(column) for column in frame.columns])
    summary = {
        "file": args.input,
        "rows": int(len(frame)),
        "columns": [str(column) for column in frame.columns],
        "column_types": {str(column): str(frame[column].dtype) for column in frame.columns},
        "missing_values": {str(column): int(frame[column].isna().sum()) for column in frame.columns},
        "duplicate_rows": int(frame.duplicated().sum()),
        "candidate_roles": candidates,
        "candidate_structures": suggest_structures(candidates),
        "questions": required_questions(candidates),
        "next_commands": next_commands(args.input, candidates),
    }
    if args.json:
        print(json.dumps(summary, indent=2, ensure_ascii=False))
    else:
        print(f"Rows: {summary['rows']}")
        print("Columns:")
        for column in summary["columns"]:
            print(f"  - {column}: {summary['column_types'][column]}, missing={summary['missing_values'][column]}")
        print(f"Duplicate rows: {summary['duplicate_rows']}")
        print("Candidate roles:")
        for role, names in candidates.items():
            if names:
                print(f"  - {role}: {', '.join(names)}")
        print("Candidate structures: " + (", ".join(summary["candidate_structures"]) or "none"))
        print("Questions:")
        for question in summary["questions"]:
            print(f"  - {question}")
        print("Next commands:")
        for command in summary["next_commands"]:
            print(f"  {command}")
    return 0


def suggest_structures(candidates: dict[str, list[str]]) -> list[str]:
    structures: list[str] = []
    if candidates["group"] and candidates["value"] and candidates["unit"]:
        structures.append("group-comparison")
    if candidates["x"] and candidates["y"] and candidates["unit"]:
        structures.append("relationship")
    if candidates["time"] and candidates["value"] and candidates["group"] and candidates["unit"]:
        structures.append("timecourse")
    if candidates["category"] and candidates["value"] and candidates["unit"]:
        structures.append("composition")
    if candidates["row"] and candidates["column"] and candidates["value"]:
        structures.append("matrix")
    return structures


def pick(candidates: dict[str, list[str]], role: str) -> str:
    return candidates.get(role, ["COLUMN"])[0] if candidates.get(role) else "COLUMN"


def required_questions(candidates: dict[str, list[str]]) -> list[str]:
    questions = []
    if not candidates["unit"]:
        questions.append("Which column is the biological experimental unit? Do not use wells/cells/fields unless they are the true unit.")
    if candidates["group"] and candidates["value"]:
        questions.append("Is the design independent, paired, repeated, nested, or technical replicate?")
    if not candidates["value"]:
        questions.append("Which numeric outcome or supplied estimate should be displayed?")
    return questions[:4]


def next_commands(input_path: str, candidates: dict[str, list[str]]) -> list[str]:
    commands = [
        f"python sci_figures.py inspect {input_path}",
    ]
    structures = suggest_structures(candidates)
    if "group-comparison" in structures:
        commands.append(
            "python skills/make-sci-data-figures/scripts/figure_workbench.py generate "
            f"{input_path} --group {pick(candidates, 'group')} --value {pick(candidates, 'value')} "
            f"--unit {pick(candidates, 'unit')} --design independent --order GROUP1,GROUP2 "
            "--outcome-type continuous --outdir results"
        )
    elif "relationship" in structures:
        commands.append(
            "python skills/make-sci-data-figures/scripts/data_family_workbench.py relationship "
            f"{input_path} --x {pick(candidates, 'x')} --y {pick(candidates, 'y')} "
            f"--unit {pick(candidates, 'unit')} --outdir relationship_results"
        )
    return commands


def route(args) -> int:
    frame = read_table(Path(args.input), args.sheet)
    candidates = column_candidates([str(column) for column in frame.columns])
    structures = suggest_structures(candidates)
    if not structures:
        print("[WARN] No safe route can be selected from column names alone.")
        for question in required_questions(candidates):
            print(f"- {question}")
        return 1
    print(f"[PASS] Candidate route: {structures[0]}")
    for command in next_commands(args.input, candidates)[1:]:
        print(command)
    return 0


def run_tool(label: str, command: list[str]) -> tuple[str, str]:
    completed = subprocess.run(command, cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    status = "PASS" if completed.returncode == 0 else "FAIL"
    print(f"[{status}] {label}")
    if completed.stdout.strip():
        print(completed.stdout.rstrip())
    return status, completed.stdout


def raster_check(path: Path, width_mm: float | None = None) -> str:
    from PIL import Image

    with Image.open(path) as image:
        detail = f"{image.width}x{image.height}px"
        if width_mm:
            dpi = image.width / (width_mm / 25.4)
            detail += f", effective_dpi={dpi:.1f}"
            status = "PASS" if dpi >= 300 else "FAIL"
        else:
            dpi_info = image.info.get("dpi")
            detail += f", metadata_dpi={dpi_info or 'unknown'}"
            status = "WARN" if not dpi_info else "PASS"
    print(f"[{status}] raster resolution {path}: {detail}")
    return status


def pdf_font_check(path: Path) -> str:
    tool = shutil.which("pdffonts")
    if not tool:
        print(f"[WARN] PDF font embedding {path}: pdffonts not available; manual check required")
        return "WARN"
    completed = subprocess.run([tool, str(path)], text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    if completed.returncode != 0:
        print(f"[FAIL] PDF font embedding {path}: {completed.stdout.strip()}")
        return "FAIL"
    bad = [line for line in completed.stdout.splitlines()[2:] if line.split() and "no" in line.split()]
    status = "FAIL" if bad else "PASS"
    print(f"[{status}] PDF font embedding {path}")
    if bad:
        print("\n".join(bad))
    return status


def qa(args) -> int:
    statuses: list[str] = []
    svg_files = [Path(path) for path in args.paths if Path(path).suffix.lower() == ".svg"]
    source_files = [Path(path) for path in args.paths if Path(path).suffix.lower() in {".py", ".r", ".R", ".txt", ".ps1", ".sh"}]
    for path in args.paths:
        item = Path(path)
        suffix = item.suffix.lower()
        if suffix in {".png", ".jpg", ".jpeg", ".tif", ".tiff"}:
            statuses.append(raster_check(item, args.width_mm))
        elif suffix == ".pdf":
            statuses.append(pdf_font_check(item))
    if svg_files:
        statuses.append(run_tool("SVG canvas", [sys.executable, str(POLISH / "scripts" / "check_svg_canvas.py"), *map(str, svg_files)])[0])
        statuses.append(run_tool("SVG editability", [sys.executable, str(POLISH / "scripts" / "check_svg_editability.py"), *map(str, svg_files)])[0])
        statuses.append(run_tool("SVG accessibility", [sys.executable, str(POLISH / "scripts" / "figure_accessibility_qa.py"), *map(str, svg_files)])[0])
    if source_files:
        command = [sys.executable, str(POLISH / "scripts" / "check_source_portability.py")]
        if args.strict_sources:
            command.append("--strict")
        command.extend(map(str, source_files))
        statuses.append(run_tool("source portability", command)[0])
    if not statuses:
        print("[WARN] No applicable QA route for supplied paths.")
        return 1
    print("[SUMMARY] " + ", ".join(statuses))
    return 1 if "FAIL" in statuses else 0


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description=__doc__)
    sub = root.add_subparsers(dest="command", required=True)

    item = sub.add_parser("doctor", help="Check dependencies, platform, fonts, and skill resources")
    item.add_argument("--font", default="Arial")
    item.set_defaults(func=doctor)

    item = sub.add_parser("inspect", help="Inspect CSV, TSV, or XLSX without running inference")
    item.add_argument("input")
    item.add_argument("--sheet", default=0)
    item.add_argument("--json", action="store_true")
    item.set_defaults(func=inspect_data)

    item = sub.add_parser("route", help="Suggest the existing workbench route for a table")
    item.add_argument("input")
    item.add_argument("--sheet", default=0)
    item.set_defaults(func=route)

    item = sub.add_parser("qa", help="Run applicable final figure and source QA checks")
    item.add_argument("paths", nargs="+")
    item.add_argument("--width-mm", type=float, help="final physical width for raster DPI checks")
    item.add_argument("--strict-sources", action="store_true")
    item.set_defaults(func=qa)
    return root


def main() -> int:
    args = parser().parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
