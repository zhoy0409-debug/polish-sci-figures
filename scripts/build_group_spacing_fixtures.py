"""Render real catalogue inputs for category-spacing geometry regression.

No source observations or result values are changed by the spacing operation.
Additional cases deliberately reorder input rows and change a raw observation.
"""
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'skills/make-sci-data-figures/scripts'))
import pandas as pd
import gallery_registry

VIEWS = '''coverage_tracks variance_scree gene_arrows parallel_coordinates superplot grouped_observations paired_dumbbell study_gantt
compare_bar_sd compare_bar_points compare_mean_sd compare_mean_ci compare_box
compare_box_points compare_notched_box compare_violin compare_violin_box compare_swarm
compare_strip_median compare_raincloud compare_log_points compare_cleveland compare_ridgeline
compare_paired_lines compare_paired_change compare_interaction compare_facet_boxes
compare_bracket_stars compare_bracket_p compare_control_symbols compare_gardner_altman
compare_cumming time_auc_summary paired_slope time_swimmer category_ranked_bars
composition_percent_bars composition_grouped_bars composition_facets composition_count_bars
composition_likert clinical_subgroup_forest coefficient_forest meta_forest meta_subgroup_forest
meta_cumulative meta_leave_one_out bias_risk_summary diagnostic_paired_forest enrichment_bars
enrichment_dots lefse_scores zone_diameters taxa_composition alpha_diversity distribution_sina
compare_uncertainty model_shap_summary tornado_sensitivity'''.split()
RESIZED = '''coverage_tracks gene_arrows parallel_coordinates compare_raincloud compare_ridgeline compare_paired_lines compare_interaction
compare_bracket_p compare_facet_boxes compare_cumming paired_dumbbell composition_grouped_bars
composition_percent_bars coefficient_forest enrichment_dots model_shap_summary'''.split()


def main():
    output = ROOT / '.cache/group-spacing-gallery'
    output.mkdir(parents=True, exist_ok=True)
    starters = json.loads((ROOT / 'skills/polish-sci-figures/assets/figure-studio/template-starters.json').read_text(encoding='utf-8'))
    manifest = []
    for view in VIEWS:
        starter = starters[view]
        data = pd.DataFrame(starter['rows'][1:], columns=starter['rows'][0])
        variants = [('normal', data, (4.8, 3.6))]
        if view in RESIZED:
            changed = data.iloc[::-1].reset_index(drop=True).copy()
            if 'value' in changed and view not in {'compare_bracket_p'}:
                changed.loc[0, 'value'] = float(changed.loc[0, 'value']) + .013
            variants += [('wide', data, (7.2, 3.6)), ('portrait', data, (3.6, 5.4)), ('edited', changed, (4.8, 3.6))]
        for name, frame, dimensions in variants:
            before = frame.to_json(orient='split')
            svg = gallery_registry.svg_at_size(frame, view, None, 'Arial', dimensions)
            assert frame.to_json(orient='split') == before, f'{view}: renderer mutated input'
            filename = f'{view}-{name}.svg'
            (output / filename).write_bytes(svg)
            manifest.append({'view': view, 'case': name, 'file': filename, 'sha256': hashlib.sha256(before.encode()).hexdigest()})
    (output / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(f'Rendered {len(manifest)} actual SVG fixtures across {len(VIEWS)} categorical views.')


if __name__ == '__main__':
    main()
