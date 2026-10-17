# Figure Studio appearance and update controls

Figure Studio 0.1.21 adds a dark Carbon Atelier workspace and a light Pearl Pro theme. This guide shows where to change the interface, find tools for the current selection, and turn off the update characters' animation. These preferences do not change scientific figure colours or source image pixels.

[English](#choose-your-workspace) · [中文](#中文) · [Release notes](release-notes-v1.4.21.md)

## Choose your workspace

Open **Appearance** in the header, then choose **Interface theme → Carbon Atelier** or **Pearl Pro**. Carbon is the default: graphite panels, jade actions and a white figure page. Pearl provides a light interface with a darker jade accent.

In the same menu, **Canvas surround** changes only the area outside the figure page:

| Choice | What changes |
| --- | --- |
| Neutral slate | The default grey-blue workspace |
| Dark graphite | A dark surround for inspecting image edges |
| Light neutral | A light surround for inspecting image edges |

The figure page stays white. Use the **Colors** tab or image display tools when you intend to edit the artwork itself; Appearance does not perform that edit. Changing themes does not add an Undo step or modify an exported figure.

The current browser remembers appearance preferences locally. Clearing site data, using a private window or switching browser/profile may require choosing them again. A message in the menu explains if preferences could not be saved. Project JSON files retain the figure and its editing state; appearance preferences belong to the browser.

## Find the tools for your selection

The right inspector identifies the current selection, such as text, image, axes or multiple objects. Common controls are prioritised when the selection type changes; other groups remain available by expanding their headings. Text controls require editable text; a raster image does not acquire editable characters or numerical axes.

The workflow bar retains **Data & discovery**, **Edit artwork**, **Image tools**, **Statistics & axes**, and **Publication export**. Choose **Find command**, or press **Ctrl + K** on Windows, and search for `theme`, `border`, `duplicates`, `axis` or `text colour`. Search navigates to existing controls; it does not run an image check or contact a literature service automatically.

For scientific features, see [Figure Discovery](figure-discovery.md), [image tools](figure-studio-image-tools.md), and [professional axes](figure-studio-axes-round2.md).

## Control update animation

Open **Updates** to check the official release channel. The cat and dog illustrate the current stage; the percentage and byte counts come from the updater. An unknown total does not produce a made-up percentage.

| What you see | What it means |
| --- | --- |
| Downloading your update | The package is still downloading; **Cancel download** is available during download |
| Verifying your update | Downloaded bytes are being checked; download 100% does not mean installation is complete |
| Ready when you are | The package passed verification; save your project and confirm before **Install and reopen** |
| Preparing to install / Installing | The existing backup and installation flow is running; follow any Windows permission prompt |
| Waiting for the updater | Retain the last confirmed stage and package bytes when available; installation progress is unknown. Use **Check progress** before starting another installation |

Clear **Character animation (respects reduced motion)** in the update window to keep the characters still. That choice is remembered by the current browser. A system reduced-motion preference also stops the movement. Stage descriptions, progress numbers and controls continue to update, and the illustrations do not cover them.

Checking/downloading updates requires the network. Local editing, plotting and export remain available offline. The update check sends release information requests, not your images, data tables or projects. Windows portable copies still use manual replacement; the in-app installer flow requires a registered Windows installer edition. See the [English quick start](../desktop/QUICKSTART.en.md) for backups and upgrading older versions.

## 中文

Figure Studio 0.1.21 增加默认深色 **Carbon Atelier** 和可选浅色 **Pearl Pro**。本指南说明实际入口、对象相关工具与更新角色动效的关闭方法；界面偏好不会修改科研图配色或原始图片像素。

### 选择界面与画布周边

在顶部打开**外观**，将**界面主题**切换为 **Carbon Atelier** 或 **Pearl Pro**。默认 Carbon 使用石墨色面板、冷翡翠绿操作强调和白色图纸；Pearl 使用浅色面板与较深的翡翠绿。

同一菜单里的**画布周边**可选**中性灰蓝**、**深石墨**或**浅中性灰**，方便检查图片边缘。它只改变图纸外面的区域，图纸仍为白色。需要修改作品时，请使用**配色**或图片颜色工具；切换外观不会增加一次撤销记录，也不会修改导出图形。

偏好保存在当前浏览器的本机存储中。清理网站数据、使用隐私窗口或更换浏览器／用户配置后可能需要重选；无法保存时，菜单会提示。工程 JSON 保存作品及编辑状态，界面偏好独立保存在浏览器中。

### 按选中内容找工具

右侧检查器显示**当前选中**，区分文字、图片、坐标轴或多个对象。切换对象类别时优先显示相关常用设置；其他分组仍可手动展开。文字格式需要选中可编辑文字，普通位图不会因此变成可编辑字符或数值坐标轴。

顶部保留**数据与智能选图**、**编辑图形**、**图片工具**、**统计与坐标轴**、**投稿导出**五组入口。点击**查找功能**或按 **Ctrl + K**，输入“主题”“改字色”“图片查重”“轴刻度”或“边框”，即可跳到对应的实际工具。搜索本身不启动图片检查或联网文献检索。

具体操作见[智能选图](figure-discovery.md)、[图片工具](figure-studio-image-tools.md)与[专业坐标轴](figure-studio-axes-round2.md)。

### 关闭角色动效并阅读更新状态

打开顶部**更新**，主动检查官方版本。猫狗展示当前阶段，下载百分比和字节数来自真实更新进度；总量未知时不虚构百分比。

下载到 100% 后仍需等待**正在校验更新包**。只有校验完成、进入**准备好了，可以安装**阶段，保存工程并勾选确认项后，才可点击**安装并重新打开**。准备和安装阶段沿用原有备份与安装流程；出现 Windows 权限提示时按系统提示处理。若显示**等待更新器确认**，会在已有记录时保留最后服务端确认的阶段及下载字节；这些是下载包进度，安装进度仍未知。先点**重新获取进度**确认状态，避免重复启动安装。

在更新窗口取消勾选**角色动画（遵循系统降动效设置）**，猫狗会保持静态姿态；当前浏览器会记住选择。系统启用减少动态效果时，也会自动停止动作。阶段说明、进度数字与操作按钮仍正常更新。

检查或下载更新需要联网，断网仍可在本机编辑、绘图和导出。更新查询不发送工程、图片或研究数据。应用内安装流程适用于注册的 Windows 安装版，便携版仍需手动替换。旧版本升级与工程备份见[中文入门](../desktop/QUICKSTART.zh-CN.md)。
