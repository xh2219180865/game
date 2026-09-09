# 四方夺城 · 微信小游戏设计

当前仓库已放弃原“弹弹奇境”弹球方向，转为轻量城池争夺。“四方夺城”为工作名称。**当前只有文档，没有可运行游戏；本轮不做原型、Figma或代码。**

先读[集中验收入口](openspec/changes/replace-pinball-with-territory-conquest/review.md)，再按关注点查看各附录。

## v1.3 文档设计：调兵主循环、策略与胜负军功

拖出一半兵，抢城并守住最后一城；正式局最多四分钟，到时城多者胜，同城数比兵力。

- 唯一正式入口：你＋3个明确标示的电脑；3关练兵、3张轮换四方地图。
- 三类城（兵营/堡垒/驿站）各两级，一种军士；没有兵种克制或手动升城。
- 主题选定“汉末三国·群雄军阵”：彩绘军棋沙盘，不加入武将抽卡/历史战役重演；八军衔、前七衔各五级、大将军小级持续增长；有效独胜+30军功，第2/3/4扣5/8/10；每30分一小级、最低0、可降衔，历史最高保留；不加战斗属性。
- 新增12种仅设计的储备（8主动＋4被动），与首发合计19种；暂不进奖励池/界面/电脑配置，按H分批评审。
- 首发四主动：有库存可反复用，每次成功扣一张，无卡槽/单局次数/公共冷却。
- 三被动：本周每局自动、不扣次数，重复增强；第1/4/8个本周正式冠军各选一次，最多三次强化。
- 独立冠军每胜一次三选一，选中同一种得2张主动；其他名次/并列/练习不发卡，无免费周卡、广告或付费卡。
- 北京时间周一00:00策略/周进度到期，军功与历史最高不重置（失利仍可降衔）；原局已生效快照按规则收尾。
- 一个本地可恢复战场；好友周榜只比本周标准四方冠军次数，是官方托管成绩，不是云存档或真人联机。

新增边界：兼行实际ETA不变则整次取消、不扣卡/兵。金蝉脱壳/整军振旅后移；免费80%派兵、火袭3/5秒及招抚替换扩营仅作F/H对照试验方案，未启用。

## 文档入口

| 文档 | 用途 |
| --- | --- |
| [H 策略储备库](openspec/changes/replace-pinball-with-territory-conquest/appendices/strategy-reserve.md) | v1.2新增12种、效果/反制/动效、推荐批次与24项条件用例；不增加首发范围 |
| [G 主题与战斗动效](openspec/changes/replace-pinball-with-territory-conquest/appendices/theme-and-battle-effects.md) | 三国主题、七策略与出兵分镜、军功升降/军衔旗饰 |
| [集中验收](openspec/changes/replace-pinball-with-territory-conquest/review.md) | 本轮改变、阅读顺序、完整性核对 |
| [主设计](openspec/changes/replace-pinball-with-territory-conquest/design.md) | 产品、兵种/城池、操作、战斗和胜负 |
| [A 地图与电脑](openspec/changes/replace-pinball-with-territory-conquest/appendices/levels-and-ai.md) | 六张地图和AI配置 |
| [B 页面与动效](openspec/changes/replace-pinball-with-territory-conquest/appendices/interface-and-motion.md) | 全流程、原创视觉、声音和小屏细节 |
| [D 军衔与策略](openspec/changes/replace-pinball-with-territory-conquest/appendices/weekly-strategies-and-careers.md) | 等级、七策略、奖励和重复规则 |
| [E 微信与存储](openspec/changes/replace-pinball-with-territory-conquest/appendices/platform-and-storage.md) | 保存/恢复、周界、好友榜、异常与发布门槛 |
| [F 合理性与风险](openspec/changes/replace-pinball-with-territory-conquest/appendices/balance-and-risks.md) | 取舍、预算、平衡假设和未来试玩方法 |
| [C 验收用例](openspec/changes/replace-pinball-with-territory-conquest/appendices/acceptance.md) | 220项首发未来用例与v1.3文档检查；H的24项仍为条件用例 |
| [执行清单](openspec/changes/replace-pinball-with-territory-conquest/tasks.md) | 文档完成项与未实施工作分离 |
| [提案](openspec/changes/replace-pinball-with-territory-conquest/proposal.md) | 为什么改变、影响范围 |

文档收敛不等于玩法吸引力、平台接入、真机性能已经通过。验收后再授权M0→M1→M2→M3实施；本次不提交/推送、不修改远端Figma或其他项目。

旧资料见[弹球退役说明](docs/history/retired-pinball-2026-09-08/HISTORY.md)，旧批准与截图不作为新游戏基线。上下文见[OpenSpec项目说明](openspec/project.md)。

文档检查命令：`openspec validate replace-pinball-with-territory-conquest --strict`。目前没有游戏启动、构建或运行测试命令。
