# polish-sci-figures v1.4.1

[中文](release-v1.4.1.md) | [English](release-v1.4.1.en.md)

套件 v1.4.1 与 **Figure Studio 0.1.1** 修复了 Claude 技能上传兼容性，并改善图库查找、预览加载和本机服务恢复。原有 218 个可编辑模板与三技能源码工作流继续保留。此前版本的能力与验收记录见 [v1.4.0 说明](release-v1.4.0.md)。

## 选择下载文件

所有文件通过 [官方 v1.4.1 发行页](https://github.com/zhoy0409-debug/polish-sci-figures/releases/tag/v1.4.1) 分发。

| 文件 | 用途 |
| --- | --- |
| [polish-sci-figures-Studio-0.1.1-Setup-x64.exe](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.1/polish-sci-figures-Studio-0.1.1-Setup-x64.exe) | Windows 10/11 x64 安装版；无需另行安装 Python、Codex 或注册账号 |
| [polish-sci-figures-Studio-0.1.1-Portable-x64.zip](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.1/polish-sci-figures-Studio-0.1.1-Portable-x64.zip) | 便携版；完整解压后运行 `Figure Studio.exe`，保留 `_internal` |
| [polish-sci-figures-v1.4.1-skill.zip](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.1/polish-sci-figures-v1.4.1-skill.zip) | 修复后的自包含技能上传包 |
| [sci-figure-suite-v1.4.1.zip](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.1/sci-figure-suite-v1.4.1.zip) | 完整源码 CLI 与三个技能目录 |
| [SHA256SUMS.txt](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.1/SHA256SUMS.txt) | 上述四个发行文件的 SHA-256 校验值 |

桌面版使用步骤见 [中文入门](../desktop/QUICKSTART.zh-CN.md)；AI 用户见 [平台安装指南](platform-installation.md)。

## 修复与改善

- **Claude 上传包兼容性。** v1.4.0 上传包内包含四个 `SKILL.md`，真实上传时被 Claude 拒绝。v1.4.1 整个 ZIP 仅保留一个入口 `SKILL.md`，三项配套工作流改以 `WORKFLOW.md` 随包提供，完整绘图代码与数据合同保留，内部链接同步调整。请使用新版上传包；三技能源码包仍保留各自的技能入口。
- **编辑器打开选定图形。** 单面板默认使用一列布局。CLI 支持通过 `studio --view` 打开已审查的候选图，同时保留其他候选和源数据；不存在的候选名称会明确报错，不会悄悄换成另一张图。
- **组间距实时调整。** 在“属性 → 组间距”拖动滑块或输入百分比。支持的分类图中，原始点、估计值、区间、组名及自动比较标注同步移动，数据值和图形大小保持不变；一次拖动可一步撤销。换数据时保留间距设置，并按新图重新计算位置。已有柱形图继续使用“柱形布局”控制；连续数值轴和无法可靠识别组别的图形不启用此功能。
- **全库搜索。** 图库支持跨类别查找，减少新用户逐个分类寻找图形的步骤；适用数据合同和示例标记继续显示。
- **按需生成设置预览。** 仅在查看相应设置页时生成尺寸、候选图和配色预览，减少普通编辑的重复渲染。图形内容、输入要求和数据计算不因此改变。
- **配色保护坐标轴。** 修复切换配色时数据系列的颜色覆盖轴文字与轴线的问题，保留坐标轴原有的颜色和样式；已完成实际界面检查。
- **断线恢复。** 本机服务暂时不可用时显示连接状态，保留工程和数据草稿；重新连接后继续操作，不要求清空工程或丢弃尚未提交的数据。
- **数值库线程默认值。** 桌面启动器在未显式配置时，将 OpenBLAS、MKL、OpenMP 和 NumExpr 线程数默认设为 1，限制多线程运行带来的额外资源开销。已有显式环境设置保留。该默认值本身不是低配硬件性能保证。
- **完整双语入口。** 首页、平台安装指南、版本说明和桌面入门提供中文与英文入口。Claude 用户先点击输入框旁的 `+` → Skills → polish-sci-figures，再用“帮我把这张表画成适合论文的图”等日常表达开始；不保证普通请求自动调用已安装技能，设计问题仍按实际数据确认。

统计方法和证据要求不因本次补丁改变：原始数据需真实实验单位与明确设计，比较按声明的家族校正；结果类模板仍需要对应分析结果。数据修改不应沿用旧的外部统计结果。

## 本版验证状态

修复后的技能 ZIP 已在真实 Claude 界面成功上传并被识别。Sonnet 5.5 Medium 在显式选择技能后，使用 16 行合成数据和普通中文请求，确认独立实验单位及 mg/L 单位，实际运行 `doctor`、`workflow`、`candidate` 并生成 PNG/PDF/SVG、候选 ZIP 与 HTML；PNG 视觉检查通过。使用日常语言反馈后，重新生成的 HTML 已以一列显示选定的估计图，并通过英文界面视觉检查；候选选择和单面板布局的底层修复也已通过 10 项生成器及 CLI 检查。Claude 下载链路尚未验证，不将本次描述为整条交付流程一次通过。当前测试机尚未安装 WorkBuddy，未开展其宿主内实测。

资源测试已完成：在同一 Windows 主机以 Job Object 限制为 2 CPU / 2 GiB，已发行 0.1.0 EXE 与修改后源码的作业提交内存峰值分别为 **1649.58 MiB 与 299.44 MiB，下降 81.85%**；采样物理工作集约为 284.11 MiB 与 284.14 MiB，基本不变。不能据此称“总 RAM 减少 82%”或运行更快。20 种代表模板的生成、换数据及 10 种支持的精确重绘均通过，图形摘要和统计记录一致。详见 [测试环境、方法与完整结果](windows-resource-benchmark.md)。

新版 0.1.1 安装包已通过实际安装、安装文件与打包文件的逐字节比对，以及隔离 PATH/PYTHONHOME 后的独立 EXE 检查。检查涵盖 Tk 资源、编辑器页面、请求权限、统计分析、绘图及尺寸重绘；重装保留工程与设置，卸载保留用户工程。新冻结 EXE 还通过 2 CPU / 2 GiB 下雨云、聚类热图和 PCA 三种模板的生成、换数据与精确重绘；提交内存峰值为 232.95 MiB，采样工作集峰值为 212.21 MiB，六份原始/修改图形摘要及完整 Welch/Holm 记录与旧版一致。这是三模板复验，与上述 20 模板测试范围不同，不据此另算降幅。详细检查见 [验证记录](figure-studio-validation.md)。

## 升级与许可

升级前保存工程 JSON 并退出启动器，再安装桌面版 0.1.1。便携版需完整解压，不能只替换 EXE。当前应用设置目录 `%LOCALAPPDATA%\Figure Studio` 和安装标识保持不变；浏览器自动保存另存于原本机地址的网站数据中，清理浏览器数据可能删除记录。

AI 用户应下载 v1.4.1 上传包替换旧版技能。该修复无需修改科研数据，也不改变源码三技能的分工。维护与下载统一来自本仓库；项目继续采用 [MIT 许可](../LICENSE)，依赖保留各自许可。Windows 产物仍未代码签名，SHA-256 校验值不是发布者签名，也不是防复制机制。
