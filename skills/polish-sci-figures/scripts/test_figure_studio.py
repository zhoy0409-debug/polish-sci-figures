"""Regression coverage for portable packaging and scientific provenance boundaries."""
import hashlib
import json
from pathlib import Path
import tempfile
import unittest

from figure_studio import build_project, write_html

SIMPLE = '<svg xmlns="http://www.w3.org/2000/svg" width="100pt" height="80pt" viewBox="0 0 100 80"><text x="5" y="10">P &lt; 0.05</text></svg>'


class StudioTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.svg = self.root / 'panel.svg'
        self.svg.write_text(SIMPLE, encoding='utf-8')

    def bundle(self):
        (self.root/'figure_recipe.json').write_text(json.dumps({'input':'data.csv'}))
        source = b'group,value\nControl,1\nTreatment,2\n'
        (self.root/'data.csv').write_bytes(source)
        (self.root/'analysis_plan.json').write_text(json.dumps({'source_sha256':hashlib.sha256(source).hexdigest()}))

    def test_self_contained_script_escape_and_no_overwrite(self):
        project=build_project([self.svg], '</script><script>alert(1)</script>')
        out=self.root/'studio.html';write_html(project,out)
        html=out.read_text(encoding='utf-8')
        self.assertNotIn('</script><script>alert(1)</script>',html)
        self.assertIn('\\u003c/script>',html)
        self.assertNotIn('/*__STUDIO_',html)
        self.assertNotIn('__STUDIO_PROJECT__',html)
        self.assertIn("connect-src 'none'",html)
        with self.assertRaises(ValueError):write_html(project,out)
        self.assertEqual(self.svg.read_text(encoding='utf-8'),SIMPLE)

    def test_bundle_original_data_and_hash(self):
        self.bundle();p=build_project([self.root],'Test')
        self.assertEqual(p['panels'][0]['table']['rows'][1],['Control','1'])
        (self.root/'data.csv').write_text('group,value\nControl,100\n')
        with self.assertRaisesRegex(ValueError,'hash changed'):build_project([self.root],'Test')

    def test_candidate_canvas_mismatch_rejected(self):
        self.bundle();(self.root/'wide.svg').write_text(SIMPLE.replace('100','120'))
        with self.assertRaisesRegex(ValueError,'canvases differ'):build_project([self.root],'Test')

    def test_directory_without_provenance_rejected(self):
        with self.assertRaisesRegex(ValueError,'figure_recipe'):build_project([self.root],'Test')

    def test_physical_units_and_entity_rejection(self):
        self.svg.write_text(SIMPLE.replace('100pt','35.2777777778mm').replace('80pt','28.2222222222mm'))
        p=build_project([self.svg],'Test');self.assertAlmostEqual(p['panels'][0]['variants'][0]['width'],100)
        self.svg.write_text('<!DOCTYPE svg [<!ENTITY a "x">]>'+SIMPLE)
        with self.assertRaisesRegex(ValueError,'entity'):build_project([self.svg],'Test')

    def test_identity_stable_and_input_not_mutated(self):
        first=build_project([self.svg],'A');second=build_project([self.svg],'A')
        self.assertEqual(first['id'],second['id'])
        self.assertNotEqual(first['id'],build_project([self.svg],'B')['id'])
        self.assertEqual(first['panels'][0]['variants'][0]['svg'],SIMPLE)

    def test_real_size_redraws_preserve_sources_and_analysis(self):
        import importlib.util
        workbench = Path(__file__).resolve().parents[2]/'make-sci-data-figures/scripts/figure_workbench.py'
        spec=importlib.util.spec_from_file_location('test_studio_workbench',workbench)
        wb=importlib.util.module_from_spec(spec);spec.loader.exec_module(wb)
        source=workbench.parent.parent/'examples/synthetic_group_comparison.csv'
        bundle=self.root/'bundle'
        wb.generate(source,'condition','Response','independent',bundle,subject='sample_id',order_text='Control,Treatment',font_requested='DejaVu Sans')
        before={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in bundle.iterdir() if p.is_file()}
        original=json.loads((bundle/'analysis_plan.json').read_text(encoding='utf-8'))
        project=build_project([bundle],'Layout',with_layouts=True)
        pan=project['panels'][0]
        self.assertEqual(pan['analysis'],original)
        self.assertEqual(before,{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in bundle.iterdir() if p.is_file()})
        points=[v for v in pan['variants'] if v['name']=='raw_points_estimate_ci']
        self.assertEqual({v['size'] for v in points},{'original','portrait','wide','spanWide','spanThree','spanTall','large'})
        self.assertEqual(len({v['sha256'] for v in points}),7)
        for v in points:
            self.assertIn('<text',v['svg'])
            ratios={'spanThree':(14.4+1/3)/3.6,'original':4/3,'portrait':3/4,'wide':2,'spanWide':(9.6+1/6)/3.6,'spanTall':4.8/(7.2+1/6),'large':(9.6+1/6)/(7.2+1/6)}
            self.assertAlmostEqual(v['width']/v['height'],ratios[v['size']])


if __name__=='__main__':unittest.main()
