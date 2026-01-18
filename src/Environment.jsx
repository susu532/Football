import React, { useMemo, useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { Stars, Sparkles, useGLTF, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { RigidBody, CuboidCollider, CylinderCollider } from '@react-three/rapier'
import { PHYSICS } from './PhysicsConstants'

// Rapier Arena (Host Only)
export function RapierArena() {
  const wallHeight = 10
  const wallThickness = 2
  const pitchWidth = 30
  const pitchDepth = 20
  const goalWidth = 6
  
  return (
    <RigidBody type="fixed" friction={0.2} restitution={PHYSICS.WALL_RESTITUTION}>
       {/* Ground */}
       <CuboidCollider args={[30/2, 0.5/2, 20/2]} position={[0, -0.5/2, 0]} friction={1.0} restitution={PHYSICS.GROUND_RESTITUTION} />
       
       {/* Walls */}
       <CuboidCollider args={[(pitchWidth + wallThickness * 2)/2, wallHeight/2, wallThickness/2]} position={[0, wallHeight/2, -pitchDepth/2 - wallThickness/2]} />
       <CuboidCollider args={[(pitchWidth + wallThickness * 2)/2, wallHeight/2, wallThickness/2]} position={[0, wallHeight/2, pitchDepth/2 + wallThickness/2]} />
       
       {/* Side walls with goal gaps */}
       <CuboidCollider args={[wallThickness/2, wallHeight/2, 7.5/2]} position={[-pitchWidth/2 - wallThickness/2, wallHeight/2, -6.25]} />
       <CuboidCollider args={[wallThickness/2, wallHeight/2, 7.5/2]} position={[-pitchWidth/2 - wallThickness/2, wallHeight/2, 6.25]} />
       
       <CuboidCollider args={[wallThickness/2, wallHeight/2, 7.5/2]} position={[pitchWidth/2 + wallThickness/2, wallHeight/2, -6.25]} />
       <CuboidCollider args={[wallThickness/2, wallHeight/2, 7.5/2]} position={[pitchWidth/2 + wallThickness/2, wallHeight/2, 6.25]} />
       
       <CuboidCollider args={[wallThickness/2, wallHeight/2, (goalWidth+2)/2]} position={[-13 - wallThickness, wallHeight/2, 0]} />
       <CuboidCollider args={[wallThickness/2, wallHeight/2, (goalWidth+2)/2]} position={[13 + wallThickness, wallHeight/2, 0]} />
       
       <CylinderCollider args={[2, 0.06]} position={[-10.8, 2, -2.5]} restitution={PHYSICS.POST_RESTITUTION} />
       <CylinderCollider args={[2, 0.06]} position={[-10.8, 2, 2.5]} restitution={PHYSICS.POST_RESTITUTION} />
       <CylinderCollider args={[2, 0.06]} position={[10.8, 2, -2.5]} restitution={PHYSICS.POST_RESTITUTION} />
       <CylinderCollider args={[2, 0.06]} position={[10.8, 2, 2.5]} restitution={PHYSICS.POST_RESTITUTION} />
       
       <CylinderCollider args={[3, 0.04]} position={[-10.8, 4, 0]} rotation={[0, 0, Math.PI/2]} restitution={PHYSICS.POST_RESTITUTION} />
       <CylinderCollider args={[3, 0.04]} position={[10.8, 4, 0]} rotation={[0, 0, Math.PI/2]} restitution={PHYSICS.POST_RESTITUTION} />
       
       <CuboidCollider args={[pitchWidth/2, 0.1, pitchDepth/2]} position={[0, wallHeight, 0]} />

    </RigidBody>
  )
}

// Helper to generate striped grass texture
function generateGrassTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 1024
  const context = canvas.getContext('2d')
  
  // Darker green base
  context.fillStyle = '#1a4a10'
  context.fillRect(0, 0, 1024, 1024)
  
  // Lighter green stripes
  context.fillStyle = '#225c16' 
  const numStripes = 12
  const stripeHeight = 1024 / numStripes
  
  for (let i = 0; i < numStripes; i += 2) {
    context.fillRect(0, i * stripeHeight, 1024, stripeHeight)
  }
  
  // Add some noise/texture
  context.fillStyle = 'rgba(0,0,0,0.05)'
  for(let i=0; i<50000; i++) {
    const x = Math.random() * 1024
    const y = Math.random() * 1024
    const w = Math.random() * 3
    const h = Math.random() * 3
    context.fillRect(x, y, w, h)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  // Anisotropy will be set by the mesh
  return texture
}

// Soccer Pitch (Visuals Only)
export function SoccerPitch({
  size = [30, 0.2, 20],
  wallHeight = 10,
  wallThickness = 0.4
}) {
  const grassTexture = useMemo(() => generateGrassTexture(), [])
  
  // Configure texture
  useEffect(() => {
    grassTexture.anisotropy = 16
    grassTexture.minFilter = THREE.LinearMipmapLinearFilter
    grassTexture.magFilter = THREE.LinearFilter
    grassTexture.needsUpdate = true
  }, [grassTexture])

  return (
    <group>
      {/* Grass Pitch */}
      <mesh position={[0, 0, 0]} receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial 
          map={grassTexture}
          roughness={0.8} 
          metalness={0.1}
          envMapIntensity={0.5}
        />
      </mesh>

      {/* Atmospheric Sparkles (Fireflies/Dew) */}
      <Sparkles 
        count={100} 
        scale={[28, 2, 18]} 
        position={[0, 1, 0]} 
        size={4} 
        speed={0.4} 
        opacity={0.4} 
        color="#ccffcc"
      />
      <mesh position={[0, 0.12, 0]} rotation={[-Math.PI/2, 0, 0]}>
        <planeGeometry args={[0.1, 20]} />
        <meshStandardMaterial color="#fff" transparent opacity={0.5} />
      </mesh>
      
      <mesh position={[0, 0.12, -10]} rotation={[-Math.PI/2, 0, 0]}>
        <planeGeometry args={[30, 0.1]} />
        <meshStandardMaterial color="#fff" transparent opacity={0.5} />
      </mesh>
      <mesh position={[0, 0.12, 10]} rotation={[-Math.PI/2, 0, 0]}>
        <planeGeometry args={[30, 0.1]} />
        <meshStandardMaterial color="#fff" transparent opacity={0.5} />
      </mesh>
      <mesh position={[-15, 0.12, 0]} rotation={[-Math.PI/2, 0, 0]}>
        <planeGeometry args={[0.1, 20]} />
        <meshStandardMaterial color="#fff" transparent opacity={0.5} />
      </mesh>
      <mesh position={[15, 0.12, 0]} rotation={[-Math.PI/2, 0, 0]}>
        <planeGeometry args={[0.1, 20]} />
        <meshStandardMaterial color="#fff" transparent opacity={0.5} />
      </mesh>


      <mesh position={[-11, 0.12, 0]} rotation={[-Math.PI/2, 0, 0]}>
        <ringGeometry args={[0, 0.1, 4, 1, 0, Math.PI*2]} />
        <meshStandardMaterial color="#fff" />
      </mesh>


      <mesh position={[11, 0.12, 0]} rotation={[-Math.PI/2, 0, 0]}>
        <ringGeometry args={[0, 0.1, 4, 1, 0, Math.PI*2]} />
        <meshStandardMaterial color="#fff" />
      </mesh>

      <mesh position={[0, 0.12, 0]} rotation={[-Math.PI/2, 0, 0]}>
        <ringGeometry args={[2.5, 2.7, 32]} />
        <meshStandardMaterial color="#fff" transparent opacity={0.5} />
      </mesh>
      
      <mesh position={[-size[0]/2 , 0.12, -size[2]/2]} rotation={[-Math.PI/2, 0, -Math.PI/2]}>
        <ringGeometry args={[0.8, 1.0, 16, 1, 0, Math.PI/2]} />
        <meshStandardMaterial color="#fff" transparent opacity={0.5} />
      </mesh>
      <mesh position={[size[0]/2, 0.12, -size[2]/2 ]} rotation={[-Math.PI/2, 0, -Math.PI]}>
        <ringGeometry args={[0.8, 1.0, 16, 1, 0, Math.PI/2]} />
        <meshStandardMaterial color="#fff" transparent opacity={0.5} />
      </mesh>
      <mesh position={[size[0]/2, 0.12, size[2]/2]} rotation={[-Math.PI/2, 0, Math.PI/2]}>
        <ringGeometry args={[0.8, 1.0, 16, 1, 0, Math.PI/2]} />
        <meshStandardMaterial color="#fff" transparent opacity={0.5} />
      </mesh>
      <mesh position={[-size[0]/2, 0.12, size[2]/2]} rotation={[-Math.PI/2, 0, 0]}>
        <ringGeometry args={[0.8, 1.0, 16, 1, 0, Math.PI/2]} />
        <meshStandardMaterial color="#fff" transparent opacity={0.5} />
      </mesh>

      


      

    </group>
  )
}

export function SoccerGoal({ position = [0, 0, 0], rotation = [0, 0, 0], netColor = '#e0e0e0' }) {
  const { scene } = useGLTF('/models/soccer_goal.glb')
  
  const clonedGoal = useMemo(() => {
    const cloned = scene.clone()
    cloned.traverse((child) => {
      if (child.isMesh) {
        // Smooth shading
        if (child.geometry) {
          child.geometry.computeVertexNormals()
        }

        // Material fixes
        if (child.material) {
          child.material = child.material.clone()
          // Ensure textures are filtered well
          if (child.material.map) {
            child.material.map.anisotropy = 16
            child.material.map.minFilter = THREE.LinearMipmapLinearFilter
            child.material.map.magFilter = THREE.LinearFilter
            child.material.map.needsUpdate = true
          }
          
          if (child.name.toLowerCase().includes('net')) {
            child.material.color.set(netColor)
            child.material.transparent = true
            child.material.opacity = 0.7
          } else {
            // Upgrade posts to MeshPhysicalMaterial
            const oldMat = child.material
            child.material = new THREE.MeshPhysicalMaterial({
              color: oldMat.color,
              map: oldMat.map,
              roughness: 0.4, // More matte
              metalness: 0.1, // Less metallic
              clearcoat: 0.2, // Subtle shine
              clearcoatRoughness: 0.1,
              envMapIntensity: 0.4 // Softer reflections
            })
          }
          child.material.needsUpdate = true
        }

        child.castShadow = true
        child.receiveShadow = false
      }
    })
    return cloned
  }, [scene, netColor])

  return (
    <primitive 
      object={clonedGoal} 
      position={position} 
      rotation={rotation} 
      scale={0.01} 
    />
  )
}

export function GoalCelebrationEffect({ team }) {
  const startTime = useRef(null)
  const ringRef = useRef(null)
  const ringMatRef = useRef(null)
  const glowRef = useRef(null)
  const glowMatRef = useRef(null)

  const teamColor = team === 'red' ? '#ff4757' : '#3742fa'

  const goalX = team === 'red' ? 12.2 : -12.2
  const frontOffsetX = team === 'red' ? -0.85 : 0.85
  const ringRotY = team === 'red' ? -Math.PI / 2 : Math.PI / 2

  useFrame(({ clock }) => {
    if (startTime.current == null) startTime.current = clock.getElapsedTime()
    const t = clock.getElapsedTime() - startTime.current
    const duration = 1.35
    const p = THREE.MathUtils.clamp(t / duration, 0, 1)
    const ease = 1 - Math.pow(1 - p, 3)

    if (ringRef.current) {
      const s = 0.35 + ease * 2.4
      ringRef.current.scale.set(s, s, s)
      ringRef.current.rotation.z = t * 2.0
    }

    if (ringMatRef.current) {
      ringMatRef.current.opacity = (1 - p) * 0.95
    }

    if (glowRef.current) {
      const gs = 0.2 + ease * 1.6
      glowRef.current.scale.set(gs, gs, gs)
    }

    if (glowMatRef.current) {
      glowMatRef.current.opacity = (1 - p) * 0.65
    }
  })

  return (
    <group position={[goalX + frontOffsetX, 0.9, 0]} rotation={[0, ringRotY, 0]}>
      <mesh ref={glowRef} rotation={[0, 0, 0]}>
        <circleGeometry args={[0.9, 48]} />
        <meshBasicMaterial
          ref={glowMatRef}
          color={teamColor}
          transparent
          opacity={0.65}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <mesh ref={ringRef} rotation={[0, 0, 0]}>
        <ringGeometry args={[0.85, 1.15, 64]} />
        <meshBasicMaterial
          ref={ringMatRef}
          color={teamColor}
          transparent
          opacity={0.95}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <pointLight color={teamColor} intensity={6} distance={8} decay={2} />

      <Sparkles
        count={120}
        scale={[2.4, 2.2, 4.2]}
        position={[0, 0, 0]}
        size={7}
        speed={1.6}
        opacity={0.85}
        color={teamColor}
      />
    </group>
  )
}

export function GameSkybox({ mapId }) {
  const { scene } = useThree()
  const isNight = mapId === 'DesertMap' || mapId === 'CityAtNight' || mapId === 'MinecraftMap' || mapId === 'MoonMap' || mapId === 'MysteryShack' || mapId === 'JapaneseTown'
  
  useEffect(() => {
    if (isNight) {
      scene.background = new THREE.Color('#000000')
    } else {
      scene.background = new THREE.Color('#87CEEB')
    }
    scene.fog = null
  }, [isNight, scene])
  
  return (
    <>
      {isNight && (
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
      )}
    </>
  )
}

// Lightweight sky for mobile to replace the black void
export function MobileSky({ mapId }) {
  const { scene } = useThree()
  const isNight = mapId === 'DesertMap' || mapId === 'CityAtNight' || mapId === 'MinecraftMap' || mapId === 'MoonMap' || mapId === 'MysteryShack' || mapId === 'JapaneseTown'
  
  useEffect(() => {
    if (isNight) {
      scene.background = new THREE.Color('#000000')
    } else {
      scene.background = new THREE.Color('#87CEEB')
    }
    scene.fog = null
  }, [isNight, scene])
  
  return (
    <>
      {isNight && (
        <Stars radius={100} depth={50} count={2000} factor={4} saturation={0} fade speed={1} />
      )}
    </>
  )
}

export function StadiumLight({ position, rotationY = 0 }) {
  const groupRef = useRef()
  const lightRef = useRef()

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Pole */}
      <mesh position={[0, 6, 0]}>
        <cylinderGeometry args={[0.15, 0.25, 12, 8]} />
        <meshStandardMaterial color="#444" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Light Head */}
      <group position={[0, 12, 0]} rotation={[0.5, 0, 0]}>
        <mesh position={[0, 0, 0.3]}>
          <boxGeometry args={[1.5, 1, 0.4]} />
          <meshStandardMaterial color="#333" />
        </mesh>
        
        {/* Glowing Face */}
        <mesh position={[0, 0, 0.51]}>
          <planeGeometry args={[1.3, 0.8]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>

        {/* Spot Light */}
        <spotLight
          ref={lightRef}
          position={[0, 0, 0.6]}
          angle={Math.PI / 3}
          penumbra={0.5}
          intensity={50}
          distance={40}
          castShadow
          shadow-mapSize={[512, 512]}
        />
      </group>
    </group>
  )
}

export function StadiumLights() {
  return (
    <group>
      {/* 4 Corners */}
      <StadiumLight position={[-16, 0, -11]} rotationY={Math.PI / 4} />
      <StadiumLight position={[16, 0, -11]} rotationY={-Math.PI / 4} />
      <StadiumLight position={[-16, 0, 11]} rotationY={(3 * Math.PI) / 4} />
      <StadiumLight position={[16, 0, 11]} rotationY={(-3 * Math.PI) / 4} />
      
      {/* Extra ambient light for stadium vibe */}
      <ambientLight intensity={0.4} />
    </group>
  )
}
