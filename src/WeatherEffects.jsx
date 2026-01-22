// WeatherEffects.jsx - Rain and Snow particle systems for atmospheric maps
import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Rain Effect - Gentle falling raindrops with slight wind drift
export function RainEffect({ count = 300, area = [50, 35, 35] }) {
  const pointsRef = useRef()
  
  const { positions, velocities } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const velocities = new Float32Array(count)
    
    for (let i = 0; i < count; i++) {
      // Random starting position within area
      positions[i * 3] = (Math.random() - 0.5) * area[0]      // x
      positions[i * 3 + 1] = Math.random() * area[1]          // y (height)
      positions[i * 3 + 2] = (Math.random() - 0.5) * area[2]  // z
      
      // Slower fall speed variation
      velocities[i] = 0.08 + Math.random() * 0.08
    }
    
    return { positions, velocities }
  }, [count, area])
  
  useFrame((state, delta) => {
    if (!pointsRef.current) return
    
    const positionArray = pointsRef.current.geometry.attributes.position.array
    const time = state.clock.elapsedTime
    
    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      
      // Fall down with speed
      positionArray[i3 + 1] -= velocities[i]
      
      // Slight wind drift in x direction
      positionArray[i3] += Math.sin(time * 2 + i) * 0.01
      
      // Reset to top when reaching ground
      if (positionArray[i3 + 1] < -1) {
        positionArray[i3 + 1] = area[1]
        positionArray[i3] = (Math.random() - 0.5) * area[0]
        positionArray[i3 + 2] = (Math.random() - 0.5) * area[2]
      }
    }
    
    pointsRef.current.geometry.attributes.position.needsUpdate = true
  })
  
  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#aaddff"
        size={0.05}
        transparent
        opacity={0.35}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

// Snow Effect - Gentle floating snowflakes with soft drift
export function SnowEffect({ count = 150, area = [50, 30, 35] }) {
  const pointsRef = useRef()
  
  const { positions, velocities, driftOffsets } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const velocities = new Float32Array(count)
    const driftOffsets = new Float32Array(count)
    
    for (let i = 0; i < count; i++) {
      // Random starting position within area
      positions[i * 3] = (Math.random() - 0.5) * area[0]      // x
      positions[i * 3 + 1] = Math.random() * area[1]          // y (height)
      positions[i * 3 + 2] = (Math.random() - 0.5) * area[2]  // z
      
      // Very slow, varied fall speed for snow
      velocities[i] = 0.008 + Math.random() * 0.012
      
      // Random phase offset for drift
      driftOffsets[i] = Math.random() * Math.PI * 2
    }
    
    return { positions, velocities, driftOffsets }
  }, [count, area])
  
  useFrame((state, delta) => {
    if (!pointsRef.current) return
    
    const positionArray = pointsRef.current.geometry.attributes.position.array
    const time = state.clock.elapsedTime
    
    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      
      // Slow fall
      positionArray[i3 + 1] -= velocities[i]
      
      // Gentle swaying drift in x and z
      positionArray[i3] += Math.sin(time * 0.5 + driftOffsets[i]) * 0.015
      positionArray[i3 + 2] += Math.cos(time * 0.4 + driftOffsets[i]) * 0.01
      
      // Reset to top when reaching ground
      if (positionArray[i3 + 1] < -1) {
        positionArray[i3 + 1] = area[1]
        positionArray[i3] = (Math.random() - 0.5) * area[0]
        positionArray[i3 + 2] = (Math.random() - 0.5) * area[2]
      }
    }
    
    pointsRef.current.geometry.attributes.position.needsUpdate = true
  })
  
  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#ffffff"
        size={0.12}
        transparent
        opacity={0.5}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  )
}

// Maps that should have rain weather
export const RAIN_MAPS = ['CityAtNight', 'MinecraftMap', 'JapaneseTown']

// Maps that should have snow weather
export const SNOW_MAPS = ['MysteryShack']

// Weather wrapper component for easy integration
export function WeatherSystem({ mapId }) {
  const hasRain = RAIN_MAPS.includes(mapId)
  const hasSnow = SNOW_MAPS.includes(mapId)
  
  if (hasRain) return <RainEffect />
  if (hasSnow) return <SnowEffect />
  
  return null
}
