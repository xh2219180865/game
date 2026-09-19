# 方案 A 战场地表素材

本轮按用户选定的方案 A 生成并用于本项目。使用内置 image_gen，不使用 CLI 或外部检索素材。参考图只提供美术方向，未复刻参考图中的城池、道路或按钮。

## 交付与接入

三张均为 1024×1536 的不透明 PNG；原始输出直接复制入项目，未做图像修改或格式转换。以 `cover` 填充现有战场，城池、道路、行军和交互仍由运行时真实地图绘制。

| 地表 | 项目文件 | 对应地图 |
| --- | --- | --- |
| 浅草 | [a-terrain-plains.png](../../assets/art/a-terrain-plains.png) | L01、A01 |
| 浅雪 | [a-terrain-snow.png](../../assets/art/a-terrain-snow.png) | L02、A02 |
| 暖沙 | [a-terrain-desert.png](../../assets/art/a-terrain-desert.png) | L03、A03 |

参考：[方案 A 原图](four-screens-refined.png) 。`assets.ts` 的原 `terrain-*` 逻辑键由主 Agent 接入以上路径；`terrain.ts` 保留签名、裁切和地图映射。缺图／解码失败时使用相应气候的浅色后备，中心 80% 不添草线，外围装饰继续避让营地；不改变营地坐标、路网或命中区域。

## 实际检查

已逐张查看实际生成图：三图无文字、建筑、道路、桥、水面和通行障碍；中心保持低对比的草／雪／沙连续表面，实体树石主要位于边角。浅草为青绿暖黄，浅雪为暖白灰青，暖沙为象牙金色，三种地貌有可见差异。原图边缘装饰会按战场宽高裁切，需由主 Agent 在集成后的 320／375／430 页面复核。本文的图像检查不等同游戏运行截图或真机验收。

`node --test tests/scheme-a-terrain.test.ts`：3 项通过，覆盖 PNG 尺寸、不同气候缺图后备、中央草线留空、Canvas 保存恢复、裁切、输入不变、已加载图片与解码失败后备、无效视口。既有 `tests/terrain.test.ts` 的硬编码草地色值需要主 Agent 随视觉变更更新，其余边界断言保持；已加载路径断言由主 Agent 对齐新文件名。

## 原始输出与完整提示词

### plains

原始输出：`/Users/xuhe/.codex/generated_images/01a095f6-7fdf-7ae2-b9b4-26d2578c9444/exec-75da0710-91b5-4a9e-a7dd-e51aee556440.png` 。

参考图参数：`referenced_image_paths=["/Users/xuhe/Desktop/xh/game/artifacts/ui-direction-v2/four-screens-refined.png"]`。

```text
Use case: stylized-concept. Asset type: production terrain background for a portrait Chinese classical light strategy mini game, flat top-down playable ground. Reference image is STYLE ONLY: use its bright warm ivory, soft jade green, clear painterly miniature look. Generate a single 1024x1536 portrait image, no UI. Primary request: very light fresh spring grassland terrain, soft warm sage grass with delicate hand painted material, empty open flat ground across central 80% of the canvas. Sparse tiny Chinese pine shrubs, rounded pale stones and low grassy mounds ONLY at extreme outer 6% perimeter, deliberately understated. Lighting is clear soft daylight. Palette warm ivory #F6F3E7, pale sage #C5D5B2, restrained jade #568C78. No dark forest masses, no dramatic shadows. Essential: central ground almost uniform clean low contrast, suitable for overlaying many small buildings, troops and roads at arbitrary positions; continuous traversable surface all across the image. No buildings, no soldiers, no people, no flags, no paths, no roads, no river, no lake, no bridges, no cliffs, no dividers, no labels, no typography, no border, no numbers, no watermark. Not a landscape horizon scene, not a mockup, not an atlas.
```

### snow

原始输出：`/Users/xuhe/.codex/generated_images/01a095f6-7fdf-7ae2-b9b4-26d2578c9444/exec-be7c760c-661c-402e-9a25-068ec4d34c09.png` 。

参考图参数：`referenced_image_paths=["/Users/xuhe/Desktop/xh/game/artifacts/ui-direction-v2/four-screens-refined.png"]`。

```text
Use case: stylized-concept. Asset type: production terrain background for a portrait Chinese classical light strategy mini game, flat top-down playable ground. Reference image is STYLE ONLY: use its bright warm ivory, soft jade green, clear painterly miniature look. Generate a single 1024x1536 portrait image, no UI. Primary request: very light winter snowland terrain, warm ivory and pale blue-white snow with delicate hand painted material, empty open flat ground across central 80% of the canvas. Sparse tiny snow-dusted Chinese pine shrubs, rounded pale blue-gray stones and tiny low snowy mounds ONLY at extreme outer 6% perimeter, deliberately understated. Lighting is clear soft daylight. Palette warm ivory #F6F3E7, pale blue gray #DCE9E5 and muted evergreen #789A8C; center clearly snowy rather than green, bright and warm, not icy dark. No dark forest masses, no dramatic shadows. Essential: central ground almost uniform clean low contrast, suitable for overlaying many small buildings, troops and roads at arbitrary positions; continuous traversable surface all across the image. No buildings, no soldiers, no people, no flags, no paths, no roads, no river, no lake, no bridges, no cliffs, no dividers, no labels, no typography, no border, no numbers, no watermark. Not a landscape horizon scene, not a mockup, not an atlas.
```

### desert

原始输出：`/Users/xuhe/.codex/generated_images/01a095f6-7fdf-7ae2-b9b4-26d2578c9444/exec-53db16b0-54c8-476d-a13a-690984c89700.png` 。

参考图参数：`referenced_image_paths=["/Users/xuhe/Desktop/xh/game/artifacts/ui-direction-v2/four-screens-refined.png"]`。

```text
Use case: stylized-concept. Asset type: production terrain background for a portrait Chinese classical light strategy mini game, flat top-down playable ground. Reference image is STYLE ONLY: use its bright warm ivory, soft jade green, clear painterly miniature look. Generate a single 1024x1536 portrait image, no UI. Primary request: very light warm northern frontier sandy terrain, pale golden beige and soft ivory sand with delicate hand painted material, empty open flat ground across central 80% of the canvas. Sparse tiny very sparse dry tamarisk shrubs, rounded pale sandstone pebbles and tiny low sandy mounds ONLY at extreme outer 6% perimeter, deliberately understated. Lighting is clear soft daylight. Palette warm ivory #F6F3E7, pale warm sand #E6D5AF, restrained sage accent #C5D5B2; clearly warmer and sandier than spring or snow, bright and inviting. Avoid cracked dirt, orange saturation, strong dunes or carved lines. No dark forest masses, no dramatic shadows. Essential: central ground almost uniform clean low contrast, suitable for overlaying many small buildings, troops and roads at arbitrary positions; continuous traversable surface all across the image. No buildings, no soldiers, no people, no flags, no paths, no roads, no river, no lake, no bridges, no cliffs, no dividers, no labels, no typography, no border, no numbers, no watermark. Not a landscape horizon scene, not a mockup, not an atlas.
```


