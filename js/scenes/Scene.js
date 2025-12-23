export default class Scene {
  constructor(name) {
    this.name = name
  }
  
  init(params) {
    console.log(`[Scene] ${this.name} initialized`)
  }
  
  update(dt) {
  }
  
  render(ctx) {
  }
  
  destroy() {
    console.log(`[Scene] ${this.name} destroyed`)
  }
}
