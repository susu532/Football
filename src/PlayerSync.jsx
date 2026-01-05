// PlayerSync.jsx - Player visual components for Colyseus
// LocalPlayer: Wraps PlayerController with name label
// ClientPlayerVisual: Remote player with smooth interpolation

import React, { useRef, useEffect, useImperativeHandle } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import CharacterSkin from './CharacterSkin'

import { PlayerController } from './PlayerController'
import { SnapshotBuffer } from './SnapshotBuffer'

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
  const { player, serverTimestamp, ref } = props
  const groupRef = useRef()
  const buffer = useRef(new SnapshotBuffer(50)) // 50ms delay
  const lastServerTime = useRef(0)
  const timeOffset = useRef(null)

  useImperativeHandle(ref, () => groupRef.current)
  
  const teamColor = player.team === 'red' ? '#ff4444' : player.team === 'blue' ? '#4488ff' : '#888'

  // Add snapshots to buffer
  useEffect(() => {
    if (serverTimestamp && serverTimestamp !== lastServerTime.current) {
      lastServerTime.current = serverTimestamp
      
      // Initialize time offset on first packet
      if (timeOffset.current === null) {
        timeOffset.current = Date.now() - serverTimestamp
      }

      buffer.current.add({
        x: player.x,
        y: player.y,
        z: player.z,
        rotY: player.rotY,
        timestamp: serverTimestamp
      })
    }
  }, [serverTimestamp, player])

  // Smooth interpolation each frame
  useFrame(() => {
    if (!groupRef.current || timeOffset.current === null) return
    
    // Estimate current server time
    const estimatedServerTime = Date.now() - timeOffset.current
    
    // Get interpolated state
    const state = buffer.current.getInterpolatedState(estimatedServerTime)
    if (!state) return

    groupRef.current.position.set(state.x, state.y, state.z)
    groupRef.current.rotation.y = state.rotY
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
}
