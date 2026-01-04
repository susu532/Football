import React from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'



export const MysteryShack = React.memo(function MysteryShack() {
  const gltf = useGLTF('/models/gravity_falls.glb', true)
  const scene = React.useMemo(() => {
    const cloned = gltf.scene.clone()
    cloned.traverse((child) => {
      if (child.isMesh) {
        // Smooth shading
        if (child.geometry) {
          child.geometry.computeVertexNormals()
        }
        
        // Material fixes
        if (child.material) {
          child.material = child.material.clone()
          // Ensure textures are filtered well
          if (child.material.map) {
            child.material.map.anisotropy = 16
            child.material.map.minFilter = THREE.LinearMipmapLinearFilter
            child.material.map.magFilter = THREE.LinearFilter
            child.material.map.needsUpdate = true
          }
          child.material.roughness = 0.6
          child.material.metalness = 0.2
          child.material.envMapIntensity = 1.0
          child.material.needsUpdate = true
        }
        
        child.castShadow = true
        child.receiveShadow = true
      }
    })
    return cloned
  }, [gltf.scene])
  return React.createElement('primitive', { object: scene, position: [0, -8, 0], scale: 4 })
})

