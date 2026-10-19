# v1.4.26 · Figure Studio 0.1.26

Prepared on 2026-10-19. This release adds local photo outlines, four-corner correction, ruler straightening and reversible global colour suggestions. Preview on the canvas, refine or cancel, and retain the original. The linked acceptance report records the tested Windows runtime, all performance batches and publication-dependent checks.

[中文](#中文) · [English](#english) · [Photo workflow](figure-studio-photo-correction.md) · [Actual acceptance scope](figure-studio-photo-correction-validation.md)

## 中文

### 从原始照片到可撤销的校正版本

导入 PNG、JPEG 或 WebP，选中照片后打开 **图片工具 → 一键矫正与微调**。本机边缘分析可提出多个边界，用户可以换选范围、拖动四角或输入原图坐标。已知比例应明确指定；默认边长估计不代表实物比例。参数在真实组图画布中预览，**取消**不保留修改，**保留校正**才生成版本并增加一次撤销。

只是整体倾斜时，使用 **标尺拉正**沿可靠参考边拖线，选择水平或垂直目标。它对当前范围做统一旋转和内接裁剪，替代四角透视；反复改线使用最初范围，不会累计裁小。手动继续改四角或比例会另标为微调，不改写原参考线记录，也不逐条泳道拉伸。

**图片版本 → 保留原图／已校正**提供直接切换。再次调整从保留的原始像素开始，工程记录几何、插值和文件 SHA-256，并校验原图与输出的对应关系。几何输出不继承旧比例尺、标定或 ROI。混合了文字／图表的复杂小图应先单独导入照片，保留原组图内容。

### 一键校色后仍可微调

使用 **一键校色与微调**，或 **图片颜色与显示 → 一键校色（拍摄照片）**。建议使用现有全局显示参数，先预览再应用；可靠近白背景才用于有限白平衡，没有可靠背景时只建议保守的共同亮度／对比度，并说明未调白平衡。新增截断按有界采样检查，必要时降低强度；手动控制和取消继续可用。

该建议面向普通拍摄／明场展示，荧光模式不提供单图自动白平衡。它不是相机色度校准、染色归一化、局部去雾或信号恢复。原始嵌入文件不被显示滤镜覆盖。

### 容量、性能与验收状态

全部分析与处理在本机执行。自动边界使用最多 640 px 边长的分析图，不能判断目标的生物学含义；完整输出使用原图区域的双线性重采样，不补画缺失内容。输出比例和采样后的条带强度不能替代原仪器文件的定量分析。容量及操作步骤见[照片指南](figure-studio-photo-correction.md)。

支持的浏览器在本机 Worker 中解码并读取检测缩略图和原图 ROI，保留取消、超时及源尺寸检查。完整输出不使用检测缩略图。已校验的 SVG 模板按内容与处理策略缓存，每个调用者仍获得独立 DOM；开始新检测时不重复绘制同一个旧候选。

本轮已完成实际安装版照片、保存重开、原图／审计／导出、既有科研编辑及正常重装／卸载检查。大图性能保留全部实测批次，未作通用无回退结论。当前实测范围以[专项报告](figure-studio-photo-correction-validation.md)为准，旧版[最终验收](qa/jade-hearts/windows-0.1.25/postrelease-acceptance.json)保持不变。

首次使用运行 [0.1.26 Windows Setup](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.26/polish-sci-figures-Studio-0.1.26-Setup-x64.exe)；[便携版](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.26/polish-sci-figures-Studio-0.1.26-Portable-x64.zip)需完整解压。附件在[对应发行页](https://github.com/zhoy0409-debug/polish-sci-figures/releases/tag/v1.4.26)提供；本说明准备时发行尚未完成。旧版安装用户的更新流程仍为 **更新 → 下载并准备更新 → 保存并确认 → 安装并重新打开**；真正的官方 0.1.25 → 0.1.26 更新要在目标公开后单独实测，不以本地覆盖安装替代。桌面包是否签名以本轮实际产物记录为准。

## English

### Correct a photo while retaining its source

Import a PNG, JPEG or WebP and choose **Image tools → Auto straighten & refine**. Review locally suggested outlines, choose the intended area, then refine its corners or source-pixel coordinates. Specify a known aspect ratio when available; an edge estimate is a display choice, not physical calibration. The actual composite canvas previews the result. Cancel discards the draft; **Keep correction** creates one version and one Undo step.

For a global tilt, **Ruler straighten** aligns a two-point reference horizontally or vertically using one rigid rotation and an inscribed crop. It replaces four-corner perspective. Repeated ruler edits reuse the initial bounds instead of cumulatively cropping the previous result. Later manual geometry is marked separately while the original ruler audit remains intact; this does not straighten individual lanes or gel curvature.

**Image version → Retained original / Corrected** switches versions directly. Reopening samples the preserved source rather than a previous correction. The project retains geometry, interpolation and encoded-file hashes. Old scale calibration and ROIs do not transfer to the geometric derivative. Import a photograph separately when its original panel also contains unrelated text or charts.

### Preview global colour suggestions

Choose **Auto color & refine next**, or **Image display → Auto color (photos)**. The existing editable display controls provide a conservative global suggestion and sampled clipping review. Only reliable near-white backgrounds support limited white balancing; otherwise the suggestion retains common channel gains and explains that white balance was unchanged. Manual refinement, cancellation and one-step Apply remain available.

The operation is for photo/brightfield display. Per-image automatic balancing is disabled in fluorescence mode. It is not colourimetric calibration, stain normalization, local dehazing or signal reconstruction, and the raw embedded file is retained.

### Verification and distribution boundary

All processing is local. Automatic outlines are geometric proposals rather than biological identification. Full output resamples existing pixels with bilinear interpolation and cannot reconstruct missing detail or establish quantitative source equivalence.

Actual installed-photo, save/reopen, source/audit/export, existing scientific editing and normal reinstall/uninstall checks are recorded. All large-figure performance batches are retained, without a general no-regression claim. The [acceptance report](figure-studio-photo-correction-validation.md) records actual results; the previous 0.1.25 evidence is not relabelled as this version’s result.

Use the [version-specific release page](https://github.com/zhoy0409-debug/polish-sci-figures/releases/tag/v1.4.26) for Setup, Portable and source/skill packages once available. Publication is not complete at this document’s preparation. A real official 0.1.25 → 0.1.26 update requires the public target and separate download, verification, backup, installation and automatic-restoration acceptance; a local reinstall is a different check. Signing status must come from the actual new artifacts.
