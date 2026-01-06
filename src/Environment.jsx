import React, { useMemo, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { Stars, Sparkles, useGLTF, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { RigidBody, CuboidCollider, CylinderCollider } from '@react-three/rapier'
import { useSpring, a } from '@react-spring/three'

// Rapier Arena (Host Only)
export function RapierArena() {
  const wallHeight = 10
  const wallThickness = 2
  const pitchWidth = 30
  const pitchDepth = 20
  const goalWidth = 6
  
  return (
    <RigidBody type="fixed" friction={0.2} restitution={0.6}>
       {/* Ground */}
       <CuboidCollider args={[30/2, 0.5/2, 20/2]} position={[0, -0.5/2, 0]} friction={1.0} restitution={0.6} />
       
       {/* Walls */}
       <CuboidCollider args={[(pitchWidth + wallThickness * 2)/2, wallHeight/2, wallThickness/2]} position={[0, wallHeight/2, -pitchDepth/2 - wallThickness/2]} />
       <CuboidCollider args={[(pitchWidth + wallThickness * 2)/2, wallHeight/2, wallThickness/2]} position={[0, wallHeight/2, pitchDepth/2 + wallThickness/2]} />
       
       <CuboidCollider args={[wallThickness/2, wallHeight/2, 7/2]} position={[-pitchWidth/2 - wallThickness/2, wallHeight/2, -6.5]} />
       <CuboidCollider args={[wallThickness/2, wallHeight/2, 7/2]} position={[-pitchWidth/2 - wallThickness/2, wallHeight/2, 6.5]} />
       
       <CuboidCollider args={[wallThickness/2, wallHeight/2, 7/2]} position={[pitchWidth/2 + wallThickness/2, wallHeight/2, -6.5]} />
       <CuboidCollider args={[wallThickness/2, wallHeight/2, 7/2]} position={[pitchWidth/2 + wallThickness/2, wallHeight/2, 6.5]} />
       
       <CuboidCollider args={[wallThickness/2, wallHeight/2, (goalWidth+2)/2]} position={[-13 - wallThickness, wallHeight/2, 0]} />
       <CuboidCollider args={[wallThickness/2, wallHeight/2, (goalWidth+2)/2]} position={[13 + wallThickness, wallHeight/2, 0]} />
       
       <CylinderCollider args={[2, 0.06]} position={[-10.8, 2, -2.5]} restitution={0.8} />
       <CylinderCollider args={[2, 0.06]} position={[-10.8, 2, 2.5]} restitution={0.8} />
       <CylinderCollider args={[2, 0.06]} position={[10.8, 2, -2.5]} restitution={0.8} />
       <CylinderCollider args={[2, 0.06]} position={[10.8, 2, 2.5]} restitution={0.8} />
       
       <CylinderCollider args={[3, 0.06]} position={[-10.8, 4, 0]} rotation={[0, 0, Math.PI/2]} restitution={0.8} />
       <CylinderCollider args={[3, 0.06]} position={[10.8, 4, 0]} rotation={[0, 0, Math.PI/2]} restitution={0.8} />
       
       <CuboidCollider args={[pitchWidth/2, 0.1, pitchDepth/2]} position={[0, wallHeight, 0]} />

         <CuboidCollider args={[4/2, 13/2, 0.2/2]} position={[13, 0, -2.4]} />
         <CuboidCollider args={[4/2, 13/2, 0.2/2]} position={[-13, 0, -2.4]} />
         <CuboidCollider args={[4/2, 13/2, 0.2/2]} position={[13, 0, 2.4]} />
         <CuboidCollider args={[4/2, 13/2, 0.2/2]} position={[-13, 0, 2.4]} />
        <CuboidCollider args={[5/2, 9/2, 5.5/2]} position={[10.8, 8.7, 0]} />
        <CuboidCollider args={[5/2, 9/2, 5.5/2]} position={[-10.8, 8.7, 0]} />
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
  wallThickness = 0.4,
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
        child.receiveShadow = true
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

export function GameSkybox() {
  useThree(({ scene }) => {
    scene.background = new THREE.Color('#050510')
  })
  return (
    <>
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
      <Sparkles count={200} scale={[30, 10, 20]} size={2} speed={0.2} opacity={0.2} />
    </>
  )
}

// Goal Celebration Effect
export function GoalEffect({ position, color, trigger }) {
  const [spring, api] = useSpring(() => ({
    scale: 0,
    opacity: 0,
    lightIntensity: 0,
    config: { tension: 120, friction: 14 }
  }))

  useEffect(() => {
    if (trigger > 0) {
      api.start({
        from: { scale: 0, opacity: 1, lightIntensity: 5 },
        to: [
          { scale: 8, opacity: 0.5, lightIntensity: 2 },
          { scale: 12, opacity: 0, lightIntensity: 0 }
        ]
      })
    }
  }, [trigger, api])

  return (
    <group position={position}>
      {/* Flash Light */}
      <a.pointLight 
        color={color} 
        intensity={spring.lightIntensity} 
        distance={15} 
        decay={2} 
      />

      {/* Shockwave Ring */}
      <a.mesh rotation={[-Math.PI / 2, 0, 0]} scale={spring.scale}>
        <ringGeometry args={[0.8, 1.2, 32]} />
        <a.meshBasicMaterial 
          color={color} 
          transparent 
          opacity={spring.opacity} 
          side={THREE.DoubleSide}
        />
      </a.mesh>

      {/* Glowing Sphere */}
      <a.mesh scale={spring.scale.to(s => s * 0.5)}>
        <sphereGeometry args={[1, 16, 16]} />
        <a.meshBasicMaterial 
          color={color} 
          transparent 
          opacity={spring.opacity.to(o => o * 0.5)} 
        />
      </a.mesh>

      {/* Particle Burst - Keyed to trigger to force reset */}
      {trigger > 0 && (
        <Sparkles 
          key={`goal-sparkles-${trigger}`}
          count={60} 
          scale={[5, 5, 5]} 
          size={8} 
          speed={3} 
          color={color} 
          opacity={1}
        />
      )}
    </group>
  )
}
