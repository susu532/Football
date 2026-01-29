/**
 * OmniPitch 3D Soccer Experience
 * Copyright (c) 2026 OmniPitch Games. All Rights Reserved.
 *
 * This file is proprietary and confidential.
 * Unauthorized copying, transfer, or use is strictly prohibited.
 */

// StateHistory.js - Ring buffer for game state history
// Used for server reconciliation and input replay

export class RingBuffer {
  constructor(capacity) {
    this.buffer = new Array(capacity)
    this.capacity = capacity
    this.head = 0
    this.size = 0
  }

  push(item) {
    this.buffer[this.head] = item
    this.head = (this.head + 1) % this.capacity
    if (this.size < this.capacity) {
      this.size++
    }
  }

  get(index) {
    if (index < 0 || index >= this.size) return null
    // Calculate actual index in circular buffer
    // head points to next empty slot, so head-1 is latest
    let i = this.head - 1 - index
    if (i < 0) i += this.capacity
    return this.buffer[i]
  }

  // Find state closest to a specific tick
  getByTick(tick) {
    for (let i = 0; i < this.size; i++) {
      const item = this.get(i)
      if (item && item.tick === tick) {
        return item
      }
    }
    return null
  }
  
  // Find state closest to a timestamp
  getByTimestamp(timestamp) {
    // Binary search could be better if sorted, but linear is fine for small buffers
    let closest = null
    let minDiff = Infinity
    
    for (let i = 0; i < this.size; i++) {
      const item = this.get(i)
      if (!item) continue
      
      const diff = Math.abs(item.timestamp - timestamp)
      if (diff < minDiff) {
        minDiff = diff
        closest = item
      }
    }
    return closest
  }

  clear() {
    this.head = 0
    this.size = 0
  }
}

export const stateHistory = new RingBuffer(120) // 1 second of history at 120Hz
