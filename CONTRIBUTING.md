# Contributing

Thank you for improving the SCI Figure Skills suite.

## Ground Rules

- Preserve scientific integrity before visual polish.
- Do not add automatic complex inference without a validated specialist workflow.
- Keep raw scientific images immutable.
- Keep command-line compatibility or provide a backward-compatible entry.
- Add tests for every behavioral promise.
- Do not hard-code private user paths, plugin caches, or local runtime paths in delivered sources.

## Local Checks

```bash
python -m compileall -q sci_figures.py scripts skills demo
python test_sci_figures_cli.py
python skills/polish-sci-figures/scripts/test_font_policy.py
python skills/polish-sci-figures/scripts/test_check_source_portability.py
python skills/polish-sci-figures/scripts/figure_accessibility_qa.py --self-test
```

Use `python sci_figures.py doctor --font "DejaVu Sans"` on machines without Arial. Final submission files should use the requested journal font without fallback.
