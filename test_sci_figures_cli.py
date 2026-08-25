#!/usr/bin/env python3
"""Behavioral regression tests for the unified safe CLI."""
from __future__ import annotations
import json, subprocess, sys
from pathlib import Path
from tempfile import TemporaryDirectory
import pandas as pd
import sci_figures as sf

ROOT=Path(__file__).resolve().parent; CLI=ROOT/"sci_figures.py"; PYTHON=sys.executable
def run(*args, check=True):
    p=subprocess.run([PYTHON,str(CLI),*map(str,args)],cwd=ROOT,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
    if check and p.returncode: raise AssertionError(p.stdout)
    return p

def main():
    for args in (("--help",),("doctor","--help"),("inspect","--help"),("route","--help"),("qa","--help")):
        assert "usage:" in run(*args).stdout.lower()
    doctor=json.loads(run("doctor","--font","DejaVu Sans","--json").stdout)
    assert doctor["schema_version"]=="1.3.1" and doctor["summary"]["exit_code"]==0
    assert all({"status","code","name","detail","path","blocking","manual_review"} <= set(x) for x in doctor["results"])
    with TemporaryDirectory() as tmp:
        root=Path(tmp); special=root/"中文 data (final).csv"
        frame=pd.DataFrame({"lipid_level":[1.,2.,3.,4.],"width":[3.,4.,5.,6.],"candidate_score":[.1,.2,.3,.4],
                            "condition":["A","A","B","B"],"response":[1.,2.,3.,4.]})
        frame.to_csv(special,index=False)
        payload=json.loads(run("inspect",special,"--json").stdout)
        units=[x["column"] for x in payload["candidate_roles"]["unit"]]
        assert not ({"lipid_level","width","candidate_score"}&set(units)), units
        routed=json.loads(run("route",special,"--json").stdout)
        assert routed["summary"]["exit_code"]==0 and routed["command"] is None
        assert "structure" in routed["missing_declarations"]
        assert "--design independent" not in json.dumps(routed)
        explicit=json.loads(run("route",special,"--structure","group-comparison","--json").stdout)
        assert {"unit","design"} <= set(explicit["missing_declarations"])

        good=pd.DataFrame({"subject_id":["S1","S2","S3","S4"],"condition":["A","A","B","B"],"response":[1.,2.,3.,4.]})
        good_path=root/"patient data (中文).csv"; good.to_csv(good_path,index=False)
        inspected=json.loads(run("inspect",good_path,"--json").stdout)
        assert inspected["candidate_roles"]["unit"][0]["column"]=="subject_id"
        no_design=json.loads(run("route",good_path,"--structure","group-comparison","--json").stdout)
        assert no_design["command"] is None and "design" in no_design["missing_declarations"]
        confirmed=json.loads(run("route",good_path,"--structure","group-comparison","--design","independent","--json").stdout)
        assert confirmed["command"] and confirmed["argv"][3]==str(good_path)
        repeated=json.loads(run("route",good_path,"--structure","group-comparison","--design","repeated","--json").stdout)
        assert repeated["command"] is None and repeated["results"][0]["code"]=="SPECIALIST_DESIGN_REQUIRED"
        assert "'" in sf.format_command(confirmed["argv"],"posix") and "'" in sf.format_command(confirmed["argv"],"windows")
        declarations={
            "relationship":{"x":"response","y":"response","unit":"subject_id"},
            "timecourse":{"time":"response","value":"response","group":"condition","unit":"subject_id"},
            "composition":{"sample":"subject_id","category":"condition","value":"response"},
            "matrix":{"row":"condition","column":"subject_id","value":"response"},
            "survival":{"time":"response","event":"response","group":"condition","unit":"subject_id"},
            "dose-response":{"dose":"response","response":"response","group":"condition"},
            "roc-pr":{"outcome":"condition","score":"response","unit":"subject_id"},
            "supplied-results":{"term":"condition","estimate":"response","low":"response","high":"response"},
        }
        for structure, values in declarations.items():
            args=["route",str(good_path),"--structure",structure,"--json"]
            for key,value in values.items(): args += ["--"+key,value]
            route_payload=json.loads(run(*args).stdout)
            assert route_payload["command"] and route_payload["selected_structure"]==structure,route_payload

        xlsx=root/"multi sheet 中文.xlsx"
        with pd.ExcelWriter(xlsx) as writer:
            good.to_excel(writer,sheet_name="First",index=False); frame.to_excel(writer,sheet_name="数据 二",index=False)
        assert json.loads(run("inspect",xlsx,"--sheet","0","--json").stdout)["rows"]==4
        named=json.loads(run("inspect",xlsx,"--sheet","数据 二","--json").stdout); assert "lipid_level" in named["columns"]
        missing=run("inspect",xlsx,"--sheet","99","--json",check=False); assert missing.returncode==2
        assert json.loads(missing.stdout)["results"][0]["code"]=="INPUT_ERROR"

        svg=root/"figure.svg"; svg.write_text('<svg xmlns="http://www.w3.org/2000/svg" width="50mm" height="30mm" viewBox="0 0 500 300"><text style="font-family:Arial">Live</text></svg>',encoding="utf-8")
        qa=json.loads(run("qa",svg,"--font","Arial","--json").stdout); assert qa["summary"]["manual_review"]>=1
        broken=root/"broken.svg"; broken.write_text("<svg>",encoding="utf-8")
        bad=run("qa",broken,"--json",check=False); assert bad.returncode==2 and json.loads(bad.stdout)["results"][0]["status"]=="FAIL"
        unsupported=root/"x.bin"; unsupported.write_bytes(b"x")
        assert json.loads(run("qa",unsupported,"--json",check=False).stdout)["results"][0]["code"]=="UNSUPPORTED_QA_TYPE"

    sample="name type encoding emb sub uni object ID\n----------------------------------------------\nArial TrueType WinAnsi yes no no 10 0\nBadFont Type1 Custom no yes no 11 0\n"
    fonts=sf.parse_pdffonts(sample); assert fonts[0]["emb"]=="yes" and fonts[1]["emb"]=="no"
    print("sci_figures.py behavioral tests passed")
if __name__=="__main__": main()
