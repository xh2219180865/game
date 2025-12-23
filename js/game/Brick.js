import GameConfig from '../config.js'

class Brick {
  constructor(col, row, hp) {
    this.col = col
    this.row = row
    this.hp = hp
    this.maxHp = hp
    
    this.width = 45
    this.height = 45
    this.gap = 5
    this.startX = 10
    this.startY = 100
    
    this.updatePosition()
    
    this.shakeOffset = 0
    this.isDestroying = false
  }
  
  updatePosition() {
    this.x = this.startX + this.col * (this.width + this.gap)
    this.y = this.startY + this.row * (this.height + this.gap)
  }
  
  hit() {
    this.hp--
    this.shake()
    
    if (this.hp <= 0) {
      this.destroy()
      return true
    }
    return false
  }
  
  shake() {
    this.shakeOffset = 5
  }
  
  destroy() {
    this.isDestroying = true
  }
  
  moveDown() {
    this.row++
    this.updatePosition()
  }
  
  update(dt) {
    if (this.shakeOffset > 0) {
      this.shakeOffset *= 0.8
      if (this.shakeOffset < 0.5) this.shakeOffset = 0
    }
  }
  
  render(ctx) {
    const offsetX = (Math.random() - 0.5) * this.shakeOffset
    const offsetY = (Math.random() - 0.5) * this.shakeOffset
    const x = this.x + offsetX
    const y = this.y + offsetY
    
    const hpRatio = this.hp / this.maxHp
    ctx.fillStyle = this.getColor(hpRatio)
    ctx.fillRect(x, y, this.width, this.height)
    
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 16px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(this.hp, x + this.width / 2, y + this.height / 2)
  }
  
  getColor(ratio) {
    if (ratio > 0.7) return '#4CAF50'
    if (ratio > 0.4) return '#FFC107'
    return '#F44336'
  }
}

export default Brick
