# polish-sci-figures v1.4.3

[English](release-v1.4.3.en.md) | [中文](release-v1.4.3.md)

套件 v1.4.3 与 **Figure Studio 0.1.3** 通过分步引导和直接的图形反馈，降低数据分析与图形精修的使用门槛。

## 本版更新

- **继续编辑已有图形。** 导入 SVG，或选择 PDF 中的一页；受支持的原生文字与路径保持可编辑，内嵌图片仍是图片。独立的 PDF 特效可回退为局部图片图层；依赖背景的混合或透明效果若无法逐对象保真，则整页保留为外观图像。这是转换限制，不代表原 PDF 仅包含图片。转曲文字与扫描文字不会被误称为可编辑字符；导出前请检查本地字体替代效果。
- **跟着引导选择统计方法。** 自动识别常见组别、数值与编号列；确认研究设计和比较目标后，按推荐顺序展示适用方法及简要说明。选定方法即可计算并预览图内结果，确认后再应用。推荐依据是适用性，不是哪个方法的 *P* 值更小。
- **继续精修自动标注。** 选中单根比较线即可调整左右端点、线宽、括号形状，也可恢复自动位置。标注文字支持内容和局部字符格式编辑。应用新的分析时会提示重置手动统计文字与位置，撤销可恢复此前版本。
- **更容易画出想要的直线。** 水平线和垂直线工具保持固定方向，可拖动任一端点调整长度。自由直线支持方向吸附及 Shift 限定角度；比较括号便于手动标注。插入文字后直接在落点编辑。
- **在出错的位置修正数据。** 粘贴表格（包括 Excel 区域）或导入 CSV/TSV，先 **检查数据**，再 **更新图形**；无效单元格会被标出并说明原因。保留可编辑草稿与最后有效图形，不会仅因数值偏大或偏小就静默删除，或武断地视为错误。
- **一眼区分配色方案。** 科研红蓝仍为默认，同时提供蓝橙青、青绿珊瑚、紫金、Okabe–Ito 多组配色与同色阶方案。预览使用当前图形；发散热图保留中性色中心。
- **直接调整样本点与误差棒。** 支持的图形可用实时滑块调整样本点大小、误差棒端帽长度和线宽。竖向误差棒可显示仅上、仅下或双向，以真实估计值为截点，兼顾非对称区间与对数轴。

表格本身无法确定的研究设计信息仍需用户确认。二元、计数、生存或模型结果不会被强行套入不适用的连续变量检验，可连接专门分析的结果。外观编辑保留数据及原有不确定性定义。

## 下载

| 安装包 | 用途 |
| --- | --- |
| [Windows 安装包](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.3/polish-sci-figures-Studio-0.1.3-Setup-x64.exe) | Windows 10/11 x64；已包含运行环境 |
| [Windows 便携版](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.3/polish-sci-figures-Studio-0.1.3-Portable-x64.zip) | 完整解压后运行 `Figure Studio.exe`，保留 `_internal` 文件夹 |
| [单入口技能上传包](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.3/polish-sci-figures-v1.4.3-skill.zip) | 用于兼容技能宿主；整个压缩包仅有一个 `SKILL.md` |
| [三技能源码套件](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.3/sci-figure-suite-v1.4.3.zip) | Codex 等文件夹技能环境，或本机命令行 |
| [SHA256SUMS.txt](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.3/SHA256SUMS.txt) | 核对上述四个文件 |

升级前请用 **保存** 下载工程 JSON，关闭 Figure Studio 后运行新安装包；通过 **项目 → 打开工程** 继续编辑。详见 [桌面版入门](../desktop/QUICKSTART.zh-CN.md) 与 [平台指南](platform-installation.md)。
