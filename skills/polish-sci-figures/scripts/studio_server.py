"""Loopback-only Figure Studio data engine. Reuses validated workbenches; never executes submitted code."""
from __future__ import annotations
import argparse,base64,binascii,csv,io,json,math,secrets,sys,tempfile,threading,time
from pathlib import Path
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from urllib.parse import urlsplit
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'make-sci-data-figures/scripts'))
from figure_studio import panel_from_path, inspect_svg_bytes
LOCK=threading.Lock()


def import_pdf(payload):
    """Read a bounded local PDF; no paths, remote URLs or submitted code."""
    if not isinstance(payload,dict) or set(payload)-{'data','action','page'} or not {'data','action'}<=set(payload):
        raise ValueError('PDF import requires data and action, with an optional page')
    action=payload['action']
    if action not in ('inspect','page'):raise ValueError('Unknown PDF import action')
    encoded=payload['data']
    if not isinstance(encoded,str) or not 0<len(encoded)<=26666668:raise ValueError('PDF file limit: 20 MB')
    try:raw=base64.b64decode(encoded,validate=True)
    except (ValueError,binascii.Error):raise ValueError('Invalid PDF data') from None
    if len(raw)>20000000:raise ValueError('PDF file limit: 20 MB')
    if not raw.lstrip().startswith(b'%PDF-'):raise ValueError('The file does not contain a PDF document')
    page=payload.get('page',0)
    if isinstance(page,bool) or not isinstance(page,int) or page<0:raise ValueError('Invalid PDF page number')
    from studio_pdf import inspect_pdf,import_pdf_page
    return inspect_pdf(raw) if action=='inspect' else import_pdf_page(raw,page)

def validate_table(recipe,rows):
    """Validate the bounded, rectangular table shared by both local endpoints."""
    if not isinstance(recipe,dict) or not isinstance(rows,list) or not 2<=len(rows)<=10001:raise ValueError('Expected a header and 1–10000 observations')
    header=rows[0]
    if not isinstance(header,list) or not 1<=len(header)<=100 or any(not isinstance(x,str) or not x.strip() for x in header) or len(set(header))!=len(header):raise ValueError('Column names must be nonempty and unique')
    if any(not isinstance(row,list) or len(row)!=len(header) or any(not isinstance(x,str) or len(x)>1000 for x in row) for row in rows):raise ValueError('All rows must match the header; cell limit 1000 characters')
    return header


def reflow(recipe,rows,width,height,axes=None):
    """Render one reviewed view at the requested physical size, without file input."""
    header=validate_table(recipe,rows)
    from gallery_layout import MARGINS_PT,REVIEWED
    min_width=MARGINS_PT['left']+MARGINS_PT['right']+36
    min_height=MARGINS_PT['top']+MARGINS_PT['bottom']+36
    for name,value,minimum in [('width',width,min_width),('height',height,min_height)]:
        if isinstance(value,bool) or not isinstance(value,(int,float)) or not minimum<value<=1440 or not math.isfinite(value):
            raise ValueError(f'{name} must be a finite physical size greater than {minimum:g} pt and at most 1440 pt')
    params=recipe.get('parameters',{})
    if not isinstance(params,dict):raise ValueError('Recipe parameters must be an object')
    for key,default,limit in [('font','Arial',128),('palette','zhoy_muted',100)]:
        value=recipe.get(key,default)
        if not isinstance(value,str) or not value.strip() or len(value)>limit:raise ValueError('Invalid '+key)
    colors=recipe.get('colors')
    if colors is not None and (not isinstance(colors,str) or len(colors)>1000):raise ValueError('Colours must be a comma-separated colour list')
    import pandas as pd
    import matplotlib.pyplot as plt
    data=pd.DataFrame(rows[1:],columns=header)
    dimensions=(float(width)/72,float(height)/72)
    family=recipe.get('family')
    from gallery_axes import normalize,capabilities,controls_from_svg
    axes=normalize(recipe.get('axis_settings') if axes is None else axes)
    if axes and family!='gallery':raise ValueError('Editable data-axis settings currently require a gallery recipe')
    try:
        if family=='gallery':
            import gallery_registry as registry
            if set(params)!={'view'} or not isinstance(params['view'],str):raise ValueError('Gallery reflow requires one declared view')
            view=params['view']
            # Legacy copies of these two renderers need their exact cell
            # identities regenerated. This endpoint allowance does not add them
            # to REVIEWED or enable any new automatic layout/axis controls.
            metadata_view=view in {'grouped_observations','compare_facet_boxes'}
            if view not in registry.CONTRACTS or (view not in REVIEWED and not capabilities(view)['supported'] and not metadata_view):raise ValueError('This gallery view has no reviewed reflow layout')
            registry.validate(data,view)
            from figure_workbench import style
            style(recipe.get('font','Arial'))
            raw=registry.svg_at_size(data,view,registry.colors_for(recipe.get('palette','zhoy_muted'),colors),recipe.get('font','Arial'),dimensions,axes=axes)
        elif family=='roc':
            from studio_roc_sizes import render_reflow
            view=recipe.get('studio_view')
            if view not in {'roc_pointwise_band','roc_bootstrap_curves'}:raise ValueError('Only reviewed ROC uncertainty views support reflow')
            raw=render_reflow(data,recipe,dimensions)
        else:raise ValueError('This figure family does not support precise reflow')
        if recipe.get('facet_context') is not None:
            from studio_facets import title_svg
            raw=title_svg(raw,recipe,rows)
        variant={**inspect_svg_bytes(raw,view),'preserveAspect':True}
        if family=='gallery':variant['axis_controls']=controls_from_svg(raw)
        if not math.isclose(variant['width'],float(width),abs_tol=1e-4) or not math.isclose(variant['height'],float(height),abs_tol=1e-4):
            raise ValueError('Rendered SVG dimensions do not match the requested physical size')
        return variant
    finally:plt.close('all')


def regenerate(recipe,rows,statistics=None,axes=None):
    header=validate_table(recipe,rows)
    from studio_facets import facet_context, title_svg
    context=facet_context(recipe,rows)
    from gallery_axes import normalize,controls_from_svg
    axes=normalize(recipe.get('axis_settings') if axes is None else axes)
    if axes and recipe.get('family')!='gallery':raise ValueError('Editable data-axis settings currently require a gallery recipe')
    # Analyze before rendering. Invalid configurations fail atomically and cannot
    # return new artwork carrying statistical results from an older table.
    statistics_result=None
    if statistics is not None:
        from studio_statistics import analyze
        statistics_result=analyze(recipe,rows,statistics)
    import figure_workbench as wb
    import data_family_workbench as dfw
    import advanced_template_workbench as aw
    import matplotlib.pyplot as plt
    def svg_only(fig,stem):
        wb.prepare_marks(fig)
        output=stem.with_suffix('.svg')
        fig.savefig(output,format='svg',metadata={'Date':None})
        output.write_text(wb.embed_category_metadata(output.read_text(encoding='utf-8'),fig),encoding='utf-8')
        plt.close(fig)
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
            elif family=='gallery':
                from gallery_registry import generate
                params=r.get('parameters',{})
                if set(params)!={'view'} or not isinstance(params['view'],str):raise ValueError('Gallery recipe requires one declared view')
                generate(source,out,**params,palette=palette,colors_text=colors,font=r.get('font','Arial'),axes=axes)
            elif family=='roc_results':
                from roc_contract_workbench import generate
                params=r.get('parameters',{})
                allowed={'view','method','max_fpr','prevalence','cost_fn','cost_fp'}
                if set(params)-allowed or any(isinstance(v,(dict,list)) for v in params.values()):raise ValueError('Invalid ROC result parameters')
                generate(source,out,**params,palette=palette,colors_text=colors,font=r.get('font','Arial'))
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
            if family=='gallery':
                import gallery_registry as registry
                data=__import__('pandas').read_csv(source,keep_default_na=False)
                colors=registry.colors_for(palette,r.get('colors'))
                for key in [params['view']]:
                    for name,size,raw in registry.render_sizes(data,key,colors,r.get('font','Arial'),axes=axes):
                        panel['variants'].append({**inspect_svg_bytes(raw,name),'size':size,'preserveAspect':True})
                for variant in panel['variants']:
                    variant['axis_controls']=controls_from_svg(variant['svg'])
                panel['axis_controls']=panel['analysis'].get('axis_controls')
            if family in ('roc','roc_results'):
                from studio_roc_sizes import render_sizes
                for name,size,raw in render_sizes(source,r,panel['analysis']):
                    panel['variants'].append({**inspect_svg_bytes(raw,name),'size':size,'preserveAspect':True})
            requested=r.get('studio_view')
            if isinstance(requested,str):
                panel['initialVariant']=next((i for i,v in enumerate(panel['variants']) if v['name']==requested),panel['initialVariant'])
                panel['recipe']['studio_view']=requested
            # Gallery dimensions are newly rendered axes, not affine-stretched artwork.
            panel['recipe']['input']='data.csv';panel['name']='Updated data';panel['provenance']='local-recomputed'
            panel['analysis']['data_revision']={'source_sha256':panel['table']['sha256'],'engine':'existing-workbench','updated_at':time.strftime('%Y-%m-%dT%H:%M:%S')}
            if statistics_result is not None:
                if statistics_result['data_sha256']!=panel['table']['sha256']:
                    raise ValueError('Statistical results do not match the rendered data revision')
                panel['statistics']=statistics_result
            if context is not None:
                panel['facet']=context
                panel['recipe']['facet_context']=context
                for variant in panel['variants']:
                    variant['svg']=title_svg(variant['svg'],recipe,rows).decode('utf-8')
            return panel
        finally:plt.close('all')

class Handler(BaseHTTPRequestHandler):
    def send_json(self,status,value):
        raw=json.dumps(value,ensure_ascii=False,allow_nan=False).encode();self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)
    def do_GET(self):
        if self.headers.get('Host')!=self.server.address:return self.send_json(403,{'error':'Invalid host'})
        if urlsplit(self.path).path!='/':return self.send_json(404,{'error':'Not found'})
        text=self.server.page.read_text(encoding='utf-8').replace("connect-src 'none'","connect-src 'self'").replace("connect-src https://www.ebi.ac.uk", "connect-src 'self' https://www.ebi.ac.uk")
        config=json.dumps({'token':self.server.token,'endpoint':'/api/render','reflowEndpoint':'/api/reflow','analyzeEndpoint':'/api/analyze','splitFacetsEndpoint':'/api/split-facets','pdfEndpoint':'/api/import-pdf','duplicateEndpoint':'/api/image-duplicates','imageLinksEndpoint':'/api/image-links'})
        if getattr(self.server,'update_checker',None):
            settings=json.loads(config);settings['updatesEndpoint']='/api/updates';settings['updateInfo']=self.server.update_checker.current;config=json.dumps(settings)
        if getattr(self.server,'windows_updater',None):
            settings=json.loads(config);settings['updateInstallEndpoint']='/api/update-install';settings['updateInfo']={**settings.get('updateInfo',{}),'inAppInstall':self.server.windows_updater.snapshot()['supported']};config=json.dumps(settings)
        text=text.replace('</head>',f'<script id="local-engine" type="application/json">{config}</script></head>',1)
        raw=text.encode();self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8');self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(raw)
    def do_POST(self):
        if self.path not in ('/api/render','/api/reflow','/api/analyze','/api/split-facets','/api/import-pdf','/api/image-duplicates','/api/image-links','/api/updates','/api/update-install') or self.headers.get('Host')!=self.server.address or self.headers.get('Origin')!='http://'+self.server.address or self.headers.get('X-Studio-Token')!=self.server.token:return self.send_json(403,{'error':'Local editor authorization required'})
        try:
            size=int(self.headers.get('Content-Length','0'))
            limit=256 if self.path in ('/api/updates','/api/update-install') else 44000000 if self.path in ('/api/image-duplicates','/api/image-links') else 27000000 if self.path=='/api/import-pdf' else 3000000
            if not 0<size<=limit:raise ValueError(f'Request limit: {limit//1000000} MB')
            payload=json.loads(self.rfile.read(size));started=time.monotonic()
            if not isinstance(payload,dict):raise ValueError('Request body must be an object')
            if self.path=='/api/update-install':
                if set(payload)!={'action'} or payload['action'] not in ('status','download','cancel','install'):raise ValueError('Invalid update installation action')
                updater=getattr(self.server,'windows_updater',None)
                if updater is None:return self.send_json(200,{'status':'unsupported','supported':False})
                return self.send_json(200,updater.request(payload['action']))
            if self.path=='/api/updates':
                if set(payload)-{'refresh'} or type(payload.get('refresh',False)) is not bool:raise ValueError('Update checks accept only a refresh boolean')
                checker=getattr(self.server,'update_checker',None)
                if checker is None:return self.send_json(200,{'status':'unavailable','reason':'unsupported-host'})
                return self.send_json(200,checker.check(refresh=payload.get('refresh',False)))
            if self.path=='/api/image-duplicates':
                from studio_duplicate_jobs import JOBS
                return self.send_json(200,JOBS.request(payload))
            with LOCK:
                if self.path=='/api/image-links':
                    if set(payload)!={'images'}:raise ValueError('Image localization requires images')
                    from studio_image_links import locate_image_links
                    response=locate_image_links(payload['images'])
                elif self.path=='/api/import-pdf':
                    response={'pdf':import_pdf(payload)}
                elif self.path=='/api/reflow':
                    if not {'recipe','rows','width','height'}<=set(payload) or set(payload)-{'recipe','rows','width','height','axes'}:raise ValueError('Reflow requires recipe, rows, width and height, with optional axes')
                    response={'variant':reflow(payload['recipe'],payload['rows'],payload['width'],payload['height'],payload.get('axes'))}
                elif self.path=='/api/split-facets':
                    if not {'recipe','rows'}<=set(payload) or set(payload)-{'recipe','rows','statistics'}:raise ValueError('Facet splitting requires recipe and rows, with optional statistics')
                    from studio_facets import split_facets
                    response=split_facets(payload['recipe'],payload['rows'],payload.get('statistics'))
                elif self.path=='/api/analyze':
                    if set(payload)!={'recipe','rows','config'}:raise ValueError('Analysis requires recipe, rows and config')
                    from studio_statistics import analyze
                    response=analyze(payload['recipe'],payload['rows'],payload['config'])
                else:
                    if not {'recipe','rows'}<=set(payload) or set(payload)-{'recipe','rows','statistics','axes'}:raise ValueError('Rendering requires recipe and rows, with optional statistics and axes')
                    response={'panel':regenerate(payload['recipe'],payload['rows'],payload.get('statistics'),payload.get('axes'))}
            self.send_json(200,{**response,'seconds':round(time.monotonic()-started,2)})
        except (ValueError,KeyError,TypeError) as e:self.send_json(422,{'error':str(e)})
        except Exception as e:self.send_json(500,{'error':str(e)})
    def log_message(self,*args):pass

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('html',type=Path);p.add_argument('--port',type=int,default=8767);a=p.parse_args()
    server=ThreadingHTTPServer(('127.0.0.1',a.port),Handler);server.page=a.html.resolve();server.token=secrets.token_urlsafe(32);server.address=f'127.0.0.1:{a.port}'
    from studio_updates import UpdateChecker,installation_info
    server.update_checker=UpdateChecker(installation_info(),Path.home()/'.cache'/'figure-studio'/'update-check.json')
    print(f'Figure Studio local data engine: http://{server.address}/',flush=True);server.serve_forever()
if __name__=='__main__':main()
