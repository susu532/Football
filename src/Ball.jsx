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

// === S-TIER MICRO-PRECISE COLLISION PREDICTION ===
// Designed for 0-ping visual feel at any latency

// Collision constants tuned to match RAPIER server physics
const COLLISION_COOLDOWN = 0.008 // Half frame - allows rapid micro-touches
const ANTICIPATION_LOOKAHEAD = 0.05 // 50ms ahead - predict collision before it happens
const IMPULSE_PREDICTION_FACTOR = 0.85 // Matched to server impulse response
const BALL_RADIUS = 0.8
const PLAYER_RADIUS = 0.7
const COMBINED_RADIUS = BALL_RADIUS + PLAYER_RADIUS

// RAPIER-matched physics constants
const BALL_MASS = 3.0
const BALL_RESTITUTION = 0.75
const GRAVITY = 20
const LINEAR_DAMPING = 1.5

// Interpolation tuning for instant response
const LERP_NORMAL = 18 // Standard interpolation
const LERP_COLLISION = 50 // Aggressive snap on collision
const LERP_SNAP_THRESHOLD = 8 // Distance to hard snap

// Sub-frame sweep test with lookahead
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
  
  // Return first valid intersection
  if (t1 >= 0 && t1 <= 1) return t1
  if (t2 >= 0 && t2 <= 1) return t2
  return null
}

// Anticipatory trajectory prediction
const predictFuturePosition = (pos, vel, time, gravity) => {
  return {
    x: pos.x + vel.x * time,
    y: Math.max(BALL_RADIUS, pos.y + vel.y * time - 0.5 * gravity * time * time),
    z: pos.z + vel.z * time
  }
}

// ClientBallVisual - S-TIER Visual prediction for 0-ping feel
// Server-authoritative with aggressive client-side visual prediction
export const ClientBallVisual = React.forwardRef(({ ballState, onKickMessage, localPlayerRef }, ref) => {
  const groupRef = useRef()
  const targetPos = useRef(new THREE.Vector3(0, 2, 0))
  const visualPos = useRef(new THREE.Vector3(0, 2, 0)) // Separate visual position
  const targetRot = useRef(new THREE.Quaternion())
  const serverVelocity = useRef(new THREE.Vector3(0, 0, 0))
  const predictedVelocity = useRef(new THREE.Vector3(0, 0, 0))
  const kickFeedback = useRef(null)
  const lastCollisionTime = useRef(0)
  const collisionThisFrame = useRef(false) // Flag for instant snap
  const lastCollisionNormal = useRef(new THREE.Vector3())
  const anticipatedCollision = useRef(null) // Store anticipated collision for next frame
  
  useImperativeHandle(ref, () => groupRef.current)

  // Kick message handler - instant visual response
  useEffect(() => {
    if (onKickMessage) {
      const unsubscribe = onKickMessage('ball-kicked', (data) => {
        if (kickFeedback.current) kickFeedback.current()
        
        if (data.impulse) {
          // INSTANT impulse application - no dampening
          predictedVelocity.current.x += data.impulse.x * IMPULSE_PREDICTION_FACTOR
          predictedVelocity.current.y += data.impulse.y * IMPULSE_PREDICTION_FACTOR
          predictedVelocity.current.z += data.impulse.z * IMPULSE_PREDICTION_FACTOR
          
          // Set collision flag for instant visual snap
          collisionThisFrame.current = true
        }
      })
      return unsubscribe
    }
  }, [onKickMessage])

  useFrame((state, delta) => {
    if (!groupRef.current || !ballState) return

    const now = state.clock.getElapsedTime()
    collisionThisFrame.current = false

    // 1. Sync server state
    targetPos.current.set(ballState.x, ballState.y, ballState.z)
    serverVelocity.current.set(ballState.vx || 0, ballState.vy || 0, ballState.vz || 0)
    if (ballState.rx !== undefined) {
      targetRot.current.set(ballState.rx, ballState.ry, ballState.rz, ballState.rw)
    }

    // 2. Blend predicted velocity toward server (smooth reconciliation)
    const reconcileRate = 1 - Math.exp(-12 * delta) // Fast reconciliation
    predictedVelocity.current.lerp(serverVelocity.current, reconcileRate)

    // 3. Advance prediction with physics
    const vel = predictedVelocity.current
    targetPos.current.addScaledVector(vel, delta)
    
    // Apply gravity (matches RAPIER)
    if (targetPos.current.y > BALL_RADIUS) {
      predictedVelocity.current.y -= GRAVITY * delta
    }

    // 4. S-TIER COLLISION PREDICTION
    const timeSinceCollision = now - lastCollisionTime.current
    
    if (localPlayerRef?.current?.position && timeSinceCollision > COLLISION_COOLDOWN) {
      const playerPos = localPlayerRef.current.position
      const playerVel = localPlayerRef.current.userData?.velocity || { x: 0, y: 0, z: 0 }
      const ballPos = groupRef.current.position
      
      // ANTICIPATORY COLLISION: Check if collision will happen in next 50ms
      const futureBall = predictFuturePosition(
        ballPos, 
        vel, 
        ANTICIPATION_LOOKAHEAD, 
        GRAVITY
      )
      const futurePlayer = {
        x: playerPos.x + (playerVel.x || 0) * ANTICIPATION_LOOKAHEAD,
        y: playerPos.y + (playerVel.y || 0) * ANTICIPATION_LOOKAHEAD,
        z: playerPos.z + (playerVel.z || 0) * ANTICIPATION_LOOKAHEAD
      }
      
      // Distance checks (current and anticipated)
      const dx = ballPos.x - playerPos.x
      const dy = ballPos.y - playerPos.y
      const dz = ballPos.z - playerPos.z
      const currentDist = Math.sqrt(dx * dx + dy * dy + dz * dz)
      
      const fdx = futureBall.x - futurePlayer.x
      const fdy = futureBall.y - futurePlayer.y
      const fdz = futureBall.z - futurePlayer.z
      const futureDist = Math.sqrt(fdx * fdx + fdy * fdy + fdz * fdz)
      
      // Sweep test for high-speed collisions
      const ballEnd = targetPos.current.clone()
      const sweepT = sweepSphereToSphere(ballPos, ballEnd, playerPos, COMBINED_RADIUS)
      
      // Collision conditions
      const isCurrentCollision = currentDist < COMBINED_RADIUS
      const isAnticipatedCollision = futureDist < COMBINED_RADIUS && futureDist < currentDist
      const isSweepCollision = sweepT !== null
      
      if ((isCurrentCollision || isAnticipatedCollision || isSweepCollision) && currentDist > 0.05) {
        // Calculate collision normal
        let nx, ny, nz, contactDist
        
        if (isSweepCollision && sweepT > 0) {
          // Exact contact from sweep
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
        
        // Dot product with normal (approach speed)
        const approachSpeed = relVx * nx + relVy * ny + relVz * nz
        
        // Only respond if approaching
        if (approachSpeed < 0 || isCurrentCollision) {
          lastCollisionTime.current = now
          collisionThisFrame.current = true
          lastCollisionNormal.current.set(nx, ny, nz)
          
          // RAPIER-matched impulse calculation
          // j = -(1 + e) * Vrel·n / (1/m_ball + 1/m_player)
          // Since player is kinematic (infinite mass): j = -(1 + e) * Vrel·n * m_ball
          const e = BALL_RESTITUTION
          const impulseMag = -(1 + e) * approachSpeed
          
          // Apply impulse with slight boost for game feel
          const boostFactor = 1.15
          predictedVelocity.current.x += impulseMag * nx * boostFactor
          predictedVelocity.current.y += impulseMag * ny * boostFactor + 1.5 // Vertical pop
          predictedVelocity.current.z += impulseMag * nz * boostFactor
          
          // Player velocity transfer (friction/grip effect)
          const transferFactor = 0.5
          predictedVelocity.current.x += (playerVel.x || 0) * transferFactor
          predictedVelocity.current.z += (playerVel.z || 0) * transferFactor
          
          // INSTANT position correction (prevents tunneling)
          const overlap = COMBINED_RADIUS - contactDist + 0.02
          if (overlap > 0) {
            targetPos.current.x += nx * overlap
            targetPos.current.y += ny * overlap * 0.5
            targetPos.current.z += nz * overlap
            
            // Also move visual immediately for 0-ping feel
            groupRef.current.position.x += nx * overlap * 0.8
            groupRef.current.position.z += nz * overlap * 0.8
          }
        }
      }
    }

    // 5. VISUAL INTERPOLATION with collision-aware snapping
    const distance = groupRef.current.position.distanceTo(targetPos.current)
    
    if (distance > LERP_SNAP_THRESHOLD) {
      // Hard snap for major desync
      groupRef.current.position.copy(targetPos.current)
    } else if (collisionThisFrame.current) {
      // INSTANT response on collision frame - aggressive lerp
      const snapFactor = 1 - Math.exp(-LERP_COLLISION * delta)
      groupRef.current.position.lerp(targetPos.current, snapFactor)
    } else {
      // Normal smooth interpolation
      const lerpFactor = 1 - Math.exp(-LERP_NORMAL * delta)
      groupRef.current.position.lerp(targetPos.current, lerpFactor)
    }
    
    // Rotation interpolation
    groupRef.current.quaternion.slerp(targetRot.current, 1 - Math.exp(-15 * delta))
    
    // 6. Floor collision
    if (groupRef.current.position.y < BALL_RADIUS) {
      groupRef.current.position.y = BALL_RADIUS
      if (predictedVelocity.current.y < 0) {
        predictedVelocity.current.y = Math.abs(predictedVelocity.current.y) * BALL_RESTITUTION
      }
    }

    // 7. Apply linear damping (matches server)
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
