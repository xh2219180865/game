# 战场材质与七策器物

2026-11-15：战场地表重制为俯视开阔场地，母版为 [field-terrain-master.png](field-terrain-master.png)，使用 **内置 imagegen**；输入全文见 [field-terrain-prompt.json](field-terrain-prompt.json)。工具原始文件名 `exec-3d0479c3-3b1a-4160-8722-16be01650583.png`。此母版替代下文 terrain-master 的运行地表，但保留历史母版，不改营寨、军士和器物图集。

运行导出：`uv run --with pillow==13.0.0 python artifacts/ui-direction-v2/battle-style/export-field-terrain.py`，只裁切、等比缩放与 JPEG 编码。结果为 `assets/art/field-{plains,snow,desert}.jpg`；精确尺寸、字节、SHA-256 在 [field-terrain-manifest.json](field-terrain-manifest.json)。Pillow 仅为制作工具，不进入项目依赖。图像不包含文字、道路或玩法对象，构建从清单取三张替换图，不同时携带旧地表。

2026-11-13，依据用户要求，以现有首页 `assets/art/warfront-home.jpg` 为画风参照，使用 **内置 imagegen** 生成三张制作母版。当前文件是实际运行素材的来源，不是另一套页面概念稿。完整输入见 [image-prompts.json](image-prompts.json)；实际导出尺寸与 SHA-256 见 [export-manifest.json](export-manifest.json)，不能把提示词中的期望尺寸当作输出尺寸。

| 母版 | 内置工具输出文件 | 用途 |
| --- | --- | --- |
| terrain-master.png | exec-ac95d2bd-efb4-4d1f-8eeb-bc2d5beb10bf.png | 三种无道路、无建筑地表；灰岩、旧土、疏林 |
| camps-master.png | exec-6be4f873-2483-43bf-a02b-aa3475dbe7f6.png | 十二个分级营寨和四个静态军士源窗 |
| strategies-master.png | exec-40754d6d-1b9d-4870-ba8d-b8e5910540f0.png | 号角、行装、盾矛、火罐、粮束、缰具、木栅 |

`export-assets.py` 只做裁切、等比缩放、透明留边与编码；使用制作期 Pillow 13.0.0，不加入项目依赖。仓库内母版足以重新导出，不依赖生成工具的个人目录。可运行 `uv run --with pillow==13.0.0 python artifacts/ui-direction-v2/battle-style/export-assets.py`。营寨按 alpha 包络重排为 768×768，源窗记录于 `camp-regions.json`；四类既有六帧行军图集保留，静态第四行不替代行军动画。

正式输出位于 `assets/art/`：`battlefield-plains.jpg`、`battlefield-snow.jpg`、`battlefield-desert.jpg`、`siege-camps.png`、`strategy-props.png`。替换五个运行路径，图片总数仍为 14；旧资产保留为历史源，不同时打包。图鉴／选策的旧绢底裁切现有军图案，由 Canvas 绘制夹木条；文字、数量、等级、道路和桥梁仍实时绘制。

图案只表达现有七策：火罐不新增火焰伤害，行装不把兼行限制为骑兵；锁态及图片失败仍有 Canvas 回退。地图、营地与策略 ID、规则、存档和操作范围不变。已验证与待验范围统一记在 [开发计划](../../../docs/10-开发计划.md)，截图和测试日志仅放 `.tmp/first-version/battle-style-20261113/`。
