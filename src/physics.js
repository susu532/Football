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
  friction: 0.4,
  restitution: 0.6, // Bouncy ball
})

const ballPlayerContact = new CANNON.ContactMaterial(ballMaterial, playerMaterial, {
  friction: 0.1,
  restitution: 3, // Strong kick response - ball bounces off player powerfully
})

export function createWorld() {
  if (world) return world

  world = new CANNON.World()
  world.gravity.set(0, -12, 0) // Lighter gravity for floatier ball
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
  const radius = 0.35 // Slightly larger ball
  const shape = new CANNON.Sphere(radius)
  const body = new CANNON.Body({
    mass: 0.08, // Very light ball - easy to kick
    position: new CANNON.Vec3(...position),
    material: ballMaterial,
    linearDamping: 0.05, // Very low damping for responsive movement
    angularDamping: 0.05,
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
  const wallHeight = 3

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
  
  // TOP wall (full width, no gap) at z = -10
  addWall(0, -pitchDepth / 2 - wallThickness / 2, pitchWidth + wallThickness * 2, wallThickness)
  
  // BOTTOM wall (full width, no gap) at z = +10
  addWall(0, pitchDepth / 2 + wallThickness / 2, pitchWidth + wallThickness * 2, wallThickness)
  
  // LEFT wall (split for goal gap) at x = -15
  const leftX = -pitchWidth / 2 - wallThickness / 2
  const sideWallLength = (pitchDepth - goalWidth) / 2
  const sideWallOffset = goalWidth / 2 + sideWallLength / 2
  
  addWall(leftX, -sideWallOffset, wallThickness, sideWallLength) // Left Top
  addWall(leftX, sideWallOffset, wallThickness, sideWallLength)  // Left Bottom
  
  // RIGHT wall (split for goal gap) at x = +15
  const rightX = pitchWidth / 2 + wallThickness / 2
  
  addWall(rightX, -sideWallOffset, wallThickness, sideWallLength) // Right Top
  addWall(rightX, sideWallOffset, wallThickness, sideWallLength)  // Right Bottom
  
  // Goal back walls (behind the goals at x = ±13)
  const goalBackX = 13
  addWall(-goalBackX - wallThickness, 0, wallThickness, goalWidth + 2) // Left goal back
  addWall(goalBackX + wallThickness, 0, wallThickness, goalWidth + 2)  // Right goal back
}

