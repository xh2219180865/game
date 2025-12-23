import Scene from './Scene.js'
import Button from '../ui/Button.js'
import GameManager from '../game/GameManager.js'

export default class ResultScene extends Scene {
  constructor() {
    super('result')
    this.score = 0
    this.round = 0
    this.ballCount = 0
    this.isNewRecord = false
    this.highScore = 0
    
    this.restartBtn = new Button({
      text: '再来一局',
      color: '#4CAF50',
      width: 140,
      height: 50
    })
    
    this.homeBtn = new Button({
      text: '返回主页',
      color: '#2196F3',
      width: 140,
      height: 50
    })
    
    this.shareBtn = new Button({
      text: '分享成绩',
      color: '#FF9800',
      width: 200,
      height: 45
    })
    
    this.reviveBtn = new Button({
      text: '看广告复活',
      color: '#9C27B0',
      width: 200,
      height: 45
    })
    
    this.canRevive = true
  }
  
  init(params) {
    super.init(params)
    this.score = params.score || 0
    this.round = params.round || 0
    this.ballCount = params.ballCount || 1
    this.isNewRecord = params.isNewRecord || false
    this.highScore = GameManager.loadHighScore()
    this.canRevive = params.canRevive !== false
    this.gameData = params
    
    this.incrementGameCount()
    this.reportScore()
    this.layoutButtons()
    this.bindEvents()
  }
  
  incrementGameCount() {
    if (window.adManager) {
      window.adManager.incrementGameCount()
      window.adManager.tryShowInterstitial()
    }
  }
  
  reportScore() {
    if (window.shareManager) {
      window.shareManager.reportScore(this.score)
    }
  }
  
  layoutButtons() {
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    const btnY = centerY + 100
    const btnGap = 20
    
    this.restartBtn.setPosition(centerX - this.restartBtn.width - btnGap / 2, btnY)
    this.homeBtn.setPosition(centerX + btnGap / 2, btnY)
    this.shareBtn.setPosition(centerX - this.shareBtn.width / 2, btnY + 70)
    this.reviveBtn.setPosition(centerX - this.reviveBtn.width / 2, btnY + 130)
  }
  
  bindEvents() {
    this.onTouchEnd = (e) => {
      const touch = e.changedTouches[0]
      const x = touch.clientX
      const y = touch.clientY
      
      if (this.restartBtn.contains(x, y)) {
        this.restartGame()
      } else if (this.homeBtn.contains(x, y)) {
        this.goHome()
      } else if (this.shareBtn.contains(x, y)) {
        this.shareScore()
      } else if (this.canRevive && this.reviveBtn.contains(x, y)) {
        this.watchAdToRevive()
      }
    }
    
    wx.onTouchEnd(this.onTouchEnd)
  }
  
  restartGame() {
    if (window.soundManager) {
      window.soundManager.play('button')
    }
    if (window.sceneManager) {
      window.sceneManager.switchTo('game')
    }
  }
  
  goHome() {
    if (window.soundManager) {
      window.soundManager.play('button')
    }
    if (window.sceneManager) {
      window.sceneManager.switchTo('home')
    }
  }
  
  shareScore() {
    if (window.soundManager) {
      window.soundManager.play('button')
    }
    if (window.shareManager) {
      window.shareManager.share(this.score)
    }
  }
  
  watchAdToRevive() {
    if (window.soundManager) {
      window.soundManager.play('button')
    }
    
    if (window.adManager && window.adManager.isAdAvailable()) {
      window.adManager.showRewardedAd((success) => {
        if (success) {
          this.reviveGame()
        }
      })
    } else {
      this.reviveGame()
    }
  }
  
  reviveGame() {
    if (window.sceneManager) {
      window.sceneManager.switchTo('game', {
        revive: true,
        score: this.score,
        round: this.round,
        ballCount: this.ballCount
      })
    }
  }
  
  update(dt) {
  }
  
  render(ctx) {
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 36px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('游戏结束', centerX, centerY - 100)
    
    if (this.isNewRecord) {
      ctx.fillStyle = '#FFD700'
      ctx.font = 'bold 20px Arial'
      ctx.fillText('🎉 新纪录! 🎉', centerX, centerY - 55)
    }
    
    ctx.fillStyle = '#FFFFFF'
    ctx.font = '22px Arial'
    ctx.fillText(`最终分数: ${this.score}`, centerX, centerY - 10)
    ctx.fillText(`坚持了 ${this.round} 回合`, centerX, centerY + 25)
    ctx.fillText(`小球数量: ${this.ballCount}`, centerX, centerY + 60)
    
    this.restartBtn.render(ctx)
    this.homeBtn.render(ctx)
    this.shareBtn.render(ctx)
    
    if (this.canRevive) {
      this.reviveBtn.render(ctx)
    }
  }
  
  destroy() {
    if (this.onTouchEnd) {
      wx.offTouchEnd(this.onTouchEnd)
    }
    super.destroy()
  }
}
