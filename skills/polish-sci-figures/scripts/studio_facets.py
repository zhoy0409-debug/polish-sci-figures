"""Split a reviewed faceted view into editable panels without redefining its tests."""
from __future__ import annotations
import copy
import math
import textwrap
import xml.etree.ElementTree as ET

from studio_statistics import analyze, table_hash, validate_rows, fail

SOURCE_VIEW = 'compare_facet_boxes'
TARGET_VIEW = 'compare_box_points'
MAX_SPLIT_FACETS = 6


def facet_context(recipe, rows):
    context = recipe.get('facet_context')
    if context is None:
        return None
    if (not isinstance(context, dict) or set(context) != {'column', 'value', 'label', 'source_data_sha256'} or
            any(not isinstance(context.get(k), str) or not 1 <= len(context[k]) <= 200 for k in ('column', 'value', 'label')) or
            not isinstance(context.get('source_data_sha256'), str) or len(context['source_data_sha256']) != 64):
        fail('分面来源信息无效', 'Invalid facet provenance')
    header = validate_rows(rows)
    if context['column'] not in header or any(row[header.index(context['column'])].strip() != context['value'] for row in rows[1:]):
        fail('拆分后的图形必须保留原分面值；请从原始多分面数据重新拆分', 'A split panel must retain its original facet value; split again from the original faceted data')
    return copy.deepcopy(context)


def title_svg(raw, recipe, rows):
    """Use the reserved physical header, retaining editable vector text at every size."""
    context = facet_context(recipe, rows)
    if context is None:
        return raw
    root = ET.fromstring(raw)
    ns = 'http://www.w3.org/2000/svg'
    ET.register_namespace('', ns)
    width = float(root.attrib['viewBox'].split()[2])
    available = max(36., width-104.)
    # Short facet labels retain 10 pt. Long labels wrap in the reserved header.
    units = sum(1.0 if ord(c) > 0x2e7f else .58 for c in context['label'])
    size = max(6., min(10., available/max(1., units/2)))
    count = max(5, int(available/size*.95))
    lines = textwrap.wrap(context['label'], width=count, break_long_words=True, break_on_hyphens=False) or [context['label']]
    if len(lines) > 2:
        lines = [lines[0], lines[1][:-1]+'…']
    group = ET.SubElement(root, '{'+ns+'}g', {'id': 'studio-facet-title'})
    ET.SubElement(group, '{'+ns+'}title').text = context['label']
    text = ET.SubElement(group, '{'+ns+'}text', {'x':'60', 'y':'25', 'font-size':str(size),
        'font-family':recipe.get('font','Arial')+", 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif",
        'font-weight':'600', 'fill':'#26364b'})
    for i, line in enumerate(lines):
        ET.SubElement(text, '{'+ns+'}tspan', {'x':'60', 'y':str(25+i*12)}).text = line
    return ET.tostring(root, encoding='utf-8', xml_declaration=True)


def _source_statistics(recipe, rows, record):
    if record is None:
        return None
    digest = table_hash(rows)
    if not isinstance(record, dict) or record.get('stale') or record.get('tableKey') != digest:
        fail('统计结果已过期，请更新后再拆分', 'Statistics are stale; update them before splitting')
    config = record.get('config')
    if not isinstance(config, dict):
        fail('缺少可验证的统计配置', 'A verifiable statistical configuration is required')
    if record.get('binding') == 'current':
        if config.get('group') != 'group' or config.get('value') != 'value' or config.get('facet') != 'factor':
            fail('统计分层必须与图中的 factor、group、value 对应', 'The analysis must correspond to the plotted factor, group and value columns')
        result = analyze(recipe, rows, config)
    elif record.get('binding') in ('external', 'results'):
        inputs = record.get('inputRows')
        if not inputs or not config.get('facet'):
            fail('外部比较需要完整的分面结果表，才能保持原比较族', 'External comparisons need the full faceted input table to retain the original comparison family')
        result = analyze(recipe, inputs, config)
    else:
        fail('不支持的统计绑定', 'Unsupported statistical binding')
    if result['data_sha256'] != record.get('data_sha256'):
        fail('统计输入与保存记录不一致，请先更新统计分析', 'Statistical input differs from its saved record; update the analysis first')
    if not result['analysis'].get('facets'):
        fail('统计结果不包含分面比较，不能推断各分面的 P 值', 'No faceted comparisons are present; per-facet P values cannot be inferred')
    return result


def _snapshot(result, facet, panel_digest, source_digest):
    whole = result['analysis']
    selected = next((item for item in whole['facets'] if item['label'] == facet), None)
    if selected is None:
        fail('统计分面与图形分面不一致', 'Statistical and plotted facets do not match')
    comparisons = selected['primary_test']['pairwise']
    result_rows = [['group_a', 'group_b', 'p_value']] + [[c['group_a'], c['group_b'], repr(c['p'])] for c in comparisons]
    correction = str(whole.get('correction', ''))
    count = whole['comparison_count']
    method = selected['primary_test']['name']
    correction_label = f'{correction}; original family of {count} comparisons'[:200]
    config = dict(mode='results', group_a='group_a', group_b='group_b', p_value='p_value',
                  method_label=method[:500], adjustment='already_adjusted', correction_method=correction_label,
                  family=whole['family'], order=list(selected['group_order']), results_confirmed=True)
    if result['config'].get('control') is not None:
        config['control'] = result['config']['control']
    analysis = {k:copy.deepcopy(v) for k,v in whole.items() if k not in ('facets', 'facet_column', 'data_sha256', 'diagnostics', 'recommendations')}
    analysis.update(copy.deepcopy(selected))
    analysis.update(mode='results', imported_results=True, correction_scope='original_faceted_family',
                    facet_comparison_count=len(comparisons), data_sha256=table_hash(result_rows),
                    split_family={'source_data_sha256':source_digest, 'statistics_data_sha256':result['data_sha256'],
                                  'facet':facet, 'comparison_count':count, 'config':copy.deepcopy(result['config']),
                                  'facets':copy.deepcopy(whole['facets'])})
    analysis['diagnostics'] = [n for n in whole.get('diagnostics',[]) if n.get('facet', facet)==facet]
    analysis['diagnostics'].append({
        'zh':f'显示原分面比较族中的结果（共 {count} 项比较）；拆分不重新校正 P 值。修改本图数据后，需重新连接原比较族的结果。',
        'en':f'Displays results from the original family of {count} comparisons; splitting does not readjust P values. After changing this panel’s data, reconnect results from the original comparison family.'})
    return dict(binding='results', tableKey=panel_digest, config=config, analysis=analysis,
                data_sha256=table_hash(result_rows), inputRows=result_rows)


def split_facets(recipe, rows, statistics=None):
    header = validate_rows(rows)
    if not isinstance(recipe, dict) or recipe.get('family') != 'gallery' or recipe.get('parameters') != {'view':SOURCE_VIEW}:
        fail('当前模板不支持拆分分面', 'This template does not support splitting facets')
    import pandas as pd
    import matplotlib.pyplot as plt
    import gallery_registry as registry
    from studio_server import regenerate
    frame = pd.DataFrame(rows[1:], columns=header)
    registry.validate(frame, SOURCE_VIEW)
    fi = header.index('factor')
    labels = list(dict.fromkeys(row[fi].strip() for row in rows[1:]))
    if not 2 <= len(labels) <= MAX_SPLIT_FACETS or any(not label or len(label)>200 for label in labels):
        fail('拆分需要 2–6 个非空分面', 'Splitting requires 2–6 nonempty facets')
    # Statistics are calculated only once on the complete original family.
    result = _source_statistics(recipe, rows, statistics)
    if result is not None and set(labels) != {s['label'] for s in result['analysis']['facets']}:
        fail('统计分面必须完整对应图形分面', 'Statistical facets must exactly match the plotted facets')
    source_digest = table_hash(rows)
    figure = registry.render(frame,SOURCE_VIEW,colors=registry.colors_for(recipe.get('palette','zhoy_muted'),recipe.get('colors')),axes=recipe.get('axis_settings'))
    try:
        ranges = figure._studio_axis_controls['effective']
        ymin = min(a['y_min'] for a in ranges); ymax = max(a['y_max'] for a in ranges)
    finally:
        plt.close(figure)
    child_recipe = copy.deepcopy(recipe)
    child_recipe['parameters'] = {'view':TARGET_VIEW}
    child_recipe.pop('studio_view',None)
    child_recipe['axis_settings'] = {**recipe.get('axis_settings',{}),'y_min':ymin,'y_max':ymax}
    panels=[]
    for label in labels:
        child_rows = [list(header)]+[list(row) for row in rows[1:] if row[fi].strip()==label]
        context = dict(column='factor',value=label,label=label,source_data_sha256=source_digest)
        r={**child_recipe,'facet_context':context}
        panel=regenerate(r,child_rows)
        panel['name']=label
        panel['facet']=context
        if result is not None:
            selected=next(item for item in result['analysis']['facets'] if item['label']==label)
            groups={row[header.index('group')].strip() for row in child_rows[1:]}
            if groups!=set(selected['group_order']):
                fail('统计组别与分面数据不一致', 'Statistical groups do not match the facet data')
            panel['statistics']=_snapshot(result,label,panel['table']['sha256'],source_digest)
        panels.append({'facet':context,'panel':panel})
    return {'panels':panels,'source':{'facet_column':'factor','source_data_sha256':source_digest,
            'source_statistics_sha256':result['data_sha256'] if result else None,
            'comparison_count':result['analysis']['comparison_count'] if result else 0}}
