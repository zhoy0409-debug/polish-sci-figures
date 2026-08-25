#!/usr/bin/env python3
"""Regression tests for PDF font rows and SVG CSS font declarations."""
from __future__ import annotations
import shutil, sys, tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT)); sys.path.insert(0,str(ROOT/"skills"/"polish-sci-figures"/"scripts"))
from sci_figures import parse_pdffonts, pdf_qa
from figure_accessibility_qa import audit_svg

HEADER="name type encoding emb sub uni object ID\n----------------------------------------------\n"
def main():
    one=parse_pdffonts(HEADER+"Arial Type1 WinAnsi yes no no 10 0\n")
    assert one[0]["emb"]=="yes" and one[0]["sub"]=="no" and one[0]["uni"]=="no"
    cid=parse_pdffonts(HEADER+"ELUGPM+ArialMT CID TrueType Identity-H yes yes yes 17 0\n")
    assert cid[0]["emb"]=="yes",cid
    mixed=parse_pdffonts(HEADER+"Arial Type 1 WinAnsi yes yes yes 10 0\nBad CID TrueType Identity-H no yes yes 11 0\n")
    assert [x["emb"] for x in mixed]==["yes","no"]
    for bad in ("not a header\n",HEADER+"unparseable row\n"):
        try: parse_pdffonts(bad)
        except ValueError: pass
        else: raise AssertionError("invalid pdffonts output was accepted")
    with tempfile.TemporaryDirectory() as tmp:
        root=Path(tmp)
        cases={
            "attribute":'<text font-family="Arial">A</text>',
            "inline_family":'<text style="font-family: Arial">A</text>',
            "inline_short":'<text style="font: italic 700 10.5px/1.2 \'Arial\'">A</text>',
            "fallback":'<text style="font: 10px Arial, sans-serif">A</text>',
            "class":'<style>.label { font: 10px Arial; }</style><text class="label">A</text>',
        }
        for name,body in cases.items():
            path=root/f"{name}.svg"; path.write_text(f'<svg xmlns="http://www.w3.org/2000/svg">{body}</svg>',encoding="utf-8")
            report=audit_svg(path,required_font="Arial")
            assert not any(x["code"] in {"SVG_FONT_UNDECLARED","SVG_FONT_MISMATCH"} for x in report["issues"]),(name,report)
        narrow=root/"narrow.svg"; narrow.write_text('<svg xmlns="http://www.w3.org/2000/svg"><text style="font:10px Arial Narrow">A</text></svg>',encoding="utf-8")
        assert any(x["code"]=="SVG_FONT_MISMATCH" for x in audit_svg(narrow,required_font="Arial")["issues"])
        absent=root/"absent.svg"; absent.write_text('<svg xmlns="http://www.w3.org/2000/svg"><text>A</text></svg>',encoding="utf-8")
        assert any(x["code"]=="SVG_FONT_UNDECLARED" for x in audit_svg(absent,required_font="Arial")["issues"])
    real=audit_svg(ROOT/"demo"/"workbench"/"raw_points_estimate_ci.svg",required_font="Arial")
    assert not any(x["code"] in {"SVG_FONT_UNDECLARED","SVG_FONT_MISMATCH"} for x in real["issues"]),real
    if shutil.which("pdffonts"):
        pdf_findings=pdf_qa(ROOT/"demo"/"workbench"/"raw_points_estimate_ci.pdf")
        assert pdf_findings[0]["status"]=="PASS",pdf_findings
    else:
        print("SKIP: real PDF font audit requires pdffonts")
    print("PDF and SVG QA parser tests passed")
if __name__=="__main__": main()
