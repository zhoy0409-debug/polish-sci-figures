# 实际手动覆盖安装 0.1.22 → 0.1.23

本组验收使用原始官方 0.1.22 安装程序和本次原始 0.1.23 Setup，在隔离安装目录、默认子配置和同一浏览器会话中完成覆盖安装及自动恢复。[汇总](summary.json)与[实际阶段](phases.json)记录安装、启动、覆盖升级和正常卸载；`officialInAppFlow=false`，不是编辑器自动下载或更新助手验收。

升级前通过真实“打开／保存”操作建立工程和 IndexedDB 自动保存。升级后浏览器重新访问同一地址，先验证自动恢复，未用再次打开工程文件补救。升级前后及双主题检查的保存文件均为 582496 字节，SHA256 同为 `1974a7b03b462aa46fde5bae5d7a39902305b1751d8dfd6965df24b155f9a975`。完整五个核心容器保持一致，包括 150 条公开 Iris 观测、12 份原 SVG、3 个历史状态、1 个检查点和1 份数据草稿；设置字节不变。正常卸载后，完整外部配置和已完成的浏览器证据文件保持一致，四个 AppId 视图均不存在。

为使这组手动升级保持离线，测试主动终止了自动 `/api/updates` 请求。现有 `engineFetch` 错误分支因此显示黄色本机服务断线提示，原始前后截图保留这一状态。实际原生健康检查、安装来源及默认更新能力均通过；这些截图支持工程保留和恢复结论，科研计算与编辑验证见独立的[功能回归](../functional/README.md)。

用户主动关闭旧窗口后，先前一次性能测量的结束保护检查失败，结果未计入匹配比较。继续验收前重新核对同一测试副本的完整程序、设置、注册和健康状态，并显式更新保护基线。历史安装／启动记录未重跑或重写。更早的手动安装因原来源目录变成链接，在 Setup 启动前被拒绝，见[保留尝试](retained-attempts.json)。

[升级前截图](before-manual-setup-upgrade.png) · [自动恢复后截图](actual23-automatic-project-recovery.png) · [原始完整录屏](original-manual-upgrade.webm) · [原始媒体哈希和采样审核范围](media.json)。仅静帧及列出的录屏采样点经过人工查看，不宣称逐帧审查。

This proves a real manual Setup overwrite, same-origin automatic recovery and exact saved-payload preservation on one Windows device using an owned headless Chrome context. The editor's official stable-release download, verification, helper handoff and reopen remain a separate acceptance after 0.1.23 first becomes public. No new native IME, clean-VM or all-workflows claim is made here.
