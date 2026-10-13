# polish-sci-figures · 产品指南

[首页](README.md) · [English](README.en.md) · [中文](README.zh-CN.md)

**从数据到组图：可编辑模板、明确的统计分析、可逆的精细排版。**

polish-sci-figures 把科研绘图、图像规范化和组图质控放在同一工作流中。普通用户可直接安装 **Figure Studio**，在浏览器中编辑；AI 用户继续使用三个配套技能，从数据分析到最终交付。两种入口使用同一套本地图形与分析代码。

[![Skill checks](https://github.com/zhoy0409-debug/polish-sci-figures/actions/workflows/python-app.yml/badge.svg)](https://github.com/zhoy0409-debug/polish-sci-figures/actions/workflows/python-app.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**套件 v1.4.4 · Figure Studio 0.1.4（Windows 桌面版）**

[官方下载 / Downloads](https://github.com/zhoy0409-debug/polish-sci-figures/releases) · [中文入门](desktop/QUICKSTART.zh-CN.md) · [English quick start](desktop/QUICKSTART.en.md) · [本版更新](docs/release-v1.4.4.md#图片查重)

## 选择入口 / Choose your workflow

| 你的工作方式 | 从这里开始 | 本机要求 |
| --- | --- | --- |
| 直接预览、换数据、编辑和排版 | Figure Studio Windows 安装包 | Windows 10/11 x64；无需 Codex、Python、账号或 API 密钥 |
| Claude 中直接上传技能 | [自包含技能上传包](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.4/polish-sci-figures-v1.4.4-skill.zip) | 宿主支持技能与代码执行；参见 [平台安装](docs/platform-installation.md) |
| 让 AI 分析数据、生成候选图、完成质控 | 三技能套件 `sci-figure-suite-v1.4.4.zip` | 支持技能的 AI 环境，以及套件 Python 依赖 |
| 已有 SVG，希望手动精修 | AI/CLI 生成自包含 Studio 页面 | 页面可离线编辑；重新计算数据需本机引擎 |

- [安装即用](#安装即用)
- [可编辑的图形仓库](#可编辑的图形仓库)
- [从数据更新到最终排版](#从数据更新到最终排版)
- [统计分析与证据边界](#统计分析与证据边界)
- [图片查重](#图片查重)
- [AI 与命令行工作流](#ai-与命令行工作流)
- [验证范围与当前边界](#验证范围与当前边界)
- [官方发行与许可](#官方发行与许可)

## 安装即用

1. 从 [GitHub Releases](https://github.com/zhoy0409-debug/polish-sci-figures/releases) 下载 `polish-sci-figures-Studio-0.1.4-Setup-x64.exe`。
2. 安装后打开 **polish-sci-figures Studio** 快捷方式。启动窗口会打开默认浏览器中的编辑器。
3. 选择 **从模板开始**，浏览真实预览，再将示例数据替换为自己的数据；也可导入现有图片、SVG 或选定的 PDF 页面。受支持的原生文字与矢量路径保留编辑能力；PDF 特效可能需要局部图片图层或整页外观图像。详见[转换边界](docs/release-v1.4.3.md#本版更新)，导出前请检查字体替代效果。
4. 编辑完成后导出 SVG / PNG / TIFF，并用 **保存** 下载可继续编辑的 JSON 备份。

便携版为 `polish-sci-figures-Studio-0.1.4-Portable-x64.zip`。完整解压后运行 `Figure Studio.exe`，保留旁边的 `_internal` 文件夹。桌面包自带绘图与统计运行环境，可离线使用。数据表支持单元格编辑、直接粘贴 Excel 区域及导入 CSV/TSV；若要以文件方式导入 Excel 工作簿，请先导出为 CSV/TSV。

关闭浏览器不会关闭本机服务；使用结束时关闭启动小窗口。自动保存位于所用浏览器的本地存储中，清理网站数据、切换浏览器或使用隐私窗口可能丢失记录。**重要工程请下载 JSON 备份。** 详见 [中文入门](desktop/QUICKSTART.zh-CN.md)。

## 可编辑的图形仓库

当前提供 **218 个可编辑模板起点**：191 个表格驱动模板，以及 15 个基于观察数据的 ROC / PR 展示和 12 个已有 ROC 结果展示。每个起点都附输入要求和示例预览；示例数据明确标注，插入模板不会把示例冒充为用户结果。

| 科学问题 | 图形示例 | 输入边界 |
| --- | --- | --- |
| 分布与组间比较 | 原始点、箱线、雨云、小提琴、效应量与区间、分面比较 | 观察值、组别及真实实验单位；推断需确认设计 |
| 关系、时间与剂量 | 散点、轨迹、时间带、剂量反应、分解与诊断图 | 原始观察值或模板要求的拟合结果 |
| 分类与诊断表现 | ROC、PR、阈值、混淆矩阵、置信带、部分 AUC、交叉验证等 | 根据模板提供预测观察值或已计算结果；并非所有方法自动拟合 |
| 组学与矩阵 | 热图、火山图、曼哈顿图、富集图、GSEA、基因组覆盖轨迹 | 对应数值矩阵、统计结果或轨迹数据 |
| 生存、综合与模型解释 | 生存曲线与风险表、森林图、SHAP、PCA、列线图 | 原始生存记录或明确的模型、汇总和解释结果 |
| 组成与连接关系 | 组成图、UpSet、流向图、网络及结构图 | 集合成员、组成、边或流量等相应数据 |

预览、应用后的图形与替换数据后的输出共用渲染器。适合当前数据的候选优先展示，完整仓库提供跨类别搜索、分类浏览和放大预览。兼容候选由明确的数据与科学含义约束，不能因为列名相同就任意切换。

模板数量不是 218 种统计模型，也不意味着任意数据、标签长度和尺寸都已人工验收。[输入合同与实现说明](skills/polish-sci-figures/references/figure_studio.md#original-editable-gallery-2026-10-12) 记录具体边界；旧 1–124 参考编号仍可通过 `template_router.py` 查找对应科学工作流。

以下为合成数据示范，用于展示组合能力，不是生物学证据：

![Synthetic bioinformatics composite](demo/composite_showcase/Figure_1_Bioinformatics.png)

<details>
<summary>基础研究与测序组图示范</summary>

![Synthetic basic-research composite](demo/composite_showcase/Figure_2_Basic_research.png)

![Synthetic sequencing composite](demo/composite_showcase/Figure_3_Sequencing.png)

</details>

## 从数据更新到最终排版

- **数据与图形相连。** 粘贴表格或导入 CSV/TSV，检查标出的单元格，再选择 **更新图形**；也可启用自动更新。无效修改保留草稿和上一版有效图形，有效的极端值不会被删去；当前数据绑定的比较分析同步重算。本机服务断线时保留工程和数据草稿，重新连接后继续操作。
- **母版可调整。** 拖动换位、跨行跨列、增添行列、调整间距；支持的模板按真实尺寸重绘，其他素材保留原有比例。指定分面比较可拆成横排独立面板，保留原比较家族的统计记录。
- **直接编辑对象。** 框选、多选、对齐、分组与锁定；移动已有对象，插入文字、线条和形状，使用方向键微调。双击文本可就地编辑，字符级加粗、斜体、上下标保留科学记号的局部格式。
- **更容易放置标注。** 水平线和垂直线在拖动端点时保持方向；自由直线靠近水平或垂直方向时自动吸附，也可按 Shift 限定角度。比较括号工具便于手动标注；插入文字后直接在落点编辑。
- **调整样本点与配色。** 在当前图形上预览不同色系；支持的样本点可用滑块实时缩放。误差棒可选择仅上、仅下或双向，调整端帽长度与线宽，仍以真实估计值和区间为依据。
- **细节有对应控制。** 支持的轴可调整真实范围、首组间距和数据坐标参考线；热图可切换连续配色、显示真实格值并调整数字格式。比例尺需用户提供校准，图号可自动编号或手动编辑。
- **组别太远可直接收紧。** 属性页的统一组间距滑块可实时平移支持的横向或纵向分类图整组元素，已有柱形图也使用这一入口。散点和区间保持大小，比较标注与连接线同步调整；一次撤销恢复之前的间距。连续数值轴、矩阵及空间不足的图形不会被强行移动。
- **修改可追回。** 撤销、重做、命名版本、项目总览和外观预设支持连续工作；跨图粘贴外观保留目标数据、统计和校准信息。
- **图与图之间的间距分开调整。** 左侧分别设置横向、纵向间距；需要更紧凑时启用“自动收紧留白”，按可见内容收掉外部空白，保留字形与图形大小。跨格小图或跨图标注暂保留原留白并提示。
- **按出版尺寸输出。** 右键小图所在单元格，选择“单图另存为…”可导出 SVG、无损 RGB TIFF 或 PNG；整组 TIFF 选择顶部 **导出 → TIF**。单图按当前单元格裁切，保留图号、统计标注、条件表及当前编辑。导出框锁定纵横比，可设宽度（mm），栅格格式可选 600 / 900 / 1200 dpi，并显示实际像素尺寸。SVG 保留已有矢量和活文字；TIFF 按所选 dpi 栅格化矢量，不会补回低分辨率原图缺失的细节。

中文和 English 界面可切换；用户自己的数据、项目名和图内文字不会被擅自翻译。完整功能说明见 [Figure Studio](skills/polish-sci-figures/references/figure_studio.md)。

## 统计分析与证据边界

统计引导会识别常见的数据列，按适用性和分析目标排列方法，并简要说明每种方法比较什么。确认独立或配对设计及实验单位后，选择方法即可计算结果、预览图内标注；自动识别不合适时，仍可展开高级列映射进行调整。

原始数据分析要求用户确认独立或配对设计，并明确组别、数值与真实实验单位。配对数据需要可匹配的对象编号；独立数据没有编号列时，需确认每行代表不同的实验单位。软件不会从行号猜测独立性，也不会将技术重复当成独立样本。当前交互分析支持：

| 设计 | 方法 | 主要比较目标 |
| --- | --- | --- |
| 独立组 | Welch *t* 检验 | 均值差异 |
| 独立组 | Mann–Whitney *U* 检验 | 分布或秩差异，通常不等同于中位数检验 |
| 配对 | 配对 *t* 检验 | 配对均值差异 |
| 配对 | Wilcoxon 符号秩检验 | 配对差值的秩位置；需相应方法假设 |

选择全部两两比较或与指定对照比较时，**一次 Holm 校正覆盖本次请求的全部比较，包括各分面**。不同分面不会被合并成跨分面比较。方法按设计与估计目标推荐，不按最小 *P* 值推荐。完整两两结果可切换字母分组、井号、星号和具体 *P* 值；总体 ANOVA 的 *P* 值不能冒充两两结果，共享字母也不证明等效。

已有比较结果可按列映射接入，须声明方法及数值是否已校正。外部结果与拆分分面保存的结果在对应数据改变后会失效并提示更新，不沿用旧显著性。SHAP、GSEA、模型区间、诊断综合等结果类模板负责规范呈现已有结果，不代替上游专业模型。详情见 [本机分析协议与方法边界](skills/polish-sci-figures/references/figure_studio.md#analyze-observations-or-connect-comparison-results)。

原技能的独立、配对、多组、关系、生存与剂量等工作流继续保留其各自分析合同。显微图先按真实校准规范化，再进入组图；不要从图片外观反推比例尺。

## 图片查重

交付前检查是否把同一张图片放了两次。Figure Studio 可检查当前组图、选中的图片或本地图片批次，无需拆散小图编组。每批 2–60 张栅格图像在本机比较，也能读取 SVG 中嵌入的图片，展示完全重复及旋转、翻转、缩放或裁剪后的疑似重叠。

并排查看图片与匹配证据、定位画布中的对应图片，再导出报告留档。检查不会修改或删除图片。标出的图片需要结合原图和采集记录复核；未检出不代表排除了所有重复。详见[操作步骤与支持范围](docs/image-duplicate-check.md#中文)。

AI / 命令行入口：

```bash
python sci_figures.py duplicates image-a.png image-b.tif figure.svg --out image-check
```

## AI 与命令行工作流

三个技能保留原来的分工，Figure Studio 是同一产品的可视化入口，不是必须安装的第四个技能。

**Claude 用户：** 下载 [polish-sci-figures-v1.4.4-skill.zip](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.4/polish-sci-figures-v1.4.4-skill.zip)，直接按平台的技能上传入口导入。单入口包内置完整三技能工作流与 CLI，无需重新打包。此前 v1.4.1 已修复旧上传包内含多个 `SKILL.md` 导致 Claude 拒绝的问题，已在 Claude 实际调用技能绘图，PNG 视觉检查通过；HTML 交付与下载链路的具体验证范围见平台指南。Claude Code 也可使用个人或项目技能目录。具体步骤、官方依据与宿主验证状态见 [平台安装指南](docs/platform-installation.md)。

| 技能 | 负责内容 |
| --- | --- |
| [`make-sci-data-figures`](skills/make-sci-data-figures/SKILL.md) | 数据与设计核查、统计记录、候选图、图形仓库与可重绘数据包 |
| [`standardize-sci-images`](skills/standardize-sci-images/SKILL.md) | 显微 / 病理图像规范化、统一显示设置、权威校准比例尺与处理审计 |
| [`polish-sci-figures`](skills/polish-sci-figures/SKILL.md) | 精修与组图、Figure Studio、文字与几何检查、最终尺寸质控 |

从 [官方发行页](https://github.com/zhoy0409-debug/polish-sci-figures/releases) 下载 `sci-figure-suite-v1.4.4.zip`，解压完整套件。AI/CLI 路径需要自行安装依赖；Windows 桌面包已包含运行环境。

```powershell
python -m pip install -r requirements.txt
New-Item -ItemType Directory -Force "$HOME/.agents/skills" | Out-Null
Copy-Item -Recurse -Force ./skills/make-sci-data-figures "$HOME/.agents/skills/"
Copy-Item -Recurse -Force ./skills/standardize-sci-images "$HOME/.agents/skills/"
Copy-Item -Recurse -Force ./skills/polish-sci-figures "$HOME/.agents/skills/"
```

在支持技能的 AI 环境中，不必编写专业提示词。Claude 用户先在输入框旁点击 `+` → Skills → polish-sci-figures 选择技能；其他宿主按其入口启用。上传表格后可以直接说：

> 帮我把这张表画成适合论文的图，给我几个合适的样式选一下。

安装成功不保证普通请求会自动调用技能。先从菜单选择，再使用日常表达，无需记忆专业调用语法。

技能会自动检查字体和依赖，再读表、筛出少量适合的候选，并说明各自能看出什么。设计不清楚时，只确认会影响分析的事实，例如“这两列是同一批对象处理前后，还是两批不同对象？”颜色、字号和位置等后续修改可在编辑器中直接完成，无需反复调用 AI。

保留整套技能以便相互调用。macOS / Linux 可将这三个目录复制到 `~/.agents/skills/`；具体技能目录以所用 AI 工具的配置为准。桌面安装包当前只提供 Windows x64 版。

### 检查数据与生成模板

```bash
python sci_figures.py doctor --font Arial
python sci_figures.py inspect data.xlsx --sheet 0 --json
python sci_figures.py route data.csv --structure group-comparison --design paired
python skills/make-sci-data-figures/scripts/gallery_cli.py --list
python skills/make-sci-data-figures/scripts/gallery_cli.py --view compare_raincloud --input observations.csv --out results/raincloud
```

`inspect` / `route` 提供结构证据和待确认项，不擅自执行推断设计。图形仓库 CLI 的表格须符合所选模板列合同；例如雨云图使用 `group,unit,value`。CLI 数据巡检接受 CSV/TSV/XLSX；模板 CLI 使用 CSV。

### 交付可继续编辑的页面

```bash
python sci_figures.py studio results/raincloud panel2.svg --out figure-studio.html
python sci_figures.py studio-serve figure-studio.html --port 8767
python sci_figures.py qa final.svg --font Arial
```

一个候选目录成为一个小图。生成的 HTML 可离线进行布局和外观编辑；数据重算需启动本机服务，桌面版会自动启动它。原始数据、分析与配方保存在数据包中，浏览器差异不会自动重写 Python/R 源码。AI 接回工程时应保留用户选择，再做终稿检查。

## 验证范围与当前边界

本版测试包含输入合同、真实重绘、数据替换、SVG 文本与尺寸、统计绑定、撤销和本机服务。浏览器检查覆盖选中对象编辑、热图数值及配色、统计重算、分面拆分、轴设置、字符格式和导出等具体场景。详细记录见 [验证记录](docs/figure-studio-validation.md)；可重现的源码与打包检查见 [构建说明](desktop/BUILD.md)。

这些记录不是所有模板、数据、标签长度、导入 SVG 或浏览器均已视觉验收的声明。自动边界检查不能代替实际尺寸下的可读性、图例含义、重叠和期刊要求检查。统一精确绘图区仅应用于明确支持的模板；其余素材使用已有画布或本身几何，避免非等比拉伸。

- **桌面运行环境：** Windows 10/11 x64 分发目标，冻结的 CPython 3.12 运行时；实际测试环境与结果以发行记录为准。
- **技能与 CLI：** CI 配置覆盖 Python 3.10 / 3.12 和 Windows / macOS / Ubuntu；本版最终 CI 状态见页首检查链接，不能把矩阵配置当成已完成测试。
- **输出：** Studio 当前提供 SVG、PNG、TIFF 和工程 JSON；PDF 可使用适合的原绘图流程处理，尚无编辑器 PDF 导出按钮。
- **输入图像：** 普通 PNG/JPEG 的内部文字不能自动转为独立可编辑对象。SVG 支持受限的静态子集，不执行脚本或外部资源。
- **分析：** 重复测量、层级、协变量调整、复杂预测模型等需明确的专业工作流；界面不会凭图形形式补造统计结果。

自动保存与本机计算不等于云端备份。桌面编辑与分析在本机进行，官方项目链接只有点击时才打开。AI 工作流所用的 Codex、其他 AI 环境或外部服务有各自的数据处理规则。

## 官方发行与许可

[zhoy0409-debug/polish-sci-figures](https://github.com/zhoy0409-debug/polish-sci-figures) 是本项目唯一的官方维护与发布入口。维护版本通过该仓库 Releases 分发；安装包、便携包和技能套件保持各自的版本标识。

本项目继续采用 [MIT License](LICENSE)，保留版权与许可声明。打包的第三方组件附有各自许可说明，不能把它们一概称为 MIT。官方标识、固定仓库入口和 SHA-256 校验值方便核对来源与文件，不是 DRM，也不保证软件不能被复制；校验值不是发布者数字签名。当前构建未做代码签名，Windows 可能显示未知发布者或信誉提示。

引用信息见 [CITATION.cff](CITATION.cff)。感谢 Gliese-876 提出的运行时依赖与源码可移植性检查建议；原技能的贡献与许可记录继续保留。
