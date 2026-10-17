# 实时预览安装版的隔离验收方案

本方案规定如何在不改变用户正在运行的 Figure Studio、原有安装登记和研究数据的条件下，验收 0.1.22 安装包。source20 原始包现已完成实际 Install／Start、全套指定编辑范围、正常 Reinstall／Uninstall 及独立最终查询；真实官方 0.1.20 → 0.1.22 更新仍为发布后待实测。source17 原 Setup 的完整结果见[历史汇总](../docs/qa/live-preview/windows-final17-acceptance-summary.json)。source19 原包虽通过 8 套件 108 项，因已确认的轴输入缺陷被替代；其[部分记录](../docs/qa/live-preview/windows-final19-partial-installed-summary.json)与[未完成阶段的正规清理](../docs/qa/live-preview/windows-final19-incomplete-cleanup-summary.json)不算最终验收。本文件保留方案，不用计划代替完成证据。

source20 已通过 [95 个组件脚本](../docs/qa/live-preview/source20-component-regressions.json)、[双主题 10 项真实 Iris 轴流程](../docs/qa/live-preview/source20-axis-composition-browser.json)、[25 组轴输入合同和旧回归](../docs/qa/live-preview/source20-axis-composition-fix-regressions.json)，[正式性能四阶段对照](../docs/qa/live-preview/performance-v2-final20-vs17-18-19.json)和[独立四面板](../docs/qa/live-preview/four-panel-style-final20-diagnostic.json)已完成，包含改善及退步。source18 人工微软拼音 6 项、F2／失焦、Undo／Redo、保存重开及 SVG／PNG 保留原证据，原表和源图精确一致，见[实际输入法记录](../docs/windows-native-ime-acceptance.md)。[source20 代码范围](../docs/qa/live-preview/source20-ime-change-scope.json)排除已改的轴模块，不冒称新安装版重复人工 IME；浏览器轴组合事件明确为合成，实际键盘、渲染和文件操作分别核对。

## source20 本次执行结果

[实际安装版汇总](../docs/qa/live-preview/windows-final20-acceptance-summary.json)绑定原始成品和各独立范围：Own 八套件 [108 项](../docs/qa/live-preview/windows-final20-own-summary.json)、P1 [74 项](../docs/qa/live-preview/windows-final20-p1-summary.json)、额外轴 [10 项](../docs/qa/live-preview/windows-final20-axis-composition-browser.json)、[60 图／1770 对真实后台任务取消](../docs/qa/live-preview/windows-final20-duplicate-summary.json)、[10000 图元 PDF／SVG 两项](../docs/qa/live-preview/windows-final20-large-import-summary.json)均完成。轴组合尾事件为合成，普通键盘／Iris 引擎／文件操作为真实浏览器流程，不是重复原生 IME。

正常 [重装](../docs/qa/live-preview/windows-final20-reinstall-summary.json)和[卸载](../docs/qa/live-preview/windows-final20-uninstall-summary.json)外层进程实际退出 0；同步 helper 检查原生返回，但未独立保存原生数值。[只读最终查询](../docs/qa/live-preview/windows-final20-native-final-state.json)证明四登记视图空、自有进程 0、EXE 移除、原 1 实例身份与 3 外部文件精确保留，Iris 150 行／12 原 SVG 不变。它是正常完成后的清理，区别于 source19 未完成阶段卸载。

`audit/live-preview-inventory.md` 是本次安装包内的构建时快照，保持原字节。本外部方案与最新 docs 后补实际结果；只对显式 docs/*.md 生成第二份严格快照差异证明，不更改首份成品证明、原 Setup 或冻结非文档。官方更新未以普通重装替代。

## 安装前的保护基线

安装器的正式 AppId 是 `{51D78749-35EE-43BB-BA21-F79D6A1D5094}`，见 [Inno 源码](../desktop/FigureStudio.iss)。测试使用原始候选安装器及其 SHA-256，不更换 AppId 后冒充正式包。

先只读核对 HKCU 和 HKLM 的 32／64 位注册表视图中，精确 AppId 对应的 Uninstall 项及子项。私有日志保存值名、值类型和未展开的原值；二进制、多字符串、DWORD／QWORD 必须保留类型。只公开是否存在及保护检查结果，不能把机器目录写入公开报告。

若存在真实用户安装登记，保持 [现有验收脚本](../desktop/verify_windows.ps1) 的拒绝保护，改用独立 Windows 测试账户或虚拟机。不得临时覆盖真实登记、运行安装器后再导入 `.reg`，据此宣称用户安装没有受到影响。若原登记不存在，清理后的正确恢复目标就是“仍不存在”。

记录所有当前运行的 Figure Studio 实例，包含进程 ID、创建时间、精确可执行文件路径和文件 SHA-256；除本轮新建且精确匹配 QA 安装目录的实例外，其余均为受保护进程。测试结束逐项核对其身份元组和文件未变，不能使用按进程名批量终止的命令。

## 隔离安装及启动

隔离程序目录、数据目录、浏览器 profile 和证明目录均放在本任务 `.cache` 的独立子目录。执行前确认解析后的绝对目录位于该工作区，且不等于受保护实例的程序或数据目录；不递归移动或清理未经核实的目录。

安装参数沿用 `/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /NOCLOSEAPPLICATIONS /STUDIOUPDATE=1 /NOICONS /TASKS=""`，并显式指定 QA `/DIR` 和日志。这样避免自动关闭原实例、创建用户快捷方式或由安装器自动启动另一份程序。

实际 QA EXE 使用独立 `--data-dir`，并仅在启动该子进程时设置隔离的 `LOCALAPPDATA`。启动器和辅助程序用隐藏窗口；原生界面可见测试由主任务单独控制。记录实际启动的 EXE 身份、版本和服务 origin；只有由已安装路径启动、且包内文件核对通过的实例才能标为 `installed-candidate`。解压运行、旧冻结 runtime 和 Python 源码服务分别标记。

## 必须保留的安装版证明

1. 核对安装器 SHA-256、x64 PE 架构、正式版本及全部安装文件哈希；不得只检查主 EXE。
2. 在隔离 PATH／Python 环境执行冻结自检，验证 Pillow／OpenCV 等真实运行依赖和本机数据引擎，而非借用开发虚拟环境。
3. 将同一公开合法工程分别交给源码版和安装版脚本，执行边框、坐标轴、30 次 input、取消／失效、一次 Undo／Redo、保存重开和 committed-only SVG／PNG／TIFF 导出。
4. 覆盖 Carbon／Pearl、中／英文、1280 × 720 与 1920 × 1080；浏览器 DPR／触控模拟与真实 Windows 系统缩放分开报告。脚本不自行修改系统 DPI。
5. 真实异步测试只延迟本机后端的真实响应，不伪造坐标或图像结果；检查旧响应／取消后不会写回。
6. 重装检查隔离工程、设置和外部哨兵文件哈希；卸载后原数据仍保留。需要浏览器验收时先保留安装，再显式执行清理，不在测试中途卸载。

## 清理与登记恢复

清理前重新读取 QA AppId 的 `InstallLocation`、实际卸载程序和 QA 进程身份。只有它们仍指向本轮经过核实的隔离目录，才停止本轮实例并调用该目录的真实卸载器。若登记已被另一个安装过程改变，停止清理并保留证据，不能覆盖并发变化。

原本没有登记的情况：卸载后检查精确 AppId 在原视图中恢复不存在，QA 程序已移除，外部数据保留，受保护进程及其可执行文件身份未变。测试目录可留作审计材料，不能将保留数据误报为卸载残留。

原本只有本任务自有、可证明所有权的旧 QA 登记时，应先记录完整注册表类型快照，并由主任务决定如何复用或清理；不将其他任务遗留目录自动视为本轮可删除目录。原本有真实用户登记时，本方案不会在该用户账户上安装，因此无需对真实登记进行写入式“恢复”。

## 报告边界

公开报告只含版本、文件数量／哈希、匿名检查结果及已脱敏截图；安装目录、注册表原值、进程命令行、服务令牌、nonce、私有图像和工程留在忽略目录。源码 P0 pilot 通过不能替代安装版通过；本地安装通过也不等于已经发布，真实用户首次使用、中文输入法和实体触控仍按实际测试范围单独标注。


## 最终候选的一次性执行顺序

最终源码阶段通过参数提供，可为 source17 或后续冻结版；不得在 runner 中把 source16 自动当作最终安装源码。原始 Setup 与解包文件树在验收完成前保持原字节，使用新的 QaRoot，不能复用 09 阶段的 state。

| 顺序 | 实际输入／动作 | 完成门槛 |
|---|---|---|
| 1. 主任务 Build／Install | 最终阶段 manifest、原始 Setup SHA-256、保留的 `Figure Studio` 包目录、新 QaRoot、空闲 Port／Port+1；主任务运行 `verify_live_preview_windows.ps1 -Phase Install` | 四注册视图初始全部不存在；所有原 EXE 身份保护；完整安装文件、PE 版本和无开发 Python 的冻结自检通过 |
| 2. Start | 同一 `-QaRoot` 与 `-Version`，运行 `-Phase Start`；端口沿用 Install 写入的 state，不靠 Start 重新指定端口 | 实际安装 EXE 身份、认证健康响应、版本及真实 `data/workspace/index.html` SHA 落盘 |
| 3. 本代理完整功能 | 使用 `run_studio_installed_acceptance.cjs`，显式传实际 state、最终 source-stage manifest、实际 installed HTML／SHA、原始 Setup SHA、包与源码一致性 proof；默认仅生成计划，必须 `--mode=run` 才启动浏览器 | P0 72、resource 4、新 blank 生命周期、touch 8、selection 5、完整 Discovery（含独立文件实际 Save）及两段 headful 核心录像全部通过；每套前后只读核查原进程及登记 |
| 4. 委托高频与其它真实流程 | image_tools_ux 运行已安装的 P1 两主题各完整 37；可用同 runner 的 `--suites=p1-carbon,p1-pearl` 和另一个输出目录。主任务另协调查重后台与原生启动器检查 | 记录同一最终 HTML／Setup；委托结果不能由 source16 或本 runner 的部分 PASS 代替 |
| 5. 人工画面／素材复核 | 查看最终 installed 头部与主画布截图；核对 headful 原始录屏中的草稿、取消与一次应用，选择真实时间片段 | 不把测试末尾已应用截图标成草稿；原 WebM 不编辑，任何 GIF 压缩和帧率变化另记 |
| 6. Reinstall | 所有最终浏览器、委托及人工检查结束后，显式 `-Phase Reinstall -BrowserAcceptanceComplete -ProjectPayload <实际 Save 文件>` | 仅停精确本轮 QA PID；同一原始 Setup 重装，所有包文件再核对；设置、哨兵及实际原始工程 JSON 字节保持 |
| 7. Uninstall | 同一 state，显式 `-Phase Uninstall -BrowserAcceptanceComplete` | 本轮真实卸载器 SHA／目录仍匹配；四视图恢复原不存在；原应用元组和外部数据不变 |

各阶段都要求 PowerShell **7.5 或以上**，脚本现用 `#Requires -Version 7.5` 在任何安装写入之前拒绝旧版本。`Install` 需要 `-PackageRoot -ExpectedSetupSha256 -Port`；`Start／Reinstall／Uninstall` 从 state 读取已批准的 Setup、包目录与端口，只需保持 `-QaRoot -Version` 一致。`Reinstall` 额外需要真实 Save 文件；正常 `Uninstall` 必须在成功 Reinstall 之后。失败尝试的清理只能明确使用 `-CleanupIncompleteAttempt`，其安全报告始终标为 incomplete cleanup，不能写成最终全部通过。

主任务完成 Install 后，Start 的实际命令为：

```powershell
pwsh -NoProfile -File scripts/verify_live_preview_windows.ps1 -Phase Start -Version 0.1.22 -QaRoot NEW-QA-ROOT
```

拿到真实工作区 HTML 与主任务批准的哈希后，再生成／执行计划：

```powershell
node scripts/run_studio_installed_acceptance.cjs --mode=plan --state=NEW-QA-ROOT/private-state.json --source-stage=FINAL-STAGE --source-manifest=FINAL-FREEZE/source-manifest.json --installed-html=NEW-QA-ROOT/data/workspace/index.html --expected-installed-html-sha256=APPROVED-HTML-SHA256 --expected-setup-sha256=APPROVED-SETUP-SHA256 --package-source-proof=ACTUAL-PACKAGE-SOURCE-PROOF.json --expected-version=0.1.22 --out=NEW-QA-ROOT/browser-final
```

`--mode=plan` 只读实际 Install 证据并输出私有命令计划，不启动程序或浏览器，也不创建通过报告。实际执行用完全相同参数改为 `--mode=run`。输出目录必须尚未存在；每个 child 命令通过结构化 argv 启动，不使用 shell 拼接。默认 own suites 按 `p0,resources,blank,touch390,touch1280,selection,discovery,core-demo` 顺序运行；`--suites` 限定运行时报告明确是部分范围。P1 委托仍须完成后才能设置 BrowserAcceptanceComplete。

runner 会先验证四视图与精确进程的只读身份、认证健康、真实工作区／served HTML 的精确注入重建、原始 Setup、安装文件 manifest 和冻结自检 proof。它不自行 Install、Start、重装、卸载或发布。`check_live_preview_windows_identity.ps1` 仅查询 CIM、文件哈希和精确 AppId 登记，没有终止进程或写注册表操作。失败保留全部原日志，不自动卸载，避免在其它验收仍进行时结束服务。

源码冻结页含公开 Iris 工程，而桌面包起始页为空白工程，两者 HTML 哈希分别保留。`--source-manifest` 与包的源码对照 proof 绑定原始冻结清单、78 项 UI 资产及 27 项后端源码引用；其中 23 项生产模块必须逐项通过实际字节码对照，4 项不分发的测试源码单独记录。`--expected-installed-html-sha256` 则必须同时匹配主任务批准的实际起始页、完整安装文件清单中的唯一 starter 条目、原包 starter、已安装 starter，以及 Start 记录的工作区 HTML，不能以 Iris 冻结页代替。

P0 接收新生成的 `browser-final/installed-run-manifest.json`：其 `htmlSha256` 为实际安装工作区 HTML，同时复制原冻结资产／后端哈希，保留 `parentSourceFreeze` 的原清单和 HTML 哈希、实际 packaged starter 相对路径与哈希，以及安装器／完整安装清单哈希。原始 source manifest 不修改。该运行清单只在 `--mode=run` 的进程身份、认证健康及精确服务端注入验证通过后落盘；计划模式仅列出拟生成路径，不把计划当作真实验收。

P1 的真实冻结 HTML 参数是 `--expected-html=HASH`，其余多数脚本为 `--expected-html-sha256=HASH`；runner 已分别适配，不能静默传错参数。core-demo 明确 `headless=false, video=true`，只录最终 installed 的边框及原生轴两项，不能复用早期 source pilot 录像冒充安装版。

P0 的实际 Iris Save 文件会经原报告 SHA 核对后写入 `browser-final/private-preservation-payload.json` 的私有文件索引，里面仍是应用下载的合法 payload，不手造 schema。主任务认可所有检查完成后，以该 `file` 作为 Reinstall 的 `-ProjectPayload`；公开摘要只记 SHA。保留原始 private-state、实例 nonce、实际 served HTML、完整命令与日志在 `.cache`，不要放入公开 ZIP。

## BEFORE／最终 AFTER 演示素材

原始 BEFORE 两段仍为独立 0.1.21 冻结 runtime，**不是安装版**：H&E 边框视频 1,824,791 字节，Iris 坐标轴视频 10,475,311 字节；路径和已核实 SHA 固定在 `.cache/live-preview-qa/demo-plan-before-v4.json`。最终派生前已重新核对完整哈希、解码并逐一查看原片及 GIF 的首／中／末画面；实际来源见[媒体清单](../docs/qa/live-preview/reviewed-before-after-media.json)。原文件未修改。

`scripts/build_studio_live_preview_demo.py` 已支持任意后续阶段的实际原录屏，不硬编码 source16。最终 AFTER 必须来自上述 installed core-demo 的实际 WebM、PASS raw report、最终 local／served HTML 和 Setup proof。先人工查看原视频，明确真实输入 seek／duration 后再建新 plan；不能将 report 墙钟时间直接当作视频偏移，也不能预填尚未发生的阶段或 UI 进度。

BEFORE 已审过的实际 seek 为边框 `8.0s + 1.4s`、原生轴 `34.0s + 9.3s`；它们分别显示旧遮挡弹窗／显式应用和三次真实自动提交。最终 AFTER 取自实际安装版，边框为 `6.3s + 4.5s`，坐标轴为 `4.5s + 3.3s`，其输入和草稿画面经解码核对；[演示](../docs/live-preview-demonstration.md)说明未入镜范围。两个阶段保持同一 H&E 源像素／几何和同一 Iris 数据；H&E 工程标题与 ID 不同，不能称整个工程 JSON 字节相同。

派生 GIF 固定宽 960、10 fps、256 色，无裁剪、UI 合成或插帧，原视频不修改；它用于展示，不替代已独立解码的科学图导出像素证明。当前 ffmpeg 是最小构建，既有流程实际生成 GIF，不承诺未验证的 MP4 编码器。生成器拒绝覆盖旧输出，输出默认仍要求人工查看首／中／末及动作边界；任何已应用画面都保留相应标签。
