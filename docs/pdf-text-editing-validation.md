# PDF text editing validation · Studio 0.1.8

English · [中文](#中文)

## Reproduction and correction

PDF text can encode a 12 pt label as a local `0.012` font with a `1000×` text matrix. Reading or replacing only the local font value produces the wrong physical size. The editor now includes the text and ancestor matrices, panel viewport and output scale exactly once. Stored edits retain the original matrices and may legitimately contain very small local font values.

Positioned character arrays are resized once from the original geometry. Separate parent and child edits are prepared before either font changes, preserving inherited bases and avoiding repeated spacing multiplication. Direct text, absolute-unit runs and relative subscripts retain their size relationships.

Marquee mode now permits dragging objects already in the selection. Blank space and unselected objects still start a selection box, and Shift retains its selection behavior.

## Actual desktop-browser checks

The actual local editor imported a synthetic PDF through its PDF dialog, identifying six editable text objects and one vector object. The fixture includes ordinary, 12×, 1000×, stretched, rotated and nested-scale text. No user research data was used.

- The 1000× text initially read **12 pt** in both the sidebar and quick toolbar.
- Quick edits **1 → 8 → 24 → 8 pt** produced stored local sizes `0.001 → 0.008 → 0.024 → 0.008`. The two 8 pt results had identical measured width and height.
- Sidebar edits **100 → 8 pt** enlarged the text and restored its earlier dimensions, with both controls agreeing.
- With marquee mode still enabled, the selected text moved by mouse drag. One undo restored its original position.
- Three texts with different internal matrices were box-selected together, read as **12 pt**, and moved together directly.
- The downloaded project JSON was reopened through the UI. The 8 pt text and character spacing were preserved. An exported SVG retained the original 1000× matrix, local `0.008px` font and editable text.
- The browser reported no console errors during these interactions.

The user's original PDF was not supplied; these checks reproduce the encoding class and interaction using synthetic PDFs, not the specific source shown in the screenshot. Pixel bounds depend on available fonts and are not used as the definition of point size.

## Automated checks

`test_studio_text_geometry.cjs` and `test_studio_pdf_text_editing.cjs` execute production font helpers and edit application against real SVG DOM nodes. Coverage includes 50×/1000× matrices, ancestor rotation and stretch, inherited and absolute-unit fonts, relative runs, mixed selections, output scale, repeated previews, project/history restoration and parent/child position arrays. They run in the CI DOM job.

Existing positioned-text, rich-text, quick-toolbar, workspace-selection, state/history, keyboard-nudge, deletion, data-text-preservation and panel-export regressions were also run locally. Package and cross-platform CI results are recorded separately on the release; source tests alone do not establish that a distributed installer contains the fix.

## 中文

本次复现了两类问题：PDF 内部字号没有结合变换矩阵换算，导致调整后异常放大；框选模式下，已选对象的拖动仍被当作重新框选。

实际桌面浏览器已通过导入对话框载入含普通、12 倍、1000 倍、拉伸、旋转和嵌套变换文字的合成 PDF，完成以下验证：

- 快捷栏连续设置 **1 → 8 → 24 → 8 pt**，两次 8 pt 的宽高一致，无累积放大。
- 侧栏设置 **100 → 8 pt**，可以正常缩回，两个入口读数一致。
- 保持框选模式时直接拖动已选文字，一次撤销恢复位置；三种内部矩阵的文字可框选并一起移动。
- 实际下载工程 JSON、重新打开及导出 SVG 后，字号、字间距与可编辑文字保留。
- 测试过程中未出现浏览器控制台错误。

另以自动回归覆盖父子文字坐标重复缩放、继承字号、局部上下标、物理输出尺寸和历史恢复。用户原始 PDF 尚未提供，以上实际导入检查使用合成 PDF；安装包与跨平台 CI 的验收结果另行记录。
