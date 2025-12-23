## ADDED Requirements

### Requirement: High Score Persistence
游戏 SHALL 持久化保存玩家的最高分记录。

#### Scenario: Save High Score
- **WHEN** 游戏结束且当前分数超过历史最高分
- **THEN** 系统将新的最高分保存到本地存储
- **AND** 标记本局为"新纪录"

#### Scenario: Load High Score
- **WHEN** 主页场景初始化
- **THEN** 系统从本地存储读取历史最高分
- **AND** 如果没有记录则返回 0

### Requirement: Home Screen Display
游戏主页 SHALL 显示游戏标题和历史最高分。

#### Scenario: Show High Score
- **WHEN** 主页场景渲染
- **THEN** 显示游戏标题"弹弹消消乐"
- **AND** 显示"最高分: [分数]"
- **AND** 显示"点击屏幕开始游戏"提示

### Requirement: Game Over Screen
游戏结束界面 SHALL 提供重玩和返回主页选项。

#### Scenario: Display Game Over
- **WHEN** 游戏状态变为 gameover
- **THEN** 显示半透明遮罩层
- **AND** 显示"游戏结束"标题
- **AND** 显示本局分数和回合数
- **AND** 如果是新纪录，显示"新纪录!"提示
- **AND** 显示"再来一局"按钮区域
- **AND** 显示"返回主页"按钮区域

#### Scenario: Restart Game
- **WHEN** 玩家点击"再来一局"区域
- **THEN** 重新初始化 GameManager
- **AND** 开始新游戏

#### Scenario: Return Home
- **WHEN** 玩家点击"返回主页"区域
- **THEN** 切换到主页场景
