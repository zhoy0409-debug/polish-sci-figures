"""Regression coverage for portable packaging and scientific provenance boundaries."""
import hashlib
from html.parser import HTMLParser
import json
import re
import subprocess
import sys
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
        self.assertIn("connect-src https://www.ebi.ac.uk;",html)
        self.assertIn('root.StudioTiff = api',html)
        self.assertIn('async function encodeAsync(options)',html)
        self.assertIn('root.StudioCompactWhitespace=api',html)
        self.assertIn('id="compactWhitespace"',html)
        self.assertIn('function overlayInsertionGeometry(',html)
        self.assertIn('const StudioDuplicateCheck =',html)
        self.assertIn('.duplicate-dialog{',html)
        self.assertIn('id="checkImageDuplicates"',html)
        class Scripts(HTMLParser):
            def __init__(self):
                super().__init__(); self.scripts=[]; self.attributes=[]; self.active=False
            def handle_starttag(self,tag,attrs):
                if tag=='script':self.active=True; self.scripts.append('');self.attributes.append(dict(attrs))
            def handle_endtag(self,tag):
                if tag=='script':self.active=False
            def handle_data(self,data):
                if self.active:self.scripts[-1]+=data
        parsed=Scripts();parsed.feed(html)
        self.assertEqual(len(parsed.scripts),5)
        knowledge=next(i for i,attrs in enumerate(parsed.attributes) if attrs.get('id')=='chartKnowledge')
        self.assertEqual(parsed.attributes[knowledge].get('type'),'application/json')
        self.assertEqual(json.loads(parsed.scripts[knowledge])['schema_version'],'1.0.0')
        self.assertTrue(json.loads(parsed.scripts[knowledge])['charts'])
        self.assertEqual(sum(attrs.get('type')!='application/json' for attrs in parsed.attributes),1,'Only the bundled runtime may execute; knowledge remains inert JSON')
        self.assertIn('function reportHTML(',parsed.scripts[-1])
        self.assertIn('finally{document.body.inert=false;}',parsed.scripts[-1])
        with self.assertRaises(ValueError):write_html(project,out)
        self.assertEqual(self.svg.read_text(encoding='utf-8'),SIMPLE)

    def test_bundle_original_data_and_hash(self):
        self.bundle();p=build_project([self.root],'Test')
        self.assertEqual(p['panels'][0]['table']['rows'][1],['Control','1'])
        (self.root/'data.csv').write_text('group,value\nControl,100\n')
        with self.assertRaisesRegex(ValueError,'hash changed'):build_project([self.root],'Test')

    def test_default_columns_follow_panel_count_and_explicit_override(self):
        self.assertEqual(build_project([self.svg], 'Single')['initialState']['columns'], 1)
        self.assertEqual(build_project([self.svg, self.svg], 'Pair')['initialState']['columns'], 2)
        self.assertEqual(build_project([self.svg] * 3, 'Three')['initialState']['columns'], 2)
        self.assertEqual(build_project([self.svg], 'Single', columns=2)['initialState']['columns'], 2)
        self.assertEqual(build_project([self.svg] * 3, 'Three', columns=1)['initialState']['columns'], 1)
        for columns in (0, 7):
            with self.assertRaisesRegex(ValueError, 'Columns'):
                build_project([self.svg], 'Invalid', columns=columns)

    def test_explicit_initial_view_keeps_candidates_data_and_provenance(self):
        self.bundle()
        for name in ('estimation_graphic', 'raw_points_estimate_ci'):
            (self.root / (name + '.svg')).write_text(SIMPLE, encoding='utf-8')
        before = {p.name: p.read_bytes() for p in self.root.iterdir()}
        default = build_project([self.root], 'Default')['panels'][0]
        self.assertEqual(default['variants'][default['initialVariant']]['name'], 'raw_points_estimate_ci')
        project = build_project([self.root], 'Chosen', view='estimation_graphic')
        chosen = project['panels'][0]
        self.assertEqual(chosen['variants'][chosen['initialVariant']]['name'], 'estimation_graphic')
        self.assertEqual(project['initialState']['panels']['panel-0']['variant'], chosen['initialVariant'])
        self.assertEqual(chosen['recipe']['studio_view'], 'estimation_graphic')
        for key in ('variants', 'analysis', 'table'):
            self.assertEqual(chosen[key], default[key])
        self.assertEqual(before, {p.name: p.read_bytes() for p in self.root.iterdir()})
        self.assertEqual(build_project([self.svg], 'SVG', view='panel')['panels'][0]['initialVariant'], 0)
        with self.assertRaisesRegex(ValueError, 'unknown initial view.*Available views:'):
            build_project([self.root], 'Invalid', view='unknown_view')
        with self.assertRaisesRegex(ValueError, 'unknown initial view'):
            build_project([self.svg], 'Invalid SVG', view='estimation_graphic')
        # Gallery data changes and exact-size redraws must keep the chosen view.
        recipe = json.loads((self.root / 'figure_recipe.json').read_text())
        recipe.update(family='gallery', parameters={'view': 'raw_points_estimate_ci'})
        (self.root / 'figure_recipe.json').write_text(json.dumps(recipe))
        selected = build_project([self.root], 'Gallery', view='estimation_graphic')['panels'][0]
        self.assertEqual(selected['recipe']['parameters']['view'], 'estimation_graphic')

    def test_cli_initial_view_and_column_forwarding(self):
        self.bundle()
        for name in ('estimation_graphic', 'raw_points_estimate_ci'):
            (self.root / (name + '.svg')).write_text(SIMPLE, encoding='utf-8')
        root = Path(__file__).resolve().parents[3]
        unified = [sys.executable, str(root / 'sci_figures.py'), 'studio']
        direct = [sys.executable, str(Path(__file__).with_name('figure_studio.py'))]
        for index, (command, count, extra, columns) in enumerate((
                (unified, 1, [], 1), (unified, 1, ['--columns', '2'], 2),
                (unified, 2, [], 2), (unified, 2, ['--columns', '1'], 1),
                (direct, 1, [], 1))):
            output = self.root / f'cli-{index}.html'
            result = subprocess.run([*command, *([str(self.root)] * count), '--view', 'estimation_graphic',
                                     '--out', str(output), *extra], capture_output=True, text=True, encoding='utf-8')
            self.assertEqual(result.returncode, 0, result.stderr)
            payload = re.search(r'<script type="application/json" id="project">(.*?)</script>',
                                output.read_text(encoding='utf-8'), re.S)
            project = json.loads(payload.group(1))
            self.assertEqual(project['initialState']['columns'], columns)
            for panel in project['panels']:
                self.assertEqual(panel['variants'][panel['initialVariant']]['name'], 'estimation_graphic')
        output = self.root / 'unknown.html'
        result = subprocess.run([*unified, str(self.root), '--view', 'missing', '--out', str(output)],
                                capture_output=True, text=True, encoding='utf-8')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Available views:', result.stderr)
        self.assertFalse(output.exists())

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
