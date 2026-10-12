"""Numerical and actual-render checks for the clinical/evidence templates."""
from pathlib import Path
import sys,warnings
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/'scripts'),str(ROOT/'skills/make-sci-data-figures/scripts')]
import gallery_clinical as g
from test_gallery_compare import bounds
from figure_workbench import style

def main():
 out=ROOT/'.cache/clinical-final-qa';out.mkdir(parents=True,exist_ok=True);tables=g.fixtures();assert set(tables)==set(g.CONTRACTS);cases=0
 sizes=[((4.8,3.6),'normal'),((3.6,3.6),'narrow'),((7.2,3.6),'wide'),((4.8,5.4),'tall')]
 for key,data in tables.items():
  original=data.copy(deep=True);changed=data.copy(deep=True)
  for col in ['time','effect','pooled','estimate','lower','upper','residual','smooth','predicted','observed','fitted','sensitivity','specificity','se_lower','se_upper','sp_lower','sp_upper','moderator','net_benefit','change']:
   if col in g.CONTRACTS[key][4].split():changed[col]*=.92
  for col in ['count','n','population','high_risk','true_positive']:
   if col in changed:changed[col]*=2
  if 'judgement' in changed:changed['judgement']=changed.judgement.map({'low':'some','some':'high','high':'low'})
  for version,table in [('original',data),('edited',changed)]:
   for size,suffix in sizes:
    with warnings.catch_warnings(record=True) as seen:
     warnings.simplefilter('always');style('Arial');fig=g.render(table,key,figsize=size);bounds(fig,key+' '+version+' '+suffix)
     assert not [str(w.message) for w in seen if 'layout' in str(w.message).lower()],(key,suffix,[str(w.message) for w in seen])
    np.testing.assert_allclose(fig.get_size_inches(),size)
    if version=='edited' or suffix=='normal':fig.savefig(out/f'{key}-{version}-{suffix}.png',dpi=110)
    if version=='original' and suffix=='normal':fig.savefig(out/f'{key}.svg');assert '<image' not in (out/f'{key}.svg').read_text(encoding='utf8')
    plt.close(fig);cases+=1
  pd.testing.assert_frame_equal(data,original)
  try:g.validate(data.drop(columns=g.CONTRACTS[key][3].split()[0]),key)
  except ValueError:pass
  else:raise AssertionError('Accepted missing data '+key)
 # Tied event/censor times: the event count uses everyone at risk at that time.
 known=pd.DataFrame({'time':[1,2,2,3],'event':[1,1,0,1]});t,s,l,u,h=g.km(known)
 np.testing.assert_allclose(s,[1,.75,.5,0]);np.testing.assert_allclose(h,[0,.25,.25+1/3,.25+1/3+1]);assert ((l<=s)&(s<=u)).all()
 # Risk-table values must use the exact displayed shared time coordinates.
 data=tables['survival_risk_counts'];f=g.render(data,'survival_risk_counts');f.canvas.draw();ax,tab=f.axes
 for txt in tab.texts:
  x,y=txt.get_position();q=list(data.groupby('group',sort=False))[int(y)][1];assert int(txt.get_text())==int((q.time>=x).sum())
 assert ax.get_xlim()==tab.get_xlim();plt.close(f)
 # Every flow label is contained by its node and no arrow begins inside a box.
 f=g.render(tables['study_flow'],'study_flow');f.canvas.draw();ax=f.axes[0];rr=f.canvas.get_renderer();labels=[t for t in ax.texts if t.get_text()]
 for text,patch in zip(labels,ax.patches):
  a=text.get_window_extent(rr);b=patch.get_window_extent(rr);assert a.x0>b.x0 and a.x1<b.x1 and a.y0>b.y0 and a.y1<b.y1,(text.get_text(),a,b)
 plt.close(f)
 # A set of competing events cannot collectively exceed probability one.
 bad=tables['competing_incidence'].copy();bad[['estimate','lower','upper']]=[.7,.6,.8]
 try:g.validate(bad,'competing_incidence')
 except ValueError:pass
 else:raise AssertionError('Accepted impossible total cumulative incidence')
 # Forest marker area encodes the supplied study weight proportionally.
 data=tables['meta_forest'];f=g.render(data,'meta_forest');areas=np.array([c.get_sizes()[0] for c in f.axes[0].collections]);weights=data.loc[data.role=='study','weight'].to_numpy();np.testing.assert_allclose(areas/areas[0],weights/weights[0]);plt.close(f)
 for suffix in ['normal','narrow','wide','tall']:
  keys=list(tables)
  for start in range(0,len(keys),9):
   page=Image.new('RGB',(1500,1200),'#E9EDF3');draw=ImageDraw.Draw(page)
   for i,key in enumerate(keys[start:start+9]):
    path=out/f'{key}-edited-{suffix}.png';im=Image.open(path);im.thumbnail((480,355));x=i%3*500;y=i//3*400;page.paste(im,(x+(500-im.width)//2,y+32));draw.text((x+10,y+10),key,fill='#263B58')
   page.save(out/f'{suffix}-sheet-{start//9}.png')
 print(f'{len(tables)} clinical/evidence templates: {cases} render/data/size cases, vector export, KM ties, risk counts and flow text containment passed')

if __name__=='__main__':main()
