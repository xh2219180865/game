# game-core Specification

## Purpose
TBD - created by archiving change add-game-foundation. Update Purpose after archive.
## Requirements
### Requirement: Game Entry Point
游戏 SHALL 提供标准的微信小游戏入口文件，初始化 Canvas 并启动主循环。

#### Scenario: Game Initialization
- **WHEN** 小游戏启动
- **THEN** 系统创建全屏 Canvas
- **AND** 初始化 2D 渲染上下文
- **AND** 启动游戏主循环

### Requirement: Game Main Loop
游戏 SHALL 实现基于 requestAnimationFrame 的主循环，以稳定帧率运行更新和渲染逻辑。

#### Scenario: Frame Update
- **WHEN** 每一帧执行
- **THEN** 系统计算距离上一帧的时间间隔 (delta time)
- **AND** 调用当前场景的 update(dt) 方法
- **AND** 清空 Canvas
- **AND** 调用当前场景的 render(ctx) 方法
- **AND** 请求下一帧

#### Scenario: Delta Time Calculation
- **WHEN** 两帧之间间隔 16ms
- **THEN** delta time 值为 0.016 秒
- **AND** 物理和动画更新使用该值保证帧率无关性

### Requirement: Scene Management
游戏 SHALL 提供场景管理器，支持不同游戏场景的切换。

#### Scenario: Scene Switch
- **WHEN** 调用 sceneManager.switchTo('game')
- **THEN** 系统销毁当前场景 (如有)
- **AND** 创建并初始化目标场景
- **AND** 将当前场景引用指向新场景

#### Scenario: Scene Lifecycle
- **WHEN** 场景被激活
- **THEN** 调用场景的 init() 方法
- **WHEN** 场景被销毁
- **THEN** 调用场景的 destroy() 方法 (如有)

### Requirement: Game Configuration
游戏 SHALL 提供集中的配置模块，管理所有游戏参数。

#### Scenario: Config Access
- **WHEN** 游戏模块需要读取配置
- **THEN** 可通过 GameConfig 对象访问砖块、小球、道具、分数等配置
- **AND** 配置值符合设计文档定义

### Requirement: Resource Loading
游戏 SHALL 提供资源加载器，支持图片等资源的预加载。

#### Scenario: Preload Images
- **WHEN** 调用 resourceLoader.loadAll()
- **THEN** 系统异步加载所有注册的图片资源
- **AND** 返回 Promise，在所有资源加载完成后 resolve
- **AND** 加载失败时 Promise reject 并包含错误信息

