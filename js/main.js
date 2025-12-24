import SceneManager from './scenes/SceneManager.js'
import ResourceLoader from './utils/ResourceLoader.js'
import GameConfig from './config.js'
import Storage from './utils/Storage.js'
import SoundManager from './utils/SoundManager.js'
import ShareManager from './utils/ShareManager.js'
import AdManager from './utils/AdManager.js'

class GameMain {
  constructor() {
    console.log('[GameMain] Constructor started')
    this.canvas = wx.createCanvas()
    this.ctx = this.canvas.getContext('2d')
    this.lastTime = Date.now()
    this.frameCount = 0
    this.fpsTime = 0
    this.fps = 0
    
    this.init()
  }
  
  init() {
    console.log('[GameMain] Init started')
    this.resourceLoader = new ResourceLoader()
    this.sceneManager = new SceneManager()
    this.soundManager = new SoundManager()
    this.shareManager = new ShareManager()
    this.adManager = new AdManager()
    
    if (typeof GameGlobal !== 'undefined') {
      GameGlobal.canvas = this.canvas
      GameGlobal.Storage = Storage
      GameGlobal.sceneManager = this.sceneManager
      GameGlobal.soundManager = this.soundManager
      GameGlobal.shareManager = this.shareManager
      GameGlobal.adManager = this.adManager
      GameGlobal.game = this
    }
    console.log('[GameMain] Global variables set')
    
    this.resourceLoader.loadAll().then(() => {
      console.log('[GameMain] Resources loaded, starting game loop')
      this.sceneManager.switchTo('home')
      this.startLoop()
    }).catch(err => {
      console.error('[GameMain] Resource loading failed:', err)
    })
  }
  
  startLoop() {
    const loop = () => {
      const now = Date.now()
      const dt = (now - this.lastTime) / 1000
      this.lastTime = now
      
      this.updateFPS(dt)
      this.update(dt)
      this.render()
      
      requestAnimationFrame(loop)
    }
    loop()
  }
  
  updateFPS(dt) {
    this.frameCount++
    this.fpsTime += dt
    if (this.fpsTime >= 1) {
      this.fps = this.frameCount
      this.frameCount = 0
      this.fpsTime = 0
    }
  }
  
  update(dt) {
    this.sceneManager.currentScene?.update(dt)
  }
  
  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.sceneManager.currentScene?.render(this.ctx)
    
    if (GameConfig.debug.showFPS) {
      this.ctx.fillStyle = '#00FF00'
      this.ctx.font = '12px Arial'
      this.ctx.textAlign = 'left'
      this.ctx.fillText(`FPS: ${this.fps}`, 10, 20)
    }
  }
}

new GameMain()
