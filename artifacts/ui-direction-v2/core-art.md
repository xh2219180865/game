# 方案 A 核心插画来源与验证

使用内置 imagegen，未使用 CLI 或代码绘制替代。风格参考为已实际查看的 [方案 A 样稿](four-screens-refined.png)，仅借用用户选定的原创视觉方向。图像中的文字、按钮和数值不作为素材。

## 交付

- [首页背景](../../assets/art/a-home.png)：1024 × 1536，RGB；青瓦白墙城门、天空与暖白地面，无界面文字。已实际目检，完整城门适合竖屏全幅，底部留有操作区。
- [七策插画](../../assets/art/a-cards.png)：1774 × 887，RGB，严格 4 列 2 行等分（每格 443.5 × 443.5，可按图宽／4与图高／2浮点裁切）。顺序征兵、兼行、乡勇、火袭／屯田、神速、扩营、留空。已逐格目检，无标题／数值／按钮，七策主体完整，卡图中的旗是插画道具，不参与战场阵营识别。
- [不透明建筑候选](buildings-opaque-candidate.png)：1448 × 1086，4 列 3 行，列步／弓／骑／塔，行一／二／三级。十二营与顺序已目检，但三次生成／透明修订均输出烘焙棋盘 RGB，`sips -g hasAlpha` 为 `no`，不符合透明精灵交付要求。不得接入透明营地渲染，未创建 `assets/art/a-buildings.png`。保留候选供评估，未以代码抠图或未经授权的 CLI 绕过工具限制。

## 原始生成文件

- home：/Users/xuhe/.codex/generated_images/01a095f6-4641-7a11-bc57-83b35f4bac74/exec-e2c427bd-bdb0-4566-b389-6ee7265d7f15.png
- cards：/Users/xuhe/.codex/generated_images/01a095f6-4641-7a11-bc57-83b35f4bac74/exec-10c0370e-f52a-4b84-82ed-7e9a8b13b2a0.png
- buildings：/Users/xuhe/.codex/generated_images/01a095f6-4641-7a11-bc57-83b35f4bac74/exec-7b470128-1a21-451b-a657-393d161c1d01.png
- 建筑透明修订：/Users/xuhe/.codex/generated_images/01a095f6-4641-7a11-bc57-83b35f4bac74/exec-62361528-b6e9-4534-8c2a-3ab9e14f315a.png
- 建筑最终尝试：/Users/xuhe/.codex/generated_images/01a095f6-4641-7a11-bc57-83b35f4bac74/exec-11bc5dbc-1b50-4893-8de5-7298e6a10fc7.png

## 完整提示词

### home

```text
Use case: stylized-concept. Create an original production-ready portrait game background, 1024x1536, for 四方夺城 lightweight Chinese mobile game. Reference image is STYLE REFERENCE ONLY: reproduce the approved scheme A bright hand-painted Qingwa city gate, ivory walls, jade green foliage and pale mountain atmosphere, not its UI or text. View a welcoming ancient Chinese gate courtyard: center lower-middle elegant substantial grey-blue tiled city gate with ivory stone walls, wooden doors, few jade shrubs, softly painted mountain silhouettes and clear pale blue sky. Bright calm daylight, painterly refined illustration, crisp bold architecture silhouettes, subtle texture, restrained warm gold detail. Composition: top 25% mostly quiet pale sky for runtime title, middle 40% beautiful layered city gate, lower 35% broad simple warm ivory paving fading softly to light ivory so runtime controls can overlay. No people close to camera, no flags with baked faction colors. No text, Chinese characters, numbers, calligraphy, logos, buttons, frames, UI or watermark anywhere. Do not copy the reference layout. Full-bleed finished background image.
```

### cards

```text
Use case: stylized-concept. Production game illustration atlas, exact 4 columns x 2 rows equal cells on a 2048x1024 landscape canvas. Reference image is STYLE REFERENCE ONLY, approved scheme A: bright clean Chinese antiquity illustration, grey-blue Qingwa tiled roofs, ivory walls, jade green, warm paper, subtle golden details, small-screen crisp silhouettes. Each cell is a square standalone illustration with quiet pale ivory backdrop, no border, no rounded card corners, no gaps needed, content centered with 8% inset and no overlaps with neighboring cell. Strict reading order LEFT TO RIGHT TOP THEN BOTTOM: 1 mobilize army: a large traditional bronze war drum, drumsticks and grouped spears at Chinese barracks, no numbers. 2 forced march: two infantry soldiers jogging swiftly with small speed ribbons on a path, light jade uniform. 3 village volunteers: three volunteer infantry rallying in front of a tiled gate, round shield and spear, immediately visually distinguishable from cell 1 drum. 4 fire raid: a flaming arrow and a compact burning supply cart, stylized safe flame plume, no people hurt. 5 farming: golden rice stalks, overflowing grain baskets beside a small field and hoe, peaceful. 6 speed training: one galloping horse with rider and elegant wind swoosh, clearly cavalry. 7 camp expansion: a neat enlarged walled barracks with an added courtyard gate and tiny construction beams, clearly building expansion. 8 bottom right completely empty pale ivory. No text, no letters, no numbers, no symbols resembling text, no UI, no button or title. Seven full scenes only; do not duplicate or exchange scenes.
```

### buildings

```text
Use case: stylized-concept. Production transparent PNG sprite atlas, exact 4 columns x 3 rows equal rectangular cells, landscape 2048x1536. Reference is STYLE REFERENCE ONLY. Create twelve original Chinese camp building sprites in approved scheme A bright painterly miniature style: blue-grey Qingwa tiled roofs, ivory stone/plaster walls, warm timber columns, jade-green modest foliage; clean bold silhouettes readable at 60px. GENUINELY TRANSPARENT ALPHA background, no white fill, no checkerboard baked in. Each isolated building centered in its own 512x512 cell with at least 10% clear transparent margin on all sides; full roofs, walls and ground bases entirely within cell. Consistent isometric 3/4 camera, north roof face visible, daylight upper-left. Exact columns left to right: infantry barracks identifiable by paired upright spears and small shield by entrance; archery barracks identifiable by large curved bow and circular target; cavalry stable identifiable by visible horse and open stable door; defensive arrow tower clearly tall square watchtower with crenellations and bow platform. Exact rows top to bottom: level 1 small single basic building; level 2 larger two-roof building with stronger courtyard/stone foundation; level 3 grand fortified multi-roof compound, or tall elaborate tower for column4. Twelve distinct complete sprites, same style and ground plane, tier upgrade visually obvious. NO faction-colored flags or banners (runtime will add flags), no characters walking, no text, no numbers, no labels, no grid lines, no UI, no watermark. Transparent outside the twelve compact sprites; shadows very subtle and local.
```

### 建筑透明修订

```text
Use case: background-extraction. Edit the reference building sprite atlas. Keep all twelve Chinese building sprites EXACTLY the same composition, architecture, type, colors, details and 4 columns x 3 rows ordering. CRITICAL: remove the entire grey-and-white checkerboard background and output a REAL transparent PNG with alpha channel. The checkerboard in source is an unwanted opaque background, NOT the desired transparency. Do NOT paint a transparency grid into the image. Every pixel outside the building silhouettes and their compact bases should be fully transparent (alpha 0). Keep all whole sprites separated within equal cells with clear transparent margins. No new elements, no flags, no grid lines, no text. Deliver real RGBA PNG transparency, not RGB checkerboard. This is a precise background removal only.
```

### 建筑最终尝试

```text
Use case: stylized-concept. Make a game-ready cutout sprite sheet with TRANSPARENT BACKGROUND. It must be a PNG with real alpha transparency, NOT a rendered checkerboard pattern. Twelve isolated Chinese ancient buildings in equal 4 columns by 3 rows grid. All around objects is transparent empty space. For reference use only the blue roof ivory wall architecture and painterly bright friendly style, absolutely none of its UI, text, flags or layout. Each grid cell generous margins and complete entire building. From left to right columns are: infantry barracks with shield and spears, archery lodge with bow and target, cavalry stable with horse, tall defensive watchtower. Top row small basic tier, middle row medium upgraded tier, bottom row grand fortified tier. Three-quarter isometric, clean crisp silhouettes and modest painted detail suitable for 60px gameplay; uniform directional lighting. Buildings occupy middle 75% of each equal cell, tall tower no more than85% cell height. Clear gaps between twelve isolated complete buildings. No faction banners, no text, no UI. Alpha transparent export, no background pixels, no checkerboard painted texture.
```

