import React, { useState, useEffect } from 'react'
import useStore from './store'
import CharacterPreview from './CharacterPreview'
import MapSelector from './MapSelector'

// Random name generator
const adjectives = ['Swift', 'Thunder', 'Shadow', 'Blaze', 'Storm', 'Frost', 'Iron', 'Steel', 'Phantom', 'Cyber', 'Nova', 'Turbo', 'Mega', 'Ultra', 'Epic']
const nouns = ['Striker', 'Keeper', 'Ace', 'Legend', 'Champion', 'Warrior', 'Hunter', 'Raider', 'Master', 'King', 'Boss', 'Dragon', 'Phoenix', 'Tiger', 'Wolf']

function generateRandomName() {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
  const noun = nouns[Math.floor(Math.random() * nouns.length)]
  const num = Math.floor(Math.random() * 99) + 1
  return `${adj}${noun}${num}`
}

export default function TeamSelectPopup({ defaultName, rooming }) {
  const joinGame = useStore((s) => s.joinGame)
  const hasJoined = useStore((s) => s.hasJoined)
  const setPlayerCharacter = useStore((s) => s.setPlayerCharacter)
  
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [selectedCharacter, setSelectedCharacter] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('playerCharacter') || 'cat'
    }
    return 'cat'
  })
  const [selectedMap, setSelectedMap] = useState('OceanFloor')
  const [playerName, setPlayerName] = useState(defaultName || '')
  const [privateJoinCode, setPrivateJoinCode] = useState('')
  const [isRoomBusy, setIsRoomBusy] = useState(false)
  
  useEffect(() => {
    if (!defaultName) {
      setPlayerName(generateRandomName())
    } else {
      setPlayerName(defaultName)
    }
  }, [defaultName])
  
  if (hasJoined) return null
  
  const handleCharacterSelect = (character) => {
    setSelectedCharacter(character)
    setPlayerCharacter(character)
    if (typeof window !== 'undefined') {
      localStorage.setItem('playerCharacter', character)
    }
  }

  const validateInputs = () => {
    if (!selectedTeam) {
      alert('Please select a team!')
      return false
    }
    if (!playerName.trim()) {
      alert('Please enter a name!')
      return false
    }
    return true
  }

  const handleJoin = () => {
    if (!validateInputs()) return
    joinGame(playerName.trim(), selectedTeam, selectedCharacter, selectedMap)
  }

  const handleCreatePublicRoom = async () => {
    if (!rooming) return
    if (!validateInputs()) return
    setIsRoomBusy(true)
    const joined = await rooming.createPublicRoom({
      name: playerName.trim(),
      team: selectedTeam,
      character: selectedCharacter,
      map: selectedMap
    })
    setIsRoomBusy(false)
    if (joined) {
      joinGame(playerName.trim(), selectedTeam, selectedCharacter, selectedMap)
    } else {
      alert('Failed to create public room')
    }
  }

  const handleCreatePrivateRoom = async () => {
    if (!rooming) return
    if (!validateInputs()) return
    setIsRoomBusy(true)
    const joined = await rooming.createPrivateRoom({
      name: playerName.trim(),
      team: selectedTeam,
      character: selectedCharacter,
      map: selectedMap
    })
    setIsRoomBusy(false)
    if (joined) {
      joinGame(playerName.trim(), selectedTeam, selectedCharacter, selectedMap)
    } else {
      alert('Failed to create private room')
    }
  }

  const handleRefreshRooms = async () => {
    if (!rooming) return
    setIsRoomBusy(true)
    await rooming.refreshAvailableRooms()
    setIsRoomBusy(false)
  }

  const handleJoinPublicRoom = async (roomId) => {
    if (!rooming) return
    if (!validateInputs()) return
    setIsRoomBusy(true)
    const joined = await rooming.joinRoomById(roomId, {
      name: playerName.trim(),
      team: selectedTeam,
      character: selectedCharacter
    })
    setIsRoomBusy(false)
    if (joined) {
      joinGame(playerName.trim(), selectedTeam, selectedCharacter, selectedMap)
    } else {
      alert('Failed to join room')
    }
  }

  const handleJoinPrivateByCode = async () => {
    if (!rooming) return
    if (!validateInputs()) return
    const code = privateJoinCode.trim().toUpperCase()
    if (!code) {
      alert('Enter a room code')
      return
    }
    setIsRoomBusy(true)
    const joined = await rooming.joinPrivateRoomByCode(code, {
      name: playerName.trim(),
      team: selectedTeam,
      character: selectedCharacter
    })
    setIsRoomBusy(false)
    if (joined) {
      joinGame(playerName.trim(), selectedTeam, selectedCharacter, selectedMap)
    } else {
      alert('Invalid code or room not found')
    }
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
          <div className="magic-footer">
            <span className="magic-footer-text">Waiting for your feedback</span>
            <a href="https://discord.gg/susuxo" target="_blank" rel="noopener noreferrer" className="discord-link">
              <svg className="discord-icon" viewBox="0 0 127.14 96.36">
                <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.06,72.06,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.71,32.65-1.82,56.6.4,80.21a105.73,105.73,0,0,0,32.17,16.15,77.7,77.7,0,0,0,6.89-11.11,68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1,105.25,105.25,0,0,0,32.19-16.14c.4-23.61-4.13-47.56-20.79-72.14ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
              </svg>
              <span>susuxo</span>
            </a>
          </div>
        </div>

        {/* Right Content - Interactive Form */}
        <div className="magic-content">
          <h1 className="magic-title">Omni-Pitch</h1>

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

          <MapSelector 
            selectedMapId={selectedMap} 
            onSelect={setSelectedMap} 
          />
          
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

          {rooming && (
            <div className="magic-section" style={{ marginTop: '20px' }}>
              <div className="magic-section-title">Rooms (Max 4 players)</div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  className="magic-join-btn active"
                  onClick={handleCreatePublicRoom}
                  disabled={isRoomBusy}
                  style={{ width: 'auto', padding: '12px 14px' }}
                >
                  Create Public
                </button>
                <button
                  className="magic-join-btn active"
                  onClick={handleCreatePrivateRoom}
                  disabled={isRoomBusy}
                  style={{ width: 'auto', padding: '12px 14px' }}
                >
                  Create Private
                </button>
                <button
                  className="magic-join-btn"
                  onClick={handleRefreshRooms}
                  disabled={isRoomBusy}
                  style={{ width: 'auto', padding: '12px 14px' }}
                >
                  Refresh List
                </button>
              </div>

              {rooming.roomCode && (
                <div style={{ marginTop: '12px', color: 'white', fontWeight: 'bold' }}>
                  Private Code: <span style={{ letterSpacing: '2px' }}>{rooming.roomCode}</span>
                </div>
              )}

              <div style={{ marginTop: '12px', display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  className="magic-input"
                  value={privateJoinCode}
                  onChange={(e) => setPrivateJoinCode(e.target.value)}
                  placeholder="Join private code (e.g. A7K3)"
                  maxLength={8}
                  style={{ flex: 1 }}
                />
                <button
                  className="magic-join-btn active"
                  onClick={handleJoinPrivateByCode}
                  disabled={isRoomBusy}
                  style={{ width: 'auto', padding: '12px 14px' }}
                >
                  Join
                </button>
              </div>

              <div style={{ marginTop: '12px', maxHeight: '140px', overflow: 'auto', background: 'rgba(0,0,0,0.25)', borderRadius: '12px', padding: '10px' }}>
                {(rooming.availableRooms || []).length === 0 ? (
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>
                    No public rooms found. Click “Refresh List”.
                  </div>
                ) : (
                  (rooming.availableRooms || []).map((r) => (
                    <div key={r.roomId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 6px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      <div style={{ color: 'white', fontSize: '12px' }}>
                        <div style={{ fontWeight: 'bold' }}>{r.metadata?.map || 'Unknown Map'}</div>
                        <div style={{ opacity: 0.8 }}>{r.clients}/{r.maxClients} players</div>
                      </div>
                      <button
                        className="magic-join-btn active"
                        onClick={() => handleJoinPublicRoom(r.roomId)}
                        disabled={isRoomBusy || r.clients >= r.maxClients}
                        style={{ width: 'auto', padding: '10px 12px' }}
                      >
                        Join
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        
      </div>
      
    </div>
    
  )
}
