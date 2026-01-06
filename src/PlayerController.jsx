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
const INPUT_SEND_RATE = 1 / 60 // 60Hz for responsive inputs

// PlayerController: Handles local player input => sends to server + local prediction
export const PlayerController = React.forwardRef((props, ref) => {
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
    serverState = null // Server state for reconciliation
  } = props

  const groupRef = useRef()
  const { camera } = useThree()
  
  // Physics state (Predicted state)
  const physicsPosition = useRef(new THREE.Vector3(...spawnPosition))
  const velocity = useRef(new THREE.Vector3())
  const verticalVelocity = useRef(0)
  const isOnGround = useRef(true)
  const jumpCount = useRef(0)
  const prevJump = useRef(false) // For edge detection

  // Pre-allocated vectors for per-frame calculations (avoids GC stutters)
  const cameraForward = useRef(new THREE.Vector3())
  const cameraRight = useRef(new THREE.Vector3())
  const moveDir = useRef(new THREE.Vector3())
  const serverPos = useRef(new THREE.Vector3())
  const errorVec = useRef(new THREE.Vector3())

  // Initialize position
  const lastSpawnRef = useRef('')
  useEffect(() => {
    const spawnKey = JSON.stringify(spawnPosition)
    if (groupRef.current && spawnKey !== lastSpawnRef.current) {
      groupRef.current.position.set(...spawnPosition)
      physicsPosition.current.set(...spawnPosition)
      lastSpawnRef.current = spawnKey
    }
  }, [spawnPosition])
  
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

  useImperativeHandle(ref, () => ({
    get position() { return groupRef.current?.position || new THREE.Vector3() },
    get rotation() { return groupRef.current?.rotation || new THREE.Euler() },
    resetPosition: (x, y, z) => {
      if (groupRef.current) groupRef.current.position.set(x, y, z)
      physicsPosition.current.set(x, y, z)
      velocity.current.set(0, 0, 0)
      verticalVelocity.current = 0
    }
  }))

  // Initialize input manager
  useEffect(() => {
    InputManager.init()
    return () => InputManager.destroy()
  }, [])

  // Collect power-ups
  const checkPowerUpCollision = useCallback((position) => {
    // Handled on server
  }, [])

  useFrame((state, delta) => {
    if (!groupRef.current) return

    const now = state.clock.getElapsedTime()
    const input = InputManager.getInput()
    
    // Get camera direction for relative movement (reuse pre-allocated vectors)
    camera.getWorldDirection(cameraForward.current)
    cameraForward.current.y = 0
    cameraForward.current.normalize()
    
    cameraRight.current.crossVectors(cameraForward.current, new THREE.Vector3(0, 1, 0))
    cameraRight.current.normalize()

    // Calculate movement direction relative to camera
    moveDir.current.set(0, 0, 0)
    moveDir.current.addScaledVector(cameraForward.current, -input.move.z)
    moveDir.current.addScaledVector(cameraRight.current, input.move.x)
    
    if (moveDir.current.length() > 0) {
      moveDir.current.normalize()
    }

    // 1. Apply Gravity first (matches server)
    verticalVelocity.current -= GRAVITY * delta

    // 2. Ground Check (reset jump count if on ground)
    // Matches server: if (currentPos.y <= GROUND_Y + 0.05 && player.vy <= 0)
    if (physicsPosition.current.y <= GROUND_Y + 0.05 && verticalVelocity.current <= 0) {
      jumpCount.current = 0
    }

    // 3. Handle Jump (overrides gravity for this frame)
    if (input.jump && !prevJump.current && jumpCount.current < MAX_JUMPS) {
      const jumpMult = serverState?.jumpMult || 1
      const baseJumpForce = JUMP_FORCE * jumpMult
      // Matches server: player.vy = player.jumpCount === 0 ? jumpForce : jumpForce * DOUBLE_JUMP_MULTIPLIER
      verticalVelocity.current = jumpCount.current === 0 ? baseJumpForce : baseJumpForce * DOUBLE_JUMP_MULTIPLIER
      jumpCount.current++
      isOnGround.current = false
    }
    prevJump.current = input.jump

    // Handle kick - send to server
    if (input.kick && sendKick) {
      if (onLocalInteraction) onLocalInteraction()
      
      const rotation = groupRef.current.rotation.y
      const forwardX = Math.sin(rotation)
      const forwardZ = Math.cos(rotation)
      const kickMult = serverState?.kickMult || 1
      const kickPower = 65 * kickMult
      
      sendKick({
        impulseX: forwardX * kickPower + velocity.current.x * 2,
        impulseY: 0.5 * kickPower,
        impulseZ: forwardZ * kickPower + velocity.current.z * 2
      })
    }

    // Apply physics (local prediction)
    const speedMult = serverState?.speedMult || 1
    const speed = MOVE_SPEED * speedMult
    // Smoothed velocity (matches server 0.3 factor)
    const targetVx = moveDir.current.x * speed
    const targetVz = moveDir.current.z * speed
    velocity.current.x = velocity.current.x + (targetVx - velocity.current.x) * 0.3
    velocity.current.z = velocity.current.z + (targetVz - velocity.current.z) * 0.3
    
    // 4. Calculate new physics position
    let newX = physicsPosition.current.x + velocity.current.x * delta
    let newY = physicsPosition.current.y + verticalVelocity.current * delta
    let newZ = physicsPosition.current.z + velocity.current.z * delta

    // 5. Ground Clamp
    if (newY <= GROUND_Y) {
      newY = GROUND_Y
      verticalVelocity.current = 0
      isOnGround.current = true
      jumpCount.current = 0
    }

    // Bounds checking
    const wallMargin = 0.3
    newX = Math.max(-15 + wallMargin, Math.min(15 - wallMargin, newX))
    newZ = Math.max(-10 + wallMargin, Math.min(10 - wallMargin, newZ))

    // Update physics position
    physicsPosition.current.set(newX, newY, newZ)

    // Visual Interpolation (Smooth Glide)
    // The visual model glides toward the predicted physics position
    const visualLambda = 25
    groupRef.current.position.x = THREE.MathUtils.damp(groupRef.current.position.x, physicsPosition.current.x, visualLambda, delta)
    groupRef.current.position.y = THREE.MathUtils.damp(groupRef.current.position.y, physicsPosition.current.y, visualLambda, delta)
    groupRef.current.position.z = THREE.MathUtils.damp(groupRef.current.position.z, physicsPosition.current.z, visualLambda, delta)

    // Rotate player to face camera direction (strafe mode)
    if (!isFreeLook || !isFreeLook.current) {
      const targetAngle = Math.atan2(cameraForward.current.x, cameraForward.current.z)
      const currentRot = groupRef.current.rotation.y
      let rotDiff = targetAngle - currentRot
      
      while (rotDiff > Math.PI) rotDiff -= Math.PI * 2
      while (rotDiff < -Math.PI) rotDiff += Math.PI * 2
      
      groupRef.current.rotation.y += rotDiff * Math.min(1, 20 * delta)
    }

    // Server reconciliation (smooth correction of physics position)
    // Skip reconciliation if actively moving - prediction is more accurate
    const isMoving = moveDir.current.length() > 0.1 || Math.abs(verticalVelocity.current) > 0.5
    if (serverState && !isMoving) {
      serverPos.current.set(serverState.x, serverState.y, serverState.z)
      errorVec.current.copy(serverPos.current).sub(physicsPosition.current)
      
      const errorMagnitude = errorVec.current.length()
      if (errorMagnitude > 0.5 && errorMagnitude < 5) {
        // Soft correction of physics position - frame-rate independent
        const correctionAlpha = 1 - Math.exp(-5 * delta)
        physicsPosition.current.add(errorVec.current.multiplyScalar(correctionAlpha))
      } else if (errorMagnitude >= 5) {
        // Snap physics position if way off
        physicsPosition.current.copy(serverPos.current)
      }
    }

    // Update userData for effects sync and ball prediction
    groupRef.current.userData.invisible = serverState?.invisible || false
    groupRef.current.userData.giant = serverState?.giant || false
    groupRef.current.userData.velocity = velocity.current // Expose velocity for ball prediction

    // Check power-up collisions
    checkPowerUpCollision(physicsPosition.current)

    // Send input to server (throttled at 60Hz)
    if (now - lastInputTime.current >= INPUT_SEND_RATE && sendInput) {
      lastInputTime.current = now
      inputSequence.current++
      
      sendInput({
        x: moveDir.current.x,
        z: moveDir.current.z,
        jump: input.jump,
        rotY: groupRef.current.rotation.y,
        seq: inputSequence.current
      })
    }
  })

  return (
    <group ref={groupRef}>
      <CharacterSkin
        teamColor={teamColor}
        characterType={characterType}
        invisible={serverState?.invisible || false}
        giant={serverState?.giant || false}
        isRemote={false}
      />
    </group>
  )
})
PlayerController.displayName = 'PlayerController'

export default PlayerController
