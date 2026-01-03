// GamePhysics.jsx - Host-only physics world controller
// Contains all Rapier physics bodies and handles ball+player collisions

import React, { useRef, useEffect, useCallback, useImperativeHandle } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Physics as RapierPhysics, RigidBody, CuboidCollider, CylinderCollider, BallCollider } from '@react-three/rapier'
import { RPC, usePlayerState } from 'playroomkit'
import { SoccerBall } from './Ball'

// Constants
const BALL_MASS = 0.45
const BALL_RESTITUTION = 0.8
const BALL_FRICTION = 0.5
const BALL_DAMPING = 0.3
const SYNC_RATE = 1 / 30 // 30Hz
const GOAL_COOLDOWN = 5 // seconds

// HostBallController - Dynamic ball with collision-based kicks
export function HostBallController(props) {
  const { setBallState, onGoal, players, ref } = props
  const rigidBodyRef = useRef()
  const lastSyncTime = useRef(0)
  const lastGoalTime = useRef(0)

  useImperativeHandle(ref, () => rigidBodyRef.current)

  // Handle player-kick RPC
  useEffect(() => {
    const unsubscribe = RPC.register('player-kick', (data) => {
      if (!rigidBodyRef.current) return

      const { impulse, position, playerId } = data
      const ballPos = rigidBodyRef.current.translation()

      // Validate proximity (player must be close to ball)
      const dx = ballPos.x - position[0]
      const dy = ballPos.y - position[1]
      const dz = ballPos.z - position[2]
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

      if (dist < 2.0) {
        // Apply kick impulse
        rigidBodyRef.current.applyImpulse(
          { x: impulse[0], y: impulse[1], z: impulse[2] },
          true
        )

        // Broadcast visual feedback
        RPC.call('ball-kicked', {}, RPC.Mode.ALL)

        // Force immediate sync
        syncBallState(true)
      }
    })

    return () => unsubscribe()
  }, [setBallState])

  const syncBallState = useCallback((reliable = false) => {
    if (!rigidBodyRef.current) return

    const translation = rigidBodyRef.current.translation()
    const linvel = rigidBodyRef.current.linvel()
    const rotation = rigidBodyRef.current.rotation()

    setBallState({
      position: [translation.x, translation.y, translation.z],
      velocity: [linvel.x, linvel.y, linvel.z],
      rotation: [rotation.x, rotation.y, rotation.z, rotation.w],
      timestamp: Date.now()
    }, reliable)
  }, [setBallState])

  useFrame((state) => {
    if (!rigidBodyRef.current) return

    const now = state.clock.getElapsedTime()
    const translation = rigidBodyRef.current.translation()
    const linvel = rigidBodyRef.current.linvel()

    // Goal detection
    if (now - lastGoalTime.current > GOAL_COOLDOWN) {
      if (Math.abs(translation.x) > 11.3 && Math.abs(translation.z) < 2.3 && translation.y < 4) {
        lastGoalTime.current = now
        onGoal(translation.x > 0 ? 'red' : 'blue')
      }
    }

    // Throttled sync (30Hz)
    if (now - lastSyncTime.current >= SYNC_RATE) {
      const isMoving = Math.abs(linvel.x) > 0.01 || Math.abs(linvel.y) > 0.01 || Math.abs(linvel.z) > 0.01

      if (isMoving) {
        lastSyncTime.current = now
        syncBallState(false)
      }
    }

    // Limit angular velocity
    const angvel = rigidBodyRef.current.angvel()
    const maxAv = 15.0
    const avSq = angvel.x ** 2 + angvel.y ** 2 + angvel.z ** 2
    if (avSq > maxAv ** 2) {
      const scale = maxAv / Math.sqrt(avSq)
      rigidBodyRef.current.setAngvel(
        { x: angvel.x * scale, y: angvel.y * scale, z: angvel.z * scale },
        true
      )
    }
  })

  return (
    <RigidBody
      ref={rigidBodyRef}
      colliders="ball"
      restitution={BALL_RESTITUTION}
      friction={BALL_FRICTION}
      linearDamping={BALL_DAMPING}
      angularDamping={BALL_DAMPING}
      mass={BALL_MASS}
      type="dynamic"
      position={[0, 2, 0]}
      ccd
      name="ball"
    >
      <SoccerBall />
    </RigidBody>
  )
}

// HostPlayerBody - Kinematic body for each player (for ball collision)
export function HostPlayerBody({ player, localPlayerRef, isLocalPlayer }) {
  const rigidBodyRef = useRef()
  
  // Get remote player state
  const [position] = usePlayerState(player, 'pos', [0, 1, 0])
  const [velocity] = usePlayerState(player, 'vel', [0, 0, 0])
  
  const targetPos = useRef(new THREE.Vector3(...position))

  useEffect(() => {
    targetPos.current.set(position[0], position[1], position[2])
  }, [position])

  useFrame((_, delta) => {
    if (!rigidBodyRef.current) return

    let currentPos
    
    if (isLocalPlayer && localPlayerRef?.current) {
      // Use local player's actual position
      currentPos = localPlayerRef.current.position
    } else {
      // Interpolate remote player position
      const rb = rigidBodyRef.current
      const current = rb.translation()
      
      // Smooth interpolation toward target
      const lerpFactor = 1 - Math.exp(-15 * delta)
      currentPos = new THREE.Vector3(
        THREE.MathUtils.lerp(current.x, targetPos.current.x, lerpFactor),
        THREE.MathUtils.lerp(current.y, targetPos.current.y, lerpFactor),
        THREE.MathUtils.lerp(current.z, targetPos.current.z, lerpFactor)
      )
    }

    rigidBodyRef.current.setNextKinematicTranslation(currentPos)
  })

  return (
    <RigidBody
      ref={rigidBodyRef}
      type="kinematicPosition"
      colliders={false}
      name={`player-${player.id}`}
    >
      <CuboidCollider args={[0.4, 0.8, 0.4]} position={[0, 0.8, 0]} />
    </RigidBody>
  )
}

// HostArena - Static collision geometry
export function HostArena() {
  const wallHeight = 10
  const wallThickness = 2
  const pitchWidth = 30
  const pitchDepth = 20
  const goalWidth = 6

  return (
    <RigidBody type="fixed" friction={0.2} restitution={0.6}>
      {/* Ground */}
      <CuboidCollider args={[pitchWidth / 2, 0.25, pitchDepth / 2]} position={[0, -0.25, 0]} friction={1.0} />

      {/* Back walls (Z axis) */}
      <CuboidCollider 
        args={[(pitchWidth + wallThickness * 2) / 2, wallHeight / 2, wallThickness / 2]} 
        position={[0, wallHeight / 2, -pitchDepth / 2 - wallThickness / 2]} 
      />
      <CuboidCollider 
        args={[(pitchWidth + wallThickness * 2) / 2, wallHeight / 2, wallThickness / 2]} 
        position={[0, wallHeight / 2, pitchDepth / 2 + wallThickness / 2]} 
      />

      {/* Side walls with goal gaps */}
      <CuboidCollider args={[wallThickness / 2, wallHeight / 2, 7 / 2]} position={[-pitchWidth / 2 - wallThickness / 2, wallHeight / 2, -6.5]} />
      <CuboidCollider args={[wallThickness / 2, wallHeight / 2, 7 / 2]} position={[-pitchWidth / 2 - wallThickness / 2, wallHeight / 2, 6.5]} />
      <CuboidCollider args={[wallThickness / 2, wallHeight / 2, 7 / 2]} position={[pitchWidth / 2 + wallThickness / 2, wallHeight / 2, -6.5]} />
      <CuboidCollider args={[wallThickness / 2, wallHeight / 2, 7 / 2]} position={[pitchWidth / 2 + wallThickness / 2, wallHeight / 2, 6.5]} />

      {/* Goal back walls */}
      <CuboidCollider args={[wallThickness / 2, wallHeight / 2, (goalWidth + 2) / 2]} position={[-13 - wallThickness, wallHeight / 2, 0]} />
      <CuboidCollider args={[wallThickness / 2, wallHeight / 2, (goalWidth + 2) / 2]} position={[13 + wallThickness, wallHeight / 2, 0]} />

      {/* Goal posts */}
      <CylinderCollider args={[2, 0.06]} position={[-10.8, 2, -2.5]} restitution={0.8} />
      <CylinderCollider args={[2, 0.06]} position={[-10.8, 2, 2.5]} restitution={0.8} />
      <CylinderCollider args={[2, 0.06]} position={[10.8, 2, -2.5]} restitution={0.8} />
      <CylinderCollider args={[2, 0.06]} position={[10.8, 2, 2.5]} restitution={0.8} />

      {/* Goal crossbars */}
      <CylinderCollider args={[3, 0.06]} position={[-10.8, 4, 0]} rotation={[0, 0, Math.PI / 2]} restitution={0.8} />
      <CylinderCollider args={[3, 0.06]} position={[10.8, 4, 0]} rotation={[0, 0, Math.PI / 2]} restitution={0.8} />

      {/* Ceiling */}
      <CuboidCollider args={[pitchWidth / 2, 0.1, pitchDepth / 2]} position={[0, wallHeight, 0]} />

      {/* Goal side barriers */}
      <CuboidCollider args={[2, 6.5, 0.1]} position={[13, 0, -2.4]} />
      <CuboidCollider args={[2, 6.5, 0.1]} position={[-13, 0, -2.4]} />
      <CuboidCollider args={[2, 6.5, 0.1]} position={[13, 0, 2.4]} />
      <CuboidCollider args={[2, 6.5, 0.1]} position={[-13, 0, 2.4]} />

      {/* Goal area blockers */}
      <CuboidCollider args={[2.5, 4.5, 2.75]} position={[10.8, 8.7, 0]} />
      <CuboidCollider args={[2.5, 4.5, 2.75]} position={[-10.8, 8.7, 0]} />
    </RigidBody>
  )
}

// Main GamePhysics component - renders physics world on host only
export function GamePhysics({ 
  isHost, 
  players, 
  me,
  localPlayerRef,
  setBallState, 
  onGoal,
  ballRef 
}) {
  if (!isHost) return null

  return (
    <RapierPhysics gravity={[0, -20, 0]}>
      <HostArena />
      <HostBallController 
        ref={ballRef}
        setBallState={setBallState} 
        onGoal={onGoal}
        players={players}
      />
      {players.map(player => (
        <HostPlayerBody
          key={player.id}
          player={player}
          localPlayerRef={me && player.id === me.id ? localPlayerRef : null}
          isLocalPlayer={me && player.id === me.id}
        />
      ))}
    </RapierPhysics>
  )
}

export default GamePhysics
