class Storage {
  static KEYS = {
    HIGH_SCORE: 'highScore',
    SOUND_ENABLED: 'soundEnabled',
    MUSIC_ENABLED: 'musicEnabled',
    VIBRATION_ENABLED: 'vibrationEnabled'
  }
  
  static get(key, defaultValue = null) {
    try {
      const value = wx.getStorageSync(key)
      return value !== '' && value !== undefined ? value : defaultValue
    } catch (e) {
      console.error('[Storage] Get failed:', key, e)
      return defaultValue
    }
  }
  
  static set(key, value) {
    try {
      wx.setStorageSync(key, value)
      return true
    } catch (e) {
      console.error('[Storage] Set failed:', key, e)
      return false
    }
  }
  
  static remove(key) {
    try {
      wx.removeStorageSync(key)
      return true
    } catch (e) {
      console.error('[Storage] Remove failed:', key, e)
      return false
    }
  }
  
  static getHighScore() {
    return Storage.get(Storage.KEYS.HIGH_SCORE, 0)
  }
  
  static setHighScore(score) {
    return Storage.set(Storage.KEYS.HIGH_SCORE, score)
  }
  
  static isSoundEnabled() {
    return Storage.get(Storage.KEYS.SOUND_ENABLED, true)
  }
  
  static setSoundEnabled(enabled) {
    return Storage.set(Storage.KEYS.SOUND_ENABLED, enabled)
  }
  
  static isMusicEnabled() {
    return Storage.get(Storage.KEYS.MUSIC_ENABLED, true)
  }
  
  static setMusicEnabled(enabled) {
    return Storage.set(Storage.KEYS.MUSIC_ENABLED, enabled)
  }
  
  static isVibrationEnabled() {
    return Storage.get(Storage.KEYS.VIBRATION_ENABLED, true)
  }
  
  static setVibrationEnabled(enabled) {
    return Storage.set(Storage.KEYS.VIBRATION_ENABLED, enabled)
  }
}

export default Storage
