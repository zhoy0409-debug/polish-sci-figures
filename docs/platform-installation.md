# 在 AI 工具中安装 polish-sci-figures

[English](platform-installation.en.md) | [中文](platform-installation.md)

套件 v1.4.10 提供一个自包含上传包，内含入口技能和完整本机绘图资源。Claude 用户可直接上传，不必手工重打 ZIP 或让宿主分别寻找三个技能。想直接操作图形的 Windows 用户请使用 [Figure Studio 安装包](../desktop/QUICKSTART.zh-CN.md)，无需安装 AI 技能。

## 下载哪个包

下载 [polish-sci-figures-v1.4.10-skill.zip](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.10/polish-sci-figures-v1.4.10-skill.zip)。它只有一个根目录 `polish-sci-figures/`，整个 ZIP 中仅有一个入口 `SKILL.md`。完整三项工作流以 `WORKFLOW.md` 存放在内部 `suite/`，CLI 与运行资源一起保留。保持这个结构，直接上传原 ZIP。

v1.4.0 上传包内含四个 `SKILL.md`，已在真实 Claude 上传中确认被拒绝。v1.4.1 已通过 Claude 实际上传验证，v1.4.10 延续其单入口结构。请下载当前版本，不要继续上传旧文件。

需要自行运行源码、分别管理三个技能时，选择同一发行页的 `sci-figure-suite-v1.4.10.zip`。这两个包用途不同，不要将整个三技能源码包作为单个技能上传。

## 平台入口

| 平台 | 安装方式 | 使用条件 |
| --- | --- | --- |
| Claude | Customize → Skills → Yours → Add skill → Upload skill，上传上述 ZIP | 开启代码执行；以账户实际可用功能为准 |
| Claude Code | 解压单入口包，使 `~/.claude/skills/polish-sci-figures/SKILL.md` 存在；也可放在项目 `.claude/skills/` 下 | 本机允许执行 Python，并安装套件所需依赖 |
| Codex 等文件夹技能环境 | 将完整源码套件的三个 `skills/` 子目录放入工具配置的技能目录 | 保留三个配套技能并安装 Python 依赖；参见 [产品指南](../README.zh-CN.md#ai-与命令行工作流) |

Claude 上传入口按本次实际界面记录，其他入口依据官方文档核对。首次运行时，技能要求代理先检查现有 Python 和依赖：优先项目虚拟环境，再检查工具提供的运行时，实际导入科学计算包后复用同一个解释器。不能假定系统的 `python` 就是合适版本，也不能假定工具自带 Python 已安装 SciPy。随后检查字体并处理数据，无需用户猜路径或另写检查提示词；不会自动修改系统 PATH 或全局安装包。

官方依据：[Claude 使用技能](https://support.claude.com/en/articles/12512180-use-skills-in-claude)、[Claude 上传包结构](https://support.claude.com/en/articles/12512198-how-to-create-custom-skills)、[Claude Code 技能目录](https://code.claude.com/docs/en/skills)。

## 第一次使用

上传或放置目录后，在新会话里选择相应技能。**Claude 用户先点击输入框旁的 `+` → Skills → polish-sci-figures**，一键插入技能，再上传表格并用日常语言请求：

> 帮我把这张表画成适合论文的图，给我几个合适的样式选一下。

不要仅凭“已经安装”判断技能一定被调用。普通请求不保证自动触发：实际测试中，未选择技能时 Claude 曾自行编写绘图代码，这不计作本技能通过。先用上面的菜单选择即可，无需记忆调用语法。

无需先掌握图型名称或统计术语。技能先检查表格，必要时会用“同一批对象的前后变化，还是两批不同对象？”等具体问题确认设计；后续颜色、字体和排版可直接在编辑器中修改。

请提供真实实验单位和研究设计。模板示例不是用户结果；模型解释、汇总分析等模板需要相应计算结果。浏览器精修可独立于 AI 调用，数据重算需要运行套件本机服务；Windows 桌面版会自动启动内置服务。

## 实际验证

Codex 本机新手流程已复测图库入口：使用实际通过依赖导入的项目 Python 3.12，在未设置 `PYTHONUTF8`、管道编码为 GBK 时，图库列表仍能完整输出中文和科学下标并解析为 JSON；指定 `--palette journal_blue_red` 能生成包含对应颜色的 SVG。另有 5 项回归覆盖正常与错误输出、配色校验、默认配色保留及换色前后几何一致性。

Claude Sonnet 5.5 Medium 中，先从菜单选择技能，再提供 16 行合成数据和普通中文请求，并确认独立实验单位及 mg/L 单位。宿主实际运行了 `doctor`、`workflow` 和 `candidate`，生成 PNG/PDF/SVG、候选 ZIP 和 HTML；PNG 已完成视觉检查。使用日常语言反馈后，HTML 已以一列打开选定的估计图，并通过英文界面视觉检查。CLI 现支持保留显式选定的候选图，单面板默认一列。Claude 下载链路尚未验证，因此不称整条交付流程一次通过。

这些技能由本项目维护，并非 Claude 或 Codex 的官方内置产品。下载与更新统一来自 [polish-sci-figures 官方发行页](https://github.com/zhoy0409-debug/polish-sci-figures/releases)。
