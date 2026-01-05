// Ball.jsx - Client ball visual with interpolation for Colyseus
// Server-authoritative: Client NEVER moves the ball, only displays

import React, { useRef, useEffect, useImperativeHandle, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useSpring, a } from '@react-spring/three'
import { SnapshotBuffer } from './SnapshotBuffer'

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
      ref={ref}
      object={clonedBall} 
      scale={spring.scale} 
    />
  )
}

// ClientBallVisual - Visual-only ball with smooth interpolation from server state
// Receives snapshots from Colyseus, interpolates smoothly
export function ClientBallVisual({ ballState, serverTimestamp, onKickMessage, ref }) {
  const groupRef = useRef()
  const buffer = useRef(new SnapshotBuffer(30))
  const lastServerTime = useRef(0)
  const timeOffset = useRef(null)
  const kickFeedback = useRef(null)
  
  // Visual prediction offset (for instant responsiveness)
  const visualOffset = useRef(new THREE.Vector3())
  const predictionVelocity = useRef(new THREE.Vector3())
  
  useImperativeHandle(ref, () => groupRef.current)

  // Listen for kick message for visual feedback and prediction
  useEffect(() => {
    if (onKickMessage) {
      const unsubscribe = onKickMessage('ball-kicked', (data) => {
        // Visual feedback (scale pop)
        if (kickFeedback.current) {
          kickFeedback.current()
        }

        // Prediction: Apply instant visual velocity that decays
        if (data.impulse) {
           predictionVelocity.current.set(
             data.impulse.x,
             data.impulse.y,
             data.impulse.z
           ).multiplyScalar(0.1) // Scale down for visual offset
        }
      })
      return unsubscribe
    }
  }, [onKickMessage])

  useFrame((state, delta) => {
    if (!groupRef.current || !ballState) return

    // 1. Add to buffer
    if (serverTimestamp && serverTimestamp !== lastServerTime.current) {
      lastServerTime.current = serverTimestamp
      
      const currentOffset = Date.now() - serverTimestamp
      if (timeOffset.current === null || currentOffset < timeOffset.current) {
        timeOffset.current = currentOffset
      }

      buffer.current.add({
        x: ballState.x,
        y: ballState.y,
        z: ballState.z,
        rx: ballState.rx,
        ry: ballState.ry,
        rz: ballState.rz,
        rw: ballState.rw,
        timestamp: serverTimestamp
      })
    }

    // 2. Interpolate
    if (timeOffset.current !== null) {
      const estimatedServerTime = Date.now() - timeOffset.current
      const state = buffer.current.getInterpolatedState(estimatedServerTime)
      
      if (state) {
        // Apply prediction velocity to offset
        visualOffset.current.addScaledVector(predictionVelocity.current, delta)
        predictionVelocity.current.multiplyScalar(1 - 10 * delta) // Decay velocity
        visualOffset.current.multiplyScalar(1 - 5 * delta)        // Decay offset back to 0

        groupRef.current.position.set(
          state.x + visualOffset.current.x, 
          state.y + visualOffset.current.y, 
          state.z + visualOffset.current.z
        )
        
        if (state.rx !== undefined) {
          groupRef.current.quaternion.set(state.rx, state.ry, state.rz, state.rw)
        }
      }
    }
  })

  return (
    <group ref={groupRef} position={[0, 2, 0]}>
      <SoccerBall onKickFeedback={kickFeedback} />
    </group>
  )
}
