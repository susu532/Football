import React, { useRef, useEffect, useState } from 'react'
import { Canvas, useFrame, useThree, extend } from '@react-three/fiber'
import { Html, Sparkles, Stars } from '@react-three/drei'
import * as THREE from 'three'
import Player from './Player'
import PlayerModel from './PlayerModel'
import useStore from './store'
import { createWorld, stepWorld, getWorld, createSoccerBallBody, createPlayerBody, removeBody } from './physics'
import * as CANNON from 'cannon-es'
import { useSpring, a } from '@react-spring/three'
import { io } from 'socket.io-client'
import TeamSelectPopup from './TeamSelectPopup'

// Small Soccer placeholder - replace with real widget/SDK integration
export function openSoccerPlaceholder() {
  // In a real integration you'd open Soccer's SDK or widget here.
  // Keep this lightweight for the demo.
  window.alert('Open Soccer (placeholder)')
}

function Platform({ position = [0, 0, 0], size = [4, 0.5, 2], color = '#6b8e23' }) {
  return (
    <mesh position={position} receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} />
    </mesh>
  )
}

function CameraController({ targetRef }) {
  const { camera } = useThree()
  const orbit = useRef({
    azimuth: 0,
    polar: Math.PI / 4,
    distance: 8,
    targetDistance: 8,
    dragging: false,
    lastX: 0,
    lastY: 0,
  })

  useEffect(() => {
    const onPointerDown = (e) => {
      if (e.button !== 0) return
      orbit.current.dragging = true
      orbit.current.lastX = e.clientX
      orbit.current.lastY = e.clientY
    }
    const onPointerUp = () => {
      orbit.current.dragging = false
    }
    const onPointerMove = (e) => {
      if (!orbit.current.dragging) return
      const dx = e.clientX - orbit.current.lastX
      const dy = e.clientY - orbit.current.lastY
      orbit.current.lastX = e.clientX
      orbit.current.lastY = e.clientY
      orbit.current.azimuth -= dx * 0.01
      orbit.current.polar -= dy * 0.01
      orbit.current.polar = Math.max(0.2, Math.min(Math.PI / 2, orbit.current.polar))
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointermove', onPointerMove)
    // Wheel -> zoom
    const onWheel = (e) => {
      // Normalize wheel delta (deltaY direction: positive = scroll down = zoom out)
      const delta = e.deltaY
      const zoomSensitivity = 0.025 // tweakable sensitivity
      const minDistance = 3
      const maxDistance = 18
      const current = orbit.current
      current.targetDistance = THREE.MathUtils.clamp(current.targetDistance + delta * zoomSensitivity, minDistance, maxDistance)
    }
    window.addEventListener('wheel', onWheel, { passive: true })
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('wheel', onWheel)
    }
  }, [])

  useFrame(() => {
    const p = (targetRef.current && targetRef.current.position) || { x: 0, y: 0, z: 0 }
    const { azimuth, polar } = orbit.current
    // Smoothly approach target distance for easing
    orbit.current.distance = THREE.MathUtils.lerp(orbit.current.distance, orbit.current.targetDistance ?? orbit.current.distance, 0.12)
    const distance = orbit.current.distance
    const x = p.x + distance * Math.sin(polar) * Math.sin(azimuth)
    const y = p.y + distance * Math.cos(polar) + 2.2
    const z = p.z + distance * Math.sin(polar) * Math.cos(azimuth)
    camera.position.lerp(new THREE.Vector3(x, y, z), 0.15)
    camera.lookAt(p.x, p.y + 1, p.z)
  })
  return null
}

function Door({ position = [16, 1, 0], open = false }) {
  // Door slides up when open
  return (
    <mesh position={[position[0], position[1] + (open ? 2 : 0), position[2]]} castShadow>
      <boxGeometry args={[1, 3, 0.2]} />
      <meshStandardMaterial color={open ? '#8f8' : '#444'} />
    </mesh>
  )
}

function Button({ position = [14, 0.5, 0], onPress }) {
  const [pressed, setPressed] = useState(false)
  const [showSparkles, setShowSparkles] = useState(false)
  const { scale, color } = useSpring({ 
    scale: pressed ? 1.3 : 1, 
    color: pressed ? '#f06292' : '#ffb6d5',
    config: { tension: 300, friction: 10 } 
  })
  
  const handlePress = () => {
    setPressed(true)
    setShowSparkles(true)
    onPress && onPress()
    setTimeout(() => {
      setPressed(false)
      setShowSparkles(false)
    }, 500)
  }
  
  return (
    <group position={position}>
      <a.mesh
        onClick={handlePress}
        castShadow
        scale-x={scale}
        scale-y={scale}
        scale-z={scale}
      >
        <cylinderGeometry args={[0.5, 0.5, 0.2, 32]} />
        <a.meshStandardMaterial color={color} />
      </a.mesh>
      {showSparkles && (
        <Sparkles count={20} scale={2} size={2} speed={0.4} color="#f06292" />
      )}
    </group>
  )
}

function MovingPlatform({ position = [0, 2, -6], size = [3, 0.5, 2], range = 4, speed = 1, platforms, platformIndex }) {
  const meshRef = useRef()
  const [isPlayerOn, setIsPlayerOn] = useState(false)
  
  useFrame(({ clock }) => {
    if (meshRef.current) {
      const newZ = position[2] + Math.sin(clock.getElapsedTime() * speed) * range
      meshRef.current.position.z = newZ
      
      // Update the platform position in the platforms array for collision detection
      if (platforms && platformIndex !== undefined) {
        platforms[platformIndex].position[2] = newZ
      }
    }
  })
  
  return (
    <group>
      <mesh ref={meshRef} position={position} receiveShadow castShadow>
        <boxGeometry args={size} />
        <meshPhysicalMaterial 
          color={isPlayerOn ? "#ff6b9d" : "#bada55"} 
          metalness={0.3}
          roughness={0.4}
          clearcoat={0.5}
        />
      </mesh>
      {isPlayerOn && (
        <Sparkles
          position={[position[0], position[1] + 0.5, position[2]]}
          count={10}
          scale={1.5}
          size={1}
          speed={0.3}
          color="#ff6b9d"
        />
      )}
    </group>
  )
}

function Tree({ position = [10, 0.75, -4] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.75, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.3, 1.5, 12]} />
        <meshStandardMaterial color="#8b5a2b" />
      </mesh>
      <mesh position={[0, 1.7, 0]} castShadow>
        <sphereGeometry args={[0.8, 16, 16]} />
        <meshStandardMaterial color="#228B22" />
      </mesh>
    </group>
  )
}


function Skybox() {
  // Simple color background, can be replaced with textures
  useThree(({ scene }) => {
    scene.background = new THREE.Color('#b3e0ff')
  })
  return null
}

function BlueSky() {
  useThree(({ scene }) => {
    scene.background = null
  })
  return (
    <color attach="background" args={["#87CEEB"]} />
  )
}

function GrassTerrain({ position = [0, -0.05, 0], size = [200, 200] }) {
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={size} />
      <meshStandardMaterial color="#90EE90" roughness={0.8} />
    </mesh>
  )
}

function Street({ position = [0, -0.04, 0], size = [20, 20] }) {
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={size} />
      <meshStandardMaterial color="#2C2C2C" roughness={0.9} />
    </mesh>
  )
}

function Sidewalk({ position = [0, -0.03, 0], size = [25, 25] }) {
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={size} />
      <meshStandardMaterial color="#C0C0C0" roughness={0.8} />
    </mesh>
  )
}

function Building({ position = [0, 0, 0], size = [8, 12, 8], color = "#A0A0A0", windows = true, type = "office" }) {
  return (
    <group position={position}>
      {/* Main building */}
      <mesh position={[0, size[1]/2, 0]} castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshPhysicalMaterial color={color} roughness={0.7} metalness={0.2} />
      </mesh>
      
      {/* Windows */}
      {windows && (
        <>
          {Array.from({ length: Math.floor(size[1]/3) }, (_, i) => (
            <mesh key={i} position={[0, i * 3 - size[1]/2 + 1.5, size[2]/2 + 0.01]}>
              <planeGeometry args={[size[0] * 0.8, 2]} />
              <meshStandardMaterial color="#87CEEB" transparent opacity={0.7} />
            </mesh>
          ))}
        </>
      )}
      
      {/* Building details based on type */}
      {type === "office" && (
        <>
          {/* Rooftop antenna */}
          <mesh position={[0, size[1] + 0.5, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 1, 8]} />
            <meshStandardMaterial color="#404040" />
          </mesh>
          {/* Air conditioning units */}
          <mesh position={[size[0]/3, size[1] + 0.1, size[2]/3]}>
            <boxGeometry args={[1, 0.3, 0.8]} />
            <meshStandardMaterial color="#C0C0C0" />
          </mesh>
        </>
      )}
      
      {type === "residential" && (
        <>
          {/* Chimney */}
          <mesh position={[size[0]/4, size[1] + 0.3, size[2]/4]}>
            <cylinderGeometry args={[0.3, 0.3, 0.6, 8]} />
            <meshStandardMaterial color="#8B4513" />
          </mesh>
          {/* Door */}
          <mesh position={[0, 0.5, size[2]/2 + 0.01]}>
            <planeGeometry args={[1, 2]} />
            <meshStandardMaterial color="#654321" />
          </mesh>
        </>
      )}
      
      {type === "skyscraper" && (
        <>
          {/* Spire */}
          <mesh position={[0, size[1] + 2, 0]}>
            <coneGeometry args={[0.5, 2, 8]} />
            <meshStandardMaterial color="#FFD700" metalness={0.8} />
          </mesh>
          {/* Multiple antennas */}
          <mesh position={[-size[0]/4, size[1] + 1, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 1.5, 6]} />
            <meshStandardMaterial color="#404040" />
          </mesh>
          <mesh position={[size[0]/4, size[1] + 1, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 1.5, 6]} />
            <meshStandardMaterial color="#404040" />
          </mesh>
        </>
      )}
    </group>
  )
}

function Streetlight({ position = [0, 0, 0] }) {
  return (
    <group position={position}>
      {/* Pole */}
      <mesh position={[0, 2, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 4, 8]} />
        <meshStandardMaterial color="#404040" metalness={0.8} />
      </mesh>
      {/* Light */}
      <mesh position={[0, 4.2, 0]} castShadow>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={0.5} />
      </mesh>
    </group>
  )
}

function Car({ position = [0, 0, 0], color = "#FF0000" }) {
  return (
    <group position={position}>
      {/* Body */}
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[2, 0.6, 4]} />
        <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Wheels */}
      <mesh position={[-0.7, 0.1, 1.2]} castShadow>
        <cylinderGeometry args={[0.2, 0.2, 0.3, 8]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh position={[0.7, 0.1, 1.2]} castShadow>
        <cylinderGeometry args={[0.2, 0.2, 0.3, 8]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh position={[-0.7, 0.1, -1.2]} castShadow>
        <cylinderGeometry args={[0.2, 0.2, 0.3, 8]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh position={[0.7, 0.1, -1.2]} castShadow>
        <cylinderGeometry args={[0.2, 0.2, 0.3, 8]} />
        <meshStandardMaterial color="#222" />
      </mesh>
    </group>
  )
}

function CityTree({ position = [0, 0, 0], type = "oak" }) {
  return (
    <group position={position}>
      {/* Trunk */}
      <mesh position={[0, 1, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.3, 2, 8]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
      
      {/* Foliage based on type */}
      {type === "oak" && (
        <>
          <mesh position={[0, 2.5, 0]} castShadow>
            <sphereGeometry args={[1.2, 16, 16]} />
            <meshStandardMaterial color="#228B22" />
          </mesh>
        </>
      )}
      
      {type === "pine" && (
        <>
          <mesh position={[0, 2.2, 0]} castShadow>
            <coneGeometry args={[0.8, 1.5, 8]} />
            <meshStandardMaterial color="#2E8B57" />
          </mesh>
          <mesh position={[0, 3.2, 0]} castShadow>
            <coneGeometry args={[0.6, 1.2, 8]} />
            <meshStandardMaterial color="#2E8B57" />
          </mesh>
          <mesh position={[0, 4.1, 0]} castShadow>
            <coneGeometry args={[0.4, 0.8, 8]} />
            <meshStandardMaterial color="#2E8B57" />
          </mesh>
        </>
      )}
      
      {type === "palm" && (
        <>
          <mesh position={[0, 2.8, 0]} castShadow>
            <sphereGeometry args={[0.3, 8, 8]} />
            <meshStandardMaterial color="#8B4513" />
          </mesh>
          {/* Palm fronds */}
          {[...Array(6)].map((_, i) => (
            <mesh key={i} position={[0, 2.8, 0]} rotation={[0, (i * Math.PI) / 3, 0]}>
              <planeGeometry args={[0.1, 1.5]} />
              <meshStandardMaterial color="#228B22" side={THREE.DoubleSide} />
            </mesh>
          ))}
        </>
      )}
    </group>
  )
}

function Rock({ position = [0, 0.3, 0], scale = 1, type = "boulder" }) {
  return (
    <group position={position} scale={scale}>
      {type === "boulder" && (
        <mesh castShadow receiveShadow>
          <dodecahedronGeometry args={[0.5, 1]} />
          <meshPhysicalMaterial color="#696969" roughness={0.8} metalness={0.1} />
        </mesh>
      )}
      
      {type === "small" && (
        <mesh castShadow receiveShadow>
          <octahedronGeometry args={[0.3, 0]} />
          <meshPhysicalMaterial color="#A9A9A9" roughness={0.7} metalness={0.2} />
        </mesh>
      )}
      
      {type === "flat" && (
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.8, 0.2, 0.6]} />
          <meshPhysicalMaterial color="#778899" roughness={0.9} metalness={0.1} />
        </mesh>
      )}
    </group>
  )
}

function Bush({ position = [0, 0.2, 0], scale = 1 }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.3, 0]} castShadow>
        <sphereGeometry args={[0.4, 12, 12]} />
        <meshStandardMaterial color="#32CD32" />
      </mesh>
      <mesh position={[0.2, 0.4, 0.1]} castShadow>
        <sphereGeometry args={[0.3, 10, 10]} />
        <meshStandardMaterial color="#228B22" />
      </mesh>
      <mesh position={[-0.2, 0.4, -0.1]} castShadow>
        <sphereGeometry args={[0.3, 10, 10]} />
        <meshStandardMaterial color="#228B22" />
      </mesh>
    </group>
  )
}

function TrashCan({ position = [0, 0, 0] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.3, 0.3, 1, 8]} />
        <meshStandardMaterial color="#404040" metalness={0.6} />
      </mesh>
    </group>
  )
}

function Bench({ position = [0, 0, 0] }) {
  return (
    <group position={position}>
      {/* Seat */}
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[2, 0.1, 0.5]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
      {/* Back */}
      <mesh position={[0, 0.6, -0.2]} castShadow>
        <boxGeometry args={[2, 0.6, 0.1]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
      {/* Legs */}
      <mesh position={[-0.8, 0.15, 0]} castShadow>
        <boxGeometry args={[0.1, 0.3, 0.1]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
      <mesh position={[0.8, 0.15, 0]} castShadow>
        <boxGeometry args={[0.1, 0.3, 0.1]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
    </group>
  )
}

function PinkFlower({ position = [0, 0.1, 0], scale = 1, color = "#f06292" }) {
  return (
    <group position={position} scale={scale}>
      {/* Stem */}
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.3, 8]} />
        <meshStandardMaterial color="#a5d6a7" />
      </mesh>
      {/* Petals */}
      {[...Array(6)].map((_, i) => (
        <mesh key={i} position={[Math.cos(i * Math.PI/3) * 0.13, 0.32, Math.sin(i * Math.PI/3) * 0.13]}>
          <sphereGeometry args={[0.07, 8, 8]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
      {/* Center */}
      <mesh position={[0, 0.32, 0]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color="#fff59d" />
      </mesh>
    </group>
  )
}

function PinkHeart({ position = [0, 0.2, 0], scale = 1, color = "#f06292" }) {
  // Heart shape using two spheres and a cone
  return (
    <group position={position} scale={scale}>
      <mesh position={[-0.07, 0.22, 0]}>
        <sphereGeometry args={[0.09, 10, 10]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0.07, 0.22, 0]}>
        <sphereGeometry args={[0.09, 10, 10]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh rotation={[Math.PI, 0, Math.PI/4]} position={[0, 0.13, 0]}>
        <coneGeometry args={[0.13, 0.18, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  )
}

// Soccer Pitch (Stadium Look)
function SoccerPitch({
  size = [24, 0.2, 14],
  wallHeight = 2.5,
  wallThickness = 0.4,
}) {
  // Pitch
  return (
    <group>
      {/* Grass field */}
      <mesh position={[0, 0, 0]} receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color="#3a9d23" />
      </mesh>
      {/* White lines */}
      <mesh position={[0, 0.01, 0]} receiveShadow>
        <planeGeometry args={[size[0] * 0.98, size[2] * 0.98]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.08} />
      </mesh>
      {/* Center circle */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI/2, 0, 0]}>
        <ringGeometry args={[2.5, 2.7, 32]} />
        <meshStandardMaterial color="#fff" transparent opacity={0.5} />
      </mesh>
      {/* Walls */}
      {/* Left */}
      <mesh position={[-size[0]/2 - wallThickness/2, wallHeight/2, 0]} castShadow receiveShadow>
        <boxGeometry args={[wallThickness, wallHeight, size[2]+wallThickness*2]} />
        <meshStandardMaterial color="#888" />
      </mesh>
      {/* Right */}
      <mesh position={[size[0]/2 + wallThickness/2, wallHeight/2, 0]} castShadow receiveShadow>
        <boxGeometry args={[wallThickness, wallHeight, size[2]+wallThickness*2]} />
        <meshStandardMaterial color="#888" />
      </mesh>
      {/* Top */}
      <mesh position={[0, wallHeight/2, -size[2]/2 - wallThickness/2]} castShadow receiveShadow>
        <boxGeometry args={[size[0]+wallThickness*2, wallHeight, wallThickness]} />
        <meshStandardMaterial color="#888" />
      </mesh>
      {/* Bottom */}
      <mesh position={[0, wallHeight/2, size[2]/2 + wallThickness/2]} castShadow receiveShadow>
        <boxGeometry args={[size[0]+wallThickness*2, wallHeight, wallThickness]} />
        <meshStandardMaterial color="#888" />
      </mesh>
      {/* Stadium stands (simple) */}
      {/* Removed the top black platform */}
    </group>
  )
}

// Soccer Goal (improved, with net and team color support)
function SoccerGoal({ position = [0, 0, 0], rotation = [0, 0, 0], width = 4, height = 2, depth = 1.2, netColor = '#e0e0e0' }) {
  // Net grid
  const netRows = 7
  const netCols = 10
  const netW = width
  const netH = height
  const netD = depth
  const netThickness = 0.04
  const postsColor = '#fff'
  return (
    <group position={position} rotation={rotation}>
      {/* Posts */}
      <mesh position={[-netW/2, netH/2, 0]}>
        <cylinderGeometry args={[0.08, 0.08, netH, 16]} />
        <meshStandardMaterial color={postsColor} />
      </mesh>
      <mesh position={[netW/2, netH/2, 0]}>
        <cylinderGeometry args={[0.08, 0.08, netH, 16]} />
        <meshStandardMaterial color={postsColor} />
      </mesh>
      {/* Crossbar */}
      <mesh position={[0, netH, 0]} rotation={[0, 0, Math.PI/2]}>
        <cylinderGeometry args={[0.08, 0.08, netW, 16]} />
        <meshStandardMaterial color={postsColor} />
      </mesh>
      {/* Back bar */}
      <mesh position={[0, 0.08, -netD]} rotation={[0, 0, Math.PI/2]}>
        <cylinderGeometry args={[0.06, 0.06, netW, 12]} />
        <meshStandardMaterial color={postsColor} />
      </mesh>
      {/* Side bars (top to back) */}
      <mesh position={[-netW/2, netH, -netD/2]} rotation={[0, Math.PI/2, 0]}>
        <cylinderGeometry args={[0.06, 0.06, netD, 12]} />
        <meshStandardMaterial color={postsColor} />
      </mesh>
      <mesh position={[netW/2, netH, -netD/2]} rotation={[0, Math.PI/2, 0]}>
        <cylinderGeometry args={[0.06, 0.06, netD, 12]} />
        <meshStandardMaterial color={postsColor} />
      </mesh>
      {/* Net (vertical and horizontal lines) */}
      {Array.from({ length: netCols + 1 }).map((_, i) => (
        <mesh key={'net-v-' + i} position={[-netW/2 + (i * netW / netCols), netH/2, -netD/2]} rotation={[0, 0, 0]}>
          <cylinderGeometry args={[netThickness, netThickness, netH, 8]} />
          <meshStandardMaterial color={netColor} />
        </mesh>
      ))}
      {Array.from({ length: netRows + 1 }).map((_, j) => (
        <mesh key={'net-h-' + j} position={[0, (j * netH / netRows), -netD/2]} rotation={[0, 0, Math.PI/2]}>
          <cylinderGeometry args={[netThickness, netThickness, netW, 8]} />
          <meshStandardMaterial color={netColor} />
        </mesh>
      ))}
      {/* Net depth lines */}
      {Array.from({ length: netCols + 1 }).map((_, i) => (
        <mesh key={'net-d-' + i} position={[-netW/2 + (i * netW / netCols), 0.08, -netD/2]} rotation={[Math.PI/2, 0, 0]}>
          <cylinderGeometry args={[netThickness, netThickness, netD, 8]} />
          <meshStandardMaterial color={netColor} />
        </mesh>
      ))}
      {Array.from({ length: netCols + 1 }).map((_, i) => (
        <mesh key={'net-d-top-' + i} position={[-netW/2 + (i * netW / netCols), netH, -netD/2]} rotation={[Math.PI/2, 0, 0]}>
          <cylinderGeometry args={[netThickness, netThickness, netD, 8]} />
          <meshStandardMaterial color={netColor} />
        </mesh>
      ))}
    </group>
  )
}

// Soccer Ball (classic black and white pattern)
const SoccerBall = React.forwardRef(function SoccerBall({ position = [0, 0.25, 0], radius = 0.3 }, ref) {
  // Use a mesh with a texture for the classic look
  // For now, use a procedural pattern with black pentagons
  // (for full realism, a texture can be loaded later)
  return (
    <mesh ref={ref} position={position} castShadow receiveShadow>
      <sphereGeometry args={[radius, 32, 32]} />
      {/* White base */}
      <meshStandardMaterial color="#fff" />
      {/* Black pentagons (approximate, not perfect) */}
      {Array.from({ length: 12 }).map((_, i) => {
        // Distribute pentagons roughly on sphere
        const phi = Math.acos(-1 + (2 * i) / 12)
        const theta = Math.PI * (1 + Math.sqrt(5)) * i
        const x = Math.cos(theta) * Math.sin(phi) * radius
        const y = Math.cos(phi) * radius
        const z = Math.sin(theta) * Math.sin(phi) * radius
        return (
          <mesh key={i} position={[x, y, z]}>
            <circleGeometry args={[radius * 0.18, 8]} />
            <meshStandardMaterial color="#222" />
          </mesh>
        )
      })}
    </mesh>
  )
})

function LocalPlayerWithSync({ socket, playerId, playerRef, hasModel, playerName = '', playerTeam = '', teamColor = '#888', spawnPosition = [0, 1, 0] }) {
  // Physics body for the player (to push the ball)
  const [body] = useState(() => createPlayerBody(spawnPosition))
  
  useEffect(() => {
    const world = getWorld()
    world.addBody(body)
    return () => world.removeBody(body)
  }, [body])

  // Sync physics body with player position
  useFrame(() => {
    if (playerRef.current && body) {
      // Update physics body to match player position (Kinematic)
      const pos = playerRef.current.position
      body.position.set(pos.x, pos.y, pos.z)
    }
  })

  // Send player movement to server with player data
  useFrame(() => {
    if (!socket || !playerId || !playerRef.current) return
    const pos = playerRef.current.position
    const rot = playerRef.current.rotation ? playerRef.current.rotation.y : 0
    socket.emit('move', { 
      position: [pos.x, pos.y, pos.z], 
      rotation: rot,
      name: playerName,
      team: playerTeam,
      color: teamColor
    })
  })
  // Render local player with team color and name label
  return (
    <group>
      {hasModel ? (
        <PlayerModel ref={playerRef} position={spawnPosition} color={teamColor}>
          {playerName && (
            <Html position={[0, 2.2, 0]} center distanceFactor={8}>
              <div className={`player-name-label ${playerTeam}`}>{playerName}</div>
            </Html>
          )}
        </PlayerModel>
      ) : (
        <Player ref={playerRef} position={spawnPosition} color={teamColor}>
          {playerName && (
            <Html position={[0, 2.2, 0]} center distanceFactor={8}>
              <div className={`player-name-label ${playerTeam}`}>{playerName}</div>
            </Html>
          )}
        </Player>
      )}
    </group>
  )
}

function SoccerBallWithPhysics({ ballBody, socket, playerId, remotePlayers }) {
  const meshRef = useRef()
  // Sync mesh with physics
  useFrame(() => {
    if (meshRef.current && ballBody) {
      meshRef.current.position.copy(ballBody.position)
      meshRef.current.quaternion.copy(ballBody.quaternion)
    }
  })
  // Host sends ball state to server
  useFrame(() => {
    if (!socket || !playerId) return
    if (Object.keys(remotePlayers)[0] === playerId) {
      if (ballBody) {
        socket.emit('ball-update', {
          position: [ballBody.position.x, ballBody.position.y, ballBody.position.z],
          velocity: [ballBody.velocity.x, ballBody.velocity.y, ballBody.velocity.z],
        })
      }
    }
  })
  return <SoccerBall ref={meshRef} />
}

function RemotePlayer({ position = [0, 1, 0], color = '#888', rotation = 0, playerName = '', team = '' }) {
  // Remote player using cat-like geometry for consistency
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Body: elongated ellipsoid */}
      <mesh position={[0, 0.08, 0]} scale={[0.5, 0.32, 0.28]} castShadow>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial color={color} roughness={0.7} metalness={0.05} />
      </mesh>
      {/* Head: realistic proportion */}
      <mesh position={[0, 0.6, 0.02]} scale={[0.42, 0.42, 0.38]} castShadow>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.02} />
      </mesh>
      {/* Ears */}
      <mesh position={[-0.18, 0.95, 0]} rotation={[0, 0, -0.2]} scale={[0.9, 0.9, 0.9]} castShadow>
        <coneGeometry args={[0.09, 0.22, 20]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0.18, 0.95, 0]} rotation={[0, 0, 0.2]} scale={[0.9, 0.9, 0.9]} castShadow>
        <coneGeometry args={[0.09, 0.22, 20]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Eyes */}
      <group position={[-0.12, 0.82, 0.08]}> 
        <mesh scale={[0.105, 0.06, 0.01]}> <sphereGeometry args={[1, 16, 16]} /><meshStandardMaterial color="#f6f6f6" /></mesh>
        <mesh position={[0, 0, 0.01]} scale={[0.06, 0.035, 0.01]}> <circleGeometry args={[1, 32]} /><meshStandardMaterial color="#000" /></mesh>
      </group>
      <group position={[0.12, 0.82, 0.08]}> 
        <mesh scale={[0.105, 0.06, 0.01]}> <sphereGeometry args={[1, 16, 16]} /><meshStandardMaterial color="#f6f6f6" /></mesh>
        <mesh position={[0, 0, 0.01]} scale={[0.06, 0.035, 0.01]}> <circleGeometry args={[1, 32]} /><meshStandardMaterial color="#000" /></mesh>
      </group>
      {/* Player name label */}
      {playerName && (
        <Html position={[0, 2.2, 0]} center distanceFactor={8}>
          <div className={`player-name-label ${team}`}>{playerName}</div>
        </Html>
      )}
    </group>
  )
}

function RemotePlayerWithPhysics({ id, position = [0, 1, 0], color = '#888', rotation = 0, playerName = '', team = '' }) {
  // Physics body for remote player
  const [body] = useState(() => createPlayerBody(position))
  
  useEffect(() => {
    const world = getWorld()
    world.addBody(body)
    return () => world.removeBody(body)
  }, [body])

  // Sync physics body with remote player position
  useFrame(() => {
    if (body) {
      body.position.set(position[0], position[1], position[2])
    }
  })

  return (
    <RemotePlayer position={position} color={color} rotation={rotation} playerName={playerName} team={team} />
  )
}

function PhysicsHandler() {
  useFrame((_, delta) => {
    stepWorld(Math.min(delta, 0.1))
  })
  return null
}

export default function Scene() {
  const playerRef = useRef()
  const [hasModel, setHasModel] = useState(false)
  const [socket, setSocket] = useState(null)
  const [playerId, setPlayerId] = useState(null)
  const [remotePlayers, setRemotePlayers] = useState({})
  const [ballBody] = useState(() => createSoccerBallBody())
  const pitchSize = [24, 0.2, 14]
  
  // Get player state from store
  const hasJoined = useStore((s) => s.hasJoined)
  const playerName = useStore((s) => s.playerName)
  const playerTeam = useStore((s) => s.playerTeam)
  
  // Team colors
  const teamColors = {
    red: '#ff4757',
    blue: '#3742fa'
  }

  // Connect to socket.io server
  useEffect(() => {
    const s = io('https://socket-rox7.onrender.com')
    setSocket(s)
    s.on('init', ({ id, players, ball }) => {
      setPlayerId(id)
      setRemotePlayers(players)
      if (ballBody) {
        ballBody.position.set(...ball.position)
        ballBody.velocity.set(...ball.velocity)
      }
    })
    s.on('player-joined', (player) => {
      setRemotePlayers((prev) => ({ ...prev, [player.id]: player }))
    })
    s.on('player-move', ({ id, position, rotation, name, team, color }) => {
      setRemotePlayers((prev) => prev[id] ? { ...prev, [id]: { ...prev[id], position, rotation, name, team, color } } : prev)
    })
    s.on('player-left', (id) => {
      setRemotePlayers((prev) => {
        const copy = { ...prev }
        delete copy[id]
        return copy
      })
    })
    s.on('ball-update', (ball) => {
      if (ballBody) {
        ballBody.position.set(...ball.position)
        ballBody.velocity.set(...ball.velocity)
      }
    })
    return () => {
      s.disconnect()
    }
  }, [ballBody])

  useEffect(() => {
    // Add soccer ball to physics world
    const world = createWorld()
    world.addBody(ballBody)
    return () => {
      world.removeBody(ballBody)
    }
  }, [ballBody])

  // Manage remote player physics bodies
  useEffect(() => {
    const world = getWorld()
    const bodies = {} // Map id -> body

    // We need to sync bodies with remotePlayers state
    // But since we can't easily diff inside this effect without refs or complex logic,
    // we'll use a ref to track created bodies or just iterate.
    // Actually, a better way is to handle body creation/update in a separate component for each remote player,
    // or do it here. Let's do it here for simplicity but we need to be careful not to recreate bodies constantly.
    
    // Strategy: We'll use a ref to store the bodies map so it persists across renders
    // But we can't easily use a ref inside this effect if we want to react to remotePlayers changes.
    // Instead, let's make a RemotePlayerPhysics component that handles its own body!
    // That's much cleaner.
  }, []) 

  // Reset ball on 'P' key

  // Reset ball on 'P' key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key.toLowerCase() === 'p') {
        if (ballBody) {
          ballBody.position.set(0, 0.5, 0)
          ballBody.velocity.set(0, 0, 0)
          ballBody.angularVelocity.set(0, 0, 0)
          
          if (socket) {
            socket.emit('ball-update', {
              position: [0, 0.5, 0],
              velocity: [0, 0, 0]
            })
          }
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [ballBody, socket])



  if (!hasJoined) {
    return <TeamSelectPopup />
  }

  return (
    <Canvas shadows camera={{ position: [0, 8, 18], fov: 60 }}>
      <PhysicsHandler />
      <color attach="background" args={["#87CEEB"]} />
      <ambientLight intensity={0.7} color="#FFFFFF" />
      <directionalLight position={[10, 30, 10]} intensity={2} color="#fff" castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
      {/* Stadium lights */}
      <pointLight position={[-10, 15, -10]} intensity={1.2} color="#fff" />
      <pointLight position={[10, 15, 10]} intensity={1.2} color="#fff" />
      {/* Soccer pitch */}
      <SoccerPitch size={pitchSize} />
      {/* Goals with team colors - Blue team defends top goal, Red team defends bottom goal */}
      <SoccerGoal position={[0, 0.1, -pitchSize[2]/2+0.7]} netColor={teamColors.blue} />
      <SoccerGoal position={[0, 0.1, pitchSize[2]/2-0.7]} rotation={[0, Math.PI, 0]} netColor={teamColors.red} />
      {/* Soccer ball with physics (syncs with server) */}
      <SoccerBallWithPhysics ballBody={ballBody} socket={socket} playerId={playerId} remotePlayers={remotePlayers} />
      {/* Local player with multiplayer sync */}
      <LocalPlayerWithSync 
        socket={socket} 
        playerId={playerId} 
        playerRef={playerRef} 
        hasModel={hasModel} 
        playerName={playerName}
        playerTeam={playerTeam}
        teamColor={teamColors[playerTeam]}
        spawnPosition={playerTeam === 'red' ? [0, 1, 5] : [0, 1, -5]}
      />
      {/* Remote players */}
      {Object.entries(remotePlayers).map(([id, p]) => (
        id !== playerId && <RemotePlayerWithPhysics key={id} id={id} position={p.position} color={p.color || '#888'} rotation={p.rotation} playerName={p.name} team={p.team} />
      ))}
      {/* Camera controller */}
      <CameraController targetRef={playerRef} />
      {/* HUD and overlays */}
      <Html fullscreen>
        <div className="hud">
          <div className="hud-left">Use WASD/arrows to move. {playerName && `Playing as: ${playerName}`}</div>
        </div>
      </Html>
    </Canvas>
  )
}



// Note: we check for model availability inside the Scene component on mount.

function Coins({ playerRef, positions = [] }) {
  const collectCoin = useStore((s) => s.collectCoin)
  const coinsRef = useRef([])
  const [collected, setCollected] = useState(Array(positions.length).fill(false))
  const [showSparkles, setShowSparkles] = useState(Array(positions.length).fill(false))

  useFrame(() => {
    // stepWorld() - Moved to Scene component
    const playerPos = playerRef.current ? playerRef.current.position : null
    if (!playerPos) return
    positions.forEach((pos, i) => {
      const cr = coinsRef.current[i]
      if (!cr) return
      cr.rotation.y += 0.1
      if (!collected[i] && playerPos.distanceTo(cr.position) < 1) {
        collectCoin()
        setCollected((prev) => {
          const arr = [...prev]; arr[i] = true; return arr;
        })
        setShowSparkles((prev) => {
          const arr = [...prev]; arr[i] = true; return arr;
        })
        setTimeout(() => {
          setShowSparkles((prev) => {
            const arr = [...prev]; arr[i] = false; return arr;
          })
        }, 1000)
      }
    })
  })

  return (
    <group>
      {positions.map((p, i) => {
        const { scale, rotation } = useSpring({
          scale: collected[i] ? 0 : 1,
          rotation: [0, 0, 0],
          config: { tension: 300, friction: 20 },
        })
        return (
          <group key={i} position={p}>
            <a.mesh
          ref={(el) => (coinsRef.current[i] = el)}
          rotation={[0, 0, 0]}
          castShadow
              scale-x={scale}
              scale-y={scale}
              scale-z={scale}
            >
              <torusGeometry args={[0.25, 0.08, 18, 32]} />
              <meshPhysicalMaterial 
                color="#ffd7fa" 
                metalness={0.8} 
                roughness={0.2} 
                clearcoat={0.6} 
                iridescence={0.4}
                emissive="#ffa"
                emissiveIntensity={0.3}
              />
              {/* Heart pattern */}
              <mesh position={[0, 0, 0.13]} scale={[0.18, 0.18, 0.01]}>
                <sphereGeometry args={[1, 8, 8]} />
                <meshStandardMaterial color="#f06292" />
        </mesh>
            </a.mesh>
            {showSparkles[i] && (
              <Sparkles count={15} scale={1.5} size={1.5} speed={0.6} color="#ffd700" />
            )}
          </group>
        )
      })}
    </group>
  )
}
