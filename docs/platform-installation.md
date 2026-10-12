# 在 AI 工具中安装 polish-sci-figures

套件 v1.4.0 提供一个自包含上传包，内含入口技能和完整本机绘图资源。Claude 与 WorkBuddy 用户可直接上传，不必手工重打 ZIP 或让宿主分别寻找三个技能。想直接操作图形的 Windows 用户请使用 [Figure Studio 安装包](../desktop/QUICKSTART.zh-CN.md)，无需安装 AI 技能。

## 下载哪个包

下载 [polish-sci-figures-v1.4.0-skill.zip](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.0/polish-sci-figures-v1.4.0-skill.zip)。它只有一个根目录 `polish-sci-figures/`，根下包含 `SKILL.md`，完整三技能与 CLI 位于内部 `suite/`。保持这个结构，直接上传原 ZIP。

需要自行运行源码、分别管理三个技能时，选择同一发行页的 `sci-figure-suite-v1.4.0.zip`。这两个包用途不同，不要将整个三技能源码包作为单个技能上传。

## 平台入口

| 平台 | 安装方式 | 使用条件 |
| --- | --- | --- |
| Claude | Customize → Skills → + → Create skill → Upload a skill，上传上述 ZIP | 开启代码执行；以账户实际可用功能为准 |
| Claude Code | 解压单入口包，使 `~/.claude/skills/polish-sci-figures/SKILL.md` 存在；也可放在项目 `.claude/skills/` 下 | 本机允许执行 Python，并安装套件所需依赖 |
| WorkBuddy | 技能 → 添加技能 → 上传技能，上传上述 ZIP | 本机执行权限和 Python 依赖可用；项目技能路径为 `.codebuddy/skills/<name>/SKILL.md` |
| Codex 等文件夹技能环境 | 将完整源码套件的三个 `skills/` 子目录放入工具配置的技能目录 | 保留三个配套技能并安装 Python 依赖；参见 [首页](../README.md#ai-与命令行工作流) |

以上入口依据官方文档核对；本版未声称已登录 Claude 或 WorkBuddy 完成端到端实机测试。技能被识别与绘图运行环境可执行是两个步骤：首次运行请让 AI 检查字体和依赖，再处理数据。

官方依据：[Claude 使用技能](https://support.claude.com/en/articles/12512180-use-skills-in-claude)、[Claude 上传包结构](https://support.claude.com/en/articles/12512198-how-to-create-custom-skills)、[Claude Code 技能目录](https://code.claude.com/docs/en/skills)、[WorkBuddy 技能市场](https://www.codebuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Skills-Market)、[WorkBuddy 项目技能](https://www.codebuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Project)。

## 第一次使用

上传或放置目录后，在新会话里启用相应技能，可这样请求：

> 帮我把这张表画成适合论文的图，给我几个合适的样式选一下。

无需先掌握图型名称或统计术语。技能先检查表格，必要时会用“同一批对象的前后变化，还是两批不同对象？”等具体问题确认设计；后续颜色、字体和排版可直接在编辑器中修改。

请提供真实实验单位和研究设计。模板示例不是用户结果；模型解释、汇总分析等模板需要相应计算结果。浏览器精修可独立于 AI 调用，数据重算需要运行套件本机服务；Windows 桌面版会自动启动内置服务。

这些技能由本项目维护，并非 Claude、WorkBuddy 或 Codex 的官方内置产品。下载与更新统一来自 [polish-sci-figures 官方发行页](https://github.com/zhoy0409-debug/polish-sci-figures/releases)。
