# polish-sci-figures v1.4.4 · Figure Studio 0.1.4

[English](#image-duplicate-screening) · [中文](#图片查重)

Windows installer and portable edition include the local screening engine. See the [validation record](image-duplicate-validation.md) for the completed checks and their scope.

## Image duplicate screening

Check for accidentally reused images before exporting a scientific figure, using the editor or the original AI/CLI workflow.

- **Start from the canvas.** Choose **Check images** in the top toolbar to check the current figure, selected images or panels, or local files. Embedded raster images remain inside their panel groups.
- **Review matching evidence.** Screen 2–60 images for identical pixels and suspected overlap after rotation, flipping, resizing or cropping. Review image pairs side by side and locate images in the current figure.
- **Keep a record.** Download the editor's HTML/JSON report or individual evidence images. The CLI writes a self-contained HTML report, JSON, CSV and generated evidence PNGs to a new folder.
- **Use the same check with AI.** Ask Codex or Claude to check supplied images for accidental reuse, or run `python sci_figures.py duplicates image-a.png image-b.tif --out image-check`.
- **Keep the artwork intact.** Screening runs locally in the desktop application, supports cancellation, and does not modify or remove image content.

Findings are prompts to review the source images and acquisition records. The check compares images with each other; it does not automatically split flattened montages or detect copied regions inside a single image. Underlying image sources are compared even when the canvas shows a crop. See the [guide](image-duplicate-check.md) for input formats, TIFF-frame handling, evidence limits and report interpretation.

---

## 图片查重

Windows 安装版与便携版包含本机查重引擎。已完成的测试及其范围见[验证记录](image-duplicate-validation.md#中文)。

导出科研组图前，检查是否意外放重了图片；既可在编辑器里使用，也可继续通过原有 AI / 命令行工作流完成。

- **从画布直接检查。** 在顶部工具栏点击 **图片查重**，选择当前组图、已选图片或小图，或本地文件；无需拆散编组中的嵌入图片。
- **看证据再复核。** 每批比较 2–60 张图片，检查像素一致及旋转、翻转、缩放或裁剪后的疑似重叠。并排查看图片对，定位当前组图中的对应图片。
- **留下检查记录。** 编辑器可下载 HTML / JSON 报告或单张证据图；命令行在新目录中生成自包含 HTML 报告、JSON、CSV 和已生成的 PNG 证据图。
- **AI 工作流同步接入。** 在 Codex 或 Claude 中直接要求检查图片是否放重，也可运行 `python sci_figures.py duplicates image-a.png image-b.tif --out image-check`。
- **保留原图与排版。** 桌面版在本机检查，过程中可以取消，不会修改或删除图像内容。

结果用于回查原图和采集记录。本功能比较不同图片，不自动拆分已合并的组图，也不检测单张图片内部的复制粘贴。画布有裁剪时，比较的仍是底层原图。输入格式、TIFF 各帧处理、证据图上限和结果解释见[操作指南](image-duplicate-check.md#中文)。
