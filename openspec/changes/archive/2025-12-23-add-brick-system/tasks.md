## 1. 砖块实现
- [x] 1.1 创建 `js/game/Brick.js` 砖块类
  - 属性: col, row, x, y, width, height, hp, maxHp, shakeOffset
  - 方法: hit(), shake(), moveDown(), update(dt), render(ctx)
- [x] 1.2 实现砖块颜色根据 HP 比例变化
- [x] 1.3 实现砖块受击震动动画

## 2. 游戏管理器
- [x] 2.1 创建 `js/game/GameManager.js` 游戏管理器
  - 状态机: idle, aiming, shooting, gameover
  - 属性: round, score, balls[], bricks[], launchPoint, aimAngle
- [x] 2.2 实现瞄准逻辑 (startAiming, updateAim)
- [x] 2.3 实现小球发射逻辑 (launch)，支持多球连发
- [x] 2.4 实现游戏主更新循环 (update)
  - 更新小球位置
  - 检测小球与砖块碰撞
  - 判断回合结束

## 3. 回合逻辑
- [x] 3.1 实现 spawnNewRow() 生成新行砖块
- [x] 3.2 实现砖块下移逻辑
- [x] 3.3 实现 nextRound() 回合切换
- [x] 3.4 实现 checkGameOver() 游戏结束判定

## 4. 游戏场景
- [x] 4.1 创建 `js/scenes/GameScene.js` 游戏场景
- [x] 4.2 集成 GameManager，实现完整游戏流程
- [x] 4.3 注册场景到 SceneManager

## 5. 验证
- [x] 5.1 验证砖块生成和下移正确
- [x] 5.2 验证回合流程完整
- [x] 5.3 验证游戏结束判定正确
