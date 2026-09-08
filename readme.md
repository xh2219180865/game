# 据点争夺 · 微信小游戏（暂定方向）

本项目继续在当前仓库开发。2026-09-08 用户明确放弃原有“弹弹奇境”弹球制作，改为探索以产兵、派兵和占领据点为核心的轻量微信小游戏。正式名称尚未确定。

## 已确认的边界

- 不新建另一个项目，不继续弹球、反弹、符印消除或灵球养成。
- 参考其他游戏的玩法思路，不沿用其水墨宣纸、书法按钮、文字兵器和页面布局，也不默认继续使用旧弹球美术。
- 保持个人开发、竖屏单手、轻量本地运行；不接自建后端、完整云存档或第三方分析服务。
- 保留此前允许的微信官方好友周榜这一联网例外；每周一北京时间 00:00 切换周期。榜单计分需要根据新玩法重新定义，不沿用弹球分数。

## 当前状态

**已完成项目方向切换；新玩法提案待确认；尚无可运行游戏。**

原仓库只有产品文档、Figma 索引和视觉素材，没有游戏运行时代码，也没有 Cocos Creator 工程。旧资料已原样迁出当前制作目录，见 [退役资料说明](docs/history/retired-pinball-2026-09-08/HISTORY.md)。这不是已上线功能的归档，也不表示旧方案的未完成任务已经完成。

外部“制作说明”目录提供的是历史素材和部分预览缓存，并无策划文档。本项目未恢复或导入这些缓存代码；截图和历史代码不构成已批准的新需求。

## 详细设计 v0.2（待批准）

当前草案建议单机玩家对一个电脑：自动产兵、拖拽派出一半兵力、增援与攻占，最后一城失守即淘汰，在途部队不续命。精确同刻双方最后据点均失守时判平局。以上为细化后的推荐规则，尚未获得用户批准。

制作分为 M0（仅第一关、兵营 I、基础闭环）和 M1（完整三关、兵营/堡垒/驿站各两级）。始终只有一种基础兵力；据点等级由地图预设，不做局内升级。三兵种、肉鸽卡牌和好友榜后置。

“夺城接力”作为基础玩法成立后的独立实验；“彩色玩具沙盘”仅是视觉候选，都不是用户已确认的成品规则或风格。

- [变更提案与待确认项](openspec/changes/replace-pinball-with-territory-conquest/proposal.md)
- [详细设计文档 v0.2：规则、六种据点规格与审批项](openspec/changes/replace-pinball-with-territory-conquest/design.md)
- [附录 A：三张地图与电脑行为](openspec/changes/replace-pinball-with-territory-conquest/appendices/levels-and-ai.md)
- [附录 B：页面、交互和动效](openspec/changes/replace-pinball-with-territory-conquest/appendices/interface-and-motion.md)
- [附录 C：验收与边界用例](openspec/changes/replace-pinball-with-territory-conquest/appendices/acceptance.md)
- [执行清单](openspec/changes/replace-pinball-with-territory-conquest/tasks.md)
- [项目上下文](openspec/project.md)

## 后续顺序

1. 确认新玩法提案及“先可玩验证、后完整页面”的顺序。
2. 在当前仓库建立 M0 最小运行时，验证第一关的派兵、夺城、最后一城淘汰与重试。
3. 通过后完成 M1 三关与三类两级据点，再单独决定是否实验夺城接力，不自动扩展兵种和随机强化。
4. 确认独立美术方向并完善 Figma 关键状态，进入 M3 微信真机与本地进度闭环；好友榜计分另定后接入。

上述新制作顺序仍待批准；原弹球 Phase A/Figma 验收记录已退役，既不约束新方向，也不构成新玩法的开工批准。依照 OpenSpec，具体提案获批前不创建运行时代码。

## 检查文档

```sh
openspec list
openspec validate replace-pinball-with-territory-conquest --strict
```

当前没有可执行的游戏启动、构建或测试命令；不得将文档检查通过写成游戏已可玩、性能已验证或已完成微信适配。
