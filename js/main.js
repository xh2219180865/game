import SceneManager from './scenes/SceneManager.js'
import ResourceLoader from './utils/ResourceLoader.js'
import GameConfig from './config.js'

class GameMain {
  constructor() {
    this.canvas = wx.createCanvas()
    this.ctx = this.canvas.getContext('2d')
    this.lastTime = Date.now()
    this.frameCount = 0
    this.fpsTime = 0
    this.fps = 0
    
    this.init()
  }
  
  init() {
    this.resourceLoader = new ResourceLoader()
    this.sceneManager = new SceneManager()
    
    window.canvas = this.canvas
    window.sceneManager = this.sceneManager
    
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
      console.log('[GameMain] FPS:', this.fps)
    }
  }
  
  update(dt) {
    this.sceneManager.currentScene?.update(dt)
  }
  
  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.sceneManager.currentScene?.render(this.ctx)
    
    this.ctx.fillStyle = '#00FF00'
    this.ctx.font = '12px Arial'
    this.ctx.textAlign = 'left'
    this.ctx.fillText(`FPS: ${this.fps}`, 10, 20)
  }
}

new GameMain()
