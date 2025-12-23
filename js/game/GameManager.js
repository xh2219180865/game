import GameConfig from '../config.js'
import Ball from './Ball.js'
import Brick from './Brick.js'
import Physics from './Physics.js'
import PowerUp from './PowerUp.js'

class GameManager {
  constructor(canvas) {
    this.canvas = canvas
    this.state = 'idle'
    this.round = 0
    this.score = 0
    this.balls = []
    this.bricks = []
    this.powerUps = []
    
    this.ballCount = GameConfig.ball.initialCount
    this.launchPoint = { x: canvas.width / 2, y: canvas.height - 50 }
    this.nextLaunchX = this.launchPoint.x
    this.aimAngle = -Math.PI / 2
    
    this.gameOverLine = canvas.height - 100
    this.isNewRecord = false
    
    this.onGameOver = null
    this.launchedCount = 0
    this.pendingBalls = 0
    
    this.init()
  }
  
  static loadHighScore() {
    if (window.Storage) {
      return window.Storage.getHighScore()
    }
    try {
      return wx.getStorageSync('highScore') || 0
    } catch (e) {
      return 0
    }
  }
  
  saveHighScore() {
    const highScore = GameManager.loadHighScore()
    if (this.score > highScore) {
      this.isNewRecord = true
      if (window.Storage) {
        window.Storage.setHighScore(this.score)
      } else {
        try {
          wx.setStorageSync('highScore', this.score)
        } catch (e) {
          console.error('Failed to save high score:', e)
        }
      }
      if (window.soundManager) {
        window.soundManager.play('highscore')
      }
    }
  }
  
  init() {
    this.resetBalls()
    this.spawnNewRow()
  }
  
  resetBalls() {
    this.balls = []
    this.launchPoint.x = this.nextLaunchX
    for (let i = 0; i < this.ballCount; i++) {
      const ball = new Ball(this.launchPoint.x, this.launchPoint.y)
      this.balls.push(ball)
    }
  }
  
  spawnNewRow() {
    this.round++
    
    this.bricks.forEach(brick => brick.moveDown())
    
    this.powerUps.forEach(powerUp => powerUp.moveDown())
    
    const cols = GameConfig.brick.columns
    for (let col = 0; col < cols; col++) {
      if (Math.random() < GameConfig.brick.spawnRate) {
        const hp = Math.floor(this.round * GameConfig.brick.hpGrowth) + 
                   Math.floor(Math.random() * this.round)
        this.bricks.push(new Brick(col, 0, Math.max(1, hp)))
      } else {
        const rand = Math.random()
        if (rand < GameConfig.powerUp.extraBallRate) {
          this.powerUps.push(new PowerUp(col, 0, 'extraBall'))
        } else if (rand < GameConfig.powerUp.extraBallRate + GameConfig.powerUp.bombRate) {
          this.powerUps.push(new PowerUp(col, 0, 'bomb'))
        } else if (rand < GameConfig.powerUp.extraBallRate + GameConfig.powerUp.bombRate + GameConfig.powerUp.laserRate) {
          this.powerUps.push(new PowerUp(col, 0, 'laser'))
        }
      }
    }
    
    this.checkGameOver()
  }
  
  startAiming(x, y) {
    if (this.state !== 'idle') return
    this.state = 'aiming'
    this.updateAim(x, y)
  }
  
  updateAim(x, y) {
    if (this.state !== 'aiming') return
    
    const dx = x - this.launchPoint.x
    const dy = y - this.launchPoint.y
    this.aimAngle = Math.atan2(dy, dx)
    
    if (this.aimAngle > -0.1) this.aimAngle = -0.1
    if (this.aimAngle < -Math.PI + 0.1) this.aimAngle = -Math.PI + 0.1
  }
  
  launch() {
    if (this.state !== 'aiming') return
    this.state = 'shooting'
    this.launchedCount = 0
    
    if (window.soundManager) {
      window.soundManager.play('launch')
    }
    
    let delay = 0
    this.balls.forEach((ball) => {
      setTimeout(() => {
        ball.x = this.launchPoint.x
        ball.y = this.launchPoint.y
        ball.launch(this.aimAngle)
        this.launchedCount++
      }, delay)
      delay += GameConfig.ball.launchInterval
    })
  }
  
  update(dt) {
    if (this.state === 'gameover') return
    
    const bounds = {
      width: this.canvas.width,
      height: this.canvas.height,
      bottomBoundary: this.canvas.height
    }
    
    let allReturned = true
    let firstLandedX = null
    
    const maxStep = GameConfig.ball.radius * 0.8
    const steps = Math.max(1, Math.ceil((GameConfig.ball.speed * dt) / maxStep))
    const subDt = dt / steps
    
    this.balls.forEach(ball => {
      if (ball.active) {
        for (let step = 0; step < steps && ball.active; step++) {
          ball.stepMove(subDt)
          
          Physics.checkWallCollision(ball, bounds)
          
          for (let i = this.bricks.length - 1; i >= 0; i--) {
            const brick = this.bricks[i]
            if (Physics.checkAndHandleBrickCollision(ball, brick)) {
              if (brick.hit()) {
                this.score += GameConfig.score.perDestroy
                this.bricks.splice(i, 1)
                if (window.soundManager) {
                  window.soundManager.play('destroy')
                }
                this.vibrate()
              } else {
                this.score += GameConfig.score.perHit
                if (window.soundManager) {
                  window.soundManager.play('hit')
                }
                this.vibrateShort()
              }
            }
          }
          
          for (let i = this.powerUps.length - 1; i >= 0; i--) {
            const powerUp = this.powerUps[i]
            if (powerUp.checkCollision(ball)) {
              this.collectPowerUp(powerUp, i)
            }
          }
          
          if (ball.y + ball.radius >= this.canvas.height) {
            ball.stop()
            if (firstLandedX === null) {
              firstLandedX = ball.x
            }
          }
        }
        
        if (ball.active) {
          allReturned = false
        }
      }
    })
    
    if (firstLandedX !== null) {
      const radius = GameConfig.ball.radius
      this.nextLaunchX = Math.max(radius, Math.min(firstLandedX, this.canvas.width - radius))
    }
    
    if (this.state === 'shooting' && allReturned && this.launchedCount >= this.ballCount) {
      this.nextRound()
    }
    
    this.bricks.forEach(brick => brick.update(dt))
  }
  
  nextRound() {
    this.state = 'idle'
    this.ballCount += this.pendingBalls
    this.pendingBalls = 0
    this.spawnNewRow()
    this.resetBalls()
  }
  
  checkGameOver() {
    const isOver = this.bricks.some(brick => 
      brick.y + brick.height > this.gameOverLine
    )
    
    if (isOver) {
      this.state = 'gameover'
      this.saveHighScore()
      if (window.soundManager) {
        window.soundManager.play('gameover')
      }
      this.triggerGameOver()
    }
  }
  
  triggerGameOver() {
    if (this.onGameOver) {
      this.onGameOver({
        score: this.score,
        round: this.round,
        ballCount: this.ballCount,
        isNewRecord: this.isNewRecord
      })
    }
  }
  
  collectPowerUp(powerUp, index) {
    if (window.soundManager) {
      window.soundManager.play('powerup')
    }
    
    switch (powerUp.type) {
      case 'extraBall':
        this.pendingBalls++
        break
      case 'bomb':
        this.triggerBomb(powerUp)
        break
      case 'laser':
        this.triggerLaser(powerUp)
        break
    }
    this.powerUps.splice(index, 1)
  }
  
  triggerBomb(powerUp) {
    const bombRadius = GameConfig.powerUp.bombRadius
    for (let i = this.bricks.length - 1; i >= 0; i--) {
      const brick = this.bricks[i]
      if (Math.abs(brick.col - powerUp.col) <= bombRadius &&
          Math.abs(brick.row - powerUp.row) <= bombRadius) {
        this.score += GameConfig.score.perDestroy
        this.bricks.splice(i, 1)
      }
    }
  }
  
  triggerLaser(powerUp) {
    for (let i = this.bricks.length - 1; i >= 0; i--) {
      const brick = this.bricks[i]
      if (brick.col === powerUp.col) {
        this.score += GameConfig.score.perDestroy
        this.bricks.splice(i, 1)
      }
    }
  }
  
  vibrateShort() {
    try {
      if (window.Storage && window.Storage.isVibrationEnabled()) {
        wx.vibrateShort({ type: 'light' })
      }
    } catch (e) {}
  }
  
  vibrate() {
    try {
      if (window.Storage && window.Storage.isVibrationEnabled()) {
        wx.vibrateShort({ type: 'medium' })
      }
    } catch (e) {}
  }
  
  render(ctx) {
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    
    this.bricks.forEach(brick => brick.render(ctx))
    
    this.powerUps.forEach(powerUp => powerUp.render(ctx))
    
    this.balls.forEach(ball => ball.render(ctx))
    
    if (this.state === 'aiming' || this.state === 'idle') {
      this.renderAimLine(ctx)
    }
    
    this.renderUI(ctx)
  }
  
  renderAimLine(ctx) {
    ctx.beginPath()
    ctx.arc(this.launchPoint.x, this.launchPoint.y, 10, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
    ctx.fill()
    
    ctx.beginPath()
    ctx.setLineDash([10, 10])
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.lineWidth = 2
    ctx.moveTo(this.launchPoint.x, this.launchPoint.y)
    ctx.lineTo(
      this.launchPoint.x + Math.cos(this.aimAngle) * 200,
      this.launchPoint.y + Math.sin(this.aimAngle) * 200
    )
    ctx.stroke()
    ctx.setLineDash([])
  }
  
  renderUI(ctx) {
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 20px Arial'
    ctx.textAlign = 'left'
    ctx.fillText(`分数: ${this.score}`, 20, 40)
    
    ctx.textAlign = 'right'
    ctx.fillText(`第 ${this.round} 回合`, this.canvas.width - 20, 40)
    
    ctx.textAlign = 'center'
    ctx.font = '14px Arial'
    ctx.fillStyle = '#AAAAAA'
    ctx.fillText(`小球: ${this.ballCount}`, this.launchPoint.x, this.canvas.height - 15)
  }
  
}

export default GameManager
