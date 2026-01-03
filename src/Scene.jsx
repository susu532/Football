import React, { useRef, useEffect, useState, Suspense, useCallback, lazy } from 'react'
import { Canvas, useFrame, useThree, extend } from '@react-three/fiber'
import { Html, Sparkles, Stars, Loader, useGLTF, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import CharacterSkin from './CharacterSkin'
import useStore from './store'
import { createWorld, stepWorld, getWorld, createSoccerBallBody, createPlayerBody, removeBody } from './physics'
import * as CANNON from 'cannon-es'
import { useSpring, a } from '@react-spring/three'

import { usePlayroom } from './usePlayroom'
import { usePlayerState, RPC } from 'playroomkit'
import TeamSelectPopup from './TeamSelectPopup'
import { PhysicsHandler } from './GameLogic'
import { PowerUp, POWER_UP_TYPES } from './PowerUp'
import MobileControls from './MobileControls'
import MapComponents from './MapComponents'

// Small Soccer placeholder - replace with real widget/SDK integration
function openSoccerPlaceholder() {
  // In a real integration you'd open Soccer's SDK or widget here.
  // Keep this lightweight for the demo.
  window.alert('Open Soccer (placeholder)')
}

const CSS_ANIMATIONS = `
  @keyframes confettiFall {
    0% { transform: translateY(0) rotate(0deg); opacity: 1; }
    100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
  }
  @keyframes goalPulse {
    0% { transform: scale(1); }
    100% { transform: scale(1.1); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes popIn {
    from { transform: scale(0.8); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }
`;



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
    scene.background = new THREE.Color('#050510')
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

function LocalPlayerWithSync({ me, playerRef, hasModel, playerName = '', playerTeam = '', teamColor = '#888', spawnPosition = [0, 1, 0], ballBody = null, powerUps = [], onCollectPowerUp = null, onPowerUpActive = null, isFreeLook = null, mobileInput = null, characterType = 'cat', onLocalInteraction = null }) {
  // Callback when player kicks the ball - send update to server
  const handleKick = (data) => {
    if (data) {
      // Send kick event to host (and others)
      RPC.call('kick-ball', { ...data, playerId: me.id }, RPC.Mode.ALL)
      if (onLocalInteraction) onLocalInteraction()
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

  // Send player movement to Playroom
  const lastUpdate = useRef(0)
  
  useFrame((state) => {
    if (!me || !playerRef.current) return
    
    // Throttle updates to ~30 times per second (every 33ms)
    const now = state.clock.getElapsedTime()
    if (now - lastUpdate.current < 0.033) return
    lastUpdate.current = now

    const pos = playerRef.current.position
    const rot = playerRef.current.rotation ? playerRef.current.rotation.y : 0
    // Read invisible and giant state from userData (set by CharacterSkin)
    const invisible = playerRef.current.userData?.invisible || false
    const giant = playerRef.current.userData?.giant || false
    
    // Sync state
    me.setState('pos', [pos.x, pos.y, pos.z], false) // unreliable (fast)
    me.setState('rot', rot, false)
    me.setState('invisible', invisible, false)
    me.setState('giant', giant, false)
    
    // Sync profile (reliable) - only if changed? 
    // Actually setState checks for changes internally usually, but let's be safe
    // We can just set it once or check diff. 
    // For now, let's assume profile doesn't change every frame.
    // We should probably do this in a useEffect when props change.
  })

  // Sync profile when it changes
  useEffect(() => {
    if (me) {
      me.setState('profile', {
        name: playerName,
        team: playerTeam,
        color: teamColor,
        character: characterType
      }, true) // reliable
    }
  }, [me, playerName, playerTeam, teamColor, characterType])

  // Update physics body radius dynamically
  useFrame(() => {
    const giant = playerRef.current?.userData?.giant || false
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
        remotePlayers={{}} // Not needed for local skin logic?
        ballBody={ballBody} 
        onKick={handleKick}
        powerUps={powerUps}
        onCollectPowerUp={onCollectPowerUp}
        onPowerUpActive={onPowerUpActive}
        isFreeLook={isFreeLook}
        mobileInput={mobileInput}
        characterType={characterType}
        onLocalInteraction={onLocalInteraction}
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

function GoalDetector({ ballBody, onGoal }) {
  const lastGoalTime = useRef(0)
  
  useFrame((state) => {
    if (ballBody) {
      const { x, y, z } = ballBody.position
      const now = state.clock.getElapsedTime()
      
      // Cooldown of 5 seconds to prevent multiple triggers during the respawn delay
      if (now - lastGoalTime.current < 5) return

      // New specs: position=[-11.2, 0, 0], args=[0.2, 6, 4.6]
      if (Math.abs(x) > 11.1 && Math.abs(z) < 2.3 && y < 4) {
        const teamScored = x > 0 ? 'red' : 'blue'
        lastGoalTime.current = now
        onGoal(teamScored)
        // Immediate reset removed to allow ball to stay in net visually
      }
    }
  })
  return null
}

function SoccerBallWithPhysics({ ballBody, ballState, setBallState, isHost }) {
  const meshRef = useRef()
  
  // Sync mesh with physics
  useFrame(() => {
    if (meshRef.current && ballBody) {
      meshRef.current.position.copy(ballBody.position)
      meshRef.current.quaternion.copy(ballBody.quaternion)
    }
  })

  // Host sends ball state to server with throttling
  const lastBallUpdate = useRef(0)
  
  useFrame((state, delta) => {
    if (isHost) {
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
            position: [ballBody.position.x, ballBody.position.y, ballBody.position.z],
            velocity: [ballBody.velocity.x, ballBody.velocity.y, ballBody.velocity.z],
          }
          setBallState(ballData, false) // unreliable
        }
      }
    } else {
      // Client Sync Logic
      if (ballBody && ballState) {
        // Interpolate or snap
        const dist = Math.sqrt(
          Math.pow(ballBody.position.x - ballState.position[0], 2) + 
          Math.pow(ballBody.position.y - ballState.position[1], 2) + 
          Math.pow(ballBody.position.z - ballState.position[2], 2)
        )
        if (dist > 2.0) { 
          // Snap if too far
          ballBody.position.set(...ballState.position)
          ballBody.velocity.set(...ballState.velocity)
        } else {
           // Apply velocity from state to keep physics active but guided
           // This is a simple way to keep it in sync without jittery position setting
           // However, for precise sports games, position lerping might be better.
           // Let's try soft position correction + velocity
           
           // Simple approach: Snap position if far, otherwise let physics run but nudge velocity?
           // Actually, standard approach:
           // ballBody.position.lerp(target, 0.1) -> Cannon bodies don't have lerp.
           // We can set velocity to move towards target.
           
           // For now, let's stick to the previous logic: Snap if far. 
           // But we should also update velocity to match host so prediction is accurate.
           ballBody.velocity.set(...ballState.velocity)
           
           // Maybe slight position correction?
           ballBody.position.x += (ballState.position[0] - ballBody.position.x) * 0.1
           ballBody.position.y += (ballState.position[1] - ballBody.position.y) * 0.1
           ballBody.position.z += (ballState.position[2] - ballBody.position.z) * 0.1
        }
      }
    }
  })
  return <SoccerBall ref={meshRef} />
}



// Single player model path for all players (cat model)
const PLAYER_MODEL_PATH = '/models/cat.glb'

function RemotePlayerWithPhysics({ player, ballBody }) {
  const [position] = usePlayerState(player, 'pos', [0, 1, 0])
  const [rotation] = usePlayerState(player, 'rot', 0)
  const [profile] = usePlayerState(player, 'profile', { name: 'Player', color: '#888', team: '', character: 'cat' })
  const [invisible] = usePlayerState(player, 'invisible', false)
  const [giant] = usePlayerState(player, 'giant', false)

  const { name: playerName, color, team, character } = profile

  // Physics body for remote player
  const [body] = useState(() => createPlayerBody(position))
  const groupRef = useRef()
  const targetPosition = useRef(new THREE.Vector3(...position))
  const targetRotation = useRef(rotation)
  
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

  const prevPos = useRef(new THREE.Vector3(...position))

  // Smoothly interpolate towards target position
  useFrame((_, delta) => {
    if (groupRef.current) {
      // Use damp for time-based smoothing (independent of frame rate)
      // Lambda 20 gives a snappier but still smooth feel
      const lambda = 20
      
      groupRef.current.position.x = THREE.MathUtils.damp(groupRef.current.position.x, targetPosition.current.x, lambda, delta)
      groupRef.current.position.y = THREE.MathUtils.damp(groupRef.current.position.y, targetPosition.current.y, lambda, delta)
      groupRef.current.position.z = THREE.MathUtils.damp(groupRef.current.position.z, targetPosition.current.z, lambda, delta)
      
      // Smooth rotation (handle wrap-around)
      let rotDiff = targetRotation.current - groupRef.current.rotation.y
      while (rotDiff > Math.PI) rotDiff -= Math.PI * 2
      while (rotDiff < -Math.PI) rotDiff += Math.PI * 2
      
      groupRef.current.rotation.y += rotDiff * Math.min(1, lambda * delta)
      
      // Sync physics body with visual position
      if (body) {
        body.position.set(
          groupRef.current.position.x,
          groupRef.current.position.y,
          groupRef.current.position.z
        )
      }

      // Dribble Logic (Host only effectively, as physics runs there)
      if (ballBody) {
         const currentPos = groupRef.current.position
         const dx = currentPos.x - prevPos.current.x
         const dz = currentPos.z - prevPos.current.z
         // Calculate speed (units per second)
         const speed = Math.sqrt(dx*dx + dz*dz) / (delta || 0.016)
         
         if (speed > 1.0) {
           // Check distance to ball
           const bPos = ballBody.position
           const distToBall = Math.sqrt((bPos.x - currentPos.x)**2 + (bPos.z - currentPos.z)**2)
           
           // Interaction radius (Player 0.5 + Ball 0.22 + margin)
           if (distToBall < 1.0) {
              // Apply impulse
              // Direction: Normalized velocity vector
              const dirX = dx / ((speed * delta) || 0.001)
              const dirZ = dz / ((speed * delta) || 0.001)
              
              const dribblePower = 0.8
              ballBody.applyImpulse(
                new CANNON.Vec3(dirX * dribblePower * delta * speed, 0, dirZ * dribblePower * delta * speed),
                bPos
              )
           }
         }
         
         prevPos.current.copy(currentPos)
      }
    }
  })

  return (
    <group ref={groupRef} position={[position[0], position[1], position[2]]}>
      <CharacterSkin 
        characterType={character}
        teamColor={color}
        isRemote={true}
        invisible={invisible}
        giant={giant}
        key={character} // Force remount on character change
      />
      {playerName && !invisible && (
        <Html key={`label-${playerName}`} position={[0, 2.2, 0]} center distanceFactor={8}>
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

  const { 
    isLaunched, 
    players, 
    ballState, 
    setBallState, 
    scores, 
    setScores, 
    chatMessages,
    setChatMessages,
    isHost, 
    me 
  } = usePlayroom()



  // Auto-scroll chat when messages change
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [chatMessages])

  // Filter out my player from remote players list
  const remotePlayers = React.useMemo(() => {
    if (!me) return []
    return players.filter(p => p.id !== me.id)
  }, [players, me])

  const playerRef = useRef()
  const targetRef = useRef() // Camera target
  const [hasModel, setHasModel] = useState(false)
  // const [socket, setSocket] = useState(null) // Deprecated
  const [playerId, setPlayerId] = useState(null)
  // const [remotePlayers, setRemotePlayers] = useState({}) // Replaced by usePlayroom
  const [ballBody] = useState(() => createSoccerBallBody())
  // const [scores, setScores] = useState({ red: 0, blue: 0 }) // Replaced by usePlayroom
  // const chatMessages = [] // Replaced by usePlayroom
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
  const lastLocalInteraction = useRef(0)
  
  const handleLocalInteraction = useCallback(() => {
    lastLocalInteraction.current = Date.now()
  }, [])

  // RPC Listeners
  useEffect(() => {
    if (isLaunched) {
      // Listen for goal celebrations
      RPC.register('goal-scored', (data) => {
        setCelebration({ team: data.team })
        const audio = new Audio('/winner-game-sound-404167.mp3')
        audio.volume = 0.03
        audio.play().catch(e => console.error("Audio play failed:", e))
        setTimeout(() => {
          audio.pause()
          audio.currentTime = 0
        }, 3000)
        setTimeout(() => setCelebration(null), 3000) // Sync to 3s
        
        // Reset local player position
        setTimeout(() => {
          if (playerRef.current) {
            const spawn = playerTeam === 'red' ? [-6, 0.1, 0] : [6, 0.1, 0]
            playerRef.current.position.set(...spawn)
          }
        }, 3000) // Sync to 3s
      })

      // Listen for kick events
      RPC.register('kick-ball', (data) => {
        if (!ballBody) return
        
        // Host always applies impulse (authoritative)
        // Clients apply impulse for prediction (except the kicker, who already applied it locally)
        if (isHost || data.playerId !== me.id) {
          const impulse = new CANNON.Vec3(...data.impulse)
          const point = new CANNON.Vec3(...data.point)
          ballBody.applyImpulse(impulse, point)
        }
      })
      
      // RPC chat removed in favor of stable useMultiplayerState
    }
  }, [isLaunched, playerTeam, ballBody])
  
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

  // Sync ball physics with Playroom state
  useEffect(() => {
    if (ballBody && ballState) {
      if (!isHost) {
        // If we recently interacted with the ball locally, skip sync to prevent jitter
        // This allows client-side prediction to run smoothly until the host catches up
        if (Date.now() - lastLocalInteraction.current < 250) return

        const dist = Math.sqrt(
          Math.pow(ballBody.position.x - ballState.position[0], 2) + 
          Math.pow(ballBody.position.y - ballState.position[1], 2) + 
          Math.pow(ballBody.position.z - ballState.position[2], 2)
        )
        if (dist > 2.0) { 
          ballBody.position.set(...ballState.position)
          ballBody.velocity.set(...ballState.velocity)
        } else {
           ballBody.velocity.set(...ballState.velocity)
        }
      }
    }
  }, [ballBody, ballState, isHost])

  // Handle goal scored
  const handleGoal = (team) => {
    if (isHost) {
      const newScores = { ...scores }
      newScores[team]++
      setScores(newScores)
      
      // Broadcast goal to all clients via RPC
      RPC.call('goal-scored', { team }, RPC.Mode.ALL)
      
      // Reset ball after delay
      setTimeout(() => {
        // 1. Reset physics body (Host only)
        if (ballBody) {
          ballBody.position.set(0, 2, 0)
          ballBody.velocity.set(0, 0, 0)
          ballBody.angularVelocity.set(0, 0, 0)
        }
        // 2. Sync state to all clients
        setBallState({ position: [0, 2, 0], velocity: [0, 0, 0] }, true)
      }, 3000)
    }
  }

  // Handle score updates (Visuals only, logic moved to RPC)
  useEffect(() => {
      prevScoresRef.current = { ...scores }
  }, [scores])

  useEffect(() => {
    const world = createWorld()
    world.addBody(ballBody)
    return () => {
      world.removeBody(ballBody)
    }
  }, [ballBody])

  if (!hasJoined) {
    return <TeamSelectPopup defaultName={me?.getProfile()?.name} />
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <style>{CSS_ANIMATIONS}</style>
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
        <button
          onClick={() => {
            const elem = document.documentElement
            if (!document.fullscreenElement) {
              elem.requestFullscreen()
            } else {
              document.exitFullscreen()
            }
          }}
          style={{
            background: 'rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '12px',
            color: 'white',
            padding: '10px',
            cursor: 'pointer',
            backdropFilter: 'blur(5px)'
          }}
        >
          ⛶
        </button>
      </div>

      {/* Scoreboard - Top Center */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        gap: '20px',
        background: 'rgba(0,0,0,0.6)',
        padding: '10px 30px',
        borderRadius: '20px',
        border: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{ color: '#ff4757', fontSize: '32px', fontWeight: 'bold' }}>{scores.red}</div>
        <div style={{ color: 'white', fontSize: '32px', fontWeight: 'bold' }}>-</div>
        <div style={{ color: '#3742fa', fontSize: '32px', fontWeight: 'bold' }}>{scores.blue}</div>
      </div>
      
      {/* Active Power-up Indicator */}
      {activeEffect && (
        <div style={{
          position: 'absolute',
          top: '100px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          background: 'rgba(255, 215, 0, 0.8)',
          padding: '10px 20px',
          borderRadius: '20px',
          color: 'black',
          fontWeight: 'bold',
          animation: 'bounce 0.5s infinite alternate'
        }}>
          ⚡ {activeEffect.name} Active!
        </div>
      )}

      {/* Goal Celebration Overlay */}
      {celebration && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 10000,
          fontSize: '80px',
          fontWeight: 'bold',
          color: celebration.team === 'red' ? '#ff4757' : '#3742fa',
          textShadow: '0 0 20px rgba(255,255,255,0.8)',
          animation: 'popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}>
          GOAL!
        </div>
      )}

      {/* 3D Canvas */}
      <Canvas shadows camera={{ position: [0, 8, 18], fov: 60 }} gl={{ outputColorSpace: THREE.SRGBColorSpace }}>

          <Suspense fallback={null}>
            <fog attach="fog" args={['#050510', 10, 50]} />
            <PhysicsHandler />
            {isHost && (
              <GoalDetector 
                ballBody={ballBody} 
                setScores={setScores} 
                onGoal={handleGoal}
              />
            )}
            
            <ambientLight intensity={0.2} />
            <hemisphereLight intensity={0.3} groundColor="#000000" skyColor="#1a1a2e" />
            <pointLight position={[10, 10, 10]} intensity={0.5} castShadow />
            <directionalLight 
              position={[-20, 30, 20]} 
              intensity={1.5} 
              color="#aaccff" 
              castShadow 
              shadow-mapSize={[2048, 2048]}
              shadow-camera-left={-30}
              shadow-camera-right={30}
              shadow-camera-top={30}
              shadow-camera-bottom={-30}
            />
            <Skybox />
            <MapComponents.MysteryShack />
            <Sparkles count={300} scale={[40, 20, 40]} size={3} speed={0.3} color="#aaccff" />
            <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
            
            
            <SoccerPitch size={pitchSize} />
            <SoccerGoal position={[-11.2, 0, 0]} rotation={[0, 0, 0]} netColor={teamColors.red} />
            <SoccerGoal position={[11.2, 0, 0]} rotation={[0, -Math.PI, 0]} netColor={teamColors.blue} />
            
            {/* Ball with Physics and Sync */}
            <SoccerBallWithPhysics 
              ballBody={ballBody} 
              setBallState={setBallState}
              isHost={isHost}
            />
            
            {/* Local Player */}
              <LocalPlayerWithSync 
                me={me}
                playerRef={playerRef}
                hasModel={hasModel}
                playerName={playerName}
                playerTeam={playerTeam}
                teamColor={playerTeam === 'red' ? teamColors.red : teamColors.blue}
                spawnPosition={playerTeam === 'red' ? [-6, 0.1, 0] : [6, 0.1, 0]}
                ballBody={ballBody}
                powerUps={activePowerUps}
                onCollectPowerUp={handleCollectPowerUp}
                onPowerUpActive={handlePowerUpActive}
                isFreeLook={isFreeLook}
                mobileInput={mobileInput}
                characterType={playerCharacter}
                onLocalInteraction={handleLocalInteraction}
                key={playerCharacter} // Force remount when character changes
              />

            
            {/* Remote Players */}
            {remotePlayers.map((p) => (
              <RemotePlayerWithPhysics 
                key={p.id} 
                player={p}
                ballBody={ballBody}
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
                  <div key={msg.time + '-' + msg.playerName} style={{ marginBottom: '8px' }}>
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
                  if (chatInput.trim()) {
                    const newMessage = {
                      playerName: playerName || 'Guest',
                      team: playerTeam,
                      message: chatInput.trim(),
                      time: Date.now()
                    }
                    // Use multiplayer state for stable sync
                    setChatMessages(prev => [...(prev || []).slice(-49), newMessage])
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
                  // me.quit() is not a valid Playroom function
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


