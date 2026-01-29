/**
 * OmniPitch 3D Soccer Experience
 * Copyright (c) 2026 OmniPitch Games. All Rights Reserved.
 *
 * This file is proprietary and confidential.
 * Unauthorized copying, transfer, or use is strictly prohibited.
 *
 * For licensing inquiries: hentertrabelsi@gmail.com
 */

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
const INPUT_SEND_RATE = 1 / 30 // 30Hz

// Sub-frame Physics Constants
const SUB_FRAME_TIMESTEP = PHYSICS.SUB_FRAME_TIMESTEP // 120Hz
const VISUAL_TIMESTEP = PHYSICS.FIXED_TIMESTEP // 60Hz

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
    serverState = null, // Server state for reconciliation
    ping = 0 // Network latency for adaptive reconciliation
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

  // Enhanced Jump Prediction State
  const jumpPredictionState = useRef({
    predictedY: 0,
    predictedVy: 0,
    confidence: 0,
    startTick: 0
  })

  // Pre-allocated vectors for per-frame calculations (avoids GC stutters)
  const cameraForward = useRef(new THREE.Vector3())
  const cameraRight = useRef(new THREE.Vector3())
  const moveDir = useRef(new THREE.Vector3())
  const serverPos = useRef(new THREE.Vector3())
  const errorVec = useRef(new THREE.Vector3())
  
  // Jitter Fix: Visual Offset for reconciliation hiding
  const visualOffset = useRef(new THREE.Vector3())
  
  // Phase 16: Player Visual-Physics Separation
  const visualPosition = useRef(new THREE.Vector3(...spawnPosition))
  
  // Phase 18: Reconciliation Error Spreading
  const errorAccumulator = useRef(new THREE.Vector3(0, 0, 0))
  
  // Jitter Fix: Physics tick tracking for reliable input history
  const physicsTick = useRef(0)

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
  const currentJumpRequestId = useRef(0)
  const prevJumpRequestId = useRef(0)
  const pendingKick = useRef(false)
  const pendingKickTimestamp = useRef(0)

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
  // Fixed timestep accumulator
  const accumulator = useRef(0)
  const subFrameAccumulator = useRef(0)
  const FIXED_TIMESTEP = PHYSICS.FIXED_TIMESTEP
  const inputHistory = useRef([])

  useFrame((state, delta) => {
    if (!groupRef.current) return

    const now = state.clock.getElapsedTime()
    const input = InputManager.getInput()
    
    // Buffer events
    if (input.jumpRequestId > currentJumpRequestId.current) {
      currentJumpRequestId.current = input.jumpRequestId
    }
    if (input.kick) {
      pendingKick.current = true
      pendingKickTimestamp.current = input.kickTimestamp
    }
    
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
    subFrameAccumulator.current += delta
    
    // Physics loop - Sub-Frame Precision (120Hz)
    // We run physics faster than server to catch input nuances
    while (subFrameAccumulator.current >= SUB_FRAME_TIMESTEP) {
      // Increment simulation tick (virtual sub-ticks)
      // We map 2 sub-ticks to 1 server tick roughly
      
      // 1. Apply Gravity first (matches server)
      verticalVelocity.current -= GRAVITY * SUB_FRAME_TIMESTEP

      // 2. Ground Check (reset jump count if on ground)
      if (physicsPosition.current.y <= GROUND_Y + PHYSICS.GROUND_CHECK_EPSILON && verticalVelocity.current <= 0) {
        jumpCount.current = 0
      }

      // 3. Handle Jump (overrides gravity for this frame)
      const jumpRequested = currentJumpRequestId.current > prevJumpRequestId.current
      if (jumpRequested && jumpCount.current < MAX_JUMPS) {
        const jumpMult = serverState?.jumpMult || 1
        const baseJumpForce = JUMP_FORCE * jumpMult
        verticalVelocity.current = jumpCount.current === 0 ? baseJumpForce : baseJumpForce * DOUBLE_JUMP_MULTIPLIER
        jumpCount.current++
        isOnGround.current = false
        AudioManager.playSFX('jump')
        
        // Mark this jump ID as processed
        prevJumpRequestId.current = currentJumpRequestId.current
        
        // Init jump prediction
        jumpPredictionState.current = {
          predictedY: physicsPosition.current.y,
          predictedVy: verticalVelocity.current,
          confidence: 1.0,
          startTick: physicsTick.current
        }
      }

      // Apply physics (local prediction)
      const speedMult = serverState?.speedMult || 1
      const speed = MOVE_SPEED * speedMult
      // Smoothed velocity (matches server 0.8 factor)
      const targetVx = moveDir.current.x * speed
      const targetVz = moveDir.current.z * speed
      
      // Instant stop when no input, smooth otherwise (matches server)
      if (targetVx === 0 && targetVz === 0) {
        velocity.current.x = 0
        velocity.current.z = 0
      } else {
        const smoothing = PHYSICS.VELOCITY_SMOOTHING_SUB
        velocity.current.x = velocity.current.x + (targetVx - velocity.current.x) * smoothing
        velocity.current.z = velocity.current.z + (targetVz - velocity.current.z) * smoothing
      }
      
      // 4. Calculate new physics position
      let newX = physicsPosition.current.x + velocity.current.x * SUB_FRAME_TIMESTEP
      let newY = physicsPosition.current.y + verticalVelocity.current * SUB_FRAME_TIMESTEP
      let newZ = physicsPosition.current.z + velocity.current.z * SUB_FRAME_TIMESTEP

      // 5. Ground Clamp
      if (newY <= GROUND_Y) {
        newY = GROUND_Y
        verticalVelocity.current = 0
        isOnGround.current = true
        jumpCount.current = 0
      }

      // Bounds checking
      newX = Math.max(-PHYSICS.ARENA_HALF_WIDTH, Math.min(PHYSICS.ARENA_HALF_WIDTH, newX))
      newZ = Math.max(-PHYSICS.ARENA_HALF_DEPTH, Math.min(PHYSICS.ARENA_HALF_DEPTH, newZ))

      // Update physics position
      physicsPosition.current.set(newX, newY, newZ)

      // Decrement accumulator
      subFrameAccumulator.current -= SUB_FRAME_TIMESTEP
    }
    
    // Server Tick Sync (60Hz) - Record history for reconciliation
    while (accumulator.current >= FIXED_TIMESTEP) {
      physicsTick.current++
      
      // RECORD INPUT HISTORY (1:1 with server tick)
      inputHistory.current.push({
        tick: physicsTick.current,
        x: moveDir.current.x,
        z: moveDir.current.z,
        jumpRequestId: currentJumpRequestId.current,
        rotY: groupRef.current.rotation.y,
        timestamp: typeof performance !== 'undefined' ? performance.now() : Date.now()
      })
      
      // Keep buffer size manageable (2 seconds @ 60Hz = 120 items)
      if (inputHistory.current.length > 120) {
        inputHistory.current.shift()
      }
      
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
      const impulseY = 0.3 * kickPower // Server adds 0.8 vertical boost automatically
      const impulseZ = forwardZ * kickPower + velocity.current.z * 2

      // Send to server
      sendKick({
        impulseX,
        impulseY,
        impulseZ,
        timestamp: pendingKickTimestamp.current
      })
      
      AudioManager.playSFX('kick')

      // Phase 20: Collision Response Refinement (Impulse Ramping)
      // We send the full impulse to server, but local prediction can ramp it
      if (ballRef?.current?.userData?.predictKick) {
        ballRef.current.userData.predictKick({
          x: impulseX,
          y: impulseY + PHYSICS.KICK_VERTICAL_BOOST * kickMult,
          z: impulseZ
        }, pendingKickTimestamp.current)
      }
      pendingKick.current = false
    }

    // Visual Interpolation (Smooth Glide)
    // Jitter Fix: Velocity-aware smoothing + Visual Offset Decay
    
    // 1. Decay visual offset (hide the snap)
    // Use damp for frame-rate independent smoothing
    // Lower lambda = slower decay = smoother correction
    const decayLambda = 2.5 
    visualOffset.current.x = THREE.MathUtils.damp(visualOffset.current.x, 0, decayLambda, delta)
    visualOffset.current.y = THREE.MathUtils.damp(visualOffset.current.y, 0, decayLambda, delta)
    visualOffset.current.z = THREE.MathUtils.damp(visualOffset.current.z, 0, decayLambda, delta)
    
    // Phase 19: Movement Input Prediction (Anticipatory Visual Offset)
    // Add a small offset in the direction of input for instant feel
    const inputOffset = new THREE.Vector3(moveDir.current.x, 0, moveDir.current.z).multiplyScalar(0.1)
    const targetVisualPos = physicsPosition.current.clone().add(visualOffset.current).add(inputOffset)
    
    // Phase 18: Error Spreading (Apply accumulated error)
    visualPosition.current.addScaledVector(errorAccumulator.current, delta * 5)
    errorAccumulator.current.multiplyScalar(0.9) // Decay error
    
    // 3. Apply smoothing
    const baseLambda = PHYSICS.VISUAL_LAMBDA_MIN
    const speedFactor = Math.min(1, velocity.current.length() / 10)
    const visualLambda = baseLambda + speedFactor * (PHYSICS.VISUAL_LAMBDA_MAX - baseLambda)
    
    // Head Stabilization: Use higher damping for Y-axis (height) to prevent bobbing
    const headLambda = PHYSICS.HEAD_STABILIZATION_LAMBDA
    
    // Interpolate visualPosition toward physics target
    visualPosition.current.x = THREE.MathUtils.damp(visualPosition.current.x, targetVisualPos.x, visualLambda, delta)
    visualPosition.current.y = THREE.MathUtils.damp(visualPosition.current.y, targetVisualPos.y, headLambda, delta)
    visualPosition.current.z = THREE.MathUtils.damp(visualPosition.current.z, targetVisualPos.z, visualLambda, delta)

    groupRef.current.position.copy(visualPosition.current)

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
      // Initialize physicsTick if this is the first server state
      if (lastReconciledTick.current === 0) {
        physicsTick.current = serverState.tick
      }

      lastReconciledTick.current = serverState.tick
      
      // 1. Calculate error between predicted position and server position
      serverPos.current.set(serverState.x, serverState.y, serverState.z)
      errorVec.current.copy(serverPos.current).sub(physicsPosition.current)
      const errorMagnitude = errorVec.current.length()
      
        // Phase 18: Error Spreading (Reconciliation Smoothing)
        // Instead of snapping physics instantly, we accumulate the error and spread it
        const posError = serverPos.current.clone().sub(physicsPosition.current)
        if (posError.lengthSq() > 0.0001) {
          errorAccumulator.current.addScaledVector(posError, 0.1) // Accumulate 10% of error
        }
        
        // Capture position BEFORE snap for visual offset (legacy jitter fix compatibility)
        const beforeSnap = physicsPosition.current.clone()
        
        // HARD SNAP PHYSICS (Authority)
        physicsPosition.current.copy(serverPos.current)
        
        // Phase 17: Jump Prediction Refinement
        // Blend vertical velocity toward server state for more consistent jumps
        const serverVy = serverState.vy || 0
        verticalVelocity.current = THREE.MathUtils.lerp(verticalVelocity.current, serverVy, 0.5)
        
        velocity.current.set(serverState.vx, serverState.vy, serverState.vz)
        jumpCount.current = serverState.jumpCount || 0
        
        // Replay inputs...
        // (rest of replay logic remains same)
        
        // Replay inputs
        const validHistory = inputHistory.current.filter(h => h.tick > serverState.tick)
        
        // Find the input state at the start of replay (server state) to know the initial jump ID
        const startInput = inputHistory.current.find(h => h.tick === serverState.tick)
        let replayLastJumpId = startInput ? startInput.jumpRequestId : 0
        
        validHistory.forEach(input => {
          // Jitter Fix: 1:1 Replay (1 step per history item)
          // No loop needed because we record 1 item per physics step now
          
          // Apply Gravity
          verticalVelocity.current -= GRAVITY * FIXED_TIMESTEP
          
          // Ground Check
          if (physicsPosition.current.y <= GROUND_Y + PHYSICS.GROUND_CHECK_EPSILON && verticalVelocity.current <= 0) {
            jumpCount.current = 0
          }
          
          // Jump
          // Detect change in jumpRequestId
          if (input.jumpRequestId > replayLastJumpId && jumpCount.current < MAX_JUMPS) {
             const jumpMult = serverState.jumpMult || 1
             const baseJumpForce = JUMP_FORCE * jumpMult
             verticalVelocity.current = jumpCount.current === 0 ? baseJumpForce : baseJumpForce * DOUBLE_JUMP_MULTIPLIER
             jumpCount.current++
             isOnGround.current = false
             replayLastJumpId = input.jumpRequestId
          }
          
          // Movement
          const speedMult = serverState.speedMult || 1
          const speed = MOVE_SPEED * speedMult
          const targetVx = (input.x || 0) * speed
          const targetVz = (input.z || 0) * speed
          
          if (targetVx === 0 && targetVz === 0) {
            velocity.current.x = 0
            velocity.current.z = 0
          } else {
            const smoothing = PHYSICS.VELOCITY_SMOOTHING
            velocity.current.x = velocity.current.x + (targetVx - velocity.current.x) * smoothing
            velocity.current.z = velocity.current.z + (targetVz - velocity.current.z) * smoothing
          }
          
          // Integrate
          let newX = physicsPosition.current.x + velocity.current.x * FIXED_TIMESTEP
          let newY = physicsPosition.current.y + verticalVelocity.current * FIXED_TIMESTEP
          let newZ = physicsPosition.current.z + velocity.current.z * FIXED_TIMESTEP
          
          // Ground Clamp
          if (newY <= GROUND_Y) {
            newY = GROUND_Y
            verticalVelocity.current = 0
            jumpCount.current = 0
          }
          
          // Bounds
          newX = Math.max(-PHYSICS.ARENA_HALF_WIDTH, Math.min(PHYSICS.ARENA_HALF_WIDTH, newX))
          newZ = Math.max(-PHYSICS.ARENA_HALF_DEPTH, Math.min(PHYSICS.ARENA_HALF_DEPTH, newZ))
          
          physicsPosition.current.set(newX, newY, newZ)
        })
        
        // Sync physics tick to the end of replay
        if (validHistory.length > 0) {
          physicsTick.current = validHistory[validHistory.length - 1].tick
        } else {
          physicsTick.current = serverState.tick
        }

        inputHistory.current = validHistory
        
        visualOffset.current.x += beforeSnap.x - physicsPosition.current.x
        visualOffset.current.y += beforeSnap.y - physicsPosition.current.y
        visualOffset.current.z += beforeSnap.z - physicsPosition.current.z
      }

    groupRef.current.userData.velocity = velocity.current // Expose velocity for ball prediction
    groupRef.current.userData.velocityMagnitude = velocity.current.length()
    groupRef.current.userData.isRunning = velocity.current.length() > PHYSICS.COLLISION_VELOCITY_THRESHOLD
    groupRef.current.userData.velocityTimestamp = now // Timestamp for temporal correlation

    // Check power-up collisions
    checkPowerUpCollision(physicsPosition.current)

    // Send input batch to server (throttled at 60Hz)
    if (now - lastInputTime.current >= INPUT_SEND_RATE && sendInput) {
      lastInputTime.current = now
      inputSequence.current++
      
      // Get all inputs generated since last send
      // We filter history to find inputs that haven't been acknowledged yet?
      // Actually, simpler: just send the last N inputs that cover the time since last send.
      // But we need to be precise.
      // Let's send the last 5 inputs (approx 40ms coverage) to be safe against packet loss.
      // Server will deduplicate based on tick.
      
      const inputsToSend = inputHistory.current.slice(-5) // Send last 5 ticks
      
      if (inputsToSend.length > 0) {
        sendInput({
          inputs: inputsToSend,
          seq: inputSequence.current
        })
      }

      // Consume buffered jump (it's recorded in history now)
      // No need to reset pendingJump, the ID stays until it changes
      // pendingJump.current = false 
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
