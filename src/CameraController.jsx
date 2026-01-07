import React, { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

export default function CameraController({ targetRef, isFreeLook, cameraOrbit, isMobile }) {
  const { camera } = useThree()
  const orbit = useRef({
    azimuth: 0,
    polar: Math.PI / 4,
    distance: isMobile ? 14 : 8, // Further back on mobile for better visibility
    targetDistance: isMobile ? 14 : 8,
    isLocked: false
  })

  // Pre-allocated vector for camera target
  const cameraTarget = useRef(new THREE.Vector3())

  useEffect(() => {
    if (cameraOrbit) {
      cameraOrbit.current = orbit.current
    }
  }, [cameraOrbit])

  useEffect(() => {
    const onPointerLockChange = () => {
      const isLocked = document.pointerLockElement === document.body
      orbit.current.isLocked = isLocked
    }

    const onPointerLockError = (e) => {
      orbit.current.isLocked = false
      console.warn('Pointer lock error:', e)
    }

    const onClick = (e) => {
      // Disable pointer lock on mobile
      if (isMobile) return

      // Ignore clicks on buttons, inputs, or interactive elements
      if (
        e.target.tagName === 'BUTTON' || 
        e.target.tagName === 'INPUT' || 
        e.target.closest('button') || 
        e.target.closest('.interactive-ui')
      ) {
        return
      }

      // Request lock
      if (document.pointerLockElement !== document.body) {
        try {
          const maybePromise = document.body.requestPointerLock()
          if (maybePromise && typeof maybePromise.catch === 'function') {
            maybePromise.catch((err) => {
              console.warn('Pointer lock request rejected:', err)
            })
          }
        } catch (err) {
          console.warn('Pointer lock request failed:', err)
        }
      }
    }

    const onMouseMove = (e) => {
      if (document.pointerLockElement !== document.body) return
      
      const sensitivity = 0.002
      orbit.current.azimuth -= e.movementX * sensitivity
      orbit.current.polar -= e.movementY * sensitivity
      orbit.current.polar = Math.max(0.2, Math.min(Math.PI / 2, orbit.current.polar))
    }

    const onWheel = (e) => {
      const delta = e.deltaY
      const zoomSensitivity = 0.025
      const minDistance = 3
      const maxDistance = 25 // Allowed more zoom out
      orbit.current.targetDistance = THREE.MathUtils.clamp(
        orbit.current.targetDistance + delta * zoomSensitivity, 
        minDistance, 
        maxDistance
      )
    }

    document.addEventListener('pointerlockchange', onPointerLockChange)
    document.addEventListener('pointerlockerror', onPointerLockError)
    document.body.addEventListener('click', onClick)
    document.addEventListener('mousemove', onMouseMove)
    window.addEventListener('wheel', onWheel, { passive: true })

    return () => {
      document.removeEventListener('pointerlockchange', onPointerLockChange)
      document.removeEventListener('pointerlockerror', onPointerLockError)
      document.body.removeEventListener('click', onClick)
      document.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('wheel', onWheel)
    }
  }, [isMobile])

  useFrame((_, delta) => {
    const p = (targetRef.current && targetRef.current.position) || { x: 0, y: 0, z: 0 }
    const { azimuth, polar } = orbit.current
    
    // Smooth zoom
    orbit.current.distance = THREE.MathUtils.lerp(
      orbit.current.distance, 
      orbit.current.targetDistance ?? orbit.current.distance, 
      0.1
    )
    
    const distance = orbit.current.distance
    const x = p.x + distance * Math.sin(polar) * Math.sin(azimuth)
    const y = p.y + distance * Math.cos(polar) + 2.2
    const z = p.z + distance * Math.sin(polar) * Math.cos(azimuth)
    
    // Robust position update with NaN checks
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
      cameraTarget.current.set(x, y, z)
      
      // Slightly stiffer damping for mobile to prevent "floaty" feel
      const dampSpeed = isMobile ? 20 : 15 
      
      camera.position.x = THREE.MathUtils.damp(camera.position.x, cameraTarget.current.x, dampSpeed, delta)
      camera.position.y = THREE.MathUtils.damp(camera.position.y, cameraTarget.current.y, dampSpeed, delta)
      camera.position.z = THREE.MathUtils.damp(camera.position.z, cameraTarget.current.z, dampSpeed, delta)
      
      if (Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)) {
        camera.lookAt(p.x, p.y + 1, p.z)
      }
    } else {
      console.warn('Camera NaN detected, resetting')
      camera.position.set(0, 10, 10)
      camera.lookAt(0, 0, 0)
      // Reset orbit to safe values
      orbit.current.azimuth = 0
      orbit.current.polar = Math.PI / 4
      orbit.current.distance = 10
    }
  }, 1) // Priority 1

  return null
}
