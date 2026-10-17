# 专业坐标轴：操作、适用范围与第二轮验收

本文说明第二轮专业坐标轴功能的使用方法与实际验证范围。它沿用 Figure Studio 的数据配方、Matplotlib 渲染与撤销历史；调整范围时会重新绘制真实数据，而不是改写坐标数字。以下结果于 **2026-10-17** 在 Windows 本机 Chrome 和本机数据引擎上验证，开发基线为 Suite v1.4.19 / Studio 0.1.19；本文不代替新版 Windows 安装包的整体验收记录。

## 从哪里进入

选择含数据配方的图，点击顶部 **统计与坐标轴**，或右侧属性中的 **专业坐标轴设置**。双击已识别的轴线或数值刻度也可打开。原有“坐标范围与首组间距”和参考线入口继续保留。

设置分为“范围、刻度、尺寸、外观”四区。先选择 X 或 Y 轴；“当前坐标轴”只修改该轴的刻度和外观，“当前子图”可统一轴线、字号等外观。系统不会把 X 轴数值范围复制到 Y 轴。当前支持同一配方内具有共同科学含义的分面联动；尚未提供跨多个独立 Panel 批量套用轴设置。

1. 在“范围”填写上下限；留空恢复自动范围。范围外的数据仍保留在原表中，并显示裁切提示。
2. 在“刻度”选择主刻度间隔或数量、次刻度数和标签格式。间隔与数量互斥；log10 间隔按 log₁₀ 单位计算，1 表示每十倍。百分比只改变显示：比例值 0.25 显示为 25%，原值仍为 0.25；已使用 0–100 百分数的时间组成图中，25 显示为 25%，不会再次乘以 100。
3. 在“尺寸”设置绘图区宽高和左、下留白，单位为最终印刷 pt；1 mm = 2.83465 pt。可锁定宽高比例，字号和线宽保持物理尺寸。显式设置尺寸后使用精确的自定义几何，普通横竖版候选不会覆盖它。手动网格或锁定布局不允许安全联动时，会说明原因，要求先恢复自动尺寸或解锁。
4. 在“外观”调整轴线、刻度、字体和间距。默认启用延迟实时预览，输入停止后才调用本机重绘；也可取消实时预览后一次应用。每次实际应用进入撤销历史，可保存工程后重开。

重绘保留可匹配的文字和统一样式；自由元素位移、局部图形改动及导入轴延伸可能重置，界面会说明这一点。新增轴字号、颜色或距离优先于旧的统一文字样式。原始测量值和已连接的统计结果不因轴设置改变。

## 按来源区分能力

| 图的来源 | 可以做什么 | 明确边界 |
| --- | --- | --- |
| 带原始表和 gallery 配方、已声明轴语义的本地图 | 真实范围裁切、数字刻度、格式、物理绘图区及外观联动 | 仅限已审查模板；分类轴保留类别含义，不能设置为连续数值轴 |
| 已审查的正值数值散点、部分时间序列图 | 线性与 log10 切换 | 非正观测或不确定性区间会被拒绝；柱形零基线、密度、概率、残差等图不擅自转换 |
| 可识别数值结构的 Matplotlib SVG | 延长轴并续接一致刻度、轴线颜色/粗细/显隐 | 不缩短原始范围，不改尺度，不声称重算绘图区或数据 |
| 普通 PDF/SVG、压平图或识别失败的轴 | 使用原有图形编辑工具 | 不依据像素重标数值；专业轴面板明确显示缺少可验证的数据坐标关系 |

已配置的 log10 轴还要求上下限严格大于零。过密主刻度、无穷值、错误范围、未知尺度和不支持的图型会在提交前被拒绝；数值格式把不同刻度四舍五入为同一标签时会提示提高精度。

## 已执行的验证

以下测试使用真实渲染与浏览器操作；工程测试数据与真实生物测量数据分别记录。

| 验证层 | 实际结果 | 复跑入口 |
| --- | --- | --- |
| 原有负值观测与统计回归 | PASS：22 个实际绘制场景，含本机 engine；负柱、范围、首组间距、参考线和统计保持一致 | [`test_studio_axes_regression.py`](../scripts/test_studio_axes_regression.py) `--engine` |
| 新专业轴渲染与 engine 合同 | PASS：24 项工程案例，SVG/PNG、合法 log10、非正值拒绝、分类轴拒绝、百分比仅显示、240/260 pt 物理框、不可变原表、配方与 reflow | [`test_studio_axis_settings.py`](../scripts/test_studio_axis_settings.py) |
| 导入轴延伸回归 | PASS：14 项 DOM/SVG 场景，含负值、反向、log、次刻度、变换、保存和状态历史 | [`test_studio_axis_editing.cjs`](../scripts/test_studio_axis_editing.cjs) `--dom` |
| UI 与异步状态 | PASS：四区输入、当前轴外观、类别限制、锁定、导入轴仅延长、复位；旧异步队列覆盖过期请求和失败重试 | [`test_studio_axis_settings_ui.cjs`](../scripts/test_studio_axis_settings_ui.cjs)、[`test_studio_axes_events.cjs`](../scripts/test_studio_axes_events.cjs) |
| 慢重绘与百分比语义专项 | PASS：受控 Promise 验证忙时最新修改排队、不误报已应用、手动应用/复位忙态、工程/选择切换；轻量 formatter 验证 0–1 与 0–100 百分比、重复标签提示、非数值图拒绝，原值不变 | [`test_studio_axis_settings_async.cjs`](../scripts/test_studio_axis_settings_async.cjs)、[`test_studio_axis_formatters.py`](../scripts/test_studio_axis_formatters.py) |
| 真实 Chrome 工程流程 | PASS：普通入口、四区、真实重绘、单步撤销重做、接受替换确认后保存重开、双击刻度、SVG/PNG 导出；无远端请求、无页面异常 | [`test_studio_axis_settings_browser.cjs`](../scripts/test_studio_axis_settings_browser.cjs) |
| 可追溯真实生物测量数据 | PASS：同一浏览器流程在 UCI Iris 的 150 株植物测量上复跑；原表逐项相等 | 同一浏览器脚本，设置 `STUDIO_AXES_PROJECT` |

真实数据来自 [UCI Iris 数据集](https://archive.ics.uci.edu/dataset/53/iris)，DOI [10.24432/C56C76](https://doi.org/10.24432/C56C76)，以 CC BY 4.0 许可发布。采用下载包中的 `bezdekIris.data`，X 对应萼片长度（cm）、Y 对应花瓣长度（cm）；UCI 将每行定义为一株植物。本验收不据此推断实验独立性，也不执行假设检验。下载 ZIP 的 SHA-256 为 `d11fe30213d36434a0879aab7cb00ce3c812eb7ba2495874438abff7b7b762e9`。

公开数据准备命令需要明确指定 `--download`，只下载上述公开数据，不读取或上传私有工程。准备工程本身不代表浏览器验收通过：

```powershell
.venv/Scripts/python.exe -X utf8 scripts/prepare_axis_real_data_qa.py --download
$env:STUDIO_AXES_URL = 'http://127.0.0.1:<本机端口>/'
$env:STUDIO_AXES_PROJECT = '.cache/axis-real-data-qa/iris-axis-project.json'
$env:STUDIO_AXES_PROOF = '.cache/axis-real-data-qa'
node scripts/test_studio_axis_settings_browser.cjs
```

测试需要安装项目开发依赖与 Playwright，并将其置于 Node 可解析路径；应用普通轴编辑不需要系统 Node。受限 Windows 测试环境可把 `TEMP`/`TMP` 指向仓库内可写的临时目录。结果 JSON、截图和 SVG 默认写入忽略提交的 `.cache`。私有数据验收仍应使用独立本地输出目录，不将原始表、文件名或图像纳入公共测试报告。

本轮未以 Iris 验证所有科研图型，也未把工程案例等同于对临床或实验结论的验证。尚未提供任意导入 PDF 的数据坐标还原、跨独立小图的轴批量复制，以及字形/线宽随几何等比缩放模式；当前使用固定物理字号和线宽。
