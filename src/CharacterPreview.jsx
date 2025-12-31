import React, { useRef, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF, OrbitControls, PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'

function CharacterModel({ modelPath, character, isSelected }) {
  const groupRef = useRef()
  const { scene } = useGLTF(modelPath)
  
  const characterScale = character === 'cat' ? 0.01 : 0.15
  
  const clonedScene = React.useMemo(() => {
    const cloned = scene.clone()
    cloned.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })
    return cloned
  }, [scene])
  
  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.5
    }
  })
  
  return (
    <group ref={groupRef}>
      <primitive object={clonedScene} scale={characterScale} position={[0, 0, 0]} />
    </group>
  )
}

function CharacterScene({ character, isSelected }) {
  const modelPath = character === 'cat' ? '/models/cat.glb' : '/models/low_poly_car.glb'
  
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 1.5, 4]} fov={50} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 10, 5]} intensity={1} castShadow />
      <directionalLight position={[-5, 5, -5]} intensity={0.5} />
      <CharacterModel modelPath={modelPath} character={character} isSelected={isSelected} />
    </>
  )
}

export default function CharacterPreview({ character, isSelected, onSelect }) {
  const characterName = character === 'cat' ? 'Cat' : 'Car'
  
  return (
    <button
      className={`character-preview-card ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(character)}
      style={{
        padding: '0',
        border: isSelected ? '3px solid #00d2d3' : '3px solid rgba(255,255,255,0.2)',
        borderRadius: '16px',
        background: isSelected ? 'rgba(0, 210, 211, 0.15)' : 'rgba(255, 255, 255, 0.05)',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        overflow: 'hidden',
        width: '180px',
        height: '200px'
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
          e.currentTarget.style.transform = 'translateY(-5px)'
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
          e.currentTarget.style.transform = 'translateY(0)'
        }
      }}
    >
      <div style={{ width: '100%', height: '150px' }}>
        <Canvas shadows gl={{ outputColorSpace: THREE.SRGBColorSpace }}>
          <Suspense fallback={null}>
            <CharacterScene character={character} isSelected={isSelected} />
          </Suspense>
        </Canvas>
      </div>
      <div style={{ 
        padding: '10px', 
        textAlign: 'center',
        color: '#fff',
        fontWeight: '600',
        fontSize: '1.1rem'
      }}>
        {characterName}
      </div>
    </button>
  )
}
