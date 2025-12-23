## Context
弹弹消消乐游戏的核心循环是回合制：玩家发射小球 → 小球碰撞砖块 → 所有小球落地 → 进入下一回合。参考 readme.md 中的设计，实现完整的砖块系统和游戏管理器。

## Goals / Non-Goals
- **Goals**:
  - 实现 Brick 类，包含位置、血量、受击逻辑
  - 实现砖块震动反馈动画
  - 实现 GameManager 管理游戏状态机
  - 实现回合制流程：idle → aiming → shooting → idle
  - 实现砖块生成和下移规则
  - 实现游戏结束判定

- **Non-Goals**:
  - 不实现道具系统（后续独立提案）
  - 不实现分数存储和排行榜（后续独立提案）
  - 不实现结算场景（后续独立提案）

## Decisions

### 1. 游戏状态机
- **States**: `idle`, `aiming`, `shooting`, `gameover`
- **Transitions**:
  - `idle` → `aiming`: 触摸开始
  - `aiming` → `shooting`: 触摸结束，发射小球
  - `shooting` → `idle`: 所有小球落地
  - `any` → `gameover`: 砖块触及底线

### 2. 砖块生成规则
- **Decision**: 每回合在顶部生成新行
- **HP 计算**: `round * hpGrowth + random(0, round)`
- **生成概率**: 每格 60% 概率生成砖块

### 3. 小球连发机制
- **Decision**: 多球依次发射，间隔 80ms
- **Why**: 形成弹幕效果，增加视觉冲击力

### 4. 回合结束判定
- **Decision**: 所有小球 active=false 时进入下一回合
- **Logic**: 每帧检查是否所有小球已落地

## Risks / Trade-offs
- **Risk**: 大量砖块时性能下降
  - **Mitigation**: 使用空间分区优化碰撞检测（后续优化）
- **Risk**: 小球卡在砖块之间
  - **Mitigation**: 已在 Physics 模块实现位置修正
