import React, { forwardRef, useRef, useImperativeHandle, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGLTF, useAnimations } from '@react-three/drei'

const PlayerModel = forwardRef(function PlayerModel({ position = [0, 1, 0], platforms = [], obstacles = [], children }, ref) {
  // load GLTF; if missing the hook will throw — catch it above before rendering PlayerModel
  const gltf = useGLTF('/models/player.glb')
  const modelRef = useRef()
  const rigRef = useRef()
  const { actions } = useAnimations(gltf.animations, rigRef)
  const velocity = useRef(new THREE.Vector3())
  const onGround = useRef(false)

  useImperativeHandle(ref, () => ({
    get position() {
      return modelRef.current ? modelRef.current.position : new THREE.Vector3()
    },
  }))

  // keyboard
  const keys = useRef({ left: false, right: false, jump: false })
  useEffect(() => {
    const down = (e) => {
      if (e.code === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.current.left = true
      if (e.code === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.current.right = true
      if (e.code === 'Space') keys.current.jump = true
    }
    const up = (e) => {
      if (e.code === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.current.left = false
      if (e.code === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.current.right = false
      if (e.code === 'Space') keys.current.jump = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  useEffect(() => {
    if (!actions) return
    if (actions.idle) actions.idle.play()
  }, [actions])

  useFrame((_, delta) => {
    if (!modelRef.current) return
    const speed = 6
    const dir = (keys.current.right ? 1 : 0) - (keys.current.left ? 1 : 0)
    modelRef.current.rotation.y = dir ? -dir * 0.2 : modelRef.current.rotation.y * 0.9
    velocity.current.x = THREE.MathUtils.lerp(velocity.current.x, dir * speed, 0.2)
    velocity.current.y -= 20 * delta
    if (keys.current.jump && onGround.current) {
      velocity.current.y = 8
      onGround.current = false
      if (actions && actions.jump) actions.jump.reset().play()
    }
    modelRef.current.position.x += velocity.current.x * delta
    modelRef.current.position.y += velocity.current.y * delta

    // collision
    onGround.current = false
    const px = modelRef.current.position
    for (let i = 0; i < platforms.length; i++) {
      const p = platforms[i]
      const half = { x: p.size[0] / 2, y: p.size[1] / 2 }
      const minX = p.position[0] - half.x
      const maxX = p.position[0] + half.x
      const topY = p.position[1] + half.y
      const groundY = topY
      if (px.x > minX - 0.5 && px.x < maxX + 0.5) {
        if (px.y <= groundY + 0.01 && px.y >= groundY - 2) {
          px.y = groundY
          velocity.current.y = 0
          onGround.current = true
        }
      }
    }
    
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
    
    if (px.y < 0) {
      px.y = 0
      velocity.current.y = 0
      onGround.current = true
    }

    if (actions) {
      if (dir !== 0 && onGround.current) {
        if (actions.run && !actions.run.isRunning()) actions.run.play()
        if (actions.idle && actions.idle.isRunning()) actions.idle.stop()
      } else {
        if (actions.idle && !actions.idle.isRunning()) actions.idle.play()
        if (actions.run && actions.run.isRunning()) actions.run.stop()
      }
    }
  })

  return (
    <primitive ref={modelRef} object={gltf.scene} position={position} castShadow>{children}</primitive>
  )
})

export default PlayerModel
