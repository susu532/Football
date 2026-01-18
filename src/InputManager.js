// InputManager.js - Unified input handling for keyboard and mobile
// This module provides a singleton interface for all player input

class InputManagerClass {
  constructor() {
    this.keys = {}
    this.mobileInput = { move: { x: 0, y: 0 }, jump: false, kick: false }
    this.jumpRequestId = 0 // Increments on every jump press
    this.kickPressed = false
    this.isInitialized = false
    
    // Reusable objects to reduce GC
    this._reusableInput = {
      move: { x: 0, z: 0 },
      jumpRequestId: 0,
      kick: false,
      kickTimestamp: 0,
      timestamp: 0
    }
    
    // Sub-frame input tracking
    this.inputQueue = []
    this.lastInputTime = 0
    this.inputVelocity = { x: 0, z: 0 }
    this.kickTimestamp = 0
  }

  init() {
    if (this.isInitialized || typeof window === 'undefined') return
    
    this._onKeyDown = this.handleKeyDown.bind(this)
    this._onKeyUp = this.handleKeyUp.bind(this)
    this._onMouseDown = this.handleMouseDown.bind(this)
    
    window.addEventListener('keydown', this._onKeyDown)
    window.addEventListener('keyup', this._onKeyUp)
    window.addEventListener('mousedown', this._onMouseDown)
    this.isInitialized = true
  }

  destroy() {
    if (!this.isInitialized || typeof window === 'undefined') return
    
    window.removeEventListener('keydown', this._onKeyDown)
    window.removeEventListener('keyup', this._onKeyUp)
    window.removeEventListener('mousedown', this._onMouseDown)
    this.isInitialized = false
  }

  handleMouseDown(e) {
    // Left click only (button 0)
    if (e.button === 0) {
      if (this.isInputFocused()) return
      
      this.kickPressed = true
      this.kickTimestamp = typeof performance !== 'undefined' ? performance.now() : Date.now()
      
      const timestamp = this.kickTimestamp
      this.inputQueue.push({ type: 'down', key: 'mouse0', code: 'mouse0', timestamp })
    }
  }

  handleKeyDown(e) {
    if (e.repeat) return
    
    const key = e.key.toLowerCase()
    const code = e.code.toLowerCase()
    
    this.keys[key] = true
    this.keys[code] = true
    
    // Sub-frame timestamping
    const timestamp = typeof performance !== 'undefined' ? performance.now() : Date.now()
    this.inputQueue.push({ type: 'down', key, code, timestamp })
    
    // Track one-shot actions
    if (e.code === 'Space') {
      this.jumpRequestId++
    }
    if (key === 'f') {
      this.kickPressed = true
      this.kickTimestamp = typeof performance !== 'undefined' ? performance.now() : Date.now()
    }
  }

  handleKeyUp(e) {
    const key = e.key.toLowerCase()
    const code = e.code.toLowerCase()
    
    this.keys[key] = false
    this.keys[code] = false
    
    const timestamp = typeof performance !== 'undefined' ? performance.now() : Date.now()
    this.inputQueue.push({ type: 'up', key, code, timestamp })
  }

  // Mobile input setters
  setMobileMove(x, y) {
    this.mobileInput.move = { x, y }
  }

  setMobileJump() {
    this.jumpRequestId++
  }

  setMobileKick() {
    this.kickPressed = true
    this.kickTimestamp = typeof performance !== 'undefined' ? performance.now() : Date.now()
  }

  // Helper to check if user is typing in an input field
  isInputFocused() {
    if (typeof document === 'undefined') return false
    const active = document.activeElement
    return active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')
  }

  // Get current input state
  // Returns { move: {x, z}, jump: bool, kick: bool }
  getInput() {
    if (this.isInputFocused()) {
      // Consume one-shots even if focused to prevent "stuck" actions
      this.jumpPressed = false
      this.kickPressed = false
      
      this._reusableInput.move.x = 0
      this._reusableInput.move.z = 0
      this._reusableInput.jumpRequestId = this.jumpRequestId
      this._reusableInput.kick = false
      this._reusableInput.kickTimestamp = 0
      return this._reusableInput
    }

    let moveX = 0
    let moveZ = 0

    // QWERTY: WASD, AZERTY: ZQSD, Plus Arrow keys
    if (this.keys['w'] || this.keys['z'] || this.keys['arrowup']) moveZ -= 1
    if (this.keys['s'] || this.keys['arrowdown']) moveZ += 1
    if (this.keys['a'] || this.keys['q'] || this.keys['arrowleft']) moveX -= 1
    if (this.keys['d'] || this.keys['arrowright']) moveX += 1

    // Mobile joystick overrides keyboard if present
    if (this.mobileInput.move.x !== 0 || this.mobileInput.move.y !== 0) {
      moveX = this.mobileInput.move.x
      moveZ = -this.mobileInput.move.y // Invert for camera-relative movement
    }

    // Normalize diagonal movement
    const length = Math.sqrt(moveX * moveX + moveZ * moveZ)
    if (length > 1) {
      moveX /= length
      moveZ /= length
    }

    // Consume one-shot actions
    const jump = this.jumpPressed
    const kick = this.kickPressed
    this.jumpPressed = false
    this.kickPressed = false

    this.kickPressed = false
    
    this._reusableInput.move.x = moveX
    this._reusableInput.move.z = moveZ
    this._reusableInput.jumpRequestId = this.jumpRequestId
    this._reusableInput.kick = kick
    this._reusableInput.kickTimestamp = this.kickTimestamp
    this._reusableInput.timestamp = typeof performance !== 'undefined' ? performance.now() : Date.now()
    
    // Update input velocity (simple difference)
    // In a real sub-frame system we'd use the queue, but for now just tracking current vs last
    this.inputVelocity.x = moveX
    this.inputVelocity.z = moveZ
    
    return this._reusableInput
  }

  // Peek at input without consuming one-shots (for prediction)
  peekInput() {
    if (this.isInputFocused()) {
      this._reusableInput.move.x = 0
      this._reusableInput.move.z = 0
      this._reusableInput.jumpRequestId = this.jumpRequestId
      this._reusableInput.kick = false
      return this._reusableInput
    }

    let moveX = 0
    let moveZ = 0

    if (this.keys['w'] || this.keys['z'] || this.keys['arrowup']) moveZ -= 1
    if (this.keys['s'] || this.keys['arrowdown']) moveZ += 1
    if (this.keys['a'] || this.keys['q'] || this.keys['arrowleft']) moveX -= 1
    if (this.keys['d'] || this.keys['arrowright']) moveX += 1

    if (this.mobileInput.move.x !== 0 || this.mobileInput.move.y !== 0) {
      moveX = this.mobileInput.move.x
      moveZ = -this.mobileInput.move.y
    }

    const length = Math.sqrt(moveX * moveX + moveZ * moveZ)
    if (length > 1) {
      moveX /= length
      moveZ /= length
    }

    this._reusableInput.move.x = moveX
    this._reusableInput.move.z = moveZ
    this._reusableInput.jumpRequestId = this.jumpRequestId
    this._reusableInput.kick = this.kickPressed
    
    return this._reusableInput
  }

  // Check if any movement input is active
  hasMovement() {
    const input = this.peekInput()
    return input.move.x !== 0 || input.move.z !== 0
  }
}

// Singleton export
const InputManager = new InputManagerClass()
export default InputManager
