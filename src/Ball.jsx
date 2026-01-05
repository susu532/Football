// Ball.jsx - Client ball visual with interpolation for Colyseus
// Server-authoritative: Client NEVER moves the ball, only displays

import React, { useRef, useEffect, useImperativeHandle, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
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
        // Smooth shading
        if (child.geometry) {
          child.geometry.computeVertexNormals()
        }

        // Material fixes
        if (child.material) {
          child.material = child.material.clone()
          // Ensure textures are filtered well
          if (child.material.map) {
            child.material.map.anisotropy = 16
            child.material.map.minFilter = THREE.LinearMipmapLinearFilter
            child.material.map.magFilter = THREE.LinearFilter
            child.material.map.needsUpdate = true
          }
          child.material.roughness = 0.8
          child.material.metalness = 0.1
          child.material.envMapIntensity = 0.2
          child.material.flatShading = false
          child.material.needsUpdate = true
        }

        child.castShadow = true
        child.receiveShadow = true
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
export const ClientBallVisual = React.forwardRef(({ ballState, onKickMessage }, ref) => {
  const groupRef = useRef()
  const targetPos = useRef(new THREE.Vector3(0, 2, 0))
  const targetRot = useRef(new THREE.Quaternion())
  const velocity = useRef(new THREE.Vector3(0, 0, 0))
  const kickFeedback = useRef(null)
  const lastUpdateTime = useRef(0)
  
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

    // 2. Interpolation: Smoothly move visual toward target
    // Use adaptive lerp based on distance (snap if too far)
    const distance = groupRef.current.position.distanceTo(targetPos.current)
    
    if (distance > 10) {
      // Snap to position if too far (likely reconnect or major desync)
      groupRef.current.position.copy(targetPos.current)
    } else {
      const lerpFactor = 1 - Math.exp(-15 * delta)
      groupRef.current.position.lerp(targetPos.current, lerpFactor)
    }
    
    groupRef.current.quaternion.slerp(targetRot.current, 1 - Math.exp(-10 * delta))
    
    // 3. Simple floor collision for visual prediction
    if (groupRef.current.position.y < 0.8) {
      groupRef.current.position.y = 0.8
      velocity.current.y = Math.abs(velocity.current.y) * 0.5 // Bounce
    }

    // 4. Apply velocity damping (matches server linearDamping 1.5)
    velocity.current.multiplyScalar(1 - 1.5 * delta)
  })

  return (
    <group ref={groupRef} position={[0, 2, 0]}>
      <SoccerBall onKickFeedback={kickFeedback} />
    </group>
  )
})
ClientBallVisual.displayName = 'ClientBallVisual'
