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
    p=subprocess.run([PYTHON,str(CLI),*map(str,args)],cwd=ROOT,text=True,encoding="utf-8",stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    if check and p.returncode: raise AssertionError(p.stdout+"\nSTDERR:\n"+p.stderr)
    return p

def main():
    for args in (("--help",),("doctor","--help"),("inspect","--help"),("route","--help"),("qa","--help")):
        assert "usage:" in run(*args).stdout.lower()
    doctor=json.loads(run("doctor","--font","DejaVu Sans","--json").stdout)
    assert doctor["schema_version"]=="1.3.2" and doctor["summary"]["exit_code"]==0
    assert all({"status","code","name","detail","path","blocking","manual_review"} <= set(x) for x in doctor["results"])
    composition=ROOT/"skills"/"make-sci-data-figures"/"examples"/"synthetic_composition.csv"
    composition_info=json.loads(run("inspect",composition,"--json").stdout)
    assert composition_info["candidate_roles"]["sample"][0]["column"]=="sample"
    assert composition_info["candidate_roles"]["category"][0]["column"]=="cell_type"
    assert composition_info["candidate_roles"]["value"][0]["column"]=="count"
    assert composition_info["candidate_structures"]==["composition"],composition_info["candidate_structures"]
    composition_route=json.loads(run("route",composition,"--structure","composition","--json").stdout)
    assert composition_route["command"] and "--category cell_type" in composition_route["command"]
    relationship=ROOT/"skills"/"make-sci-data-figures"/"examples"/"synthetic_relationship.csv"
    relationship_info=json.loads(run("inspect",relationship,"--json").stdout)
    assert "dose-response" not in relationship_info["candidate_structures"],relationship_info["candidate_structures"]
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
        route_frame=pd.DataFrame({"unit":["U1","U1","U2","U2"],"group":["A","B","A","B"],"x":[1.,2.,3.,4.],"y":[2.,3.,4.,5.],
            "time":[0.,1.,0.,1.],"value":[3.,4.,5.,6.],"sample":["S1","S1","S2","S2"],"category":["C1","C2","C1","C2"],
            "row":["R1","R1","R2","R2"],"column":["K1","K2","K1","K2"],"event":[0,1,0,1],"dose":[.1,1.,.1,1.],
            "response":[10.,12.,11.,13.],"outcome":[0,1,0,1],"score":[.1,.8,.2,.9],"term":["T1","T2","T3","T4"],
            "estimate":[1.,2.,3.,4.],"low":[.5,1.5,2.5,3.5],"high":[1.5,2.5,3.5,4.5],"bad_type":["a","b","c","d"]})
        route_path=root/"route_cases.csv"; route_frame.to_csv(route_path,index=False)
        declarations={
            "relationship":{"x":"x","y":"y","unit":"unit"}, "timecourse":{"time":"time","value":"value","group":"group","unit":"unit"},
            "composition":{"sample":"sample","category":"category","value":"value"}, "matrix":{"row":"row","column":"column","value":"value"},
            "survival":{"time":"time","event":"event","group":"group","unit":"unit"}, "dose-response":{"dose":"dose","response":"response","group":"group"},
            "roc-pr":{"outcome":"outcome","score":"score","unit":"unit"}, "supplied-results":{"term":"term","estimate":"estimate","low":"low","high":"high"},
        }
        for structure, values in declarations.items():
            args=["route",str(route_path),"--structure",structure,"--json"]
            for key,value in values.items(): args += ["--"+key,value]
            route_payload=json.loads(run(*args).stdout)
            assert route_payload["command"] and route_payload["selected_structure"]==structure,route_payload
        def routed_case(*args): return json.loads(run("route",route_path,*args,"--json",check=False).stdout)
        assert routed_case("--structure","relationship","--x","x","--y","x","--unit","unit")["results"][0]["code"]=="ROUTE_ROLE_CONFLICT"
        assert routed_case("--structure","relationship","--x","DOES_NOT_EXIST","--y","y","--unit","unit")["results"][0]["code"]=="ROUTE_COLUMN_NOT_FOUND"
        assert routed_case("--structure","relationship","--x","bad_type","--y","y","--unit","unit")["results"][0]["code"]=="ROUTE_NON_NUMERIC"
        assert routed_case("--structure","group-comparison","--group","group","--value","value","--unit","unit","--design","independent")["results"][0]["code"]=="ROUTE_INDEPENDENT_UNIT_CROSSES_GROUPS"
        assert json.loads(run("route",good_path,"--structure","group-comparison","--group","condition","--value","response","--unit","subject_id","--design","paired","--json",check=False).stdout)["results"][0]["code"]=="ROUTE_NO_VALID_PAIRS"
        for name,changes,args,code in (
            ("bad_dose",{"dose":[0.,1.,2.,3.]},("--structure","dose-response","--dose","dose","--response","response","--group","group"),"ROUTE_NONPOSITIVE_DOSE"),
            ("bad_comp",{"value":[1.,-1.,2.,3.]},("--structure","composition","--sample","sample","--category","category","--value","value"),"ROUTE_NEGATIVE_COMPOSITION"),
            ("bad_event",{"event":[0,0,0,0]},("--structure","survival","--time","time","--event","event","--group","group","--unit","unit"),"ROUTE_EVENT_NOT_BINARY"),
            ("bad_interval",{"low":[2.,1.5,2.5,3.5]},("--structure","supplied-results","--term","term","--estimate","estimate","--low","low","--high","high"),"ROUTE_INTERVAL_ORDER")):
            changed=route_frame.assign(**changes); path=root/f"{name}.csv"; changed.to_csv(path,index=False)
            result=json.loads(run("route",path,*args,"--json",check=False).stdout)
            assert result["results"][0]["code"]==code,result

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
