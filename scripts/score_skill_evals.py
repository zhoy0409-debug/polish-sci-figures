#!/usr/bin/env python3
"""Score replayed Skill runs without pretending a live Codex evaluation ran."""
from __future__ import annotations
import argparse, json
from pathlib import Path

def score(evals: list[dict], runs: list[dict]) -> dict:
    by_id={run["id"]:run for run in runs}; cases=[]
    for case in evals:
        run=by_id.get(case["id"]); reasons=[]
        if run is None: reasons.append("captured run missing"); output=""; triggered=None
        else: output=str(run.get("output","")).casefold(); triggered=run.get("triggered_skill")
        expected=case.get("expected_skill") if case["should_trigger"] else None
        if triggered != expected: reasons.append(f"triggered_skill={triggered!r}, expected={expected!r}")
        for phrase in case["must_do"]:
            if phrase.casefold() not in output: reasons.append(f"missing required behavior: {phrase}")
        for phrase in case["must_not_do"]:
            if phrase.casefold() in output: reasons.append(f"forbidden behavior present: {phrase}")
        cases.append({"id":case["id"],"passed":not reasons,"reasons":reasons})
    passed=sum(x["passed"] for x in cases)
    return {"schema_version":"1.3.1","mode":"replay","live_eval_run":False,"cases":cases,
            "summary":{"total":len(cases),"passed":passed,"failed":len(cases)-passed,
                       "score":passed/len(cases) if cases else 0.0}}

def main() -> int:
    p=argparse.ArgumentParser(description=__doc__); p.add_argument("runs"); p.add_argument("--evals",default="evals/skill_behavior_v1_3_1.json"); p.add_argument("--report")
    a=p.parse_args(); report=score(json.loads(Path(a.evals).read_text(encoding="utf-8")),json.loads(Path(a.runs).read_text(encoding="utf-8")))
    text=json.dumps(report,indent=2,ensure_ascii=False); print(text)
    if a.report: Path(a.report).write_text(text+"\n",encoding="utf-8")
    return 1 if report["summary"]["failed"] else 0
if __name__=="__main__": raise SystemExit(main())
