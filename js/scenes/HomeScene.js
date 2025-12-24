import Scene from './Scene.js'
import GameManager from '../game/GameManager.js'
import Button from '../ui/Button.js'

export default class HomeScene extends Scene {
  constructor() {
    super('home')
    this.highScore = 0
    this.startBtn = new Button({
      text: '开始游戏',
      color: '#4CAF50',
      width: 160,
      height: 55,
      fontSize: 20
    })
    this.rankBtn = new Button({
      text: '排行榜',
      color: '#FF9800',
      width: 120,
      height: 45,
      fontSize: 18
    })
    this.showingRank = false
    this.openDataCanvas = null
  }
  
  init(params) {
    super.init(params)
    this.highScore = GameManager.loadHighScore()
    this.layoutUI()
    this.bindEvents()
  }
  
  layoutUI() {
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    this.startBtn.setPosition(centerX - this.startBtn.width / 2, centerY + 30)
    this.rankBtn.setPosition(centerX - this.rankBtn.width / 2, centerY + 100)
  }
  
  bindEvents() {
    this.onTouchEnd = (e) => {
      const touch = e.changedTouches[0]
      
      if (this.showingRank) {
        this.hideRank()
        return
      }
      
      if (this.startBtn.contains(touch.clientX, touch.clientY)) {
        if (GameGlobal.soundManager) {
          GameGlobal.soundManager.play('button')
        }
        if (GameGlobal.sceneManager) {
          GameGlobal.sceneManager.switchTo('game')
        }
      } else if (this.rankBtn.contains(touch.clientX, touch.clientY)) {
        if (GameGlobal.soundManager) {
          GameGlobal.soundManager.play('button')
        }
        this.showRank()
      }
    }
    wx.onTouchEnd(this.onTouchEnd)
  }
  
  showRank() {
    this.showingRank = true
    try {
      if (!this.openDataCanvas) {
        this.openDataCanvas = wx.getOpenDataContext().canvas
      }
      wx.getOpenDataContext().postMessage({ type: 'showRank' })
    } catch (e) {
    }
  }
  
  hideRank() {
    this.showingRank = false
    try {
      wx.getOpenDataContext().postMessage({ type: 'hideRank' })
    } catch (e) {
    }
  }
  
  update(dt) {
  }
  
  render(ctx) {
    const { width, height } = canvas
    
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, width, height)
    
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 36px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('弹弹消消乐', width / 2, height / 3)
    
    ctx.font = '20px Arial'
    ctx.fillStyle = '#FFD700'
    ctx.fillText(`最高分: ${this.highScore}`, width / 2, height / 3 + 55)
    
    this.startBtn.render(ctx)
    this.rankBtn.render(ctx)
    
    if (this.showingRank && this.openDataCanvas) {
      ctx.drawImage(this.openDataCanvas, 0, 0, width, height)
    }
  }
  
  destroy() {
    if (this.showingRank) {
      this.hideRank()
    }
    if (this.onTouchEnd) {
      wx.offTouchEnd(this.onTouchEnd)
    }
    super.destroy()
  }
}
