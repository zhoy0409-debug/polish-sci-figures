---
author: a
created: 2026-10-28
---

# Figure review, result planning and scoped collaboration

The source candidate also includes [native TIFF display previews and background project saves](figure-studio-native-tiff.md). The guide states supported formats, quantitative boundaries and the pending installed-Windows scope.

This guide describes the next stable source candidate. Check the installed version and release record for availability. Existing editing, statistics and export controls remain available.

Open **Review** beside Export. Set the minimum text and line sizes, then review the current figure at its final export size. The defaults, 8 pt and 0.25 pt, are generic thresholds rather than verified journal requirements. Locate findings on the canvas. Text overlap is a bounding-box screen and may need manual rejection for rotated text.

Preview a text-size adjustment individually or in a batch. Keep creates one undo step; Cancel or Esc restores the committed canvas. Saving during a draft saves committed content only. Locked objects and unsupported rich text are skipped. Review again after editing the figure or changing export size. Pending data and axis calculations must finish first; edits made during measurement invalidate the result.

An unverifiable check has insufficient evidence. A bitmap cannot establish biological units, pairing, uncertainty definitions or calibration. The review does not invent them. Contrast is checked only against an established opaque uniform background, and existing analysis records do not prove that statistical assumptions were revalidated. Review makes no network requests and preserves original images, measurements and analysis records.

Under **Layout suggestions**, compare balanced, portrait and focus layouts using existing masters and native variants. Preview and cancel remain available. Locked content and cropped master bounds must be handled through the existing controls before automatic layout; they are not forcibly moved.

Under **Plan a figure from existing results**, read the current panels, declare each role and research question, and confirm the result. The planner proposes a reading order and layouts from actual panels only. It does not fill missing A–H experiments or infer a causal chain. Changing a question invalidates its previous plan; changing the project requires a fresh inspection. Scientific images without structured data may be included with their evidence limitations retained.

For Skill collaboration, export a local inspection, ask the local Skill for a targeted operation file, then import it for preflight and real-canvas preview. The inspection omits original images and measurement tables but may contain private research text. A C-only edit preserves new manual changes to A; changes to C invalidate its revision. Arbitrary project overwrites, raw-data replacement, code execution and external resource loading are refused.

**Use A as the reference for B and C.** Select A first, then Shift-click B and C. In the alignment menu, choose **Match first selected label size and baseline**. In a narrow window, open alignment from **More**. Review the preview and choose Keep or Cancel. One undo restores both target labels. This workflow requires existing plain labels and a baseline both targets can reach.

**Hand a scoped edit to the Skill.** Select the panel and choose **Copy scoped Skill task with figure text** under **Skill collaboration (local files)**. Review the copied content, paste it into the Skill, and specify the edit. Back in Studio, use **Paste Skill edits** to preview the returned operation JSON. The file handoff remains available. If the reference or a target changed, copy or export a fresh inspection.

Candidate changes must use an existing, same-canvas alternative in the same bound data bundle and explain scientific suitability. They require a separate scientific confirmation. Regenerated chart families continue through the established workbench. See the [operation protocol and CLI](../skills/polish-sci-figures/references/project_operations.md).

For projects above 1000 elements, palette cards display swatches immediately and generate actual current-figure previews in visible batches. Pending previews are labelled, generation stops when the pane is left, and re-entry can resume. No demonstration chart substitutes for user data.

See the [audit and acceptance record](windows-next-stable-audit.md) for the actual Windows installation, upgrade and performance scope.

Under **Submission size and export → Submission profiles…**, save researcher-declared dimensions and review thresholds, preview on the actual canvas, then Keep or Cancel. **Review kept figure** uses the same measured-SVG rules and reports excess height and settings changed after the profile was kept. Sources are never fetched automatically; general defaults do not certify journal requirements. See the [profile workflow and scope](figure-studio-submission-profiles.md).

## Colour vision, notation and find/replace

These features ship with Figure Studio 0.2.5.

- **Colour-vision preview** shows red-, green- and blue-blind and grayscale views on screen only. A badge stays visible; projects and exports keep their colours.
- **Review current figure** also lists colours that merge in those views, mixed fonts, and baseline notation such as IC50, cm^2 or 1e-05. It does not decide whether colour carries group meaning. More than 24 chromatic colours is treated as a continuous scale.
- **Preview notation fixes** changes plain display text only, with one undo. Check journal and font support for scripts.
- **Find and replace text** (Ctrl/Cmd + H) matches literally across panels and text annotations. Locked, statistical and character-formatted text is listed but not replaced in bulk.
