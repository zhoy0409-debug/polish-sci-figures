"""Explicit data-axis controls for reviewed gallery templates.

Limits are applied to real Matplotlib axes. Observations, estimated quantities,
and statistical results are never transformed or rewritten by this module.
"""
from __future__ import annotations

import json
import math
import re
import xml.etree.ElementTree as ET

AXIS_FIELDS = {'scale', 'major_step', 'major_count', 'minor_count', 'tick_format',
               'decimals', 'tick_side', 'labels_visible'}
STYLE_FIELDS = {'tick_direction', 'tick_length_pt', 'tick_label_size_pt', 'tick_color',
                'axis_width_pt', 'axis_color', 'axis_box', 'axis_visible',
                'title_size_pt', 'title_pad_pt', 'label_pad_pt'}
GEOMETRY_FIELDS = {'plot_width_pt', 'plot_height_pt', 'plot_left_pt', 'plot_bottom_pt'}
AXIS_STYLE_FIELDS = STYLE_FIELDS-{'axis_box'}
FIELDS = {'x_min', 'x_max', 'y_min', 'y_max', 'first_group_gap', 'reference_lines'} | STYLE_FIELDS | GEOMETRY_FIELDS | {a+'_'+k for a in ('x','y') for k in AXIS_FIELDS | AXIS_STYLE_FIELDS}
# Coordinate transformations are reviewed separately from numeric range edits.
# Density/probability/residual and bar-baseline charts retain their native scale.
LOG_VIEWS = {'relation_scatter', 'relation_transparent', 'relation_group_regression',
             'relation_color', 'relation_bubble', 'relation_identity', 'relation_labelled',
             'time_individual_paths', 'time_mean_replicates', 'time_mean_sd',
             'time_mean_band', 'time_small_multiples', 'time_steps', 'time_series'}
CATEGORY_VIEWS = {
    'compare_bar_sd', 'compare_bar_points', 'compare_mean_sd', 'compare_mean_ci',
    'compare_box', 'compare_box_points', 'compare_notched_box', 'compare_violin',
    'compare_violin_box', 'compare_swarm', 'compare_strip_median',
    'compare_raincloud', 'compare_log_points', 'compare_bracket_stars',
    'compare_bracket_p', 'compare_control_symbols', 'compare_paired_lines',
    'compare_interaction', 'compare_facet_boxes', 'compare_dose_trend',
}
NUMERIC_VIEWS = {
    'relation_scatter', 'relation_transparent', 'relation_regression_ci',
    'relation_group_regression', 'relation_color', 'relation_bubble',
    'relation_density_contour', 'relation_density_fill', 'relation_identity',
    'relation_loess', 'relation_model_compare', 'relation_labelled',
    'relation_residual_fitted', 'relation_residual_qq', 'relation_influence',
    'compare_density', 'compare_ecdf', 'compare_hist_facets',
    'time_individual_paths', 'time_mean_replicates', 'time_mean_sd',
    'time_mean_band', 'time_small_multiples', 'time_baseline_change',
    'time_steps', 'time_series', 'time_moving_average', 'time_supplied_fit',
    'time_interrupted', 'time_stacked_area', 'time_percent_area',
    'time_pk_target', 'time_mutant_window',
}
X_ONLY_VIEWS = {'compare_cleveland', 'compare_ridgeline'}


def normalize(settings=None):
    """Null values restore automatic limits; unknown/nonfinite values fail early."""
    if settings is None:
        return {}
    if not isinstance(settings, dict) or set(settings) - FIELDS:
        raise ValueError('Unknown axis setting')
    out = {}
    for key, value in settings.items():
        if value is None:
            continue
        if key == 'reference_lines':
            if not isinstance(value,list) or len(value)>8:
                raise ValueError('Provide at most eight data reference lines')
            lines=[]
            for line in value:
                if not isinstance(line,dict) or set(line)-{'axis','value','style','width','color'} or not {'axis','value'}<=set(line):
                    raise ValueError('A reference line requires axis and value, with optional style, width and color')
                if line['axis'] not in ('x','y'):
                    raise ValueError('Reference line axis must be x or y')
                number=line['value'];width=line.get('width',1.)
                if isinstance(number,bool) or not isinstance(number,(float,int)) or not math.isfinite(number) or abs(number)>1e12:
                    raise ValueError('Reference line value must be finite')
                if isinstance(width,bool) or not isinstance(width,(float,int)) or not math.isfinite(width) or not .1<=width<=8:
                    raise ValueError('Reference line width must be between 0.1 and 8 points')
                style=line.get('style','dashed');color=line.get('color','#7b8799')
                if style not in ('dashed','dotted','solid') or not isinstance(color,str) or not re.fullmatch(r'#[0-9a-fA-F]{6}',color):
                    raise ValueError('Reference line style or hexadecimal colour is invalid')
                lines.append(dict(axis=line['axis'],value=float(number),style=style,width=float(width),color=color))
            if lines:out[key]=lines
            continue
        suffix=key[2:] if key[:2] in ('x_','y_') else key
        enums={'scale':('linear','log'), 'tick_format':('auto','decimal','scientific','percent'),
               'tick_direction':('in','out','inout'), 'axis_box':('left_bottom','full','none'),
               'x_tick_side':('bottom','top','both','none'), 'y_tick_side':('left','right','both','none')}
        enum=enums.get(key,enums.get(suffix))
        if enum is not None:
            if value not in enum:raise ValueError(f'Invalid {key}')
            out[key]=value;continue
        if suffix in ('axis_visible','labels_visible'):
            if type(value) is not bool:raise ValueError(f'{key} must be true or false')
            out[key]=value;continue
        if suffix in ('axis_color','tick_color'):
            if not isinstance(value,str) or not re.fullmatch(r'#[0-9a-fA-F]{6}',value):raise ValueError(f'{key} must be a hexadecimal colour')
            out[key]=value;continue
        if isinstance(value, bool) or not isinstance(value, (float, int)) or not math.isfinite(value):
            raise ValueError(f'{key} must be a finite number or null for automatic limits')
        if abs(value) > 1e12:
            raise ValueError(f'{key} exceeds the supported numerical range')
        out[key] = float(value)
        bounded={'major_step':(1e-12,1e12), 'major_count':(2,40), 'minor_count':(0,9),
                 'decimals':(0,8), 'tick_length_pt':(0,24), 'tick_label_size_pt':(4,48),
                 'axis_width_pt':(.1,8), 'title_size_pt':(4,64), 'title_pad_pt':(0,48),
                 'label_pad_pt':(0,36), 'plot_width_pt':(36,1200), 'plot_height_pt':(36,1200),
                 'plot_left_pt':(24,240), 'plot_bottom_pt':(24,240)}
        interval=bounded.get(suffix)
        if interval and not interval[0]<=value<=interval[1]:raise ValueError(f'{key} must be between {interval[0]:g} and {interval[1]:g}')
        if suffix in ('major_count','minor_count','decimals'):
            if int(value)!=value:raise ValueError(f'{key} must be an integer')
            out[key]=int(value)
    for axis in ('x', 'y'):
        lo, hi = out.get(axis+'_min'), out.get(axis+'_max')
        if lo is not None and hi is not None and lo >= hi:
            raise ValueError(f'{axis}_min must be smaller than {axis}_max')
        if axis+'_major_step' in out and axis+'_major_count' in out:
            raise ValueError('Choose either major tick interval or target count, not both')
        if out.get(axis+'_scale')=='log' and (lo is not None and lo<=0 or hi is not None and hi<=0):
            raise ValueError('Logarithmic axes require strictly positive limits')
    return out


def capabilities(view):
    return dict(supported=view in CATEGORY_VIEWS | NUMERIC_VIEWS | X_ONLY_VIEWS,
                first_group_gap=view in CATEGORY_VIEWS,
                x_range=view in NUMERIC_VIEWS | X_ONLY_VIEWS,
                y_range=view in NUMERIC_VIEWS | CATEGORY_VIEWS,
                reference_lines=['x','y'] if view in NUMERIC_VIEWS else ['y'] if view in CATEGORY_VIEWS else ['x'] if view in X_ONLY_VIEWS else [],
                professional=view in CATEGORY_VIEWS | NUMERIC_VIEWS | X_ONLY_VIEWS,
                log_scale=view in LOG_VIEWS,
                geometry=view in CATEGORY_VIEWS | NUMERIC_VIEWS | X_ONLY_VIEWS,
                percentage_base={'x':1.,'y':100. if view=='time_percent_area' else 1.})


def validate_settings(view, settings=None):
    settings = normalize(settings)
    caps = capabilities(view)
    if settings and not caps['supported']:
        raise ValueError('This template does not yet declare editable data-axis semantics')
    for key in settings:
        if key=='reference_lines':
            if any(line['axis'] not in caps['reference_lines'] for line in settings[key]):
                raise ValueError('Reference lines must use a declared numeric data axis')
            continue
        if key in STYLE_FIELDS | GEOMETRY_FIELDS or key[2:] in AXIS_STYLE_FIELDS | {'tick_side','labels_visible'}:continue
        capability = 'first_group_gap' if key == 'first_group_gap' else key[0]+'_range'
        if not caps[capability]:
            raise ValueError(f'{key} is not supported for this template axis')
        if key.endswith('_scale') and settings[key]=='log' and not caps['log_scale']:
            raise ValueError('A logarithmic transformation is not reviewed for this chart; use a dedicated log template or another supported chart')
    return settings


def axis_semantics(view):
    """Prevent carrying a value-axis range onto a density/probability axis."""
    if view in CATEGORY_VIEWS:
        x = 'factor' if view == 'compare_interaction' else 'dose' if view == 'compare_dose_trend' else 'group'
        return x, 'log_value' if view == 'compare_log_points' else 'value'
    if view == 'compare_density': return 'value', 'density'
    if view == 'compare_ecdf': return 'value', 'cumulative_proportion'
    if view == 'compare_hist_facets': return 'value', 'count'
    if view == 'compare_cleveland': return 'mean', 'group'
    if view == 'compare_ridgeline': return 'value', 'group_density'
    if view in NUMERIC_VIEWS:
        if view.startswith('time_'):
            return 'time', 'change' if view=='time_baseline_change' else 'amount' if view=='time_stacked_area' else 'proportion' if view=='time_percent_area' else 'log_concentration' if view=='time_mutant_window' else 'concentration' if view=='time_pk_target' else 'value'
        if view.startswith('relation_residual') or view == 'relation_influence': return view, view
        return 'x', 'y'
    return None


def compatible_settings(source, target, settings=None):
    """Only retain candidates whose configured axes have the same meanings."""
    settings = normalize(settings)
    if not settings:
        return True
    try:
        validate_settings(target, settings)
    except ValueError:
        return False
    left, right = axis_semantics(source), axis_semantics(target)
    if left is None or right is None:
        return False
    dimensions={0 if key.startswith('x_') or key=='first_group_gap' else 1 for key in settings if key!='reference_lines' and key not in STYLE_FIELDS | GEOMETRY_FIELDS and key[2:] not in AXIS_STYLE_FIELDS}
    dimensions.update(0 if line['axis']=='x' else 1 for line in settings.get('reference_lines',[]))
    return all(left[dimension]==right[dimension] for dimension in dimensions)


def _record(ax, category=False):
    xlo, xhi = map(float, ax.get_xlim()); ylo, yhi = map(float, ax.get_ylim())
    record = dict(label=ax.get_title() or ax.get_ylabel() or 'Plot',
                  x_min=xlo, x_max=xhi, y_min=ylo, y_max=yhi,
                  x_scale=ax.get_xscale(), y_scale=ax.get_yscale())
    if category:
        positions = list(map(float, ax.get_xticks()))
        if not positions or any(not math.isfinite(v) for v in positions):
            raise ValueError('This categorical axis has no valid group positions')
        step = positions[1]-positions[0] if len(positions)>1 else 1.
        if step <= 0:
            raise ValueError('Category positions must have a positive step')
        record.update(first_group_position=positions[0], group_step=step,
                      first_group_gap=(positions[0]-xlo)/step)
    return record


def _ticks_and_style(ax, dimension, settings, numeric=True, percentage_base=1.):
    """Bounded, declarative locators/formatters; no caller-supplied expressions."""
    from matplotlib.ticker import FixedLocator, AutoMinorLocator, LogLocator, NullLocator, FuncFormatter
    settings={**settings,**{key[2:]:value for key,value in settings.items() if key.startswith(dimension+'_') and key[2:] in AXIS_STYLE_FIELDS}}
    axis=getattr(ax, dimension+'axis'); lo,hi=getattr(ax,'get_'+dimension+'lim')()
    logarithmic=getattr(ax,'get_'+dimension+'scale')()=='log'
    step=settings.get(dimension+'_major_step'); count=settings.get(dimension+'_major_count')
    if numeric and (step is not None or count is not None):
        lower,upper=(math.log10(lo),math.log10(hi)) if logarithmic else (lo,hi)
        if count is not None:
            positions=[lower+(upper-lower)*i/(count-1) for i in range(count)]
        else:
            first=math.ceil(lower/step-1e-10);last=math.floor(upper/step+1e-10)
            if last-first>79:raise ValueError('The major tick interval would create more than 80 labels; increase the interval')
            positions=[i*step for i in range(first,last+1)]
        values=[10**value if logarithmic else value for value in positions]
        axis.set_major_locator(FixedLocator(values))
    minor=settings.get(dimension+'_minor_count')
    if numeric and minor is not None:
        if minor==0:axis.set_minor_locator(NullLocator())
        elif logarithmic:
            # Equally spaced log subdivisions between actual major ticks.
            majors=[float(v) for v in axis.get_majorticklocs() if lo<=v<=hi]
            if len(majors)>80:raise ValueError('Too many major ticks for minor subdivisions')
            values=[10**(math.log10(a)+(math.log10(b)-math.log10(a))*i/(minor+1))
                    for a,b in zip(majors,majors[1:]) for i in range(1,minor+1)]
            axis.set_minor_locator(FixedLocator(values))
        else:axis.set_minor_locator(AutoMinorLocator(minor+1))
    fmt=settings.get(dimension+'_tick_format','auto');places=settings.get(dimension+'_decimals',2)
    if numeric and fmt!='auto':
        def format_value(value,position):
            if fmt=='scientific':return f'{value:.{places}e}'
            if fmt=='percent':return f'{value*100/percentage_base:.{places}f}%'
            return f'{value:.{places}f}'
        axis.set_major_formatter(FuncFormatter(format_value))
    tick_params={}
    for source,target in [('tick_direction','direction'),('tick_length_pt','length'),
                          ('tick_label_size_pt','labelsize'),('tick_color','colors'),('label_pad_pt','pad')]:
        if source in settings:tick_params[target]=settings[source]
    side=settings.get(dimension+'_tick_side')
    visible=settings.get(dimension+'_labels_visible',True)
    if side is not None:
        a,b=('bottom','top') if dimension=='x' else ('left','right')
        tick_params.update({a:side in (a,'both'),b:side in (b,'both'),
                            'label'+a:visible and side in (a,'both'),'label'+b:visible and side in (b,'both')})
        if side in (a,b):axis.set_label_position(side)
    elif dimension+'_labels_visible' in settings:
        tick_params.update({'labelbottom' if dimension=='x' else 'labelleft':visible,
                            'labeltop' if dimension=='x' else 'labelright':False})
    if tick_params:ax.tick_params(axis=dimension,which='both',**tick_params)
    if 'tick_length_pt' in settings:ax.tick_params(axis=dimension,which='minor',length=settings['tick_length_pt']*.6)
    label=axis.label
    if 'title_size_pt' in settings:label.set_fontsize(settings['title_size_pt'])
    if 'tick_color' in settings:label.set_color(settings['tick_color'])
    if 'title_pad_pt' in settings:axis.labelpad=settings['title_pad_pt']


def geometry_dimensions(settings, default=(4.8,3.6)):
    """Canvas dimensions for an explicit physical plotting frame, in inches."""
    settings=normalize(settings)
    if not any(key in settings for key in GEOMETRY_FIELDS):return default
    from gallery_layout import MARGINS_PT
    m=MARGINS_PT
    width=settings.get('plot_width_pt',default[0]*72-m['left']-m['right'])
    height=settings.get('plot_height_pt',default[1]*72-m['top']-m['bottom'])
    canvas=(settings.get('plot_left_pt',m['left'])+width+m['right'],
            settings.get('plot_bottom_pt',m['bottom'])+height+m['top'])
    if any(value>1440 for value in canvas):raise ValueError('The complete panel must not exceed 1440 points in either dimension')
    return tuple(value/72 for value in canvas)


def apply_axes(fig, view, settings=None):
    """Apply declared limits to all semantically equivalent facet axes."""
    settings = validate_settings(view, settings)
    caps = capabilities(view)
    info = dict(**caps, settings=settings, defaults={}, effective=[], warnings=[])
    fig._studio_axis_controls = info
    if not caps['supported']:
        return fig
    axes = [a for a in fig.axes if a.get_visible() and a.get_label() != '<colorbar>']
    if not axes:
        raise ValueError('No editable data axes were found')
    # Every whitelisted multi-axis template has equal axis semantics. All other
    # compound templates stay unsupported until they declare an explicit target.
    defaults = [_record(a, caps['first_group_gap']) for a in axes]
    info['defaults'] = {key: defaults[0][key] for key in FIELDS if key in defaults[0]}
    info['default_axes'] = defaults
    for ax, original in zip(axes, defaults):
        for dimension in ('x', 'y'):
            current = [original[dimension+'_min'], original[dimension+'_max']]
            low = settings.get(dimension+'_min', current[0])
            high = settings.get(dimension+'_max', current[1])
            if dimension == 'x' and 'first_group_gap' in settings:
                low = original['first_group_position'] - settings['first_group_gap']*original['group_step']
            scale=settings.get(dimension+'_scale',original[dimension+'_scale'])
            if scale!=original[dimension+'_scale']:
                if view not in LOG_VIEWS:raise ValueError('This chart must retain its reviewed native axis scale')
                if scale=='log':
                    extent=(ax.dataLim.x0,ax.dataLim.x1) if dimension=='x' else (ax.dataLim.y0,ax.dataLim.y1)
                    if not all(math.isfinite(v) and v>0 for v in extent):
                        raise ValueError('Logarithmic axes require strictly positive observations and uncertainty intervals; zero and negative values are not rewritten')
                    if dimension+'_min' not in settings:low=extent[0]/1.05
                    if dimension+'_max' not in settings:high=extent[1]*1.05
                getattr(ax,'set_'+dimension+'scale')(scale)
            changed = dimension+'_min' in settings or dimension+'_max' in settings or scale!=original[dimension+'_scale'] or (dimension == 'x' and 'first_group_gap' in settings)
            if not changed:
                continue
            if low >= high:
                raise ValueError(f'The requested {dimension} axis lower limit must remain smaller than its upper limit ({high:g})')
            if scale == 'log' and (low <= 0 or high <= 0):
                raise ValueError('Logarithmic axes require positive limits; choose a linear template for zero or negative values')
            getattr(ax, 'set_'+dimension+'lim')(low, high)
        for dimension in ('x','y'):
            # Categorical axes receive appearance settings, never numeric locators.
            _ticks_and_style(ax,dimension,settings,numeric=caps[dimension+'_range'],percentage_base=caps['percentage_base'][dimension])
            if caps[dimension+'_range'] and settings.get(dimension+'_tick_format','auto')!='auto':
                axis=getattr(ax,dimension+'axis');lo,hi=getattr(ax,'get_'+dimension+'lim')()
                values=[value for value in axis.get_majorticklocs() if lo<=value<=hi]
                labels=[axis.get_major_formatter()(value,index) for index,value in enumerate(values)]
                if len(set(labels))<len(labels):
                    info['warnings'].append(dict(code='tick_precision_collides',axis=dimension,
                        zh='当前小数精度使不同刻度显示为相同标签；请增加小数位或使用科学记数法。',
                        en='The selected precision gives different ticks identical labels; increase decimal places or use scientific notation.'))
        box=settings.get('axis_box');visible=settings.get('axis_visible',True)
        for name,spine in ax.spines.items():
            dimension='x' if name in ('top','bottom') else 'y'
            width=settings.get(dimension+'_axis_width_pt',settings.get('axis_width_pt'))
            color=settings.get(dimension+'_axis_color',settings.get('axis_color'))
            visible=settings.get(dimension+'_axis_visible',settings.get('axis_visible',True))
            if width is not None:spine.set_linewidth(width)
            if color is not None:spine.set_edgecolor(color)
            if box is not None or 'axis_visible' in settings or dimension+'_axis_visible' in settings:spine.set_visible(visible and (box!='none') and (box!='left_bottom' or name in ('left','bottom')))
        info['effective'].append(_record(ax, caps['first_group_gap']))
        if any(key in settings for key in ('x_min','x_max','y_min','y_max','first_group_gap')):
            # Native data annotations follow the actual data viewport. In
            # particular, a narrowed range must not leave a P label floating
            # outside the plot while its comparison line is clipped away.
            for text in ax.texts:
                if text.get_transform() is ax.transData:
                    text.set_clip_on(True)
                    text.set_clip_path(ax.patch)
    if settings.get('first_group_gap', 1) <= 0:
        info['warnings'].append(dict(code='first_group_clipped',
            zh='纵轴已到达或越过首组中心；首组部分图形可能被坐标范围裁切。',
            en='The vertical axis reaches or passes the first group centre; part of that group may be clipped by the data range.'))
    if any(key in settings for key in GEOMETRY_FIELDS):
        # Consumed by gallery_layout after the data renderer has completed.
        fig._studio_axis_geometry={key:settings[key] for key in GEOMETRY_FIELDS if key in settings}
    if any(key in settings for key in ('x_min','x_max','y_min','y_max')):
        # The plotted data extent includes raw observations and error intervals.
        # This is a view-range warning only; no observation is removed from data.
        clipped = False
        for ax in axes:
            bounds = ax.dataLim
            for dimension, extent in [('x',(bounds.x0,bounds.x1)),('y',(bounds.y0,bounds.y1))]:
                if any(dimension+'_'+end in settings for end in ('min','max')):
                    lo,hi = getattr(ax,'get_'+dimension+'lim')()
                    clipped |= all(math.isfinite(v) for v in extent) and (extent[0]<lo or extent[1]>hi)
        if clipped:
            info['warnings'].append(dict(code='data_range_clipped',
                zh='当前轴范围会裁切部分数据或区间；原始数据与统计结果保持不变。',
                en='The axis range clips some observations or intervals; source data and statistical results are unchanged.'))
    info['reference_line_status']=[]
    for i,line in enumerate(settings.get('reference_lines',[])):
        statuses=[]
        for j,ax in enumerate(axes):
            dimension=line['axis'];value=line['value']
            if getattr(ax,'get_'+dimension+'scale')()=='log' and value<=0:
                raise ValueError('Reference lines on a logarithmic axis require a positive value')
            lo,hi=getattr(ax,'get_'+dimension+'lim')()
            visible=bool(min(lo,hi)<=value<=max(lo,hi))
            statuses.append(visible)
            artist=getattr(ax,'axvline' if dimension=='x' else 'axhline')(value,color=line['color'],
                linestyle={'solid':'-','dashed':'--','dotted':':'}[line['style']],linewidth=line['width'],
                zorder=2.2,clip_on=True,label='_nolegend_')
            artist.set_gid(f'studio-reference-line-{i}-axis-{j}')
            # axvline/axhline can request autoscaling when outside current limits.
            # Restoring the exact range keeps reference lines presentation-only.
            getattr(ax,'set_'+dimension+'lim')(lo,hi)
        info['reference_line_status'].append(dict(index=i,axis=line['axis'],value=line['value'],visible=all(statuses),visible_axes=statuses))
        if not all(statuses):
            info['warnings'].append(dict(code='reference_line_outside',index=i,
                zh=f'第 {i+1} 条参考线位于部分或全部坐标范围之外。',
                en=f'Reference line {i+1} falls outside some or all displayed axis ranges.'))
    return fig


def controls_from_svg(raw):
    """Read our own embedded render metadata, including variant-specific limits."""
    root = ET.fromstring(raw)
    node = next((n for n in root.iter() if n.attrib.get('id') == 'studio-axis-controls'), None)
    return json.loads(node.text) if node is not None and node.text else None
