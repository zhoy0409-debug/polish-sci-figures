# polish-sci-figures v1.4.6 · Figure Studio 0.1.6

[English](#clearer-controls-better-placed-comparisons) · [中文](#中文)

## Clearer controls, better placed comparisons

This release makes statistical annotations easier to find and places grouped comparisons where they belong. It also adds an optional way to find published examples of a chart and try a compatible style with your own data.

- **One place for annotations.** Statistical display styles and condition tables live in **Annotations**. The panel context menu opens that same section, without duplicate controls across tabs.
- **Point and error-bar styles in one click.** In **Properties**, choose solid or hollow points, or separate fill and outline colours. Keep error bars black, grey, matched to their group, or a custom colour. Independent visibility switches hide and restore points or error bars while retaining their settings and data; saved projects and exports follow the same appearance.
- **Comparisons above the right groups.** Grouped bars and supported faceted box plots place editable comparison lines and text above the corresponding groups. Positions follow group spacing, data updates, font size and panel dimensions; large labels use staggered rows. Unidentified groups or continuous axes do not receive guessed brackets.
- **Keep earlier edits.** Existing grouped-plot projects can acquire the new anchors while retaining supported manual text, line offsets, locks, groups and undo history. Resizing or changing data refreshes the geometry without substituting another comparison's label.
- **Explore examples when you need them.** Expand **Chart types → Examples in papers** and choose **Find examples**. Europe PMC results show paper details and source links. Figure labels appear only after a chart term is found in an accessible figure caption. A compatible current-data candidate adds **Preview with my data**; repeated figures of the same chart type do not add duplicate preview buttons.
- **Switch charts without losing newer choices.** A delayed chart response does not overwrite data drafts, a later canvas-size choice or changed statistical settings. Compatible appearance and layout edits are retained.

Literature lookup is optional and starts only when requested. It sends predefined chart terms and an optional topic you type, not tables, measurements, images or project contents. A caption match identifies a chart presentation, not whether the paper's design or statistical method fits your data. Plotting, analysis, editing and image screening remain local and available offline.

## Downloads

| Use | Package |
| --- | --- |
| Windows 10/11 x64 | [Install Figure Studio 0.1.6](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.6/polish-sci-figures-Studio-0.1.6-Setup-x64.exe) · [Portable ZIP](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.6/polish-sci-figures-Studio-0.1.6-Portable-x64.zip) |
| Claude skill upload | [Single-entry skill ZIP](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.6/polish-sci-figures-v1.4.6-skill.zip) |
| Codex / local CLI workflows | [Complete three-skill suite](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.6/sci-figure-suite-v1.4.6.zip) |
| Mac / Android testing | [Separate 0.1.6 development previews](https://github.com/zhoy0409-debug/polish-sci-figures/releases/tag/figure-studio-local-preview-20261014) · [Device requirements and installation](local-device-trial.md) |

Windows includes its runtime; no separate Python installation, Codex, account or API key is needed. Mac and Android remain development previews, not App Store or Google Play releases. iPhone/iPad work is validated in simulators; no installable IPA or TestFlight build is provided.

Before upgrading, export a project JSON backup and close the application. Open the saved project after installing the update. SVG, PNG and TIFF are figure exports; keep the JSON to retain editable state and history.

See the [validation record](figure-studio-validation.md#v146-source-and-editor-checks--2026-10-14) for the checks behind these changes. Historical package and device measurements remain labeled with their original versions.

## 中文

本版让统计标注更容易找到，并将分组比较放在对应数据上方；同时新增可选的文献实例入口，方便参考已发表图形，并用自己的数据预览兼容样式。

- **标注统一在一处调整。** 统计显示样式和条件表集中在**标注**页，右键菜单也进入同一个位置，不再跨页签重复放置控件。
- **样本点与误差棒一键调整。** 在**属性**中直接选择实心、空心，或分别设置填充色与描边色；误差棒可选黑色、灰色、跟随组色或自定义颜色。两个独立显示开关可一键隐藏和恢复，保留之前的样式与数据，工程保存和导出保持同样的显示效果。
- **比较标注放在对应组上方。** 分组柱图和受支持的分面箱线图，直接在相应组别上方显示可编辑的比较线和文字。位置随组间距、数据、字号和小图尺寸更新；大字号按需错层排布。不能识别组别的图形或连续坐标轴不会被猜测性地套上括号。
- **保留已有修改。** 旧分组图工程可补充新的语义锚点，同时保留受支持的手动文字、线条偏移、锁定、编组和撤销记录。改变尺寸或数据时重新定位，不把另一组比较的文字串到当前结果上。
- **需要时再找文献实例。** 展开**图表类型 → 文献作图实例**，点击**查找文献实例**。Europe PMC 结果提供论文信息与原文链接；只有在可访问的图注中找到对应图型词，才显示图号。当前数据还存在兼容图型时，才提供**用我的数据预览**；同一论文的同种图型不会重复堆出预览按钮。
- **切换图型时保留后续选择。** 较晚返回的结果不会覆盖数据草稿、后来选择的小图尺寸或已更改的统计设置；兼容的外观与布局调整仍被保留。

文献检索是可选操作，只在主动查找时联网，发送预设图型词和手动填写的可选主题，不发送数据表、测量值、图片或工程内容。图注匹配表示论文使用了某类图形，不代表其实验设计或统计方法适合当前数据。作图、分析、编辑和图片查重仍在本机完成，可离线使用。

### 下载与升级

| 用途 | 下载 |
| --- | --- |
| Windows 10/11，64 位 | [Figure Studio 0.1.6 安装版](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.6/polish-sci-figures-Studio-0.1.6-Setup-x64.exe) · [便携 ZIP](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.6/polish-sci-figures-Studio-0.1.6-Portable-x64.zip) |
| Claude 技能上传 | [单入口技能 ZIP](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.6/polish-sci-figures-v1.4.6-skill.zip) |
| Codex / 本机命令行 | [完整三技能套件](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.6/sci-figure-suite-v1.4.6.zip) |
| Mac / Android 测试 | [独立的 0.1.6 开发预览](https://github.com/zhoy0409-debug/polish-sci-figures/releases/tag/figure-studio-local-preview-20261014) · [设备要求与安装方式](local-device-trial.md#中文) |

Windows 自带运行环境，无需单独安装 Python、打开 Codex、注册账号或填写 API 密钥。Mac 与 Android 仍是开发预览，尚未上架应用商店。iPhone/iPad 已开展模拟器验证，目前不提供可安装到真机的 IPA 或 TestFlight 版本。

升级前先导出工程 JSON 备份、退出应用，安装后重新打开工程。SVG、PNG、TIFF 是成图；保留 JSON 才能继续修改并保留历史。已完成的检查见[验证记录](figure-studio-validation.md#v146-source-and-editor-checks--2026-10-14)，旧版安装包与设备性能记录仍保留原版本标识。
