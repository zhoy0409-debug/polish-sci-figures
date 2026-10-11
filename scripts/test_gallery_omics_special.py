"""Data, SVG and multiformat layout checks for 42 original scientific templates."""
import sys,io,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'skills/make-sci-data-figures/scripts'))
import gallery_omics_special as g
import gallery_structure_extras as extras
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from matplotlib.text import Text
from PIL import Image,ImageDraw


def drawn_text(fig):
    texts=list(fig.texts)
    for legend in fig.legends:texts+=list(legend.get_texts())
    for ax in fig.axes:
        if not ax.get_visible():continue
        texts+=list(ax.texts)+[ax.title]
        if ax.axison:
            texts += [ax.xaxis.label,ax.yaxis.label]
            for axis,limits in [(ax.xaxis,ax.get_xlim()),(ax.yaxis,ax.get_ylim())]:
                for tick in axis.get_major_ticks():
                    if min(limits)-1e-8<=tick.get_loc()<=max(limits)+1e-8:texts += [tick.label1,tick.label2]
        if ax.get_legend():texts+=list(ax.get_legend().get_texts())
    return [t for t in texts if t.get_visible() and t.get_text().strip()]


def issues(fig):
    fig.canvas.draw();rr=fig.canvas.get_renderer();canvas=fig.bbox;texts=drawn_text(fig);bad=[];overlap=[]
    for t in texts:
        b=t.get_window_extent(rr)
        if b.x0 < -1 or b.y0 < -1 or b.x1 > canvas.width+1 or b.y1 > canvas.height+1:bad.append(t.get_text())
    # Nontrivial overlapping annotation/legend pairs warrant visual inspection.
    for i,t in enumerate(texts):
        a=Text.get_window_extent(t,rr)
        for u in texts[i+1:]:
            b=Text.get_window_extent(u,rr);w=min(a.x1,b.x1)-max(a.x0,b.x0);h=min(a.y1,b.y1)-max(a.y0,b.y0)
            if w>2 and h>2 and w*h>0.20*min(a.width*a.height,b.width*b.height):overlap.append((t.get_text(),u.get_text()))
    return bad,overlap


def main():
    output=ROOT/'.cache/omics-special';output.mkdir(exist_ok=True)
    report={};fixtures={**g.fixtures(),**extras.fixtures()};sizes={'normal':(4.8,3.6),'narrow':(3.6,3.6),'wide':(7.2,3.6),'tall':(4.8,5.4)}
    for key,data in fixtures.items():
        module=g if key in g.CONTRACTS else extras
        original=data.copy(deep=True)
        for name,size in sizes.items():
            fig=module.render(data,key,figsize=size);assert tuple(np.round(fig.get_size_inches(),5))==size
            bounds,overlap=issues(fig);report[key+'_'+name]={'bounds':bounds,'overlap':overlap}
            fig.savefig(output/(key+'_'+name+'.png'),dpi=100)
            buffer=io.StringIO();fig.savefig(buffer,format='svg');svg=buffer.getvalue();assert '<image' not in svg and '<text' in svg
            plt.close(fig)
        pd.testing.assert_frame_equal(data,original)
        try:module.validate(data.drop(columns=module.CONTRACTS[key][3].split()[0]),key)
        except ValueError:pass
        else:raise AssertionError('Missing column accepted: '+key)
        # A replacement table with independently changed values must render too.
        changed=data.copy(deep=True)
        for col in ['value','response','diversity','log10_cfu','richness','mean_expression','gene_ratio','x','lda_score','weight','score','abundance','estimate','likelihood_ratio','high_result','log2fc','adjusted_p','position','inhibition','dose_a','diameter','time']:
            if col in changed and key not in {'phylogeny_traits','radar_profile'}:
                if key=='parallel_coordinates':changed[col]=changed.axis_min+.94*(changed[col]-changed.axis_min)
                else:changed[col]*=.94
                break
        if key=='missingness_matrix':changed.loc[0,'observed']=1-changed.loc[0,'observed']
        if key in {'euler_two_sets','venn_membership'}:changed=changed.iloc[1:].copy()
        if key=='oncoprint_matrix':changed.loc[0,'alteration']='Missense'
        if key in {'mic_distribution','rose_frequency','protein_domains'}:changed.loc[changed['count']>0,'count']+=1
        if key=='antibiogram_matrix':changed.loc[0,'susceptible']-=3
        if key=='phylogeny_traits':changed.loc[changed.role=='node','branch_length']*=1.2
        if key=='radar_profile':changed['value']*=.94
        if key in {'gene_arrows','plasmid_features'}:changed['end']-=20
        if key=='causal_dag':changed=changed.iloc[:-1].copy()
        assert not changed.equals(data),('Replacement fixture did not change',key)
        fig=module.render(changed,key,figsize=(4.8,3.6));bounds,overlap=issues(fig)
        report[key+'_modified']={'bounds':bounds,'overlap':overlap}
        fig.savefig(output/(key+'_modified.png'),dpi=100);plt.close(fig)
    (output/'qa.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    for size in sizes:
        for sheet in range(5):
            keys=list(fixtures)[sheet*9:(sheet+1)*9]
            if not keys:continue
            canvas=Image.new('RGB',(1440,3*400),'#e8ecf2');draw=ImageDraw.Draw(canvas)
            for i,key in enumerate(keys):
                img=Image.open(output/(key+'_'+size+'.png')).convert('RGB');img.thumbnail((470,365));x=(i%3)*480+(480-img.width)//2;y=(i//3)*400+25;canvas.paste(img,(x,y));draw.text(((i%3)*480+10,(i//3)*400+7),key,fill='#263c58')
            canvas.save(output/(size+f'-sheet-{sheet}.png'))
    bad={k:v for k,v in report.items() if v['bounds'] or v['overlap']}
    for n1,n2,shared in [(40,26,14),(20,20,20),(30,10,10),(10,20,0)]:
        r1=np.sqrt(n1/np.pi);r2=np.sqrt(n2/np.pi)
        distance=r1+r2 if shared==0 else (abs(r1-r2) if shared==min(n1,n2) else extras.brentq(lambda t:extras.circle_overlap(r1,r2,t)-shared,abs(r1-r2)+1e-9,r1+r2-1e-9))
        assert abs(extras.circle_overlap(r1,r2,distance)-shared)<1e-7
    frame=extras.fixtures()['fagan_nomogram'];f=extras.render(frame,'fagan_nomogram')
    for line in f.axes[0].lines:
        if len(line.get_xdata())==3:
            y=line.get_ydata();assert abs(y[0]+y[2]-2*y[1])<1e-12
    plt.close(f)
    assert abs(extras.expit(extras.logit(.2)+np.log(5))-5/9)<1e-12
    print(json.dumps(bad,indent=2));print('42 templates x 4 canvas sizes; editable SVG, replacement data, Euler area and Fagan numerics checked.')
    assert not bad,'Overlap or text outside canvas; inspect .cache/omics-special/qa.json'


if __name__=='__main__':main()
