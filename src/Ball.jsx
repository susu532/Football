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
  
  useImperativeHandle(ref, () => groupRef.current)

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
    if (now - lastCollisionTime.current > 0.2) {
       // Blend server velocity into current velocity to correct drift
       velocity.current.lerp(extrapolatedVel, 0.1)
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
    
    if (localPlayerRef?.current?.position && now - lastCollisionTime.current > 0.1) {
      // Use physics position for accurate prediction if available, else visual position
      const pPos = localPlayerRef.current.userData?.physicsPosition || localPlayerRef.current.position
      const ballPos = groupRef.current.position
      
      // Player AABB (local coords relative to player center)
      // Player center is at pPos. The collider is offset by y=0.2.
      // But pPos is usually the bottom center or center? 
      // In PlayerController, physicsPosition is the RigidBody position.
      // Server: setTranslation(spawnX, 0.1, 0). Collider translation(0, 0.2, 0).
      // So Collider Center is at Body + (0, 0.2, 0).
      // If pPos is the Group position, it usually matches Body position.
      
      const colliderCenter = pPos.clone().add(new THREE.Vector3(0, 0.2, 0))
      const halfExtents = new THREE.Vector3(0.6, 0.2, 0.6)
      
      // Find closest point on AABB to Sphere center
      const closestX = Math.max(colliderCenter.x - halfExtents.x, Math.min(ballPos.x, colliderCenter.x + halfExtents.x))
      const closestY = Math.max(colliderCenter.y - halfExtents.y, Math.min(ballPos.y, colliderCenter.y + halfExtents.y))
      const closestZ = Math.max(colliderCenter.z - halfExtents.z, Math.min(ballPos.z, colliderCenter.z + halfExtents.z))
      
      const distSq = (closestX - ballPos.x)**2 + (closestY - ballPos.y)**2 + (closestZ - ballPos.z)**2
      const radius = 0.8
      
      if (distSq < radius * radius) {
        // COLLISION DETECTED
        lastCollisionTime.current = now
        
        const dist = Math.sqrt(distSq)
        
        // Normal from closest point to ball center
        let nx = (ballPos.x - closestX)
        let ny = (ballPos.y - closestY)
        let nz = (ballPos.z - closestZ)
        
        // Normalize
        if (dist > 0.0001) {
          nx /= dist; ny /= dist; nz /= dist;
        } else {
          // Center overlap, push up
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
          // Match server restitution (0.75)
          const restitution = 0.75 
          const massBall = 3.0
          
          // J = -(1 + e) * v_rel_norm * m_ball
          let j = -(1 + restitution) * velAlongNormal * massBall
          
          // Apply Impulse
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
          
          velocity.current.x -= tx * mu
          velocity.current.y -= ty * mu
          velocity.current.z -= tz * mu
          
          // REMOVED: Artificial pop to match server physics
        }
        
        // Penetration Resolution (Push out)
        const overlap = radius - dist
        groupRef.current.position.x += nx * overlap
        groupRef.current.position.y += ny * overlap
        groupRef.current.position.z += nz * overlap
      }
    }

    // 4. Interpolation / Correction
    const distToTarget = groupRef.current.position.distanceTo(targetPos.current)
    
    if (distToTarget > 2.0) {
      // Snap if way off
      groupRef.current.position.copy(targetPos.current)
      velocity.current.copy(extrapolatedVel)
    } else {
      // Continuous smooth correction
      // The further away, the stronger the pull.
      // Allows small deviations for smoothness, but corrects large drifts quickly.
      const correctionSpeed = Math.max(1.0, distToTarget * 5.0)
      groupRef.current.position.lerp(targetPos.current, correctionSpeed * delta)
      
      // Also blend velocity to prevent overshooting
      velocity.current.lerp(extrapolatedVel, delta * 2.0)
    }
    
    groupRef.current.quaternion.slerp(targetRot.current, 0.1)
    
    // 5. Floor Collision
    if (groupRef.current.position.y < 0.8) {
      groupRef.current.position.y = 0.8
      if (velocity.current.y < 0) {
        velocity.current.y = -velocity.current.y * 0.75 // Match server restitution
      }
    }
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
