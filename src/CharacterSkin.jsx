import React, { forwardRef, useRef, useEffect, useImperativeHandle } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const CharacterSkin = forwardRef(function CharacterSkin({ 
  position = [0, 0, 0], 
  teamColor = '#888',
  remotePlayers = {},
  onKick = null,
  powerUps = [],
  onCollectPowerUp = null,
  isFreeLook = null,
  mobileInput = null, // { move: {x, y}, jump: bool, kick: bool }
  characterType = 'cat',
  isRemote = false,
  invisible = false,
  giant = false,
  onLocalInteraction = null,
  possession = null, // Added
  localPlayerId = null, // Added
  children 
}, ref) {
  const groupRef = useRef()
  
  useImperativeHandle(ref, () => groupRef.current)
  
  // Determine model path based on character type
  console.log('CharacterSkin: characterType prop:', characterType)
  const PLAYER_MODEL_PATH = characterType === 'cat' ? '/models/cat.glb' : '/models/low_poly_car.glb'
  
  // Character scaling: cat uses 0.01, car uses 0.15
  const characterScale = characterType === 'cat' ? 0.01 : 0.0015
  
  // Position offset to match cat height (car may need different base position)
  const positionOffset = characterType === 'car' ? [0, 0, 0] : [0, 0, 0]
   
  // Power-up effects state
  const effects = useRef({
    speed: 0.8,
    jump: 1,
    kick: 1,
    invisible: false,
    giant: false
  })
  
  // Get camera for relative movement
  const { camera } = useThree()
  
  // Load the GLB model dynamically based on character type
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
          // Ensure solid rendering
          child.material.transparent = false
          child.material.opacity = 1.0
          child.material.side = THREE.FrontSide
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
  const jumpCount = useRef(0) // Track number of jumps
  
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.repeat) return // Ignore auto-repeat
      
      keys.current[e.key.toLowerCase()] = true
      keys.current[e.code.toLowerCase()] = true
      
      // Jump Logic (Space)
      if (e.code === 'Space') {
        const baseJumpForce = 8 * effects.current.jump
        
        if (isOnGround.current) {
          // First Jump
          verticalVelocity.current = baseJumpForce
          isOnGround.current = false
          jumpCount.current = 1
        } else if (jumpCount.current < 2) {
          // Double Jump (0.5x force)
          verticalVelocity.current = baseJumpForce * 0.8
          jumpCount.current = 2
        }
      }
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
    
    // Update invisible state in userData for sync (only for local)
    if (!isRemote) {
      groupRef.current.userData.invisible = effects.current.invisible
      groupRef.current.userData.giant = effects.current.giant
    }
    
    // Determine current state (local vs remote)
    const isGiant = isRemote ? giant : effects.current.giant
    const isInvisible = isRemote ? invisible : effects.current.invisible

    // Apply Giant Scaling
    const targetScale = isGiant ? 6.0 : 1.0
    groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1)
    
    // Update local visual opacity
    const targetOpacity = isInvisible ? 0.2 : 1.0
    groupRef.current.traverse((child) => {
      if (child.isMesh && child.material) {
        // Only enable transparency if actually transparent or transitioning
        const isTransparent = targetOpacity < 0.99 || child.material.opacity < 0.99
        child.material.transparent = isTransparent
        child.material.depthWrite = !isTransparent // Improve depth sorting when opaque
        child.material.opacity = THREE.MathUtils.lerp(child.material.opacity, targetOpacity, 0.1)
      }
    })
    
    // Skip movement logic for remote players
    if (isRemote) return
    
    // Apply power-up multipliers
    const speed = 8 * effects.current.speed
    const gravity = 20
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
          } else if (p.type === 'giant') {
            effects.current.giant = true
            setTimeout(() => effects.current.giant = false, 15000)
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
    
    let kickRequested = keys.current['f']
    
    // Mobile joystick input (overrides keyboard if present)
    if (mobileInput && mobileInput.current) {
      const mobile = mobileInput.current
      if (mobile.move && (mobile.move.x !== 0 || mobile.move.y !== 0)) {
        inputX = mobile.move.x
        inputZ = -mobile.move.y // Invert for camera-relative movement
      }
      
      // Mobile jump
      if (mobile.jump) {
        const baseJumpForce = 8 * effects.current.jump
        if (isOnGround.current) {
          verticalVelocity.current = baseJumpForce
          isOnGround.current = false
          jumpCount.current = 1
        } else if (jumpCount.current < 2) {
          verticalVelocity.current = baseJumpForce * 0.8
          jumpCount.current = 2
        }
        mobile.jump = false // Reset
      }
      
      // Mobile kick
      if (mobile.kick) {
        kickRequested = true
        mobile.kick = false // Reset
      }
    }
    
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
      
      // Reduce turn speed when possessing the ball for more control
      const isPossessing = possession === localPlayerId
      const rotationSpeed = isPossessing ? 10 : 20
      
      // Smoothly rotate
      groupRef.current.rotation.y += rotDiff * Math.min(1, rotationSpeed * delta)
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

    // Jump logic moved to handleKeyDown
    
    // Power Kick with F key
    if (kickRequested) {
      
      if (onKick) {
        const isPossessing = possession === localPlayerId
        
        // Use full power if possessing, otherwise a lower strength (poke kick)
        const baseKickStrength = isPossessing ? 1.0 : 0.4
        
        // We need to send the direction. We can use the player's forward vector.
        const rotation = groupRef.current.rotation.y
        const forwardX = Math.sin(rotation)
        const forwardZ = Math.cos(rotation)
        
        // Calculate kick direction (slightly up)
        const kickDir = new THREE.Vector3(forwardX, 0.5, forwardZ).normalize()
        const kickPower = 25 * effects.current.kick
        
        onKick({
          impulse: [kickDir.x * kickPower, kickDir.y * kickPower, kickDir.z * kickPower],
          point: [groupRef.current.position.x, groupRef.current.position.y, groupRef.current.position.z],
          kickStrength: baseKickStrength // Send strength to host for scaling
        })
      }
      
      // Cooldown
      keys.current['f'] = false
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
      jumpCount.current = 0 // Reset jump count on landing
    }
    
    // Bounds checking
    const pitchWidth = 30
    const pitchDepth = 20
    const wallMargin = 0.3 // Player radius
    
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
    <group ref={groupRef} position={[position[0], position[1], position[2]]}>
      <primitive 
        object={clonedScene} 
        scale={characterScale} 
        position={[positionOffset[0], positionOffset[1], positionOffset[2]]} 
      />
      {children}
    </group>
  )
})

export default CharacterSkin
