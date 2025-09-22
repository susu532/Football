import * as CANNON from 'cannon-es'

let world = null
let lastTime = null

export function createWorld() {
  if (world) return world
  world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) })
  world.broadphase = new CANNON.NaiveBroadphase()
  world.solver.iterations = 8
  lastTime = typeof performance !== 'undefined' ? performance.now() : Date.now()
  return world
}

export function stepWorld() {
  if (!world) return
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const dt = (now - lastTime) / 1000
  // fixed-step of 1/60
  const step = 1 / 60
  // cap dt
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

export function createSoccerBallBody({ position = [0, 0.3, 0], radius = 0.3, mass = 0.45 } = {}) {
  const ballShape = new CANNON.Sphere(radius)
  const ballBody = new CANNON.Body({ mass, shape: ballShape, position: new CANNON.Vec3(...position) })
  ballBody.linearDamping = 0.15 // some friction
  ballBody.angularDamping = 0.12
  return ballBody
}