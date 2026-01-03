import React, { useRef, useEffect, useImperativeHandle, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { RigidBody, useRapier } from '@react-three/rapier'
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
  const { setBallState, onGoal, players, possession, setPossession } = props
  const rigidBodyRef = useRef()
  const lastUpdate = useRef(0)
  const lastGoalTime = useRef(0)
  const currentBodyType = useRef(null)
  
  useImperativeHandle(ref, () => rigidBodyRef.current)

  useFrame((state) => {
    if (!rigidBodyRef.current) return
    
    const now = state.clock.getElapsedTime()
    const translation = rigidBodyRef.current.translation()
    const linvel = rigidBodyRef.current.linvel()
    const rotation = rigidBodyRef.current.rotation()

    // 1. Possession Logic
    let closestPlayerId = null
    let minDistanceSq = 9.0 // 3.0m range
    let closestPlayerPos = null
    let closestPlayerRot = null
    let closestPlayerEffects = null

    players.forEach(player => {
      const playerPos = player.getState('pos')
      if (playerPos && playerPos[1] < 1.0) { // On ground
        const dx = translation.x - playerPos[0]
        const dz = translation.z - playerPos[2]
        const distSq = dx * dx + dz * dz
        
        if (distSq < minDistanceSq) {
          minDistanceSq = distSq
          closestPlayerId = player.id
          closestPlayerPos = playerPos
          closestPlayerRot = player.getState('rot')
          closestPlayerEffects = { giant: player.getState('giant') }
        }
      }
    })

    const possessionRange = closestPlayerEffects?.giant ? 2.5 : 1.0
    if (minDistanceSq < possessionRange * possessionRange && closestPlayerId) {
      const dx = closestPlayerPos[0] - translation.x
      const dz = closestPlayerPos[2] - translation.z
      const angleToBall = Math.atan2(-dx, -dz)
      let angleDiff = angleToBall - closestPlayerRot
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2
      
      if (Math.abs(angleDiff) < Math.PI / 2.5) {
        if (possession !== closestPlayerId) setPossession(closestPlayerId, true)
      }
    } else if (possession !== null) {
      setPossession(null, true)
    }

    // 2. Dribbling Logic
    if (possession !== null) {
      if (currentBodyType.current !== 3) {
        rigidBodyRef.current.setBodyType(3, true) // KinematicPosition
        currentBodyType.current = 3
      }
      
      const possessingPlayer = players.find(p => p.id === possession)
      if (possessingPlayer) {
        const pPos = possessingPlayer.getState('pos')
        const pRot = possessingPlayer.getState('rot')
        if (pPos && pRot !== undefined) {
          const targetX = pPos[0] + Math.sin(pRot) * 0.5
          const targetZ = pPos[2] + Math.cos(pRot) * 0.5
          const targetY = pPos[1] + 0.1 + Math.sin(now * 10) * 0.05
          
          const target = new THREE.Vector3(targetX, targetY, targetZ)
          const currentPos = new THREE.Vector3(translation.x, translation.y, translation.z)
          currentPos.lerp(target, 1 - Math.exp(-15 * state.delta))
          rigidBodyRef.current.setNextKinematicTranslation(currentPos)
        }
      } else {
        setPossession(null, true)
      }
    } else {
      if (currentBodyType.current !== 0) {
        rigidBodyRef.current.setBodyType(0, true) // Dynamic
        currentBodyType.current = 0
      }
    }

    // 3. Goal Detection
    if (now - lastGoalTime.current > 5) {
      if (Math.abs(translation.x) > 11.3 && Math.abs(translation.z) < 2.3 && translation.y < 4) {
        if (possession !== null) setPossession(null, true)
        lastGoalTime.current = now
        onGoal(translation.x > 0 ? 'red' : 'blue')
      }
    }

    // 4. Sync State (Throttled to ~30Hz)
    if (now - lastUpdate.current > 0.033) {
      lastUpdate.current = now
      const isMoving = Math.abs(linvel.x) > 0.01 || Math.abs(linvel.y) > 0.01 || Math.abs(linvel.z) > 0.01 || possession !== null
      
      if (isMoving || now - lastUpdate.current > 1.0) { // Sync at least every second
        setBallState({
          position: [translation.x, translation.y, translation.z],
          velocity: [linvel.x, linvel.y, linvel.z],
          rotation: [rotation.x, rotation.y, rotation.z, rotation.w],
          timestamp: Date.now()
        }, possession !== null) // Reliable sync during possession
      }
    }

    // 5. Limit Angular Velocity
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
