# Editing directly on the Figure Studio canvas

This guide covers live canvas editing in Suite v1.4.26 / Windows Studio 0.1.26. Downloads are on the [version-specific release page](https://github.com/zhoy0409-debug/polish-sci-figures/releases/tag/v1.4.26). Earlier editing evidence remains historical; the [photo-correction report](figure-studio-photo-correction-validation.md) records this round’s package and performance status.

Photographed images use the same explicit draft boundary: **Image tools → Auto straighten & refine** provides automatic outlines, ruler straightening and editable corners. Preview and Cancel are temporary; **Keep correction** creates one version and one Undo step. The retained original remains available, and optional photo colour suggestions stay global and editable. See the [photo workflow](figure-studio-photo-correction.md#english-quick-reference).

Adjustments retain the real draft rendering and canonical final validation; the palette pane provides all eight complete previews. While an input method is composing text, candidate Enter/Esc does not commit or cancel the whole edit. For ordinary text editing, finish selecting the text, then press ordinary Enter or leave the field to keep it, or press Esc to discard the draft. Tools with an explicit Apply button still require that action. Text and display edits preserve original tables and source artwork. See the [Windows IME record](windows-native-ime-acceptance.md) for the actual operation evidence.

Select an object and choose **Borders** above the canvas. The docked inspector shows colour, print width, dashes, corners and edge options while the actual canvas stays visible. **Apply borders** records one undo step for the whole adjustment; **Cancel preview** or **Esc** restores the original. Mixed values retain each target's other settings, and locked targets remain unchanged.

Open **Statistics & axes**, or double-click a recognized axis. Live preview uses the actual local data renderer and keeps the last valid result while computing. Apply once to keep the settings; cancel to restore. Later requests supersede older ones. Imported vectors retain their supported geometric limits, and a locked object or unsupported scientific setting produces a reason instead of a fabricated result. Click the axis preview canvas to return to ordinary object editing. If numeric composition is rejected, trailing events or cancelling another candidate cannot silently change a limit to Automatic. Correct the value, deliberately clear the field to request Automatic, or cancel the draft; the last valid chart remains visible.

Common fields use a lighter interaction: type or drag while looking at the canvas, then press Enter or leave the field to keep one edit. Esc cancels. This covers quick font size/colour, inspector HEX/opacity/line width, panel-label settings and publication dimensions. Find **Change panel label colour** through command search or select the label and use the quick colour control.

The same interaction covers scale-bar styling, statistical annotation size, heatmap value precision and colour, supported bar geometry, grid rows/columns, panel spans and gaps. Existing axis range, first-group-gap and reference-line controls use asynchronous canvas previews with Enter/blur or slider release to keep them. Source measurements and statistical estimates stay unchanged.

Continuous decimal text fields support arrow-key adjustment and smaller steps with Shift. Rendering preserves the active field and caret; character-level editing retains the existing text editor.

Pressing Esc during a slider drag cancels that entire gesture, including movement before you release the pointer. Release it to start another adjustment.

Image display and linked-detail tools now dock beside the canvas. Their existing original/adjusted comparison, histogram, ROI and source checks remain available. Inset and text-spacing tools retain their established local previews. Invalid or unfinished input keeps the last valid view and cannot silently apply an older value. Physical scale bars still require real calibration.

After Figure Discovery renders actual-data candidates, choose **Compare on canvas** on a card. The docked tool shows the candidate at its real position in the composite; cancel restores the original, and applying keeps one edit. Literature chart comparisons use your current data. A local preview does not verify a paper's figure number or caption.

Replacing the data clears the old overview and recommendations. If the new file cannot be read, read a valid table before continuing; the tool will not generate views from the previous measurements. You can select the same file again. Text fields keep their own editing shortcuts, while ordinary buttons let canvas undo and nudging work.

Tools with an explicit Apply/Keep button save and export only committed settings. Keep a draft first if it should appear in the final file. Simple fields commit when focus leaves them. The export menu moves focus, so press Esc to discard or Enter to keep the field before exporting. Unfinished input cannot commit on blur and retains the last valid preview. Cancel does not add history; undo reverses a committed gesture. Changing the project or target invalidates old drafts.

Visual previews do not alter source observations, embedded image pixels or statistical provenance. Image display is not scientific normalization. Literature searches, duplicate screening and matching remain explicit actions; ordinary styling does not start network requests or image analysis.

An uncalibrated image starts with a blank source-width field. Enter its actual physical width from acquisition records. Each image restores its own calibration and saved scale settings when selected.

On touch screens and narrow windows, Adjustments docks beside or below the canvas without blocking it. Borders opens the controls directly. The panel navigator retains its closable drawer.

Scale calibration refers to the full source-image width. Letterboxing is excluded; a sliced image retains full-source calibration while the bar is placed in its visible region. Bars are never shortened to fit while retaining the same physical label. Reduce length, font size or thickness if needed. Extra clipping or masking without a verified visible region cannot receive a new scale bar. An unverifiable legacy record remains in the project with a notice and blocks export until corrected; other editing remains available.

Actual interface examples: [Figure Discovery in Pearl](qa/live-preview/resource-source16-discovery-pearl-zh.png) and [local chart comparisons in Carbon](qa/live-preview/resource-source16-literature-carbon.png).

See the [acceptance record](live-preview-validation.md) for measured conditions, recordings and unverified scope, and the [workflow audit](../audit/live-preview-inventory.md) for before/after procedures.

See the [actual before/after recordings](live-preview-demonstration.md), with source hashes and recording limits.
