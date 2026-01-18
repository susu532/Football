import React, { useRef, Suspense, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF, Stage, Environment, ContactShadows } from '@react-three/drei'
import { EffectComposer, SMAA, FXAA, Bloom, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'

function CharacterModel({ modelPath, character, team }) {
  const groupRef = useRef()
  const { scene } = useGLTF(modelPath)
  
  const characterScale = character === 'cat' ? 0.05 : 0.005
  
  // Clone scene to allow independent material updates
  const clonedScene = React.useMemo(() => scene.clone(), [scene])

  // Update materials based on team
  useEffect(() => {
    const teamColor = team === 'red' ? new THREE.Color('#ff4757') : new THREE.Color('#2d9cdb')
    
    clonedScene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
        
        // Logic to find the "main" body part to color
        // This depends on the model structure. 
        // For now, we'll try to color materials that look like "body" or just everything that isn't black/glass
        // Or simpler: Color everything that has a map or specific name?
        // Let's try coloring the main material.
        
        if (child.material) {
          // Clone material to avoid affecting other instances
          child.material = child.material.clone()
          
          // Apply team color to base color
          child.material.color = teamColor
          
          // Enhance material properties
          if (character === 'car') {
            child.material.metalness = 0.6
            child.material.roughness = 0.2
            child.material.envMapIntensity = 1.5
          } else {
            child.material.metalness = 0.1
            child.material.roughness = 0.8
          }
        }
      }
    })
  }, [clonedScene, team, character])
  
  useFrame((state, delta) => {
    if (groupRef.current) {
      // Slow rotation for showcase
      groupRef.current.rotation.y += delta * 0.5
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
        intensity={0.5}
        environment="city"
        shadows={{ type: 'accumulative', bias: -0.001, intensity: Math.PI }}
        adjustCamera={1.2}
      >
        <CharacterModel modelPath={modelPath} character={character} team={team} />
      </Stage>
      
      {/* Extra Environment for reflections */}
      <Environment preset="city" />
      
      {/* Ground Shadows */}
      <ContactShadows position={[0, -0.01, 0]} opacity={0.5} scale={10} blur={2} far={4} />
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
          shadows
          dpr={[1, 2]}
          gl={{ 
            antialias: false,
            outputColorSpace: THREE.SRGBColorSpace,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.0
          }}
          camera={{ position: [0, 0, 4], fov: 50 }}
        >
          <Suspense fallback={null}>
            <CharacterScene character={character} team={team} />
            
            <EffectComposer multisampling={4}>
              <SMAA />
              <Bloom luminanceThreshold={1} mipmapBlur intensity={0.8} radius={0.4} />
              <Vignette eskil={false} offset={0.1} darkness={0.3} />
            </EffectComposer>
          </Suspense>
        </Canvas>
      </div>
      <div className="character-preview-name">
        {characterName}
      </div>
    </button>
  )
}
