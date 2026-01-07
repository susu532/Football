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
export const ClientPlayerVisual = React.forwardRef((props, ref) => {
  const { player } = props
  const groupRef = useRef()
  const velocityRef = useRef(new THREE.Vector3()) // For ball collision prediction
  const lastPos = useRef(new THREE.Vector3())

  useImperativeHandle(ref, () => groupRef.current)
  
  const teamColor = player.team === 'red' ? '#ff4444' : player.team === 'blue' ? '#4488ff' : '#888'

  // Smooth interpolation each frame
  // Snapshot buffer for smooth interpolation
  const snapshotBuffer = useRef([])
  const SNAPSHOT_DELAY = 100 // ms

  // Buffer incoming state updates
  useEffect(() => {
    if (!player) return
    
    const now = Date.now()
    const snapshot = {
      time: now,
      x: player.x,
      y: player.y,
      z: player.z,
      rotY: player.rotY,
      vx: player.vx || 0,
      vy: player.vy || 0,
      vz: player.vz || 0
    }
    
    snapshotBuffer.current.push(snapshot)
    if (snapshotBuffer.current.length > 20) snapshotBuffer.current.shift()
  }, [player, player.x, player.y, player.z, player.rotY])

  // Smooth interpolation each frame
  useFrame((state, delta) => {
    if (!groupRef.current || snapshotBuffer.current.length === 0) return
    
    const now = Date.now()
    const renderTime = now - SNAPSHOT_DELAY
    
    let targetX = player.x
    let targetY = player.y
    let targetZ = player.z
    let targetRot = player.rotY
    
    // Find snapshots
    const buffer = snapshotBuffer.current
    let idx = -1
    for (let i = 0; i < buffer.length - 1; i++) {
      if (buffer[i].time <= renderTime && buffer[i+1].time >= renderTime) {
        idx = i
        break
      }
    }

    if (idx !== -1) {
      // Interpolate
      const t0 = buffer[idx]
      const t1 = buffer[idx+1]
      const alpha = (renderTime - t0.time) / (t1.time - t0.time)
      
      targetX = THREE.MathUtils.lerp(t0.x, t1.x, alpha)
      targetY = THREE.MathUtils.lerp(t0.y, t1.y, alpha)
      targetZ = THREE.MathUtils.lerp(t0.z, t1.z, alpha)
      
      // Rot interpolation (shortest path)
      let rotDiff = t1.rotY - t0.rotY
      while (rotDiff > Math.PI) rotDiff -= Math.PI * 2
      while (rotDiff < -Math.PI) rotDiff += Math.PI * 2
      targetRot = t0.rotY + rotDiff * alpha
    } else {
      // Extrapolate (if buffer empty or lagging)
      const latest = buffer[buffer.length - 1]
      const dt = (renderTime - latest.time) / 1000
      const safeDt = Math.min(dt, 0.2) // Limit extrapolation
      
      targetX = latest.x + latest.vx * safeDt
      targetY = latest.y + latest.vy * safeDt
      targetZ = latest.z + latest.vz * safeDt
      targetRot = latest.rotY
    }

    // Calculate velocity from position delta (for ball collision prediction)
    if (delta > 0.001) {
      const safeInvDelta = 1 / Math.max(delta, 0.008)
      velocityRef.current.set(
        (targetX - lastPos.current.x) * safeInvDelta,
        (targetY - lastPos.current.y) * safeInvDelta,
        (targetZ - lastPos.current.z) * safeInvDelta
      )
      // Clamp velocity
      const maxVel = 30
      const velMag = velocityRef.current.length()
      if (velMag > maxVel) {
        velocityRef.current.multiplyScalar(maxVel / velMag)
      }
    }
    lastPos.current.set(targetX, targetY, targetZ)
    
    // Expose velocity for ball collision prediction
    groupRef.current.userData.velocity = velocityRef.current
    groupRef.current.userData.velocityTimestamp = state.clock.getElapsedTime()

    // Apply position directly (interpolation is handled by snapshot logic)
    // We use a very fast lerp here just to smooth out frame-rate jitters
    const lambda = 25
    groupRef.current.position.x = THREE.MathUtils.damp(groupRef.current.position.x, targetX, lambda, delta)
    groupRef.current.position.y = THREE.MathUtils.damp(groupRef.current.position.y, targetY, lambda, delta)
    groupRef.current.position.z = THREE.MathUtils.damp(groupRef.current.position.z, targetZ, lambda, delta)
    
    // Rotation
    let rotDiff = targetRot - groupRef.current.rotation.y
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
