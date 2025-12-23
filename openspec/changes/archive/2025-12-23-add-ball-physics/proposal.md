# Change: 新增小球物理系统与碰撞检测

## Why
游戏需要实现小球发射、物理运动和碰撞检测功能，这是弹弹消消乐核心玩法的基础。小球需要能够在游戏区域内反弹，并与砖块、墙壁进行碰撞检测。

## What Changes
- 新增 `Ball` 类，实现小球的位置、速度、半径属性和物理运动逻辑
- 新增 `Physics` 模块，提供物理计算和碰撞检测算法
- 实现墙壁碰撞检测与反弹
- 实现圆形与矩形（小球与砖块）碰撞检测
- 实现碰撞后的反弹方向计算

## Impact
- Affected specs: `ball-physics` (新增)
- Affected code: 
  - `js/game/Ball.js` (新增)
  - `js/game/Physics.js` (新增)
