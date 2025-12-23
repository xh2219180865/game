const GameConfig = {
  brick: {
    columns: 7,
    spawnRate: 0.6,
    baseHP: 1,
    hpGrowth: 1.2,
    maxHP: 999
  },
  
  ball: {
    initialCount: 1,
    speed: 800,
    radius: 8,
    launchInterval: 80
  },
  
  powerUp: {
    extraBallRate: 0.15,
    bombRate: 0.05,
    laserRate: 0.03,
    bombRadius: 1,
    radius: 15
  },
  
  score: {
    perHit: 10,
    perDestroy: 100,
    comboMultiplier: 1.5
  },

  screen: {
    designWidth: 375,
    designHeight: 667
  },
  
  debug: {
    showFPS: false
  }
}

export default GameConfig
