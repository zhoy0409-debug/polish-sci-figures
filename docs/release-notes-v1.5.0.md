---
author: a
created: 2026-10-28
---

# Suite 1.5.0 · Figure Studio 0.2.0

这是 Windows 集中升级的候选记录。2026-10-30 用户要求完成调试后先交其检查；未经再次批准，不合并、不创建标签、不发布安装包。2026-10-28 的本次源码快照尚未通过新版本安装版实操、同包 5000 图元及真实应用内升级验收；正式发布状态、最终安装包哈希和后续验收补充以[本版发行页](https://github.com/zhoy0409-debug/polish-sci-figures/releases/tag/v1.5.0)为准。当前可用版本仍见[上一正式版 v1.4.26](https://github.com/zhoy0409-debug/polish-sci-figures/releases/tag/v1.4.26)。

[中文](#中文) · [English](#english) · [用户简明说明](windows-next-stable-summary.zh-CN.md) · [完整验收记录](windows-next-stable-audit.md)

## 中文

### 分类抽屉与使用反馈

六类任务工具使用唯一归属，搜索别名直接定位实际字段。工程与图层可收起，工具在选择对象后保持当前任务，重新进入未结束的边框草稿不会重置参数。帮助菜单提供经用户预览后在 GitHub 确认的反馈，以及扣除基线与登记验收的下载统计；历史净下载未知，不收集使用行为或活跃人数。[完整使用与统计口径](figure-studio-workspace-and-feedback.md)。

进一步区分全局命令、任务分类和画布上下文操作。画布快捷区合并，文字基础设置优先，批量替换、段落和字符格式按需展开；手动展开状态不再被选区类别变化重置。外围小图控制点在编辑子对象时减弱，实际命中区域及缩放意图保留。此项仍属于未发布候选，等待用户检查及安装版验收。

按 2026-10-31 已确认的方案修复局部放大控件误入窄栏、工具遮挡和中间宽度英文溢出。短窗口将次要快捷操作收入“更多”，保留字号与上下标；“专注画布”可隐藏并恢复两侧面板，手动倍率下保持图形位置。属性与检索减少重复框线和文字，WB 成对字段按长标签对齐。沿用原有分类、科研算法、预览和历史，[本轮真实截图与回归边界](qa/windows-next-stable/uiux-core-20261031.md)单独记录。

### 按最终尺寸检查并继续编辑

顶部 **图形质检** 按真实输出尺寸检查支持范围内的字号、文字拥挤与裁切，并定位到画布。受支持的字号和已有版式建议沿用实时预览、取消及一次撤销；无法核实的统计设计、复杂裁切和未知背景不会伪装成已通过。**查找功能**可以直接进入质检和投稿配置，重复进入时保留当前草稿。

**投稿尺寸与导出 → 投稿配置…** 保存用户明确填写的宽度、DPI、最大高度和字号／线宽阈值及来源；可随工程保存或单独导入、导出。修改在实际画布预览，保留后仍可手工调整；要求不匹配与超高会明确报告，不会自动裁掉科研内容，也不会把通用默认值当作期刊认证。[投稿配置操作](figure-studio-submission-profiles.md)。

局部修改使用版本化、限定面板和原始来源的操作合同；过期来源或锁定对象拒绝修改。组图规划整理已经确认的结果，信息不足时留下待确认项，保留既有数据合同、候选排序、统计分析和绘图引擎。[质检与局部协作](figure-review.zh-CN.md)。

### 保留原生 TIFF，再生成明确的显示图

从 **导入文件** 打开受支持的无符号 8／16 位单通道 TIFF、RGB8 TIFF 或有限单文件 OME。实际平面、显示窗、伽马和 LUT 在真实画布预览；保留或取消沿用现有事务。原文件与原生样本保持独立，显示 PNG 明确为 8 位显示，不作为密度定量数据。校正衍生图继续保留原文件来源和下载入口。

导入后可点 **从原始 TIFF 新建显示**，使用保留的原生平面和当前显示参数建立独立显示；已有图片及手工编辑保持，原文件只保存一份。新显示不继承校正、比例尺或 ROI。容量为 64 MB／文件、32 MP／页、128 页、80 MB 原始 TIFF／工程、200 MB 工程 JSON；不支持的格式明确拒绝。[完整范围及离线操作](figure-studio-native-tiff.md)。

### 大工程、更新和保留能力

大工程保存／解析使用本地 Worker，点击保存后的新修改仍为未保存。减少部分 SVG 选择、配色入口和确认开销，保留 ID、引用、科学元数据与导出检查；5000 图元拖动仍有长任务，未宣称所有场景提速。原始比较批次和未采用尝试见[验收记录](windows-next-stable-audit.md)。

智能选图、原有数据与统计编辑、专业坐标轴、边框、文字、校色、透视校正、标尺拉正、局部放大、比例尺、SVG／PNG／TIFF 导出继续保留。原始数据默认本地处理，文献联网仍由用户明确触发。Carbon Atelier、Mineral Jade、Pearl Pro 和简约猫狗／真实字节爱心进度沿用已确定方案。

新包沿用原有安装身份和工程目录。发布后首次使用 `polish-sci-figures-Studio-0.2.0-Setup-x64.exe`；受支持已安装用户从编辑器 **更新 → 下载并准备更新 → 保存并确认 → 安装并重新打开** 升级，无需自行解压。便携包仍是独立分发。本次不发布新 macOS、iOS 或 Android 包；源版本元数据同步不代表旧预览已升级。

### 明确未纳入与待验收范围

同文件多平面批量显示原型留在独立开发分支，本版不包含。自动图例安排、轴标题距离／标注避让、复杂多文件 OME、原生 PDF／CMYK／字体嵌入仍未完成。缺少独立人工标注的检测功能没有准确率、漏检或误报认证。

本快照不把浏览器、冻结 HTTP 自检或受控文件恢复当作 Windows 安装实操及真正更新。只有新候选版本自身 CI、来源核对、原图／工程／科研数据保留、安装编辑与同包性能、真实旧版到新版的下载／校验／安装／自动重启及实际失败恢复全部通过，才合并并发布一次稳定版。

## English

This candidate is on an explicit user-review hold: no merge, tag or release until renewed approval. It adds canonical task drawers, alias-aware local search, reviewed GitHub feedback and QA-excluded incremental download accounting without usage telemetry. This is the release-preparation snapshot for Suite 1.5.0 / Figure Studio 0.2.0, focused on Windows. It adds final-size local figure review, scoped revision-checked changes, confirmed-result figure planning, declared submission profiles, bounded native TIFF display with retained originals, and local Worker project save/parse. Existing scientific data, statistics, editing, exports, visual themes and simple update companions remain available.

Review and submission settings preview on the actual canvas, can be cancelled and create one Undo step when kept. TIFF display retains the original bit depth and bytes separately from an explicitly non-quantitative display PNG; a retained native plane can create a separate display without inheriting calibration or geometric edits. See the [review guide](figure-review.en.md), [submission guide](figure-studio-submission-profiles.md) and [TIFF limits](figure-studio-native-tiff.md#english-workflow).

SVG performance changes preserve scientific metadata, references and actual export bytes. All comparison batches and remaining long tasks stay in the [audit](windows-next-stable-audit.md); this is not a claim that every operation is faster. Original data stays local, with literature network requests explicitly initiated by the user.

The multi-plane batching experiment, automatic legend/label arrangement, complex multi-file OME, native PDF/CMYK/font embedding and independently labelled detector accuracy are outside this release scope. No new platform preview is published or relabelled by updating source version constants.

As of this dated preparation snapshot, final installed Windows editing, same-package 5000-object measurement and genuine 0.1.26 → 0.2.0 in-app update/failure recovery remain pending. Browser tests, frozen HTTP self-tests and controlled recovery checks do not establish those results. The installer identity and project location stay compatible. Once actually published, use Setup for first installation and the existing in-editor download, integrity check, save/confirm and install/reopen flow for supported installations. Publication and final artifact evidence belong to the [version-specific release](https://github.com/zhoy0409-debug/polish-sci-figures/releases/tag/v1.5.0).


## 2026-10-31 · WB 开发候选补充（未发布）

新增“图片处理 → WB 条带处理与组图”，复用原生 TIFF、本地图像重采样、实际画布预览、现有历史和工程合同。支持源图／曝光管理、可修正检测建议、标尺拉正与裁切、源图泳道映射及强制拼接边界、蛋白／条件／分组标注、独立画布对象及重开续编。源图整体显示调整与采集曝光分开，不能单独美化某个条带。补充完整原图／映射 ZIP 和限定为 WB 参数稿的可编辑 PPTX；后续自由画布编辑请用 SVG／工程导出。

[操作指南](figure-studio-western-blot.zh-CN.md)与[实际验收范围](qa/windows-next-stable/wb-workflow-20261031.md)区分真实私图工程测试、公开合成高位深测试和未通过的原生门槛。16-bit 原 TIFF 字节保留，WB 衍生图为 8-bit 显示；不宣称 16-bit WB 输出、独立检测准确率或灰度定量。当前仍不合并、不发布。

The WB development candidate is now implemented, with original-source retention, editable crop/lane provenance and native canvas objects. Its PPTX exports the WB parameter draft, not arbitrary subsequent canvas overrides. Source-browser tests and an independent OOXML parser do not certify installed Windows or native PowerPoint acceptance. Publication remains on hold.
