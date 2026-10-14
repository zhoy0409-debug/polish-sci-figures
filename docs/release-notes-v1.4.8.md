# Suite v1.4.8 · Figure Studio 0.1.8

English · [中文](#中文)

This hotfix corrects font-size editing in imported PDF/SVG artwork and makes selected objects directly movable after marquee selection. These notes describe the prepared version; publication and finished-package checks are recorded on its GitHub release.

## Set the size you actually want

PDF text can store a small local font size and enlarge it with a transformation. Figure Studio now includes the text's own transformation, ancestor transformations and output scale when reading or setting its size in points. The sidebar and quick toolbar use the same physical size, including rotated text and mixed selections with equivalent visible sizes.

Changing the font size preserves the original text transformations and updates individually positioned characters without repeatedly multiplying their spacing. Nested text runs retain their relative sizes, including subscripts and superscripts. Edits remain reversible and are saved with the project.

## Select, then drag

After drawing a selection box, drag an already selected object to move the selection immediately. This also works for selected inserted annotations and panel labels. Starting from blank space or an unselected object still draws a selection box; Shift keeps its selection behavior. One completed drag creates one undo step.

## Update and continue

- Windows: [installer](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.8/polish-sci-figures-Studio-0.1.8-Setup-x64.exe) or [portable ZIP](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.8/polish-sci-figures-Studio-0.1.8-Portable-x64.zip).
- AI workflows: [single-skill upload](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.8/polish-sci-figures-v1.4.8-skill.zip) or [complete three-skill suite](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.8/sci-figure-suite-v1.4.8.zip).
- Mac and Android remain [development previews](https://github.com/zhoy0409-debug/polish-sci-figures/releases/tag/figure-studio-local-preview-0.1.8); follow the [device guide](local-device-trial.md). iPhone/iPad has no installable IPA. PDF import requires the desktop engine.

Save an editable project backup before upgrading. Version 0.1.7 can check official downloads through **Updates**. Version 0.1.6 and earlier need a manual installation to gain this reminder. The image inset, manual color, image-linking and local analysis features from [0.1.7](release-notes-v1.4.7.md) remain available.

## Verification scope

Regression checks use real SVG DOM nodes and synthetic PDFs with 50× and 1000× text matrices, rotations, nested text runs, repeated font-size changes, project save/restore and output scaling. The pointer checks exercise the production selection handlers, including cancellation, undo and persisted positions. Browser and CI evidence for the release is recorded separately; test fixtures do not establish compatibility with every PDF producer.

The user's original PDF has not been supplied. Reproduction and browser checks therefore use synthetic PDF fixtures rather than that source file. Existing PDF font-substitution and unsupported-effect conversion limits still apply.

## 中文

本次热修复纠正导入 PDF/SVG 后的字号换算，并支持框选后直接拖动已选对象。这份说明描述待发行版本；实际发布与成品包验收结果以对应 GitHub 发行页为准。

### 设置的字号，就是实际需要的字号

PDF 可以用很小的内部字号配合变换矩阵显示较大的文字。编辑器现在将文字自身变换、祖先变换和输出缩放一起纳入 pt 字号换算。侧栏与快捷工具栏使用同一套实际字号，包括旋转文字，以及内部表示不同、实际字号相同的混合选择。

改字号时保留原文字变换，并调整逐字符坐标，避免反复叠加字间距。嵌套文字片段保留相对大小，包括上下标；修改仍可撤销，并随工程保存。

### 框选后，直接拖动

框选完成后，从任一已选对象开始拖动，即可移动整个选择。已选的手动标注和小图图号也支持此操作。从空白或未选对象开始仍可框选，Shift 保持原有的选择行为；一次完整拖动只记录一步撤销。

### 升级后继续编辑

- Windows：[安装版](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.8/polish-sci-figures-Studio-0.1.8-Setup-x64.exe)或[便携 ZIP](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.8/polish-sci-figures-Studio-0.1.8-Portable-x64.zip)。
- AI 工作流：[单技能上传包](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.8/polish-sci-figures-v1.4.8-skill.zip)或[完整三技能套件](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.8/sci-figure-suite-v1.4.8.zip)。
- Mac、Android 仍为[开发预览](https://github.com/zhoy0409-debug/polish-sci-figures/releases/tag/figure-studio-local-preview-0.1.8)，安装步骤见[设备指南](local-device-trial.md#中文)。iPhone/iPad 暂无可安装 IPA；PDF 导入需要桌面版引擎。

升级前请保存可编辑工程备份。0.1.7 可通过**更新**入口查找官方下载；0.1.6 及更早版本需手动安装一次才能获得提醒。[0.1.7](release-notes-v1.4.7.md#中文) 的局部放大、手动调色、图片关联和本地分析功能继续保留。

### 验证范围

回归使用真实 SVG DOM 与合成 PDF，覆盖 50×、1000× 文字矩阵、旋转、嵌套文字、反复修改字号、工程保存恢复和输出缩放。指针回归执行实际选择处理代码，包含取消、撤销和位置持久化。发行版的浏览器及 CI 证据另行记录，不将这些用例等同于所有 PDF 生成软件的兼容性验证。

用户原始 PDF 尚未提供，因此复现与浏览器检查使用合成 PDF，而非该源文件。已有的 PDF 字体替代与特殊效果转换边界仍然适用。
