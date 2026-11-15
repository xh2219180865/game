# 本地题字字集

`shanhe-wenkai.ttf` 用于题名、设置项和操作牌，不替换长正文、倒计时或战场精确人数。来源为设计稿保存的四段 LXGW WenKai TC 字集，原始 URL、SHA-256 与许可见 [来源清单](../../artifacts/ui-direction-v2/page-design/fonts/manifest.json)。完整 SIL Open Font License 保留在 `OFL.txt`。

2026-11-10 发布字集用 fontTools 合并上述四个 TTF，按 `src/render`、`src/core`、`src/app` 的 TypeScript 文案取子集、去 hinting，并将 family／full／PostScript 等名称改为 **Shanhe WenKai**，避免沿用上游保留名称。未改笔画。文件 278,472 字节，包含 611 个 Unicode 映射；SHA-256 为 `6cf3668c5dc8939373fdc891310dfe95c71f8f0919817b3a6366126472dc38ed`。这是有限显示字集，不是完整中文字库；新增文案需检查缺字。

浏览器经 FontFace 从包内加载，微信经可选 `wx.loadFont`；失败或缺字使用系统楷体、宋体、serif。浏览器加载不阻塞开局与存档。字体和许可均随两端构建复制，无 CDN 请求、运行时依赖或系统安装。桌面实际加载证据及真机待验范围见 [开发计划](../../docs/10-开发计划.md)。
