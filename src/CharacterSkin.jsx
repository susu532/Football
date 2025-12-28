import React, { forwardRef, useRef, useEffect } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
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
  
  // Load the GLB model
  const { scene } = useGLTF(modelPath)
  
  // Clone the scene to avoid sharing state between instances
  const clonedScene = React.useMemo(() => {
    const cloned = scene.clone()
    // Apply team color tint to materials (optional)
    cloned.traverse((child) => {
      if (child.isMesh && child.material) {
        // Clone material to avoid affecting other instances
        child.material = child.material.clone()
        child.castShadow = true
        child.receiveShadow = true
      }
    })
    return cloned
  }, [scene, teamColor])
  
  // Expose position via ref
  useEffect(() => {
    if (ref && groupRef.current) {
      ref.current = groupRef.current
    }
  }, [ref])
  
  // Handle keyboard input and movement
  const keys = useRef({})
  const velocity = useRef(new THREE.Vector3())
  
  useEffect(() => {
    const handleKeyDown = (e) => {
      keys.current[e.key.toLowerCase()] = true
    }
    const handleKeyUp = (e) => {
      keys.current[e.key.toLowerCase()] = false
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
    const moveDir = new THREE.Vector3()
    
    if (keys.current['w'] || keys.current['arrowup']) moveDir.z -= 1
    if (keys.current['s'] || keys.current['arrowdown']) moveDir.z += 1
    if (keys.current['a'] || keys.current['arrowleft']) moveDir.x -= 1
    if (keys.current['d'] || keys.current['arrowright']) moveDir.x += 1
    
    if (moveDir.length() > 0) {
      moveDir.normalize()
      // Rotate character to face movement direction
      const angle = Math.atan2(moveDir.x, moveDir.z)
      groupRef.current.rotation.y = angle
    }
    
    // Apply velocity
    velocity.current.lerp(moveDir.multiplyScalar(speed), 0.15)
    groupRef.current.position.x += velocity.current.x * delta
    groupRef.current.position.z += velocity.current.z * delta
    
    // Keep on ground
    groupRef.current.position.y = 0
  })
  
  return (
    <group ref={groupRef} position={position}>
      <primitive object={clonedScene} scale={0.4} />
      {children}
    </group>
  )
})

export default CharacterSkin
