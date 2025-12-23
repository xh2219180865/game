# Change: 项目搭建与游戏主循环

## Why
建立微信小游戏"弹弹消消乐"的基础项目结构和核心游戏循环系统，作为后续所有游戏功能开发的基础框架。

## What Changes
- 创建微信小游戏项目配置文件 (`game.json`, `project.config.json`)
- 实现游戏入口文件 (`game.js`)
- 实现游戏主循环系统 (`js/main.js`)，包含：
  - Canvas 2D 渲染初始化
  - requestAnimationFrame 游戏循环
  - 帧时间计算 (delta time)
  - 场景管理器基础架构
- 创建游戏配置模块 (`js/config.js`)
- 创建资源加载器骨架 (`js/utils/ResourceLoader.js`)
- 创建场景管理器 (`js/scenes/SceneManager.js`)

## Impact
- **Affected specs**: `game-core` (新增)
- **Affected code**: 
  - `game.js` - 入口文件
  - `game.json` - 游戏配置
  - `project.config.json` - 项目配置
  - `js/main.js` - 主循环
  - `js/config.js` - 游戏配置
  - `js/scenes/SceneManager.js` - 场景管理
  - `js/utils/ResourceLoader.js` - 资源加载
