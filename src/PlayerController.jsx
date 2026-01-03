// PlayerController.jsx - Local player physics controller
// Handles input processing, sends to host, and applies local prediction

import React, { useRef, useEffect, useImperativeHandle, useCallback } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RPC } from 'playroomkit'
import InputManager from './InputManager'
import CharacterSkin from './CharacterSkin'

// Physics constants
const MOVE_SPEED = 8
const JUMP_FORCE = 8
const DOUBLE_JUMP_MULTIPLIER = 0.8
const GRAVITY = 20
const GROUND_Y = 0.1
const MAX_JUMPS = 2

// PlayerController: Handles local player input => sends to host + local prediction
export function PlayerController(props) {
  const { 
    me,
    isHost,
    playerName = '',
    playerTeam = '',
    teamColor = '#888',
    characterType = 'cat',
    spawnPosition = [0, 1, 0],
    powerUps = [],
    onCollectPowerUp = null,
    isFreeLook = null,
    onLocalInteraction = null,
    ref
  } = props

  const groupRef = useRef()
  const { camera } = useThree()
  
  // Physics state
  const velocity = useRef(new THREE.Vector3())
  const verticalVelocity = useRef(0)
  const isOnGround = useRef(true)
  const jumpCount = useRef(0)
  
  // Power-up effects
  const effects = useRef({
    speed: 1,
    jump: 1,
    kick: 1,
    invisible: false,
    giant: false
  })

  // Sync throttle
  const lastSyncTime = useRef(0)
  const SYNC_RATE = 1 / 30 // 30Hz

  useImperativeHandle(ref, () => groupRef.current)

  // Initialize input manager
  useEffect(() => {
    InputManager.init()
    return () => InputManager.destroy()
  }, [])

  // Collect power-ups
  const checkPowerUpCollision = useCallback((position) => {
    if (!onCollectPowerUp) return
    
    powerUps.forEach(p => {
      const dx = position.x - p.position[0]
      const dz = position.z - p.position[2]
      const dist = Math.sqrt(dx * dx + dz * dz)
      
      if (dist < 1.5) {
        onCollectPowerUp(p.id)
        
        // Apply effect
        const effectDuration = 15000
        if (p.type === 'speed') {
          effects.current.speed = 2.0
          setTimeout(() => effects.current.speed = 1, effectDuration)
        } else if (p.type === 'jump') {
          effects.current.jump = 2.0
          setTimeout(() => effects.current.jump = 1, effectDuration)
        } else if (p.type === 'kick') {
          effects.current.kick = 2.0
          setTimeout(() => effects.current.kick = 1, effectDuration)
        } else if (p.type === 'invisible') {
          effects.current.invisible = true
          setTimeout(() => effects.current.invisible = false, effectDuration)
        } else if (p.type === 'giant') {
          effects.current.giant = true
          setTimeout(() => effects.current.giant = false, effectDuration)
        }
      }
    })
  }, [powerUps, onCollectPowerUp])

  useFrame((state, delta) => {
    if (!groupRef.current || !me) return

    const now = state.clock.getElapsedTime()
    const input = InputManager.getInput()
    
    // Get camera direction for relative movement
    const cameraForward = new THREE.Vector3()
    camera.getWorldDirection(cameraForward)
    cameraForward.y = 0
    cameraForward.normalize()
    
    const cameraRight = new THREE.Vector3()
    cameraRight.crossVectors(cameraForward, new THREE.Vector3(0, 1, 0))
    cameraRight.normalize()

    // Calculate movement direction relative to camera
    const moveDir = new THREE.Vector3()
    moveDir.addScaledVector(cameraForward, -input.move.z)
    moveDir.addScaledVector(cameraRight, input.move.x)
    
    if (moveDir.length() > 0) {
      moveDir.normalize()
    }

    // Handle jump
    if (input.jump) {
      const baseJumpForce = JUMP_FORCE * effects.current.jump
      
      if (isOnGround.current) {
        verticalVelocity.current = baseJumpForce
        isOnGround.current = false
        jumpCount.current = 1
      } else if (jumpCount.current < MAX_JUMPS) {
        verticalVelocity.current = baseJumpForce * DOUBLE_JUMP_MULTIPLIER
        jumpCount.current++
      }
    }

    // Handle kick - send RPC to host
    if (input.kick && onLocalInteraction) {
      onLocalInteraction()
      
      // Calculate kick direction
      const rotation = groupRef.current.rotation.y
      const forwardX = Math.sin(rotation)
      const forwardZ = Math.cos(rotation)
      const kickDir = new THREE.Vector3(forwardX, 0.5, forwardZ).normalize()
      const kickPower = 65 * effects.current.kick
      
      RPC.call('player-kick', {
        playerId: me.id,
        impulse: [kickDir.x * kickPower, kickDir.y * kickPower, kickDir.z * kickPower],
        position: [groupRef.current.position.x, groupRef.current.position.y, groupRef.current.position.z]
      }, RPC.Mode.ALL)
    }

    // Apply physics
    const speed = MOVE_SPEED * effects.current.speed
    
    // Smooth horizontal velocity
    velocity.current.x = THREE.MathUtils.lerp(velocity.current.x, moveDir.x * speed, 0.15)
    velocity.current.z = THREE.MathUtils.lerp(velocity.current.z, moveDir.z * speed, 0.15)
    
    // Apply gravity
    verticalVelocity.current -= GRAVITY * delta

    // Calculate new position
    let newX = groupRef.current.position.x + velocity.current.x * delta
    let newY = groupRef.current.position.y + verticalVelocity.current * delta
    let newZ = groupRef.current.position.z + velocity.current.z * delta

    // Ground check
    if (newY <= GROUND_Y) {
      newY = GROUND_Y
      verticalVelocity.current = 0
      isOnGround.current = true
      jumpCount.current = 0
    }

    // Bounds checking (arena limits)
    const wallMargin = 0.3
    newX = Math.max(-15 + wallMargin, Math.min(15 - wallMargin, newX))
    newZ = Math.max(-10 + wallMargin, Math.min(10 - wallMargin, newZ))

    // Apply position
    groupRef.current.position.set(newX, newY, newZ)

    // Rotate player to face camera direction (strafe mode)
    if (!isFreeLook || !isFreeLook.current) {
      const targetAngle = Math.atan2(cameraForward.x, cameraForward.z)
      const currentRot = groupRef.current.rotation.y
      let rotDiff = targetAngle - currentRot
      
      while (rotDiff > Math.PI) rotDiff -= Math.PI * 2
      while (rotDiff < -Math.PI) rotDiff += Math.PI * 2
      
      groupRef.current.rotation.y += rotDiff * Math.min(1, 20 * delta)
    }

    // Update userData for effects sync
    groupRef.current.userData.invisible = effects.current.invisible
    groupRef.current.userData.giant = effects.current.giant

    // Check power-up collisions
    checkPowerUpCollision(groupRef.current.position)

    // Sync position to network (throttled to 30Hz)
    if (now - lastSyncTime.current >= SYNC_RATE) {
      lastSyncTime.current = now
      
      me.setState('pos', [
        groupRef.current.position.x,
        groupRef.current.position.y,
        groupRef.current.position.z
      ], false)
      me.setState('rot', groupRef.current.rotation.y, false)
      me.setState('vel', [velocity.current.x, verticalVelocity.current, velocity.current.z], false)
      me.setState('invisible', effects.current.invisible, false)
      me.setState('giant', effects.current.giant, false)
    }
  })

  // Set initial profile
  useEffect(() => {
    if (me) {
      me.setState('profile', {
        name: playerName,
        team: playerTeam,
        color: teamColor,
        character: characterType
      }, true)
    }
  }, [me, playerName, playerTeam, teamColor, characterType])

  return (
    <group ref={groupRef} position={spawnPosition}>
      <CharacterSkin
        teamColor={teamColor}
        characterType={characterType}
        invisible={effects.current.invisible}
        giant={effects.current.giant}
        isRemote={false}
      />
    </group>
  )
}

export default PlayerController
