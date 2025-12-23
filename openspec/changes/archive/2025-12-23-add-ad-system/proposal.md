# Change: 添加广告系统（预留入口）

## Why
根据设计文档，游戏需要接入广告实现变现。由于目前还没有广告权限，先预留广告入口和管理类，确保后续可以无缝接入，同时不影响当前程序运行。

## What Changes
- 新增 AdManager 广告管理类（支持激励视频、插屏、Banner）
- 在结算页添加"看广告复活"按钮（预留）
- 实现广告计数器（每3局显示插屏广告）
- 所有广告调用在无权限时静默失败

## Impact
- Affected specs: `ad-system` (新增)
- Affected code:
  - `js/utils/AdManager.js` (新增)
  - `js/scenes/ResultScene.js` (修改 - 添加复活按钮)
  - `js/main.js` (修改 - 初始化AdManager)
