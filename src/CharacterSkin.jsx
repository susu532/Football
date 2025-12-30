import React, { forwardRef, useRef, useEffect } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import * as CANNON from 'cannon-es'

// Single player model path (cat model for all players)
const PLAYER_MODEL_PATH = '/models/cat.glb'

const CharacterSkin = forwardRef(function CharacterSkin({ 
  position = [0, 0, 0], 
  teamColor = '#888',
  remotePlayers = {},
  ballBody = null,
  onKick = null,
  powerUps = [],
  onCollectPowerUp = null,
  onPowerUpActive = null,
  isFreeLook = null,
  children 
}, ref) {
  const groupRef = useRef()
  
  // Power-up effects state
  const effects = useRef({
    speed: 1,
    jump: 1,
    kick: 1,
    invisible: false
  })
  
  // Get camera for relative movement
  const { camera } = useThree()
  
  // Load the GLB model
  const { scene } = useGLTF(PLAYER_MODEL_PATH)
  
  // Clone the scene to avoid sharing state between instances
  const clonedScene = React.useMemo(() => {
    const cloned = scene.clone()
    cloned.traverse((child) => {
      if (child.isMesh) {
        // Ensure material is unique
        if (child.material) {
          child.material = child.material.clone()
          // Apply team color to the model
          child.material.color = new THREE.Color(teamColor)
          // Fix visibility issues
          child.material.transparent = true // Enable transparency for invisibility effect
          child.material.opacity = 1.0
          child.material.side = THREE.DoubleSide
          child.material.needsUpdate = true
        }
        child.castShadow = true
        child.receiveShadow = true
      }
    })
    return cloned
  }, [scene, teamColor])
  
  // Update opacity based on invisibility effect
  useFrame(() => {
    if (groupRef.current) {
      // Sync internal effect state to userData for network transmission
      groupRef.current.userData.invisible = effects.current.invisible
      
      const targetOpacity = effects.current.invisible ? 0.2 : 1.0
      groupRef.current.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.opacity = THREE.MathUtils.lerp(child.material.opacity, targetOpacity, 0.1)
          // Ensure transparency is enabled if opacity < 1
          child.material.transparent = true
        }
      })
    }
  })

  // Expose position via ref
  useEffect(() => {
    if (ref) {
      if (typeof ref === 'function') {
        ref(groupRef.current)
      } else {
        ref.current = groupRef.current
      }
    }
  }, [ref])
  
  // Handle keyboard input and movement
  const keys = useRef({})
  const velocity = useRef(new THREE.Vector3())
  const verticalVelocity = useRef(0)
  const isOnGround = useRef(true)
  
  useEffect(() => {
    const handleKeyDown = (e) => {
      keys.current[e.key.toLowerCase()] = true
      keys.current[e.code.toLowerCase()] = true
    }
    const handleKeyUp = (e) => {
      keys.current[e.key.toLowerCase()] = false
      keys.current[e.code.toLowerCase()] = false
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  useFrame((_, delta) => {
    if (!groupRef.current) return
    

    
    // Apply power-up multipliers
    const speed = 8 * effects.current.speed
    const gravity = 20
    const jumpForce = 8 * effects.current.jump
    const groundY = 0.1
    const playerRadius = 0.5
    
    // Power-up Collision Detection
    if (onCollectPowerUp) {
      powerUps.forEach(p => {
        const dx = groupRef.current.position.x - p.position[0]
        const dz = groupRef.current.position.z - p.position[2]
        const dist = Math.sqrt(dx*dx + dz*dz)
        
        // Check X and Z distance (ignore height/elevation)
        if (dist < 1.5) { // Increased radius for easier collection
          onCollectPowerUp(p.id)
          
          // Trigger UI indicator
          if (onPowerUpActive) {
            onPowerUpActive(p.type)
          }
          
          // Apply Effect
          if (p.type === 'speed') {
            effects.current.speed = 2.0 // Double speed
            setTimeout(() => effects.current.speed = 1, 15000)
          } else if (p.type === 'jump') {
            effects.current.jump = 2.0 // Double jump power
            setTimeout(() => effects.current.jump = 1, 15000)
          } else if (p.type === 'kick') {
            effects.current.kick = 2.0 // Double kick power
            setTimeout(() => effects.current.kick = 1, 15000)
          } else if (p.type === 'invisible') {
            effects.current.invisible = true
            setTimeout(() => effects.current.invisible = false, 15000)
          }
        }
      })
    }
    
    // Get input direction
    let inputX = 0, inputZ = 0
    
    // QWERTY: WASD, AZERTY: ZQSD, Plus Arrow keys
    if (keys.current['w'] || keys.current['z'] || keys.current['arrowup']) inputZ -= 1
    if (keys.current['s'] || keys.current['arrowdown']) inputZ += 1
    if (keys.current['a'] || keys.current['q'] || keys.current['arrowleft']) inputX -= 1
    if (keys.current['d'] || keys.current['arrowright']) inputX += 1
    
    // Get camera direction (horizontal only)
    const cameraForward = new THREE.Vector3()
    camera.getWorldDirection(cameraForward)
    cameraForward.y = 0
    cameraForward.normalize()
    
    const cameraRight = new THREE.Vector3()
    cameraRight.crossVectors(cameraForward, new THREE.Vector3(0, 1, 0))
    cameraRight.normalize()
    
    // Calculate movement direction relative to camera
    const moveDir = new THREE.Vector3()
    moveDir.addScaledVector(cameraForward, -inputZ)
    moveDir.addScaledVector(cameraRight, inputX)
    
    if (moveDir.length() > 0) {
      moveDir.normalize()
    }

    // Always rotate player to face camera direction (Strafe Mode)
    // UNLESS Free Look is active
    if (!isFreeLook || !isFreeLook.current) {
      const targetAngle = Math.atan2(cameraForward.x, cameraForward.z)
      const currentRot = groupRef.current.rotation.y
      let rotDiff = targetAngle - currentRot
      // Normalize angle difference
      while (rotDiff > Math.PI) rotDiff -= Math.PI * 2
      while (rotDiff < -Math.PI) rotDiff += Math.PI * 2
      
      // Smoothly rotate
      groupRef.current.rotation.y += rotDiff * Math.min(1, 20 * delta)
    }
    
    // Apply horizontal velocity with lerp for smooth movement
    velocity.current.x = THREE.MathUtils.lerp(velocity.current.x, moveDir.x * speed, 0.15)
    velocity.current.z = THREE.MathUtils.lerp(velocity.current.z, moveDir.z * speed, 0.15)

    // Player-Player Collision Detection
    const nextX = groupRef.current.position.x + velocity.current.x * delta
    const nextZ = groupRef.current.position.z + velocity.current.z * delta
    
    Object.values(remotePlayers).forEach(p => {
      // Skip invalid players or players near center (uninitialized)
      if (!p.position) return
      // Skip players near center (within 1 unit of origin on X/Z plane)
      if (Math.abs(p.position[0]) < 1 && Math.abs(p.position[2]) < 1) return
      
      const dx = nextX - p.position[0]
      const dz = nextZ - p.position[2]
      const dist = Math.sqrt(dx*dx + dz*dz)
      const minDist = playerRadius * 2 // 0.5 + 0.5
      
      if (dist < minDist) {
        // Collision detected - push back
        const pushDir = new THREE.Vector3(dx, 0, dz).normalize()
        const pushForce = (minDist - dist) / delta // Push out of collision
        
      }
    })

    // Active Dribble: Push ball further when moving into it
    if (ballBody) {
      const pPos = groupRef.current.position
      const bPos = ballBody.position
      const dx = bPos.x - pPos.x
      const dz = bPos.z - pPos.z
      const dist = Math.sqrt(dx*dx + dz*dz)
      
      // Interaction radius (Player 0.5 + Ball 0.22 + margin)
      if (dist < 1.0) {
        // Calculate player speed
        const speed = Math.sqrt(velocity.current.x**2 + velocity.current.z**2)
        
        if (speed > 1.0) {
          // Player is moving fast enough to "dribble"
          // Apply impulse in direction of PLAYER MODEL FACING
          // User request: "make it follow the direction of the model"
          
          const dribblePower = 0.35 // Further reduced for very tight control
          const rotation = groupRef.current.rotation.y
          
          // Calculate forward vector from rotation
          const forwardX = Math.sin(rotation)
          const forwardZ = Math.cos(rotation)
          
          ballBody.applyImpulse(
            new CANNON.Vec3(
              forwardX * dribblePower * delta * speed, // Scale by speed for control
              0,
              forwardZ * dribblePower * delta * speed
            ),
            bPos
          )
        }
      }
    }

    
    // Jump with space
    if ((keys.current[' '] || keys.current['space']) && isOnGround.current) {
      verticalVelocity.current = jumpForce
      isOnGround.current = false
    }
    
    // Power Kick with F key
    if (keys.current['f'] && ballBody) {
      const playerPos = groupRef.current.position
      const ballPos = ballBody.position
      
      // Calculate distance to ball (on ground plane)
      const dx = ballPos.x - playerPos.x
      const dz = ballPos.z - playerPos.z
      const distance = Math.sqrt(dx * dx + dz * dz)
      
      // Only kick if close enough (within 2.0 units)
      const kickRange = 2.0
      if (distance < kickRange) {
        // 1. Check if player is roughly facing the ball (dot product)
        const playerForward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), groupRef.current.rotation.y)
        const toBall = new THREE.Vector3(dx, 0, dz).normalize()
        const dot = playerForward.dot(toBall)
        
        // Allow kick if facing within ~90 degrees (dot > 0)
        if (dot > 0) {
          // 2. Aiming: Use camera direction for precision aiming
          const aimDir = new THREE.Vector3()
          camera.getWorldDirection(aimDir)
          aimDir.y = 0
          aimDir.normalize()
          
          // Blend camera aim with direction to ball for natural feel
          // If ball is to the side, we still want to kick it forward-ish but respecting physics
          const kickDir = new THREE.Vector3().copy(aimDir).lerp(toBall, 0.3).normalize()
          
          // 3. Vertical Lift (Chip shot vs Power shot)
          // Kick slightly up
          kickDir.y = 0.4
          kickDir.normalize()
          
          // 4. Power calculation
          const basePower = 12 * effects.current.kick // Apply kick power-up
          const randomVar = 0.95 + Math.random() * 0.1 // 0.95 - 1.05 variation (less random)
          const kickPower = basePower * randomVar
          
          // 5. Apply Impulse
          // Apply at a point slightly offset from center to create spin
          // Hitting bottom-center creates backspin (lift)
          const impulsePoint = new CANNON.Vec3(
            ballPos.x, 
            ballPos.y - 0.05, // Reduced offset for less spin
            ballPos.z
          )
          
          const impulse = new CANNON.Vec3(
            kickDir.x * kickPower,
            kickDir.y * kickPower,
            kickDir.z * kickPower
          )
          
          ballBody.applyImpulse(impulse, impulsePoint)
          
          // Trigger callback
          if (onKick) onKick()
          
          // Cooldown
          keys.current['f'] = false
        }
      }
    }
    
    // Apply gravity
    verticalVelocity.current -= gravity * delta
    
    // Calculate new position
    let newX = groupRef.current.position.x + velocity.current.x * delta
    let newY = groupRef.current.position.y + verticalVelocity.current * delta
    let newZ = groupRef.current.position.z + velocity.current.z * delta
    
    // Ground check
    if (newY <= groundY) {
      newY = groundY
      verticalVelocity.current = 0
      isOnGround.current = true
    }
    
    // Bounds checking
    const pitchWidth = 30
    const pitchDepth = 20
    const wallMargin = 0.5 // Player radius
    
    // Main pitch limits (x=±15, z=±10)
    newX = Math.max(-15 + wallMargin, Math.min(15 - wallMargin, newX))
    newZ = Math.max(-10 + wallMargin, Math.min(10 - wallMargin, newZ))
    
    // Diagonal Wall Checks REMOVED - Arena is now rectangular
    
    // Obstacle Collision (Walls)
    const obstacles = [
      // Goal Side Walls (User requested)
      { x: 13, z: -2.4, w: 4, d: 0.2 },
      { x: 13, z: 2.4, w: 4, d: 0.2 },
      { x: -13, z: -2.4, w: 4, d: 0.2 },
      { x: -13, z: 2.4, w: 4, d: 0.2 },
      
     
    ]

    obstacles.forEach(wall => {
      const halfW = wall.w / 2 + wallMargin
      const halfD = wall.d / 2 + wallMargin
      
      if (newX > wall.x - halfW && newX < wall.x + halfW &&
          newZ > wall.z - halfD && newZ < wall.z + halfD) {
          
          // Resolve collision - push to nearest edge
          const dx1 = Math.abs(newX - (wall.x - halfW))
          const dx2 = Math.abs(newX - (wall.x + halfW))
          const dz1 = Math.abs(newZ - (wall.z - halfD))
          const dz2 = Math.abs(newZ - (wall.z + halfD))
          
          const min = Math.min(dx1, dx2, dz1, dz2)
          
          if (min === dx1) newX = wall.x - halfW
          else if (min === dx2) newX = wall.x + halfW
          else if (min === dz1) newZ = wall.z - halfD
          else if (min === dz2) newZ = wall.z + halfD
      }
    })
    
    groupRef.current.position.x = newX
    groupRef.current.position.y = newY
    groupRef.current.position.z = newZ
  })
  
  return (
    <group ref={groupRef} position={position}>
      <primitive object={clonedScene} scale={0.01} position={[0, 0, 0]} />
      {children}
    </group>
  )
})

export default CharacterSkin
