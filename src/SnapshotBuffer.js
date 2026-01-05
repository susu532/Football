import * as THREE from 'three'

export class SnapshotBuffer {
  constructor(interpolationDelay = 100) {
    this.buffer = []
    this.interpolationDelay = interpolationDelay
  }

  add(snapshot) {
    // Keep buffer sorted by timestamp
    this.buffer.push(snapshot)
    this.buffer.sort((a, b) => a.timestamp - b.timestamp)
    
    // Prune old snapshots (keep last 1 second)
    if (this.buffer.length > 20) {
      this.buffer = this.buffer.slice(-20)
    }
  }

  getInterpolatedState(serverTime) {
    // Calculate render time (past)
    const renderTime = serverTime - this.interpolationDelay

    // Drop older snapshots
    while (this.buffer.length >= 2 && this.buffer[1].timestamp <= renderTime) {
      this.buffer.shift()
    }

    if (this.buffer.length === 0) return null

    // If we only have one snapshot or renderTime is newer than newest snapshot
    if (this.buffer.length === 1 || this.buffer[this.buffer.length - 1].timestamp <= renderTime) {
      return this.buffer[this.buffer.length - 1]
    }

    // Interpolate between buffer[0] and buffer[1]
    const t0 = this.buffer[0]
    const t1 = this.buffer[1]
    
    const total = t1.timestamp - t0.timestamp
    const current = renderTime - t0.timestamp
    const ratio = Math.max(0, Math.min(1, current / total))

    return this.interpolate(t0, t1, ratio)
  }

  interpolate(s1, s2, ratio) {
    const result = { ...s2 }
    
    // Interpolate position
    if (s1.x !== undefined && s2.x !== undefined) {
      result.x = s1.x + (s2.x - s1.x) * ratio
      result.y = s1.y + (s2.y - s1.y) * ratio
      result.z = s1.z + (s2.z - s1.z) * ratio
    }

    // Interpolate rotation (shortest path)
    if (s1.rotY !== undefined && s2.rotY !== undefined) {
      let diff = s2.rotY - s1.rotY
      while (diff > Math.PI) diff -= Math.PI * 2
      while (diff < -Math.PI) diff += Math.PI * 2
      result.rotY = s1.rotY + diff * ratio
    }

    // Interpolate quaternion (for ball)
    if (s1.rx !== undefined && s2.rx !== undefined) {
      const q1 = new THREE.Quaternion(s1.rx, s1.ry, s1.rz, s1.rw)
      const q2 = new THREE.Quaternion(s2.rx, s2.ry, s2.rz, s2.rw)
      q1.slerp(q2, ratio)
      result.rx = q1.x
      result.ry = q1.y
      result.rz = q1.z
      result.rw = q1.w
    }

    return result
  }
}
