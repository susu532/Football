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

// ClientBallVisual - Visual-only ball with smooth interpolation from server state
// Receives snapshots from Colyseus, interpolates smoothly
export const ClientBallVisual = React.forwardRef(({ ballState, onKickMessage, localPlayerRef }, ref) => {
  const groupRef = useRef()
  const targetPos = useRef(new THREE.Vector3(0, 2, 0))
  const targetRot = useRef(new THREE.Quaternion())
  const velocity = useRef(new THREE.Vector3(0, 0, 0))
  const kickFeedback = useRef(null)
  const lastUpdateTime = useRef(0)
  const lastCollisionTime = useRef(0) // Cooldown for collision prediction
  
  useImperativeHandle(ref, () => ({
    get position() { return groupRef.current.position },
    get velocity() { return velocity.current },
    applyImpulse: (impulse) => {
      velocity.current.x += impulse.x
      velocity.current.y += impulse.y
      velocity.current.z += impulse.z
      
      // Trigger visual feedback
      if (kickFeedback.current) kickFeedback.current()
    }
  }))

  // Listen for kick message for visual feedback and prediction
  useEffect(() => {
    if (onKickMessage) {
      const unsubscribe = onKickMessage('ball-kicked', (data) => {
        // Visual feedback (scale pop)
        if (kickFeedback.current) {
          kickFeedback.current()
        }

        // Prediction: Apply a temporary visual impulse
        if (data.impulse) {
           velocity.current.x += data.impulse.x / 3.0
           velocity.current.y += data.impulse.y / 3.0
           velocity.current.z += data.impulse.z / 3.0
        }
      })
      return unsubscribe
    }
  }, [onKickMessage])

  useFrame((state, delta) => {
    if (!groupRef.current || !ballState) return

    const now = state.clock.getElapsedTime()

    // 1. Sync targets from proxy with LATENCY EXTRAPOLATION
    // We want to render where the ball IS right now, not where it WAS 50ms ago.
    // Assuming ~50ms latency (tunable or dynamic if we had ping)
    const LATENCY_COMPENSATION = 0.06 // 60ms ahead
    
    // Only update target if the server state has changed significantly or it's a new frame
    // But here we just overwrite. To smooth it, we should blend.
    // For now, let's apply the compensation to the target.
    
    // Calculate the "server" position extrapolated to "now"
    const serverPos = new THREE.Vector3(ballState.x, ballState.y, ballState.z)
    const serverVel = new THREE.Vector3(ballState.vx || 0, ballState.vy || 0, ballState.vz || 0)
    
    // Apply linear damping to extrapolation (approximate)
    // v(t) = v0 * (1 - damping * t)
    const dampingFactor = Math.max(0, 1 - 1.5 * LATENCY_COMPENSATION)
    const extrapolatedVel = serverVel.clone().multiplyScalar(dampingFactor)
    const extrapolatedPos = serverPos.clone().addScaledVector(serverVel, LATENCY_COMPENSATION) // Simple Euler for position
    
    // Update our target to this "present" state
    targetPos.current.copy(extrapolatedPos)
    
    // If we haven't predicted a collision recently, we trust the server velocity (damped)
    // But if we DID predict a collision, we want to keep our local velocity for a bit
    // to avoid "snapping" back before the server confirms the hit.
    if (now - lastCollisionTime.current > 0.3) {
       // Blend server velocity into current velocity to correct drift
       const vLerp = 1 - Math.exp(-1.5 * delta)
       velocity.current.lerp(extrapolatedVel, vLerp)
    }

    // 2. Prediction: Advance locally
    // This runs every frame, so we are simulating forward from the last (extrapolated) server state
    // PLUS any local impulses we applied.
    
    // Apply gravity
    if (groupRef.current.position.y > 0.8) {
      velocity.current.y -= 20 * delta
    }
    
    // Apply Damping (matches server 1.5)
    velocity.current.multiplyScalar(Math.max(0, 1 - 1.5 * delta))

    // Move visual
    groupRef.current.position.addScaledVector(velocity.current, delta)
    
    // 3. MICRO-PRECISE COLLISION (AABB vs Sphere)
    // Player Collider: Cuboid(0.6, 0.2, 0.6) at (x, 0.2, z) -> Bounds: [x-0.6, 0, z-0.6] to [x+0.6, 0.4, z+0.6]
    // Ball Collider: Sphere(0.8)
    
    // 3. MICRO-PRECISE COLLISION (CCD + Angular Impulse)
    // We check for collision along the path from prevPos to currentPos to prevent tunneling.
    // We also calculate angular impulse (spin) from friction.
    
    if (localPlayerRef?.current?.position && now - lastCollisionTime.current > 0.1) {
      const pPos = localPlayerRef.current.userData?.physicsPosition || localPlayerRef.current.position
      const colliderCenter = pPos.clone().add(new THREE.Vector3(0, 0.2, 0))
      const halfExtents = new THREE.Vector3(0.6, 0.2, 0.6)
      const radius = 0.8
      
      // CCD: Sub-step the movement to check for collisions
      // Simple approach: Check start, mid, and end of the step
      const startPos = groupRef.current.position.clone().sub(velocity.current.clone().multiplyScalar(delta))
      const endPos = groupRef.current.position
      const steps = 3 // Check 3 points along the path
      
      for (let i = 0; i <= steps; i++) {
        const t = i / steps
        const checkPos = startPos.clone().lerp(endPos, t)
        
        // Find closest point on AABB to Sphere center
        const closestX = Math.max(colliderCenter.x - halfExtents.x, Math.min(checkPos.x, colliderCenter.x + halfExtents.x))
        const closestY = Math.max(colliderCenter.y - halfExtents.y, Math.min(checkPos.y, colliderCenter.y + halfExtents.y))
        const closestZ = Math.max(colliderCenter.z - halfExtents.z, Math.min(checkPos.z, colliderCenter.z + halfExtents.z))
        
        const distSq = (closestX - checkPos.x)**2 + (closestY - checkPos.y)**2 + (closestZ - checkPos.z)**2
        
        if (distSq < radius * radius) {
          // COLLISION DETECTED
          lastCollisionTime.current = now
          
          const dist = Math.sqrt(distSq)
          
          // Normal from closest point to ball center
          let nx = (checkPos.x - closestX)
          let ny = (checkPos.y - closestY)
          let nz = (checkPos.z - closestZ)
          
          if (dist > 0.0001) {
            nx /= dist; ny /= dist; nz /= dist;
          } else {
            nx = 0; ny = 1; nz = 0;
          }
          
          // Relative Velocity
          const playerVel = localPlayerRef.current.userData?.velocity || { x: 0, y: 0, z: 0 }
          const relVx = velocity.current.x - playerVel.x
          const relVy = velocity.current.y - playerVel.y
          const relVz = velocity.current.z - playerVel.z
          
          const velAlongNormal = relVx * nx + relVy * ny + relVz * nz
          
          if (velAlongNormal < 0) {
            // Physics Resolution
            const restitution = 0.75 // Match server exactly
            const massBall = 3.0
            
            // J = -(1 + e) * v_rel_norm * m_ball
            let j = -(1 + restitution) * velAlongNormal * massBall
            
            // Apply Linear Impulse
            const impulseX = j * nx
            const impulseY = j * ny
            const impulseZ = j * nz
            
            velocity.current.x += impulseX / massBall
            velocity.current.y += impulseY / massBall
            velocity.current.z += impulseZ / massBall
            
            // Friction (Tangential impulse)
            const tx = relVx - velAlongNormal * nx
            const ty = relVy - velAlongNormal * ny
            const tz = relVz - velAlongNormal * nz
            
            const mu = 0.5 // Match server friction
            
            // Tangential force
            const tanImpulseX = -tx * mu * massBall
            const tanImpulseY = -ty * mu * massBall
            const tanImpulseZ = -tz * mu * massBall
            
            velocity.current.x += tanImpulseX / massBall
            velocity.current.y += tanImpulseY / massBall
            velocity.current.z += tanImpulseZ / massBall
            
            // Angular Impulse (Torque)
            // Torque = r x F. Here r is radius * -normal. F is tangential impulse.
            // Actually, change in angular velocity = (r x J_tan) / I
            // I (Moment of Inertia for solid sphere) = 2/5 * m * r^2
            const I = 0.4 * massBall * radius * radius
            
            // Contact point relative to ball center is -normal * radius
            const rx = -nx * radius
            const ry = -ny * radius
            const rz = -nz * radius
            
            // Cross product: r x J_tan
            const torqueX = ry * tanImpulseZ - rz * tanImpulseY
            const torqueY = rz * tanImpulseX - rx * tanImpulseZ
            const torqueZ = rx * tanImpulseY - ry * tanImpulseX
            
            // Apply to angular velocity (if we had it, for now just fake it visually or store it)
            // Let's add angularVelocity ref
            if (!velocity.current.ang) velocity.current.ang = new THREE.Vector3()
            
            velocity.current.ang.x += torqueX / I
            velocity.current.ang.y += torqueY / I
            velocity.current.ang.z += torqueZ / I
            
            // Extra "Pop"
            velocity.current.y += 1.5 
          }
          
          // Penetration Resolution (Push out) - Softened to prevent jitter
          const overlap = radius - dist
          const pushFactor = 0.5 // Only push out halfway per frame to smooth it
          groupRef.current.position.x += nx * overlap * pushFactor
          groupRef.current.position.y += ny * overlap * pushFactor
          groupRef.current.position.z += nz * overlap * pushFactor
          
          // Break after first collision to prevent multiple hits in one frame
          break 
        }
      }
    }

    // 4. Interpolation / Correction (Adaptive)
    const distToTarget = groupRef.current.position.distanceTo(targetPos.current)
    
    if (distToTarget > 4.0) {
      // Large error: snap to server state
      groupRef.current.position.copy(targetPos.current)
      velocity.current.copy(extrapolatedVel)
    } else {
      // Adaptive lerp: slower if we are predicting a collision or near a player
      const pPos = localPlayerRef?.current?.position
      const distToPlayer = pPos ? groupRef.current.position.distanceTo(pPos) : 10
      
      // If we are near the player or recently collided, we trust local physics more
      const isInteracting = distToPlayer < 2.5 || (now - lastCollisionTime.current < 0.5)
      
      // Use frame-rate independent lerp factor
      const baseLerp = isInteracting ? 0.5 : 2.5
      const lerpFactor = 1 - Math.exp(-baseLerp * delta)
      
      groupRef.current.position.lerp(targetPos.current, lerpFactor) 
    }
    
    // Apply Angular Velocity to Rotation
    if (velocity.current.ang) {
      const rotDelta = velocity.current.ang.clone().multiplyScalar(delta)
      const rotQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(rotDelta.x, rotDelta.y, rotDelta.z))
      groupRef.current.quaternion.premultiply(rotQuat)
      
      // Damping for angular velocity
      velocity.current.ang.multiplyScalar(1 - 1.5 * delta)
    } else {
       const rLerp = 1 - Math.exp(-2.0 * delta)
       groupRef.current.quaternion.slerp(targetRot.current, rLerp)
    }
    
    // 5. Floor Collision
    if (groupRef.current.position.y < 0.8) {
      groupRef.current.position.y = 0.8
      if (velocity.current.y < 0) {
        velocity.current.y = -velocity.current.y * 0.6 
        
        // Floor friction -> spin
        if (velocity.current.ang) {
           // Simple rolling friction approximation
           velocity.current.x *= 0.98
           velocity.current.z *= 0.98
        }
      }
    }
  })

  return (
    <group ref={groupRef} position={[0, 2, 0]}>
      <Trail
        width={0.6}
        length={8}
        color="#ffffff"
        attenuation={(t) => t * t + 0.01}
      >
        <SoccerBall onKickFeedback={kickFeedback} />
      </Trail>
    </group>
  )
})
ClientBallVisual.displayName = 'ClientBallVisual'
