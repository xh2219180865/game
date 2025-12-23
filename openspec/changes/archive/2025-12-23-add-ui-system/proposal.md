# Change: 完善UI界面系统（主页、结算）

## Why
当前主页和结算界面较为简单，需要按照设计文档增强UI交互体验，包括：美化主页布局、添加按钮组件、独立结算场景等。

## What Changes
- 新增 Button UI 组件类
- 增强 HomeScene：添加开始游戏按钮、显示最高分
- 新增 ResultScene：独立的游戏结算场景
- 从 GameManager 中移除结算UI渲染逻辑

## Impact
- Affected specs: `ui-system` (新增)
- Affected code:
  - `js/ui/Button.js` (新增)
  - `js/scenes/HomeScene.js` (修改 - 增强布局和按钮)
  - `js/scenes/ResultScene.js` (新增)
  - `js/scenes/SceneManager.js` (修改 - 注册新场景)
  - `js/game/GameManager.js` (修改 - 移除结算UI)
