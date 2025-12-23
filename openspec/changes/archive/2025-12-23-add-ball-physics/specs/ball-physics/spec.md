## ADDED Requirements

### Requirement: Ball Entity
游戏 SHALL 提供 Ball 类，表示可发射的小球实体，包含位置、速度、半径等物理属性。

#### Scenario: Ball Creation
- **WHEN** 创建新的 Ball 实例
- **THEN** 小球具有初始位置 (x, y)
- **AND** 小球具有速度向量 (vx, vy) 初始为 0
- **AND** 小球具有半径 (radius) 默认为 8 像素
- **AND** 小球具有运动速度常量 (speed) 默认为 800 像素/秒
- **AND** 小球具有活动状态 (active) 初始为 false

#### Scenario: Ball Launch
- **WHEN** 调用 ball.launch(angle) 发射小球
- **THEN** 小球的 vx 设置为 cos(angle) * speed
- **AND** 小球的 vy 设置为 sin(angle) * speed
- **AND** 小球的 active 状态设置为 true

### Requirement: Ball Movement
游戏 SHALL 实现基于 delta time 的小球匀速运动，确保帧率无关性。

#### Scenario: Position Update
- **WHEN** 调用 ball.update(dt) 且小球处于活动状态
- **THEN** 小球的 x 坐标更新为 x + vx * dt
- **AND** 小球的 y 坐标更新为 y + vy * dt

#### Scenario: Inactive Ball
- **WHEN** 调用 ball.update(dt) 且小球处于非活动状态
- **THEN** 小球位置不发生变化

### Requirement: Wall Collision Detection
游戏 SHALL 检测小球与游戏区域边界的碰撞，并正确处理反弹。

#### Scenario: Left Wall Collision
- **WHEN** 小球左边缘 (x - radius) 小于或等于 0
- **THEN** 小球 x 坐标修正为 radius
- **AND** 小球 vx 反转为 -vx

#### Scenario: Right Wall Collision
- **WHEN** 小球右边缘 (x + radius) 大于或等于画布宽度
- **THEN** 小球 x 坐标修正为 width - radius
- **AND** 小球 vx 反转为 -vx

#### Scenario: Top Wall Collision
- **WHEN** 小球上边缘 (y - radius) 小于或等于 0
- **THEN** 小球 y 坐标修正为 radius
- **AND** 小球 vy 反转为 -vy

#### Scenario: Bottom Boundary
- **WHEN** 小球下边缘 (y + radius) 大于游戏区域底部边界
- **THEN** 小球 active 状态设置为 false
- **AND** 小球 vx 和 vy 设置为 0

### Requirement: Circle-Rectangle Collision Detection
游戏 SHALL 实现圆形（小球）与矩形（砖块）的碰撞检测算法。

#### Scenario: Collision Check
- **WHEN** 检测小球与矩形砖块的碰撞
- **THEN** 系统计算矩形上距离圆心最近的点
- **AND** 计算该点到圆心的距离
- **AND** 如果距离小于小球半径，返回 true 表示碰撞
- **AND** 如果距离大于或等于小球半径，返回 false 表示无碰撞

#### Scenario: Closest Point Calculation
- **WHEN** 计算矩形上距离圆心最近的点
- **THEN** closestX = max(rect.x, min(ball.x, rect.x + rect.width))
- **AND** closestY = max(rect.y, min(ball.y, rect.y + rect.height))

### Requirement: Collision Bounce
游戏 SHALL 根据碰撞位置正确计算反弹方向。

#### Scenario: Horizontal Bounce
- **WHEN** 小球从砖块左侧或右侧碰撞
- **THEN** 小球 vx 反转为 -vx
- **AND** 小球 vy 保持不变

#### Scenario: Vertical Bounce
- **WHEN** 小球从砖块上方或下方碰撞
- **THEN** 小球 vy 反转为 -vy
- **AND** 小球 vx 保持不变

#### Scenario: Corner Bounce
- **WHEN** 小球从砖块角落碰撞
- **THEN** 小球 vx 反转为 -vx
- **AND** 小球 vy 反转为 -vy

### Requirement: Ball Rendering
游戏 SHALL 提供小球的渲染方法，在 Canvas 上绘制圆形小球。

#### Scenario: Render Ball
- **WHEN** 调用 ball.render(ctx)
- **THEN** 在 Canvas 上绘制以 (x, y) 为圆心、radius 为半径的圆形
- **AND** 填充颜色为白色 (#FFFFFF)
