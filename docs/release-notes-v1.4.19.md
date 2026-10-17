# Suite v1.4.19 · Figure Studio 0.1.19

Figure Discovery turns uploaded tables and confirmed study-design information into scientifically eligible, editable previews. It reuses the existing editor, analysis and rendering pipeline, with one versioned local rule engine shared by the Skill and CLI.

- Data profiles distinguish observed, declared, inferred and unknown information. Pairing, independence and biological replication require confirmation.
- Candidate cards explain the scientific emphasis, conditions and limitations. Ineligible views are excluded; restricted data may produce fewer than three alternatives.
- CSV/TSV and local XLSX import, real-data previews, apply, undo/redo and project save/reopen are supported.
- Europe PMC is optional and user-triggered. Only public search keywords are sent. Verified figure captions, abstract-inferred types and topic-only articles are distinguished. No paper images are redistributed; OpenAlex is not active.
- Windows x64 installer and portable builds bundle Python and plotting dependencies; the desktop interface requires neither system Python, Node.js, Codex nor an API key.

See [usage](figure-discovery.md), [scientific/source validation](figure-discovery-validation.md), and the release attachments for installer hashes and actual Windows acceptance. This Windows release does not replace the published 0.1.18 Mac/Android development previews or establish new physical-device acceptance. The Windows executable is unsigned.

## 中文

本版新增可实际使用的“智能选图”：上传数据、确认实验设计后，比较不同科学展示重点的真实数据预览，再应用到原编辑器。图形知识库与规则引擎由 Skill、CLI 和 Figure Studio 共享。

- 区分已观察、用户确认、未核实推断和未知信息，不擅自认定配对、独立或生物学重复。
- 提供候选理由、条件、限制和真实数据图；排除不适用图型，不为凑数量生成错误方案。
- 支持本地 CSV／TSV／XLSX、应用与撤销重做、工程保存重开。技术重复、汇总数据和已有组学分析结果按各自条件处理。
- 文献检索由用户主动触发，只发送公开关键词；已核实图注与仅主题相关论文明确区分，不转发论文图片。断网仍能本地选图、绘图、编辑和导出。
- Windows 安装版与便携版自带 Python 和绘图库，普通用户无需安装 Node.js、Codex 或配置 API 密钥。

使用步骤见 [智能选图指南](figure-discovery.md)及随包中英文入门文档。安装包实际验收与哈希见发行附件；尚未完成的科学场景与验证范围见[验证记录](figure-discovery-validation.md)。本次不更新已发布的 0.1.18 Mac／Android 开发预览，也不新增手机真机验收。Windows 程序尚未数字签名。
