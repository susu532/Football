import React from 'react'
import { useFrame } from '@react-three/fiber'
import { stepWorld } from './physics'

export function PhysicsHandler() {
  useFrame((_, delta) => {
    stepWorld(Math.min(delta, 0.1))
  })
  return null
}

export function GoalDetector({ ballBody, socket, playerId, remotePlayers, ballAuthority, pitchSize }) {
  useFrame(() => {
    if (!ballBody || !socket || !playerId) return

    // Determine if we have ball authority
    const hasAuthority = ballAuthority === playerId

    if (hasAuthority) {
      const { x, y, z } = ballBody.position
      // Goal positions are now on LEFT/RIGHT sides (X axis) at x = ±11
      const blueGoalX = -11.2  // Left side (deeper in net)
      const redGoalX = 11.2    // Right side (deeper in net)
      const goalWidth = 2.2   // Narrower detection width (Z axis)
      const goalHeightLimit = 4 // Crossbar height limit
      
      // Blue Goal (Left) -> Blue Scores when ball crosses (Wait, if ball enters Left Goal, it means Red attacked there? No.)
      // Standard Soccer: Teams switch sides.
      // Let's assume:
      // Red Team starts on Left (-6), defends Left Goal (-11).
      // Blue Team starts on Right (6), defends Right Goal (11).
      // If ball enters Left Goal (-11), it means Blue scored (or Red own goal).
      // If ball enters Right Goal (11), it means Red scored (or Blue own goal).
      
      // Previous logic: x < blueGoalX (-11) -> 'red' scored. (Correct if Red is attacking Left)
      // User says "score adding to wrong team".
      // So if ball goes into Left Goal (-11), it should be BLUE score.
      
      if (x < blueGoalX && Math.abs(z) < goalWidth && y < goalHeightLimit) {
         ballBody.position.set(0, 2.0, 0) 
         ballBody.velocity.set(0, 0, 0)
         ballBody.angularVelocity.set(0, 0, 0)
         socket.emit('goal', 'blue') // Swapped to blue
      }
      // Red Goal (Right) -> Red Scores when ball crosses
      else if (x > redGoalX && Math.abs(z) < goalWidth && y < goalHeightLimit) {
         ballBody.position.set(0, 2.0, 0)
         ballBody.velocity.set(0, 0, 0)
         ballBody.angularVelocity.set(0, 0, 0)
         socket.emit('goal', 'red') // Swapped to red
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

