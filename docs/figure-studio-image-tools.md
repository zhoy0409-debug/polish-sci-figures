# 图片工具：边框、查重、颜色和局部放大

Figure Studio 0.1.20 在原编辑器顶部增加五个工作入口。打开 **图片工具**，可以直接找到下列功能；也可以点击 **查找功能**，输入“给病理图加边框”“图片查重”或“纵轴刻度间隔”。快捷键为 Ctrl/Command + K。选中图片后，画布工具栏和右键菜单也提供相应入口。

## 给对象加边框

选中图片、文字、形状、组合或整个小图，点击 **边框**，设置颜色、最终印刷粗细（pt）、实线／虚线／点线、直角／圆角和锚定外缘，再点击 **应用边框**。边框是单独的装饰记录，不修改原图像素，也不代表 ROI 或比例尺。多选可以批量应用；已锁定对象保持原样。

**可见外缘**适用于普通对象和矩形裁剪；**完整外缘**依据原图／对象的完整边界。旋转后框线随对象定位。复杂蒙版或包含裁剪子对象的组合可能无法确定矩形可见外缘，此时会给出原因；可以改为完整外缘，或单独选中子对象。圆角只支持矩形。没有绘制面积的对象不能加框；细线根据真实描边宽度计算外缘，边框过粗时会拒绝应用。

边框向内绘制，当前不支持居中／外侧位置。**复制／粘贴边框格式**在不同对象之间复用样式；普通元素 Ctrl+C/V 不携带独立边框记录，粘贴后需另行粘贴边框格式。隐藏源对象时，其框也隐藏。**移除边框**、恢复默认、撤销和重做均可使用，工程保存重开会保留记录。不同图形版本各自保留元素边框；更新源 SVG 后，旧元素锚点不能自动视为可信，需要重新应用，失效边框会阻止对应内容导出。整小图／图号边框在原生数据重新生成时迁移。

## 检查不同图片之间的重复或重叠

导入至少两张图片后，顶部会提示可手动查重，**不会自动扫描**。打开 **图片工具 → 图片查重**，先核对检查范围、图片数、配对数、原始／可见区域和容量限制，再点击 **开始检查**。也可选择本机文件，或使用明确标为合成数据的内置示例。

检查在本机运行，最多 60 张、40 MB 编码载荷。进度和取消操作可见；取消不会把部分结果标成完成，也不会清掉之前的复核记录。结果区分精确像素相同、疑似同源／重叠和信息不足，提供证据图供逐对复核，并可保留备注、保存工程和导出记录。

当前不检查单张压平组图内部的复制区域，不判定学术不端；没有发现不等于没有重复。重裁剪、低纹理条带、不同通道或重复组织结构应结合采集记录复核。[真实来源工程测试、漏检、误报与性能](scientific-image-evaluation-round2.md)分别记录，尚无独立人工盲测准确率。

## 调整显示并匹配参考颜色

在 **图片工具**中选择目标图片，打开 **图片颜色与显示 → 匹配参考图**。单张图片可以调整曝光、对比度等显示参数；需要匹配时再明确选择参考图。比较窗提供同位置原图／调整图、1×／2×／4×细节、RGB 直方图、端点像素和新增截断比例。核对后点击一次 **应用**，可整体撤销。

保留原始嵌入像素，以非破坏性的显示记录和 SVG 滤镜呈现。参考颜色匹配属于明场展示调整，不是染色归一化或信号定量；荧光仅提供共同显示参数，不能据此改变或解释实验信号量。直方图使用有界采样，属于显示检查，不冒充原始全分辨率定量。

## 关联总览和放大图

打开 **图片工具 → 关联总览与放大图**，选择总览与细节。两张独立文件需要先确认具有共同来源或重叠视野，然后才尝试自动定位。系统显示原图坐标、几何质量与失败原因；质量值不是正确概率。

返回候选后，核对原图上的框，可手动绘制、移动、缩放或直接修改像素坐标，方向键微调 1 px，Shift + 方向键微调 10 px。最后点击 **应用**。人工调整会记录为人工确认，不冒充自动检测证据。无法定位时不生成猜测框，可以改用人工标注；取消会丢弃尚未应用的草稿。

源图、裁剪或引用变化后，需要重新核对关系；失效来源不能悄悄导出成仍有效的关联。已有的图内局部放大与物理比例尺入口仍保留，比例尺需要真实采集标定。

## 文件和隐私

编辑器普通图片导入目前接受 PNG、JPEG 和 WebP；TIFF 可用于查重文件入口，直接放入画布前需按原始位深和通道条件审慎转换。不要把 16 位或多通道科研原图随意压成 8 位，再宣称定量等价。本次私有 RGB TIFF 操作验收采用无损 PNG，并逐像素验证转换结果。

查重单文件上限为 12 MB，另有 40 MB 总编码载荷、20 MP 像素上限；本次提供的大幅 16 位透射电镜 TIFF 超限，部分无损 PNG 重封装后仍超限，**当前不能直接完成这些原图的全幅检查**。已明确选定的局部视野工程验证不能替代全幅验收，也不能自动推断原图不同视野是否重复。

图片工具和原始数据默认在本机运行，不需要云端 AI 或账户。联网文献检索仍由用户明确触发，只能发送单独填写的公开检索词。私有验收原图、路径、文件名和截图不随仓库或安装包分发。

## English quick reference

Open **Image tools** in the five-part workflow bar, or use **Find command** (Ctrl/Command + K). Selected images also expose contextual shortcuts.

- **Object borders:** independent, inside decorative frames in final print pt; batch edits respect locks. Visible rectangular clips and full original boundaries are distinct. Complex masks need original-edge mode or individual child selection. Rounded frames require rectangles. Use **Copy/Paste border style** after ordinary object copy/paste. Save/reopen and Undo/Redo retain border records.
- **Screen duplicates:** review scope and limits, then explicitly start. Up to 60 images / 40 MB encoded; progress, cancellation, evidence, review notes and saved records remain local. Flattened-image internal copying and misconduct judgments are outside scope.
- **Image display → Match reference:** compare raw/adjusted detail, RGB histograms and clipping before Apply. This is reversible display adjustment, not stain normalization or quantitative fluorescence correction.
- **Link overview and detail:** confirm shared provenance for separate files, inspect original-pixel coordinates, refine manually, then Apply. Rejected localization never produces a guessed rectangle; manual geometry is labelled as manual confirmation.

See [professional axes](figure-studio-axes-round2.md), [evaluation and known misses](scientific-image-evaluation-round2.md), and [actual acceptance scope](figure-studio-experience-round2-validation.md). No independent human-labelled blind accuracy claim is made.
