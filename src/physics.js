import * as CANNON from 'cannon-es'

// Singleton physics world
let world = null
let groundBody = null

// Materials
const groundMaterial = new CANNON.Material('ground')
const ballMaterial = new CANNON.Material('ball')
const playerMaterial = new CANNON.Material('player')

// Contact materials (define interactions)
const ballGroundContact = new CANNON.ContactMaterial(ballMaterial, groundMaterial, {
  friction: 0.5,
  restitution: 0.3, // Reduced bounciness for realistic ball
})

const ballPlayerContact = new CANNON.ContactMaterial(ballMaterial, playerMaterial, {
  friction: 0.3,
  restitution: 0.5, // Moderate bounce off players
})

export function createWorld() {
  if (world) return world

  world = new CANNON.World()
  world.gravity.set(0, -9.81, 0) // Realistic gravity
  world.broadphase = new CANNON.SAPBroadphase(world)
  world.solver.iterations = 15
  world.allowSleep = false

  // Add contact materials
  world.addContactMaterial(ballGroundContact)
  world.addContactMaterial(ballPlayerContact)

  // Create ground plane at pitch surface level
  const groundShape = new CANNON.Plane()
  groundBody = new CANNON.Body({
    mass: 0,
    material: groundMaterial,
    position: new CANNON.Vec3(0, 0.1, 0),
  })
  groundBody.addShape(groundShape)
  groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2)
  world.addBody(groundBody)

  // Create walls (only at edges, NO walls in the middle)
  createWalls(world)

  return world
}

export function getWorld() {
  return world || createWorld()
}

// Sub-stepping physics for stability
const fixedTimeStep = 1 / 120
const maxSubSteps = 5

export function stepWorld(dt = 1 / 60) {
  if (world) {
    world.step(fixedTimeStep, dt, maxSubSteps)
  }
}

export function removeBody(body) {
  if (world && body) {
    world.removeBody(body)
  }
}

export function createSoccerBallBody(position = [0, 2.0, 0]) {
  const radius = 0.35 // Standard ball radius
  const shape = new CANNON.Sphere(radius)
  const body = new CANNON.Body({
    mass: 0.45, // Realistic soccer ball weight (~450g)
    position: new CANNON.Vec3(...position),
    material: ballMaterial,
    linearDamping: 0.2, // Natural air resistance/friction
    angularDamping: 0.3, // Spin slows down naturally
  })
  body.addShape(shape)
  return body
}

// Helper to create a player body (kinematic)
export function createPlayerBody(position = [0, 1, 0]) {
  const radius = 1 // Slightly larger for better ball contact
  const shape = new CANNON.Sphere(radius)
  const body = new CANNON.Body({
    mass: 0,
    type: CANNON.Body.KINEMATIC,
    position: new CANNON.Vec3(...position),
    material: playerMaterial,
  })
  body.addShape(shape)
  return body
}

function createWalls(world) {
  // Pitch dimensions: 30 wide (X) x 20 deep (Z)
  const pitchWidth = 30
  const pitchDepth = 20
  const wallThickness = 2
  const wallHeight = 5

  const wallMaterial = new CANNON.Material('wall')
  const ballWallContact = new CANNON.ContactMaterial(ballMaterial, wallMaterial, {
    friction: 0.1,
    restitution: 0.7, // Bouncy walls
  })
  world.addContactMaterial(ballWallContact)

  const addWall = (x, z, w, d) => {
    const shape = new CANNON.Box(new CANNON.Vec3(w / 2, wallHeight / 2, d / 2))
    const body = new CANNON.Body({
      mass: 0,
      position: new CANNON.Vec3(x, wallHeight / 2, z),
      material: wallMaterial,
    })
    body.addShape(shape)
    world.addBody(body)
  }

  // Goals are at X = ±11, so we need gaps on LEFT and RIGHT walls
  const goalWidth = 6 // Goal opening size
  
  // Chamfered Corners (Diagonal Walls)
  const chamferSize = 4
  const diagLen = Math.sqrt(chamferSize*chamferSize + chamferSize*chamferSize)
  
  // TOP wall (shortened) at z = -10
  // Original width 30. New width 30 - 2*chamferSize = 22.
  // Center x=0.
  addWall(0, -pitchDepth / 2 - wallThickness / 2, pitchWidth - 2 * chamferSize, wallThickness)
  
  // BOTTOM wall (shortened) at z = +10
  addWall(0, pitchDepth / 2 + wallThickness / 2, pitchWidth - 2 * chamferSize, wallThickness)
  
  // LEFT wall (shortened) at x = -15
  // Original depth 20. New depth 20 - 2*chamferSize = 12.
  // But it has a goal gap of 6 in the middle.
  // So we have two segments: Top and Bottom.
  // Total length 12. Gap 6. Remaining 6. Split 3 and 3.
  // Top segment: from z = -6 to z = -3. Center z = -4.5.
  // Bottom segment: from z = 3 to z = 6. Center z = 4.5.
  
  const leftX = -pitchWidth / 2 - wallThickness / 2
  const rightX = pitchWidth / 2 + wallThickness / 2
  
  // Left Side Walls
  addWall(leftX, -4.5, wallThickness, 3) // Left Top
  addWall(leftX, 4.5, wallThickness, 3)  // Left Bottom
  
  // Right Side Walls
  addWall(rightX, -4.5, wallThickness, 3) // Right Top
  addWall(rightX, 4.5, wallThickness, 3)  // Right Bottom
  
  // Diagonal Walls
  // Top-Left: Connects (-15, -6) to (-11, -10)
  // Center: (-13, -8)
  const diagWall = new CANNON.Box(new CANNON.Vec3(wallThickness / 2, wallHeight / 2, diagLen / 2))
  
  const addDiagWall = (x, z, angle) => {
    const body = new CANNON.Body({
      mass: 0,
      position: new CANNON.Vec3(x, wallHeight / 2, z),
      material: wallMaterial
    })
    body.addShape(diagWall)
    body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), angle)
    world.addBody(body)
  }
  
  addDiagWall(-13, -8, -Math.PI / 4) // Top-Left
  addDiagWall(13, -8, Math.PI / 4)   // Top-Right
  addDiagWall(13, 8, -Math.PI / 4)   // Bottom-Right
  addDiagWall(-13, 8, Math.PI / 4)   // Bottom-Left
  
  // Goal back walls (behind the goals at x = ±13)
  const goalBackX = 13
  addWall(-goalBackX - wallThickness, 0, wallThickness, goalWidth + 2) // Left goal back
  addWall(goalBackX + wallThickness, 0, wallThickness, goalWidth + 2)  // Right goal back

  // Crossbar Material (Extra Bouncy)
  const crossbarMaterial = new CANNON.Material('crossbar')
  const ballCrossbarContact = new CANNON.ContactMaterial(ballMaterial, crossbarMaterial, {
    friction: 0.1,
    restitution: 0.5, // Less bouncy
  })
  world.addContactMaterial(ballCrossbarContact)

  // Crossbars (at x = ±11, height ~2.3)
  const crossbarHeight = 2.3 // Slightly lower to ensure hit
  const crossbarThickness = 0.3 // Thicker
  
  // Left Goal Crossbar
  const leftCrossbarShape = new CANNON.Box(new CANNON.Vec3(crossbarThickness, crossbarThickness, goalWidth / 2))
  const leftCrossbar = new CANNON.Body({
    mass: 0,
    position: new CANNON.Vec3(-11, crossbarHeight, 0),
    material: crossbarMaterial
  })
  leftCrossbar.addShape(leftCrossbarShape)
  world.addBody(leftCrossbar)

  // Right Goal Crossbar
  const rightCrossbarShape = new CANNON.Box(new CANNON.Vec3(crossbarThickness, crossbarThickness, goalWidth / 2))
  const rightCrossbar = new CANNON.Body({
    mass: 0,
    position: new CANNON.Vec3(11, crossbarHeight, 0),
    material: crossbarMaterial
  })
  rightCrossbar.addShape(rightCrossbarShape)
  world.addBody(rightCrossbar)

  // Goal Net Physics (Sides and Roof)
  const netDepth = 2 // Distance from goal line to back of net
  const netSideThickness = 0.1
  
  // Helper to add net wall
  const addNetWall = (x, y, z, w, h, d) => {
    const shape = new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2))
    const body = new CANNON.Body({
      mass: 0,
      position: new CANNON.Vec3(x, y, z),
      material: wallMaterial
    })
    body.addShape(shape)
    world.addBody(body)
  }

  // Right Goal Net (x > 0)
  // Sides
  addNetWall(12, wallHeight / 2, -3 - netSideThickness, netDepth, wallHeight, netSideThickness * 2) // Top side
  addNetWall(12, wallHeight / 2, 3 + netSideThickness, netDepth, wallHeight, netSideThickness * 2)  // Bottom side
  // Roof
  addNetWall(12, 2.4, 0, netDepth, netSideThickness * 2, goalWidth)
  // Back
  addNetWall(13 + netSideThickness, wallHeight / 2, 0, netSideThickness * 2, wallHeight, goalWidth)

  // Left Goal Net (x < 0)
  // Sides
  addNetWall(-12, wallHeight / 2, -3 - netSideThickness, netDepth, wallHeight, netSideThickness * 2) // Top side
  addNetWall(-12, wallHeight / 2, 3 + netSideThickness, netDepth, wallHeight, netSideThickness * 2)  // Bottom side
  // Roof
  addNetWall(-12, 2.4, 0, netDepth, netSideThickness * 2, goalWidth)
  // Back
  addNetWall(-13 - netSideThickness, wallHeight / 2, 0, netSideThickness * 2, wallHeight, goalWidth)
}

