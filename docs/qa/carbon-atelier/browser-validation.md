# Carbon Atelier 浏览器验收记录

**更新日期：2026-10-17。状态：源码功能矩阵通过，性能退步正在修复，尚未据此批准发布。** 本记录供维护者核对真实 Chrome 操作与测量边界；它不替代 Windows 安装、真实更新及系统缩放验收。

基线固定为提交 `2c6d11a0b494c3668a929cc272482e74be58e0fe`。原版资源与生成的编辑器已冻结；[保存记录](baseline-preservation.json)逐文件核对其内容未改变。性能结果使用实际 Windows Google Chrome，隔离临时浏览器上下文，阻止所有非本机 HTTP 请求。

## 已有证据

各项记录按实际完成范围标记；后续版本复测会增加结果，而不把基线失败改写成通过。

| 范围 | 当前证据 | 状态 |
| --- | --- | --- |
| 原版新工程、Iris 文字/轴、H&E 图片、查重、选图候选 | [原版浏览器记录](baseline-browser-acceptance.json)，同目录 `baseline-legacy-*.png` | 已完成 |
| 原版 120 / 5000 图元、五类真实编辑操作 | [性能汇总](baseline-performance-summary.json) | 已完成 |
| Carbon / Pearl 源表、源 SVG、导出像素一致性 | [源码浏览器矩阵](source-browser-acceptance.json)，两主题均保留源表、源 SVG 和输出像素 | 已完成源码验收 |
| 三种视口、浏览器 DPR 1.25 / 1.5 | [源码浏览器矩阵](source-browser-acceptance.json)，10 个主题/视口/DPR 组合、6 类状态、52 张截图 | 已完成源码验收 |
| 工程恢复、工具栏高度、改色/拖动撤销、侧栏宽度记忆 | [三视口复核](layout-restoration-checks.json) | 已修复并通过 |
| 轴上下文、真实保存状态、画布环绕及主题记忆 | [两主题补充复核](context-acceptance.json) | 已完成源码验收 |
| 组件文字/边界与实际页面文字对比度 | [组件检查](theme-component-checks.json)、[首次页面失败记录](ui-contrast-initial.json)、[定点修复复核](context-acceptance.json) | 已修复发现的问题；不宣称全页面 AA |
| 首版 Carbon 与冻结基线的性能对照 | [原始退步汇总](pre-optimization-performance-summary.json)、[前后对照](pre-optimization-performance-comparison.json)、[诊断](profile-diagnostics.json) | 存在退步，优化后正式复测未完成 |
| Windows 实际系统缩放、安装、真实更新 | 由独立的安装与原生界面流程记录 | 不由本记录宣称完成 |

原版还保留了 [16.64 秒实际窗口操作录像](baseline-public-workflow.webm)与[录像校验信息](baseline-video.json)。[公共 H&E 查重补充记录](baseline-browser-screening.json)在 headless Chrome 中实际重复导入同一许可素材并获得结果，验证工作流；它不构成检测准确率研究。

## 测量方法

性能脚本使用 120 与 5000 个实际进入编辑器、可选择和编辑的 SVG 图元。图形为确定性压力素材，明确不属于科研检测准确率证据。每种规模按固定顺序重复选择文字、改色、拖拽、调整侧栏和切换属性标签，每项 12 次。

捕获阶段的输入监听先于应用处理器记录 `performance.now()`。脚本记录下一次和第二次 `requestAnimationFrame` 回调的**实际执行时间**，同时用 `PerformanceObserver` 收集 Long Tasks 与可用的 Event Timing。选择使用实际选择处理器的 `pointerdown`，改色使用 `input`，标签使用 `click`，拖拽使用按下后的首个移动事件；拖拽提交与整个操作的最慢输入另列。改色通过 Playwright 控件填值触发输入，不代表打开系统原生颜色选择器的延迟；早期原始记录中笼统的“Trusted UI events”标签不能用于宣称全部输入事件均为可信硬件事件。

这些数字表示浏览器的帧呈现机会，不是屏幕像素或光学首帧。整操作墙钟包含 Playwright 移动、控件等待等开销，单独报告；帧间隔分布也不能当作连续 60 fps。测量设备的普通帧间隔约 8.3 ms，未强制为 60 Hz。录像和自动化开销在前后版本中保持一致，后台系统负载无法完全控制；没有直接测量 GPU 占用。

汇总保留 P50、P95、长任务数/累计耗时、帧长与超过 50 ms 的比例。12 次重复中的 P95 接近最大样本值，不能解释为大规模用户总体或最坏情况保证。原始事件与 WebM 录像保留在被 Git 忽略的本地 QA 缓存，公开汇总附原始 JSON 的 SHA-256。

## 真实项目与导出保护

真实数据工程使用 [UCI Iris](https://archive.ics.uci.edu/dataset/53/iris) 的 150 行测量，来源 DOI `10.24432/C56C76`，许可 CC BY 4.0。它用于验证旧工程、坐标轴、文字与原数据保持，不从表格擅自推断实验独立性，也不增加假设检验。

病理图使用 Kilbad 公有领域 H&E 图，由 [scikit-image `skin` 文档](https://scikit-image.org/docs/0.25.x/api/skimage.data.html#skimage.data.skin)提供来源。脚本先校验原始素材 SHA-256，再进行本机导入；公开记录不包含私人科研图片。选图候选截图使用明确标记的工程示例数据。

主题隔离比较原始源表、源 SVG、输出 PNG 的逐像素 SHA-256，以及规范化后的 SVG。原有导出器每次调用都会递增 `fNN-` ID 命名空间，同主题连续导出也有不同的原始字节哈希。规范化仅处理已验证的 ID 属性与对应 `href` / `url()` 属性引用，不处理文字、元数据、颜色或科学内容；原始哈希同时保留。规范化工具的回归测试专门检查正文、元数据与 HEX 色值不会被改写。

浏览器 `deviceScaleFactor` 仿真仅覆盖光栅密度，不等同 Windows 系统 125% / 150% 缩放，也不作为后者通过的证据。

## 首轮发现与修正记录

初期试跑发现 rAF 提供的帧时间戳可能早于输入采样时刻。该试跑已标为 superseded，留在缓存中且不进入公开统计；正式采样改用回调执行时的单调时间，汇总拒绝负时间。

当前版操作检查发现导入后改色/撤销、拖动/撤销再刷新可能触发 `undefined variant` 恢复错误；同流程在冻结基线也复现。恢复历史后校准当前面板的修复已通过三视口复核。另在 1280 视口，选中文字会使工具栏增加一行，造成 fit 画布缩小；按宽度及语言预留工具栏高度后，三视口的文字、形状、面板选择保持相同画布尺寸。

首次页面文字抽样覆盖两主题、六类状态，共 1317 个可见样本；轴页面的同一状态文字出现两个低对比度结果。首次失败证据完整保留。修复后，该实际可见文字在 Carbon / Pearl 的比值为 7.76 / 6.64；补充轴上下文每主题 110 个样本通过。抽样排除了科研画布、禁用控件和无法可靠计算的非纯色背景，不等于完整 WCAG 合规认证。

首轮正式性能对照在选择、拖拽和侧栏等操作出现退步。发布因此暂缓；诊断确认侧栏几何变量继承及重复布局读写是部分开销来源。优化方向验证已有侧栏改善，其他大图操作仍需归因与复测。[诊断记录](profile-diagnostics.json)保留临时浏览器干预条件，不将其与含录屏的正式性能数值直接混合。

## 复跑入口

复跑使用本机 Chrome、Node.js、可解析的 Playwright，以及本机编辑器服务。录屏另需 Playwright FFmpeg helper。浏览器脚本要求明确提供本机 URL，不会在未配置时自动打开服务或外发数据。

```powershell
node scripts/test_studio_carbon_harness.cjs
node scripts/test_studio_carbon_browser.cjs --url=http://127.0.0.1:18961/ --label=current --full=true
node scripts/test_studio_carbon_layout_browser.cjs --url=http://127.0.0.1:18961/
```

```powershell
node scripts/benchmark_studio_carbon_browser.cjs --url=http://127.0.0.1:18961/ --label=current --samples=12
node scripts/test_studio_carbon_summarize.cjs --input=.cache/carbon-qa/current/performance.json --out=.cache/carbon-qa/current-summary.json
```

正式前后对比应在资源冻结、相同 Chrome/视口/采样/录像设置下执行。变更视口、DPR、降速条件或录屏设置后，需要作为单独条件报告。
