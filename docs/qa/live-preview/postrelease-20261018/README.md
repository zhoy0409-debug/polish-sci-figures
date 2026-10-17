# 2026-10-18 发布后 Windows 更新验收

原官方稳定版 0.1.20 和官方预览版 0.1.21 均通过一次真实官方更新至 0.1.22、同会话自动恢复及独立正常卸载。原 v1.4.22 的 8 项发布资产、标签与原校验文件保持不变。

| 原客户端 → 目标 | 实际输入及结果 | 证据 |
|---|---|---|
| 稳定版 0.1.20 → 0.1.22 | 历史 1 状态、检查点 0、草稿 0；5 次保存均为同一 577820 字节；自动恢复、设置及正常清理通过 | [实际汇总](official20-to22.json) |
| 预览版 0.1.21 → 0.1.22 | 真实 UI 两次编辑后历史 3 状态、检查点 1、有效原表草稿 1；8 次保存均为同一 582496 字节；自动恢复、设置及正常清理通过 | [实际汇总](official21-to22.json) |

两次分别下载／安装各 1 次，原 Iris 150 个观测和 12 个原 SVG 均精确保留。21 的草稿是恢复原表头后的原始 151 行，并非新增测量或新科研分析；其多步历史和非空容器不外推到 20 的单状态／空集合输入。旧 helper 完成记录及 20／21 的 2507／2533 个原程序回滚文件哈希分别通过。

数据来源为 [UCI Iris（Fisher，1936；DOI 10.24432/C56C76）](https://archive.ics.uci.edu/dataset/53/iris)，按 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 使用；本次改变 UI 标签并建立原表草稿，原测量未变。

原严格结果未独立记录内部安装器的数值退出码（`null`）；外层严格脚本实际退出 0。之后各自独立正常卸载的外层与原生卸载器均实际返回 0；四个登记视图为空、自有原生进程已退出、原用户保护实例和外部数据保留由独立清理证据核对。

21 的安装后身份门禁本体退出 0；其附加浏览器数量包装检查失败另行保留。原浏览器基线进程均未改变，另有一个 renderer 的直接父进程属于原基线，未带本次自动化标记或固定源端口；其 URL 和新增原因未知，未停止该进程，不将本项写成所有浏览器为 0。

## 原始媒体与观察边界

- 20：[完整原始 WebM](official20-to22-original.webm)、[下载前](official20-to22-before.png)、[校验完成](official20-to22-ready.png)、[自动恢复后](official20-to22-restored.png)、[去路径时间线](official20-to22-timed-events.json)。实际查看 3 张截图和原录像 30／47／64／115 秒的采样帧。
- 21：[完整原始 WebM](official21-to22-original.webm)、[UI 前置编辑](official21-to22-prelude.png)、[下载前](official21-to22-before.png)、[校验完成](official21-to22-ready.png)、[自动恢复后](official21-to22-restored.png)、[去路径时间线](official21-to22-timed-events.json)。实际查看 3 张截图及前置编辑截图，并查看原录像 25／45／65／95 秒采样帧。

两段旧页面在安装交接时都短暂显示 `paused`／未响应，原画面保留；UI 均未观测到 verifying／installing，后端 installing 握手单独报告，不重建缺失画面。截图和采样帧不等于逐帧观看或光学性能测量。

旧 20／21 helper 没有新 audit，本次不验证新 22 客户端的 audit 或生产 100 ms 轮询；旧 21 控制器为 1000 ms，采集器 100 ms 观察间隔不能替代 UI 阶段证明。本页不新增原生 Windows IME 验收，既有人工结果仍按[原阶段](https://github.com/zhoy0409-debug/polish-sci-figures/blob/main/docs/windows-native-ime-acceptance.md)报告。

## 补充包

[下载独立补充包 Figure-Studio-0.1.22-Postrelease-QA-20261018.zip](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.22/Figure-Studio-0.1.22-Postrelease-QA-20261018.zip)。包内 `MEMBER-MANIFEST.json` 记录成员；外部 [POSTRELEASE-DELIVERY-20261018.json](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.22/POSTRELEASE-DELIVERY-20261018.json) 与 [SHA256SUMS-Postrelease-QA-20261018.txt](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.22/SHA256SUMS-Postrelease-QA-20261018.txt)记录实际字节和校验。补充包不替换原 8 项资产、标签或原 SHA 文件。既有[功能验收](https://github.com/zhoy0409-debug/polish-sci-figures/blob/main/docs/live-preview-validation.md)和[性能范围](https://github.com/zhoy0409-debug/polish-sci-figures/blob/main/docs/stable-performance-validation.md)保持原始数字。
