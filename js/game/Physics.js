class Physics {
  static checkWallCollision(ball, bounds) {
    const { width, height, bottomBoundary } = bounds
    let collided = false
    
    if (ball.x - ball.radius <= 0) {
      ball.x = ball.radius
      ball.vx = -ball.vx
      collided = true
    }
    
    if (ball.x + ball.radius >= width) {
      ball.x = width - ball.radius
      ball.vx = -ball.vx
      collided = true
    }
    
    if (ball.y - ball.radius <= 0) {
      ball.y = ball.radius
      ball.vy = -ball.vy
      collided = true
    }
    
    if (ball.y + ball.radius >= bottomBoundary) {
      ball.stop()
      return { collided: true, hitBottom: true }
    }
    
    return { collided, hitBottom: false }
  }
  
  static checkRectCollision(ball, rect) {
    const closestX = Math.max(rect.x, Math.min(ball.x, rect.x + rect.width))
    const closestY = Math.max(rect.y, Math.min(ball.y, rect.y + rect.height))
    
    const distX = ball.x - closestX
    const distY = ball.y - closestY
    const distance = Math.sqrt(distX * distX + distY * distY)
    
    if (distance < ball.radius) {
      return {
        collided: true,
        closestX,
        closestY,
        distX,
        distY,
        distance
      }
    }
    
    return { collided: false }
  }
  
  static handleBounce(ball, rect, collision) {
    const { closestX, closestY } = collision
    
    const fromLeft = closestX === rect.x
    const fromRight = closestX === rect.x + rect.width
    const fromTop = closestY === rect.y
    const fromBottom = closestY === rect.y + rect.height
    
    const isCorner = (fromLeft || fromRight) && (fromTop || fromBottom)
    
    if (isCorner) {
      ball.vx = -ball.vx
      ball.vy = -ball.vy
    } else if (fromLeft || fromRight) {
      ball.vx = -ball.vx
    } else if (fromTop || fromBottom) {
      ball.vy = -ball.vy
    }
    
    const overlap = ball.radius - collision.distance
    if (overlap > 0 && collision.distance > 0) {
      const normalX = collision.distX / collision.distance
      const normalY = collision.distY / collision.distance
      ball.x += normalX * overlap
      ball.y += normalY * overlap
    }
  }
  
  static checkAndHandleBrickCollision(ball, brick) {
    const rect = {
      x: brick.x,
      y: brick.y,
      width: brick.width,
      height: brick.height
    }
    
    const collision = Physics.checkRectCollision(ball, rect)
    
    if (collision.collided) {
      Physics.handleBounce(ball, rect, collision)
      return true
    }
    
    return false
  }
}

export default Physics
