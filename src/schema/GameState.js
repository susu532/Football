import { Schema, MapSchema } from 'colyseus.js'
import { defineTypes } from '@colyseus/schema' // defineTypes is NOT exported by colyseus.js usually, but Schema is.
// Wait, if I mix them, it might fail.
// Let's try to see if colyseus.js exports defineTypes.
// If not, I must ensure @colyseus/schema is the SAME version as used by colyseus.js.
// But colyseus.js usually bundles it.
// Let's try importing Schema from colyseus.js and defineTypes from @colyseus/schema.
// This is risky.
// BETTER APPROACH: Use the Context?
// No.
// Let's try importing EVERYTHING from @colyseus/schema and hope colyseus.js uses it if installed?
// No, colyseus.js is a bundle.

// Let's try to import Schema from colyseus.js.
// And defineTypes from @colyseus/schema.
// But defineTypes registers metadata.
// If Schema from colyseus.js is different from Schema from @colyseus/schema, defineTypes(Schema, ...) might fail or register on wrong global.

// ACTUALLY, the best way for client-side colyseus.js (which is a browser bundle) is to NOT use @colyseus/schema package if possible, OR use the one it provides.
// But it doesn't provide defineTypes in exports usually.

// Let's try:
// import { Schema, MapSchema } from 'colyseus.js'
import { defineTypes } from '@colyseus/schema'
// This WAS what I had. And it failed.
// Why? Because colyseus.js (the client lib) checks `instanceof Schema` where `Schema` is ITS internal Schema.
// So I MUST extend `colyseus.js`'s Schema.

// So:
// import { Schema, MapSchema } from 'colyseus.js'
// import { defineTypes } from '@colyseus/schema'
// defineTypes(GameState, ...) -> GameState extends Schema (from colyseus.js).
// Does defineTypes work on any class? Yes, it attaches Symbol.metadata.
// So this MIX should work IF defineTypes doesn't depend on Schema class identity.

// Let's try this mix.


// Player state
export class PlayerState extends Schema {
  constructor() {
    super()
    this.x = 0
    this.y = 0.1
    this.z = 0
    this.vx = 0
    this.vy = 0
    this.vz = 0
    this.rotY = 0
    this.name = ''
    this.team = ''
    this.character = 'cat'
    this.invisible = false
    this.giant = false
  }
}

defineTypes(PlayerState, {
  x: 'number',
  y: 'number',
  z: 'number',
  vx: 'number',
  vy: 'number',
  vz: 'number',
  rotY: 'number',
  name: 'string',
  team: 'string',
  character: 'string',
  invisible: 'boolean',
  giant: 'boolean'
})

// Ball state
export class BallState extends Schema {
  constructor() {
    super()
    this.x = 0
    this.y = 2
    this.z = 0
    this.vx = 0
    this.vy = 0
    this.vz = 0
    this.rx = 0
    this.ry = 0
    this.rz = 0
    this.rw = 1
  }
}

defineTypes(BallState, {
  x: 'number',
  y: 'number',
  z: 'number',
  vx: 'number',
  vy: 'number',
  vz: 'number',
  rx: 'number',
  ry: 'number',
  rz: 'number',
  rw: 'number'
})

// Main game state
export class GameState extends Schema {
  constructor() {
    super()
    this.players = new MapSchema()
    this.ball = new BallState()
    this.redScore = 0
    this.blueScore = 0
    this.timer = 300
    this.gamePhase = 'waiting'
  }
}

defineTypes(GameState, {
  players: { map: PlayerState },
  ball: BallState,
  redScore: 'number',
  blueScore: 'number',
  timer: 'number',
  gamePhase: 'string'
})
