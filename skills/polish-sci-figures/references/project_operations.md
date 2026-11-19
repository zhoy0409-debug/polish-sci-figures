# Local project review and scoped operations

In builds that expose **Ask AI to review this figure**, select a panel and open **Review**. This action saves a local checklist scoped to the selected panel, with a copyable task prompt. Use its exact project ID, panel revision, variant and element keys. Return the operation JSON on its own so that **Preview AI edits** can check it against the current project before the user keeps it. If preflight reports a changed target, obtain a fresh checklist. Keep the user's unrelated edits, sources and analyses.

This reference describes the source-tree candidate. Check the installed editor's capabilities before promising a feature in an older desktop release.

In Figure Studio, open **图形质检 / Review** beside Export. Review uses the real exported figure at its declared final size. The default 8 pt text and 0.25 pt line thresholds are editable generic review thresholds, not verified journal rules. Geometry findings require human review; an unavailable scientific check is not a pass. Text-size corrections preview on the real canvas, respect locks, and commit as one undo step. Save during preview saves only committed edits.

For local Skill collaboration, expand **与 Skill 协作 / Skill collaboration** and export the inspection JSON. It contains project identity, per-panel revision hashes, current variants and editable element references. It omits original images and measurement tables, but may contain research text, so keep it private unless the user authorizes sharing.

For a small edit, select the panel label or an object in the panel, open **Review → Skill collaboration**, and enter the change in **What should change?** before choosing **Copy scoped Skill task with figure text**. The copied task includes the response format and can be used in a chat without an installed Skill. Selecting a single panel label limits the inspection to that label. For chart edits, the copied inspection includes editable text and explicitly selected objects. Use **Export inspection** or **Ask AI to review this figure** when you need the full element and candidate lists.

Use the inspection JSON embedded in that message. Return the operation object as plain JSON or one JSON code block. In **Review**, choose **Preview from clipboard** or paste the reply manually. A reply may include explanation around a single JSON code block. Studio still checks the project ID and target revision before preview. If a single-panel style edit is stale, Studio can copy a fresh task for that panel.

Inspect **Changes** and use **Compare before edits** to toggle the canvas between the current and proposed designs. **Hide sidebar** reveals the canvas while retaining the preview. Use **Resume review preview** to return to the same proposed edits.

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
- `panel.label.match`: match the font size and actual canvas baseline of an existing reference panel label. Studio computes both values and preserves the target's label text, horizontal position, typeface and color.
- `panel.candidate`: select a `localSwitch: true` variant already present in the same bound source-data bundle, with the same physical canvas and viewBox. Include a meaningful `reason` describing suitability and display purpose. The editor requires separate scientific confirmation. This does not fit a new model or regenerate a gallery/ROC recipe; use the established workbench for those changes. Data drafts and content locks must be resolved first. Edits on other panels remain exact.

Style lengths use local SVG coordinates. For a text root, the inspection includes `fontSizeLocal`, `pointFactor` and `finalSizePt`; a desired final size is converted to local size by dividing by the measured `pointFactor`. Do not guess the factor for PDF-derived transforms or unsupported objects. Non-text ink, opacity and line-width changes require scientific confirmation because they may affect data/legend encoding. The normal manual editor remains available. Revision fingerprints also include the key-scheme version, relevant derived renders and presentation context, preventing reuse after a conflicting sanitizer, final-size or layout change.

From the complete suite:

```sh
python sci_figures.py project-ops inspect saved-project.json
python sci_figures.py project-ops apply saved-project.json --patch operations.json --out reviewed-project.json
```

The CLI requires Node.js 18+ and refuses existing output files. The independently installed polish skill also provides `node scripts/studio_operations.cjs inspect PROJECT` and `apply PROJECT PATCH NEW_OUTPUT`. CLI application supports panel label styles and existing candidates; element styles require editor preflight because the CLI does not introduce a second SVG sanitizer. For an already reviewed candidate change, the CLI requires `--confirm-scientific-change`. Never use it merely to suppress review.

Source images, analysis records, measurement data, checkpoints and data drafts are preserved. History gains one state only after the whole operation succeeds. This protocol intentionally cannot overwrite a project, execute code, fetch resources, infer pairing or calibration, choose the smallest P value, or replace raw scientific evidence.

## Match several panel labels to one reference

In **Review → Skill collaboration**, choose **Export inspection** to include the reference and all targets. Use `displayLabel` to match the visible letters and verify each panel ID. If a label is ambiguous, ask which panel the user means. Check that `capabilities.operations` includes `panel.label.match`.

For “match B and C to A”, return a single operation file. Use `base` for the targets' revisions and use A's ID and revision as the reference in each operation. Use the actual identifiers and revisions from the inspection:

```json
{
  "schema": "figure-studio-operations/1",
  "projectId": "COPY_PROJECT_ID",
  "base": {"panel-1": "COPY_B_REVISION", "panel-2": "COPY_C_REVISION"},
  "operations": [
    {"type": "panel.label.match", "panel": "panel-1", "reference": "panel-0", "referenceRevision": "COPY_A_REVISION"},
    {"type": "panel.label.match", "panel": "panel-2", "reference": "panel-0", "referenceRevision": "COPY_A_REVISION"}
  ]
}
```

Use **Preview AI edits** in Studio to check the batch, then Keep or Cancel. Keep adds one undo step. The batch may contain only label matches, with each target listed once and no changes to the reference. If the reference or a target has changed, export a fresh inspection. Rich text, pinned label geometry, locked targets and baselines outside a target panel's permitted range are rejected. This operation uses the editor's current layout and requires Studio rather than the CLI.

## Organize confirmed existing results

The Review workspace includes a result planner. Declare a role, question and researcher confirmation for every existing panel before generating an order/layout proposal. Editing a purpose or the project invalidates its previous plan. The same local rule module is available through `python sci_figures.py project-ops plan PROJECT --assignments ASSIGNMENTS.json` or `node scripts/studio_operations.cjs plan PROJECT ASSIGNMENTS.json`. Assignments are an array of `{ "panel": "panel-0", "role": "comparison", "question": "Researcher-declared question", "confirmed": true }`. Roles are overview, comparison, relationship, morphology, validation and other. The plan preserves panel revisions and refers only to existing results. It cannot infer a causal evidence hierarchy or fabricate missing experiments.
