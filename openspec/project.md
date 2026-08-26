# Project Context

## Purpose

“弹弹奇境”是面向中国大陆 18—40 岁休闲用户的竖屏微信小游戏。核心体验是一次瞄准触发整屏连锁，并在每三个回合进行一次弹珠能力三选一。

当前处于 Phase A：产品流程与 Figma 原型阶段。旧原生 Canvas 运行时已经永久删除，当前没有 Cocos Creator 工程。

## Planned Tech Stack

- 设计：独立 Figma 游戏文件
- 游戏引擎：Cocos Creator 2D，具体稳定版本在 Phase B 确认
- 语言：TypeScript
- 目标平台：微信小游戏

## Project Conventions

### Architecture

- Figma 主流程通过验收后才允许创建 Cocos Creator 工程。
- 场景、节点、组件、Prefab 和配置表保持单一职责。
- 物理采用固定时间步，并使用子步进或连续碰撞检测保护高速小球。
- 发射队列使用游戏时钟，不使用大量 `setTimeout`。
- 关卡、砖块、能力和数值必须配置化。
- 每日挑战使用确定性随机种子。

### Testing Strategy

- Phase A 验证用户流程、信息层级、单手操作、安全区和可读性。
- Phase B 验证弹射手感、碰撞正确性、等待时间、前后台恢复和中低端安卓性能。
- 正式配置通过自动模拟和真实玩家测试校准。

## Product Constraints

- 竖屏、单手操作，普通单关目标时长 1—3 分钟。
- 原型阶段不做实时多人、复杂排行榜、大型成就、完整商城、多币种、公会、聊天或 UGC。
- 原型阶段不接入插屏广告、Banner 或付费功能。
- 视觉采用治愈萌系与轻国潮元素，明亮柔和但不低幼。
- 设计兼顾女性、非传统游戏用户、中年用户和中低端安卓设备。

## Compliance Context

正式上线前需要处理实名认证、未成年人防沉迷、隐私授权与数据删除、游戏备案/版号适用性、广告与付费资质、排行榜反作弊及异常降级。

## Source of Truth

- 当前产品基线：`openspec/changes/define-dandan-qijing-product-baseline/`
- 旧“弹弹消消乐”原生 Canvas 代码、规格和文档均已永久删除，不得恢复为实现基线。
