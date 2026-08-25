# Environment & dependencies

Install once into the active Python environment:

```bash
pip install -r requirements.txt
# optional but recommended for direct PDF rendering:
pip install -r requirements-optional.txt
# optional, when the source workflow is R-native: use R + ggplot2 instead
```

| Capability | Package | Used by |
|---|---|---|
| Plotting (default backend) | `matplotlib`, `numpy` | figure generation, `assets/sci_style.mplstyle`, `scripts/panel_labels.py` |
| Data handling | `pandas` | reading source data |
| Contact-sheet montage | `Pillow` | `scripts/make_montage.py` |
| Render DOCX/PPTX/PDF pages to PNG | `pymupdf` (`import fitz`) **or** Poppler `pdftoppm` | `scripts/render_doc_pages.py` |
| DOCX/PPTX -> PDF conversion | **LibreOffice** (`soffice` on PATH) | `scripts/render_doc_pages.py` (only for .docx/.pptx input) |
| SVG editability audit | stdlib only | `scripts/check_svg_editability.py` |
| SVG physical-canvas audit | stdlib only | `scripts/check_svg_canvas.py` |
| Source portability audit | stdlib only | `scripts/check_source_portability.py` |
| Accessibility/delivery QA | stdlib + Pillow | `scripts/figure_accessibility_qa.py` |

Notes
- **Fonts.** v1.3.1 fails by default when the requested font is missing. Use
  `--allow-font-fallback` only for draft previews; audits must record requested
  font, actual font, font file, fallback status, and whether the output is
  allowed for final delivery.
- **LibreOffice** is only needed to render Word/PowerPoint pages. If it is not
  installed, export the document to PDF manually and pass the PDF instead.
- **PDF renderer.** `render_doc_pages.py` prefers PyMuPDF and automatically
  falls back to Poppler's `pdftoppm` when PyMuPDF is unavailable. Install at
  least one of them; some managed runtimes already provide `pdftoppm` on PATH.
- Pin the same backend the project already uses; only default to
  Python/matplotlib when there is no existing plotting signal.
