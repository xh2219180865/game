# Change: 添加音效系统与存储系统

## Why
根据设计文档，游戏需要音效增强体验和完善的本地存储管理。音效包括：背景音乐、发射音效、击中音效、消除音效、道具音效等。存储系统用于管理游戏设置和数据持久化。

## What Changes
- 新增 SoundManager 音效管理类
- 新增 Storage 存储管理类
- 在游戏关键节点调用音效播放
- 统一存储管理接口
- 音效文件暂时预留，后续添加

## Impact
- Affected specs: `sound-system` (新增), `storage-system` (新增)
- Affected code:
  - `js/utils/SoundManager.js` (新增)
  - `js/utils/Storage.js` (新增)
  - `js/game/GameManager.js` (修改 - 调用音效)
  - `js/scenes/HomeScene.js` (修改 - 按钮音效)
  - `js/scenes/ResultScene.js` (修改 - 结算音效)
