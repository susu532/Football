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
  friction: 0.4, // Lower friction for smoother rolling
  restitution: 0.4, // Less bouncy
})

const ballPlayerContact = new CANNON.ContactMaterial(ballMaterial, playerMaterial, {
  friction: 0.2,
  restitution: 0.7, // Player kicks are punchier
})

export function createWorld() {
  if (world) return world

  world = new CANNON.World()
  world.gravity.set(0, -15, 0) // Stronger gravity for snappier ball
  world.broadphase = new CANNON.SAPBroadphase(world) // Better broadphase
  world.solver.iterations = 20 // More iterations for stable collisions
  world.allowSleep = false // Keep physics active

  // Add contact materials
  world.addContactMaterial(ballGroundContact)
  world.addContactMaterial(ballPlayerContact)

  // Create ground plane
  const groundShape = new CANNON.Plane()
  groundBody = new CANNON.Body({
    mass: 0, // Static
    material: groundMaterial,
  })
  groundBody.addShape(groundShape)
  groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2)
  world.addBody(groundBody)

  // Create walls (invisible boundaries)
  createWalls(world)

  return world
}

export function getWorld() {
  return world || createWorld()
}

// Sub-stepping physics for stability
const fixedTimeStep = 1 / 120 // 120Hz physics
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

export function createSoccerBallBody(position = [0, 0.5, 0]) {
  const radius = 0.3
  const shape = new CANNON.Sphere(radius)
  const body = new CANNON.Body({
    mass: 0.45, // Realistic soccer ball mass
    position: new CANNON.Vec3(...position),
    material: ballMaterial,
    linearDamping: 0.2, // Lower for smoother movement
    angularDamping: 0.2, // Lower for smoother rolling
  })
  body.addShape(shape)
  return body
}

// Helper to create a player body (kinematic)
export function createPlayerBody(position = [0, 1, 0]) {
  const radius = 0.4
  const shape = new CANNON.Sphere(radius) // Simple sphere for player collision
  const body = new CANNON.Body({
    mass: 0, // Kinematic bodies have infinite mass effectively, but we set type to KINEMATIC
    type: CANNON.Body.KINEMATIC,
    position: new CANNON.Vec3(...position),
    material: playerMaterial,
  })
  body.addShape(shape)
  return body
}

function createWalls(world) {
  const pitchWidth = 30
  const pitchDepth = 20
  const wallThickness = 5 // Thicker walls to prevent tunneling
  const wallHeight = 2

  const wallMaterial = new CANNON.Material('wall')
  const ballWallContact = new CANNON.ContactMaterial(ballMaterial, wallMaterial, {
    friction: 0.2,
    restitution: 0.5,
  })
  world.addContactMaterial(ballWallContact)

  // Helper for walls
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

  // Side walls
  addWall(0, -pitchDepth / 2 - wallThickness / 2, pitchWidth + 2, wallThickness) // Top
  addWall(0, pitchDepth / 2 + wallThickness / 2, pitchWidth + 2, wallThickness) // Bottom
  addWall(-pitchWidth / 2 - wallThickness / 2, 0, wallThickness, pitchDepth + 2) // Left
  addWall(pitchWidth / 2 + wallThickness / 2, 0, wallThickness, pitchDepth + 2) // Right
}
