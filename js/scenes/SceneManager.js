import HomeScene from './HomeScene.js'

export default class SceneManager {
  constructor() {
    this.currentScene = null
    this.scenes = {
      'home': HomeScene
    }
  }
  
  switchTo(sceneName, params = {}) {
    console.log(`[SceneManager] Switching to scene: ${sceneName}`)
    
    if (this.currentScene) {
      this.currentScene.destroy()
      this.currentScene = null
    }
    
    const SceneClass = this.scenes[sceneName]
    if (!SceneClass) {
      console.error(`[SceneManager] Scene not found: ${sceneName}`)
      return
    }
    
    this.currentScene = new SceneClass(sceneName)
    this.currentScene.init(params)
    
    console.log(`[SceneManager] Scene switched to: ${sceneName}`)
  }
  
  registerScene(name, SceneClass) {
    this.scenes[name] = SceneClass
  }
}
