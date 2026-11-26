# Figure Studio：找到功能并完成一次操作

首次打开点 **使用向导**。已有工程从顶部 **向导 → 使用向导** 进入；工具页标题旁的 **怎么用** 直接打开当前工具的步骤。向导不是强制流程，可随时关闭。

在 **全部功能与操作步骤** 搜索任务，例如“箭头”“空格”“TIFF”“组合”“磁吸”。选中功能后点 **打开并保留操作提示**，步骤会留在画布上方，边看边做。点提示标题可折叠，再点展开；**收起提示** 只隐藏说明，不修改作品。功能检索 **Ctrl + K** 用于直接打开工具，向导用于查操作步骤。

工具需要特定对象时，先在画布选中它。原生 SVG 文字和图元可单独编辑；PNG 和扫描 PDF 内部的文字、线条不能拆开改。请先保留或取消当前预览，再从向导进入另一个工具；关闭向导本身会保留正在做的预览。

## 常见任务

| 想完成的事 | 到这里找 | 如何确认有效 |
| --- | --- | --- |
| 从数据生成图表 | 数据与图表 → 数据与智能选图 | 核对变量、设计和实验单位；在画布对照后应用或取消 |
| 导入 TIFF | 导入，或向导搜索 TIFF | 选择平面和显示范围，预览后保留；16 位偏暗时调整显示范围 |
| 改文字、保留多个空格 | 文字与对象样式 → 字体与字号 | 双击原生文字编辑，检查空格；段落组中调整行距和字距 |
| 插入单向或双向箭头 | 标注与测量 → 插入文字、线条与形状 | 选箭头后在画布拖动，拖端点改方向；Esc 取消待放置对象 |
| 把 B、C 贴到 A 的高度 | 向导搜索磁吸，或直接拖图号 | 固定 A，只拖 B/C；出线时文字基线同时贴齐，松手保留；Alt 临时跳过 |
| 图片和文字一起移动 | 排版与画布 → 组合与取消组合 | Shift 多选后组合，整体拖动；取消组合恢复单独编辑 |
| 垂直或斜向距离标定 | Ctrl K 搜索两点标定，或图片向导 → 两点标定 | 选原图，沿已知距离拖两点，输入真实长度和单位，再添加比例尺 |
| 照片校色或图表换色 | 选中对象后的校色／换配色 | 先预览；PNG 图表用显示调整，图元改色需源 SVG 或数据 |
| WB、荧光图像显示 | 图片处理 → WB 或图片显示 | 核对原图与显示参数；显示调整不代替定量归一化 |
| 检查并导出 | 检查与导出 → 图形质检／投稿导出 | 主动检查，核对实际尺寸和 DPI，保留工程备份后导出 |
| 让 AI 只修改一个小图 | 向导搜索 AI，或图形质检中的 AI 协作 | 选目标生成任务，导回预览；目标已变、锁定或工程不匹配时拒绝写入 |

## 保存与恢复

带 **保留／应用** 按钮的工具先确认预览，再保存工程。普通编辑用 **Ctrl Z** 撤销，**Ctrl Y** 或 **Ctrl Shift Z** 重做。重开保存的工程，检查图层、图号、样式和数据；导出的 PNG/TIF 不能替代可编辑工程。

离线 HTML 提供同一套向导。需要重新计算数据、生成模板或执行某些本机分析时，使用桌面编辑器，或按 Skill 交付说明启动本地服务。界面会说明所需条件。

## English

Open **Usage guide** on the welcome screen, **Guide → Usage guide** in the header, or **How to use** beside a tool title. Search **All functions & steps**, select a task, then choose **Open with on-canvas steps**. Instructions remain above the canvas; collapse their title or dismiss the tips without changing the project. **Ctrl K** opens commands directly.

Select the appropriate canvas object first. Keep or cancel an active preview before starting another tool from the guide. Closing the guide itself preserves the draft. Save an editable project, then reopen it to verify layers, labels and styles. Raster image internals require the source SVG or data for element-level editing. Offline HTML includes the guide; data recomputation and engine-dependent tools require the desktop editor or local service.
