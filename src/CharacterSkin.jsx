import React, { forwardRef, useRef, useEffect } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// Preload all character models
const SKIN_MODELS = [
  'character-male-a', 'character-male-b', 'character-male-c',
  'character-male-d', 'character-male-e', 'character-male-f',
  'character-female-a', 'character-female-b', 'character-female-c',
  'character-female-d', 'character-female-e', 'character-female-f',
]

// Preload all models
SKIN_MODELS.forEach(skin => {
  useGLTF.preload(`/models/characters/${skin}.glb`)
})

const CharacterSkin = forwardRef(function CharacterSkin({ 
  skinId = 'character-male-a', 
  position = [0, 0, 0], 
  teamColor = '#888',
  children 
}, ref) {
  const groupRef = useRef()
  const modelPath = `/models/characters/${skinId}.glb`
  
  // Get camera for relative movement
  const { camera } = useThree()
  
  // Load the GLB model
  const { scene } = useGLTF(modelPath)
  
  // Clone the scene to avoid sharing state between instances
  const clonedScene = React.useMemo(() => {
    const cloned = scene.clone()
    cloned.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material = child.material.clone()
        child.castShadow = true
        child.receiveShadow = true
      }
    })
    return cloned
  }, [scene])
  
  // Expose position via ref - use useImperativeHandle pattern
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
    
    const speed = 8
    const gravity = 20
    const jumpForce = 8
    const groundY = 0.1
    
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
      const angle = Math.atan2(moveDir.x, moveDir.z)
      groupRef.current.rotation.y = angle
    }
    
    // Apply horizontal velocity with lerp for smooth movement
    velocity.current.x = THREE.MathUtils.lerp(velocity.current.x, moveDir.x * speed, 0.15)
    velocity.current.z = THREE.MathUtils.lerp(velocity.current.z, moveDir.z * speed, 0.15)
    
    // Jump with space
    if ((keys.current[' '] || keys.current['space']) && isOnGround.current) {
      verticalVelocity.current = jumpForce
      isOnGround.current = false
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
    
    // Bounds checking (Pitch is 30x20, allow goal areas)
    const maxX = 14
    const maxZ = 12
    
    // Clamp position
    newX = Math.max(-maxX, Math.min(maxX, newX))
    newZ = Math.max(-maxZ, Math.min(maxZ, newZ))
    
    groupRef.current.position.x = newX
    groupRef.current.position.y = newY
    groupRef.current.position.z = newZ
  })
  
  return (
    <group ref={groupRef} position={position}>
      <primitive object={clonedScene} scale={1.5} position={[0, 0, 0]} />
      {children}
    </group>
  )
})

export default CharacterSkin


