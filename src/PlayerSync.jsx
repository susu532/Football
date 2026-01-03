// PlayerSync.jsx - Refactored with clean host/client separation
// Host: Uses PlayerController for local player physics
// Client: Uses ClientPlayerVisual for remote player interpolation

import React, { useRef, useEffect, useImperativeHandle } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { usePlayerState } from 'playroomkit'
import CharacterSkin from './CharacterSkin'
import { PlayerController } from './PlayerController'

// LocalPlayer - Wraps PlayerController for the local player
export function LocalPlayer(props) {
  const { 
    me, 
    isHost,
    playerName = '', 
    playerTeam = '', 
    teamColor = '#888', 
    spawnPosition = [0, 1, 0], 
    powerUps = [], 
    onCollectPowerUp = null, 
    isFreeLook = null, 
    characterType = 'cat',
    onLocalInteraction = null,
    ref
  } = props
  
  const controllerRef = useRef()
  const labelRef = useRef()

  useImperativeHandle(ref, () => controllerRef.current)

  // Name label follows player
  useFrame(() => {
    if (labelRef.current && controllerRef.current) {
      labelRef.current.position.copy(controllerRef.current.position)
    }
  })

  return (
    <group>
      <PlayerController
        ref={controllerRef}
        me={me}
        isHost={isHost}
        playerName={playerName}
        playerTeam={playerTeam}
        teamColor={teamColor}
        spawnPosition={spawnPosition}
        powerUps={powerUps}
        onCollectPowerUp={onCollectPowerUp}
        isFreeLook={isFreeLook}
        characterType={characterType}
        onLocalInteraction={onLocalInteraction}
      />
      {playerName && (
        <group ref={labelRef}>
          <Html position={[0, 2.2, 0]} center distanceFactor={8}>
            <div className={`player-name-label ${playerTeam}`}>{playerName}</div>
          </Html>
        </group>
      )}
    </group>
  )
}

// ClientPlayerVisual - Visual-only remote player with smooth interpolation
export function ClientPlayerVisual(props) {
  const { player, ref } = props
  const groupRef = useRef()

  useImperativeHandle(ref, () => groupRef.current)
  
  // Get remote player state from network
  const [position] = usePlayerState(player, 'pos', [0, 1, 0])
  const [rotation] = usePlayerState(player, 'rot', 0)
  const [profile] = usePlayerState(player, 'profile', { 
    name: 'Player', 
    color: '#888', 
    team: '', 
    character: 'cat' 
  })
  const [invisible] = usePlayerState(player, 'invisible', false)
  const [giant] = usePlayerState(player, 'giant', false)

  const { name: playerName, color, team, character } = profile

  // Interpolation targets
  const targetPosition = useRef(new THREE.Vector3(...position))
  const targetRotation = useRef(rotation)
  
  // Update targets when new data arrives
  useEffect(() => {
    targetPosition.current.set(position[0], position[1], position[2])
    targetRotation.current = rotation
  }, [position, rotation])

  // Smooth interpolation each frame
  useFrame((_, delta) => {
    if (!groupRef.current) return
    
    const lambda = 20 // Interpolation speed
    
    // Position interpolation
    groupRef.current.position.x = THREE.MathUtils.damp(
      groupRef.current.position.x, 
      targetPosition.current.x, 
      lambda, 
      delta
    )
    groupRef.current.position.y = THREE.MathUtils.damp(
      groupRef.current.position.y, 
      targetPosition.current.y, 
      lambda, 
      delta
    )
    groupRef.current.position.z = THREE.MathUtils.damp(
      groupRef.current.position.z, 
      targetPosition.current.z, 
      lambda, 
      delta
    )
    
    // Rotation interpolation (handle wrapping)
    let rotDiff = targetRotation.current - groupRef.current.rotation.y
    while (rotDiff > Math.PI) rotDiff -= Math.PI * 2
    while (rotDiff < -Math.PI) rotDiff += Math.PI * 2
    groupRef.current.rotation.y += rotDiff * Math.min(1, lambda * delta)
  })

  return (
    <group ref={groupRef} position={position}>
      <CharacterSkin 
        characterType={character}
        teamColor={color}
        isRemote={true}
        invisible={invisible}
        giant={giant}
      />
      {playerName && !invisible && (
        <Html position={[0, 2.2, 0]} center distanceFactor={8}>
          <div className={`player-name-label ${team}`}>{playerName}</div>
        </Html>
      )}
    </group>
  )
}

// Re-export for backward compatibility
export { LocalPlayer as LocalPlayerWithSync }
export { ClientPlayerVisual as RemotePlayerWithPhysics }
