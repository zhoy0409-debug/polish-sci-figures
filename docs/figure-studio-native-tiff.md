---
author: a
created: 2026-10-28
---

# 原生 TIFF 与显示图 / Native TIFF and display images

本页对应下一 Windows 稳定版的源码候选，尚未代表正式安装版已验收或发布。当前正式版仍为 0.1.26。[本轮验收范围](windows-next-stable-audit.md)。

## 中文操作

1. 启动具有本机数据服务的 Figure Studio。点击 **导入文件**，或把 `.tif` / `.tiff` 拖到画布。处理在本机完成，不调用文献或云端服务。
2. 右侧出现 **原生 TIFF 显示**。选择实际 TIFF 页；可核实的单文件 OME 平面显示 C/Z/T 位置，没有映射的信息明确标为未知。
3. 默认采用位深的完整范围。需要时点击 **一键建议显示窗**，再微调原生强度下限、上限、伽马和灰度／绿色／洋红／青色 LUT。彩色 RGB 图保留原 RGB 通道，不提供伪彩色 LUT。建议范围取所选平面的实际全图最小值和最大值，不改变原始测量值。
4. 修改直接在画布预览。预览最长边为 1024 像素；**保留时的显示分辨率**默认是原始像素尺寸，也可明确选择最长边 2048 的重采样显示。点击 **保留并导入** 写入工程，一次撤销；点击 **取消** 恢复原工程。预览期间保存不会保存尚未保留的图片。
5. 导入后，图片说明区显示原生位深和页码。点击 **下载原始 TIFF** 可取回逐字节相同的原文件。工程保存原始 TIFF 一份，以及所选平面的 8 位显示 PNG、显示参数、原生样本和文件校验记录。多个显示平面共用同一原文件。

比较同批荧光或条带强弱时，请使用一致的显示窗、伽马和 LUT。逐图建议范围不能用于证明组间信号差异。原生 TIFF 用于保留与后续分析；画布中的显示 PNG 不作为密度定量输入。打印 DPI 不等于显微标定，不自动生成比例尺；明确重采样后，还需按显示像素与原生像素的比例核对标尺。

原生显示窗目前在导入预览中调整。保留后仍可使用原有的图片颜色、比例尺和排版工具；尚无保留后重新编辑原生显示窗的专门入口。不要把普通显示颜色调整解释为重新读取原生强度。

## 支持范围

- 无符号 8/16 位单通道 MINISBLACK、8 位连续 RGB；常规 TIFF 与经过结构核对的单系列、单文件 OME-TIFF。OME 映射支持明确的非默认顺序和部分映射；没有映射的页不猜测 C/Z/T。此核对不等于完整 OME schema 或采集记录认证。
- 每文件最多 64 MB、每页 3200 万像素／最长边 32768、最多 128 页；工程中原生 TIFF 总计最多 80 MB。显示 PNG 最多 20 MB；超限时可明确选择较低显示分辨率，原始文件仍完整保留。JSON 工程仍为 200 MB 上限。
- 有符号／浮点、16 位 RGB、透明通道、CMYK、白为零、带旋转标签、SubIFD／金字塔、多系列或依赖其他文件的 OME 均明确拒绝。拒绝不会覆盖原图或当前工程。其他格式继续使用原有导入入口。
- RGB 显示保留可读取的原始 ICC 配置；显示调整使用全图统一公式。后端以条带计算同一全图参数，条带之间不会分别归一化。

原始 TIFF 只上传一次到受令牌和来源检查保护的本机接口，预览后续只传短期本机会话 ID 和显示参数。后端最多缓存两个原始文件／128 MB，关闭时释放，闲置会话在后续请求时按 30 分钟期限清理；不写临时原图到磁盘。断网不影响本机导入。以文件直接打开的静态 HTML 不具备 TIFF 解码服务，会给出提示。

## English workflow

This is an unreleased Windows source candidate. Import a `.tif` or `.tiff` using **Import files** or a canvas drop while the local engine is running. In **Native TIFF display**, select a real page, inspect verified OME C/Z/T coordinates where available, and adjust the native-unit window, gamma and display LUT. **Suggest display window** reads the actual global minimum and maximum of the selected plane. Use the same settings for comparable images; individually suggested ranges do not establish relative signal strength.

Adjustments preview on the real canvas at a 1024-pixel maximum edge. **Keep & import** generates the chosen native-size or explicitly resampled 2048-edge display and creates one undo record. **Cancel** preserves the existing project, including its history. Saving during preview excludes the draft. Download the exact original TIFF from the source information section after importing. The project stores each original once, with per-display provenance and SHA-256 checks; reopening verifies retained file and display bytes.

The original retains its bit depth. The canvas uses an 8-bit display PNG, which is not a quantitative measurement source. Print DPI is not microscopy calibration. Resampling is explicit and requires an appropriate display-to-native calibration conversion before adding a scale bar. Native-window editing is currently available during import; the existing post-import image tools remain available, but do not reopen the native intensity window.

Supported: unsigned 8/16-bit scalar MINISBLACK and contiguous RGB8; bounded ordinary TIFF and structurally checked single-series, single-file OME mapping. Limits are 64 MB/file, 32 MP/page, 128 pages, 80 MB of native files/project, 20 MB/display PNG and 200 MB/project JSON. Unsupported signed/float, RGB16, alpha, CMYK, white-is-zero, rotated, pyramidal/SubIFD, multi-series and externally referenced OME files are refused explicitly. Original bytes never leave the protected loopback endpoint. Full OME schema certification and native installed-app acceptance remain outside the checks completed here.

## 大工程保存 / Large-project saves

工程 JSON 编码和文件解析在本地 Worker 中完成，保存时可继续编辑。下载的是点击保存时的快照；之后的编辑仍显示为尚未下载，切换到新工程也不会错误地标为已保存。数据和显示图的校验、历史验证、打开工程前的替换确认继续保留。后台处理减少主线程卡顿，未承诺下载总时间必然缩短。旧浏览器缺少 Worker 时只允许有限的小文件兼容处理，大文件会提示使用当前 Edge／Chrome。

Project JSON encoding and parsing use a local Worker. Save captures the project at the time of the click; subsequent edits and newly opened projects remain unsaved. Source integrity, history validation and replacement confirmation remain required. Reduced main-thread interruption does not imply shorter total download time.

OME mapping follows the [official OME-TIFF specification](https://docs.openmicroscopy.org/ome-model/6.2.2/ome-tiff/specification.html). Engineering evidence and its limits are recorded in the [acceptance audit](windows-next-stable-audit.md).
