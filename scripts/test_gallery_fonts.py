"""Check installed CJK fallback, mixed-language layout and editable SVG text."""
from pathlib import Path
import sys,warnings
import pandas as pd
import matplotlib.pyplot as plt
from matplotlib.text import Text
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/'scripts'),str(ROOT/'skills/make-sci-data-figures/scripts')]
import gallery_registry as registry
from gallery_fonts import cjk_fallbacks,font_families
from figure_workbench import style
from test_gallery_compare import bounds


def main():
 out=ROOT/'.cache/gallery-cjk-qa';out.mkdir(parents=True,exist_ok=True)
 assert cjk_fallbacks(),'CJK font required for this local integration check'
 cases={}
 for key in ['compare_raincloud','meta_forest','composition_percent_bars','composition_ring','model_shap_summary','model_nomogram','model_facet_relationship','clustered_matrix','parallel_coordinates']:
  d=pd.DataFrame({'category':['A','B','C','D'],'count':[42,28,18,12]}) if key=='composition_ring' else registry.OWNERS[key].fixtures()[key].copy()
  if key=='compare_raincloud':d['group']=d.group.map(dict(zip(d.group.unique(),['未经处理对照组 Control','药物干预实验组 Treatment','恢复验证实验组 Rescue'])))
  if key=='meta_forest':
   d['label']=[f'多中心验证研究 {i+1} Trial' if i<6 else '总体合并结果 Overall' for i in range(len(d))]
   d['subgroup']=d.subgroup.map({'Stratum A':'前瞻性研究 Prospective','Stratum B':'回顾性研究 Retrospective'})
  if key=='composition_percent_bars':
   d['group']=d.group.map({v:f'独立验证队列 {i+1} Cohort' for i,v in enumerate(d.group.unique())})
   d['category']=d.category.map({v:f'细胞亚群 {i+1} Cell' for i,v in enumerate(d.category.unique())})
  if key=='composition_ring':d['category']=[f'样本组成类别 {i+1} Type' for i in range(len(d))]
  if key=='model_shap_summary':d['feature']=d.feature.map({v:f'基线炎症相关指标 {i+1} Marker' for i,v in enumerate(d.feature.unique())})
  if key=='model_nomogram':
   mapping=dict(zip(d.variable.unique(),['模型积分 Points','基线年龄 Age (years)','生物标志物浓度 Marker','疾病分期 Stage','累计总积分 Total','结局发生概率 Probability']))
   d['variable']=d.variable.map(mapping)
  if key=='model_facet_relationship':d['facet']=d.facet.map(dict(zip(d.facet.unique(),['线性关系 Linear','曲线关系 Curved','异方差关系 Changing spread','影响观测点 Influential'])))
  if key=='clustered_matrix':
   d['feature']=d.feature.map({v:f'基因{i+1}' for i,v in enumerate(d.feature.unique())});d['sample']=d['sample'].map({v:f'样本{i+1}' for i,v in enumerate(d['sample'].unique())})
  if key=='parallel_coordinates':d['variable']=d.variable.map({v:f'指标{i+1}' for i,v in enumerate(d.variable.unique())})
  cases[key]=d
 sizes={'normal':(4.8,3.6),'narrow':(3.6,3.6),'wide':(7.2,3.6),'tall':(4.8,5.4)}
 for key,d in cases.items():
  for name,size in sizes.items():
   with warnings.catch_warnings(record=True) as caught:
    warnings.simplefilter('always');style('Arial');f=registry.render(d,key,figsize=size);bounds(f,(key,name))
    for t in f.findobj(Text):
     if t.get_text():assert t.get_fontfamily()[0]=='Arial' and cjk_fallbacks()[0] in t.get_fontfamily(),(key,t.get_text(),t.get_fontfamily())
    f.savefig(out/f'{key}-{name}.png',dpi=130)
    assert not [str(w.message) for w in caught if 'glyph' in str(w.message).lower() or 'layout' in str(w.message).lower()],(key,name,[str(w.message) for w in caught])
   plt.close(f)
  raw=registry.svg_at_size(d,key,registry.COLORS,'Arial',sizes['normal']).decode('utf8');(out/f'{key}.svg').write_text(raw,encoding='utf8')
  assert '<text' in raw and '<image' not in raw and cjk_fallbacks()[0] in raw
  assert any('\u4e00'<=c<='\u9fff' for c in raw)
 # A selected Latin font survives module defaults while retaining CJK fallback.
 raw=registry.svg_at_size(cases['compare_raincloud'],'compare_raincloud',registry.COLORS,'Arial Narrow',sizes['normal']).decode('utf8')
 assert 'Arial Narrow' in raw and cjk_fallbacks()[0] in raw
 for name in sizes:
  sheet=Image.new('RGB',(1500,1200),'#E9EDF3');draw=ImageDraw.Draw(sheet)
  for i,key in enumerate(cases):
   im=Image.open(out/f'{key}-{name}.png');im.thumbnail((480,355));x=i%3*500;y=i//3*400;sheet.paste(im,(x+(500-im.width)//2,y+33));draw.text((x+10,y+10),key,fill='#263B58')
  sheet.save(out/f'{name}-sheet.png')
 print(f'{len(cases)*len(sizes)} mixed Chinese/English renders passed; editable SVG and font stack: {font_families("Arial")}')

if __name__=='__main__':main()
