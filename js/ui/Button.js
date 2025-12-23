export default class Button {
  constructor(options = {}) {
    this.x = options.x || 0
    this.y = options.y || 0
    this.width = options.width || 150
    this.height = options.height || 50
    this.text = options.text || 'Button'
    this.color = options.color || '#4CAF50'
    this.textColor = options.textColor || '#FFFFFF'
    this.fontSize = options.fontSize || 18
    this.borderRadius = options.borderRadius || 8
    this.pressed = false
  }
  
  setPosition(x, y) {
    this.x = x
    this.y = y
  }
  
  contains(px, py) {
    return px >= this.x && px <= this.x + this.width &&
           py >= this.y && py <= this.y + this.height
  }
  
  setPressed(pressed) {
    this.pressed = pressed
  }
  
  render(ctx) {
    const color = this.pressed ? this.darkenColor(this.color) : this.color
    
    ctx.fillStyle = color
    ctx.beginPath()
    this.roundRect(ctx, this.x, this.y, this.width, this.height, this.borderRadius)
    ctx.fill()
    
    ctx.fillStyle = this.textColor
    ctx.font = `bold ${this.fontSize}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(this.text, this.x + this.width / 2, this.y + this.height / 2)
  }
  
  roundRect(ctx, x, y, w, h, r) {
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
  }
  
  darkenColor(hex) {
    const num = parseInt(hex.slice(1), 16)
    const r = Math.max(0, (num >> 16) - 30)
    const g = Math.max(0, ((num >> 8) & 0x00FF) - 30)
    const b = Math.max(0, (num & 0x0000FF) - 30)
    return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`
  }
}
