"""Original structural, composition and model-result scientific templates."""
import textwrap
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from gallery_fonts import font_families
from matplotlib.colors import LinearSegmentedColormap, Normalize
from matplotlib.patches import Circle, Wedge, PathPatch, FancyArrowPatch, Rectangle
from matplotlib.path import Path
from matplotlib.lines import Line2D
from scipy.optimize import brentq
from scipy.special import logit, expit
from gallery_omics_special import PALETTE, _wrap, _axes, _finish, _legend, _matrix, _colorbar

CONTRACTS={
 'parallel_coordinates':('多变量平行坐标','Parallel coordinates','relationship','sample group variable value axis_min axis_max','value axis_min axis_max'),
 'synergy_surface_result':('协同作用结果曲面','Supplied interaction surface','relationship','dose_a dose_b score method','dose_a dose_b score'),
 'missingness_matrix':('缺失模式矩阵','Missingness pattern matrix','matrix','sample variable observed','observed'),
 'euler_two_sets':('面积比例双集合 Euler 图','Area-proportional two-set Euler diagram','matrix','sample set',''),
 'muller_lineages':('Muller 克隆谱系图','Muller lineage composition','omics','clone parent time abundance','time abundance'),
 'chord_flows':('定量弦图','Quantitative chord flows','matrix','source target value','value'),
 'mediation_paths_result':('中介路径与系数','Supplied mediation path coefficients','effects','source target estimate lower upper method','estimate lower upper'),
 'fagan_nomogram':('Fagan 概率列线图','Fagan probability nomogram','roc','scenario pretest likelihood_ratio','pretest likelihood_ratio'),
 'tornado_sensitivity':('单因素敏感性龙卷风图','One-way sensitivity tornado','effects','parameter baseline low_result high_result','baseline low_result high_result'),
}
NOTES={
 'parallel_coordinates':('每个对象提供所有变量与预先确定的坐标上下界；显示按各轴范围归一化的位置，端点标注原单位数值。','Every subject needs all variables and declared axis bounds; normalized positions retain original-unit endpoints.'),
 'synergy_surface_result':('输入已计算的相互作用分数和方法名称；正负含义由所用模型决定，不从此曲面推断统计显著性。','Supply calculated interaction scores and method name; signs depend on the model and do not establish significance.'),
 'missingness_matrix':('observed 为 1 表示观测、0 表示缺失；每个样本与变量必须完整列出。','Observed is 1 for present and 0 for missing; include every sample-variable pair.'),
 'euler_two_sets':('精确计算两个圆的面积和交叠，使其与集合及交集样本数成比例；只支持两个非空集合。','Circle and overlap areas are proportional to exact membership counts; supports two nonempty sets.'),
 'muller_lineages':('输入克隆谱系与每个时间点的互斥克隆丰度；后代嵌在祖先带内，显露面积表示该克隆自身比例。','Supply lineage relationships and exclusive clone abundances at every time point; descendants nest within ancestors, and visible area represents each clone’s own proportion.'),
 'chord_flows':('输入有向非负流量；端点弧长与流量成正比，带色代表来源，节点弧长表示流入与流出之和。','Directed nonnegative flows; endpoint arc lengths encode flow, ribbon colour denotes source, and node arcs represent incoming plus outgoing totals.'),
 'mediation_paths_result':('输入已拟合三节点中介模型的路径估计与区间；不重新拟合，也不将路径系数乘积包装为已检验的间接效应。','Supply three-node mediation path estimates and intervals; no refitting or untested indirect-effect claim is performed.'),
 'fagan_nomogram':('输入验前概率 0–1 和阳性或阴性似然比；按 Bayes 赔率公式精确换算验后概率。','Supply pretest probability from 0 to 1 and a positive or negative likelihood ratio; posterior probability follows Bayes’ odds formula.'),
 'tornado_sensitivity':('输入共同基准结果以及每个参数取上下界时的结果；展示单因素敏感性，不解释为置信区间。','Supply one baseline and outcomes at each parameter’s lower/upper input bounds; this is one-way sensitivity, not a confidence interval.'),
}
REFERENCE_MAP={62:'parallel_coordinates',77:'synergy_surface_result',78:'missingness_matrix',83:'euler_two_sets',93:'muller_lineages',95:'chord_flows',97:'mediation_paths_result',98:'fagan_nomogram',99:'tornado_sensitivity'}
SOURCE_MAP={};COMPATIBLE_GROUPS=[]
PRESERVE_ASPECT={'euler_two_sets','chord_flows','mediation_paths_result','fagan_nomogram','synergy_surface_result'}


def _unique(s):return list(dict.fromkeys(s.astype(str)))


def circle_overlap(r1,r2,distance):
    if distance>=r1+r2:return 0.
    if distance<=abs(r1-r2):return np.pi*min(r1,r2)**2
    a=np.clip((distance**2+r1*r1-r2*r2)/(2*distance*r1),-1,1)
    b=np.clip((distance**2+r2*r2-r1*r1)/(2*distance*r2),-1,1)
    area=r1*r1*np.arccos(a)+r2*r2*np.arccos(b)-.5*np.sqrt(max(0,(-distance+r1+r2)*(distance+r1-r2)*(distance-r1+r2)*(distance+r1+r2)))
    return float(area)


def _lineage(d):
    parent=d.groupby('clone',sort=False).parent.first().to_dict();nodes=list(parent)
    if not set(parent.values()) <= (set(nodes)|{'ROOT'}):raise ValueError('Every clone parent must be another clone or ROOT')
    for node in nodes:
        seen=set();cur=node
        while cur!='ROOT':
            if cur in seen:raise ValueError('Clone lineage contains a cycle')
            seen.add(cur);cur=parent[cur]
    children={n:[k for k,p in parent.items() if p==n] for n in nodes}
    return nodes,parent,children


def validate(data,view):
    if view not in CONTRACTS:raise ValueError('Unknown structural template')
    cols=CONTRACTS[view][3].split();numeric=CONTRACTS[view][4].split()
    if not set(cols)<=set(data):raise ValueError('Required columns: '+', '.join(cols))
    d=data.copy(deep=True)
    if d.empty or d[cols].isna().any().any():raise ValueError('Required values must be present')
    for col in numeric:
        d[col]=pd.to_numeric(d[col],errors='raise')
        if not np.isfinite(d[col]).all():raise ValueError(col+' must be finite')
    for col in set(cols)-set(numeric):
        d[col]=d[col].astype(str)
        if d[col].str.strip().eq('').any():raise ValueError('Labels must be nonempty')
    keys={'parallel_coordinates':['sample','variable'],'synergy_surface_result':['dose_a','dose_b'],'missingness_matrix':['sample','variable'],'euler_two_sets':['sample','set'],'muller_lineages':['clone','time'],'chord_flows':['source','target'],'mediation_paths_result':['source','target'],'fagan_nomogram':['scenario'],'tornado_sensitivity':['parameter']}[view]
    if d.duplicated(keys).any():raise ValueError('Duplicate keys: '+', '.join(keys))
    if view=='parallel_coordinates':
        if not 2<=d.variable.nunique()<=8 or d.group.nunique()>5 or d['sample'].nunique()>100:raise ValueError('Use 2–8 variables, at most five groups and at most 100 observations')
        if len(d)!=d['sample'].nunique()*d.variable.nunique() or d.groupby('sample').group.nunique().max()!=1:raise ValueError('Every sample needs all variables and one group')
        if (d.axis_min>=d.axis_max).any() or d.groupby('variable')[['axis_min','axis_max']].nunique().max().max()!=1 or (d.value<d.axis_min).any() or (d.value>d.axis_max).any():raise ValueError('Each axis needs consistent bounds containing all its values')
    elif view=='synergy_surface_result':
        if d.method.nunique()!=1 or len(d)!=d.dose_a.nunique()*d.dose_b.nunique() or min(d.dose_a.nunique(),d.dose_b.nunique())<2 or max(d.dose_a.nunique(),d.dose_b.nunique())>30:raise ValueError('Supply a complete 2–30 by 2–30 surface and one documented interaction method')
        if (d[['dose_a','dose_b']]<0).any().any():raise ValueError('Concentrations cannot be negative')
    elif view=='missingness_matrix':
        if not d.observed.isin([0,1]).all() or len(d)!=d['sample'].nunique()*d.variable.nunique() or d['sample'].nunique()>20 or d.variable.nunique()>12:raise ValueError('Provide a complete binary matrix, at most twenty samples by twelve variables')
    elif view=='euler_two_sets':
        if d['set'].nunique()!=2:raise ValueError('Area-proportional Euler layout needs exactly two nonempty sets')
    elif view=='muller_lineages':
        if (d.abundance<0).any() or d.groupby('time').abundance.sum().le(0).any() or len(d)!=d.clone.nunique()*d.time.nunique() or d.clone.nunique()>8 or d.time.nunique()<2:raise ValueError('Provide 2+ time points for at most eight clones, with nonnegative exclusive abundances and positive totals')
        if d.groupby('clone').parent.nunique().max()!=1:raise ValueError('Each clone needs exactly one parent')
        _lineage(d)
    elif view=='chord_flows':
        if (d.value<=0).any() or len(set(d.source)|set(d.target))>8 or len(d)>28:raise ValueError('Use positive flows, at most eight nodes and twenty-eight links')
    elif view=='mediation_paths_result':
        if not ((d.lower<=d.estimate)&(d.estimate<=d.upper)).all() or d.method.nunique()!=1:raise ValueError('Intervals must contain estimates; supply one documented model')
        nodes=set(d.source)|set(d.target);sources=nodes-set(d.target);targets=nodes-set(d.source)
        if len(nodes)!=3 or len(d)!=3 or len(sources)!=1 or len(targets)!=1 or (d.source==d.target).any():raise ValueError('Supply the three paths of an exposure–mediator–outcome model')
    elif view=='fagan_nomogram':
        if not ((d.pretest>0)&(d.pretest<1)&(d.likelihood_ratio>0)).all() or len(d)>3:raise ValueError('Use 0 < probability < 1, positive likelihood ratios, and at most three scenarios')
    elif view=='tornado_sensitivity':
        if d.baseline.nunique()!=1 or len(d)>12:raise ValueError('Use a single common baseline and at most twelve parameters')
    return d


def render(data,view,colors=None,figsize=(4.8,3.6)):
    d=validate(data,view);c=list(colors or PALETTE);c=(c*4)[:24]
    plt.rcParams.update({'font.family':font_families(),'font.size':8,'axes.labelsize':9,'svg.fonttype':'none'})
    fig,ax=_axes(figsize);seq=LinearSegmentedColormap.from_list('structure_seq',['#eef2f7',c[0]]);div=LinearSegmentedColormap.from_list('structure_div',[c[0],'#f5f6f8',c[1]])
    if view=='parallel_coordinates':
        variables=_unique(d.variable);groups=_unique(d.group);m=d.pivot(index='sample',columns='variable',values='value')[variables];bounds=d.groupby('variable')[['axis_min','axis_max']].first().loc[variables];normed=(m-bounds.axis_min)/(bounds.axis_max-bounds.axis_min)
        for sample,row in normed.iterrows():
            group=d.loc[d['sample']==sample,'group'].iloc[0];ax.plot(range(len(variables)),row.to_numpy(),color=c[groups.index(group)],alpha=.35,lw=.8)
        for i,name in enumerate(variables):
            ax.vlines(i,0,1,lw=.75,color='#9eabbd');ax.text(i,1.055,f'{bounds.loc[name,"axis_max"]:g}',ha='center',fontsize=8,gid=f'studio-spacing-group-{i}-label-0');ax.text(i,-.065,f'{bounds.loc[name,"axis_min"]:g}',ha='center',va='top',fontsize=8,gid=f'studio-spacing-group-{i}-label-1')
        ax.set(xticks=range(len(variables)),xticklabels=[_wrap(x,12) for x in variables],ylim=(-.13,1.12));ax.set_yticks([]);ax.spines[['left','right','top','bottom']].set_visible(False);ax.tick_params(axis='x',length=0,pad=5);ax.set_xlim(-.25,len(variables)-.75);_legend(fig,[Line2D([],[],color=c[i]) for i in range(len(groups))],groups)
    elif view=='synergy_surface_result':
        ax.remove();ax=fig.add_axes([.03,.11,.90,.72],projection='3d');m=d.pivot(index='dose_b',columns='dose_a',values='score');x,y=np.meshgrid(m.columns.to_numpy(),m.index.to_numpy());z=m.to_numpy();limit=max(abs(z.min()),abs(z.max()),1e-9)
        surf=ax.plot_surface(x,y,z,cmap=div,vmin=-limit,vmax=limit,edgecolor='white',lw=.22,antialiased=True,rasterized=False);ax.view_init(25,-125);ax.set_box_aspect((1.3,1,.65));ax.set_xlabel('Drug A dose',fontsize=8,labelpad=1);ax.set_ylabel('Drug B dose',fontsize=8,labelpad=1);ax.tick_params(labelsize=8,pad=0);ax.xaxis.set_major_locator(plt.MaxNLocator(3));ax.yaxis.set_major_locator(plt.MaxNLocator(3));ax.zaxis.set_major_locator(plt.MaxNLocator(3));ax.grid(False)
        for pane in [ax.xaxis.pane,ax.yaxis.pane,ax.zaxis.pane]:pane.fill=False;pane.set_edgecolor('#e0e6ee')
        ca=fig.add_axes([.25,.91,.50,.025]);cb=fig.colorbar(surf,cax=ca,orientation='horizontal');cb.set_label('Supplied interaction score',fontsize=8,labelpad=2);cb.ax.xaxis.set_label_position('top');cb.ax.tick_params(labelsize=8,length=2);cb.outline.set_visible(False);cb.solids.set_rasterized(False)
        fig.text(.5,.028,textwrap.fill(d.method.iloc[0],max(30,int(figsize[0]*10))),ha='center',fontsize=8,color='#64758c')
    elif view=='missingness_matrix':
        m=d.pivot(index='sample',columns='variable',values='observed');ax.set_position([.21,.24,.74,.51]);_matrix(ax,m.to_numpy(),m.index,m.columns,seq,0,1)
        top=fig.add_axes([.21,.81,.74,.12],sharex=ax);top.bar(range(m.shape[1]),(1-m.mean())*100,width=.7,color=c[1]);top.set_ylim(0,100);top.tick_params(axis='x',bottom=False,labelbottom=False);top.set_yticks([0,100]);top.tick_params(axis='y',labelsize=8);top.set_ylabel('Missing\n(%)',fontsize=8,labelpad=4);top.spines[['top','right']].set_visible(False);_legend(fig,[Rectangle((0,0),1,1,fc='#eef2f7'),Rectangle((0,0),1,1,fc=c[0])],['Missing','Observed'])
    elif view=='euler_two_sets':
        names=_unique(d['set']);a=set(d.loc[d['set']==names[0],'sample']);b=set(d.loc[d['set']==names[1],'sample']);r1=np.sqrt(len(a)/np.pi);r2=np.sqrt(len(b)/np.pi);shared=len(a&b)
        if shared==0:dist=r1+r2+max(r1,r2)*.08
        elif shared==min(len(a),len(b)):dist=abs(r1-r2)
        else:dist=brentq(lambda z:circle_overlap(r1,r2,z)-shared,abs(r1-r2)+1e-10,r1+r2-1e-10)
        scale=max(r1,r2);left=-dist/2;right=dist/2
        for x,r,col in [(left,r1,c[0]),(right,r2,c[1])]:ax.add_patch(Circle((x,0),r,fc=col,ec=col,alpha=.26,lw=1.1))
        ax.set(xlim=(min(left-r1,right-r2)-.12*scale,max(left+r1,right+r2)+.12*scale),ylim=(-1.15*scale,1.15*scale),aspect='equal');ax.axis('off');_legend(fig,[Circle((0,0),1,fc=c[0],alpha=.5),Circle((0,0),1,fc=c[1],alpha=.5)],[f'{names[0]} ({len(a)})',f'{names[1]} ({len(b)})'])
        fig.text(.5,.11,f'Only A: {len(a-b)}   Shared: {shared}   Only B: {len(b-a)}',ha='center',fontsize=8,color='#495f79')
    elif view=='muller_lineages':
        nodes,parent,children=_lineage(d);m=d.pivot(index='time',columns='clone',values='abundance').sort_index();m=m.div(m.sum(axis=1),axis=0);x=m.index.to_numpy();totals={}
        def total(node):
            totals[node]=m[node].to_numpy()+sum((total(child) for child in children[node]),np.zeros(len(m)))
            return totals[node]
        roots=[n for n in nodes if parent[n]=='ROOT']
        for n in roots:total(n)
        def draw(node,bottom):
            ax.fill_between(x,bottom,bottom+totals[node],color=c[nodes.index(node)],lw=0);offset=bottom+m[node].to_numpy()/2
            for child in children[node]:draw(child,offset);offset=offset+totals[child]
        bottom=np.zeros(len(m))
        for n in roots:draw(n,bottom);bottom+=totals[n]
        _finish(ax,'Time','Clone fraction');ax.set(xlim=(x.min(),x.max()),ylim=(0,1));_legend(fig,[Rectangle((0,0),1,1,fc=c[i]) for i in range(len(nodes))],nodes,ncol=4)
    elif view=='chord_flows':
        nodes=_unique(pd.concat([d.source,d.target]));totals={n:d.loc[d.source==n,'value'].sum()+d.loc[d.target==n,'value'].sum() for n in nodes};gap=.04;units=(2*np.pi-len(nodes)*gap)/sum(totals.values());start=0;arcs={};offset={}
        for i,n in enumerate(nodes):
            end=start+totals[n]*units;arcs[n]=(start,end);offset[n]=start;ax.add_patch(Wedge((0,0),1.03,np.rad2deg(start),np.rad2deg(end),width=.10,fc=c[i],ec='white',lw=.6));mid=(start+end)/2;ax.text(1.22*np.cos(mid),1.22*np.sin(mid),_wrap(n,10),ha='center',va='center',fontsize=8);start=end+gap
        for r in d.itertuples():
            a0=offset[r.source];a1=a0+r.value*units;offset[r.source]=a1;b0=offset[r.target];b1=b0+r.value*units;offset[r.target]=b1
            aa=np.linspace(a0,a1,12);bb=np.linspace(b0,b1,12);A=np.c_[np.cos(aa),np.sin(aa)]*.92;B=np.c_[np.cos(bb),np.sin(bb)]*.92
            verts=[tuple(A[0])]+[tuple(p) for p in A[1:]]+[(0,0),(0,0),tuple(B[0])]+[tuple(p) for p in B[1:]]+[(0,0),(0,0),tuple(A[0]),tuple(A[0])]
            codes=[Path.MOVETO]+[Path.LINETO]*11+[Path.CURVE4]*3+[Path.LINETO]*11+[Path.CURVE4]*3+[Path.CLOSEPOLY]
            ax.add_patch(PathPatch(Path(verts,codes),fc=c[nodes.index(r.source)],ec='white',lw=.25,alpha=.35))
        ax.set(xlim=(-1.55,1.55),ylim=(-1.55,1.55),aspect='equal');ax.axis('off');fig.text(.5,.05,'Ribbon colour: source · arc width: flow',ha='center',fontsize=8,color='#65748a')
    elif view=='mediation_paths_result':
        nodes=set(d.source)|set(d.target);source=next(iter(nodes-set(d.target)));target=next(iter(nodes-set(d.source)));mediator=next(iter(nodes-{source,target}));pos={source:(0,.2),mediator:(.5,.83),target:(1,.2)};texts={}
        ax.set_position([.04,.18,.92,.70]);ax.set(xlim=(-.22,1.22),ylim=(-.16,1.12));ax.axis('off')
        for n,p in pos.items():texts[n]=ax.text(*p,_wrap(n,13),ha='center',va='center',fontsize=8,bbox=dict(boxstyle='round,pad=.6',fc='#f2f5f9',ec=c[0],lw=.9),zorder=3)
        fig.canvas.draw()
        for r in d.itertuples():
            a=np.array(pos[r.source]);b=np.array(pos[r.target]);direct=r.source==source and r.target==target
            ax.add_patch(FancyArrowPatch(a,b,patchA=texts[r.source].get_bbox_patch(),patchB=texts[r.target].get_bbox_patch(),arrowstyle='-|>',mutation_scale=11,shrinkA=4,shrinkB=4,lw=1,color='#7b8fa7'))
            midpoint=(a+b)/2;midpoint[1]+=(-.22 if direct else .12)
            ax.text(*midpoint,f'{r.estimate:.2f}\n[{r.lower:.2f}, {r.upper:.2f}]',ha='center',va='center',fontsize=8,color='#344d6d',bbox=dict(fc='white',ec='none',pad=1))
        fig.text(.5,.055,'Supplied path estimate [interval]',ha='center',fontsize=8,color='#65748a')
    elif view=='fagan_nomogram':
        pre=-logit(d.pretest.to_numpy());lr=.5*np.log(d.likelihood_ratio.to_numpy());post=logit(d.pretest.to_numpy())+np.log(d.likelihood_ratio.to_numpy());extent=max(4.7,max(abs(np.r_[pre,lr,post]))*1.08);ax.set(xlim=(-.22,2.22),ylim=(-extent,extent));ax.axis('off');fig.subplots_adjust(left=.07,right=.94,bottom=.23,top=.86)
        for x in [0,1,2]:ax.vlines(x,-extent*.95,extent*.95,color='#73859d',lw=.8)
        probs=np.array([.01,.05,.1,.2,.5,.8,.9,.95,.99]);ratios=np.array([.01,.1,1,10,100])
        for x,ys,labels in [(0,-logit(probs),[f'{p*100:g}' for p in probs]),(1,.5*np.log(ratios),[f'{r:g}' for r in ratios]),(2,logit(probs),[f'{p*100:g}' for p in probs])]:
            last=-float('inf');gap=14/(figsize[1]*100*.63)*(2*extent)
            for yy,label in sorted(zip(ys,labels)):
                ax.plot([x-.025,x+.025],[yy,yy],color='#73859d',lw=.7)
                if yy-last>=gap:ax.text(x-.055 if x!=2 else x+.055,yy,label,ha='right' if x!=2 else 'left',va='center',fontsize=8);last=yy
        for x,title in [(0,'Pretest\nprobability (%)'),(1,'Likelihood\nratio'),(2,'Post-test\nprobability (%)')]:ax.text(x,extent*1.03,title,ha='center',va='bottom',fontsize=8)
        for i,r in enumerate(d.itertuples()):ax.plot([0,1,2],[pre[i],lr[i],post[i]],color=c[i],lw=1.4,marker='o',ms=3,label=f'{r.scenario}: {expit(post[i]):.1%}')
        _legend(fig,*ax.get_legend_handles_labels(),ncol=2)
    elif view=='tornado_sensitivity':
        baseline=d.baseline.iloc[0];d=d.assign(span=np.maximum(d.low_result,d.high_result)-np.minimum(d.low_result,d.high_result)).sort_values('span',ascending=False);y=np.arange(len(d));ax.barh(y-.13,d.low_result-baseline,left=baseline,height=.23,color=c[0],label='Lower input');ax.barh(y+.13,d.high_result-baseline,left=baseline,height=.23,color=c[1],label='Upper input');ax.axvline(baseline,color='#77899f',ls='--',lw=.8);ax.set(yticks=y,yticklabels=[_wrap(n,17) for n in d.parameter],ylim=(len(d)-.4,-.6));fig.subplots_adjust(left=.34);_finish(ax,'Model outcome','');_legend(fig,*ax.get_legend_handles_labels())
    fig.canvas.draw();return fig


def fixtures():
    rng=np.random.default_rng(7029);out={}
    out['parallel_coordinates']=pd.DataFrame([(f'S{i}',g,var,float(rng.uniform(lo,hi)),lo,hi) for g in ['Control','Treatment'] for i in range(0 if g=='Control' else 10,10 if g=='Control' else 20) for var,lo,hi in [('Measure A',0,100),('Measure B',0,5),('Measure C',20,60),('Measure D',0,1)]],columns=['sample','group','variable','value','axis_min','axis_max'])
    out['synergy_surface_result']=pd.DataFrame([(a,b,float(14*np.exp(-((a-2.6)**2+(b-2.3)**2)/3)-4*np.exp(-(a*a+b*b)/2)),'Synthetic interaction-model result') for a in np.linspace(0,5,12) for b in np.linspace(0,5,12)],columns=['dose_a','dose_b','score','method'])
    out['missingness_matrix']=pd.DataFrame([(f'S{i+1}',v,int(rng.random()>.08*(j+1))) for i in range(12) for j,v in enumerate(['Age','Marker A','Marker B','Outcome','Follow-up'])],columns=['sample','variable','observed'])
    out['euler_two_sets']=pd.DataFrame([(f'S{i}','Set A') for i in range(40)]+[(f'S{i}','Set B') for i in range(26,52)],columns=['sample','set'])
    rows=[]
    for t in range(9):
        b=max(0,min(45,(t-1)*8));c=max(0,min(22,(t-3)*7));e=max(0,min(15,(t-5)*6));a=100-b-c-e
        for clone,parent,v in [('Founder','ROOT',a),('Clone B','Founder',b),('Clone C','Founder',c),('Clone D','Clone B',e)]:rows.append((clone,parent,t,v))
    out['muller_lineages']=pd.DataFrame(rows,columns=['clone','parent','time','abundance'])
    out['chord_flows']=pd.DataFrame([('A','B',12),('A','C',8),('B','C',15),('B','D',7),('C','D',11),('D','A',5)],columns=['source','target','value'])
    out['mediation_paths_result']=pd.DataFrame([('Exposure','Mediator',.48,.29,.66,'Supplied linear mediation model'),('Mediator','Outcome',.36,.18,.55,'Supplied linear mediation model'),('Exposure','Outcome',.17,.02,.32,'Supplied linear mediation model')],columns=['source','target','estimate','lower','upper','method'])
    out['fagan_nomogram']=pd.DataFrame({'scenario':['Positive test','Negative test'],'pretest':[.2,.2],'likelihood_ratio':[5.,.18]})
    out['tornado_sensitivity']=pd.DataFrame({'parameter':['Baseline risk','Treatment effect','Unit cost','Adherence','Discount rate'],'baseline':100,'low_result':[65,79,89,93,97],'high_result':[139,124,112,108,104]})
    return out
