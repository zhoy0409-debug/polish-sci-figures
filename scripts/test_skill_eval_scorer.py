#!/usr/bin/env python3
"""Self-contained positive and negative tests for replay evaluation scoring."""
from __future__ import annotations
import json, sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from score_skill_evals import score

ROOT=Path(__file__).resolve().parents[1]
def main():
    fixture=json.loads((ROOT/"evals"/"scorer_fixture.json").read_text(encoding="utf-8"))
    assert score(fixture["evals"],fixture["valid_runs"])["summary"]["failed"]==0
    assert score(fixture["evals"],fixture["forbidden_runs"])["summary"]["failed"]==1
    cases=json.loads((ROOT/"evals"/"skill_behavior_v1_3_2.json").read_text(encoding="utf-8"))
    good=[{"id":c["id"],"triggered_skill":c["expected_skill"] if c["should_trigger"] else None,
           "output":"; ".join(c["must_do"])} for c in cases]
    assert score(cases,good)["summary"]["failed"]==0
    forbidden=[dict(x) for x in good]; forbidden[0]["output"] += "; "+cases[0]["must_not_do"][0]
    assert score(cases,forbidden)["summary"]["failed"]==1
    missed=[dict(x) for x in good]; missed[0]["triggered_skill"]=None
    assert score(cases,missed)["summary"]["failed"]==1
    wrong=[dict(x) for x in good]; wrong[0]["triggered_skill"]="polish-sci-figures"
    assert score(cases,wrong)["summary"]["failed"]==1
    print("skill eval replay scorer tests passed")
if __name__=="__main__": main()
