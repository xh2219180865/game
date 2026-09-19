# 三类兵种动作制作记录

2026-09-13。使用内置 imagegen 模式制作；未使用 CLI/API，未对候选做代码抠图。所有运行图保留原始 alpha，母版不打包。

## 交付与接入

- `assets/art/a-troop-motion-master.png`：1536×1024 母版；运行图 `a-troop-motion.png` 为 640×427、348,484 字节，只使用弓兵与守备兵各六帧。中间骑兵行边界不合格，因此没有使用该行。
- `assets/art/a-cavalry-motion-master.png`：1536×1024 独立宽格骑兵母版；运行图 `a-cavalry-motion.png` 为 640×427、239,026 字节，六帧。
- `src/render/troop-motion-regions.ts` 记录统一尺度的源区；不逐帧缩放人物，底部锚点固定。四类兵种共享已有按实际行进距离推进的帧号，减少动态及拥挤保留静态姿态。
- 加载失败先回退原手绘兵种，再回退 Canvas；弓兵真实齐射时仍保留抬弓亮线。

最初两张候选无 alpha，未纳入项目资源。重新生成取得真实透明母版后，逐个检查裁切边界；骑兵改用独立图集解决跨格问题。图片由系统 `sips` 等比缩小，未绘制、修补或合成像素。

## 本地验收

像素回归读取实际 PNG，检查透明占比、非透明主体、18 个源区边缘不裁切、足部轮廓差异。绘制回归覆盖六帧、左右朝向、固定世界锚点、Canvas 状态恢复、加载失败回退及真实抬弓。375 宽浏览器实查帧图、四兵种同时行进、1000／1100 ms 真实兵数、弓兵齐射；兼行骑兵到达时间 1956→1438 ms、库存 3→2。

全量 `npm run check`：886 项、0 跳过，类型检查及两端构建通过。微信构建目录 3,570,070 字节／4 MiB（3.40 MiB）。随着新增两张运行图，回归包体预算从 3 MiB 调整为 3.5 MiB，保留至少 512 KiB 余量；硬上限 4 MiB 及超 1 字节拒绝用例保持。没有放宽透明／边界断言。

浏览器及模拟器证据的最新范围以 `docs/10-开发计划.md` 为准，构建成功不等于真机验收。

## 最终提示词：弓兵与守备兵母版

```text
Production sprite sheet, transparent background. 18 separate Chinese ancient miniature game units in exactly SIX COLUMNS and THREE ROWS, 1536x1024 landscape. Real transparent alpha PNG cutouts. Row1 six sequential walking frames of one teal-cloth bronze-armoured ARCHER holding a recurved bow. Row2 six sequential trotting frames of a teal-armoured CAVALRY rider with vertical spear on a chestnut horse. Row3 six sequential walking frames of a heavy GUARD with bronze tall shield and short sword. Every figure faces RIGHT, consistent near-side view and same stable torso placement in each cell. Compact 3.5-head human proportions, charcoal lamellar armour, muted teal cloth, metal helmets with ivory plumes. Bright polished hand-painted 2.5D mobile game style with clean chunky readable silhouettes. Six DISTINCT leg poses per row: contact, down, raised knee passing, opposite contact, opposite down, opposite raised knee passing; horses show distinct trotting hoof articulation. Six equally spaced centers, same foot baseline across each row, entire figure and all weapons fully INSIDE each cell with 15% EMPTY TRANSPARENT PADDING, especially cavalry tails and spears. No overlaps, no ground, no shadows, no text, no labels, no numbers, no extra objects. Transparent background around every cutout. Export a PNG with genuine alpha channel; absolutely no opaque backdrop, no painted checkerboard pattern.
```

## 最终提示词：独立骑兵母版

```text
Production game sprite sheet with TRANSPARENT BACKGROUND. Exactly SIX images in THREE COLUMNS by TWO ROWS, on a 1536x1024 landscape canvas. Each cell is 512x512. Each image is one Chinese cavalryman in muted teal cloth, charcoal lamellar armour, ivory helmet plume, on a compact chestnut horse facing RIGHT with upright spear. SAME rider, horse, costume, scale, stable torso and consistent foot baseline. SIX SEQUENTIAL TROT FRAMES, ordered left-to-right then next row: left diagonal contact, left diagonal down, right diagonal passing raised, right diagonal contact, right diagonal down, left diagonal passing raised. Visibly distinct realistic four-hoof positions with bent joints; don't duplicate the same pose. Polished hand-painted 2.5D miniature Chinese mobile game style, readable at 38 pixels wide, warm bronze tack. Whole rider, all spear, all horse tail, all hooves completely inside each cell. Occupy only central 70% of cell width and 75% height: at least 70 px transparent margins left and right, and 60px at top and bottom. No sprites touch or overlap. Each horse stands on the same local baseline y=440 in its own cell. No text, no numbers, no flags, no landscape, no shadows, no floor. True transparent alpha PNG cutouts, no background and absolutely no painted checkerboard pattern.
```

