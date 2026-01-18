// Ball.jsx - Client ball visual with interpolation for Colyseus
// Server-authoritative: Client NEVER moves the ball, only displays

import React, { useRef, useEffect, useImperativeHandle, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'

import { useGLTF, Trail } from '@react-three/drei'
import * as THREE from 'three'
import { useSpring, a } from '@react-spring/three'
import { PHYSICS } from './PhysicsConstants.js'

// Soccer Ball Visual Component
export const SoccerBall = React.forwardRef(({ radius = PHYSICS.BALL_RADIUS, onKickFeedback }, ref) => {
  const internalRef = useRef()
  useImperativeHandle(ref, () => internalRef.current)
  const { scene } = useGLTF('/models/soccer_ball.glb')
  
  const [spring, api] = useSpring(() => ({
    scale: 5,
    config: { tension: 400, friction: 10 }
  }))

  // Kick feedback effect
  useEffect(() => {
    if (onKickFeedback) {
      const handleKick = () => {
        api.start({
          from: { scale: 7 },
          to: { scale: 5 }
        })
      }
      // Store callback for external trigger
      onKickFeedback.current = handleKick
    }
  }, [api, onKickFeedback])

  const clonedBall = useMemo(() => {
    const cloned = scene.clone()
    cloned.traverse((child) => {
      if (child.isMesh) {
        // Material fixes
        if (child.material) {
          const oldMat = child.material
          // Use MeshStandardMaterial - cheaper than MeshPhysicalMaterial
          child.material = new THREE.MeshStandardMaterial({
            map: oldMat.map,
            color: oldMat.color, // Restore original color
            roughness: 0.7, // Increased for matte look
            metalness: 0.0,
            flatShading: false
          })
          
          // Ensure textures are filtered well
          if (child.material.map) {
            child.material.map.anisotropy = 4 // Reduced from 16
            child.material.map.minFilter = THREE.LinearMipmapLinearFilter
            child.material.map.magFilter = THREE.LinearFilter
            child.material.map.needsUpdate = true
          }
          child.material.needsUpdate = true
        }

        child.castShadow = true
        child.receiveShadow = false // Disable receive shadow for performance
        
        // REMOVED: computeVertexNormals to save CPU
      }
    })
    return cloned
  }, [scene])

  return (
    <a.primitive 
      ref={internalRef}
      object={clonedBall} 
      scale={spring.scale} 
    />
  )
})
SoccerBall.displayName = 'SoccerBall'

// === S-TIER PING-AWARE COLLISION PREDICTION ===
// Designed for 0-ping visual feel at ANY latency

// Collision constants - ultra-aggressive for instant feel
const COLLISION_COOLDOWN = 0.002 // 2ms - ultra-fast re-collision for high speeds
const BASE_LOOKAHEAD = 0.03 // Reduced from 0.05
const MAX_LOOKAHEAD = 0.10 // Reduced from 0.15
const IMPULSE_PREDICTION_FACTOR = 0.98 // Increased to 0.98 for Phase 5
const BALL_RADIUS = PHYSICS.BALL_RADIUS
const PLAYER_RADIUS = PHYSICS.PLAYER_RADIUS // Increased from 0.14 to match server cuboid(0.6, 0.2, 0.6)
const COMBINED_RADIUS = BALL_RADIUS + PLAYER_RADIUS

// RAPIER-matched physics constants
const BALL_RESTITUTION = PHYSICS.BALL_RESTITUTION
const GRAVITY = PHYSICS.WORLD_GRAVITY
const LINEAR_DAMPING = PHYSICS.BALL_LINEAR_DAMPING

// Ultra-aggressive interpolation for instant response
const LERP_NORMAL = 25 // Snappy base
const LERP_COLLISION = 80 // Near-instant snap on collision
const LERP_SNAP_THRESHOLD = 8
const SPECULATIVE_THRESHOLD = 0.5 // Tightened from 0.7
const KICK_VISUAL_SNAP = 0.95 // Near-instant visual response

// Sub-frame sweep test
const sweepSphereToSphere = (ballStart, ballEnd, playerPos, combinedRadius) => {
  const dx = ballEnd.x - ballStart.x
  const dy = ballEnd.y - ballStart.y
  const dz = ballEnd.z - ballStart.z
  
  const fx = ballStart.x - playerPos.x
  const fy = ballStart.y - playerPos.y
  const fz = ballStart.z - playerPos.z
  
  const a = dx * dx + dy * dy + dz * dz
  const b = 2 * (fx * dx + fy * dy + fz * dz)
  const c = fx * fx + fy * fy + fz * fz - combinedRadius * combinedRadius
  
  if (a < 0.0001) return null
  
  const discriminant = b * b - 4 * a * c
  if (discriminant < 0) return null
  
  const sqrtDisc = Math.sqrt(discriminant)
  const t1 = (-b - sqrtDisc) / (2 * a)
  const t2 = (-b + sqrtDisc) / (2 * a)
  
  if (t1 >= 0 && t1 <= 1) return t1
  if (t2 >= 0 && t2 <= 1) return t2
  return null
}

// Multi-step sweep for sub-frame precision
const multiStepSweep = (ballStart, ballEnd, playerPos, combinedRadius) => {
  for (let i = 0; i < PHYSICS.SWEEP_SUBSTEPS; i++) {
    const t0 = i / PHYSICS.SWEEP_SUBSTEPS
    const t1 = (i + 1) / PHYSICS.SWEEP_SUBSTEPS
    const subStart = ballStart.clone().lerp(ballEnd, t0)
    const subEnd = ballStart.clone().lerp(ballEnd, t1)
    const hit = sweepSphereToSphere(subStart, subEnd, playerPos, combinedRadius)
    if (hit !== null) return t0 + hit * (t1 - t0)
  }
  return null
}

// Anticipatory trajectory prediction with gravity
const predictFuturePosition = (pos, vel, time, gravity) => ({
  x: pos.x + vel.x * time,
  y: Math.max(BALL_RADIUS, pos.y + vel.y * time - 0.5 * gravity * time * time),
  z: pos.z + vel.z * time
})

// Trajectory Line Component
const TrajectoryLine = ({ startPos, startVel, gravity = 20 }) => {
  const points = useMemo(() => {
    const pts = []
    const pos = startPos.clone()
    const vel = startVel.clone()
    const dt = 1/60
    const maxSteps = 120 // 2 seconds
    
    // Simple physics simulation
    for (let i = 0; i < maxSteps; i++) {
      pts.push(pos.clone())
      
      pos.addScaledVector(vel, dt)
      vel.y -= gravity * dt
      
      // Floor bounce
      if (pos.y < PHYSICS.BALL_RADIUS) {
        pos.y = PHYSICS.BALL_RADIUS
        vel.y *= -PHYSICS.BALL_RESTITUTION
        vel.x *= 0.85
        vel.z *= 0.85
      }
      
      // Wall bounces (approximate)
      if (Math.abs(pos.x) > 14.5) {
        pos.x = Math.sign(pos.x) * 14.5
        vel.x *= -PHYSICS.BALL_RESTITUTION
      }
      if (Math.abs(pos.z) > 9.5) {
        pos.z = Math.sign(pos.z) * 9.5
        vel.z *= -PHYSICS.BALL_RESTITUTION
      }
    }
    return pts
  }, [startPos, startVel, gravity])

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={points.length}
          array={new Float32Array(points.flatMap(p => [p.x, p.y, p.z]))}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial color="white" opacity={0.3} transparent />
    </line>
  )
}

// ClientBallVisual - PING-AWARE 0-ping prediction
// Now accepts ping prop for latency-scaled prediction
export const ClientBallVisual = React.forwardRef(({ 
  ballState, 
  onKickMessage, 
  localPlayerRef,
  ping = 0, // Network latency in ms
  pingJitter = 0, // Network jitter for adaptive smoothing
  ballOwner = '' // Session ID of ball owner
}, ref) => {
  const groupRef = useRef()
  const targetPos = useRef(new THREE.Vector3(0, 2, 0))
  const targetRot = useRef(new THREE.Quaternion())
  const serverVelocity = useRef(new THREE.Vector3(0, 0, 0))
  const predictedVelocity = useRef(new THREE.Vector3(0, 0, 0))
  const kickFeedback = useRef(null)
  const lastCollisionTime = useRef(0)
  const collisionThisFrame = useRef(false)
  const lastCollisionNormal = useRef(new THREE.Vector3())
  const serverPosSmoothed = useRef(null) // For jitter smoothing EMA
  const collisionConfidence = useRef(0) // Confidence score for current prediction
  const subFrameTime = useRef(0) // For sub-frame collision timing
  
  // Phase 4: Snapshot Interpolation Buffer
  const serverStateBuffer = useRef([])
  const INTERPOLATION_DELAY = 0.05 // 50ms buffer
  
  // Phase 10: Visual-Physics Separation
  const physicsPos = useRef(new THREE.Vector3(0, 2, 0))
  const visualPos = useRef(new THREE.Vector3(0, 2, 0))
  const renderDelay = useRef(0.1) // 100ms default render delay
  const isOptimistic = useRef(false) // For Phase 14 instant kick
  
  // Phase 5: Kick Prediction State
  const kickConfidence = useRef(0)
  const lastKickPredictTime = useRef(0)
  
  // Phase 12: Reconciliation Smoothing
  const errorAccumulator = useRef(new THREE.Vector3(0, 0, 0))
  
  // Phase 11: Collision Prediction Refinement
  const lastFrameCollision = useRef(false)
  
  // S-Tier State
  const visualAccumulator = useRef(0)
  const wasColliding = useRef(false)
  const lastPingTier = useRef(0)
  const kickTimestampOffset = useRef(0) // Offset between local clock and kick timestamp
  
  // Ownership state
  const isOwner = localPlayerRef?.current?.userData?.sessionId === ballOwner
  
  useImperativeHandle(ref, () => {
    const obj = groupRef.current || {}
    // Expose instant kick predictor for PlayerController
    obj.userData = obj.userData || {}
    obj.userData.predictKick = (impulse, timestamp) => {
      // INSTANT local kick response - before server roundtrip
      // Apply impulse / mass to get velocity change (F = ma -> dv = J/m)
      const invMass = 1 / PHYSICS.BALL_MASS 
      
      // Sub-frame timing compensation
      // If kick happened 8ms ago (half frame), advance physics by 8ms
      // S-Tier: Use precise timestamp if available
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
      const kickTime = timestamp || now
      const frameOffset = Math.max(0, (now - kickTime) / 1000)
      
      // Store offset for drift compensation
      kickTimestampOffset.current = frameOffset

      predictedVelocity.current.x += impulse.x * invMass * IMPULSE_PREDICTION_FACTOR
      predictedVelocity.current.y += impulse.y * invMass * IMPULSE_PREDICTION_FACTOR
      predictedVelocity.current.z += impulse.z * invMass * IMPULSE_PREDICTION_FACTOR
      
      kickConfidence.current = 1.0
      lastKickPredictTime.current = performance.now()

      // Apply sub-frame advancement with gravity compensation
      if (frameOffset > 0) {
         predictedVelocity.current.y -= GRAVITY * frameOffset
         physicsPos.current.addScaledVector(predictedVelocity.current, frameOffset)
      }
      
      // Phase 14: Optimistic Rendering - Instant sync
      isOptimistic.current = true
      renderDelay.current = 0
      visualPos.current.copy(physicsPos.current)
      
      collisionThisFrame.current = true
    }
    return obj
  })

  // Kick message handler - confirms/corrects local prediction
  useEffect(() => {
    if (onKickMessage) {
      const unsubscribeKicked = onKickMessage('ball-kicked', (data) => {
        if (kickFeedback.current) kickFeedback.current()
        
        if (data.impulse) {
          // Phase 26: Server-Client Impulse Synchronization
          // Blend client prediction toward server authority
          const serverImpulse = {
            x: data.impulse.x * IMPULSE_PREDICTION_FACTOR,
            y: data.impulse.y * IMPULSE_PREDICTION_FACTOR,
            z: data.impulse.z * IMPULSE_PREDICTION_FACTOR
          }
          const blendFactor = 0.3 // Trust client 70%, server 30%
          predictedVelocity.current.x = THREE.MathUtils.lerp(predictedVelocity.current.x, serverImpulse.x, blendFactor)
          predictedVelocity.current.y = THREE.MathUtils.lerp(predictedVelocity.current.y, serverImpulse.y, blendFactor)
          predictedVelocity.current.z = THREE.MathUtils.lerp(predictedVelocity.current.z, serverImpulse.z, blendFactor)
        }
      })

      const unsubscribeTouched = onKickMessage('ball-touched', (data) => {
        // Server confirmed a running collision
        if (data.velocity) {
          const blendFactor = 0.4
          predictedVelocity.current.lerp(new THREE.Vector3(data.velocity.x, data.velocity.y, data.velocity.z), blendFactor)
        }
      })

      return () => {
        unsubscribeKicked()
        unsubscribeTouched()
      }
    }
  }, [onKickMessage])

  useFrame((state, delta) => {
    if (!groupRef.current || !ballState) return

    const now = state.clock.getElapsedTime()
    collisionThisFrame.current = false

    // === S-TIER PING-AWARE PARAMETERS ===
    const pingSeconds = ping / 1000
    const dynamicLookahead = Math.min(MAX_LOOKAHEAD, BASE_LOOKAHEAD + pingSeconds / 2)
    
    // === JITTER-AWARE EMA SMOOTHING ===
    // High jitter = smoother (0.1), low jitter = more responsive (0.25)
    const adaptiveEMA = Math.max(0.1, Math.min(0.25, 0.15 + (pingJitter / 200) * 0.1))
    const serverPos = new THREE.Vector3(ballState.x, ballState.y, ballState.z)
    
    // Update Snapshot Buffer
    if (serverStateBuffer.current.length === 0 || serverStateBuffer.current[0].tick !== ballState.tick) {
      serverStateBuffer.current.unshift({
        x: ballState.x,
        y: ballState.y,
        z: ballState.z,
        vx: ballState.vx || 0,
        vy: ballState.vy || 0,
        vz: ballState.vz || 0,
        tick: ballState.tick,
        timestamp: performance.now()
      })
      if (serverStateBuffer.current.length > 5) serverStateBuffer.current.pop()
    }

    if (!serverPosSmoothed.current) {
      serverPosSmoothed.current = serverPos.clone()
    } else {
      serverPosSmoothed.current.lerp(serverPos, adaptiveEMA)
    }

    // 1. Sync server state with EMA smoothing
    // Phase 7: Visual Velocity Estimation
    let estimatedVelocity = new THREE.Vector3()
    if (serverStateBuffer.current.length >= 2) {
      const s0 = serverStateBuffer.current[0]
      const s1 = serverStateBuffer.current[1]
      const dt = (s0.timestamp - s1.timestamp) / 1000
      if (dt > 0.001) {
        estimatedVelocity.set(
          (s0.x - s1.x) / dt,
          (s0.y - s1.y) / dt,
          (s0.z - s1.z) / dt
        )
      }
    }

    physicsPos.current.copy(serverPosSmoothed.current)
    serverVelocity.current.set(ballState.vx || 0, ballState.vy || 0, ballState.vz || 0)
    
    // Blend estimated velocity if server velocity is zero but ball is moving
    if (serverVelocity.current.lengthSq() < 0.01 && estimatedVelocity.lengthSq() > 0.1) {
      serverVelocity.current.lerp(estimatedVelocity, 0.5)
    }

    if (ballState.rx !== undefined) {
      targetRot.current.set(ballState.rx, ballState.ry, ballState.rz, ballState.rw)
    }

    // Extrapolate target position by latency (ping) to see ball in "present" time
    // This removes the feeling of input lag for the owner
    const latencyCorrection = pingSeconds / 2 + 0.016 // Half RTT + 1 frame
    physicsPos.current.addScaledVector(serverVelocity.current, latencyCorrection)

    // === VELOCITY-WEIGHTED RECONCILIATION ===
    // Adaptive Reconciliation Tiers
    let reconcileRate
    if (ping < PHYSICS.RECONCILE_TIER_1_PING) {
      reconcileRate = 1 - Math.exp(-6 * delta) // Tier 1: Trust local (slow reconcile)
    } else if (ping < PHYSICS.RECONCILE_TIER_2_PING) {
      reconcileRate = 1 - Math.exp(-12 * delta) // Tier 2: Balanced
    } else {
      reconcileRate = 1 - Math.exp(-25 * delta) // Tier 3: Trust server (fast reconcile)
    }

    // Velocity influence
    const speed = serverVelocity.current.length()
    const velocityFactor = Math.max(0.3, 1 - speed / 40)
    
    // Ownership influence
    const ownershipFactor = isOwner ? 0.2 : 1.0 
    
    // Final rate
    const finalReconcileRate = 1 - Math.exp(Math.log(1 - reconcileRate) * velocityFactor * ownershipFactor)
    
    // Phase 5: Kick Confidence Decay
    // If server doesn't confirm kick, fade out predicted impulse
    if (kickConfidence.current > 0) {
      const timeSinceKick = (performance.now() - lastKickPredictTime.current) / 1000
      if (timeSinceKick > 0.2) { // 200ms grace period
        kickConfidence.current = Math.max(0, kickConfidence.current - delta * 2)
        if (kickConfidence.current === 0) {
          // Speculative Rollback: Blend back to server velocity faster
          reconcileRate *= 2
        }
      }
    }

    // Phase 12: Error Spreading (Reconciliation Smoothing)
    const posError = serverPosSmoothed.current.clone().addScaledVector(serverVelocity.current, latencyCorrection).sub(physicsPos.current)
    if (posError.lengthSq() > 0.0001) {
      errorAccumulator.current.addScaledVector(posError, 0.1) // Accumulate 10% of error
    }
    
    // Apply error spreading
    physicsPos.current.addScaledVector(errorAccumulator.current, delta * 5)
    errorAccumulator.current.multiplyScalar(0.9) // Decay
    
    predictedVelocity.current.lerp(serverVelocity.current, finalReconcileRate)

    // Phase 22: Sub-Frame Physics Timestep Subdivision
    const playerPos = localPlayerRef?.current?.position
    const distToPlayer = playerPos ? groupRef.current.position.distanceTo(playerPos) : 999
    const playerVel = localPlayerRef.current.userData?.velocity || { x: 0, y: 0, z: 0 }
    const relVel = new THREE.Vector3(
      predictedVelocity.current.x - (playerVel.x || 0),
      predictedVelocity.current.y - (playerVel.y || 0),
      predictedVelocity.current.z - (playerVel.z || 0)
    )
    const relativeSpeed = relVel.length()
    
    // Dynamic subdivisions scaling linearly with relative speed
    // 1 sub at 10m/s, up to 12 subs at 120m/s
    const subdivisions = (distToPlayer < (BALL_RADIUS + PLAYER_RADIUS + PHYSICS.COLLISION_SUBDIVISION_THRESHOLD)) ? 
      Math.min(12, Math.max(PHYSICS.COLLISION_SUBDIVISIONS, Math.ceil(relativeSpeed / 10))) : 1
    const subDt = delta / subdivisions

    for (let s = 0; s < subdivisions; s++) {
      const ballPosAtSubStepStart = physicsPos.current.clone()
      
      // 3. Advance prediction with physics
      const vel = predictedVelocity.current
      
      // Apply Linear Damping (matches server RAPIER)
      const dampingFactor = 1 - PHYSICS.BALL_LINEAR_DAMPING * subDt
      vel.x *= dampingFactor
      vel.z *= dampingFactor
      
      physicsPos.current.addScaledVector(vel, subDt)
      
      if (physicsPos.current.y > BALL_RADIUS) {
        predictedVelocity.current.y -= GRAVITY * subDt
      }

      // === WALL/ARENA COLLISION PREDICTION (MATCHES SERVER enforceBallBoundaries) ===
      const ARENA_HALF_WIDTH = PHYSICS.ARENA_HALF_WIDTH  // 14.5
      const ARENA_HALF_DEPTH = PHYSICS.ARENA_HALF_DEPTH  // 9.5
      const GOAL_POST_Z = 2.5  // Goal posts at z = ±2.5
      const GOAL_LINE_X = PHYSICS.GOAL_LINE_X  // 10.8
      const GOAL_BACK_X = 17.0  // Back of goal net
      const GOAL_HEIGHT = PHYSICS.GOAL_HEIGHT  // 4.0
      const ballR = BALL_RADIUS
      
      // Effective boundaries
      const maxX = ARENA_HALF_WIDTH - ballR
      const maxZ = ARENA_HALF_DEPTH - ballR
      
      // Robust zone detection (matches server)
      const absX = Math.abs(physicsPos.current.x)
      const absZ = Math.abs(physicsPos.current.z)
      const isPastGoalLine = absX > GOAL_LINE_X
      const isInGoalNetArea = isPastGoalLine && absX < GOAL_BACK_X
      const isInGoalOpening = absZ < GOAL_POST_Z && physicsPos.current.y < GOAL_HEIGHT && isPastGoalLine
      
      // === Z AXIS ENFORCEMENT ===
      if (isInGoalNetArea) {
        // Ball is inside goal net - enforce goal side walls at z = ±2.5
        const goalSideLimit = GOAL_POST_Z - ballR
        if (physicsPos.current.z > goalSideLimit) {
          predictedVelocity.current.z *= -PHYSICS.GOAL_RESTITUTION
          physicsPos.current.z = goalSideLimit
        } else if (physicsPos.current.z < -goalSideLimit) {
          predictedVelocity.current.z *= -PHYSICS.GOAL_RESTITUTION
          physicsPos.current.z = -goalSideLimit
        }
      } else {
        // Ball is in main arena - enforce arena walls
        if (physicsPos.current.z > maxZ) {
          predictedVelocity.current.z *= -PHYSICS.WALL_RESTITUTION
          physicsPos.current.z = maxZ
        } else if (physicsPos.current.z < -maxZ) {
          predictedVelocity.current.z *= -PHYSICS.WALL_RESTITUTION
          physicsPos.current.z = -maxZ
        }
      }
      
      // === X AXIS ENFORCEMENT ===
      if (isInGoalOpening || isInGoalNetArea) {
        // Ball is in goal area - clamp to goal back wall
        const goalBackLimit = GOAL_BACK_X - ballR
        if (physicsPos.current.x > goalBackLimit) {
          predictedVelocity.current.x *= -PHYSICS.GOAL_RESTITUTION
          physicsPos.current.x = goalBackLimit
        } else if (physicsPos.current.x < -goalBackLimit) {
          predictedVelocity.current.x *= -PHYSICS.GOAL_RESTITUTION
          physicsPos.current.x = -goalBackLimit
        }
      } else {
        // Ball is in main arena - enforce arena walls
        if (physicsPos.current.x > maxX) {
          predictedVelocity.current.x *= -PHYSICS.WALL_RESTITUTION
          physicsPos.current.x = maxX
        } else if (physicsPos.current.x < -maxX) {
          predictedVelocity.current.x *= -PHYSICS.WALL_RESTITUTION
          physicsPos.current.x = -maxX
        }
      }
      
      // Ceiling boundary
      if (physicsPos.current.y > PHYSICS.WALL_HEIGHT - ballR) {
        predictedVelocity.current.y *= -0.1
        physicsPos.current.y = PHYSICS.WALL_HEIGHT - ballR
      }

      // 4. PING-AWARE COLLISION PREDICTION with DYNAMIC RADIUS
      const timeSinceCollision = now - lastCollisionTime.current
      
      if (playerPos && timeSinceCollision > COLLISION_COOLDOWN) {
        const playerVel = localPlayerRef.current.userData?.velocity || { x: 0, y: 0, z: 0 }
        const ballPos = ballPosAtSubStepStart
        
        // === DYNAMIC COLLISION RADIUS for giant power-up ===
        const isGiant = localPlayerRef.current.userData?.giant || false
        const giantScale = isGiant ? 5 : 1
        const dynamicPlayerRadius = PLAYER_RADIUS * giantScale
        const dynamicCombinedRadius = BALL_RADIUS + dynamicPlayerRadius
        
        // Anticipatory collision with dynamic lookahead
        const futureBall = predictFuturePosition(ballPos, predictedVelocity.current, dynamicLookahead, GRAVITY)
        const futurePlayer = {
          x: playerPos.x + (playerVel.x || 0) * dynamicLookahead,
          y: playerPos.y + (playerVel.y || 0) * dynamicLookahead,
          z: playerPos.z + (playerVel.z || 0) * dynamicLookahead
        }
        
        // Distance checks
        const dx = ballPos.x - playerPos.x
        const dy = ballPos.y - playerPos.y
        const dz = ballPos.z - playerPos.z
        const currentDist = Math.sqrt(dx * dx + dy * dy + dz * dz)
        
        const fdx = futureBall.x - futurePlayer.x
        const fdy = futureBall.y - futurePlayer.y
        const fdz = futureBall.z - futurePlayer.z
        const futureDist = Math.sqrt(fdx * fdx + fdy * fdy + fdz * fdz)
        
        // Sweep test
        const ballEnd = physicsPos.current.clone()
        const sweepT = multiStepSweep(ballPos, ballEnd, playerPos, dynamicCombinedRadius)
        
        const isCurrentCollision = currentDist < dynamicCombinedRadius
        const isAnticipatedCollision = futureDist < dynamicCombinedRadius && futureDist < currentDist && currentDist < dynamicCombinedRadius * 1.1
        const isSweepCollision = sweepT !== null
        
        const isSpeculative = futureDist < currentDist * 0.3 && futureDist < dynamicCombinedRadius * 0.8 && currentDist < dynamicCombinedRadius * 1.05
        
        if ((isCurrentCollision || isAnticipatedCollision || isSweepCollision || isSpeculative) && currentDist > 0.05) {
          // === BALL CARRY / STABILITY MODE (Client Prediction) ===
          const isOnHead = dy > PHYSICS.BALL_STABILITY_HEIGHT_MIN && ny > 0.5
          const relSpeed = relVel.length()
          const isLowVelocity = relSpeed < PHYSICS.BALL_STABILITY_VELOCITY_THRESHOLD
          
          if (isOnHead && isLowVelocity) {
            // Match server carry logic: inherit player velocity and dampen vertical
            predictedVelocity.current.x = (playerVel.x || 0)
            predictedVelocity.current.z = (playerVel.z || 0)
            predictedVelocity.current.y *= PHYSICS.BALL_STABILITY_DAMPING
            
            // Smoothly position above head
            const targetY = playerPos.y + dynamicPlayerRadius + BALL_RADIUS + 0.05
            physicsPos.current.y = THREE.MathUtils.damp(physicsPos.current.y, targetY, 10, subDt)
            physicsPos.current.x = THREE.MathUtils.damp(physicsPos.current.x, playerPos.x, 10, subDt)
            physicsPos.current.z = THREE.MathUtils.damp(physicsPos.current.z, playerPos.z, 10, subDt)
            
            lastFrameCollision.current = true
            collisionThisFrame.current = true
            continue // Skip normal impulse logic
          }

          if (collisionConfidence.current < 0.85 && !isCurrentCollision) {
            lastFrameCollision.current = false
            continue
          }
          
          if (isSpeculative && !lastFrameCollision.current) {
            lastFrameCollision.current = true
            continue
          }
          lastFrameCollision.current = true

          let nx, ny, nz, contactDist
          
          // Phase 23: Hermite Contact Point Interpolation
          if (isSweepCollision && sweepT > 0) {
            subFrameTime.current = sweepT
            // Hermite interpolation for smoother contact
            const t = sweepT
            const t2 = t * t
            const t3 = t2 * t
            const h1 = 2*t3 - 3*t2 + 1
            const h2 = -2*t3 + 3*t2
            const contactPt = ballPos.clone().multiplyScalar(h1).add(ballEnd.clone().multiplyScalar(h2))
            
            const cx = contactPt.x - playerPos.x
            const cy = contactPt.y - playerPos.y
            const cz = contactPt.z - playerPos.z
            contactDist = Math.sqrt(cx * cx + cy * cy + cz * cz)
            const invD = 1 / Math.max(contactDist, 0.1)
            nx = cx * invD
            ny = Math.max(0.1, cy * invD)
            nz = cz * invD
          } else {
            subFrameTime.current = 0
            contactDist = currentDist
            const invD = 1 / Math.max(currentDist, 0.1)
            nx = dx * invD
            ny = Math.max(0.1, dy * invD)
            nz = dz * invD
          }
          
          const relVx = predictedVelocity.current.x - (playerVel.x || 0)
          const relVy = predictedVelocity.current.y - (playerVel.y || 0)
          const relVz = predictedVelocity.current.z - (playerVel.z || 0)
          const approachSpeed = relVx * nx + relVy * ny + relVz * nz
          const relativeSpeed = Math.sqrt(relVx * relVx + relVy * relVy + relVz * relVz)
          
          // Phase 25: Multi-Factor Collision Confidence
          const speedFactor = Math.min(1.5, Math.abs(approachSpeed) / 15)
          const distFactor = Math.min(1, dynamicCombinedRadius / Math.max(currentDist, 0.1))
          const angleFactor = Math.max(0, -(relVx * nx + relVy * ny + relVz * nz) / Math.max(relativeSpeed, 0.1))
          collisionConfidence.current = speedFactor * distFactor * angleFactor * PHYSICS.COLLISION_CONFIDENCE_BOOST
          
          if (approachSpeed < 0 || isCurrentCollision) {
            lastCollisionTime.current = now
            collisionThisFrame.current = true
            lastCollisionNormal.current.set(nx, ny, nz)
            
            // Phase 24: Velocity-Matched Impulse Response Curves
            const approachNorm = Math.min(1, Math.abs(approachSpeed) / 20)
            const speedCurve = Math.pow(approachNorm, 1.3)
            const approachAngle = Math.acos(Math.abs(approachSpeed) / Math.max(relativeSpeed, 0.1))
            const angleMultiplier = Math.cos(approachAngle) * PHYSICS.COLLISION_ANGLE_FACTOR
            
            const playerSpeed = localPlayerRef.current.userData?.velocityMagnitude || 0
            const isRunning = localPlayerRef.current.userData?.isRunning || false

            // Momentum transfer calculation
            const momentumFactor = isRunning ? 
              (playerSpeed / 8) * PHYSICS.PLAYER_BALL_VELOCITY_TRANSFER : 0.5
            
            // Approach boost for head-on collisions
            const approachDot = ((playerVel.x || 0) * nx + (playerVel.z || 0) * nz) / (playerSpeed + 0.001)
            const approachBoost = approachDot < -0.5 ? PHYSICS.PLAYER_BALL_APPROACH_BOOST : 1.0

            let impulseMag = -(1 + PHYSICS.BALL_RESTITUTION) * approachSpeed * (0.8 + speedCurve * 0.4) * (1 + angleMultiplier) * momentumFactor * approachBoost
            
            // Ensure a minimum impulse for responsiveness
            impulseMag = Math.max(PHYSICS.PLAYER_BALL_IMPULSE_MIN, impulseMag)

            const boostFactor = isGiant ? 2.0 : 1.2
            const impulseFactor = isSpeculative && !isCurrentCollision ? PHYSICS.SPECULATIVE_IMPULSE_FACTOR : 1.0
            
            // Impulse Ramping
            const impulseRamp = 1 / PHYSICS.IMPULSE_RAMP_FRAMES
            const highSpeedBoost = 1 + Math.min(0.3, relativeSpeed / 100)
            predictedVelocity.current.x += impulseMag * nx * boostFactor * impulseFactor * impulseRamp * highSpeedBoost
            predictedVelocity.current.y += (impulseMag * ny * boostFactor * impulseFactor + (isGiant ? PHYSICS.COLLISION_LIFT_GIANT : PHYSICS.COLLISION_LIFT)) * impulseRamp * highSpeedBoost
            predictedVelocity.current.z += impulseMag * nz * boostFactor * impulseFactor * impulseRamp * highSpeedBoost
            
            predictedVelocity.current.x += (playerVel.x || 0) * PHYSICS.TOUCH_VELOCITY_TRANSFER * impulseRamp * highSpeedBoost
            predictedVelocity.current.z += (playerVel.z || 0) * PHYSICS.TOUCH_VELOCITY_TRANSFER * impulseRamp * highSpeedBoost
            
            const overlap = Math.min(1.0, dynamicCombinedRadius - contactDist + 0.02)
            if (overlap > 0) {
              const remainingTime = subDt * (1 - subFrameTime.current)
              physicsPos.current.x += nx * overlap + predictedVelocity.current.x * remainingTime * 0.3
              physicsPos.current.y += ny * overlap * 0.5
              physicsPos.current.z += nz * overlap + predictedVelocity.current.z * remainingTime * 0.3
              
              const visualPush = 0.8 * Math.max(0.6, collisionConfidence.current)
              groupRef.current.position.x += nx * overlap * visualPush
              groupRef.current.position.z += nz * overlap * visualPush
            }
            break // Collision handled for this sub-step
          }
        }
      }
    }


    // 5. ULTRA-AGGRESSIVE visual interpolation with CONFIDENCE WEIGHTING
    // S-Tier: 240Hz Visual Interpolation Loop
    visualAccumulator.current += delta
    const VISUAL_STEP = PHYSICS.VISUAL_TIMESTEP
    
    // Detect First Touch for Instant Response
    const isFirstTouch = collisionThisFrame.current && !wasColliding.current
    wasColliding.current = collisionThisFrame.current

    while (visualAccumulator.current >= VISUAL_STEP) {
      const dt = VISUAL_STEP
      // Phase 13: Acceleration Limiting
      const prevPos = groupRef.current.position.clone()
      
      // Phase 10: Snapshot Interpolation Logic
      // Find two snapshots in the buffer that surround our target render time
      const renderTime = performance.now() - renderDelay.current * 1000
      let s0 = null, s1 = null
      
      for (let i = 0; i < serverStateBuffer.current.length - 1; i++) {
        if (serverStateBuffer.current[i].timestamp >= renderTime && serverStateBuffer.current[i+1].timestamp <= renderTime) {
          s0 = serverStateBuffer.current[i]
          s1 = serverStateBuffer.current[i+1]
          break
        }
      }
      
      if (s0 && s1) {
        const t = (renderTime - s1.timestamp) / (s0.timestamp - s1.timestamp)
        visualPos.current.set(
          THREE.MathUtils.lerp(s1.x, s0.x, t),
          THREE.MathUtils.lerp(s1.y, s0.y, t),
          THREE.MathUtils.lerp(s1.z, s0.z, t)
        )
        // Apply latency extrapolation to interpolated state
        const latencyExtrap = pingSeconds / 2
        visualPos.current.addScaledVector(serverVelocity.current, latencyExtrap)
      } else if (serverStateBuffer.current.length > 0) {
        // Fallback to latest if buffer too small or time out of range
        const latest = serverStateBuffer.current[0]
        visualPos.current.set(latest.x, latest.y, latest.z)
        const latencyExtrap = pingSeconds / 2
        visualPos.current.addScaledVector(serverVelocity.current, latencyExtrap)
      }

      // Phase 14: Optimistic Rendering Fade
      if (isOptimistic.current) {
        renderDelay.current = THREE.MathUtils.damp(renderDelay.current, 0.1, 5, dt)
        if (Math.abs(renderDelay.current - 0.1) < 0.001) {
          renderDelay.current = 0.1
          isOptimistic.current = false
        }
      }

      const distance = groupRef.current.position.distanceTo(isOptimistic.current ? physicsPos.current : visualPos.current)
      const target = isOptimistic.current ? physicsPos.current : visualPos.current
      
      // NaN Protection
      if (isNaN(target.x) || isNaN(target.y) || isNaN(target.z)) {
        target.copy(serverPosSmoothed.current)
        predictedVelocity.current.copy(serverVelocity.current)
      }

      // PANIC SNAP
      if (distance > 8.0) {
        groupRef.current.position.copy(target)
        predictedVelocity.current.copy(serverVelocity.current)
      } else if (distance > 2.0) {
        // FAST CORRECTION
        const fastLerp = 1 - Math.exp(-40 * dt)
        groupRef.current.position.lerp(target, fastLerp)
      } else if (isFirstTouch) {
        // INSTANT FIRST TOUCH SNAP
        const snapFactor = PHYSICS.FIRST_TOUCH_SNAP_FACTOR
        groupRef.current.position.lerp(target, snapFactor)
      } else if (collisionThisFrame.current) {
        // Continuous collision snap
        const isRunning = localPlayerRef.current.userData?.isRunning || false
        const confidenceBoost = 1 + collisionConfidence.current * 0.5
        const snapFactor = isRunning ? PHYSICS.RUNNING_COLLISION_SNAP : (1 - Math.exp(-LERP_COLLISION * confidenceBoost * dt))
        groupRef.current.position.lerp(target, snapFactor)
      } else {
        // Normal smooth interpolation
        const lerpFactor = 1 - Math.exp(-LERP_NORMAL * dt)
        groupRef.current.position.lerp(target, lerpFactor)
      }
      
      // Phase 13: Acceleration Limiting (Final pass)
      const currentPos = groupRef.current.position
      const visualVel = currentPos.clone().sub(prevPos).divideScalar(dt)
      const MAX_ACCEL = 200 // 200 m/s²
      if (visualVel.lengthSq() > 0.0001) {
        // Simple velocity clamping to prevent snaps
        const maxDist = 80 * dt // 80 m/s max visual speed (increased for high-speed play)
        if (currentPos.distanceTo(prevPos) > maxDist) {
          currentPos.copy(prevPos).addScaledVector(visualVel.normalize(), maxDist)
        }
      }
      
      visualAccumulator.current -= VISUAL_STEP
    }
    
    // Interpolate remainder for silky smoothness
    const remainder = visualAccumulator.current / VISUAL_STEP
    if (remainder > 0) {
       // Optional: slight blend for sub-step smoothness
       // groupRef.current.position.lerp(physicsPos.current, remainder * 0.1)
    }
    
    groupRef.current.quaternion.slerp(targetRot.current, 1 - Math.exp(-15 * delta))
    
    // 6. Floor collision with friction
    if (groupRef.current.position.y < BALL_RADIUS) {
      groupRef.current.position.y = BALL_RADIUS
      if (predictedVelocity.current.y < 0) {
        predictedVelocity.current.y = Math.abs(predictedVelocity.current.y) * PHYSICS.BALL_RESTITUTION
        // Floor friction
        predictedVelocity.current.x *= 0.85
        predictedVelocity.current.z *= 0.85
      }
    }

    // 7. Linear damping
    predictedVelocity.current.multiplyScalar(1 - LINEAR_DAMPING * delta)
  })

  return (
    <group ref={groupRef} position={[0, 2, 0]}>
      <Trail
        width={0.6}
        length={8}
        color="#ffffff"
        attenuation={(t) => t * t}
      >
        <SoccerBall onKickFeedback={kickFeedback} />
      </Trail>
      {isOwner && (
        <TrajectoryLine 
          startPos={groupRef.current?.position || new THREE.Vector3()} 
          startVel={predictedVelocity.current} 
        />
      )}
    </group>
  )
})
ClientBallVisual.displayName = 'ClientBallVisual'
