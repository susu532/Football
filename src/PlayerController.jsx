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
const INPUT_SEND_RATE = 1 / 60 // 60Hz

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
    isFreeLook = null,
    onLocalInteraction = null,
    serverState = null, // Server state for reconciliation
    serverTimestamp = null,
    ref
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
  
  // History buffer for reconciliation
  const history = useRef([])
  const timeOffset = useRef(null)

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
  
  // Power-up effects (synced from server)
  const effects = useRef({
    speed: 1,
    jump: 1,
    kick: 1,
    invisible: false,
    giant: false
  })

  // Sync effects from server state
  useEffect(() => {
    if (serverState) {
      effects.current.speed = serverState.speedMultiplier || 1
      effects.current.jump = serverState.jumpMultiplier || 1
      effects.current.kick = serverState.kickMultiplier || 1
      effects.current.invisible = serverState.invisible || false
      effects.current.giant = serverState.giant || false
    }
  }, [serverState])

  // Input throttle
  const lastInputTime = useRef(0)
  const inputSequence = useRef(0)

  useImperativeHandle(ref, () => ({
    get position() { return groupRef.current?.position || new THREE.Vector3() },
    get rotation() { return groupRef.current?.rotation || new THREE.Euler() },
    resetPosition: (x, y, z) => {
      if (groupRef.current) {
        groupRef.current.position.set(x, y, z)
        physicsPosition.current.set(x, y, z)
        velocity.current.set(0, 0, 0)
        verticalVelocity.current = 0
        jumpCount.current = 0
        isOnGround.current = true
      }
    }
  }))

  // Initialize input manager
  useEffect(() => {
    InputManager.init()
    return () => InputManager.destroy()
  }, [])



  useFrame((state, delta) => {
    if (!groupRef.current) return

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

    // Handle jump (with edge detection to match server)
    if (input.jump && !prevJump.current && jumpCount.current < MAX_JUMPS) {
      const baseJumpForce = JUMP_FORCE * effects.current.jump
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
      const kickDir = new THREE.Vector3(forwardX, 0.5, forwardZ).normalize()
      const kickPower = 65 * effects.current.kick
      
      sendKick({
        impulseX: kickDir.x * kickPower + velocity.current.x * 2,
        impulseY: kickDir.y * kickPower,
        impulseZ: kickDir.z * kickPower + velocity.current.z * 2
      })
    }

    // Apply physics (local prediction)
    const speed = MOVE_SPEED * effects.current.speed
       const lerpAlpha = 1 - Math.exp(-21.36 * delta)
    velocity.current.x = THREE.MathUtils.lerp(velocity.current.x, moveDir.x * speed, lerpAlpha)
    velocity.current.z = THREE.MathUtils.lerp(velocity.current.z, moveDir.z * speed, lerpAlpha)

    
    verticalVelocity.current -= GRAVITY * delta

    // Calculate new physics position
    let newX = physicsPosition.current.x + velocity.current.x * delta
    let newY = physicsPosition.current.y + verticalVelocity.current * delta
    let newZ = physicsPosition.current.z + velocity.current.z * delta

    // Ground check
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
      const targetAngle = Math.atan2(cameraForward.x, cameraForward.z)
      const currentRot = groupRef.current.rotation.y
      let rotDiff = targetAngle - currentRot
      
      while (rotDiff > Math.PI) rotDiff -= Math.PI * 2
      while (rotDiff < -Math.PI) rotDiff += Math.PI * 2
      
      groupRef.current.rotation.y += rotDiff * Math.min(1, 20 * delta)
    }

    // History-based Reconciliation
    if (serverState && serverTimestamp) {
      // 1. Initialize time offset
      if (timeOffset.current === null) {
        timeOffset.current = Date.now() - serverTimestamp
      }

      // 2. Find past state matching server timestamp
      // Server timestamp is "server time". We need to find local state at that time.
      // Local state was saved with Date.now().
      // serverTime + offset = localTime
      const targetLocalTime = serverTimestamp + timeOffset.current
      
      // Find snapshot closest to targetLocalTime
      const pastState = history.current.find(s => Math.abs(s.timestamp - targetLocalTime) < 20)

      if (pastState) {
        const serverPos = new THREE.Vector3(serverState.x, serverState.y, serverState.z)
        const pastPos = new THREE.Vector3(pastState.x, pastState.y, pastState.z)
        
        const error = serverPos.clone().sub(pastPos)
        
        // Ignore small errors (floating point diffs)
        if (error.length() > 0.05) {
          // Apply soft correction to CURRENT position
          // We assume the error made in the past persists to now
          const correctionAlpha = 1 - Math.exp(-5 * delta)
          physicsPosition.current.add(error.multiplyScalar(correctionAlpha))
        }
      } else if (!pastState && history.current.length > 0) {
        // If no matching history (maybe too old or too new), fall back to simple distance check
        // This handles the case where we just joined or lag spike dropped history
        const serverPos = new THREE.Vector3(serverState.x, serverState.y, serverState.z)
        if (physicsPosition.current.distanceTo(serverPos) > 2.0) {
           physicsPosition.current.lerp(serverPos, 0.1)
        }
      }
    }

    // Save current state to history
    history.current.push({
      x: physicsPosition.current.x,
      y: physicsPosition.current.y,
      z: physicsPosition.current.z,
      timestamp: Date.now()
    })
    
    // Prune history (keep 1 second)
    if (history.current.length > 60) {
      history.current.shift()
    }

    // Update userData for effects sync
    groupRef.current.userData.invisible = effects.current.invisible
    groupRef.current.userData.giant = effects.current.giant



    // Send input to server (throttled at 60Hz)
    if (now - lastInputTime.current >= INPUT_SEND_RATE && sendInput) {
      lastInputTime.current = now
      inputSequence.current++
      
      sendInput({
        x: moveDir.x,
        z: moveDir.z,
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
        invisible={effects.current.invisible}
        giant={effects.current.giant}
        isRemote={false}
      />
    </group>
  )
}

export default PlayerController
