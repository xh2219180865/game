import Scene from './Scene.js'
import Ball from '../game/Ball.js'
import Physics from '../game/Physics.js'

export default class PhysicsTestScene extends Scene {
  constructor() {
    super('physicsTest')
    this.balls = []
    this.testBricks = []
    this.launchPoint = { x: 0, y: 0 }
    this.isAiming = false
    this.aimAngle = -Math.PI / 2
  }
  
  init(params) {
    super.init(params)
    
    const { width, height } = canvas
    this.launchPoint = { x: width / 2, y: height - 50 }
    
    this.balls = [new Ball(this.launchPoint.x, this.launchPoint.y)]
    
    this.testBricks = [
      { x: 50, y: 100, width: 45, height: 45, hp: 3 },
      { x: 120, y: 100, width: 45, height: 45, hp: 5 },
      { x: 190, y: 100, width: 45, height: 45, hp: 2 },
      { x: 260, y: 100, width: 45, height: 45, hp: 4 },
      { x: 85, y: 160, width: 45, height: 45, hp: 3 },
      { x: 155, y: 160, width: 45, height: 45, hp: 6 },
      { x: 225, y: 160, width: 45, height: 45, hp: 2 }
    ]
    
    this.bindEvents()
  }
  
  bindEvents() {
    wx.onTouchStart(this.onTouchStart.bind(this))
    wx.onTouchMove(this.onTouchMove.bind(this))
    wx.onTouchEnd(this.onTouchEnd.bind(this))
  }
  
  unbindEvents() {
    wx.offTouchStart()
    wx.offTouchMove()
    wx.offTouchEnd()
  }
  
  onTouchStart(e) {
    const touch = e.touches[0]
    if (!this.balls[0].active) {
      this.isAiming = true
      this.updateAim(touch.clientX, touch.clientY)
    }
  }
  
  onTouchMove(e) {
    if (this.isAiming) {
      const touch = e.touches[0]
      this.updateAim(touch.clientX, touch.clientY)
    }
  }
  
  onTouchEnd(e) {
    if (this.isAiming) {
      this.isAiming = false
      this.launchBall()
    }
  }
  
  updateAim(x, y) {
    const dx = x - this.launchPoint.x
    const dy = y - this.launchPoint.y
    this.aimAngle = Math.atan2(dy, dx)
    
    if (this.aimAngle > -0.1) this.aimAngle = -0.1
    if (this.aimAngle < -Math.PI + 0.1) this.aimAngle = -Math.PI + 0.1
  }
  
  launchBall() {
    const ball = this.balls[0]
    if (!ball.active) {
      ball.launch(this.aimAngle)
    }
  }
  
  update(dt) {
    const { width, height } = canvas
    const bounds = {
      width,
      height,
      bottomBoundary: height
    }
    
    this.balls.forEach(ball => {
      if (ball.active) {
        ball.update(dt)
        
        const wallResult = Physics.checkWallCollision(ball, bounds)
        
        if (wallResult.hitBottom) {
          ball.x = this.launchPoint.x
          ball.y = this.launchPoint.y
        }
        
        this.testBricks.forEach(brick => {
          if (brick.hp > 0) {
            const hit = Physics.checkAndHandleBrickCollision(ball, brick)
            if (hit) {
              brick.hp--
            }
          }
        })
      }
    })
    
    this.testBricks = this.testBricks.filter(brick => brick.hp > 0)
  }
  
  render(ctx) {
    const { width, height } = canvas
    
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, width, height)
    
    ctx.fillStyle = '#FFFFFF'
    ctx.font = '14px Arial'
    ctx.textAlign = 'left'
    ctx.fillText('物理测试场景 - 滑动瞄准并释放发射', 10, 30)
    
    this.testBricks.forEach(brick => {
      const hpRatio = brick.hp / 6
      if (hpRatio > 0.7) ctx.fillStyle = '#4CAF50'
      else if (hpRatio > 0.4) ctx.fillStyle = '#FFC107'
      else ctx.fillStyle = '#F44336'
      
      ctx.fillRect(brick.x, brick.y, brick.width, brick.height)
      
      ctx.fillStyle = '#FFFFFF'
      ctx.font = 'bold 16px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(brick.hp, brick.x + brick.width / 2, brick.y + brick.height / 2)
    })
    
    this.balls.forEach(ball => ball.render(ctx))
    
    if (this.isAiming || !this.balls[0].active) {
      this.renderAimLine(ctx)
    }
    
    ctx.fillStyle = '#AAAAAA'
    ctx.font = '12px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(`x1`, this.launchPoint.x, height - 20)
  }
  
  renderAimLine(ctx) {
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
  
  destroy() {
    this.unbindEvents()
    super.destroy()
  }
}
