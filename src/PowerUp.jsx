import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'

export const POWER_UP_TYPES = {
  speed: { color: '#00ffff', label: '⚡', id: 'speed' },
  kick: { color: '#ff0000', label: '💥', id: 'kick' },
  jump: { color: '#00ff00', label: '⬆️', id: 'jump' },
  invisible: { color: '#a020f0', label: '👻', id: 'invisible' },
  shield: { color: '#00ffff', label: '🛡️', id: 'shield' }
}

export function PowerUp({ position, type, onCollect }) {
  const ref = useRef()
  
  useFrame((state, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta
      // Bob around the group center
      ref.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.1
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
      <Html
        position={[0, 1, 0]}
        center
        distanceFactor={8}
      >
        <div style={{
          fontSize: '24px',
          pointerEvents: 'none',
          userSelect: 'none',
          filter: 'drop-shadow(0 0 5px rgba(255,255,255,0.5))'
        }}>
          {config.label}
        </div>
      </Html>
    </group>
  )
}
