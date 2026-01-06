import React, { useState, useEffect } from 'react'
import useStore from './store'
import CharacterPreview from './CharacterPreview'
import MapSelector from './MapSelector'
import { MAP_DATA } from './MapComponents'

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
  const [notifications, setNotifications] = useState([])

  const showNotification = (message, type = 'info') => {
    const id = Date.now()
    setNotifications(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id))
    }, 3000)
  }

  useEffect(() => {
    if (!rooming || typeof rooming.refreshAvailableRooms !== 'function') return
    rooming.refreshAvailableRooms()
  }, [rooming])

  useEffect(() => {
    if (!rooming || typeof rooming.refreshAvailableRooms !== 'function') return
    const id = setInterval(() => {
      rooming.refreshAvailableRooms()
    }, 1500)
    return () => clearInterval(id)
  }, [rooming])
  
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
      showNotification('Please select a team!', 'warning')
      return false
    }
    if (!playerName.trim()) {
      showNotification('Please enter a name!', 'warning')
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
      showNotification('Failed to create public room', 'error')
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
      showNotification('Failed to create private room', 'error')
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
      showNotification('Failed to join room', 'error')
    }
  }

  const handleJoinPrivateByCode = async () => {
    if (!rooming) return
    if (!validateInputs()) return
    const code = privateJoinCode.trim().toUpperCase()
    if (!code) {
      showNotification('Enter a room code', 'warning')
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
      showNotification('Invalid code or room not found', 'error')
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

          {rooming && (
            <div className="magic-section" style={{ marginTop: '20px' }}>
              <div className="magic-section-header">
                <div className="magic-section-title">Public Rooms</div>
               
              </div>
              
              <div className="rooms-slider">
                {(rooming.availableRooms || []).length === 0 ? (
                  <div className="no-rooms-message">
                    No public rooms found.Refresh List.
                  </div>
                ) : (
                  (rooming.availableRooms || []).map((r) => {
                    const mapInfo = MAP_DATA.find(m => m.id === r.metadata?.map) || MAP_DATA[0]
                    return (
                      <div key={r.roomId} className="room-card-modern">
                        <div className="room-card-image" style={{ backgroundImage: `url(${mapInfo.image})` }}>
                          <div className="room-card-overlay">
                            <div className="room-card-map-name">{mapInfo.name}</div>
                            <div className="room-card-counts">
                              <span className="count-red">{r.metadata?.redCount ?? 0} Red</span>
                              <span className="count-divider">/</span>
                              <span className="count-blue">{r.metadata?.blueCount ?? 0} Blue</span>
                            </div>
                          </div>
                        </div>
                        <button
                          className="room-join-btn"
                          onClick={() => handleJoinPublicRoom(r.roomId)}
                          disabled={isRoomBusy || r.clients >= r.maxClients}
                        >
                          {r.clients >= r.maxClients ? 'FULL' : 'JOIN ARENA'}
                        </button>
                      </div>
                    )
                  })
                )}
              </div>
 <MapSelector 
            selectedMapId={selectedMap} 
            onSelect={setSelectedMap} 
          />
              <div className="room-actions-bar">
                <button
                  className="magic-action-btn"
                  onClick={handleCreatePublicRoom}
                  disabled={isRoomBusy}
                >
                  🌐 Create Public
                </button>
                <button
                  className="magic-action-btn"
                  onClick={handleCreatePrivateRoom}
                  disabled={isRoomBusy}
                >
                  🔒 Create Private
                </button>
              
              </div>

              <div className="private-join-section">
                <input
                  type="text"
                  className="magic-input small"
                  value={privateJoinCode}
                  onChange={(e) => setPrivateJoinCode(e.target.value)}
                  placeholder="Private Code (e.g. A7K3)"
                  maxLength={8}
                />
                <button
                  className="magic-action-btn"
                  onClick={handleJoinPrivateByCode}
                  disabled={isRoomBusy}
                >
                  Join Private
                </button>
              </div>

              {rooming.roomCode && (
                <div className="active-room-code">
                  Your Room Code: <span>{rooming.roomCode}</span>
                </div>
              )}
            </div>
          )}
        </div>
        
      </div>
      
      {/* Modern Notifications */}
      <div className="notification-container">
        {notifications.map(n => (
          <div key={n.id} className={`notification-card ${n.type}`}>
            <div className="notification-icon">
              {n.type === 'warning' ? '⚠️' : n.type === 'error' ? '❌' : 'ℹ️'}
            </div>
            <div className="notification-message">{n.message}</div>
            <div className="notification-progress" />
          </div>
        ))}
      </div>
    </div>
  )
}
