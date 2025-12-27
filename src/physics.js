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
  restitution: 0.7, // Bounciness
})

const ballPlayerContact = new CANNON.ContactMaterial(ballMaterial, playerMaterial, {
  friction: 0.3,
  restitution: 0.5, // Player kicks are slightly bouncy
})

export function createWorld() {
  if (world) return world

  world = new CANNON.World()
  world.gravity.set(0, -9.82, 0)
  world.broadphase = new CANNON.NaiveBroadphase()
  world.solver.iterations = 10

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

export function stepWorld(dt = 1 / 60) {
  if (world) {
    world.step(dt)
  }
}

export function createSoccerBallBody(position = [0, 2, 0]) {
  const radius = 0.3
  const shape = new CANNON.Sphere(radius)
  const body = new CANNON.Body({
    mass: 0.45, // Standard soccer ball mass approx 0.45kg
    position: new CANNON.Vec3(...position),
    material: ballMaterial,
    linearDamping: 0.2, // Air resistance
    angularDamping: 0.2, // Rolling resistance
  })
  body.addShape(shape)
  return body
}

// Helper to create a player body (kinematic)
export function createPlayerBody(position = [0, 1, 0]) {
  const radius = 0.5
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
  const pitchWidth = 24
  const pitchDepth = 14
  const wallThickness = 1
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
