import React, { useRef, useEffect, useImperativeHandle, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PHYSICS } from './PhysicsConstants'

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

  // Velocity Smoothing State
  const smoothedVelocity = useRef(new THREE.Vector3())

  // Shake State
  const shakeState = useRef({
    intensity: 0,
    decay: 8, // Faster decay (5 -> 8)
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
        camera.position.set(x, y + 5, z + 10)
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
               // Handle promise rejection for modern browsers
        const promise = document.body.requestPointerLock()
        if (promise && promise.catch) {
          promise.catch(err => {
            // Suppress the error if it's just the user exiting or spamming click
            // console.warn('Pointer lock failed:', err)
          })
        }
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
    // Add "Look Ahead" based on SMOOTHED velocity
    smoothedVelocity.current.lerp(targetVel, dt * 5) // Smooth out micro-jitters
    const lookAhead = smoothedVelocity.current.clone().multiplyScalar(0.3)
    lookAhead.y = 0 // Don't look ahead vertically
    
    // Clamp look-ahead to prevent motion sickness glitches
    lookAhead.clampLength(0, 5.0)
    
    const { azimuth, polar, distance } = orbit.current
    
    // Calculate offset from orbit
    const offsetX = distance * Math.sin(polar) * Math.sin(azimuth)
    const offsetY = distance * Math.cos(polar)
    const offsetZ = distance * Math.sin(polar) * Math.cos(azimuth)

    const idealX = targetPos.x + offsetX + lookAhead.x
    const idealY = targetPos.y + offsetY + 2.0 // Look slightly above player
    const idealZ = targetPos.z + offsetZ + lookAhead.z

    // 3. Update Position with Damp (Replaced Springs)
    const posLambda = 8 // Balanced (was 6)
    const camX = THREE.MathUtils.damp(camera.position.x, idealX, posLambda, dt)
    const camY = THREE.MathUtils.damp(camera.position.y, idealY, posLambda, dt)
    const camZ = THREE.MathUtils.damp(camera.position.z, idealZ, posLambda, dt)

    // 4. Camera Shake
    let shakeX = 0, shakeY = 0, shakeZ = 0
    if (shakeState.current.intensity > 0.01) {
      shakeState.current.time += dt
      const t = shakeState.current.time
      const i = shakeState.current.intensity
      
      shakeX = noise(t) * i * 0.7 // Scale down vibration
      shakeY = noise(t + 100) * i * 0.7
      shakeZ = noise(t + 200) * i * 0.7
      
      // Decay
      shakeState.current.intensity = THREE.MathUtils.lerp(i, 0, dt * shakeState.current.decay)
    }

    // 5. Apply to Camera
    camera.position.set(camX + shakeX, camY + shakeY, camZ + shakeZ)
    
    // Look At Target (with slight smoothing)
    const lookTarget = targetPos.clone().add(new THREE.Vector3(0, 1.5, 0))
    lookTarget.add(targetVel.clone().multiplyScalar(0.1))
    
    camera.lookAt(lookTarget)
  })

  return null
})

SmartCamera.displayName = 'SmartCamera'
