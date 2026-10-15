"""Font-class regressions using real PDF objects and real PDFium conversion."""
from pathlib import Path
from io import BytesIO
import sys
import unittest
import xml.etree.ElementTree as ET
from pypdf import PdfWriter
from pypdf.generic import DictionaryObject,NameObject,NumberObject,ArrayObject,DecodedStreamObject

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'skills/polish-sci-figures/scripts'))
import studio_pdf
NS={'s':'http://www.w3.org/2000/svg'}

def font_pdf(family='Helvetica',flags=None,italic_angle=0):
    """One unembedded Type1 font. Descriptor flags survive through PDFium."""
    writer=PdfWriter();page=writer.add_blank_page(240,110)
    font=DictionaryObject({NameObject('/Type'):NameObject('/Font'),NameObject('/Subtype'):NameObject('/Type1'),NameObject('/BaseFont'):NameObject('/'+family),NameObject('/Encoding'):NameObject('/WinAnsiEncoding')})
    if flags is not None:
        descriptor=DictionaryObject({NameObject('/Type'):NameObject('/FontDescriptor'),NameObject('/FontName'):NameObject('/'+family),NameObject('/Flags'):NumberObject(flags),NameObject('/FontBBox'):ArrayObject([NumberObject(v) for v in [0,-200,1000,900]]),NameObject('/Ascent'):NumberObject(800),NameObject('/Descent'):NumberObject(-200),NameObject('/CapHeight'):NumberObject(700),NameObject('/ItalicAngle'):NumberObject(italic_angle),NameObject('/StemV'):NumberObject(80)})
        font[NameObject('/FontDescriptor')]=writer._add_object(descriptor)
    page[NameObject('/Resources')]=DictionaryObject({NameObject('/Font'):DictionaryObject({NameObject('/F1'):writer._add_object(font)})})
    stream=DecodedStreamObject();stream.set_data(b'BT /F1 12 Tf 1 0 0 1 20 55 Tm [(AV) -80 (ATAR)] TJ ET')
    page[NameObject('/Contents')]=writer._add_object(stream)
    output=BytesIO();writer.write(output);return output.getvalue()

class PdfFontFallbackTests(unittest.TestCase):
    def converted(self,family,flags=None,italic_angle=0):
        result=studio_pdf.import_pdf_page(font_pdf(family,flags,italic_angle))
        root=ET.fromstring(result['svg']);text=root.find('.//s:text',NS)
        self.assertIsNotNone(text);self.assertFalse(result['rasterOnly']);self.assertEqual(result['editable']['texts'],1)
        self.assertEqual(result['editable']['images'],0);self.assertEqual(text.text,'AVATAR')
        self.assertIn('font_substitution',result['warningCodes'])
        self.assertEqual(len(text.attrib['x'].split()),len(text.text));self.assertEqual(len(text.attrib['y'].split()),len(text.text))
        self.assertEqual(text.attrib['font-size'],'12')
        return result,text

    def test_standard_font_classes_remain_editable_with_matching_local_fallback(self):
        for family,first,last in [('Helvetica','Arial','sans-serif'),('Times-Roman','Times New Roman','serif'),('Courier','Courier New','monospace')]:
            with self.subTest(family=family):
                result,text=self.converted(family)
                self.assertTrue(text.attrib['font-family'].startswith('"'+first+'"'))
                self.assertTrue(text.attrib['font-family'].endswith(last))
                if last=='serif':self.assertNotIn('sans-serif',text.attrib['font-family']);self.assertNotIn('Arial',text.attrib['font-family'])

    def test_unknown_name_uses_real_pdf_serif_and_fixed_pitch_descriptor_flags(self):
        for flags,suffix in [(2,', "Times New Roman", Times, serif'),(1,', "Courier New", monospace'),(3,', "Courier New", monospace')]:
            with self.subTest(flags=flags):
                result,text=self.converted('ExampleResearchFace',flags)
                self.assertEqual(text.attrib['font-family'],'"ExampleResearchFace"'+suffix)
                self.assertNotIn('Arial',text.attrib['font-family'])

    def test_recognizable_serif_names_without_descriptors_do_not_fall_back_to_arial(self):
        for family in ['Palatino-Roman','Garamond','Baskerville','BookAntiqua']:
            with self.subTest(family=family):
                result,text=self.converted(family)
                self.assertTrue(text.attrib['font-family'].endswith(', "Times New Roman", Times, serif'))
                self.assertNotIn('Arial',text.attrib['font-family'])

    def test_subset_prefix_and_native_bold_italic_are_preserved(self):
        result,text=self.converted('ABCDEE+TimesNewRomanPSMT')
        self.assertTrue(text.attrib['font-family'].startswith('"Times New Roman"'));self.assertNotIn('ABCDEE+',result['svg'])
        for family in ['Helvetica-BoldOblique','Times-BoldItalic','Courier-BoldOblique']:
            with self.subTest(family=family):
                result,text=self.converted(family);self.assertEqual(text.attrib.get('font-weight'),'700');self.assertEqual(text.attrib.get('font-style'),'italic')

    def test_dejavu_monospace_face_is_not_renamed_to_proportional_sans(self):
        for family in ['DejaVuSansMono','ABCDEE+DejaVuSansMono-Bold']:
            with self.subTest(family=family):
                result,text=self.converted(family)
                self.assertTrue(text.attrib['font-family'].startswith('"DejaVu Sans Mono"'))
                self.assertTrue(text.attrib['font-family'].endswith(', "Courier New", monospace'))

    def test_descriptor_italic_flag_is_applied_without_rewriting_text_geometry(self):
        result,text=self.converted('ExampleResearchFace',2|64,-12)
        self.assertEqual(text.attrib.get('font-style'),'italic');self.assertTrue(text.attrib['font-family'].endswith(', "Times New Roman", Times, serif'))
        positions=[float(v) for v in text.attrib['x'].split()];self.assertEqual(positions[0],0);self.assertTrue(all(b>a for a,b in zip(positions,positions[1:])))
        self.assertEqual(set(float(v) for v in text.attrib['y'].split()),{0.0})
        # Original per-glyph kerning is retained on import; only an explicit
        # font replacement may hand those advances to the browser's new font.
        self.assertIn('matrix(',text.attrib['transform']);self.assertNotIn('textLength',text.attrib)

if __name__=='__main__':unittest.main(verbosity=2)
