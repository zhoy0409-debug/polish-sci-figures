# Figure Studio Skill Suite 1.6.0 候选验收

基线为 GitHub main `2687cf3` 对应的源码树。本轮保留三 Skill 路由，以 `v1.6.0-rc.1` 构建候选 ZIP。桌面版本与官方发行记录独立管理。

| 工作流 | 基线 | 候选 |
| --- | --- | --- |
| 数据绘图 | 单表选图及独立分析计划 | 以实验单位和研究问题组织多终点证据，从已有分析计划导出 HTML |
| 科研图像 | 统一裁剪与单一物理宽度 | 以宽高上限和最低 DPI 自动适配，增加 WB 泳道和原生强度来源检查 |
| 精修与组图 | 最终尺寸检查和有限工程操作 | 按证据关系比较真实排版，定位冲突、局部修复、同尺寸重渲染和复查 |
| 共用桌面编辑器 | 已有自动比例、适合格子和组间比较预览 | 明确自动适配入口，从有效统计预览导出 HTML 并保留完整精度记录 |
| 安装与平台 | 安装页链接固定在旧版本 | 从官方发行页选择版本，单入口与三技能包分流，候选分支接入两个 macOS 架构的预览构建 |

## 复现

使用通过 `sci_figures.py doctor` 的环境，从 Suite 根目录执行。

```sh
python scripts/test_release_bundle.py
python scripts/test_portable_skill.py
python skills/standardize-sci-images/scripts/test_standardize_images.py
python scripts/test_studio_statistics.py
python scripts/run_studio_tiff_browser_checks.py --out .cache/candidate-browser
python scripts/build_release.py --version v1.6.0-rc.1
python scripts/build_portable_skill.py --version v1.6.0-rc.1
```

浏览器回归使用本地 Chrome，或按 CI 设置 `STUDIO_TIFF_BROWSER=chromium`，并提供 Playwright。统计报告用例调用真实本机引擎，对比显示值和内嵌完整记录，检查原始与校正后的 *P* 值、旧结果失效、外部校正值导入和工程历史。

用 `demo/image_inputs/manifest.csv` 分别运行标准化脚本的默认尺寸及 `--fit-box-mm 35 20`，再比较四张图的审计记录。合成示例由 42.33 × 33.02 mm、300 dpi 变为 25.64 × 20.00 mm、495.3 dpi。原始哈希、裁剪坐标和比例尺一致。

独立 Codex 试跑使用仓库四组合成例，重绘 48 个观测的分布及均值区间，并从原始分析记录导出报告。Windows 的 Git 检出改变了 CSV 的行结束符。测试将副本还原为 LF 后核对了原始哈希，再运行绘图和排版检查。

## 验收范围

Windows 上的 Chrome 运行了共用编辑器源代码和本机统计服务。Windows 安装包和 macOS arm64、x86_64 原生包仍需各自构建与实机验收。临床生存示例验证已有分析记录的 HTML 导出。复杂动物实验、CRAB 基因组、WB 端到端 Agent 任务及 Claude 宿主属于后续独立验收。ScholarFlow 的同名技能在安装文档中明确区分，跨仓库更名需单独迁移。
