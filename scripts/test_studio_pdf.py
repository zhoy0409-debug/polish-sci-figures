"""Exercise actual scientific PDF objects, not mocked PDFium bindings."""
import base64
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
import io
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
import xml.etree.ElementTree as ET

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
from PIL import Image
import pypdfium2 as pdfium
from pypdf import PdfWriter
from pypdf.generic import (DictionaryObject, NameObject, NumberObject,
                           FloatObject, ArrayObject, DecodedStreamObject)

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'skills/polish-sci-figures/scripts'))
import studio_pdf

NS = {'s':'http://www.w3.org/2000/svg'}


def chart_pdf(kind='vector'):
    buffer = io.BytesIO()
    fig, ax = plt.subplots(figsize=(4, 3))
    if kind == 'gradient':
        ax.pcolormesh(np.array([[0., 1.], [1., 0.]]), shading='gouraud')
    elif kind == 'mixed':
        ax.imshow(np.arange(100).reshape(10, 10), extent=(0, 2, 0, 4))
    else:
        ax.bar([0, 1], [2, 3], color=['#487aad', '#cb617a'], alpha=.7)
    ax.plot([-1, 0, 1, 2, 3], [0, 1, 3, 2, 4], '--', color='#146b6b')
    ax.set_xlim(-.5, 1.5)
    ax.set_ylabel('Concentration (mg/L)')
    ax.set_title('Editable research', fontstyle='italic')
    fig.savefig(buffer, format='pdf'); plt.close(fig)
    return buffer.getvalue()


def paint_pdf(mode='/Multiply', *, used=True, form=False, alpha=None, group=False, soft_mask=False):
    writer = PdfWriter(); page = writer.add_blank_page(100, 100)
    state = DictionaryObject({NameObject('/BM'):NameObject(mode)})
    if alpha is not None:
        state[NameObject('/ca')] = FloatObject(alpha)
    if soft_mask:
        mask_form = DecodedStreamObject(); mask_form.set_data(b'1 g 0 0 100 100 re f')
        mask_form.update({NameObject('/Type'):NameObject('/XObject'), NameObject('/Subtype'):NameObject('/Form'),
                         NameObject('/BBox'):ArrayObject([NumberObject(v) for v in [0,0,100,100]]),
                         NameObject('/Group'):DictionaryObject({NameObject('/S'):NameObject('/Transparency')})})
        state[NameObject('/SMask')] = DictionaryObject({NameObject('/S'):NameObject('/Luminosity'),
                                                       NameObject('/G'):writer._add_object(mask_form)})
    resources = DictionaryObject({NameObject('/ExtGState'):DictionaryObject({NameObject('/GS1'):writer._add_object(state)})})
    stream = DecodedStreamObject()
    stream.set_data(b'1 0 0 rg 10 10 60 60 re f '+(b'/GS1 gs ' if used else b'')+b'0 0 1 rg 40 40 50 50 re f')
    if form:
        stream.update({NameObject('/Type'):NameObject('/XObject'), NameObject('/Subtype'):NameObject('/Form'),
                       NameObject('/BBox'):ArrayObject([NumberObject(v) for v in [0,0,100,100]]),
                       NameObject('/Resources'):resources})
        if group:
            stream[NameObject('/Group')] = DictionaryObject({NameObject('/S'):NameObject('/Transparency')})
        # Compress the nested stream: byte searching would miss its used gs/Do.
        ref = writer._add_object(stream.flate_encode())
        page[NameObject('/Resources')] = DictionaryObject({NameObject('/XObject'):DictionaryObject({NameObject('/Form1'):ref})})
        outer = DecodedStreamObject(); outer.set_data(b'/Form1 Do')
        page[NameObject('/Contents')] = writer._add_object(outer.flate_encode())
    else:
        page[NameObject('/Resources')] = resources
        page[NameObject('/Contents')] = writer._add_object(stream.flate_encode())
    output = io.BytesIO(); writer.write(output)
    return output.getvalue()


class PdfImportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.vector = chart_pdf()

    def test_vector_text_paths_and_real_style(self):
        result = studio_pdf.import_pdf_page(self.vector)
        svg = ET.fromstring(result['svg'])
        self.assertFalse(result['rasterOnly'])
        self.assertGreater(result['editable']['texts'], 5)
        self.assertGreater(result['editable']['paths'], 8)
        self.assertEqual(result['editable']['images'], 0)
        self.assertIn('Editable research', ''.join(svg.itertext()))
        self.assertTrue(svg.findall('.//s:text[@font-style="italic"]', NS))
        self.assertTrue(svg.findall('.//s:path[@stroke-dasharray]', NS))
        self.assertTrue(svg.findall('.//s:path[@fill-opacity]', NS))
        self.assertTrue(svg.findall('.//s:clipPath', NS))
        self.assertEqual(svg.attrib['viewBox'], '0 0 288 216')

    def test_scanned_pdf_is_honestly_image_only(self):
        data = io.BytesIO()
        Image.new('RGB', (80, 60), '#cb617a').save(data, 'PDF')
        result = studio_pdf.import_pdf_page(data.getvalue())
        self.assertTrue(result['rasterOnly'])
        self.assertEqual(result['editable'], {'texts':0, 'paths':0, 'images':1})
        self.assertIn('image_only', result['warningCodes'])
        node = ET.fromstring(result['svg']).find('.//s:image', NS)
        with Image.open(io.BytesIO(base64.b64decode(node.attrib['href'].split(',')[1]))) as embedded:
            self.assertEqual(embedded.size, (80, 60))

    def test_mixed_pdf_keeps_both_vector_and_image_objects(self):
        result = studio_pdf.import_pdf_page(chart_pdf('mixed'))
        self.assertGreater(result['editable']['texts'], 0)
        self.assertGreater(result['editable']['paths'], 0)
        self.assertGreater(result['editable']['images'], 0)
        self.assertFalse(result['rasterOnly'])

    def test_unsupported_gradient_is_one_layer_not_whole_page(self):
        result = studio_pdf.import_pdf_page(chart_pdf('gradient'))
        self.assertGreater(result['editable']['texts'], 0)
        self.assertGreater(result['editable']['paths'], 0)
        self.assertGreater(result['rasterizedObjects'], 0)
        self.assertIn('appearance_layer', result['warningCodes'])
        self.assertFalse(result['rasterOnly'])
        self.assertIn('Editable research', result['svg'])
        svg = ET.fromstring(result['svg'])
        images = svg.findall('.//s:image', NS)
        # The isolated gradient has no copy of page text or background behind it.
        self.assertTrue(all(float(n.attrib['width']) < result['widthPt'] for n in images))

    def test_rotation_crop_and_multiple_pages(self):
        out = io.BytesIO()
        with pdfium.PdfDocument(self.vector) as doc:
            with closing(doc[0]) as page:
                page.set_rotation(90)
                page.set_cropbox(20, 20, 260, 190)
            doc.import_pages(doc, [0])
            doc.save(out)
        data = out.getvalue()
        info = studio_pdf.inspect_pdf(data)
        self.assertEqual(info['pageCount'], 2)
        self.assertEqual(info['pages'][0]['widthPt'], 170)
        self.assertEqual(info['pages'][0]['heightPt'], 240)
        result = studio_pdf.import_pdf_page(data, 1)
        self.assertEqual(result['pageIndex'], 1)
        self.assertEqual(result['pageCount'], 2)
        self.assertIn('matrix(0 1 1 0 -20 -20)', result['svg'])

    def test_nested_form_preserves_editable_children(self):
        out = io.BytesIO()
        with pdfium.PdfDocument(self.vector) as source, pdfium.PdfDocument.new() as dest:
            with closing(dest.new_page(432, 324)) as page:
                form = source.page_as_xobject(0, dest)
                obj = form.as_pageobject()
                obj.set_matrix(pdfium.PdfMatrix(1.2, 0, 0, 1.2, 20, 30))
                page.insert_obj(obj); page.gen_content(); dest.save(out)
        result = studio_pdf.import_pdf_page(out.getvalue())
        self.assertGreater(result['editable']['texts'], 5)
        self.assertGreater(result['editable']['paths'], 8)
        self.assertEqual(result['editable']['images'], 0)
        self.assertIn('Editable research', result['svg'])

    def test_nested_unsupported_object_only_rasterizes_its_layer(self):
        out = io.BytesIO()
        with pdfium.PdfDocument(chart_pdf('gradient')) as source, pdfium.PdfDocument.new() as dest:
            with closing(dest.new_page(432, 324)) as page:
                form = source.page_as_xobject(0, dest)
                obj = form.as_pageobject()
                obj.set_matrix(pdfium.PdfMatrix(1.2, 0, 0, 1.2, 20, 30))
                page.insert_obj(obj); page.gen_content(); dest.save(out)
        result = studio_pdf.import_pdf_page(out.getvalue())
        self.assertEqual(result['rasterizedObjects'], 1)
        self.assertGreater(result['editable']['texts'], 5)
        self.assertGreater(result['editable']['paths'], 8)
        image = ET.fromstring(result['svg']).find('.//s:image', NS)
        self.assertGreater(float(image.attrib['x']), 20)
        self.assertLess(float(image.attrib['width']), 300)

    def test_image_orientation_and_page_rotation_remain_separate(self):
        # Unequal corner colors make a vertical flip visible; single-color scans
        # would not detect a mistaken PDF bottom-left to SVG top-left conversion.
        im = Image.new('RGB', (80, 60))
        im.paste('#cb617a', (0,0,40,30)); im.paste('#487aad', (40,0,80,30))
        im.paste('#146b6b', (0,30,40,60)); im.paste('#b0822c', (40,30,80,60))
        data = io.BytesIO(); im.save(data, 'PDF')
        result = studio_pdf.import_pdf_page(data.getvalue())
        image = ET.fromstring(result['svg']).find('.//s:image', NS)
        with Image.open(io.BytesIO(base64.b64decode(image.attrib['href'].split(',')[1]))) as decoded:
            red = decoded.convert('RGB').getpixel((10,10))
            self.assertGreater(red[0], red[1])
            blue = decoded.convert('RGB').getpixel((60,10))
            self.assertGreater(blue[2], blue[0])
        self.assertIn('matrix(80 0 0 60 0 0)', image.attrib['transform'])

    def test_curves_keep_bezier_geometry(self):
        data = io.BytesIO(); fig, ax = plt.subplots(figsize=(3,2))
        ax.scatter([0,1,2], [1,2,1], s=150); fig.savefig(data, format='pdf'); plt.close(fig)
        result = studio_pdf.import_pdf_page(data.getvalue())
        paths = ET.fromstring(result['svg']).findall('.//s:path', NS)
        self.assertTrue(any('C' in p.attrib.get('d','') for p in paths))
        self.assertEqual(result['rasterizedObjects'], 0)

    def test_repeated_parallel_imports_do_not_mutate_input(self):
        with ThreadPoolExecutor(max_workers=3) as pool:
            results = list(pool.map(studio_pdf.import_pdf_page, [self.vector]*3))
        self.assertEqual(results[0]['svg'], results[1]['svg'])
        self.assertEqual(results[0]['svg'], results[2]['svg'])

    def test_bad_files_pages_and_resource_limits(self):
        for data in (b'', b'<svg/>', b'%PDF-broken'):
            with self.assertRaises(ValueError):
                studio_pdf.inspect_pdf(data)
        for index in (-1, 1, True, .5, '0'):
            with self.assertRaises(ValueError):
                studio_pdf.import_pdf_page(self.vector, index)
        with patch.object(studio_pdf, 'MAX_OBJECTS', 1), self.assertRaises(ValueError):
            studio_pdf.import_pdf_page(self.vector)
        blank = io.BytesIO()
        with pdfium.PdfDocument.new() as doc:
            doc.new_page(200, 100).close(); doc.save(blank)
        with self.assertRaisesRegex(ValueError, 'blank'):
            studio_pdf.import_pdf_page(blank.getvalue())

    def test_backdrop_blend_preserves_pixels_and_reports_conversion_limit(self):
        for nested in (False, True):
            data = paint_pdf(form=nested)
            result = studio_pdf.import_pdf_page(data)
            self.assertEqual(result['editable'], {'texts':0, 'paths':0, 'images':1})
            self.assertEqual(result['warningCodes'], ['page_appearance'])
            self.assertNotIn('image_only', result['warningCodes'])
            node = ET.fromstring(result['svg']).find('.//s:image', NS)
            with Image.open(io.BytesIO(base64.b64decode(node.attrib['href'].split(',')[1]))) as preserved:
                self.assertEqual(preserved.convert('RGB').getpixel((150,150)), (0,0,0))
                with pdfium.PdfDocument(data) as doc, closing(doc[0]) as page, closing(page.render(scale=3)) as bitmap:
                    self.assertEqual(preserved.convert('RGB').tobytes(), bitmap.to_pil().convert('RGB').tobytes())

    def test_constant_alpha_and_unused_blend_resources_stay_editable(self):
        for data in (paint_pdf('/Normal', alpha=.5), paint_pdf(used=False), paint_pdf('/Normal', alpha=.5, form=True)):
            result = studio_pdf.import_pdf_page(data)
            self.assertEqual(result['editable'], {'texts':0, 'paths':2, 'images':0})
            self.assertNotIn('page_appearance', result['warningCodes'])
        result = studio_pdf.import_pdf_page(paint_pdf('/Normal', alpha=.5))
        self.assertIn('fill-opacity=', result['svg'])

    def test_used_transparency_group_and_soft_mask_report_limit(self):
        for data in (paint_pdf('/Normal', form=True, group=True), paint_pdf('/Normal', soft_mask=True)):
            result = studio_pdf.import_pdf_page(data)
            self.assertEqual(result['warningCodes'], ['page_appearance'])
            self.assertTrue(result['rasterOnly'])

    def test_repeated_image_output_has_early_cumulative_limit(self):
        rng = np.random.default_rng(2026)
        pixels = rng.integers(0,256,(100,100,3),dtype=np.uint8).tobytes()
        image = DecodedStreamObject(); image.set_data(pixels)
        image.update({NameObject('/Type'):NameObject('/XObject'), NameObject('/Subtype'):NameObject('/Image'),
                      NameObject('/Width'):NumberObject(100), NameObject('/Height'):NumberObject(100),
                      NameObject('/ColorSpace'):NameObject('/DeviceRGB'), NameObject('/BitsPerComponent'):NumberObject(8)})
        writer = PdfWriter(); page = writer.add_blank_page(100,100)
        page[NameObject('/Resources')] = DictionaryObject({NameObject('/XObject'):DictionaryObject({NameObject('/Im'):writer._add_object(image.flate_encode())})})
        contents = DecodedStreamObject(); contents.set_data(b'q 100 0 0 100 0 0 cm /Im Do Q\n'*24)
        page[NameObject('/Contents')] = writer._add_object(contents)
        data = io.BytesIO(); writer.write(data)
        original = studio_pdf._Converter.embed_image
        calls = []
        def counted(converter, node, payload):
            calls.append(len(payload))
            return original(converter, node, payload)
        with patch.object(studio_pdf, 'MAX_EMBEDDED_BYTES', 80000), patch.object(studio_pdf._Converter, 'embed_image', counted):
            with self.assertRaisesRegex(ValueError, 'too much image data'):
                studio_pdf.import_pdf_page(data.getvalue())
        self.assertLess(len(calls), 4)
        with patch.object(studio_pdf, 'MAX_SVG_BYTES', 1000), self.assertRaisesRegex(ValueError, 'too complex'):
            studio_pdf.import_pdf_page(self.vector)


if __name__ == '__main__':
    unittest.main(verbosity=2)
