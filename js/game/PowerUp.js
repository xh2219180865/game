import GameConfig from '../config.js'

class PowerUp {
  constructor(col, row, type) {
    this.col = col
    this.row = row
    this.type = type
    
    this.width = 30
    this.height = 30
    this.gap = 5
    this.startX = 10 + 7.5
    this.startY = 100 + 7.5
    
    this.radius = 15
    this.collected = false
    
    this.updatePosition()
  }
  
  updatePosition() {
    this.x = this.startX + this.col * (45 + this.gap)
    this.y = this.startY + this.row * (45 + this.gap)
  }
  
  moveDown() {
    this.row++
    this.updatePosition()
  }
  
  checkCollision(ball) {
    const dx = ball.x - this.x
    const dy = ball.y - this.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    return distance < (ball.radius + this.radius)
  }
  
  getColor() {
    switch (this.type) {
      case 'extraBall':
        return '#4CAF50'
      case 'bomb':
        return '#F44336'
      case 'laser':
        return '#2196F3'
      default:
        return '#9C27B0'
    }
  }
  
  getSymbol() {
    switch (this.type) {
      case 'extraBall':
        return '+'
      case 'bomb':
        return '💣'
      case 'laser':
        return '⚡'
      default:
        return '?'
    }
  }
  
  render(ctx) {
    if (this.collected) return
    
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2)
    ctx.fillStyle = this.getColor()
    ctx.fill()
    ctx.closePath()
    
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2)
    ctx.stroke()
    
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 14px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(this.getSymbol(), this.x, this.y)
  }
}

export default PowerUp
