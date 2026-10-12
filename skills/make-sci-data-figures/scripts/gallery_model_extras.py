"""Editable model-result views. All fitted/explanation results are supplied inputs."""
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from gallery_fonts import font_families
from matplotlib.colors import LinearSegmentedColormap,Normalize
from matplotlib.lines import Line2D
from matplotlib.ticker import MaxNLocator
from gallery_compare import PALETTE,_wrap,_style,_legend,_swarm

CONTRACTS={
 'model_nomogram':('模型积分列线图','Model-point nomogram','effects','role variable order position tick','order position'),
 'model_shap_summary':('SHAP 贡献汇总','SHAP contribution summary','relationship','unit feature shap_value feature_value','shap_value feature_value'),
 'model_facet_relationship':('分面关系与拟合结果','Faceted relationships and fits','relationship','facet unit role x y','x y'),
 'model_deming_results':('Deming 回归结果','Deming regression results','relationship','unit role x y','x y'),
 'model_ice_pdp':('个体条件期望与部分依赖','Individual conditional expectation and partial dependence','relationship','unit kind x y','x y'),
 'model_partial_residual':('偏残差与模型分量','Partial residual and fitted component','relationship','unit role x y','x y'),
 'model_quantile_results':('分位数回归结果','Quantile-regression results','relationship','unit role quantile x y','quantile x y'),
 'model_bootstrap_distribution':('Bootstrap 估计量分布','Bootstrap estimate distribution','effects','replicate estimate observed','estimate observed'),
}
NOTES={
 'model_nomogram':('提供已验证模型各刻度的公共位置（position 为 0–1）、标签和行顺序；role 为 points、predictor、total 或 probability。积分及概率转换由原模型提供。','Supply positions on each validated model scale (0–1), tick labels and row order; role is points, predictor, total or probability. Model-point and probability mappings come from the fitted model.'),
 'model_shap_summary':('提供已计算的每个对象各特征 SHAP 值及原特征值；颜色为每个特征内部的相对高低，横轴保持模型解释输出单位，不推断因果。','Supply each subject-feature SHAP value and original feature value. Colour denotes within-feature relative value; horizontal units remain the explanation output units, without causal interpretation.'),
 'model_facet_relationship':('各分面提供 observation 和 fit 坐标；共享坐标范围，呈现原始分布与已经拟合的关系，不自动为各分面选择模型。','Each facet supplies observation and fit coordinates. Shared ranges show the data structure and existing fits without automatic model selection.'),
 'model_deming_results':('提供 observation 与已完成 Deming 分析的 fit 坐标；测量误差方差比由原分析确定。本模板不把普通回归冒充 Deming 回归。','Supply observation and fit coordinates from a completed Deming analysis, whose measurement-error variance ratio is determined externally. No OLS line is relabelled as Deming regression.'),
 'model_ice_pdp':('kind 为 ice 或 pdp；每个 unit 一条已计算曲线，同一特征坐标与输出尺度。PDP 曲线由原分析提供，不自动将任意 ICE 样本均值当作总体 PDP。','kind is ice or pdp; each unit identifies a calculated curve on the same feature/output scale. PDP is supplied, not inferred from an arbitrary sample of ICE curves.'),
 'model_partial_residual':('role 为 partial_residual 或 fit；提供同一已拟合模型的分量加残差与分量曲线，保留所用连接函数及尺度。','role is partial_residual or fit; supply component-plus-residual values and the component curve from the same fitted model, retaining its link and scale.'),
 'model_quantile_results':('observation 行的 quantile 为 0（不参与分位曲线）；fit 行使用 0–1 之间的分位数，各分位结果来自已完成的分析。','For observation rows, quantile is 0 and ignored; fit rows use quantiles strictly between 0 and 1, from a completed quantile-regression analysis.'),
 'model_bootstrap_distribution':('提供重采样估计量和原样本估计值；标示中间 95% 的重采样分位范围，该范围不自动等同 BCa 或其他方法的置信区间。','Supply bootstrap estimates and the original estimate. The central 95% bootstrap quantile range is shown; it is not automatically a BCa or other confidence interval.'),
}
REFERENCE_MAP={29:'model_nomogram',30:'model_shap_summary',51:'model_facet_relationship',72:'model_deming_results',76:'model_ice_pdp',88:'model_partial_residual',100:'model_quantile_results',101:'model_bootstrap_distribution'}
SOURCE_MAP={}
PRESERVE_ASPECT={'model_nomogram','model_facet_relationship','model_deming_results'}
COMPATIBLE_GROUPS=[]
COLUMN_LABELS={'role':('行类型','Row type'),'variable':('变量名称','Variable'),'order':('刻度行顺序','Scale row order'),'position':('刻度相对位置','Relative scale position'),'tick':('刻度标签','Tick label'),'unit':('对象或曲线编号','Subject or curve ID'),'feature':('特征名称','Feature'),'shap_value':('SHAP 贡献值','SHAP contribution'),'feature_value':('原特征值','Original feature value'),'facet':('分面名称','Facet'),'x':('横轴值','X coordinate'),'y':('输出值','Output value'),'kind':('ICE 或 PDP','ICE or PDP'),'quantile':('分位数','Quantile'),'replicate':('重采样编号','Bootstrap replicate'),'estimate':('重采样估计量','Bootstrap estimate'),'observed':('原样本估计值','Original estimate')}

def validate(data,view):
 if view not in CONTRACTS:raise ValueError('Unknown model-result template')
 required=CONTRACTS[view][3].split();numeric=CONTRACTS[view][4].split()
 if not set(required)<=set(data):raise ValueError('Required columns: '+', '.join(required))
 d=data.copy()
 if d.empty or d[required].isna().any().any():raise ValueError('Required fields must be nonempty')
 for col in numeric:
  d[col]=pd.to_numeric(d[col],errors='raise')
  if not np.isfinite(d[col]).all():raise ValueError('Numeric results must be finite')
 for col in set(required)-set(numeric):
  d[col]=d[col].astype(str)
  if d[col].str.strip().eq('').any():raise ValueError('Labels must not be empty')
 if view=='model_nomogram':
  if not set(d.role)<={'points','predictor','total','probability'} or not {'predictor','total','probability'}<=set(d.role):raise ValueError('A nomogram needs predictor, total and probability scales')
  if not d.position.between(0,1).all() or (d.groupby('variable')[['order','role']].nunique()>1).any().any():raise ValueError('Each scale has one row and role, and positions in [0,1]')
  if d.groupby('order').variable.nunique().max()>1 or d.duplicated(['variable','position']).any() or d.groupby('variable').size().min()<2:raise ValueError('Unique scale rows and at least two distinct ticks per scale')
  if d.variable.nunique()>8 or d.groupby('variable').size().max()>8:raise ValueError('Use up to eight scales and eight ticks per scale')
 elif view=='model_shap_summary':
  if d.duplicated(['unit','feature']).any() or d.feature.nunique()>10:raise ValueError('Unique subject-feature values, at most ten features')
  if len(d)!=d.unit.nunique()*d.feature.nunique():raise ValueError('SHAP summary requires complete subject-feature contributions')
 elif view=='model_bootstrap_distribution':
  if d.replicate.duplicated().any() or d.observed.nunique()!=1 or len(d)<40 or d.estimate.nunique()<3:raise ValueError('Supply 40+ distinct replicates and one original estimate')
 elif view=='model_ice_pdp':
  if set(d.kind)!={'ice','pdp'} or d[d.kind=='pdp'].unit.nunique()!=1 or d[d.kind=='ice'].unit.nunique()>80:raise ValueError('Supply one PDP curve and 1–80 ICE curves')
  if d.duplicated(['unit','kind','x']).any():raise ValueError('Unique X positions per curve required')
  grids=[tuple(v.sort_values('x').x) for _,v in d.groupby(['unit','kind'])]
  if len(set(grids))!=1 or len(grids[0])<4:raise ValueError('ICE/PDP curves must share at least four X coordinates')
 else:
  obsrole='partial_residual' if view=='model_partial_residual' else 'observation'
  if set(d.role)!={obsrole,'fit'}:raise ValueError('Supply '+obsrole+' and fit rows')
  groupcols=['facet'] if view=='model_facet_relationship' else ['quantile'] if view=='model_quantile_results' else []
  if view=='model_facet_relationship' and not 2<=d.facet.nunique()<=4:raise ValueError('Use two to four facets')
  if view=='model_quantile_results':
   if not ((d.loc[d.role=='fit','quantile']>0)&(d.loc[d.role=='fit','quantile']<1)).all() or d.loc[d.role=='fit','quantile'].nunique()>5:raise ValueError('Use up to five fitted quantiles strictly between zero and one')
   if not d.loc[d.role=='observation','quantile'].eq(0).all():raise ValueError('Observation rows use quantile 0 as a non-fitted marker')
  fit=d[d.role=='fit'];pieces=fit.groupby(groupcols) if groupcols else [('fit',fit)]
  for _,rows in pieces:
   if len(rows)<4 or rows.x.duplicated().any():raise ValueError('Each fitted curve needs four unique X coordinates')
  if view=='model_facet_relationship' and any(set(rows.role)!={'observation','fit'} for _,rows in d.groupby('facet')):raise ValueError('Every facet needs observations and fitted results')
  if view=='model_quantile_results':
   grids=[tuple(q.sort_values('x').x) for _,q in fit.groupby('quantile')]
   if len(set(grids))>1:raise ValueError('Use one common X grid for quantile curves')
  if d.duplicated(['role','unit']+groupcols).any():raise ValueError('Duplicate result row IDs')
 return d

def render(data,view,colors=None,figsize=(4.8,3.6)):
 d=validate(data,view);c=list(colors or PALETTE)
 plt.rcParams.update({'svg.fonttype':'none','font.family':font_families(),'font.size':8,'axes.linewidth':.75})
 fig,ax=plt.subplots(figsize=figsize,layout='constrained');fig.get_layout_engine().set(w_pad=.07,h_pad=.07,wspace=.08,hspace=.08)
 if view=='model_nomogram':
  scales=sorted(d.groupby('variable'),key=lambda pair:pair[1].order.iloc[0]);ax.set_xlim(-.03,1.04);ax.set_ylim(len(scales)-.6,-.65);ax.axis('off')
  for row,(name,q) in enumerate(scales):
   q=q.sort_values('position');ax.plot([q.position.min(),q.position.max()],[row,row],color='#697C94',lw=1)
   for j,r in enumerate(q.itertuples()):
    ax.plot([r.position]*2,[row-.045,row+.045],color='#697C94',lw=.8);ax.text(r.position,row+.10,_wrap(r.tick,8),ha='center',va='top',fontsize=8)
   ax.text(0,row-.20,_wrap(name,40),ha='left',va='bottom',fontsize=8,fontweight='bold' if q.role.iloc[0] in {'total','probability'} else 'normal',color=c[0])
 elif view=='model_shap_summary':
  features=d.groupby('feature').shap_value.apply(lambda v:abs(v).mean()).sort_values().index;cmap=LinearSegmentedColormap.from_list('shap_original',[c[0],'#EDF0F5',c[1]])
  for i,name in enumerate(features):
   q=d[d.feature==name];values=q.feature_value.to_numpy();relative=(values-values.min())/(np.ptp(values) or 1);ax.scatter(q.shap_value,i+_swarm(q.shap_value,width=.27),c=relative,cmap=cmap,vmin=0,vmax=1,s=14,alpha=.85,lw=.15,edgecolors='white')
  ax.axvline(0,color='#B8C2CF',lw=.8);_style(ax,'SHAP contribution');ax.set_yticks(range(len(features)),[_wrap(v,20) for v in features]);ax.margins(y=.13);cb=fig.colorbar(plt.cm.ScalarMappable(norm=Normalize(0,1),cmap=cmap),ax=ax,fraction=.03,pad=.035,aspect=28);cb.set_ticks([0,1],labels=['Low','High']);cb.set_label('Feature value',fontsize=8,labelpad=3);cb.ax.tick_params(labelsize=8,length=0,pad=1);cb.solids.set_rasterized(False)
  def compound_layout(frame):
   left,bottom,width,height=frame;page_width=fig.get_figwidth()*72
   ax.set_position(frame);cb.ax.set_axes_locator(None);cb.ax.set_box_aspect(None);cb.ax.set_aspect('auto')
   cb.ax.set_position((left+width+8/page_width,bottom,7/page_width,height))
  fig._studio_main_axes=[ax];fig._studio_compound_layout=compound_layout
 elif view=='model_facet_relationship':
  names=list(d.facet.unique());fig.delaxes(ax);axes=fig.subplots(2 if len(names)>2 else 1,2,sharex=True,sharey=True,squeeze=False).ravel()
  for i,name in enumerate(names):
   a=axes[i];q=d[d.facet==name];obs=q[q.role=='observation'];fit=q[q.role=='fit'].sort_values('x');a.scatter(obs.x,obs.y,color=c[0],s=14,alpha=.65,edgecolor='white',lw=.3);a.plot(fit.x,fit.y,color=c[1],lw=1.3);_style(a,'X' if i>=len(names)-2 else '', 'Y' if i%2==0 else '');a.set_title(_wrap(name,18),fontsize=9,pad=7);a.xaxis.set_major_locator(MaxNLocator(3));a.yaxis.set_major_locator(MaxNLocator(3))
  for a in axes[len(names):]:a.set_visible(False)
 elif view=='model_ice_pdp':
  for _,q in d[d.kind=='ice'].groupby('unit'):q=q.sort_values('x');ax.plot(q.x,q.y,color=c[0],alpha=.16,lw=.65)
  q=d[d.kind=='pdp'].sort_values('x');ax.plot(q.x,q.y,color=c[1],lw=2,label='PDP');_style(ax,'Feature value','Model response');ax.legend([Line2D([],[],color=c[0],lw=.8,alpha=.5),Line2D([],[],color=c[1],lw=2)],['Individual curves','PDP'],loc='lower left',bbox_to_anchor=(0,1.02),frameon=False,fontsize=8,ncol=2)
 elif view=='model_bootstrap_distribution':
  low,high=np.quantile(d.estimate,[.025,.975]);ax.hist(d.estimate,bins='fd',density=True,color=c[0],alpha=.40,edgecolor='white',lw=.5);ax.axvspan(low,high,color=c[0],alpha=.07);ax.axvline(low,color=c[0],lw=1,ls='--');ax.axvline(high,color=c[0],lw=1,ls='--');ax.axvline(d.observed.iloc[0],color=c[1],lw=1.5);_style(ax,'Bootstrap estimate','Density');ax.legend([Line2D([],[],color=c[1],lw=1.5),Line2D([],[],color=c[0],ls='--')],['Original estimate','2.5% and 97.5% quantiles'],loc='lower left',bbox_to_anchor=(0,1.02),frameon=False,fontsize=8,ncol=1)
 else:
  obsrole='partial_residual' if view=='model_partial_residual' else 'observation';obs=d[d.role==obsrole];ax.scatter(obs.x,obs.y,s=16,color=c[0],alpha=.6,edgecolor='white',lw=.3)
  if view=='model_quantile_results':
   for i,(q,rows) in enumerate(d[d.role=='fit'].groupby('quantile')):rows=rows.sort_values('x');ax.plot(rows.x,rows.y,color=c[i%len(c)],ls=['--','-','-.',':','--'][i],lw=1.5,label=f'Quantile {q:g}')
   _legend(ax,columns=2)
  else:
   curve=d[d.role=='fit'].sort_values('x');ax.plot(curve.x,curve.y,color=c[1],lw=1.5,label='Deming fit' if view=='model_deming_results' else 'Fitted component');_legend(ax,columns=1)
  _style(ax,'Method A' if view=='model_deming_results' else 'Feature value','Method B' if view=='model_deming_results' else 'Component + residual' if view=='model_partial_residual' else 'Response')
 return fig

def fixtures():
 rng=np.random.default_rng(709);out={};rows=[]
 risk=1/(1+np.exp(-(-4+.02*np.linspace(0,260,5))))
 for order,(role,name,values) in enumerate([('points','Points',[0,20,40,60,80,100]),('predictor','Age (years)',[30,40,50,60,70,80]),('predictor','Marker level',[0,2,4,6,8,10]),('predictor','Stage',['I','II','III']),('total','Total points',[0,65,130,195,260]),('probability','Event probability',[f'{v:.1%}' for v in risk])]):
  positions=[0,.3,.6] if name=='Stage' else np.linspace(0,1,len(values))
  for pos,tick in zip(positions,values):rows.append([role,name,order,float(pos),str(tick)])
 out['model_nomogram']=pd.DataFrame(rows,columns=['role','variable','order','position','tick'])
 n=75;x=rng.uniform(-2,2,(n,5));coef=np.array([1.5,-1,.7,.35,-.15]);sv=x*coef;out['model_shap_summary']=pd.DataFrame([[f'S{i}',f'Feature {j+1}',sv[i,j],x[i,j]] for i in range(n) for j in range(5)],columns=['unit','feature','shap_value','feature_value'])
 grid=np.linspace(0,10,40);rows=[]
 for j,name in enumerate(['Linear relation','Curved relation','Changing spread','Influential observation']):
  xx=np.linspace(1,9,22);yy=1+.7*xx+rng.normal(0,[.65,.6,1.4,.45][j],len(xx))
  if j==1:yy=6-.16*(xx-5)**2+rng.normal(0,.4,len(xx))
  if j==2:yy=1+.7*xx+rng.normal(0,xx*.23,len(xx))
  if j==3:yy[-1]+=6
  for i,(a,b) in enumerate(zip(xx,yy)):rows.append([name,f'S{i}','observation',a,b])
  fitted=np.polyval(np.polyfit(xx,yy,2 if j==1 else 1),grid)
  for i,(a,b) in enumerate(zip(grid,fitted)):rows.append([name,f'F{i}','fit',a,b])
 out['model_facet_relationship']=pd.DataFrame(rows,columns=['facet','unit','role','x','y'])
 xx=np.linspace(1,10,40)+rng.normal(0,.3,40);yy=.4+1.08*xx+rng.normal(0,.4,40);sxx=xx.var(ddof=1);syy=yy.var(ddof=1);sxy=np.cov(xx,yy)[0,1];slope=(syy-sxx+np.sqrt((syy-sxx)**2+4*sxy*sxy))/(2*sxy);intercept=yy.mean()-slope*xx.mean()
 obs=pd.DataFrame({'unit':[f'S{i}' for i in range(len(xx))],'role':'observation','x':xx,'y':yy});fit=pd.DataFrame({'unit':[f'F{i}' for i in range(len(grid))],'role':'fit','x':grid,'y':intercept+slope*grid});out['model_deming_results']=pd.concat([obs,fit],ignore_index=True)
 curves=np.array([1+.25*grid+.16*np.maximum(grid-4,0)**2+intercept for intercept in rng.normal(0,.7,24)]);rows=[[f'S{i}','ice',a,b] for i,values in enumerate(curves) for a,b in zip(grid,values)]+[['Population','pdp',a,b] for a,b in zip(grid,curves.mean(axis=0))];out['model_ice_pdp']=pd.DataFrame(rows,columns=['unit','kind','x','y'])
 xx=rng.uniform(0,10,80);yy=.25*xx+.06*xx**2+rng.normal(0,.8,len(xx));out['model_partial_residual']=pd.concat([pd.DataFrame({'unit':[f'S{i}' for i in range(len(xx))],'role':'partial_residual','x':xx,'y':yy}),pd.DataFrame({'unit':[f'F{i}' for i in range(len(grid))],'role':'fit','x':grid,'y':.25*grid+.06*grid**2})],ignore_index=True)
 xx=rng.uniform(0,10,120);yy=2+.6*xx+rng.normal(0,.4+.15*xx);rows=[[f'S{i}','observation',0,a,b] for i,(a,b) in enumerate(zip(xx,yy))]
 from scipy.optimize import linprog
 # Genuine linear quantile fits for the synthetic fixture, using the check loss.
 design=np.column_stack([np.ones(len(xx)),xx]);neq=len(xx);matrix=np.column_stack([design,np.eye(neq),-np.eye(neq)])
 for q in [.1,.5,.9]:
  result=linprog(np.r_[0,0,np.repeat(q,neq),np.repeat(1-q,neq)],A_eq=matrix,b_eq=yy,bounds=[(None,None),(None,None)]+[(0,None)]*(2*neq),method='highs');assert result.success
  for i,a in enumerate(grid):rows.append([f'F{i}','fit',q,a,result.x[0]+result.x[1]*a])
 out['model_quantile_results']=pd.DataFrame(rows,columns=['unit','role','quantile','x','y'])
 raw=rng.lognormal(.3,.5,60);est=np.array([rng.choice(raw,len(raw),replace=True).mean() for _ in range(600)]);out['model_bootstrap_distribution']=pd.DataFrame({'replicate':[f'B{i}' for i in range(len(est))],'estimate':est,'observed':raw.mean()})
 return out
