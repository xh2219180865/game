import Scene from './Scene.js'

export default class HomeScene extends Scene {
  constructor() {
    super('home')
  }
  
  init(params) {
    super.init(params)
  }
  
  update(dt) {
  }
  
  render(ctx) {
    const { width, height } = canvas
    
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, width, height)
    
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 32px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('弹弹消消乐', width / 2, height / 3)
    
    ctx.font = '18px Arial'
    ctx.fillStyle = '#AAAAAA'
    ctx.fillText('点击屏幕开始游戏', width / 2, height / 2)
  }
  
  destroy() {
    super.destroy()
  }
}
