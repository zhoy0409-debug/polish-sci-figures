# 实时预览验收记录

本轮实际安装版各独立流程、原 Setup 生命周期、成品哈希及尚未验证范围见[最终本地汇总](windows-final17-acceptance-summary.json)。当前候选按用户要求暂不发布；早期阶段文件保持原始字节和当时状态。

本目录按冻结版本和实际测试条件分别保存证据。`before-workflow-summary.json` 是 0.1.21 冻结可执行 runtime 的原始行为观察；它不是新安装测试。`p0-dev-pilot-01-summary.json` 是首轮开发版 6 项通过；`p0-dev-pilot-02-extended-summary.json` 是第二轮开发版新增 3 项的最新结果，同时列出先前失败。不同 HTML 哈希的结果不合并为一次完整验收。

原始未编辑录屏、完整浏览器日志和下载文件保留在忽略目录。公开摘要记录原报告及视频 SHA-256，不公开浏览器 profile、本机服务令牌、私有工程或原图。测试脚本失败见 `p0-pilot-retained-attempts.json`；后续通过不会删除原失败。

## 复现输入

本页的脚本从完整源码目录执行。Windows 成品附带使用说明和安全摘要，开发测试脚本、浏览器与测试依赖请使用本轮另交付的源码包；不要求普通用户安装这些依赖才能编辑图表。

使用项目开发依赖、Windows Chrome、Playwright 和 Pillow。以下 `--download` 是明确的公开素材联网操作，不读取或上传用户工程。后续 UI 验收只访问本机服务。

```powershell
.venv/Scripts/python.exe scripts/prepare_studio_live_preview_sources.py --download
.venv/Scripts/python.exe scripts/prepare_axis_real_data_qa.py --download
node scripts/prepare_studio_live_preview_fixtures.cjs --out=.cache/live-preview-qa/public-fixtures-v1
```

准备脚本拒绝覆盖已有 fixture 目录。H&E 与 TEM 下载逐字节核对 `scripts/fixtures/real-image-sources.json` 的哈希，不重新编码。Iris 使用明确命名的 UCI `bezdekIris.data`，保留 150 个观测、变量单位和 DOI。已知 ROI、四图片排版与普通 SVG 路径为构造的编辑工程案例；它们不构成独立人工检测真值。CDC TEM 为官方低分辨率彩色化衍生图，须保留 CDC／Hannah A. Bullock／Azaibi Tamin 来源说明。

## 执行条件

测试前由主任务提供冻结的本机 Figure Studio 数据引擎 URL，并确认没有并行性能测量。使用能够加载 Playwright 的 Node 环境；只有需要录屏时才需要对应的 Playwright ffmpeg。显式指定尚未存在的输出目录。

```powershell
node scripts/test_studio_live_preview_matrix.cjs --url=http://127.0.0.1:PORT/ --label=UNIQUE-RUN --out=.cache/live-preview-qa/UNIQUE-RUN --kind=source-development-runtime --manifest=FREEZE/source-manifest.json --html=FREEZE/index.html --expected-version=0.1.22 --headless=true --video=false
```

将 `PORT`、`UNIQUE-RUN` 和 `FREEZE` 替换为真实服务端口、独立运行名及冻结目录。必须指定实际存在的 HTML 文件名。默认顺序执行 1280 × 720／1920 × 1080、中／英文、Carbon／Pearl，共 8 个条件、每条件 9 个顶层案例。案例包含 H&E 与公开 TEM 白色 1 pt 边框、普通 SVG 路径、锁定混选、无效输入、选择／工程／Undo／删除失效、真实轴响应迟到／取消，以及保存和 SVG／PNG／TIFF 导出隔离。`--ids` 可限定案例，限定运行必须按实际范围报告。

服务端会注入本机引擎配置，并按明确规则修改两处 CSP `connect-src` 字符串，因此 served HTML 原始 SHA 与冻结 HTML 的原始 SHA 应分别记录。`verify_studio_served_html.cjs` 验证固定相对 API 路径、唯一引擎 JSON 块及逐字节重建结果；不通过删除全部 script 或科学图形内容取得“相同”。公开报告仅输出哈希和通过事实，不输出服务令牌。

高频属性的完整运行另用以下命令；Carbon 与 Pearl 分别指定新输出目录。完整运行必须包含 37 个不同案例，`--ids` 窄复测不能代替全跑。

```powershell
node scripts/test_studio_live_properties_browser.cjs --url=http://127.0.0.1:PORT/ --label=UNIQUE-P1 --out=.cache/live-preview-qa/UNIQUE-P1 --html=FREEZE/index.html --expected-version=0.1.22 --theme=carbon --cancel-trailing-motion=true --headless=false --video=true
```

滑块测试先等待真正的 IndexedDB 自动保存快照建立，持鼠时只读 `StudioLibrary.get('autosaves', projectId).payload`，核对 project、state、history、checkpoints 和 dataDrafts；不会为读取状态先合成失焦。Esc 后继续真实移动鼠标，再松开并开始下一手势，分别验证原字段／画布、零提交及新手势一次提交。原来的持鼠实际 Save 断言仍可用 `--ids=P28-bar-width --range-save-probe=true --diagnostic-range=true` 单独诊断，另记下载、焦点和原生事件顺序；历史未查明原因的失败不由后续通过反推原因。

触控模拟与独立编辑回归使用 `test_studio_live_preview_touch_browser.cjs`、`test_studio_selection_browser.cjs`，同样显式提供 `--url`、`--label`、`--out`、`--html` 和 `--expected-version`。触控脚本分别以 `--width=390 --height=844` 和 `--width=1280 --height=720` 执行，两主题 × 中英文各 4 个条件，共 8 个条件，固定 DPR 1。脚本通过实际可见的导入及 Edit 入口执行真实 Chrome `tap`，并以解码后的图像内容尺寸至少 160 × 90 CSS 像素、窄屏顶部不高于 140 CSS 像素和导航不重叠作为工程下限；仍须查看截图。文字通过自动填入控件，不能称为实体触控或中文输入法验收。

既有智能选图回归复用 `test_figure_discovery_browser.cjs`。设置 `STUDIO_DISCOVERY_URL`、`STUDIO_DISCOVERY_HTML`、`STUDIO_DISCOVERY_OFFLINE_HTML`、`STUDIO_DISCOVERY_EXPECT_LOCAL_SHA256`、`STUDIO_DISCOVERY_EXPECT_VERSION`、`STUDIO_DISCOVERY_PROOF`，分别指向实际本机服务、未注入的当前 HTML、同一版本的真实 standalone HTML、版本号和独立输出目录。它实际点击未知单位时的推荐动作、独立／配对推荐、应用与撤销及保存重开；公开文献检索点击在浏览器网络边界被阻断并检查离线状态，不伪造文献响应。standalone 也禁止 HTTP 请求，并等待异步 Apply 真正关闭后实际下载 Save，逐值核对已提交汇总数据的原始行；仅点击按钮或截图不计为应用成功。历史旧版 `.cache/discovery-starter.html` 不作为本轮安装版证据。

智能选图与本地图型对照的主画布流程另用专项脚本，在 1280 × 720 下逐一运行两种主题和中英文：

```powershell
node scripts/test_studio_resource_preview_browser.cjs --url=http://127.0.0.1:PORT/ --label=UNIQUE-RESOURCES --out=.cache/live-preview-qa/UNIQUE-RESOURCES --html=FREEZE/index.html --expected-html-sha256=FROZEN-HTML-SHA256 --expected-version=0.1.22 --headless=false --video=true
```

它使用真实 Iris 工程和仓库中的 CSV 工程示例，检查主画布 A／B 对照、实际 Save、只读 IndexedDB、SVG／PNG／TIFF 草稿隔离、语言切换、原文件再次选择、取消及一次 Undo／Redo。停靠工具打开时仍实际执行 F2 文字取消和键盘微调。本地图型对照的失败案例仅中止实际本机 HTTP 传输，重试结果仍由原引擎计算；不伪造图形或论文证据。单主题／单语言 pilot 不能代替四条件完整运行。脚本默认遇到首个失败后关闭 context／browser 并停止后续条件，保留 plannedConditions 和实际完成结果。新文件超过 2,000,000 字节时，实际检查旧概况／候选清空、原生 Find 禁用、真实指针尝试仍无绘图请求，以及重新读取同名文件可恢复；不强制点击禁用控件。普通按钮焦点下实际执行方向键、Windows Ctrl+Z／Ctrl+Shift+Z 撤销和重做，检查 dock 不吞掉编辑器按键。

空白工程的欢迎区有独立短专项 `test_studio_blank_resource_preview_browser.cjs --url=... --out=NEW-DIR --html=FREEZE/index.html --hash=FROZEN-HTML-SHA256`：预览必须让出欢迎区、主图超过 100 × 90 CSS 像素，取消恢复欢迎，应用及一次撤销／重做保持状态与科学数据。原 source15 约 46 × 35 像素的失败与 source16 344 × 258 的实际修复分别保留。

实际 IDB 结构化克隆保留 3 个 own `undefined` 派生缓存键，JSON Save 会省略它们；专项比较仅允许这 3 个缺失且 `undefined` 的键（`layoutRenders`、`heatmapRenders`、`statisticalRenders`），其余科学值、源 SVG、state、history、checkpoints、dataDrafts 均严格比较，不做整体 JSON 归一化。`test_studio_resource_preview_harness.cjs` 另检查未知键、已定义缓存、负零、源图与历史改变仍被拒绝。资源公共摘要可用 `summarize_studio_resource_preview_browser.cjs --input=RAW/resource-preview.json --out=NEW-SUMMARY.json` 重跑，要求完整四条件、同一捕获 harness、全部通过及零外部请求；不会把单条件 pilot 汇总为完整通过。

安装版运行需要独立的安装器 SHA、完整安装文件清单和进程路径证明；仅把 `kind` 写成安装版不能证明已安装。安装与清理流程见 `audit/live-preview-windows-qa-plan.md`。本轮专用 `verify_live_preview_windows.ps1` 要求 PowerShell 7.5 或以上：读取原 JSON 状态使用 `ConvertFrom-Json -DateKind String` 保留进程创建时间的原始 ISO 字符串，并核对 PID、创建时间、路径及 EXE 哈希。Windows PowerShell 5.1 不满足此 QA 脚本前提。每次尝试使用全新的 QaRoot；阶段失败后的正规卸载另记为清理，不能改写成完整验收通过。用户当前要求暂停发布，本地安装验收不代表创建新版 Release。

## 结果解释

状态、历史、工程、源图 href 与实际导出像素分别核对。SVG 规范化仅针对导出器递增的 ID 及其属性引用；不修改图内文字、数据或科学内容。TIFF 由独立 Pillow 进程只读解码，核对 RGB、尺寸、DPI 和与实际 PNG 的 RGBA 像素哈希。DPI 描述输出网格，不能恢复源图片细节。

Save／导出草稿测试使用真实 DOM 按钮激活，测试端不额外合成 pointer、Tab、blur 或 focus。真实下载仍可能自然改变焦点，因此另记焦点观察，以实际历史、工程和导出断言判断隔离；不能只凭一次保存下载推断后续完全未提交。一般控件的真实失焦提交仍按原交互合同验证。导出菜单主动转移焦点，因此有效普通 HEX 会在导出回调前保留；不想保留时先按 Esc。带明确 Apply 的工具草稿不会因此自动应用。

真实异步测试只延迟本机后端已有响应，不伪造图形。浏览器可能已中止旧网络请求，因此它与“producer 忽略 AbortSignal”单元分支分别说明。视口与固定 DPR 不等于 Windows 真实系统缩放；真实触控、中文输入法及无辅助新用户完成率须另行实测。性能基准由独立无录屏脚本负责，功能验收耗时不能代替输入到可见像素的延迟指标。

最终 Setup／Portable 构建后保持字节不变。包内文档为构建时快照；后续真实安装验收和两处按钮名说明补正随单独的 Public-QA 与源码包交付，本目录及外部最新指南为验收结论依据。外部报告包含安装包本身的哈希，不反向嵌入该安装包造成自引用。

## 可交付的真实性能时序

`four-panel-source17-timing-trace.json.gz` 为真实 source17 CDP 追踪的隐私衍生文件，保留全部 102,246 个事件和实际时序字段，移除每个事件的 args 与原始 metadata。解压后为 Chrome trace JSON 结构，未单独实测删参衍生文件的 DevTools 导入；没有源码 URL、参数或原线程名，不是另一次性能运行。原追踪 SHA 及衍生文件哈希在同名 `.manifest.json` 中。复现：

```powershell
.venv/Scripts/python.exe scripts/test_sanitize_studio_performance_trace.py
.venv/Scripts/python.exe scripts/sanitize_studio_performance_trace.py --input .cache/stable-qa/four-panel-style-candidate17/timeline.json --expected-sha256 02372354f70f691da699f5709f589adb5b247e2dc487442bdb415cef6b77ea51 --out NEW-DIR/timing-trace.json.gz
```

公开转换器的 6 项独立检查覆盖私有 args 排除、未知字段／路径标签／伪 URL ID 拒绝，以及实际 CDP 整数 ID 保留。首个转换尝试因未允许实际整数 ID 而在写出前拒绝；原追踪未变，显式补齐该合法类型后完成输出。它是 QA 适配问题，不是产品或性能采样失败，未增加或替换性能样本。这 6 项不计入先前冻结版的 85 个组件脚本。


## 最终安装版补充验收与 QA 前提

[查重期间编辑](windows-final17-duplicate-summary.json)使用 60 张明确标注的合成图、1,770 对实际任务，观察真实进度后取消，核对取消确认和旧人工复核不变；它不测图像检测准确率。[大型导入](windows-final17-large-import-summary.json)使用 10,000 原生矩形 PDF 和 10,000 元素 SVG，核对草稿、取消、单次撤销、重开及真实 SVG／PNG 导出；它测图元复杂度，不是大型文件字节吞吐或真实科研图像算法验证。

安装身份由原 Setup 哈希、实际 EXE、文件版本、监听进程和原 AppId 的四个登记视图共同确认。隔离 QA 的 `--data-dir` 按产品既有安全策略令 `inAppInstall` 为 false；这一能力单独精确断言，不用它推翻原安装身份，也不把该实例用于官方版本更新安装验收。登记查询显式采用 UTF-8，保留首轮中文路径编码失败。

60 图任务的启动响应超过原 Inspector 资源缓存时，首轮与扩大另一会话缓存的尝试都失败，均保留原报告哈希。最终捕获使用同一有界 CDP 会话的真实请求序号、响应状态与正文，并要求任务 ID 真实匹配；不明任务、缺失正文或捕获异常仍失败。首轮任务无法回收 ID 时，终止结果保持未知；不由后来通过反推已取消。最终批次有实际原生取消确认。

大型导入首轮将 DOM click 误当作不会失焦。真实生产 `bindHeaderMenus` 在捕获阶段执行 `summary.focus()`，有效颜色在导出回调前正常提交。三轮真实焦点／IDB 诊断保留在报告内，没有据此更改产品。最终分开检查：有效草稿的 Save／只读 IDB；未完成 HEX 的最后有效预览、禁止提交与严格基线导出；独立有效 HEX 按 Enter 的一次提交、撤销和重开导出。只对目标颜色接受浏览器验证的 RGB／HEX 等价，不归一化其他科学内容。

相关 QA 合同可单独复现，不计入冻结版 85 个组件脚本：

```powershell
node scripts/test_studio_installed_browser_identity.cjs
node scripts/test_studio_duplicate_network_capture.cjs
node scripts/test_studio_large_import_contracts.cjs
```

本机实际分别通过 13／12／6 组；身份脚本的 Windows PowerShell Unicode 往返分支只在 Windows 执行。远端 CI 尚未运行，不将工作流新增命令写成 CI 已通过。
