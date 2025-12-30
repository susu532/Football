import React, { useRef, useEffect, useState, Suspense } from 'react'
import { Canvas, useFrame, useThree, extend } from '@react-three/fiber'
import { Html, Sparkles, Stars, Loader, useGLTF, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import CharacterSkin from './CharacterSkin'
import useStore from './store'
import { createWorld, stepWorld, getWorld, createSoccerBallBody, createPlayerBody, removeBody } from './physics'
import * as CANNON from 'cannon-es'
import { useSpring, a } from '@react-spring/three'
import { io } from 'socket.io-client'
import TeamSelectPopup from './TeamSelectPopup'
import { PhysicsHandler, GoalDetector } from './GameLogic'
import { PowerUp, POWER_UP_TYPES } from './PowerUp'

// Small Soccer placeholder - replace with real widget/SDK integration
function openSoccerPlaceholder() {
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

function CameraController({ targetRef, isFreeLook }) {
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
      if (e.button !== 0 && e.button !== 2) return
      
      orbit.current.dragging = true
      orbit.current.lastX = e.clientX
      orbit.current.lastY = e.clientY
      
      if (e.button === 2 && isFreeLook) {
        console.log("Free Look ACTIVE")
        isFreeLook.current = true
      }
    }
    const onPointerUp = () => {
      orbit.current.dragging = false
      if (isFreeLook) {
        console.log("Free Look INACTIVE")
        isFreeLook.current = false
      }
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
    
    const onContextMenu = (e) => e.preventDefault()

    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('contextmenu', onContextMenu)
    
    const onWheel = (e) => {
      const delta = e.deltaY
      const zoomSensitivity = 0.025
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
      window.removeEventListener('contextmenu', onContextMenu)
      window.removeEventListener('wheel', onWheel)
    }
  }, [isFreeLook])

  useFrame(() => {
    const p = (targetRef.current && targetRef.current.position) || { x: 0, y: 0, z: 0 }
    const { azimuth, polar } = orbit.current
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

function StadiumDoor({ position = [16, 1, 0], open = false }) {
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
  size = [30, 0.2, 20],
  wallHeight = 10, // Doubled height
  wallThickness = 0.4,
}) {
  // Pitch
  return (
    <group>
      {/* Grass field */}
      <mesh position={[0, 0, 0]} receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color="#3a9d23" roughness={1} />
      </mesh>
      {/* White lines */}
      
      {/* Center circle */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI/2, 0, 0]}>
        <ringGeometry args={[2.5, 2.7, 32]} />
        <meshStandardMaterial color="#fff" transparent opacity={0.5} />
      </mesh>
      {/* Corner Arcs */}
      {/* Top-Left */}
      <mesh position={[-size[0]/2 + 1, 0.02, -size[2]/2 + 1]} rotation={[-Math.PI/2, 0, 0]}>
        <ringGeometry args={[0.8, 1.0, 16, 1, 0, Math.PI/2]} />
        <meshStandardMaterial color="#fff" transparent opacity={0.5} />
      </mesh>
      {/* Top-Right */}
      <mesh position={[size[0]/2 - 1, 0.02, -size[2]/2 + 1]} rotation={[-Math.PI/2, 0, Math.PI/2]}>
        <ringGeometry args={[0.8, 1.0, 16, 1, 0, Math.PI/2]} />
        <meshStandardMaterial color="#fff" transparent opacity={0.5} />
      </mesh>
      {/* Bottom-Right */}
      <mesh position={[size[0]/2 - 1, 0.02, size[2]/2 - 1]} rotation={[-Math.PI/2, 0, Math.PI]}>
        <ringGeometry args={[0.8, 1.0, 16, 1, 0, Math.PI/2]} />
        <meshStandardMaterial color="#fff" transparent opacity={0.5} />
      </mesh>
      {/* Bottom-Left */}
      <mesh position={[-size[0]/2 + 1, 0.02, size[2]/2 - 1]} rotation={[-Math.PI/2, 0, -Math.PI/2]}>
        <ringGeometry args={[0.8, 1.0, 16, 1, 0, Math.PI/2]} />
        <meshStandardMaterial color="#fff" transparent opacity={0.5} />
      </mesh>

      {/* Walls with Rounded Corners (Chamfered) - Semi-Invisible Glass Look */}
      {/* Top Wall (Full Width) */}
      <RoundedBox args={[size[0] + wallThickness*2, wallHeight, wallThickness]} radius={0.1} smoothness={4} position={[0, wallHeight/2, -size[2]/2 - wallThickness/2]} castShadow receiveShadow>
        <meshPhysicalMaterial color="#88ccff" roughness={0.1} metalness={0.1} transmission={0.6} thickness={0.5} transparent opacity={0.3} />
      </RoundedBox>
      {/* Bottom Wall (Full Width) */}
      <RoundedBox args={[size[0] + wallThickness*2, wallHeight, wallThickness]} radius={0.1} smoothness={4} position={[0, wallHeight/2, size[2]/2 + wallThickness/2]} castShadow receiveShadow>
        <meshPhysicalMaterial color="#88ccff" roughness={0.1} metalness={0.1} transmission={0.6} thickness={0.5} transparent opacity={0.3} />
      </RoundedBox>
      
      {/* Left Side Walls (Length 7 each) */}
      <RoundedBox args={[wallThickness, wallHeight, 7]} radius={0.1} smoothness={4} position={[-size[0]/2 - wallThickness/2, wallHeight/2, -6.5]} castShadow receiveShadow>
        <meshPhysicalMaterial color="#88ccff" roughness={0.1} metalness={0.1} transmission={0.6} thickness={0.5} transparent opacity={0.3} />
      </RoundedBox>
      <RoundedBox args={[wallThickness, wallHeight, 7]} radius={0.1} smoothness={4} position={[-size[0]/2 - wallThickness/2, wallHeight/2, 6.5]} castShadow receiveShadow>
        <meshPhysicalMaterial color="#88ccff" roughness={0.1} metalness={0.1} transmission={0.6} thickness={0.5} transparent opacity={0.3} />
      </RoundedBox>
      
      {/* Right Side Walls (Length 7 each) */}
      <RoundedBox args={[wallThickness, wallHeight, 7]} radius={0.1} smoothness={4} position={[size[0]/2 + wallThickness/2, wallHeight/2, -6.5]} castShadow receiveShadow>
        <meshPhysicalMaterial color="#88ccff" roughness={0.1} metalness={0.1} transmission={0.6} thickness={0.5} transparent opacity={0.3} />
      </RoundedBox>
      <RoundedBox args={[wallThickness, wallHeight, 7]} radius={0.1} smoothness={4} position={[size[0]/2 + wallThickness/2, wallHeight/2, 6.5]} castShadow receiveShadow>
        <meshPhysicalMaterial color="#88ccff" roughness={0.1} metalness={0.1} transmission={0.6} thickness={0.5} transparent opacity={0.3} />
      </RoundedBox>
      
      {/* Semi-Invisible Roof */}
      <mesh position={[0, wallHeight, 0]} rotation={[-Math.PI/2, 0, 0]} receiveShadow>
        <planeGeometry args={[size[0] + 2, size[2] + 2]} />
        <meshBasicMaterial color="#88ccff" transparent opacity={0.1} side={THREE.DoubleSide} depthWrite={false} />
        {/* Grid pattern for the roof to make it slightly visible */}
        
      </mesh>
    </group>
  )
}

// Soccer Goal (using GLB model)
function SoccerGoal({ position = [0, 0, 0], rotation = [0, 0, 0], netColor = '#e0e0e0' }) {
  const { scene } = useGLTF('/models/soccer_goal.glb')
  
  // Clone the model to avoid sharing state
  const clonedGoal = React.useMemo(() => {
    const cloned = scene.clone()
    cloned.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
        // If the model has a net part, we could try to color it
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
      scale={0.01} // GLB models may need scaling
    />
  )
}

// Mystery Shack Environment
function MysteryShack() {
  const gltf = useGLTF('/models/gravity_falls.glb')
  
  // Clone to avoid issues if used multiple times (though here it's once)
  const scene = React.useMemo(() => {
    const cloned = gltf.scene.clone()
    cloned.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })
    return cloned
  }, [gltf.scene])

  return <primitive object={scene} position={[0, -10, 0]} scale={4} />
}

// Soccer Ball (using GLB model)
const SoccerBall = React.forwardRef(function SoccerBall({ position = [0, 0.25, 0], radius = 0.22 }, ref) {
  const { scene } = useGLTF('/models/soccer_ball.glb')
  
  const clonedBall = React.useMemo(() => {
    const cloned = scene.clone()
    cloned.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })
    return cloned
  }, [scene])

  return (
    <primitive 
      ref={ref}
      object={clonedBall} 
      position={position} 
      scale={5} // Scale to match physics diameter (0.44)
    />
  )
})

function LocalPlayerWithSync({ socket, playerId, playerRef, hasModel, playerName = '', playerTeam = '', teamColor = '#888', spawnPosition = [0, 1, 0], remotePlayers = {}, ballBody = null, powerUps = [], onCollectPowerUp = null, onPowerUpActive = null, isFreeLook = null }) {
  // Callback when player kicks the ball - send update to server
  const handleKick = () => {
    if (socket && ballBody) {
      socket.emit('ball-update', {
        position: [ballBody.position.x, ballBody.position.y, ballBody.position.z],
        velocity: [ballBody.velocity.x, ballBody.velocity.y, ballBody.velocity.z],
      })
    }
  }
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
  const lastUpdate = useRef(0)
  useFrame((state) => {
    if (!socket || !playerId || !playerRef.current) return
    
    // Throttle updates to ~30 times per second (every 33ms)
    const now = state.clock.getElapsedTime()
    if (now - lastUpdate.current < 0.033) return
    lastUpdate.current = now

    const pos = playerRef.current.position
    const rot = playerRef.current.rotation ? playerRef.current.rotation.y : 0
    // Read invisible and giant state from userData (set by CharacterSkin)
    const invisible = playerRef.current.userData?.invisible || false
    const giant = playerRef.current.userData?.giant || false
    
    // Update physics body radius dynamically
    if (body && body.shapes.length > 0) {
      const targetRadius = giant ? 3.0 : 0.9 // 10x radius if giant
      if (body.shapes[0].radius !== targetRadius) {
        body.shapes[0].radius = targetRadius
        body.updateBoundingRadius()
      }
    }
    
    socket.emit('move', { 
      position: [pos.x, pos.y, pos.z], 
      rotation: rot,
      name: playerName,
      team: playerTeam,
      color: teamColor,
      invisible, // Send invisible state
      giant // Send giant state
    })
  })

  // Create a separate ref for the name label that follows the player
  const labelRef = useRef()
  
  useFrame(() => {
    if (labelRef.current && playerRef.current) {
      labelRef.current.position.copy(playerRef.current.position)
    }
  })

  // Render local player with CharacterSkin (new GLB models)
  return (
    <group>
      <CharacterSkin 
        ref={playerRef} 
        position={spawnPosition} 
        teamColor={teamColor} 
        remotePlayers={remotePlayers} 
        ballBody={ballBody} 
        onKick={handleKick}
        powerUps={powerUps}
        onCollectPowerUp={onCollectPowerUp}
        onPowerUpActive={onPowerUpActive}
        isFreeLook={isFreeLook}
      />
      {/* Name label follows player position */}
      {playerName && (
        <group ref={labelRef}>
          <Html position={[0, 2.2, 0]} center distanceFactor={8}>
            <div className={`player-name-label ${playerTeam}`}>{playerName}</div>
          </Html>
        </group>
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
        <mesh scale={[0.105, 0.06, 0.01]}><sphereGeometry args={[1, 16, 16]} /><meshStandardMaterial color="#f6f6f6" /></mesh>
        <mesh position={[0, 0, 0.01]} scale={[0.06, 0.035, 0.01]}><circleGeometry args={[1, 32]} /><meshStandardMaterial color="#000" /></mesh>
      </group>
      <group position={[0.12, 0.82, 0.08]}>
        <mesh scale={[0.105, 0.06, 0.01]}><sphereGeometry args={[1, 16, 16]} /><meshStandardMaterial color="#f6f6f6" /></mesh>
        <mesh position={[0, 0, 0.01]} scale={[0.06, 0.035, 0.01]}><circleGeometry args={[1, 32]} /><meshStandardMaterial color="#000" /></mesh>
      </group>
      {/* Player name label */}{playerName && (
        <Html position={[0, 2.2, 0]} center distanceFactor={8}>
          <div className={`player-name-label ${team}`}>{playerName}</div>
        </Html>
      )}</group>
  )
}

// Single player model path for all players (cat model)
const PLAYER_MODEL_PATH = '/models/cat.glb'

function RemotePlayerWithPhysics({ id, position = [0, 1, 0], color = '#888', rotation = 0, playerName = '', team = '', invisible = false, giant = false }) {
  // Physics body for remote player
  const [body] = useState(() => createPlayerBody(position))
  const groupRef = useRef()
  const targetPosition = useRef(new THREE.Vector3(...position))
  const targetRotation = useRef(rotation)
  
  // Update physics body radius for remote players
  useEffect(() => {
    if (body && body.shapes.length > 0) {
      const targetRadius = giant ? 9.0 : 0.9
      if (body.shapes[0].radius !== targetRadius) {
        body.shapes[0].radius = targetRadius
        body.updateBoundingRadius()
      }
    }
  }, [body, giant])

  // Load GLB model for remote player
  const { scene } = useGLTF(PLAYER_MODEL_PATH)
  
  const clonedScene = React.useMemo(() => {
    const cloned = scene.clone()
    cloned.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material = child.material.clone()
        // Apply team color to the model
        child.material.color = new THREE.Color(color)
        child.castShadow = true
        child.receiveShadow = true
        // Enable transparency for invisibility
        child.material.transparent = true
        child.material.opacity = 1.0
      }
    })
    return cloned
  }, [scene, color])
  
  // Handle invisibility and giant updates
  useFrame(() => {
    if (groupRef.current) {
      // Giant Scaling
      const targetScale = giant ? 10.0 : 1.0
      groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1)
      
      // Invisibility
      const targetOpacity = invisible ? 0.0 : 1.0 
      
      groupRef.current.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.opacity = THREE.MathUtils.lerp(child.material.opacity, targetOpacity, 0.1)
        }
      })
    }
  })
  
  useEffect(() => {
    // Don't add physics body if position is at default center (uninitialized)
    if (position[0] === 0 && position[2] === 0) return
    
    const world = getWorld()
    world.addBody(body)
    return () => world.removeBody(body)
  }, [body, position])

  // Update target when new position comes in
  useEffect(() => {
    targetPosition.current.set(position[0], position[1], position[2])
    targetRotation.current = rotation
  }, [position, rotation])

  // Smoothly interpolate towards target position
  useFrame((_, delta) => {
    if (groupRef.current) {
      // Use damp for time-based smoothing (independent of frame rate)
      // Lambda 15 gives a good balance of smoothness and responsiveness
      const lambda = 15
      
      groupRef.current.position.x = THREE.MathUtils.damp(groupRef.current.position.x, targetPosition.current.x, lambda, delta)
      groupRef.current.position.y = THREE.MathUtils.damp(groupRef.current.position.y, targetPosition.current.y, lambda, delta)
      groupRef.current.position.z = THREE.MathUtils.damp(groupRef.current.position.z, targetPosition.current.z, lambda, delta)
      
      // Smooth rotation
      groupRef.current.rotation.y = THREE.MathUtils.damp(groupRef.current.rotation.y, targetRotation.current, lambda, delta)
      
      // Sync physics body with visual position
      if (body) {
        body.position.set(
          groupRef.current.position.x,
          groupRef.current.position.y,
          groupRef.current.position.z
        )
      }
    }
  })

  return (
    <group ref={groupRef} position={position}>
      <primitive object={clonedScene} scale={0.01} position={[0, 0, 0]} />
      {playerName && !invisible && ( // Hide name label if invisible
        <Html position={[0, 2.2, 0]} center distanceFactor={8}>
          <div className={`player-name-label ${team}`}>{playerName}</div>
        </Html>
      )}
    </group>
  )
}



export default function Scene() {
  // Get player state from store - MUST BE AT TOP
  const hasJoined = useStore((s) => s.hasJoined)
  const playerName = useStore((s) => s.playerName)
  const playerTeam = useStore((s) => s.playerTeam)

  const playerRef = useRef()
  const targetRef = useRef() // Camera target
  const [hasModel, setHasModel] = useState(false)
  const [socket, setSocket] = useState(null)
  const [playerId, setPlayerId] = useState(null)
  const [remotePlayers, setRemotePlayers] = useState({})
  const [ballBody] = useState(() => createSoccerBallBody())
  const [scores, setScores] = useState({ red: 0, blue: 0 })
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [isChatOpen, setIsChatOpen] = useState(true)
  const [celebration, setCelebration] = useState(null) // { team: 'red' | 'blue' }
  const [activePowerUps, setActivePowerUps] = useState([])
  const [activeEffect, setActiveEffect] = useState(null) // { type: 'speed'|'kick'|'jump'|'invisible', label: '⚡' }
  const chatRef = useRef(null)
  const prevScoresRef = useRef({ red: 0, blue: 0 })
  const pitchSize = [30, 0.2, 20]
  const isFreeLook = useRef(false) // Ref for Free Look mode
  
  // Power-up Spawning Logic
  useEffect(() => {
    if (!hasJoined) return

    const spawnPowerUp = () => {
      // Pick one random type
      const types = Object.values(POWER_UP_TYPES)
      const randomType = types[Math.floor(Math.random() * types.length)]
      
      const newPowerUp = {
        id: Math.random().toString(36).substr(2, 9),
        type: randomType.id,
        // Random position within pitch bounds (x: -14 to 14, z: -9 to 9)
        position: [
          (Math.random() - 0.5) * 28,
          0.2, // Player elevation
          (Math.random() - 0.5) * 18
        ]
      }
      
      // Set active power-up (ensure only one exists)
      setActivePowerUps([newPowerUp])
      
      // Remove after 5 seconds if not collected
      setTimeout(() => {
        setActivePowerUps(prev => prev.filter(p => p.id !== newPowerUp.id))
      }, 5000)
    }

    // Initial spawn
    spawnPowerUp()

    // Spawn every 20 seconds
    const interval = setInterval(spawnPowerUp, 20000)

    return () => clearInterval(interval)
  }, [hasJoined])

  const handleCollectPowerUp = (id) => {
    setActivePowerUps(prev => prev.filter(p => p.id !== id))
  }

  const handlePowerUpActive = (type) => {
    const powerUpType = Object.values(POWER_UP_TYPES).find(t => t.id === type)
    if (powerUpType) {
      setActiveEffect(powerUpType)
      // Clear after 15 seconds
      setTimeout(() => setActiveEffect(null), 15000)
    }
  }
  
  // Team colors
  const teamColors = {
    red: '#ff4757',
    blue: '#3742fa'
  }

  // Connect to socket.io server
  useEffect(() => {
    const s = io('https://socket-rox7.onrender.com')
    setSocket(s)
    s.on('init', ({ id, players, ball, scores }) => {
      setPlayerId(id)
      setRemotePlayers(players)
      if (scores) setScores(scores)
      if (ballBody) {
        ballBody.position.set(...ball.position)
        ballBody.velocity.set(...ball.velocity)
      }
    })
    s.on('player-joined', (player) => {
      setRemotePlayers((prev) => ({ ...prev, [player.id]: player }))
    })
    s.on('player-move', ({ id, position, rotation, name, team, color, invisible, giant }) => {
      setRemotePlayers((prev) => prev[id] ? { ...prev, [id]: { ...prev[id], position, rotation, name, team, color, invisible, giant } } : prev)
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
    s.on('score-update', (newScores) => {
      // Check if a goal was scored
      if (newScores.red > prevScoresRef.current.red || newScores.blue > prevScoresRef.current.blue) {
        setCelebration({ team: newScores.red > prevScoresRef.current.red ? 'red' : 'blue' })
        
        // Play goal sound
        const audio = new Audio('/winner-game-sound-404167.mp3')
        audio.volume = 0.05
        audio.play().catch(e => console.error("Audio play failed:", e))
        
        // Stop sound after 2 seconds
        setTimeout(() => {
          audio.pause()
          audio.currentTime = 0
        }, 2000)

        setTimeout(() => setCelebration(null), 3000) // Hide after 3 seconds
        // Respawn players after 2 seconds
        setTimeout(() => {
          if (playerRef.current) {
            const spawn = playerTeam === 'red' ? [-6, 0.1, 0] : [6, 0.1, 0]
            playerRef.current.position.set(...spawn)
          }
        }, 2000)
      }
      prevScoresRef.current = { ...newScores }
      setScores(newScores)
    })
    s.on('ball-reset', (ball) => {
      if (ballBody) {
        ballBody.position.set(...ball.position)
        ballBody.velocity.set(...ball.velocity)
        ballBody.angularVelocity.set(0, 0, 0)
      }
    })
    s.on('chat-message', (msg) => {
      setChatMessages(prev => [...prev.slice(-49), msg]) // Keep last 50 messages
      // Auto-scroll to bottom
      setTimeout(() => {
        if (chatRef.current) {
          chatRef.current.scrollTop = chatRef.current.scrollHeight
        }
      }, 50)
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







  if (!hasJoined) {
    return <TeamSelectPopup />
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Scoreboard - outside Canvas, fixed on top */}
      <div style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        right: 0, 
        zIndex: 9999, 
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '20px'
      }}>
        <div style={{ 
          fontSize: '48px', 
          fontWeight: 'bold', 
          color: 'white', 
          textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
          display: 'flex', 
          gap: '30px', 
          textTransform: 'uppercase',
          background: 'rgba(0,0,0,0.5)',
          padding: '10px 30px',
          borderRadius: '12px'
        }}>
          <span style={{ color: '#ff4757' }}>RED: {scores.red}</span>
          <span style={{ color: 'white' }}>-</span>
          <span style={{ color: '#3742fa' }}>BLUE: {scores.blue}</span>
        </div>
       
      </div>

      {/* Active Power-Up Indicator */}
      {activeEffect && (
        <div style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          zIndex: 10,
          background: 'rgba(0,0,0,0.7)',
          padding: '15px',
          borderRadius: '50%',
          width: '80px',
          height: '80px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          fontSize: '48px',
          border: `4px solid ${activeEffect.color}`,
          boxShadow: `0 0 20px ${activeEffect.color}`,
          animation: 'pulse 1s infinite alternate'
        }}>
          {activeEffect.label}
        </div>
      )}

      {/* Goal Celebration Overlay */}
      {celebration && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 10000,
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.3)'
        }}>
          {/* Confetti particles */}
          {Array.from({ length: 50 }).map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                width: `${Math.random() * 15 + 5}px`,
                height: `${Math.random() * 15 + 5}px`,
                background: celebration.team === 'red' 
                  ? ['#ff4757', '#ff6b81', '#ffd32a', '#fff200'][Math.floor(Math.random() * 4)]
                  : ['#3742fa', '#5f6cff', '#00d2d3', '#54a0ff'][Math.floor(Math.random() * 4)],
                borderRadius: Math.random() > 0.5 ? '50%' : '0',
                left: `${Math.random() * 100}%`,
                top: `-10%`,
                animation: `confettiFall ${2 + Math.random() * 2}s ease-out forwards`,
                animationDelay: `${Math.random() * 0.5}s`,
                transform: `rotate(${Math.random() * 360}deg)`
              }}
            />
          ))}
          {/* GOAL Text */}
          <div style={{
            fontSize: '120px',
            fontWeight: '900',
            color: celebration.team === 'red' ? '#ff4757' : '#3742fa',
            textShadow: `0 0 20px ${celebration.team === 'red' ? '#ff4757' : '#3742fa'}, 
                         0 0 40px ${celebration.team === 'red' ? '#ff4757' : '#3742fa'},
                         0 0 60px ${celebration.team === 'red' ? '#ff4757' : '#3742fa'},
                         4px 4px 0 #000`,
            animation: 'goalPulse 0.5s ease-in-out infinite alternate',
            textTransform: 'uppercase',
            letterSpacing: '20px'
          }}>
            ⚽ GOAL! ⚽
          </div>
          <div style={{
            position: 'absolute',
            bottom: '30%',
            fontSize: '36px',
            fontWeight: 'bold',
            color: 'white',
            textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
          }}>
            {celebration.team.toUpperCase()} TEAM SCORES!
          </div>
        </div>
      )}
      
      {/* CSS Animations */}
      <style>{`
        @keyframes confettiFall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        @keyframes goalPulse {
          0% {
            transform: scale(1);
          }
          100% {
            transform: scale(1.1);
          }
        }
      `}</style>
      {/* 3D Canvas */}
      <Canvas shadows camera={{ position: [0, 8, 18], fov: 60 }}>
        <Suspense fallback={null}>
          <PhysicsHandler />
          <GoalDetector ballBody={ballBody} socket={socket} playerId={playerId} remotePlayers={remotePlayers} pitchSize={pitchSize} />
          <color attach="background" args={["#87CEEB"]} />
          <ambientLight intensity={0.7} color="#FFFFFF" />

          <directionalLight 
            position={[10, 30, 10]} 
            intensity={2} 
            color="#fff" 
            castShadow 
            shadow-mapSize-width={2048} 
            shadow-mapSize-height={2048}
            shadow-camera-left={-50}
            shadow-camera-right={50}
            shadow-camera-top={50}
            shadow-camera-bottom={-50}
            shadow-bias={-0.0005}
          />
          {/* Stadium lights */}
          <pointLight position={[-10, 15, -10]} intensity={1.2} color="#fff" />
          <pointLight position={[10, 15, 10]} intensity={1.2} color="#fff" />
          {/* Mystery Shack Environment */}
          <MysteryShack />
          {/* Soccer pitch */}
          <SoccerPitch size={pitchSize} />
          {/* Goals with team colors - Blue team defends top goal, Red team defends bottom goal */}
          {/* Goals positioned just behind pitch edges, rotated 90° facing each other */}
          <SoccerGoal position={[11, 0.1, 0]} rotation={[0,-Math.PI / 1, 0]} netColor={teamColors.blue} />
          <SoccerGoal position={[-11, 0.1, 0]} rotation={[0,Math.PI / 0.5, 0]} netColor={teamColors.red} />
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
            spawnPosition={playerTeam === 'red' ? [-6, 0.1, 0] : [6, 0.1, 0]}
            remotePlayers={remotePlayers}
            ballBody={ballBody}
            powerUps={activePowerUps}
            onCollectPowerUp={handleCollectPowerUp}
            onPowerUpActive={handlePowerUpActive}
            isFreeLook={isFreeLook}
          />
          {/* Remote players */}
          {Object.entries(remotePlayers)
            .filter(([id]) => id !== playerId) // Don't render self
            .filter(([_, p]) => p.position && p.position[0] !== undefined) // Skip uninitialized
            .filter(([_, p]) => !(p.position[0] === 0 && p.position[2] === 0)) // Skip center position
            .map(([id, p]) => (
              <RemotePlayerWithPhysics 
                key={id} 
                id={id} 
                position={p.position} 
                color={p.color || '#888'} 
                rotation={p.rotation} 
                playerName={p.name} 
                team={p.team} 
                invisible={p.invisible} // Pass invisible state
                giant={p.giant} // Pass giant state
              />
            ))}
          {/* Camera controller */}
          <CameraController targetRef={playerRef} isFreeLook={isFreeLook} />

          {/* Render PowerUps */}
          {activePowerUps.map(p => (
            <PowerUp 
              key={p.id} 
              position={p.position} 
              type={Object.keys(POWER_UP_TYPES).find(key => POWER_UP_TYPES[key].id === p.type)} 
            />
          ))}
        </Suspense>
      </Canvas>
      <Loader />
      
      {/* Chat Box - Bottom Right */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        right: '20px',
        width: '300px',
        maxHeight: '250px',
        background: 'rgba(0,0,0,0.7)',
        borderRadius: '12px',
        overflow: 'hidden',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{
          padding: '10px 15px',
          background: 'rgba(0,0,0,0.5)',
          color: 'white',
          fontWeight: 'bold',
          fontSize: '14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>💬 Chat</span>
          <button 
            onClick={() => setIsChatOpen(!isChatOpen)}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            {isChatOpen ? '−' : '+'}
          </button>
        </div>
        {isChatOpen && (
          <>
            <div 
              ref={chatRef}
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '10px',
                maxHeight: '150px'
              }}
            >
              {chatMessages.map((msg, i) => (
                <div key={i} style={{ marginBottom: '8px' }}>
                  <span style={{ 
                    color: msg.team === 'red' ? '#ff4757' : msg.team === 'blue' ? '#3742fa' : '#888',
                    fontWeight: 'bold',
                    fontSize: '12px'
                  }}>
                    {msg.playerName}:
                  </span>
                  <span style={{ color: 'white', marginLeft: '5px', fontSize: '12px' }}>
                    {msg.message}
                  </span>
                </div>
              ))}
            </div>
            <form 
              onSubmit={(e) => {
                e.preventDefault()
                if (chatInput.trim() && socket) {
                  socket.emit('chat-message', {
                    playerName,
                    team: playerTeam,
                    message: chatInput.trim()
                  })
                  setChatInput('')
                }
              }}
              style={{ padding: '10px', borderTop: '1px solid rgba(255,255,255,0.2)' }}
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type a message..."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: 'none',
                  borderRadius: '6px',
                  background: 'rgba(255,255,255,0.1)',
                  color: 'white',
                  fontSize: '12px',
                  outline: 'none'
                }}
              />
            </form>
          </>
        )}
      </div>
    </div>
  )
}



// Note: we check for model availability inside the Scene component on mount.


