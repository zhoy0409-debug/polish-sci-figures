"""Bounded, explicit-design statistical comparisons for Figure Studio.

No model is inferred from a plot or from the resulting P values. Unit identity,
design and the comparison family must be confirmed before raw-data analysis.
References: scipy.stats.ttest_ind, ttest_rel, mannwhitneyu, wilcoxon;
statsmodels.stats.multitest.multipletests (Holm step-down adjustment).
"""
from __future__ import annotations

import csv
import hashlib
import io
import itertools
import math
import warnings
from decimal import Decimal, localcontext

import numpy as np
import scipy
from scipy import stats

MAX_ROWS = 10000
MAX_GROUPS = 10
MAX_FACETS = 12
MAX_COMPARISONS = 120
MAX_PERMUTATION_WORK = 20_000_000
SEED = 18731
METHOD_NAMES = {
    'welch': 'Welch two-sample t-test',
    'mannwhitney': 'Mann–Whitney U distribution test',
    'paired_t': 'Paired t-test',
    'wilcoxon': 'Wilcoxon signed-rank test',
}
METHOD_DESIGNS = {'welch': 'independent', 'mannwhitney': 'independent',
                  'paired_t': 'paired', 'wilcoxon': 'paired'}
RAW_KEYS = {'mode', 'group', 'value', 'unit', 'design', 'method', 'family',
            'control', 'facet', 'order', 'design_confirmed', 'unit_role', 'goal',
            'filter_column', 'filter_value'}
RESULT_KEYS = {'mode', 'group_a', 'group_b', 'p_value', 'method_label',
               'adjustment', 'correction_method', 'family', 'control', 'facet',
               'order', 'results_confirmed'}


def fail(zh, en):
    raise ValueError(f'{zh} / {en}')


def table_hash(rows):
    """Canonical CSV digest, identical to the server's newly written data.csv."""
    stream = io.StringIO(newline='')
    csv.writer(stream).writerows(rows)
    return hashlib.sha256(stream.getvalue().encode('utf-8')).hexdigest()


def validate_rows(rows):
    if not isinstance(rows, list) or not 2 <= len(rows) <= MAX_ROWS + 1:
        fail('需要表头及 1–10000 行数据', 'Expected a header and 1–10000 data rows')
    header = rows[0]
    if (not isinstance(header, list) or not 1 <= len(header) <= 100 or
            any(not isinstance(x, str) or not x.strip() for x in header) or
            len(set(header)) != len(header)):
        fail('列名必须非空且唯一', 'Column names must be nonempty and unique')
    if any(not isinstance(row, list) or len(row) != len(header) or
           any(not isinstance(x, str) or len(x) > 1000 for x in row) for row in rows[1:]):
        fail('数据表必须矩形且单元格不超过 1000 字符', 'Expected a rectangular string table; cell limit 1000 characters')
    return header


def _column(config, key, header, optional=False):
    value = config.get(key)
    if optional and value in (None, ''):
        return None
    if not isinstance(value, str) or value not in header:
        fail(f'请选择有效的 {key} 列', f'Choose a valid {key} column')
    return header.index(value)


def _text(raw, key, line):
    text = raw.strip()
    if not text or len(text) > 200:
        fail(f'第 {line} 行 {key} 为空或过长', f'Row {line}: {key} must contain 1–200 characters')
    return text


def _number(raw, key, line):
    try:
        value = float(raw)
    except (TypeError, ValueError):
        fail(f'第 {line} 行 {key} 不是数值；未删除任何行', f'Row {line}: {key} is not numeric; no rows were dropped')
    if not math.isfinite(value):
        fail(f'第 {line} 行 {key} 含缺失值或非有限值', f'Row {line}: {key} contains a missing or nonfinite value')
    return value


def holm(values):
    """Holm-adjusted P in original order, monotone in ascending raw P."""
    values = list(values)
    if any(not math.isfinite(p) or not 0 <= p <= 1 for p in values):
        fail('P 值必须在 0–1 之间', 'P values must be finite and between 0 and 1')
    output = [0.0] * len(values)
    running = 0.0
    for rank, index in enumerate(sorted(range(len(values)), key=values.__getitem__)):
        running = max(running, min(1.0, values[index] * (len(values) - rank)))
        output[index] = running
    return output


def recommendations(design, goal='mean'):
    """Order by declared design/estimand, never by observed significance."""
    if design not in ('independent', 'paired') or goal not in ('mean', 'distribution'):
        return []
    methods = ['welch', 'mannwhitney'] if design == 'independent' else ['paired_t', 'wilcoxon']
    if goal == 'distribution':
        methods.reverse()
    conditions = {
        'welch': ('比较独立研究单位的均值；不要求组间等方差。', 'Compare means of independent experimental units without assuming equal variances.'),
        'mannwhitney': ('比较独立样本的分布；不能一般性解释为中位数检验。', 'Compare independent distributions; this is not generally a test of medians.'),
        'paired_t': ('比较同一研究单位的平均差值；小样本时需关注差值分布。', 'Compare mean within-unit differences; examine the difference distribution in small samples.'),
        'wilcoxon': ('比较配对差值的符号秩；位置解释要求差值分布对称。', 'Signed-rank comparison of paired differences; a location interpretation requires symmetric differences.'),
    }
    return [{'method': key, 'rank': index + 1, 'name': METHOD_NAMES[key],
             'reason_zh': conditions[key][0], 'reason_en': conditions[key][1]}
            for index, key in enumerate(methods)]


def _order(observed, config):
    order = config.get('order')
    if order is None:
        return list(dict.fromkeys(observed))
    if (not isinstance(order, list) or any(not isinstance(x, str) or not x.strip() for x in order)
            or len(order) != len(set(order)) or set(order) != set(observed)):
        fail('分组顺序必须与实际组别完整对应', 'Group order must match every observed group exactly')
    return list(order)


def _pairs(order, config):
    if not 2 <= len(order) <= MAX_GROUPS:
        fail('每个分面需要 2–10 个组别', 'Each facet requires 2–10 groups')
    if config['family'] == 'all_pairs':
        return list(itertools.combinations(range(len(order)), 2))
    control = config.get('control')
    if not isinstance(control, str) or control not in order:
        fail('请选择实际存在的对照组', 'Choose an observed control group')
    c = order.index(control)
    return [(c, j) for j in range(len(order)) if j != c]


def _base_config(config, allowed):
    if not isinstance(config, dict) or set(config) - allowed:
        fail('统计配置包含未知字段', 'Statistics configuration contains unknown fields')
    if config.get('family') not in ('all_pairs', 'control'):
        fail('请明确比较族：全部两两比较或对照组比较', 'Declare all-pairs or control comparisons')


def _pair_test(a, b, method, permutation_budget):
    """Effect direction is group b minus group a throughout."""
    x = np.asarray([v[0] for v in a.values()], dtype=float)
    y = np.asarray([v[0] for v in b.values()], dtype=float)
    if METHOD_DESIGNS[method] == 'independent':
        # Table sorting must not change seeded Monte Carlo assignments (or the
        # order of floating-point reductions). This sorts local copies only.
        x.sort(); y.sort()
    if min(len(x), len(y)) < 2:
        fail('每组至少需要 2 个独立研究单位或完整配对', 'Each group requires at least two experimental units or complete pairs')
    notes = []
    if np.ptp(x) == 0 or np.ptp(y) == 0:
        notes.append({'zh': '至少一组观测值恒定；请确认测量精度与数据来源。', 'en': 'At least one group is constant; verify measurement precision and source data.'})
    if np.ptp(np.concatenate([x, y])) == 0:
        fail('所有观测值相同，无法估计差异的不确定性', 'All observations are identical; uncertainty of a difference cannot be estimated')
    extra = {}
    with warnings.catch_warnings(record=True) as caught, np.errstate(over='raise', invalid='raise', divide='raise'):
        warnings.simplefilter('always')
        try:
            if method == 'welch':
                if np.var(x, ddof=1) == 0 and np.var(y, ddof=1) == 0:
                    fail('两组均为恒定值，无法计算 Welch 检验', 'Both groups are constant; Welch variance cannot be estimated')
                test = stats.ttest_ind(y, x, equal_var=False, nan_policy='raise', alternative='two-sided')
                ci = test.confidence_interval(confidence_level=.95)
                extra = {'estimate': float(np.mean(y) - np.mean(x)), 'estimand': 'mean(group_b) - mean(group_a)',
                         'ci95': [float(ci.low), float(ci.high)], 'ci_scope': 'unadjusted pairwise 95% CI',
                         'degrees_of_freedom': float(test.df), 'p_method': 'Welch-Satterthwaite'}
            elif method == 'mannwhitney':
                ties = len(set(np.concatenate([x, y]))) < len(x) + len(y)
                if min(len(x), len(y)) < 10 and (ties or len(x) + len(y) > 50):
                    if len(x) + len(y) > 200:
                        fail('小样本秩检验需要置换计算；本地界面最多支持合计 200 个单位', 'Small-sample rank-test permutation is limited to 200 combined units in this local interface')
                    permutation_budget[0] += 9999 * (len(x) + len(y))
                    if permutation_budget[0] > MAX_PERMUTATION_WORK:
                        fail('本次小样本置换计算超出本地计算上限；请缩小预先指定的比较族', 'Small-sample permutations exceed this local computation limit; reduce the prespecified comparison family')
                    pm = stats.PermutationMethod(n_resamples=9999, batch=128, rng=np.random.default_rng(SEED))
                    label = 'permutation, up to 9999 resamples, seed 18731'
                else:
                    pm = 'exact' if min(len(x), len(y)) <= 8 and not ties else 'asymptotic'
                    label = pm + ('; tie and continuity correction' if pm == 'asymptotic' else '')
                # A two-sided comparison is invariant to exchanging group labels.
                # Canonicalize the permutation pools as well as within-pool order.
                swap = (len(x), tuple(x)) < (len(y), tuple(y))
                first, second = (x, y) if swap else (y, x)
                test = stats.mannwhitneyu(first, second, alternative='two-sided', method=pm, nan_policy='raise')
                u_b = len(x) * len(y) - test.statistic if swap else test.statistic
                extra = {'estimate': float(u_b / (len(x) * len(y))), 'statistic': float(u_b),
                         'estimand': 'Pr(group_b > group_a) + 0.5 Pr(tie)', 'p_method': label}
            else:
                # Align by identity, not table row order. Decimal subtraction preserves
                # exact ties in user-provided decimal measurements without rounding data.
                keys = sorted(a)
                x = np.asarray([a[k][0] for k in keys]); y = np.asarray([b[k][0] for k in keys])
                with localcontext() as context:
                    context.prec = 1100
                    difference = np.asarray([float(Decimal(b[k][1]) - Decimal(a[k][1])) for k in keys])
                if method == 'paired_t':
                    if np.ptp(difference) == 0:
                        fail('配对差值恒定，无法估计配对 t 检验的方差', 'Paired differences are constant; paired-t variance cannot be estimated')
                    test = stats.ttest_1samp(difference, 0, nan_policy='raise', alternative='two-sided')
                    ci = test.confidence_interval(confidence_level=.95)
                    extra = {'estimate': float(np.mean(difference)), 'estimand': 'mean(group_b - group_a)',
                             'ci95': [float(ci.low), float(ci.high)], 'ci_scope': 'unadjusted pairwise 95% CI',
                             'degrees_of_freedom': float(test.df), 'p_method': 'paired t on within-unit differences'}
                else:
                    if not np.any(difference):
                        fail('所有配对差值均为零，不能计算符号秩检验', 'All paired differences are zero; signed-rank inference is undefined')
                    nonzero = difference[difference != 0]
                    tied = len(set(abs(nonzero))) < len(nonzero) or len(nonzero) != len(difference)
                    if tied and len(difference) <= 30:
                        permutation_budget[0] += 9999 * len(difference)
                        if permutation_budget[0] > MAX_PERMUTATION_WORK:
                            fail('本次小样本置换计算超出本地计算上限；请缩小预先指定的比较族', 'Small-sample permutations exceed this local computation limit; reduce the prespecified comparison family')
                        pm = stats.PermutationMethod(n_resamples=9999, batch=128, rng=np.random.default_rng(SEED))
                        label = 'permutation, up to 9999 sign flips, seed 18731'
                    else:
                        pm = 'exact' if not tied and len(difference) <= 50 else 'asymptotic'
                        label = pm
                    test = stats.wilcoxon(difference, alternative='two-sided', zero_method='wilcox',
                                          method=pm, nan_policy='raise')
                    extra = {'descriptive_median_difference': float(np.median(difference)),
                             'estimand': 'signed ranks of within-unit differences', 'p_method': label,
                             'zero_differences': int(len(difference) - len(nonzero))}
                extra['difference_computation'] = 'decimal subtraction of supplied numeric text'
        except (FloatingPointError, OverflowError) as exc:
            fail('数值范围或精度无法稳定支持本次检验', 'Numeric range or precision prevents stable inference')
    if not math.isfinite(float(test.statistic)) or not math.isfinite(float(test.pvalue)):
        fail('本次检验未得到有限结果，请检查数据变异与样本数', 'The test did not produce finite results; check variation and sample sizes')
    for item in caught:
        notes.append({'zh': '统计引擎提示：' + str(item.message), 'en': str(item.message)})
    return {'p_raw': float(test.pvalue), 'statistic': float(test.statistic),
            'n_a': len(x), 'n_b': len(y), **extra}, notes


def _raw(recipe, rows, config):
    _base_config(config, RAW_KEYS)
    if config.get('design_confirmed') is not True or config.get('unit_role') != 'independent_experimental_unit':
        fail('请确认研究设计及真实独立研究单位；技术重复不能视为独立样本', 'Confirm the design and genuine independent experimental unit; technical replicates are not independent samples')
    design, method = config.get('design'), config.get('method')
    if design not in ('independent', 'paired') or METHOD_DESIGNS.get(method) != design:
        fail('所选方法与研究设计不匹配', 'The selected method does not match the declared design')
    if config.get('goal', 'mean') not in ('mean', 'distribution'):
        fail('请选择均值或分布的分析目标', 'Choose a mean or distribution estimand')
    header = rows[0]
    view = recipe.get('parameters', {}).get('view') if isinstance(recipe.get('parameters'), dict) else None
    filter_index = _column(config, 'filter_column', header, optional=True)
    filter_value = config.get('filter_value')
    if filter_index is not None and (not isinstance(filter_value, str) or not 1 <= len(filter_value.strip()) <= 200):
        fail('请明确筛选值', 'Declare the row-filter value')
    if filter_index is None and filter_value not in (None, ''):
        fail('筛选值需要对应筛选列', 'A filter value requires its filter column')
    if view == 'pca_loadings' and 'role' in header and (config.get('filter_column') != 'role' or filter_value != 'score'):
        fail('PCA 混合表须明确筛选 role = score，载荷不是研究单位', 'Filter the mixed PCA table explicitly to role = score; loadings are not experimental units')
    gi, vi, ui = [_column(config, key, header) for key in ('group', 'value', 'unit')]
    fi = _column(config, 'facet', header, optional=True)
    if len({gi, vi, ui}) != 3 or fi in (gi, vi, ui):
        fail('分组、结局、单位和分面须映射到不同列', 'Group, outcome, unit and facet must use distinct columns')
    facets = {}
    rows_used = 0
    for line, row in enumerate(rows[1:], 2):
        if filter_index is not None and row[filter_index].strip() != filter_value.strip():
            continue
        rows_used += 1
        label = _text(row[fi], 'facet', line) if fi is not None else ''
        group, unit = _text(row[gi], 'group', line), _text(row[ui], 'unit', line)
        value = _number(row[vi], 'value', line)
        groups = facets.setdefault(label, {})
        observations = groups.setdefault(group, {})
        if unit in observations:
            fail(f'第 {line} 行：同一研究单位在同组同分面出现多次', f'Row {line}: a unit occurs repeatedly in the same group and facet; technical replicates require prior unit-level aggregation or a hierarchical model')
        observations[unit] = (value, row[vi].strip())
    if not facets:
        fail('筛选后没有可分析的观测值', 'No observations remain after the declared filter')
    if len(facets) > MAX_FACETS:
        fail('本地分析最多支持 12 个分面', 'This local analysis supports at most 12 facets')
    output, notes, jobs = [], [], []
    for label, groups in facets.items():
        order = _order(list(groups), config)
        pairs = _pairs(order, config)
        unitsets = [set(groups[g]) for g in order]
        if design == 'independent' and any(unitsets[i] & unitsets[j] for i, j in itertools.combinations(range(len(order)), 2)):
            fail(f'分面 {label or "全部"} 同一单位跨组重复，请确认配对设计', f'Facet {label or "all"}: a unit appears in multiple independent groups; confirm a paired design')
        if design == 'paired' and any(s != unitsets[0] for s in unitsets[1:]):
            fail(f'分面 {label or "全部"} 配对不完整；没有自动删除单位', f'Facet {label or "all"}: pairing is incomplete; no units were silently dropped')
        item = {'label': label, 'group_order': order, 'group_n': {g: len(groups[g]) for g in order},
                'primary_test': {'name': METHOD_NAMES[method] + '; Holm-adjusted pairwise comparisons', 'pairwise': []}}
        output.append(item)
        jobs.extend((item, groups, a, b) for a, b in pairs)
    if len(jobs) > MAX_COMPARISONS:
        fail('比较数量超过 120，请按预先指定的研究问题拆分', 'More than 120 comparisons; split according to prespecified research questions')
    flat, permutation_budget = [], [0]
    for item, groups, a, b in jobs:
        order = item['group_order']
        result, diagnostic = _pair_test(groups[order[a]], groups[order[b]], method, permutation_budget)
        result.update(a=a, b=b, group_a=order[a], group_b=order[b])
        item['primary_test']['pairwise'].append(result)
        flat.append(result)
        notes.extend({**note, 'facet': item['label'], 'group_a': order[a], 'group_b': order[b]} for note in diagnostic)
    for comparison, adjusted in zip(flat, holm(c['p_raw'] for c in flat)):
        comparison['p'] = adjusted
    analysis = {'schema': 'studio-statistics/1', 'mode': 'raw', 'design': design,
                'method': method, 'family': config['family'], 'control': config.get('control'),
                'correction': 'Holm', 'correction_scope': 'all_facets', 'comparison_count': len(flat),
                'alternative': 'two-sided', 'alpha': .05, 'rows_used': rows_used,
                'rows_supplied': len(rows) - 1, 'rows_filtered_out': len(rows) - 1 - rows_used,
                'experimental_unit_column': config['unit'], 'diagnostics': notes,
                'recommendations': recommendations(design, config.get('goal', 'mean')),
                'engine': {'library': 'SciPy', 'version': scipy.__version__}}
    if filter_index is not None:
        analysis['row_filter'] = {'column': config['filter_column'], 'value': filter_value.strip()}
    if view == 'pca_loadings':
        notes.append({'zh': '检验仅针对所选得分坐标，不是 PCA 整体组间分离检验。', 'en': 'This test concerns the selected score coordinate, not overall PCA group separation.'})
    if fi is None:
        analysis.update({k: v for k, v in output[0].items() if k != 'label'})
    else:
        analysis['facet_column'] = config['facet']
        analysis['facets'] = output
    return analysis


def _results(rows, config):
    _base_config(config, RESULT_KEYS)
    adjustment = config.get('adjustment')
    if config.get('results_confirmed') is not True or adjustment not in ('already_adjusted', 'holm', 'none'):
        fail('请确认结果表来源及 P 值是否已校正', 'Confirm result provenance and whether P values were already adjusted')
    description = config.get('method_label')
    if not isinstance(description, str) or not 1 <= len(description.strip()) <= 500:
        fail('请填写真实分析方法', 'Provide the actual analysis method')
    correction = config.get('correction_method')
    if adjustment == 'already_adjusted' and (not isinstance(correction, str) or not correction.strip() or len(correction) > 200 or correction.strip().lower() in ('none', 'no', 'uncorrected')):
        fail('已校正结果需要明确校正方法', 'Already-adjusted results require the correction method')
    if adjustment == 'none' and len(rows) > 2:
        fail('多个比较需要 Holm 校正或明确导入已校正的结果', 'Multiple comparisons require Holm adjustment or explicitly imported adjusted results')
    header = rows[0]
    ai, bi, pi = [_column(config, key, header) for key in ('group_a', 'group_b', 'p_value')]
    fi = _column(config, 'facet', header, optional=True)
    if len({ai, bi, pi}) != 3 or fi in (ai, bi, pi):
        fail('组别与 P 值须使用不同列', 'Group labels and P values require distinct columns')
    facets = {}
    for line, row in enumerate(rows[1:], 2):
        label = _text(row[fi], 'facet', line) if fi is not None else ''
        ga, gb = _text(row[ai], 'group_a', line), _text(row[bi], 'group_b', line)
        p = _number(row[pi], 'p_value', line)
        if ga == gb or not 0 <= p <= 1:
            fail(f'第 {line} 行的比较组别或 P 值无效', f'Row {line}: invalid comparison groups or P value')
        facets.setdefault(label, []).append({'group_a': ga, 'group_b': gb, 'p': p})
    if len(facets) > MAX_FACETS or len(rows) - 1 > MAX_COMPARISONS:
        fail('最多支持 12 个分面、120 个比较', 'At most 12 facets and 120 comparisons are supported')
    output, flat = [], []
    for label, comparisons in facets.items():
        order = _order(list(dict.fromkeys(itertools.chain.from_iterable((c['group_a'], c['group_b']) for c in comparisons))), config)
        required = {tuple(sorted(pair)) for pair in _pairs(order, config)}
        seen = set()
        for comparison in comparisons:
            a, b = order.index(comparison['group_a']), order.index(comparison['group_b'])
            pair = tuple(sorted((a, b)))
            if pair in seen:
                fail('结果表包含重复比较', 'The results table contains duplicate comparisons')
            comparison.update(a=a, b=b)
            if adjustment != 'already_adjusted':
                comparison['p_raw'] = comparison['p']
            seen.add(pair)
        if seen != required:
            fail('结果表未完整覆盖声明的比较族', 'The results table does not exactly cover the declared comparison family')
        flat.extend(comparisons)
        adjustment_label = str(correction) + '-adjusted comparisons' if adjustment == 'already_adjusted' else 'Holm-adjusted comparisons' if adjustment == 'holm' else 'single unadjusted comparison'
        output.append({'label': label, 'group_order': order,
                       'primary_test': {'name': description.strip() + '; ' + adjustment_label, 'pairwise': comparisons}})
    if adjustment == 'holm':
        for comparison, adjusted in zip(flat, holm(c['p_raw'] for c in flat)):
            comparison['p'] = adjusted
    analysis = {'schema': 'studio-statistics/1', 'mode': 'results', 'family': config['family'],
                'correction': correction if adjustment == 'already_adjusted' else 'Holm' if adjustment == 'holm' else 'none',
                'correction_scope': 'as supplied' if adjustment == 'already_adjusted' else 'all_facets',
                'comparison_count': len(flat), 'alpha': .05, 'imported_results': True,
                'diagnostics': [{'zh': 'P = 0 为原表提供的值；请核查数值精度或报告下限。', 'en': 'P = 0 was supplied; verify precision or the reporting limit.'}] if any(c['p'] == 0 for c in flat) else []}
    if fi is None:
        analysis.update({k: v for k, v in output[0].items() if k != 'label'})
    else:
        analysis.update(facet_column=config['facet'], facets=output)
    return analysis


def analyze(recipe, rows, config):
    """Return a new analysis, never mutate submitted data or reuse a prior P value."""
    validate_rows(rows)
    if not isinstance(recipe, dict) or not isinstance(config, dict):
        fail('需要图形配方与明确统计配置', 'A figure recipe and explicit statistics configuration are required')
    mode = config.get('mode', 'raw')
    if mode == 'raw':
        analysis = _raw(recipe, rows, config)
    elif mode == 'results':
        analysis = _results(rows, config)
    else:
        fail('统计模式无效', 'Invalid statistics mode')
    digest = table_hash(rows)
    analysis['data_sha256'] = digest
    return {'analysis': analysis, 'config': {**config, 'mode': mode}, 'data_sha256': digest}
