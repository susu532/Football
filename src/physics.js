import * as CANNON from 'cannon-es'

let world = null
let lastTime = null

// Materials
export const ballMaterial = new CANNON.Material('ball')
export const groundMaterial = new CANNON.Material('ground')
export const playerMaterial = new CANNON.Material('player')

export function createWorld() {
  if (world) return world
  world = new CANNON.World({ gravity: new CANNON.Vec3(0, -15, 0) }) // Slightly stronger gravity for snappier feel
  world.broadphase = new CANNON.NaiveBroadphase()
  world.solver.iterations = 10
  
  // Contact Materials
  const ballGroundContact = new CANNON.ContactMaterial(ballMaterial, groundMaterial, {
    friction: 0.4,
    restitution: 0.7, // Bouncy ball
    contactEquationStiffness: 1e7,
    contactEquationRelaxation: 3
  })
  world.addContactMaterial(ballGroundContact)

  const ballPlayerContact = new CANNON.ContactMaterial(ballMaterial, playerMaterial, {
    friction: 0.1,
    restitution: 0.5, // Kick power
    contactEquationStiffness: 1e7,
    contactEquationRelaxation: 3
  })
  world.addContactMaterial(ballPlayerContact)

  lastTime = typeof performance !== 'undefined' ? performance.now() : Date.now()
  return world
}

export function stepWorld() {
  if (!world) return
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const dt = (now - lastTime) / 1000
  const step = 1 / 60
  const maxSubs = 3
  let accumulator = dt
  if (accumulator > maxSubs * step) accumulator = maxSubs * step
  while (accumulator >= step) {
    world.step(step)
    accumulator -= step
  }
  lastTime = now
}

export function getWorld() {
  return world
}

export function createSoccerBallBody({ position = [0, 2, 0], radius = 0.3, mass = 0.4 } = {}) {
  const ballShape = new CANNON.Sphere(radius)
  const ballBody = new CANNON.Body({ 
    mass, 
    shape: ballShape, 
    position: new CANNON.Vec3(...position),
    material: ballMaterial
  })
  ballBody.linearDamping = 0.1 // Air resistance
  ballBody.angularDamping = 0.1
  return ballBody
}

export function createPlayerBody({ position = [0, 1, 0], radius = 0.4 } = {}) {
  const shape = new CANNON.Sphere(radius)
  const body = new CANNON.Body({
    mass: 0, 
    type: CANNON.Body.KINEMATIC,
    shape: shape,
    position: new CANNON.Vec3(...position),
    material: playerMaterial
  })
  return body
}