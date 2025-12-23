# Change: 新增砖块系统与回合逻辑

## Why
游戏需要实现砖块生成、受击、消除和回合制逻辑，这是弹弹消消乐核心玩法的关键组成部分。砖块系统与物理系统配合，构成完整的游戏循环。

## What Changes
- 新增 `Brick` 类，实现砖块的位置、血量、受击、震动动画和渲染
- 新增 `GameManager` 类，管理游戏状态、回合流程、小球发射和碰撞处理
- 实现回合制逻辑：发射→碰撞→回收→下一回合
- 实现砖块生成规则：每回合顶部生成新行，已有砖块下移
- 实现游戏结束判定：砖块触及底线时结束

## Impact
- Affected specs: `brick-system` (新增)
- Affected code:
  - `js/game/Brick.js` (新增)
  - `js/game/GameManager.js` (新增)
  - `js/scenes/GameScene.js` (新增)
