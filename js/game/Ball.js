import GameConfig from '../config.js'

class Ball {
  constructor(x, y) {
    this.x = x
    this.y = y
    this.vx = 0
    this.vy = 0
    this.radius = GameConfig.ball.radius
    this.speed = GameConfig.ball.speed
    this.active = false
  }
  
  launch(angle) {
    this.vx = Math.cos(angle) * this.speed
    this.vy = Math.sin(angle) * this.speed
    this.active = true
  }
  
  update(dt) {
    if (!this.active) return
    
    this.x += this.vx * dt
    this.y += this.vy * dt
  }
  
  stepMove(subDt) {
    if (!this.active) return
    this.x += this.vx * subDt
    this.y += this.vy * subDt
  }
  
  stop() {
    this.active = false
    this.vx = 0
    this.vy = 0
  }
  
  reset(x = 0, y = 0) {
    this.x = x
    this.y = y
    this.vx = 0
    this.vy = 0
    this.active = false
  }
  
  render(ctx) {
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2)
    ctx.fillStyle = '#FFFFFF'
    ctx.fill()
    ctx.closePath()
  }
}

export default Ball
