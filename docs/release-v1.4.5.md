# polish-sci-figures v1.4.5 · Figure Studio 0.1.5

[English](#interactive-image-review) · [中文](#图片查重交互复核)

## Interactive image review

Inspect a flagged pair, record your decision and return to it with the saved project.

- **Choose the sources.** Check or uncheck images in the source list before scanning a figure, selection or local batch.
- **Inspect the details.** Click matching evidence or **View details** for wheel zoom, drag-to-pan, synchronized views and optional matching lines. Original browser-compatible PNG, JPEG, WebP and BMP images load for the active pair. TIFF and high-depth images use labeled checking previews; high-depth intensity mapping does not alter the sources.
- **Compare aligned structures.** **Aligned overlay** uses the recorded matching transform. Adjust opacity, show A or B alone, or **Hold to view B**. Records without valid alignment coordinates retain side-by-side review.
- **Return to the figure.** Locate both canvas images together after layout changes. A replaced or removed source triggers a recheck message while saved evidence remains available.
- **Keep the decision.** Mark a pair as pending, legitimate reuse or needing replacement, with a note. Reviews are saved with the project and included in HTML/JSON reports. Cancelling or failing a new check preserves the previous completed record.
- **Reopen the work.** Projects retain checked source images once, including local files. Exported review reports contain evidence and decisions without embedding those original files. Project import/export accepts up to 200 MB (200,000,000 bytes) per file.

The detail-preview budget is 12,000,000 encoded bytes. Preview images have a maximum side of 900 pixels; a labeled thumbnail is used when a larger preview is unavailable. Screening still compares 2–60 raster images locally and leaves the artwork intact. See the [guide](image-duplicate-check.md) for source formats and review limits, and the [validation record](image-duplicate-validation.md) for checks completed for this version.

## 图片查重交互复核

放大核对疑似图片对、记录判断，并随工程保存，之后可以接着复核。

- **先选检查对象。** 当前组图、选区或本地批次中的图片都可在清单中逐一勾选、排除。
- **放大看细节。** 点击匹配证据或 **查看详情**，通过滚轮缩放、拖动平移、同步视野和匹配连线核对结构。当前图片对加载浏览器支持的 PNG、JPEG、WebP、BMP 原图；TIFF 与高位深图片使用有标识的检查预览，高位深强度映射不改变原始图片。
- **对齐后再比较。** **对齐叠加** 使用已记录的匹配变换。可调透明度、单看 A 或 B，或 **按住看 B**。没有有效对齐坐标的记录仍可并排查看。
- **回到组图中定位。** 调整布局后仍可同时定位画布中的两张图片；原图已更换或删除时会提示重新检查，已有证据仍可查看。
- **保留复核判断。** 图片对可标记为待复核、合理复用或需要替换，并添加备注。记录随工程保存，也写入 HTML/JSON 报告。新检查取消或失败时，原有完成记录不会被覆盖。
- **重新打开继续处理。** 工程中保留一份检查过的源图片，包括添加的本地文件；下载的复核报告保留证据与判断，不嵌入这些原始文件。单个工程文件导入和导出上限为 200 MB（200,000,000 字节）。

详情预览编码后总量最多 12,000,000 字节，预览最长边不超过 900 像素；没有较大预览时，使用有明确标识的缩略图。检查仍在本机逐对比较 2–60 张栅格图片，不改变组图内容。支持格式与复核范围见[操作指南](image-duplicate-check.md#中文)，本版已完成检查见[验证记录](image-duplicate-validation.md#中文)。
