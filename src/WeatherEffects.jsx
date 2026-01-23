// WeatherEffects.jsx - Rain and Snow particle systems for atmospheric maps
import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import AudioManager from './AudioManager'

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

  // Play rain sound and mute music
  React.useEffect(() => {
    AudioManager.playAmbient('rain')
    AudioManager.setWeatherMuteMusic(true)
    return () => {
      AudioManager.stopAmbient('rain')
      AudioManager.setWeatherMuteMusic(false)
    }
  }, [])
  
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
        size={0.1}
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
export function SnowEffect({ count = 200, area = [50, 30, 35] }) {
  const pointsRef = useRef()
  
  const { positions, velocities, driftOffsets, sizes } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const velocities = new Float32Array(count)
    const driftOffsets = new Float32Array(count * 2) // x and z drift phases
    const sizes = new Float32Array(count)
    
    for (let i = 0; i < count; i++) {
      // Random starting position within area
      positions[i * 3] = (Math.random() - 0.5) * area[0]      // x
      positions[i * 3 + 1] = Math.random() * area[1]          // y (height)
      positions[i * 3 + 2] = (Math.random() - 0.5) * area[2]  // z
      
      // Realistic slow fall speed (units per second) - snowflakes fall 1-2 m/s in real life
      velocities[i] = 1.5 + Math.random() * 1.0
      
      // Random phase offsets for natural drift variation
      driftOffsets[i * 2] = Math.random() * Math.PI * 2     // x drift phase
      driftOffsets[i * 2 + 1] = Math.random() * Math.PI * 2 // z drift phase
      
      // Varied snowflake sizes
      sizes[i] = 0.08 + Math.random() * 0.12
    }
    
    return { positions, velocities, driftOffsets, sizes }
  }, [count, area])
  
  useFrame((state, delta) => {
    if (!pointsRef.current) return
    
    // Clamp delta to prevent huge jumps on tab switch or lag spikes
    const clampedDelta = Math.min(delta, 0.1)
    
    const positionArray = pointsRef.current.geometry.attributes.position.array
    const time = state.clock.elapsedTime
    
    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      
      // Fall down using delta-time (frame-rate independent)
      positionArray[i3 + 1] -= velocities[i] * clampedDelta
      
      // Gentle swaying drift - slow sine waves for natural floating effect
      const xDriftPhase = driftOffsets[i * 2]
      const zDriftPhase = driftOffsets[i * 2 + 1]
      
      // Subtle horizontal drift (much gentler than before)
      positionArray[i3] += Math.sin(time * 0.3 + xDriftPhase) * 0.3 * clampedDelta
      positionArray[i3 + 2] += Math.cos(time * 0.25 + zDriftPhase) * 0.2 * clampedDelta
      
      // Reset to top when reaching ground
      if (positionArray[i3 + 1] < -1) {
        positionArray[i3 + 1] = area[1] + Math.random() * 5 // Stagger respawn height
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
        size={0.15}
        transparent
        opacity={0.7}
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
