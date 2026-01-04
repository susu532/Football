import React, { useState, useEffect, useRef } from 'react'
import { RPC } from 'playroomkit'

export default function Chat({ playerName, playerTeam }) {
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [isChatOpen, setIsChatOpen] = useState(true)
  const chatRef = useRef(null)

  // Listen for chat messages via RPC
  useEffect(() => {
    const unsubscribe = RPC.register('chat-message', (data) => {
      setChatMessages((prev) => [...prev.slice(-49), data])
    })
    return () => unsubscribe()
  }, [])

  // Auto-scroll chat
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [chatMessages])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (chatInput.trim()) {
      const newMessage = {
        playerName: playerName || 'Guest',
        team: playerTeam,
        message: chatInput.trim(),
        time: Date.now()
      }
      
      // Broadcast message to all players (including self)
      RPC.call('chat-message', newMessage, RPC.Mode.ALL)
      setChatInput('')
    }
  }

  return (
    <div style={{
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
