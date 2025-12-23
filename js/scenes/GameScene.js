import Scene from './Scene.js'
import GameManager from '../game/GameManager.js'

export default class GameScene extends Scene {
  constructor() {
    super('game')
    this.gameManager = null
  }
  
  init(params) {
    super.init(params)
    this.gameManager = new GameManager(canvas)
    this.gameManager.onGameOver = (data) => this.handleGameOver(data)
    this.bindEvents()
  }
  
  bindEvents() {
    this.onTouchStart = (e) => {
      const touch = e.touches[0]
      this.gameManager.startAiming(touch.clientX, touch.clientY)
    }
    
    this.onTouchMove = (e) => {
      const touch = e.touches[0]
      this.gameManager.updateAim(touch.clientX, touch.clientY)
    }
    
    this.onTouchEnd = (e) => {
      if (this.gameManager.state === 'aiming') {
        this.gameManager.launch()
      }
    }
    
    wx.onTouchStart(this.onTouchStart)
    wx.onTouchMove(this.onTouchMove)
    wx.onTouchEnd(this.onTouchEnd)
  }
  
  handleGameOver(data) {
    if (window.sceneManager) {
      window.sceneManager.switchTo('result', data)
    }
  }
  
  unbindEvents() {
    wx.offTouchStart(this.onTouchStart)
    wx.offTouchMove(this.onTouchMove)
    wx.offTouchEnd(this.onTouchEnd)
  }
  
  restartGame() {
    this.gameManager = new GameManager(canvas)
  }
  
  goHome() {
    if (window.sceneManager) {
      window.sceneManager.switchTo('home')
    }
  }
  
  update(dt) {
    if (this.gameManager) {
      this.gameManager.update(dt)
    }
  }
  
  render(ctx) {
    if (this.gameManager) {
      this.gameManager.render(ctx)
    }
  }
  
  destroy() {
    this.unbindEvents()
    super.destroy()
  }
}
