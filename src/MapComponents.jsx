import React from 'react'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'



export const MysteryShack = React.memo(function MysteryShack() {
  const gltf = useGLTF('/models/gravity_falls.glb')
  const scene = React.useMemo(() => {
    const cloned = gltf.scene.clone()
    cloned.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })
    return cloned
  }, [gltf.scene])
  return React.createElement('primitive', { object: scene, position: [0, -8, 0], scale: 4 })
})

export default {
  MysteryShack
}
