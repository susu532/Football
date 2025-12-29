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
      const { x, y, z } = ballBody.position
      // Goal positions are now on LEFT/RIGHT sides (X axis) at x = ±11
      const blueGoalX = -11.2  // Left side (deeper in net)
      const redGoalX = 11.2    // Right side (deeper in net)
      const goalWidth = 2.2   // Narrower detection width (Z axis)
      const goalHeightLimit = 4 // Crossbar height limit
      
      // Blue Goal (Left) -> Red Scores when ball crosses
      if (x < blueGoalX && Math.abs(z) < goalWidth && y < goalHeightLimit) {
         ballBody.position.set(0, 2.0, 0) 
         ballBody.velocity.set(0, 0, 0)
         ballBody.angularVelocity.set(0, 0, 0)
         socket.emit('goal', 'red')
      }
      // Red Goal (Right) -> Blue Scores when ball crosses
      else if (x > redGoalX && Math.abs(z) < goalWidth && y < goalHeightLimit) {
         ballBody.position.set(0, 2.0, 0)
         ballBody.velocity.set(0, 0, 0)
         ballBody.angularVelocity.set(0, 0, 0)
         socket.emit('goal', 'blue')
      }
    }
  })
  
  // Visual Debug Boxes for Goal Detection
  return (
    <group>
      {/* Blue Goal Detection Zone (Left) */}
      <mesh position={[-12.5, 1.5, 0]}>
        <boxGeometry args={[0.2, 4, 4.6]} />
        <meshBasicMaterial  transparent opacity={0} />
      </mesh>
      
      {/* Red Goal Detection Zone (Right) */}
      <mesh position={[12.5, 1.5, 0]}>
        <boxGeometry args={[0.2, 4, 4.6]} />
        <meshBasicMaterial  transparent opacity={0} />
      </mesh>
    </group>
  )
}

