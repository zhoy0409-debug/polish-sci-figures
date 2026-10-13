# Image duplicate check: validation record

Updated 2026-10-13. This record covers the local image-comparison engine, browser workflow and Windows package checks. For the user workflow, see [Image duplicate check](image-duplicate-check.md).

## English

### v1.4.5 / Studio 0.1.5 review workflow

The following automated JavaScript checks passed on the local Windows development computer:

| Check | Verified scope |
| --- | --- |
| `node scripts/test_studio_duplicate_check.cjs` | A DOM adapter exercises source exclusions, detail-viewer handoff/closure, immutable per-keystroke reviews without replacing the textarea, project restoration, escaped reports without original payloads, layout-aware location, and cancellation/failure/project-switch handling. It passes completed records through the actual validator and verifies that 1,770 report pairs embed each of the 60 inventory thumbnails only once |
| `node scripts/test_studio_duplicate_review.cjs` | Saved-record round trip and validation, source identity after layout changes, replacement/deletion detection, mixed local/canvas pairs and bounds spanning both located images |
| `node scripts/test_studio_duplicate_viewer.cjs` | Affine inversion and crop/mirror alignment, pointer-anchored zoom, pan and relative-view synchronization, invalid-coordinate rejection, and original/mapped/thumbnail source selection |

All 48 Studio JavaScript test scripts passed. The image engine passed 11 Python test methods, HTTP/CLI integration passed 4, and project-generation checks passed 10. These cover bounded review previews in addition to the earlier detector checks.

**Studio 0.1.5 was also exercised in the actual desktop browser:** four synthetic images produced three candidate pairs; a rotated crop aligned in the overlay; wheel zoom, dragging, opacity and line toggles worked; Chinese and English controls were checked. A review decision and note survived page reload and export/reimport of the project. Changing the layout from a 2 × 2 grid to a vertical stack still located and selected both images together. Deleting the sources showed a recheck message instead of selecting other images. HTML and JSON reports were downloaded through the interface. No browser console errors were observed during these checks.

The 0.1.5 installer and the extracted portable ZIP passed isolated tests with a system-only `PATH` and invalid `PYTHONHOME`: the bundled engine performed statistics, rendering, reflow, editable PDF import and image matching. Installed-file hashes matched the package; reinstall preserved data/settings, and uninstall preserved external project data. The portable skill archive contains exactly one `SKILL.md`. These are local Windows development-machine checks, not clean-VM, Mac or mobile device validation.

The sections below retain the measured **v1.4.4 / Studio 0.1.4 baseline**. Its performance figures were not remeasured for 0.1.5.

### Functional checks (v1.4.4 baseline)

`python scripts/test_image_duplicates.py` passed all **9 test methods**, including these generated-image cases:

| Case | Observed result |
| --- | --- |
| Same decoded 8-bit pixels stored with different PNG compression | Exact duplicate |
| Resizing with JPEG quality 80, rotation by 31°, horizontal and vertical mirroring | Matching pair found for each transformation |
| Partial crop; crop combined with mirroring, resizing and JPEG compression | Overlap found, with geometric evidence |
| Crop supplied before the original image | Overlap found; correspondence is not dependent on input order in this case |
| Unrelated synthetic microscopy images; blank images; regular repeating cells | No pair reported in the negative fixtures |
| Same plot axes, labels and template with different observations | No pair reported |
| Same native 16-bit grayscale pixels in TIFF and PNG | Exact duplicate; original intensity values are retained for identity hashing |
| Different high-intensity TIFFs whose values all exceed 255 | Different hashes; no false exact duplicate caused by 8-bit clipping |
| 16-bit RGB images differing by one intensity unit | Different hashes; never classified as exact. Normalized previews can still produce a reviewable transformed candidate |
| Floating-point TIFF containing NaN | Rejected with an explanation |
| Unsupported high-depth CMYK TIFF files and multichannel TIFF stacks | Rejected before a lossy conversion can produce a false exact match; covered by the integration regressions |
| URLs, filesystem paths, SVG payloads, invalid base64, invalid image bytes, duplicate IDs and oversized inputs | Rejected by the engine |
| Multipage/animated input passed directly to the engine | Rejected instead of silently inspecting only the first frame; callers must extract frames explicitly |
| Cancellation and evidence-count/byte limits | Cancellation raises a distinct exception; all pair records remain when evidence generation reaches its limit |

The exact-match digest uses decoded pixels, not the compressed file bytes. High-depth inputs use native-depth pixels; their display/feature preview uses a separately recorded linear intensity mapping. The originals are not rewritten.

The **4 integration test methods** in `scripts/test_duplicate_integration.py` also passed. They cover local HTTP authorization, cancellation, file and SVG-layer intake, source preservation, report escaping and evidence-limit explanations. Native 16-bit CMYK frames differing only in low bits are explicitly rejected before a lossy frame extraction could produce false exact matches. Individual high-depth CMYK and unsupported Lab inputs are also rejected without returning a completed match report.

### Browser workflow (Studio 0.1.4)

The following actions were exercised in the actual browser on the current Windows development computer:

| Action | Observed result |
| --- | --- |
| Chinese interface: check the current figure | Four images, six comparisons and three reported pairs: exact duplicate, cropped overlap and rotated copy |
| Locate a reported pair | Two corresponding image markers appeared on the canvas |
| Check the selected images | The scope contained two images and one comparison |
| Switch to English | The check button and results were translated; the HTML report was downloaded through the interface |
| Add two local images through the file chooser | One comparison produced one overlap finding with 188 matching points |

### Windows package and installation (Studio 0.1.4)

The frozen executable passed its local HTTP self-test with bundled OpenCV and evidence generation. `desktop/verify_windows.ps1 -Version 0.1.4` also passed: installation completed, every installed file hash matched the package, and the self-test succeeded with an isolated `PATH` and an invalid `PYTHONHOME`. The upgrade check preserved the external project and settings; uninstalling preserved the external project.

These checks ran on the local Windows development computer, not a clean virtual machine. This feature was not tested inside the actual Claude client; the browser and packaged-runtime results do not establish host-client compatibility.

### Maximum-batch measurement (v1.4.4 baseline)

The benchmark compared **60 distinct 480 × 360 synthetic microscopy-like images**, generated with deterministic seeds 700–759. Their encoded input total was 24,768,300 bytes. This was a real local run on the current Windows development computer, with Python 3.12.14 and OpenCV 4.11.0. OpenCV native parallelism was capped at two threads; the host exposes 22 logical processors.

| Measurement | Observed value |
| --- | ---: |
| Compared image pairs | 1,770 |
| Reported matches among these distinct fixtures | 0 |
| Engine scan time | 31.0649 s |
| Process working set after preparing the input | 76,627,968 bytes |
| Process lifetime peak working set after the scan | 282,943,488 bytes, approximately 269.8 MiB |
| Process private committed memory before / after the scan | 767,848,448 / 780,533,760 bytes |
| Cancellation latency after a request during pair comparison | 5.551 ms |

Memory was measured with Windows `GetProcessMemoryInfo`, including native OpenCV/NumPy memory. The peak working-set figure belongs to the whole benchmark process, including input preparation, and is not a Python-allocation estimate. Private committed memory is reported separately from resident working-set memory.

For the cancellation measurement, another thread requested cancellation 10 ms after pair comparison began. The engine stopped after one completed pair and raised `ScanCancelled`; it did not return an incomplete report as a completed scan. Cancellation is checked between image/feature operations and pair operations; the measured latency is not a maximum guaranteed for every image.

The development run's machine-readable record is `.cache/image-duplicate-demo/benchmark.json`. It is a local validation artifact, not a required runtime file.

### Operating limits and remaining scope

- At most 60 images, 40,000,000 encoded bytes per batch, 12,000,000 source-file bytes per embedded image and 20 megapixels per image.
- Feature analysis downsamples to a maximum side of 900 pixels and caps SIFT at 1,400 features. OpenCV uses at most two native threads.
- Evidence images are capped at 120 and 15,000,000 encoded bytes combined. Pair records remain available beyond these limits; rerun a smaller batch to obtain omitted evidence.
- Studio 0.1.5 adds a separate 12,000,000-byte encoded review-preview budget, with a maximum side of 900 pixels and a labeled thumbnail fallback. Project import/export has a 200,000,000-byte limit per file; this does not raise the screening batch limits.
- These checks use synthetic examples. They are not a measured sensitivity/specificity study on a representative scientific-image corpus.
- This was not a clean virtual machine, a CPU-throttled benchmark or a test on separate low-end hardware. It does not establish minimum system requirements or cross-platform performance.
- Very small crops, severely altered images, feature-poor or repetitive structures and copying inside a single image can be missed. Matching structures can also occur in legitimate related channels or shared controls. Results require source-image review.

---

## 中文

### v1.4.5 / Studio 0.1.5 复核流程

以下 JavaScript 自动化检查已在本机 Windows 开发电脑通过：

| 检查 | 已验证范围 |
| --- | --- |
| `node scripts/test_studio_duplicate_check.cjs` | 使用 DOM 适配器验证图片勾选排除、详情查看器参数传递与关闭、逐次输入产生独立复核记录且不替换文本框、工程恢复、报告转义且不包含原始图片载荷、布局改变后的定位，以及取消／失败／切换工程处理；完成记录经过实际验证器，并验证含 1,770 对结果的报告仅为 60 张图片各嵌入一次清单缩略图 |
| `node scripts/test_studio_duplicate_review.cjs` | 保存记录的序列化与校验、布局改变后的原图身份匹配、更换／删除检测、本地文件与画布图片混合配对，以及同时涵盖两张定位图片的边界计算 |
| `node scripts/test_studio_duplicate_viewer.cjs` | 仿射逆变换、裁剪／翻转对齐、以指针为中心的缩放、平移与相对视野同步、无效坐标拒绝，以及原图／映射预览／缩略图选择 |

全部 48 个 Studio JavaScript 测试脚本通过；图片引擎 11 项 Python 测试、HTTP/CLI 集成 4 项、工程生成 10 项测试通过。除既有检测用例外，也覆盖有容量上限的详情预览。

**Studio 0.1.5 已在实际桌面浏览器中操作验证：**4 张合成图片检出 3 对候选；旋转裁剪图在叠加视图中正确对齐；滚轮缩放、拖动平移、透明度和连线开关可用，并核对了中英文界面。复核结论与备注在刷新页面、导出并重新导入工程后保留。由 2 × 2 改为纵向布局后，仍能同时定位并选中两张图片；删除原图后提示重新检查，不误选其他图片。通过界面下载了 HTML 和 JSON 报告。上述检查中未观察到浏览器控制台错误。

0.1.5 安装版及实际解压的便携 ZIP 均在仅有系统路径的 `PATH`、无效 `PYTHONHOME` 下通过隔离自检，随包引擎完成统计、绘图、尺寸重排、可编辑 PDF 导入和图片匹配。安装文件哈希与包内一致；重装保留数据和设置，卸载保留外部工程。自包含技能 ZIP 只有一个 `SKILL.md`。这些是本机 Windows 开发电脑检查，不是干净虚拟机、Mac 或移动设备验证。

下文保留 **v1.4.4 / Studio 0.1.4 的既有基线实测**；其中的性能数字未在 0.1.5 中重新测量。

### 功能验证（v1.4.4 基线）

`python scripts/test_image_duplicates.py` 的 **9 项测试全部通过**，覆盖以下合成图片情形：

| 情形 | 实际结果 |
| --- | --- |
| 相同 8 位像素，以不同 PNG 压缩参数保存 | 检出完全重复 |
| 缩放并以 JPEG 质量 80 保存、旋转 31°、水平及垂直翻转 | 各种变换均检出匹配 |
| 局部裁剪，以及裁剪叠加翻转、缩放和 JPEG 压缩 | 检出重叠，并生成几何匹配证据 |
| 先提供裁剪图，再提供原图 | 仍检出重叠；该用例不依赖输入顺序 |
| 无关的合成显微图、空白图、规则重复细胞纹理 | 这些阴性用例未报告匹配 |
| 坐标轴、标签和模板相同，但数据点不同 | 未报告匹配 |
| 相同原始 16 位灰度像素分别保存为 TIFF、PNG | 检出完全重复；身份哈希保留原始强度值 |
| 两张不同 TIFF，像素值均大于 255 | 哈希不同，没有因转成 8 位后截断而误判完全重复 |
| 两张 16 位 RGB 图片只相差一个强度单位 | 哈希不同，不归为完全重复；归一化预览仍可能形成需复核的变换匹配 |
| 浮点 TIFF 含 NaN | 拒绝检查并说明原因 |
| 不支持的高位深 CMYK TIFF 及多通道 TIFF 图像栈 | 在有损转换前明确拒绝，避免误判完全重复；已纳入集成回归测试 |
| 网址、路径、SVG 数据、无效 base64、损坏图片、重复 ID、超限输入 | 检测引擎拒绝接收 |
| 直接向引擎传入多页或动画图片 | 明确拒绝，不会只检查第一帧；调用方须先逐帧提取 |
| 取消检查、证据图数量及体积上限 | 取消有独立状态；证据达到上限后仍保留全部匹配记录 |

完全重复的身份判断基于解码后的像素，不比较压缩文件字节。高位深图片保留原始位深参与身份判断，显示及特征分析使用单独记录的线性强度映射，不改写原图。

`scripts/test_duplicate_integration.py` 的 **4 项集成测试也已通过**，覆盖本机 HTTP 授权、取消、文件及 SVG 图层提取、原图保留、报告字符转义和证据上限说明。对仅低位强度不同的原生 16 位 CMYK 多帧图片，在可能丢失位深的帧提取之前明确拒绝，避免误判为完全重复。单张高位深 CMYK 及不支持的 Lab 输入也会拒绝检查，不返回完成的匹配报告。

### 浏览器实际操作（Studio 0.1.4）

以下操作在当前 Windows 开发电脑的真实浏览器中完成：

| 操作 | 实际结果 |
| --- | --- |
| 中文界面检查当前组图 | 4 张图片、6 对比较，检出 3 组：完全重复、裁剪重叠、旋转重复 |
| 定位一组匹配图片 | 画布中出现对应的 2 个图片定位标记 |
| 只检查已选图片 | 检查范围为 2 张图片、1 对比较 |
| 切换英文界面 | 查重按钮和结果随语言切换，并通过界面实际下载 HTML 报告 |
| 通过文件选择器添加 2 张本地图片 | 1 对比较检出 1 组重叠，显示 188 个匹配点 |

### Windows 安装包验证（Studio 0.1.4）

冻结后的可执行程序使用随包提供的 OpenCV，通过本机 HTTP 自检并生成匹配证据。`desktop/verify_windows.ps1 -Version 0.1.4` 验证通过：安装完成，全部已安装文件的哈希与安装包一致；在隔离 `PATH`、设置无效 `PYTHONHOME` 后仍通过自检。升级保留外部工程和设置，卸载保留外部工程。

这些检查在本机 Windows 开发电脑完成，未使用干净虚拟机。本功能尚未在真实 Claude 客户端内测试；浏览器和打包运行环境的验证不等同于完成宿主客户端适配测试。

### 最大批次实测（v1.4.4 基线）

本次实际比较了 **60 张不同的 480 × 360 合成显微图片**，固定生成种子为 700–759，编码后输入共 24,768,300 字节。在当前 Windows 开发电脑运行，Python 3.12.14、OpenCV 4.11.0；OpenCV 内部最多使用两个线程，电脑可见 22 个逻辑处理器。

| 指标 | 实测值 |
| --- | ---: |
| 比较图片对数 | 1,770 |
| 这批不同图片检出的匹配 | 0 |
| 检测引擎耗时 | 31.0649 秒 |
| 输入准备完成后的进程工作集 | 76,627,968 字节 |
| 检查后记录的进程峰值工作集 | 282,943,488 字节，约 269.8 MiB |
| 检查前／后的进程私有提交内存 | 767,848,448／780,533,760 字节 |
| 比较中发出取消请求后的停止延迟 | 5.551 毫秒 |

内存通过 Windows `GetProcessMemoryInfo` 读取，包含 OpenCV、NumPy 的原生内存。峰值工作集是整个测试进程的记录，包含输入准备阶段，并非仅统计 Python 对象分配。私有提交内存与驻留工作集分开报告。

取消测试由另一个线程在开始逐对比较 10 毫秒后发出请求。引擎在完成一对比较后停止并抛出 `ScanCancelled`，没有把未完成结果当作完成报告返回。取消检查点位于图片／特征处理和逐对比较操作之间；上述延迟是本次测量值，不是所有输入情况下的最长保证。

本机保留了可机读记录 `.cache/image-duplicate-demo/benchmark.json`。它是开发验证材料，运行功能不依赖该文件。

### 运行上限与未覆盖范围

- 每批最多 60 张图片、编码后最多 40,000,000 字节；每张图片解码前的文件数据最多 12,000,000 字节、最多 2000 万像素。
- 特征分析最长边缩至 900 像素，SIFT 最多 1,400 个特征，OpenCV 内部最多两个线程。
- 证据图最多 120 张，编码后总体积最多 15,000,000 字节；超出部分仍保留匹配记录，可缩小批次重新生成证据。
- Studio 0.1.5 新增独立的详情预览容量：编码后最多 12,000,000 字节，最长边不超过 900 像素，缺少较大预览时使用有标识的缩略图。单个工程文件导入／导出上限为 200,000,000 字节，不改变查重批次本身的容量上限。
- 用例为合成图片，不能据此宣称在代表性科研图片集上已测得灵敏度或特异度。
- 本次不是干净虚拟机、限速 CPU 或另一台低配置电脑的测试，因此不据此宣称最低硬件要求或跨平台性能已完成验证。
- 很小的裁剪、严重修改、特征不足或高度重复的结构，以及单张图片内部的复制，可能漏检。合法的关联通道或共享对照也可能具有匹配结构，结果需要结合原图复核。
