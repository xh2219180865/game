# 原创美术资源

## 2026-11-04 山川地貌图集（正式运行新增一张）

内置 imagegen 以现有 `warfront-camps.png` 为画风参考制作6组低矮山脊／山石：3列为平原、雪地、砂地，2行为变化。母版 `warfront-landforms-master.png`（1536×1024）保留，运行版 `warfront-landforms.png`（384×256，95,420字节）经sips等比编码；该次只调整新素材发布尺寸，未降低旧营地／军士图集质量。内置原文件 `exec-298f6ac5-62df-44e3-b305-6f38c98ecc02.png`。母版及运行版均是真RGBA透明区，实际alpha与裁切窗由测试解码，不把预览底色当透明证明。

运行清单新增landforms后共10张；6个源窗由src/render/assets.ts的LANDFORM_SPRITE_CROPS定义，山石在规划包络内等比底对齐，失败使用同包络Canvas回退。河流、水纹与木桥按真实道路在Canvas绘制，不把整张概念地图带入游戏；运行不依赖母版或.tmp文件。微信4MiB与至少512KiB余量的既有检查保持。

完整生成提示词（内置 imagegen；仅参考原营地画风，不编辑原图）：

```text
Use case: stylized-concept
Asset type: ONE production transparent terrain sprite atlas for an original late-Han Chinese military outpost game. EXACT 3 equal columns by 2 equal rows, landscape canvas 3:2. Six fully isolated compact hand-painted rocky ridges. Reference image is for the existing camp sprites' brush detail, miniature high oblique projection and restrained natural colors only. No buildings in output.
Each cell has ONE entire asymmetrical low mountain ridge cluster made of 3-5 unequal rounded broken crags with smaller loose scree at the feet, generous 12% transparent margins, all roots and tiny bushes INSIDE its cell. Camera high oblique 3/4, light from upper left, all on same plane and foot baseline, ratio each cluster width:height about 1.6:1. Readable at 65px wide on a phone, crisp broken outer silhouettes and coarse warm rock strata; painterly rough detail matching the reference. These must look organic and weathered, NEVER regular triangles, pyramids, crystal points, polygon meshes or flat vector symbols. Not huge towering scenic mountains, not distant blue fog, no black outlines. No rectangular ground tiles, no sky or landscape background.
Top left: weathered grey olive rocks with ochre faces, sparse dark small pines and dry shrubs, sprawling low ridge.
Top middle: cold grey ridge with small pale snow patches settled in crevices, sparse small firs; stone remains visible, not white glacier.
Top right: warm grey sandstone broken low ridge with tan faces, dry grass and sparse scrub; not orange desert.
Bottom left: second grassland ridge variation, slightly narrower, blunt outcrops, dark olive sparse brush.
Bottom middle: second cold rocky snow variation, low broken boulders with snow in shade and tiny firs.
Bottom right: second warm sandstone variation, flat broken slabs and scree with tiny scrub.
True transparent alpha background around all six sprites, no painted checkerboard, no frame, no grid lines, no text, no letters, no labels, no flags, no units, no bridges or water. No cast shadows outside each cell. Restrained muted earth pigments; avoid fantasy, neon, glow, saturated green, photorealistic 3D and exaggerated cartoon proportions.

```


## 十策图标设计（2026-11-04，未接入运行）

[设计资产](../../artifacts/strategy-design-v1/README.md) 保存内置 imagegen 概念板、十张独立透明 SVG 母稿、完整提示词与交互分镜；规格见 05 G8／09 H9。母稿和概念板均未加入本目录正式素材清单，不替换 a-cards，不增加运行图片或微信包体。正式采用时需另做 PNG／Canvas 接入及真机核验。

## 2026-11-03 城池与四军整套重做

本节为当前城池／兵种素材入口，替代下方旧图集运行说明。内置 imagegen 新制四张 RGBA 图集，取代 `a-battle.png`、`a-battle-sample.png`、`a-troop-motion.png`、`a-cavalry-motion.png` 的运行路径，旧源文件保留但不打包；运行图片仍为 9 张，不叠加新旧两套。全六图、战前／图鉴／军令继续共用同一绘制入口。

| 正式运行图 | 尺寸 | 字节 | 制作母版文件名 |
| --- | --- | --- | --- |
| warfront-camps.png | 640×640 | 649,664 | exec-9f9eb55a-700d-4c5c-9fa9-d19eb357c20e.png |
| warfront-infantry.png | 768×512 | 345,268 | exec-fa8aa448-6a81-441a-9f7b-ef1b4fdf8e0f.png |
| warfront-foot.png | 1024×341 | 351,464 | exec-3b4d0033-c9f6-4b2f-b305-d8e11a109489.png |
| warfront-cavalry.png | 576×384 | 222,045 | exec-edaac9f9-de15-428a-8b38-2f0ec46caa8e.png |

母版均位于 `/Users/xuhe/.codex/generated_images/01a1a1a5-d98d-7263-a9ad-afbb8cdb0ca6/`；本机 sips 等比缩小只作发布编码，生产代码不依赖母版目录。骑兵和步兵初稿存在半透明底色，分别经内置图像工具做背景提取后才编码；初稿 `exec-ef7e5f09-3421-413b-bf8d-658ecc9dc167.png` 和 `exec-fb9aa4d7-187e-40d0-be45-77d9e22b7469.png` 没有发布。最终图以实际 alpha 解码验证透明区、非空源窗、四类脚部轮廓变化和无裁切，不把预览底色当透明证据。

城池图集是十二座独立完整营地和四种静态军士；三级用木栅、石墙院、成套门楼角楼递进，弓架／靶场、马厩／拴马、盾矛架、独立高塔分别识别兵种。四兵种各六帧；裁切采用校准后的独立 UV，每类等尺寸窗口，保持绘制锚点和实际队首不变。屋面及中立墙面染色按新素材重定位并验证不越出建筑透明边缘。没有把概念图中的字样、旗号、火器或虚构兵数带入游戏。

### 原始生成提示词（内置 imagegen）

**camps**

> Production sprite atlas for an original late Han Chinese ancient warfare mobile strategy game. Cohesive hand painted 2.5D miniature game art, high oblique view, left upper light, charcoal grey tiled roofs, aged ochre timber, dark desaturated blue grey lamellar armor, muted warm highlights, crisp strong silhouettes readable when downscaled. Real transparent alpha background, absolutely no painted checkerboard, no text, letters, labels, numbers, flags, UI or ground background. Each object completely isolated with transparent gutters. No Western castles, fantasy, modern guns or gold ornament. Square image, STRICT FOUR EQUAL COLUMNS AND FOUR EQUAL ROWS, 16 individual sprites, one object centered within each cell, generous transparent gap; no sprite crosses cell borders. Rows 1-3: exactly TWELVE complete standalone camps, not assembled parts. Columns left to right: infantry barracks, archer training camp, cavalry stable, defensive watchtower. Row 1 tier one: small wooden palisade courtyard with ONE modest building; infantry has shield-and-spear rack at gate, archer has clearly visible round target and bow rack, cavalry has tethered small horse and stable lean-to, tower is a distinctly tall narrow square wooden watchtower with an enclosed ground stockade. Row 2 tier two: enclosed stone-and-timber courtyard with a gated entrance and flanking work sheds; retain each type's clear shield rack / target range / open stable with horse / tall stone lookout identity. Row 3 tier three: fortified compact stone settlement with robust gatehouse and paired corner defenses, larger wall mass and roof tiers, keep each type's primary function visually unmistakable; tower must emphasize a tall central stone watchtower, cavalry must visibly include stable paddock, archer must include open target range. Each camp has complete outer wall/palisade, courtyard ground INSIDE wall only, deep gate recess, textured timber and tiled roofing. Bottom front gate points to lower right, all 12 share same oblique angle. Camps should substantially fill 80% of each square cell, rows 1 to 3 read progressively larger and stronger, not same building recolored. NO hanging flags, no colored faction identifiers, no large shadows outside sprite. FOURTH ROW: four standalone static soldier sprites in same columns: spear-and-round-shield infantry, bow-in-hand archer, mounted lancer on brown horse, heavy rectangular-shield garrison guard. All face right in three quarter view, full bodies, feet on same baseline. The last row is only four soldier sprites, no buildings. 4x4 regular atlas.

**infantry**

> Production sprite atlas for an original late Han Chinese ancient warfare mobile strategy game. Cohesive hand painted 2.5D miniature game art, high oblique view, left upper light, charcoal grey tiled roofs, aged ochre timber, dark desaturated blue grey lamellar armor, muted warm highlights, crisp strong silhouettes readable when downscaled. Real transparent alpha background, absolutely no painted checkerboard, no text, letters, labels, numbers, flags, UI or ground background. Each object completely isolated with transparent gutters. No Western castles, fantasy, modern guns or gold ornament. Landscape image, STRICT THREE EQUAL COLUMNS by THREE EQUAL ROWS, NINE cells. Row 1 contains exactly three complete infantry barracks at levels 1, 2, 3: low timber palisade and shield/spear rack, enclosed courtyard with tiled gate, fortified stone gatehouse with paired corner towers. Neutral grey roofs and weathered timber. Rows 2 and 3 contain SIX successive walk cycle animation frames of THE SAME infantry soldier facing screen-right in three quarter view: row 2 left to right frames 1 2 3; row3 left to right frames4 5 6. Han infantry wears a broad grey lamellar cuirass, small rounded helmet with short black neck guard, ochre sash and brown boots, carries a compact round shield on near arm and a long vertical spear on far side. No plume or long streaming cloth. Full spear and helmet inside every cell. Frame1 left foot reaches forward heel down, right leg reaches back; frame2 left leg supports with right heel lifting; frame3 right knee clearly raised passing left leg; frame4 right foot reaches forward heel down; frame5 right leg supports with left heel lifting; frame6 left knee raised passing right. Same soldier scale, head height, spear orientation, body center and exact ground baseline across all six cells. Animate LEG JOINTS, feet are visibly different; do not just slide or rotate the same sprite. All feet on common relative baseline 88% cell height. Infantry occupies 70% cell height with whitespace above spear tip and generous side gutters. Crisp bold dark silhouette, no detached shadows, no checkerboard.

**foot**

> Production sprite atlas for an original late Han Chinese ancient warfare mobile strategy game. Cohesive hand painted 2.5D miniature game art, high oblique view, left upper light, charcoal grey tiled roofs, aged ochre timber, dark desaturated blue grey lamellar armor, muted warm highlights, crisp strong silhouettes readable when downscaled. Real transparent alpha background, absolutely no painted checkerboard, no text, letters, labels, numbers, flags, UI or ground background. Each object completely isolated with transparent gutters. No Western castles, fantasy, modern guns or gold ornament. Landscape image. STRICT SIX EQUAL COLUMNS by TWO EQUAL ROWS, 12 full-body character animation frames, one centered in each cell. Top row: SIX successive walk cycle frames of the SAME Han archer; bottom row: SIX frames of the SAME Han garrison guard. All face screen-right in three quarter view. ARCHER: lighter grey lamellar vest, short brown sleeves, compact helmet, a prominent large curved wooden bow visibly held in near hand, quiver with feathered arrows on back, no spear, no shield. GUARD: bulky dark lamellar coat, heavier closed helmet and neck guard, massive upright rectangular wooden shield with metal edging covering near forearm and torso, short sword on far side, NO bow, no tower carried, visibly broader than archer. Colors neutral muted slate and ochre, no faction colors. Each row one consistent character identity, proportions and equipment across six frames. Same ground baseline 90% within each cell, same torso height and scale. Frames1 to6: left-foot-forward contact, weight shifts onto left and right heel lifts, right knee lifted in passing, right-foot-forward contact, weight shifts onto right and left heel lifts, left knee lifted in passing. Clearly articulate knees and boot positions in every adjacent frame; do not rotate or slide same image. Weapons are stable but arms swing a little. Occupy 75% cell height, full limbs and all weapon tips inside cell with generous transparent gutters, no characters cut off or touching. No figures besides these exact 12.

**cavalry**

> Production sprite atlas for an original late Han Chinese ancient warfare mobile strategy game. Cohesive hand painted 2.5D miniature game art, high oblique view, left upper light, charcoal grey tiled roofs, aged ochre timber, dark desaturated blue grey lamellar armor, muted warm highlights, crisp strong silhouettes readable when downscaled. Real transparent alpha background, absolutely no painted checkerboard, no text, letters, labels, numbers, flags, UI or ground background. Each object completely isolated with transparent gutters. No Western castles, fantasy, modern guns or gold ornament. Landscape image, STRICT THREE EQUAL COLUMNS by TWO EQUAL ROWS. Exactly SIX successive trot cycle animation sprites of the SAME mounted Han cavalry lancer on the SAME brown horse, all facing screen-right in side three quarter view. Frame order top row 1 2 3, bottom row4 5 6. Rider has dark slate lamellar cuirass, compact helmet, ochre saddle cloth, long upright wooden spear, no banner or plume. Horse is a sturdy small brown warhorse with black mane and tail, visible leather reins, functional saddle, four distinct articulated legs. Rider remains seated and steady, horse silhouette must stay consistent in length and scale, same torso center and common hoof contact baseline at 90% each equal cell. Frame1 near foreleg forward and diagonal far hindleg forward, frame2 weight bearing with opposite knee lifting, frame3 passing pose with two clearly lifted hooves, frame4 opposite diagonal reach, frame5 opposite weight bearing and knee lift, frame6 opposite passing pose. Include believable shoulder/knee/hock articulation; distinct legs and hoof silhouettes in all six frames, not sliding the whole horse or changing camera. Whole horse and rider and full vertical spear visible inside each cell, horse body occupies 75% cell width, at least 10% transparent left and right gutters and clear space over spear tip. No detached shadows or ground.

### 背景提取提示词（内置 imagegen）

**骑兵**

> Background extraction only. The reference is the EDIT TARGET: a 3 column by 2 row six-frame cavalry game sprite sheet. Remove the ENTIRE grey background including all gradient and ground shadows between and inside the horse legs, under the hooves, around spear shafts and between rider and reins. Output genuinely transparent alpha PNG, not a colored or checkerboard background. Preserve all six existing mounted soldiers and horses, their exact positions, proportions, scale, colors, camera, animation poses and spear tips; do not add or remove frames, do not redraw or invent legs, do not rearrange cells. Crisp antialiased cutout edges, no opaque halo or detached shadow. Keep the same 3x2 layout and canvas aspect.

**步兵**

> Background extraction only. EDIT TARGET is this original 3x3 atlas: row1 three infantry camps, rows2-3 six infantry walk frames. Remove ALL brown/grey/black gradient background and ALL soft outer ground shadows, including between the spear shafts and bodies and between legs. Genuine transparent alpha PNG with fully empty transparent gutters and no painted matte or checkerboard. Preserve all nine existing sprites, all exact positions, animation poses, armor, spear tips, camp walls and inside courtyard earth. Keep the same 3 columns and 3 rows and same aspect. Do not redraw the characters, do not crop or merge cells. Isolate only the three camps and six men with clean antialiased cutout edges.


本目录保存“谋定山河”的正式本地素材与制作源，构建复制到浏览器与微信相同路径。图片不包含实际库存、兵数、按钮或卡牌文字；所有交互及真实状态由 Canvas 绘制。

此前方案 A 使用 `a-home.jpg`、`a-cards.jpg`、`a-terrain-plains.jpg`、`a-terrain-snow.jpg`、`a-terrain-desert.jpg`。同名 PNG 是正式制作母版，JPEG 使用 macOS sips 同尺寸编码，质量 76；五张运行图共 1,800,963 字节。另使用 `a-battle.png`（640×640 RGBA、616,913 字节）承载四类三级营地与四兵种，另有 `a-battle-sample.png`（768×512 RGBA、358,796 字节）用于新版三级步兵营和六帧步兵迈步，共七张运行资源。建筑与军士改为手绘立体微缩造型，原有 Canvas 实现仅作加载／绘制失败回退；旧建筑／兵种原图仍保留，已退出运行资源清单与构建包。首页 1024×1536，卡图 1774×887、严格4×2，地表均1024×1536。完整提示词与原始源路径见 [核心插画](../../artifacts/ui-direction-v2/core-art.md) 与 [三种地表](../../artifacts/ui-direction-v2/terrain-art.md)。本轮战场素材使用真实透明母版，校准源区与原始提示词见 [战场造型制作记录](../../artifacts/ui-direction-v2/battle-art.md)。

当前样板制作来源、完整提示词和编码说明见 [A01 战场样板](../../artifacts/ui-direction-v2/battle-sample.md)。两张战场 PNG 母版均保留，不进入构建。

当前运行资源以 `src/render/assets.ts` 的 9 项为准：平原环境已改为下述 `warfront-ground.jpg`，旧 `a-terrain-plains.jpg` 保留为源记录但不再打包；首页使用 `home-courtyard.jpg`，853×1844、JPEG 70、418,529 字节，替换旧 `a-home.jpg`，不同时打包；PNG 母版保留但不进入运行包。出征前庭背景已去除标题、按钮、胶囊及旗帜文字，全部交互实时绘制。完整提示词和制作说明见 [首页制作记录](../../artifacts/ui-direction-v2/home-courtyard-production.md)。

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


## 2026-11-03 夯土战场样板

运行文件：`warfront-ground.jpg`，1024×1536，318,701 字节。使用内置 imagegen 文生图制作；母版位于 `/Users/xuhe/.codex/generated_images/01a1a1a5-d98d-7263-a9ad-afbb8cdb0ca6/exec-f85f2159-b048-48db-b782-98db15c46790.png`，以 `sips -s format jpeg -s formatOptions 65` 转换发布格式，不重绘、不裁切。A01 以 86% 不透明度叠于底色；L01 复用淡化层。替换资源清单中的平原路径，图片数仍为 9，旧原图不删除；正式运行只依赖本目录 JPEG，不依赖母版目录。

素材只含开放泥土、低矮碎草和屏边松石。营地、路线、数字、军旗、UI 与效果全部实时绘制，不把概念截图作为战场。概念图中生成的官衔、国号、库存和火器没有接入游戏。

生成提示词（内置工具原文）：

> Use case: stylized-concept. Asset type: production background texture for portrait 2D Canvas mobile ancient Chinese warfare strategy game. Generate ONLY the bare battlefield ground, no UI, no buildings, no troops, no text, no flags, no roads, no paths, no boundaries, no grid, no stones in circular objectives. Tall portrait 2:3 image. High oblique top down hand painted game terrain consistent with late Han miniature war camps. The entire central 90% is open traversable dusty ochre clay earth, worn compacted dirt, subtle broken dry moss and muted olive grass patches, tiny flat gravel, painterly texture, irregular soft natural color planes of warm earth and cooler shadow. NOT pale mint green or white paper. Medium value readable ochre ground like an authentic trampled encampment. Strong atmospheric depth from cooler desaturated far TOP to warmer foreground bottom, restrained saturation. Only the outermost 3% left and right edges and bottom 6% may contain cropped dark pine branches and weathered grey angular boulders, enough to frame foreground without covering gameplay. Top 8% has very distant low scrub blending into ground, no horizon, no sky, no mountains, no river or body of water. Clear center, rich tactile soil but avoid high frequency detail or dark blotches. Left upper light, soft grounded side shadows at edges only. Original handcrafted game production art, visually rich 2.5D, no photorealism, no Japanese architecture or fantasy magic. This will be used behind existing precisely placed nine miniature camps; do not invent camps or roads. All routes will be drawn separately by the engine.
