// Ball.jsx - Client ball visual with interpolation for Colyseus
// Server-authoritative: Client NEVER moves the ball, only displays

import React, { useRef, useEffect, useImperativeHandle, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useSpring, a } from '@react-spring/three'

// Soccer Ball Visual Component
export function SoccerBall({ radius = 0.8, ref, onKickFeedback }) {
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
        child.castShadow = true
        child.receiveShadow = true
      }
    })
    return cloned
  }, [scene])

  return (
    <a.primitive 
      ref={ref}
      object={clonedBall} 
      scale={spring.scale} 
    />
  )
}

// ClientBallVisual - Visual-only ball with smooth interpolation from server state
// Receives snapshots from Colyseus, interpolates smoothly
export function ClientBallVisual({ ballState, onKickMessage, ref }) {
  const groupRef = useRef()
  const targetPos = useRef(new THREE.Vector3(0, 2, 0))
  const targetRot = useRef(new THREE.Quaternion())
  const velocity = useRef(new THREE.Vector3(0, 0, 0))
  const kickFeedback = useRef(null)
  const lastUpdateTime = useRef(0)
  
  useImperativeHandle(ref, () => groupRef.current)

  // Update targets when new snapshot arrives
  useEffect(() => {
    if (ballState) {
      targetPos.current.set(ballState.x, ballState.y, ballState.z)
      velocity.current.set(ballState.vx || 0, ballState.vy || 0, ballState.vz || 0)
      
      if (ballState.rx !== undefined) {
        targetRot.current.set(ballState.rx, ballState.ry, ballState.rz, ballState.rw)
      }
      
      lastUpdateTime.current = Date.now()
    }
  }, [ballState])

  // Listen for kick message for visual feedback and prediction
  useEffect(() => {
    if (onKickMessage) {
      const unsubscribe = onKickMessage('ball-kicked', (data) => {
        // Visual feedback (scale pop)
        if (kickFeedback.current) {
          kickFeedback.current()
        }

        // Prediction: If we kicked it, or if we want to predict others' kicks
        // We can apply a temporary visual impulse to the ball
        // This makes it feel instant even before the server snapshot arrives
        if (data.impulse) {
           velocity.current.x += data.impulse.x * 0.1
           velocity.current.y += data.impulse.y * 0.1
           velocity.current.z += data.impulse.z * 0.1
        }
      })
      return unsubscribe
    }
  }, [onKickMessage])

  useFrame((state, delta) => {
    if (!groupRef.current) return

    // 1. Prediction: Advance target position using velocity
    // Helps smooth out the gap between snapshots
    targetPos.current.addScaledVector(velocity.current, delta)
    
    // Apply simple gravity to prediction
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

    // 4. Apply velocity damping
    velocity.current.multiplyScalar(1 - 0.3 * delta)
  })

  return (
    <group ref={groupRef} position={[0, 2, 0]}>
      <SoccerBall onKickFeedback={kickFeedback} />
    </group>
  )
}
