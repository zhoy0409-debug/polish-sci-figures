#!/usr/bin/env python3
"""Verify the complete release archive and execute its extracted CLI."""
from __future__ import annotations
import json, subprocess, sys, tempfile, zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"scripts"))
from build_release import ROOT_FILES, SKILL_NAMES, build

def main():
    with tempfile.TemporaryDirectory() as tmp:
        base=Path(tmp); archive=build("v1.3.3",base/"dist")
        assert archive.name=="sci-figure-suite-v1.3.3.zip"
        with zipfile.ZipFile(archive) as handle:
            names=set(handle.namelist())
            for name in ROOT_FILES: assert name in names,name
            for skill in SKILL_NAMES: assert f"skills/{skill}/SKILL.md" in names,skill
            for asset in ("studio.html", "studio.css", "studio.js", "i18n.js", "memory.js", "discovery.js", "library.js", "catalogue.js", "catalogue-previews.json"):
                assert f"skills/polish-sci-figures/assets/figure-studio/{asset}" in names, asset
            assert not any("__pycache__" in name or name.endswith((".pyc",".pyo")) or "/examples/" in name or name.startswith("dist/") for name in names)
            extracted=base/"suite"; handle.extractall(extracted)
        help_run=subprocess.run([sys.executable,"sci_figures.py","--help"],cwd=extracted,text=True,encoding="utf-8",stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        assert help_run.returncode==0 and "usage:" in help_run.stdout.lower(),help_run.stderr
        sample=base/"sample.svg"
        sample.write_text('<svg xmlns="http://www.w3.org/2000/svg" width="100pt" height="80pt" viewBox="0 0 100 80"><text x="5" y="15">Response</text></svg>', encoding="utf-8")
        studio=subprocess.run([sys.executable,"sci_figures.py","studio",str(sample.resolve()),"--out",str((base/"studio.html").resolve())],cwd=extracted,text=True,encoding="utf-8",stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        assert studio.returncode==0,studio.stderr
        assert "figure-studio/1" in (base/"studio.html").read_text(encoding="utf-8")
        doctor=subprocess.run([sys.executable,"sci_figures.py","doctor","--font","DejaVu Sans","--json"],cwd=extracted,text=True,encoding="utf-8",stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        payload=json.loads(doctor.stdout); assert doctor.returncode==0 and payload["summary"]["blocking"]==0,(payload,doctor.stderr)
    print("complete release bundle tests passed")
if __name__=="__main__": main()
