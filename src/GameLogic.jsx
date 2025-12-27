import React from 'react'
import { useFrame } from '@react-three/fiber'
import { stepWorld } from './physics'

export function PhysicsHandler() {
  useFrame((_, delta) => {
    stepWorld(Math.min(delta, 0.1))
  })
  return null
}

export function GoalDetector({ ballBody, socket, playerId, remotePlayers, pitchSize }) {
  useFrame(() => {
    if (!ballBody || !socket || !playerId) return
    
    // Determine host (lowest ID)
    const allIds = [playerId, ...Object.keys(remotePlayers)].sort()
    const isHost = allIds[0] === playerId

    if (isHost) {
      const { x, z } = ballBody.position
      // Blue Goal (Top, z < -6) -> Red Scores
      if (z < -pitchSize[2]/2 - 0.5 && Math.abs(x) < 2) {
         // Reset ball immediately to prevent multiple triggers locally before server reset
         ballBody.position.set(0, 0.5, 0) 
         ballBody.velocity.set(0, 0, 0)
         socket.emit('goal', 'red')
      }
      // Red Goal (Bottom, z > 6) -> Blue Scores
      else if (z > pitchSize[2]/2 + 0.5 && Math.abs(x) < 2) {
         ballBody.position.set(0, 0.5, 0)
         ballBody.velocity.set(0, 0, 0)
         socket.emit('goal', 'blue')
      }
    }
  })
  return null
}
