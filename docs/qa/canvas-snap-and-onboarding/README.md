---
author: a
created: 2026-11-08
---

# Figure Studio 画布交互与下载入口验收

本轮以 GitHub `main` 的 `3b0430054467` 为基线。正式下载为 Suite v1.5.0 / Figure Studio 0.2.0。草稿 PR #44 负责统计报告翻译与反馈路由，草稿 PR #1 负责私有运行依赖检查。

| 用户路径 | 验证结果 |
| --- | --- |
| 首页下载 | 核对三个 README、两份快速入门及发行说明顶部的 Setup 直链与 Skill 指南。GitHub 正式 Release API 确认资产名、版本和 SHA-256，Setup 和单入口 ZIP 直链均返回 HTTP 302 下载跳转。便携版、源码包、校验和预览版列在次级入口。 |
| 颜色入口 | Chrome 导入 JPEG 照片和 PNG 图表，并打开含原始数据绑定的可编辑图表。JPEG 一次点击进入自动校色预览。SVG 一次点击进入配色，悬停预览并点击应用，也可用 Ctrl+K 的「改色」打开所选对象的色值。PNG 一次点击进入整体显示调整并获得源 SVG／原始数据提示。验证取消、保留、一次撤销、保存重开及未选小图和原始来源。 |
| 磁吸 | 跨小图拖 B、C 对齐固定的 A。A、B、C 字号分别为 13、23、17 pt。100% 与 75% 缩放均通过，横向位置跟随指针。验证图元干扰、Alt、拖离、跨行边界、快速松手、普通对象边缘／中心吸附和取消。两次拖动令撤销索引依次为 0、1、2。 |
| 工程往返 | 通过 CLI 生成可编辑 JSON，从「打开工程」加载，确认数据和候选图完整。人工改 A 后，从质检导出仅含 C 的本地交接文件。用合法样式操作预览 C，保存预览不写入修改。取消和保留均可用，A、B 状态逐项相等。已变化的 C、错误工程 ID 和无效 JSON 均拒绝，状态及历史相等。源码回归另覆盖锁定目标。 |

旧版在 100% 缩放亮线时，A 和 B 的基线分别为 247.840、252.840 CSS px，水平线位于 241.840 CSS px。候选在拖动中将 A、B 和线置于 247.840 CSS px。保存并重开后，在 75% 缩放下三个图号基线均为 226.380 CSS px，最大差小于 0.001 CSS px。

[旧版亮线但基线错位](baseline-b-preview.png) · [已安装编辑器的拖动、贴齐、松手和重开序列](abc-drag-and-reopen.gif)

[照片校色](photo-preview.png) · [整图配色](chart-palette-preview.png) · [PNG 显示调整](png-preview.png) · [本地交接](handoff.png) · [仅 C 的预览](ai-c-preview.png)

照片为 Matplotlib 随附的美国海军 Grace Hopper 示例照片。图表与组图使用仓库示例或合成数据。无原始研究资料进入截图。

## 验证范围

- **源码**。对齐参考线、组对齐、命令搜索、工具抽屉、局部操作与 CLI、版本链接和单入口 Skill 解包回归通过。现有 `test_studio_state.cjs` 仍在统计报告英文消息处失败，相关修复位于 [PR #44](https://github.com/zhoy0409-debug/polish-sci-figures/pull/44)。
- **Chrome 156**。在工作树生成的独立编辑器上重跑颜色、磁吸和工程往返，保存后重新加载文件，并对比状态、原始来源及历史。
- **Windows x64 安装版**。用候选 Setup 安装到本机隔离目录，核对安装资源的 SHA-256 后从已安装 EXE 启动本机服务，在该地址重跑两个浏览器脚本。随后卸载测试安装。安装使用静默方式，未验证全新用户的桌面快捷方式或安全提示。

位图局部替色是独立功能缺口。PNG 保留整体亮度、对比度等显示调整。已标记的原生科研图像、荧光显示参数和 WB 整源调整继续沿用现有工具。JPEG 快捷入口按文件格式提示校色，编辑器不会据像素推断科研图像用途。

## 复现

安装项目依赖及 Playwright。Chrome 路径默认使用系统 Chrome，也可按仓库 CI 设置 `STUDIO_TIFF_BROWSER=chromium`。

```bash
python scripts/build_canvas_round_fixture.py --out .cache/canvas-qa
node scripts/test_studio_label_snap_browser.cjs .cache/canvas-qa/canvas.html .cache/canvas-qa/snap
node scripts/test_studio_context_handoff_browser.cjs .cache/canvas-qa/canvas.html .cache/canvas-qa/context PHOTO.jpg demo/multigroup_workbench/box_raw_points.png .cache/canvas-qa/skill-project.json
```

基线复现用 `--suite` 指向上一提交的工作树，添加 `--baseline`，再给磁吸脚本传入第三个参数 `baseline`。安装版使用 `desktop/build_windows.py` 构建。安装到独立目录，用 `Figure Studio.exe --no-open --data-dir TEST_DATA_DIR` 启动本机服务。将上述脚本首个参数改为该本机 URL，并为磁吸脚本附加 `candidate .cache/canvas-qa/canvas-project.json`。无可用隔离目录时，改在新 Windows 账户或虚拟机安装。
