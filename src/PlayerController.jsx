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
export const PlayerController = React.forwardRef((props, ref) => {
  const { 
    me,
    sendInput,
    sendKick,
    ballRef, // Received from parent
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
  const lastKickTime = useRef(0)
  const inputSequence = useRef(0)
  const lastReconciledTick = useRef(0)
  
  // Input Buffering (Captures events between frames)
  const pendingJump = useRef(false)
  const pendingKick = useRef(false)

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

  // Fixed timestep accumulator
  const accumulator = useRef(0)
  const FIXED_TIMESTEP = 1 / 120
  const inputHistory = useRef([])

  useFrame((state, delta) => {
    if (!groupRef.current) return

    const now = state.clock.getElapsedTime()
    const input = InputManager.getInput()
    
    // Buffer events
    if (input.jump) pendingJump.current = true
    if (input.kick) pendingKick.current = true
    
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

    // Accumulate time for fixed timestep
    accumulator.current += delta
    
    // Physics loop - Fixed Timestep
    while (accumulator.current >= FIXED_TIMESTEP) {
      // 1. Apply Gravity first (matches server)
      verticalVelocity.current -= GRAVITY * FIXED_TIMESTEP

      // 2. Ground Check (reset jump count if on ground)
      if (physicsPosition.current.y <= GROUND_Y + 0.05 && verticalVelocity.current <= 0) {
        jumpCount.current = 0
      }

      // 3. Handle Jump (overrides gravity for this frame)
      const jumpTriggered = pendingJump.current && !prevJump.current
      if (jumpTriggered && jumpCount.current < MAX_JUMPS) {
        const jumpMult = serverState?.jumpMult || 1
        const baseJumpForce = JUMP_FORCE * jumpMult
        verticalVelocity.current = jumpCount.current === 0 ? baseJumpForce : baseJumpForce * DOUBLE_JUMP_MULTIPLIER
        jumpCount.current++
        isOnGround.current = false
        // Store for history
        groupRef.current.userData.lastJumpTriggered = true
      }
      prevJump.current = pendingJump.current

      // Apply physics (local prediction)
      const speedMult = serverState?.speedMult || 1
      const speed = MOVE_SPEED * speedMult
      // Smoothed velocity (matches server 0.3 factor)
      const targetVx = moveDir.current.x * speed
      const targetVz = moveDir.current.z * speed
      velocity.current.x = velocity.current.x + (targetVx - velocity.current.x) * 0.3
      velocity.current.z = velocity.current.z + (targetVz - velocity.current.z) * 0.3
      
      // 4. Calculate new physics position
      let newX = physicsPosition.current.x + velocity.current.x * FIXED_TIMESTEP
      let newY = physicsPosition.current.y + verticalVelocity.current * FIXED_TIMESTEP
      let newZ = physicsPosition.current.z + velocity.current.z * FIXED_TIMESTEP

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

      // Decrement accumulator
      accumulator.current -= FIXED_TIMESTEP
    }

    // Handle kick - send to server (outside fixed loop, event based)
    if (pendingKick.current && sendKick) {
      // Kick cooldown (200ms) to prevent spam
      if (now - lastKickTime.current < 0.2) {
        pendingKick.current = false // Consume even if on cooldown
        return
      }
      lastKickTime.current = now

      if (onLocalInteraction) onLocalInteraction()
      
      const rotation = groupRef.current.rotation.y
      const forwardX = Math.sin(rotation)
      const forwardZ = Math.cos(rotation)
      const kickMult = serverState?.kickMult || 1
      const kickPower = 65 * kickMult
      
      const impulseX = forwardX * kickPower + velocity.current.x * 2
      const impulseY = 0.5 * kickPower
      const impulseZ = forwardZ * kickPower + velocity.current.z * 2

      // Send to server
      sendKick({
        impulseX,
        impulseY,
        impulseZ
      })

      // INSTANT LOCAL PREDICTION
      if (ballRef?.current?.userData?.predictKick) {
        ballRef.current.userData.predictKick({
          x: impulseX,
          y: impulseY + 0.8 * kickMult,
          z: impulseZ
        })
      }
      pendingKick.current = false
    }

    // Visual Interpolation (Smooth Glide)
    // Reduced from 25 to 15 for smoother feel
    const visualLambda = 15
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
    // We only reconcile if we have a valid server state and it's newer than our last check
    
    if (serverState && serverState.tick > lastReconciledTick.current) {
      lastReconciledTick.current = serverState.tick
      
      // 1. Calculate error between predicted position and server position
      serverPos.current.set(serverState.x, serverState.y, serverState.z)
      errorVec.current.copy(serverPos.current).sub(physicsPosition.current)
      const errorMagnitude = errorVec.current.length()
      
      // 2. Decide whether to reconcile
      // If error is small (< 5cm), ignore it to prevent micro-jitters
      // If error is large (> 5cm), hard correct and replay inputs
      if (errorMagnitude > 0.05) {
        // REWIND: Snap to server state
        physicsPosition.current.copy(serverPos.current)
        velocity.current.set(serverState.vx, serverState.vy, serverState.vz)
        verticalVelocity.current = serverState.vy
        jumpCount.current = serverState.jumpCount || 0 // Sync jump count!
        
        // REPLAY: Re-simulate inputs since server tick
        // Filter history for inputs newer than server tick
        const validHistory = inputHistory.current.filter(h => h.tick > serverState.tick)
        
        validHistory.forEach(historyItem => {
          const { input, jumpCountSnapshot } = historyItem
          
          // Restore exact jumpCount before re-simulating this input frame
          // This ensures we match the state we had when we first processed this input
          if (jumpCountSnapshot !== undefined) {
            jumpCount.current = jumpCountSnapshot
          }
          
          // Re-run physics step (simplified version of main loop)
          // Note: Inputs are at 60Hz, Physics is 120Hz.
          // We must run 2 steps per input to match the simulation speed.
          for (let i = 0; i < 2; i++) {
            // Apply Gravity
            verticalVelocity.current -= GRAVITY * FIXED_TIMESTEP
            
            // Ground Check
            if (physicsPosition.current.y <= GROUND_Y + 0.05 && verticalVelocity.current <= 0) {
              jumpCount.current = 0
            }
            
            // Jump (only on first step of the input frame to avoid double jumping)
            // Use stored jumpTriggered event for reliable replay
            if (i === 0 && input.jumpTriggered && jumpCount.current < MAX_JUMPS) {
               const jumpMult = serverState.jumpMult || 1
               const baseJumpForce = JUMP_FORCE * jumpMult
               verticalVelocity.current = jumpCount.current === 0 ? baseJumpForce : baseJumpForce * DOUBLE_JUMP_MULTIPLIER
               jumpCount.current++
               isOnGround.current = false
            }
            
            // Movement - Use stored x/z from history (matches what was sent to server)
            const speedMult = serverState.speedMult || 1
            const speed = MOVE_SPEED * speedMult
            const targetVx = (input.x || 0) * speed
            const targetVz = (input.z || 0) * speed
            
            velocity.current.x = velocity.current.x + (targetVx - velocity.current.x) * 0.3
            velocity.current.z = velocity.current.z + (targetVz - velocity.current.z) * 0.3
            
            // Integrate
            let newX = physicsPosition.current.x + velocity.current.x * FIXED_TIMESTEP
            let newY = physicsPosition.current.y + verticalVelocity.current * FIXED_TIMESTEP
            let newZ = physicsPosition.current.z + velocity.current.z * FIXED_TIMESTEP
            
            // Ground Clamp
            if (newY <= GROUND_Y) {
              newY = GROUND_Y
              verticalVelocity.current = 0
              jumpCount.current = 0 // Reset jump count on ground hit!
            }
            
            // Bounds
            const wallMargin = 0.3
            newX = Math.max(-15 + wallMargin, Math.min(15 - wallMargin, newX))
            newZ = Math.max(-10 + wallMargin, Math.min(10 - wallMargin, newZ))
            
            physicsPosition.current.set(newX, newY, newZ)
          }
        })
        
        // Prune old history
        inputHistory.current = validHistory
      }
    }

    // Update userData for effects sync and ball prediction
    groupRef.current.userData.invisible = serverState?.invisible || false
    groupRef.current.userData.giant = serverState?.giant || false
    groupRef.current.userData.velocity = velocity.current // Expose velocity for ball prediction
    groupRef.current.userData.velocityTimestamp = now // Timestamp for temporal correlation

    // Check power-up collisions
    checkPowerUpCollision(physicsPosition.current)

    // Send input to server (throttled at 60Hz)
    if (now - lastInputTime.current >= INPUT_SEND_RATE && sendInput) {
      lastInputTime.current = now
      inputSequence.current++
      
      // Store input in history buffer
      inputHistory.current.push({
        tick: serverState?.tick || 0, // Approximate tick
        input: { 
          ...input, 
          x: moveDir.current.x, // Store the exact direction sent to server
          z: moveDir.current.z,
          jumpTriggered: groupRef.current.userData.lastJumpTriggered || false, // Store the actual trigger event!
          rotY: groupRef.current.rotation.y 
        },
        jumpCountSnapshot: jumpCount.current, 
        timestamp: now
      })
      // Reset trigger for next input frame
      groupRef.current.userData.lastJumpTriggered = false

      // Keep buffer size manageable (last 2 seconds)
      const TWO_SECONDS_AGO = now - 2.0
      inputHistory.current = inputHistory.current.filter(h => h.timestamp > TWO_SECONDS_AGO)
      
      sendInput({
        x: moveDir.current.x,
        z: moveDir.current.z,
        jump: pendingJump.current, // Send the buffered jump
        rotY: groupRef.current.rotation.y,
        seq: inputSequence.current
      })

      // Consume buffered jump
      pendingJump.current = false
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
