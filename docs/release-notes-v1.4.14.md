# Suite v1.4.14 · Figure Studio 0.1.14

English · [中文](#中文)

This update makes everyday editing more direct: adjust text spacing, reuse a text style, align or delete panels, and keep finished content fixed while continuing the layout. Existing templates, local statistics, editable PDF/SVG import, scientific-image tools, SVG/PNG/TIFF exports and the companion Codex/Claude skills remain available.

## Changes

- **Text spacing:** select text, open **Text spacing**, and set letter spacing in final-output points or line spacing as a multiplier. Changes preview on the selected text; clicking away applies one Undo step. Imported PDF transforms, positioned characters and native superscripts/subscripts are retained.
- **Two focused style tools:** select source text, click **Format painter**, then click target text to reuse its font, size, base emphasis, colour and spacing. Text content and placement stay with the target, including partial scientific formatting. **Eyedropper** instead picks a shape colour for the currently selected shapes. Press Esc to cancel either tool; locked targets are excluded.
- **Panel commands:** click a panel frame or its Layers entry to select the panel; Shift-click to select several. Use the alignment control for panels as well as objects, or press Delete to remove selected editable panels with Undo. Deleting the last panel leaves a blank editable canvas. Selecting an empty cell can remove a wholly empty row or column; an individual gap in an occupied row and column is not a removable grid track.
- **Panel labels join the selection:** select labels with artwork and inserted annotations to move, align or resize them together. Labels can also be locked or deleted independently, using the same history.
- **Locks preserve finished work:** locked panels, individual elements and labels retain their canvas position, size and appearance through subsequent grid and style changes. Editable vector snapshots and inverse coordinate compensation preserve the content; unlocking retains its current placement. Canvas changes that would clip locked content are rejected with an explanation.
- **Less work while interacting:** spacing previews cache the selected SVG nodes and update on animation frames rather than rebuilding the figure for every input. Cached lock compensation protects fixed content during grid previews; gesture completion produces one reversible change. No universal frame-rate or device-performance guarantee is implied.

## Install or update

| Device or workflow | Download |
| --- | --- |
| Windows | [Installer](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.14/polish-sci-figures-Studio-0.1.14-Setup-x64.exe) · [Portable ZIP](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.14/polish-sci-figures-Studio-0.1.14-Portable-x64.zip) |
| Mac previews | [Apple silicon](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/figure-studio-local-preview-0.1.14/polish-sci-figures-Studio-0.1.14-macOS-arm64-Preview.zip) · [Intel](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/figure-studio-local-preview-0.1.14/polish-sci-figures-Studio-0.1.14-macOS-x86_64-Preview.zip) |
| Android preview | [Development APK](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/figure-studio-local-preview-0.1.14/polish-sci-figures-Studio-0.1.14-Android-preview.apk) |
| AI skills | [Single-skill upload](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.14/polish-sci-figures-v1.4.14-skill.zip) · [Complete suite](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.14/sci-figure-suite-v1.4.14.zip) |

Downloads are provided through the official polish-sci-figures releases. Save a project JSON before upgrading. Installed Windows 0.1.9 and later support confirmed in-app updates; versions 0.1.8 and earlier need one manual upgrade. A 0.1.9 long-path preparation failure can be resolved with the current installer. Portable Windows and native previews use manual installation.

Mac previews require macOS 15 or later and use ad-hoc signing without Apple notarization. Android previews require Android 8 or later and a current System WebView. Temporary signing keys can prevent an in-place Android update: export projects outside the app before replacing an older preview. iPhone/iPad remains a simulator development build, without an installable IPA. See the [device guide](local-device-trial.md).

## Verification scope

Source and DOM regression tests exercise transformed PDF units, spacing previews and one-step commits, text-only style transfer, shape colours, panel commands, mixed labels, lock compensation and saved-state restoration. Browser gestures, frozen installers and native builds have separate acceptance records. Package hashes, actual build checks and publication status are recorded with the corresponding release attachments; earlier platform reports remain historical baselines.

## 中文

本版让常用编辑更直接：调整文字间距、复用文字样式、对齐或删除小图，并在继续排版时固定已完成的内容。原有模板、本地统计分析、可编辑 PDF/SVG 导入、科研图像工具、SVG/PNG/TIFF 导出及 Codex/Claude 配套技能继续保留。

### 本版变化

- **文字间距：** 选中文字，打开**文字间距**，设置最终成图 pt 字间距和倍数行距。输入直接预览，点击外部完成一次可撤销修改；保留导入 PDF 的变换、逐字定位及原生上下标。
- **两种工具各司其职：** 选源文字，点**格式刷**，再点目标文字，复用字体、字号、基础字重/斜体、颜色和间距；目标文字内容、位置及局部科学字符格式继续保留。**吸色笔**从图形取色，应用到已选图形。Esc 取消，已锁定的目标不能被修改。
- **小图操作：** 点击小图框或左侧图层条目选择整张小图，Shift + 点击多选；用对齐控件一起排齐，按 Delete 删除可编辑小图，支持撤销。删掉最后一张后保留空白画布。选空格时可删除整条空白行或列；有图行列中的单个空隙不是独立可删除的网格轨道。
- **图号加入共同选择：** 图号可与图内元素、插入标注一起选择，统一移动、对齐或缩放，也能单独锁定或删除，使用同一套撤销记录。
- **锁定后保持成品：** 小图、单个元素和图号锁定后，在后续网格与样式调整中保留画布位置、大小和外观。使用可编辑矢量快照与逆坐标补偿，解锁时保留当前位置；母版修改若会裁掉锁定内容，会说明原因并拒绝该操作。
- **减少操作中的重复工作：** 间距预览缓存所选 SVG 节点，按动画帧更新，不因每次输入重建整图；网格预览中缓存补偿关系，保护锁定内容，手势结束记录一次修改。不同设备的实际流畅度仍以对应验收为准。

### 安装与升级

| 设备或工作流 | 下载 |
| --- | --- |
| Windows | [安装版](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.14/polish-sci-figures-Studio-0.1.14-Setup-x64.exe) · [便携 ZIP](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.14/polish-sci-figures-Studio-0.1.14-Portable-x64.zip) |
| Mac 预览 | [Apple 芯片版](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/figure-studio-local-preview-0.1.14/polish-sci-figures-Studio-0.1.14-macOS-arm64-Preview.zip) · [Intel 版](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/figure-studio-local-preview-0.1.14/polish-sci-figures-Studio-0.1.14-macOS-x86_64-Preview.zip) |
| Android 预览 | [开发 APK](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/figure-studio-local-preview-0.1.14/polish-sci-figures-Studio-0.1.14-Android-preview.apk) |
| AI 技能 | [单技能上传包](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.14/polish-sci-figures-v1.4.14-skill.zip) · [完整三技能套件](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.14/sci-figure-suite-v1.4.14.zip) |

下载由 polish-sci-figures 官方发行页提供。升级前请保存工程 JSON。Windows 安装版 0.1.9 及更新版本支持确认后的应用内更新，0.1.8 及更早版本需手动升级一次；0.1.9 若遇到长路径准备失败，可手动运行当前安装程序。Windows 便携版与原生预览版仍手动安装。

Mac 要求 macOS 15 或更新系统，使用临时签名，尚未 Apple 公证。Android 要求 Android 8 或更新系统及较新的 System WebView；临时签名不同可能无法覆盖旧版，替换前请将工程导出到应用外。iPhone/iPad 仍为模拟器开发构建，没有可安装 IPA。详见[设备安装指南](local-device-trial.md#中文)。

### 验证范围

源码与 DOM 回归检查覆盖 PDF 变换单位、间距预览与单次提交、仅文字样式转移、图形取色、小图命令、图号混合选择、锁定补偿及工程重开。真实浏览器手势、冻结安装包及原生构建单独验收；对应发行附件记录校验值、实际成品检查及发布状态，旧平台记录保留为历史基线。
