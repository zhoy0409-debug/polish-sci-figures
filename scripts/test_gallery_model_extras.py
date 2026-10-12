"""Rendered and semantic QA for the eight supplied-model-result views."""
from pathlib import Path
import sys,warnings
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/'scripts'),str(ROOT/'skills/make-sci-data-figures/scripts')]
import gallery_model_extras as g
from test_gallery_compare import bounds
from figure_workbench import style

def main():
 tables=g.fixtures();out=ROOT/'.cache/model-extras-qa';out.mkdir(parents=True,exist_ok=True);cases=0
 assert set(tables)==set(g.CONTRACTS) and len(g.REFERENCE_MAP)==8
 sizes=[((4.8,3.6),'normal'),((3.6,3.6),'narrow'),((7.2,3.6),'wide'),((4.8,5.4),'tall')]
 for key,data in tables.items():
  original=data.copy(deep=True);changed=data.copy(deep=True)
  for col in ['x','y','shap_value','feature_value','estimate','observed']:
   if col in changed:changed[col]*=1.12
  if key=='model_nomogram':changed.loc[changed.variable=='Marker level','variable']='Biomarker level'
  for version,d in [('original',data),('edited',changed)]:
   for size,name in sizes:
    with warnings.catch_warnings(record=True) as seen:
     warnings.simplefilter('always');style('Arial');fig=g.render(d,key,figsize=size);bounds(fig,(key,version,name));assert not [str(w.message) for w in seen if 'layout not applied' in str(w.message)],(key,name,seen)
    np.testing.assert_allclose(fig.get_size_inches(),size)
    if version=='edited':fig.savefig(out/f'{key}-{name}.png',dpi=120)
    if version=='original' and name=='normal':fig.savefig(out/f'{key}.svg');assert '<image' not in (out/f'{key}.svg').read_text(encoding='utf8')
    plt.close(fig);cases+=1
  pd.testing.assert_frame_equal(data,original)
  try:g.validate(data.drop(columns=g.CONTRACTS[key][3].split()[0]),key)
  except ValueError:pass
  else:raise AssertionError('Accepted incomplete schema '+key)
 d=tables['model_ice_pdp'];pdp=d[d.kind=='pdp'].sort_values('x').y.to_numpy();avg=d[d.kind=='ice'].groupby('x').y.mean().to_numpy();np.testing.assert_allclose(pdp,avg)
 d=tables['model_shap_summary'];f=g.render(d,'model_shap_summary');assert sum(len(c.get_offsets()) for c in f.axes[0].collections)==len(d);plt.close(f)
 for name in ['normal','narrow','wide','tall']:
  page=Image.new('RGB',(1500,1200),'#E9EDF3');draw=ImageDraw.Draw(page)
  for i,key in enumerate(tables):
   im=Image.open(out/f'{key}-{name}.png');im.thumbnail((480,355));x=i%3*500;y=i//3*400;page.paste(im,(x+(500-im.width)//2,y+33));draw.text((x+10,y+10),key,fill='#263B58')
  page.save(out/f'{name}-sheet.png')
 print(f'8 model-result templates: {cases} edited/size render cases, vector SVG, unchanged inputs and contribution/ICE checks passed')
if __name__=='__main__':main()
