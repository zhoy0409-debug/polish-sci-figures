#!/usr/bin/env python3
"""Verify the complete release archive and execute its extracted CLI."""
from __future__ import annotations
import json, py_compile, subprocess, sys, tempfile, zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"scripts"))
from build_release import ROOT_FILES, SUPPORT_FILES, SKILL_NAMES, build

def main():
    test_tmp=(ROOT/".cache/release-test-tmp").resolve()
    assert test_tmp.is_relative_to(ROOT.resolve())
    test_tmp.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(dir=test_tmp) as tmp:
        base=Path(tmp); archive=build("v1.4.2",base/"dist")
        assert archive.name=="sci-figure-suite-v1.4.2.zip"
        with zipfile.ZipFile(archive) as handle:
            names=set(handle.namelist())
            for name in (*ROOT_FILES, *SUPPORT_FILES): assert name in names,name
            for skill in SKILL_NAMES: assert f"skills/{skill}/SKILL.md" in names,skill
            for asset in ("studio.html", "studio.css", "studio.js", "i18n.js", "memory.js", "discovery.js", "library.js", "catalogue.js", "catalogue-previews.json", "gallery-contracts.js", "template-starters.json", "rich-text.js", "rich-text.css", "workspace-layout.js", "workspace-layout.css", "group-spacing.js", "tiff-export.js", "compact-whitespace.js"):
                assert f"skills/polish-sci-figures/assets/figure-studio/{asset}" in names, asset
            for module in ("studio_server.py", "studio_statistics.py", "studio_facets.py"):
                assert f"skills/polish-sci-figures/scripts/{module}" in names, module
            for module in ("gallery_registry", "gallery_workbench", "gallery_compare", "gallery_time_composition",
                           "gallery_clinical", "gallery_omics_special", "gallery_misc", "gallery_model_extras",
                           "gallery_temporal_extras", "gallery_structure_extras", "gallery_axes", "gallery_heatmap",
                           "gallery_layout", "gallery_fonts"):
                assert f"skills/make-sci-data-figures/scripts/{module}.py" in names,module
            assert not any(set(Path(name).parts)&{"__pycache__",".cache",".git",".venv","examples","dist"} or
                           (name.endswith((".pyc",".pyo",".csv",".tsv",".xlsx",".zip",".png",".jpg",".gif",".pdf")) and name not in SUPPORT_FILES) or
                           Path(name).name.startswith(".env") for name in names), "Generated/private data in source release"
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
        # Exercise the same no-source layout as the desktop resource package.
        # All source/bytecode deletion here is restricted to this temporary copy.
        assert extracted.resolve().is_relative_to(test_tmp)
        for source in extracted.rglob("*.py"):
            py_compile.compile(str(source),cfile=str(source.with_suffix(".pyc")),
                               dfile="suite/"+source.relative_to(extracted).as_posix(),doraise=True,
                               invalidation_mode=py_compile.PycInvalidationMode.UNCHECKED_HASH)
            source.unlink()
        assert not list(extracted.rglob("*.py"))
        probe=r"""
import json,sys,tempfile
from pathlib import Path
root=Path.cwd();tempfile.tempdir=str(root.parent)
sys.path[:0]=[str(root/'skills/polish-sci-figures/scripts'),str(root/'skills/make-sci-data-figures/scripts')]
import gallery_registry as registry
from studio_server import regenerate,reflow
from studio_sizes import render_sizes
assert render_sizes.__code__.co_filename.startswith('suite/'), 'Must load bytecode from packaged suite'
rows=[['group','value','unit']]+[[g,str(v),g+str(i)] for g,values in [('A',[1,2,3,4,5,2.5,3.5,4.5]),('B',[2,3,5,6,7,4.5,5.5,6.5])] for i,v in enumerate(values)]
config={'mode':'raw','group':'group','value':'value','unit':'unit','design':'independent','method':'welch','family':'all_pairs','design_confirmed':True,'unit_role':'independent_experimental_unit'}
recipe={'family':'gallery','parameters':{'view':'compare_raincloud'},'font':'DejaVu Sans'}
axes={'y_min':-6,'y_max':12,'reference_lines':[{'axis':'y','value':0,'style':'dashed','width':1,'color':'#69758b'}]}
first=regenerate(recipe,rows,statistics=config,axes=axes)
assert first['table']['rows']==rows
assert len(first['variants'])>=7
assert first['statistics']['data_sha256']==first['table']['sha256']
updated=[list(row) for row in rows];updated[1][1]='-4'
second=regenerate(first['recipe'],updated,statistics=config)
assert second['table']['rows']==updated
assert second['table']['sha256']!=first['table']['sha256']
assert second['statistics']['analysis']['primary_test']['pairwise']!=first['statistics']['analysis']['primary_test']['pairwise']
variant=reflow(second['recipe'],updated,480,320)
assert variant['width']==480 and variant['height']==320 and '<svg' in variant['svg']
assert variant['axis_controls']['settings']['y_min']==-6
legacy={'group':'group','value':'value','design':'independent','subject':'unit','order':['A','B'],'font':'DejaVu Sans'}
old=regenerate(legacy,rows)
assert any(v['name']=='bar_raw_points' for v in old['variants']), 'Legacy dynamic loader must accept .pyc'
print(json.dumps({'templates':len(registry.CONTRACTS),'gallery_variants':len(second['variants']),'legacy_variants':len(old['variants']),'replacement_and_reflow':True}))
"""
        runtime=subprocess.run([sys.executable,"-c",probe],cwd=extracted,text=True,encoding="utf-8",stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        assert runtime.returncode==0,(runtime.stdout,runtime.stderr)
        report=json.loads(runtime.stdout);assert report["templates"]>=190,report
    print("complete v1.4.2 source release, extracted CLI and bytecode runtime tests passed:",report)
if __name__=="__main__": main()
