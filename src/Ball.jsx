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
const PLAYER_RADIUS = 0.5 // Reduced from 0.7
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

    // 4. PING-AWARE COLLISION PREDICTION (CAR FORM OBB - SUB-FRAME SWEEP)
    const timeSinceCollision = now - lastCollisionTime.current
    
    if (localPlayerRef?.current?.position && timeSinceCollision > COLLISION_COOLDOWN) {
      const playerPos = localPlayerRef.current.position
      const playerRot = localPlayerRef.current.rotation
      const playerVel = localPlayerRef.current.userData?.velocity || { x: 0, y: 0, z: 0 }
      const ballPos = groupRef.current.position
      
      // CAR DIMENSIONS (Must match Server!)
      const CAR_HALF_X = 0.7
      const CAR_HALF_Y = 0.3
      const CAR_HALF_Z = 1.4
      const CAR_OFFSET_Y = 0.3

      // Transform Ball Movement to Player Local Space
      const playerQuat = new THREE.Quaternion().setFromEuler(playerRot)
      const invQuat = playerQuat.clone().invert()

      // Previous position (Start of frame) - approximated by subtracting velocity * delta
      // We use the PREDICTED velocity for the sweep to catch high-speed impacts
      const moveVec = new THREE.Vector3().copy(predictedVelocity.current).multiplyScalar(delta)
      const worldStart = new THREE.Vector3().subVectors(ballPos, moveVec)
      const worldEnd = ballPos.clone()

      // Transform Start/End to Local Space
      const localStart = worldStart.clone().sub(playerPos).applyQuaternion(invQuat)
      localStart.y -= CAR_OFFSET_Y
      
      const localEnd = worldEnd.clone().sub(playerPos).applyQuaternion(invQuat)
      localEnd.y -= CAR_OFFSET_Y

      // EXPANDED AABB (Minkowski Sum approximation for Sphere vs Box)
      // We expand the box by the ball radius to treat the ball as a point
      const EXPANDED_X = CAR_HALF_X + BALL_RADIUS
      const EXPANDED_Y = CAR_HALF_Y + BALL_RADIUS
      const EXPANDED_Z = CAR_HALF_Z + BALL_RADIUS

      // RAY/SEGMENT VS AABB INTERSECTION (Slab Method)
      let tMin = 0
      let tMax = 1
      let hitAxis = -1 // 0:x, 1:y, 2:z
      let hitSign = 0

      const dir = new THREE.Vector3().subVectors(localEnd, localStart)
      
      // Check X slab
      if (Math.abs(dir.x) < 1e-9) {
        if (Math.abs(localStart.x) > EXPANDED_X) tMin = Infinity // Parallel and outside
      } else {
        const invDir = 1.0 / dir.x
        let t1 = (-EXPANDED_X - localStart.x) * invDir
        let t2 = (EXPANDED_X - localStart.x) * invDir
        if (t1 > t2) [t1, t2] = [t2, t1]
        
        if (t1 > tMin) { tMin = t1; hitAxis = 0; hitSign = Math.sign(-dir.x); }
        if (t2 < tMax) tMax = t2
      }

      // Check Y slab
      if (Math.abs(dir.y) < 1e-9) {
        if (Math.abs(localStart.y) > EXPANDED_Y) tMin = Infinity
      } else {
        const invDir = 1.0 / dir.y
        let t1 = (-EXPANDED_Y - localStart.y) * invDir
        let t2 = (EXPANDED_Y - localStart.y) * invDir
        if (t1 > t2) [t1, t2] = [t2, t1]
        
        if (t1 > tMin) { tMin = t1; hitAxis = 1; hitSign = Math.sign(-dir.y); }
        if (t2 < tMax) tMax = t2
      }

      // Check Z slab
      if (Math.abs(dir.z) < 1e-9) {
        if (Math.abs(localStart.z) > EXPANDED_Z) tMin = Infinity
      } else {
        const invDir = 1.0 / dir.z
        let t1 = (-EXPANDED_Z - localStart.z) * invDir
        let t2 = (EXPANDED_Z - localStart.z) * invDir
        if (t1 > t2) [t1, t2] = [t2, t1]
        
        if (t1 > tMin) { tMin = t1; hitAxis = 2; hitSign = Math.sign(-dir.z); }
        if (t2 < tMax) tMax = t2
      }

      // Check for valid intersection
      // Also check if we started INSIDE (tMin == 0) - treat as immediate collision
      const isInside = Math.abs(localStart.x) < EXPANDED_X && Math.abs(localStart.y) < EXPANDED_Y && Math.abs(localStart.z) < EXPANDED_Z
      const isHit = (tMin <= tMax && tMin >= 0 && tMin <= 1) || isInside

      if (isHit) {
        // Calculate Normal
        const localNormal = new THREE.Vector3(0, 0, 0)
        if (isInside) {
          // If inside, find closest face to push out
          const dx = EXPANDED_X - Math.abs(localStart.x)
          const dy = EXPANDED_Y - Math.abs(localStart.y)
          const dz = EXPANDED_Z - Math.abs(localStart.z)
          if (dx < dy && dx < dz) localNormal.set(Math.sign(localStart.x), 0, 0)
          else if (dy < dz) localNormal.set(0, Math.sign(localStart.y), 0)
          else localNormal.set(0, 0, Math.sign(localStart.z))
          tMin = 0 // Immediate
        } else {
          if (hitAxis === 0) localNormal.x = hitSign
          else if (hitAxis === 1) localNormal.y = hitSign
          else if (hitAxis === 2) localNormal.z = hitSign
        }

        // Transform normal back to World Space
        const worldNormal = localNormal.clone().applyQuaternion(playerQuat)
        
        // STABILIZATION LOGIC
        const isRoof = localNormal.y > 0.9 // Top face
        
        lastCollisionTime.current = now
        collisionThisFrame.current = true
        lastCollisionNormal.current.copy(worldNormal)
        
        // Relative velocity
        const relVx = vel.x - (playerVel.x || 0)
        const relVy = vel.y - (playerVel.y || 0)
        const relVz = vel.z - (playerVel.z || 0)
        const approachSpeed = relVx * worldNormal.x + relVy * worldNormal.y + relVz * worldNormal.z
        
        if (approachSpeed < 0 || isInside) {
          // Standard Bounce
          const restitution = isRoof ? 0.1 : BALL_RESTITUTION
          const impulseMag = -(1 + restitution) * approachSpeed
          
          predictedVelocity.current.x += impulseMag * worldNormal.x
          predictedVelocity.current.y += impulseMag * worldNormal.y
          predictedVelocity.current.z += impulseMag * worldNormal.z
          
          // Friction / Stabilization
          if (isRoof) {
            const friction = 0.8
            predictedVelocity.current.x += ((playerVel.x || 0) - predictedVelocity.current.x) * friction
            predictedVelocity.current.z += ((playerVel.z || 0) - predictedVelocity.current.z) * friction
          } else {
            predictedVelocity.current.x *= 0.9
            predictedVelocity.current.z *= 0.9
          }
          
          // Player velocity transfer
          predictedVelocity.current.x += (playerVel.x || 0) * 0.2
          predictedVelocity.current.z += (playerVel.z || 0) * 0.2
          
          // SUB-FRAME POSITION CORRECTION
          // 1. Rewind to impact point
          // 2. Reflect velocity
          // 3. Advance remaining time
          if (!isInside && tMin > 0) {
             // Rewind
             targetPos.current.copy(worldStart).addScaledVector(moveVec, tMin)
             // Push out slightly to avoid precision issues
             targetPos.current.addScaledVector(worldNormal, 0.01)
             
             // Advance remainder
             const remainingTime = delta * (1 - tMin)
             targetPos.current.addScaledVector(predictedVelocity.current, remainingTime)
             
             // Sync visual group
             groupRef.current.position.copy(targetPos.current)
          } else if (isInside) {
             // Push out logic for embedded case
             const overlap = 0.1 // Arbitrary small push
             targetPos.current.addScaledVector(worldNormal, overlap)
             groupRef.current.position.addScaledVector(worldNormal, overlap)
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
