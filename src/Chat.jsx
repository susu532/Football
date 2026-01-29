/**
 * OmniPitch 3D Soccer Experience
 * Copyright (c) 2026 OmniPitch Games. All Rights Reserved.
 *
 * This file is proprietary and confidential.
 * Unauthorized copying, transfer, or use is strictly prohibited.
 *
 * For licensing inquiries: hentertrabelsi@gmail.com
 */

// Chat.jsx - Chat component for Colyseus
import React, { useState, useEffect, useRef } from 'react'

export default function Chat({ playerName, playerTeam, sendChat, onMessage }) {
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [isChatOpen, setIsChatOpen] = useState(true)
  const chatRef = useRef(null)

  // Listen for chat messages from Colyseus
  useEffect(() => {
    if (onMessage) {
      const unsubscribe = onMessage('chat-message', (data) => {
        setChatMessages((prev) => [...prev.slice(-49), data])
      })
      return () => {
        if (typeof unsubscribe === 'function') unsubscribe()
      }
    }
  }, [onMessage])

  // Auto-scroll chat
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [chatMessages])

  // Click outside to minimize
  const containerRef = useRef(null)
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsChatOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (chatInput.trim() && sendChat) {
      sendChat(chatInput.trim())
      setChatInput('')
    }
  }

  return (
    <div 
      ref={containerRef}
      style={{
      position: 'absolute',
      bottom: '20px',
      right: '20px',
      width: '300px',
      maxHeight: '250px',
      background: 'rgba(0,0,0,0.7)',
      borderRadius: '12px',
      overflow: 'hidden',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{
        padding: '10px 15px',
        background: 'rgba(0,0,0,0.5)',
        color: 'white',
        fontWeight: 'bold',
        fontSize: '14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>💬 Chat</span>
        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          {isChatOpen ? '−' : '+'}
        </button>
      </div>
      {isChatOpen && (
        <>
          <div
            ref={chatRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '10px',
              maxHeight: '150px'
            }}
          >
            {chatMessages.map((msg, i) => (
              <div key={msg.time + '-' + msg.playerName + '-' + i} style={{ marginBottom: '8px' }}>
                <span style={{
                  color: msg.team === 'red' ? '#ff4757' : msg.team === 'blue' ? '#3742fa' : '#888',
                  fontWeight: 'bold',
                  fontSize: '12px'
                }}>
                  {msg.playerName}:
                </span>
                <span style={{ color: 'white', marginLeft: '5px', fontSize: '12px' }}>
                  {msg.message}
                </span>
              </div>
            ))}
          </div>
          <form
            onSubmit={handleSubmit}
            style={{ padding: '10px', borderTop: '1px solid rgba(255,255,255,0.2)' }}
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type a message..."
              style={{
                width: '100%',
                padding: '8px 12px',
                border: 'none',
                borderRadius: '6px',
                background: 'rgba(255,255,255,0.1)',
                color: 'white',
                fontSize: '12px',
                outline: 'none'
              }}
            />
          </form>
        </>
      )}
    </div>
  )
}
