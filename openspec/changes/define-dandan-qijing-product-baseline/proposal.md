# Change: 确立《弹弹奇境》产品与实施基线

## Why

当前仓库原是一套“弹弹消消乐”原生 JavaScript/Canvas 微信小游戏原型，并叠加了签到、成就、转盘、段位、广告复活等扩展。新的交接文档已经把方向调整为“连锁反应 + 局内构筑 + 异步社交”，并要求先完成独立 Figma 原型、再启动 Cocos Creator/TypeScript 灰盒。用户已明确旧代码不需要提交或保留，因此本次直接清除旧实现并建立唯一的新产品基线。

## What Changes

- **BREAKING**：以“弹弹奇境”为原型阶段工作代号，替代旧的纯无尽分数驱动产品基线。
- 明确核心卖点为“一次瞄准触发整屏连锁；每三回合，让弹珠进化一次”。
- 明确 MVP 必做范围、暂不做范围和原型阶段不接广告的约束。
- 建立设计优先门禁：独立 Figma 主流程通过确认前，不创建或扩展 Cocos Creator 工程。
- 将《弹弹奇境》UI/UX 设计指南、2026-08-27 吸引力复盘和 V3 用户否决结论纳入 Phase A 验收基线。V4 保留“夜游奇境”的东方夜色氛围，但把玩法颜色收敛为青色玩家、黄色目标/主行动、红色危险三种单一语义，取消多色描边、卡片堆叠和遮挡战场的连锁字幕。
- 删除原生 JavaScript/Canvas 工程、旧增长功能、旧资源、旧微信工程配置和旧规格，不做代码或数据迁移。
- 后续 Cocos Creator 工程采用 TypeScript、固定时间步、配置驱动和确定性随机种子。

## Impact

- **Affected specs**：新增 `product-baseline`；旧 `game-core`、`game-flow`、`power-up-system`、`social-system`、`ad-system` 等规格全部移除。
- **Affected code**：删除旧原生 Canvas 运行时代码。后续分别创建 Phase A（Figma）与 Phase B（Cocos 灰盒）的独立变更。
- **Data/migration**：当前本地存储、排行榜和广告相关数据仅属于旧原型，不承诺向新工程迁移。
