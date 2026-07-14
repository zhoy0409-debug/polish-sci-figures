"""Render the pages/slides of a DOCX, PPTX, or PDF to PNG images so the figure
can be inspected *after insertion*, not just as a standalone plot.

A figure that looks perfect alone routinely breaks once embedded: it overflows
the text column, clips at the slide edge, or the caption reflows. This closes
the loop the QA checklist demands.

IMPORTANT: DOCX and PPTX are rendered by converting through LibreOffice. The
resulting images are a LibreOffice COMPATIBILITY PREVIEW, not native Microsoft
Word / PowerPoint rendering -- fonts, spacing, and effects can differ slightly.
Use it to catch layout failures (overflow, clipping, reflow); confirm final
fidelity in the actual application when it matters. PDF input is rendered
directly and is exact.

Usage
-----
    python render_doc_pages.py manuscript.docx qa/pages     # -> qa/pages/page_001.png ...
    python render_doc_pages.py deck.pptx qa/slides --dpi 150
    python render_doc_pages.py figures.pdf qa/pdf

PDF is rendered directly via PyMuPDF when available, with Poppler's
`pdftoppm` as a fallback. DOCX/PPTX are first converted to PDF with LibreOffice
(`soffice`) if it is on PATH; otherwise the script explains what to install
rather than silently producing nothing.

Requires: PyMuPDF (`pip install pymupdf`) or `pdftoppm`; LibreOffice for
DOCX/PPTX input.
"""
from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile


def _soffice() -> str | None:
    for name in ("soffice", "soffice.exe", "libreoffice"):
        p = shutil.which(name)
        if p:
            return p
    # common Windows install location
    win = r"C:\Program Files\LibreOffice\program\soffice.exe"
    return win if os.path.exists(win) else None


def _pdftoppm() -> str | None:
    """Find pdftoppm, unwrapping simple Windows runtime shims when possible."""
    command = shutil.which("pdftoppm.exe") or shutil.which("pdftoppm")
    if not command or not command.lower().endswith((".cmd", ".bat")):
        return command

    # Some managed runtimes put nested batch shims on PATH. Calling those via
    # cmd.exe can fail when the profile path contains non-ASCII characters,
    # even though the native executable works. Follow only the conventional
    # %~dp0-relative target written literally in the shim.
    current = command
    for _ in range(3):
        if not current.lower().endswith((".cmd", ".bat")):
            break
        try:
            with open(current, encoding="utf-8", errors="replace") as handle:
                source = handle.read()
        except OSError:
            break
        match = re.search(
            r"(?:%~dp0|%SCRIPT_DIR%)([^\"\r\n]*?pdftoppm\.(?:exe|cmd|bat))",
            source,
            flags=re.IGNORECASE,
        )
        if not match:
            break
        target = os.path.normpath(os.path.join(os.path.dirname(current),
                                               match.group(1)))
        if not os.path.isfile(target):
            break
        current = target
    return current


def to_pdf(src: str, workdir: str) -> str:
    ext = os.path.splitext(src)[1].lower()
    if ext == ".pdf":
        return src
    soffice = _soffice()
    if not soffice:
        sys.exit(
            f"{ext} input needs LibreOffice to convert to PDF, but 'soffice' "
            "was not found on PATH.\n"
            "Install LibreOffice, or export the document to PDF yourself and "
            "pass the PDF to this script."
        )
    # Use an isolated user profile so the conversion does not clash with a
    # running LibreOffice instance (a common cause of silent headless failure).
    profile = "file:///" + os.path.join(workdir, "lo_profile").replace("\\", "/")
    proc = subprocess.run(
        [soffice, f"-env:UserInstallation={profile}", "--headless",
         "--convert-to", "pdf", "--outdir", workdir, src],
        capture_output=True, text=True,
    )
    out = os.path.join(workdir, os.path.splitext(os.path.basename(src))[0] + ".pdf")
    if proc.returncode != 0 or not os.path.exists(out):
        sys.exit(
            "LibreOffice failed to convert the document to PDF "
            f"(exit {proc.returncode}).\n"
            f"stdout: {proc.stdout.strip()}\nstderr: {proc.stderr.strip()}\n"
            "If LibreOffice is broken or unavailable in this environment, "
            "export the document to PDF manually and pass the PDF instead."
        )
    return out


def render(pdf_path: str, out_dir: str, dpi: int = 150) -> int:
    try:
        import fitz  # PyMuPDF
    except ImportError:
        fitz = None
    os.makedirs(out_dir, exist_ok=True)

    if fitz is not None:
        doc = fitz.open(pdf_path)
        try:
            zoom = dpi / 72.0
            mat = fitz.Matrix(zoom, zoom)
            for i, page in enumerate(doc, 1):
                pix = page.get_pixmap(matrix=mat)
                out = os.path.join(out_dir, f"page_{i:03d}.png")
                pix.save(out)
                print(f"wrote {out}")
            return doc.page_count
        finally:
            doc.close()

    pdftoppm = _pdftoppm()
    if not pdftoppm:
        sys.exit(
            "PDF rendering needs either PyMuPDF (`pip install pymupdf`) or "
            "Poppler's `pdftoppm` on PATH."
        )

    # A temporary prefix prevents stale or partially rendered pages from being
    # mistaken for this run's output.
    with tempfile.TemporaryDirectory(dir=out_dir) as render_tmp:
        prefix = os.path.join(render_tmp, "page")
        args = ["-png", "-r", str(dpi), pdf_path, prefix]
        if os.name == "nt" and pdftoppm.lower().endswith((".cmd", ".bat")):
            # Windows cannot execute batch wrappers directly via CreateProcess.
            command = [os.environ.get("COMSPEC", "cmd.exe"), "/d", "/c",
                       pdftoppm, *args]
        else:
            command = [pdftoppm, *args]
        proc = subprocess.run(
            command, capture_output=True, text=True, errors="replace"
        )
        if proc.returncode != 0:
            sys.exit(
                f"pdftoppm failed to render the PDF (exit {proc.returncode}).\n"
                f"stdout: {proc.stdout.strip()}\n"
                f"stderr: {proc.stderr.strip()}"
            )

        pages = []
        for name in os.listdir(render_tmp):
            stem, ext = os.path.splitext(name)
            if ext.lower() != ".png" or not stem.startswith("page-"):
                continue
            try:
                page_number = int(stem.rsplit("-", 1)[1])
            except ValueError:
                continue
            pages.append((page_number, os.path.join(render_tmp, name)))
        pages.sort()
        if not pages:
            sys.exit("pdftoppm reported success but produced no PNG pages.")

        for i, (_, source) in enumerate(pages, 1):
            out = os.path.join(out_dir, f"page_{i:03d}.png")
            os.replace(source, out)
            print(f"wrote {out}")
        return len(pages)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("document", help="DOCX, PPTX, or PDF to render")
    ap.add_argument("out_dir", help="directory for page_###.png output")
    ap.add_argument("--dpi", type=int, default=150, help="render resolution (default 150)")
    a = ap.parse_args(argv)

    with tempfile.TemporaryDirectory() as tmp:
        pdf = to_pdf(a.document, tmp)
        n = render(pdf, a.out_dir, dpi=a.dpi)
    print(f"rendered {n} page(s) into {a.out_dir}")


if __name__ == "__main__":
    main()
