<div align="center">

# polish-sci-figures

**Scientific figures, thoughtfully made.**

Turn research data and scientific images into clear, editable figures.<br>
Explore the right chart, refine every detail, and bring your results together.

[English](#polish-sci-figures) · [中文](#中文)

[![Release](https://img.shields.io/github/v/release/zhoy0409-debug/polish-sci-figures?color=3f6da3)](https://github.com/zhoy0409-debug/polish-sci-figures/releases/latest)
[![Skill checks](https://github.com/zhoy0409-debug/polish-sci-figures/actions/workflows/python-app.yml/badge.svg)](https://github.com/zhoy0409-debug/polish-sci-figures/actions/workflows/python-app.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-c95770.svg)](LICENSE)

**[Download Figure Studio](https://github.com/zhoy0409-debug/polish-sci-figures/releases/latest)** · **[Use the AI skills](docs/platform-installation.en.md)** · **[Explore the guide](README.en.md)**

</div>

![Scientific figure showcase in the signature blue–red palette: genomic associations, differential expression, enrichment, correlations, ROC curves, effect estimates and PCA. Synthetic demonstration data.](demo/composite_showcase/Figure_1_Bioinformatics.png)

<p align="center"><sub>Scientific figure showcase · Synthetic demonstration data · Blue–red palette</sub></p>

[What you can make](#what-you-can-make) · [Get started](#get-started) · [Guides and project](#guides-and-project)

## What you can make

**polish-sci-figures** brings data visualization, scientific image preparation, and figure assembly into one workflow. Use the AI skills to work from a research question, or open **Figure Studio**, the companion visual editor, to work directly with your figures.

- **Find a form that fits your data.** Explore distributions, paired observations, effects and intervals, time courses, heatmaps, survival curves, and more. Compare suitable alternatives before choosing a figure.
- **Make the details yours.** Replace data, adjust group spacing, edit individual characters, format statistical annotations, and arrange panels with alignment guides. Undo and redo keep refinements reversible.
- **Take the result into your paper.** Export individual panels or the complete layout as editable SVG or high-resolution PNG / TIFF. Save the project to continue editing later.

The [current library](README.en.md#editable-chart-library) offers **218 editable starting templates**. Statistical methods follow the declared study design; result-based templates use the corresponding supplied analyses. Scientific images retain their calibration and processing records.

<details>
<summary><strong>See more examples</strong></summary>

**Experimental biology** — group comparisons, dose response, distributions, expression and time courses.

![Experimental biology figure with blue–red comparisons, dose response, heatmap and time course. Synthetic demonstration data.](demo/composite_showcase/Figure_2_Basic_research.png)

**Sequencing and omics** — quality profiles, alignment composition, PCA, matrices, differential expression and genomic tracks.

![Sequencing and omics figure with quality profiles, PCA, heatmaps, differential expression and genomic tracks. Synthetic demonstration data.](demo/composite_showcase/Figure_3_Sequencing.png)

All examples use synthetic data.

</details>

## Get started

Choose the way you prefer to work. Both paths belong to the same polish-sci-figures suite.

### Open Figure Studio

[Download the Windows installer](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.1/polish-sci-figures-Studio-0.1.1-Setup-x64.exe), install it, and open the shortcut. Choose a template, replace its example data, then edit and export in your browser. Windows 10/11 x64; the runtime is included, with no separate Python setup, Codex, account, or API key required.

[Quick start](desktop/QUICKSTART.en.md) · [Portable edition](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.1/polish-sci-figures-Studio-0.1.1-Portable-x64.zip)

### Work with AI

Use the companion skills in **Codex**, **Claude**, or another compatible environment. Install and select the skills using the [platform guide](docs/platform-installation.en.md), attach your data, and ask in everyday language:

> Help me turn this table into a figure for my paper. Show me a few suitable styles, and let me edit the result.

The suite covers plotting and analysis, calibrated image preparation, and final figure refinement through three cooperating skills. You can continue adjusting the result in Figure Studio without another AI call. Host requirements, WorkBuddy setup, and actual testing coverage are listed in the platform guide.

[Codex / CLI setup](README.en.md#ai-and-command-line-workflows) · [Claude / WorkBuddy upload package](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.1/polish-sci-figures-v1.4.1-skill.zip)

## Guides and project

[Product guide](README.en.md) · [Latest improvements](docs/release-v1.4.1.en.md) · [Validation record](docs/figure-studio-validation.md) · [Contributing](CONTRIBUTING.md)

Official downloads and updates come from [this repository's Releases](https://github.com/zhoy0409-debug/polish-sci-figures/releases). The project is available under the [MIT License](LICENSE); citation details are in [CITATION.cff](CITATION.cff).

---

## 中文

**从数据到成图，让科研表达更清晰。**

**polish-sci-figures** 将科研绘图、科学图像处理和组图精修连接在一起。从研究问题出发，找到适合数据的图形；也可以直接打开配套编辑器 **Figure Studio**，调整细节、编排小图，完成论文中的整幅图。

**[下载 Figure Studio](https://github.com/zhoy0409-debug/polish-sci-figures/releases/latest)** · **[使用 AI 技能](docs/platform-installation.md)** · **[阅读完整指南](README.zh-CN.md)**

[能做什么](#能做什么) · [开始使用](#开始使用) · [指南与项目](#指南与项目)

### 能做什么

从单幅图到完整组图，让图形更好地表达数据中的信息。

- **找到适合数据的表达方式。** 从分布、配对观察、效应量与区间，到时间趋势、热图和生存曲线，先比较合适的候选，再决定用哪一种。
- **把细节调整到位。** 替换数据、调整组间距、修改单个字符、设置统计标注，并借助对齐辅助线编排小图；撤销与重做让精修可以随时回退。
- **把结果带进论文。** 单个小图和整幅组图均可导出可编辑 SVG 或高清 PNG / TIFF，保存工程后还能继续编辑。

[当前图形仓库](README.zh-CN.md#可编辑的图形仓库)提供 **218 个可编辑模板起点**。统计方法匹配明确的研究设计，结果类模板使用对应的已有分析；科学图像保留校准信息和处理记录。上方组图均使用合成数据展示，红蓝配色贯穿不同类型的图形。

### 开始使用

按自己的习惯选择入口，两种方式都属于同一套 polish-sci-figures 产品。

**直接打开 Figure Studio。** [下载 Windows 安装包](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.1/polish-sci-figures-Studio-0.1.1-Setup-x64.exe)，安装后打开快捷方式。选模板、换数据，在浏览器中完成编辑和导出。支持 Windows 10/11 x64，运行环境已包含，无需单独配置 Python、打开 Codex、注册账号或填写 API 密钥。

[快速入门](desktop/QUICKSTART.zh-CN.md) · [便携版](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.1/polish-sci-figures-Studio-0.1.1-Portable-x64.zip)

**让 AI 协助作图。** 在 **Codex**、**Claude** 或其他兼容环境中，按[平台指南](docs/platform-installation.md)安装并选用技能，附上数据，用日常语言描述需求即可：

> 帮我把这张表画成适合论文的图，给我几个合适的样式选一下，最后让我自己继续编辑。

三个配套技能分别负责数据作图与分析、带校准的图像处理，以及最终精修和组图。生成后可以直接在 Figure Studio 中继续调整，无需每次修改都重新请求 AI。宿主要求、WorkBuddy 安装方式及实际测试范围见平台指南。

[Codex / 命令行安装](README.zh-CN.md#ai-与命令行工作流) · [Claude / WorkBuddy 上传包](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.1/polish-sci-figures-v1.4.1-skill.zip)

### 指南与项目

[完整功能指南](README.zh-CN.md) · [本版更新](docs/release-v1.4.1.md) · [验证记录](docs/figure-studio-validation.md) · [参与贡献](CONTRIBUTING.md)

官方下载与更新统一通过[本仓库的 Releases](https://github.com/zhoy0409-debug/polish-sci-figures/releases)提供。项目采用 [MIT 许可](LICENSE)，引用信息见 [CITATION.cff](CITATION.cff)。

[↑ Back to English](#polish-sci-figures)
