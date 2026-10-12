"""Reflow the selected ROC view using its original observations or supplied results."""
import io
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from gallery_registry import SIZES
from figure_workbench import style,resolve_palette
from gallery_marks import prepare_marks, embed_marks

def render_reflow(data,recipe,dimensions):
    """Render one raw-data ROC view, without generating other views or sizes."""
    from advanced_template_workbench import _roc_points,_trapezoid
    from roc_explorer import render_views
    from gallery_fonts import apply_font_fallback
    selected=recipe.get('studio_view');params=recipe.get('parameters',{})
    if selected not in {'roc_pointwise_band','roc_bootstrap_curves'}:
        raise ValueError('This ROC view is not available for exact-size reflow.')
    required={'outcome','score','unit'};allowed=required|{'cohort','positive'}
    if not isinstance(params,dict) or not required.issubset(params) or not set(params).issubset(allowed):
        raise ValueError('ROC parameters must specify outcome, score and unit columns; cohort and positive are optional.')
    columns=[]
    for role in ('outcome','score','unit','cohort'):
        column=params.get(role)
        if role=='cohort' and column is None:continue
        if not isinstance(column,str) or column not in data.columns:
            raise ValueError('ROC column is missing: '+role)
        columns.append(column)
    if len(columns)!=len(set(columns)):
        raise ValueError('ROC data roles must use distinct columns.')
    frame=data.copy(deep=True)
    for column in columns:
        if frame[column].isna().any() or frame[column].astype(str).str.strip().eq('').any():
            raise ValueError('ROC data must not contain missing values in '+column)
    if frame[params['unit']].astype(str).str.strip().duplicated().any():
        raise ValueError('ROC observations must have unique unit identifiers.')
    scores=pd.to_numeric(frame[params['score']],errors='coerce').to_numpy(float)
    if not np.isfinite(scores).all():raise ValueError('ROC scores must be finite numbers.')
    frame[params['score']]=scores
    def label(value):
        text=str(value).strip()
        try:
            number=float(text)
            if np.isfinite(number) and number.is_integer():return str(int(number))
        except (ValueError,OverflowError):pass
        return text
    positive=params.get('positive','1')
    if isinstance(positive,bool) or not isinstance(positive,(str,int,float)) or not str(positive).strip():
        raise ValueError('The positive class must be a nonempty scalar label.')
    if isinstance(positive,float) and not np.isfinite(positive):raise ValueError('Invalid positive class.')
    positive=label(positive);outcomes=frame[params['outcome']].map(label)
    if outcomes.nunique()!=2 or positive not in set(outcomes):
        raise ValueError('ROC data must contain two outcome classes, including the positive class.')
    frame[params['outcome']]=outcomes
    groups=[('all',frame)] if not params.get('cohort') else list(frame.groupby(params['cohort'],sort=False))
    if len(groups)>6:raise ValueError('Exact-size ROC views support at most six cohorts.')
    style(recipe.get('font','Arial'));apply_font_fallback(recipe.get('font','Arial'))
    colors=resolve_palette(recipe.get('palette','zhoy_muted'),recipe.get('colors'),len(groups))
    records=[]
    for i,(level,group) in enumerate(groups):
        truth=group[params['outcome']].eq(positive).to_numpy(int)
        if min(np.count_nonzero(truth),np.count_nonzero(1-truth))<2:
            raise ValueError('Each cohort needs at least two observations in each outcome class.')
        scores=group[params['score']].to_numpy(float)
        x,y,precision,thresholds=_roc_points(truth,scores)
        records.append(dict(fpr=x,tpr=y,precision=precision,thresholds=thresholds,
            color=colors[i%len(colors)],label=str(level),auc=_trapezoid(y,x),truth=truth,scores=scores))
    with plt.rc_context({'svg.fonttype':'none'}):
        figures=render_views(records,figsize=dimensions,views={selected})
        try:
            if len(figures)!=1 or figures[0][0]!=selected:
                raise ValueError('The selected ROC view could not be rendered.')
            output=io.StringIO();figures[0][1].savefig(output,format='svg',metadata={'Date':None})
            return output.getvalue().encode('utf-8')
        finally:
            for _,figure in figures:plt.close(figure)

def render_sizes(source,recipe,analysis):
    family=recipe.get('family');params=recipe.get('parameters',{})
    if family not in ('roc','roc_results'):return
    style(recipe.get('font','Arial'));d=pd.read_csv(source,keep_default_na=False)
    colors=resolve_palette(recipe.get('palette','zhoy_muted'),recipe.get('colors'),8)
    if family=='roc_results':
        from roc_contract_workbench import render
        options={k:v for k,v in params.items() if k!='method'}
        selected='roc_'+params['view']
    else:
        from advanced_template_workbench import _roc_points
        from roc_explorer import render_views
        selected=recipe.get('studio_view','roc');records=[]
        groups=[('all',d)] if not params.get('cohort') else list(d.groupby(params['cohort'],sort=False))
        def label(v):
            if isinstance(v,(int,float,np.integer,np.floating)) and float(v).is_integer():return str(int(v))
            return str(v).strip()
        for i,(level,q) in enumerate(groups):
            truth=q[params['outcome']].map(label).eq(analysis['positive_label']).to_numpy(int)
            scores=q[params['score']].to_numpy(float);x,y,precision,thresholds=_roc_points(truth,scores)
            metric=analysis['metrics'][str(level)]
            records.append(dict(fpr=x,tpr=y,precision=precision,thresholds=thresholds,
                color=colors[i%len(colors)],label=str(level),auc=metric['auc'],
                ci=metric['bootstrap_95_ci'],truth=truth,scores=scores))
    for size,dimensions in SIZES.items():
        if size=='original':continue
        if family=='roc_results':fig=render(d,colors=colors,figsize=dimensions,**options)
        elif selected in ('roc','precision_recall'):
            fig,ax=plt.subplots(figsize=dimensions,layout='constrained')
            for r in records:
                x,y=(r['fpr'],r['tpr']) if selected=='roc' else (r['tpr'],r['precision'])
                ax.plot(x,y,lw=1.4,color=r['color'],label=r['label']+(f" · AUC {r['auc']:.2f}" if selected=='roc' else ''))
            if selected=='roc':ax.plot([0,1],[0,1],color='#b7c1ce',ls=':',lw=.7)
            ax.set(xlim=(0,1),ylim=(0,1.02),xlabel='1 − specificity' if selected=='roc' else 'Recall',ylabel='Sensitivity' if selected=='roc' else 'Precision')
            ax.spines[['top','right']].set_visible(False);ax.tick_params(labelsize=8)
            ax.legend(loc='lower right',frameon=False,fontsize=8)
        elif selected in ('roc_convex','roc_probit'):
            from roc_contract_workbench import render
            table=pd.DataFrame([{'series':r['label'],'role':'curve','x':x,'y':y} for r in records for x,y in zip(r['fpr'],r['tpr'])])
            fig=render(table,selected[4:],colors=colors,figsize=dimensions)
        else:
            result=render_views(records,dimensions,views={selected})
            if not result:raise ValueError('Unsupported ROC size view: '+selected)
            fig=result[0][1]
        try:
            prepare_marks(fig)
            output=io.StringIO();fig.savefig(output,format='svg',metadata={'Date':None})
            yield selected,size,embed_marks(output.getvalue(),fig).encode('utf-8')
        finally:plt.close(fig)
