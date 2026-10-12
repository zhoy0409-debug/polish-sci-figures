"""Local PDF import using PDFium's actual text, path and image objects.

No OCR or data reconstruction is implied. Unsupported paint operations retain a
clearly reported image layer instead of silently dropping artwork. PDFium calls
are serialized: its public C API is not thread safe.
"""
from __future__ import annotations

import base64
import ctypes as C
from contextlib import closing
import io
import math
import re
import threading
import xml.etree.ElementTree as ET

MAX_PDF_BYTES = 20000000
MAX_PAGES = 200
MAX_OBJECTS = 50000
MAX_SEGMENTS = 250000
MAX_CHARS = 100000
MAX_IMAGE_PIXELS = 20000000
MAX_SVG_BYTES = 20000000
MAX_EMBEDDED_BYTES = 18000000
MAX_CONTENT_BYTES = 12000000
_LOCK = threading.RLock()
_SVG = 'http://www.w3.org/2000/svg'
ET.register_namespace('', _SVG)


def _engine():
    try:
        import pypdfium2 as pdfium
        import pypdfium2.raw as raw
    except ImportError as exc:
        raise ValueError('PDF import requires pypdfium2. Install the current Figure Studio release or update the skill dependencies.') from exc
    return pdfium, raw


def _open(data):
    if not isinstance(data, (bytes, bytearray)) or not data or len(data) > MAX_PDF_BYTES:
        raise ValueError('Choose a PDF smaller than 20 MB.')
    if b'%PDF-' not in bytes(data[:1024]):
        raise ValueError('The selected file is not a PDF.')
    pdfium, _ = _engine()
    try:
        doc = pdfium.PdfDocument(bytes(data))
    except pdfium.PdfiumError as exc:
        raise ValueError('This PDF is damaged or password protected. Save an unlocked copy and try again.') from exc
    if not 0 < len(doc) <= MAX_PAGES:
        doc.close()
        raise ValueError('Choose a PDF with between 1 and 200 pages.')
    return doc


def _page_info(page, index):
    w, h = page.get_size()
    if not all(math.isfinite(v) and 0 < v <= 14400 for v in (w, h)):
        raise ValueError('The PDF page dimensions are unsupported.')
    return {'index': index, 'widthPt': w, 'heightPt': h, 'rotation': page.get_rotation()}


def inspect_pdf(data: bytes) -> dict:
    """Read page dimensions without rendering or executing document actions."""
    with _LOCK, _open(data) as doc:
        pages = []
        for i in range(len(doc)):
            with closing(doc[i]) as page:
                pages.append(_page_info(page, i))
        return {'pageCount': len(doc), 'pages': pages}


def _background_effect(data, page_index):
    """Inspect used graphics states; PDFium exposes no blend-mode getter.

    Ordinary constant alpha can be represented by SVG opacity. Blend modes,
    transparency groups and graphics-state soft masks need the page backdrop,
    so rendering just the affected object would change its colors. pypdf reads
    compressed streams and indirect resources; never search raw PDF bytes.
    """
    try:
        from pypdf import PdfReader
        from pypdf.generic import ContentStream, ArrayObject
    except ImportError as exc:
        raise ValueError('PDF import requires pypdf. Install the current Figure Studio release or update the skill dependencies.') from exc
    reader = None
    try:
        reader = PdfReader(io.BytesIO(data), strict=False)
        page = reader.pages[page_index]
        total_bytes = operations = 0
        visited = set()

        def resolved(value):
            return value.get_object() if hasattr(value, 'get_object') else value

        def blend(value):
            value = resolved(value)
            modes = value if isinstance(value, (list, ArrayObject)) else [value]
            return any(str(resolved(mode)) not in ('/Normal', '/Compatible', 'None') for mode in modes)

        def walk(owner, resources=None, depth=0):
            nonlocal total_bytes, operations
            if depth > 15:
                raise ValueError('The PDF effect nesting is too complex for interactive import.')
            owner = resolved(owner)
            if not hasattr(owner, 'get'):
                raise ValueError('The PDF contains an invalid graphics resource.')
            resources = resolved(owner.get('/Resources', resources or {}))
            key = (id(owner), id(resources))
            if key in visited:
                return None
            visited.add(key)
            group = resolved(owner.get('/Group', {}))
            if group.get('/S') == '/Transparency':
                return 'transparency_group'
            if blend(owner.get('/BM')):
                return 'blend_mode'
            source = owner.get('/Contents') if owner.get('/Type') == '/Page' else owner
            if source is None:
                return None
            source = resolved(source)
            parts = source if isinstance(source, ArrayObject) else [source]
            decoded = []
            for part in parts:
                part = resolved(part)
                if not hasattr(part, 'get_data'):
                    raise ValueError('The PDF contains an invalid graphics stream.')
                chunk = part.get_data()
                total_bytes += len(chunk)
                if total_bytes > MAX_CONTENT_BYTES:
                    raise ValueError('The PDF graphics streams are too large for interactive import.')
                decoded.append(chunk)
            # Bound decoded bytes before asking ContentStream to build operators.
            from pypdf.generic import DecodedStreamObject
            bounded = DecodedStreamObject(); bounded.set_data(b'\n'.join(decoded))
            stream = ContentStream(bounded, reader)
            for args, op in stream.operations:
                operations += 1
                if operations > MAX_SEGMENTS:
                    raise ValueError('The PDF has too many graphics operations for interactive import.')
                if op == b'gs' and args:
                    states = resolved(resources.get('/ExtGState', {}))
                    state = resolved(states.get(args[0], {}))
                    if blend(state.get('/BM')):
                        return 'blend_mode'
                    mask = resolved(state.get('/SMask'))
                    if mask is not None and str(mask) != '/None':
                        return 'soft_mask'
                elif op == b'Do' and args:
                    objects = resolved(resources.get('/XObject', {}))
                    obj = resolved(objects.get(args[0], {}))
                    if obj.get('/Subtype') == '/Form':
                        reason = walk(obj, resources, depth+1)
                        if reason:
                            return reason
                elif op in (b'scn', b'SCN') and args:
                    patterns = resolved(resources.get('/Pattern', {}))
                    pattern = resolved(patterns.get(args[-1]))
                    if pattern and hasattr(pattern, 'get_data'):
                        reason = walk(pattern, resources, depth+1)
                        if reason:
                            return reason
            return None

        reason = walk(page)
        if reason:
            return reason
        for annotation in page.get('/Annots', []):
            annotation = resolved(annotation)
            if blend(annotation.get('/BM')):
                return 'blend_mode'
            appearance = resolved(annotation.get('/AP', {})).get('/N')
            appearance = resolved(appearance)
            if appearance:
                candidates = [appearance] if hasattr(appearance, 'get_data') else list(appearance.values())
                for candidate in candidates:
                    reason = walk(candidate, page.get('/Resources'))
                    if reason:
                        return reason
        return None
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError('This PDF uses effects that could not be inspected safely. Export a simplified PDF or SVG and try again.') from exc
    finally:
        if reader is not None:
            reader.close()


def _page_appearance(page, info):
    """Honest full-page fallback only for effects that depend on the backdrop."""
    scale = min(3, math.sqrt(MAX_IMAGE_PIXELS/(info['widthPt']*info['heightPt'])))
    with closing(page.render(scale=scale, fill_color=(255,255,255,255), draw_annots=True)) as bitmap:
        output = io.BytesIO(); bitmap.to_pil().save(output, format='PNG')
    data = output.getvalue()
    if 4*((len(data)+2)//3) > MAX_EMBEDDED_BYTES:
        raise ValueError('This PDF page produces too much image data for interactive editing. Import a smaller page or reduce embedded image resolution.')
    root = _node('svg', width=_num(info['widthPt'])+'pt', height=_num(info['heightPt'])+'pt',
                 viewBox=f"0 0 {_num(info['widthPt'])} {_num(info['heightPt'])}", preserveAspectRatio='xMidYMid meet')
    node = _node('image', x='0', y='0', width=_num(info['widthPt']), height=_num(info['heightPt']),
                 id='pdf-page-appearance', preserveAspectRatio='none')
    node.set('href', 'data:image/png;base64,'+base64.b64encode(data).decode('ascii'))
    root.append(node)
    return {'svg': ET.tostring(root, encoding='unicode'), 'editable': {'texts':0, 'paths':0, 'images':1},
            'warnings': ['This PDF uses blending or transparency effects that this importer cannot preserve as separate editable objects. The page is kept as one image to preserve its appearance. This is a conversion limit, not evidence that the original PDF is image-only.'],
            'warningCodes': ['page_appearance'], 'rasterOnly': True, 'rasterizedObjects': 1}


def _num(v):
    v = float(v)
    if not math.isfinite(v) or abs(v) > 1e9:
        raise ValueError('The PDF contains unsupported coordinates.')
    return format(v, '.7g')


def _node(tag, **attrs):
    return ET.Element('{%s}%s' % (_SVG, tag), {k.replace('_', '-'): str(v) for k, v in attrs.items()})


def _matrix(m):
    return 'matrix(' + ' '.join(_num(v) for v in m) + ')'


def _mul(a, b):
    aa, ab, ac, ad, ae, af = a
    ba, bb, bc, bd, be, bf = b
    return (aa*ba+ac*bb, ab*ba+ad*bb, aa*bc+ac*bd, ab*bc+ad*bd,
            aa*be+ac*bf+ae, ab*be+ad*bf+af)


def _point(m, x, y):
    a, b, c, d, e, f = m
    return a*x+c*y+e, b*x+d*y+f


def _inverse(m):
    a, b, c, d, e, f = m
    det = a*d-b*c
    if abs(det) < 1e-12:
        raise ValueError('The PDF contains a degenerate object transform.')
    return d/det, -b/det, -c/det, a/det, (c*f-d*e)/det, (b*e-a*f)/det


def _address(obj):
    return C.cast(getattr(obj, 'raw', obj), C.c_void_p).value


class _AppearanceFallback(Exception):
    pass


class _Converter:
    def __init__(self, doc, page, info):
        self.pdfium, self.raw = _engine()
        self.doc, self.page = doc, page
        self.info = info
        self.counts = {'texts': 0, 'paths': 0, 'images': 0}
        self.objects = self.segments = 0
        self.raster_layers = 0
        self.embedded_bytes = 0
        self.output_bytes = 1024
        self.background_paths = 0
        self.warnings, self.warning_codes = [], []
        self.root = _node('svg', width=_num(info['widthPt'])+'pt', height=_num(info['heightPt'])+'pt', viewBox=f"0 0 {_num(info['widthPt'])} {_num(info['heightPt'])}", preserveAspectRatio='xMidYMid meet')
        self.defs = _node('defs')
        self.root.append(self.defs)
        l, b, r, t = page.get_bbox()
        self.page_matrix = {0: (1, 0, 0, -1, -l, t), 90: (0, 1, 1, 0, -b, -l),
                            180: (-1, 0, 0, 1, r, -b), 270: (0, -1, -1, 0, t, r)}[page.get_rotation()]
        self.textpage = page.get_textpage()
        self.chars = self._characters()

    def warn(self, code, message):
        if code not in self.warning_codes:
            self.warning_codes.append(code)
            self.warnings.append(message)

    def embed_image(self, node, data):
        self.embedded_bytes += 4*((len(data)+2)//3)
        if self.embedded_bytes > MAX_EMBEDDED_BYTES:
            raise ValueError('This PDF page produces too much image data for interactive editing. Import a smaller page or reduce embedded image resolution.')
        node.set('href', 'data:image/png;base64,'+base64.b64encode(data).decode('ascii'))

    def charge_output(self, node):
        # Reject growing artwork before constructing a complete oversized SVG.
        self.output_bytes += len(ET.tostring(node, encoding='utf-8'))
        if self.output_bytes > MAX_SVG_BYTES:
            raise ValueError('This PDF page is too complex for interactive editing. Import a smaller section or simplify the artwork.')

    def _characters(self):
        r = self.raw
        count = self.textpage.count_chars()
        if count > MAX_CHARS:
            raise ValueError('This page has too many characters for interactive editing.')
        chars = {}
        for i in range(count):
            obj = r.FPDFText_GetTextObject(self.textpage, i)
            code = r.FPDFText_GetUnicode(self.textpage, i)
            if not obj or not code or r.FPDFText_IsGenerated(self.textpage, i) == 1:
                continue
            if code < 32 or code > 0x10ffff or 0xd800 <= code <= 0xdfff:
                continue
            x, y = C.c_double(), C.c_double()
            if r.FPDFText_GetCharOrigin(self.textpage, i, x, y):
                chars.setdefault(_address(obj), []).append((chr(code), x.value, y.value))
        return chars

    def path_data(self, count, getter):
        self.segments += max(count, 0)
        if count < 0 or self.segments > MAX_SEGMENTS:
            raise ValueError('This page has too many path segments for interactive editing.')
        result, bezier = [], []
        r = self.raw
        for i in range(count):
            seg = getter(i)
            x, y = C.c_float(), C.c_float()
            if not seg or not r.FPDFPathSegment_GetPoint(seg, x, y):
                raise _AppearanceFallback('path_geometry')
            kind = r.FPDFPathSegment_GetType(seg)
            xy = _num(x.value)+' '+_num(y.value)
            if kind == r.FPDF_SEGMENT_BEZIERTO:
                bezier.append(xy)
                if len(bezier) == 3:
                    result.append('C'+' '.join(bezier)); bezier = []
            elif kind in (r.FPDF_SEGMENT_MOVETO, r.FPDF_SEGMENT_LINETO) and not bezier:
                result.append(('M' if kind == r.FPDF_SEGMENT_MOVETO else 'L')+xy)
            else:
                raise _AppearanceFallback('path_geometry')
            if r.FPDFPathSegment_GetClose(seg):
                result.append('Z')
        if bezier:
            raise _AppearanceFallback('path_geometry')
        return ' '.join(result)

    def paint(self, obj, node, fill, stroke):
        r = self.raw
        for name, enabled, api in [('fill', fill, r.FPDFPageObj_GetFillColor), ('stroke', stroke, r.FPDFPageObj_GetStrokeColor)]:
            if not enabled:
                node.set(name, 'none'); continue
            values = [C.c_uint() for _ in range(4)]
            if not api(obj, *values):
                raise _AppearanceFallback('pattern_paint')
            red, green, blue, alpha = [v.value for v in values]
            node.set(name, '#%02x%02x%02x' % (red, green, blue))
            if alpha != 255:
                node.set(name+'-opacity', _num(alpha/255))
        if stroke:
            width = C.c_float()
            if r.FPDFPageObj_GetStrokeWidth(obj, width):
                node.set('stroke-width', _num(width.value if width.value > 0 else .25))
            cap = r.FPDFPageObj_GetLineCap(obj)
            join = r.FPDFPageObj_GetLineJoin(obj)
            node.set('stroke-linecap', {0:'butt', 1:'round', 2:'square'}.get(cap, 'butt'))
            node.set('stroke-linejoin', {0:'miter', 1:'round', 2:'bevel'}.get(join, 'miter'))
            count = r.FPDFPageObj_GetDashCount(obj)
            if count > 10000:
                raise ValueError('The PDF dash pattern is too complex.')
            if count > 0:
                dash = (C.c_float*count)()
                if r.FPDFPageObj_GetDashArray(obj, dash, count):
                    node.set('stroke-dasharray', ' '.join(_num(v) for v in dash))
                    phase = C.c_float()
                    if r.FPDFPageObj_GetDashPhase(obj, phase):
                        node.set('stroke-dashoffset', _num(phase.value))

    def clip(self, obj, parent, parent_matrix):
        r = self.raw
        clip = r.FPDFPageObj_GetClipPath(obj)
        count = r.FPDFClipPath_CountPaths(clip) if clip else 0
        for i in range(max(0, count)):
            n = r.FPDFClipPath_CountPathSegments(clip, i)
            if n <= 0:
                # Text clipping cannot be recovered through these path APIs.
                raise _AppearanceFallback('complex_clipping')
            d = self.path_data(n, lambda j: r.FPDFClipPath_GetPathSegment(clip, i, j))
            # PDFium does not expose the clip path's winding rule. A single
            # simple rectangle/polygon is unambiguous; preserve more complex
            # clipping through a local image layer instead of guessing holes.
            if n > 5 or d.count('M') != 1 or 'C' in d:
                raise _AppearanceFallback('complex_clipping')
            ident = 'pdf-clip-'+str(len(self.defs))
            entry = _node('clipPath', id=ident, clipPathUnits='userSpaceOnUse')
            entry.append(_node('path', d=d, transform=_matrix(_mul(self.page_matrix, parent_matrix))))
            self.charge_output(entry)
            self.defs.append(entry)
            wrapper = _node('g', clip_path='url(#'+ident+')')
            parent.append(wrapper)
            parent = wrapper
        return parent

    def text(self, obj, matrix):
        r = self.raw
        mode = r.FPDFTextObj_GetTextRenderMode(obj)
        if mode == r.FPDF_TEXTRENDERMODE_INVISIBLE:
            return None
        if mode not in (r.FPDF_TEXTRENDERMODE_FILL, r.FPDF_TEXTRENDERMODE_STROKE, r.FPDF_TEXTRENDERMODE_FILL_STROKE):
            raise _AppearanceFallback('text_clipping')
        chars = self.chars.get(_address(obj), [])
        text = ''.join(c[0] for c in chars)
        if not text:
            text = obj.extract().strip()
        if not text:
            return None
        if '\ufffd' in text:
            raise _AppearanceFallback('unmapped_text')
        font = obj.get_font()
        family = re.sub(r'^[A-Z]{6}\+', '', font.get_base_name())
        low = family.lower()
        if 'dejavu' in low:
            family = 'DejaVu Sans' if 'sans' in low else 'DejaVu Serif'
        elif 'helvetica' in low or 'arial' in low:
            family = 'Arial'
        elif 'times' in low:
            family = 'Times New Roman'
        elif 'courier' in low:
            family = 'Courier New'
        else:
            family = re.sub(r'[-,](Bold|Italic|Oblique|Regular).*$', '', family, flags=re.I)
        # No remote fonts or hidden outline overlay: the visible text stays editable.
        self.warn('font_substitution', 'PDF text remains editable. A locally available font is used; review lettering before export.')
        node = _node('text', font_family=family+', Arial, sans-serif', font_size=_num(obj.get_font_size()),
                     transform=_matrix(_mul(_mul(self.page_matrix, matrix), (1, 0, 0, -1, 0, 0))))
        node.text = text
        node.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
        if 'bold' in low or font.get_weight() >= 600:
            node.set('font-weight', '700')
        if 'italic' in low or 'oblique' in low or max(0, r.FPDFFont_GetFlags(font)) & 64:
            node.set('font-style', 'italic')
        if chars:
            inverse = _inverse(matrix)
            xy = [_point(inverse, c[1], c[2]) for c in chars]
            node.set('x', ' '.join(_num(v[0]) for v in xy))
            node.set('y', ' '.join(_num(-v[1]) for v in xy))
        else:
            node.set('x', '0'); node.set('y', '0')
            self.warn('text_spacing', 'Some original character spacing was unavailable; review those text labels.')
        self.paint(obj, node, mode != r.FPDF_TEXTRENDERMODE_STROKE, mode != r.FPDF_TEXTRENDERMODE_FILL)
        self.counts['texts'] += 1
        return node

    def image(self, obj, parent_matrix):
        w, h = obj.get_px_size()
        if not w or not h or w*h > MAX_IMAGE_PIXELS:
            raise ValueError('An embedded image exceeds the 20 megapixel import limit.')
        l, b, r, t = obj.get_bounds()
        cw, ch = abs(r-l), abs(t-b)
        if not cw or not ch:
            return None
        if (w < h) != (cw < ch):
            w, h = h, w
        # A stretched image can create a much larger bitmap than its source
        # dimensions. Bound the transformed allocation before calling PDFium.
        scale = min(max(w/cw, h/ch), math.sqrt(MAX_IMAGE_PIXELS/(cw*ch)))
        if scale < max(w/cw, h/ch)-1e-6:
            self.warn('image_resolution', 'A stretched image was resampled at a bounded resolution to keep editing responsive.')
        original = obj.get_matrix()
        # Rendering this image alone applies its mask and affine transform. It does
        # not rasterize the page's separate text, paths or other image objects.
        try:
            obj.set_matrix(original.scale(scale, scale))
            with closing(obj.get_bitmap(render=True, scale_to_original=False)) as bitmap:
                # The only PIL view is encoded and closed before its owning PDFium
                # bitmap; no caller receives a reference to this foreign buffer.
                bitmap.warn_on_close = False
                im = bitmap.to_pil()
                try:
                    data = io.BytesIO(); im.save(data, format='PNG')
                finally:
                    im.close()
        finally:
            obj.set_matrix(original)
        matrix = _mul(_mul(self.page_matrix, parent_matrix), (r-l, 0, 0, -(t-b), l, t))
        node = _node('image', x='0', y='0', width='1', height='1', preserveAspectRatio='none', transform=_matrix(matrix))
        self.embed_image(node, data.getvalue())
        self.counts['images'] += 1
        return node

    def raster_layer(self, obj, ancestors, reason, annotations=False):
        """Render only one unsupported paint object, keeping all others editable."""
        self.raster_layers += 1
        if self.raster_layers > 32:
            raise ValueError('This page has too many special effects for interactive import. Simplify the PDF before importing.')
        r = self.raw
        changed = []
        allowed = {_address(item) for item in ancestors}
        wanted = _address(obj) if obj else None
        def isolate(container=None):
            count = r.FPDFFormObj_CountObjects(container) if container else r.FPDFPage_CountObjects(self.page)
            for i in range(count):
                item = r.FPDFFormObj_GetObject(container, i) if container else r.FPDFPage_GetObject(self.page, i)
                address = _address(item)
                active = C.c_int()
                if not r.FPDFPageObj_GetIsActive(item, active):
                    raise ValueError('The PDF object could not be isolated safely.')
                if address == wanted:
                    continue
                if address in allowed:
                    isolate(item)
                elif active.value:
                    if not r.FPDFPageObj_SetIsActive(item, False):
                        raise ValueError('The PDF object could not be isolated safely.')
                    changed.append(item)
        try:
            isolate()
            scale = min(3, math.sqrt(MAX_IMAGE_PIXELS/(self.info['widthPt']*self.info['heightPt'])))
            with closing(self.page.render(scale=scale, fill_color=(255,255,255,0), draw_annots=annotations)) as bitmap:
                im = bitmap.to_pil().convert('RGBA')
                bounds = im.getchannel('A').getbbox()
                if not bounds:
                    return None
                data = io.BytesIO(); im.crop(bounds).save(data, format='PNG')
        finally:
            for item in reversed(changed):
                r.FPDFPageObj_SetIsActive(item, True)
        l, t, right, bottom = bounds
        node = _node('image', x=_num(l/scale), y=_num(t/scale), width=_num((right-l)/scale), height=_num((bottom-t)/scale),
                     id='pdf-raster-layer-'+str(self.raster_layers), preserveAspectRatio='none')
        self.embed_image(node, data.getvalue())
        self.counts['images'] += 1
        self.warn('appearance_layer', 'Special PDF paint, clipping, or annotations are kept as image layers. Other text and paths remain editable; image-layer contents cannot be edited separately.')
        return node

    def walk(self, parent, container=None, parent_matrix=(1, 0, 0, 1, 0, 0), depth=0, ancestors=()):
        if depth > 15:
            raise _AppearanceFallback('deep_forms')
        r = self.raw
        count = r.FPDFFormObj_CountObjects(container) if container else r.FPDFPage_CountObjects(self.page)
        for i in range(count):
            self.objects += 1
            if self.objects > MAX_OBJECTS:
                raise ValueError('This page has too many objects for interactive editing.')
            raw = r.FPDFFormObj_GetObject(container, i) if container else r.FPDFPage_GetObject(self.page, i)
            obj = self.pdfium.PdfObject(raw, page=self.page, textpage=self.textpage)
            active = C.c_int(1)
            if r.FPDFPageObj_GetIsActive(obj, active) and not active.value:
                continue
            try:
                matrix = _mul(parent_matrix, obj.get_matrix().get())
                target = self.clip(obj, parent, parent_matrix)
                if obj.type == r.FPDF_PAGEOBJ_FORM:
                    self.walk(target, obj, matrix, depth+1, (*ancestors, obj)); continue
                if obj.type == r.FPDF_PAGEOBJ_PATH:
                    d = self.path_data(r.FPDFPath_CountSegments(obj), lambda j: r.FPDFPath_GetPathSegment(obj, j))
                    node = _node('path', d=d, transform=_matrix(_mul(self.page_matrix, matrix)))
                    fill, stroke = C.c_int(), C.c_int()
                    if not r.FPDFPath_GetDrawMode(obj, fill, stroke):
                        raise _AppearanceFallback('path_paint')
                    self.paint(obj, node, fill.value != r.FPDF_FILLMODE_NONE, bool(stroke.value))
                    node.set('fill-rule', 'evenodd' if fill.value == r.FPDF_FILLMODE_ALTERNATE else 'nonzero')
                    self.counts['paths'] += 1
                    if not stroke.value and node.get('fill') == '#ffffff':
                        l, b, right, top = obj.get_bounds()
                        pm = _mul(self.page_matrix, parent_matrix)
                        corners = [_point(pm, x, y) for x, y in ((l,b),(l,top),(right,b),(right,top))]
                        if (min(p[0] for p in corners) <= .1 and min(p[1] for p in corners) <= .1 and
                            max(p[0] for p in corners) >= self.info['widthPt']-.1 and
                            max(p[1] for p in corners) >= self.info['heightPt']-.1):
                            self.background_paths += 1
                elif obj.type == r.FPDF_PAGEOBJ_TEXT:
                    node = self.text(obj, matrix)
                elif obj.type == r.FPDF_PAGEOBJ_IMAGE:
                    node = self.image(obj, parent_matrix)
                else:
                    raise _AppearanceFallback('unsupported_paint')
            except (_AppearanceFallback, self.pdfium.PdfiumError) as exc:
                target = parent
                node = self.raster_layer(obj, ancestors, str(exc))
            if node is not None:
                node.set('id', 'pdf-object-'+str(self.objects))
                self.charge_output(node)
                target.append(node)

    def convert(self):
        try:
            self.walk(self.root)
            if self.raw.FPDFPage_GetAnnotCount(self.page):
                node = self.raster_layer(None, (), 'pdf_annotations', annotations=True)
                if node is not None:
                    self.charge_output(node)
                    self.root.append(node)
        finally:
            self.textpage.close()
        raster = not self.counts['texts'] and self.counts['paths'] == self.background_paths
        if raster and not self.counts['images']:
            raise ValueError('This PDF page is blank. Choose another page.')
        if raster:
            self.warn('image_only', 'This page contains image artwork only. Move or resize the images; text and marks inside them are not separately editable.')
        elif not self.counts['texts'] and self.counts['paths']:
            self.warn('outlined_text', 'No editable text was found. Any lettering drawn as outlines remains a vector shape, not editable characters.')
        svg = ET.tostring(self.root, encoding='unicode')
        if len(svg.encode('utf-8')) > MAX_SVG_BYTES:
            raise ValueError('This PDF page is too complex for interactive editing. Import a smaller section or simplify the artwork.')
        return {'svg': svg, 'editable': self.counts,
                'warnings': self.warnings, 'warningCodes': self.warning_codes, 'rasterOnly': raster,
                'rasterizedObjects': self.raster_layers}


def import_pdf_page(data: bytes, page_index: int = 0) -> dict:
    """Convert one zero-based PDF page, preserving independently editable objects."""
    if isinstance(page_index, bool) or not isinstance(page_index, int):
        raise ValueError('The PDF page index must be an integer.')
    with _LOCK, _open(data) as doc:
        if not 0 <= page_index < len(doc):
            raise ValueError('The requested PDF page does not exist.')
        with closing(doc[page_index]) as page:
            info = _page_info(page, page_index)
            reason = _background_effect(data, page_index)
            result = _page_appearance(page, info) if reason else _Converter(doc, page, info).convert()
            result.update(pageIndex=page_index, pageCount=len(doc), widthPt=info['widthPt'], heightPt=info['heightPt'])
            return result
