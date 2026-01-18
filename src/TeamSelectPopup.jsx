import React, { useState, useEffect } from 'react'
import useStore from './store'
import CharacterPreview from './CharacterPreview'
import { MAP_DATA } from './MapComponents'
import audioManager from './AudioManager'

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
  
  const [view, setView] = useState('home') // 'home', 'create', 'customize', 'gamemodes'
  
  const [selectedTeam, setSelectedTeam] = useState('red')
  const [selectedCharacter, setSelectedCharacter] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('playerCharacter') || 'cat'
    }
    return 'cat'
  })
  const [selectedMap, setSelectedMap] = useState('OceanFloor')
  const [difficulty, setDifficulty] = useState('medium')
  const [playerName, setPlayerName] = useState(defaultName || '')
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

  useEffect(() => {
    const handleGlobalClick = (e) => {
      // Check if clicked element is a button or inside a button
      if (e.target.closest('button') || e.target.closest('.option-btn') || e.target.closest('.map-card-large')) {
        audioManager.playSFX('pop')
      }
    }

    window.addEventListener('click', handleGlobalClick)
    return () => window.removeEventListener('click', handleGlobalClick)
  }, [])
  
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

  const handleJoin = async () => {
    if (!validateInputs()) return
    if (!rooming) return

    setIsRoomBusy(true)

    // 1. Find best available room
    // Filter for public rooms that are not full
    const available = (rooming.availableRooms || []).filter(r => 
      r.clients < r.maxClients && 
      (!r.metadata || r.metadata.isPublic !== false) &&
      (!r.metadata || r.metadata.mode === 'standard') // Only join standard matches
    )

    // Sort by creation time (newest first) to join the "last created"
    // Assuming metadata.createdAt exists, otherwise rely on list order
    available.sort((a, b) => {
      const tA = a.metadata?.createdAt || 0
      const tB = b.metadata?.createdAt || 0
      return tB - tA
    })

    if (available.length > 0) {
      // Join the best room
      const targetRoom = available[0]
      await handleJoinPublicRoom(targetRoom.roomId)
    } else {
      // 2. Create new random room
      const randomMap = MAP_DATA[Math.floor(Math.random() * MAP_DATA.length)].id
      const options = {
        name: playerName.trim(),
        team: selectedTeam,
        character: selectedCharacter,
        map: randomMap,
        mode: 'standard'
      }
      
      const joined = await rooming.createPublicRoom(options)
      if (joined) {
        joinGame(playerName.trim(), selectedTeam, selectedCharacter, randomMap)
      } else {
        showNotification('Failed to create room', 'error')
      }
    }
    
    setIsRoomBusy(false)
  }

  const handleCreateRoom = async (mode = 'standard', isPublic = true) => {
    if (!rooming) return
    if (!validateInputs()) return
    setIsRoomBusy(true)
    
    const options = {
      name: playerName.trim(),
      team: selectedTeam,
      character: selectedCharacter,
      map: selectedMap,
      mode: mode,
      isPublic: isPublic
    }

    if (mode === 'training') {
      options.difficulty = difficulty
      options.isPublic = false // Training rooms are private by default
    }

    const joined = await rooming.createPublicRoom(options)
    setIsRoomBusy(false)
    if (joined) {
      joinGame(playerName.trim(), selectedTeam, selectedCharacter, selectedMap)
    } else {
      showNotification('Failed to create room', 'error')
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

  // --- SUB-VIEWS ---

  const [showHelp, setShowHelp] = useState(false)

  const renderHelpModal = () => (
    <div className="help-modal-overlay" onClick={() => setShowHelp(false)}>
      <div className="help-modal-content" onClick={e => e.stopPropagation()}>
        <h2>Controls</h2>
        <div className="keybind-list">
          <div className="keybind-item">
            <span className="key-icon">W</span><span className="key-icon">A</span><span className="key-icon">S</span><span className="key-icon">D</span>
            <span className="key-desc">Move (QWERTY)</span>
          </div>
          <div className="keybind-item">
            <span className="key-icon">Z</span><span className="key-icon">Q</span><span className="key-icon">S</span><span className="key-icon">D</span>
            <span className="key-desc">Move (AZERTY)</span>
          </div>

          <div className="keybind-item">
            <span className="key-icon wide">SPACE</span>
            <span className="key-desc">Jump</span>
          </div>
          <div className="keybind-item">
            <span className="key-icon">F</span> <span className="mouse-icon">🖱️ Left</span>
            <span className="key-desc">Kick</span>
          </div>
          <div className="keybind-item">
            <span className="mouse-icon">🖱️ Move</span>
            <span className="key-desc">Camera</span>
          </div>
        </div>
        <button className="lobby-btn btn-blue btn-small" onClick={() => setShowHelp(false)}>Close</button>
      </div>
    </div>
  )

  const renderHomeView = () => (
    <div className="lobby-center">
      <div className="lobby-logo">
        OMNI<span className="logo-highlight">PITCH</span>
      </div>
      
      <div className="lobby-character-stage">
        <CharacterPreview 
          character={selectedCharacter} 
          team={selectedTeam}
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
            onClick={() => setView('create')}
            disabled={isRoomBusy}
          >
            Create
          </button>
          <button 
            className="lobby-btn btn-blue btn-small"
            onClick={() => setView('join')}
            disabled={isRoomBusy}
          >
            Join Private
          </button>
        </div>
      </div>

      <button className="btn-help" onClick={() => setShowHelp(true)}>?</button>
      {showHelp && renderHelpModal()}
    </div>
  )

  const renderJoinView = () => {
    const [joinCode, setJoinCode] = useState('')
    
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && joinCode.trim()) {
        handleJoinPublicRoom(joinCode.trim())
      }
    }

    return (
      <div className="lobby-center immersive-view">
        <div className="immersive-header">
          <button className="btn-back" onClick={() => setView('home')}>◀ Back</button>
          <h2>Private Match</h2>
          <div className="spacer"></div>
        </div>
        
        <div className="join-private-container">
          <div className="input-valley">
            <div className="valley-label">ENTER CODE</div>
            <input 
              type="text" 
              className="valley-input"
              placeholder="A1B2"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              autoFocus
              maxLength={10}
            />
          </div>
          
          <button 
            className="lobby-btn btn-green btn-large-action"
            onClick={() => handleJoinPublicRoom(joinCode.trim())}
            disabled={!joinCode.trim() || isRoomBusy}
            style={{ marginTop: '40px', minWidth: '200px' }}
          >
            JOIN
          </button>
        </div>
      </div>
    )
  }

  const renderCreateView = () => (
    <div className="lobby-center immersive-view">
      <div className="immersive-header">
        <button className="btn-back" onClick={() => setView('home')}>◀ Back</button>
        <h2>Select Arena</h2>
        <div className="spacer"></div>
      </div>
      
      <div className="map-selection-grid">
        {MAP_DATA.map(map => (
          <div 
            key={map.id} 
            className={`map-card-large ${selectedMap === map.id ? 'selected' : ''}`}
            onClick={() => setSelectedMap(map.id)}
            style={{ backgroundImage: `url(${map.image})` }}
          >
            <div className="map-card-content">
              <div className="map-name">{map.name}</div>
              {selectedMap === map.id && <div className="selected-badge">SELECTED</div>}
            </div>
          </div>
        ))}
      </div>
      
      <div className="match-type-controls">
        <button 
          className="lobby-btn btn-green btn-large-action"
          onClick={() => handleCreateRoom('standard', true)}
          disabled={isRoomBusy}
        >
          Public Match
        </button>
        <button 
          className="lobby-btn btn-purple btn-large-action"
          onClick={() => handleCreateRoom('standard', false)}
          disabled={isRoomBusy}
        >
          Private Match
        </button>
      </div>
    </div>
  )

  const renderCustomizeView = () => (
    <div className="lobby-center immersive-view">
      <div className="immersive-header">
        <button className="btn-back" onClick={() => setView('home')}>◀ Back</button>
        <h2>Customize</h2>
        <div className="spacer"></div>
      </div>

      <div className="customize-layout">
        <div className="customize-preview">
          <CharacterPreview 
            character={selectedCharacter} 
            team={selectedTeam}
            isSelected={true} 
            onSelect={() => {}}
          />
        </div>

        <div className="customize-options">
          <div className="option-group">
            <h3>Team Color</h3>
            <div className="option-row">
              <button 
                className={`option-btn red ${selectedTeam === 'red' ? 'active' : ''}`}
                onClick={() => setSelectedTeam('red')}
              >
                Red Team
              </button>
              <button 
                className={`option-btn blue ${selectedTeam === 'blue' ? 'active' : ''}`}
                onClick={() => setSelectedTeam('blue')}
              >
                Blue Team
              </button>
            </div>
          </div>

          <div className="option-group">
            <h3>Character Model</h3>
            <div className="option-row">
              <button 
                className={`option-btn ${selectedCharacter === 'cat' ? 'active' : ''}`}
                onClick={() => handleCharacterSelect('cat')}
              >
                Cat Striker
              </button>
              <button 
                className={`option-btn ${selectedCharacter === 'car' ? 'active' : ''}`}
                onClick={() => handleCharacterSelect('car')}
              >
                Rocket Car
              </button>
            </div>
          </div>

          <button 
            className="lobby-btn btn-yellow btn-large-action"
            onClick={() => setView('home')}
            style={{ marginTop: 'auto' }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )

  const renderGameModesView = () => (
    <div className="lobby-center immersive-view">
      <div className="immersive-header">
        <button className="btn-back" onClick={() => setView('home')}>◀ Back</button>
        <h2>Game Modes</h2>
        <div className="spacer"></div>
      </div>

      <div className="gamemodes-layout">
        <div className="gamemode-card selected">
          <div className="mode-icon">🤖</div>
          <div className="mode-info">
            <h3>Training</h3>
            <p>1v1 against an AI Bot</p>
          </div>
        </div>

        <div className="difficulty-selector">
          <h3>Difficulty</h3>
          <div className="difficulty-options">
            {['easy', 'medium', 'hard'].map(d => (
              <button 
                key={d}
                className={`difficulty-btn ${difficulty === d ? 'active' : ''}`}
                onClick={() => setDifficulty(d)}
              >
                {d.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <button 
          className="lobby-btn btn-yellow btn-large-action"
          onClick={() => handleCreatePublicRoom('training')}
          disabled={isRoomBusy}
        >
          Start Training
        </button>
      </div>
    </div>
  )

  return (
    <div className="lobby-container">
      {/* Background Grid */}
      <div className="lobby-background"></div>

      {/* Top Bar */}
      <div className="lobby-top-bar">
        <div className="profile-section">
          <div className="level-badge">
            <div className="level-circle">1</div>
          </div>
          
          <div className="player-identity">
            <input 
              type="text" 
              className="lobby-name-input"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength={15}
            />
            <button className="lobby-dice-btn" onClick={() => setPlayerName(generateRandomName())}>🎲</button>
          </div>
        </div>

        <div className="top-right-section">
          <div className="currency-pill">
            <span className="coin-icon">🪙</span>
            <span className="coin-amount">0</span>
          </div>
          <button className="btn-settings" onClick={() => showNotification('Settings coming soon!')}>⚙️</button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="lobby-main">
        {/* Left Sidebar */}
        <div className="lobby-sidebar-left">
          <button 
            className="lobby-btn btn-orange btn-customize"
            onClick={() => setView('customize')}
          >
            <span className="btn-icon">🛠️</span>
            Customize
          </button>

          <button 
            className="lobby-btn btn-blue btn-gamemodes"
            onClick={() => setView('gamemodes')}
            style={{ marginTop: '10px' }}
          >
            <span className="btn-icon">🎮</span>
            Game Modes
          </button>

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

        {/* Center Content (Dynamic View) */}
        {view === 'home' && renderHomeView()}
        {view === 'create' && renderCreateView()}
        {view === 'customize' && renderCustomizeView()}
        {view === 'gamemodes' && renderGameModesView()}

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
