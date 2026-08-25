#!/usr/bin/env python3
"""Regression test for an unusable preconfigured Matplotlib cache."""
from __future__ import annotations
import os, subprocess, sys, tempfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
def main():
    with tempfile.TemporaryDirectory() as tmp:
        blocked=Path(tmp)/"not-a-directory"; blocked.write_text("blocked",encoding="utf-8")
        env=dict(os.environ); env["MPLCONFIGDIR"]=str(blocked)
        scripts=[ROOT/"skills"/"make-sci-data-figures"/"scripts"/"figure_workbench.py",
                 ROOT/"skills"/"make-sci-data-figures"/"scripts"/"data_family_workbench.py",
                 ROOT/"skills"/"make-sci-data-figures"/"scripts"/"advanced_template_workbench.py",
                 ROOT/"skills"/"standardize-sci-images"/"scripts"/"standardize_images.py"]
        for script in scripts:
            p=subprocess.run([sys.executable,str(script),"--help"],cwd=ROOT,env=env,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
            assert p.returncode==0,(script,p.stdout)
            assert "temporary cache directory" not in p.stdout.lower(),p.stdout
        qa_test=ROOT/"skills"/"polish-sci-figures"/"scripts"/"test_figure_text_qa.py"
        p=subprocess.run([sys.executable,str(qa_test)],cwd=ROOT,env=env,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
        assert p.returncode==0,p.stdout
        assert "temporary cache directory" not in p.stdout.lower(),p.stdout
    print("Matplotlib runtime environment tests passed")
if __name__=="__main__": main()
