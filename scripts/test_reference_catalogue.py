"""Reference metadata is internal; published previews are original SVGs."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
assets=ROOT/'skills/polish-sci-figures/assets/figure-studio'
refs=ROOT/'skills/polish-sci-figures/references'
assert not (assets/'reference-catalogue.json').exists()
cards=json.loads((refs/'design-pattern-index.json').read_text(encoding='utf-8'))
assert len(cards)==102 and all('image' not in c for c in cards)
archive=json.loads((refs/'chart-gallery-index.json').read_text(encoding='utf-8'))
assert len(archive['items'])==187 and len({c['id'] for c in archive['items']})==187
previews=json.loads((assets/'catalogue-previews.json').read_text(encoding='utf-8'))
starters=json.loads((assets/'template-starters.json').read_text(encoding='utf-8'))
assert len(starters)==33
for name,starter in starters.items():
    assert name in previews and '<svg' in previews[name]
    assert '<image' not in previews[name] and 'base64' not in previews[name]
    assert len(starter['rows'])>1 and starter['recipe']['family'] in {'gallery','roc_results'}
print('102 prior + 187 new reference metadata entries; 33 original editable starters; no copied image cards')
