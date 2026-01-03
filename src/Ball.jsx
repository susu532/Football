import React, { useRef, useEffect, useImperativeHandle, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { RigidBody } from '@react-three/rapier'
import { useSpring, a } from '@react-spring/three'
import { RPC } from 'playroomkit'

// Soccer Ball Visual Component
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

// Host Ball: Handles physics simulation, possession, and goal detection
export const HostBall = React.forwardRef(function HostBall(props, ref) {
  const { setBallState, onGoal, players } = props
  const rigidBodyRef = useRef()
  const lastUpdate = useRef(0)
  const lastGoalTime = useRef(0)
  
  useImperativeHandle(ref, () => rigidBodyRef.current)

  useFrame((state) => {
    if (!rigidBodyRef.current) return
    
    const now = state.clock.getElapsedTime()
    const translation = rigidBodyRef.current.translation()
    const linvel = rigidBodyRef.current.linvel()
    const rotation = rigidBodyRef.current.rotation()

    // 1. Goal Detection
    if (now - lastGoalTime.current > 5) {
      if (Math.abs(translation.x) > 11.3 && Math.abs(translation.z) < 2.3 && translation.y < 4) {
        lastGoalTime.current = now
        onGoal(translation.x > 0 ? 'red' : 'blue')
      }
    }

    // 2. Sync State (Throttled to ~30Hz)
    if (now - lastUpdate.current > 0.033) {
      lastUpdate.current = now
      const isMoving = Math.abs(linvel.x) > 0.01 || Math.abs(linvel.y) > 0.01 || Math.abs(linvel.z) > 0.01
      
      if (isMoving || now - lastUpdate.current > 1.0) { // Sync at least every second
        setBallState({
          position: [translation.x, translation.y, translation.z],
          velocity: [linvel.x, linvel.y, linvel.z],
          rotation: [rotation.x, rotation.y, rotation.z, rotation.w],
          timestamp: Date.now()
        }, false)
      }
    }

    // 3. Limit Angular Velocity
    const angvel = rigidBodyRef.current.angvel()
    const maxAv = 15.0
    const avSq = angvel.x**2 + angvel.y**2 + angvel.z**2
    if (avSq > maxAv**2) {
      const scale = maxAv / Math.sqrt(avSq)
      rigidBodyRef.current.setAngvel({ x: angvel.x * scale, y: angvel.y * scale, z: angvel.z * scale }, true)
    }
  })

  return (
    <RigidBody 
      ref={rigidBodyRef} 
      colliders="ball" 
      restitution={0.7} 
      friction={0.5} 
      linearDamping={0.5} 
      angularDamping={0.5} 
      mass={0.5}
      type="dynamic"
      position={[0, 2, 0]}
      ccd
    >
      <SoccerBall />
    </RigidBody>
  )
})

// Client Ball: Visual-only, interpolates between snapshots
export const ClientBall = React.forwardRef(function ClientBall({ ballState }, ref) {
  const groupRef = useRef()
  const targetPos = useRef(new THREE.Vector3(0, 2, 0))
  const targetRot = useRef(new THREE.Quaternion())
  const velocity = useRef(new THREE.Vector3(0, 0, 0))
  
  useImperativeHandle(ref, () => groupRef.current)

  useEffect(() => {
    if (ballState) {
      targetPos.current.set(...ballState.position)
      targetRot.current.set(...ballState.rotation)
      velocity.current.set(...ballState.velocity)
    }
  }, [ballState])

  useFrame((_, delta) => {
    if (!groupRef.current) return

    // 1. Prediction: Move target position based on velocity
    targetPos.current.addScaledVector(velocity.current, delta)

    // 2. Interpolation: Smoothly move visual ball towards target
    const lerpFactor = 1 - Math.exp(-15 * delta)
    groupRef.current.position.lerp(targetPos.current, lerpFactor)
    groupRef.current.quaternion.slerp(targetRot.current, 1 - Math.exp(-10 * delta))
    
    // 3. Simple floor collision for prediction
    if (groupRef.current.position.y < 0.22) {
      groupRef.current.position.y = 0.22
      velocity.current.y *= -0.5 // Simple bounce
    }
  })

  return (
    <group ref={groupRef}>
      <SoccerBall />
    </group>
  )
})
