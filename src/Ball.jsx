// Ball.jsx - Client ball visual with interpolation for Colyseus
// Server-authoritative: Client NEVER moves the ball, only displays
// Enhanced with Rocket League-style collision mechanics

import React, { useRef, useEffect, useImperativeHandle, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'

import { useGLTF, Trail } from '@react-three/drei'
import * as THREE from 'three'
import { useSpring, a } from '@react-spring/three'

// Import centralized collision config
import { 
  COLLISION_CONFIG, 
  LAG_CONFIG,
  getHitZoneMultiplier, 
  getDynamicSubFrameSteps,
  getVelocityScaledLookahead,
  bezierLerp 
} from './physics/CollisionConfig.js'

// Soccer Ball Visual Component
export const SoccerBall = React.forwardRef(({ radius = 0.8, onKickFeedback }, ref) => {
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

// === S-TIER ROCKET LEAGUE-STYLE COLLISION PREDICTION ===
// Designed for 0-ping visual feel at ANY latency
// Features: Hit zones, momentum transfer, sub-frame Bézier interpolation

// Destructure config for cleaner access
const {
  COOLDOWN: COLLISION_COOLDOWN,
  BASE_LOOKAHEAD,
  MAX_LOOKAHEAD,
  MICRO_TIME_THRESHOLD,
  BALL_RADIUS,
  PLAYER_RADIUS,
  BALL_RESTITUTION,
  GRAVITY,
  LINEAR_DAMPING,
  MAX_LINEAR_VEL,
  ARENA_HALF_WIDTH,
  ARENA_HALF_DEPTH,
  GOAL_HALF_WIDTH,
  BASE_BOOST,
  GIANT_BOOST,
  VERTICAL_LIFT,
  GIANT_VERTICAL_LIFT,
  MOMENTUM_TRANSFER,
  AERIAL_MOMENTUM,
  IMPULSE_PREDICTION_FACTOR,
  SUB_FRAME_STEPS_MIN,
  VELOCITY_DECAY_RATE,
  SPECULATIVE_THRESHOLD,
  SPECULATIVE_IMPULSE_FACTOR,
  LERP_NORMAL,
  LERP_COLLISION,
  LERP_SNAP_THRESHOLD,
  PING_DAMPENING_MAX,
  SERVER_TRUST_LOCAL,
  SERVER_TRUST_REMOTE,
  POSITION_SNAP_THRESHOLD,
  SPIN_INFLUENCE,
  MAX_PREDICTION_HISTORY,
  ROLLBACK_TIME_TOLERANCE,
  CHAIN_COLLISION_PENALTY
} = COLLISION_CONFIG

const {
  EXTRAPOLATION_MAX_MS,
  RECONCILIATION_ALPHA,
  ERROR_SNAP_THRESHOLD,
  ERROR_SMOOTH_THRESHOLD
} = LAG_CONFIG

const COMBINED_RADIUS = BALL_RADIUS + PLAYER_RADIUS

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

// Anticipatory trajectory prediction with gravity
const predictFuturePosition = (pos, vel, time, gravity) => ({
  x: pos.x + vel.x * time,
  y: Math.max(BALL_RADIUS, pos.y + vel.y * time - 0.5 * gravity * time * time),
  z: pos.z + vel.z * time
})

// ClientBallVisual - PING-AWARE 0-ping prediction
// Now accepts ping prop for latency-scaled prediction
export const ClientBallVisual = React.forwardRef(({ 
  ballState, 
  onKickMessage, 
  localPlayerRef,
  ping = 0, // Network latency in ms
  pingJitter = 0 // Network jitter for adaptive smoothing
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
  
  useImperativeHandle(ref, () => {
    const obj = groupRef.current || {}
    // Expose instant kick predictor for PlayerController
    obj.userData = obj.userData || {}
    obj.userData.predictKick = (impulse) => {
      // INSTANT local kick response - before server roundtrip
      predictedVelocity.current.x += impulse.x * IMPULSE_PREDICTION_FACTOR
      predictedVelocity.current.y += impulse.y * IMPULSE_PREDICTION_FACTOR
      predictedVelocity.current.z += impulse.z * IMPULSE_PREDICTION_FACTOR
      collisionThisFrame.current = true
    }
    return obj
  })

  // Kick message handler - confirms/corrects local prediction
  useEffect(() => {
    if (onKickMessage) {
      const unsubKick = onKickMessage('ball-kicked', (data) => {
        if (kickFeedback.current) kickFeedback.current()
        
        if (data.impulse) {
          // Server confirmation - blend with existing prediction
          const serverImpulse = {
            x: data.impulse.x * IMPULSE_PREDICTION_FACTOR,
            y: data.impulse.y * IMPULSE_PREDICTION_FACTOR,
            z: data.impulse.z * IMPULSE_PREDICTION_FACTOR
          }
          // Soft correction toward server impulse
          predictedVelocity.current.x += (serverImpulse.x - predictedVelocity.current.x) * 0.3
          predictedVelocity.current.y += (serverImpulse.y - predictedVelocity.current.y) * 0.3
          predictedVelocity.current.z += (serverImpulse.z - predictedVelocity.current.z) * 0.3
        }
      })

      const unsubCollision = onKickMessage('ball-collision', (data) => {
        // Handle server-authoritative collision event
        const isMe = localPlayerRef?.current && localPlayerRef.current.userData?.sessionId === data.sessionId
        
        if (isMe) {
          // We likely already predicted this, so just soft-reconcile velocity
          const serverVel = new THREE.Vector3(data.vx, data.vy, data.vz)
          predictedVelocity.current.lerp(serverVel, SERVER_TRUST_LOCAL) 
        } else {
          // Remote player collision - we didn't predict this!
          const serverVel = new THREE.Vector3(data.vx, data.vy, data.vz)
          predictedVelocity.current.lerp(serverVel, SERVER_TRUST_REMOTE)
          
          // Snap position if needed
          const serverPos = new THREE.Vector3(data.x, data.y, data.z)
          if (groupRef.current.position.distanceTo(serverPos) > ERROR_SNAP_THRESHOLD) {
            groupRef.current.position.lerp(serverPos, 0.5)
          }
          
          // Trigger visual feedback
          if (kickFeedback.current) kickFeedback.current()
        }
      })

      return () => {
        unsubKick()
        unsubCollision()
      }
    }
  }, [onKickMessage])

  useFrame((state, delta) => {
    if (!groupRef.current || !ballState) return

    const now = state.clock.getElapsedTime()
    collisionThisFrame.current = false

    // === S-TIER ROCKET LEAGUE PING-AWARE PARAMETERS ===
    const pingSeconds = ping / 1000
    const velMagnitude = predictedVelocity.current.length()
    
    // Velocity-scaled lookahead: faster ball needs less prediction ahead
    const baseLookahead = BASE_LOOKAHEAD + pingSeconds / 2
    const dynamicLookahead = Math.min(MAX_LOOKAHEAD, getVelocityScaledLookahead(baseLookahead, velMagnitude))
    
    // === 1. SERVER EXTRAPOLATION (ANTI-LAG) ===
    // Predict where the server ball IS right now (ServerPos + Velocity * Ping)
    // This fixes rubber-banding by not anchoring to the past
    const serverPos = new THREE.Vector3(ballState.x, ballState.y, ballState.z)
    const serverVel = new THREE.Vector3(ballState.vx || 0, ballState.vy || 0, ballState.vz || 0)
    
    // Cap extrapolation to avoid wild predictions at high ping
    const extrapolationTime = Math.min(pingSeconds, EXTRAPOLATION_MAX_MS / 1000)
    const extrapolatedServerPos = serverPos.clone().addScaledVector(serverVel, extrapolationTime)
    
    // === 2. ERROR-BASED RECONCILIATION ===
    // Instead of snapping to server, smoothly correct the error
    if (!serverPosSmoothed.current) {
      serverPosSmoothed.current = extrapolatedServerPos.clone()
      targetPos.current.copy(extrapolatedServerPos)
    } else {
      // Calculate error between our current prediction and the extrapolated server truth
      const errorVec = extrapolatedServerPos.clone().sub(targetPos.current)
      const errorDist = errorVec.length()
      
      if (errorDist > ERROR_SNAP_THRESHOLD) {
        // Hard snap if error is too large (teleport)
        targetPos.current.copy(extrapolatedServerPos)
        predictedVelocity.current.copy(serverVel)
      } else if (errorDist > ERROR_SMOOTH_THRESHOLD) {
        // Smoothly apply error correction
        targetPos.current.add(errorVec.multiplyScalar(RECONCILIATION_ALPHA))
        
        // Also blend velocity to keep trajectory aligned
        predictedVelocity.current.lerp(serverVel, RECONCILIATION_ALPHA * 0.5)
      }
    }

    serverVelocity.current.copy(serverVel)
    if (ballState.rx !== undefined) {
      targetRot.current.set(ballState.rx, ballState.ry, ballState.rz, ballState.rw)
    }

    // Apply velocity decay for smooth prediction blending
    predictedVelocity.current.multiplyScalar(VELOCITY_DECAY_RATE)
    const blendedVelocity = decayedVelocity.lerp(serverVelocity.current, reconcileRate)
    predictedVelocity.current.copy(blendedVelocity)

    // 3. Advance prediction with physics + Magnus effect (ball spin)
    const vel = predictedVelocity.current
    
    // === MAGNUS EFFECT: Ball spin curves trajectory ===
    if (ballState.rx !== undefined && velMagnitude > 5) {
      const angVel = { x: ballState.rx || 0, y: ballState.ry || 0, z: ballState.rz || 0 }
      vel.x += angVel.z * velMagnitude * SPIN_INFLUENCE * delta
      vel.z -= angVel.x * velMagnitude * SPIN_INFLUENCE * delta
    }
    
    targetPos.current.addScaledVector(vel, delta)
    
    if (targetPos.current.y > BALL_RADIUS) {
      predictedVelocity.current.y -= GRAVITY * delta
    }

    // === WALL/ARENA COLLISION PREDICTION (using config constants) ===
    
    // X walls (with goal gaps)
    if (Math.abs(targetPos.current.x) > ARENA_HALF_WIDTH) {
      const inGoalZone = Math.abs(targetPos.current.z) < GOAL_HALF_WIDTH && targetPos.current.y < 4
      if (!inGoalZone) {
        predictedVelocity.current.x *= -BALL_RESTITUTION
        targetPos.current.x = Math.sign(targetPos.current.x) * (ARENA_HALF_WIDTH - 0.1)
      }
    }
    
    // Z walls
    if (Math.abs(targetPos.current.z) > ARENA_HALF_DEPTH) {
      predictedVelocity.current.z *= -BALL_RESTITUTION
      targetPos.current.z = Math.sign(targetPos.current.z) * (ARENA_HALF_DEPTH - 0.1)
    }

    // === VELOCITY CLAMPING (using config constant) ===
    const clampVelMag = predictedVelocity.current.length()
    if (clampVelMag > MAX_LINEAR_VEL) {
      predictedVelocity.current.multiplyScalar(MAX_LINEAR_VEL / clampVelMag)
    }

    // 4. PING-AWARE COLLISION PREDICTION with DYNAMIC RADIUS
    const timeSinceCollision = now - lastCollisionTime.current
    
    if (localPlayerRef?.current?.position && timeSinceCollision > COLLISION_COOLDOWN) {
      const playerPos = localPlayerRef.current.position
      const playerVel = localPlayerRef.current.userData?.velocity || { x: 0, y: 0, z: 0 }
      const ballPos = groupRef.current.position
      
      // === DYNAMIC COLLISION RADIUS for giant power-up ===
      const isGiant = localPlayerRef.current.userData?.giant || false
      const giantScale = isGiant ? 10 : 1
      const dynamicPlayerRadius = PLAYER_RADIUS * giantScale
      const dynamicCombinedRadius = BALL_RADIUS + dynamicPlayerRadius
      
      // Anticipatory collision with dynamic lookahead
      const futureBall = predictFuturePosition(ballPos, vel, dynamicLookahead, GRAVITY)
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
      
      // Sweep test with dynamic radius
      const ballEnd = targetPos.current.clone()
      const sweepT = sweepSphereToSphere(ballPos, ballEnd, playerPos, dynamicCombinedRadius)
      
      // Collision conditions
      const isCurrentCollision = currentDist < dynamicCombinedRadius
      const isAnticipatedCollision = futureDist < dynamicCombinedRadius && futureDist < currentDist
      const isSweepCollision = sweepT !== null
      
      // === SPECULATIVE COLLISION DETECTION ===
      // Pre-detect likely collisions for ultra-early response
      const isSpeculative = futureDist < currentDist * SPECULATIVE_THRESHOLD && 
                           futureDist < dynamicCombinedRadius * 1.5 &&
                           currentDist < dynamicCombinedRadius * 2
      
      if ((isCurrentCollision || isAnticipatedCollision || isSweepCollision || isSpeculative) && currentDist > 0.05) {
        let nx, ny, nz, contactDist
        
        // === SUB-FRAME COLLISION TIMING ===
        // Use sweep hit time for micro-precise contact moment
        if (isSweepCollision && sweepT > 0) {
          subFrameTime.current = sweepT
          const contactPt = ballPos.clone().lerp(ballEnd, sweepT)
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
        
        // Relative velocity
        const relVx = vel.x - (playerVel.x || 0)
        const relVy = vel.y - (playerVel.y || 0)
        const relVz = vel.z - (playerVel.z || 0)
        const approachSpeed = relVx * nx + relVy * ny + relVz * nz
        
        // === COLLISION CONFIDENCE SCORING ===
        // Higher confidence = more aggressive prediction
        const speedFactor = Math.min(1, Math.abs(approachSpeed) / 15)
        const distFactor = Math.min(1, dynamicCombinedRadius / Math.max(currentDist, 0.1))
        collisionConfidence.current = speedFactor * distFactor
        
        if (approachSpeed < 0 || isCurrentCollision) {
          // Micro-time check to avoid double-processing
          if (now - lastCollisionTime.current < MICRO_TIME_THRESHOLD) return
          
          lastCollisionTime.current = now
          collisionThisFrame.current = true
          lastCollisionNormal.current.set(nx, ny, nz)
          
          // === ROCKET LEAGUE-STYLE HIT ZONE DETECTION ===
          // Hood (top) = power shot, Front = normal, Wheels (bottom) = dribble
          const hitZoneMultiplier = getHitZoneMultiplier(
            ballPos.y, 
            playerPos.y, 
            dynamicPlayerRadius
          )
          
          // === ANGLE-BASED IMPULSE SCALING ===
          // Direct hits get full impulse, glancing hits get reduced
          const normalMag = Math.sqrt(nx * nx + ny * ny + nz * nz)
          const approachMag = Math.sqrt(relVx * relVx + relVy * relVy + relVz * relVz)
          const dotProduct = (nx * relVx + ny * relVy + nz * relVz) / (normalMag * Math.max(approachMag, 0.1))
          const angleFactor = Math.max(0.4, Math.abs(dotProduct)) // 0.4-1.0 based on hit angle
          
          // RAPIER-matched impulse with Rocket League tuning
          const impulseMag = -(1 + BALL_RESTITUTION) * approachSpeed * angleFactor * hitZoneMultiplier
          const boostFactor = isGiant ? GIANT_BOOST : BASE_BOOST
          
          // Apply impulse scaled by confidence for speculative hits
          const impulseFactor = isSpeculative && !isCurrentCollision ? SPECULATIVE_IMPULSE_FACTOR : 1.0
          
          predictedVelocity.current.x += impulseMag * nx * boostFactor * impulseFactor
          predictedVelocity.current.y += impulseMag * ny * boostFactor * impulseFactor + (isGiant ? GIANT_VERTICAL_LIFT : VERTICAL_LIFT)
          predictedVelocity.current.z += impulseMag * nz * boostFactor * impulseFactor
          
          // === ENHANCED MOMENTUM TRANSFER (Rocket League style) ===
          const playerSpeed = Math.sqrt((playerVel.x || 0) ** 2 + (playerVel.z || 0) ** 2)
          const momentumBoost = Math.min(1.5, 0.3 + playerSpeed / 20)
          predictedVelocity.current.x += (playerVel.x || 0) * MOMENTUM_TRANSFER * momentumBoost
          predictedVelocity.current.z += (playerVel.z || 0) * MOMENTUM_TRANSFER * momentumBoost
          
          // === AERIAL COLLISION BONUS ===
          // Hitting while in the air adds extra upward momentum
          if (playerPos.y > 1.5 && Math.abs(playerVel.y || 0) > 2) {
            predictedVelocity.current.y += Math.abs(playerVel.y || 0) * AERIAL_MOMENTUM
          }
          
          // INSTANT position correction with sub-frame advancement
          const overlap = dynamicCombinedRadius - contactDist + 0.025
          if (overlap > 0) {
            // Advance remaining time after collision
            const remainingTime = delta * (1 - subFrameTime.current)
            targetPos.current.x += nx * overlap + vel.x * remainingTime * 0.35
            targetPos.current.y += ny * overlap * 0.55
            targetPos.current.z += nz * overlap + vel.z * remainingTime * 0.35
            
            // === VELOCITY-SCALED VISUAL PUSH ===
            // Faster collisions get stronger immediate visual response
            const velMag = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z)
            const velocityBoost = Math.min(1.5, 1 + velMag / 30)
            const visualPush = 0.85 * Math.max(0.65, collisionConfidence.current) * velocityBoost
            groupRef.current.position.x += nx * overlap * visualPush
            groupRef.current.position.y += ny * overlap * visualPush * 0.3
            groupRef.current.position.z += nz * overlap * visualPush
          }
        }
      }
    }

    // 5. ULTRA-AGGRESSIVE visual interpolation with CONFIDENCE WEIGHTING
    const distance = groupRef.current.position.distanceTo(targetPos.current)
    
    if (distance > LERP_SNAP_THRESHOLD) {
      groupRef.current.position.copy(targetPos.current)
    } else if (collisionThisFrame.current) {
      // === DYNAMIC MULTI-STEP SUB-FRAME INTERPOLATION ===
      // More steps for faster collisions, fewer for slower ones
      const dynamicSubFrameSteps = getDynamicSubFrameSteps(velMagnitude)
      const confidenceBoost = 1 + collisionConfidence.current * 0.6
      
      // Apply in multiple micro-steps for ultra-smooth visual
      const stepDelta = delta / dynamicSubFrameSteps
      for (let step = 0; step < dynamicSubFrameSteps; step++) {
        const stepFactor = 1 - Math.exp(-LERP_COLLISION * confidenceBoost * stepDelta)
        groupRef.current.position.lerp(targetPos.current, stepFactor)
        
        // Micro-advance position based on predicted velocity
        if (step < dynamicSubFrameSteps - 1) {
          groupRef.current.position.addScaledVector(vel, stepDelta * 0.2)
        }
      }
    } else {
      // Smooth non-collision interpolation with ping-aware dampening
      const pingDampening = Math.max(0.7, 1 - ping / PING_DAMPENING_MAX)
      const lerpFactor = 1 - Math.exp(-LERP_NORMAL * pingDampening * delta)
      groupRef.current.position.lerp(targetPos.current, lerpFactor)
    }
    
    groupRef.current.quaternion.slerp(targetRot.current, 1 - Math.exp(-15 * delta))
    
    // 6. Floor collision with friction
    if (groupRef.current.position.y < BALL_RADIUS) {
      groupRef.current.position.y = BALL_RADIUS
      if (predictedVelocity.current.y < 0) {
        predictedVelocity.current.y = Math.abs(predictedVelocity.current.y) * BALL_RESTITUTION
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
    </group>
  )
})
ClientBallVisual.displayName = 'ClientBallVisual'
