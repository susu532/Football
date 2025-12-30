import React, { useState, useEffect } from 'react'
import useStore from './store'

// Random name generator
const adjectives = ['Swift', 'Thunder', 'Shadow', 'Blaze', 'Storm', 'Frost', 'Iron', 'Steel', 'Phantom', 'Cyber', 'Nova', 'Turbo', 'Mega', 'Ultra', 'Epic']
const nouns = ['Striker', 'Keeper', 'Ace', 'Legend', 'Champion', 'Warrior', 'Hunter', 'Raider', 'Master', 'King', 'Boss', 'Dragon', 'Phoenix', 'Tiger', 'Wolf']

function generateRandomName() {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
  const noun = nouns[Math.floor(Math.random() * nouns.length)]
  const num = Math.floor(Math.random() * 99) + 1
  return `${adj}${noun}${num}`
}

export default function TeamSelectPopup() {
  const joinGame = useStore((s) => s.joinGame)
  const hasJoined = useStore((s) => s.hasJoined)
  
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [selectedRoom, setSelectedRoom] = useState('room1')
  const [playerName, setPlayerName] = useState('')
  
  useEffect(() => {
    setPlayerName(generateRandomName())
  }, [])
  
  if (hasJoined) return null
  
  const handleJoin = () => {
    if (!selectedTeam) {
      alert('Please select a team!')
      return
    }
    if (!playerName.trim()) {
      alert('Please enter a name!')
      return
    }
    joinGame(playerName.trim(), selectedTeam, selectedRoom)
  }
  
  return (
    <div className="team-select-overlay">
      <div className="team-select-popup" style={{ maxWidth: '900px', display: 'flex', overflow: 'hidden', padding: 0 }}>
        {/* Left Column - Form */}
        <div style={{ flex: 1, padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px' , alignItems: 'center', justifyContent: 'center'}}>
          <h1 className="team-select-title" style={{ margin: 0 }}>⚽ Join the Match!</h1>
          
          <div className="team-select-section">
            <h2>Choose Your Room</h2>
            <div className="room-buttons" style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              {['room1', 'room2', 'room3'].map(room => (
                <button
                  key={room}
                  className={`room-btn ${selectedRoom === room ? 'selected' : ''}`}
                  onClick={() => setSelectedRoom(room)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '2px solid rgba(255,255,255,0.2)',
                    background: selectedRoom === room ? '#4caf50' : 'rgba(0,0,0,0.3)',
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    fontSize: '12px'
                  }}
                >
                  {room.replace('room', 'Room ')}
                </button>
              ))}
            </div>
          </div>

          <div className="team-select-section">
            <h2>Choose Your Team</h2>
            
            <div className="team-buttons">
              <button
                className={`team-btn team-btn-red ${selectedTeam === 'red' ? 'selected' : ''}`}
                onClick={() => setSelectedTeam('red')}
              >
                <span className="team-icon">🔴</span>
                <span className="team-name">Red Team</span>
              </button>
              <button
                className={`team-btn team-btn-blue ${selectedTeam === 'blue' ? 'selected' : ''}`}
                onClick={() => setSelectedTeam('blue')}
              >
                <span className="team-icon">🔵</span>
                <span className="team-name">Blue Team</span>
                
              </button>
            </div>
            
          </div>
          
          <div className="team-select-section">
            <h2>Your Player Name</h2>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                className="name-input"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name..."
                maxLength={20}
                style={{ flex: 1 }}
              />
              <button 
                className="randomize-btn"
                onClick={() => setPlayerName(generateRandomName())}
              >
                🎲
              </button>
            </div>
          </div>
          
          <button 
            className={`join-btn ${selectedTeam ? 'active' : ''}`}
            onClick={handleJoin}
            disabled={!selectedTeam}
            style={{ marginTop: 'auto' }}
          >
            🎮 Join Game
          </button>
        </div>

         
      </div>
      {/* Right Column - Tutorial Image */}
       <div style={{ position: 'absolute', right: 100, top: 200, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <img 
            src="/tuto.png" 
            alt="Game Tutorial" 
            style={{ width: '100%', height: '20%' }} 
          />
        </div>
    </div>
  )
}
