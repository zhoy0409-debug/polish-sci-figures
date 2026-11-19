---
author: a
created: 2026-11-19
---

# 参照图号对齐验收

以 `8750662b7cf8a28d3e4f43049ea0e515b9e9798f` 为基线。Windows 上使用 Chrome 157.0.8103.79、Node.js 24.18.0 和 Python 3.12.14 测试由源码构建的 Studio 页面。测试用合成数据生成一个带数据及分析记录的小图和两个静态 SVG 小图。B、C 的小图位置有不同的垂直偏移，用于验证基线来自真实画布坐标。

| 场景 | 实测结果 |
| --- | --- |
| 从「图形质检」导出检查清单并导入由清单生成的操作 JSON | A/B/C 的字号从 13/23/17 pt 预览为 13/13/13 pt。100% 缩放下，基线从 262.222/362.551/357.847 CSS px 对齐至 262.222 CSS px。横坐标保持一致。 |
| 预览中保存、取消预览 | 下载的工程仍为已提交状态，历史索引保持 0。取消恢复原始字号和基线。 |
| 保留、保存、关闭后重开 | 历史索引变为 1，新浏览器上下文重开后，实际渲染和已保存状态一致。只修改 B/C 图号的字号及纵向位置，原始图件、数据与分析记录逐项相等。 |
| 重开后一次撤销 | 历史索引回到 0，两个图号恢复原始状态。 |
| 从旧清单生成的操作，参照或目标已编辑 | 分别返回参照或目标过期提示。整批操作拒绝，保存状态及历史一致。 |

复现命令如下。需要 Playwright 能启动本机 Chrome，CI 使用其安装的 Chromium。

```sh
python scripts/build_canvas_round_fixture.py --out .cache/label-match-fixture
node scripts/test_studio_label_match_browser.cjs .cache/label-match-fixture .cache/label-match-browser
```

输出目录包含前后画布截图、`result.json`、实际导出的检查清单和重新打开的工程。验收脚本按已导出的标识和版本生成交接 JSON。此轮实测覆盖源码浏览器流程；Windows 安装包和外部 AI 宿主不在本次实测范围内。
