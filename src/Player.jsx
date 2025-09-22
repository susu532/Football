import React, { forwardRef, useRef, useImperativeHandle, useEffect } from 'react'
import { useFrame, useThree, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import normalSoft from './assets/normal-soft.jpg'

const Player = forwardRef(function Player({ position = [0, 1, 0], platforms = [], obstacles = [], appearance = 'real' }, ref) {
  const meshRef = useRef()
  const velocity = useRef(new THREE.Vector3())
  const onGround = useRef(false)

  // Expose position ref for camera controller
  useImperativeHandle(ref, () => ({
    get position() {
      return meshRef.current ? meshRef.current.position : new THREE.Vector3()
    },
  }))

  // Keyboard state
  const keys = useRef({ forward: false, backward: false, left: false, right: false, jump: false })

  // Camera reference for direction
  const { camera } = useThree()

  // Eye refs for pupil tracking
  const leftPupilRef = useRef()
  const rightPupilRef = useRef()
  // Normal map for fur (used in 'real' appearance)
  const normalMap = useLoader(THREE.TextureLoader, normalSoft)

  useEffect(() => {
    const down = (e) => {
      // QWERTY: W/S/A/D, AZERTY: Z/S/Q/D
      const k = e.key.toLowerCase()
      if (e.code === 'ArrowLeft' || k === 'a' || k === 'q') keys.current.left = true
      if (e.code === 'ArrowRight' || k === 'd') keys.current.right = true
      if (e.code === 'ArrowUp' || k === 'w' || k === 'z') keys.current.forward = true
      if (e.code === 'ArrowDown' || k === 's') keys.current.backward = true
      if (e.code === 'Space') keys.current.jump = true
    }
    const up = (e) => {
      const k = e.key.toLowerCase()
      if (e.code === 'ArrowLeft' || k === 'a' || k === 'q') keys.current.left = false
      if (e.code === 'ArrowRight' || k === 'd') keys.current.right = false
      if (e.code === 'ArrowUp' || k === 'w' || k === 'z') keys.current.forward = false
      if (e.code === 'ArrowDown' || k === 's') keys.current.backward = false
      if (e.code === 'Space') keys.current.jump = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  useFrame((_, delta) => {
    if (!meshRef.current) return

  // --- Pupil tracking: compute small pupil offsets so the eyes follow the camera ---
    try {
      if (leftPupilRef.current && rightPupilRef.current && camera) {
        // camera position in world space
        const camWorld = new THREE.Vector3()
        camera.getWorldPosition(camWorld)

        // Invert player's world matrix to convert world coords into player-local coords
        const invPlayer = new THREE.Matrix4().copy(meshRef.current.matrixWorld).invert()
        const camLocal = camWorld.clone().applyMatrix4(invPlayer)

        // Eye local positions (matches the group positions used when building the eyes)
        const leftEyeLocal = new THREE.Vector3(-0.12, 0.88, 0.32)
        const rightEyeLocal = new THREE.Vector3(0.12, 0.88, 0.32)

        // Compute direction from eye to camera in player-local space
        const dirLeft = camLocal.clone().sub(leftEyeLocal)
        const dirRight = camLocal.clone().sub(rightEyeLocal)

        // Normalize and map to small pupil offset range (x horizontal, y vertical)
        dirLeft.normalize()
        dirRight.normalize()

        const maxOffset = 0.018 // max pupil offset in local units
        // Map world/local directions to pupil offsets
        const targetLeftX = THREE.MathUtils.clamp(dirLeft.x * maxOffset, -maxOffset, maxOffset)
        const targetLeftY = THREE.MathUtils.clamp(dirLeft.y * maxOffset * 0.6, -maxOffset, maxOffset)
        const targetRightX = THREE.MathUtils.clamp(dirRight.x * maxOffset, -maxOffset, maxOffset)
        const targetRightY = THREE.MathUtils.clamp(dirRight.y * maxOffset * 0.6, -maxOffset, maxOffset)

        // Smoothly lerp pupil positions for a cute follow effect
        leftPupilRef.current.position.x = THREE.MathUtils.lerp(leftPupilRef.current.position.x, targetLeftX, 0.2)
        leftPupilRef.current.position.y = THREE.MathUtils.lerp(leftPupilRef.current.position.y, targetLeftY, 0.2)
        rightPupilRef.current.position.x = THREE.MathUtils.lerp(rightPupilRef.current.position.x, targetRightX, 0.2)
        rightPupilRef.current.position.y = THREE.MathUtils.lerp(rightPupilRef.current.position.y, targetRightY, 0.2)
      }
    } catch (e) {
      // keep robust: ignore any runtime math errors in tracking
    }


    // Movement direction relative to camera
    const speed = 6
    let moveX = 0, moveZ = 0
    if (keys.current.forward) moveZ += 1
    if (keys.current.backward) moveZ -= 1
    if (keys.current.left) moveX -= 1
    if (keys.current.right) moveX += 1
    let moveVec = new THREE.Vector3(moveX, 0, moveZ)
    if (moveVec.length() > 0) {
      moveVec.normalize()
      
      // Get camera's forward and right vectors (ignoring Y component for ground movement)
      const cameraForward = new THREE.Vector3()
      camera.getWorldDirection(cameraForward)
      cameraForward.y = 0 // Keep movement on ground plane
      cameraForward.normalize()
      
      const cameraRight = new THREE.Vector3()
      cameraRight.crossVectors(cameraForward, new THREE.Vector3(0, 1, 0))
      cameraRight.normalize()
      
      // Apply movement relative to camera direction
      const finalMoveVec = new THREE.Vector3()
      finalMoveVec.addScaledVector(cameraForward, moveVec.z)
      finalMoveVec.addScaledVector(cameraRight, moveVec.x)
      moveVec = finalMoveVec
    }
    // Smooth velocity with friction
    const friction = onGround.current ? 0.3 : 0.1
    velocity.current.x = THREE.MathUtils.lerp(velocity.current.x, moveVec.x * speed, friction)
    velocity.current.z = THREE.MathUtils.lerp(velocity.current.z, moveVec.z * speed, friction)

    // Face direction of movement if moving
    if (moveVec.length() > 0.1) {
      meshRef.current.rotation.y = Math.atan2(moveVec.x, moveVec.z)
    }

    // Gravity
    velocity.current.y -= 28 * delta
    // Clamp fall speed
    velocity.current.y = Math.max(velocity.current.y, -30)

    // Jump (snappier)
    if (keys.current.jump && onGround.current) {
      velocity.current.y = 10
      onGround.current = false
    }

    // Apply velocity
    meshRef.current.position.x += velocity.current.x * delta
    meshRef.current.position.y += velocity.current.y * delta
    meshRef.current.position.z += velocity.current.z * delta

    // Platform collision detection (AABB, now 3D, improved)
    onGround.current = false
    const px = meshRef.current.position
    let standingOnPlatform = null
    for (let i = 0; i < platforms.length; i++) {
      const p = platforms[i]
      const half = { x: p.size[0] / 2, y: p.size[1] / 2, z: p.size[2] / 2 }
      const minX = p.position[0] - half.x
      const maxX = p.position[0] + half.x
      const minZ = p.position[2] - half.z
      const maxZ = p.position[2] + half.z
      const topY = p.position[1] + half.y
      const groundY = topY
      
      // check if player is above platform and within X/Z range
      if (
        px.x > minX - 0.45 && px.x < maxX + 0.45 &&
        px.z > minZ - 0.45 && px.z < maxZ + 0.45
      ) {
        // if we fell below the platform top, snap to it
        if (px.y <= groundY + 0.01 && px.y >= groundY - 1.2) {
          px.y = groundY
          velocity.current.y = 0
          onGround.current = true
          standingOnPlatform = p
        }
      }
    }
    
    // Move with moving platform if standing on it
    if (standingOnPlatform && standingOnPlatform.prevY !== undefined) {
      const dy = standingOnPlatform.position[1] - standingOnPlatform.prevY
      px.y += dy
    }
    
    // Handle moving platforms (X and Z movement)
    if (standingOnPlatform && standingOnPlatform.isMoving) {
      if (standingOnPlatform.prevX !== undefined) {
        const dx = standingOnPlatform.position[0] - standingOnPlatform.prevX
        const dz = standingOnPlatform.position[2] - standingOnPlatform.prevZ
        px.x += dx
        px.z += dz
      }
    }
    
    // Save previous positions for moving platforms
    platforms.forEach((p) => {
      p.prevX = p.position[0]
      p.prevY = p.position[1]
      p.prevZ = p.position[2]
    })

    // Obstacle collision detection (prevent moving through objects)
    const playerRadius = 0.45
    const playerHeight = 1.0
    
    for (let i = 0; i < obstacles.length; i++) {
      const obstacle = obstacles[i]
      const half = { x: obstacle.size[0] / 2, y: obstacle.size[1] / 2, z: obstacle.size[2] / 2 }
      
      // Check if player is within obstacle bounds
      const minX = obstacle.position[0] - half.x - playerRadius
      const maxX = obstacle.position[0] + half.x + playerRadius
      const minZ = obstacle.position[2] - half.z - playerRadius
      const maxZ = obstacle.position[2] + half.z + playerRadius
      const minY = obstacle.position[1] - half.y
      const maxY = obstacle.position[1] + half.y
      
      // Check if player is colliding with obstacle
      if (
        px.x > minX && px.x < maxX &&
        px.z > minZ && px.z < maxZ &&
        px.y + playerHeight > minY && px.y < maxY
      ) {
        // Calculate push direction
        const centerX = obstacle.position[0]
        const centerZ = obstacle.position[2]
        const dx = px.x - centerX
        const dz = px.z - centerZ
        
        // Push player away from obstacle
        if (Math.abs(dx) > Math.abs(dz)) {
          // Push along X axis
          if (dx > 0) {
            px.x = centerX + half.x + playerRadius
          } else {
            px.x = centerX - half.x - playerRadius
          }
          velocity.current.x = 0
        } else {
          // Push along Z axis
          if (dz > 0) {
            px.z = centerZ + half.z + playerRadius
          } else {
            px.z = centerZ - half.z - playerRadius
          }
          velocity.current.z = 0
        }
      }
    }

    // Prevent falling through the large ground plane at y=0 (base)
    if (px.y < 0) {
      px.y = 0
      velocity.current.y = 0
      onGround.current = true
    }
  })

  return (
    <group ref={meshRef} position={[position[0], position[1] + 0.18, position[2]]} castShadow>
      {appearance === 'real' ? (
        // Realistic cat: more natural proportions, fur material, vertical pupils
        <>
          {/* Soft shadow */}
          <mesh position={[0, -0.18, 0]} rotation={[-Math.PI/2, 0, 0]} scale={[0.6, 0.6, 1]}>
            <circleGeometry args={[1.2, 24]} />
            <meshBasicMaterial color="#000" opacity={0.18} transparent />
          </mesh>
          {/* Body: elongated ellipsoid */}
          <mesh position={[0, 0.08, 0]} scale={[0.5, 0.32, 0.28]} castShadow>
            <sphereGeometry args={[1, 32, 32]} />
            <meshStandardMaterial color="#c8b79a" normalMap={normalMap} roughness={0.7} metalness={0.05} />
          </mesh>
          {/* Head: realistic proportion */}
          <mesh position={[0, 0.6, 0.02]} scale={[0.42, 0.42, 0.38]} castShadow>
            <sphereGeometry args={[1, 32, 32]} />
            <meshStandardMaterial color="#d6c2a1" normalMap={normalMap} roughness={0.6} metalness={0.02} />
          </mesh>
          {/* Ears: pointed, inner pink */}
          <mesh position={[-0.18, 0.95, 0]} rotation={[0, 0, -0.2]} scale={[0.9, 0.9, 0.9]} castShadow>
            <coneGeometry args={[0.09, 0.22, 20]} />
            <meshStandardMaterial color="#d6b39a" />
          </mesh>
          <mesh position={[0.18, 0.95, 0]} rotation={[0, 0, 0.2]} scale={[0.9, 0.9, 0.9]} castShadow>
            <coneGeometry args={[0.09, 0.22, 20]} />
            <meshStandardMaterial color="#d6b39a" />
          </mesh>
          {/* Eyes: sclera + iris + vertical slit pupil */}
          <group position={[-0.12, 0.82, 0.08]}> 
            <mesh scale={[0.105, 0.06, 0.01]}> <sphereGeometry args={[1, 16, 16]} /><meshStandardMaterial color="#f6f6f6" /></mesh>
            <mesh position={[0, 0, 0.01]} scale={[0.06, 0.035, 0.01]}> <circleGeometry args={[1, 32]} /><meshStandardMaterial color="#7b5a35" /></mesh>
            <mesh ref={leftPupilRef} position={[0, 0, 0.012]} scale={[0.01, 0.035, 0.01]}> <boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#000" /></mesh>
          </group>
          <group position={[0.12, 0.82, 0.08]}> 
            <mesh scale={[0.105, 0.06, 0.01]}> <sphereGeometry args={[1, 16, 16]} /><meshStandardMaterial color="#f6f6f6" /></mesh>
            <mesh position={[0, 0, 0.01]} scale={[0.06, 0.035, 0.01]}> <circleGeometry args={[1, 32]} /><meshStandardMaterial color="#7b5a35" /></mesh>
            <mesh ref={rightPupilRef} position={[0, 0, 0.012]} scale={[0.01, 0.035, 0.01]}> <boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#000" /></mesh>
          </group>
          {/* Nose and mouth (subtle) */}
          <mesh position={[0, 0.75, 0.14]} scale={[0.04, 0.025, 0.01]}> <sphereGeometry args={[1, 8, 8]} /><meshStandardMaterial color="#e48aa4" /></mesh>
          {/* Whiskers: thin lines */}
          <mesh position={[0.12, 0.74, 0.14]} rotation={[0, 0, -0.05]}> <boxGeometry args={[0.22, 0.002, 0.002]} /><meshStandardMaterial color="#ddd" /></mesh>
          <mesh position={[-0.12, 0.74, 0.14]} rotation={[0, 0, 0.05]}> <boxGeometry args={[0.22, 0.002, 0.002]} /><meshStandardMaterial color="#ddd" /></mesh>
          {/* Tail: longer, tapered */}
          <mesh position={[0, 0.18, -0.5]} rotation={[1.2, 0, 0.5]} scale={[0.06, 0.6, 0.06]} castShadow>
            <cylinderGeometry args={[1, 0.6, 1, 12]} />
            <meshStandardMaterial color="#c8b79a" normalMap={normalMap} roughness={0.75} />
          </mesh>
        </>
      ) : (
        // Fallback: chibi style (unchanged)
        <>
          {/* Soft shadow under cat */}
          <mesh position={[0, -0.18, 0]} rotation={[-Math.PI/2, 0, 0]} scale={[0.45, 0.45, 1]}>
            <circleGeometry args={[1, 20]} />
            <meshBasicMaterial color="#f8bbd0" opacity={0.18} transparent />
          </mesh>
          {/* Chibi Body: small, round */}
          <mesh position={[0, 0.22, 0]} scale={[0.38, 0.28, 0.38]} castShadow>
            <sphereGeometry args={[1, 18, 18]} />
            <meshPhysicalMaterial color="#f8bbd0" iridescence={0.18} iridescenceIOR={1.2} />
          </mesh>
          {/* Collar with bell */}
          <mesh position={[0, 0.36, 0]} scale={[1.08, 1.08, 1.08]}>
            <torusGeometry args={[0.19, 0.025, 8, 16]} />
            <meshStandardMaterial color="#ba68c8" />
          </mesh>
          <mesh position={[0, 0.32, 0.18]} scale={[0.08, 0.08, 0.08]}>
            <sphereGeometry args={[1, 10, 10]} />
            <meshStandardMaterial color="#fff59d" />
          </mesh>
          {/* ...existing chibi geometry (legs, head, eyes, nose, mouth, whiskers, tail) ... */}
        </>
      )}
    </group>
  )
})

export default Player


