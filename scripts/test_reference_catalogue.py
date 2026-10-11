"""Offline reference coverage, image decoding, provenance and honest eligibility."""
import base64,io,json
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
assets=ROOT/'skills/polish-sci-figures/assets/figure-studio'
cards=json.loads((assets/'reference-catalogue.json').read_text(encoding='utf-8'))
previews=json.loads((assets/'catalogue-previews.json').read_text(encoding='utf-8'))
assert [c['number'] for c in cards]==list(range(1,103))
assert len({c['id'] for c in cards})==102
for card in cards:
    assert card['applicability']=='reference-only' and card['dataKind']=='synthetic'
    for field in ('title','inputs'):
        assert all(card[field].get(lang,'').strip() for lang in ('zh','en'))
    assert len(card['sha256'])==64 and not Path(card['source']).is_absolute()
    assert card['image'].startswith('data:image/webp;base64,')
    with Image.open(io.BytesIO(base64.b64decode(card['image'].split(',',1)[1]))) as image:
        image.load();assert image.width>500 and image.height>700
    if card['renderer']:assert card['renderer'] in previews,card['renderer']
print('102 complete bilingual reference contracts, decodable offline previews and valid renderer links passed')
