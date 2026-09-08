# V6 战斗样板素材记录

2026-09-08。由内置 imagegen 生成，Figma 编辑与导出。仅供 Phase A 视觉评审，尚不是微信小游戏运行时资源包。

## 文件

- `moonlit-battle-court-v1.png`：852×1846，RGB 场景底图。无 UI 与目标。
- `jade-seal-atlas-v1.png`：1536×1024，RGB，三种外形 × 两种损伤状态。注意：棋盘格是实际像素，**不是真透明**。Figma 组件使用原生矢量蒙版裁切；运行时使用前须从蒙版材质节点导出真正透明的单体资源，并验证边缘与内存预算，不要直接加载此图集。
- `battle-aim-preview.png` / `battle-chain-preview.png`：Figma 静态截图，375×812。
- `battle-chain-motion.mp4`：Figma 原生 2 秒时间轴的评审导出（375 px 宽 / 10 fps / low），不是运行时性能录像。适合看运动顺序，不用于判断真实帧率。
- 玩家复用 `../v4/spirit-marble-hero-v1.png`，未重新生成。

Figma: https://www.figma.com/design/gjKRKvGp6MMQdpG3DvXnst?node-id=387-7
符印组件：390:2；图集源节点：387:13；底图节点：387:8。

## 最终提示词：战斗场景

```text
Use case: stylized-concept
Asset type: portrait 2D GAME BATTLE BACKGROUND, 750 x 1624 aspect ratio, without UI or gameplay pieces.
Primary request: redesign the reference night garden as a beautifully art-directed playable jade courtyard at night for a premium casual mobile ricochet game. Keep the poetic Chinese moon-garden identity, purple night and teal jade accents, but make it charming, legible and game-like, not a dark wallpaper.
Input image: existing moon garden is environment/world reference only, not a composition to preserve.
Composition: exact front-facing orthographic gameplay plane. Extremely calm open central vertical playfield covering x=9–91% and y=23–80%; this is a smooth matte indigo-violet jade inlay, faint cloudy stone variation only, NO perspective grid, NO central objects or patterns, no distant scenery inside the field. Two narrow sculpted stone edging rails at x≈6% and94%, straight PARALLEL vertical inner edges; extend y≈26–81%. They feel like polished purple jade rim integrated into terrain, delicate cyan inlaid edge, not neon UI lines. At top center around y=20%, a small stylized carved round moon gate crowning the court, recognizable circular aperture, very subtle unlit pale-gold ring, decorative and behind gameplay. It must stay compact ABOVE the open playfield. Beyond that, soft layered violet mountains and a crescent moon in the top quarter, painterly simplified forms.
Bottom 18%: a small elegant jade launch dais centered around y=85%, with a shallow round socket for our spirit ball (ball is not drawn), small mossy stones and two tiny warm lantern accents at far edges. A few refined cloud curls and leafy silhouettes at OUTER EDGES ONLY. Top 12% remains darker and quiet for editable UI text.
Style: polished friendly 2.5D hand-painted casual game environment, rounded tactile carved stone, silk-smooth shading, collectible toy quality, restrained Chinese fantasy. Medium-dark luminous violet rather than black, soft lavender bounce light; center low detail, excellent contrast for golden targets and cyan player.
Avoid: text, letters, numbers, icons, buttons, balls, target stones, glowing paths, UI panels, busy central imagery, giant gate, photorealism, sharp noisy texture, oversaturated rainbow, garish full-screen glow. No black empty void. NO perspective narrowing; visible collision rails stay parallel.
```

## 首次符印图集提示词

```text
Use case: stylized-concept
Asset type: transparent game sprite atlas for a polished, lightweight portrait WeChat ricochet game.
Primary request: A SINGLE precise sprite atlas containing SIX matching amber-yellow jade seal stones, in 3 columns and 2 rows. Top row: intact circle, intact upright rounded equilateral triangle, intact diamond (square rotated 45 degrees). Bottom row: the exact same three stones with hairline fractures and tiny chips, still whole silhouettes. Each cell same square size with generous equal transparent padding. Align object centers to regular cell centers. Identical visual size, lighting and orthographic straight-on camera; slight 3D thickness visible along lower edge, NOT tilted isometric.
Input image: jade spirit character is MATERIAL AND ART-STYLE REFERENCE ONLY; do not copy eyes, face or appendages.
Style: premium friendly casual mobile game art, hand-painted 2.5D sculpted translucent jade, chunky satisfying tactile objects. Warm pale honey-gold face, richer amber lower bevel, subtle cloudy inclusions and rounded light-catching rim. Small discreet carved curved cloud motifs ONLY near edges. Large smooth calm center reserved for editable dark HP number to be overlaid later.
Lighting: soft top-left highlights, gentle lower-right edge shadow, restrained warm bloom, no neon rings.
Constraints: genuine transparent alpha background; no numbers, no text, no labels, no character faces, no frames/grid lines, no extra objects, no drop shadows extending beyond each cell. Each object well separated. Preserve circular / triangle / diamond collision silhouettes. High quality clean edges at small game sizes.
```

## 后续背景提取编辑提示词

编辑参考为首次生成的六格图集，使用内置 imagegen。输出仍为 RGB；实际集成采用 Figma 矢量蒙版，未用外部程序抠图。

```text
Use case: background-extraction
Edit target: the attached six-stone sprite atlas.
Remove ONLY the gray-and-white checkerboard background. It is currently painted into the image; that is incorrect. Return a PNG with real alpha transparency (alpha=0) everywhere outside the six golden stones. NOT a new checkerboard image, NOT white, NOT black. Preserve every stone's exact shape, material, edge detail, cracks, color, size and pixel position. Preserve the 1536 x 1024 canvas and 3-column x 2-row layout. Do not redraw or rearrange anything. No text, no new objects.
```
