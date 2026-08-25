#!/usr/bin/env python3
"""Score captured Skill runs; this never claims that a live model was run."""
from __future__ import annotations
import argparse, json, re
from pathlib import Path
from typing import Any

def match_rule(output: str, rule: Any) -> tuple[bool,str]:
    if isinstance(rule,str):
        ok=rule.casefold() in output.casefold(); return ok,f"literal:{rule}"
    if isinstance(rule,dict) and isinstance(rule.get("regex"),str):
        ok=re.search(rule["regex"],output,re.I|re.M) is not None; return ok,f"regex:{rule['regex']}"
    if isinstance(rule,dict) and isinstance(rule.get("any"),list) and rule["any"]:
        matched=[str(x) for x in rule["any"] if str(x).casefold() in output.casefold()]
        return bool(matched),"synonym:"+(matched[0] if matched else "|".join(map(str,rule["any"])))
    raise ValueError(f"invalid eval rule: {rule!r}")

def score(evals:list[dict],runs:list[dict])->dict:
    by_id={run["id"]:run for run in runs}; results=[]
    for case in evals:
        run=by_id.get(case["id"]); reasons=[]; evidence=[]
        raw_output="" if run is None else str(run.get("output","")); triggered=None if run is None else run.get("triggered_skill")
        if run is None: reasons.append("captured run missing")
        expected=case.get("expected_skill") if case["should_trigger"] else None
        if triggered!=expected: reasons.append(f"triggered_skill={triggered!r}, expected={expected!r}")
        required_all=[*case.get("must_do",[]),*case.get("required_all",[])]
        required_any=case.get("required_any",[])
        forbidden=[*case.get("must_not_do",[]),*case.get("forbidden_any",[])]
        for rule in required_all:
            ok,detail=match_rule(raw_output,rule)
            if ok: evidence.append({"kind":"required","rule":rule,"match":detail})
            else: reasons.append(f"missing required behavior: {detail}")
        if required_any:
            matches=[(rule,match_rule(raw_output,rule)) for rule in required_any]
            if not any(value[0] for _,value in matches): reasons.append("none of required_any matched")
            else:
                rule,value=next((rule,value) for rule,value in matches if value[0]); evidence.append({"kind":"required_any","rule":rule,"match":value[1]})
        for rule in forbidden:
            ok,detail=match_rule(raw_output,rule)
            if ok: reasons.append(f"forbidden behavior present: {detail}"); evidence.append({"kind":"forbidden","rule":rule,"match":detail})
        results.append({"id":case["id"],"passed":not reasons,"triggered_skill":triggered,"expected_skill":expected,
                        "raw_output":raw_output,"evidence":evidence,"reasons":reasons})
    passed=sum(x["passed"] for x in results)
    return {"schema_version":"1.3.3","mode":"replay","live_eval_run":False,"cases":results,
            "summary":{"total":len(results),"passed":passed,"failed":len(results)-passed,"score":passed/len(results) if results else 0.0}}

def main()->int:
    p=argparse.ArgumentParser(description=__doc__); p.add_argument("runs"); p.add_argument("--evals",default="evals/skill_behavior_v1_3_3.json"); p.add_argument("--report")
    a=p.parse_args(); report=score(json.loads(Path(a.evals).read_text(encoding="utf-8")),json.loads(Path(a.runs).read_text(encoding="utf-8")))
    text=json.dumps(report,indent=2,ensure_ascii=False); print(text)
    if a.report: Path(a.report).write_text(text+"\n",encoding="utf-8")
    return 1 if report["summary"]["failed"] else 0
if __name__=="__main__": raise SystemExit(main())
