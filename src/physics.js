import * as CANNON from 'cannon-es'

// Singleton physics world
let world = null
let groundBody = null

// Materials - S-tier realistic soccer physics
const groundMaterial = new CANNON.Material('ground')
const ballMaterial = new CANNON.Material('ball')
const playerMaterial = new CANNON.Material('player')
const wallMaterial = new CANNON.Material('wall')
const postMaterial = new CANNON.Material('post') // Goal posts and crossbar

// Contact materials (S-tier realistic interactions)

// Ball vs Ground - Natural grass-like rolling
const ballGroundContact = new CANNON.ContactMaterial(ballMaterial, groundMaterial, {
  friction: 0.6,           // Reduced friction to prevent erratic spin/grip
  restitution: 0.4,        // Lower bounce for more control
  contactEquationStiffness: 1e8,
  contactEquationRelaxation: 3,
})

// Ball vs Player - Controlled dribbling feel
const ballPlayerContact = new CANNON.ContactMaterial(ballMaterial, playerMaterial, {
  friction: 0.4,           // Lower friction for smoother dribbling
  restitution: 0.35,        // Reduced bounce off player
  contactEquationStiffness: 1e7,
  contactEquationRelaxation: 3,
})

// Ball vs Wall - Realistic rebound off boards
const ballWallContact = new CANNON.ContactMaterial(ballMaterial, wallMaterial, {
  friction: 0.2,           // Smooth wall surface
  restitution: 0.4,        // Moderate bounce off walls
  contactEquationStiffness: 1e8,
  contactEquationRelaxation: 3,
})

// Ball vs Post/Crossbar - That satisfying PING sound physics
const ballPostContact = new CANNON.ContactMaterial(ballMaterial, postMaterial, {
  friction: 0.1,           // Metal is slippery
  restitution: 0.5,        // Reduced bounce to prevent flying off map
  contactEquationStiffness: 1e9, // Hard metal contact
  contactEquationRelaxation: 2,
})

export function createWorld() {
  if (world) return world

  world = new CANNON.World()
  world.gravity.set(0, -9.81, 0) // Earth gravity
  
  // S-tier broadphase for performance
  world.broadphase = new CANNON.SAPBroadphase(world)
  
  // Higher solver iterations for stable physics
  world.solver.iterations = 20
  world.solver.tolerance = 0.001
  
  // Disable sleeping for responsive ball
  world.allowSleep = false
  
  // Better default material
  world.defaultContactMaterial.friction = 0.3
  world.defaultContactMaterial.restitution = 0.3

  // Add all contact materials
  world.addContactMaterial(ballGroundContact)
  world.addContactMaterial(ballPlayerContact)
  world.addContactMaterial(ballWallContact)
  world.addContactMaterial(ballPostContact)

  // Create ground plane at pitch surface level
  const groundShape = new CANNON.Plane()
  groundBody = new CANNON.Body({
    mass: 0,
    material: groundMaterial,
    position: new CANNON.Vec3(0, 0.57, 0),
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

// Sub-stepping physics for stability - S-tier precision
const fixedTimeStep = 1 / 120   // 120 Hz physics
const maxSubSteps = 8           // More substeps for accuracy

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

// S-tier soccer ball - realistic FIFA ball physics
export function createSoccerBallBody(position = [0, 0.5, 0]) {
  const radius = 0.22              // FIFA regulation ball ~22cm diameter
  const shape = new CANNON.Sphere(radius)
  const body = new CANNON.Body({
    mass: 0.45,                    // Slightly heavier for stability
    position: new CANNON.Vec3(...position),
    material: ballMaterial,
    linearDamping: 0.9,            // Balanced damping
    angularDamping: 0.9,           // Higher damping to reduce spin
    fixedRotation: false,          // Ball can spin
  })
  
  // Limit rotation on Y axis (horizontal spinning) while allowing X/Z rolling
  body.angularFactor = new CANNON.Vec3(1, 0.2, 1)
  
  body.addShape(shape)
  
  // Better collision response
  body.collisionResponse = true
  
  return body
}

// Helper to create a player body (kinematic)
export function createPlayerBody(position = [0, 1, 0]) {
  const radius = 1 // Match visual model size
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
  const wallHeight = 10

  // Use global wallMaterial for walls (contact materials already added in createWorld)

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

  // Goals are at X = ±15 (approx), so we need gaps on LEFT and RIGHT walls
  const goalWidth = 6 // Goal opening size
  
  // TOP wall (Full width) at z = -10
  // Width 30 + 2*thickness to cover corners
  addWall(0, -pitchDepth / 2 - wallThickness / 2, pitchWidth + wallThickness * 2, wallThickness)
  
  // BOTTOM wall (Full width) at z = +10
  addWall(0, pitchDepth / 2 + wallThickness / 2, pitchWidth + wallThickness * 2, wallThickness)
  
  // Left Side Walls (with goal gap)
  const leftX = -pitchWidth / 2 - wallThickness / 2
  const rightX = pitchWidth / 2 + wallThickness / 2
  
  // Side wall length calculation:
  // Total depth 20. Goal gap 6. Remaining 14. Split 7 and 7.
  // Top segment: from z = -10 to z = -3. Center z = -6.5. Length 7.
  // Bottom segment: from z = 3 to z = 10. Center z = 6.5. Length 7.
  
  // Left Side Walls
  addWall(leftX, -6.5, wallThickness, 7) // Left Top
  addWall(leftX, 6.5, wallThickness, 7)  // Left Bottom
  
  // Right Side Walls
  addWall(rightX, -6.5, wallThickness, 7) // Right Top
  addWall(rightX, 6.5, wallThickness, 7)  // Right Bottom
  
  // Goal back walls
  const goalBackX = 13
  addWall(-goalBackX - wallThickness, 0, wallThickness, goalWidth + 2)
  addWall(goalBackX + wallThickness, 0, wallThickness, goalWidth + 2)

  // Goal Posts and Crossbars - Using postMaterial for that satisfying PING
  const crossbarHeight = 4  // FIFA regulation: 2.44m (8 ft)
  const postRadius = 0.06      // ~12cm diameter posts (FIFA standard)
  
  // Helper to add goal post (cylinder)
  const addPost = (x, z) => {
    const shape = new CANNON.Cylinder(postRadius, postRadius, crossbarHeight, 8)
    const body = new CANNON.Body({
      mass: 0,
      position: new CANNON.Vec3(x, crossbarHeight / 2, z),
      material: postMaterial
    })
    body.addShape(shape)
    world.addBody(body)
  }
  
  // Left Goal Posts (at x = -11)
  addPost(-10.8, -2.5)  // Left post
  addPost(-10.8, 2.5)   // Right post
  
  // Right Goal Posts (at x = 11)
  addPost(10.8, -2.5)   // Left post
  addPost(10.8, 2.5)    // Right post
  
  // Crossbars (horizontal bar at top of goal)
  const crossbarShape = new CANNON.Cylinder(postRadius, postRadius, goalWidth, 8)
  
  // Left Goal Crossbar
  const leftCrossbar = new CANNON.Body({
    mass: 0,
    position: new CANNON.Vec3(-10.8, crossbarHeight, 0),
    material: postMaterial
  })
  leftCrossbar.addShape(crossbarShape)
  leftCrossbar.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2)
  world.addBody(leftCrossbar)

  // Right Goal Crossbar
  const rightCrossbar = new CANNON.Body({
    mass: 0,
    position: new CANNON.Vec3(10.8, crossbarHeight, 0),
    material: postMaterial
  })
  rightCrossbar.addShape(crossbarShape)
  rightCrossbar.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2)
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
  addNetWall(11.8, 4, 0, netDepth, netSideThickness * 2, goalWidth)
  // Back
  addNetWall(13 + netSideThickness, wallHeight / 2, 0, netSideThickness * 2, wallHeight, goalWidth)

  // Left Goal Net (x < 0)
  // Sides
  addNetWall(-12, wallHeight / 2, -3 - netSideThickness, netDepth, wallHeight, netSideThickness * 2) // Top side
  addNetWall(-12, wallHeight / 2, 3 + netSideThickness, netDepth, wallHeight, netSideThickness * 2)  // Bottom side
  // Roof
  addNetWall(-11.8, 4, 0, netDepth, netSideThickness * 2, goalWidth)
  // Back
  addNetWall(-13 - netSideThickness, wallHeight / 2, 0, netSideThickness * 2, wallHeight, goalWidth)

  // Arena Roof (Invisible physics barrier to keep ball in)
  const roofShape = new CANNON.Box(new CANNON.Vec3(pitchWidth / 2, 0.1, pitchDepth / 2))
  const roofBody = new CANNON.Body({
    mass: 0,
    position: new CANNON.Vec3(0, wallHeight, 0), // At top of walls (y=5)
    material: wallMaterial
  })
  roofBody.addShape(roofShape)
  world.addBody(roofBody)

  // Custom Walls requested by user
  // position={[13, 2, -2.8]}, args={[4, 13, 0.2]}
  addNetWall(13, 2, -2.4, 4, 13, 0.2)
  // position={[-13, 2, -2.4]}, args={[4, 13, 0.2]}
  addNetWall(-13, 2, -2.4, 4, 13, 0.2)
  // position={[13, 2, 2.8]}, args={[4, 13, 0.2]}
  addNetWall(13, 2, 2.4, 4, 13, 0.2)
  // position={[-13, 2, 2.8]}, args={[4, 13, 0.2]}
  addNetWall(-13, 2, 2.4, 4, 13, 0.2)
}

