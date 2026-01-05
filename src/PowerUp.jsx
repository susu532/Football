import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'

export const POWER_UP_TYPES = {
  speed: { color: '#00ffff', label: '⚡', id: 'speed' },
  kick: { color: '#ff0000', label: '💥', id: 'kick' },
  jump: { color: '#00ff00', label: '⬆️', id: 'jump' },
  invisible: { color: '#a020f0', label: '👻', id: 'invisible' },
  giant: { color: '#FFD700', label: '🦍', id: 'giant' }
}

export function PowerUp({ position, type, onCollect }) {
  const ref = useRef()
  
  useFrame((state, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta
      // Bob around the initial Y position passed in props
      ref.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 2) * 0.1
    }
  })

  const config = POWER_UP_TYPES[type]

  return (
    <group position={position}>
      <mesh ref={ref} castShadow>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial 
          color={config.color} 
          emissive={config.color}
          emissiveIntensity={0.5}
          transparent
          opacity={0.8}
        />
      </mesh>
      <Text
        position={[0, 1, 0]}
        fontSize={0.5}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {config.label}
      </Text>
    </group>
  )
}
