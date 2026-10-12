# 用 Figure Studio 完成第一张图

跟着这份图文演示，把数据表变成雨云图，修改文字和组间距，再导出 TIFF。截图来自实际编辑器，合成示例数据也已提供，可以直接跟着操作。

[English](editor-tour.en.md) · [中文](editor-tour.zh-CN.md) · [返回项目首页](../README.md#中文)

这是[首页操作演示](../README.md#看看编辑器怎么用)的静态图文版，可以按自己的节奏阅读，点击图片查看大图。截图使用英文界面，下面同时给出相应的中文按钮名称。

## 1. 打开编辑器

[下载 Figure Studio](https://github.com/zhoy0409-debug/polish-sci-figures/releases/latest)，安装 Windows 桌面版，然后打开 **polish-sci-figures Studio** 快捷方式。启动窗口显示 **Editor is ready** 后，编辑器会在浏览器中打开；需要时可在顶部选择 **中文**。

点击欢迎页面上的 **从模板开始（Start from a template）**。

![Figure Studio 欢迎页面，提供从模板开始的入口。](media/figure-studio-start.png)

## 2. 选择模板

在图形搜索框 **Search charts** 中输入 **raincloud**，点击雨云图卡片上的 **使用示例开始（Start with example）**。此时画布上会出现一张可以继续编辑的图。

![图形仓库中的雨云图模板与可编辑预览。](media/figure-studio-template.png)

## 3. 换成新的数据

打开[演示用 CSV 数据](media/demo-observations.csv)，点击 GitHub 的 **Download raw file** 按钮，把文件下载到电脑。文件包含两组、共 24 条合成观测记录，三列分别为 `group`（组别）、`unit`（观测编号）和 `value`（数值）。

回到编辑器，选中图形，打开 **数据表（Data table）**。点击 **替换 CSV / TSV（Replace CSV / TSV）**，选择刚下载的文件。如果界面提示仍有待应用的数据修改，点击 **立即重算（Recompute now）**，等待图形更新。

![已载入演示数据的雨云图数据表。](media/figure-studio-data.png)

正式作图时，将演示值替换为自己的测量数据，并保留模板要求的列结构。Excel 表格需要先另存为 CSV 或 TSV，再导入编辑器。

## 4. 调整文字和组间距

双击纵轴标题 **Value**，输入 **Response**，按 **Enter** 生效。选中图形，打开 **属性（Properties）**，将 **组间距（Group spacing）** 从 **100%** 调至 **75%**。两组会靠得更近，测量数值保持不变。

![纵轴标题已改为 Response，组间距已调至 75% 的雨云图。](media/figure-studio-refine.png)

想与之前的布局比较时，可以使用 **撤销（Undo）**；文字和间距都可以继续调整。

## 5. 导出并保留可编辑工程

打开顶部工具栏的 **导出（Export）**，选择 **TIF**，将分辨率设为 **600 dpi**，核对成图尺寸后点击 **下载文件（Download file）**。导出的 TIFF 只包含图形，不会带上编辑器的操作控件。

![TIFF 导出窗口，显示输出尺寸与 600 dpi 分辨率。](media/figure-studio-export.png)

需要矢量图时，选择 **导出 → SVG（Export → SVG）**。在组图中只想导出某一个小图，可以右键点击该小图，选择相应的导出选项。

同时点击工具栏上的 **保存（Save）**，下载可编辑的工程 JSON。以后选择 **项目 → 打开工程（Project → Open project）**，就能接着修改数据、文字和布局。

**[下载 Figure Studio](https://github.com/zhoy0409-debug/polish-sci-figures/releases/latest)** · [安装与工程备份](../desktop/QUICKSTART.zh-CN.md) · [完整功能指南](../README.zh-CN.md)
