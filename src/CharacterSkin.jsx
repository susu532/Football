// CharacterSkin.jsx - Pure visual component for player characters
// All movement logic has been moved to PlayerController.jsx
// This component handles: model loading, team colors, visual effects (invisible/giant)

import React, { useMemo, useRef, useImperativeHandle } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const CharacterSkin = React.forwardRef(({ 
  player,
  teamColor = '#888',
  characterType = 'cat',
  invisible = false,
  giant = false,
  isRemote = false,
  children
}, ref) => {
  const internalRef = useRef()
  useImperativeHandle(ref, () => internalRef.current)
  // Use proxy values if player is provided, otherwise fallback to props
  const isInvisible = player ? player.invisible : invisible
  const isGiant = player ? player.giant : giant

  // Determine model path based on character type
  const MODEL_PATH = characterType === 'cat' 
    ? '/models/cat.glb' 
    : '/models/low_poly_car.glb'
  
  // Character scaling: cat uses 0.025, car uses 0.004
  const characterScale = characterType === 'cat' ? 0.020 : 0.0014
   
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
            child.material.map.anisotropy = 4 // Reduced from 16
            child.material.map.minFilter = THREE.LinearMipmapLinearFilter
            child.material.map.magFilter = THREE.LinearFilter
            child.material.map.needsUpdate = true
          }

          // Use MeshStandardMaterial - cheaper than MeshPhysicalMaterial
          const oldMat = child.material
          child.material = new THREE.MeshStandardMaterial({
            map: oldMat.map,
            color: new THREE.Color(teamColor),
            transparent: false,
            opacity: 1.0,
            side: THREE.FrontSide,
            roughness: 0.8, // Increased for matte look
            metalness: 0.0,
            flatShading: false
          })
          child.material.needsUpdate = true
        }
        child.castShadow = true
        child.receiveShadow = false // Disable receive shadow for performance
        
        // REMOVED: computeVertexNormals to save CPU
      }
    })
    return cloned
  }, [scene, teamColor])
  
  // Pre-allocated vector for scale lerping (avoids GC stutters)
  const targetScaleVec = useRef(new THREE.Vector3(1, 1, 1))

  // Consolidated visual effects and animation loop
  useFrame((state, delta) => {
    if (!internalRef.current) return

    // 1. Handle visual effects (invisibility)
    const currentIsInvisible = player ? player.invisible : invisible
    const targetOpacity = currentIsInvisible ? (isRemote ? 0.0 : 0.3) : 1.0
    
    internalRef.current.traverse((child) => {
      if (child.isMesh && child.material) {
        if (Math.abs(child.material.opacity - targetOpacity) > 0.01) {
          const isTransparent = targetOpacity < 0.99
          child.material.transparent = isTransparent
          child.material.depthWrite = !isTransparent
          child.material.opacity = targetOpacity
          child.material.needsUpdate = true
        }
      }
    })

    // 2. Handle visual effects (giant scaling)
    const currentIsGiant = player ? player.giant : giant
    const targetScale = currentIsGiant ? 5.0 : 1.0
    
    if (Math.abs(internalRef.current.scale.x - targetScale) > 0.01) {
      targetScaleVec.current.set(targetScale, targetScale, targetScale)
      internalRef.current.scale.lerp(targetScaleVec.current, 0.1)
    }

    // 3. Idle Breathing Animation (only if not giant)
    if (!currentIsGiant) {
      const t = state.clock.getElapsedTime()
      const breatheScale = 1.0 + Math.sin(t * 3) * 0.03
      internalRef.current.scale.setY(breatheScale)
    }
  })
  
  return (
    <group ref={internalRef}>
      <primitive 
        object={clonedScene} 
        scale={characterScale} 
      />
      {children}
    </group>
  )
})
CharacterSkin.displayName = 'CharacterSkin'

export default CharacterSkin
