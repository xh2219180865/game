## 1. 核心实现
- [x] 1.1 创建 `js/game/Ball.js` 小球类
  - 属性: x, y, vx, vy, radius, speed, active
  - 方法: launch(angle), update(dt), render(ctx)
- [x] 1.2 创建 `js/game/Physics.js` 物理模块
  - 墙壁碰撞检测: checkWallCollision(ball, bounds)
  - 矩形碰撞检测: checkRectCollision(ball, rect)
  - 反弹处理: handleBounce(ball, collision)

## 2. 碰撞检测
- [x] 2.1 实现墙壁碰撞检测与反弹
  - 左右墙壁: 反转 vx
  - 顶部墙壁: 反转 vy
  - 底部边界: 标记小球为非活动状态
- [x] 2.2 实现圆形-矩形碰撞检测
  - 计算矩形上最近点
  - 计算距离并判断碰撞
- [x] 2.3 实现砖块碰撞反弹方向计算
  - 根据碰撞边确定反弹方向

## 3. 验证
- [x] 3.1 创建测试场景验证小球物理行为
- [x] 3.2 验证碰撞检测正确性
