import React, { useState, useEffect } from 'react'
import useStore from './store'
import CharacterPreview from './CharacterPreview'
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
  
  const [selectedTeam, setSelectedTeam] = useState('red')
  const [selectedCharacter, setSelectedCharacter] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('playerCharacter') || 'cat'
    }
    return 'cat'
  })
  const [selectedMap, setSelectedMap] = useState('OceanFloor')
  const [playerName, setPlayerName] = useState(defaultName || '')
  const [showCustomize, setShowCustomize] = useState(false)
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
    const id = setInterval(() => {
      rooming.refreshAvailableRooms()
    }, 3000)
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

  return (
    <div className="lobby-container">
      {/* Background Grid */}
      <div className="lobby-background"></div>

      {/* Top Bar */}
      <div className="lobby-top-bar">
        <div className="level-badge">
          <div className="level-circle">1</div>
          <div className="level-text">Level Up!</div>
        </div>
        
        <div className="player-identity-pill">
          <input 
            type="text" 
            className="lobby-name-input"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            maxLength={15}
          />
          <button className="lobby-dice-btn" onClick={() => setPlayerName(generateRandomName())}>🎲</button>
        </div>

        <div className="currency-pill">
          <span className="coin-icon">🪙</span>
          <span className="coin-amount">0</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="lobby-main">
        {/* Left Sidebar */}
        <div className="lobby-sidebar-left">
          <button 
            className="lobby-btn btn-orange btn-customize"
            onClick={() => setShowCustomize(!showCustomize)}
          >
            <span className="btn-icon">🛠️</span>
            Customize
          </button>

          {showCustomize && (
            <div className="customize-panel">
              <div className="panel-section">
                <h3>Team</h3>
                <div className="team-toggles">
                  <button 
                    className={`team-toggle red ${selectedTeam === 'red' ? 'active' : ''}`}
                    onClick={() => setSelectedTeam('red')}
                  >Red</button>
                  <button 
                    className={`team-toggle blue ${selectedTeam === 'blue' ? 'active' : ''}`}
                    onClick={() => setSelectedTeam('blue')}
                  >Blue</button>
                </div>
              </div>
              <div className="panel-section">
                <h3>Character</h3>
                <div className="char-toggles">
                  <button 
                    className={`char-toggle ${selectedCharacter === 'cat' ? 'active' : ''}`}
                    onClick={() => handleCharacterSelect('cat')}
                  >Cat</button>
                  <button 
                    className={`char-toggle ${selectedCharacter === 'car' ? 'active' : ''}`}
                    onClick={() => handleCharacterSelect('car')}
                  >Car</button>
                </div>
              </div>
            </div>
          )}

          <div className="news-panel">
            <div className="news-header">News ℹ️</div>
            <div className="news-item">
              <div className="news-icon">🏆</div>
              <div className="news-text">Season 1: Kickoff!</div>
            </div>
            <div className="news-item">
              <div className="news-icon">❄️</div>
              <div className="news-text">Winter Update</div>
            </div>
          </div>
        </div>

        {/* Center Character & Play */}
        <div className="lobby-center">
          <div className="lobby-logo">
            OMNI<span className="logo-highlight">PITCH</span>
          </div>
          
          <div className="lobby-character-stage">
            <CharacterPreview 
              character={selectedCharacter} 
              isSelected={true} 
              onSelect={() => {}}
            />
          </div>

          <div className="play-controls">
            <button className="lobby-btn btn-yellow btn-play" onClick={handleJoin}>
              <span className="play-icon">▶</span> PLAY
            </button>
            
            <div className="sub-controls">
              <button 
                className="lobby-btn btn-blue btn-small"
                onClick={handleCreatePublicRoom}
                disabled={isRoomBusy}
              >
                Create
              </button>
              <button 
                className="lobby-btn btn-blue btn-small"
                onClick={() => rooming?.refreshAvailableRooms()}
                disabled={isRoomBusy}
              >
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Right Sidebar - Rooms */}
        <div className="lobby-sidebar-right">
          <div className="rooms-panel">
            <div className="rooms-header">Live Arenas</div>
            <div className="rooms-list">
              {(rooming?.availableRooms || []).length === 0 ? (
                <div className="no-rooms">No active arenas...</div>
              ) : (
                (rooming.availableRooms || []).map((r) => (
                  <div key={r.roomId} className="room-item">
                    <div className="room-info">
                      <div className="room-map">{MAP_DATA.find(m => m.id === r.metadata?.map)?.name || 'Arena'}</div>
                      <div className="room-players">
                        <span className="red-dot">●</span> {r.metadata?.redCount || 0}
                        <span className="blue-dot">●</span> {r.metadata?.blueCount || 0}
                      </div>
                    </div>
                    <button 
                      className="btn-join-small"
                      onClick={() => handleJoinPublicRoom(r.roomId)}
                      disabled={r.clients >= r.maxClients}
                    >
                      {r.clients >= r.maxClients ? 'FULL' : 'JOIN'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
          
          <div className="ad-placeholder">
            <span>DOWNLOAD THE APP</span>
            <div className="app-store-badges">
              <div className="badge">App Store</div>
              <div className="badge">Google Play</div>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="notification-container">
        {notifications.map(n => (
          <div key={n.id} className={`notification-card ${n.type}`}>
            {n.message}
          </div>
        ))}
      </div>
    </div>
  )
}

