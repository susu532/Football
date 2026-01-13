import React, { useRef, useEffect, useImperativeHandle, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PHYSICS } from './PhysicsConstants'

// Simple Spring Physics Class
class Spring {
  constructor(stiffness = 120, damping = 20) {
    this.stiffness = stiffness
    this.damping = damping
    this.current = 0
    this.target = 0
    this.velocity = 0
  }

  update(dt) {
    const force = (this.target - this.current) * this.stiffness
    const accel = force - this.velocity * this.damping
    this.velocity += accel * dt
    this.current += this.velocity * dt
    return this.current
  }

  reset(val) {
    this.current = val
    this.target = val
    this.velocity = 0
  }
}

// Procedural Noise for Shake
const noise = (t) => {
  return Math.sin(t * 123.45) * Math.sin(t * 67.89) * Math.sin(t * 23.45)
}

export const SmartCamera = React.forwardRef(({ 
  targetRef, 
  isFreeLook, 
  cameraOrbit,
  onShake // Expose shake trigger
}, ref) => {
  const { camera } = useThree()
  
  // Camera State
  const orbit = useRef({
    azimuth: 0,
    polar: Math.PI / 4, // 45 degrees
    distance: 14,
    targetDistance: 14,
    isLocked: false
  })

  // Spring System for smooth follow
  const springs = useRef({
    x: new Spring(80, 20),
    y: new Spring(80, 20),
    z: new Spring(80, 20),
    fov: new Spring(50, 10)
  })

  // LookAt Smoothing State
  const smoothedLookTarget = useRef(new THREE.Vector3())
  const isInitialized = useRef(false)

  // Shake State
  const shakeState = useRef({
    intensity: 0,
    decay: 5,
    time: 0
  })

  // Expose controls
  useImperativeHandle(ref, () => ({
    shake: (intensity = 0.5) => {
      shakeState.current.intensity = Math.min(shakeState.current.intensity + intensity, 2.0)
    },
    reset: () => {
      if (targetRef.current) {
        const { x, y, z } = targetRef.current.position
        springs.current.x.reset(x)
        springs.current.y.reset(y + 5)
        springs.current.z.reset(z + 10)
      }
    }
  }))

  // Sync orbit ref
  useEffect(() => {
    if (cameraOrbit) {
      cameraOrbit.current = orbit.current
    }
  }, [cameraOrbit])

  // Input Event Listeners
  useEffect(() => {
    const onPointerLockChange = () => {
      orbit.current.isLocked = document.pointerLockElement === document.body
    }

    const onMouseMove = (e) => {
      if (document.pointerLockElement !== document.body) return
      const sensitivity = 0.002
      orbit.current.azimuth -= e.movementX * sensitivity
      orbit.current.polar -= e.movementY * sensitivity
      orbit.current.polar = Math.max(0.1, Math.min(Math.PI / 2 - 0.1, orbit.current.polar))
    }

    const onWheel = (e) => {
      const zoomSensitivity = 0.02
      orbit.current.targetDistance = THREE.MathUtils.clamp(
        orbit.current.targetDistance + e.deltaY * zoomSensitivity,
        5,
        25
      )
    }

    const onClick = (e) => {
      if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return
      if (document.pointerLockElement !== document.body) {
        try { document.body.requestPointerLock() } catch (e) {}
      }
    }

    document.addEventListener('pointerlockchange', onPointerLockChange)
    document.addEventListener('mousemove', onMouseMove)
    window.addEventListener('wheel', onWheel, { passive: true })
    document.body.addEventListener('click', onClick)

    return () => {
      document.removeEventListener('pointerlockchange', onPointerLockChange)
      document.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('wheel', onWheel)
      document.body.removeEventListener('click', onClick)
    }
  }, [])

  // Main Camera Loop
  useFrame((state, delta) => {
    if (!targetRef.current) return

    const dt = Math.min(delta, 0.1) // Cap dt for stability
    const targetPos = targetRef.current.position
    const targetVel = targetRef.current.userData?.velocity || new THREE.Vector3()
    
    // 1. Update Orbit
    orbit.current.distance = THREE.MathUtils.lerp(
      orbit.current.distance,
      orbit.current.targetDistance,
      dt * 5
    )

    // 2. Calculate Ideal Camera Position
    // Add "Look Ahead" based on velocity
    const lookAhead = targetVel.clone().multiplyScalar(0.1)
    lookAhead.y = 0 // Don't look ahead vertically
    
    const { azimuth, polar, distance } = orbit.current
    
    // Calculate offset from orbit
    const offsetX = distance * Math.sin(polar) * Math.sin(azimuth)
    const offsetY = distance * Math.cos(polar)
    const offsetZ = distance * Math.sin(polar) * Math.cos(azimuth)

    const idealX = targetPos.x + offsetX + lookAhead.x
    const idealY = targetPos.y + offsetY + 2.0 // Look slightly above player
    const idealZ = targetPos.z + offsetZ + lookAhead.z

    // 3. Collision Avoidance (Simple Arena Bounds)
    // If camera goes outside arena walls, push it in
    const ARENA_MARGIN = 2.0
    const minX = -PHYSICS.ARENA_HALF_WIDTH - ARENA_MARGIN
    const maxX = PHYSICS.ARENA_HALF_WIDTH + ARENA_MARGIN
    const minZ = -PHYSICS.ARENA_HALF_DEPTH - ARENA_MARGIN
    const maxZ = PHYSICS.ARENA_HALF_DEPTH + ARENA_MARGIN

    // We don't hard clamp, but we add a "repulsive force" to the spring target
    // Actually, hard clamping the *target* is better for stability
    const clampedX = THREE.MathUtils.clamp(idealX, minX, maxX)
    const clampedZ = THREE.MathUtils.clamp(idealZ, minZ, maxZ)
    // Floor check
    const clampedY = Math.max(1.0, idealY)

    // 4. Update Springs
    springs.current.x.target = clampedX
    springs.current.y.target = clampedY
    springs.current.z.target = clampedZ

    const camX = springs.current.x.update(dt)
    const camY = springs.current.y.update(dt)
    const camZ = springs.current.z.update(dt)

    // 5. Dynamic FOV
    const speed = targetVel.length()
    const baseFov = 45
    const maxFov = 65
    const targetFov = baseFov + (Math.min(speed, 20) / 20) * (maxFov - baseFov)
    
    springs.current.fov.target = targetFov
    const currentFov = springs.current.fov.update(dt)
    
    if (Math.abs(camera.fov - currentFov) > 0.1) {
      camera.fov = currentFov
      camera.updateProjectionMatrix()
    }

    // 6. Camera Shake
    let shakeX = 0, shakeY = 0, shakeZ = 0
    if (shakeState.current.intensity > 0.01) {
      shakeState.current.time += dt
      const t = shakeState.current.time
      const i = shakeState.current.intensity
      
      shakeX = noise(t) * i
      shakeY = noise(t + 100) * i
      shakeZ = noise(t + 200) * i
      
      // Decay
      shakeState.current.intensity = THREE.MathUtils.lerp(i, 0, dt * shakeState.current.decay)
    }

    // 7. Apply to Camera
    camera.position.set(camX + shakeX, camY + shakeY, camZ + shakeZ)
    
    // Look At Target (with slight smoothing)
    // We look at the player + a bit of velocity prediction
    const lookTarget = targetPos.clone().add(new THREE.Vector3(0, 1.5, 0))
    // Add velocity influence to look target (look where you're going)
    lookTarget.add(targetVel.clone().multiplyScalar(0.1))
    
    // Smooth lookAt to prevent micro-jitter
    if (!isInitialized.current) {
      smoothedLookTarget.current.copy(lookTarget)
      isInitialized.current = true
    } else {
      smoothedLookTarget.current.lerp(lookTarget, dt * 10)
    }
    
    camera.lookAt(smoothedLookTarget.current)
  })

  return null
})

SmartCamera.displayName = 'SmartCamera'
