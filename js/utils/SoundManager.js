import Storage from './Storage.js'

class SoundManager {
  constructor() {
    this.sounds = {}
    this.bgm = null
    this.soundEnabled = Storage.isSoundEnabled()
    this.musicEnabled = Storage.isMusicEnabled()
    this.soundsReady = false
    
    this.soundFiles = {
      launch: 'res/sounds/launch.mp3',
      hit: 'res/sounds/hit.mp3',
      destroy: 'res/sounds/destroy.mp3',
      powerup: 'res/sounds/powerup.mp3',
      gameover: 'res/sounds/gameover.mp3',
      button: 'res/sounds/button.mp3',
      highscore: 'res/sounds/highscore.mp3'
    }
    
    this.bgmFile = 'res/sounds/bgm.mp3'
    
    this.checkSoundsReady()
  }
  
  checkSoundsReady() {
    try {
      const fs = wx.getFileSystemManager()
      fs.access({
        path: this.soundFiles.button,
        success: () => {
          this.soundsReady = true
          console.log('[SoundManager] Sound files ready')
        },
        fail: () => {
          this.soundsReady = false
        }
      })
    } catch (e) {
      this.soundsReady = false
    }
  }
  
  play(soundName) {
    if (!this.soundEnabled || !this.soundsReady) return
    
    const filePath = this.soundFiles[soundName]
    if (!filePath) return
    
    try {
      const audio = wx.createInnerAudioContext()
      audio.src = filePath
      audio.onError(() => {})
      audio.play()
      
      audio.onEnded(() => {
        audio.destroy()
      })
    } catch (e) {
    }
  }
  
  playBGM() {
    if (!this.musicEnabled || !this.soundsReady) return
    
    try {
      if (this.bgm) {
        this.bgm.play()
        return
      }
      
      this.bgm = wx.createInnerAudioContext()
      this.bgm.src = this.bgmFile
      this.bgm.loop = true
      this.bgm.onError(() => {})
      this.bgm.play()
    } catch (e) {
    }
  }
  
  stopBGM() {
    try {
      if (this.bgm) {
        this.bgm.stop()
      }
    } catch (e) {
      // Silent fail
    }
  }
  
  pauseBGM() {
    try {
      if (this.bgm) {
        this.bgm.pause()
      }
    } catch (e) {
      // Silent fail
    }
  }
  
  setVolume(volume) {
    try {
      if (this.bgm) {
        this.bgm.volume = volume
      }
    } catch (e) {
      // Silent fail
    }
  }
  
  setSoundEnabled(enabled) {
    this.soundEnabled = enabled
    Storage.setSoundEnabled(enabled)
  }
  
  setMusicEnabled(enabled) {
    this.musicEnabled = enabled
    Storage.setMusicEnabled(enabled)
    
    if (enabled) {
      this.playBGM()
    } else {
      this.stopBGM()
    }
  }
  
  toggleSound() {
    this.setSoundEnabled(!this.soundEnabled)
    return this.soundEnabled
  }
  
  toggleMusic() {
    this.setMusicEnabled(!this.musicEnabled)
    return this.musicEnabled
  }
}

export default SoundManager
