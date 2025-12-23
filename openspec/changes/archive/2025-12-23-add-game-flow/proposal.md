# Change: 完成基础游戏流程跑通

## Why
游戏需要完整的流程闭环：主页→游戏→结束→重玩/返回主页。当前缺少分数持久化、返回主页功能和最高分显示，需要补齐这些功能使基础流程完整可玩。

## What Changes
- 新增分数存储功能，保存和读取最高分
- 游戏结束界面增加"返回主页"按钮
- 主页显示历史最高分
- 优化游戏结束界面交互

## Impact
- Affected specs: `game-flow` (新增)
- Affected code:
  - `js/game/GameManager.js` (修改 - 添加分数存储)
  - `js/scenes/HomeScene.js` (修改 - 显示最高分)
  - `js/scenes/GameScene.js` (修改 - 返回主页功能)
