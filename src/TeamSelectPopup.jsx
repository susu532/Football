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
  const [joinCode, setJoinCode] = useState('')

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

    const joined = isPublic 
      ? await rooming.createPublicRoom(options)
      : await rooming.createPrivateRoom(options)
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

  const handleJoinPrivateCode = async (code) => {
    if (!rooming) return
    if (!validateInputs()) return
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
      showNotification('Invalid or expired code', 'error')
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
    
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && joinCode.trim().length === 4) {
        handleJoinPrivateCode(joinCode.trim())
      }
    }

    return (
      <div className="lobby-center immersive-view">
        <div className="immersive-header">
          <button className="btn-back" onClick={() => setView('home')}>◀ Back</button>
          <h2>Join Private Match</h2>
          <div className="spacer"></div>
        </div>
        
        <div className="join-private-container" style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '60%',
          gap: '40px'
        }}>
          <div className="input-valley" style={{
            background: 'rgba(255, 255, 255, 0.05)',
            padding: '40px',
            borderRadius: '32px',
            border: '2px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '20px',
            width: '100%',
            maxWidth: '500px'
          }}>
            <div className="valley-label" style={{
              fontSize: '18px',
              fontWeight: 'bold',
              color: '#4488ff',
              letterSpacing: '2px'
            }}>ENTER ROOM CODE</div>
            <input 
              type="text" 
              className="valley-input"
              placeholder="----"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              autoFocus
              maxLength={4}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: '4px solid #4488ff',
                color: 'white',
                fontSize: '80px',
                textAlign: 'center',
                width: '100%',
                outline: 'none',
                fontFamily: 'monospace',
                letterSpacing: '10px',
                padding: '10px 0'
              }}
            />
          </div>
          
          <button 
            className="lobby-btn btn-green btn-large-action"
            onClick={() => handleJoinPrivateCode(joinCode.trim())}
            disabled={joinCode.trim().length !== 4 || isRoomBusy}
            style={{ 
              fontSize: '24px',
              padding: '20px 60px',
              borderRadius: '20px',
              boxShadow: '0 10px 30px rgba(46, 204, 113, 0.3)'
            }}
          >
            {isRoomBusy ? 'JOINING...' : 'JOIN MATCH'}
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
      
      <div className="map-scroll-container">
        <div className="map-grid-new">
          {MAP_DATA.map(map => (
            <div 
              key={map.id} 
              className={`map-card-new ${selectedMap === map.id ? 'selected' : ''}`}
              onClick={() => setSelectedMap(map.id)}
              style={{ backgroundImage: `url(${map.image})` }}
            >
              <div className="map-card-overlay">
                <div className="map-card-info">
                  <div className="map-name-large">{map.name}</div>
                  <div className="map-description">Professional Turf Arena</div>
                </div>
                {selectedMap === map.id && (
                  <div className="map-selected-indicator">
                    <span className="check-icon">✓</span>
                    SELECTED
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
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
          onClick={() => handleCreateRoom('training', false)}
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
        <div className="top-bar-left">
          <button className="btn-settings" onClick={() => useStore.getState().setShowSettings(true)}>⚙️</button>
        </div>

        <div className="top-bar-right">
          <div className="player-profile-card" style={{
            transform: 'scale(1.2)',
            transformOrigin: 'right top',
            background: 'rgba(25, 25, 40, 0.7)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            padding: '12px 24px', // Increased horizontal padding
            borderRadius: '20px',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '20px' // Increased gap
          }}>
            <div className="avatar-wrapper" style={{ 
              width: '54px', 
              height: '54px',
              position: 'relative'
            }}>
              <div className="avatar-placeholder" style={{ 
                fontSize: '32px',
                background: 'linear-gradient(135deg, #4488ff, #3742fa)',
                borderRadius: '16px',
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 15px rgba(55, 66, 250, 0.3)'
              }}>
                <span className="avatar-icon">👤</span>
              </div>
              <div className="level-badge-mini" style={{
                position: 'absolute',
                bottom: '-5px',
                right: '-5px',
                background: 'linear-gradient(135deg, #ffd700, #ffa500)',
                color: '#000',
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                fontSize: '12px',
                fontWeight: '900',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid #1a1a2e',
                boxShadow: '0 0 10px rgba(255, 215, 0, 0.5)'
              }}>1</div>
            </div>
            
            <div className="profile-details" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div className="profile-name-row" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input 
                  type="text" 
                  className="profile-name-input"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  maxLength={15}
                  style={{ 
                    fontSize: '18px', 
                    fontWeight: '800',
                    background: 'none',
                    border: 'none',
                    color: 'white',
                    padding: '0',
                    width: '160px', // Increased width from 120px
                    outline: 'none',
                    letterSpacing: '0.5px'
                  }}
                />
                <button 
                  className="profile-dice-btn" 
                  onClick={() => setPlayerName(generateRandomName())}
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '4px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                >🎲</button>
              </div>
              
              <div className="profile-stats-row">
                <div className="stat-item" style={{
                  background: 'rgba(255, 215, 0, 0.1)',
                  padding: '2px 12px', // Slightly more padding
                  borderRadius: '20px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  border: '1px solid rgba(255, 215, 0, 0.2)'
                }}>
                  <span className="stat-icon" style={{ fontSize: '14px' }}>🪙</span>
                  <span className="stat-value" style={{ 
                    fontSize: '13px', 
                    fontWeight: 'bold',
                    color: '#ffd700'
                  }}>0</span>
                </div>
              </div>
            </div>
          </div>
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
            style={{ marginTop: '10px', height: '60px', fontSize: '18px' }}
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
        {view === 'join' && renderJoinView()}
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
