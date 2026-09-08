# 弹弹奇境

面向中国大陆休闲用户的竖屏微信小游戏。核心卖点：一次瞄准触发整屏连锁；每三回合，让弹珠进化一次。

项目定位为轻量微信小游戏：关卡进度、收藏和设置保存在本地；仅好友周榜使用微信官方托管数据与开放数据域，不接入自建后端、云数据库、完整云存档或第三方分析服务。每周一北京时间 00:00 更新挑战与榜单周期，保留永久进度。设计重点是清晰的操作、连锁反馈和顺畅的重玩体验。

## 当前状态

项目处于 **Phase A：产品与 Figma 原型**。旧原生 Canvas 工程已经永久删除；当前仓库不包含可运行的游戏代码，也没有 Cocos Creator 工程。

## 当前工作

1. V5 已完成首页、教学、战斗、三选一、胜负、章节、每周挑战/好友榜、收藏、设置及异常反馈，共 58 个页面与状态、14 个评审入口。
2. V6「瞄准准备」「连锁爆发」两张样板及 2 秒动效已完成，用户已认可这两张的视觉方向。完整流程、玩法与无引导体验仍未验收；新提出的“借墙蓄力 + 破印扩散 + 地图/灵球差异”规则尚待批准。
3. 从 [V6 战斗评审指南](openspec/changes/define-dandan-qijing-product-baseline/figma-v6-battle-review.md) 开始；完整流程仍参考 [V5 评审指南](openspec/changes/define-dandan-qijing-product-baseline/figma-v5-review.md)。机器可读索引见同目录 `figma-state.json`，V3/V4 保留作对照。
4. 用户明确批准 Phase A 后，再创建 Cocos Creator + TypeScript 灰盒工程，不从静态画稿推断真实玩法已验证。

新增待审规则见 [玩法提案](openspec/changes/add-chain-reaction-gameplay/design.md)；这是设计方案，未写入已批准玩法或运行时代码。

详细计划与验收标准见 `openspec/changes/define-dandan-qijing-product-baseline/`。
