# Change: 添加社交功能（分享、排行榜）

## Why
根据设计文档，游戏需要社交功能来增强用户粘性和传播性。包括：游戏分享、好友排行榜等功能。

## What Changes
- 新增分享功能（结算页分享按钮、右上角分享菜单）
- 新增排行榜功能（好友排行、使用开放数据域）
- 在结算页添加分享按钮
- 在主页添加排行榜入口

## Impact
- Affected specs: `social-system` (新增)
- Affected code:
  - `js/utils/ShareManager.js` (新增)
  - `js/scenes/ResultScene.js` (修改 - 添加分享按钮)
  - `js/scenes/HomeScene.js` (修改 - 添加排行榜入口)
  - `open-data-context/` (新增 - 开放数据域子包)
