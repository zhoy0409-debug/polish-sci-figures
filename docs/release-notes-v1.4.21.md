# Suite v1.4.21 · Figure Studio 0.1.21

Figure Studio gains Carbon Atelier and Pearl Pro themes, a clearer selection inspector and a cat-and-dog update scene. Existing Figure Discovery, local scientific analysis, image tools, professional axes and editable exports remain available.

Evidence recorded 2026-10-17 covers source checks, an actual Windows 0.1.20→0.1.21 CLI upgrade, portable-runtime checks, a 22-image installed-build matrix and actual Windows 100%/125%/150% scaling. The matrix identified a narrow-header overlap; its source fix passes 48 layout cases. Candidate records identify their own artifact hashes; acceptance of the last repackaged files is defined by the separate build-specific reports in the [validation summary](carbon-atelier-validation.md). The formal comparison without video recording retains slower selection/colour tail latency for 5,000 elements. See also the [browser record](qa/carbon-atelier/browser-validation.md) and [design-token evidence](qa/carbon-atelier/design-tokens.md).

## What changed

- **Choose the workspace:** open **Appearance** for default Carbon Atelier (`#49C3A5`) or light Pearl Pro (`#176B5D`), and independently choose a neutral, dark or light canvas surround. The figure page stays white, and figure colours, source pixels and project history are independent of appearance preferences.
- **Read the current context:** the inspector identifies the selection and prioritises related groups. Existing workflow navigation and local **Find command** search remain available, including an appearance command. Inspector tabs wrap instead of hiding their labels.
- **Follow real update stages:** original offline SVG cat and dog assets illustrate checking, downloading, verification, readiness and installation. Progress follows the actual updater; download 100% still requires verification. The existing save confirmation, integrity checks, backup and Windows handoff remain in place.
- **Reduce movement:** turn off **Character animation** in the update window, or use the system reduced-motion preference. Text, progress and controls keep updating while the characters remain still.
- **Use shared UI tokens:** existing component declarations now consume the same semantic colours, spacing, typography, corners, shadows and interaction states. Scientific SVG paint and image-processing parameters are excluded from the migration.

See the [appearance and update guide](figure-studio-appearance.md), [English quick start](../desktop/QUICKSTART.en.md), and [Chinese quick start](../desktop/QUICKSTART.zh-CN.md).

## Compatibility and validation scope

Windows packages use Studio version **0.1.21**; the skill suite uses **v1.4.21**. The Windows installer and portable archive have different upgrade paths. Installer users can use the existing in-app download/verify/install flow; portable users replace files manually. Save a project JSON before upgrading. Users of 0.1.8 or earlier must run a current installer manually once. The long-path fix remains the one introduced in 0.1.10.

Chrome component checks cover both themes, exact hover/pressed brand colours, representative text/control contrast, keyboard focus, reduced motion and a scientific SVG fixture whose DOM and raster remain identical after theme switching. This is bounded evidence, not a declaration that every page meets WCAG AA, every figure format has been checked, or every device sustains 60 fps. The release's source/installer evidence and measured performance must be read with their stated fixtures, resolutions and limits.

This visual release does not extend statistical applicability, image-detection accuracy or numerical-axis reconstruction. The [v1.4.20 image/axis release](release-notes-v1.4.20.md) and its [acceptance record](figure-studio-experience-round2-validation.md) describe those capabilities and limits. Arbitrary imported PDF/SVG artwork and flattened images do not acquire original numerical axes. Midnight Focus is not implemented. Shared source changes do not establish new Mac, Android or iOS device acceptance.

## 中文

本版增加默认 **Carbon Atelier** 深色工作台与可选 **Pearl Pro** 浅色主题，梳理当前选中内容的检查器，并以原创猫狗协作场景展示真实更新阶段。保留智能选图、本地统计、图片工具、专业坐标轴及可编辑导出。

2026-10-17 的记录覆盖源码、实际 Windows 0.1.20→0.1.21 CLI 升级、便携运行时、22 图安装版矩阵和实际系统 100%／125%／150% 缩放。矩阵发现的窄标题栏重叠已在源码修复并通过 48 项布局检查。候选记录按各自成品哈希识别，最后重打包文件的验收以[验收汇总](carbon-atelier-validation.md)中的独立成品报告为准。无录屏正式对照保留 5000 图元选择／改色尾部回退。另见[浏览器记录](qa/carbon-atelier/browser-validation.md)与[设计令牌证据](qa/carbon-atelier/design-tokens.md)。

- 顶部**外观**可切换 Carbon（强调色 `#49C3A5`）和 Pearl（`#176B5D`），单独设置中性、深色或浅色的画布周边。图纸保留白色，界面偏好与作品配色、原始像素及撤销记录分开。
- 右侧显示当前选中的对象类别，常用设置优先，其他分组仍可展开；保留五组工作入口和本地功能搜索，并新增外观命令。检查器标签可换行，避免隐藏操作名称。
- 更新窗口使用离线原创猫狗 SVG，按检查、下载、校验、可安装及安装阶段呈现。百分比来自更新器，下载到 100% 后仍需校验；保存确认、完整性检查、备份和 Windows 安装交接沿用现有流程。
- 可取消勾选**角色动画**，也会遵循系统降动效偏好；静态角色不影响阶段说明、数字与按钮更新。
- 原有组件在原声明处迁移到统一的颜色、间距、字号、圆角、阴影及交互状态令牌，不改科研 SVG 原始绘制属性和图片处理参数。

操作见[外观与更新指南](figure-studio-appearance.md#中文)及[中文入门](../desktop/QUICKSTART.zh-CN.md)。套件版本为 **v1.4.21**，Windows Studio 为 **0.1.21**。升级前下载工程 JSON 备份；安装版沿用应用内更新，便携版手动替换。0.1.8 或更早版本须先手动安装一次当前版；长路径修复仍来自 0.1.10。

Chrome 组件检查覆盖双主题、精确的悬停／按压品牌色、代表性文字与控件对比度、键盘焦点、降动效及主题切换前后相同的 SVG 工程示例。该范围不等于全页面 WCAG AA、全部图形格式或所有设备持续 60 fps。实际源码／安装包与性能记录以各自的测试样本、分辨率和限制为准。

本次视觉升级不增加新的统计适用性、图像检测准确率或数值轴还原能力。图片与坐标轴能力沿用 [v1.4.20](release-notes-v1.4.20.md#中文)及其[验收边界](figure-studio-experience-round2-validation.md)；任意导入 PDF/SVG 或压平图片不能据外观还原原始数值轴。Midnight Focus 尚未实现，也未以共享源码测试替代新一轮 Mac、Android 或 iOS 真机验收。
