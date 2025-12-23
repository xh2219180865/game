# Change: 添加道具系统

## Why
根据设计文档，游戏需要道具系统增加策略性和趣味性。道具包括：+1球（增加小球数量）、炸弹（范围消除）、激光（穿透消除）。道具在游戏区域随机生成，玩家控制小球碰撞收集。

## What Changes
- 新增 PowerUp 类，支持多种道具类型
- 道具生成逻辑（随砖块行生成）
- 道具碰撞检测与收集
- 各类道具效果实现：
  - extraBall: 永久增加小球数量
  - bomb: 爆炸消除周围砖块
  - laser: 发射激光穿透消除一列砖块
- 道具视觉效果与动画

## Impact
- Affected specs: `power-up-system` (新增)
- Affected code:
  - `js/game/PowerUp.js` (新增)
  - `js/game/GameManager.js` (修改 - 集成道具系统)
  - `js/config.js` (修改 - 添加道具配置)
