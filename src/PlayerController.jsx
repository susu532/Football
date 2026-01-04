// PlayerController.jsx - Local player physics controller with Colyseus networking
// Handles input processing, sends inputs to server, and applies local prediction

import React, { useRef, useEffect, useImperativeHandle, useCallback } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import InputManager from './InputManager'
import CharacterSkin from './CharacterSkin'

// Physics constants
const MOVE_SPEED = 8
const JUMP_FORCE = 8
const DOUBLE_JUMP_MULTIPLIER = 0.8
const GRAVITY = 20
const GROUND_Y = 0.1
const MAX_JUMPS = 2
const INPUT_SEND_RATE = 1 / 30 // 30Hz

// PlayerController: Handles local player input => sends to server + local prediction
export function PlayerController(props) {
  const { 
    me,
    sendInput,
    sendKick,
    playerName = '',
    playerTeam = '',
    teamColor = '#888',
    characterType = 'cat',
    spawnPosition = [0, 1, 0],
    powerUps = [],
    onCollectPowerUp = null,
    isFreeLook = null,
    onLocalInteraction = null,
    serverState = null, // Server state for reconciliation
    ref
  } = props

  const groupRef = useRef()
  const { camera } = useThree()
  
  // Physics state (for prediction)
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

  // Input throttle
  const lastInputTime = useRef(0)
  const inputSequence = useRef(0)

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
        onCollectPowerUp(p.id, p.type)
        
        // Apply effect locally
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

    // Handle kick - send to server
    if (input.kick && sendKick) {
      if (onLocalInteraction) onLocalInteraction()
      
      // Calculate kick direction
      const rotation = groupRef.current.rotation.y
      const forwardX = Math.sin(rotation)
      const forwardZ = Math.cos(rotation)
      const kickDir = new THREE.Vector3(forwardX, 0.5, forwardZ).normalize()
      const kickPower = 65 * effects.current.kick
      
      // Add a portion of player's current velocity to the kick
      const impulseX = kickDir.x * kickPower + velocity.current.x * 2
      const impulseY = kickDir.y * kickPower
      const impulseZ = kickDir.z * kickPower + velocity.current.z * 2
      
      sendKick({
        impulseX,
        impulseY,
        impulseZ
      })
    }

    // Apply physics (local prediction)
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

    // Apply position (local prediction)
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

    // Server reconciliation (smooth correction)
    if (serverState) {
      const serverPos = new THREE.Vector3(serverState.x, serverState.y, serverState.z)
      const error = serverPos.clone().sub(groupRef.current.position)
      
      // Only reconcile if error is significant but not too large (snap if > threshold)
      const errorMagnitude = error.length()
      if (errorMagnitude > 0.1 && errorMagnitude < 5) {
        groupRef.current.position.add(error.multiplyScalar(0.2))
      } else if (errorMagnitude >= 5) {
        // Snap to server position
        groupRef.current.position.copy(serverPos)
      }
    }

    // Update userData for effects sync
    groupRef.current.userData.invisible = effects.current.invisible
    groupRef.current.userData.giant = effects.current.giant

    // Check power-up collisions
    checkPowerUpCollision(groupRef.current.position)

    // Send input to server (throttled at 30Hz)
    if (now - lastInputTime.current >= INPUT_SEND_RATE && sendInput) {
      lastInputTime.current = now
      inputSequence.current++
      
      sendInput({
        moveX: velocity.current.x / speed,
        moveZ: velocity.current.z / speed,
        jump: input.jump,
        rotY: groupRef.current.rotation.y,
        seq: inputSequence.current
      })
    }
  })

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
