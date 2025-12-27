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
      // Goal positions match Scene.jsx: 
      // Blue goal at z = -pitchSize[2]/2 + 0.7 = -6.3
      // Red goal at z = pitchSize[2]/2 - 0.7 = 6.3
      const blueGoalZ = -pitchSize[2] / 2 + 0.7 // -6.3
      const redGoalZ = pitchSize[2] / 2 - 0.7   // 6.3
      const goalWidth = 2 // Half-width of the goal (goal is 4 units wide)
      
      // Blue Goal (Top) -> Red Scores when ball crosses the goal line
      if (z < blueGoalZ && Math.abs(x) < goalWidth) {
         // Reset ball immediately to prevent multiple triggers
         ballBody.position.set(0, 0.5, 0) 
         ballBody.velocity.set(0, 0, 0)
         ballBody.angularVelocity.set(0, 0, 0)
         socket.emit('goal', 'red')
      }
      // Red Goal (Bottom) -> Blue Scores when ball crosses the goal line
      else if (z > redGoalZ && Math.abs(x) < goalWidth) {
         ballBody.position.set(0, 0.5, 0)
         ballBody.velocity.set(0, 0, 0)
         ballBody.angularVelocity.set(0, 0, 0)
         socket.emit('goal', 'blue')
      }
    }
  })
  return null
}
