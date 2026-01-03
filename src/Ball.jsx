import React, { useRef, useEffect, useImperativeHandle } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { RigidBody, useRapier } from '@react-three/rapier'
import { useSpring, a } from '@react-spring/three'
import { RPC } from 'playroomkit'

// Soccer Ball (using GLB model)
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

  const clonedBall = React.useMemo(() => {
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

export const RapierBall = React.forwardRef(function RapierBall(props, ref) {
  const { setBallState, onGoal, players, possession, setPossession } = props
  const rigidBodyRef = useRef()
  
  useImperativeHandle(ref, () => rigidBodyRef.current)

  const activeRef = rigidBodyRef
  const currentBodyType = useRef(null) // Track current body type to avoid redundant calls
  
  const lastUpdate = useRef(0)
  const lastGoalTime = useRef(0)
  const { world } = useRapier()
  const ballVisualRef = useRef()

  useFrame((state) => {
    if (!activeRef.current || !world) return
    
    const now = state.clock.getElapsedTime()
    const translation = activeRef.current.translation()
    const linvel = activeRef.current.linvel()
    
    let closestPlayerId = null
    let minDistanceSq = 3.0 * 3.0 // Proximity range: 3.0 meters (possession catch: 1.0m)
    let closestPlayerPos = null
    let closestPlayerRot = null
    let closestPlayerEffects = null

    // 1. Possession Detection & Transfer Logic
    players.forEach(player => {
      const playerPos = player.getState('pos')
      if (playerPos) {
        const dx = translation.x - playerPos[0]
        const dz = translation.z - playerPos[2]
        const distSq = dx * dx + dz * dz
        
        // We only care about players on the ground (to avoid catching mid-air)
        if (playerPos[1] < 1.0) { 
          if (distSq < minDistanceSq) {
             minDistanceSq = distSq
             closestPlayerId = player.id
             closestPlayerPos = playerPos
             closestPlayerRot = player.getState('rot')
             closestPlayerEffects = {
               giant: player.getState('giant')
             }
          }
        }
      }
    })
    
    // Check if closest player is close enough to gain possession
    const possessionRange = closestPlayerEffects?.giant ? 2.5 : 1.0 
    
    if (minDistanceSq < possessionRange * possessionRange && closestPlayerId) {
       // Check for angle: player must be facing the ball (or slightly off)
       const dx = closestPlayerPos[0] - translation.x
       const dz = closestPlayerPos[2] - translation.z
       const angleToBall = Math.atan2(-dx, -dz) // Angle from player to ball
       const playerRotation = closestPlayerRot
       
       // Calculate angle difference (-PI to PI)
       let angleDiff = angleToBall - playerRotation
       while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
       while (angleDiff < -Math.PI) angleDiff += Math.PI * 2
       
       const maxAngle = Math.PI / 2.5 // Must be within ~72 degrees forward cone
       
       if (Math.abs(angleDiff) < maxAngle) {
          // Player gains possession
          if (possession !== closestPlayerId) {
            setPossession(closestPlayerId, true)
          }
       }
    } else {
       // If the possessing player is now out of range, release the ball
       if (possession !== null) {
          setPossession(null, true)
       }
    }
    
    // 2. Possession Dribbling Logic
    if (possession !== null) {
      // Switch to Kinematic only if needed
      if (currentBodyType.current !== 0) {
        activeRef.current.setBodyType(0, true) // Kinematic
        currentBodyType.current = 0
      }
      
      activeRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
      activeRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true)
      
      const possessingPlayer = players.find(p => p.id === possession)
      if (possessingPlayer) {
        const pPos = possessingPlayer.getState('pos')
        const pRot = possessingPlayer.getState('rot')
        
        if (pPos && pRot !== undefined) {
          const rotation = pRot
          const distanceInFront = 0.5 // Dribble distance
          
          // Calculate target position in front of player
          const targetX = pPos[0] + Math.sin(rotation) * distanceInFront
          const targetZ = pPos[2] + Math.cos(rotation) * distanceInFront
          const targetY = pPos[1] + 0.1 // Ball slightly off ground
          
          // Add subtle dribble bounce (simulated)
          const bounceFactor = 0.05
          const bounce = Math.sin(now * 10) * bounceFactor
          
          const target = new THREE.Vector3(targetX, targetY + bounce, targetZ)
          
          // Smoothly move the kinematic body (Frame-rate independent lerp)
          const currentPos = new THREE.Vector3(translation.x, translation.y, translation.z)
          const lerpFactor = 1 - Math.exp(-15 * state.delta)
          currentPos.lerp(target, lerpFactor) 
 
          activeRef.current.setNextKinematicTranslation(currentPos)
 
          // Sync ball state (Throttled to 40Hz)
          if (now - lastUpdate.current > 0.025) {
            lastUpdate.current = now
            const currentRot = activeRef.current.rotation()
            setBallState({
               position: [currentPos.x, currentPos.y, currentPos.z],
               velocity: [0, 0, 0],
               rotation: [currentRot.x, currentRot.y, currentRot.z, currentRot.w]
            }, true) // reliable for possession
          }
        }
      } else {
        // Possessing player left or is missing, release ball
        setPossession(null, true)
      }
    } else {
      // Dynamic Mode (Not in possession)
      // Switch to Dynamic only if needed
      if (currentBodyType.current !== 1) {
        activeRef.current.setBodyType(1, true) // Dynamic
        currentBodyType.current = 1
      }
 
      // 3. Sync to Playroom (Dynamic Ball)
      if (now - lastUpdate.current > 0.025) { // 40Hz
        lastUpdate.current = now
        
        // Only send if moving
        if (Math.abs(linvel.x) > 0.01 || Math.abs(linvel.y) > 0.01 || Math.abs(linvel.z) > 0.01) {
           const currentRot = activeRef.current.rotation()
           setBallState({
              position: [translation.x, translation.y, translation.z],
              velocity: [linvel.x, linvel.y, linvel.z],
              rotation: [currentRot.x, currentRot.y, currentRot.z, currentRot.w]
           }, false) // unreliable
        }
      }
    }
 
    // 4. Goal Detection
    if (now - lastGoalTime.current > 5) {
      if (Math.abs(translation.x) > 11.3 && Math.abs(translation.z) < 2.3 && translation.y < 4) {
        // Release possession before scoring
        if (possession !== null) setPossession(null, true)
        
        const teamScored = translation.x > 0 ? 'red' : 'blue'
        lastGoalTime.current = now
        onGoal(teamScored)
      }
    }
    
    // 5. Limit angular velocity
    const angvel = activeRef.current.angvel()
    const maxAv = 15.0
    const avSq = angvel.x**2 + angvel.y**2 + angvel.z**2
    if (avSq > maxAv**2) {
        const scale = maxAv / Math.sqrt(avSq)
        activeRef.current.setAngvel({ x: angvel.x * scale, y: angvel.y * scale, z: angvel.z * scale }, true)
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
      type={possession !== null ? 'kinematicPosition' : 'dynamic'}
      position={[0, 2, 0]}
      ccd
    >
      <group ref={ballVisualRef}>
        <SoccerBall />
      </group>
    </RigidBody>
  )
})

export const SyncedBall = React.forwardRef(function SyncedBall(props, ref) {
  const { ballState } = props
  const groupRef = useRef()
  
  useImperativeHandle(ref, () => groupRef.current)

  const targetQuaternion = useRef(new THREE.Quaternion())

  useEffect(() => {
    if (ballState && ballState.rotation) {
      targetQuaternion.current.set(...ballState.rotation)
    }
  }, [ballState])

  useFrame((_, delta) => {
    if (groupRef.current && ballState) {
      // Interpolate position (Frame-rate independent)
      const lerpFactor = 1 - Math.exp(-15 * delta)
      groupRef.current.position.lerp(new THREE.Vector3(...ballState.position), lerpFactor)

      // Slerp for rotation
      const slerpFactor = 1 - Math.exp(-10 * delta)
      groupRef.current.quaternion.slerp(targetQuaternion.current, slerpFactor)
    }
  })

  return (
    <group ref={groupRef}>
      <SoccerBall />
    </group>
  )
})
