import React, { useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { Stars, Sparkles, useGLTF, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { RigidBody, CuboidCollider, CylinderCollider } from '@react-three/rapier'

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

// Soccer Pitch (Visuals Only)
export function SoccerPitch({
  size = [30, 0.2, 20],
  wallHeight = 10,
  wallThickness = 0.4,
}) {
  return (
    <group>
      <mesh position={[0, 0, 0]} receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color="#3a9d23" roughness={1} />
      </mesh>
      <mesh position={[0, 0.11, 0]} rotation={[-Math.PI/2, 0, 0]}>
        <planeGeometry args={[0.1, 20]} />
        <meshStandardMaterial color="#fff" transparent opacity={0.5} />
      </mesh>
      
      <mesh position={[0, 0.11, -10]} rotation={[-Math.PI/2, 0, 0]}>
        <planeGeometry args={[30, 0.1]} />
        <meshStandardMaterial color="#fff" transparent opacity={0.5} />
      </mesh>
      <mesh position={[0, 0.11, 10]} rotation={[-Math.PI/2, 0, 0]}>
        <planeGeometry args={[30, 0.1]} />
        <meshStandardMaterial color="#fff" transparent opacity={0.5} />
      </mesh>
      <mesh position={[-15, 0.11, 0]} rotation={[-Math.PI/2, 0, 0]}>
        <planeGeometry args={[0.1, 20]} />
        <meshStandardMaterial color="#fff" transparent opacity={0.5} />
      </mesh>
      <mesh position={[15, 0.11, 0]} rotation={[-Math.PI/2, 0, 0]}>
        <planeGeometry args={[0.1, 20]} />
        <meshStandardMaterial color="#fff" transparent opacity={0.5} />
      </mesh>

      <mesh position={[-13, 0.105, 0]} rotation={[-Math.PI/2, 0, 0]}>
        <planeGeometry args={[4, 10]} />
        <meshStandardMaterial color="#fff" transparent opacity={0.2} />
      </mesh>
      <mesh position={[-11, 0.105, 0]} rotation={[-Math.PI/2, 0, 0]}>
        <ringGeometry args={[0, 0.1, 4, 1, 0, Math.PI*2]} />
        <meshStandardMaterial color="#fff" />
      </mesh>

      <mesh position={[13, 0.105, 0]} rotation={[-Math.PI/2, 0, 0]}>
        <planeGeometry args={[4, 10]} />
        <meshStandardMaterial color="#fff" transparent opacity={0.2} />
      </mesh>
      <mesh position={[11, 0.105, 0]} rotation={[-Math.PI/2, 0, 0]}>
        <ringGeometry args={[0, 0.1, 4, 1, 0, Math.PI*2]} />
        <meshStandardMaterial color="#fff" />
      </mesh>

      <mesh position={[0, 0.108, 0]} rotation={[-Math.PI/2, 0, 0]}>
        <ringGeometry args={[2.5, 2.7, 32]} />
        <meshStandardMaterial color="#fff" transparent opacity={0.5} />
      </mesh>
      
      <mesh position={[-size[0]/2 + 1, 0.105, -size[2]/2 + 1]} rotation={[-Math.PI/2, 0, 0]}>
        <ringGeometry args={[0.8, 1.0, 16, 1, 0, Math.PI/2]} />
        <meshStandardMaterial color="#fff" transparent opacity={0.5} />
      </mesh>
      <mesh position={[size[0]/2 - 1, 0.105, -size[2]/2 + 1]} rotation={[-Math.PI/2, 0, Math.PI/2]}>
        <ringGeometry args={[0.8, 1.0, 16, 1, 0, Math.PI/2]} />
        <meshStandardMaterial color="#fff" transparent opacity={0.5} />
      </mesh>
      <mesh position={[size[0]/2 - 1, 0.105, size[2]/2 - 1]} rotation={[-Math.PI/2, 0, Math.PI]}>
        <ringGeometry args={[0.8, 1.0, 16, 1, 0, Math.PI/2]} />
        <meshStandardMaterial color="#fff" transparent opacity={0.5} />
      </mesh>
      <mesh position={[-size[0]/2 + 1, 0.105, size[2]/2 - 1]} rotation={[-Math.PI/2, 0, -Math.PI/2]}>
        <ringGeometry args={[0.8, 1.0, 16, 1, 0, Math.PI/2]} />
        <meshStandardMaterial color="#fff" transparent opacity={0.5} />
      </mesh>

      <RoundedBox args={[size[0] + wallThickness*2, wallHeight, wallThickness]} radius={0.1} smoothness={4} position={[0, wallHeight/2, -size[2]/2 - wallThickness/2]} castShadow receiveShadow>
        <meshStandardMaterial color="#88ccff" roughness={0.1} metalness={0.1} transparent opacity={0.3} />
      </RoundedBox>
      <RoundedBox args={[size[0] + wallThickness*2, wallHeight, wallThickness]} radius={0.1} smoothness={4} position={[0, wallHeight/2, size[2]/2 + wallThickness/2]} castShadow receiveShadow>
        <meshStandardMaterial color="#88ccff" roughness={0.1} metalness={0.1} transparent opacity={0.3} />
      </RoundedBox>
      
      <RoundedBox args={[wallThickness, wallHeight, 20]} radius={0.1} smoothness={4} position={[-size[0]/2 - wallThickness/2, wallHeight/2, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#88ccff" roughness={0.1} metalness={0.1} transparent opacity={0.3} />
      </RoundedBox>
      
      <RoundedBox args={[wallThickness, wallHeight, 20]} radius={0.1} smoothness={4} position={[size[0]/2 + wallThickness/2, wallHeight/2, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#88ccff" roughness={0.1} metalness={0.1} transparent opacity={0.3} />
      </RoundedBox>
      

    </group>
  )
}

export function SoccerGoal({ position = [0, 0, 0], rotation = [0, 0, 0], netColor = '#e0e0e0' }) {
  const { scene } = useGLTF('/models/soccer_goal.glb')
  
  const clonedGoal = useMemo(() => {
    const cloned = scene.clone()
    cloned.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
        if (child.name.toLowerCase().includes('net')) {
          child.material = child.material.clone()
          child.material.color.set(netColor)
          child.material.transparent = true
          child.material.opacity = 0.7
        }
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
