# v1.4.22 大型工程性能与 Windows 本地候选验收

本报告记录 Suite v1.4.22／Studio 0.1.22 的版本化性能与 Windows 验收。source20 已完成 95 个组件脚本（91 Node、4 Chrome）、双主题 10 项真实 Iris 轴流程、唯一正式 184 动作和独立四面板 23 手势；source20 原始 Windows 包已完成实际安装、完整编辑范围、正常重装／卸载及独立最终状态核对。真实官方 0.1.20 → 0.1.22 更新待目标发布，旧包结果不计为新包通过。

source18 人工微软拼音已核查画布选词、候选 Esc／Enter、无效 HEX、F2／失焦、Undo／Redo、保存／重开及 SVG／PNG 导出，原表和源 SVG 保持精确一致，见[Windows 输入法实际记录](windows-native-ime-acceptance.md)。source19 的三行选择／控件刷新优化保留；source20 另修数值轴拒绝组合后的输入锁存，未重复人工原生 IME。[范围核对](qa/live-preview/source20-ime-change-scope.json)明确轴模块已变，主编辑器相关处理器及文字间距／局部放大图模块保持 source18 字节；源码人工结果不冒称新安装版实操。这些功能观察不计入正式性能样本。

## source20 最终源码性能

冻结清单 SHA-256 为 `6f63351be947e5415aff2b31515e34b24b3b4ec12c3e1e245ad82783f6c414fd`，HTML 为 `8e8c76b6a84fa11502e4bfd4cd01538a5edb6994b6ecbc0f8efeb451da69999d`。唯一批次保留全部 160 正式动作与 24 次预热，未重试、删样本或筛选更快结果。全部 8 行、4 指标、来源与样本见[正式汇总](qa/live-preview/performance-v2-final20-summary.json)及[source17／18／19 对照](qa/live-preview/performance-v2-final20-vs17-18-19.json)。所有操作完整性通过，外部请求、页面错误及结束后的自有 Chrome 均为 0。

每格为 **P50／P95，单位 ms**。rAF 是呈现机会，wall 是 Playwright 操作耗时；均不是光学像素延迟或持续 FPS。

| 图元 | 操作 | 输入 → 下一 rAF | 输入 → 第二 rAF | 提交事件 → 第二 rAF | 操作 wall |
|---|---|---:|---:|---:|---:|
| 120 | 选择文字 | 17.8/19.7 | 37.7/43.6 | 21.9/27.2 | 99.2/107.7 |
| 120 | 快捷改色 | 14.0/17.3 | 49.2/57.3 | 48.9/56.9 | 76.2/107.3 |
| 120 | 细节 → 色板 | 17.0/21.6 | 38.7/45.3 | 38.7/45.3 | 90.9/99.2 |
| 120 | 色板 → 细节 | 9.9/11.4 | 29.1/35.6 | 29.1/35.6 | 74.2/82.6 |
| 5000 | 选择文字 | 67.8/78.6 | 138.5/154.7 | 80.4/84.9 | 216.0/240.3 |
| 5000 | 快捷改色 | 63.1/123.1 | 118.0/195.4 | 117.5/195.0 | 166.0/270.1 |
| 5000 | 细节 → 色板 | 289.0/366.0 | 489.8/610.7 | 489.8/610.8 | 571.3/703.7 |
| 5000 | 色板 → 细节 | 46.4/55.6 | 126.6/143.5 | 126.6/143.6 | 182.5/207.2 |

相对官方 0.1.20／0.1.21，5000 选择 next-rAF P95 213.7／212.5 → 78.6 ms、second-rAF P95 358.2／332.9 → 154.7 ms；改色分别为 299.2／350.2 → 123.1 ms 和 451.8／520.2 → 195.4 ms。仅这两个核心操作的全部四指标 P50／P95 均改善，不推广为所有操作、全部负载或所有样本低于 100 ms。

与内部阶段相比仍有退步：source19 改色 second-rAF P95 为 123.7 ms，source20 为 195.4 ms；完整八卡为 607.6 → 610.7 ms。120 图元的第二 rAF P95 依次为选择 43.6、改色 57.3、进入色板 45.3、返回细节 35.6 ms，均高于 source19 对应值；完整八行四指标在上表与 JSON 保留。没有用更快旧阶段替换最终结果，也不凭未采集证据归因于 GC 或环境。

[独立四面板诊断](qa/live-preview/four-panel-style-final20-diagnostic.json)包含 3 次预热、20 次正式手势，23 次全部核对草稿零持久化、一次提交／Undo／Redo及源工程精确不变，外部请求与页面错误为 0；不并入单面板样本。

| 四面板指标 | P50（ms） | P95（ms） |
|---|---:|---:|
| 输入 → 下一 rAF | 6.9 | 7.5 |
| 输入 → 第二 rAF | 33.8 | 37.7 |
| Enter → 下一 rAF | 23.2 | 30.1 |
| Enter → 第二 rAF | 70.6 | 82.4 |

Enter 第二 rAF P50／P95 为 70.6／82.4 ms，相比 source17 的 79.9／144.1 ms 改善，但慢于 source19 的 51.3／58.6 ms；输入为 33.8／37.7 ms，亦慢于 source19 的 27.2／32.7 ms。它是本机负载下的结果，不是任意科研工程的延迟保证。[95 组件](qa/live-preview/source20-component-regressions.json)、[双主题 10 项真实轴流程](qa/live-preview/source20-axis-composition-browser.json)与[25 组轴输入合同](qa/live-preview/source20-axis-composition-fix-regressions.json)分别证明其范围；合成组合事件不作为重复原生 IME。

source19 原 Windows 包已完成部分 8 套件／108 项，因随后确认的数值轴缺陷被替代；[原部分结果](qa/live-preview/windows-final19-partial-installed-summary.json)与[正规清理](qa/live-preview/windows-final19-incomplete-cleanup-summary.json)保留。source20 Windows 原包已另完成实际安装验收，见[本次汇总](qa/live-preview/windows-final20-acceptance-summary.json)；官方 0.1.20 → 0.1.22 仍待发布后实际更新，不用普通重装代替。

## source19 阶段性能（原样保留）

冻结清单 SHA-256 为 `bf5299072f654e7ec01115b787cb2db9e6582566327afd086153532da98cc178`，HTML 为 `4091e5b2f75e3a3b6e332736ae789da60e88a888559ee839402b06697730fba5`。唯一正式批次保留 160 个正式动作及 24 次预热，不删除异常值、不挑选更快重跑。全部来源、逐个样本、旧基线与三个源码阶段对照分别见[正式汇总](qa/live-preview/performance-v2-final19-summary.json)和[source17／18／19 对照](qa/live-preview/performance-v2-final19-vs17-18.json)。

下表完整列出 8 行、4 种指标，每格为 **P50／P95，单位 ms**。next／second rAF 仅表示呈现机会，wall 为 Playwright 操作耗时，不是光学像素延迟或持续 FPS。

| 图元 | 操作 | 输入 → 下一 rAF | 输入 → 第二 rAF | 提交事件 → 第二 rAF | 操作 wall |
|---|---|---:|---:|---:|---:|
| 120 | 选择文字 | 15.5/17.7 | 33.4/36.8 | 18.3/20.2 | 91.0/99.4 |
| 120 | 快捷改色 | 12.8/13.7 | 41.9/45.9 | 41.6/45.5 | 66.1/74.3 |
| 120 | 细节 → 色板 | 15.3/19.6 | 33.2/38.4 | 33.2/38.5 | 82.6/98.5 |
| 120 | 色板 → 细节 | 9.0/10.3 | 25.0/27.8 | 25.1/27.8 | 73.2/81.7 |
| 5000 | 选择文字 | 71.9/81.9 | 140.1/157.6 | 80.8/90.0 | 224.3/240.5 |
| 5000 | 快捷改色 | 62.6/68.2 | 114.4/123.7 | 114.1/123.2 | 156.8/173.0 |
| 5000 | 细节 → 色板 | 295.5/360.2 | 494.7/607.6 | 494.7/607.6 | 581.5/693.9 |
| 5000 | 色板 → 细节 | 48.0/61.4 | 129.9/146.7 | 130.0/146.8 | 182.7/207.5 |

5000 图元选择 next／second-rAF P95 为 81.9／157.6 ms，低于 source17 的 94.0／169.3 ms 和 source18 的 103.1／226.4 ms。改色为 68.2／123.7 ms，较 source17 的 91.0／198.7 ms 改善；第二 rAF 仍略慢于 source18 的 121.9 ms。完整八卡第二 rAF P95 为 607.6 ms，低于 source17 的 611.1 ms 与 source18 的 632.9 ms，但仍有明显生成与布局等待；返回细节 next-rAF P95 61.4 ms 也高于 source17 的 58.9 ms。不能据此宣布全部指标无回退或所有操作低于 100 ms。

source19 的[独立四面板诊断](qa/live-preview/four-panel-style-final19-diagnostic.json)另有 3 次预热、20 次正式手势，23 次均核对草稿零持久化、一次提交／Undo／Redo和源工程精确不变，页面错误及外部请求为 0。它不与单面板正式样本合并。

| 四面板指标 | P50（ms） | P95（ms） |
|---|---:|---:|
| 输入 → 下一 rAF | 4.7 | 5.6 |
| 输入 → 第二 rAF | 27.2 | 32.7 |
| Enter → 下一 rAF | 19.4 | 22.3 |
| Enter → 第二 rAF | 51.3 | 58.6 |

Enter 第二 rAF P50／P95 从 source17 的 79.9／144.1 ms、source18 的 99.8／110.3 ms 降至 51.3／58.6 ms；这是该设备、协议与负载下的结果，不是所有科研工程或输入法的延迟保证。95 个组件和双主题 14 项定向流程分别见[组件记录](qa/live-preview/source19-component-regressions.json)及[真实浏览器记录](qa/live-preview/source19-selection-refresh-browser.json)。

## source18 正式结果与 source17 对照

source18 按同一 v2 协议完成唯一 184 个动作（160 正式、24 预热），各操作 20 个正式样本，未删除异常值或为取得更好结果重跑。完整八行、四种指标、全部来源与样本见[正式汇总](qa/live-preview/performance-v2-final18-summary.json)及[source17 对照](qa/live-preview/performance-v2-final18-vs17.json)。下表单位均为 ms，四面板另属 3 次预热、20 次正式手势的[独立诊断](qa/live-preview/four-panel-style-final18-diagnostic.json)，不与单面板样本合并。

| 范围与指标 | source17 | source18 |
|---|---:|---:|
| 5000 图元改色：输入 → 第二 rAF P95 | 198.7 | 121.9 |
| 5000 图元选择：输入 → 第二 rAF P95 | 169.3 | 226.4 |
| 5000 图元细节 → 色板：输入 → 第二 rAF P95 | 611.1 | 632.9 |
| 5000 图元色板 → 细节：输入 → 第二 rAF P95 | 157.3 | 183.3 |
| 四面板 Enter → 第二 rAF P95 | 144.1 | 110.3 |
| 四面板 Enter → 第二 rAF P50 | 79.9 | 99.8 |
| 四面板输入 → 第二 rAF P95 | 43.0 | 54.9 |

source18 阶段改色与 Enter 尾延迟改善，但选择、完整色板和部分四面板指标退步；完整色板第二 rAF P95 约为 633 ms，四面板 Enter P95 仍超过 100 ms，不能写成该阶段全面达标。它随后触发定向诊断和 source19 的最小三行改动；不把当时退步先归因于环境或新增模块。rAF 表示呈现机会，不能替代光学像素延迟或持续 FPS。源码、78 个资源、27 个后端与 harness 的前后核对随对应报告保留，不能用 source17 或 source19 的较好指标覆盖 source18。

下文保留 source17 的独立正式测量。5000 图元的选择、改色及两个方向页签切换的 next／second-rAF P50／P95 均优于 v1.4.20 和 v1.4.21。部分 120 图元尾指标与确认后的延迟仍有回退；所有数字及媒体继续绑定 source17，不作为 source18 的测量。

## source17 正式浏览器性能

同一 Windows x64 设备、22 个逻辑 CPU、Chrome 155.0.8059.82、Node 24.18.0、1440 × 900、DPR 约 1、真实有界面 Chrome，无录屏。每规模的四种操作各 3 次预热、20 个正式样本，共 184 个动作（160 正式、24 预热）；每次至少等待 250 ms、自动保存结束及两次 rAF。期间暂停构建、其他验收 Chrome 和视频编码，没有声称关闭用户全部应用。P50／P95 用最近秩，P95 是第 19 个顺序统计量，不删除异常值。不同冻结版不合并样本，不为更好结果重跑。

指标从实际输入捕获到下一／第二次 requestAnimationFrame 回调，表示呈现机会，不是光学像素延迟或持续 FPS。颜色测量包含实际 input/change/blur，排除原生系统颜色选择器窗口。120／5000 为明确合成的矢量压力输入；每次核对原始 SVG、表格、分析指纹、操作与撤销。78 个静态资源、27 个后端来源和三个捕获脚本运行前后精确一致。

每格 **P50／P95，单位 ms**。全部四指标（含提交事件至第二 rAF、操作 wall time）、逐项差值、全部样本与来源哈希见[本批完整安全汇总](qa/live-preview/performance-v2-final17-summary.json)。

### 输入 → 下一次 rAF

| 图元 | 操作 | v1.4.20 | v1.4.21 | source17 |
|---|---|---:|---:|---:|
| 120 | 选择文字 | 29.1/37.0 | 29.0/31.7 | 22.9/28.1 |
| 120 | 快捷改色 | 40.0/61.3 | 35.6/41.1 | 17.1/21.2 |
| 120 | 细节 → 色板 | 31.7/37.3 | 30.0/33.1 | 17.1/19.4 |
| 120 | 色板 → 细节 | 26.3/37.1 | 24.0/26.3 | 10.4/17.4 |
| 5000 | 选择文字 | 151.9/213.7 | 153.8/212.5 | 81.4/94.0 |
| 5000 | 快捷改色 | 240.1/299.2 | 244.2/350.2 | 64.1/91.0 |
| 5000 | 细节 → 色板 | 430.4/497.5 | 465.8/735.7 | 303.7/375.2 |
| 5000 | 色板 → 细节 | 122.4/165.4 | 127.5/162.4 | 47.7/58.9 |

### 输入 → 第二次 rAF

| 图元 | 操作 | v1.4.20 | v1.4.21 | source17 |
|---|---|---:|---:|---:|
| 120 | 选择文字 | 48.6/59.2 | 45.6/49.8 | 42.9/52.0 |
| 120 | 快捷改色 | 76.9/111.4 | 67.3/85.2 | 51.6/59.5 |
| 120 | 细节 → 色板 | 53.5/60.2 | 48.3/52.9 | 37.5/44.1 |
| 120 | 色板 → 细节 | 46.9/59.3 | 41.5/44.1 | 30.5/51.2 |
| 5000 | 选择文字 | 243.3/358.2 | 248.8/332.9 | 155.4/169.3 |
| 5000 | 快捷改色 | 349.3/451.8 | 358.2/520.2 | 122.5/198.7 |
| 5000 | 细节 → 色板 | 689.3/742.7 | 674.5/973.4 | 509.4/611.1 |
| 5000 | 色板 → 细节 | 243.3/298.7 | 254.4/305.2 | 133.6/157.3 |

5000 图元选择 next-rAF P95 从 v20／v21 的 213.7／212.5 ms 降至 94.0 ms，改色从 299.2／350.2 ms 降至 91.0 ms；细节 → 色板为 375.2 ms，色板 → 细节为 58.9 ms。大型工程仍有可感知的八卡真实预览生成与布局成本，不能把这批结果推广为所有负载都低于 100 ms。

120 图元选择第二 rAF P95 为 52.0 ms，略高于 v21 的 49.8 ms；返回细节为 51.2 ms，高于 v21 的 44.1 ms。完整提交／wall 指标同样保留，未宣称全面零回退。CPU 频率、电源、温度未采集，不能用环境猜测解释差异。

本次只减少已确认的重复工作：稳定普通页签可复用已提交画布，所有图片／ROI、草稿、临时悬停和活动手势保留原 canonical 路径；同一新选择的按下／松开只读一次属性。八张完整 SVG 卡、科研源图、选择、锁定和历史均保留。普通纯色使用可恢复 paint，科学语义、几何及字体仍走正确完整渲染。

### 保留的失败与定位过程

[source16 正式结果](qa/live-preview/performance-v2-final16-summary.json)的选择／页签尾延迟回退完整保留，不用 source17 改写。随后仅一次 source10／16 × 两规模 × 选择／两方向页签的 12 动作 CPU 诊断，明确旧共享成本为全量画布重建、八卡布局及按下／松开重复属性读取。它每条件只采一次且含 profiler 开销，不能代替正式样本；[归因与原追踪哈希](qa/live-preview/source16-readonly-cpu-attribution.json)保留未知环境边界。source17 的[14 项真实定向验收](qa/live-preview/pane-selection-source17-summary.json)另保留滚动前未控制指针的首轮失败，修正 QA 前提后完整双主题通过。提出的缩放疑点经[5 组实际生产函数对照](qa/live-preview/pane-zoom-source17-review.json)反证，未据此增加无必要修改。

更早的[候选 9](qa/live-preview/performance-v2-summary.json)、[候选 10](qa/live-preview/performance-v2-final10-summary.json)及候选 6 退步仍各自留存，不跨轮筛选或合并。

## source17 独立四面板轻量编辑

4 × 120 明确合成 SVG 图元组成 2 × 2 工程，真实轮换文字、HEX 输入、Enter、Undo／Redo。3 次预热与 20 次正式手势均验证草稿零持久化、一次提交、撤销／重做和源工程精确不变，零外部请求／页面错误；此诊断独立于上述基线对照。

| 指标 | P50（ms） | P95（ms） |
|---|---:|---:|
| 输入 → 下一 rAF | 7.0 | 8.2 |
| 输入 → 第二 rAF | 35.1 | 43.0 |
| Enter → 下一 rAF | 30.2 | 60.1 |
| Enter → 第二 rAF | 79.9 | 144.1 |

输入预览第二 rAF P95 为 43.0 ms，低于 100 ms 的 rAF 工程参考线；本轮没有光学像素时延测量，不能据此宣布实际可见更新预算通过。Enter 确认后第二 rAF P95 为 144.1 ms，仍超过 100 ms，不将两种边界合并成全面达标。没有测得持续 60 fps 的证据。

71 个阶段采样的高水位：JS heap used 28,856,984 bytes、heap total 51,191,808 bytes、documents 16、DOM nodes 43,873、listeners 1,987，包含整 UI、缓存及可能尚未回收的对象；最终阶段降至 2 documents／11,280 nodes。它不是连续峰值、进程 RSS、GPU 内存或强制 GC 后保留量，不能据此判定泄漏。完整 timeline、长任务及帧间隔统计的原始哈希见[本批四面板摘要](qa/live-preview/four-panel-style-final17-diagnostic.json)；历史[source16](qa/live-preview/four-panel-style-final16-diagnostic.json)、[候选 9](qa/live-preview/four-panel-style-diagnostic.json)／[候选 10](qa/live-preview/four-panel-style-final10-diagnostic.json)独立保留。

可下载[实际事件时序 trace](qa/live-preview/four-panel-source17-timing-trace.json.gz)及其[逐字段保留证明](qa/live-preview/four-panel-source17-timing-trace.json.gz.manifest.json)。它保留原追踪的 102,246 个事件及顺序、名称、阶段、ID、时间戳和时长，移除全部 args 与原 metadata，排除路径、URL 和参数内容；没有补帧或新增事件。解压后为 Chrome trace JSON 结构；本轮未单独验证删参衍生文件的 DevTools 导入。它没有原线程名称、调用参数和 URL，不能代替本机未删减原追踪做源码栈定位。

## source20 Windows 成品与科学内容

[原包来源](qa/live-preview/windows-final20-package-source-match.json)和[最终安装版汇总](qa/live-preview/windows-final20-acceptance-summary.json)分别绑定真实 Setup、Portable、完整文件、已安装起始页及服务身份。Own 八套件 [108 项](qa/live-preview/windows-final20-own-summary.json)、双主题 P1 [74 项](qa/live-preview/windows-final20-p1-summary.json)、额外专业轴 [10 项](qa/live-preview/windows-final20-axis-composition-browser.json)、[60 图／1770 对后台任务及实际取消](qa/live-preview/windows-final20-duplicate-summary.json)和 [10000 图元 PDF／SVG 两项](qa/live-preview/windows-final20-large-import-summary.json)均完成，各自的有录像功能耗时不并入正式 184 动作性能样本。轴组合尾事件是合成触发，真实普通键盘与本地渲染另有断言，不冒称原生 IME 重测。

正常 [Reinstall](qa/live-preview/windows-final20-reinstall-summary.json) 与 [Uninstall](qa/live-preview/windows-final20-uninstall-summary.json) 的外层进程实际退出 0；同步 helper 检查原生返回但未独立保存其数值，不补造原生退出码。[独立最终状态](qa/live-preview/windows-final20-native-final-state.json)核对四登记视图为空、自有进程 0、EXE 已移除、1 个原实例身份未变及工程／设置／哨兵三文件精确保留；Iris 150 行、12 个原 SVG 变体不变。Setup 和原生 EXE 为 NotSigned，校验和不构成数字签名。

本次原始包不因后补报告而重打。附带文档与 bundled audit 是构建时快照，外部 `docs/*.md` 的实际变化须由第二份严格证明逐项列出两组哈希；首份证明及 ROOT／Quickstart／bundled audit／runtime 保持原字节。原 source17 结果在下节原样保留。

## source17 科研内容与 Windows 成品（历史）

源码与实际安装版的功能矩阵、科学源数据、保存／重开、导出及旧失败阶段见[实时预览报告](live-preview-validation.md)。source17 已完成 85 个组件脚本和 14 项定向浏览器流程；最终原始 Setup／Portable 已通过[全部成品来源核对](qa/live-preview/windows-final17-package-source-match.json)，[实际安装及冻结自检](qa/live-preview/windows-final17-install-stage.json)也通过。安装版 P0 72 项、P1 双主题 74 项和主功能矩阵已通过，详情见[主功能记录](qa/live-preview/windows-final17-own-functional-summary.json)及[高频操作记录](qa/live-preview/windows-final17-p1-summary.json)；[60 图后台任务](qa/live-preview/windows-final17-duplicate-summary.json)、[两项大型导入](qa/live-preview/windows-final17-large-import-summary.json)及[重装](qa/live-preview/windows-final17-reinstall-summary.json)／[卸载](qa/live-preview/windows-final17-uninstall-summary.json)保留数据也已实际通过。[最终汇总](qa/live-preview/windows-final17-acceptance-summary.json)分别绑定这些范围；这些带录像功能流程不并入正式性能样本。

成品附带 QA 文档是构建时快照；当前外部报告与源码包继续记录此安装器的实际验收和自身哈希。安装器本身未来哈希不嵌入同一安装器，避免自引用。

## 更新与发布状态

source20 原包的本机安装、编辑、重装和卸载验收已完成，尚未正式发布；真实官方 0.1.20 → 0.1.22 下载、校验、安装、自动重开与恢复待目标发布后执行。旧 0.1.20 → 0.1.21 证据或 source17 同版本重装不能替代此流程。实际条件见[更新验收说明](windows-update-real-acceptance.md)。本地构建、源码测试和未来下载链接均不构成已发布或已安装通过的证明，实际发行状态以版本发布记录为准。
