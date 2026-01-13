// PlayerController.jsx - Local player physics controller with Colyseus networking
// Handles input processing, sends inputs to server, and applies local prediction

import React, { useRef, useEffect, useImperativeHandle, useCallback } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import InputManager from './InputManager'
import CharacterSkin from './CharacterSkin'
import { PHYSICS } from './PhysicsConstants.js'
import AudioManager from './AudioManager'

// Physics constants
// Physics constants
const MOVE_SPEED = PHYSICS.MOVE_SPEED
const JUMP_FORCE = PHYSICS.JUMP_FORCE
const DOUBLE_JUMP_MULTIPLIER = PHYSICS.DOUBLE_JUMP_MULTIPLIER
const GRAVITY = PHYSICS.GRAVITY
const GROUND_Y = PHYSICS.GROUND_Y
const MAX_JUMPS = PHYSICS.MAX_JUMPS
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
  const FIXED_TIMESTEP = PHYSICS.FIXED_TIMESTEP
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
    // Clamp delta to prevent physics explosions on frame spikes
    const clampedDelta = Math.min(delta, 0.05)
    accumulator.current += clampedDelta
    
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
        AudioManager.playSFX('jump')
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
      // Match server bounds: ARENA_HALF_WIDTH + 0.2, ARENA_HALF_DEPTH + 0.2
      const HALF_WIDTH = PHYSICS.ARENA_HALF_WIDTH + 0.2
      const HALF_DEPTH = PHYSICS.ARENA_HALF_DEPTH + 0.2
      newX = Math.max(-HALF_WIDTH, Math.min(HALF_WIDTH, newX))
      newZ = Math.max(-HALF_DEPTH, Math.min(HALF_DEPTH, newZ))

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

      // Client-side distance validation (matches server SoccerRoom.js:394)
      const playerPos = groupRef.current.position
      const ballPos = ballRef.current?.position
      let canKick = false
      if (ballPos) {
        const dist = playerPos.distanceTo(ballPos)
        if (dist < 3.0) canKick = true
      }

      if (!canKick) {
        pendingKick.current = false
        return
      }

      lastKickTime.current = now

      if (onLocalInteraction) onLocalInteraction()
      
      const rotation = groupRef.current.rotation.y
      const forwardX = Math.sin(rotation)
      const forwardZ = Math.cos(rotation)
      const kickMult = serverState?.kickMult || 1
      const kickPower = PHYSICS.KICK_POWER * kickMult
      
      const impulseX = forwardX * kickPower + velocity.current.x * 2
      const impulseY = 0.5 * kickPower
      const impulseZ = forwardZ * kickPower + velocity.current.z * 2

      // Send to server
      sendKick({
        impulseX,
        impulseY,
        impulseZ
      })
      
      AudioManager.playSFX('kick')

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
    // Frame-rate independent exponential interpolation
    // Higher lambda = snappier response
    const visualLambda = 20
    const lerpFactor = 1 - Math.exp(-visualLambda * clampedDelta)
    groupRef.current.position.lerp(physicsPosition.current, lerpFactor)

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
      // Soft correction zone: 0.05-0.15m (smooth blend)
      // Hard correction zone: >0.5m (snap)
      if (errorMagnitude > 0.5) {
        // HARD SNAP: Teleport to server (major desync)
        physicsPosition.current.copy(serverPos.current)
        velocity.current.set(serverState.vx || 0, 0, serverState.vz || 0)
        verticalVelocity.current = serverState.vy || 0
        jumpCount.current = serverState.jumpCount || 0
      } else if (errorMagnitude > 0.05) {
        // SOFT CORRECTION: Blend toward server over time
        // The visual damp already handles the smoothing, but we correct the physics state
        const blendFactor = Math.min(0.3, errorMagnitude * 0.5)
        physicsPosition.current.lerp(serverPos.current, blendFactor)
        
        // Also blend velocity slightly to match server trend
        velocity.current.x += (serverState.vx - velocity.current.x) * 0.1
        velocity.current.z += (serverState.vz - velocity.current.z) * 0.1
      }

      // 3. Replay inputs if there was a correction
      if (errorMagnitude > 0.05) {
        // REPLAY: Re-simulate inputs since server tick
        // Filter history for inputs newer than server tick
        const validHistory = inputHistory.current.filter(h => h.tick > serverState.tick)
        
        validHistory.forEach(historyItem => {
          const { input } = historyItem
          
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
            // Use stored jumpPressed event for reliable replay
            if (i === 0 && input.jumpPressed && jumpCount.current < MAX_JUMPS) {
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

        // SMOOTH RECONCILIATION: If error was significant but not massive, 
        // we can blend the visual position to avoid a pop.
        // The visual damp (line 240) already handles this if we update physicsPosition here.
        // But if we want it even smoother for medium errors:
        if (errorMagnitude < 0.5) {
          // Optional: we could reduce the visualLambda temporarily
        }
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
        tick: (serverState?.tick || 0) + 1, // Next tick (what server will process)
        input: { 
          ...input, 
          x: moveDir.current.x, // Store the exact direction sent to server
          z: moveDir.current.z,
          jumpPressed: pendingJump.current, // Store the event!
          rotY: groupRef.current.rotation.y 
        },
        timestamp: now
      })
      // Keep buffer size manageable (e.g., last 2 seconds)
      if (inputHistory.current.length > 120) {
        inputHistory.current.shift()
      }
      
      sendInput({
        x: moveDir.current.x,
        z: moveDir.current.z,
        jump: pendingJump.current, // Send the buffered jump
        rotY: groupRef.current.rotation.y,
        seq: inputSequence.current
      })
    }

    // Consume buffered jump AFTER physics loop and send
    // This ensures it's processed for the frame it was intended and replicated
    if (!InputManager.getInput().jump) {
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
