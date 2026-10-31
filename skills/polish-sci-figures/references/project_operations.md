# Local project review and scoped operations

This reference describes the source-tree candidate. Check the installed editor's capabilities before promising a feature in an older desktop release.

In Figure Studio, open **图形质检 / Review** beside Export. Review uses the real exported figure at its declared final size. The default 8 pt text and 0.25 pt line thresholds are editable generic review thresholds, not verified journal rules. Geometry findings require human review; an unavailable scientific check is not a pass. Text-size corrections preview on the real canvas, respect locks, and commit as one undo step. Save during preview saves only committed edits.

For local Skill collaboration, expand **与 Skill 协作 / Skill collaboration** and export the inspection JSON. It contains project identity, per-panel revision hashes, current variants and editable element references. It omits original images and measurement tables, but may contain research text, so keep it private unless the user authorizes sharing.

Create an operation file using only capabilities in that inspection:

```json
{
  "schema": "figure-studio-operations/1",
  "projectId": "COPY_FROM_INSPECTION",
  "base": {"panel-2": "COPY_TARGET_PANEL_REVISION"},
  "operations": [
    {"type": "element.style", "panel": "panel-2", "variant": 0,
     "key": "COPY_ACTUAL_ELEMENT_KEY", "style": {"fill": "#176b5d"}}
  ]
}
```

Import this file in the same workspace, inspect the canvas preview, then Keep or Cancel. Changing A while a C-only operation is prepared does not discard A. Changing C, its source, its data draft or its locked state makes its revision stale and requires a new inspection. Missing targets, invalid properties, unknown operation fields and unsupported source replacement fail atomically. Do not construct keys by counting an unsanitized SVG.

Supported operations:

- `element.style`: explicit existing SVG element, current variant; color, opacity, typography, anchor and line width. No text/result/data replacement or arbitrary CSS. Element resolution uses Studio's existing sanitizer and current source snapshot.
- `panel.label.style`: an existing unlocked panel label; color and typography. It cannot invent labels or rewrite scientific wording.
- `panel.candidate`: select a `localSwitch: true` variant already present in the same bound source-data bundle, with the same physical canvas and viewBox. Include a meaningful `reason` describing suitability and display purpose. The editor requires separate scientific confirmation. This does not fit a new model or regenerate a gallery/ROC recipe; use the established workbench for those changes. Data drafts and content locks must be resolved first. Edits on other panels remain exact.

Style lengths use local SVG coordinates. For a text root, the inspection includes `fontSizeLocal`, `pointFactor` and `finalSizePt`; a desired final size is converted to local size by dividing by the measured `pointFactor`. Do not guess the factor for PDF-derived transforms or unsupported objects. Non-text ink, opacity and line-width changes require scientific confirmation because they may affect data/legend encoding. The normal manual editor remains available. Revision fingerprints also include the key-scheme version, relevant derived renders and presentation context, preventing reuse after a conflicting sanitizer, final-size or layout change.

From the complete suite:

```sh
python sci_figures.py project-ops inspect saved-project.json
python sci_figures.py project-ops apply saved-project.json --patch operations.json --out reviewed-project.json
```

The CLI requires Node.js 18+ and refuses existing output files. The independently installed polish skill also provides `node scripts/studio_operations.cjs inspect PROJECT` and `apply PROJECT PATCH NEW_OUTPUT`. CLI application supports panel label styles and existing candidates; element styles require editor preflight because the CLI does not introduce a second SVG sanitizer. For an already reviewed candidate change, the CLI requires `--confirm-scientific-change`. Never use it merely to suppress review.

Source images, analysis records, measurement data, checkpoints and data drafts are preserved. History gains one state only after the whole operation succeeds. This protocol intentionally cannot overwrite a project, execute code, fetch resources, infer pairing or calibration, choose the smallest P value, or replace raw scientific evidence.

## Organize confirmed existing results

The Review workspace includes a result planner. Declare a role, question and researcher confirmation for every existing panel before generating an order/layout proposal. Editing a purpose or the project invalidates its previous plan. The same local rule module is available through `python sci_figures.py project-ops plan PROJECT --assignments ASSIGNMENTS.json` or `node scripts/studio_operations.cjs plan PROJECT ASSIGNMENTS.json`. Assignments are an array of `{ "panel": "panel-0", "role": "comparison", "question": "Researcher-declared question", "confirmed": true }`. Roles are overview, comparison, relationship, morphology, validation and other. The plan preserves panel revisions and refers only to existing results. It cannot infer a causal evidence hierarchy or fabricate missing experiments.
