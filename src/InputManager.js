// InputManager.js - Unified input handling for keyboard and mobile
// This module provides a singleton interface for all player input

class InputManagerClass {
  constructor() {
    this.keys = {}
    this.mobileInput = { move: { x: 0, y: 0 }, jump: false, kick: false }
    this.jumpRequestId = 0 // Increments on every jump press
    this.kickPressed = false
    this.isInitialized = false
    
    // NEW: High-frequency input sampling
    this.inputSamples = [] // Ring buffer (last 8 samples @ 250Hz = 32ms coverage)
    this.lastSampleTime = 0
    this.SAMPLE_INTERVAL = 4 // 4ms = 250Hz sampling rate
    this.rafId = null
    
    // Reusable objects to reduce GC
    this._reusableInput = {
      move: { x: 0, z: 0 },
      jumpRequestId: 0,
      kick: false
    }
  }

  init() {
    if (this.isInitialized || typeof window === 'undefined') return
    
    this._onKeyDown = this.handleKeyDown.bind(this)
    this._onKeyUp = this.handleKeyUp.bind(this)
    
    window.addEventListener('keydown', this._onKeyDown)
    window.addEventListener('keyup', this._onKeyUp)
    
    // NEW: Start high-frequency sampling loop
    this.startSamplingLoop()
    
    this.isInitialized = true
  }

  destroy() {
    if (!this.isInitialized || typeof window === 'undefined') return
    
    window.removeEventListener('keydown', this._onKeyDown)
    window.removeEventListener('keyup', this._onKeyUp)
    
    // NEW: Stop sampling loop
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    
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
      this.jumpRequestId++
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

  // NEW: High-frequency input sampling (250Hz)
  startSamplingLoop() {
    const sample = (timestamp) => {
      // Sample inputs at fixed intervals
      if (timestamp - this.lastSampleTime >= this.SAMPLE_INTERVAL) {
        this.sampleInputs(timestamp)
        this.lastSampleTime = timestamp
      }
      
      this.rafId = requestAnimationFrame(sample)
    }
    
    this.rafId = requestAnimationFrame(sample)
  }

  sampleInputs(timestamp) {
    if (this.isInputFocused()) return
    
    let moveX = 0
    let moveZ = 0

    // Sample keyboard state
    if (this.keys['w'] || this.keys['z'] || this.keys['arrowup']) moveZ -= 1
    if (this.keys['s'] || this.keys['arrowdown']) moveZ += 1
    if (this.keys['a'] || this.keys['q'] || this.keys['arrowleft']) moveX -= 1
    if (this.keys['d'] || this.keys['arrowright']) moveX += 1

    // Mobile overrides
    if (this.mobileInput.move.x !== 0 || this.mobileInput.move.y !== 0) {
      moveX = this.mobileInput.move.x
      moveZ = -this.mobileInput.move.y
    }

    // Normalize
    const length = Math.sqrt(moveX * moveX + moveZ * moveZ)
    if (length > 1) {
      moveX /= length
      moveZ /= length
    }

    // Store snapshot
    const snapshot = {
      timestamp,
      move: { x: moveX, z: moveZ },
      jumpRequestId: this.jumpRequestId,
      kick: this.kickPressed
    }
    
    this.inputSamples.push(snapshot)
    
    // Keep only last 8 samples (32ms at 250Hz)
    if (this.inputSamples.length > 8) {
      this.inputSamples.shift()
    }
  }

  // NEW: Get interpolated input for exact physics tick time
  getInputForTick(tickTimestamp) {
    if (this.inputSamples.length === 0) {
      return this.getInput() // Fallback to original method
    }
    
    if (this.inputSamples.length === 1) {
      const sample = this.inputSamples[0]
      this._reusableInput.move.x = sample.move.x
      this._reusableInput.move.z = sample.move.z
      this._reusableInput.jumpRequestId = sample.jumpRequestId
      this._reusableInput.kick = sample.kick
      return this._reusableInput
    }
    
    // Find two closest samples for interpolation
    let beforeIdx = 0
    let afterIdx = 0
    
    for (let i = 0; i < this.inputSamples.length - 1; i++) {
      if (this.inputSamples[i].timestamp <= tickTimestamp && 
          this.inputSamples[i + 1].timestamp > tickTimestamp) {
        beforeIdx = i
        afterIdx = i + 1
        break
      }
    }
    
    // If tick is after all samples, use latest
    if (tickTimestamp >= this.inputSamples[this.inputSamples.length - 1].timestamp) {
      beforeIdx = afterIdx = this.inputSamples.length - 1
    }
    
    const before = this.inputSamples[beforeIdx]
    const after = this.inputSamples[afterIdx]
    
    // Linear interpolation (or use latest if same sample)
    if (before === after) {
      this._reusableInput.move.x = before.move.x
      this._reusableInput.move.z = before.move.z
    } else {
      const t = (tickTimestamp - before.timestamp) / (after.timestamp - before.timestamp)
      this._reusableInput.move.x = before.move.x + (after.move.x - before.move.x) * t
      this._reusableInput.move.z = before.move.z + (after.move.z - before.move.z) * t
    }
    
    // Use latest for discrete events
    const latest = this.inputSamples[this.inputSamples.length - 1]
    this._reusableInput.jumpRequestId = latest.jumpRequestId
    this._reusableInput.kick = latest.kick
    
    return this._reusableInput
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
