import React, { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

export const MAP_DATA = [
  { id: 'OceanFloor', name: 'Ocean Floor', path: '/maps_1/oceanfloor.glb', scale: 100, position: [0, 26, 0], emoji: '🌊', image: '/placeholders/Screenshots-20260105142140.png', color: '#1b5a73', ambientIntensity: 0.1, ambientColor: '#0a2a3a', lightIntensity: 1.0, lightColor: '#3aa9d9', fogColor: '#02111f', fogDensity: 0.01, environmentPreset: 'night', backgroundColor: '#020b1a', showStars: false, skySparklesColor: '#2fc7ff', skySparklesOpacity: 0.14, skySparklesSpeed: 0.12, skySparklesCount: 260 },
  { id: 'CityAtNight', name: 'City At Night', path: '/maps_1/city_at_night.glb', scale: 1, position: [30, -26.5, -35], emoji: '🌃', image: '/placeholders/Screenshots-20260105142231.png' },
  { id: 'CloudStation', name: 'Cloud Station', path: '/maps_1/cloud_station.glb', scale: 20, position: [-20, -20, 0], emoji: '☁️', image: '/placeholders/Screenshots-20260105142255.png' },
  { id: 'CreekFalls', name: 'Creek Falls', path: '/maps_1/creek_falls_world_maps.glb', scale: 2, position: [10, 0, -35], emoji: '🌲', image: '/placeholders/Screenshots-20260105142323.png' },
  { id: 'SoccerStadiumMap', name: 'Soccer Stadium', path: '/maps_3/soccer_stadium_draco.glb', scale: 0.2, position: [0, -7.5, 0], emoji: '🏟️', image: '/placeholders/Screenshots-20260105142925.png' },
  { id: 'GravityFallsMap', name: 'Gravity Falls', path: '/maps_1/gravity_falls.glb', scale: 4, position: [10, 0, -26], emoji: '🌲', image: '/placeholders/Screenshots-20260105143032.png' },
  { id: 'MinecraftMap', name: 'Minecraft', path: '/maps_2/minecraft_world.glb', scale: 80, position: [0, -11.5, 0], emoji: '⛏️', image: '/placeholders/Screenshots-20260105143054.png' },
  { id: 'MoonMap', name: 'Moon Base', path: '/maps_2/moon_-_mare_moscoviense.glb', scale: 0.5, position: [0, 33, 0], emoji: '🌑', image: '/placeholders/Screenshots-20260105143316.png' },
  { id: 'TropicalIslandMap', name: 'Tropical Island', path: '/maps_3/tropical_island.glb', scale: 50, position: [0, -6.6, 0], emoji: '🏝️', image: '/placeholders/Screenshots-20260105143421.png' },
  { id: 'ShipInClouds', name: 'Ship In Clouds', path: '/maps_2/ship_in_clouds.glb', scale: 100, position: [0, -10, 100], emoji: '🚢', image: '/placeholders/Screenshots-20260105143500.png' },
  { id: 'DesertMap', name: 'Desert', path: '/maps_2/stylized_desert_skybox_2.glb', scale: 50, position: [0, 0, 0], emoji: '🌵', image: '/placeholders/Screenshots-20260105143526.png' },
  { id: 'MarioMap', name: 'Mario World', path: '/maps_3/world_1-1.glb', scale: 50, position: [0, 1.4, 0], emoji: '🍄', image: '/placeholders/Screenshots-20260105143551.png' },
  { id: 'MysteryShack', name: 'Mystery Shack', path: '/models/gravity_falls.glb', scale: 4, position: [0, -8, 0], emoji: '🏚️', image: '/placeholders/Screenshots-20260105143806.png' },
]

export function MapRenderer({ mapId }) {
  const mapConfig = useMemo(() => MAP_DATA.find(m => m.id === mapId) || MAP_DATA[0], [mapId])
  
  // Lazy load only the selected map
  const gltf = useGLTF(mapConfig.path, true)
  
  // Cleanup on unmount or map change
  useEffect(() => {
    return () => {
      // Clear from cache to free memory
      useGLTF.clear(mapConfig.path)
      console.log(`Unloaded map: ${mapConfig.name}`)
    }
  }, [mapConfig.path, mapConfig.name])

  const scene = useMemo(() => {
    const cloned = gltf.scene.clone()
    cloned.traverse((child) => {
      if (child.isMesh) {
        // REMOVED: computeVertexNormals to save CPU
        if (child.material) {
          const oldMat = child.material
          // Use MeshLambertMaterial - much cheaper for CPU/GPU
          child.material = new THREE.MeshLambertMaterial({
            map: oldMat.map,
            color: oldMat.color,
            transparent: oldMat.transparent,
            opacity: oldMat.opacity,
            side: THREE.FrontSide
          })
          
          // Apply custom color if defined (e.g. for Ocean Floor)
          if (mapConfig.color) {
            child.material.color.set(mapConfig.color)
          }

          if (child.material.map) {
            child.material.map.anisotropy = 4 // Reduced from 16
            child.material.map.minFilter = THREE.LinearMipmapLinearFilter
            child.material.map.magFilter = THREE.LinearFilter
            child.material.map.needsUpdate = true
          }
          
          child.material.needsUpdate = true
        }
        // Disable all shadows for map models to boost performance
        child.castShadow = false
        child.receiveShadow = false
      }
    })
    return cloned
  }, [gltf.scene, mapConfig])

  return <primitive object={scene} position={mapConfig.position} scale={mapConfig.scale} />
}
