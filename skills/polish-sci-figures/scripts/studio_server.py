"""Loopback-only Figure Studio data engine. Reuses validated workbenches; never executes submitted code."""
from __future__ import annotations
import argparse,csv,io,json,secrets,sys,tempfile,threading,time
from pathlib import Path
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from urllib.parse import urlsplit
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'make-sci-data-figures/scripts'))
from figure_studio import panel_from_path, inspect_svg_bytes
LOCK=threading.Lock()

def regenerate(recipe,rows):
    if not isinstance(recipe,dict) or not isinstance(rows,list) or not 2<=len(rows)<=10001:raise ValueError('Expected a header and 1–10000 observations')
    header=rows[0]
    if not isinstance(header,list) or not 1<=len(header)<=100 or any(not isinstance(x,str) or not x.strip() for x in header) or len(set(header))!=len(header):raise ValueError('Column names must be nonempty and unique')
    if any(not isinstance(row,list) or len(row)!=len(header) or any(not isinstance(x,str) or len(x)>1000 for x in row) for row in rows):raise ValueError('All rows must match the header; cell limit 1000 characters')
    import figure_workbench as wb
    import data_family_workbench as dfw
    import advanced_template_workbench as aw
    import matplotlib.pyplot as plt
    def svg_only(fig,stem):
        fig.savefig(stem.with_suffix('.svg'),format='svg',metadata={'Date':None});plt.close(fig)
    # This service serializes Matplotlib jobs; the standard command-line exporter is unchanged.
    wb.save_figure=dfw.save_figure=svg_only
    wb.make_gallery=dfw.make_gallery=lambda *args:None
    with tempfile.TemporaryDirectory(prefix='figure-studio-') as tmp:
        root=Path(tmp);source=root/'data.csv';out=root/'rendered'
        with source.open('w',newline='',encoding='utf-8') as f:csv.writer(f).writerows(rows)
        r=dict(recipe);r['input']=str(source);r['allow_font_fallback']=True
        family=r.get('family');colors=r.get('colors');palette=r.get('palette','zhoy_muted')
        try:
            if r.get('design') in ('independent','paired') and all(k in r for k in ('group','value','subject','order')):
                group_column=header.index(r['group']);observed=list(dict.fromkeys(row[group_column] for row in rows[1:] if row[group_column]))
                order=[x for x in r['order'] if x in observed]+[x for x in observed if x not in r['order']]
                wb.generate(source,r['group'],r['value'],r['design'],out,r['subject'],','.join(order),palette,colors,r.get('unit_label'),r.get('font','Arial'),r.get('outcome_type','continuous'),r.get('scope','exploratory'),r.get('show_p_value',False),True)
            elif family in aw.FAMILY_FUNCTIONS:
                # Only declared scalar plotting parameters may enter a known Python function.
                params=r.get('parameters',{})
                if any(isinstance(v,(dict,list)) for v in params.values()):raise ValueError('Invalid plotting parameters')
                import inspect
                allowed=set(inspect.signature(aw.FAMILY_FUNCTIONS[family]).parameters)-{'input_path','outdir','palette','colors_text','font'}
                if set(params)-allowed:raise ValueError('Unknown plotting parameters')
                aw._ALLOW_FONT_FALLBACK=True
                aw.FAMILY_FUNCTIONS[family](input_path=source,outdir=out,palette=palette,colors_text=colors,font=r.get('font','Arial'),**params)
            elif family in ('relationship','timecourse','composition','matrix'):
                rp=root/'recipe.json';rp.write_text(json.dumps(r),encoding='utf-8');dfw.recolor(rp,out,palette,colors)
            else:raise ValueError('This figure has no supported data recipe; import a generated bundle first')
            panel=panel_from_path(out,0,with_layouts=False)
            if r.get('design') in ('independent','paired'):
                from studio_sizes import render_sizes
                for name,size,raw in render_sizes(out,panel['recipe'],panel['analysis'],panel['variants'],allowed_sizes={'originalBars'}):
                    panel['variants'].append({**inspect_svg_bytes(raw,name),'size':size})
            # Dynamic axes fitting supplies span geometry, without pre-rendering every size.
            panel['recipe']['input']='data.csv';panel['name']='Updated data';panel['provenance']='local-recomputed'
            panel['analysis']['data_revision']={'source_sha256':panel['table']['sha256'],'engine':'existing-workbench','updated_at':time.strftime('%Y-%m-%dT%H:%M:%S')}
            return panel
        finally:plt.close('all')

class Handler(BaseHTTPRequestHandler):
    def send_json(self,status,value):
        raw=json.dumps(value,ensure_ascii=False,allow_nan=False).encode();self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)
    def do_GET(self):
        if self.headers.get('Host')!=self.server.address:return self.send_json(403,{'error':'Invalid host'})
        if urlsplit(self.path).path!='/':return self.send_json(404,{'error':'Not found'})
        text=self.server.page.read_text(encoding='utf-8').replace("connect-src 'none'","connect-src 'self'")
        config=json.dumps({'token':self.server.token,'endpoint':'/api/render'})
        text=text.replace('</head>',f'<script id="local-engine" type="application/json">{config}</script></head>')
        raw=text.encode();self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8');self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(raw)
    def do_POST(self):
        if self.path!='/api/render' or self.headers.get('Host')!=self.server.address or self.headers.get('Origin')!='http://'+self.server.address or self.headers.get('X-Studio-Token')!=self.server.token:return self.send_json(403,{'error':'Local editor authorization required'})
        try:
            size=int(self.headers.get('Content-Length','0'))
            if not 0<size<=3000000:raise ValueError('Request limit: 3 MB')
            payload=json.loads(self.rfile.read(size));started=time.monotonic()
            with LOCK:panel=regenerate(payload['recipe'],payload['rows'])
            self.send_json(200,{'panel':panel,'seconds':round(time.monotonic()-started,2)})
        except (ValueError,KeyError,TypeError) as e:self.send_json(422,{'error':str(e)})
        except Exception as e:self.send_json(500,{'error':str(e)})
    def log_message(self,*args):pass

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('html',type=Path);p.add_argument('--port',type=int,default=8767);a=p.parse_args()
    server=ThreadingHTTPServer(('127.0.0.1',a.port),Handler);server.page=a.html.resolve();server.token=secrets.token_urlsafe(32);server.address=f'127.0.0.1:{a.port}'
    print(f'Figure Studio local data engine: http://{server.address}/',flush=True);server.serve_forever()
if __name__=='__main__':main()
