# power-up-system Specification

## Purpose
TBD - created by archiving change add-power-up-system. Update Purpose after archive.
## Requirements
### Requirement: Power-Up Types
游戏 SHALL 支持以下道具类型：extraBall（+1球）、bomb（炸弹）、laser（激光）。

#### Scenario: Power-Up Type Definition
- **WHEN** 道具系统初始化
- **THEN** 系统支持 extraBall、bomb、laser 三种道具类型
- **AND** 每种道具有独特的视觉标识

### Requirement: Power-Up Generation
游戏 SHALL 在每回合生成新砖块行时，按配置概率在空位生成道具。

#### Scenario: Extra Ball Generation
- **WHEN** 新行生成且某格未生成砖块
- **AND** 随机值小于 extraBallRate (0.15)
- **THEN** 在该位置生成 extraBall 道具

#### Scenario: Bomb Generation
- **WHEN** 新行生成且某格未生成砖块和 extraBall
- **AND** 随机值小于 bombRate (0.05)
- **THEN** 在该位置生成 bomb 道具

#### Scenario: Laser Generation
- **WHEN** 新行生成且某格未生成其他物体
- **AND** 随机值小于 laserRate (0.03)
- **THEN** 在该位置生成 laser 道具

### Requirement: Power-Up Movement
道具 SHALL 跟随砖块下移规则，每回合下移一行。

#### Scenario: Power-Up Moves Down
- **WHEN** 新回合开始
- **THEN** 所有道具的 row 值增加 1
- **AND** 道具位置更新到新的 Y 坐标

### Requirement: Power-Up Collision
小球 SHALL 能够与道具发生碰撞并收集道具。

#### Scenario: Ball Collects Power-Up
- **WHEN** 小球中心与道具中心距离小于两者半径之和
- **THEN** 触发道具收集事件
- **AND** 道具从游戏中移除

### Requirement: Extra Ball Effect
extraBall 道具 SHALL 永久增加玩家小球数量。

#### Scenario: Collect Extra Ball
- **WHEN** 玩家收集 extraBall 道具
- **THEN** ballCount 增加 1
- **AND** 下一回合发射的小球数量增加

### Requirement: Bomb Effect
bomb 道具 SHALL 消除周围 3x3 范围内的所有砖块。

#### Scenario: Bomb Explosion
- **WHEN** 玩家收集 bomb 道具
- **THEN** 以道具位置为中心，消除周围 3x3 格内所有砖块
- **AND** 被消除砖块计入分数

### Requirement: Laser Effect
laser 道具 SHALL 发射激光消除当前列所有砖块。

#### Scenario: Laser Activation
- **WHEN** 玩家收集 laser 道具
- **THEN** 消除道具所在列的所有砖块
- **AND** 被消除砖块计入分数

### Requirement: Power-Up Rendering
道具 SHALL 在游戏画面中以可区分的视觉样式渲染。

#### Scenario: Render Different Power-Ups
- **WHEN** 游戏渲染帧
- **THEN** extraBall 显示为绿色圆形带"+"标记
- **AND** bomb 显示为红色圆形带爆炸图标
- **AND** laser 显示为蓝色圆形带闪电图标

