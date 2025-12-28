import React, { useState, useEffect } from 'react'
import useStore from './store'

// Random name generator
const adjectives = ['Swift', 'Thunder', 'Shadow', 'Blaze', 'Storm', 'Frost', 'Iron', 'Steel', 'Phantom', 'Cyber', 'Nova', 'Turbo', 'Mega', 'Ultra', 'Epic']
const nouns = ['Striker', 'Keeper', 'Ace', 'Legend', 'Champion', 'Warrior', 'Hunter', 'Raider', 'Master', 'King', 'Boss', 'Dragon', 'Phoenix', 'Tiger', 'Wolf']

// Available character skins
const SKINS = [
  { id: 'character-male-a', name: 'Male A', preview: '/previews/character-male-a.png' },
  { id: 'character-male-b', name: 'Male B', preview: '/previews/character-male-b.png' },
  { id: 'character-male-c', name: 'Male C', preview: '/previews/character-male-c.png' },
  { id: 'character-male-d', name: 'Male D', preview: '/previews/character-male-d.png' },
  { id: 'character-male-e', name: 'Male E', preview: '/previews/character-male-e.png' },
  { id: 'character-male-f', name: 'Male F', preview: '/previews/character-male-f.png' },
  { id: 'character-female-a', name: 'Female A', preview: '/previews/character-female-a.png' },
  { id: 'character-female-b', name: 'Female B', preview: '/previews/character-female-b.png' },
  { id: 'character-female-c', name: 'Female C', preview: '/previews/character-female-c.png' },
  { id: 'character-female-d', name: 'Female D', preview: '/previews/character-female-d.png' },
  { id: 'character-female-e', name: 'Female E', preview: '/previews/character-female-e.png' },
  { id: 'character-female-f', name: 'Female F', preview: '/previews/character-female-f.png' },
]

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
  const [selectedSkin, setSelectedSkin] = useState('character-male-a')
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
    joinGame(playerName.trim(), selectedTeam, selectedSkin)
  }
  
  return (
    <div className="team-select-overlay">
      <div className="team-select-popup" style={{ maxWidth: '600px' }}>
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
          <h2>Choose Your Character</h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: '10px',
            marginTop: '15px'
          }}>
            {SKINS.map((skin) => (
              <button
                key={skin.id}
                onClick={() => setSelectedSkin(skin.id)}
                style={{
                  padding: '8px',
                  border: selectedSkin === skin.id ? '3px solid #00d2d3' : '2px solid rgba(255,255,255,0.2)',
                  borderRadius: '10px',
                  background: selectedSkin === skin.id ? 'rgba(0,210,211,0.2)' : 'rgba(255,255,255,0.08)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  transform: selectedSkin === skin.id ? 'scale(1.05)' : 'scale(1)'
                }}
              >
                <img 
                  src={skin.preview} 
                  alt={skin.name}
                  style={{
                    width: '100%',
                    height: '60px',
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
                  }}
                />
              </button>
            ))}
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
