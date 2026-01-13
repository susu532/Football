// Ball.jsx - Client ball visual with interpolation for Colyseus
// Server-authoritative: Client NEVER moves the ball, only displays

import React, { useRef, useEffect, useImperativeHandle, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'

import { useGLTF, Trail } from '@react-three/drei'
import * as THREE from 'three'
import { useSpring, a } from '@react-spring/three'
import { PHYSICS } from './PhysicsConstants.js'

// Soccer Ball Visual Component
export const SoccerBall = React.forwardRef(({ radius = 0.8, onKickFeedback }, ref) => {
  const internalRef = useRef()
  useImperativeHandle(ref, () => internalRef.current)
  const { scene } = useGLTF('/models/soccer_ball.glb')
  
  const [spring, api] = useSpring(() => ({
    scale: 5,
    config: { tension: 400, friction: 10 }
  }))

  // Kick feedback effect
  useEffect(() => {
    if (onKickFeedback) {
      const handleKick = () => {
        api.start({
          from: { scale: 7 },
          to: { scale: 5 }
        })
      }
      // Store callback for external trigger
      onKickFeedback.current = handleKick
    }
  }, [api, onKickFeedback])

  const clonedBall = useMemo(() => {
    const cloned = scene.clone()
    cloned.traverse((child) => {
      if (child.isMesh) {
        // Material fixes
        if (child.material) {
          const oldMat = child.material
          // Use MeshStandardMaterial - cheaper than MeshPhysicalMaterial
          child.material = new THREE.MeshStandardMaterial({
            map: oldMat.map,
            color: oldMat.color, // Restore original color
            roughness: 0.7, // Increased for matte look
            metalness: 0.0,
            flatShading: false
          })
          
          // Ensure textures are filtered well
          if (child.material.map) {
            child.material.map.anisotropy = 4 // Reduced from 16
            child.material.map.minFilter = THREE.LinearMipmapLinearFilter
            child.material.map.magFilter = THREE.LinearFilter
            child.material.map.needsUpdate = true
          }
          child.material.needsUpdate = true
        }

        child.castShadow = true
        child.receiveShadow = false // Disable receive shadow for performance
        
        // REMOVED: computeVertexNormals to save CPU
      }
    })
    return cloned
  }, [scene])

  return (
    <a.primitive 
      ref={internalRef}
      object={clonedBall} 
      scale={spring.scale} 
    />
  )
})
SoccerBall.displayName = 'SoccerBall'

// === S-TIER PING-AWARE COLLISION PREDICTION ===
// Designed for 0-ping visual feel at ANY latency

// Collision constants - ultra-aggressive for instant feel
const COLLISION_COOLDOWN = 0.004 // 4ms - near-instant re-collision
const BASE_LOOKAHEAD = 0.03 // Reduced from 0.05
const MAX_LOOKAHEAD = 0.10 // Reduced from 0.15
const IMPULSE_PREDICTION_FACTOR = 0.9 // Match server closely
const BALL_RADIUS = PHYSICS.BALL_RADIUS
const PLAYER_RADIUS = PHYSICS.PLAYER_RADIUS // Increased from 0.14 to match server cuboid(0.6, 0.2, 0.6)
const COMBINED_RADIUS = BALL_RADIUS + PLAYER_RADIUS

// RAPIER-matched physics constants
const BALL_RESTITUTION = PHYSICS.BALL_RESTITUTION
const GRAVITY = PHYSICS.WORLD_GRAVITY
const LINEAR_DAMPING = PHYSICS.BALL_LINEAR_DAMPING

// Ultra-aggressive interpolation for instant response
const LERP_NORMAL = 25 // Snappy base
const LERP_COLLISION = 80 // Near-instant snap on collision
const LERP_SNAP_THRESHOLD = 8
const SPECULATIVE_THRESHOLD = 0.5 // Tightened from 0.7

// Sub-frame sweep test
const sweepSphereToSphere = (ballStart, ballEnd, playerPos, combinedRadius) => {
  const dx = ballEnd.x - ballStart.x
  const dy = ballEnd.y - ballStart.y
  const dz = ballEnd.z - ballStart.z
  
  const fx = ballStart.x - playerPos.x
  const fy = ballStart.y - playerPos.y
  const fz = ballStart.z - playerPos.z
  
  const a = dx * dx + dy * dy + dz * dz
  const b = 2 * (fx * dx + fy * dy + fz * dz)
  const c = fx * fx + fy * fy + fz * fz - combinedRadius * combinedRadius
  
  if (a < 0.0001) return null
  
  const discriminant = b * b - 4 * a * c
  if (discriminant < 0) return null
  
  const sqrtDisc = Math.sqrt(discriminant)
  const t1 = (-b - sqrtDisc) / (2 * a)
  const t2 = (-b + sqrtDisc) / (2 * a)
  
  if (t1 >= 0 && t1 <= 1) return t1
  if (t2 >= 0 && t2 <= 1) return t2
  return null
}

// Anticipatory trajectory prediction with gravity
const predictFuturePosition = (pos, vel, time, gravity) => ({
  x: pos.x + vel.x * time,
  y: Math.max(BALL_RADIUS, pos.y + vel.y * time - 0.5 * gravity * time * time),
  z: pos.z + vel.z * time
})

// Trajectory Line Component
const TrajectoryLine = ({ startPos, startVel, gravity = 20 }) => {
  const points = useMemo(() => {
    const pts = []
    const pos = startPos.clone()
    const vel = startVel.clone()
    const dt = 1/60
    const maxSteps = 120 // 2 seconds
    
    // Simple physics simulation
    for (let i = 0; i < maxSteps; i++) {
      pts.push(pos.clone())
      
      pos.addScaledVector(vel, dt)
      vel.y -= gravity * dt
      
      // Floor bounce
      if (pos.y < 0.8) {
        pos.y = 0.8
        vel.y *= -0.75
        vel.x *= 0.85
        vel.z *= 0.85
      }
      
      // Wall bounces (approximate)
      if (Math.abs(pos.x) > 14.5) {
        pos.x = Math.sign(pos.x) * 14.5
        vel.x *= -0.75
      }
      if (Math.abs(pos.z) > 9.5) {
        pos.z = Math.sign(pos.z) * 9.5
        vel.z *= -0.75
      }
    }
    return pts
  }, [startPos, startVel, gravity])

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={points.length}
          array={new Float32Array(points.flatMap(p => [p.x, p.y, p.z]))}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial color="white" opacity={0.3} transparent />
    </line>
  )
}

// ClientBallVisual - PING-AWARE 0-ping prediction
// Now accepts ping prop for latency-scaled prediction
export const ClientBallVisual = React.forwardRef(({ 
  ballState, 
  onKickMessage, 
  localPlayerRef,
  ping = 0, // Network latency in ms
  pingJitter = 0, // Network jitter for adaptive smoothing
  ballOwner = '' // Session ID of ball owner
}, ref) => {
  const groupRef = useRef()
  
  // LOGIC STATE (The authoritative physics simulation)
  const logicPos = useRef(new THREE.Vector3(0, 2, 0))
  const velocity = useRef(new THREE.Vector3(0, 0, 0))
  
  // VISUAL STATE (Smoothing)
  const visualOffset = useRef(new THREE.Vector3(0, 0, 0))
  const lastReconciledTick = useRef(0)
  
  // PREDICTION STATE
  const kickFeedback = useRef(null)
  
  // Ownership state
  const isOwner = localPlayerRef?.current?.userData?.sessionId === ballOwner
  
  useImperativeHandle(ref, () => {
    const obj = groupRef.current || {}
    obj.userData = obj.userData || {}
    obj.userData.predictKick = (impulse) => {
      // INSTANT local kick response
      const invMass = 1 / PHYSICS.BALL_MASS 
      velocity.current.x += impulse.x * invMass * IMPULSE_PREDICTION_FACTOR
      velocity.current.y += impulse.y * invMass * IMPULSE_PREDICTION_FACTOR
      velocity.current.z += impulse.z * invMass * IMPULSE_PREDICTION_FACTOR
    }
    return obj
  })

  // Kick message handler
  useEffect(() => {
    if (onKickMessage) {
      const unsubscribe = onKickMessage('ball-kicked', (data) => {
        if (kickFeedback.current) kickFeedback.current()
        // We rely on server state updates for correction, 
        // but we can add a small nudge here if needed.
        // For now, let the main reconciliation loop handle it.
      })
      return unsubscribe
    }
  }, [onKickMessage])

  useFrame((state, delta) => {
    if (!groupRef.current || !ballState) return

    // 1. SERVER RECONCILIATION
    // Check if we have a new server update
    if (ballState.tick > lastReconciledTick.current) {
      lastReconciledTick.current = ballState.tick
      
      const serverPos = new THREE.Vector3(ballState.x, ballState.y, ballState.z)
      const serverVel = new THREE.Vector3(ballState.vx, ballState.vy, ballState.vz)
      
      // LATENCY EXTRAPOLATION
      // Project server state forward to match client time
      const latency = Math.max(0, ping / 1000 / 2) // One-way trip time
      
      // Apply physics extrapolation (Position + Velocity * t + 0.5 * Gravity * t^2)
      // We use a simplified version matching our local physics
      const extrapolatedPos = serverPos.clone()
      const extrapolatedVel = serverVel.clone()
      
      // 1. Apply Velocity
      extrapolatedPos.addScaledVector(serverVel, latency)
      
      // 2. Apply Gravity (y-axis)
      if (extrapolatedPos.y > BALL_RADIUS) {
        extrapolatedPos.y -= 0.5 * GRAVITY * latency * latency
        extrapolatedVel.y -= GRAVITY * latency
      }
      
      // 3. Floor clamp (simple)
      if (extrapolatedPos.y < BALL_RADIUS) extrapolatedPos.y = BALL_RADIUS

      // Calculate error against EXTRAPOLATED server position
      const dist = logicPos.current.distanceTo(extrapolatedPos)
      
      // Decision: Snap or Smooth?
      // Threshold: 10cm (Visual Offset Pattern)
      if (dist > 0.1) {
        // Capture position BEFORE snap
        const beforeSnap = logicPos.current.clone()
        
        // HARD SNAP PHYSICS to EXTRAPOLATED state
        logicPos.current.copy(extrapolatedPos)
        velocity.current.copy(extrapolatedVel)
        
        // VISUAL OFFSET: offset = old - new
        // This hides the snap by adding the difference to the visual offset
        visualOffset.current.add(beforeSnap.sub(logicPos.current))
      } else {
        // Small drift: Softly nudge velocity to converge
        // We use the extrapolated velocity as the target
        velocity.current.lerp(extrapolatedVel, 0.2)
      }
    }

    // 2. PHYSICS SIMULATION (Client-Side Prediction)
    // Apply Gravity
    if (logicPos.current.y > BALL_RADIUS) {
      velocity.current.y -= GRAVITY * delta
    }

    // Apply Velocity
    logicPos.current.addScaledVector(velocity.current, delta)

    // Floor Collision
    if (logicPos.current.y < BALL_RADIUS) {
      logicPos.current.y = BALL_RADIUS
      if (velocity.current.y < 0) {
        velocity.current.y *= -BALL_RESTITUTION
        // Friction
        velocity.current.x *= 0.98
        velocity.current.z *= 0.98
      }
    }

    // Wall Collisions
    const ARENA_HALF_WIDTH = PHYSICS.ARENA_HALF_WIDTH
    const ARENA_HALF_DEPTH = PHYSICS.ARENA_HALF_DEPTH
    const GOAL_HALF_WIDTH = PHYSICS.GOAL_WIDTH / 2
    
    // X Walls
    if (Math.abs(logicPos.current.x) > ARENA_HALF_WIDTH) {
      const inGoalZone = Math.abs(logicPos.current.z) < GOAL_HALF_WIDTH && logicPos.current.y < 4
      if (!inGoalZone) {
        velocity.current.x *= -BALL_RESTITUTION
        logicPos.current.x = Math.sign(logicPos.current.x) * (ARENA_HALF_WIDTH - 0.1)
      }
    }
    
    // Z Walls
    if (Math.abs(logicPos.current.z) > ARENA_HALF_DEPTH) {
      velocity.current.z *= -BALL_RESTITUTION
      logicPos.current.z = Math.sign(logicPos.current.z) * (ARENA_HALF_DEPTH - 0.1)
    }

    // Linear Damping
    velocity.current.multiplyScalar(1 - LINEAR_DAMPING * delta)

    // 3. VISUAL SMOOTHING
    // Decay the visual offset to zero
    visualOffset.current.lerp(new THREE.Vector3(0, 0, 0), 0.1) // 10% decay per frame
    
    // Render Position = Logic + Offset
    groupRef.current.position.copy(logicPos.current).add(visualOffset.current)
    
    // Rotation (Visual only)
    if (ballState.rx !== undefined) {
       // Smoothly interpolate rotation
       const targetRot = new THREE.Quaternion(ballState.rx, ballState.ry, ballState.rz, ballState.rw)
       groupRef.current.quaternion.slerp(targetRot, 10 * delta)
    }
  })

  return (
    <group ref={groupRef} position={[0, 2, 0]}>
      <Trail
        width={0.6}
        length={8}
        color="#ffffff"
        attenuation={(t) => t * t}
      >
        <SoccerBall onKickFeedback={kickFeedback} />
      </Trail>
      {isOwner && (
        <TrajectoryLine 
          startPos={groupRef.current?.position || new THREE.Vector3()} 
          startVel={predictedVelocity.current} 
        />
      )}
    </group>
  )
})
ClientBallVisual.displayName = 'ClientBallVisual'
