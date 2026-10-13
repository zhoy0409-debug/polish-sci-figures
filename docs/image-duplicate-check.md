# Image duplicate check / 图片查重

[Home](../README.md) · [English](#image-duplicate-check) · [中文](#中文)

## Image duplicate check

**Check whether an image was used twice, without taking your figure apart.**

Figure Studio screens image pairs locally and shows the evidence for review. Use it before exporting a microscopy figure, when combining panels from several experiments, or when checking a folder of source images. The same engine is available to the AI skills and command line.

### In Figure Studio

1. Choose **Check images** in the toolbar above the canvas, then choose **Current figure**, **Selected images or panels**, or **Local files only**. Panel groups can stay intact; the check reads their visible embedded raster image layers. **Add local images** can also add source images to the current figure or selection batch without changing the canvas.
2. Review the source checklist and uncheck images you do not want to compare, then choose **Start check**. Each batch must contain **2–60 images** after embedded images are extracted. Several images in one SVG count separately; a flattened montage counts as one image. You can cancel while the check runs.
3. Click a pair's evidence or **View details**. Use the wheel to zoom and drag to pan; **Sync zoom & pan** keeps the two relative fields of view together. Toggle matching lines when they obscure a structure. **Aligned overlay** places B over A using the recorded matching transform, including rotation, mirroring and crop offset. Adjust opacity, view A or B alone, or use **Hold to view B** for a temporary comparison. Records without valid alignment coordinates remain available side by side.
4. Use **Locate this pair** to bring both canvas images into view. A pair containing one local file offers **Locate canvas image**. Moving or resizing panels does not invalidate location; replaced or removed source images produce a recheck message. The saved evidence remains available.
5. Set **Review status** to **Pending review**, **Legitimate reuse** or **Needs replacement**, and add a note of up to 2,000 characters. These are your review decisions. Status and notes are kept with the project and restored when it is reopened. A cancelled or failed replacement scan leaves the last completed record intact.
6. Download the HTML report, JSON record, or individual evidence images. Reports include review decisions and notes; original source files are not embedded in the exported HTML/JSON report. The editor names its report `figure-studio-image-check.html`; evidence images are named `figure-studio-image-match-N.png`. Screening does not change the figure or delete any images.

The detail viewer loads original PNG, JPEG, WebP or BMP sources for the active pair when the browser can display them. TIFF and high-bit-depth images use a checking preview with a maximum side of 900 pixels; high-depth intensity mapping is recorded and leaves native source pixels unchanged. If the combined 12,000,000-byte encoded review-preview budget is reached, the viewer can fall back to a labeled, lower-resolution thumbnail. Zooming a preview cannot recover absent detail; use the original scientific-image file when examining native intensity values.

Project files retain the checked source images once so that local-file evidence can be reopened and canvas sources can be validated. Project import/export accepts up to **200 MB (200,000,000 bytes)** per file; split a larger project before saving. Downloaded review reports contain the evidence and decisions, while the project carries the original sources needed to continue editing and review.

The check compares the underlying raster source, including parts hidden by a canvas crop; it does not compare only the visible cropped area. Review the crop and source together when interpreting a match. External image URLs are not loaded; embed the image or add its local file.

The installed desktop application runs the screening service locally. For a separately generated Studio HTML page, start it through the suite so the local engine is available:

```bash
python sci_figures.py studio-serve figure-studio.html
```

### With the AI skill or command line

In Codex or Claude, select the skill, provide the images and ask:

> Check whether I accidentally used any image twice. Show matching evidence and keep a report. Do not change the originals.

The complete suite also provides a direct command:

```bash
python sci_figures.py duplicates image-a.png image-b.tif figure.svg --out image-check
```

Run it from the extracted suite directory with the suite's Python dependencies installed. In the single-entry skill upload package, use `python suite/sci_figures.py ...` from the skill directory instead. Choose a new output folder separate from the original image files; an existing folder is refused to avoid overwriting a previous report.

The CLI report folder contains `report.html` (a self-contained report with English and Chinese text), `report.json`, `matches.csv`, and generated evidence images such as `evidence-001.png`. Open the HTML to review the findings or retain the JSON/CSV with your analysis records. Evidence generation is limited to the first 120 flagged pairs and a total encoded preview size of 15 MB (15,000,000 bytes). If either limit is reached, the report retains the remaining pairs and notes the omitted evidence images; check those pairs in a smaller batch for evidence output.

The desktop/CLI check runs on the machine running the program and does not upload images to a separate screening service. When a skill runs in a cloud AI environment, its computation and files are in that host's environment; its data-handling rules still apply.

### What is checked

| Input or change | Scope |
| --- | --- |
| PNG, JPEG, TIFF, WebP and BMP files | Pairwise image comparison; the CLI extracts supported TIFF frames separately. In the editor, import each frame as a separate image; multipage/animated files are rejected rather than silently reduced to one frame |
| Raster images embedded in an SVG or an editor panel group | Individual embedded images are compared without dismantling the artwork |
| PDF input | The CLI does not accept PDFs directly; raster layers already imported into the editor can be checked |
| Exact duplicates | Reported separately from suspected overlap |
| Rotation, mirroring, resizing and partial crops | Screened for matching structures and geometrically consistent overlap |
| Vector axes, labels, bars and other chart glyphs | Not treated as image candidates |
| A flattened screenshot containing several panels | Treated as one image; supply the separate panels for cross-panel screening |
| Copying a region elsewhere inside the same image | Not covered by this cross-image check |

For multichannel high-bit-depth TIFF stacks, export each frame as a separate native-depth TIFF/PNG before checking; unsupported extraction is rejected to avoid losing scientific pixel values. High-depth CMYK, Lab and other unsupported TIFF color layouts are rejected for both individual images and stacks; export the original channels separately as native-depth grayscale TIFF/PNG. Supported high-bit-depth images retain native pixels for exact identity; their evidence preview uses a recorded intensity mapping.

Small, feature-poor, heavily altered or repetitive images may not provide reliable matching evidence. Retain any skipped-image messages in the report. Each image is limited to 20 megapixels; oversized inputs or batches show a limit message rather than silently checking only part of a selection. The batch limit applies to the extracted raster images, not merely the number of selected files. If you check a larger collection in separate batches, record the grouping: pairs in different batches have not been compared.

### How to review a result

An **exact duplicate** identifies matching image content; a **suspected overlap** identifies a pair worth checking against the source files. A similarity or matching score is not the probability of misconduct. Compare the marked structures, original field of view, channel, sample identity and acquisition record. Related channels, shared controls and intentionally reused reference images can match for legitimate reasons.

Keep the result as an image QA record. A report with no detected matches does not certify that an image is unique or that all possible duplication has been excluded. Source files and scientific context determine how a finding should be handled.

---

## 中文

**看看有没有把同一张图片放了两次，不必先拆开组图。**

Figure Studio 在本机逐对比较图片，并展示匹配证据供复核。可以在导出显微组图前检查，也可以在整合不同实验的小图时，或整理原始图片批次时使用。AI 技能与命令行使用同一套检测引擎。

### 在 Figure Studio 中使用

1. 在画布上方工具栏点击 **图片查重**，选择 **当前组图**、**已选图片或小图** 或 **仅本地文件**。无需拆散小图编组，程序会读取其中可见的嵌入式栅格图片图层。也可以通过 **添加本地图片**，把原图加入当前组图或选区的检查批次，不会改变画布。
2. 查看图片清单，取消勾选无需比较的图片，再点击 **开始检查**。每批须包含 **2–60 张图片**，按实际提取出的图片数量计算。同一个 SVG 内的多张图片分别计数；已合并成一张图片的组图只算一张。检查过程中可以取消。
3. 点击图片对的证据或 **查看详情**。滚轮缩放、拖动平移；启用 **同步缩放与平移** 可同步两侧的相对视野。匹配连线遮挡结构时可关闭。**对齐叠加** 按已记录的匹配变换将 B 对齐到 A，包含旋转、翻转和裁剪偏移；可拖动透明度、单看 A 或 B，也可 **按住看 B** 临时比较。缺少有效对齐坐标的记录仍可并排查看。
4. 点击 **定位这两张图**，将画布中的两张图片一起带入视野。如果其中一张来自本地文件，则显示 **定位画布中的图片**。移动或调整小图尺寸后仍可定位；原图已更换或移除时会提示重新检查，已保存的证据仍可查看。
5. 将 **复核状态** 设为 **待复核**、**合理复用** 或 **需要替换**，并填写最多 2,000 字符的备注。这是用户自己的复核判断。状态和备注随工程保留，重新打开工程后可继续；新检查取消或失败时，上次完成的记录保持不变。
6. 下载 HTML 报告、JSON 记录或单张证据图。报告包含复核状态和备注，导出的 HTML/JSON 不嵌入原始源文件。编辑器报告名为 `figure-studio-image-check.html`，证据图名为 `figure-studio-image-match-N.png`。检查不会改动组图，也不会自动删除图片。

详情查看器只为当前图片对加载浏览器可显示的 PNG、JPEG、WebP 或 BMP 原图。TIFF 与高位深图片使用最长边不超过 900 像素的检查预览；高位深的强度映射有记录，原始像素不变。编码后的详情预览总量达到 12,000,000 字节上限时，可退回有明确标识的低分辨率缩略图。放大预览不会增加缺失的细节；检查原生强度值时应使用原始科研图像文件。

工程中保存一份已检查的源图片，以便重新打开本地文件证据、核验画布中的原图是否变化。单个工程文件导入和导出上限为 **200 MB（200,000,000 字节）**，更大的工程请先拆分。下载的复核报告保留证据与判断，工程则包含继续编辑和复核所需的原始图片。

程序比较底层栅格原图，包括画布裁剪后未显示的部分，而非只比较屏幕上可见的裁剪区域。解释匹配结果时，请一起核对裁剪范围与原图。外部图片网址不会被加载；请先嵌入图片或添加对应本地文件。

桌面安装版自动启动本机检测服务。若使用单独生成的 Studio HTML 页面，请通过套件启动服务：

```bash
python sci_figures.py studio-serve figure-studio.html
```

### 通过 AI 技能或命令行使用

在 Codex 或 Claude 中选用技能，附上图片，用日常语言说明即可：

> 帮我检查这些图片有没有放重，展示匹配证据并保存报告，不要改动原图。

完整套件也提供直接命令：

```bash
python sci_figures.py duplicates image-a.png image-b.tif figure.svg --out image-check
```

在解压后的套件目录中运行，并先安装套件所需 Python 依赖。如果使用单入口技能上传包，则从技能目录运行 `python suite/sci_figures.py ...`。请指定与原图分开的新目录；为避免覆盖之前的报告，程序不写入已存在的输出目录。

命令行报告目录包含 `report.html`（自包含中英文报告）、`report.json`、`matches.csv`，以及已生成的 `evidence-001.png` 等证据图。打开 HTML 即可复核，也可将 JSON/CSV 与分析记录一同留档。证据预览最多生成前 120 组，编码后总体积不超过 15 MB（15,000,000 字节）。如果达到任一上限，报告仍会保留其余图片对，并提示省略的证据图；可单独用较小批次复查这些图片对，生成对应证据。

桌面版和命令行在运行程序的电脑上完成检查，不会把图片上传到独立的查重服务。若在云端 AI 环境中调用技能，则文件和计算位于该宿主环境，仍适用该平台的数据处理规则。

### 检查范围

| 输入或变化 | 支持范围 |
| --- | --- |
| PNG、JPEG、TIFF、WebP、BMP 图片 | 逐对比较图像；命令行分别提取受支持的 TIFF 各帧。编辑器中请把每帧作为独立图片导入；多页或动画文件会被拒绝，不会静默只检查第一帧 |
| SVG 或编辑器小图编组中嵌入的图片 | 分别比较嵌入图片，无需拆散图形 |
| PDF 输入 | 命令行不直接接收 PDF；已导入编辑器的栅格图层可以检查 |
| 完全重复 | 与疑似重叠分别列出 |
| 旋转、镜像翻转、缩放、局部裁剪 | 检查匹配结构与几何位置一致的重叠 |
| 矢量坐标轴、标签、柱形等图形元素 | 不作为图片候选项 |
| 一张包含多个小图的截图 | 视为一张图片；检查小图之间的重复时，请提供独立小图 |
| 单张图片内部的复制粘贴 | 不属于本功能的跨图片检查范围 |

对于多通道高位深 TIFF 堆栈，请先将每帧导出为保留原始位深的独立 TIFF/PNG；无法保留原始像素的提取会被拒绝，避免损失科研像素值。高位深 CMYK、Lab 等不受支持的 TIFF 色彩模式，无论是单张还是堆栈均会拒绝检查，请将原始通道逐一导出为保留位深的灰度 TIFF/PNG。受支持的高位深图片以原始像素判断完全一致，证据预览使用有记录的强度映射。

图片太小、可辨结构太少、改动过大或纹理高度重复时，可能无法得到可靠的匹配证据。请保留报告中的跳过提示。单张图片最多 2000 万像素；图片或批次过大时会提示超限，不会只检查部分选中内容而不告知。数量上限按提取后的栅格图片计算，而非仅按文件数计算；若把大批图片分批检查，应记录分批范围，不同批次之间的图片并未互相比对。

### 怎么理解结果

**完全重复**表示图片内容匹配；**疑似重叠**表示值得回到原图复核的候选图片对。相似度或匹配分数不是学术不端的概率。请结合标出的结构、原始视野、通道、样本身份和采集记录判断；不同通道、共享对照或明确说明的参考图片复用，也可能合理地出现匹配。

将结果作为图像质检记录保存。未检出匹配不等于保证图片唯一，也不代表排除了所有可能的重复；如何处理发现，应以原始文件和科研背景为依据。
