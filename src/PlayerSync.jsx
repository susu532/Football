// PlayerSync.jsx - Player visual components for Colyseus
// LocalPlayer: Wraps PlayerController with name label
// ClientPlayerVisual: Remote player with smooth interpolation

import React, { useRef, useEffect, useImperativeHandle } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import CharacterSkin from './CharacterSkin'
import { PlayerController } from './PlayerController'

// LocalPlayer - Wraps PlayerController for the local player
export function LocalPlayer(props) {
  const { 
    me, 
    sendInput,
    sendKick,
    playerName = '', 
    playerTeam = '', 
    teamColor = '#888', 
    spawnPosition = [0, 1, 0], 
    powerUps = [], 
    onCollectPowerUp = null, 
    isFreeLook = null, 
    characterType = 'cat',
    onLocalInteraction = null,
    serverState = null,
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
        sendInput={sendInput}
        sendKick={sendKick}
        playerName={playerName}
        playerTeam={playerTeam}
        teamColor={teamColor}
        spawnPosition={spawnPosition}
        powerUps={powerUps}
        onCollectPowerUp={onCollectPowerUp}
        isFreeLook={isFreeLook}
        characterType={characterType}
        onLocalInteraction={onLocalInteraction}
        serverState={serverState}
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
  
  // Get remote player state from network (now from player object directly)
  const { 
    x = 0, y = 1, z = 0, 
    rotY = 0, 
    name = 'Player', 
    team = '', 
    character = 'cat',
    invisible = false,
    giant = false
  } = player

  const teamColor = team === 'red' ? '#ff4444' : team === 'blue' ? '#4488ff' : '#888'

  // Interpolation targets
  const targetPosition = useRef(new THREE.Vector3(x, y, z))
  const targetRotation = useRef(rotY)
  
  // Update targets when new data arrives
  useEffect(() => {
    targetPosition.current.set(x, y, z)
    targetRotation.current = rotY
  }, [x, y, z, rotY])

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

  // Initialize position on mount to avoid flying in from origin
  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.position.set(x, y, z)
      groupRef.current.rotation.y = rotY
    }
  }, [])

  return (
    <group ref={groupRef}>
      <CharacterSkin 
        characterType={character}
        teamColor={teamColor}
        isRemote={true}
        invisible={invisible}
        giant={giant}
      />
      {name && !invisible && (
        <Html position={[0, 2.2, 0]} center distanceFactor={8}>
          <div className={`player-name-label ${team}`}>{name}</div>
        </Html>
      )}
    </group>
  )
}
