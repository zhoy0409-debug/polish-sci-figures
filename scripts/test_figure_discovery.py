"""Real existing renderers, CLI imports, XLSX import and versioned registry checks."""
from pathlib import Path
import base64, io, json, subprocess, sys, tempfile, unittest
ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/'skills/make-sci-data-figures/scripts'),str(ROOT/'skills/polish-sci-figures/scripts'),str(ROOT/'scripts')]
from figure_discovery import discover
from studio_server import regenerate
from studio_discovery import import_table
from build_discovery_registry import build

class DiscoveryTests(unittest.TestCase):
    def test_preserve_ids_and_reject_duplicate_headers(self):
        sys.path.insert(0,str(ROOT));from sci_figures import read_table
        with tempfile.TemporaryDirectory() as tmp:
            source=Path(tmp)/'measurements.csv'
            source.write_text('unit,value\n001,1.2300\n002,2.1\n',encoding='utf-8')
            frame=read_table(source,preserve_text=True)
            self.assertEqual(frame.iloc[0].tolist(),['001','1.2300'])
            source.write_text('unit,unit\n001,1.2\n',encoding='utf-8')
            with self.assertRaises(ValueError):read_table(source,preserve_text=True)

    def test_registry_reproducible(self):
        actual=json.loads((ROOT/'skills/polish-sci-figures/assets/figure-studio/chart-knowledge.json').read_text(encoding='utf-8'))
        self.assertEqual(build(),actual)

    def test_real_renderers(self):
        import pandas as pd
        for name in ['independent','paired','technical','longitudinal','omics','summary','roc']:
            with self.subTest(name=name):
                data=pd.read_csv(ROOT/f'scripts/fixtures/discovery/{name}.csv',keep_default_na=False).astype(str)
                rows=[list(data.columns),*data.values.tolist()]
                declarations=json.loads((ROOT/f'scripts/fixtures/discovery/{name}.json').read_text())
                result=discover(rows,declarations)
                self.assertTrue(result['candidates'])
                for c in result['candidates']:
                    with self.subTest(chart=c['chart_id']):
                        panel=regenerate(c['rendering']['recipe'],c['rendering']['rows'])
                        self.assertIn('<svg',panel['variants'][panel['initialVariant']]['svg'])
                        self.assertEqual(panel['table']['rows'],c['rendering']['rows'])
                        self.assertTrue(panel['recipe'])

    def test_local_workbook(self):
        import pandas as pd
        book=io.BytesIO()
        with pd.ExcelWriter(book,engine='openpyxl') as writer:
            pd.DataFrame({'unit':['a','b'],'value':[1.2,2.3]}).to_excel(writer,index=False,sheet_name='Measurements')
        payload={'data':base64.b64encode(book.getvalue()).decode()}
        result=import_table(payload)
        self.assertEqual(result['rows'][0],['unit','value']);self.assertEqual(result['sheets'],['Measurements'])
        for invalid in [{'data':'bad'}, {'data':payload['data'],'filename':'private'}, {'data':payload['data'],'sheet':True}]:
            with self.assertRaises(ValueError):import_table(invalid)

    def test_cli_export(self):
        with tempfile.TemporaryDirectory() as tmp:
            target=Path(tmp)/'results'
            proc=subprocess.run([sys.executable,str(ROOT/'sci_figures.py'),'discover',str(ROOT/'scripts/fixtures/discovery/summary.csv'),'--context',str(ROOT/'scripts/fixtures/discovery/summary.json'),'--out',str(target),'--json'],capture_output=True,text=True,encoding='utf-8')
            self.assertEqual(proc.returncode,0,proc.stderr)
            result=json.loads(proc.stdout);self.assertEqual(result['candidates'][0]['renderer_status'],'rendered')
            html=(target/'figure-discovery.html').read_text(encoding='utf-8')
            self.assertIn('ResearchDiscovery',html);self.assertIn('figureDiscoveryDialog',html);self.assertNotIn('__STUDIO_KNOWLEDGE__',html)

if __name__=='__main__':unittest.main()
