class ObjectPool {
  constructor(createFn, initialSize = 10) {
    this.createFn = createFn
    this.pool = []
    
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.createFn())
    }
  }
  
  get() {
    return this.pool.pop() || this.createFn()
  }
  
  release(obj) {
    if (obj.reset) {
      obj.reset()
    }
    this.pool.push(obj)
  }
  
  releaseAll(objects) {
    objects.forEach(obj => this.release(obj))
  }
  
  getSize() {
    return this.pool.length
  }
}

export default ObjectPool
