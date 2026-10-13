# Changelog

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
