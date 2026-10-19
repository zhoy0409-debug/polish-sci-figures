# 拍摄照片：一键矫正、校色与微调

本说明面向导入拍歪照片、屏幕翻拍或明场图片的 Figure Studio 0.1.26 用户。所有处理在本机进行，不需要外部 AI、账户或上传图片。操作容量、实际Windows检查与性能范围见[验收报告](figure-studio-photo-correction-validation.md)。

## 先自动，再按需要微调

导入原始 PNG、JPEG 或 WebP 后，选中照片，打开 **图片工具 → 一键矫正与微调**，也可以使用选中图片后的 **透视校正** 快捷按钮。

1. 编辑器在本机分析照片边缘，并在当前画布预览一个拉正方案。照片里有多层矩形时，可以在 **边界方案** 中换一个范围。
2. 检查要保留的区域。拖动四角，或输入原图像素坐标；方向键微调 1 px，Shift + 方向键微调 10 px。参数变化会更新真实画布，不必关闭面板。
3. 已知拍摄对象的宽高比时，选择 4:3、16:9、1:1 或填写自定义比例。默认的边长估计只用于展示，不代表实物的真实比例。输出宽度可以单独设置。
4. 点击 **保留校正**，从原始像素生成完整 PNG 版本。一次撤销即可返回之前的工程；**取消**或 Esc 会丢弃整次草稿。保留后再点击顶部**保存**下载工程 JSON，并核对下载目录中的文件；只保留画布版本不等于已备份到磁盘。**对照原图**只切换临时显示。
5. 使用 **一键校色与微调**，或打开 **图片颜色与显示 → 一键校色（拍摄照片）**。先查看自动建议，再调整亮度、对比度、色温、色调及强度，最后点击 **应用**。颜色草稿同样可以取消、整体撤销。

识别不到可靠的四边边界时，编辑器会明确提示，并保留手动四角操作。边缘建议不能判断哪一块是胶图、纸张或屏幕里的内容；多层边界需要用户核对。

支持的浏览器会在本机后台线程完成检测缩略图及矫正原图区域的像素读取。检测缩略图只用于提出边界；完整矫正仍读取原始像素。取消会终止本次后台任务。旧浏览器缺少后台图像接口时使用兼容路径。自动边界建议失败时可改用手动四角；原图像素读取失败时会停止输出并提示重试，不会静默转为主线程的大图读取。

## 像 Photoshop 一样使用标尺拉正

**标尺拉正**使用两点参考线计算角度，适合把整体倾斜的电泳或 WB 图片摆正；它与填写真实长度的科研比例尺是两个功能。

打开同一个校正面板，点击 **标尺拉正**，沿应当水平的条带行或可靠参考边拖一条线。松开后会自动计算角度并在画布预览；也可以选择垂直方向，或用两个端点的像素坐标微调。再次拖线或修改端点会复用最初所选范围，避免累计裁小；满意后仍使用 **保留校正**，不满意可以取消。

标尺模式对当前四点外接范围做统一旋转，会替代原有四角透视设置。输出采用范围内可用的矩形裁剪，不补画旋转后缺失的边角；界面与工程会记录参考线、角度和裁剪。继续手调四角或比例时，会明确标记为已经微调的结果。该操作不能矫正凝胶自身的弯曲，也不会分别移动或拉平各泳道。

## 原图、版本和科研记录

校正会生成新的图片版本，**图片版本 → 保留原图／已校正**可以切换。再次打开四角调整时，编辑器读取保留的原始文件和上次参数，避免对已经变形的图片反复重采样。工程中保存原编码与输出 PNG 的 SHA-256、四角、投影矩阵、输出尺寸和插值方法；打开工程时校验记录及两个文件的哈希。

该功能适用于独立的位图小图。含文字、图表或其他向量对象的混合小图应先把原始照片单独导入，避免用一个校正版本替换其他内容。新几何版本不会继承旧的比例尺、采集标定或 ROI；需要根据可信采集信息重新建立。原工程及其已有标记可以通过撤销恢复。

透视校正使用双线性插值，只映射已有像素，不补画条带或重建细节。浏览器处理的是解码后的 8 位 RGBA 展示像素。屏幕翻拍和透视处理后的图片适合展示；条带强度等定量分析仍应使用原始仪器文件。原始采集文件应另行保存。

## 一键校色会做什么

自动校色提供保守的全图显示参数。只有空间分布合格、未饱和的近白背景才会用于轻微的白平衡建议；没有可靠背景时，保留各通道相同的增益，只建议有限的全局曝光和对比度。新增截断按有界采样检查，必要时降低整体强度；界面会说明本次是否调整了白平衡，用户仍可微调。

颜色参数和可验证的 SVG 显示滤镜保存于工程，原始嵌入文件不被覆盖。**一键校色（拍摄照片）**用于普通拍摄／明场展示；荧光模式禁用单图自动校色，继续使用已有共同显示参数。这里的自动建议不等于相机色度校准或染色标准化。

## 容量与验收范围

几何建议最多分析 640 px 边长的缩略图，并提出最多 5 个边界；完整校正直接采样所选原图区域。原图上限为 3200 万像素，输出上限为 4096 px 边长、1200 万像素，每方向最多放大至所选边长的两倍。输出 PNG 超过工程编码容量时会要求减小宽度，不会悄悄改成 JPEG。原图大小还受普通导入入口限制。

所有图片分析、预览和处理都在本机执行，断网仍可使用。科研数据、原图、私有工程和拍摄信息不发送给文献服务。开发验证、真实照片操作、Windows 成品和本轮性能的实际状态分别记录在[照片校正验收报告](figure-studio-photo-correction-validation.md)中；真实照片工程验证不能代替独立标注集的检测准确率。

## English quick reference

Import the original photo, then choose **Image tools → Auto straighten & refine**. Review the suggested outline; choose another outline or drag the corners. Specify a known aspect ratio when available. **Keep correction** creates a PNG version and retains the original; Cancel leaves the saved project unchanged. Reopening uses the retained source rather than resampling an earlier correction.

For a global tilt, choose **Ruler straighten**, draw a horizontal or vertical reference, and preview one rigid rotation with an inscribed crop. Repeated ruler edits reuse the initial bounds. The ruler is not a physical scale bar or per-lane correction.

Choose **Auto color & refine next**, or **Image display → Auto color (photos)**, to preview conservative whole-image display parameters. Manual controls remain editable and Apply creates one Undo step. Automatic per-image balancing is disabled in fluorescence mode. Processing stays local; this feature does not reconstruct image content or turn a photographed display into quantitative source data.
