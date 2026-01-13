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

  // Pre-allocated vectors for per-frame calculations (avoids GC stutters)
  const cameraForward = useRef(new THREE.Vector3())
  const cameraRight = useRef(new THREE.Vector3())
  const moveDir = useRef(new THREE.Vector3())
  const serverPos = useRef(new THREE.Vector3())
  const errorVec = useRef(new THREE.Vector3())
  
  // Jitter Fix: Visual Offset for reconciliation hiding
  const visualOffset = useRef(new THREE.Vector3())
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
  const pendingJump = useRef(false)
  const pendingKick = useRef(false)
  
  // Coyote Time & Jump Buffer
  const lastGroundedTime = useRef(0) // Time when player was last on ground
  const jumpBufferTime = useRef(0)   // Time when jump was last requested

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
    accumulator.current += delta
    
    // Physics loop - Fixed Timestep
    while (accumulator.current >= FIXED_TIMESTEP) {
      // Increment simulation tick
      physicsTick.current++

      // 1. Apply Gravity first (matches server)
      verticalVelocity.current -= GRAVITY * FIXED_TIMESTEP

      // 2. Ground Check (reset jump count if on ground, track coyote time)
      const wasOnGround = isOnGround.current
      if (physicsPosition.current.y <= GROUND_Y + 0.05 && verticalVelocity.current <= 0) {
        jumpCount.current = 0
        isOnGround.current = true
        lastGroundedTime.current = now // Reset coyote timer
      } else {
        isOnGround.current = false
      }

      // 3. Handle Jump with Coyote Time and Jump Buffer
      // Coyote Time: Allow jump for COYOTE_TIME seconds after leaving ground
      const coyoteActive = (now - lastGroundedTime.current) < PHYSICS.COYOTE_TIME
      const canCoyoteJump = !isOnGround.current && coyoteActive && jumpCount.current === 0
      
      // Jump Buffer: If jump was pressed recently, execute it when landing
      if (pendingJump.current && !prevJump.current) {
        jumpBufferTime.current = now // Record when jump was requested
      }
      const jumpBuffered = (now - jumpBufferTime.current) < PHYSICS.JUMP_BUFFER_TIME
      
      // Determine if we should jump
      const wantsJump = pendingJump.current && !prevJump.current
      const bufferedLanding = jumpBuffered && wasOnGround === false && isOnGround.current
      const shouldJump = (wantsJump || bufferedLanding) && 
                         (isOnGround.current || canCoyoteJump || jumpCount.current < MAX_JUMPS)
      
      if (shouldJump && jumpCount.current < MAX_JUMPS) {
        const jumpMult = serverState?.jumpMult || 1
        const baseJumpForce = JUMP_FORCE * jumpMult
        verticalVelocity.current = jumpCount.current === 0 ? baseJumpForce : baseJumpForce * DOUBLE_JUMP_MULTIPLIER
        jumpCount.current++
        isOnGround.current = false
        jumpBufferTime.current = 0 // Clear buffer after successful jump
        AudioManager.playSFX('jump')
      }
      prevJump.current = pendingJump.current

      // Apply physics (local prediction)
      const speedMult = serverState?.speedMult || 1
      const speed = MOVE_SPEED * speedMult
      // Smoothed velocity (matches server 0.8 factor)
      const targetVx = moveDir.current.x * speed
      const targetVz = moveDir.current.z * speed
      velocity.current.x = velocity.current.x + (targetVx - velocity.current.x) * 0.8
      velocity.current.z = velocity.current.z + (targetVz - velocity.current.z) * 0.8
      
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

      // RECORD INPUT HISTORY (1:1 with physics tick)
      inputHistory.current.push({
        tick: physicsTick.current,
        x: moveDir.current.x,
        z: moveDir.current.z,
        jump: pendingJump.current,
        rotY: groupRef.current.rotation.y
      })
      
      // Keep buffer size manageable (2 seconds @ 120Hz = 240 items)
      if (inputHistory.current.length > 240) {
        inputHistory.current.shift()
      }

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
    // Jitter Fix: Velocity-aware smoothing + Visual Offset Decay
    
    // 1. Decay visual offset (hide the snap)
    visualOffset.current.lerp(new THREE.Vector3(0, 0, 0), 0.1) // Fast decay (10% per frame)
    
    // 2. Calculate target visual position
    const targetVisualPos = physicsPosition.current.clone().add(visualOffset.current)
    
    // 3. Apply smoothing
    const speed = velocity.current.length()
    const baseLambda = 12
    const speedFactor = Math.min(1, speed / 10)
    const visualLambda = baseLambda + speedFactor * 8 // Range: 12 - 20
    
    groupRef.current.position.x = THREE.MathUtils.damp(groupRef.current.position.x, targetVisualPos.x, visualLambda, delta)
    groupRef.current.position.y = THREE.MathUtils.damp(groupRef.current.position.y, targetVisualPos.y, visualLambda, delta)
    groupRef.current.position.z = THREE.MathUtils.damp(groupRef.current.position.z, targetVisualPos.z, visualLambda, delta)

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
      
      // 2. Decide whether to reconcile
      // Jitter Fix: Visual Offset Pattern
      // We snap physics INSTANTLY to be correct, but use a visual offset to hide the snap
      // Latency-Adaptive Threshold: Higher ping = more lenient to reduce jitter
      const BASE_THRESHOLD = 0.01 // 1cm - strict physics sync
      const PING_SCALE = 0.0002   // 0.02cm per 100ms ping
      const MAX_THRESHOLD = 0.15  // Cap at 15cm even for very high ping
      const RECONCILE_THRESHOLD = Math.min(MAX_THRESHOLD, BASE_THRESHOLD + ping * PING_SCALE)

      if (errorMagnitude > RECONCILE_THRESHOLD) {
        // Capture position BEFORE snap
        const beforeSnap = physicsPosition.current.clone()
        
        // HARD SNAP PHYSICS
        physicsPosition.current.copy(serverPos.current)
        velocity.current.set(serverState.vx, serverState.vy, serverState.vz)
        verticalVelocity.current = serverState.vy
        jumpCount.current = serverState.jumpCount || 0
        
        // Replay inputs with coyote time and jump buffer
        const validHistory = inputHistory.current.filter(h => h.tick > serverState.tick)
        
        // Replay state tracking
        let replayLastGroundedTick = serverState.tick
        let replayJumpBufferTick = 0
        let replayIsOnGround = serverState.y <= GROUND_Y + 0.05
        let replayPrevJump = false
        
        validHistory.forEach((input, idx) => {
          const replayTick = serverState.tick + idx + 1
          
          // Apply Gravity
          verticalVelocity.current -= GRAVITY * FIXED_TIMESTEP
          
          // Ground Check with coyote time tracking
          const wasOnGround = replayIsOnGround
          if (physicsPosition.current.y <= GROUND_Y + 0.05 && verticalVelocity.current <= 0) {
            jumpCount.current = 0
            replayIsOnGround = true
            replayLastGroundedTick = replayTick
          } else {
            replayIsOnGround = false
          }
          
          // Coyote Time (convert to ticks)
          const coyoteTicks = Math.floor(PHYSICS.COYOTE_TIME * PHYSICS.TICK_RATE)
          const ticksSinceGrounded = replayTick - replayLastGroundedTick
          const coyoteActive = ticksSinceGrounded < coyoteTicks
          const canCoyoteJump = !replayIsOnGround && coyoteActive && jumpCount.current === 0
          
          // Jump Buffer
          const jumpBufferTicks = Math.floor(PHYSICS.JUMP_BUFFER_TIME * PHYSICS.TICK_RATE)
          if (input.jump && !replayPrevJump) {
            replayJumpBufferTick = replayTick
          }
          const ticksSinceJumpRequest = replayTick - replayJumpBufferTick
          const jumpBuffered = ticksSinceJumpRequest < jumpBufferTicks && replayJumpBufferTick > 0
          
          // Determine if should jump
          const wantsJump = input.jump && !replayPrevJump
          const bufferedLanding = jumpBuffered && !wasOnGround && replayIsOnGround
          const shouldJump = (wantsJump || bufferedLanding) && 
                             (replayIsOnGround || canCoyoteJump || jumpCount.current < MAX_JUMPS)
          
          if (shouldJump && jumpCount.current < MAX_JUMPS) {
             const jumpMult = serverState.jumpMult || 1
             const baseJumpForce = JUMP_FORCE * jumpMult
             verticalVelocity.current = jumpCount.current === 0 ? baseJumpForce : baseJumpForce * DOUBLE_JUMP_MULTIPLIER
             jumpCount.current++
             replayIsOnGround = false
             replayJumpBufferTick = 0
          }
          replayPrevJump = input.jump
          
          // Movement
          const speedMult = serverState.speedMult || 1
          const speed = MOVE_SPEED * speedMult
          const targetVx = (input.x || 0) * speed
          const targetVz = (input.z || 0) * speed
          
          velocity.current.x = velocity.current.x + (targetVx - velocity.current.x) * 0.8
          velocity.current.z = velocity.current.z + (targetVz - velocity.current.z) * 0.8
          
          // Integrate
          let newX = physicsPosition.current.x + velocity.current.x * FIXED_TIMESTEP
          let newY = physicsPosition.current.y + verticalVelocity.current * FIXED_TIMESTEP
          let newZ = physicsPosition.current.z + velocity.current.z * FIXED_TIMESTEP
          
          // Ground Clamp
          if (newY <= GROUND_Y) {
            newY = GROUND_Y
            verticalVelocity.current = 0
            jumpCount.current = 0
            replayIsOnGround = true
            replayLastGroundedTick = replayTick
          }
          
          // Bounds
          const wallMargin = 0.3
          newX = Math.max(-15 + wallMargin, Math.min(15 - wallMargin, newX))
          newZ = Math.max(-10 + wallMargin, Math.min(10 - wallMargin, newZ))
          
          physicsPosition.current.set(newX, newY, newZ)
        })
        
        // Sync physics tick to the end of replay
        if (validHistory.length > 0) {
          physicsTick.current = validHistory[validHistory.length - 1].tick
        } else {
          physicsTick.current = serverState.tick
        }

        inputHistory.current = validHistory
        
        // VISUAL OFFSET CALCULATION
        // Offset = OldPos - NewPos
        // We add this to the current offset so multiple snaps accumulate correctly
        const afterSnap = physicsPosition.current
        visualOffset.current.x += beforeSnap.x - afterSnap.x
        visualOffset.current.y += beforeSnap.y - afterSnap.y
        visualOffset.current.z += beforeSnap.z - afterSnap.z
      }
    }

    groupRef.current.userData.velocity = velocity.current // Expose velocity for ball prediction
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
