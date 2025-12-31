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
  return React.createElement('primitive', { object: scene, position: [0, -10, 0], scale: 4 })
})

export const OceanFloor = React.memo(function OceanFloor() {
  const gltf = useGLTF('/models/oceanfloor.glb')
  const scene = React.useMemo(() => {
    const cloned = gltf.scene.clone()
    cloned.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
        if (child.material) {
          child.material = child.material.clone()
          child.material.emissive = new THREE.Color('#004433')
          child.material.emissiveIntensity = 0.5
          child.material.roughness = 0.8
        }
      }
    })
    return cloned
  }, [gltf.scene])
  return React.createElement('primitive', { object: scene, position: [0, 26, 0], scale: 100 })
})

export const CityAtNight = React.memo(function CityAtNight() {
  const gltf = useGLTF('/models/city_at_night.glb')
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
  return React.createElement('primitive', { object: scene, position: [30, -26.5, -35], scale: 1 })
})

export const CloudStation = React.memo(function CloudStation() {
  const gltf = useGLTF('/maps/cloud_station.glb')
  return React.createElement('primitive', { object: gltf.scene, position: [-20, -20, 0], scale: 20 })
})

export const CreekFalls = React.memo(function CreekFalls() {
  const gltf = useGLTF('/maps/creek_falls_world_maps.glb')
  return React.createElement('primitive', { object: gltf.scene, position: [10, 0, -35], scale: 2 })
})

export const SoccerStadiumMap = React.memo(function SoccerStadiumMap() {
  const gltf = useGLTF('/maps_two/soccer_stadium.glb')
  return React.createElement('primitive', { object: gltf.scene, position: [0, -7.5, 0], scale: 0.2 })
})

export const GravityFallsMap = React.memo(function GravityFallsMap() {
  const gltf = useGLTF('/maps/gravity_falls.glb')
  return React.createElement('primitive', { object: gltf.scene, position: [10, 0, -26], scale: 4 })
})

export const MinecraftMap = React.memo(function MinecraftMap() {
  const gltf = useGLTF('/maps_two/minecraft_world.glb')
  return React.createElement('primitive', { object: gltf.scene, position: [0, -10.5, 0], scale: 80 })
})

export const MoonMap = React.memo(function MoonMap() {
  const gltf = useGLTF('/maps/moon_-_mare_moscoviense.glb')
  return React.createElement('primitive', { object: gltf.scene, position: [0, 33, 0], scale: 0.5 })
})

export const TropicalIslandMap = React.memo(function TropicalIslandMap() {
  const gltf = useGLTF('/maps_two/tropical_island.glb')
  return React.createElement('primitive', { object: gltf.scene, position: [0, -2.6, 0], scale: 50 })
})

export const ShipInClouds = React.memo(function ShipInClouds() {
  const gltf = useGLTF('/maps/ship_in_clouds.glb')
  return React.createElement('primitive', { object: gltf.scene, position: [0, -10, 100], scale: 100 })
})

export const DesertMap = React.memo(function DesertMap() {
  const gltf = useGLTF('/maps/stylized_desert_skybox_2.glb')
  return React.createElement('primitive', { object: gltf.scene, position: [0, 0, 0], scale: 50 })
})

export const MarioMap = React.memo(function MarioMap() {
  const gltf = useGLTF('/maps_two/world_1-1.glb')
  return React.createElement('primitive', { object: gltf.scene, position: [0, 1.4, 0], scale: 50 })
})

// Default export for importing all components
export default {
  MysteryShack,
  OceanFloor,
  CityAtNight,
  CloudStation,
  CreekFalls,
  SoccerStadiumMap,
  GravityFallsMap,
  MinecraftMap,
  MoonMap,
  TropicalIslandMap,
  ShipInClouds,
  DesertMap,
  MarioMap
}
