# A01 完整战场样板

2026-09-13。用户确认先完成一张可试玩样板，再扩展到其他地图与兵种。本轮范围为 A01 布局、步兵营三级、步兵迈步和队旗兵数。其他营地与兵种沿用上一轮，未将样板范围冒充全面重做。

## 画面与动作

一级木栅低营、二级门楼院落、三级双塔石堡采用独立大轮廓，基准显示宽度 44／56／62，底边一致；样板建筑替换应用于共用步兵营绘制。步兵使用六帧脚步图集，每帧 120 ms，每圈 720 ms，队员错开两帧，左右朝向随真实行军方向；正常步兵不再整图摇晃。暂停不推进游戏时钟，减少动态固定姿态。样板失败回退上一版图集，双图失败回退 Canvas。

军旗形状与准确整队兵数合并为跟队旗牌，优先队首上方，遇城池遮挡时在附近稳定避让。短尾指向队首；每支队伍仍独立显示真实剩余人数，实际受击才显示减员。拥挤时沿用既有逐队查询入口，不伪造合并兵数。

A01 九节点围绕中心整体旋转 9°，中央增加平面石铺广场，外围营地增加低对比空地。四方两条起步路线保持 2,895／5,167 ms，12 条道路在六档速度下时长不变；中央塔到两弓营 105、到上下步营 150，射程关系不变。全部旧坐标只作为完整布局接收；旧局不迁移，拒绝新旧混搭或任意挪点。小屏暂停缩略图最小高度增至 160，避免旋转后兵数牌重叠。

运行画面：[三级与脚步对照](battle-sample-runtime.png)。

## 素材与制作来源

使用内置 `image_gen.imagegen`，文生图一次生成样板，未使用 CLI 或第三方参考图。

- 原始输出：`/Users/xuhe/.codex/generated_images/01a08b3a-f48b-7c23-ba25-d055e32a4ee7/exec-96787ccd-7a71-4112-b0ee-a074aefb05cc.png`。
- 正式母版：[a-battle-sample-master.png](../../assets/art/a-battle-sample-master.png)，1536×1024 RGBA。
- 运行图集：[a-battle-sample.png](../../assets/art/a-battle-sample.png)，768×512 RGBA，358,796 字节；`sips -Z 768` 等比编码。3 个建筑源区与 6 个同尺寸步兵源区见 [sample-sprite-regions.ts](../../src/render/sample-sprite-regions.ts)。
- 上一版图集从原母版重新输出为 640×640，616,913 字节，仍保留真实透明度；用于其他兵种／建筑及失败回退。原母版未改动。

像素测试检查样板真实透明背景、主体不透明度以及足部轮廓差异，不能仅凭文件扩展名判断透明。运行包仅复制注册图片，母版与此记录不参与构建。

## 完整生成提示词

```text
Production sprite sheet for an original Chinese mobile strategy game, hand-painted 2.5D miniature game assets with crisp chunky readable silhouettes, teal tiled roofs, ivory stone, dark timber, brass details. GENUINE transparent alpha background, NOT a painted checkerboard. Exactly THREE COLUMNS and THREE ROWS of equal cells, nine assets, 15% transparent padding inside EVERY cell, no overlaps, no text, no labels, no flags, no numbers, no terrain. TOP ROW: three very different tiers of the SAME military infantry barracks, each facing 3/4 front right and standing on same baseline. TOP LEFT tier 1: very humble LOW SINGLE STORY small rectangular timber hut with a low teal roof, a short rough wooden palisade and two round shields, OPEN front yard; absolutely no stone fortifications or tower. TOP MIDDLE tier 2: MEDIUM fortified courtyard with two timber halls, tall conspicuous SINGLE central gatehouse, thick ivory perimeter wall, round shields and spear rack; silhouette unmistakably taller and broader. TOP RIGHT tier 3: IMPOSING tall stone fortress with TWO HIGH corner towers, a central DOUBLE EAVED gatehouse, enclosed crenellated stone perimeter, shields and spears; silhouette radically more monumental, readable at 60 pixels. Buildings viewed from exact same direction with progressively bigger presence in their cell (tier1 55%, tier2 68%, tier3 80% of available area). BOTTOM TWO ROWS: six ordered sequential animation frames of EXACTLY THE SAME single Chinese ancient spear-and-round-shield infantry soldier WALKING to the RIGHT, side view with slight front 3/4. Three-head-tall mobile proportions, charcoal lamellar armour, muted teal cloth, bronze round shield in near hand, long vertical spear in far hand, metal helmet with ivory crest. Frame order left-to-right row2 then row3. Frame1 right leg forward planted, left leg back; frame2 right supporting and left knee lifting; frame3 left swinging forward right behind; frame4 left leg planted forward and right leg extended back; frame5 left supporting right knee lifting; frame6 right swinging forward left behind. Important: SIX DISTINCT FOOT AND KNEE POSITIONS forming one seamless walk cycle, SAME helmet, shield, spear, body proportions, weapon hand, scale, upper-body alignment and lighting in every frame, ground baseline at exact same position in every cell. Whole spear contained, no cropped head or feet. No ghosting, no multiple figures in a cell, no motion lines, no dust. Premium polished painted mobile game style, bright directional lighting upper-left, defined occlusion, legible broad colour blocks. Transparent background around all nine separate assets.
```

## 验证

`npm run check`：866 项、0 失败、0 跳过，类型检查和浏览器／微信构建通过。构建目录 2,979,142 字节；微信 CLI auto-preview 成功，实际预览包体 3,018,800 字节（约 2.88 MiB）。保留 4 MiB 门禁和小于 3 MiB 的构建回归要求。

375 宽内存交互验证 48→38 兵一级升二级、新布局道路派出 19 步兵、1000／1100 ms 迈步姿态与兵数、暂停／重新读取保持 1100 ms，继续后仍为同一部队和 ETA。浏览器 error／warn 为空。120／240 ms 样板图对照可见膝盖与脚部变化。真实新旧在途存档通过自动恢复与续演对照；这些记录不代表新版微信真机触摸、帧率或完整对战验收。

本地检查入口：[动态造型样板](http://127.0.0.1:4185/?scene=sample-art)、[独立内存试玩](http://127.0.0.1:4185/acceptance?width=375&scenario=capacity)。运行期测试服务关闭后链接不可用，可通过 `npm run visual` 在 4174 使用相同参数。
