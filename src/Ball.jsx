// Ball.jsx - Clean separation of host physics ball and client visual ball
// Host: HostBallController in GamePhysics.jsx handles physics
// Client: ClientBallVisual here handles interpolation only

import React, { useRef, useEffect, useImperativeHandle, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useSpring, a } from '@react-spring/three'
import { RPC } from 'playroomkit'

// Soccer Ball Visual Component (shared by host and client)
export const SoccerBall = React.forwardRef(function SoccerBall({ radius = 0.22 }, ref) {
  const { scene } = useGLTF('/models/soccer_ball.glb')
  
  const [spring, api] = useSpring(() => ({
    scale: 5,
    config: { tension: 400, friction: 10 }
  }))

  useEffect(() => {
    const unsubscribe = RPC.register('ball-kicked', () => {
      api.start({
        from: { scale: 7 },
        to: { scale: 5 }
      })
    })
    return () => unsubscribe()
  }, [api])

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
})

// ClientBallVisual - Visual-only ball with smooth interpolation
// Receives snapshots from host, predicts using velocity
export const ClientBallVisual = React.forwardRef(function ClientBallVisual({ ballState }, ref) {
  const groupRef = useRef()
  const targetPos = useRef(new THREE.Vector3(0, 2, 0))
  const targetRot = useRef(new THREE.Quaternion())
  const velocity = useRef(new THREE.Vector3(0, 0, 0))
  const lastSnapshotTime = useRef(0)
  
  useImperativeHandle(ref, () => groupRef.current)

  // Update targets when new snapshot arrives
  useEffect(() => {
    if (ballState && ballState.position) {
      targetPos.current.set(...ballState.position)
      velocity.current.set(...(ballState.velocity || [0, 0, 0]))
      
      if (ballState.rotation) {
        targetRot.current.set(...ballState.rotation)
      }
      
      lastSnapshotTime.current = ballState.timestamp || Date.now()
    }
  }, [ballState])

  useFrame((state, delta) => {
    if (!groupRef.current) return

    // 1. Prediction: Advance target position using velocity
    // This helps smooth out the gap between snapshots
    targetPos.current.addScaledVector(velocity.current, delta)
    
    // Apply simple gravity to prediction
    if (targetPos.current.y > 0.22) {
      velocity.current.y -= 20 * delta
    }

    // 2. Interpolation: Smoothly move visual toward target
    const lerpFactor = 1 - Math.exp(-15 * delta)
    groupRef.current.position.lerp(targetPos.current, lerpFactor)
    groupRef.current.quaternion.slerp(targetRot.current, 1 - Math.exp(-10 * delta))
    
    // 3. Simple floor collision for visual prediction
    if (groupRef.current.position.y < 0.22) {
      groupRef.current.position.y = 0.22
      velocity.current.y = Math.abs(velocity.current.y) * 0.5 // Bounce
    }

    // 4. Apply velocity damping
    velocity.current.multiplyScalar(1 - 0.3 * delta)
  })

  return (
    <group ref={groupRef} position={[0, 2, 0]}>
      <SoccerBall />
    </group>
  )
})

// Re-export for backward compatibility during transition
export { ClientBallVisual as ClientBall }
