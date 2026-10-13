"""Generate synthetic image-check fixtures; no research data are used."""
import base64
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'skills/polish-sci-figures/scripts'))
from figure_studio import build_project, write_html
from test_image_duplicates import raster


def main():
    out = ROOT / '.cache/image-duplicate-demo'
    out.mkdir(parents=True, exist_ok=True)
    first = raster(13)
    examples = [('Synthetic source', first),
                ('Crop and rotation', first.crop((80, 40, 400, 300)).rotate(90, expand=True)),
                ('Independent synthetic field', raster(29)), ('Accidental second copy', first)]
    paths = []
    for i, (name, image) in enumerate(examples):
        png = out / f'image-{i+1}.png'; image.save(png)
        data = base64.b64encode(png.read_bytes()).decode('ascii')
        path = out / f'panel-{i+1}.svg'
        path.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="360pt" height="295pt" viewBox="0 0 360 295"><rect width="360" height="295" fill="white"/><text x="15" y="20" font-family="Arial" font-size="12">{name}</text><image x="15" y="35" width="330" height="245" href="data:image/png;base64,{data}"/></svg>', encoding='utf-8')
        paths.append(path)
    target = out / 'studio.html'
    target.unlink(missing_ok=True)
    write_html(build_project(paths, 'Image check · Synthetic demo', columns=2), target)
    print(target)


if __name__ == '__main__': main()
