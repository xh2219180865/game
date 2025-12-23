# ad-system Specification

## Purpose
TBD - created by archiving change add-ad-system. Update Purpose after archive.
## Requirements
### Requirement: Ad Manager
游戏 SHALL 提供 AdManager 广告管理类，统一管理广告展示。

#### Scenario: Show Rewarded Ad
- **WHEN** 调用 AdManager.showRewardedAd(callback)
- **THEN** 尝试展示激励视频广告
- **AND** 用户完整观看后执行回调
- **AND** 广告不可用时静默失败不影响程序

#### Scenario: Show Interstitial Ad
- **WHEN** 调用 AdManager.showInterstitialAd()
- **THEN** 尝试展示插屏广告
- **AND** 广告不可用时静默失败

### Requirement: Revive Feature
游戏 SHALL 在结算页提供"看广告复活"选项。

#### Scenario: Watch Ad to Revive
- **WHEN** 用户在结算页点击"看广告复活"按钮
- **THEN** 展示激励视频广告
- **AND** 观看完成后玩家复活继续游戏
- **AND** 广告不可用时按钮显示为不可用状态

### Requirement: Interstitial Ad Trigger
游戏 SHALL 每3局游戏结束后触发插屏广告。

#### Scenario: Show Interstitial Every 3 Games
- **WHEN** 玩家完成第3局、第6局、第9局...游戏
- **THEN** 尝试展示插屏广告
- **AND** 广告不可用时跳过不影响流程

