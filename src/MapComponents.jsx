import React, { useEffect, useMemo } from 'react'
import { useGLTF, useAnimations } from '@react-three/drei'
import * as THREE from 'three'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'

export const MAP_DATA = [
  { 
    id: 'OceanFloor', 
    name: 'Ocean Floor', 
    path: '/maps_1/oceanfloor.glb', 
    scale: 100, 
    position: [0, 26, 0], 
    emoji: '🌊', 
    image: '/placeholders/Screenshots-20260105142140.png',
    ambientIntensity: 0.2,
    lightIntensity: 0.4
  },
  { 
    id: 'CityAtNight', 
    name: 'City At Night', 
    path: '/maps_1/city_at_night.glb', 
    scale: 1, 
    position: [30, -26.5, -35], 
    emoji: '🌃', 
    image: '/placeholders/Screenshots-20260105142231.png',
    ambientIntensity: 0.15,
    lightIntensity: 0.4
  },
  { 
    id: 'CloudStation', 
    name: 'Cloud Station', 
    path: '/maps_1/cloud_station.glb', 
    scale: 20, 
    position: [-20, -20, 0], 
    emoji: '☁️', 
    image: '/placeholders/Screenshots-20260105142255.png',
    ambientIntensity: 0.6,
    lightIntensity: 1.0
  },
  { 
    id: 'CreekFalls', 
    name: 'Creek Falls', 
    path: '/maps_1/creek_falls_world_maps.glb', 
    scale: 2, 
    position: [10, 0, -35], 
    emoji: '🌲', 
    image: '/placeholders/Screenshots-20260105142323.png',
    ambientIntensity: 0.5,
    lightIntensity: 0.8
  },
  { 
    id: 'SoccerStadiumMap', 
    name: 'Soccer Stadium', 
    path: '/maps_3/soccer_stadium_draco.glb', 
    scale: 0.2, 
    position: [0, -7.5, 0], 
    emoji: '🏟️', 
    image: '/placeholders/Screenshots-20260105142925.png',
    ambientIntensity: 0.5,
    lightIntensity: 0.9
  },
  { 
    id: 'GravityFallsMap', 
    name: 'Gravity Falls', 
    path: '/maps_1/gravity_falls.glb', 
    scale: 4, 
    position: [10, 0, -26], 
    emoji: '🌲', 
    image: '/placeholders/Screenshots-20260105143032.png',
    ambientIntensity: 0.4,
    lightIntensity: 0.7
  },
  { 
    id: 'MinecraftMap', 
    name: 'Minecraft', 
    path: '/maps_2/minecraft_world.glb', 
    scale: 80, 
    position: [0, -11.5, 0], 
    emoji: '⛏️', 
    image: '/placeholders/Screenshots-20260105143054.png',
    ambientIntensity: 0.5,
    lightIntensity: 0.8
  },
  { 
    id: 'MoonMap', 
    name: 'Moon Base', 
    path: '/maps_2/moon_-_mare_moscoviense.glb', 
    scale: 0.5, 
    position: [0, 33, 0], 
    emoji: '🌑', 
    image: '/placeholders/Screenshots-20260105143316.png',
    ambientIntensity: 0.05,
    lightIntensity: 0.6
  },
  { 
    id: 'TropicalIslandMap', 
    name: 'Tropical Island', 
    path: '/maps_3/tropical_island.glb', 
    scale: 50, 
    position: [0, -3.0, 0], 
    emoji: '🏝️', 
    image: '/placeholders/Screenshots-20260105143421.png',
    ambientIntensity: 0.3,
    lightIntensity: 0.5,
    disableAnimations: true
  },
  { 
    id: 'ShipInClouds', 
    name: 'Ship In Clouds', 
    path: '/maps_2/ship_in_clouds.glb', 
    scale: 100, 
    position: [0, -10, 100], 
    emoji: '🚢', 
    image: '/placeholders/Screenshots-20260105143500.png',
    ambientIntensity: 0.7,
    lightIntensity: 1.0
  },
  { 
    id: 'DesertMap', 
    name: 'Desert', 
    path: '/maps_2/stylized_desert_skybox_2.glb', 
    scale: 50, 
    position: [0, 0, 0], 
    emoji: '🌵', 
    image: '/placeholders/Screenshots-20260105143526.png',
    ambientIntensity: 0.02,
    lightIntensity: 0.02
  },
  { 
    id: 'MarioMap', 
    name: 'Mario World', 
    path: '/maps_3/world_1-1.glb', 
    scale: 50, 
    position: [0, 1.4, 0], 
    emoji: '🍄', 
    image: '/placeholders/Screenshots-20260105143551.png',
    ambientIntensity: 0.6,
    lightIntensity: 0.9
  },
  { 
    id: 'MysteryShack', 
    name: 'Mystery Shack', 
    path: '/models/gravity_falls.glb', 
    scale: 4, 
    position: [0, -8, 0], 
    emoji: '🏚️', 
    image: '/placeholders/Screenshots-20260105143806.png',
    ambientIntensity: 0.4,
    lightIntensity: 0.6
  },
  { 
    id: 'JapaneseTown', 
    name: 'Japanese Town', 
    path: '/maps_3/japaneses-town/source/japanese_town.glb', 
    scale: 50, 
    position: [0, 0.8, 0], 
    emoji: '⛩️', 
    image: '/placeholders/Screenshots-20260110090829.png',
    ambientIntensity: 0.5,
    lightIntensity: 0.8
  },
  { 
    id: 'AlAqsa360', 
    name: 'Al Aqsa 360', 
    path: '', // No GLB path needed for video player
    scale: 100, 
    position: [0, 0, 0], 
    emoji: '🕌', 
    image: '/placeholders/alaqsa.jfif', // Reusing placeholder for now
    ambientIntensity: 1.0,
    lightIntensity: 0.0,
    isVideo: true
  },
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
    const cloned = SkeletonUtils.clone(gltf.scene)
    cloned.traverse((child) => {
      if (child.isMesh) {
        // REMOVED: computeVertexNormals to save CPU
        if (child.material) {
          // Clone material to avoid sharing between instances if needed, 
          // though maps are usually unique.
          child.material = child.material.clone()
          
          // Apply custom color if defined (e.g. for Ocean Floor)
          if (mapConfig.color) {
            child.material.color.set(mapConfig.color)
          }

          // Apply texture filtering optimizations to existing maps
          if (child.material.map) {
            child.material.map.anisotropy = 8 // Balanced quality
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

  // Handle animations if they exist
  const { actions, names } = useAnimations(gltf.animations, scene)
  
  useEffect(() => {
    console.log(`Map: ${mapConfig.name}, Animations found: ${gltf.animations.length}, Names: ${names.join(', ')}`)
    
    if (mapConfig.disableAnimations) {
      console.log(`Animations disabled for map: ${mapConfig.name}`)
      return
    }

    if (names.length > 0) {
      names.forEach(name => {
        const action = actions[name]
        if (action) {
          console.log(`Starting animation: ${name}`)
          action.reset().fadeIn(0.5).play()
        }
      })
    }
  }, [actions, names, mapConfig.name, gltf.animations, mapConfig.disableAnimations])

  return <primitive object={scene} position={mapConfig.position} scale={mapConfig.scale} />
}
