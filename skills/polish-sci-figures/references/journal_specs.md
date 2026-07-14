# Journal figure specs (quick reference)

Always confirm against the target journal's current author guidelines; these
are stable conventions, not a substitute for the official spec. Sizes are the
printed figure width, not the manuscript page.

| Journal / family | Single col | Double col | Figure font | Min resolution | Vector? | TIFF? |
|---|---|---|---|---|---|---|
| Nature / Nature portfolio | 89 mm | 183 mm | **sans-serif** (Arial/Helvetica), 5-7 pt min | 300-600 dpi | prefers editable vector (AI/EPS/PDF) | on request |
| Science (AAAS) | 55 mm (1 col) / 120 mm (2 col) | 183 mm (3 col) | **sans-serif**, ~6-8 pt | 300+ dpi | AI/EPS preferred | accepted |
| Cell Press | 85 mm | 174 mm | **sans-serif (Arial)** | 300 (color) / 500 (line) | PDF/AI/EPS | accepted |
| PNAS | 87 mm | 178 mm | sans-serif, >=6 pt | 300-600 dpi | TIFF/EPS/PDF | yes |
| PLOS | 83 mm | 173 mm | Arial/Times, >=8 pt | 300-600 dpi | TIFF/EPS | required (TIFF/EPS) |
| Elsevier (general) | 90 mm | 190 mm | sans-serif >=7 pt | 300 (halftone)/1000 (line) | EPS/PDF | yes |
| Frontiers | 85 mm | 180 mm | sans-serif | 300-600 dpi | TIFF/EPS/PDF | yes |

## Font strategy (no universal default)

- **Family.** Do not globally force one family. Match the target journal /
  template / approved reference. A sans-serif family (Arial/Helvetica) is a
  reasonable default *for figure text* because many journals set figure labels
  in sans-serif even when body text is serif — but switch to serif, or a
  journal-mandated family, when the target requires it. The user's or project's
  explicit choice always wins.
- **Size — per journal, not one number:**
  - Nature / Science / Cell / PNAS / Elsevier: ~5-7 pt at final width.
  - **Frontiers: minimum 8 pt.**
  - **PLOS: 8-12 pt.**
  The bundled `sci_style.mplstyle` defaults to 7 pt (compact Nature family);
  apply the >=8 pt override documented at the top of that style file for
  Frontiers/PLOS. If a label falls below the target minimum, shrink the plot
  area or reduce tick density rather than the text.
- **Resolution:** >=300 dpi for halftone/photographic, 600 dpi for line art or
  when the journal requires it.
- **Master format:** keep an editable vector (SVG/PDF) plus the source script
  and data; add TIFF only when the journal requires it.

## Panel-label conventions

- Manuscripts, no contrary rule: bold lowercase in parentheses `(a) (b) (c)`.
- Cell/Nature main figures often use bold uppercase `A B C` — follow the target.
- PPT: follow the deck's existing A/B/C/D convention.
- One label size across main and supplementary figures.
