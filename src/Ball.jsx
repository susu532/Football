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

// === MICRO-PRECISE COLLISION PREDICTION CONSTANTS ===
const COLLISION_COOLDOWN = 0.016 // 1 frame at 60Hz (was 0.1s)
const MICRO_TOUCH_THRESHOLD = 0.5 // Distinguish taps from slides
const IMPULSE_PREDICTION_FACTOR = 0.8 // Match server response (was 0.33)
const SWEEP_SUBSTEPS = 3 // Sub-frame collision detection steps

// Sub-frame sweep test: Find exact collision time within frame
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
  
  if (a < 0.0001) return null // No movement
  
  const discriminant = b * b - 4 * a * c
  if (discriminant < 0) return null // No collision
  
  const t = (-b - Math.sqrt(discriminant)) / (2 * a)
  if (t < 0 || t > 1) return null // Collision outside frame
  
  return t // Exact time of collision within frame [0, 1]
}

// ClientBallVisual - Visual-only ball with smooth interpolation from server state
// Receives snapshots from Colyseus, interpolates smoothly
// ENHANCED: Micro-precise collision prediction for 0-ping feel
export const ClientBallVisual = React.forwardRef(({ ballState, onKickMessage, localPlayerRef }, ref) => {
  const groupRef = useRef()
  const targetPos = useRef(new THREE.Vector3(0, 2, 0))
  const prevTargetPos = useRef(new THREE.Vector3(0, 2, 0)) // For sweep test
  const targetRot = useRef(new THREE.Quaternion())
  const velocity = useRef(new THREE.Vector3(0, 0, 0))
  const predictedVelocity = useRef(new THREE.Vector3(0, 0, 0)) // Separate from server velocity
  const kickFeedback = useRef(null)
  const lastUpdateTime = useRef(0)
  const lastCollisionTime = useRef(0)
  const lastCollisionNormal = useRef(new THREE.Vector3()) // For continuous contact
  
  useImperativeHandle(ref, () => groupRef.current)

  // Listen for kick message for visual feedback and prediction
  useEffect(() => {
    if (onKickMessage) {
      const unsubscribe = onKickMessage('ball-kicked', (data) => {
        // Visual feedback (scale pop)
        if (kickFeedback.current) {
          kickFeedback.current()
        }

        // ENHANCED: Improved impulse prediction - closer to actual server response
        if (data.impulse) {
           predictedVelocity.current.x += data.impulse.x * IMPULSE_PREDICTION_FACTOR
           predictedVelocity.current.y += data.impulse.y * IMPULSE_PREDICTION_FACTOR
           predictedVelocity.current.z += data.impulse.z * IMPULSE_PREDICTION_FACTOR
        }
      })
      return unsubscribe
    }
  }, [onKickMessage])

  useFrame((state, delta) => {
    if (!groupRef.current || !ballState) return

    const now = state.clock.getElapsedTime()

    // Store previous target for sweep test
    prevTargetPos.current.copy(targetPos.current)

    // 1. Sync targets from proxy
    targetPos.current.set(ballState.x, ballState.y, ballState.z)
    velocity.current.set(ballState.vx || 0, ballState.vy || 0, ballState.vz || 0)
    if (ballState.rx !== undefined) {
      targetRot.current.set(ballState.rx, ballState.ry, ballState.rz, ballState.rw)
    }

    // 2. Blend predicted velocity with server velocity
    // Decay prediction toward server state for smooth reconciliation
    const blendRate = 1 - Math.exp(-8 * delta)
    predictedVelocity.current.lerp(velocity.current, blendRate)

    // Use predicted velocity for visual advancement
    const effectiveVelocity = predictedVelocity.current

    // 3. Prediction: Advance target position using blended velocity
    targetPos.current.addScaledVector(effectiveVelocity, delta)
    
    // Apply gravity to prediction (matches server gravity -20)
    if (targetPos.current.y > 0.8) {
      predictedVelocity.current.y -= 20 * delta
    }

    // 4. MICRO-PRECISE COLLISION PREDICTION
    // Sub-frame sweep test for instant contact response
    const timeSinceCollision = now - lastCollisionTime.current
    if (localPlayerRef?.current?.position && timeSinceCollision > COLLISION_COOLDOWN) {
      const playerPos = localPlayerRef.current.position
      const ballPos = groupRef.current.position
      
      // Get player velocity for relative collision
      const playerVx = localPlayerRef.current.userData?.velocity?.x || 0
      const playerVy = localPlayerRef.current.userData?.velocity?.y || 0
      const playerVz = localPlayerRef.current.userData?.velocity?.z || 0
      
      const collisionRadius = 1.5 // Player radius + ball radius
      
      // Sub-frame sweep test: Check if ball trajectory intersects player
      const ballStart = ballPos.clone()
      const ballEnd = targetPos.current.clone()
      
      const sweepT = sweepSphereToSphere(ballStart, ballEnd, playerPos, collisionRadius)
      
      // Direct distance check (fallback and micro-touch detection)
      const dx = ballPos.x - playerPos.x
      const dy = ballPos.y - playerPos.y
      const dz = ballPos.z - playerPos.z
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
      
      const hasCollision = sweepT !== null || dist < collisionRadius
      
      if (hasCollision && dist > 0.1) {
        // Calculate contact point (use sweep time if available)
        let contactDist = dist
        let contactX = dx, contactY = dy, contactZ = dz
        
        if (sweepT !== null && sweepT > 0) {
          // Exact contact point from sweep
          const contactBall = ballStart.clone().lerp(ballEnd, sweepT)
          contactX = contactBall.x - playerPos.x
          contactY = contactBall.y - playerPos.y
          contactZ = contactBall.z - playerPos.z
          contactDist = Math.sqrt(contactX * contactX + contactY * contactY + contactZ * contactZ)
        }
        
        // Calculate relative velocity (Ball - Player)
        const relVx = effectiveVelocity.x - playerVx
        const relVy = effectiveVelocity.y - playerVy
        const relVz = effectiveVelocity.z - playerVz
        const relSpeed = Math.sqrt(relVx * relVx + relVy * relVy + relVz * relVz)
        
        // Check if moving towards each other
        const velToPlayer = (contactX * relVx + contactY * relVy + contactZ * relVz) / Math.max(contactDist, 0.1)
        
        // Detect micro-touch vs continuous contact
        const isMicroTouch = relSpeed > MICRO_TOUCH_THRESHOLD && timeSinceCollision > 0.05
        const isContinuousContact = dist < collisionRadius * 0.95
        
        if (velToPlayer < 0 || isContinuousContact) {
          // INSTANT COLLISION RESPONSE
          lastCollisionTime.current = now
          
          // Calculate collision normal (away from player)
          const invDist = 1 / Math.max(contactDist, 0.1)
          const nx = contactX * invDist
          const ny = Math.max(0.15, contactY * invDist) // Slight upward bias
          const nz = contactZ * invDist
          
          lastCollisionNormal.current.set(nx, ny, nz)
          
          // Impulse calculation - precise elastic collision
          const restitution = isMicroTouch ? 0.85 : 0.7
          const impulseStrength = isMicroTouch ? 1.8 : 1.2
          
          // Reflect relative velocity along normal
          const dotRel = relVx * nx + relVy * ny + relVz * nz
          
          if (dotRel < 0) {
            const j = -(1 + restitution) * dotRel * impulseStrength
            
            // Apply impulse to predicted velocity (instant visual response)
            predictedVelocity.current.x += j * nx
            predictedVelocity.current.y += j * ny + (isMicroTouch ? 2.5 : 1.5) // Vertical pop
            predictedVelocity.current.z += j * nz
            
            // Transfer player momentum (makes dribbling feel connected)
            predictedVelocity.current.x += playerVx * 0.6
            predictedVelocity.current.y += Math.max(0, playerVy * 0.3)
            predictedVelocity.current.z += playerVz * 0.6
          }
          
          // Push ball out to prevent tunneling (instant)
          const overlap = collisionRadius - dist + 0.05
          if (overlap > 0) {
            targetPos.current.x += nx * overlap
            targetPos.current.y += ny * overlap * 0.5
            targetPos.current.z += nz * overlap
          }
        }
      }
    }

    // 5. Interpolation: Smoothly move visual toward target
    // ENHANCED: Higher lerp rate for snappier response
    const distance = groupRef.current.position.distanceTo(targetPos.current)
    
    if (distance > 10) {
      // Snap to position if too far (reconnect or major desync)
      groupRef.current.position.copy(targetPos.current)
    } else {
      // Higher lerp for snappier feel (was 10, now 15)
      const lerpFactor = 1 - Math.exp(-15 * delta)
      groupRef.current.position.lerp(targetPos.current, lerpFactor)
    }
    
    groupRef.current.quaternion.slerp(targetRot.current, 1 - Math.exp(-12 * delta))
    
    // 6. Floor collision for visual prediction
    if (groupRef.current.position.y < 0.8) {
      groupRef.current.position.y = 0.8
      predictedVelocity.current.y = Math.abs(predictedVelocity.current.y) * 0.5
    }

    // 7. Apply velocity damping (matches server linearDamping 1.5)
    predictedVelocity.current.multiplyScalar(1 - 1.5 * delta)
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
