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
        base=Path(tmp); archive=build("v1.3.2",base/"dist")
        assert archive.name=="sci-figure-suite-v1.3.2.zip"
        with zipfile.ZipFile(archive) as handle:
            names=set(handle.namelist())
            for name in ROOT_FILES: assert name in names,name
            for skill in SKILL_NAMES: assert f"skills/{skill}/SKILL.md" in names,skill
            assert not any("__pycache__" in name or name.endswith((".pyc",".pyo")) or "/examples/" in name or name.startswith("dist/") for name in names)
            extracted=base/"suite"; handle.extractall(extracted)
        help_run=subprocess.run([sys.executable,"sci_figures.py","--help"],cwd=extracted,text=True,encoding="utf-8",stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        assert help_run.returncode==0 and "usage:" in help_run.stdout.lower(),help_run.stderr
        doctor=subprocess.run([sys.executable,"sci_figures.py","doctor","--font","DejaVu Sans","--json"],cwd=extracted,text=True,encoding="utf-8",stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        payload=json.loads(doctor.stdout); assert doctor.returncode==0 and payload["summary"]["blocking"]==0,(payload,doctor.stderr)
    print("complete release bundle tests passed")
if __name__=="__main__": main()
