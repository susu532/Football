import React, { useRef, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF, OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { EffectComposer, SMAA, FXAA, Bloom, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'

function CharacterModel({ modelPath, character, isSelected }) {
  const groupRef = useRef()
  const { scene } = useGLTF(modelPath)
  
  const characterScale = character === 'cat' ? 0.05 : 0.005
  
  const clonedScene = React.useMemo(() => {
    const cloned = scene.clone()
    cloned.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
        if (child.material.map) {
          child.material.map.anisotropy = 16
          child.material.map.needsUpdate = true
        }
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
      <PerspectiveCamera makeDefault position={[0, 1.5, 4]} fov={50} near={0.1} far={1000} />
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
    >
      <div className="character-preview-canvas">
        <Canvas 
          shadows="soft"
          dpr={[1, 2]}
          gl={{ 
            antialias: false, // Disable MSAA for FXAA
            outputColorSpace: THREE.SRGBColorSpace,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 0.9,
            logarithmicDepthBuffer: false // Disable to reduce shimmering in small scenes
          }}
        >
          <Suspense fallback={null}>
            <EffectComposer multisampling={8}>
              <SMAA />
              <FXAA />
              <Bloom luminanceThreshold={1} mipmapBlur intensity={0.5} radius={0.6} />
              <Vignette eskil={false} offset={0.1} darkness={0.4} />
            </EffectComposer>
            <CharacterScene character={character} isSelected={isSelected} />
          </Suspense>
        </Canvas>
      </div>
      <div className="character-preview-name">
        {characterName}
      </div>
    </button>
  )
}
