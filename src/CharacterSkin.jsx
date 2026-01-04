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
  invisible = false,
  giant = false,
  children,
  ref
}) {
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
          
          // Ensure textures are filtered well
          if (child.material.map) {
            child.material.map.anisotropy = 16
            child.material.map.minFilter = THREE.LinearMipmapLinearFilter
            child.material.map.magFilter = THREE.LinearFilter
            child.material.map.needsUpdate = true
          }

          child.material.transparent = false
          child.material.opacity = 1.0
          child.material.side = THREE.FrontSide
          child.material.roughness = 0.6
          child.material.metalness = 0.1
          child.material.envMapIntensity = 0.4
          child.material.flatShading = false
          child.material.needsUpdate = true
        }
        child.castShadow = true
        child.receiveShadow = true
        
        // Smooth shading
        if (child.geometry) {
          child.geometry.computeVertexNormals()
        }
      }
    })
    return cloned
  }, [scene, teamColor])
  
  // Handle visual effects (invisibility)
  React.useEffect(() => {
    if (!ref || !ref.current) return
    const targetOpacity = invisible ? 0.2 : 1.0
    ref.current.traverse((child) => {
      if (child.isMesh && child.material) {
        const isTransparent = targetOpacity < 0.99
        child.material.transparent = isTransparent
        child.material.depthWrite = !isTransparent
        child.material.opacity = targetOpacity
        child.material.needsUpdate = true
      }
    })
  }, [invisible, ref])

  // Handle visual effects (giant scaling)
  useFrame((_, delta) => {
    if (!ref || !ref.current) return
    
    // Apply giant scaling effect
    const targetScale = giant ? 6.0 : 1.0
    if (Math.abs(ref.current.scale.x - targetScale) > 0.01) {
      ref.current.scale.lerp(
        new THREE.Vector3(targetScale, targetScale, targetScale), 
        0.1
      )
    }
  })
  
  return (
    <group ref={ref}>
      <primitive 
        object={clonedScene} 
        scale={characterScale} 
      />
      {children}
    </group>
  )
}

export default CharacterSkin
