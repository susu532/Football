// Ball.jsx - Client ball visual with interpolation for Colyseus
// Server-authoritative: Client NEVER moves the ball, only displays

import React, { useRef, useEffect, useImperativeHandle, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'

import { useGLTF, Trail } from '@react-three/drei'
import * as THREE from 'three'
import { useSpring, a } from '@react-spring/three'

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

// === S-TIER PING-AWARE COLLISION PREDICTION ===
// Designed for 0-ping visual feel at ANY latency

// Collision constants - ultra-aggressive for instant feel
const COLLISION_COOLDOWN = 0.004 // 4ms - near-instant re-collision
const BASE_LOOKAHEAD = 0.03 // Reduced from 0.05
const MAX_LOOKAHEAD = 0.10 // Reduced from 0.15
const IMPULSE_PREDICTION_FACTOR = 0.9 // Match server closely
const BALL_RADIUS = 0.8
const PLAYER_RADIUS = 0.9 // Increased for better ball stabilization
const COMBINED_RADIUS = BALL_RADIUS + PLAYER_RADIUS

// RAPIER-matched physics constants
const BALL_RESTITUTION = 0.75
const GRAVITY = 20
const LINEAR_DAMPING = 1.5

// Ultra-aggressive interpolation for instant response
const LERP_NORMAL = 25 // Snappy base
const LERP_COLLISION = 80 // Near-instant snap on collision
const LERP_SNAP_THRESHOLD = 8
const SPECULATIVE_THRESHOLD = 0.5 // Tightened from 0.7

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
      // Apply impulse / mass to get velocity change (F = ma -> dv = J/m)
      const invMass = 1 / 3.0 // Ball mass is 3.0kg
      predictedVelocity.current.x += impulse.x * invMass * IMPULSE_PREDICTION_FACTOR
      predictedVelocity.current.y += impulse.y * invMass * IMPULSE_PREDICTION_FACTOR
      predictedVelocity.current.z += impulse.z * invMass * IMPULSE_PREDICTION_FACTOR
      collisionThisFrame.current = true
    }
    return obj
  })

  // Kick message handler - confirms/corrects local prediction
  useEffect(() => {
    if (onKickMessage) {
      const unsubscribe = onKickMessage('ball-kicked', (data) => {
        if (kickFeedback.current) kickFeedback.current()
        
        if (data.impulse) {
          // Server confirmation - blend with existing prediction
          // Only add difference to avoid double-impulse
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
      return unsubscribe
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
    if (!serverPosSmoothed.current) {
      serverPosSmoothed.current = serverPos.clone()
    } else {
      serverPosSmoothed.current.lerp(serverPos, adaptiveEMA)
    }

    // 1. Sync server state with EMA smoothing
    targetPos.current.copy(serverPosSmoothed.current)
    serverVelocity.current.set(ballState.vx || 0, ballState.vy || 0, ballState.vz || 0)
    if (ballState.rx !== undefined) {
      targetRot.current.set(ballState.rx, ballState.ry, ballState.rz, ballState.rw)
    }

    // === VELOCITY-WEIGHTED RECONCILIATION ===
    // Fast ball = trust prediction more, slow ball = trust server more
    const speed = serverVelocity.current.length()
    const velocityFactor = Math.max(0.3, 1 - speed / 40) // 0.3 at high speed, 1.0 at rest
    const pingFactor = Math.max(0.3, 1 - ping / 300)
    const reconcileRate = 1 - Math.exp(-12 * pingFactor * velocityFactor * delta)
    
    predictedVelocity.current.lerp(serverVelocity.current, reconcileRate)

    // 3. Advance prediction with physics
    const vel = predictedVelocity.current
    targetPos.current.addScaledVector(vel, delta)
    
    if (targetPos.current.y > BALL_RADIUS) {
      predictedVelocity.current.y -= GRAVITY * delta
    }

    // === WALL/ARENA COLLISION PREDICTION ===
    const ARENA_HALF_WIDTH = 14.5
    const ARENA_HALF_DEPTH = 9.5
    const GOAL_HALF_WIDTH = 2.5
    const GOAL_X = 11.2
    
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

    // === VELOCITY CLAMPING ===
    const MAX_LINEAR_VEL = 50
    const velMag = predictedVelocity.current.length()
    if (velMag > MAX_LINEAR_VEL) {
      predictedVelocity.current.multiplyScalar(MAX_LINEAR_VEL / velMag)
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
      const isAnticipatedCollision = futureDist < dynamicCombinedRadius && 
                                    futureDist < currentDist &&
                                    currentDist < dynamicCombinedRadius * 1.1 // Proximity check
      const isSweepCollision = sweepT !== null
      
      // === SPECULATIVE COLLISION DETECTION ===
      // Pre-detect likely collisions for ultra-early response
      const isSpeculative = futureDist < currentDist * 0.4 && // Tightened from 0.5
                           futureDist < dynamicCombinedRadius * 0.9 && 
                           currentDist < dynamicCombinedRadius * 1.1 // Tightened from 1.3
      
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
          lastCollisionTime.current = now
          collisionThisFrame.current = true
          lastCollisionNormal.current.set(nx, ny, nz)
          
          // RAPIER-matched impulse with boost (scaled for giant)
          const impulseMag = -(1 + BALL_RESTITUTION) * approachSpeed
          const boostFactor = isGiant ? 2.0 : 1.2 // Giant kicks harder
          
          // Apply impulse scaled by confidence for speculative hits
          const impulseFactor = isSpeculative && !isCurrentCollision ? 0.85 : 1.0
          
          predictedVelocity.current.x += impulseMag * nx * boostFactor * impulseFactor
          predictedVelocity.current.y += impulseMag * ny * boostFactor * impulseFactor + (isGiant ? 3 : 1.5)
          predictedVelocity.current.z += impulseMag * nz * boostFactor * impulseFactor
          
          // Player velocity transfer
          predictedVelocity.current.x += (playerVel.x || 0) * 0.5
          predictedVelocity.current.z += (playerVel.z || 0) * 0.5
          
          // INSTANT position correction with sub-frame advancement
          const overlap = dynamicCombinedRadius - contactDist + 0.02
          if (overlap > 0) {
            // Advance remaining time after collision
            const remainingTime = delta * (1 - subFrameTime.current)
            targetPos.current.x += nx * overlap + vel.x * remainingTime * 0.3
            targetPos.current.y += ny * overlap * 0.5
            targetPos.current.z += nz * overlap + vel.z * remainingTime * 0.3
            
            // Immediate visual push (confidence-weighted)
            const visualPush = 0.8 * Math.max(0.6, collisionConfidence.current)
            groupRef.current.position.x += nx * overlap * visualPush
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
      // INSTANT snap on collision - confidence-weighted
      const confidenceBoost = 1 + collisionConfidence.current * 0.5
      const snapFactor = 1 - Math.exp(-LERP_COLLISION * confidenceBoost * delta)
      groupRef.current.position.lerp(targetPos.current, snapFactor)
    } else {
      const lerpFactor = 1 - Math.exp(-LERP_NORMAL * delta)
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
