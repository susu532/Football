/**
 * OmniPitch 3D Soccer Experience
 * Copyright (c) 2026 OmniPitch Games. All Rights Reserved.
 *
 * This file is proprietary and confidential.
 * Unauthorized copying, transfer, or use is strictly prohibited.
 *
 * For licensing inquiries: hentertrabelsi@gmail.com
 */

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
  const dragStart = useRef({ x: 0, y: 0 })
  const joystickCenter = useRef({ x: 0, y: 0 })
  
  // Camera swipe state
  const cameraLastTouch = useRef({ x: 0, y: 0 })
  const isCameraSwiping = useRef(false)

  // Joystick size constants
  const JOYSTICK_SIZE = 160 // Matches CSS width (approx internal usable area)
  const KNOB_SIZE = 80 // Matches CSS width
  const MAX_DISTANCE = (JOYSTICK_SIZE - KNOB_SIZE) / 2

  const isDraggingRef = useRef(false)

  // Handle joystick touch start
  const handleJoystickStart = useCallback((e) => {
    // Stop propagation to prevent window touchstart (camera swipe) from firing
    e.stopPropagation()
    
    // For pointer events, clientX/Y are directly on the event
    // For touch events (if somehow triggered), they are in touches[0]
    const clientX = e.clientX || (e.touches && e.touches[0].clientX)
    const clientY = e.clientY || (e.touches && e.touches[0].clientY)
    
    const rect = joystickRef.current.getBoundingClientRect()
    
    joystickCenter.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    }
    dragStart.current = { x: clientX, y: clientY }
    setIsDragging(true)
    isDraggingRef.current = true
  }, [])

  // Handle joystick touch move
  const handleJoystickMove = useCallback((e) => {
    if (!isDragging) return
    e.preventDefault()
    
    const touch = e.touches ? e.touches[0] : e
    const dx = touch.clientX - joystickCenter.current.x
    const dy = touch.clientY - joystickCenter.current.y
    
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
  }, [isDragging, MAX_DISTANCE, onMove])

  // Handle joystick touch end
  const handleJoystickEnd = useCallback(() => {
    setIsDragging(false)
    isDraggingRef.current = false
    if (knobRef.current) {
      knobRef.current.style.transform = 'translate(0, 0)'
    }
    if (onMove) {
      onMove(0, 0)
    }
  }, [onMove])

  // Camera swipe handlers - for the main game area
  const handleCameraStart = useCallback((e) => {
    // If we are already dragging the joystick, ignore
    if (isDraggingRef.current) return

    // Only handle single touch not on controls
    // We check the target and all its parents up to the control container
    if (e.target.closest('.mobile-controls') || 
        e.target.closest('.joystick-container') || 
        e.target.closest('.action-buttons') ||
        e.target.closest('.action-button')) {
      return
    }
    
    if (e.touches && e.touches.length !== 1) return
    
    const touch = e.touches ? e.touches[0] : e
    cameraLastTouch.current = { x: touch.clientX, y: touch.clientY }
    isCameraSwiping.current = true
  }, [])

  const handleCameraMove = useCallback((e) => {
    if (!isCameraSwiping.current) return
    
    // Extra safety: if we are dragging the joystick, don't move camera
    if (isDraggingRef.current) return
    
    const touch = e.touches ? e.touches[0] : e
    const dx = touch.clientX - cameraLastTouch.current.x
    const dy = touch.clientY - cameraLastTouch.current.y
    
    cameraLastTouch.current = { x: touch.clientX, y: touch.clientY }
    
    if (onCameraMove) {
      onCameraMove(dx, dy)
    }
  }, [onCameraMove])

  const handleCameraEnd = useCallback(() => {
    isCameraSwiping.current = false
  }, [])

  // Add global touch listeners for camera swipe
  useEffect(() => {
    window.addEventListener('touchstart', handleCameraStart, { passive: false })
    window.addEventListener('touchmove', handleCameraMove, { passive: false })
    window.addEventListener('touchend', handleCameraEnd)
    
    return () => {
      window.removeEventListener('touchstart', handleCameraStart)
      window.removeEventListener('touchmove', handleCameraMove)
      window.removeEventListener('touchend', handleCameraEnd)
    }
  }, [handleCameraStart, handleCameraMove, handleCameraEnd])

  // Add document-level listeners for joystick (to handle drag outside element)
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('touchmove', handleJoystickMove, { passive: false })
      document.addEventListener('touchend', handleJoystickEnd)
      document.addEventListener('mousemove', handleJoystickMove)
      document.addEventListener('mouseup', handleJoystickEnd)
    }
    
    return () => {
      document.removeEventListener('touchmove', handleJoystickMove)
      document.removeEventListener('touchend', handleJoystickEnd)
      document.removeEventListener('mousemove', handleJoystickMove)
      document.removeEventListener('mouseup', handleJoystickEnd)
    }
  }, [isDragging, handleJoystickMove, handleJoystickEnd])

  return (
    <div className="mobile-controls" onPointerDown={(e) => e.stopPropagation()}>
      {/* Virtual Joystick - Bottom Left */}
      <div 
        ref={joystickRef}
        className="joystick-container"
        onPointerDown={handleJoystickStart}
        onTouchStart={(e) => e.stopPropagation()} // Stop bubbling to window touchstart
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
          onTouchStart={(e) => e.stopPropagation()} // Stop bubbling to window touchstart
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
          onTouchStart={(e) => e.stopPropagation()} // Stop bubbling to window touchstart
          style={{ touchAction: 'none' }}
        >
          <span className="button-icon">⚽</span>
          <span className="button-label">KICK</span>
        </button>
      </div>
    </div>
  )
}
