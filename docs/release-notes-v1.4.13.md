# Suite v1.4.13 · Figure Studio 0.1.13

English · [中文](#中文)

This update focuses on reliable editing: keep statistical annotations on the chart, keep error bars attached to their data, and make large selections and figure resizing easier to control. Template plotting, local analysis, calibrated images, editable PDF/SVG import, SVG/PNG/TIFF export and the three companion AI skills remain available.

## Changes under validation

- **Retire the statistical appendix beneath the chart.** New figures and reopened projects use supported in-chart annotations instead of extending the figure with a long comparison list. Legacy variants and previews are checked during restoration, including the saved editing state. Complete comparison results remain available in the analysis workflow.
- **Keep error-bar parts together.** Changing cap length, direction, width, visibility or color must preserve the stem, upper/lower limits and their corresponding data positions. The same geometry applies while dragging a control, after release, after grid resizing and in the export. Sample-point and error-bar controls retain their separate, direct editing entries.
- **Reduce repeated work for large selections.** Cache the geometry needed for a gesture, update existing elements on animation frames, and finish the edit with one history entry. The acceptance case includes resizing a selection of 142 objects; this release does not reuse the previous version's timing measurements as new evidence.
- **Resize the whole figure from its outer frame.** Drag the right edge to change all column widths, the bottom edge to change all row heights, or the corner to resize the master proportionally. Hold Shift while dragging the corner for independent width and height changes. Each panel keeps its original proportions and remains centered. Row/column dividers and exact sidebar values remain available; locked panels and readable minimum cell sizes are respected.

- **Select overlapping objects directly.** Ctrl/Command-click cycles overlapping editable objects. Select an object, then Shift-drag in ordinary editing mode to move horizontally, vertically or at 45°.
- **Inspect image color adjustments in place.** Drag the divider or slider to wipe between the original and adjusted image in one larger preview. The view control preserves original pixels and does not add history.

## Install or update

- Windows: [installer](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.13/polish-sci-figures-Studio-0.1.13-Setup-x64.exe) or [portable ZIP](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.13/polish-sci-figures-Studio-0.1.13-Portable-x64.zip).
- Mac: [Apple silicon preview](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/figure-studio-local-preview-0.1.13/polish-sci-figures-Studio-0.1.13-macOS-arm64-Preview.zip) or [Intel preview](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/figure-studio-local-preview-0.1.13/polish-sci-figures-Studio-0.1.13-macOS-x86_64-Preview.zip).
- Android: [development APK](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/figure-studio-local-preview-0.1.13/polish-sci-figures-Studio-0.1.13-Android-preview.apk).
- AI workflows: [single-skill upload](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.13/polish-sci-figures-v1.4.13-skill.zip) or [complete three-skill suite](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.13/sci-figure-suite-v1.4.13.zip).

These links identify the new candidate packages and become usable after publication. Save a project JSON before upgrading. Installed Windows 0.1.9 and later support confirmed in-app updates; if 0.1.9 encounters its long-path preparation error, use the current installer manually. Versions 0.1.8 and earlier need one manual upgrade. Portable Windows and Mac/Android previews use manual installation.

Mac packages require macOS 15 or later, use ad-hoc signing and are not Apple-notarized. Android previews require Android 8 or later and a current Android System WebView; temporary signing keys may require replacing an older preview after exporting projects outside the app. iPhone/iPad remains an internal simulator build, without an installable IPA. See the [device guide](local-device-trial.md).

## Verification status

Acceptance is in progress. Before publication, checks must cover restored legacy projects and variant previews, stable error-bar anchors, direct slider previews, large-selection resizing, master-frame gestures, Undo, saved/reopened state and exported SVG geometry. Windows installers and each newly built native preview require their own package verification. Current source checks do not certify unpublished binaries or physical-device performance. The completed scope and file hashes will accompany the published release.

## 中文

本版重点是让编辑过程稳定、好控制：统计标注留在图内，误差棒保持对应数据位置，大量元素多选和整张母版缩放更直接。原有模板作图、本地分析、图像标定、可编辑 PDF/SVG 导入、SVG/PNG/TIFF 导出和三个配套 AI 技能继续保留。

### 正在验收的变化

- **彻底停用图下方的长统计附录。** 新图和恢复的旧工程使用支持的图内标注，不再把比较列表加在图下方、拉长画布；旧图形版本、预览和工程中的编辑状态一并检查。完整比较结果仍保留在统计分析流程中。
- **误差棒各部分保持联动。** 调整端帽长度、方向、粗细、显示状态或颜色时，主线、上下限和对应数据位置必须保持一致；拖动预览、松手应用、网格缩放和导出使用相同几何关系。样本点与误差棒保留各自清楚、直接的调整入口。
- **减少大量多选的重复计算。** 一次手势缓存所需几何信息，按动画帧更新现有元素，完成后记录一次可撤销修改。本轮验收包含 142 个对象同时选择与缩放，不把上版的耗时数据当成本轮新证据。
- **从母版外框直接缩放整图。** 拖右边调整所有列宽，拖下边调整所有行高，拖右下角等比缩放母版；按住 Shift 拖角点可独立调整宽高。每张小图始终保持原比例并居中，仍可拖行列分隔柄或在侧栏输入精确尺寸；已锁定小图和格子最小可读尺寸继续受到保护。

- **直接选择遮挡元素。** Ctrl/Command + 点击轮选重叠对象；选中后，在普通编辑模式下 Shift + 拖动保持水平、垂直或 45°方向。
- **同位置对照图片调色。** 在同一个较大的预览区域里拖动分界线或滑条，对照原图与调整图；对照操作不改原像素，不增加撤销记录。

### 安装与升级

- Windows：[安装版](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.13/polish-sci-figures-Studio-0.1.13-Setup-x64.exe)或[便携 ZIP](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.13/polish-sci-figures-Studio-0.1.13-Portable-x64.zip)。
- Mac：[Apple 芯片预览版](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/figure-studio-local-preview-0.1.13/polish-sci-figures-Studio-0.1.13-macOS-arm64-Preview.zip)或 [Intel 预览版](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/figure-studio-local-preview-0.1.13/polish-sci-figures-Studio-0.1.13-macOS-x86_64-Preview.zip)。
- Android：[开发 APK](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/figure-studio-local-preview-0.1.13/polish-sci-figures-Studio-0.1.13-Android-preview.apk)。
- AI 工作流：[单技能上传包](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.13/polish-sci-figures-v1.4.13-skill.zip)或[完整三技能套件](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.13/sci-figure-suite-v1.4.13.zip)。

以上链接标识本轮新包，发布后可下载。升级前请保存工程 JSON。Windows 安装版 0.1.9 及更新版本支持确认后的应用内更新；若 0.1.9 遇到长路径准备错误，请手动运行当前安装程序。0.1.8 及更早版本需先手动升级一次。便携版、Mac 和 Android 预览仍手动安装。

Mac 要求 macOS 15 或更新系统，使用临时本机签名，尚未完成 Apple 公证。Android 要求 Android 8 或更新系统及较新的 System WebView；临时签名可能导致旧版无法直接覆盖，卸载前需将工程导出到应用外。iPhone/iPad 仍为内部模拟器构建，没有可安装 IPA。详见[设备安装指南](local-device-trial.md#中文)。

### 验证状态

本轮仍在验收。发布前需检查旧工程恢复、版本预览、误差棒位置联动、滑块实时预览、大量多选缩放、母版外框手势、撤销、工程保存恢复及 SVG 导出几何。Windows 安装包和各平台新构建分别验收；当前源码检查不代表未发布安装包或真机性能已经通过。完成后，正式发行将随附实际验证范围与文件校验值。

Source adaptation audit / 来源与能力验证：[VectorCraft and PhotoCraft](development/editor-interaction-distillation.md).
