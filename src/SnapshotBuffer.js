import * as THREE from 'three'

export class SnapshotBuffer {
  constructor(bufferTime = 100) { // 100ms buffer
    this.buffer = []
    this.bufferTime = bufferTime
  }

  addSnapshot(state, timestamp) {
    this.buffer.push({ state, timestamp })
    // Keep buffer size reasonable (e.g., last 2 seconds)
    if (this.buffer.length > 120) {
      this.buffer.shift()
    }
  }

  getInterpolatedState(now) {
    // Target render time is "now - bufferTime"
    const renderTime = now - this.bufferTime

    // Drop older snapshots
    while (this.buffer.length >= 2 && this.buffer[1].timestamp <= renderTime) {
      this.buffer.shift()
    }

    if (this.buffer.length === 0) return null
    
    // If we only have one snapshot or the oldest is still newer than renderTime, return the oldest
    if (this.buffer.length === 1 || this.buffer[0].timestamp > renderTime) {
      return this.buffer[0].state
    }

    // Interpolate between buffer[0] and buffer[1]
    const t0 = this.buffer[0].timestamp
    const t1 = this.buffer[1].timestamp
    const ratio = (renderTime - t0) / (t1 - t0)
    
    // Clamp ratio (should be 0..1)
    const alpha = Math.max(0, Math.min(1, ratio))

    return this.interpolate(this.buffer[0].state, this.buffer[1].state, alpha)
  }

  interpolate(s1, s2, alpha) {
    // Custom interpolation logic - override this or pass as callback?
    // For now, assume generic object with x,y,z, rot
    const result = { ...s1 }
    
    // Position
    if (s1.x !== undefined && s2.x !== undefined) result.x = s1.x + (s2.x - s1.x) * alpha
    if (s1.y !== undefined && s2.y !== undefined) result.y = s1.y + (s2.y - s1.y) * alpha
    if (s1.z !== undefined && s2.z !== undefined) result.z = s1.z + (s2.z - s1.z) * alpha
    
    // Rotation (Quaternion)
    if (s1.rx !== undefined && s2.rx !== undefined) {
      const q1 = new THREE.Quaternion(s1.rx, s1.ry, s1.rz, s1.rw)
      const q2 = new THREE.Quaternion(s2.rx, s2.ry, s2.rz, s2.rw)
      q1.slerp(q2, alpha)
      result.rx = q1.x
      result.ry = q1.y
      result.rz = q1.z
      result.rw = q1.w
    }
    
    return result
  }
}
