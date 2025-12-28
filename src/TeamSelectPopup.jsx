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
    joinGame(playerName.trim(), selectedTeam)
  }
  
  return (
    <div className="team-select-overlay">
      <div className="team-select-popup" style={{ maxWidth: '500px' }}>
        <h1 className="team-select-title">⚽ Join the Match!</h1>
        
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
          <input
            type="text"
            className="name-input"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your name..."
            maxLength={20}
          />
          <button 
            className="randomize-btn"
            onClick={() => setPlayerName(generateRandomName())}
          >
            🎲 Random
          </button>
        </div>
        
        <button 
          className={`join-btn ${selectedTeam ? 'active' : ''}`}
          onClick={handleJoin}
          disabled={!selectedTeam}
        >
          🎮 Join Game
        </button>
      </div>
    </div>
  )
}
