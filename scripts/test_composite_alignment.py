"""Measure actual plot frames and render the nine-panel editable demo.

This checks data axes in physical points, not the SVG canvas/viewBox.  Auxiliary
axes (colour bars, dendrograms and marginal distributions) have separate checks.
Run --audit-only to retain a before-fix measurement without accepting alignment.
"""
from pathlib import Path
import argparse,io,json,sys,warnings
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from matplotlib.transforms import Bbox
from PIL import Image,ImageDraw

ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/'scripts'),str(ROOT/'skills/make-sci-data-figures/scripts')]
from figure_workbench import style
import gallery_registry as registry
from test_gallery_compare import bounds

KEYS=['compare_raincloud','model_shap_summary','clustered_matrix','roc_pointwise_band',
      'meta_forest','flow_alluvial','genome_manhattan','pca_loadings','coverage_tracks']
MARGINS_PT={'left':60.,'right':44.,'top':56.,'bottom':42.}
TOLERANCE_PT=.25


def records_for(data):
 from advanced_template_workbench import _roc_points
 records=[]
 for i,(label,q) in enumerate(data.groupby('cohort',sort=False)):
  truth=q.outcome.astype(str).eq('1').to_numpy();scores=q.score.to_numpy(float)
  x,y,precision,thresholds=_roc_points(truth,scores)
  records.append(dict(label=str(label),truth=truth,scores=scores,fpr=x,tpr=y,
    thresholds=thresholds,precision=precision,auc=float(np.trapezoid(y,x)),
    color=registry.COLORS[i%len(registry.COLORS)]))
 return records


def render(data,key,size):
 style('Arial')
 if key=='roc_pointwise_band':
  from roc_explorer import render_views
  return render_views(records_for(data),figsize=size,views={key})[0][1]
 return registry.render(data,key,figsize=size)


def main_axes(fig,key):
 axes=getattr(fig,'_studio_main_axes',None)
 if axes is not None:return list(axes)
 # Audit-only fallback lets the report show precisely what is misaligned.
 return [ax for ax in fig.axes if ax.get_visible()] if key=='roc_pointwise_band' else [fig.axes[0]]


def points_box(fig,axes):
 box=Bbox.union([ax.get_window_extent(fig.canvas.get_renderer()) for ax in axes])
 return np.array([box.x0,box.y0,box.x1,box.y1])*72/fig.dpi


def expected_box(size):
 return np.array([MARGINS_PT['left'],MARGINS_PT['bottom'],size[0]*72-MARGINS_PT['right'],size[1]*72-MARGINS_PT['top']])


def check_geometry(fig,key,size):
 fig.canvas.draw();np.testing.assert_allclose(fig.get_size_inches(),size,atol=1e-10)
 axes=main_axes(fig,key);actual=points_box(fig,axes);expected=expected_box(size)
 np.testing.assert_allclose(actual,expected,atol=TOLERANCE_PT,rtol=0,err_msg=f'{key}: data-frame L/B/R/T in pt')
 assert getattr(fig,'_studio_main_axes',None) is not None,(key,'missing main-axis metadata')
 # Check after a second render: divider/colourbar locators must not shrink the
 # main axes back after a correct-looking initial set_position call.
 fig.canvas.draw();np.testing.assert_allclose(points_box(fig,axes),actual,atol=.01,rtol=0)
 bounds(fig,key)
 if key=='model_shap_summary':
  colour_axes=[ax for ax in fig.axes if ax not in axes];assert len(colour_axes)==1
  colour=points_box(fig,colour_axes)
  np.testing.assert_allclose(colour[[1,3]],actual[[1,3]],atol=TOLERANCE_PT,rtol=0)
  np.testing.assert_allclose([colour[0]-actual[2],colour[2]-colour[0]],[8,7],atol=TOLERANCE_PT,rtol=0)
 if key=='meta_forest' and axes[0].get_legend():
  legend=axes[0].get_legend().get_window_extent(fig.canvas.get_renderer());legend=np.array([legend.x0,legend.y0,legend.x1,legend.y1])*72/fig.dpi
  assert legend[1]>=actual[3]+11.5,(key,'legend must stay above data frame',legend,actual)
  assert legend[3]<=size[1]*72-4,(key,'legend clipped at panel top')
 if key=='pca_loadings':
  ax=axes[0];ratio=(ax.get_ylim()[1]-ax.get_ylim()[0])/(ax.get_xlim()[1]-ax.get_xlim()[0])
  display_ratio=(actual[3]-actual[1])/(actual[2]-actual[0])
  np.testing.assert_allclose(abs(ratio),display_ratio,rtol=1e-4,err_msg='PCA must retain equal physical units')
  auxiliary=[ax for ax in fig.axes if ax not in axes];assert len(auxiliary)==2
  upper=next(ax for ax in auxiliary if ax.get_position().y0>=axes[0].get_position().y1-.001)
  right=next(ax for ax in auxiliary if ax.get_position().x0>=axes[0].get_position().x1-.001)
  np.testing.assert_allclose(points_box(fig,[upper])[[0,2]],actual[[0,2]],atol=TOLERANCE_PT,rtol=0)
  np.testing.assert_allclose(points_box(fig,[right])[[1,3]],actual[[1,3]],atol=TOLERANCE_PT,rtol=0)
 if key=='clustered_matrix':
  auxiliary=[ax for ax in fig.axes if ax not in axes and not hasattr(ax,'_colorbar')]
  assert len(auxiliary)==2
  top=max(auxiliary,key=lambda ax:ax.get_position().y0)
  left=min(auxiliary,key=lambda ax:ax.get_position().x0)
  np.testing.assert_allclose(points_box(fig,[top])[[0,2]],actual[[0,2]],atol=TOLERANCE_PT,rtol=0)
  np.testing.assert_allclose(points_box(fig,[left])[[1,3]],actual[[1,3]],atol=TOLERANCE_PT,rtol=0)
 return actual


def edited(data,key):
 d=data.copy()
 scales={'compare_raincloud':['value'],'model_shap_summary':['shap_value'],
   'clustered_matrix':['value'],'meta_forest':['estimate','lower','upper'],
   'flow_alluvial':['value'],'pca_loadings':['x','y'],'coverage_tracks':['coverage']}
 for col in scales.get(key,[]):d[col]=pd.to_numeric(d[col])*1.18
 if key=='genome_manhattan':d['p']=pd.to_numeric(d.p)*.8
 if key=='roc_pointwise_band':d['score']=pd.to_numeric(d.score)+.15*np.sin(np.arange(len(d)))
 return d


def compose(images,frames,size,out,tag,dpi=140):
 pw,ph=images[0].size;gap=28;border=24
 page=Image.new('RGB',(3*pw+2*gap+2*border,3*ph+2*gap+2*border),'white');draw=ImageDraw.Draw(page)
 for i,im in enumerate(images):
  x=border+(i%3)*(pw+gap);y=border+(i//3)*(ph+gap);page.paste(im,(x,y));draw.text((x+4,y+4),chr(65+i),fill='#24364F')
 page.save(out/f'composite-{tag}.png')
 # Guides show each ACTUAL data rectangle rather than an assumed tile margin.
 guide=page.copy();draw=ImageDraw.Draw(guide)
 for i,frame in enumerate(frames):
  x=border+(i%3)*(pw+gap);y=border+(i//3)*(ph+gap);l,b,r,t=np.asarray(frame)*dpi/72
  draw.rectangle((x+l,y+ph-t,x+r,y+ph-b),outline='#C95770',width=2)
 guide.save(out/f'frames-{tag}.png')


def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--audit-only',action='store_true');args=parser.parse_args()
 out=ROOT/'.cache/composite-alignment-qa';out.mkdir(parents=True,exist_ok=True)
 starters=json.loads((ROOT/'skills/polish-sci-figures/assets/figure-studio/template-starters.json').read_text(encoding='utf8'))
 tables={key:pd.DataFrame(starters[key]['rows'][1:],columns=starters[key]['rows'][0]) for key in KEYS};report=[];failures=[]
 for size,label in [((4.8,3.6),'normal'),((7.2,3.6),'wide')]:
  for version in ['original','edited']:
   images=[];frames=[]
   for key in KEYS:
    data=tables[key] if version=='original' else edited(tables[key],key)
    with warnings.catch_warnings(record=True) as caught:
     warnings.simplefilter('always');fig=render(data,key,size);fig.canvas.draw()
     frame=points_box(fig,main_axes(fig,key));frames.append(frame.tolist())
     try:
      check_geometry(fig,key,size)
      bad=[str(w.message) for w in caught if 'layout' in str(w.message).lower() or 'glyph' in str(w.message).lower()];assert not bad,bad
     except (AssertionError,StopIteration) as exc:failures.append({'view':key,'size':label,'version':version,'error':str(exc)})
     report.append({'view':key,'size':label,'version':version,'frame_pt':frame.tolist(),'error_pt':(frame-expected_box(size)).tolist(),'axes':len(fig.axes)})
     buf=io.BytesIO();fig.savefig(buf,format='png',dpi=140);buf.seek(0);images.append(Image.open(buf).convert('RGB'));plt.close(fig)
   compose(images,frames,size,out,f'{version}-{label}')
 (out/'measurements.json').write_text(json.dumps({'contract':MARGINS_PT,'panels':report,'failures':failures},ensure_ascii=False,indent=2),encoding='utf8')
 if failures and not args.audit_only:raise AssertionError(json.dumps(failures,ensure_ascii=False,indent=2))
 print(f'{len(report)} actual data-frame checks; {len(failures)} failures; nine-panel PNG and physical frame report: {out}')

if __name__=='__main__':main()
