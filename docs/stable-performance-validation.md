# v1.4.22 大型工程性能与 Windows 本地候选验收

source17 已完成独立正式测量。5000 图元的选择、改色及两个方向页签切换的 next／second-rAF P50／P95 均优于 v1.4.20 和 v1.4.21。部分 120 图元尾指标与确认后的延迟仍有回退，下文保留所有结果。当前是 Suite v1.4.22／Studio 0.1.22 本地候选；用户要求暂不发布，本轮没有远端合并、推送或发行。

## 正式浏览器性能

同一 Windows x64 设备、22 个逻辑 CPU、Chrome 155.0.8059.82、Node 24.18.0、1440 × 900、DPR 约 1、真实有界面 Chrome，无录屏。每规模的四种操作各 3 次预热、20 个正式样本，共 184 个动作（160 正式、24 预热）；每次至少等待 250 ms、自动保存结束及两次 rAF。期间暂停构建、其他验收 Chrome 和视频编码，没有声称关闭用户全部应用。P50／P95 用最近秩，P95 是第 19 个顺序统计量，不删除异常值。不同冻结版不合并样本，不为更好结果重跑。

指标从实际输入捕获到下一／第二次 requestAnimationFrame 回调，表示呈现机会，不是光学像素延迟或持续 FPS。颜色测量包含实际 input/change/blur，排除原生系统颜色选择器窗口。120／5000 为明确合成的矢量压力输入；每次核对原始 SVG、表格、分析指纹、操作与撤销。78 个静态资源、27 个后端来源和三个捕获脚本运行前后精确一致。

每格 **P50／P95，单位 ms**。全部四指标（含提交事件至第二 rAF、操作 wall time）、逐项差值、全部样本与来源哈希见[本批完整安全汇总](qa/live-preview/performance-v2-final17-summary.json)。

### 输入 → 下一次 rAF

| 图元 | 操作 | v1.4.20 | v1.4.21 | 当前 source17 |
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

| 图元 | 操作 | v1.4.20 | v1.4.21 | 当前 source17 |
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

## 独立四面板轻量编辑

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

## 科研内容与 Windows 成品

源码与实际安装版的功能矩阵、科学源数据、保存／重开、导出及旧失败阶段见[实时预览报告](live-preview-validation.md)。source17 已完成 85 个组件脚本和 14 项定向浏览器流程；最终原始 Setup／Portable 已通过[全部成品来源核对](qa/live-preview/windows-final17-package-source-match.json)，[实际安装及冻结自检](qa/live-preview/windows-final17-install-stage.json)也通过。安装版 P0 72 项、P1 双主题 74 项和主功能矩阵已通过，详情见[主功能记录](qa/live-preview/windows-final17-own-functional-summary.json)及[高频操作记录](qa/live-preview/windows-final17-p1-summary.json)；[60 图后台任务](qa/live-preview/windows-final17-duplicate-summary.json)、[两项大型导入](qa/live-preview/windows-final17-large-import-summary.json)及[重装](qa/live-preview/windows-final17-reinstall-summary.json)／[卸载](qa/live-preview/windows-final17-uninstall-summary.json)保留数据也已实际通过。[最终汇总](qa/live-preview/windows-final17-acceptance-summary.json)分别绑定这些范围；这些带录像功能流程不并入正式性能样本。

成品附带 QA 文档是构建时快照；当前外部报告与源码包继续记录此安装器的实际验收和自身哈希。安装器本身未来哈希不嵌入同一安装器，避免自引用。

## 更新与发布状态

新官方版本下载 → 校验 → 安装 → 自动重开／恢复仍未执行。发布暂停时没有已公开的新目标，旧 0.1.20 → 0.1.21 证据或本轮同版本重装不能替代此流程。已有本机审计及独立验收脚本的真实执行条件见[更新验收说明](windows-update-real-acceptance.md)。本地构建和安装验收不会创建新版 Release；发布暂停解除前不改变公开渠道。
