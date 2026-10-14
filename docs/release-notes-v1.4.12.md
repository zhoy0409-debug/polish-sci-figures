# Suite v1.4.12 · Figure Studio 0.1.12

English · [中文](#中文)

This release makes detailed figure editing more responsive and keeps related controls together. Template plotting, local statistical analysis, calibrated images, image checks, editable PDF/SVG import and the three companion AI skills remain available.

## What changes

- **Select and drag with less waiting.** Large selections avoid repeated geometry and sidebar work. Changes remain editable, undoable and part of the saved project.
- **Extend an axis together with its ticks.** Select a recognized numeric axis and drag its endpoint. The editor adds ticks and labels using the existing linear or logarithmic mapping, while keeping the original data positions. Axes that cannot be identified reliably are not assigned invented values.
- **Style a component in one place.** In **Properties → Style by component**, choose tick labels, axes, axis titles or legend text, then apply font, line or color changes to the current panel or all panels. Locked elements remain protected. Sample points, error bars and statistical annotations retain their dedicated controls.
- **Keep comparisons beside the data.** Supported grouped, faceted and interaction plots place editable statistical annotations inside the figure, with their comparison relationships intact. Annotations no longer create a long results appendix beneath the plot. If the labels cannot fit safely, the analysis results remain available with a layout message.
- **Resize grid cells and their contents together.** Drag row or column boundaries, or enter an exact height or width. Figures scale proportionally and remain centered, without stretching or cropping. Preview the layout, release to apply, or undo the change; saved projects and exports retain the same geometry.

## Install or update

- Windows: [installer](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.12/polish-sci-figures-Studio-0.1.12-Setup-x64.exe) or [portable ZIP](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.12/polish-sci-figures-Studio-0.1.12-Portable-x64.zip).
- Mac: [Apple silicon preview](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/figure-studio-local-preview-0.1.12/polish-sci-figures-Studio-0.1.12-macOS-arm64-Preview.zip) or [Intel preview](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/figure-studio-local-preview-0.1.12/polish-sci-figures-Studio-0.1.12-macOS-x86_64-Preview.zip).
- Android: [development APK](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/figure-studio-local-preview-0.1.12/polish-sci-figures-Studio-0.1.12-Android-preview.apk).
- AI workflows: [single-skill upload](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.12/polish-sci-figures-v1.4.12-skill.zip) or [complete three-skill suite](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.12/sci-figure-suite-v1.4.12.zip).

Save a project JSON before upgrading. Installed Windows 0.1.9 and later support confirmed in-app updates; if 0.1.9 encounters its long-path preparation error, use the current installer manually. Versions 0.1.8 and earlier need one manual upgrade. Portable Windows and Mac/Android previews use manual installation. Mac packages use ad-hoc signing and are not Apple-notarized; Android previews may use different signing keys, so export projects outside the old app before uninstalling it. iPhone/iPad remains an internal simulator build, without an installable IPA. See the [device guide](local-device-trial.md).

## Verification scope

Source-level regressions and browser checks cover axis/tick mapping, editable annotations, component controls, selection and grid resizing. In a same-machine browser comparison with 136 selected objects, measured selection response fell from **479 to 38 ms**, and drag-completion work from **1,600 to 162 ms**. These are operation timings, not frames per second or a physical low-end-device benchmark.

Build and platform evidence, together with file hashes, accompany the published packages on the [official release](https://github.com/zhoy0409-debug/polish-sci-figures/releases/tag/v1.4.12) and [native preview release](https://github.com/zhoy0409-debug/polish-sci-figures/releases/tag/figure-studio-local-preview-0.1.12). The [validation record](figure-studio-validation.md#proportional-grid-sizing-and-responsive-editing--2026-10-15) describes the actual browser and export checks.

## 中文

本版减少精细编辑时的等待，并把相关控件集中到清楚的入口。原有模板作图、本地统计、图像标定、图片检查、可编辑 PDF/SVG 导入和三个配套 AI 技能继续保留。

### 本版变化

- **多选和拖动响应更快。** 大量元素同时选中时，减少重复几何计算和侧栏刷新；修改仍可编辑、撤销并保存到工程。
- **拉长坐标轴时联动补刻度。** 选中可可靠识别的数值轴，拖动端点，即可沿原有线性或对数映射补充刻度和数字，原有数据位置不变。无法可靠识别的轴不会被自动编造数值。
- **在一个地方统一组件样式。** 在**属性 → 按组成部分统一调整**中选择刻度文字、坐标轴、坐标轴标题或图例文字，对当前小图或全部小图调整字体、线条和颜色；已锁定元素保持保护。样本点、误差棒和统计标注仍保留各自的专用控件。
- **统计标注留在对应数据旁。** 支持的分组、分面及交互图把可编辑标注放在图内，保留比较关系，不再在下方生成很长的结果附录。空间不足以可靠排放时，分析结果继续保留，并提示调整布局。
- **格子与图一起等比缩放。** 拖动行列边界，或输入精确行高、列宽；图随格子等比例缩放并居中，不拉伸、不裁切。拖动即时预览，松手应用，也可撤销；保存工程和导出保持相同尺寸。

### 安装与升级

- Windows：[安装版](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.12/polish-sci-figures-Studio-0.1.12-Setup-x64.exe)或[便携 ZIP](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.12/polish-sci-figures-Studio-0.1.12-Portable-x64.zip)。
- Mac：[Apple 芯片预览版](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/figure-studio-local-preview-0.1.12/polish-sci-figures-Studio-0.1.12-macOS-arm64-Preview.zip)或 [Intel 预览版](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/figure-studio-local-preview-0.1.12/polish-sci-figures-Studio-0.1.12-macOS-x86_64-Preview.zip)。
- Android：[开发 APK](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/figure-studio-local-preview-0.1.12/polish-sci-figures-Studio-0.1.12-Android-preview.apk)。
- AI 工作流：[单技能上传包](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.12/polish-sci-figures-v1.4.12-skill.zip)或[完整三技能套件](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.12/sci-figure-suite-v1.4.12.zip)。

升级前请保存工程 JSON。Windows 安装版 0.1.9 及更新版本支持确认后的应用内更新；若 0.1.9 遇到长路径准备错误，请手动运行当前安装程序。0.1.8 及更早版本需先手动升级一次。便携版、Mac 和 Android 开发预览仍手动安装。Mac 使用临时签名，尚未完成 Apple 公证；Android 预览可能使用不同签名，卸载旧版前请先把工程导出到应用外。iPhone/iPad 仍为内部模拟器构建，没有可安装 IPA。详见[设备安装指南](local-device-trial.md#中文)。

### 验证范围

源码回归和浏览器检查覆盖轴与刻度映射、可编辑统计标注、组件控件、多选及网格缩放。同一台机器、136 个选中对象的浏览器对比中，选中响应耗时由 **479 降至 38 ms**，拖动完成阶段由 **1,600 降至 162 ms**。这些是操作耗时，不是帧率，也不代表低配置真机性能验证。

发布包随附构建、平台验证结果及文件校验值，见[正式发行页](https://github.com/zhoy0409-debug/polish-sci-figures/releases/tag/v1.4.12)和[原生预览发行页](https://github.com/zhoy0409-debug/polish-sci-figures/releases/tag/figure-studio-local-preview-0.1.12)。实际浏览器与导出检查详见[验证记录](figure-studio-validation.md#proportional-grid-sizing-and-responsive-editing--2026-10-15)。
