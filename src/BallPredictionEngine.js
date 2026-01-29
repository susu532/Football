/**
 * OmniPitch 3D Soccer Experience
 * Copyright (c) 2026 OmniPitch Games. All Rights Reserved.
 *
 * This file is proprietary and confidential.
 * Unauthorized copying, transfer, or use is strictly prohibited.
 */

/**
 * BallPredictionEngine.js
 * 
 * Competitive-grade ball prediction system with gold-standard netcode.
 * Implements Rocket League-inspired techniques for hiding latency and
 * providing instant ball response.
 * 
 * Features:
 * - Lookahead collision prediction (multi-frame)
 * - Micro-precise trajectory interpolation (Hermite splines)
 * - Rollback/reconciliation system
 * - Latency-adaptive smoothing
 * - Input-aware velocity prediction
 */

import { PHYSICS } from './PhysicsConstants.js'

// ============================================================================
// PREDICTION CONSTANTS
// ============================================================================

export const PREDICTION = {
  // Lookahead Configuration
  LOOKAHEAD_FRAMES: 8,                    // Frames to predict ahead
  LOOKAHEAD_MAX_TIME: 0.133,              // ~8 frames at 60Hz
  TTC_THRESHOLD: 0.1,                     // Time-to-collision trigger (100ms)
  TTC_PREEMPTIVE_FRAMES: 3,               // Frames before collision to start response
  
  // PING-BASED ADAPTIVE LOOKAHEAD
  LOOKAHEAD_MIN_MS: 50,                   // Minimum lookahead at low ping
  LOOKAHEAD_MAX_MS: 200,                  // Maximum lookahead at high ping
  LOOKAHEAD_PING_SCALE: 1.5,              // Lookahead = ping * scale
  PING_TIER_LOW: 50,                      // Low ping threshold (ms)
  PING_TIER_MED: 150,                     // Medium ping threshold (ms)
  
  // FIRST TOUCH PREDICTION
  FIRST_TOUCH_SNAP_FACTOR: 0.98,          // Near-instant visual snap on first contact
  FIRST_TOUCH_WINDOW_MS: 100,             // Time window to consider "first touch"
  FIRST_TOUCH_VELOCITY_BOOST: 1.2,        // Velocity boost for first touch responsiveness
  TOUCH_MEMORY_DURATION: 200,             // How long to remember a touch (ms)
  
  // Confidence Scoring
  CONFIDENCE_MIN: 0.3,                    // Minimum to apply prediction
  CONFIDENCE_DECAY_RATE: 0.85,            // Per-frame decay
  CONFIDENCE_COLLISION_BOOST: 1.5,        // Boost on confirmed collision
  CONFIDENCE_SERVER_WEIGHT: 0.4,          // Weight for server authority
  CONFIDENCE_FIRST_TOUCH_BOOST: 2.0,      // Extra boost for first touch
  
  // Trajectory Interpolation
  SPLINE_TENSION: 0.5,                    // Catmull-Rom tension (0 = sharp, 1 = smooth)
  TRAJECTORY_SAMPLES: 16,                 // Points per prediction arc
  MICRO_STEP_MS: 0.5,                     // 0.5ms micro-steps for precision
  
  // Rollback System
  ROLLBACK_BUFFER_SIZE: 12,               // Frames to store
  ROLLBACK_THRESHOLD: 0.5,                // Position diff to trigger rollback (units)
  ROLLBACK_VELOCITY_THRESHOLD: 5,         // Velocity diff to trigger rollback
  ROLLBACK_BLEND_FRAMES: 4,               // Frames to blend correction
  
  // Input Prediction
  INPUT_LOOKAHEAD_FRAMES: 3,              // Frames of input prediction
  INPUT_CONFIDENCE_DECAY: 0.8,            // Per-frame input confidence decay
  INPUT_VELOCITY_WEIGHT: 0.9,             // How much to trust input velocity
  
  // Latency Compensation
  MAX_EXTRAPOLATION_TIME: 0.2,            // Max 200ms extrapolation
  JITTER_BUFFER_SIZE: 5,                  // Snapshots for jitter smoothing
  ADAPTIVE_SMOOTH_MIN: 0.1,               // Minimum smoothing (low ping)
  ADAPTIVE_SMOOTH_MAX: 0.4,               // Maximum smoothing (high ping)
  
  // JITTER REDUCTION (EMA)
  JITTER_EMA_ALPHA: 0.15,                 // EMA alpha for position smoothing
  JITTER_VELOCITY_EMA_ALPHA: 0.25,        // EMA alpha for velocity smoothing
  JITTER_THRESHOLD: 0.02,                 // Position jitter threshold (units)
  JITTER_VELOCITY_THRESHOLD: 0.5,         // Velocity jitter threshold (units/s)
  MICRO_JITTER_FILTER: 0.005,             // Filter out micro-jitter below this
  
  // Visual Response
  INSTANT_RESPONSE_FACTOR: 0.95,          // Near-instant on first touch
  CONTINUOUS_COLLISION_FACTOR: 0.8,       // Ongoing collision response
  VISUAL_VELOCITY_CAP: 100,               // Max visual velocity (units/s)
  VISUAL_ACCELERATION_CAP: 500,           // Max visual acceleration (units/s²)
}

// ============================================================================
// MATH UTILITIES
// ============================================================================

/**
 * Hermite spline interpolation for smooth trajectory curves
 * @param {Object} p0 - Start position {x, y, z}
 * @param {Object} p1 - End position {x, y, z}
 * @param {Object} v0 - Start velocity {x, y, z}
 * @param {Object} v1 - End velocity {x, y, z}
 * @param {number} t - Interpolation factor [0, 1]
 * @returns {Object} Interpolated position {x, y, z}
 */
export function hermiteInterpolate(p0, p1, v0, v1, t) {
  const t2 = t * t
  const t3 = t2 * t
  
  // Hermite basis functions
  const h00 = 2 * t3 - 3 * t2 + 1
  const h10 = t3 - 2 * t2 + t
  const h01 = -2 * t3 + 3 * t2
  const h11 = t3 - t2
  
  return {
    x: h00 * p0.x + h10 * v0.x + h01 * p1.x + h11 * v1.x,
    y: h00 * p0.y + h10 * v0.y + h01 * p1.y + h11 * v1.y,
    z: h00 * p0.z + h10 * v0.z + h01 * p1.z + h11 * v1.z
  }
}

/**
 * Catmull-Rom spline for smooth multi-point interpolation
 * @param {Array} points - Array of positions [{x,y,z}, ...]
 * @param {number} t - Global interpolation factor [0, points.length-1]
 * @returns {Object} Interpolated position {x, y, z}
 */
export function catmullRomInterpolate(points, t) {
  if (points.length < 2) return points[0] || { x: 0, y: 0, z: 0 }
  if (points.length === 2) {
    const lt = Math.max(0, Math.min(1, t))
    return {
      x: points[0].x + (points[1].x - points[0].x) * lt,
      y: points[0].y + (points[1].y - points[0].y) * lt,
      z: points[0].z + (points[1].z - points[0].z) * lt
    }
  }
  
  const n = points.length - 1
  const i = Math.floor(Math.max(0, Math.min(n - 1, t)))
  const lt = t - i
  
  const p0 = points[Math.max(0, i - 1)]
  const p1 = points[i]
  const p2 = points[Math.min(n, i + 1)]
  const p3 = points[Math.min(n, i + 2)]
  
  const tension = PREDICTION.SPLINE_TENSION
  const s = (1 - tension) / 2
  
  const lt2 = lt * lt
  const lt3 = lt2 * lt
  
  return {
    x: s * (2*p1.x + (-p0.x + p2.x)*lt + (2*p0.x - 5*p1.x + 4*p2.x - p3.x)*lt2 + (-p0.x + 3*p1.x - 3*p2.x + p3.x)*lt3),
    y: s * (2*p1.y + (-p0.y + p2.y)*lt + (2*p0.y - 5*p1.y + 4*p2.y - p3.y)*lt2 + (-p0.y + 3*p1.y - 3*p2.y + p3.y)*lt3),
    z: s * (2*p1.z + (-p0.z + p2.z)*lt + (2*p0.z - 5*p1.z + 4*p2.z - p3.z)*lt2 + (-p0.z + 3*p1.z - 3*p2.z + p3.z)*lt3)
  }
}

/**
 * Calculate distance between two 3D points
 */
export function distance3D(a, b) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = a.z - b.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

/**
 * Normalize a 3D vector
 */
export function normalize3D(v) {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
  if (len < 0.0001) return { x: 0, y: 0, z: 0 }
  return { x: v.x / len, y: v.y / len, z: v.z / len }
}

/**
 * Dot product of two 3D vectors
 */
export function dot3D(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

/**
 * Linear interpolation
 */
export function lerp(a, b, t) {
  return a + (b - a) * Math.max(0, Math.min(1, t))
}

/**
 * 3D linear interpolation
 */
export function lerp3D(a, b, t) {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t)
  }
}

// ============================================================================
// COLLISION PREDICTION
// ============================================================================

/**
 * Sphere-Sphere sweep test for continuous collision detection
 * Returns time of first collision [0, 1] or null if no collision
 */
export function sphereSweepTest(ballStart, ballEnd, playerPos, ballRadius, playerRadius) {
  const combinedRadius = ballRadius + playerRadius
  
  // Ray from ballStart to ballEnd
  const dx = ballEnd.x - ballStart.x
  const dy = ballEnd.y - ballStart.y
  const dz = ballEnd.z - ballStart.z
  
  // Vector from player to ball start
  const fx = ballStart.x - playerPos.x
  const fy = ballStart.y - playerPos.y
  const fz = ballStart.z - playerPos.z
  
  // Quadratic coefficients: at² + bt + c = 0
  const a = dx * dx + dy * dy + dz * dz
  const b = 2 * (fx * dx + fy * dy + fz * dz)
  const c = fx * fx + fy * fy + fz * fz - combinedRadius * combinedRadius
  
  // No movement - check static collision
  if (a < 0.0001) {
    return c < 0 ? 0 : null
  }
  
  const discriminant = b * b - 4 * a * c
  if (discriminant < 0) return null
  
  const sqrtDisc = Math.sqrt(discriminant)
  const t1 = (-b - sqrtDisc) / (2 * a)
  const t2 = (-b + sqrtDisc) / (2 * a)
  
  // Return earliest valid intersection
  if (t1 >= 0 && t1 <= 1) return t1
  if (t2 >= 0 && t2 <= 1) return t2
  if (t1 < 0 && t2 > 1) return 0 // Already overlapping
  
  return null
}

/**
 * Multi-step sweep test with sub-frame precision
 */
export function multiStepSweepTest(ballStart, ballVel, playerPos, playerVel, dt, ballRadius, playerRadius, steps = 8) {
  let earliest = null
  
  for (let i = 0; i < steps; i++) {
    const t0 = (i / steps) * dt
    const t1 = ((i + 1) / steps) * dt
    
    const subStart = {
      x: ballStart.x + ballVel.x * t0,
      y: ballStart.y + ballVel.y * t0,
      z: ballStart.z + ballVel.z * t0
    }
    const subEnd = {
      x: ballStart.x + ballVel.x * t1,
      y: ballStart.y + ballVel.y * t1,
      z: ballStart.z + ballVel.z * t1
    }
    const subPlayer = {
      x: playerPos.x + playerVel.x * ((t0 + t1) / 2),
      y: playerPos.y + playerVel.y * ((t0 + t1) / 2),
      z: playerPos.z + playerVel.z * ((t0 + t1) / 2)
    }
    
    const hit = sphereSweepTest(subStart, subEnd, subPlayer, ballRadius, playerRadius)
    if (hit !== null) {
      const globalT = t0 + hit * (t1 - t0)
      if (earliest === null || globalT < earliest) {
        earliest = globalT
      }
      break // Found earliest collision in this segment
    }
  }
  
  return earliest
}

/**
 * Calculate exact time-to-collision between ball and player
 * @returns {number|null} Time in seconds until collision, or null if no collision predicted
 */
export function calculateTimeToCollision(ballPos, ballVel, playerPos, playerVel, ballRadius, playerRadius, maxTime) {
  const steps = PREDICTION.LOOKAHEAD_FRAMES
  const dt = maxTime / steps
  
  for (let i = 0; i < steps; i++) {
    const t = i * dt
    const futureBall = {
      x: ballPos.x + ballVel.x * t,
      y: Math.max(ballRadius, ballPos.y + ballVel.y * t - 0.5 * PHYSICS.WORLD_GRAVITY * t * t),
      z: ballPos.z + ballVel.z * t
    }
    const futurePlayer = {
      x: playerPos.x + playerVel.x * t,
      y: playerPos.y + playerVel.y * t,
      z: playerPos.z + playerVel.z * t
    }
    
    const dist = distance3D(futureBall, futurePlayer)
    if (dist < ballRadius + playerRadius) {
      // Refine with binary search
      let lo = Math.max(0, t - dt)
      let hi = t
      for (let j = 0; j < 8; j++) {
        const mid = (lo + hi) / 2
        const midBall = {
          x: ballPos.x + ballVel.x * mid,
          y: Math.max(ballRadius, ballPos.y + ballVel.y * mid - 0.5 * PHYSICS.WORLD_GRAVITY * mid * mid),
          z: ballPos.z + ballVel.z * mid
        }
        const midPlayer = {
          x: playerPos.x + playerVel.x * mid,
          y: playerPos.y + playerVel.y * mid,
          z: playerPos.z + playerVel.z * mid
        }
        if (distance3D(midBall, midPlayer) < ballRadius + playerRadius) {
          hi = mid
        } else {
          lo = mid
        }
      }
      return hi
    }
  }
  
  return null
}

// ============================================================================
// TRAJECTORY PREDICTION
// ============================================================================

/**
 * Predict ball trajectory with physics simulation
 * @param {Object} ballState - Current ball state {x, y, z, vx, vy, vz}
 * @param {number} steps - Number of simulation steps
 * @param {number} dt - Time step in seconds
 * @returns {Array} Array of predicted positions with velocities
 */
export function predictTrajectory(ballState, steps = PREDICTION.TRAJECTORY_SAMPLES, dt = 1/60) {
  const trajectory = []
  let pos = { x: ballState.x, y: ballState.y, z: ballState.z }
  let vel = { x: ballState.vx || 0, y: ballState.vy || 0, z: ballState.vz || 0 }
  
  const ballRadius = PHYSICS.BALL_RADIUS
  const gravity = PHYSICS.WORLD_GRAVITY
  const damping = 1 - PHYSICS.BALL_LINEAR_DAMPING * dt
  const restitution = PHYSICS.BALL_RESTITUTION
  
  for (let i = 0; i < steps; i++) {
    trajectory.push({
      x: pos.x, y: pos.y, z: pos.z,
      vx: vel.x, vy: vel.y, vz: vel.z,
      t: i * dt
    })
    
    // Physics integration
    vel.x *= damping
    vel.z *= damping
    
    if (pos.y > ballRadius) {
      vel.y -= gravity * dt
    }
    
    pos.x += vel.x * dt
    pos.y += vel.y * dt
    pos.z += vel.z * dt
    
    // Ground collision
    if (pos.y < ballRadius) {
      pos.y = ballRadius
      vel.y = Math.abs(vel.y) * restitution
      vel.x *= 0.85 // Floor friction
      vel.z *= 0.85
    }
    
    // Wall collisions (arena bounds)
    const halfWidth = PHYSICS.ARENA_HALF_WIDTH
    const halfDepth = PHYSICS.ARENA_HALF_DEPTH
    
    if (Math.abs(pos.x) > halfWidth - ballRadius) {
      pos.x = Math.sign(pos.x) * (halfWidth - ballRadius)
      vel.x *= -PHYSICS.WALL_RESTITUTION
    }
    if (Math.abs(pos.z) > halfDepth - ballRadius) {
      pos.z = Math.sign(pos.z) * (halfDepth - ballRadius)
      vel.z *= -PHYSICS.WALL_RESTITUTION
    }
  }
  
  return trajectory
}

/**
 * Get interpolated position along predicted trajectory
 * @param {Array} trajectory - Predicted trajectory from predictTrajectory()
 * @param {number} t - Time offset in seconds
 * @returns {Object} Interpolated position {x, y, z, vx, vy, vz}
 */
export function sampleTrajectory(trajectory, t) {
  if (!trajectory.length) return { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }
  
  // Find bounding points
  let i = 0
  while (i < trajectory.length - 1 && trajectory[i + 1].t <= t) i++
  
  if (i >= trajectory.length - 1) {
    return trajectory[trajectory.length - 1]
  }
  
  const p0 = trajectory[i]
  const p1 = trajectory[i + 1]
  const localT = (t - p0.t) / (p1.t - p0.t)
  
  // Use Hermite interpolation for smooth curve
  const pos = hermiteInterpolate(
    p0, p1,
    { x: p0.vx * (p1.t - p0.t), y: p0.vy * (p1.t - p0.t), z: p0.vz * (p1.t - p0.t) },
    { x: p1.vx * (p1.t - p0.t), y: p1.vy * (p1.t - p0.t), z: p1.vz * (p1.t - p0.t) },
    localT
  )
  
  // Interpolate velocity linearly
  return {
    x: pos.x,
    y: pos.y,
    z: pos.z,
    vx: lerp(p0.vx, p1.vx, localT),
    vy: lerp(p0.vy, p1.vy, localT),
    vz: lerp(p0.vz, p1.vz, localT)
  }
}

// ============================================================================
// ROLLBACK PREDICTION SYSTEM
// ============================================================================

/**
 * Manages rollback buffer for prediction reconciliation
 */
export class RollbackBuffer {
  constructor(maxSize = PREDICTION.ROLLBACK_BUFFER_SIZE) {
    this.buffer = []
    this.maxSize = maxSize
  }
  
  /**
   * Store a prediction state
   * @param {Object} state - {position, velocity, timestamp, tick}
   */
  push(state) {
    this.buffer.unshift({
      ...state,
      timestamp: state.timestamp || performance.now()
    })
    while (this.buffer.length > this.maxSize) {
      this.buffer.pop()
    }
  }
  
  /**
   * Get state at specific tick or closest
   */
  getAtTick(tick) {
    return this.buffer.find(s => s.tick === tick) || this.buffer[0]
  }
  
  /**
   * Get state at specific timestamp (interpolated)
   */
  getAtTime(timestamp) {
    if (!this.buffer.length) return null
    
    // Find bounding states
    let before = null, after = null
    for (const state of this.buffer) {
      if (state.timestamp <= timestamp) {
        before = state
        break
      }
      after = state
    }
    
    if (!before) return after || this.buffer[0]
    if (!after) return before
    
    // Interpolate between states
    const t = (timestamp - before.timestamp) / (after.timestamp - before.timestamp)
    return {
      position: lerp3D(before.position, after.position, t),
      velocity: lerp3D(before.velocity, after.velocity, t),
      timestamp: timestamp,
      tick: Math.round(lerp(before.tick, after.tick, t))
    }
  }
  
  /**
   * Check if rollback is needed by comparing to server state
   */
  needsRollback(serverState) {
    const localState = this.getAtTick(serverState.tick)
    if (!localState) return false
    
    const posDiff = distance3D(localState.position, serverState.position)
    const velDiff = distance3D(localState.velocity, serverState.velocity)
    
    return posDiff > PREDICTION.ROLLBACK_THRESHOLD ||
           velDiff > PREDICTION.ROLLBACK_VELOCITY_THRESHOLD
  }
  
  /**
   * Clear buffer (on major desync)
   */
  clear() {
    this.buffer = []
  }
}

// ============================================================================
// MAIN PREDICTION ENGINE
// ============================================================================

/**
 * BallPredictionEngine - Main class for competitive-grade ball prediction
 */
export class BallPredictionEngine {
  constructor() {
    // State buffers
    this.rollbackBuffer = new RollbackBuffer()
    this.jitterBuffer = []
    this.serverSnapshots = []
    
    // Prediction state
    this.predictedPosition = { x: 0, y: 2, z: 0 }
    this.predictedVelocity = { x: 0, y: 0, z: 0 }
    this.visualPosition = { x: 0, y: 2, z: 0 }
    
    // EMA smoothing for jitter reduction
    this.emaPosition = { x: 0, y: 2, z: 0 }
    this.emaVelocity = { x: 0, y: 0, z: 0 }
    this.prevVisualPosition = { x: 0, y: 2, z: 0 }
    
    // Confidence tracking
    this.confidence = 1.0
    this.lastCollisionTime = 0
    this.collisionActive = false
    
    // FIRST TOUCH tracking
    this.isFirstTouch = false
    this.lastTouchTime = 0
    this.touchCount = 0
    this.wasCollidingLastFrame = false
    
    // Latency tracking
    this.ping = 0
    this.jitter = 0
    this.lastServerTime = 0
    this.pingHistory = []  // For jitter calculation
    
    // Pre-computed trajectory
    this.trajectory = []
    this.trajectoryTime = 0
    
    // Collision prediction cache
    this.pendingCollisions = []
    this.collisionCooldown = 0
    
    // Ping-based adaptive lookahead
    this.adaptiveLookahead = PREDICTION.LOOKAHEAD_MAX_TIME
  }
  
  /**
   * Update network metrics with jitter calculation
   */
  updateLatency(ping, jitter = 0) {
    this.ping = ping
    this.jitter = jitter
    
    // Track ping history for adaptive smoothing
    this.pingHistory.push(ping)
    if (this.pingHistory.length > 10) this.pingHistory.shift()
    
    // Calculate adaptive lookahead based on ping
    const scaledLookahead = (ping / 1000) * PREDICTION.LOOKAHEAD_PING_SCALE
    this.adaptiveLookahead = Math.max(
      PREDICTION.LOOKAHEAD_MIN_MS / 1000,
      Math.min(PREDICTION.LOOKAHEAD_MAX_MS / 1000, scaledLookahead)
    )
  }
  
  /**
   * Get ping tier for adaptive behavior
   */
  getPingTier() {
    if (this.ping < PREDICTION.PING_TIER_LOW) return 'low'
    if (this.ping < PREDICTION.PING_TIER_MED) return 'medium'
    return 'high'
  }
  
  /**
   * Process new server state
   * @param {Object} serverState - {x, y, z, vx, vy, vz, tick}
   */
  onServerUpdate(serverState) {
    const now = performance.now()
    
    // Store in snapshot buffer
    this.serverSnapshots.unshift({
      ...serverState,
      timestamp: now
    })
    while (this.serverSnapshots.length > PREDICTION.JITTER_BUFFER_SIZE) {
      this.serverSnapshots.pop()
    }
    
    // Check for rollback
    if (this.rollbackBuffer.needsRollback({
      position: { x: serverState.x, y: serverState.y, z: serverState.z },
      velocity: { x: serverState.vx, y: serverState.vy, z: serverState.vz },
      tick: serverState.tick
    })) {
      this.reconcile(serverState)
    } else {
      // Smooth convergence
      this.blendToServer(serverState)
    }
    
    this.lastServerTime = now
  }
  
  /**
   * Reconcile prediction with server state (rollback and re-predict)
   */
  reconcile(serverState) {
    const blendFrames = PREDICTION.ROLLBACK_BLEND_FRAMES
    const blendFactor = 1 / blendFrames
    
    // Blend position smoothly
    this.predictedPosition = lerp3D(
      this.predictedPosition,
      { x: serverState.x, y: serverState.y, z: serverState.z },
      Math.min(1, blendFactor * 2)
    )
    
    // Snap velocity (more important to be accurate)
    this.predictedVelocity = lerp3D(
      this.predictedVelocity,
      { x: serverState.vx || 0, y: serverState.vy || 0, z: serverState.vz || 0 },
      0.6
    )
    
    // Reduce confidence after correction
    this.confidence *= 0.8
    
    // Re-predict trajectory
    this.recomputeTrajectory()
  }
  
  /**
   * Smooth blend towards server without full rollback
   */
  blendToServer(serverState) {
    // PING-TIER ADAPTIVE blend rate
    const pingTier = this.getPingTier()
    let baseRate
    switch (pingTier) {
      case 'low':   baseRate = 0.08; break  // Trust local more
      case 'medium': baseRate = 0.18; break  // Balanced
      default:       baseRate = 0.32; break  // Trust server more
    }
    
    // Latency-adjusted server position
    const latencySeconds = this.ping / 2000 // Half RTT
    const serverPosAdjusted = {
      x: serverState.x + (serverState.vx || 0) * latencySeconds,
      y: serverState.y + (serverState.vy || 0) * latencySeconds - 0.5 * PHYSICS.WORLD_GRAVITY * latencySeconds * latencySeconds,
      z: serverState.z + (serverState.vz || 0) * latencySeconds
    }
    
    // Apply EMA for jitter reduction before blending
    this.emaPosition = {
      x: this.emaPosition.x + PREDICTION.JITTER_EMA_ALPHA * (serverPosAdjusted.x - this.emaPosition.x),
      y: this.emaPosition.y + PREDICTION.JITTER_EMA_ALPHA * (serverPosAdjusted.y - this.emaPosition.y),
      z: this.emaPosition.z + PREDICTION.JITTER_EMA_ALPHA * (serverPosAdjusted.z - this.emaPosition.z)
    }
    
    const serverVel = { x: serverState.vx || 0, y: serverState.vy || 0, z: serverState.vz || 0 }
    this.emaVelocity = {
      x: this.emaVelocity.x + PREDICTION.JITTER_VELOCITY_EMA_ALPHA * (serverVel.x - this.emaVelocity.x),
      y: this.emaVelocity.y + PREDICTION.JITTER_VELOCITY_EMA_ALPHA * (serverVel.y - this.emaVelocity.y),
      z: this.emaVelocity.z + PREDICTION.JITTER_VELOCITY_EMA_ALPHA * (serverVel.z - this.emaVelocity.z)
    }
    
    // Filter micro-jitter
    const posDiff = distance3D(this.predictedPosition, this.emaPosition)
    if (posDiff > PREDICTION.MICRO_JITTER_FILTER) {
      this.predictedPosition = lerp3D(this.predictedPosition, this.emaPosition, baseRate)
    }
    
    const velDiff = distance3D(this.predictedVelocity, this.emaVelocity)
    if (velDiff > PREDICTION.JITTER_VELOCITY_THRESHOLD * 0.1) {
      this.predictedVelocity = lerp3D(this.predictedVelocity, this.emaVelocity, baseRate * 0.8)
    }
    
    // Boost confidence on clean updates
    this.confidence = Math.min(1, this.confidence + 0.05)
  }
  
  /**
   * Predict collision with player(s) and pre-apply response
   * @param {Array} players - Array of player states [{position, velocity, radius, sessionId}]
   * @param {string} localPlayerId - Session ID of local player for priority
   * @returns {Object|null} Collision prediction or null
   */
  predictCollision(players, localPlayerId) {
    if (this.collisionCooldown > 0) return null
    
    const now = performance.now()
    const ballPos = this.predictedPosition
    const ballVel = this.predictedVelocity
    const ballRadius = PHYSICS.BALL_RADIUS
    
    // PING-BASED ADAPTIVE LOOKAHEAD
    const maxTime = this.adaptiveLookahead
    
    let earliestCollision = null
    
    for (const player of players) {
      if (!player.position) continue
      
      const playerRadius = player.giant ? 2.0 : PHYSICS.PLAYER_RADIUS
      const playerPos = player.position
      const playerVel = player.velocity || { x: 0, y: 0, z: 0 }
      
      // Calculate time to collision with ping-scaled lookahead
      const ttc = calculateTimeToCollision(
        ballPos, ballVel,
        playerPos, playerVel,
        ballRadius, playerRadius,
        maxTime
      )
      
      if (ttc !== null && ttc < PREDICTION.TTC_THRESHOLD) {
        const priority = player.sessionId === localPlayerId ? 1.5 : 1.0
        const score = (PREDICTION.TTC_THRESHOLD - ttc) * priority
        
        if (!earliestCollision || score > earliestCollision.score) {
          earliestCollision = {
            playerId: player.sessionId,
            timeToCollision: ttc,
            score,
            playerPos,
            playerVel,
            playerRadius,
            isLocalPlayer: player.sessionId === localPlayerId
          }
        }
      }
    }
    
    if (earliestCollision && earliestCollision.timeToCollision < PREDICTION.TTC_THRESHOLD / 2) {
      // FIRST TOUCH DETECTION
      const timeSinceLastTouch = now - this.lastTouchTime
      this.isFirstTouch = !this.wasCollidingLastFrame && 
                          timeSinceLastTouch > PREDICTION.FIRST_TOUCH_WINDOW_MS
      
      // Pre-apply collision response for instant feel
      this.preApplyCollision(earliestCollision)
      
      // Update touch tracking
      this.lastTouchTime = now
      this.touchCount++
      this.wasCollidingLastFrame = true
    } else {
      this.wasCollidingLastFrame = false
    }
    
    return earliestCollision
  }
  
  /**
   * Pre-apply collision response before it actually happens
   */
  preApplyCollision(collision) {
    const { playerPos, playerVel, playerRadius } = collision
    const ballRadius = PHYSICS.BALL_RADIUS
    
    // Calculate collision normal
    const dx = this.predictedPosition.x - playerPos.x
    const dy = this.predictedPosition.y - playerPos.y
    const dz = this.predictedPosition.z - playerPos.z
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
    
    if (dist < 0.1) return
    
    const nx = dx / dist
    const ny = Math.max(0.1, dy / dist)
    const nz = dz / dist
    
    // Relative velocity
    const relVx = this.predictedVelocity.x - (playerVel.x || 0)
    const relVy = this.predictedVelocity.y - (playerVel.y || 0)
    const relVz = this.predictedVelocity.z - (playerVel.z || 0)
    
    // Approach speed
    const approachSpeed = relVx * nx + relVy * ny + relVz * nz
    
    if (approachSpeed >= 0) return // Moving apart
    
    // FIRST TOUCH BOOST
    const firstTouchMultiplier = this.isFirstTouch ? PREDICTION.FIRST_TOUCH_VELOCITY_BOOST : 1.0
    const confidenceBoost = this.isFirstTouch ? PREDICTION.CONFIDENCE_FIRST_TOUCH_BOOST : PREDICTION.CONFIDENCE_COLLISION_BOOST
    
    // Pre-apply impulse with confidence scaling
    const restitution = PHYSICS.PLAYER_BALL_RESTITUTION
    const playerSpeed = Math.sqrt((playerVel.x || 0) ** 2 + (playerVel.z || 0) ** 2)
    const momentumTransfer = playerSpeed > 3 ? PHYSICS.PLAYER_BALL_VELOCITY_TRANSFER : 0.5
    
    const impulseMag = -(1 + restitution) * approachSpeed * momentumTransfer * this.confidence * firstTouchMultiplier
    
    // Apply with ramping for smooth response
    const rampFactor = Math.min(1, (PREDICTION.TTC_THRESHOLD - collision.timeToCollision) / PREDICTION.TTC_THRESHOLD)
    
    // FIRST TOUCH uses instant snap factor
    const responseFactor = this.isFirstTouch ? 
      PREDICTION.FIRST_TOUCH_SNAP_FACTOR : 
      PREDICTION.INSTANT_RESPONSE_FACTOR
    
    this.predictedVelocity.x += impulseMag * nx * rampFactor * responseFactor
    this.predictedVelocity.y += (impulseMag * ny + PHYSICS.COLLISION_LIFT) * rampFactor * responseFactor
    this.predictedVelocity.z += impulseMag * nz * rampFactor * responseFactor
    
    // Add player momentum transfer
    this.predictedVelocity.x += (playerVel.x || 0) * PHYSICS.TOUCH_VELOCITY_TRANSFER * rampFactor
    this.predictedVelocity.z += (playerVel.z || 0) * PHYSICS.TOUCH_VELOCITY_TRANSFER * rampFactor
    
    // Set cooldown (shorter for first touch)
    this.collisionCooldown = this.isFirstTouch ? 30 : 50
    this.lastCollisionTime = performance.now()
    this.collisionActive = true
    
    // Boost confidence
    if (collision.isLocalPlayer) {
      this.confidence = Math.min(1, this.confidence + confidenceBoost * 0.2)
    }
    
    // Recompute trajectory
    this.recomputeTrajectory()
  }
  
  /**
   * Update prediction each frame
   * @param {number} dt - Delta time in seconds
   * @param {Array} players - Current player states
   * @param {string} localPlayerId - Local player session ID
   */
  update(dt, players = [], localPlayerId = null) {
    // Decay cooldown
    if (this.collisionCooldown > 0) {
      this.collisionCooldown -= dt * 1000
    }
    
    // Decay confidence over time
    this.confidence *= Math.pow(PREDICTION.CONFIDENCE_DECAY_RATE, dt * 60)
    this.confidence = Math.max(PREDICTION.CONFIDENCE_MIN, this.confidence)
    
    // Physics integration
    const gravity = PHYSICS.WORLD_GRAVITY
    const damping = 1 - PHYSICS.BALL_LINEAR_DAMPING * dt
    
    this.predictedVelocity.x *= damping
    this.predictedVelocity.z *= damping
    
    if (this.predictedPosition.y > PHYSICS.BALL_RADIUS) {
      this.predictedVelocity.y -= gravity * dt
    }
    
    this.predictedPosition.x += this.predictedVelocity.x * dt
    this.predictedPosition.y += this.predictedVelocity.y * dt
    this.predictedPosition.z += this.predictedVelocity.z * dt
    
    // Ground collision
    if (this.predictedPosition.y < PHYSICS.BALL_RADIUS) {
      this.predictedPosition.y = PHYSICS.BALL_RADIUS
      if (this.predictedVelocity.y < 0) {
        this.predictedVelocity.y = Math.abs(this.predictedVelocity.y) * PHYSICS.BALL_RESTITUTION
        this.predictedVelocity.x *= 0.85
        this.predictedVelocity.z *= 0.85
      }
    }
    
    // Wall collisions
    const halfWidth = PHYSICS.ARENA_HALF_WIDTH
    const halfDepth = PHYSICS.ARENA_HALF_DEPTH
    const ballRadius = PHYSICS.BALL_RADIUS
    
    if (Math.abs(this.predictedPosition.x) > halfWidth - ballRadius) {
      this.predictedPosition.x = Math.sign(this.predictedPosition.x) * (halfWidth - ballRadius)
      this.predictedVelocity.x *= -PHYSICS.WALL_RESTITUTION
    }
    if (Math.abs(this.predictedPosition.z) > halfDepth - ballRadius) {
      this.predictedPosition.z = Math.sign(this.predictedPosition.z) * (halfDepth - ballRadius)
      this.predictedVelocity.z *= -PHYSICS.WALL_RESTITUTION
    }
    
    // Predict collisions
    this.predictCollision(players, localPlayerId)
    
    // Store in rollback buffer
    this.rollbackBuffer.push({
      position: { ...this.predictedPosition },
      velocity: { ...this.predictedVelocity },
      tick: Math.floor(performance.now() / (1000 / 60))
    })
    
    // Update visual position with smoothing
    this.updateVisual(dt)
  }
  
  /**
   * Update visual position with adaptive smoothing
   */
  updateVisual(dt) {
    // Store previous for acceleration limiting
    this.prevVisualPosition = { ...this.visualPosition }
    
    // Adaptive smoothing based on latency, collision state, and first touch
    let smoothFactor
    
    if (this.isFirstTouch && this.collisionActive) {
      // FIRST TOUCH: Near-instant snap
      smoothFactor = PREDICTION.FIRST_TOUCH_SNAP_FACTOR
      this.isFirstTouch = false // Reset after applying
    } else if (this.collisionActive) {
      // Continuous collision: fast but not instant
      smoothFactor = PREDICTION.INSTANT_RESPONSE_FACTOR
      
      // Fade out collision state
      if (performance.now() - this.lastCollisionTime > PREDICTION.TOUCH_MEMORY_DURATION) {
        this.collisionActive = false
      }
    } else {
      // PING-TIER adaptive smoothing
      const pingTier = this.getPingTier()
      let baseSmoothness
      switch (pingTier) {
        case 'low':   baseSmoothness = PREDICTION.ADAPTIVE_SMOOTH_MIN; break
        case 'medium': baseSmoothness = (PREDICTION.ADAPTIVE_SMOOTH_MIN + PREDICTION.ADAPTIVE_SMOOTH_MAX) / 2; break
        default:       baseSmoothness = PREDICTION.ADAPTIVE_SMOOTH_MAX; break
      }
      smoothFactor = 1 - Math.exp(-30 * dt * (1 - baseSmoothness))
    }
    
    this.visualPosition = lerp3D(this.visualPosition, this.predictedPosition, smoothFactor)
    
    // JITTER REDUCTION: Clamp visual velocity and acceleration
    const visualVelX = (this.visualPosition.x - this.prevVisualPosition.x) / dt
    const visualVelY = (this.visualPosition.y - this.prevVisualPosition.y) / dt
    const visualVelZ = (this.visualPosition.z - this.prevVisualPosition.z) / dt
    const visualSpeed = Math.sqrt(visualVelX ** 2 + visualVelY ** 2 + visualVelZ ** 2)
    
    // Velocity capping
    if (visualSpeed > PREDICTION.VISUAL_VELOCITY_CAP) {
      const scale = PREDICTION.VISUAL_VELOCITY_CAP / visualSpeed
      this.visualPosition = lerp3D(this.prevVisualPosition, this.visualPosition, scale)
    }
    
    // Micro-jitter filter: if movement is below threshold, snap to prevent wobble
    const frameDist = distance3D(this.visualPosition, this.prevVisualPosition)
    if (frameDist < PREDICTION.MICRO_JITTER_FILTER && !this.collisionActive) {
      // Don't show micro-movements
      this.visualPosition = { ...this.prevVisualPosition }
    }
  }
  
  /**
   * Recompute trajectory for prediction
   */
  recomputeTrajectory() {
    this.trajectory = predictTrajectory({
      x: this.predictedPosition.x,
      y: this.predictedPosition.y,
      z: this.predictedPosition.z,
      vx: this.predictedVelocity.x,
      vy: this.predictedVelocity.y,
      vz: this.predictedVelocity.z
    })
    this.trajectoryTime = performance.now()
  }
  
  /**
   * Apply instant kick prediction (for local player kicks)
   */
  applyKickPrediction(impulse, timestamp = null) {
    const kickTime = timestamp || performance.now()
    const frameOffset = Math.max(0, (performance.now() - kickTime) / 1000)
    
    // Apply impulse
    const invMass = 1 / PHYSICS.BALL_MASS
    this.predictedVelocity.x += impulse.x * invMass
    this.predictedVelocity.y += impulse.y * invMass
    this.predictedVelocity.z += impulse.z * invMass
    
    // Compensate for frame offset
    if (frameOffset > 0) {
      this.predictedVelocity.y -= PHYSICS.WORLD_GRAVITY * frameOffset
      this.predictedPosition.x += this.predictedVelocity.x * frameOffset
      this.predictedPosition.y += this.predictedVelocity.y * frameOffset
      this.predictedPosition.z += this.predictedVelocity.z * frameOffset
    }
    
    // Boost confidence for local action
    this.confidence = 1.0
    this.collisionActive = true
    this.lastCollisionTime = performance.now()
    
    // Instant visual snap
    this.visualPosition = { ...this.predictedPosition }
    
    this.recomputeTrajectory()
  }
  
  /**
   * Get current visual position for rendering
   */
  getVisualPosition() {
    return { ...this.visualPosition }
  }
  
  /**
   * Get predicted velocity
   */
  getVelocity() {
    return { ...this.predictedVelocity }
  }
  
  /**
   * Get prediction confidence
   */
  getConfidence() {
    return this.confidence
  }
  
  /**
   * Get predicted trajectory for visualization
   */
  getTrajectory() {
    return this.trajectory
  }
  
  /**
   * Reset engine state
   */
  reset(position = { x: 0, y: 2, z: 0 }) {
    this.predictedPosition = { ...position }
    this.predictedVelocity = { x: 0, y: 0, z: 0 }
    this.visualPosition = { ...position }
    this.emaPosition = { ...position }
    this.emaVelocity = { x: 0, y: 0, z: 0 }
    this.prevVisualPosition = { ...position }
    this.confidence = 1.0
    this.isFirstTouch = false
    this.lastTouchTime = 0
    this.touchCount = 0
    this.wasCollidingLastFrame = false
    this.rollbackBuffer.clear()
    this.trajectory = []
    this.pendingCollisions = []
    this.pingHistory = []
  }
  
  /**
   * Check if currently in first touch state
   */
  isInFirstTouch() {
    return this.isFirstTouch
  }
  
  /**
   * Get adaptive lookahead time based on ping
   */
  getAdaptiveLookahead() {
    return this.adaptiveLookahead
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

// Create singleton instance for easy usage
export const ballPredictionEngine = new BallPredictionEngine()

export default BallPredictionEngine
