"""Independent starter IDs must not imply pairing or inflate technical replicates."""
from pathlib import Path
import hashlib
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'skills/make-sci-data-figures/scripts'))
sys.path.insert(0, str(ROOT / 'skills/polish-sci-figures/scripts'))
from gallery_compare import fixtures as compare_fixtures, validate
from build_gallery_styles import fixtures as base_fixtures
from studio_statistics import analyze


def main():
    compare = compare_fixtures()
    base = base_fixtures()
    changed = {k: d for k, d in compare.items() if k.startswith('compare_') and not k.startswith('compare_paired')}
    changed['grouped_observations'] = base['grouped_observations']
    starters = json.loads((ROOT / 'skills/polish-sci-figures/assets/figure-studio/template-starters.json').read_text(encoding='utf-8'))
    pending = []
    config = {'mode': 'raw', 'group': 'group', 'unit': 'unit', 'value': 'value',
              'design': 'independent', 'method': 'welch', 'family': 'all_pairs',
              'design_confirmed': True, 'unit_role': 'independent_experimental_unit'}
    for key, data in changed.items():
        assert not data.unit.duplicated().any(), key
        if key in compare:
            validate(data, key)
        rows = [list(data.columns)] + data.astype(str).values.tolist()
        stored = starters[key]['rows']
        assert stored[0] == rows[0], key
        unit_index = rows[0].index('unit')
        # These fixes are identity-only. All observations and supplied estimates /
        # comparison results must remain identical to the prior bundled starter.
        assert [[v for i, v in enumerate(r) if i != unit_index] for r in rows] == [[v for i, v in enumerate(r) if i != unit_index] for r in stored], key
        if rows != stored:
            pending.append(key)
        selected = {**config, 'group': 'dose' if key == 'compare_dose_trend' else 'group'}
        if 'factor' in data:
            selected['facet'] = 'factor'
        result = analyze({'family': 'gallery', 'parameters': {'view': key}}, rows, selected)
        assert result['analysis']['rows_used'] == len(data), key
        assert result['analysis']['comparison_count'] >= 1, key
    assert len(changed) == 27
    for key in ('compare_paired_lines', 'compare_paired_change'):
        data = compare[key]
        assert hashlib.sha256(data.to_csv(index=False).encode()).hexdigest() == '340763ba04b55b3b8f4f7e232b52aa32ce825a8ec8094844dcaf397af91539ac'
    # SuperPlot technical repeats intentionally retain their experiment identity.
    assert base['superplot'].groupby(['group', 'experiment']).size().eq(6).all()
    print(f'PASS: {len(changed)} independent starter templates use unique units; values and supplied results unchanged; paired fixtures and SuperPlot repeats preserved.')
    print('Starter rows to refresh: ' + ', '.join(pending))


if __name__ == '__main__':
    main()
