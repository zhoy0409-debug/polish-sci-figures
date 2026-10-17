"""Python CLI adapter to the single JavaScript rules engine; all research data stay local."""
from pathlib import Path
import json, shutil, subprocess, sys
ROOT=Path(__file__).resolve().parents[3]

def discover(rows,declarations=None,goal='auto'):
    node=shutil.which('node')
    if not node:raise ValueError('Figure discovery CLI requires Node.js 18+; Studio uses its embedded browser runtime.')
    result=subprocess.run([node,str(ROOT/'scripts/discover_figures.cjs')],input=json.dumps({'rows':rows,'declarations':declarations or {},'goal':goal},ensure_ascii=False),text=True,encoding='utf-8',capture_output=True,timeout=30)
    if result.returncode:raise ValueError('Invalid discovery input; inspect the local table and declarations.')
    return json.loads(result.stdout)

def command(args):
    sys.path.insert(0,str(ROOT));from sci_figures import read_table
    frame=read_table(Path(args.input),args.sheet,preserve_text=True).fillna('')
    rows=[list(map(str,frame.columns)),*frame.astype(str).values.tolist()]
    declarations=json.loads(Path(args.context).read_text(encoding='utf-8-sig')) if args.context else {}
    result=discover(rows,declarations,args.goal)
    if args.out:
        dest=Path(args.out)
        if dest.exists():raise ValueError('Output already exists; choose a new output directory')
        dest.mkdir(parents=True)
        sys.path.insert(0,str(ROOT/'skills/polish-sci-figures/scripts'))
        from studio_server import regenerate
        from figure_studio import write_html, digest
        panels=[]
        for candidate in result['candidates']:
            try:
                rendering=candidate['rendering'];panel=regenerate(rendering['recipe'],rendering['rows'])
                panel['id']='panel-'+str(len(panels));panel['name']=candidate['chart_id'];panel['discovery']={'declarations':declarations,'sourceRows':rows,'tableKey':panel['table']['sha256'],'trace':candidate['trace']}
                candidate['renderer_status']='rendered';panels.append(panel)
            except (ValueError,KeyError,TypeError):candidate['renderer_status']='contract_rejected'
        if panels:
            # Use the existing project/state contract, preserving normal editing and undo.
            project={'schema':'figure-studio/1','id':digest(json.dumps(rows).encode())[:20],'title':'Figure Discovery','panels':panels,'initialState':{'order':[p['id'] for p in panels],'columns':min(2,len(panels)),'gap':12,'panels':{p['id']:{'variant':p['initialVariant'],'edits':{}} for p in panels}}}
            write_html(project,dest/'figure-discovery.html')
        (dest/'discovery.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(result,ensure_ascii=False,indent=2));return 0
