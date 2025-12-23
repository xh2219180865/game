## ADDED Requirements

### Requirement: Sound Manager
游戏 SHALL 提供 SoundManager 音效管理类，统一管理音效播放。

#### Scenario: Play Sound Effect
- **WHEN** 调用 SoundManager.play(soundName)
- **THEN** 播放对应的音效文件
- **AND** 如果音效文件不存在则静默失败不报错

#### Scenario: Sound Toggle
- **WHEN** 音效开关关闭
- **THEN** 调用 play() 不播放任何音效

### Requirement: Background Music
游戏 SHALL 支持背景音乐循环播放。

#### Scenario: BGM Loop
- **WHEN** 调用 SoundManager.playBGM()
- **THEN** 背景音乐开始循环播放
- **WHEN** 调用 SoundManager.stopBGM()
- **THEN** 背景音乐停止

#### Scenario: Music Toggle
- **WHEN** 音乐开关关闭
- **THEN** 背景音乐不播放

### Requirement: Game Sound Effects
游戏 SHALL 在关键节点播放对应音效。

#### Scenario: Launch Sound
- **WHEN** 小球发射时
- **THEN** 播放 launch 音效

#### Scenario: Hit Sound
- **WHEN** 小球击中砖块时
- **THEN** 播放 hit 音效

#### Scenario: Destroy Sound
- **WHEN** 砖块被消除时
- **THEN** 播放 destroy 音效

#### Scenario: PowerUp Sound
- **WHEN** 收集道具时
- **THEN** 播放 powerup 音效

#### Scenario: GameOver Sound
- **WHEN** 游戏结束时
- **THEN** 播放 gameover 音效

#### Scenario: Button Sound
- **WHEN** 点击按钮时
- **THEN** 播放 button 音效

#### Scenario: HighScore Sound
- **WHEN** 打破新纪录时
- **THEN** 播放 highscore 音效
