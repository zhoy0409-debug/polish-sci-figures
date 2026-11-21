"""Create a local synthetic A/B/C figure and a data-bound Skill project for browser QA."""
import argparse
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--suite", type=Path, default=ROOT)
    parser.add_argument("--baseline", action="store_true")
    args = parser.parse_args()
    out, suite = args.out.resolve(), args.suite.resolve()
    out.mkdir(parents=True, exist_ok=False)
    sys.path.insert(0, str(suite / "skills/polish-sci-figures/scripts"))
    from figure_studio import build_project, write_html

    panels = []
    for index, color in enumerate(("#225e8c", "#99574e", "#367260")):
        path = out / f"panel-{index}.svg"
        path.write_text(
            '<svg xmlns="http://www.w3.org/2000/svg" width="195pt" height="126pt" viewBox="0 0 195 126">'
            '<rect x="14" y="30" width="158" height="74" stroke="#c0c6c9" fill="#fff"/>'
            f'<rect x="48" y="61" width="24" height="35" fill="{color}"/>'
            '<rect x="105" y="46" width="24" height="50" fill="#828f9a"/>'
            f'<text x="27" y="108" font-size="8" fill="#222">Synthetic · panel {index + 1}</text></svg>',
            encoding="utf-8",
        )
        panels.append(path)
    project = build_project(panels, "Canvas interaction", 3, False, None)
    for i, panel in enumerate(project["initialState"]["panels"].values()):
        panel["label"] = {"text": "ABC"[i], "x": 12, "y": [29, 48, 64][i],
                          "size": [13, 23, 17][i], "font": "Arial", "bold": True, "color": "#20242A"}
    write_html(project, out / "canvas.html")
    payload = {"project": project, "state": project["initialState"], "checkpoints": [], "dataDrafts": {}}
    (out / "canvas-project.json").write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    if args.baseline:
        return
    data = out / "synthetic.csv"
    data.write_text("group,value,unit\nA,1.1,a1\nA,2.3,a2\nA,3.6,a3\nA,4.2,a4\n"
                    "B,2.1,b1\nB,3.7,b2\nB,4.9,b3\nB,5.2,b4\n", encoding="utf-8", newline="\n")
    bundle = out / "bundle"
    subprocess.run([sys.executable, str(suite / "skills/make-sci-data-figures/scripts/gallery_cli.py"),
                    "--view", "compare_box_points", "--input", str(data), "--out", str(bundle)],
                   cwd=suite, check=True)
    subprocess.run([sys.executable, str(suite / "sci_figures.py"), "studio", str(bundle),
                    *map(str, panels[1:]), "--columns", "3", "--project-out", str(out / "skill-project.json")],
                   cwd=suite, check=True)


if __name__ == "__main__":
    main()
