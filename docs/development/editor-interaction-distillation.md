# Editor interaction distillation

This is a product adaptation of the Cangjie method: read the source, extract frameworks, principles, cases, failure modes and terminology, verify each selected mechanism, write an executable contract, and test the Figure Studio implementation. The deliverable is editor behavior in suite v1.4.13 / Studio 0.1.13.

## Source overview and scope

- [VectorCraft](https://github.com/storytold/vectorcraft/tree/0a33cff3f6e2a1e9e672f4c3816f58cd8d3d032e), pinned at `0a33cff3f6e2a1e9e672f4c3816f58cd8d3d032e`: document/selection state, tool actions, engine transactions and view rendering are separate. Selected source scope covers gestures, hit testing, affine coordinates, undo and caches.
- [PhotoCraft](https://github.com/storytold/photocraft/tree/a62ef68ca2495b680634e0421b702e4de88287a6), pinned at `a62ef68ca2495b680634e0421b702e4de88287a6`: original pixels, temporary adjustment previews and applied document changes have separate lifecycles. Selected scope covers adjustment sessions, preview resolution, cache identity and cancellation.

Both repositories offer MIT or Apache-2.0 licensing. The bundled `third-party-notices.js` retains upstream MIT notices. Their branding and separately licensed assets are outside this adaptation. Upstream Rust applications and GPU tests were not executed; their README performance numbers are not Figure Studio measurements.

## Verification and coverage

V1 checks an implemented source branch, including its preconditions and failures. V2 checks Figure Studio with new inputs and its own DOM/state tests. V3 requires a concrete user benefit: fewer repeated operations, easier access to obscured objects, stable scientific geometry, or easier inspection of an image adjustment.

| User task | Source mechanism | Figure Studio destination | Verification |
|---|---|---|---|
| Drag or resize many selected objects | Snapshot → replace preview → commit/cancel | `selection-resize-controller.js`, host finish callback | 142-object work counts; real browser drag; undo/reopen tests |
| Edit an object behind another | Top-first hit stack, cycle from selection | `vector-interaction.js`, canvas pointer handler | Real host tests and browser Ctrl-click |
| Move along a consistent direction | Shift-constrained movement | `vector-interaction.js`, object/content movement | Positive/negative axes and diagonals; frame and click boundary tests |
| Keep interval parts together | Indexed workset and coordinate conjugation | `mark-style.js`, `selection-transform-dom.js` | Source geometry, stem/cap ownership, repeated style and resize tests |
| Inspect an image adjustment | Source/session/settings distinct from view state | `image-color-ui.js`, `image-color.js` | Wipe boundaries, source preservation, cancel/apply/session tests |

The error-bar ownership relationship and the image wipe control are Figure Studio adaptations. They are not presented as existing upstream scientific features. The existing source-backed SVG export and local statistical computation remain authoritative.

## Capability cards

### C1: One stable gesture, one history step

**R — source:** VectorCraft [`engine/src/lib.rs:1556–1650`](https://github.com/storytold/vectorcraft/blob/0a33cff3f6e2a1e9e672f4c3816f58cd8d3d032e/crates/engine/src/lib.rs#L1556) and [`tools/src/select.rs:374–453`](https://github.com/storytold/vectorcraft/blob/0a33cff3f6e2a1e9e672f4c3816f58cd8d3d032e/crates/tools/src/select.rs#L374).

**I — interpretation:** Pointer frequency does not determine how many edits or history steps exist. Every preview is an absolute action on the start snapshot.

**A1 — exercise:** A synthetic 142-object Figure Studio selection receives many pointer updates, a final release, then a second resize. This is our exercise, not an upstream benchmark.

**A2 — trigger:** Resize/move a selection or adjust error-bar styles. A simple click below the threshold does not start an edit.

**E — execution:** Capture the state, unique nodes, initial transforms and inverse coordinate maps once. Consume the latest pointer once per animation frame. Reuse an identical, already validated final preview at release. Settle existing outlines without reading every glyph box again. Commit one state. Reject stale state, restore on cancellation, and clear a failed final preview so it cannot commit an older success.

**B — boundaries:** Semantic numeric-axis resizing uses its specialized geometry hook. Autosave and full project validation remain active. This mechanism does not establish universal FPS or low-end device performance.

### C2: Pick obscured objects without rearranging the figure

**R:** VectorCraft [`tools/src/select.rs:339–345,547–550`](https://github.com/storytold/vectorcraft/blob/0a33cff3f6e2a1e9e672f4c3816f58cd8d3d032e/crates/tools/src/select.rs#L339).

**I:** Cycle the native top-first hit stack, rather than interpreting every overlapping bounding box as a hit.

**A1:** Two overlapping synthetic rectangles: normal click selects the top rectangle; Ctrl/Command-click selects the lower one and wraps on repetition. Browser and host tests also check scientific transparent hit proxies, annotations and panel labels.

**A2:** Ctrl/Command-click inside the editable canvas. On touch devices, ordinary selection and existing controls remain available.

**E:** Read `elementsFromPoint` once; normalize proxies to their real source; deduplicate DOM identity within this canvas; filter hidden/locked objects; select the next object after the current selection. Do not write history or rebuild the canvas. Resize handles, placement controls and guides retain priority.

**B:** Modifier-click selects an object; it does not start a move in the same pointer press. The selected object can be edited, resized or nudged with arrow keys. Identical `eN` keys in different panels are distinct objects.

### C3: Direction-constrained movement

**R:** VectorCraft [`tools/src/bbox.rs:106–110`](https://github.com/storytold/vectorcraft/blob/0a33cff3f6e2a1e9e672f4c3816f58cd8d3d032e/crates/tools/src/bbox.rs#L106).

**I:** A selected object or selection follows a horizontal, vertical or exact 45° direction while Shift is held. A snap must not pull it off that direction.

**A1:** Synthetic positive and negative drags, tiny movements, axis snaps with unwanted perpendicular corrections, and two consecutive gestures.

**A2:** Select an object, then Shift-drag in ordinary edit mode. Explicit box-selection mode keeps its existing Shift-add selection behavior. Resize handles keep their aspect-ratio modifier.

**E:** Project the start-relative delta onto the nearest allowed direction. Apply axis snapping only along the moving axis. Diagonal movement currently omits snapping and fake guides. Release uses the final modifier state and records one move; zero-motion clicks record none.

**B:** This changes presentation coordinates, not raw data or calculated results.

### C4: Non-destructive image comparison

**R:** PhotoCraft [`ui-egui/src/adjust_preview.rs:1,15,163,207,224`](https://github.com/storytold/photocraft/blob/a62ef68ca2495b680634e0421b702e4de88287a6/crates/ui-egui/src/adjust_preview.rs#L1), [`full_res_preview.rs`](https://github.com/storytold/photocraft/blob/a62ef68ca2495b680634e0421b702e4de88287a6/crates/ui-egui/tests/full_res_preview.rs#L1), and [`adjust_preview_tests.rs:111`](https://github.com/storytold/photocraft/blob/a62ef68ca2495b680634e0421b702e4de88287a6/crates/ui-egui/src/adjust_preview_tests.rs#L111).

**I:** Original pixels, temporary display parameters, view controls and final history changes are independent. A reduced analysis sample is not an export source.

**A1:** Figure Studio compares an original image and its display adjustment at the same position and scale. The wipe interaction is our adaptation of the preview contract.

**A2:** Open Image color matching for a readable, unlocked embedded raster image.

**E:** Both previews use the same full source `href`. Only the adjusted preview has the validated display filter. Wipe movement changes the clipping boundary; it does not decode pixels, recompute matching, redraw the main figure or write history. Apply commits one adjustment; cancel discards temporary display. A changed source, target or saved adjustment invalidates the session.

**B:** The sampled clipping warning is an estimate of display range, not a scientific measurement of signal. Fluorescence images retain the existing common-parameter constraints. No local signal removal, generative enhancement, arbitrary Photoshop filter stack, RAW/PSD support or GPU equivalence is claimed.

## Reference and deferred mechanisms

Structural sharing, revision-indexed geometry, background thumbnail queues and source-preserving proxies informed the review. Full Rust engine transplantation, PSD layer editing, worker/GPU rendering, R-tree indexing and a new persistent scene graph remain engineering options requiring measured bottlenecks and separate compatibility/export tests. They are not listed as shipped capabilities.

## 中文

本轮按仓颉的五角度提取、三重验证和 R/I/A1/A2/E/B 能力卡方法，把两份固定版本源码中的适用机制落实为 Figure Studio 交互。交付包括稳定的手势快照与一次撤销、Ctrl/Command 轮选遮挡元素、Shift 方向约束，以及原图与调色预览的同位置擦拭对照。

误差棒联动和擦拭控件是本产品的科研场景适配。原始数据、图片像素、统计结果和可编辑导出结构继续保留。上游原生应用与 GPU 测试未在此机运行，其宣传帧率不作为本产品性能证明；未经实测的渲染引擎、PSD 和图层功能没有列为已交付能力。
