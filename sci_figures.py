#!/usr/bin/env python3
"""Safe unified entry point for the SCI Figure Skills suite."""
from __future__ import annotations

import argparse, importlib, json, os, platform, re, shlex, shutil, subprocess, sys, tempfile
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
SKILLS = ROOT / "skills"
MAKE, STANDARDIZE, POLISH = (SKILLS / n for n in ("make-sci-data-figures", "standardize-sci-images", "polish-sci-figures"))
SUPPORTED_PYTHON = ((3, 10), (3, 12))
CORE = {"matplotlib": "matplotlib", "numpy": "numpy", "openpyxl": "openpyxl", "pandas": "pandas", "Pillow": "PIL", "scipy": "scipy"}
OPTIONAL = {"PyMuPDF": "fitz", "python-docx": "docx", "python-pptx": "pptx", "tifffile": "tifffile"}

def finding(status: str, code: str, name: str, detail: str, *, path: str | None = None,
            blocking: bool | None = None, manual_review: bool = False) -> dict[str, Any]:
    return {"status": status, "code": code, "name": name, "detail": detail, "path": path,
            "blocking": status in {"FAIL", "UNSAFE"} if blocking is None else blocking,
            "manual_review": manual_review}

def emit(items: list[dict[str, Any]], json_mode: bool, extra: dict[str, Any] | None = None) -> int:
    blocking = sum(bool(x["blocking"]) for x in items)
    warnings = sum(x["status"] in {"WARN", "NEEDS_CONFIRMATION", "MANUAL_REVIEW"} for x in items)
    manual = sum(bool(x["manual_review"]) for x in items)
    code = 2 if blocking else 0
    payload = {"schema_version": "1.3.1", "results": items,
               "summary": {"total": len(items), "blocking": blocking, "warnings": warnings,
                           "manual_review": manual, "exit_code": code}}
    payload.update(extra or {})
    if json_mode:
        print(json.dumps(payload, indent=2, ensure_ascii=False))
    else:
        for x in items:
            print(f"[{x['status']}] {x['name']}" + (f": {x['detail']}" if x["detail"] else ""))
        print(f"[SUMMARY] blocking={blocking}, warnings={warnings}, manual_review={manual}, exit_code={code}")
    return code

def parse_sheet(value: str | int) -> str | int:
    if isinstance(value, int): return value
    value = value.strip()
    return int(value) if re.fullmatch(r"[+-]?\d+", value) else value

def read_table(path: Path, sheet: str | int = 0):
    import pandas as pd
    if not path.is_file(): raise ValueError(f"Input file does not exist: {path}")
    suffix = path.suffix.lower()
    try:
        if suffix == ".csv": return pd.read_csv(path)
        if suffix in {".tsv", ".txt"}: return pd.read_csv(path, sep="\t")
        if suffix == ".xlsx": return pd.read_excel(path, sheet_name=parse_sheet(sheet))
        if suffix == ".xls": raise ValueError("Legacy .xls is not a tested v1.3.1 input. Convert it to .xlsx, CSV, or TSV.")
        raise ValueError(f"Unsupported input type {suffix!r}. Use CSV, TSV, or XLSX.")
    except ValueError as exc:
        if suffix == ".xlsx" and ("worksheet" in str(exc).lower() or "sheet" in str(exc).lower()):
            raise ValueError(f"Worksheet {sheet!r} was not found in {path.name}. Use a zero-based index or exact sheet name.") from None
        raise
    except Exception as exc: raise ValueError(f"Could not read {path.name}: {exc}") from None

def ensure_mpl_config() -> tuple[bool, str]:
    requested = Path(os.environ.get("MPLCONFIGDIR", ROOT / ".cache" / "matplotlib"))
    for path in (requested, Path(tempfile.gettempdir()) / "polish-sci-figures-mplconfig"):
        try:
            path.mkdir(parents=True, exist_ok=True); probe = path / ".write-test"
            probe.write_text("ok", encoding="utf-8"); probe.unlink(); os.environ["MPLCONFIGDIR"] = str(path)
            return True, str(path)
        except OSError: pass
    return False, "No writable Matplotlib cache directory is available"

def version_of(name: str) -> str:
    module = importlib.import_module(name); return str(getattr(module, "__version__", "installed"))

def doctor(args) -> int:
    items = []
    current, (low, high) = sys.version_info[:2], SUPPORTED_PYTHON
    ok = low <= current <= high
    items.append(finding("PASS" if ok else "FAIL", "PYTHON_VERSION", "Python version", platform.python_version()))
    for label, module in CORE.items():
        try: items.append(finding("PASS", "CORE_DEPENDENCY", f"core dependency {label}", version_of(module)))
        except Exception as exc: items.append(finding("FAIL", "CORE_DEPENDENCY_MISSING", f"core dependency {label}", str(exc)))
    for label, module in OPTIONAL.items():
        try: items.append(finding("PASS", "OPTIONAL_DEPENDENCY", f"optional dependency {label}", version_of(module)))
        except Exception: items.append(finding("WARN", "OPTIONAL_DEPENDENCY_MISSING", f"optional dependency {label}", "not installed", blocking=False))
    ok, detail = ensure_mpl_config(); items.append(finding("PASS" if ok else "FAIL", "MPL_CACHE", "Matplotlib writable cache", detail))
    try:
        from matplotlib import font_manager
        path = font_manager.findfont(font_manager.FontProperties(family=args.font), fallback_to_default=False)
        items.append(finding("PASS", "FONT_AVAILABLE", f"font {args.font}", path))
    except Exception as exc: items.append(finding("FAIL", "FONT_MISSING", f"font {args.font}", str(exc)))
    for code, name, commands in (("LIBREOFFICE", "LibreOffice", ("soffice", "libreoffice")),
                                 ("PDF_RENDERER", "PDF renderer", ("pdftoppm", "mutool", "gs")),
                                 ("PDF_FONTS", "pdffonts", ("pdffonts",))):
        found = next((p for c in commands if (p := shutil.which(c))), None)
        items.append(finding("PASS" if found else "WARN", code, name, found or "not found", blocking=False,
                             manual_review=(code == "PDF_FONTS" and not found)))
    for skill in (MAKE, STANDARDIZE, POLISH):
        missing = [str(p.relative_to(skill)) for p in (skill / "SKILL.md", skill / "agents" / "openai.yaml") if not p.is_file()]
        items.append(finding("PASS" if not missing else "FAIL", "SKILL_STRUCTURE", f"skill {skill.name}", "complete" if not missing else str(missing)))
    return emit(items, args.json)

def tokenize(name: str) -> list[str]:
    name = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", " ", name)
    return [x.casefold() for x in re.findall(r"[^\W_]+", name, flags=re.UNICODE)]

TOKENS = {
 "group":{"group","condition","treatment","cohort","arm","class"}, "value":{"value","response","signal","count","intensity","score","measurement","abundance"},
 "unit":{"unit","sample","subject","patient","mouse","participant","specimen","animal","id"}, "time":{"time","day","week","month","followup","visit"},
 "category":{"category","celltype","term","pathway","feature","class"}, "x":{"x","dose","exposure","concentration"}, "y":{"y","response","signal","value"},
 "row":{"row","pathway","gene","feature","term"}, "column":{"column","condition","sample","time","group"}, "event":{"event","status","death","censor"},
 "outcome":{"outcome","truth","observed","label"}, "score":{"score","probability","prediction","risk"}, "estimate":{"estimate","effect","coefficient","ratio"},
 "low":{"low","lower","lcl"}, "high":{"high","upper","ucl"}}

def column_profiles(frame) -> dict[str, dict[str, Any]]:
    out = {}; rows = len(frame)
    for raw in frame.columns:
        s, name = frame[raw], str(raw); nonmissing = int(s.notna().sum()); unique = int(s.nunique(dropna=True))
        out[name] = {"tokens": tokenize(name), "dtype": str(s.dtype), "numeric": bool(s.dtype.kind in "biufc"),
                     "missing": rows-nonmissing, "unique": unique, "unique_fraction": unique/nonmissing if nonmissing else 0.0,
                     "has_repeats": unique < nonmissing}
    return out

def role_candidates(frame) -> dict[str, list[dict[str, Any]]]:
    profiles = column_profiles(frame); out = {role: [] for role in TOKENS}
    for role, aliases in TOKENS.items():
        for column, p in profiles.items():
            matched = sorted(set(p["tokens"]) & aliases)
            if not matched: continue
            score = .62 + min(.18, .06*len(matched)); evidence = ["name token(s): " + ", ".join(matched)]
            if role == "unit":
                if p["numeric"] and matched == ["id"]: score -= .18; evidence.append("numeric ID is ambiguous")
                if p["unique_fraction"] >= .8: score += .12; evidence.append("mostly unique values")
                elif p["has_repeats"]: evidence.append("repeated values may encode repeated measures")
            elif role in {"value","x","y","time","event","score","estimate","low","high"}:
                score += .12 if p["numeric"] else -.2; evidence.append("numeric dtype" if p["numeric"] else "non-numeric dtype")
            elif role in {"group","category","row","column","outcome"} and p["has_repeats"]: score += .08; evidence.append("repeated levels")
            score = max(0., min(score, .98)); out[role].append({"column":column,"confidence":round(score,2),"evidence":evidence,"ambiguous":score<.75})
        out[role].sort(key=lambda x:(-x["confidence"],x["column"].casefold()))
    return out

REQUIRED = {"group-comparison":["group","value","unit","design"], "relationship":["x","y","unit"],
 "timecourse":["time","value","group","unit"], "composition":["sample","category","value"], "matrix":["row","column","value"],
 "survival":["time","event","group","unit"], "dose-response":["dose","response","group"], "roc-pr":["outcome","score","unit"],
 "supplied-results":["term","estimate","low","high"]}

def candidates_for_routes(c):
    mapping={"group-comparison":["group","value","unit"],"relationship":["x","y","unit"],"timecourse":["time","value","group","unit"],
             "composition":["unit","category","value"],"matrix":["row","column","value"],"survival":["time","event","group","unit"],
             "dose-response":["x","y","group"],"roc-pr":["outcome","score","unit"],"supplied-results":["row","estimate","low","high"]}
    out=[]
    for name, roles in mapping.items():
        present=[r for r in roles if c.get(r)]
        if len(present)>=max(2,len(roles)-1):
            missing=[r for r in roles if not c.get(r)]; out.append({"structure":name,"confidence":round(len(present)/len(roles),2),"evidence":present,"missing":missing,"ambiguous":bool(missing)})
    return sorted(out,key=lambda x:(-x["confidence"],x["structure"]))

def inspect_payload(path, sheet, frame):
    c=role_candidates(frame); routes=candidates_for_routes(c)
    questions=["Confirm the biological experimental-unit column.","Declare whether the design is independent, paired, repeated, nested, or technical replicate."]
    if len(routes)!=1: questions.append("Confirm which scientific structure matches the intended claim.")
    return {"file":path,"sheet":parse_sheet(sheet),"rows":int(len(frame)),"columns":column_profiles(frame),"duplicate_rows":int(frame.duplicated().sum()),
            "candidate_roles":c,"candidate_routes":routes,"candidate_structures":[r["structure"] for r in routes],
            "risks":["Column names and data profiles are suggestions, not experimental-design declarations."],"questions":questions,
            "next_step":"Run route with explicit --structure and required field/design declarations."}

def inspect_data(args):
    payload=inspect_payload(args.input,args.sheet,read_table(Path(args.input),args.sheet))
    if args.json: print(json.dumps(payload,indent=2,ensure_ascii=False))
    else:
        print(f"Rows: {payload['rows']}; duplicate rows: {payload['duplicate_rows']}")
        for r in payload["candidate_routes"]: print(f"[SUGGESTION] {r['structure']}: confidence={r['confidence']}, missing={r['missing']}")
        for q in payload["questions"]: print(f"[NEEDS_CONFIRMATION] {q}")
    return 0

def ps_quote(v): return v if re.fullmatch(r"[A-Za-z0-9_./:\\-]+",v) else "'"+v.replace("'","''")+"'"
def format_command(argv, target=None):
    target=target or ("windows" if os.name=="nt" else "posix")
    return " ".join(ps_quote(x) for x in argv) if target=="windows" else shlex.join(argv)
def top(c, role):
    items=c.get(role,[]); return items[0]["column"] if len(items)==1 and not items[0]["ambiguous"] else None

def route_argv(structure,path,f,outdir):
    if structure=="group-comparison": return ["python","skills/make-sci-data-figures/scripts/figure_workbench.py","generate",path,"--group",f["group"],"--value",f["value"],"--unit",f["unit"],"--design",f["design"],"--outcome-type","continuous","--outdir",outdir]
    if structure in {"relationship","timecourse","composition","matrix"}:
        fields={"relationship":["x","y","unit"],"timecourse":["time","value","group","unit"],"composition":["sample","category","value"],"matrix":["row","column","value"]}[structure]
        argv=["python","skills/make-sci-data-figures/scripts/data_family_workbench.py",structure,path]
    else:
        cmd="roc" if structure=="roc-pr" else "forest" if structure=="supplied-results" else structure
        fields={"survival":["time","event","group","unit"],"dose-response":["dose","response","group"],"roc-pr":["outcome","score","unit"],"supplied-results":["term","estimate","low","high"]}[structure]
        argv=["python","skills/make-sci-data-figures/scripts/advanced_template_workbench.py",cmd,path]
    for name in fields: argv += ["--"+name,f[name]]
    return argv+["--outdir",outdir]

def route(args):
    payload=inspect_payload(args.input,args.sheet,read_table(Path(args.input),args.sheet)); c=payload["candidate_roles"]
    selected=args.structure; fields={k:v for k,v in vars(args).items() if isinstance(v,str) and v}; aliases={"sample":"unit","dose":"x","response":"y","term":"row"}
    if not selected:
        routes=payload["candidate_routes"]
        selected=routes[0]["structure"] if len(routes)==1 and not routes[0]["ambiguous"] else None
    if selected:
        for name in REQUIRED[selected]:
            if name not in fields and (value:=top(c,aliases.get(name,name))): fields[name]=value
    missing=["structure"] if not selected else [x for x in REQUIRED[selected] if x not in fields]
    unsupported_design = selected == "group-comparison" and fields.get("design") in {"repeated", "nested", "technical-replicate"}
    if unsupported_design:
        items=[finding("NEEDS_CONFIRMATION","SPECIALIST_DESIGN_REQUIRED","Route selection",
                       f"Design {fields['design']!r} is declared but is not fitted by the independent/paired workbench; supply specialist results or a validated model workflow.",blocking=False)]
        argv=command=None
    elif missing: items=[finding("NEEDS_CONFIRMATION","ROUTE_FIELDS_MISSING","Route selection","Required declarations: "+", ".join(missing),blocking=False)]; argv=command=None
    else:
        argv=route_argv(selected,args.input,fields,args.outdir); command=format_command(argv,args.command_platform)
        items=[finding("CONFIRMED","ROUTE_CONFIRMED",f"Route {selected}","All required columns and scientific-design declarations are present.")]
    extra={"candidate_routes":payload["candidate_routes"],"selected_structure":selected,"missing_declarations":missing,"questions":payload["questions"],"command":command,"argv":argv}
    code=emit(items,args.json,extra)
    if not args.json: print(command or "Command template withheld until the missing declarations are confirmed.")
    return code

def parse_pdffonts(output):
    lines=[x for x in output.splitlines() if x.strip()]; idx=next((i for i,x in enumerate(lines) if "name" in x.lower() and "emb" in x.lower()),-1)
    if idx<0: raise ValueError("pdffonts output did not contain a recognizable header")
    header=lines[idx].split(); emb=next(i for i,x in enumerate(header) if x.lower()=="emb"); rows=[]
    for line in lines[idx+1:]:
        if set(line.strip())<={"-"," "}: continue
        parts=line.split()
        if len(parts)>emb: rows.append({"name":parts[0],"emb":parts[emb].lower()})
    return rows

def raster_qa(path,width):
    from PIL import Image
    with Image.open(path) as im:
        dims=f"{im.width}x{im.height}px"
        if width is None: return [finding("MANUAL_REVIEW","RASTER_PHYSICAL_SIZE_REQUIRED","Raster resolution",dims+"; pass --width-mm for effective DPI",path=str(path),blocking=False,manual_review=True)]
        dpi=im.width/(width/25.4); return [finding("PASS" if dpi>=300 else "FAIL","RASTER_EFFECTIVE_DPI","Raster resolution",f"{dims}, effective_dpi={dpi:.1f}",path=str(path))]
def pdf_qa(path):
    tool=shutil.which("pdffonts")
    if not tool: return [finding("MANUAL_REVIEW","PDF_FONTS_TOOL_MISSING","PDF font embedding","pdffonts unavailable; inspect manually",path=str(path),blocking=False,manual_review=True)]
    p=subprocess.run([tool,str(path)],text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
    if p.returncode: return [finding("FAIL","PDF_FONTS_READ_ERROR","PDF font embedding",p.stdout.strip(),path=str(path))]
    fonts=parse_pdffonts(p.stdout); bad=[x["name"] for x in fonts if x["emb"]!="yes"]
    return [finding("FAIL" if bad else "PASS","PDF_FONT_EMBEDDING","PDF font embedding","not embedded: "+", ".join(bad) if bad else f"{len(fonts)} font entries embedded",path=str(path))]

def qa(args):
    items=[]
    for raw in args.paths:
        path=Path(raw)
        if not path.is_file(): items.append(finding("FAIL","FILE_NOT_FOUND","Input file","File does not exist",path=str(path))); continue
        try:
            suffix=path.suffix.lower()
            if suffix in {".png",".jpg",".jpeg",".tif",".tiff"}: items += raster_qa(path,args.width_mm)
            elif suffix==".pdf": items += pdf_qa(path)
            elif suffix==".svg":
                for label, script in (("SVG canvas","check_svg_canvas.py"),("SVG editability","check_svg_editability.py")):
                    check=subprocess.run([sys.executable,str(POLISH/"scripts"/script),str(path)],cwd=ROOT,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
                    items.append(finding("PASS" if check.returncode==0 else "FAIL",script.replace(".py","").upper(),label,check.stdout.strip(),path=str(path)))
                cmd=[sys.executable,str(POLISH/"scripts"/"figure_accessibility_qa.py"),str(path),"--json"]+(["--font",args.font] if args.font else [])
                p=subprocess.run(cmd,cwd=ROOT,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
                try: items += json.loads(p.stdout)["results"]
                except Exception: items.append(finding("FAIL","SVG_QA_ERROR","SVG QA",p.stdout.strip(),path=str(path)))
            elif suffix in {".py",".r",".txt",".ps1",".sh"}:
                cmd=[sys.executable,str(POLISH/"scripts"/"check_source_portability.py")]+(["--strict"] if args.strict_sources else [])+[str(path),"--json"]
                p=subprocess.run(cmd,cwd=ROOT,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
                items.append(finding("PASS" if p.returncode==0 else "FAIL","SOURCE_PORTABILITY","Source portability",p.stdout.strip(),path=str(path)))
            else: items.append(finding("FAIL","UNSUPPORTED_QA_TYPE","QA input",f"Unsupported suffix {suffix!r}",path=str(path)))
        except Exception as exc: items.append(finding("FAIL","FILE_READ_ERROR","QA input",str(exc),path=str(path)))
    return emit(items,args.json)

def parser():
    root=argparse.ArgumentParser(description=__doc__); sub=root.add_subparsers(dest="command",required=True)
    p=sub.add_parser("doctor"); p.add_argument("--font",default="Arial"); p.add_argument("--json",action="store_true"); p.set_defaults(func=doctor)
    p=sub.add_parser("inspect"); p.add_argument("input"); p.add_argument("--sheet",default=0); p.add_argument("--json",action="store_true"); p.set_defaults(func=inspect_data)
    p=sub.add_parser("route"); p.add_argument("input"); p.add_argument("--sheet",default=0); p.add_argument("--json",action="store_true"); p.add_argument("--structure",choices=list(REQUIRED)); p.add_argument("--design",choices=["independent","paired","repeated","nested","technical-replicate"])
    for name in sorted(set().union(*(set(v) for v in REQUIRED.values()))-{"design"}): p.add_argument("--"+name)
    p.add_argument("--outdir",default="results"); p.add_argument("--command-platform",choices=["windows","posix"]); p.set_defaults(func=route)
    p=sub.add_parser("qa"); p.add_argument("paths",nargs="+"); p.add_argument("--width-mm",type=float); p.add_argument("--font"); p.add_argument("--strict-sources",action="store_true"); p.add_argument("--json",action="store_true"); p.set_defaults(func=qa)
    return root
def main():
    args=parser().parse_args()
    try: return args.func(args)
    except (ValueError,OSError) as exc: return emit([finding("FAIL","INPUT_ERROR","Input",str(exc))],bool(getattr(args,"json",False)))
if __name__=="__main__": raise SystemExit(main())
