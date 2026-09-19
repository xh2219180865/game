# 原创美术资源

本目录保存“谋定山河”的正式本地素材与制作源，构建复制到浏览器与微信相同路径。图片不包含实际库存、兵数、按钮或卡牌文字；所有交互及真实状态由 Canvas 绘制。

此前方案 A 使用 `a-home.jpg`、`a-cards.jpg`、`a-terrain-plains.jpg`、`a-terrain-snow.jpg`、`a-terrain-desert.jpg`。同名 PNG 是正式制作母版，JPEG 使用 macOS sips 同尺寸编码，质量 76；五张运行图共 1,800,963 字节。另使用 `a-battle.png`（640×640 RGBA、616,913 字节）承载四类三级营地与四兵种，另有 `a-battle-sample.png`（768×512 RGBA、358,796 字节）用于新版三级步兵营和六帧步兵迈步，共七张运行资源。建筑与军士改为手绘立体微缩造型，原有 Canvas 实现仅作加载／绘制失败回退；旧建筑／兵种原图仍保留，已退出运行资源清单与构建包。首页 1024×1536，卡图 1774×887、严格4×2，地表均1024×1536。完整提示词与原始源路径见 [核心插画](../../artifacts/ui-direction-v2/core-art.md) 与 [三种地表](../../artifacts/ui-direction-v2/terrain-art.md)。本轮战场素材使用真实透明母版，校准源区与原始提示词见 [战场造型制作记录](../../artifacts/ui-direction-v2/battle-art.md)。

当前样板制作来源、完整提示词和编码说明见 [A01 战场样板](../../artifacts/ui-direction-v2/battle-sample.md)。两张战场 PNG 母版均保留，不进入构建。

当前运行资源以 `src/render/assets.ts` 的 9 项为准：首页使用 `home-courtyard.jpg`，853×1844、JPEG 70、418,529 字节，替换旧 `a-home.jpg`，不同时打包；PNG 母版保留但不进入运行包。出征前庭背景已去除标题、按钮、胶囊及旗帜文字，全部交互实时绘制。完整提示词和制作说明见 [首页制作记录](../../artifacts/ui-direction-v2/home-courtyard-production.md)。

下表为此前版本保留的资源记录。

素材于 2026-09-12 使用内置 `image_gen.imagegen` 文生图制作。用户草图与原创三屏概念用于理解美术方向，未直接复制竞品人物、标识或页面截图。完整制作提示词见 `sources.json`；它是来源记录，不进入运行包。

| 文件 | 职责 | 处理 |
| --- | --- | --- |
| home.jpg | 全幅城关首页、山水与军案 | 原始 948×1659 PNG 编码 JPEG 65，未裁切 |
| cards.jpg | 七策主题插画 | 原始 1448×1086、4 列×2 行，按行征兵／兼行／乡勇／火袭／屯田／神速／扩营／空白；JPEG 65 |
| buildings.png | 四类三级中性建筑 | 原始 1448×1086 RGBA；十二项使用核验后的独立源矩形，不能等分裁切 |
| troops.png | 保留的早期四兵种姿态图集；当前小兵来自 a-battle.png，art.ts 保留 Canvas 回退 | 原始 1774×887 RGBA；八项独立源矩形，弓与阵营标识实时绘制 |
| terrain-plains.jpg | 平原背景 | 1024×1536，JPEG 65；L01／A01 |
| terrain-snow.jpg | 雪地背景 | 1024×1536，JPEG 65；L02／A02 |
| terrain-desert.jpg | 大漠背景 | 1024×1536，JPEG 65；L03／A03 |

编码使用 macOS `sips`，仅转换发布格式，不重新绘制或改变尺寸。cards 原 PNG 带轻微透明度，JPEG 已铺底并实际检查。构建同步清理输出目录中的旧 JPG／PNG，只复制 `ART_SOURCES` 注册的运行图片，不把制作母版、来源文档与概念稿一起发布。

原始生成记录保存在本机图像输出目录，本轮可重建的编码母版保存在 `.tmp/original-art/masters/`；正式程序不依赖该临时目录。生产图片是本目录中的文件。
