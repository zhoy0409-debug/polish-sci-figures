/* UI-only localization. Scientific artwork, records and user-authored names are never translated. */
'use strict';
const StudioI18n = (() => {
  const en = {"参考图集 · 102":"Reference collection · 102","搜索图表":"Search charts","名称、关键词或所需数据":"Name, keyword or required inputs","返回图库":"Back to gallery","参考模板 · 示例数据":"Reference template · example data","所需数据：":"Required inputs: ","放大预览：":"Enlarge preview: ","本地图集 · 示例数据 · 原卡片保留中文说明和来源标注":"Local reference collection · example data · original cards retain Chinese notes and source credits","使用当前数据的对应图表":"Use corresponding chart with current data","模板参考；尚未连接当前数据":"Reference template; not connected to current data","{0} 个图表 · {1} 张参考卡":"{0} charts · {1} reference cards","没有匹配的图表，请调整搜索词或类别。":"No matching charts. Change the search or category.","样式示意":"Illustrative layout","浏览图表样式。标记“当前数据”的预览可直接应用；“示例数据”展示模板，并注明所需输入。":"Browse chart styles. Current-data previews can be applied; example-data previews show templates and required inputs.","当前数据":"Current data","示例数据":"Example data","查看所需数据":"Required inputs","应用线宽":"Apply stroke width",
"误差棒":"Error bars","显示方向":"Displayed direction","双向":"Both","正向":"Positive","负向":"Negative","误差棒方向无效":"Invalid error-bar direction","已更新误差棒方向":"Error-bar direction updated",
"线宽（最终成图 pt）":"Stroke width (final pt)","填充":"Fill","保持原样":"Keep current","实心":"Solid","空心／无填充":"Hollow / no fill","对象对齐":"Align objects","文本对齐":"Text alignment","左对齐":"Align left","居中":"Center","右对齐":"Align right","水平居中":"Center horizontally","垂直居中":"Center vertically","顶端对齐":"Align top","底端对齐":"Align bottom","请选择至少两个对象":"Select at least two objects","已对齐所选对象":"Selected objects aligned",
"标注参数无效": "Invalid annotation properties", "标注": "Annotations", "标注类型": "Annotation type", "文本": "Text", "直线": "Line", "矩形": "Rectangle", "椭圆": "Ellipse", "插入标注": "Insert annotation", "标注属性": "Annotation properties", "拖动标注可移动位置；拖动控制点可调整尺寸。画布空白处拖动可框选，Shift 追加选择。": "Drag annotations to move; drag handles to resize. Drag empty canvas space to select; Shift adds to the selection.", "文本内容": "Text content", "字号（pt）": "Font size (pt)", "线宽（pt）": "Stroke width (pt)", "不透明度": "Opacity", "填充形状": "Fill shape", "加粗": "Bold", "应用属性": "Apply properties", "删除标注": "Delete annotation", "已选 {0} 个标注": "{0} annotations selected", "已插入标注": "Annotation inserted", "已更新标注": "Annotation updated", "已删除未锁定标注": "Unlocked annotations deleted", "插入文本": "Insert text", "插入直线": "Insert line", "插入矩形": "Insert rectangle", "插入椭圆": "Insert ellipse", "已调整标注位置": "Annotation position updated", "框选完成": "Selection updated", "已移动所选元素": "Selected objects moved",

"Figure Studio · 科研图形编辑器": "Figure Studio · Scientific Figure Editor", "已恢复版本": "Version restored", "清除本浏览器的偏好记忆？当前图形、版本和撤销记录不会删除。": "Clear saved preferences in this browser? Figures, versions and undo history will be retained.", "已恢复初始版本推荐间距": "Initial spacing restored", "恢复初始版本推荐间距": "Restore initial spacing", "已保存 20 个版本，请另存工程后继续整理。": "20 versions saved. Save another project to continue.", "已保存版本「{0}」": "Saved version “{0}”", "版本无效": "Invalid version", "已下载工程；包含原图、当前修改和版本。": "Project downloaded with source assets, current edits and versions.", "面板标签会导出，随小图移动。使用当前文字字体；编号顺序只在点击编号时更新。": "Labels are exported and move with panels. Uses the selected font; numbering updates only on request.",

"科研图形编辑器": "Scientific Figure Editor", "POLISH SCI FIGURES / 图形编辑器": "POLISH SCI FIGURES / FIGURE EDITOR", "FIGURE / 图层": "FIGURE / LAYERS", "PROPERTIES / 属性": "PROPERTIES", "布局与顺序": "Layout & order", "图表类型": "Chart types", "属性": "Properties", "配色": "Colors", "方向与比例": "Orientation & aspect ratio", "网格跨度": "Grid span", "推荐图表": "Recommended charts", "设置面板占用的行列。悬停预览，单击应用。": "Set the panel span. Hover to preview; click to apply.", "根据数据结构与表达目的推荐。悬停预览，单击应用。": "Recommendations reflect the data structure and communication goal. Hover to preview; click to apply.", "预览不同方向与画布比例。": "Preview orientation and canvas aspect ratios.", "悬停预览布局，单击应用。预览序号不导出。": "Hover to preview layouts; click to apply. Preview indices are not exported.", "面板标签": "Panel labels", "统计分析": "Statistical analysis", "分析记录": "Analysis record", "版本": "Versions", "偏好设置": "Preferences", "项目与预设": "Projects & presets", "源数据快照；在“数据表”中编辑。": "Source data snapshot; edit in Data table.", "数据修订与图形样式保留独立版本。": "Data revisions and appearance are versioned separately.", "原始外观": "Original appearance", "恢复初始版本": "Restore initial version", "推荐 · ": "Recommended · ", "1 × 1": "1 × 1", "跨 2 列": "Span 2 columns", "跨 3 列": "Span 3 columns", "整行": "Full row", "跨 2 行": "Span 2 rows", "就绪": "Ready", "结束布局编辑": "Finish layout editing", "编辑布局": "Edit layout",

"最多同时放置 24 张小图": "A maximum of 24 active panels is supported", "请先选择一个空格": "Select an empty cell first", "请选择空格导入图片": "Choose an empty cell for image import", "正在保存…": "Saving…", "工程版本资源已达上限，请另存为新工程": "Asset revision limit reached; save a new project", "目标已变化，请重新选择导入位置": "The destination changed; select it again", "图片不能超过 20 MB": "Images must be at most 20 MB", "不支持 XML 实体": "XML entities are unsupported", "SVG 需要有效 viewBox": "SVG needs a valid viewBox", "支持 PNG、JPEG、WebP 或 SVG": "Supported: PNG, JPEG, WebP or SVG", "图片无法解码": "Image could not be decoded", "图片已导入；可撤销恢复原图": "Image imported; undo restores the original", "替换当前小图…": "Replace this panel…", "在此空格导入图片…": "Import image into this cell…", "数据表": "Data table", "数据表与实时重绘": "Data table & live redraw", "修改在本机重新分析；图形、区间和统计标注同时更新。无效或未完成的数据不会覆盖当前图。": "Reanalysis runs locally and updates charts, intervals and statistics together. Invalid or incomplete data do not replace the current chart.", "新增行": "Add row", "替换 CSV / TSV": "Replace CSV / TSV", "立即重算": "Recompute now", "放弃未应用修改": "Discard pending edits", "上一页": "Previous", "下一页": "Next", "新增列": "Add column", "新增列名称": "New column name", "此图片没有原始数据表；不能从像素推断实验数据。": "This image has no source table; experimental data cannot be inferred from pixels.", "本机计算已连接 · 数据不会上传到外部服务": "Local engine connected · No data sent to external services", "独立 HTML 可查看数据；实时重算请用 studio_server.py 启动本机编辑器。": "Standalone HTML shows source tables. Start the local editor with studio_server.py for live recomputation.", "删除此列": "Delete this column", "删除第 {0} 行": "Delete row {0}", "第 {0} 行 · {1}": "Row {0} · {1}", "{0}–{1} / {2} 行": "Rows {0}–{1} of {2}", "数据已修改，等待重算；导出暂不可用": "Data changed; awaiting recomputation. Export temporarily unavailable.", "正在本机重算图形与统计结果…": "Recomputing charts and statistics locally…", "数据、图形和统计已同步更新；可撤销": "Data, charts and statistics updated together; undo available", "已同步重算 · {0} 秒 · 原始版本仍可撤销": "Recomputed in {0} s · Previous version remains in undo history", "尚未应用：": "Not applied: ", "当前图仍对应上次有效数据；请修正数据表。": "The chart still represents the last valid data; correct the table.", "已恢复上次有效数据": "Restored last valid data", "数据表不能超过 2 MB": "Data tables must be at most 2 MB", "表达目的": "Communication goal", "总体概览": "Overview", "分布特征": "Distribution", "效应大小": "Effect size", "阈值选择": "Thresholds", "不确定性": "Uncertainty", "推荐数量": "Recommendations", "更多图型 → 完整图型库": "More charts → Full catalogue", "完整图型库": "Full chart catalogue", "当前数据可用的样式提供真实预览；其他样式列出所需数据，不用示意数据冒充你的结果。": "Eligible charts show previews from your data. Other charts explain their requirements; illustrations never stand in for your results.", "首选 · ": "Recommended · ", "当前数据可用": "Available for current data", "应用这个图型": "Apply this chart", "需要相应数据或计算结果": "Requires matching data or computed results", "请查看分析记录": "See the analysis record",

'快捷操作':'Quick actions',
'颜色与透明度…':'Color & opacity…','字体与字号…':'Font & size…','图型与横竖预览…':'Chart & orientation previews…','位置与跨格…':'Position & span…','图号与位置…':'Panel label & position…','统计标注…':'Statistical annotations…','图像比例尺…':'Image scale bar…',
'点击更改投稿尺寸':'Click to change publication size',

"导出尺寸或分辨率无效":"Invalid export dimensions or resolution","{0} × {1} px · {2} dpi · 锁定纵横比":"{0} \u00d7 {1} px \u00b7 {2} dpi \u00b7 Aspect ratio locked","缩放后最小文字约 {0} pt；请按期刊要求核对。":"Smallest scaled text is approximately {0} pt; check your journal requirements.","已等比例调整投稿尺寸":"Publication size changed proportionally","已恢复原始物理尺寸":"Original physical dimensions restored","原始栅格图像无法解码":"The source raster image could not be decoded","{0} 张原始图片不足目标分辨率，最低约 {1} dpi；放大不能补回细节。":"{0} source images fall below the target resolution; minimum about {1} dpi. Upscaling cannot restore detail.","输出超过浏览器画布容量，请保留投稿尺寸并导出 SVG 后转换。":"Output exceeds browser canvas capacity. Keep the publication size and export SVG for external conversion.","已导出 {0} × {1} px，{2} dpi；物理尺寸 {3} × {4} mm。":"Exported {0} \u00d7 {1} px at {2} dpi; physical size {3} \u00d7 {4} mm.","投稿尺寸与导出":"Publication size & export","整体等比例缩放，保留内部排版。快捷尺寸仅作示例，以目标期刊要求为准。":"Scale proportionally, preserving the composition. Preset widths are examples; follow your journal requirements.","尺寸快捷值":"Preset width","自定义尺寸":"Custom size","成图宽度（mm）":"Figure width (mm)","成图高度（mm）":"Figure height (mm)","PNG 分辨率":"PNG resolution","恢复原始物理尺寸":"Restore original physical size",

"插入方向无效":"Invalid insertion direction","插入数量超出当前母版容量":"The insertion exceeds the grid capacity","插入会移动或扩展已锁定小图，请先解锁":"Insertion would move or expand a locked panel. Unlock it first.","当前还可插入 {0} 行、{1} 列；跨越插入位置的小图会扩展。":"Room for {0} more rows and {1} columns. Panels spanning the insertion expand.","已插入 {0} {1}":"Inserted {0} {1}","行":"rows","列":"columns","插入行／列":"Insert rows / columns","插入行或列":"Insert rows or columns","扩展母版":"Extend layout","插入数量":"Number to insert","↑ 在上方插入行":"\u2191 Rows above","↓ 在下方插入行":"\u2193 Rows below","← 在左侧插入列":"\u2190 Columns left","→ 在右侧插入列":"\u2192 Columns right","关闭":"Close",

'恢复该成稿全部参数':'Restore exact source settings','显示已归档组图':'Show archived figures','恢复归档':'Unarchive','归档':'Archive','完整恢复仅适用于该预设的原工程；其他工程请粘贴可迁移样式。':'Exact restoration applies to the source project only. Paste transferable styles onto other projects.','已恢复成稿全部参数':'Exact source settings restored',

'将修改 {0} 个文字对象；输入后回车或移开即可应用。':'Editing {0} text objects. Press Enter or leave the field to apply.',
'当前未选中文字。请点选文字，或将范围改为当前小图。':'No text selected. Select text or choose the current panel scope.',

'统计标注与柱形布局':'Statistical labels & bars',
'单坐标绘图区自动对齐网格边界，文字与点标记保持物理尺寸；图像和多坐标图保留原比例。':'Single-axis plots align to the grid with fixed-size text and markers. Images and multi-axis figures retain their aspect ratio.',

"总览保存失败，请下载工程备份。":"Collection save failed. Download a project backup.","打开并细调":"Open to refine","该工程需要重新导入":"This project needs to be imported again","本地总览：{0} 张组图，{1} 个预设。":"Local collection: {0} figures, {1} presets.","已粘贴编辑预设":"Edit preset pasted","已粘贴可迁移样式；数据、文字与统计结果保留。锁定小图跳过 {0} 张。":"Transferable styles pasted; data, text and statistical results retained. Skipped {0} locked panels.","请输入预设名称":"Enter a preset name","组图总览／编辑预设":"Collection / presets","组图总览与编辑预设":"Figure collection & presets","返回编辑":"Back to editor","集中查看所有组图，点开继续细调。预设按小图顺序匹配可迁移样式；数据、文字内容、统计结果和图像标定保留目标工程自己的值。":"Review all figures together and open any to refine. Presets match transferable styles by panel order, preserving target data, text, statistics and image calibration.","收录／更新当前组图":"Add / update this figure","导入多个工程／总览包":"Import projects / collection","备份整个总览":"Back up collection","成稿预设名称":"Preset name","例如：论文主图统一样式":"e.g. Main manuscript figures","保存当前成稿参数":"Save current edit preset","使用预设":"Choose preset","粘贴到当前组图":"Paste onto current figure","同时应用布局（小图数量相同时）":"Include layout (matching panel count)",

    'HEX 色值':'HEX color','常用色板':'Swatches','最近使用':'Recent colors',
    '请输入有效的 HEX 色值，例如 #4477AA。':'Enter a valid HEX color, such as #4477AA.',

    'Figure Studio · 科研组图微调':'Figure Studio · Scientific figure refinement',
    'POLISH SCI FIGURES / 交互微调':'POLISH SCI FIGURES / VISUAL REFINEMENT',
    '↶ 撤销':'↶ Undo','↷ 重做':'↷ Redo','查看原版':'View original','返回编辑版':'Back to edits',
    '恢复首版':'Reset to first draft','保存工程':'Save project','打开工程':'Open project','导出 SVG':'Export SVG',
    'FIGURE / 面板':'FIGURE / PANELS','选中小图，再点选图内元素。':'Select a panel, then click an object inside it.',
    'Shift + 点击可多选。':'Shift-click to select multiple objects.',
    '母版与叙事顺序':'Layouts & reading order',
    '悬停母版看整图，点击应用。空位保留；数字表示阅读顺序，不进入导出。':'Hover to preview the composition; click to apply. Empty slots are retained. Reading-order guides are not exported.',
    '跨格时匹配已有横 / 竖版':'Match available canvas variants to spanning slots',
    '行数':'Rows','列数':'Columns','应用行列':'Apply grid','间距（pt）':'Gutter (pt)',
    '开启拖动排版':'Enable layout dragging','完成排版 · 返回细节编辑':'Finish layout · Edit details',
    '拖动画布小图或左侧列表至目标格：有图则交换，空位则移入。也可用下面的行列定位。':'Drag a panel or its list entry to a cell: swap occupied slots or move into an empty one. Row and column controls are also available.',
    '目标行':'Target row','目标列':'Target column','移动 / 交换至该位置':'Move / swap to this position',
    '跨行':'Row span','跨列':'Column span','应用跨格并顺序重排':'Apply span & repack in order',
    '面板前移':'Move earlier','面板后移':'Move later',
    '画布按小图真实尺寸扩展，留白居中。新增横竖规格由原始数据重绘，字体不随拼版拉伸。':'Slots accommodate native panel sizes with centred whitespace. Canvas variants are redrawn from source data; fonts are not stretched.',
    '命名版本':'Named versions','例如：蓝橙配色':'Example: blue–orange palette','版本名称':'Version name','保存当前版本':'Save this version',
    '一个工程保存原图与样式差异，版本不重复存整张图。':'One project stores source artwork and edit differences; versions do not duplicate the full figure.',
    '预览缩放':'Preview zoom','适合窗口':'Fit to window','本地编辑 · 无需 API · 原始文件保持不变':'Local editing · No API needed · Source files unchanged',
    'INSPECTOR / 检查器':'INSPECTOR','选择一个元素':'Select an object','编辑模式':'Editing mode',
    '表达探索':'Explore','细节编辑':'Details','配色比较':'Palettes','应用范围':'Apply to',
    '已选元素':'Selected objects','当前小图：与选中元素同色':'Current panel: matching colours','当前小图':'Current panel','整张组图':'Entire figure',
    '文字类别':'Text category','所有文字':'All text','坐标刻度':'Tick labels','坐标轴标题':'Axis titles','图例文字':'Legend text',
    '外观':'Appearance','颜色':'Colour','通道':'Paint channel','填充与描边':'Fill & stroke','仅填充':'Fill only','仅描边':'Stroke only','应用颜色':'Apply colour','不透明度':'Opacity',
    '按原有可见通道改色；不会给空心图形添加填充。':'Change existing paint channels; hollow marks remain unfilled.',
    '文字':'Text','字体':'Font','字号（最终成图 pt）':'Font size (final figure pt)','应用字体 / 字号':'Apply font / size','加粗 / 还原':'Toggle bold',
    '所选文字内容':'Selected text','点选一个文字或文字片段':'Select a text object or text run','修改该文字':'Update text',
    '含上下标 / 斜体的文字请选择具体片段；不把整段格式抹平。':'Select individual runs for superscripts, subscripts or italics to preserve their formatting.',
    '同一图型，横放还是竖放？':'Same chart, different proportions',
    '真实画布重绘预览；不是旋转图片，也不改变变量含义。鼠标移上去看整张组图效果。':'Preview actual redraws, not rotated images. Variables keep their meaning. Hover to see the full composition.',
    '这组数据，还能怎么看？':'What else can these data show?',
    '不必先知道图名。悬停看整图效果，点击保留；先比较表达的信息，再选样式。':'No chart vocabulary required. Hover to compare the information shown in context; click to keep a candidate.',
    '配色预览':'Palette previews',
    '按范围预览；整图跨面板颜色对应需核对分组语义。连续色标保持原样。':'Preview within the selected scope. Check group-to-colour meaning across panels. Continuous colour scales are preserved.',
    '预览互补色':'Preview complementary colours','数据与分析记录':'Data & analysis records','交付前检查':'Delivery checks',
    '导出为编辑稿。请按最终尺寸核对字体、碰撞、颜色语义、科学符号及栅格分辨率，再运行原 skill 的 QA。':'Exports are editable drafts. Check typography, collisions, colour meaning, scientific notation and raster resolution at final size, then run the skill’s QA.',
    '工程布局无效':'Invalid project layout','母版行数无效':'Invalid number of rows','小图超出母版':'Panel exceeds layout bounds','小图位置重叠':'Panel positions overlap',
    '面板顺序无效':'Invalid panel order','候选图状态无效':'Invalid candidate state','样式版本无效':'Invalid style version','元素标识无效':'Invalid object identifier','不支持的样式差异':'Unsupported style edit','无效颜色':'Invalid colour',
    '母版位置不足，请增加行列或减小跨格范围':'Not enough slots. Add rows or columns, or reduce the span.',
    '原始点 + 均值及置信区间':'Raw points + mean and CI','箱线图 + 原始点':'Box plot + raw points','小提琴图 + 原始点':'Violin plot + raw points','雨云图':'Raincloud plot','估计图：显示组间效应':'Estimation plot: between-group effect','配对轨迹':'Paired trajectories','个体变化量':'Individual changes','配对估计图':'Paired estimation plot','组别均值与区间':'Group means and intervals','ROC 曲线':'ROC curve','精确率–召回率曲线':'Precision–recall curve',
    '关心组间平均差异与个体离散程度':'Comparing group means and individual variation',
    '同时看到每个观测值、均值和不确定性；不会只留下柱子的高度。':'Shows individual observations, means and uncertainty together.',
    '关心中位数、四分位范围与分布离散程度':'Examining medians, interquartile ranges and spread',
    '保留原始点，帮助辨认相同均值下不同的数据分布。须结合样本量解读。':'Retains raw points to reveal distributions that similar means can hide. Interpret in light of sample size.',
    '关心分布形状；原流程已允许密度估计':'Examining distribution shape when density estimation is appropriate',
    '能看到偏态或多峰的线索；外形受样本量和带宽影响，不替代检验。':'Can reveal skewness or multiple modes. Shape depends on sample size and bandwidth; it is not a statistical test.',
    '希望一起观察原始点与分布形状':'Viewing individual observations alongside distribution shape',
    '同屏比较个体、分布和摘要；适用于原流程判定可绘制的连续数据。':'Combines observations, distributions and summaries for continuous data approved by the upstream workflow.',
    '核心问题是两组相差多少':'Asking how much two groups differ',
    '把组间效应量及其区间直接画出来；比仅比较高度更便于读出差异大小。':'Displays the between-group effect and its interval directly, making the magnitude of the difference visible.',
    '关注同一对象前后如何变化':'Following changes within the same experimental units',
    '连线保留配对关系，展示个体变化方向；只适用于已确认的配对数据。':'Connecting lines preserve pairing and individual change directions. Requires confirmed paired data.',
    '关注个体变化量及平均变化':'Examining individual and average changes',
    '围绕零线比较变化方向和幅度；保留配对差值，不把两次测量当独立样本。':'Compares changes against zero while retaining paired differences rather than treating measurements as independent.',
    '同时关注配对关系与效应大小':'Showing pairing and effect size together',
    '并列展示原始配对数据与差值区间，帮助判断变化量及其不确定性。':'Shows paired observations alongside the difference interval to expose magnitude and uncertainty.',
    '需要清楚比较多组的估计值和区间':'Comparing estimates and intervals across several groups',
    '集中展示各组均值及不确定性；这不是自动计算的组间差异检验。':'Summarises group means and uncertainty. This is not an automatically added between-group test.',
    '关注不同阈值下灵敏度与假阳性率的权衡':'Examining sensitivity versus false-positive rate across thresholds',
    '展示分类区分能力；与 PR 图回答的问题不同，不能仅按美观互换。':'Shows discrimination. ROC and PR plots answer different questions and should not be exchanged for appearance alone.',
    '关注检出率与阳性预测准确性的权衡':'Examining recall versus precision',
    '可观察召回增加时精确率如何变化；受阳性率影响，跨队列比较需结合背景。':'Shows how precision changes with recall. Prevalence affects interpretation, especially across cohorts.',
    '克制蓝橙':'Muted blue–orange','柔和科研':'Soft research palette','原始横竖比例':'Original proportions','竖版':'Portrait','加宽横版':'Wide landscape','跨两列横版':'Two-column landscape','跨两行竖版':'Two-row portrait','重点大图':'Large focal panel',
    'SVG 无效或超过大小限制':'Invalid SVG or size limit exceeded','无法解析 SVG':'Unable to parse SVG','请先把 SVG 样式表转换为行内样式':'Convert SVG stylesheets to inline styles first.','不是受支持的 Figure Studio 工程':'Unsupported Figure Studio project','工程面板无效':'Invalid project panel','SVG 尺寸无效':'Invalid SVG dimensions','未知的画布规格':'Unknown canvas profile',
    '浏览器本地空间不足或不可用，请点击「保存工程」下载当前修改。':'Browser storage is full or unavailable. Use Save project to download your edits.',
    ' · 已记录，可撤销':' · Recorded; undo available','请先退出原版对照。':'Exit original comparison first.','请先点选图内元素。':'Select an object inside the figure first.',
    '实时预览 · 松开滑块或确认颜色后记录一次修改':'Live preview · Release the slider or confirm the colour to record one edit',
    '已更新 {0} 个属性':'Updated {0} properties',
    '当前范围没有适用元素。黑白坐标与连续色标不参与整图改色。':'No applicable objects in this scope. Whole-figure recolouring excludes neutral axes and continuous colour scales.',
    '2 行 × 2 列':'2 rows × 2 columns','3 行 × 3 列':'3 rows × 3 columns','4 行 × 3 列':'4 rows × 3 columns','5 行 × 3 列':'5 rows × 3 columns','横向并列':'Horizontal comparison','纵向叙事':'Vertical sequence','上方宽图':'Wide panel above','左侧长图':'Tall panel at left',
    '已应用母版 ':'Applied layout: ','母版 ':'Layout: ','母版预览：':'Layout preview: ',' · 点击应用，移开还原':' · Click to apply; move away to restore','已返回当前布局':'Current layout restored','已应用 ':'Applied: ','预览 ':'Preview: ','已返回当前编辑版':'Current edits restored',
    '已选 {0} 个元素':'{0} objects selected','当前小图 · ':'Current panel · ','已切换画布规格':'Canvas profile changed','画布 ':'Canvas: ',
    '此图只有原始尺寸。用受支持的绘图配方和源数据准备尺寸候选后，可直接切换。':'Only the original size is available. Prepare canvas variants with a supported recipe and source data to enable switching.',
    '来自同一上游绘图包；预览使用真实 SVG。不同形式的统计含义请查看分析记录。':'Real SVGs from the same upstream bundle. Consult the analysis record for the statistical meaning of each form.',
    '单独导入的 SVG 无数据驱动候选；需先用原 skill 生成候选图包。':'Standalone SVGs have no data-driven alternatives. Generate a candidate bundle with the original skill first.',
    '已切换候选图':'Chart candidate changed','整图预览：':'Composition preview: ','适合：':'Useful for: ','。':'. ',
    '由上游分析流程提供；请结合下方分析记录判断它适合回答的问题。':'Provided by the upstream workflow. Use the analysis record below to assess the question it answers.',
    '原始表只读，外观调整不改变分析。':'Source table is read-only. Appearance edits do not alter the analysis.',
    '未嵌入原始表；下方仅显示已有配方与分析。':'No source table is embedded. Available recipe and analysis records are shown below.',
    '当前小图：{0} 个文字对象，{1} 个栅格图层。':'Current panel: {0} text objects and {1} raster layers.',
    '配色、字号修改后需重新核对碰撞与可读性。':'Recheck collisions and readability after colour or font-size edits.',
    '工程只保存外观差异；新数据请从分析流程重新生成。':'The project records appearance edits. For new data, regenerate from the analysis workflow.',
    '本图没有可编辑文字，路径化或栅格文字不能直接改字体。':'No editable text is present. Outlined or raster text cannot have its font changed directly.',
    '{0} 行 × {1} 列 · {2} × {3} mm':'{0} rows × {1} columns · {2} × {3} mm',
    '已移动 / 交换小图':'Panel moved / swapped','选择面板 ':'Select panel ','已交换小图':'Panels swapped','已恢复版本 ':'Restored version: ','未完成：':'Not completed: ','已撤销':'Undone','已重做':'Redone',
    '原版对照：当前布局与候选，未应用外观修改。':'Original comparison: current layout and candidates without appearance edits.',
    '已返回编辑版':'Returned to edits','已恢复 AI 首版；仍可撤销此次恢复':'First AI draft restored; this reset can be undone',
    '文字类别已选择，下一次文字样式操作将使用此范围。':'Text category selected. The next text-style edit will use this scope.',
    '字号应为 4–72 pt。':'Font size must be 4–72 pt.','已修改文字；请核对标签与数据含义':'Text updated; check its meaning against the data',
    '已应用互补配色':'Complementary colours applied',' · 点击应用（不代表色觉无障碍已验证）':' · Click to apply (colour-vision accessibility not verified)',
    '已更新行列母版':'Grid updated','已应用跨格':'Span applied','间距应为 0–100 pt。':'Gutter must be 0–100 pt.','已修改间距':'Gutter changed','已调整面板顺序':'Panel order changed',
    '请输入版本名称。':'Enter a version name.','已保存 20 个命名版本，请另存工程后继续整理。':'20 named versions are already saved. Download the project before continuing.',
    '已保存命名版本「{0}」':'Saved version “{0}”',
    '已下载工程；包含原图、当前修改和命名版本。':'Project downloaded with source artwork, current edits and named versions.',
    '工程超过 100 MB':'Project exceeds 100 MB','命名版本无效':'Invalid named versions','版本名称无效':'Invalid version name',
    '打开工程将替换当前工作区。若当前修改尚未下载，请先取消并保存工程。':'Opening a project replaces the current workspace. If your edits have not been downloaded, cancel and save the project first.',
    '工程已恢复':'Project restored','已导出可编辑 SVG。请继续运行原 skill 的最终尺寸与排版 QA。':'Editable SVG exported. Run the skill’s final-size and layout QA before delivery.',
    '300 dpi 输出超过 4000 万像素，请导出 SVG 后用专业工具转换':'300 dpi output exceeds 40 million pixels. Export SVG and convert with a suitable tool.',
    'SVG 栅格化失败，请使用 SVG 导出':'SVG rasterisation failed. Use SVG export.','PNG 导出失败':'PNG export failed',
    '已导出 {0} × {1} px；按 {2} mm 放置约为 300 dpi。PNG 本身不含可编辑文字。':'Exported {0} × {1} px; approximately 300 dpi at {2} mm width. PNG text is not editable.',
    '已恢复本浏览器的自动保存。':'Restored this browser’s autosaved project.',
    '未恢复本地缓存；可用「打开工程」导入已保存项目。':'Local autosave was not restored. Use Open project to import a saved project.',
    '无法打开工程：':'Unable to open project: ',
    '个人偏好与推荐':'Personal preferences & suggestions',
    '从主动保存的选择中学习':'Learn from my intentional saves',
    '偏好仅存于本地浏览器。自动保存、悬停和撤销不计入；同一状态重复保存只计一次。积累两次后显示常用选项，始终由你决定是否应用。':'Preferences stay in this browser. Autosaves, hover previews and undo do not count. Repeated saves of an identical state count once. Suggestions appear after two uses; you decide whether to apply them.',
    '清除偏好记忆':'Clear preference memory',
    '偏好记忆未保存；当前图形编辑不受影响。':'Preferences could not be saved; current figure edits are unaffected.',
    '已记住 {0} 次不同的主动保存选择。':'Remembered {0} distinct intentional saves.',
    '偏好学习与推荐已暂停。':'Preference learning and suggestions are paused.',
    '主动保存 {0} 次 · 点击应用':'Chosen in {0} intentional saves · Click to apply',
    '常用配色':'Frequently saved palette','已应用常用配色':'Frequently saved palette applied',
    '已应用常用图型':'Frequently saved chart applied','已应用常用母版':'Frequently saved layout applied',
    '常用母版：{0} 行 × {1} 列':'Frequent layout: {0} rows × {1} columns',
    '继续保存满意的结果，重复使用的偏好会出现在这里。':'Save results you like. Repeated preferences will appear here.',
    '清除本浏览器的偏好记忆？当前图形、命名版本和撤销记录不会删除。':'Clear this browser’s preference memory? Current figures, named versions and undo history will remain.',
    '偏好记忆已清除。':'Preference memory cleared.',
    '再次点击确认清除':'Click again to confirm clearing',
    '恢复刚清除的偏好':'Restore just-cleared preferences',
    '偏好记忆已恢复。':'Preference memory restored.',
    '撤销记录无效':'Invalid undo history','撤销记录与当前状态不一致':'Undo history does not match the current state',
    '已自动保存 · 含撤销记录':'Autosaved · Undo history included',
    '自动保存失败 · 请下载工程':'Autosave failed · Download your project',
    '其他窗口已更新 · 请先下载当前工程':'Another window saved changes · Download this project first',
    '当前编辑已恢复，但旧撤销记录不可用。':'Current edits were restored, but previous undo history was unavailable.',
    '缓存版本无效':'Invalid cached versions',
    '界面语言已切换；图内文字、数据和编辑历史保持不变。':'Interface language changed. Figure text, data and edit history are unchanged.'
  };
  Object.assign(en,{'跨三列横版':'Three-column canvas','占一格':'One cell','占两列':'Two columns','占三列':'Three columns','占整行':'Full row','占两行':'Two rows','当前小图占几个格子？':'How many cells should this panel occupy?','格子是排版单位，不是图片数量。可跨两列、三列或整行；悬停预览，点击应用。':'Cells are layout units, not an image count. Span two or three columns or a full row; hover to preview and click to apply.'});
  en['更多 ROC 方向与所需条件']='More ROC directions and requirements';
  Object.assign(en,{"柱形布局参数无效": "Invalid bar geometry parameters", "已调整柱宽和组间距": "Bar width and group spacing updated", "已恢复自动柱形布局": "Automatic bar layout restored", "柱形布局": "Bar layout", "柱宽": "Bar width", "组间距": "Group spacing", "恢复自动布局": "Restore automatic layout", "只改变横向布局，均值、误差线和纵轴数值保持一致。当前单因素图没有组内多系列间距。": "Only horizontal geometry changes. Estimates, intervals and y-axis values stay fixed. This one-factor chart has no within-group series spacing."});
  Object.assign(en,{'组图字体参数无效':'Invalid composite typography','已统一组图文字规格':'Composite typography aligned','统一组图文字规格':'Align composite typography'});
  Object.assign(en,{"组合状态无效": "Invalid group state", "锁定状态无效": "Invalid lock state", "小图已锁定": "Panel is locked", "元素已锁定": "Object is locked", "请先多选小图或元素": "Select multiple panels or objects first", "已组合": "Selection grouped", "已拆分组合": "Selection ungrouped", "已锁定所选内容": "Selection locked", "已解锁所选内容": "Selection unlocked", "组合与锁定": "Group and lock", "Shift 多选小图或元素。组合小图可整体移至空位；元素组合便于一起选择和修改样式。": "Shift-select panels or objects. Panel groups move together to empty cells; object groups support shared selection and styling.", "组合": "Group", "拆分": "Ungroup", "锁定": "Lock", "解锁": "Unlock"});
  Object.assign(en,{"图号参数无效": "Invalid panel label", "已调整图号": "Panel labels updated", "正式图号": "Exported panel labels", "编号样式": "Numbering style", "按当前顺序编号": "Number in current order", "当前图号": "Current label", "横向位置（%）": "Horizontal position (%)", "纵向位置（%）": "Vertical position (%)", "图号字号（pt）": "Label size (pt)", "图号加粗": "Bold label", "应用当前图号": "Apply current label", "移除当前图号": "Remove current label", "正式图号会导出，随小图移动。使用当前文字字体；编号顺序只在点击编号时更新。": "Labels are exported and move with panels. Uses the selected text font; renumbering occurs only when requested."});
  Object.assign(en,{"比例尺参数无效": "Invalid scale-bar parameters", "请选中一张未旋转的栅格图像": "Select one unrotated raster image", "已更新比例尺": "Scale bar updated", "图像比例尺": "Image scale bar", "先选中栅格图像。填写该图像完整宽度对应的实际微米数，不从截图猜测标定。": "Select a raster image and enter the physical width of its full field in micrometres. Calibration is not inferred from screenshots.", "图像实际宽度（μm）": "Image physical width (μm)", "比例尺长度（μm）": "Scale length (μm)", "位置": "Position", "左下": "Bottom left", "右下": "Bottom right", "左上": "Top left", "右上": "Top right", "线条粗细（pt）": "Bar thickness (pt)", "数字字号（pt）": "Label size (pt)", "数字加粗": "Bold label", "显示底纹": "Show background", "底纹透明度": "Background opacity", "应用／更新比例尺": "Apply / update scale bar", "移除比例尺": "Remove scale bar", "线条和数字使用当前颜色、字体。原图中已经烧录的比例尺不会被删除。": "Uses the selected colour and font. Existing burned-in scale bars are not removed."});
  Object.assign(en,{"间距实时预览": "Live gutter preview", "恢复首版推荐间距": "Restore first-draft gutter", "已恢复首版推荐间距": "First-draft gutter restored"});
  Object.assign(en,{"比较结果无效": "Invalid comparison results", "字母分组需要完整两两比较": "Letter displays require complete pairwise comparisons", "标注样式无效": "Invalid annotation style", "缺少已确认的比较结果": "Confirmed comparison results are missing", "已切换统计标注": "Statistical annotation style changed", "统计标注": "Statistical annotations", "呈现方式": "Display style", "无附加标注": "No added annotation", "括号＋星号": "Brackets + stars", "括号＋井号": "Brackets + hashes", "括号＋具体 P 值": "Brackets + numeric P values", "字母分组": "Letter grouping", "复用已记录比较结果。字母需完整两两比较，共享字母表示未检出差异，不代表相等。符号阈值为 0.05、0.01、0.001、0.0001；图注需说明校正方法。": "Reuses recorded comparisons. Letters require all pairwise results; shared letters mean no detected difference, not equality. Symbol thresholds: 0.05, 0.01, 0.001, 0.0001. State the adjustment method in the caption."});
  Object.assign(en,{"分析选择无效": "Invalid analysis selection", "统计方法与分析结果": "Statistical methods and results", "按研究问题和数据结构排序，不按 P 值大小排序。这里比较已有分析结果，未运行的方法不会显示虚构结果。": "Ranked by research question and data structure, never by P value. Only computed results are compared.", "关注的问题": "Research target", "均值差异": "Mean differences", "秩／分布差异": "Rank / distribution differences", "选择理由": "Selection rationale", "与研究问题、设计和假设的关系": "Relationship to the question, design and assumptions", "此图没有可比较的检验结果。先确认研究设计与分析目标。": "No comparable tests are available. Confirm the design and target first.", "条件推荐：": "Conditional recommendation: ", "备选／敏感性分析：": "Alternative / sensitivity analysis: ", "针对均值问题；独立性或配对结构由分析方案确认。小样本、强偏态和极端值需结合诊断判断。": "Targets means. Independence or pairing must be confirmed by the analysis plan. Evaluate small samples, skew and extreme observations using diagnostics.", "配对秩方法关注差值的秩结构；Wilcoxon 的位置解释需要差值分布对称，不能仅凭“不正态”选择。": "Paired rank methods assess ranked differences. A location interpretation of Wilcoxon requires symmetric differences; non-normality alone is not a selection rule.", "秩方法关注分布差异，不能无条件解释为均值或中位数差异。": "Rank methods address distributional differences, not unconditionally means or medians.", "当前分析包未提供该秩方法的独立效应量区间；不借用均值差 CI。": "This bundle has no separate rank-effect interval; mean-difference CIs are not reused.", "当前选择": "Selected method", "采用这个已计算方法": "Select this computed method", "请填写方法选择与研究问题的关系": "Explain how the method matches the research question", "分析选择已记录，请重新确认统计标注": "Analysis choice recorded; reconfirm statistical annotations", "其他方向需补充条件：协变量调整／ANCOVA 需协变量与模型；混合模型需重复或层级结构；置换检验需可交换性与重排单位；稳健／截尾方法需明确目标量；分类结局需列联表或广义线性模型；生存分析需时间与删失信息。": "Other methods need more context: ANCOVA needs covariates and a model; mixed models need repeated/hierarchical structure; permutation tests need exchangeability and resampling units; robust/trimmed methods need an estimand; categorical outcomes need contingency or generalised linear models; survival methods need times and censoring."});
  en['原图已嵌入主分析 P 值，请先由分析流程重绘']='The artwork contains primary-analysis P values. Regenerate it through the analysis pipeline first.';
  Object.assign(en,{'应用跨格':'Apply span','拖动画布小图移动／交换；拖右边、下边或角点吸附跨格。Shift 多选。也可用行列定位。':'Drag panels to move or swap. Drag right, bottom or corner handles to snap across cells. Shift-select or use row/column controls.'});
  en['图层']='Layers';
  const panelLabels={
    independent:['独立样本比较','Independent-samples comparison'],
    paired:['配对比较','Paired comparison'],
    paired_workbench:['配对比较','Paired comparison'],
    multigroup:['多组比较','Multiple-group comparison'],
    roc:['ROC','ROC'],
    survival:['生存分析','Survival analysis'],
    enrichment:['富集分析','Enrichment analysis'],
    relationship:['相关与回归','Association and regression'],
    timecourse:['时间序列','Time course'],
    composition:['组成比例','Composition'],
    matrix:['矩阵图','Matrix plot']
  };
  function panelName(panel){
    // Localize only recognized generated bundle identifiers; retain stored names.
    if(!['upstream-bundle','local-recomputed'].includes(panel.provenance))return panel.name;
    const recipe=panel.recipe||{},key=panel.name;
    const expected=key==='multigroup'?'independent':key==='paired_workbench'?'paired':key;
    if(recipe.design!==expected&&recipe.family!==expected)return panel.name;
    return panelLabels[key]?.[language==='en'?1:0]||panel.name;
  }
  let language='zh-CN';
  function choose(saved,preferred='en'){return ['zh-CN','en'].includes(saved)?saved:/^zh\b/i.test(preferred)?'zh-CN':'en';}
  function setLanguage(value){language=value==='en'?'en':'zh-CN';return language;}
  function t(text,...values){let result=language==='en'?(en[text]??text):text;return result.replace(/\{(\d+)\}/g,(_,n)=>String(values[+n]??''));}
  return {t,choose,setLanguage,panelName,get language(){return language;},en};
})();
if(typeof module!=='undefined')module.exports=StudioI18n;
