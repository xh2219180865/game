export default class ResourceLoader {
  constructor() {
    this.images = {}
    this.imageList = [
    ]
  }
  
  loadAll() {
    console.log('[ResourceLoader] Starting to load resources...')
    
    if (this.imageList.length === 0) {
      console.log('[ResourceLoader] No resources to load')
      return Promise.resolve()
    }
    
    const promises = this.imageList.map(item => this.loadImage(item.key, item.src))
    
    return Promise.all(promises)
      .then(() => {
        console.log('[ResourceLoader] All resources loaded successfully')
      })
      .catch(err => {
        console.error('[ResourceLoader] Failed to load resources:', err)
        throw err
      })
  }
  
  loadImage(key, src) {
    return new Promise((resolve, reject) => {
      const image = wx.createImage()
      
      image.onload = () => {
        this.images[key] = image
        console.log(`[ResourceLoader] Loaded image: ${key}`)
        resolve(image)
      }
      
      image.onerror = (err) => {
        console.error(`[ResourceLoader] Failed to load image: ${key}`, err)
        reject(new Error(`Failed to load image: ${key}`))
      }
      
      image.src = src
    })
  }
  
  getImage(key) {
    return this.images[key]
  }
  
  registerImage(key, src) {
    this.imageList.push({ key, src })
  }
}
