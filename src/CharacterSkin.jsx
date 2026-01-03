// CharacterSkin.jsx - Pure visual component for player characters
// All movement logic has been moved to PlayerController.jsx
// This component handles: model loading, team colors, visual effects (invisible/giant)

import React, { useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const CharacterSkin = function CharacterSkin({ 
  teamColor = '#888',
  characterType = 'cat',
  isRemote = false,
  invisible = false,
  giant = false,
  children,
  ref
}) {
  const groupRef = useRef()
  
  // Forward ref to the group
  React.useImperativeHandle(ref, () => groupRef.current)
  
  // Determine model path based on character type
  const MODEL_PATH = characterType === 'cat' 
    ? '/models/cat.glb' 
    : '/models/low_poly_car.glb'
  
  // Character scaling: cat uses 0.01, car uses 0.0015
  const characterScale = characterType === 'cat' ? 0.01 : 0.0015
   
  // Load the GLB model
  const { scene } = useGLTF(MODEL_PATH)
  
  // Clone and configure the scene
  const clonedScene = useMemo(() => {
    const cloned = scene.clone()
    cloned.traverse((child) => {
      if (child.isMesh) {
        // Clone material to avoid shared state
        if (child.material) {
          child.material = child.material.clone()
          child.material.color = new THREE.Color(teamColor)
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
  
  // Handle visual effects (giant scaling, invisibility)
  useFrame((_, delta) => {
    if (!groupRef.current) return
    
    // Apply giant scaling effect
    const targetScale = giant ? 6.0 : 1.0
    groupRef.current.scale.lerp(
      new THREE.Vector3(targetScale, targetScale, targetScale), 
      0.1
    )
    
    // Apply invisibility effect
    const targetOpacity = invisible ? 0.2 : 1.0
    groupRef.current.traverse((child) => {
      if (child.isMesh && child.material) {
        const isTransparent = targetOpacity < 0.99 || child.material.opacity < 0.99
        child.material.transparent = isTransparent
        child.material.depthWrite = !isTransparent
        child.material.opacity = THREE.MathUtils.lerp(
          child.material.opacity, 
          targetOpacity, 
          0.1
        )
      }
    })
  })
  
  return (
    <group ref={groupRef}>
      <primitive 
        object={clonedScene} 
        scale={characterScale} 
      />
      {children}
    </group>
  )
}

export default CharacterSkin
