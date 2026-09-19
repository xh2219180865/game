# 青瓦城关 · 营地、军士与控件精修

本页是上一轮制作记录。当前运行图集已重新编码为 640×640，步兵营和步兵由后续样板替换，当前来源与验证见 [A01 战场样板](battle-sample.md)。

制作与接入：2026-09-13。沿用用户选定的方案 A，为四类营地各制作三级外观，并重做四兵种造型。以下记录正式运行资源；历史候选不进入构建。

## 正式素材

- 制作方式：内置 `image_gen.imagegen` 文生图；原创青瓦白墙、木构与铜饰微缩造型，没有直接采用竞品截图。
- 生成原文件：`/Users/xuhe/.codex/generated_images/01a08b3a-f48b-7c23-ba25-d055e32a4ee7/exec-01dc96d6-158a-4d90-9a85-24a1e84f7a3e.png`。
- 正式母版：[a-battle-master.png](../../assets/art/a-battle-master.png)，1254×1254 RGBA，不进入运行包。
- 运行图集：[a-battle.png](../../assets/art/a-battle.png)，864×864 RGBA，1,108,009 字节；macOS `sips -Z 864` 等比缩小，未用程序重新绘画。
- 源矩形：[battle-sprite-regions.ts](../../src/render/battle-sprite-regions.ts)。12 座营地与 4 个军士逐一校准，不能按等分网格直接裁切。

一级以单体营房／训练设施为主；二级增加院墙、附房与防护；三级强化门楼、重檐及城防体量。步营的盾矛、弓营的箭靶、马厩的马匹及塔营的高台维持跨等级身份，不只改变颜色或数字。

渲染保留真实阵营旗形、兵数、营地命中范围与塔射方向。第三级步营源区左下角有邻格长矛尖，运行绘制仅裁去该空白角；步兵裁区避开上方邻格，矛尖由 Canvas 补绘。不得以规则或兵数变化掩盖素材问题。

军士采用步兵长矛圆盾、弓兵弯弓箭囊、骑兵完整人马、守备兵重盾的独立轮廓；运行时补阵营束带，左右镜像跟随行军方向，轻微摆动和起伏表达行走。当前是单姿态图集加程序运动，尚未制作逐帧关节动作。

返回、暂停、关闭等由 [game-controls.ts](../../src/render/game-controls.ts) 原生绘制青玉铜框、暖白符号及按下厚度变化，不增加按钮图片。加载或绘图失败使用原有 Canvas 建筑／士兵回退。

两次后续网格整理／透明提取候选未产生真实透明通道，均未接入；最终使用最初的真实 RGBA 母版。运行图集透明像素 367,377／746,496，近不透明像素（alpha≥240）299,887；缩放后大量主体 alpha 为 254，透明检查不能只统计精确 255。

## 原始生成提示词

```text
Use case: stylized-concept. Asset type: production sprite atlas for an original Chinese mobile strategy game, Qingwa Chengguan visual theme. Generate ONE square PNG sprite sheet with GENUINE TRANSPARENT ALPHA BACKGROUND, no white or checkerboard pixels. Exactly 4 columns and 4 rows, 16 equal square cells, generous transparent gutters. Each separate object centered within its cell, entirely contained, occupying 80% width/height. No labels, text, UI, flags, banners, people near buildings, scenery, ground tiles, panels or frames. Professional polished hand-painted 2.5D mobile game art, charming premium miniature dioramas, 3/4 isometric front-right view, warm sunlight upper left, deep occlusion shadows, layered teal blue-grey tiled roofs, carved eaves, warm ivory plaster, rich dark timber, aged brass highlights, stone plinths. Chunky readable silhouettes, vivid coherent materials, crisp anti-aliased edges, substantial architecture rather than flat icons. Soft painted forms, not geometric vector clipart, not photorealism. Row 1: level 1 [military barracks with round shields and spears beside gateway; archery training hall with large target and bow rack; open wooden horse stable with visible brown horse; tall square stone defensive watchtower with exposed wooden firing deck and large ballista]. Row 2: same four building types level 2, expanded wings, enclosing walls, taller roofs and richer architecture, identities unchanged. Row 3: same four level 3, impressive small fortified complexes with double eaves, gate towers, stone defenses; military training hall / target practice hall / stables / high ballista tower MUST remain clearly different. Match footprint at each level, taller and richer not crowded with dozens of tiny objects. Row 4: four individual full-body readable Chinese ancient warriors, feet at same baseline, 3/4 view facing right, matching painted miniature style, approximately 3-head-tall heroic mobile proportions. [spear infantry with round bronze shield and lamellar armour; archer with conspicuous curved bow and back quiver; armoured rider on a complete brown horse, long cavalry spear; heavy guard with large rectangular bronze tower shield and heavy helmet]. Soldiers neutral charcoal/ivory armour and small muted teal cloth, no flags or faction colours. Strong facial/helmet contrast, metal edge lights, distinctive weapons, two separate feet/hooves visible. No sparkles or spell effects. Background must be completely transparent and all objects independent with no contact across cell edges. Keep everything original, premium illustrated strategy game sprites that remain readable at 60px buildings and 32px troops.
```

## 验证范围

850 项自动测试、类型检查、浏览器／微信构建通过。正式包目录 3,108,058 字节；微信 CLI auto-preview 成功，实际包体 3,147,265 字节（约 3.00 MiB），低于 4 MiB。浏览器检查四类三级外观、320／375 小屏与 430 对照图，独立内存验证一级→二级升级、出兵、暂停与继续。此记录不代替新版真机触摸、帧率和完整对战验收；详细状态见开发计划。
