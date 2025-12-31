import React, { useState, useEffect } from 'react'
import useStore from './store'
import CharacterPreview from './CharacterPreview'

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
  const setPlayerCharacter = useStore((s) => s.setPlayerCharacter)
  
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [selectedRoom, setSelectedRoom] = useState('room1')
  const [selectedCharacter, setSelectedCharacter] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('playerCharacter') || 'cat'
    }
    return 'cat'
  })
  const [playerName, setPlayerName] = useState('')
  
  useEffect(() => {
    setPlayerName(generateRandomName())
  }, [])
  
  if (hasJoined) return null
  
  const handleCharacterSelect = (character) => {
    setSelectedCharacter(character)
    setPlayerCharacter(character)
    if (typeof window !== 'undefined') {
      localStorage.setItem('playerCharacter', character)
    }
  }

  const handleJoin = () => {
    if (!selectedTeam) {
      alert('Please select a team!')
      return
    }
    if (!playerName.trim()) {
      alert('Please enter a name!')
      return
    }
    joinGame(playerName.trim(), selectedTeam, selectedRoom, selectedCharacter)
  }
  
  return (
    <div className="team-select-overlay">
      <div className="team-select-popup">
        {/* Left Sidebar - Visual Guide */}
        <div className="magic-sidebar">
          <img 
            src="/logo.png" 
            alt="Omni-Pitch Soccer Logo" 
            className="magic-sidebar-logo"
          />
          <img 
            src="/tuto.png" 
            alt="Game Tutorial" 
            className="magic-sidebar-tuto"
          />
        </div>

        {/* Right Content - Interactive Form */}
        <div className="magic-content">
          <h1 className="magic-title">Omni-Pitch</h1>
          
          <div className="magic-section">
            <div className="magic-section-title">Choose Your Room</div>
            <div className="magic-grid-rooms">
              {Array.from({ length: 13 }, (_, i) => `room${i + 1}`).map(room => (
                <button
                  key={room}
                  className={`magic-btn-room ${selectedRoom === room ? 'selected' : ''}`}
                  onClick={() => setSelectedRoom(room)}
                >
                  {room.replace('room', 'Room ')}
                </button>
              ))}
            </div>
          </div>

          <div className="magic-section">
            <div className="magic-section-title">Select Your Team</div>
            <div className="magic-grid-teams">
              <button
                className={`magic-btn-team red ${selectedTeam === 'red' ? 'selected' : ''}`}
                onClick={() => setSelectedTeam('red')}
              >
                <span className="team-icon">🔴</span>
                <span className="team-name">Red Team</span>
              </button>
              <button
                className={`magic-btn-team blue ${selectedTeam === 'blue' ? 'selected' : ''}`}
                onClick={() => setSelectedTeam('blue')}
              >
                <span className="team-icon">🔵</span>
                <span className="team-name">Blue Team</span>
              </button>
            </div>
          </div>
          
          <div className="magic-section">
            <div className="magic-section-title">Choose Your Character</div>
            <div className="magic-grid-characters">
              <CharacterPreview 
                character="cat" 
                isSelected={selectedCharacter === 'cat'} 
                onSelect={handleCharacterSelect}
              />
              <CharacterPreview 
                character="car" 
                isSelected={selectedCharacter === 'car'} 
                onSelect={handleCharacterSelect}
              />
            </div>
          </div>
          
          <div className="magic-section">
            <div className="magic-section-title">Player Identity</div>
            <div className="magic-input-wrapper">
              <input
                type="text"
                className="magic-input"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name..."
                maxLength={20}
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
            className={`magic-join-btn ${selectedTeam ? 'active' : ''}`}
            onClick={handleJoin}
            disabled={!selectedTeam}
          >
            🎮 Enter Arena
          </button>
        </div>
      </div>
    </div>
  )
}
