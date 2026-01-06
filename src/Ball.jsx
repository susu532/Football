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

    // 1. Sync targets from proxy
    targetPos.current.set(ballState.x, ballState.y, ballState.z)
    velocity.current.set(ballState.vx || 0, ballState.vy || 0, ballState.vz || 0)
    if (ballState.rx !== undefined) {
      targetRot.current.set(ballState.rx, ballState.ry, ballState.rz, ballState.rw)
    }

    // 2. Prediction: Advance target position using velocity
    // Helps smooth out the gap between snapshots
    targetPos.current.addScaledVector(velocity.current, delta)
    
    // Apply gravity to prediction (matches server gravity -20)
    if (targetPos.current.y > 0.8) {
      velocity.current.y -= 20 * delta
    }

    // 3. LOCAL COLLISION PREDICTION (Visual Only)
    // Check for collision with local player and apply visual deflection
    if (localPlayerRef?.current?.position && now - lastCollisionTime.current > 0.1) {
      const playerPos = localPlayerRef.current.position
      const ballPos = groupRef.current.position
      
      const dx = ballPos.x - playerPos.x
      const dy = ballPos.y - playerPos.y
      const dz = ballPos.z - playerPos.z
      const distSq = dx * dx + dz * dz // Horizontal distance squared
      const dist = Math.sqrt(distSq + dy * dy) // Full 3D distance
      
      const collisionRadius = 1.5 // Player radius + ball radius
      
      if (dist < collisionRadius && dist > 0.1) {
        // Check if ball is moving towards player (dot product) or if player is moving towards ball
        const velToPlayer = dx * velocity.current.x + dz * velocity.current.z
        
        // Only collide if moving towards each other or overlapping significantly
        if (velToPlayer < 0 || dist < collisionRadius * 0.9) { 
          lastCollisionTime.current = now
          
          // Calculate reflection normal (away from player)
          const nx = dx / dist
          const ny = Math.max(0.2, dy / dist) // Bias upward for bounce feel
          const nz = dz / dist
          
          // Relative velocity (Ball - Player)
          // We assume player velocity is available from ref, else 0
          const playerVx = localPlayerRef.current.userData?.velocity?.x || 0
          const playerVz = localPlayerRef.current.userData?.velocity?.z || 0
          
          const relVx = velocity.current.x - playerVx
          const relVz = velocity.current.z - playerVz
          
          // Impulse calculation (simplified elastic collision)
          // Ball mass ~3, Player mass ~infinite (kinematic)
          const restitution = 0.8
          const impulseStrength = 1.5 // Boost factor for game feel
          
          // Reflect relative velocity along normal
          const dotRel = relVx * nx + velocity.current.y * ny + relVz * nz
          
          if (dotRel < 0) {
             const j = -(1 + restitution) * dotRel
             
             velocity.current.x += j * nx * impulseStrength
             velocity.current.y += j * ny * impulseStrength + 2 // Add vertical pop
             velocity.current.z += j * nz * impulseStrength
             
             // Add player velocity transfer (friction/grip)
             velocity.current.x += playerVx * 0.5
             velocity.current.z += playerVz * 0.5
          }
          
          // Push ball out to prevent tunneling
          const overlap = collisionRadius - dist
          targetPos.current.x += nx * overlap
          targetPos.current.z += nz * overlap
        }
      }
    }

    // 4. Interpolation: Smoothly move visual toward target
    // Use adaptive lerp based on distance (snap if too far)
    const distance = groupRef.current.position.distanceTo(targetPos.current)
    
    if (distance > 10) {
      // Snap to position if too far (likely reconnect or major desync)
      groupRef.current.position.copy(targetPos.current)
    } else {
      // Tuned for 60Hz updates (smoother)
      const lerpFactor = 1 - Math.exp(-10 * delta)
      groupRef.current.position.lerp(targetPos.current, lerpFactor)
    }
    
    groupRef.current.quaternion.slerp(targetRot.current, 1 - Math.exp(-10 * delta))
    
    // 5. Simple floor collision for visual prediction
    if (groupRef.current.position.y < 0.8) {
      groupRef.current.position.y = 0.8
      velocity.current.y = Math.abs(velocity.current.y) * 0.5 // Bounce
    }

    // 6. Apply velocity damping (matches server linearDamping 1.5)
    velocity.current.multiplyScalar(1 - 1.5 * delta)
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
