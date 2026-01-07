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
export const LocalPlayer = React.forwardRef((props, ref) => {
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
    serverState = null
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
})
LocalPlayer.displayName = 'LocalPlayer'

// ClientPlayerVisual - Visual-only remote player with smooth interpolation
import { SnapshotBuffer } from './SnapshotBuffer'

export const ClientPlayerVisual = React.forwardRef((props, ref) => {
  const { player } = props
  const groupRef = useRef()
  const buffer = useRef(new SnapshotBuffer(100)) // 100ms buffer

  useImperativeHandle(ref, () => groupRef.current)
  
  const teamColor = player.team === 'red' ? '#ff4444' : player.team === 'blue' ? '#4488ff' : '#888'

  // Update buffer when server state changes
  // Note: Colyseus updates the 'player' object in place, so we need to poll it or use a listener.
  // Since this component re-renders or useFrame runs, we can check for changes.
  // Better approach: In useFrame, we push the CURRENT server state to the buffer.
  // But we need the timestamp of the update.
  // Assuming 'player' is a schema proxy, it's always "current".
  // We'll push the current state with the current time.
  
  useFrame((state, delta) => {
    if (!groupRef.current || !player) return
    
    const now = state.clock.getElapsedTime() * 1000 // ms
    
    // Add current server state to buffer
    // We assume the server state arrived "recently". Ideally we'd use the server timestamp.
    // But since we don't have it easily here, we use local time.
    // This effectively buffers the *arrival* of packets.
    buffer.current.addSnapshot({
      x: player.x,
      y: player.y,
      z: player.z,
      rotY: player.rotY,
      vx: player.vx,
      vy: player.vy,
      vz: player.vz
    }, now)
    
    // Get interpolated state for 100ms ago
    const interpolated = buffer.current.getInterpolatedState(now)
    
    if (interpolated) {
      groupRef.current.position.set(interpolated.x, interpolated.y, interpolated.z)
      groupRef.current.rotation.y = interpolated.rotY || 0
    } else {
      // Fallback if buffer empty (e.g. start)
      groupRef.current.position.set(player.x, player.y, player.z)
    }
  })

  // Initialize position on mount
  useEffect(() => {
    if (groupRef.current && player) {
      groupRef.current.position.set(player.x, player.y, player.z)
      groupRef.current.rotation.y = player.rotY
    }
  }, [])

  return (
    <group ref={groupRef}>
      <CharacterSkin 
        player={player}
        characterType={player.character}
        teamColor={teamColor}
        isRemote={true}
        invisible={player.invisible}
        giant={player.giant}
      />
      {player.name && !player.invisible && (
        <Html position={[0, 2.2, 0]} center distanceFactor={8}>
          <div className={`player-name-label ${player.team}`}>{player.name}</div>
        </Html>
      )}
    </group>
  )
})
ClientPlayerVisual.displayName = 'ClientPlayerVisual'
