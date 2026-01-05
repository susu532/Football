// InputManager.js - Unified input handling for keyboard and mobile
// This module provides a singleton interface for all player input

class InputManagerClass {
  constructor() {
    this.keys = {}
    this.mobileInput = { move: { x: 0, y: 0 }, jump: false, kick: false }
    this.jumpPressed = false
    this.kickPressed = false
    this.isInitialized = false
  }

  init() {
    if (this.isInitialized || typeof window === 'undefined') return
    
    this._onKeyDown = this.handleKeyDown.bind(this)
    this._onKeyUp = this.handleKeyUp.bind(this)
    
    window.addEventListener('keydown', this._onKeyDown)
    window.addEventListener('keyup', this._onKeyUp)
    this.isInitialized = true
  }

  destroy() {
    if (!this.isInitialized || typeof window === 'undefined') return
    
    window.removeEventListener('keydown', this._onKeyDown)
    window.removeEventListener('keyup', this._onKeyUp)
    this.isInitialized = false
  }

  handleKeyDown(e) {
    if (e.repeat) return
    
    const key = e.key.toLowerCase()
    const code = e.code.toLowerCase()
    
    this.keys[key] = true
    this.keys[code] = true
    
    // Track one-shot actions
    if (e.code === 'Space') {
      this.jumpPressed = true
    }
    if (key === 'f') {
      this.kickPressed = true
    }
  }

  handleKeyUp(e) {
    const key = e.key.toLowerCase()
    const code = e.code.toLowerCase()
    
    this.keys[key] = false
    this.keys[code] = false
  }

  // Mobile input setters
  setMobileMove(x, y) {
    this.mobileInput.move = { x, y }
  }

  setMobileJump() {
    this.jumpPressed = true
  }

  setMobileKick() {
    this.kickPressed = true
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
      return { move: { x: 0, z: 0 }, jump: false, kick: false }
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

    return {
      move: { x: moveX, z: moveZ },
      jump,
      kick
    }
  }

  // Peek at input without consuming one-shots (for prediction)
  peekInput() {
    if (this.isInputFocused()) {
      return { move: { x: 0, z: 0 }, jump: false, kick: false }
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

    return {
      move: { x: moveX, z: moveZ },
      jump: this.jumpPressed,
      kick: this.kickPressed
    }
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
