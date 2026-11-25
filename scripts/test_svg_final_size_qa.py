#!/usr/bin/env python3
"""Final-size SVG audit: geometry, colour, notation and parity with the editor."""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "skills" / "polish-sci-figures" / "scripts"))
import svg_final_size_qa as qa  # noqa: E402

NS = 'xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"'
TEXTS = ["MIC50 (ug/mL)", "log2 fold change", "log10(CFU)", "CO2", "cm^2", "10^-4", "1e-05", "2.5E+3", "3 x 10^5", "P<0.05", "n=12",
         "+/-", ">=2", "-5", "mean - SD", "um", "5 um", "fullum", "IC50", "VIC50", "log2.5", "x10 dose", "e-cadherin", "1e",
         "ctrl^{-1}", "R=0.9", "pH=7", "Group A", "p=.03", "blaKPC-2", "ST11", "H2O2 2 mM", "CTX-M-15", "10", "1.0"]
# Intended results, independent of either implementation.
EXPECTED = {"MIC50 (ug/mL)": "MIC₅₀ (µg/mL)", "log2 fold change": "log₂ fold change", "cm^2": "cm²", "10^-4": "10⁻⁴", "1e-05": "1 × 10⁻⁵",
            "3 x 10^5": "3 × 10⁵", "P<0.05": "P < 0.05", ">=2": "≥2", "-5": "−5", "5 um": "5 µm", "fullum": "fullum", "VIC50": "VIC50",
            "log2.5": "log2.5", "e-cadherin": "e-cadherin", "pH=7": "pH=7", "blaKPC-2": "blaKPC-2", "CTX-M-15": "CTX-M-15",
            "H2O2 2 mM": "H₂O₂ 2 mM", "ctrl^{-1}": "ctrl⁻¹"}
# Published CIEDE2000 reference pairs (Sharma, Wu & Dalal 2005).
DELTA_E = [((50, 2.6772, -79.7751), (50, 0, -82.7485), 2.0425), ((50, -1, 2), (50, 0, 0), 2.3669),
           ((50, 2.5, 0), (73, 25, -18), 27.1492), ((2.0776, 0.0795, -1.135), (0.9033, -0.0636, -0.5514), 0.9082),
           ((60.2574, -34.0099, 36.2677), (60.4626, -34.1751, 39.4387), 1.2644), ((50, 2.5, 0), (50, 0, -2.5), 4.3065)]


def main() -> int:
    for a, b, expected in DELTA_E:
        assert abs(qa.delta_e(a, b) - expected) < 1e-4, (a, b, qa.delta_e(a, b))
    for source, expected in EXPECTED.items():
        assert qa.suggest_notation(source)[0] == expected, (source, qa.suggest_notation(source))
    for source in TEXTS:  # Idempotent: a fixed label is never flagged again.
        once = qa.suggest_notation(source)[0]
        assert qa.suggest_notation(once) == (once, []), (source, once, qa.suggest_notation(once))
    assert qa.suggest_notation("CO2", plain=False) == ("CO2", [])
    assert qa.parse_color("rgb(0, 114, 178)") == "#0072b2" and qa.parse_color("#abc") == "#aabbcc"
    assert qa.parse_color("rgba(1,2,3,0)") is None and qa.parse_color("none") is None
    okabe = ["#e69f00", "#56b4e9", "#009e73", "#0072b2", "#d55e00"]
    assert not [c for c in qa.color_conflicts(okabe)[0] if c["vision"] in {"protan", "deutan"}]
    assert any(c["vision"] == "deutan" for c in qa.color_conflicts(["#c44e52", "#7f7a2e", "#333333"])[0]) or \
        any(c["vision"] == "protan" for c in qa.color_conflicts(["#a52a2a", "#4d5a00"])[0])
    assert qa.color_conflicts([f"#{i:02x}00ff" for i in range(0, 250, 8)]) == ([], False)

    with tempfile.TemporaryDirectory(prefix="图形 ") as tmp:
        folder = Path(tmp)

        def audit(body, attrs='width="100mm" height="50mm" viewBox="0 0 1000 500"', **kw):
            path = folder / "图.svg"
            path.write_text(f"<svg {NS} {attrs}>{body}</svg>", encoding="utf-8")
            report = qa.audit(path, **kw)
            return {i["code"]: i for i in report["issues"]}, report

        # 1000 units = 100 mm, so 1 unit = 0.2835 pt. 30 units = 8.5 pt.
        issues, _ = audit('<text x="50" y="100" font-size="30">Fine</text>')
        assert not issues, issues
        issues, _ = audit('<g transform="scale(.5)"><text x="50" y="100" font-size="30">Small</text></g>')
        assert issues["TEXT_TOO_SMALL"]["severity"] == "WARN" and "4.3 pt" in issues["TEXT_TOO_SMALL"]["message"]
        issues, _ = audit('<text x="50" y="100" font-size="30">Fine</text>', width_mm=40, min_text_pt=6)
        assert issues["TEXT_TOO_SMALL"]["severity"] == "FAIL"
        issues, _ = audit('<style>.a{font:12px "Times New Roman"} text{font-size:30px}</style><text class="a" x="9" y="90">Tiny</text>')
        assert "TEXT_TOO_SMALL" in issues  # Class beats element selector.
        issues, _ = audit('<svg x="100" y="0" width="200" height="200" viewBox="0 0 800 800"><text x="9" y="400" font-size="60">Nested</text></svg>')
        assert "4.3 pt" in issues["TEXT_TOO_SMALL"]["message"]
        issues, _ = audit('<text x="50" y="100" font-size="30">Overlap one</text><text x="60" y="104" font-size="30">Overlap two</text>')
        assert issues["TEXT_OVERLAP"]["count"] == 1
        # Parallel rotated ticks intersect only as bounding boxes.
        ticks = "".join(f'<text transform="translate({100 + 60 * i} 400) rotate(-45)" font-size="30">Condition {i}</text>' for i in range(6))
        assert "TEXT_OVERLAP" not in audit(ticks)[0]
        assert "TEXT_OUTSIDE_CANVAS" in audit('<text x="980" y="100" font-size="30">Clipped label</text>')[0]
        issues, _ = audit('<path d="M0 0h9" stroke="rgb(0,0,0)" stroke-width="0.5"/>')
        assert "0.14 pt" in issues["LINE_TOO_THIN"]["message"]
        issues, report = audit('<defs><path id="m" d="M0 0h3" style="stroke:#0072b2;stroke-width:.5"/></defs><use xlink:href="#m" x="9" y="9"/>')
        assert issues["LINE_TOO_THIN"]["count"] == 1 and "#0072b2" in report["colors"]
        assert "LINE_TOO_THIN" not in audit('<g display="none"><path d="M0 0h9" stroke="#000" stroke-width="0.1"/></g>')[0]
        issues, _ = audit('<text x="9" y="90" font-size="30" font-family="Arial">A</text><text x="9" y="200" font-size="30" font-family="Times New Roman">B</text>')
        assert "MIXED_FONT_FAMILIES" in issues
        assert "LOW_TEXT_CONTRAST" in audit('<text x="9" y="90" font-size="30" fill="#ccc">Faint</text>')[0]
        issues, _ = audit('<rect width="9" height="9" fill="#376795"/><rect width="9" height="9" fill="rgb(183,34,48)"/>')
        assert set(issues) == {"COLOR_MERGES_GRAYSCALE"}, issues
        assert "FINAL_SIZE_UNDECLARED" in audit("", attrs='viewBox="0 0 100 50"')[0]
        for bad in ("<svg", "<p/>"):
            path = folder / "bad.svg"
            path.write_text(bad, encoding="utf-8")
            assert qa.main([str(path), "--json"]) == 2
        cli = subprocess.run([sys.executable, "-X", "utf8", str(ROOT / "sci_figures.py"), "qa", str(folder / "图.svg"), "--width-mm", "30",
                              "--min-text-pt", "6", "--json"], capture_output=True, text=True, encoding="utf-8")
        codes = {r["code"] for r in json.loads(cli.stdout)["results"]}
        assert "FINAL_SIZE_UNDECLARED" not in codes and "SVG_FINAL_SIZE" in codes, codes

    node = shutil.which("node")
    if node:
        module = ROOT / "skills/polish-sci-figures/assets/figure-studio/figure-quality.js"
        colors = okabe + ["#376795", "#b72230", "#6fa6a0", "#d6a84b", "#ff0000", "#008000", "#333333"]
        script = ("const q=require(process.argv[1]),[texts,colors]=JSON.parse(process.argv[2]);process.stdout.write(JSON.stringify("
                  "{notation:texts.map(t=>[q.suggestNotation(t),q.suggestNotation(t,false)]),colors:q.colorConflicts(colors)}))")
        result = subprocess.run([node, "-e", script, str(module), json.dumps([TEXTS, colors])], capture_output=True, text=True, encoding="utf-8", check=True)
        editor = json.loads(result.stdout)
        for source, (plain, rich) in zip(TEXTS, editor["notation"]):
            assert (plain["text"], plain["codes"]) == qa.suggest_notation(source), source
            assert (rich["text"], rich["codes"]) == qa.suggest_notation(source, False), source
        key = lambda c: (c["first"], c["second"], c["vision"])
        python = {key(c): c["simulated"] for c in qa.color_conflicts(colors)[0]}
        browser = {key(c): c["simulated"] for c in editor["colors"]["conflicts"]}
        assert python.keys() == browser.keys() and all(abs(python[k] - browser[k]) <= 0.11 for k in python), (python, browser)
    print("PASS final-size geometry, colour separation, notation and editor parity" + ("" if node else " (editor parity skipped: no Node.js)"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
