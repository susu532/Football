import React, { useRef, useEffect, useState, useCallback } from 'react'

/**
 * MobileControls Component
 * Provides virtual joystick and action buttons for mobile users
 * Swipe on canvas is handled separately in CameraController
 */
export default function MobileControls({ 
  onMove,        // Callback: (x, y) => void, where x/y are -1 to 1
  onJump,        // Callback: () => void
  onKick,        // Callback: () => void
  onCameraMove   // Callback: (dx, dy) => void, camera swipe deltas
}) {
  const joystickRef = useRef(null)
  const knobRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const joystickCenter = useRef({ x: 0, y: 0 })
  
  // Camera swipe state
  const cameraLastPos = useRef({ x: 0, y: 0 })
  const isCameraSwiping = useRef(false)
  const activeCameraPointerId = useRef(null)

  // Joystick size constants
  const JOYSTICK_SIZE = 160 
  const KNOB_SIZE = 80 
  const MAX_DISTANCE = (JOYSTICK_SIZE - KNOB_SIZE) / 2

  const isDraggingRef = useRef(false)
  const activeJoystickPointerId = useRef(null)

  // --- JOYSTICK HANDLERS (Pointer Events) ---

  const handleJoystickDown = useCallback((e) => {
    // Prevent default to stop scrolling/zooming
    e.preventDefault()
    e.stopPropagation()
    
    // Capture pointer
    e.target.setPointerCapture(e.pointerId)
    activeJoystickPointerId.current = e.pointerId
    
    const rect = joystickRef.current.getBoundingClientRect()
    joystickCenter.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    }
    
    setIsDragging(true)
    isDraggingRef.current = true
    
    // Initial move processing
    handleJoystickMove(e)
  }, [])

  const handleJoystickMove = useCallback((e) => {
    if (!isDraggingRef.current) return
    if (e.pointerId !== activeJoystickPointerId.current) return
    
    e.preventDefault()
    
    const dx = e.clientX - joystickCenter.current.x
    const dy = e.clientY - joystickCenter.current.y
    
    // Calculate distance and clamp
    const distance = Math.sqrt(dx * dx + dy * dy)
    const clampedDistance = Math.min(distance, MAX_DISTANCE)
    const angle = Math.atan2(dy, dx)
    
    // Calculate knob position
    const knobX = Math.cos(angle) * clampedDistance
    const knobY = Math.sin(angle) * clampedDistance
    
    if (knobRef.current) {
      knobRef.current.style.transform = `translate(${knobX}px, ${knobY}px)`
    }
    
    // Normalize to -1 to 1 range
    const normalizedX = knobX / MAX_DISTANCE
    const normalizedY = -knobY / MAX_DISTANCE // Invert Y for game coordinates
    
    if (onMove) {
      onMove(normalizedX, normalizedY)
    }
  }, [MAX_DISTANCE, onMove])

  const handleJoystickUp = useCallback((e) => {
    if (e.pointerId !== activeJoystickPointerId.current) return
    
    e.preventDefault()
    setIsDragging(false)
    isDraggingRef.current = false
    activeJoystickPointerId.current = null
    
    if (knobRef.current) {
      knobRef.current.style.transform = 'translate(0, 0)'
    }
    if (onMove) {
      onMove(0, 0)
    }
  }, [onMove])

  // --- CAMERA HANDLERS (Pointer Events) ---

  const handleCameraDown = useCallback((e) => {
    // Ignore if touching controls
    if (e.target.closest('.mobile-controls')) return
    
    // Only accept primary pointer if not already swiping
    if (activeCameraPointerId.current !== null) return
    
    activeCameraPointerId.current = e.pointerId
    cameraLastPos.current = { x: e.clientX, y: e.clientY }
    isCameraSwiping.current = true
  }, [])

  const handleCameraMove = useCallback((e) => {
    if (!isCameraSwiping.current) return
    if (e.pointerId !== activeCameraPointerId.current) return
    
    const dx = e.clientX - cameraLastPos.current.x
    const dy = e.clientY - cameraLastPos.current.y
    
    cameraLastPos.current = { x: e.clientX, y: e.clientY }
    
    if (onCameraMove) {
      onCameraMove(dx, dy)
    }
  }, [onCameraMove])

  const handleCameraUp = useCallback((e) => {
    if (e.pointerId !== activeCameraPointerId.current) return
    
    isCameraSwiping.current = false
    activeCameraPointerId.current = null
  }, [])

  // Global Camera Listeners
  useEffect(() => {
    window.addEventListener('pointerdown', handleCameraDown)
    window.addEventListener('pointermove', handleCameraMove)
    window.addEventListener('pointerup', handleCameraUp)
    window.addEventListener('pointercancel', handleCameraUp)
    
    return () => {
      window.removeEventListener('pointerdown', handleCameraDown)
      window.removeEventListener('pointermove', handleCameraMove)
      window.removeEventListener('pointerup', handleCameraUp)
      window.removeEventListener('pointercancel', handleCameraUp)
    }
  }, [handleCameraDown, handleCameraMove, handleCameraUp])

  return (
    <div className="mobile-controls">
      {/* Virtual Joystick - Bottom Left */}
      <div 
        ref={joystickRef}
        className="joystick-container"
        onPointerDown={handleJoystickDown}
        onPointerMove={handleJoystickMove}
        onPointerUp={handleJoystickUp}
        onPointerCancel={handleJoystickUp}
        onPointerLeave={handleJoystickUp}
        style={{ touchAction: 'none' }}
      >
        <div className="joystick-base">
          <div ref={knobRef} className="joystick-knob" />
        </div>
      </div>

      {/* Action Buttons - Bottom Right */}
      <div className="action-buttons">
        <button 
          className="action-button jump-button"
          onPointerDown={(e) => { 
            e.preventDefault()
            e.stopPropagation()
            onJump && onJump() 
          }}
          style={{ touchAction: 'none' }}
        >
          <span className="button-icon">🦘</span>
          <span className="button-label">JUMP</span>
        </button>
        
        <button 
          className="action-button kick-button"
          onPointerDown={(e) => { 
            e.preventDefault()
            e.stopPropagation()
            onKick && onKick() 
          }}
          style={{ touchAction: 'none' }}
        >
          <span className="button-icon">⚽</span>
          <span className="button-label">KICK</span>
        </button>
      </div>
    </div>
  )
}
