## ADDED Requirements

### Requirement: Brick Entity
游戏 SHALL 提供 Brick 类，表示可被击破的砖块实体，包含位置、血量和视觉反馈。

#### Scenario: Brick Creation
- **WHEN** 创建新的 Brick 实例，指定列号、行号和血量
- **THEN** 砖块具有网格位置 (col, row)
- **AND** 砖块具有像素位置 (x, y) 根据网格计算得出
- **AND** 砖块具有尺寸 (width=45, height=45)
- **AND** 砖块具有血量 (hp) 和最大血量 (maxHp)
- **AND** 砖块具有震动偏移量 (shakeOffset) 初始为 0

#### Scenario: Brick Hit
- **WHEN** 调用 brick.hit()
- **THEN** 砖块血量减 1
- **AND** 触发震动动画
- **AND** 如果血量归零，返回 true 表示销毁
- **AND** 如果血量大于零，返回 false 表示存活

#### Scenario: Brick Move Down
- **WHEN** 调用 brick.moveDown()
- **THEN** 砖块行号 (row) 增加 1
- **AND** 砖块像素位置 (y) 相应更新

### Requirement: Brick Visual Feedback
游戏 SHALL 提供砖块的视觉反馈，包括颜色变化和震动动画。

#### Scenario: Color by HP Ratio
- **WHEN** 砖块血量比例 (hp/maxHp) > 0.7
- **THEN** 砖块颜色为绿色 (#4CAF50)
- **WHEN** 砖块血量比例在 0.4 到 0.7 之间
- **THEN** 砖块颜色为黄色 (#FFC107)
- **WHEN** 砖块血量比例 < 0.4
- **THEN** 砖块颜色为红色 (#F44336)

#### Scenario: Shake Animation
- **WHEN** 砖块被击中触发震动
- **THEN** shakeOffset 设置为 5
- **AND** 每帧 shakeOffset 乘以 0.8 衰减
- **AND** 渲染时位置随机偏移 shakeOffset 范围内

### Requirement: Game State Machine
游戏 SHALL 通过状态机管理游戏流程，支持瞄准、发射、等待回合结束等状态。

#### Scenario: State Idle
- **WHEN** 游戏处于 idle 状态
- **THEN** 玩家可以开始瞄准
- **AND** 显示发射点和默认瞄准线

#### Scenario: State Aiming
- **WHEN** 玩家触摸屏幕开始瞄准
- **THEN** 状态切换为 aiming
- **AND** 瞄准角度根据触摸位置实时更新
- **AND** 角度限制在向上方向 (-π+0.1 到 -0.1)

#### Scenario: State Shooting
- **WHEN** 玩家松开触摸发射小球
- **THEN** 状态切换为 shooting
- **AND** 所有小球依次发射，间隔 80ms
- **AND** 小球按瞄准角度飞出

#### Scenario: State Gameover
- **WHEN** 任意砖块触及游戏区域底线
- **THEN** 状态切换为 gameover
- **AND** 游戏停止更新

### Requirement: Round System
游戏 SHALL 实现回合制系统，每回合结束后生成新砖块并推进游戏。

#### Scenario: Round Start
- **WHEN** 新回合开始
- **THEN** 回合数 (round) 增加 1
- **AND** 所有现有砖块下移一行
- **AND** 在顶部生成新的一行砖块

#### Scenario: Brick Generation
- **WHEN** 生成新行砖块
- **THEN** 遍历每一列 (共 7 列)
- **AND** 每格有 60% 概率生成砖块
- **AND** 砖块血量 = round × hpGrowth + random(0, round)

#### Scenario: Round End
- **WHEN** 所有小球落地 (active = false)
- **THEN** 状态从 shooting 切换回 idle
- **AND** 触发下一回合开始

### Requirement: Ball Launch Management
游戏 SHALL 管理多个小球的发射和回收。

#### Scenario: Multi Ball Launch
- **WHEN** 发射小球
- **THEN** 按小球数量依次发射
- **AND** 每个小球间隔 launchInterval (80ms) 发射
- **AND** 所有小球使用相同的发射角度

#### Scenario: Ball Return
- **WHEN** 小球落地 (y > bottomBoundary)
- **THEN** 小球 active 设置为 false
- **AND** 记录落地位置作为下一回合发射点

#### Scenario: All Balls Returned
- **WHEN** 检查所有小球状态
- **AND** 所有小球 active 均为 false
- **THEN** 回合结束，准备进入下一回合

### Requirement: Game Over Detection
游戏 SHALL 检测游戏结束条件并正确处理。

#### Scenario: Brick Reaches Bottom
- **WHEN** 任意砖块的底部 (y + height) 超过游戏结束线
- **THEN** 触发游戏结束
- **AND** 状态切换为 gameover

#### Scenario: Game Over Line
- **WHEN** 判定游戏结束线位置
- **THEN** 结束线位于屏幕底部上方 100 像素处
