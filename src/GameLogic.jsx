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
      // Goal positions are now on LEFT/RIGHT sides (X axis) at x = ±11
      const blueGoalX = -11  // Left side
      const redGoalX = 11    // Right side
      const goalHeight = 3   // Half-height of goal opening
      
      // Blue Goal (Left) -> Red Scores when ball crosses
      if (x < blueGoalX && Math.abs(z) < goalHeight) {
         ballBody.position.set(0, 2.0, 0) 
         ballBody.velocity.set(0, 0, 0)
         ballBody.angularVelocity.set(0, 0, 0)
         socket.emit('goal', 'red')
      }
      // Red Goal (Right) -> Blue Scores when ball crosses
      else if (x > redGoalX && Math.abs(z) < goalHeight) {
         ballBody.position.set(0, 2.0, 0)
         ballBody.velocity.set(0, 0, 0)
         ballBody.angularVelocity.set(0, 0, 0)
         socket.emit('goal', 'blue')
      }
    }
  })
  return null
}

