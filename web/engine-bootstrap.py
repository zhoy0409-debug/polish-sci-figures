"""Fixed JSON dispatcher for the browser worker; never evaluates submitted code."""
import gc
import copy
import json
import os
import sys
import time

sys.path[:0] = [
    '/suite/skills/polish-sci-figures/scripts',
    '/suite/skills/make-sci-data-figures/scripts',
    '/suite/skills/standardize-sci-images/scripts',
]
os.environ['MPLCONFIGDIR'] = '/tmp/mplconfig'
os.environ['MPLBACKEND'] = 'Agg'


def _studio_dispatch(endpoint, payload_json):
    started = time.monotonic()
    try:
        payload = json.loads(payload_json)
        if not isinstance(payload, dict):
            raise ValueError('Request body must be an object')
        keys = set(payload)
        rendering_warnings = []
        requested_font = None
        if endpoint in {'/api/render', '/api/reflow', '/api/split-facets'} and isinstance(payload.get('recipe'), dict):
            requested_font = payload['recipe'].get('font', 'Arial')
            if isinstance(requested_font, str) and requested_font.strip() and len(requested_font) <= 128:
                from matplotlib import font_manager
                try:
                    font_manager.findfont(font_manager.FontProperties(family=requested_font), fallback_to_default=False)
                except ValueError:
                    payload = copy.deepcopy(payload)
                    payload['recipe']['font'] = 'DejaVu Sans'
                    rendering_warnings.append({
                        'code': 'browser_font_fallback', 'requestedFont': requested_font, 'renderedFont': 'DejaVu Sans',
                        'en': f'The browser calculation engine does not include {requested_font}; this generated preview uses bundled DejaVu Sans. Imported artwork is unchanged. CJK characters remain editable SVG text and depend on the browser display font.',
                        'zh': f'浏览器计算引擎未包含 {requested_font}；本次生成预览使用内置 DejaVu Sans。导入的原图不受影响。中文字符保留为可编辑 SVG 文字，显示依赖浏览器字体。',
                    })
        if endpoint == '/api/image-duplicates':
            if keys != {'images'}:
                raise ValueError('Image check requires images')
            from studio_duplicates import scan_images
            from js import _studio_progress
            response = scan_images(payload['images'], progress=lambda value: _studio_progress(json.dumps(value)))
        elif endpoint == '/api/analyze':
            if keys != {'recipe', 'rows', 'config'}:
                raise ValueError('Analysis requires recipe, rows and config')
            from studio_statistics import analyze
            response = analyze(payload['recipe'], payload['rows'], payload['config'])
        elif endpoint == '/api/render':
            if not {'recipe', 'rows'} <= keys or keys - {'recipe', 'rows', 'statistics', 'axes'}:
                raise ValueError('Rendering requires recipe and rows, with optional statistics and axes')
            from studio_server import regenerate
            response = {'panel': regenerate(payload['recipe'], payload['rows'], payload.get('statistics'), payload.get('axes'))}
        elif endpoint == '/api/reflow':
            if not {'recipe', 'rows', 'width', 'height'} <= keys or keys - {'recipe', 'rows', 'width', 'height', 'axes'}:
                raise ValueError('Reflow requires recipe, rows, width and height, with optional axes')
            from studio_server import reflow
            response = {'variant': reflow(payload['recipe'], payload['rows'], payload['width'], payload['height'], payload.get('axes'))}
        elif endpoint == '/api/split-facets':
            if not {'recipe', 'rows'} <= keys or keys - {'recipe', 'rows', 'statistics'}:
                raise ValueError('Facet splitting requires recipe and rows, with optional statistics')
            from studio_facets import split_facets
            response = split_facets(payload['recipe'], payload['rows'], payload.get('statistics'))
        else:
            raise ValueError('Unknown browser operation')
        if rendering_warnings:
            # Keep the user's requested family in the scientific recipe. Only this
            # newly generated preview has a declared browser rendering fallback.
            panels = [response['panel']] if isinstance(response.get('panel'), dict) else response.get('panels', [])
            for panel in panels:
                if isinstance(panel, dict) and isinstance(panel.get('panel'), dict):
                    panel = panel['panel']
                if isinstance(panel, dict) and isinstance(panel.get('recipe'), dict):
                    panel['recipe']['font'] = requested_font
                    panel['browserRendering'] = {'requestedFont': requested_font, 'renderedFont': 'DejaVu Sans'}
            response = {**response, 'warnings': [*response.get('warnings', []), *rendering_warnings]}
        result = {'status': 200, 'body': {**response, 'seconds': round(time.monotonic() - started, 2)}}
        return json.dumps(result, ensure_ascii=False, allow_nan=False)
    except (ValueError, KeyError, TypeError) as error:
        return json.dumps({'status': 422, 'body': {'error': str(error)}}, ensure_ascii=False)
    except Exception as error:
        return json.dumps({'status': 500, 'body': {'error': str(error)}}, ensure_ascii=False)
    finally:
        if 'matplotlib.pyplot' in sys.modules:
            sys.modules['matplotlib.pyplot'].close('all')
        gc.collect()
