// Ball.jsx - Client ball visual with interpolation for Colyseus
// Server-authoritative: Client NEVER moves the ball, only displays

import React, { useRef, useEffect, useImperativeHandle, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'

import { useGLTF, Trail } from '@react-three/drei'
import * as THREE from 'three'
import { useSpring, a } from '@react-spring/three'

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
const BASE_LOOKAHEAD = 0.05 // 50ms base anticipation
const MAX_LOOKAHEAD = 0.15 // 150ms max anticipation at high ping
const IMPULSE_PREDICTION_FACTOR = 0.9 // Match server closely
const BALL_RADIUS = 0.8

// Player hitbox dimensions (match server cuboid exactly)
const PLAYER_HALF_WIDTH = 0.6   // X half-extent
const PLAYER_HALF_HEIGHT = 0.4  // Y half-extent (total height 0.8 centered at 0.2)
const PLAYER_HALF_DEPTH = 0.6   // Z half-extent
const PLAYER_CENTER_Y_OFFSET = 0.2 // Collider center offset from player position

// RAPIER-matched physics constants
const BALL_RESTITUTION = 0.75
const GRAVITY = 20
const LINEAR_DAMPING = 1.5

// Ultra-aggressive interpolation for instant response
const LERP_NORMAL = 25 // Snappy base
const LERP_COLLISION = 80 // Near-instant snap on collision
const LERP_SNAP_THRESHOLD = 8

// Sphere-to-AABB collision detection (matches server cuboid)
const sphereToAABB = (spherePos, sphereRadius, boxCenter, halfExtents) => {
  // Find closest point on AABB to sphere center
  const closestX = Math.max(boxCenter.x - halfExtents.x, 
                    Math.min(spherePos.x, boxCenter.x + halfExtents.x))
  const closestY = Math.max(boxCenter.y - halfExtents.y, 
                    Math.min(spherePos.y, boxCenter.y + halfExtents.y))
  const closestZ = Math.max(boxCenter.z - halfExtents.z, 
                    Math.min(spherePos.z, boxCenter.z + halfExtents.z))
  
  const dx = spherePos.x - closestX
  const dy = spherePos.y - closestY
  const dz = spherePos.z - closestZ
  const distSq = dx * dx + dy * dy + dz * dz
  
  if (distSq < sphereRadius * sphereRadius) {
    const dist = Math.sqrt(distSq)
    const invDist = dist > 0.001 ? 1 / dist : 0
    return {
      colliding: true,
      normal: { x: dx * invDist, y: dy * invDist, z: dz * invDist },
      penetration: sphereRadius - dist,
      closestPoint: { x: closestX, y: closestY, z: closestZ }
    }
  }
  return { colliding: false }
}

// Swept sphere-to-AABB for high-speed collision (prevents tunneling)
const sweepSphereToAABB = (sphereStart, sphereEnd, sphereRadius, boxCenter, halfExtents) => {
  // Minkowski sum: expand box by sphere radius
  const minX = boxCenter.x - halfExtents.x - sphereRadius
  const maxX = boxCenter.x + halfExtents.x + sphereRadius
  const minY = boxCenter.y - halfExtents.y - sphereRadius
  const maxY = boxCenter.y + halfExtents.y + sphereRadius
  const minZ = boxCenter.z - halfExtents.z - sphereRadius
  const maxZ = boxCenter.z + halfExtents.z + sphereRadius
  
  // Ray direction
  const dx = sphereEnd.x - sphereStart.x
  const dy = sphereEnd.y - sphereStart.y
  const dz = sphereEnd.z - sphereStart.z
  
  // Slab intersection
  let tMin = 0, tMax = 1
  
  // X slab
  if (Math.abs(dx) > 0.0001) {
    const t1 = (minX - sphereStart.x) / dx
    const t2 = (maxX - sphereStart.x) / dx
    tMin = Math.max(tMin, Math.min(t1, t2))
    tMax = Math.min(tMax, Math.max(t1, t2))
  } else if (sphereStart.x < minX || sphereStart.x > maxX) {
    return null
  }
  
  // Y slab
  if (Math.abs(dy) > 0.0001) {
    const t1 = (minY - sphereStart.y) / dy
    const t2 = (maxY - sphereStart.y) / dy
    tMin = Math.max(tMin, Math.min(t1, t2))
    tMax = Math.min(tMax, Math.max(t1, t2))
  } else if (sphereStart.y < minY || sphereStart.y > maxY) {
    return null
  }
  
  // Z slab
  if (Math.abs(dz) > 0.0001) {
    const t1 = (minZ - sphereStart.z) / dz
    const t2 = (maxZ - sphereStart.z) / dz
    tMin = Math.max(tMin, Math.min(t1, t2))
    tMax = Math.min(tMax, Math.max(t1, t2))
  } else if (sphereStart.z < minZ || sphereStart.z > maxZ) {
    return null
  }
  
  if (tMin <= tMax && tMin >= 0 && tMin <= 1) {
    return tMin
  }
  return null
}

// Anticipatory trajectory prediction with gravity
const predictFuturePosition = (pos, vel, time, gravity) => ({
  x: pos.x + vel.x * time,
  y: Math.max(BALL_RADIUS, pos.y + vel.y * time - 0.5 * gravity * time * time),
  z: pos.z + vel.z * time
})

// ClientBallVisual - PING-AWARE 0-ping prediction with AABB collision
export const ClientBallVisual = React.forwardRef(({ 
  ballState, 
  onKickMessage, 
  localPlayerRef,
  ping = 0 // Network latency in ms
}, ref) => {
  const groupRef = useRef()
  const targetPos = useRef(new THREE.Vector3(0, 2, 0))
  const targetRot = useRef(new THREE.Quaternion())
  const serverVelocity = useRef(new THREE.Vector3(0, 0, 0))
  const predictedVelocity = useRef(new THREE.Vector3(0, 0, 0))
  const kickFeedback = useRef(null)
  const lastCollisionTime = useRef(0)
  const collisionThisFrame = useRef(false)
  const lastCollisionNormal = useRef(new THREE.Vector3())
  
  useImperativeHandle(ref, () => {
    const obj = groupRef.current || {}
    obj.userData = obj.userData || {}
    obj.userData.predictKick = (impulse) => {
      predictedVelocity.current.x += impulse.x * IMPULSE_PREDICTION_FACTOR
      predictedVelocity.current.y += impulse.y * IMPULSE_PREDICTION_FACTOR
      predictedVelocity.current.z += impulse.z * IMPULSE_PREDICTION_FACTOR
      collisionThisFrame.current = true
    }
    return obj
  })

  // Kick message handler
  useEffect(() => {
    if (onKickMessage) {
      const unsubscribe = onKickMessage('ball-kicked', (data) => {
        if (kickFeedback.current) kickFeedback.current()
        
        if (data.impulse) {
          const serverImpulse = {
            x: data.impulse.x * IMPULSE_PREDICTION_FACTOR,
            y: data.impulse.y * IMPULSE_PREDICTION_FACTOR,
            z: data.impulse.z * IMPULSE_PREDICTION_FACTOR
          }
          predictedVelocity.current.x += (serverImpulse.x - predictedVelocity.current.x) * 0.3
          predictedVelocity.current.y += (serverImpulse.y - predictedVelocity.current.y) * 0.3
          predictedVelocity.current.z += (serverImpulse.z - predictedVelocity.current.z) * 0.3
        }
      })
      return unsubscribe
    }
  }, [onKickMessage])

  useFrame((state, delta) => {
    if (!groupRef.current || !ballState) return

    const now = state.clock.getElapsedTime()
    collisionThisFrame.current = false

    // === PING-AWARE PARAMETERS ===
    const pingSeconds = ping / 1000
    const dynamicLookahead = Math.min(MAX_LOOKAHEAD, BASE_LOOKAHEAD + pingSeconds / 2)
    const pingFactor = Math.max(0.3, 1 - ping / 300)
    const reconcileRate = 1 - Math.exp(-12 * pingFactor * delta)

    // 1. Sync server state
    targetPos.current.set(ballState.x, ballState.y, ballState.z)
    serverVelocity.current.set(ballState.vx || 0, ballState.vy || 0, ballState.vz || 0)
    if (ballState.rx !== undefined) {
      targetRot.current.set(ballState.rx, ballState.ry, ballState.rz, ballState.rw)
    }

    // 2. Ping-aware velocity reconciliation
    predictedVelocity.current.lerp(serverVelocity.current, reconcileRate)

    // 3. Advance prediction with physics
    const vel = predictedVelocity.current
    targetPos.current.addScaledVector(vel, delta)
    
    if (targetPos.current.y > BALL_RADIUS) {
      predictedVelocity.current.y -= GRAVITY * delta
    }

    // 4. S-TIER DIRECTIONAL COLLISION PREDICTION (Sphere-to-AABB)
    const timeSinceCollision = now - lastCollisionTime.current
    
    if (localPlayerRef?.current?.position && timeSinceCollision > COLLISION_COOLDOWN) {
      const playerPos = localPlayerRef.current.position
      const playerVel = localPlayerRef.current.userData?.velocity || { x: 0, y: 0, z: 0 }
      const ballPos = groupRef.current.position
      
      // Player box center (offset for collider position)
      const boxCenter = {
        x: playerPos.x,
        y: playerPos.y + PLAYER_CENTER_Y_OFFSET,
        z: playerPos.z
      }
      const halfExtents = {
        x: PLAYER_HALF_WIDTH,
        y: PLAYER_HALF_HEIGHT,
        z: PLAYER_HALF_DEPTH
      }
      
      // Test current collision (Sphere-to-AABB)
      const collision = sphereToAABB(ballPos, BALL_RADIUS, boxCenter, halfExtents)
      
      // Swept test for high-speed
      const ballEnd = targetPos.current.clone()
      const sweepT = sweepSphereToAABB(ballPos, ballEnd, BALL_RADIUS, boxCenter, halfExtents)
      
      // Anticipatory collision
      const futureBall = predictFuturePosition(ballPos, vel, dynamicLookahead, GRAVITY)
      const futureBox = {
        x: boxCenter.x + (playerVel.x || 0) * dynamicLookahead,
        y: boxCenter.y + (playerVel.y || 0) * dynamicLookahead,
        z: boxCenter.z + (playerVel.z || 0) * dynamicLookahead
      }
      const futureCollision = sphereToAABB(futureBall, BALL_RADIUS, futureBox, halfExtents)
      
      if (collision.colliding || sweepT !== null || futureCollision.colliding) {
        let nx, ny, nz, penetration
        
        if (collision.colliding) {
          nx = collision.normal.x
          ny = collision.normal.y
          nz = collision.normal.z
          penetration = collision.penetration
        } else if (sweepT !== null && sweepT > 0) {
          // Contact point from sweep
          const contactPt = {
            x: ballPos.x + (ballEnd.x - ballPos.x) * sweepT,
            y: ballPos.y + (ballEnd.y - ballPos.y) * sweepT,
            z: ballPos.z + (ballEnd.z - ballPos.z) * sweepT
          }
          const sweepCol = sphereToAABB(contactPt, BALL_RADIUS, boxCenter, halfExtents)
          if (sweepCol.colliding) {
            nx = sweepCol.normal.x
            ny = sweepCol.normal.y
            nz = sweepCol.normal.z
            penetration = sweepCol.penetration
          } else {
            // Fallback normal
            const dx = contactPt.x - boxCenter.x
            const dy = contactPt.y - boxCenter.y
            const dz = contactPt.z - boxCenter.z
            const d = Math.sqrt(dx*dx + dy*dy + dz*dz) || 1
            nx = dx / d
            ny = dy / d
            nz = dz / d
            penetration = 0.05
          }
        } else if (futureCollision.colliding) {
          nx = futureCollision.normal.x
          ny = futureCollision.normal.y
          nz = futureCollision.normal.z
          penetration = futureCollision.penetration * 0.5 // Anticipatory - reduced
        }
        
        // Ensure valid normal
        if (nx === undefined || (nx === 0 && ny === 0 && nz === 0)) {
          const dx = ballPos.x - boxCenter.x
          const dy = ballPos.y - boxCenter.y
          const dz = ballPos.z - boxCenter.z
          const d = Math.sqrt(dx*dx + dy*dy + dz*dz) || 1
          nx = dx / d
          ny = Math.max(0.1, dy / d)
          nz = dz / d
          penetration = 0.05
        }
        
        // Relative velocity
        const relVx = vel.x - (playerVel.x || 0)
        const relVy = vel.y - (playerVel.y || 0)
        const relVz = vel.z - (playerVel.z || 0)
        const approachSpeed = relVx * nx + relVy * ny + relVz * nz
        
        if (approachSpeed < 0 || collision.colliding) {
          lastCollisionTime.current = now
          collisionThisFrame.current = true
          lastCollisionNormal.current.set(nx, ny, nz)
          
          // === DIRECTIONAL IMPULSE RESPONSE ===
          const absNx = Math.abs(nx)
          const absNy = Math.abs(ny)
          const absNz = Math.abs(nz)
          
          // Determine contact direction
          const isTop = absNy > 0.6 && ny > 0
          const isFront = absNz > 0.5 && nz > 0
          const isSide = absNx > 0.5
          const isBehind = absNz > 0.5 && nz < 0
          
          let boostFactor = 1.2
          let verticalBoost = 1.5
          
          if (isTop) {
            // Header - strong vertical, minimal lateral
            boostFactor = 0.8
            verticalBoost = 3.0
          } else if (isFront) {
            // Front - strong forward push
            boostFactor = 1.3
            verticalBoost = 1.5
          } else if (isSide) {
            // Side - strong lateral
            boostFactor = 1.25
            verticalBoost = 1.3
          } else if (isBehind) {
            // Behind - backward bounce
            boostFactor = 1.1
            verticalBoost = 1.2
          }
          
          // RAPIER-matched impulse
          const impulseMag = -(1 + BALL_RESTITUTION) * approachSpeed
          
          predictedVelocity.current.x += impulseMag * nx * boostFactor
          predictedVelocity.current.y += impulseMag * ny * boostFactor + verticalBoost
          predictedVelocity.current.z += impulseMag * nz * boostFactor
          
          // Player velocity transfer
          predictedVelocity.current.x += (playerVel.x || 0) * 0.5
          predictedVelocity.current.z += (playerVel.z || 0) * 0.5
          
          // INSTANT position correction
          if (penetration > 0) {
            const pushOut = penetration + 0.02
            targetPos.current.x += nx * pushOut
            targetPos.current.y += ny * pushOut * 0.5
            targetPos.current.z += nz * pushOut
            
            // Immediate visual push
            groupRef.current.position.x += nx * pushOut * 0.8
            groupRef.current.position.z += nz * pushOut * 0.8
          }
        }
      }
    }

    // 5. ULTRA-AGGRESSIVE visual interpolation
    const distance = groupRef.current.position.distanceTo(targetPos.current)
    
    if (distance > LERP_SNAP_THRESHOLD) {
      groupRef.current.position.copy(targetPos.current)
    } else if (collisionThisFrame.current) {
      // INSTANT snap on collision
      const snapFactor = 1 - Math.exp(-LERP_COLLISION * delta)
      groupRef.current.position.lerp(targetPos.current, snapFactor)
    } else {
      const lerpFactor = 1 - Math.exp(-LERP_NORMAL * delta)
      groupRef.current.position.lerp(targetPos.current, lerpFactor)
    }
    
    groupRef.current.quaternion.slerp(targetRot.current, 1 - Math.exp(-15 * delta))
    
    // 6. Floor collision
    if (groupRef.current.position.y < BALL_RADIUS) {
      groupRef.current.position.y = BALL_RADIUS
      if (predictedVelocity.current.y < 0) {
        predictedVelocity.current.y = Math.abs(predictedVelocity.current.y) * BALL_RESTITUTION
      }
    }

    // 7. Linear damping
    predictedVelocity.current.multiplyScalar(1 - LINEAR_DAMPING * delta)
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
    </group>
  )
})
ClientBallVisual.displayName = 'ClientBallVisual'
