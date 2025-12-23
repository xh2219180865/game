# Tasks: 音效系统与存储系统实现

## 1. 存储系统
- [x] 1.1 创建 Storage 类（get/set/remove 方法封装）
- [x] 1.2 添加存储配置项（音效开关、音乐开关）
- [x] 1.3 迁移 GameManager 中的 highScore 存储到 Storage

## 2. 音效系统
- [x] 2.1 创建 SoundManager 类（预留音效接口）
- [x] 2.2 实现 play/stop/setVolume 方法
- [x] 2.3 实现背景音乐循环播放
- [x] 2.4 实现音效开关控制（读取 Storage 配置）

## 3. 音效集成（预留调用点）
- [x] 3.1 小球发射时调用 launch 音效
- [x] 3.2 击中砖块时调用 hit 音效
- [x] 3.3 消除砖块时调用 destroy 音效
- [x] 3.4 收集道具时调用 powerup 音效
- [x] 3.5 游戏结束时调用 gameover 音效
- [x] 3.6 按钮点击时调用 button 音效
- [x] 3.7 新纪录时调用 highscore 音效

## 4. 全局实例
- [x] 4.1 在 main.js 初始化 SoundManager 和 Storage
- [x] 4.2 通过 window 暴露全局访问

## 5. 测试验证
- [x] 5.1 验证存储读写正常
- [x] 5.2 验证音效调用点正确（无音效文件时不报错）
- [x] 5.3 验证音效开关功能正常
