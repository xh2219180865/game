class AdManager {
  constructor() {
    this.rewardedAd = null
    this.interstitialAd = null
    this.bannerAd = null
    this.adEnabled = false
    this.gameCount = 0
    
    this.rewardedAdUnitId = ''
    this.interstitialAdUnitId = ''
    this.bannerAdUnitId = ''
    
    this.initAds()
  }
  
  initAds() {
    this.initRewardedAd()
    this.initInterstitialAd()
  }
  
  initRewardedAd() {
    if (!this.rewardedAdUnitId) return
    
    try {
      if (wx.createRewardedVideoAd) {
        this.rewardedAd = wx.createRewardedVideoAd({
          adUnitId: this.rewardedAdUnitId
        })
        
        this.rewardedAd.onError(() => {})
        this.adEnabled = true
      }
    } catch (e) {
    }
  }
  
  initInterstitialAd() {
    if (!this.interstitialAdUnitId) return
    
    try {
      if (wx.createInterstitialAd) {
        this.interstitialAd = wx.createInterstitialAd({
          adUnitId: this.interstitialAdUnitId
        })
        
        this.interstitialAd.onError(() => {})
      }
    } catch (e) {
    }
  }
  
  isAdAvailable() {
    return this.adEnabled && this.rewardedAd !== null
  }
  
  showRewardedAd(callback) {
    if (!this.rewardedAd) {
      return false
    }
    
    try {
      const closeHandler = (res) => {
        if (res && res.isEnded) {
          callback && callback(true)
        } else {
          callback && callback(false)
        }
        this.rewardedAd.offClose(closeHandler)
      }
      
      this.rewardedAd.onClose(closeHandler)
      
      this.rewardedAd.show().catch(() => {
        this.rewardedAd.load().then(() => {
          this.rewardedAd.show()
        }).catch(() => {
          callback && callback(false)
        })
      })
      
      return true
    } catch (e) {
      return false
    }
  }
  
  showInterstitialAd() {
    if (!this.interstitialAd) {
      return false
    }
    
    try {
      this.interstitialAd.show().catch(() => {
        this.interstitialAd.load().then(() => {
          this.interstitialAd.show()
        }).catch(() => {})
      })
      return true
    } catch (e) {
      return false
    }
  }
  
  showBannerAd(style = {}) {
    if (!this.bannerAdUnitId) return null
    
    try {
      if (this.bannerAd) {
        this.bannerAd.show()
        return this.bannerAd
      }
      
      if (wx.createBannerAd) {
        this.bannerAd = wx.createBannerAd({
          adUnitId: this.bannerAdUnitId,
          style: {
            left: style.left || 0,
            top: style.top || 0,
            width: style.width || 300
          }
        })
        
        this.bannerAd.onError(() => {})
        this.bannerAd.show()
        return this.bannerAd
      }
    } catch (e) {
    }
    return null
  }
  
  hideBannerAd() {
    try {
      if (this.bannerAd) {
        this.bannerAd.hide()
      }
    } catch (e) {
    }
  }
  
  incrementGameCount() {
    this.gameCount++
    return this.gameCount
  }
  
  shouldShowInterstitial() {
    return this.gameCount > 0 && this.gameCount % 3 === 0
  }
  
  tryShowInterstitial() {
    if (this.shouldShowInterstitial()) {
      this.showInterstitialAd()
    }
  }
}

export default AdManager
