# 官方0.1.25 → 0.1.26更新：实际通过范围与隔离验收副本收尾

2026-10-19，原官方25实际发现已公开26，完成一次真实下载、SHA校验、一次确认安装和自然同源自动恢复。公开release 417215091；tag `v1.4.26`，merge `3256d85e46477d061336b00e8afff75cceb5fa45`。**实际升级与所列功能范围通过；验收用隔离测试副本的关闭与卸载尚未执行，finalAcceptance=false。** 隔离验收副本的关闭与卸载请求在进程创建前被审批拒绝，未实际运行；这不是产品升级器的失败，真实升级和上述数据保护已通过。此前最终r2 Setup自身的安装／自检／3项focused／正常重装卸载通过，二者分开记录。

8次普通Save每份均1189526字节，SHA-256 `5849c445820ce0202390357e06252a42c06b68053d85f0df2aad3e5f29512653`。全五容器精确一致，150观察、12原SVG、独立H&E字节保留；实际historyStates=5、index=4、checkpoint=1、dataDraft=1。安装器实际单条exit0；helper自然退出、自动化Chrome根为0，两个保护浏览器根身份不变。目标应用2655项成员逐字节一致；旧25 rollback2629另计，包含旧应用及uninstaller，不能混为目标清单。

所有24个UI／184个被动status采样保留；其中下载UI20、下载status180，两流已知total均106071955字节且各自单调。UI实际见checking/downloading/ready/preparing/installing，**未采到verifying**。后端校验事件独立记录，不补造UI画面。

实际查看3张原PNG、12固定时点接触表及14/18/23秒原尺寸帧；未全片观看。5/26/47/74%逐颗填充和部分水面可见，ready100%与保存确认分开；preparing/installing为空心，未给假安装比例。重开见Iris+H&E双面板。旧25前端驱动本次更新，不声称新版26已下载未来版本。

原114.64秒录像只在[同版本独立Postrelease-QA附件](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.26/Figure-Studio-0.1.26-Postrelease-QA.zip)提供；SHA-256 `5823806d12c2eaa21666585c9e06e8521380a4dfbbeb5f60da719f130c64136a`。原录像纳入同版本独立QA附件；实际公开清单及校验信息以本发行页POSTRELEASE-DELIVERY.json和POSTRELEASE-SHA256SUMS.txt为准。

H&E：Kilbad, distributed by scikit-image，Public domain dedication by author Kilbad；[既有数据来源](https://scikit-image.org/docs/0.25.x/api/skimage.data.html#skimage.data.skin)。Iris沿现有公开UCI Iris150观察fixture及实际保存SHA，不补造工程中不存在的许可URL。只分发获准公共场景；用户私图、原工程与profile/trace不分发。

[专项报告](../../../figure-studio-photo-correction-validation.md)保留原12组照片、173/172/1编辑结果、全部276性能操作与92 CPU窗。大图总等待及5000选择波动不支持通用无退步；未签名、非clean VM、未新增IME／SendInput、无独立标注准确率及pdffonts边界不变。初始八附件及tag永不覆盖；最终说明以独立dated补充提供。
