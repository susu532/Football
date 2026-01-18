import React, { useRef, Suspense, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF, Stage, Environment, ContactShadows } from '@react-three/drei'
import { EffectComposer, SMAA, FXAA, Bloom, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'

function CharacterModel({ modelPath, character, team }) {
  const groupRef = useRef()
  const { scene } = useGLTF(modelPath)
  
  const characterScale = character === 'cat' ? 0.05 : 0.005
  
  // Clone scene once
  const clonedScene = React.useMemo(() => scene.clone(), [scene])

  // Update materials based on team
  useEffect(() => {
    const teamColor = team === 'red' ? new THREE.Color('#ff4757') : new THREE.Color('#2d9cdb')
    
    clonedScene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
        
        if (child.material) {
          // Clone material if it's the first time or if we need a fresh one
          // We can just clone it every time for safety, but let's be efficient
          if (!child.userData.materialCloned) {
            child.material = child.material.clone()
            child.userData.materialCloned = true
          }
          
          // Apply team color to base color
          child.material.color.copy(teamColor)
          
          // Enhance material properties
          if (character === 'car') {
            child.material.metalness = 0.7
            child.material.roughness = 0.15
            child.material.envMapIntensity = 2.0
          } else {
            child.material.metalness = 0.0
            child.material.roughness = 0.7
          }
          
          child.material.needsUpdate = true
        }
      }
    })
  }, [clonedScene, team, character])
  
  useFrame((state, delta) => {
    if (groupRef.current) {
      // Slow rotation for showcase
      groupRef.current.rotation.y += delta * 0.4
    }
  })
  
  return (
    <group ref={groupRef}>
      <primitive object={clonedScene} scale={characterScale} position={[0, 0, 0]} />
    </group>
  )
}

function CharacterScene({ character, team }) {
  const modelPath = character === 'cat' ? '/models/cat.glb' : '/models/low_poly_car.glb'
  
  return (
    <>
      <Stage
        intensity={0.8}
        environment="city"
        shadows={false}
        adjustCamera={1.1}
      >
        <CharacterModel modelPath={modelPath} character={character} team={team} />
      </Stage>
    </>
  )
}

export default function CharacterPreview({ character, team = 'red', isSelected, onSelect }) {
  const characterName = character === 'cat' ? 'Cat' : 'Car'
  
  return (
    <button
      className={`character-preview-card ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(character)}
    >
      <div className="character-preview-canvas">
        <Canvas 
          dpr={[1, 2]}
          gl={{ 
            antialias: true,
            outputColorSpace: THREE.SRGBColorSpace,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.2
          }}
          camera={{ position: [0, 0, 4], fov: 45 }}
        >
          <Suspense fallback={null}>
            <CharacterScene character={character} team={team} />
          </Suspense>
        </Canvas>
      </div>
      <div className="character-preview-name">
        {characterName}
      </div>
    </button>
  )
}
