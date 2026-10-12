"""Explicit data-axis controls for reviewed gallery templates.

Limits are applied to real Matplotlib axes. Observations, estimated quantities,
and statistical results are never transformed or rewritten by this module.
"""
from __future__ import annotations

import json
import math
import re
import xml.etree.ElementTree as ET

FIELDS = {'x_min', 'x_max', 'y_min', 'y_max', 'first_group_gap', 'reference_lines'}
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
        raise ValueError('Unknown axis setting; use axis limits, first_group_gap or reference_lines')
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
        if isinstance(value, bool) or not isinstance(value, (float, int)) or not math.isfinite(value):
            raise ValueError(f'{key} must be a finite number or null for automatic limits')
        if abs(value) > 1e12:
            raise ValueError(f'{key} exceeds the supported numerical range')
        out[key] = float(value)
    for axis in ('x', 'y'):
        lo, hi = out.get(axis+'_min'), out.get(axis+'_max')
        if lo is not None and hi is not None and lo >= hi:
            raise ValueError(f'{axis}_min must be smaller than {axis}_max')
    return out


def capabilities(view):
    return dict(supported=view in CATEGORY_VIEWS | NUMERIC_VIEWS | X_ONLY_VIEWS,
                first_group_gap=view in CATEGORY_VIEWS,
                x_range=view in NUMERIC_VIEWS | X_ONLY_VIEWS,
                y_range=view in NUMERIC_VIEWS | CATEGORY_VIEWS,
                reference_lines=['x','y'] if view in NUMERIC_VIEWS else ['y'] if view in CATEGORY_VIEWS else ['x'] if view in X_ONLY_VIEWS else [])


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
        capability = 'first_group_gap' if key == 'first_group_gap' else key[0]+'_range'
        if not caps[capability]:
            raise ValueError(f'{key} is not supported for this template axis')
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
    dimensions={0 if key.startswith('x_') or key=='first_group_gap' else 1 for key in settings if key!='reference_lines'}
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
            changed = dimension+'_min' in settings or dimension+'_max' in settings or (dimension == 'x' and 'first_group_gap' in settings)
            if not changed:
                continue
            if low >= high:
                raise ValueError(f'The requested {dimension} axis lower limit must remain smaller than its upper limit ({high:g})')
            if original[dimension+'_scale'] == 'log' and (low <= 0 or high <= 0):
                raise ValueError('Logarithmic axes require positive limits; choose a linear template for zero or negative values')
            getattr(ax, 'set_'+dimension+'lim')(low, high)
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
