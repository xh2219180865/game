# ui-system Specification

## Purpose
TBD - created by archiving change add-ui-system. Update Purpose after archive.
## Requirements
### Requirement: Button Component
游戏 SHALL 提供可复用的 Button UI 组件，支持点击检测和视觉反馈。

#### Scenario: Button Rendering
- **WHEN** 按钮被渲染
- **THEN** 显示带圆角的矩形背景
- **AND** 居中显示按钮文字
- **AND** 按钮颜色可自定义

#### Scenario: Button Click Detection
- **WHEN** 用户点击按钮区域内
- **THEN** 返回点击成功
- **WHEN** 用户点击按钮区域外
- **THEN** 返回点击失败

### Requirement: Home Scene UI
主页场景 SHALL 显示游戏标题、最高分和开始游戏按钮。

#### Scenario: Home Page Layout
- **WHEN** 进入主页场景
- **THEN** 屏幕上方显示游戏标题"弹弹消消乐"
- **AND** 标题下方显示历史最高分
- **AND** 屏幕中央显示"开始游戏"按钮

#### Scenario: Start Game Button
- **WHEN** 用户点击"开始游戏"按钮
- **THEN** 场景切换到游戏场景

### Requirement: Result Scene
游戏 SHALL 提供独立的结算场景，显示本局成绩并提供操作选项。

#### Scenario: Result Display
- **WHEN** 游戏结束切换到结算场景
- **THEN** 显示"游戏结束"标题
- **AND** 显示本局分数
- **AND** 显示坚持的回合数
- **AND** 如果是新纪录则显示新纪录提示

#### Scenario: Result Actions
- **WHEN** 用户点击"再来一局"按钮
- **THEN** 场景切换到新的游戏场景
- **WHEN** 用户点击"返回主页"按钮
- **THEN** 场景切换到主页场景

### Requirement: Scene Data Passing
场景切换 SHALL 支持传递数据参数给目标场景。

#### Scenario: Pass Game Result
- **WHEN** 游戏结束切换到结算场景
- **THEN** 传递分数、回合数、小球数量等数据
- **AND** 结算场景可读取并显示这些数据

