// Client-side prediction and interpolation utilities for smooth multiplayer experience

// Smooth interpolation for remote players
export function interpolatePosition(currentPos, targetPos, factor = 0.15) {
  return {
    x: currentPos.x + (targetPos.x - currentPos.x) * factor,
    y: currentPos.y + (targetPos.y - currentPos.y) * factor,
    z: currentPos.z + (targetPos.z - currentPos.z) * factor
  }
}

// Exponential smoothing for rotation
export function interpolateRotation(currentRot, targetRot, factor = 0.2) {
  // Handle angle wrapping (normalize to -PI to PI)
  let diff = targetRot - currentRot
  while (diff > Math.PI) diff -= Math.PI * 2
  while (diff < -Math.PI) diff += Math.PI * 2
  return currentRot + diff * factor
}

// Client-side prediction with reconciliation
export class ClientPrediction {
  constructor() {
    this.pendingUpdates = []
    this.serverState = null
    this.clientState = null
  }

  // Add client input to pending updates
  addInput(input, timestamp) {
    this.pendingUpdates.push({ input, timestamp })
  }

  // Predict position based on inputs
  predict(currentPos, velocity, delta) {
    return {
      x: currentPos.x + velocity.x * delta,
      y: currentPos.y + velocity.y * delta,
      z: currentPos.z + velocity.z * delta
    }
  }

  // Reconcile with server state
  reconcile(serverPos, clientPos) {
    // Calculate position difference
    const dx = serverPos.x - clientPos.x
    const dy = serverPos.y - clientPos.y
    const dz = serverPos.z - clientPos.z
    
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
    
    // If difference is too large, snap to server
    if (distance > 2.0) {
      return serverPos
    }
    
    // Otherwise, smooth correction
    return {
      x: clientPos.x + dx * 0.3,
      y: clientPos.y + dy * 0.3,
      z: clientPos.z + dz * 0.3
    }
  }

  // Clear old updates
  cleanup(maxAge = 1000) {
    const now = Date.now()
    this.pendingUpdates = this.pendingUpdates.filter(
      u => now - u.timestamp < maxAge
    )
  }
}

// Lag compensation for game events (kicks, goals)
export class LagCompensation {
  constructor() {
    this.eventHistory = []
  }

  // Store event with timestamp
  addEvent(type, data, timestamp) {
    this.eventHistory.push({ type, data, timestamp })
  }

  // Find closest state at given time
  getNearestState(timestamp) {
    return this.eventHistory.find(
      e => Math.abs(e.timestamp - timestamp) < 50
    )
  }

  // Cleanup old events
  cleanup(maxAge = 2000) {
    const now = Date.now()
    this.eventHistory = this.eventHistory.filter(
      e => now - e.timestamp < maxAge
    )
  }
}

// Adaptive quality settings based on performance
export class AdaptiveQuality {
  constructor() {
    this.currentLevel = 'high'
    this.frameTimeHistory = []
    this.targetFrameTime = 16.67 // 60 FPS target
    
    this.settings = {
      high: {
        shadows: true,
        shadowMapSize: 2048,
        particleCount: 100,
        renderDistance: 200
      },
      medium: {
        shadows: true,
        shadowMapSize: 1024,
        particleCount: 50,
        renderDistance: 150
      },
      low: {
        shadows: false,
        shadowMapSize: 512,
        particleCount: 20,
        renderDistance: 100
      }
    }
  }

  // Update quality based on frame time
  updateQuality(frameTime) {
    this.frameTimeHistory.push(frameTime)
    if (this.frameTimeHistory.length > 60) {
      this.frameTimeHistory.shift()
    }

    const avgFrameTime = this.frameTimeHistory.reduce((a, b) => a + b, 0) / this.frameTimeHistory.length

    // Downgrade if consistently slow
    if (avgFrameTime > 33.33 && this.currentLevel !== 'low') {
      this.currentLevel = 'medium'
      if (avgFrameTime > 50) {
        this.currentLevel = 'low'
      }
    }
    // Upgrade if consistently fast
    else if (avgFrameTime < 20 && this.currentLevel !== 'high') {
      this.currentLevel = 'medium'
      if (avgFrameTime < 16.67) {
        this.currentLevel = 'high'
      }
    }

    return this.getSettings()
  }

  getSettings() {
    return this.settings[this.currentLevel]
  }

  getCurrentLevel() {
    return this.currentLevel
  }
}
