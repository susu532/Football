import React, { useRef, useEffect, useState, Suspense, useCallback, lazy } from 'react'
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
import MobileControls from './MobileControls'
import MapComponents from './MapComponents'

// Small Soccer placeholder - replace with real widget/SDK integration
function openSoccerPlaceholder() {
  // In a real integration you'd open Soccer's SDK or widget here.
  // Keep this lightweight for the demo.
  window.alert('Open Soccer (placeholder)')
}



function CameraController({ targetRef, isFreeLook, cameraOrbit }) {
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
  
  // Expose orbit ref for external control (mobile swipe)
  useEffect(() => {
    if (cameraOrbit) {
      cameraOrbit.current = orbit.current
    }
  }, [cameraOrbit])


  useEffect(() => {
    const onPointerDown = (e) => {
      // Ignore if clicking on mobile controls
      if (e.target.closest('.mobile-controls') || e.target.closest('.joystick-container') || e.target.closest('.action-buttons')) {
        return
      }

      // On mobile, we handle camera swipe via touch events in MobileControls.jsx
      // to avoid conflicts with the joystick. So we ignore touch pointer events here.
      if (e.pointerType === 'touch') return

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
      {/* Center Line */}
      <mesh position={[0, 0.102, 0]} rotation={[-Math.PI/2, 0, 0]}>
        <planeGeometry args={[0.1, 20]} />
        <meshStandardMaterial color="#fff" transparent opacity={0.5} />
      </mesh>
      
      {/* Field Border Lines */}
      {/* Top Line */}
      <mesh position={[0, 0.102, -10]} rotation={[-Math.PI/2, 0, 0]}>
        <planeGeometry args={[30, 0.1]} />
        <meshStandardMaterial color="#fff" transparent opacity={0.5} />
      </mesh>
      {/* Bottom Line */}
      <mesh position={[0, 0.102, 10]} rotation={[-Math.PI/2, 0, 0]}>
        <planeGeometry args={[30, 0.1]} />
        <meshStandardMaterial color="#fff" transparent opacity={0.5} />
      </mesh>
      {/* Left Line */}
      <mesh position={[-15, 0.102, 0]} rotation={[-Math.PI/2, 0, 0]}>
        <planeGeometry args={[0.1, 20]} />
        <meshStandardMaterial color="#fff" transparent opacity={0.5} />
      </mesh>
      {/* Right Line */}
      <mesh position={[15, 0.102, 0]} rotation={[-Math.PI/2, 0, 0]}>
        <planeGeometry args={[0.1, 20]} />
        <meshStandardMaterial color="#fff" transparent opacity={0.5} />
      </mesh>

      {/* Penalty Boxes */}
      {/* Left Box */}
      <mesh position={[-13, 0.02, 0]} rotation={[-Math.PI/2, 0, 0]}>
        <planeGeometry args={[4, 10]} />
        <meshStandardMaterial color="#fff" transparent opacity={0.2} />
      </mesh>
      <mesh position={[-11, 0.02, 0]} rotation={[-Math.PI/2, 0, 0]}>
        <ringGeometry args={[0, 0.1, 4, 1, 0, Math.PI*2]} />
        <meshStandardMaterial color="#fff" />
      </mesh>
      
      {/* Right Box */}
      <mesh position={[13, 0.02, 0]} rotation={[-Math.PI/2, 0, 0]}>
        <planeGeometry args={[4, 10]} />
        <meshStandardMaterial color="#fff" transparent opacity={0.2} />
      </mesh>
      <mesh position={[11, 0.02, 0]} rotation={[-Math.PI/2, 0, 0]}>
        <ringGeometry args={[0, 0.1, 4, 1, 0, Math.PI*2]} />
        <meshStandardMaterial color="#fff" />
      </mesh>

      {/* Center circle */}
      <mesh position={[0, 0.101, 0]} rotation={[-Math.PI/2, 0, 0]}>
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
      
      {/* Left Side Walls (Length 20) */}
      <RoundedBox args={[wallThickness, wallHeight, 20]} radius={0.1} smoothness={4} position={[-size[0]/2 - wallThickness/2, wallHeight/2, 0]} castShadow receiveShadow>
        <meshPhysicalMaterial color="#88ccff" roughness={0.1} metalness={0.1} transmission={0.6} thickness={0.5} transparent opacity={0.3} />
      </RoundedBox>
      
      {/* Right Side Walls (Length 20) */}
      <RoundedBox args={[wallThickness, wallHeight, 20]} radius={0.1} smoothness={4} position={[size[0]/2 + wallThickness/2, wallHeight/2, 0]} castShadow receiveShadow>
        <meshPhysicalMaterial color="#88ccff" roughness={0.1} metalness={0.1} transmission={0.6} thickness={0.5} transparent opacity={0.3} />
      </RoundedBox>
      
      {/* Semi-Invisible Roof */}
      <mesh position={[0, wallHeight, 0]} rotation={[-Math.PI/2, 0, 0]} receiveShadow>
        <planeGeometry args={[size[0] + 2, size[2] + 2]} />
        <meshBasicMaterial color="#88ccff" transparent opacity={0.1} side={THREE.DoubleSide} depthWrite={false} />
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

function LocalPlayerWithSync({ socket, playerId, playerRef, hasModel, playerName = '', playerTeam = '', teamColor = '#888', spawnPosition = [0, 1, 0], remotePlayers = {}, ballBody = null, powerUps = [], onCollectPowerUp = null, onPowerUpActive = null, isFreeLook = null, mobileInput = null, characterType = 'cat' }) {
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

  // Send player movement to server with change detection
  const lastUpdate = useRef(0)
  const lastMoveData = useRef(null)
  
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
    
    // Build move data
    const moveData = {
      position: [pos.x, pos.y, pos.z],
      rotation: rot,
      name: playerName,
      team: playerTeam,
      color: teamColor,
      invisible,
      giant,
      character: characterType
    }
    
    // Only send changed data to reduce bandwidth
    const changes = {}
    if (!lastMoveData.current) {
      // First update, send everything
      socket.emit('m', {
        p: moveData.position,
        r: moveData.rotation,
        i: moveData.invisible,
        g: moveData.giant
      })
      socket.emit('player-info', {
        name: moveData.name,
        team: moveData.team,
        color: moveData.color,
        character: moveData.character
      })
      lastMoveData.current = moveData
      return
    }
    
    // Check which fields changed
    if (lastMoveData.current.position[0] !== moveData.position[0] ||
        lastMoveData.current.position[1] !== moveData.position[1] ||
        lastMoveData.current.position[2] !== moveData.position[2]) {
      changes.p = moveData.position
    }
    
    if (lastMoveData.current.rotation !== moveData.rotation) {
      changes.r = moveData.rotation
    }
    
    if (lastMoveData.current.invisible !== moveData.invisible) {
      changes.i = moveData.invisible
    }
    
    if (lastMoveData.current.giant !== moveData.giant) {
      changes.g = moveData.giant
    }
    
    // Include ID for reference
    if (Object.keys(changes).length > 0) {
      changes.id = playerId
      socket.emit('m', changes)
    }

    // Check metadata changes
    const infoChanges = {}
    if (lastMoveData.current.name !== moveData.name) infoChanges.name = moveData.name
    if (lastMoveData.current.team !== moveData.team) infoChanges.team = moveData.team
    if (lastMoveData.current.color !== moveData.color) infoChanges.color = moveData.color
    if (lastMoveData.current.character !== moveData.character) infoChanges.character = moveData.character

    if (Object.keys(infoChanges).length > 0) {
      socket.emit('player-info', infoChanges)
    }
    
    lastMoveData.current = moveData
    
    // Update physics body radius dynamically
    if (body && body.shapes.length > 0) {
      const targetRadius = giant ? 4.0 : 0.9
      if (body.shapes[0].radius !== targetRadius) {
        body.shapes[0].radius = targetRadius
        body.updateBoundingRadius()
      }
    }
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
        mobileInput={mobileInput}
        characterType={characterType}
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

function SoccerBallWithPhysics({ ballBody, socket, playerId, ballAuthority }) {
  const meshRef = useRef()
  // Sync mesh with physics
  useFrame(() => {
    if (meshRef.current && ballBody) {
      meshRef.current.position.copy(ballBody.position)
      meshRef.current.quaternion.copy(ballBody.quaternion)
    }
  })
  // Ball authority sends ball state to server with throttling and velocity threshold
  const lastBallUpdate = useRef(0)
  const lastBallData = useRef(null)
  useFrame((state, delta) => {
    if (!socket || !playerId) return
    if (ballAuthority === playerId) {
      const now = state.clock.getElapsedTime()
      if (now - lastBallUpdate.current < 0.025) return // 40 Hz (25ms)
      lastBallUpdate.current = now

      if (ballBody) {
        // Limit angular velocity (spin)
        const maxAv = 15.0 
        const avSq = ballBody.angularVelocity.x**2 + ballBody.angularVelocity.y**2 + ballBody.angularVelocity.z**2
        if (avSq > maxAv**2) {
           const scale = maxAv / Math.sqrt(avSq)
           ballBody.angularVelocity.x *= scale
           ballBody.angularVelocity.y *= scale
           ballBody.angularVelocity.z *= scale
        }

        const ballVelocity = Math.sqrt(
          ballBody.velocity.x ** 2 +
          ballBody.velocity.y ** 2 +
          ballBody.velocity.z ** 2
        )

        // Only send update if ball is moving significantly (threshold: 0.1 units/sec)
        const velocityThreshold = 0.1

        if (ballVelocity > velocityThreshold) {
          const ballData = {
            p: [ballBody.position.x, ballBody.position.y, ballBody.position.z],
            v: [ballBody.velocity.x, ballBody.velocity.y, ballBody.velocity.z],
          }

          // Check if data actually changed
          if (!lastBallData.current ||
              Math.abs(lastBallData.current.p[0] - ballData.p[0]) > 0.01 ||
              Math.abs(lastBallData.current.p[1] - ballData.p[1]) > 0.01 ||
              Math.abs(lastBallData.current.p[2] - ballData.p[2]) > 0.01 ||
              Math.abs(lastBallData.current.v[0] - ballData.v[0]) > 0.01 ||
              Math.abs(lastBallData.current.v[1] - ballData.v[1]) > 0.01 ||
              Math.abs(lastBallData.current.v[2] - ballData.v[2]) > 0.01) {
            socket.emit('b', ballData)
            lastBallData.current = ballData
          }
        }
      }
    } else {
      // Non-authority: Interpolate towards server state
      if (ballBody && ballBody.targetPosition) {
        // Smoothly interpolate position
        // Lambda 10 gives good responsiveness without too much jitter
        const lambda = 10
        
        ballBody.position.x = THREE.MathUtils.damp(ballBody.position.x, ballBody.targetPosition.x, lambda, delta)
        ballBody.position.y = THREE.MathUtils.damp(ballBody.position.y, ballBody.targetPosition.y, lambda, delta)
        ballBody.position.z = THREE.MathUtils.damp(ballBody.position.z, ballBody.targetPosition.z, lambda, delta)
        
        // Also interpolate velocity for visual consistency (optional but good for prediction)
        if (ballBody.targetVelocity) {
           ballBody.velocity.x = THREE.MathUtils.damp(ballBody.velocity.x, ballBody.targetVelocity.x, lambda, delta)
           ballBody.velocity.y = THREE.MathUtils.damp(ballBody.velocity.y, ballBody.targetVelocity.y, lambda, delta)
           ballBody.velocity.z = THREE.MathUtils.damp(ballBody.velocity.z, ballBody.targetVelocity.z, lambda, delta)
        }
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

function RemotePlayerWithPhysics({ id, position = [0, 1, 0], color = '#888', rotation = 0, playerName = '', team = '', invisible = false, giant = false, character = 'cat' }) {
  // Physics body for remote player
  const [body] = useState(() => createPlayerBody(position))
  const groupRef = useRef()
  const targetPosition = useRef(new THREE.Vector3(...position))
  const targetRotation = useRef(rotation)
  const lastPosition = useRef(new THREE.Vector3(...position))
  
  // Update physics body radius for remote players
  useEffect(() => {
    if (body && body.shapes.length > 0) {
      const targetRadius = giant ? 4.0 : 0.9
      if (body.shapes[0].radius !== targetRadius) {
        body.shapes[0].radius = targetRadius
        body.updateBoundingRadius()
      }
    }
  }, [body, giant])

  // Load GLB model for remote player
  const playerModelPath = character === 'cat' ? '/models/cat.glb' : '/models/low_poly_car.glb'
  const characterScale = character === 'cat' ? 0.01 : 0.0015
  const { scene } = useGLTF(playerModelPath)
  
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
      const targetScale = giant ? 6.0 : 1.0
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
    const world = getWorld()
    world.addBody(body)
    return () => world.removeBody(body)
  }, [body])

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
    <group ref={groupRef} position={[position[0], position[1] + (character === 'car' ? 0.2 : 0), position[2]]}>
      <primitive object={clonedScene} scale={characterScale} position={[0, 0, 0]} />
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
  const playerCharacter = useStore((s) => s.playerCharacter)
  const leaveGame = useStore((s) => s.leaveGame)

  // Adaptive shadow quality based on device
  const [shadowMapSize, setShadowMapSize] = useState(2048)
  
  useEffect(() => {
    const isMobile = window.innerWidth < 768 || 'ontouchstart' in window
    setShadowMapSize(isMobile ? 1024 : 2048)
  }, [])

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
  const [activeEffect, setActiveEffect] = useState(null)
  const chatRef = useRef(null)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const prevScoresRef = useRef({ red: 0, blue: 0 })
  const pitchSize = [30, 0.2, 20]
  const isFreeLook = useRef(false)
  const [ballAuthority, setBallAuthority] = useState(null) // Track which player has ball authority
  
  // Connection quality tracking
  const [connectionQuality, setConnectionQuality] = useState('excellent')
  const [ping, setPing] = useState(0)
  const [showConnectionWarning, setShowConnectionWarning] = useState(false)
  const lastPingTime = useRef(0)
  
  // Helper function for connection quality color
  const getConnectionQualityColor = (quality) => {
    switch(quality) {
      case 'excellent': return '#00ff00'
      case 'good': return '#ffff00'
      case 'fair': return '#ffa500'
      case 'poor': return '#ff0000'
      default: return '#888'
    }
  }
  
  // Mobile controls state
  const mobileInput = useRef({ move: { x: 0, y: 0 }, jump: false, kick: false })
  const cameraOrbit = useRef(null) // Reference to camera orbit state
  
  // Mobile control callbacks
  const handleMobileMove = useCallback((x, y) => {
    mobileInput.current.move = { x, y }
  }, [])
  
  const handleMobileJump = useCallback(() => {
    mobileInput.current.jump = true
  }, [])
  
  const handleMobileKick = useCallback(() => {
    mobileInput.current.kick = true
  }, [])
  
  const handleMobileCameraMove = useCallback((dx, dy) => {
    // Apply camera rotation like mouse drag
    if (cameraOrbit.current) {
      cameraOrbit.current.azimuth -= dx * 0.01
      cameraOrbit.current.polar -= dy * 0.01
      cameraOrbit.current.polar = Math.max(0.2, Math.min(Math.PI / 2, cameraOrbit.current.polar))
    }
  }, [])
  
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
    if (!hasJoined) return
    const s = io('https://socket-rox7.onrender.com', {
      transports: ['websocket', 'polling'],
      upgrade: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    })
    setSocket(s)
    
    // Ping measurement
    const measurePing = () => {
      const start = Date.now()
      s.emit('ping', start)
    }
    
    s.on('pong', (timestamp) => {
      const pingTime = Date.now() - timestamp
      setPing(pingTime)

      // Update connection quality based on ping
      if (pingTime < 100) {
        setConnectionQuality('excellent')
        setShowConnectionWarning(false)
      } else if (pingTime < 200) {
        setConnectionQuality('good')
        setShowConnectionWarning(false)
      } else if (pingTime < 300) {
        setConnectionQuality('fair')
        setShowConnectionWarning(false)
      } else {
        setConnectionQuality('poor')
        setShowConnectionWarning(true)
      }
    })
    
    // Measure ping every 2 seconds
    const pingInterval = setInterval(measurePing, 2000)
    
    return () => {
      clearInterval(pingInterval)
      s.disconnect()
      setSocket(null)
    }
  }, [hasJoined, ballBody])

  // Handle joining game
  useEffect(() => {
    if (socket && hasJoined) {
      console.log("Joining game with character:", playerCharacter)
      socket.emit('join-game', { character: playerCharacter })
    }
  }, [socket, hasJoined, playerCharacter])

  // Socket event listeners
  useEffect(() => {
    if (!socket) return
    


    socket.on('init', ({ id, players, ball, scores, ballAuthority }) => {
      setPlayerId(id)
      setRemotePlayers(players)
      if (scores) setScores(scores)
      if (ballAuthority) setBallAuthority(ballAuthority)
      if (ballBody) {
        ballBody.position.set(...ball.position)
        ballBody.velocity.set(...ball.velocity)
      }
    })
    socket.on('player-joined', (player) => {
      setRemotePlayers((prev) => ({ ...prev, [player.id]: player }))
    })
    // Optimized movement handler
    socket.on('m', ({ id, p, r, i, g }) => {
      setRemotePlayers((prev) => {
        if (!prev[id]) return prev
        const player = { ...prev[id] }
        if (p) player.position = p
        if (r !== undefined) player.rotation = r
        if (i !== undefined) player.invisible = i
        if (g !== undefined) player.giant = g
        return { ...prev, [id]: player }
      })
    })

    // Player info handler
    socket.on('player-info', ({ id, name, team, character, color }) => {
      setRemotePlayers((prev) => {
        if (!prev[id]) return prev
        const player = { ...prev[id] }
        if (name) player.name = name
        if (team) player.team = team
        if (character) player.character = character
        if (color) player.color = color
        return { ...prev, [id]: player }
      })
    })

    socket.on('player-left', (id) => {
      setRemotePlayers((prev) => {
        const copy = { ...prev }
        delete copy[id]
        return copy
      })
    })
    socket.on('b', (ball) => {
      if (ballBody) {
        // Store target state for interpolation
        ballBody.targetPosition = new THREE.Vector3(...ball.p)
        ballBody.targetVelocity = new THREE.Vector3(...ball.v)
        
        // If this is the first update or we're very far off, snap immediately
        if (!ballBody.lastServerUpdate || 
            ballBody.position.distanceTo(ballBody.targetPosition) > 5.0) {
          ballBody.position.copy(ballBody.targetPosition)
          ballBody.velocity.copy(ballBody.targetVelocity)
        }
        ballBody.lastServerUpdate = Date.now()
      }
    })
    // Combined event for goal score and ball reset
    // Handle score updates
    socket.on('score-update', (newScores) => {
      // Check if a goal was scored (score increased)
      if (newScores.red > prevScoresRef.current.red || newScores.blue > prevScoresRef.current.blue) {
        setCelebration({ team: newScores.red > prevScoresRef.current.red ? 'red' : 'blue' })

        // Play goal sound
        const audio = new Audio('/winner-game-sound-404167.mp3')
        audio.volume = 0.03
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

    // Handle ball reset
    socket.on('ball-reset', (ball) => {
      if (ballBody) {
        ballBody.position.set(...ball.position)
        ballBody.velocity.set(...ball.velocity)
        ballBody.angularVelocity.set(0, 0, 0)
      }
    })
    socket.on('chat-message', (msg) => {
      setChatMessages(prev => [...prev.slice(-49), msg]) // Keep last 50 messages
      // Auto-scroll to bottom
      setTimeout(() => {
        if (chatRef.current) {
          chatRef.current.scrollTop = chatRef.current.scrollHeight
        }
      }, 50)
    })

    // Handle ball authority reassignment
    socket.on('ball-authority', (newAuthority) => {
      setBallAuthority(newAuthority)
    })

    // Handle full state sync to fix desync
    // Handle full state sync to fix desync
    socket.on('full-state-sync', ({ players, ball, scores }) => {
      if (scores) {
        setScores(scores)
        prevScoresRef.current = { ...scores }
      }
      if (ballBody && ball) {
        // Only snap ball if distance is significant to avoid jitter
        const dist = Math.sqrt(
          Math.pow(ballBody.position.x - ball.position[0], 2) + 
          Math.pow(ballBody.position.y - ball.position[1], 2) + 
          Math.pow(ballBody.position.z - ball.position[2], 2)
        )
        if (dist > 2.0) { // Only snap if desync is > 2 meters
          ballBody.position.set(...ball.position)
          ballBody.velocity.set(...ball.velocity)
        }
      }
      // Update remote players with full state
      setRemotePlayers(players)
    })
    return () => {
      socket.off('init')
      socket.off('player-joined')
      socket.off('m')
      socket.off('player-info')
      socket.off('player-left')
      socket.off('b')
      socket.off('goal-scored')
      socket.off('chat-message')
      socket.off('ball-authority')
      socket.off('full-state-sync')
    }
  }, [socket, ballBody])

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
      {/* Connection Status - Top Left */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        zIndex: 9999,
        background: 'rgba(0,0,0,0.5)',
        padding: '10px 20px',
        borderRadius: '12px',
        color: 'white',
        fontSize: '18px',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        border: '1px solid rgba(255,255,255,0.2)',
        backdropFilter: 'blur(5px)',
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: '5px'
      }}>
        <div style={{
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ color: getConnectionQualityColor(connectionQuality) }}>
            ● {connectionQuality.toUpperCase()}
          </span>
          <span>{ping}ms</span>
        </div>
      </div>

      {/* Connection Warning */}
      {showConnectionWarning && (
        <div style={{
          position: 'absolute',
          top: '80px',
          left: '20px',
          zIndex: 9999,
          background: 'rgba(255, 0, 0, 0.7)',
          padding: '10px 15px',
          borderRadius: '8px',
          color: 'white',
          fontSize: '12px',
          fontWeight: 'bold',
          backdropFilter: 'blur(5px)',
          animation: 'pulse 1s infinite'
        }}>
          ⚠️ POOR CONNECTION - PLAYERS MAY DESYNC
        </div>
      )}

       <button
          onClick={() => setShowExitConfirm(true)}
          style={{
            position: 'absolute',
            top: '20px',
            left: '180px',
            zIndex: 9999,
            background: 'rgba(255,71,87,0.5)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '12px',
            color: 'white',
            padding: '10px',
            cursor: 'pointer',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            transition: 'all 0.2s'
          }}
          title="Exit to Menu"
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,71,87,0.7)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,71,87,0.5)'}
        >
          🚪
        </button>
      

      {/* Game Controls - Top Right */}
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        zIndex: 9999,
        display: 'flex',
        gap: '10px'
      }}>
        
        {/* Fullscreen Button */}
        <button
          onClick={() => {
            if (!document.fullscreenElement) {
              document.documentElement.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message}`);
              });
            } else {
              document.exitFullscreen();
            }
          }}
          style={{
            background: 'rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '12px',
            color: 'white',
            padding: '10px',
            cursor: 'pointer',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            transition: 'all 0.2s'
          }}
          title="Toggle Fullscreen"
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.5)'}
        >
          ⛶
        </button>

        {/* Exit Button */}
       
      </div>

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
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes popIn {
          from { transform: scale(0.8); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
      {/* 3D Canvas */}
      <Canvas shadows camera={{ position: [0, 8, 18], fov: 60 }} gl={{ outputColorSpace: THREE.SRGBColorSpace }}>
        <Suspense fallback={null}>
          <PhysicsHandler />
          <GoalDetector ballBody={ballBody} socket={socket} playerId={playerId} remotePlayers={remotePlayers} ballAuthority={ballAuthority} pitchSize={pitchSize} />
          <color attach="background" args={["#87CEEB"]} />
          <ambientLight intensity={0.7} color="#FFFFFF" />
          <directionalLight 
            position={[10, 30, 10]} 
            intensity={2} 
            color="#fff" 
            castShadow 
            shadow-mapSize-width={shadowMapSize} 
            shadow-mapSize-height={shadowMapSize}
            shadow-camera-left={-50}
            shadow-camera-right={50}
            shadow-camera-top={50}
            shadow-camera-bottom={-50}
            shadow-bias={-0.0005}
          />
          <pointLight position={[-10, 15, -10]} intensity={1.2} color="#fff" />
          <pointLight position={[10, 15, 10]} intensity={1.2} color="#fff" />
          <Suspense fallback={null}>
            <MapComponents.MysteryShack />
          </Suspense>
          <SoccerPitch size={pitchSize} />
          <SoccerGoal position={[11, 0.1, 0]} rotation={[0, -Math.PI / 1, 0]} netColor={teamColors.blue} />
          <SoccerGoal position={[-11, 0.1, 0]} rotation={[0, Math.PI / 0.5, 0]} netColor={teamColors.red} />
          <SoccerBallWithPhysics ballBody={ballBody} socket={socket} playerId={playerId} ballAuthority={ballAuthority} />
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
            mobileInput={mobileInput}
            characterType={playerCharacter}
          />
          {Object.entries(remotePlayers)
            .filter(([id]) => id !== playerId)
            .filter(([_, p]) => p.position && p.position[0] !== undefined)
            .map(([id, p]) => (
            <RemotePlayerWithPhysics
                key={id}
                id={id}
                position={p.position}
                color={p.color || '#888'}
                rotation={p.rotation}
                playerName={p.name}
                team={p.team}
                invisible={p.invisible}
                giant={p.giant}
                character={p.character || 'cat'}
              />
            ))}
          <CameraController targetRef={playerRef} isFreeLook={isFreeLook} cameraOrbit={cameraOrbit} />
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
      
      {/* Mobile Controls - Only visible on touch devices */}
      {hasJoined && (
        <MobileControls 
          onMove={handleMobileMove}
          onJump={handleMobileJump}
          onKick={handleMobileKick}
          onCameraMove={handleMobileCameraMove}
        />
      )}
      
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

      {/* Modern S-Tier Exit Confirmation Pop-up */}
      {showExitConfirm && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 20000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(10px)',
          animation: 'fadeIn 0.3s ease-out'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(20,20,30,0.9), rgba(40,40,60,0.9))',
            padding: '40px',
            borderRadius: '24px',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5), 0 0 20px rgba(255,71,87,0.2)',
            textAlign: 'center',
            maxWidth: '400px',
            width: '90%',
            transform: 'scale(1)',
            animation: 'popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
          }}>
            <div style={{ fontSize: '64px', marginBottom: '20px' }}>🚪</div>
            <h2 style={{ 
              color: 'white', 
              fontSize: '28px', 
              margin: '0 0 15px 0',
              fontWeight: '900',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              Leaving so soon?
            </h2>
            <p style={{ 
              color: 'rgba(255,255,255,0.7)', 
              fontSize: '16px', 
              margin: '0 0 30px 0',
              lineHeight: '1.5'
            }}>
              Are you sure you want to leave the match? Your current score will be lost.
            </p>
            <div style={{ display: 'flex', gap: '15px' }}>
              <button
                onClick={() => setShowExitConfirm(false)}
                style={{
                  flex: 1,
                  padding: '15px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'white',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              >
                STAY
              </button>
              <button
                onClick={() => {
                  setShowExitConfirm(false);
                  if (socket) {
                    socket.emit('leave-game');
                    socket.disconnect();
                  }
                  setScores({ red: 0, blue: 0 }); // Reset local scores
                  leaveGame();
                }}
                style={{
                  flex: 1,
                  padding: '15px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(45deg, #ff4757, #ff6b81)',
                  color: 'white',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: '0 5px 15px rgba(255,71,87,0.4)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 20px rgba(255,71,87,0.6)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 5px 15px rgba(255,71,87,0.4)';
                }}
              >
                LEAVE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}



// Note: we check for model availability inside the Scene component on mount.


