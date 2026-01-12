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
        ballRef={props.ballRef}
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
export const ClientPlayerVisual = React.forwardRef((props, ref) => {
  const { player } = props
  const groupRef = useRef()
  const velocityRef = useRef(new THREE.Vector3()) // For ball collision prediction
  const lastPos = useRef(new THREE.Vector3())

  useImperativeHandle(ref, () => groupRef.current)
  
  const teamColor = player.team === 'red' ? '#ff4444' : player.team === 'blue' ? '#4488ff' : '#888'

  // Smooth interpolation each frame
  useFrame((state, delta) => {
    if (!groupRef.current || !player) return
    
    const lambda = 8 // Interpolation speed (tuned for 60Hz updates)
    
    // Position interpolation - read directly from Colyseus proxy
    // Prediction: Extrapolate position based on velocity
    // This helps smooth out jumps and fast movements between server updates
    const LOOKAHEAD = 0.032 // ~32ms prediction (2 frames at 60Hz)
    const predictedX = player.x + (player.vx || 0) * LOOKAHEAD
    const predictedY = player.y + (player.vy || 0) * LOOKAHEAD
    const predictedZ = player.z + (player.vz || 0) * LOOKAHEAD

    // Calculate velocity from position delta (for ball collision prediction)
    // Use server velocity if available for smoother prediction
    if (player.vx !== undefined) {
      velocityRef.current.set(player.vx, player.vy, player.vz)
    } else if (delta > 0.001) {
      const safeInvDelta = 1 / Math.max(delta, 0.008) // Clamp to avoid spikes
      velocityRef.current.set(
        (predictedX - lastPos.current.x) * safeInvDelta,
        (predictedY - lastPos.current.y) * safeInvDelta,
        (predictedZ - lastPos.current.z) * safeInvDelta
      )
      // Clamp velocity magnitude to prevent physics explosions
      const maxVel = 30
      const velMag = velocityRef.current.length()
      if (velMag > maxVel) {
        velocityRef.current.multiplyScalar(maxVel / velMag)
      }
    }
    lastPos.current.set(predictedX, predictedY, predictedZ)
    
    // Expose velocity for ball collision prediction
    groupRef.current.userData.velocity = velocityRef.current
    groupRef.current.userData.velocityTimestamp = state.clock.getElapsedTime()

    groupRef.current.position.x = THREE.MathUtils.damp(
      groupRef.current.position.x, 
      predictedX, 
      lambda, 
      delta
    )
    groupRef.current.position.y = THREE.MathUtils.damp(
      groupRef.current.position.y, 
      predictedY, 
      lambda, 
      delta
    )
    groupRef.current.position.z = THREE.MathUtils.damp(
      groupRef.current.position.z, 
      predictedZ, 
      lambda, 
      delta
    )
    
    // Rotation interpolation (handle wrapping)
    let rotDiff = player.rotY - groupRef.current.rotation.y
    while (rotDiff > Math.PI) rotDiff -= Math.PI * 2
    while (rotDiff < -Math.PI) rotDiff += Math.PI * 2
    groupRef.current.rotation.y += rotDiff * Math.min(1, lambda * delta)
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
