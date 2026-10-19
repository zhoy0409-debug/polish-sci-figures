# 官方0.1.25 → 0.1.26更新：实际通过范围与隔离验收副本收尾

**状态时点说明：下方首段保留初次审批拒绝后的历史状态；用户随后明确授权，隔离验收副本已正常关闭并卸载，当前所列范围 finalAcceptance=true。日期化实际结果见页末，不倒写原始11个附件。**

2026-10-19，原官方25实际发现已公开26，完成一次真实下载、SHA校验、一次确认安装和自然同源自动恢复。公开release 417215091；tag `v1.4.26`，merge `3256d85e46477d061336b00e8afff75cceb5fa45`。**实际升级与所列功能范围通过；验收用隔离测试副本的关闭与卸载尚未执行，finalAcceptance=false。** 隔离验收副本的关闭与卸载请求在进程创建前被审批拒绝，未实际运行；这不是产品升级器的失败，真实升级和上述数据保护已通过。此前最终r2 Setup自身的安装／自检／3项focused／正常重装卸载通过，二者分开记录。

8次普通Save每份均1189526字节，SHA-256 `5849c445820ce0202390357e06252a42c06b68053d85f0df2aad3e5f29512653`。全五容器精确一致，150观察、12原SVG、独立H&E字节保留；实际historyStates=5、index=4、checkpoint=1、dataDraft=1。安装器实际单条exit0；helper自然退出、自动化Chrome根为0，两个保护浏览器根身份不变。目标应用2655项成员逐字节一致；旧25 rollback2629另计，包含旧应用及uninstaller，不能混为目标清单。

所有24个UI／184个被动status采样保留；其中下载UI20、下载status180，两流已知total均106071955字节且各自单调。UI实际见checking/downloading/ready/preparing/installing，**未采到verifying**。后端校验事件独立记录，不补造UI画面。

实际查看3张原PNG、12固定时点接触表及14/18/23秒原尺寸帧；未全片观看。5/26/47/74%逐颗填充和部分水面可见，ready100%与保存确认分开；preparing/installing为空心，未给假安装比例。重开见Iris+H&E双面板。旧25前端驱动本次更新，不声称新版26已下载未来版本。

原114.64秒录像只在[同版本独立Postrelease-QA附件](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.26/Figure-Studio-0.1.26-Postrelease-QA.zip)提供；SHA-256 `5823806d12c2eaa21666585c9e06e8521380a4dfbbeb5f60da719f130c64136a`。原录像纳入同版本独立QA附件；实际公开清单及校验信息以本发行页POSTRELEASE-DELIVERY.json和POSTRELEASE-SHA256SUMS.txt为准。

H&E：Kilbad, distributed by scikit-image，Public domain dedication by author Kilbad；[既有数据来源](https://scikit-image.org/docs/0.25.x/api/skimage.data.html#skimage.data.skin)。Iris沿现有公开UCI Iris150观察fixture及实际保存SHA，不补造工程中不存在的许可URL。只分发获准公共场景；用户私图、原工程与profile/trace不分发。

[专项报告](../../../figure-studio-photo-correction-validation.md)保留原12组照片、173/172/1编辑结果、全部276性能操作与92 CPU窗。大图总等待及5000选择波动不支持通用无退步；未签名、非clean VM、未新增IME／SendInput、无独立标注准确率及pdffonts边界不变。初始八附件及tag永不覆盖；最终说明以独立dated补充提供。


## 2026-10-19：隔离验收副本已完成正常收尾

用户明确允许关闭并正常卸载本次隔离验收副本后，继续执行原有受保护门禁的 `NormalCleanup`，实际通过。完成时间为UTC `2026-10-19T12:58:59.8672045Z`；正常卸载实际退出码0，HKCU/HKLM × 32/64位四视图全部不存在，整个外部profile、proof、prelude与input逐项保留，保护门禁通过（2个原浏览器根）。原阶段同时要求自有测试副本已停止、安装EXE不存在、所用端口无监听；这些是该阶段成功所包含的检查，不冒充额外独立查询。详见[实际日期化清理证据](cleanup-20261019.json)。

当前实际官方25→26升级、所列功能／科学数据保护及已授权测试环境收尾均通过，`finalAcceptance=true`仅适用于既有列明范围。最初被审批拒绝、尚未执行的[完整旧状态](https://github.com/zhoy0409-debug/polish-sci-figures/blob/980ce9c01b6a029ba4e6308b943a2c7f010016c6/docs/qa/photo-correction/windows-0.1.26/official-update.json)及旧normalCleanup块保留于历史，不重写为首次即完成。全部性能波动、原失败、媒体抽样限制、未新增IME／SendInput、未独立标注准确率及未签名等边界不变。

已发布的原11个附件、安装包、tag均保持不变；只另加同版本日期化 `Figure-Studio-0.1.26-Cleanup-Acceptance-20261019.json`，其内容与本页cleanup JSON完全相同，不重建安装包或原ZIP。

独立只读收尾查询另实际确认：自有原生进程0、安装EXE不存在、原端口无监听、四视图均absent、2个保护浏览器根身份与二进制不变；再次校验8份保存文件与设置。收尾后的保留文件计数为profile 2642、proof 14、prelude 16、inputs 1。完整集合前后逐SHA相等来自原NormalCleanup实际Snapshot/SameSnapshot检查；独立查询没有再做第二次整集合重哈希。
