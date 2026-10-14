# Changelog

## v1.4.9 · Figure Studio 0.1.9

- Resize individual or mixed selections with edge and corner handles, preserving PDF transforms and editable source assets; one gesture produces one undo step.
- Add direct **Resize panel content** and **Fit to cell** actions, with aspect-ratio choices in the canvas toolbar.
- Delete a panel from its left-hand trash button, retaining recoverable data and source assets; deleting the last panel leaves an editable blank canvas.
- Add guided download, integrity checking and confirmed installation of future updates in the installed Windows edition. Versions 0.1.8 and earlier require a first manual upgrade to 0.1.9; portable Windows and native previews retain their separate installation steps.

[Release notes / 本版更新](docs/release-notes-v1.4.9.md)

## v1.4.8 · Figure Studio 0.1.8

- Read and edit imported PDF/SVG text in physical points, including its own and ancestor transformations and output scaling.
- Keep positioned character spacing and nested text-run sizes consistent across repeated edits, undo and project restoration.
- Drag selected objects directly after marquee selection; blank-space and Shift selection remain available.
- Validate the fixes with synthetic PDF/SVG fixtures and production editor handlers; the user's original PDF has not been provided.

[Hotfix notes](docs/release-notes-v1.4.8.md)

## v1.4.7 · Figure Studio 0.1.7

- Add editable image insets from the original raster image, with ROI selection, magnification, borders, connectors and calibrated scale bars using common 1 / 2 / 5 values.
- Keep inset edits in undo, projects and SVG / TIFF exports.
- Add reversible brightfield reference matching and visible manual brightness, contrast, temperature and tint controls; fluorescence uses shared linear display adjustments, retaining source pixels.
- Link two or three overview/detail images with reviewed matching regions, editable frames and connectors, movement tracking, hide/undo, project persistence and SVG / TIFF export.
- Add unobtrusive update reminders, manual checks, offline status and official platform downloads; users of 0.1.6 need a first manual upgrade.

[Prepared release notes](docs/release-notes-v1.4.7.md)

## v1.4.6 · Figure Studio 0.1.6

- Add quick solid/hollow/custom point styles, independent fill/outline colours, group/black/grey/custom error-bar colours, and separate hide/restore switches that preserve data and appearance settings.
- Place editable grouped and supported faceted comparisons above their matching data, retaining earlier edits and adapting to spacing, fonts and panel sizes.
- Keep statistical styles and condition tables together in Annotations, with one context-menu entry point.
- Add optional Europe PMC examples with caption verification and compatible previews using the current data; research data remain local.
- Preserve newer data, size and analysis choices during asynchronous chart switches.
- Refresh Windows packages and provide separate Mac/Android development previews; iOS remains simulator-only.

[Release details](docs/release-v1.4.6.md) · [Device downloads](docs/local-device-trial.md)

## v1.4.5 · Figure Studio 0.1.5

- Review an active image pair with wheel zoom, drag-to-pan, synchronized views, matching lines and an overlay using the recorded alignment.
- Choose source images before scanning; locate canvas pairs after layout changes and flag replaced or removed sources.
- Save per-pair decisions and notes with the project and include them in reports; cancelled or failed checks preserve the last completed record.
- Retain source images once for later review, omit originals from exported reports, and allow project import/export up to 200 MB per file.

[Release details](docs/release-v1.4.5.md) · [Image review guide](docs/image-duplicate-check.md)

## v1.4.4 · Figure Studio 0.1.4

- Local image duplicate screening checks the current figure, selected images or panels, and local files without dismantling groups.
- Identical pixels and suspected rotated, flipped, resized or cropped overlaps are presented with pair evidence and canvas location actions.
- Download HTML/JSON reports and individual evidence images; the `duplicates` CLI also writes CSV records to a new report folder.
- The scientific-image and figure-polishing skills include source-based image reuse checks alongside their existing preparation and QA workflows.

[Release details](docs/release-v1.4.4.md) · [Image duplicate guide](docs/image-duplicate-check.md)

## v1.4.3 · Figure Studio 0.1.3

- Guided statistics recognize common columns, rank methods by data type and confirmed design, and preview results before application.
- Automatic comparison lines remain editable: adjust individual endpoints, line width and bracket style, then restore automatic placement when needed.
- Import SVG artwork or a selected PDF page. Supported native text and paths remain editable; PDF effects may require local image layers or a whole-page appearance image. This is a conversion limit, not evidence that the source PDF was image-only.
- Text insertion opens in place. Horizontal/vertical lines, endpoint handles, angle snapping, and comparison brackets simplify manual annotation.
- Data-table checks identify invalid cells before updating the chart; drafts and the last valid figure remain available for correction.
- Palette previews offer distinct hue families while preserving the meaning of continuous heatmap scales.
- Live controls resize sample points and adjust error-bar direction, cap length, and line width.

[Release details](docs/release-v1.4.3.en.md) · [Previous release](docs/release-v1.4.2.en.md)

## 中文

### v1.4.8 · Figure Studio 0.1.8

- PDF/SVG 导入文字按实际 pt 读写字号，计入文字及祖先变换和输出缩放。
- 反复编辑时保持逐字符间距和嵌套文字的相对大小，支持撤销与工程恢复。
- 框选后可直接拖动已选对象，保留空白处框选及 Shift 选择操作。
- 使用合成 PDF/SVG 与实际编辑处理代码验证修复；用户原始 PDF 尚未提供。

[热修复说明](docs/release-notes-v1.4.8.md#中文)

### v1.4.7 · Figure Studio 0.1.7

- 新增基于原始位图的可编辑局部放大：框选区域、调整倍率、边框和连接线，并根据真实标定生成 1 / 2 / 5 常用数值比例尺。
- 放大窗编辑纳入撤销、工程保存和 SVG / TIFF 导出。
- 新增可逆的明场参考图颜色匹配，亮度、对比度、色温和色调可直接手调；荧光采用共同的线性显示调整，保留原始像素。
- 两张或三张概览图/细节图可核对匹配区域后建立关联，支持可编辑框线、移动联动、隐藏与撤销、工程保存及 SVG / TIFF 导出。
- 新增轻量更新提醒、手动检查、离线状态和官方对应平台下载；0.1.6 用户需先手动升级一次。

[待发行版本说明](docs/release-notes-v1.4.7.md#中文)

### v1.4.6 · Figure Studio 0.1.6

- 样本点支持快捷切换实心、空心及独立填充/描边色；误差棒支持跟随组色、黑色、灰色及自定义。两个显示开关独立隐藏与恢复，不删除数据或原有样式设置。
- 分组图及受支持的分面比较在对应数据上方显示可编辑标注，保留旧工程修改，并随间距、字号和尺寸更新。
- 统计样式与条件表统一在标注页，右键菜单进入同一位置。
- 新增可选 Europe PMC 文献实例，核对图注后提供兼容图型的当前数据预览，研究数据留在本机。
- 异步切换图型时保留后来更改的数据、尺寸和分析设置。
- 更新 Windows 安装包，Mac/Android 独立提供开发预览；iOS 仍限模拟器。

[本版详情](docs/release-v1.4.6.md#中文) · [各设备下载](docs/local-device-trial.md#中文)

### v1.4.5 · Figure Studio 0.1.5

- 当前图片对支持滚轮缩放、拖动平移、同步视野、匹配连线，以及按已记录坐标对齐的叠加查看。
- 检查前可逐张选择图片；布局改变后仍可定位画布图片对，原图更换或移除时提示重新检查。
- 复核判断和备注随工程保存并写入报告；取消或失败的检查不会覆盖上次完成记录。
- 工程保留一份供后续复核的源图片，导出报告不嵌入原图；单个工程文件导入和导出上限调整为 200 MB。

[本版详情](docs/release-v1.4.5.md#图片查重交互复核) · [复核操作指南](docs/image-duplicate-check.md#中文)

### v1.4.4 · Figure Studio 0.1.4

- 本机图片查重支持当前组图、已选图片或小图以及本地文件，无需拆散编组。
- 展示像素一致及旋转、翻转、缩放或裁剪后的疑似重叠，提供图片对证据和画布定位。
- 下载 HTML / JSON 报告和单张证据图；`duplicates` 命令行还可在新报告目录中生成 CSV 记录。
- 科学图像处理与组图精修技能在原有素材准备和质检流程中加入基于原图的复用检查。

[本版详情](docs/release-v1.4.4.md#图片查重) · [图片查重指南](docs/image-duplicate-check.md#中文)

### v1.4.3 · Figure Studio 0.1.3

- 统计引导识别常见列名，根据数据类型和已确认设计排列方法，计算后先预览再应用。
- 自动生成的比较线仍可编辑：逐根调整左右端点、线宽和括号样式，也可恢复自动位置。
- 导入已有 SVG 或选定 PDF 页面，受支持的原生文字与路径保持可编辑；PDF 特效可能需要局部图片图层或整页外观图像。这是转换限制，不代表原 PDF 仅包含图片。
- 文字插入后就地编辑；水平线、垂直线、端点手柄、角度吸附与比较括号简化手动标注。
- 更新图形前定位数据表中的无效单元格；保留草稿和最后有效图形，便于修正。
- 配色预览提供差异明确的色系，同时保留连续热图色阶的含义。
- 用实时滑块调整样本点大小、误差棒方向、端帽长度和线宽。

[本版详情](docs/release-v1.4.3.md) · [上一版本](docs/release-v1.4.2.md)
