# Windows 受限资源测试

[English](windows-resource-benchmark.en.md)

测试日期：2026-10-12。以下是实际发布 EXE 与修改后源码的本机测试，不是物理低配电脑认证，也不包含浏览器界面的帧率或交互延迟。

## 环境和限制

- 主机：Intel Core Ultra 7 155H，22 个逻辑 CPU，31.47 GiB 物理内存。
- 基线：已发行 `polish-sci-figures-Studio-0.1.0-Portable-x64.zip` 的独立解压副本；ZIP SHA-256 为 `f8381d0abd6562f06f7572a801bd0003e8e610369fc743f3770efef6c5d6de06`。
- EXE SHA-256：`fe24eeaaaa7ceebfc7deb5a46e1a563fe89d3aacc7fa0d067d3e504ccb15f6a8`。
- 受限档：Windows Job Object 将测试进程及其子进程限定在逻辑 CPU 0、1，作业提交内存上限为 2 GiB。未修改全机设置或已有编辑器进程。
- 每档使用新进程和新的应用数据、字体缓存目录。没有清空操作系统磁盘缓存，因此记录的是首次应用启动，不能称为严格磁盘冷启动。
- 工作集每 50 ms 采样；提交内存峰值来自 Windows Job Object 的高水位计数。浏览器和测量客户端不计入作业内存。

## 实际执行

每档处理相同的 20 个代表模板，包括雨云图、分面比较、热图、ROC、PCA、火山图、森林图、剂量反应、时间序列、UpSet、流向图、生存图、GSEA、SHAP、STL、路径结果、曼哈顿图、分布图与交互曲面。输入均为明确标记的合成模板数据。

每个模板均执行真实 HTTP 生成、修改合成数据后的重新生成、输入哈希与 SVG 内容校验。支持精确重绘的 10 个模板另执行 480 × 320 pt 重绘；其余模板明确返回“不支持精确重绘”，保留已有尺寸变体和比例显示边界，没有将其计入重绘成功数。每档另计算同一数据的 Welch 比较及 Holm 校正。

| 指标 | 发布 EXE，无资源上限 | 发布 EXE，2 CPU / 2 GiB | 修改后源码，2 CPU / 2 GiB |
| --- | ---: | ---: | ---: |
| 服务及目录数据就绪 / s | 0.864 | 0.600 | 0.573 |
| 模板生成耗时中位数 / s | 1.487 | 1.244 | 1.563 |
| 模板生成最大耗时 / s | 6.291 | 4.633 | 4.614 |
| 替换数据耗时中位数 / s | 1.365 | 1.227 | 1.501 |
| 支持的精确重绘耗时中位数 / s | 0.229 | 0.179 | 0.235 |
| 作业提交内存峰值 / MiB | 1652.02 | 1649.58 | 299.44 |
| 采样工作集峰值 / MiB | 297.62 | 284.11 | 284.14 |

这是一轮顺序测量，运行期间存在系统负载波动，不能据此宣称修改提高了运行速度。明确观察到的收益是：受限档提交内存峰值减少约 **81.85%**，物理工作集基本不变。

原因是数值库按较多 CPU 初始化线程及缓冲区。修改后的启动器在导入数值库前，仅为当前应用设置 `OPENBLAS_NUM_THREADS`、`MKL_NUM_THREADS`、`OMP_NUM_THREADS`、`NUMEXPR_NUM_THREADS` 的缺省值 `1`；保留用户显式环境设置。相同发布 EXE 的独立环境变量对照也复现了内存下降。

三个档位全部通过 20 次生成、20 次数据替换和 10 次支持的精确重绘。20 个模板原始与修改后的 40 个 SVG 图形摘要完全一致；输入表格及完整 Welch/Holm 分析记录也一致。绘图摘要归一化了随机 SVG ID，但保留路径、图形属性和显示文字，因此该检查并非只判断请求成功。

## 0.1.1 冻结程序复验

完整重新冻结后的 `polish-sci-figures-Studio-0.1.1-Portable-x64.zip` 已完成独立受限复验。ZIP SHA-256 为 `5a8f60b04dea5318de5637e0c275dad7f2f942efa745e4924a758ee51f1eb410`；EXE SHA-256 为 `33c62e5f2bef8bc26cb344b309a1be8b89c9c489bb28b2a6f22092fdd7185815`。

测试使用新的应用目录、专属端口 19831 和相同的 2 CPU / 2 GiB Job Object。未指定 `--math-threads`，继承环境中的四项数值线程变量均未设置，因此验收使用的是冻结程序自身的默认行为。

| 模板 | 生成 / s | 替换数据 / s | 480 × 320 pt 重绘 / s |
| --- | ---: | ---: | ---: |
| 雨云图 | 4.849 | 2.433 | 0.107 |
| 聚类热图 | 3.198 | 3.016 | 0.419 |
| PCA 与载荷、边缘分布 | 1.823 | 1.733 | 0.244 |

服务及目录数据在 0.773 s 就绪；作业提交内存峰值为 **232.95 MiB**，采样工作集峰值为 212.21 MiB。3 次生成、3 次替换数据和 3 次精确重绘全部通过；六个原始/修改后图形摘要、输入数据哈希与 0.1.0 一致。完整 Welch/Holm 分析结果、分析配置和数据哈希也一致，比较仅排除了接口响应中的耗时字段。

这次三模板复验确认了内存修复已经进入实际冻结程序；范围不同于前述 20 模板测试，因此不将其与 20 模板峰值计算新的改善百分比，也不据单轮耗时宣称提速。记录位于 `.cache/resource-benchmark-frozen-0.1.1/summary.json` 和同目录的 `comparison.json`。

## 复现

在 Windows、已安装项目测试依赖的 Python 环境中执行。输出目录必须尚不存在，避免复用旧应用缓存：

```powershell
python desktop/benchmark_resources_windows.py --archive dist/desktop/polish-sci-figures-Studio-0.1.0-Portable-x64.zip --outdir .cache/resource-release-new --mode both
python desktop/benchmark_resources_windows.py --source --outdir .cache/resource-source-new --mode limited
python desktop/benchmark_resources_windows.py --archive dist/desktop/polish-sci-figures-Studio-0.1.1-Portable-x64.zip --outdir .cache/resource-frozen-new --mode limited --cases compare_raincloud clustered_matrix pca_loadings --port 19831
python desktop/test_resource_job_windows.py -v
python desktop/test_figure_studio_app.py -v
```

可选 `--math-threads 1` 仅改变测试子进程的数值线程设置；`--cases` 可限定代表模板，`--port` 可为测试应用指定独立的本机端口。脚本通过 `--no-open` 禁止自动打开浏览器，使用隐藏启动窗口，并在结束时关闭专属 Job Object。资源控制专项测试验证了父子进程的 2 CPU 亲和性、归属及关闭清理；启动器 8 项回归通过。

本轮 20 模板原始记录位于 `.cache/resource-benchmark-final-release/summary.json`、`.cache/resource-benchmark-final-source/summary.json` 和 `.cache/resource-benchmark-comparison.json`。报告记录合成测试输入标识与测量结果；测试目录另外保留独立应用副本和隔离缓存，没有使用实际用户数据。修改涉及启动器本身，0.1.1 已完成完整重新冻结及上述 EXE 复验。
