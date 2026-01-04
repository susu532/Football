// Scene.jsx - Main game scene with Colyseus networking
// Server-authoritative pattern: All physics runs on Colyseus server

import React, { useRef, useEffect, useState, Suspense, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, Loader, Environment } from '@react-three/drei'
import * as THREE from 'three'


import { useColyseus } from './useColyseus.jsx'
import useStore from './store'

import TeamSelectPopup from './TeamSelectPopup'
import { PowerUp, POWER_UP_TYPES } from './PowerUp'
import MobileControls from './MobileControls'
import InputManager from './InputManager'
import * as MapComponents from './MapComponents'
import Chat from './Chat'

import { ClientBallVisual } from './Ball'
import { LocalPlayer, ClientPlayerVisual } from './PlayerSync'
import { SoccerPitch, SoccerGoal, GameSkybox } from './Environment'

const CSS_ANIMATIONS = `
  @keyframes popIn {
    from { transform: scale(0.8); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`

// Server URL - change for production
const SERVER_URL = import.meta.env.VITE_COLYSEUS_SERVER || 'ws://localhost:2567'

// Camera Controller
function CameraController({ targetRef, isFreeLook, cameraOrbit }) {
  const { camera } = useThree()
  const orbit = useRef({
    azimuth: 0,
    polar: Math.PI / 4,
    distance: 8,
    targetDistance: 8,
    dragging: false,
    lastX: 0,
    lastY: 0,
  })

  useEffect(() => {
    if (cameraOrbit) {
      cameraOrbit.current = orbit.current
    }
  }, [cameraOrbit])

  useEffect(() => {
    const onPointerDown = (e) => {
      if (e.target.closest('.mobile-controls') || e.target.closest('.joystick-container') || e.target.closest('.action-buttons')) {
        return
      }
      if (e.pointerType === 'touch') return
      if (e.button !== 0 && e.button !== 2) return

      orbit.current.dragging = true
      orbit.current.lastX = e.clientX
      orbit.current.lastY = e.clientY

      if (e.button === 2 && isFreeLook) {
        isFreeLook.current = true
      }
    }

    const onPointerUp = () => {
      orbit.current.dragging = false
      if (isFreeLook) {
        isFreeLook.current = false
      }
    }

    const onPointerMove = (e) => {
      if (!orbit.current.dragging) return
      const dx = e.clientX - orbit.current.lastX
      const dy = e.clientY - orbit.current.lastY
      orbit.current.lastX = e.clientX
      orbit.current.lastY = e.clientY
      orbit.current.azimuth -= dx * 0.01
      orbit.current.polar -= dy * 0.01
      orbit.current.polar = Math.max(0.2, Math.min(Math.PI / 2, orbit.current.polar))
    }

    const onContextMenu = (e) => e.preventDefault()

    const onWheel = (e) => {
      const delta = e.deltaY
      const zoomSensitivity = 0.025
      const minDistance = 3
      const maxDistance = 18
      orbit.current.targetDistance = THREE.MathUtils.clamp(
        orbit.current.targetDistance + delta * zoomSensitivity, 
        minDistance, 
        maxDistance
      )
    }

    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('contextmenu', onContextMenu)
    window.addEventListener('wheel', onWheel, { passive: true })

    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('contextmenu', onContextMenu)
      window.removeEventListener('wheel', onWheel)
    }
  }, [isFreeLook])

  useFrame(() => {
    const p = (targetRef.current && targetRef.current.position) || { x: 0, y: 0, z: 0 }
    const { azimuth, polar } = orbit.current
    orbit.current.distance = THREE.MathUtils.lerp(
      orbit.current.distance, 
      orbit.current.targetDistance ?? orbit.current.distance, 
      0.12
    )
    const distance = orbit.current.distance
    const x = p.x + distance * Math.sin(polar) * Math.sin(azimuth)
    const y = p.y + distance * Math.cos(polar) + 2.2
    const z = p.z + distance * Math.sin(polar) * Math.cos(azimuth)
    camera.position.lerp(new THREE.Vector3(x, y, z), 0.15)
    camera.lookAt(p.x, p.y + 1, p.z)
  })

  return null
}

export default function Scene() {
  // Store state
  const hasJoined = useStore((s) => s.hasJoined)
  const playerName = useStore((s) => s.playerName)
  const playerTeam = useStore((s) => s.playerTeam)
  const playerCharacter = useStore((s) => s.playerCharacter)
  const leaveGame = useStore((s) => s.leaveGame)
  const setHasJoined = useStore((s) => s.setHasJoined)

  // Colyseus state
  const {
    isLaunched,
    isConnected,
    joinRoom,
    leaveRoom,
    players,
    ballState,
    scores,
    gameState,
    gameTimer,
    isHost,
    me,
    sendInput,
    sendKick,
    sendChat,
    startGame,
    endGame,
    onMessage
  } = useColyseus(SERVER_URL)

  // Adaptive shadow quality
  const [shadowMapSize, setShadowMapSize] = useState(2048)
  useEffect(() => {
    const isMobile = window.innerWidth < 768 || 'ontouchstart' in window
    setShadowMapSize(isMobile ? 1024 : 2048)
  }, [])

  // Remote players filter
  const remotePlayers = React.useMemo(() => {
    if (!me) return players
    return players.filter(p => p.sessionId !== me.sessionId)
  }, [players, me])

  // Get my player state from server for reconciliation
  const myServerState = React.useMemo(() => {
    if (!me) return null
    return players.find(p => p.sessionId === me.sessionId)
  }, [players, me])

  // Refs
  const playerRef = useRef()
  const isFreeLook = useRef(false)
  const cameraOrbit = useRef(null)
  const lastLocalInteraction = useRef(0)

  // UI State
  const [celebration, setCelebration] = useState(null)
  const [activePowerUps, setActivePowerUps] = useState([])
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [connectionQuality] = useState('excellent')
  const [ping] = useState(0)
  const [showConnectionWarning] = useState(false)
  const [gameOverData, setGameOverData] = useState(null)
  const [collectedEmoji, setCollectedEmoji] = useState(null)

  // Stable player props
  const spawnPosition = React.useMemo(() => (
    playerTeam === 'red' ? [-6, 0.1, 0] : [6, 0.1, 0]
  ), [playerTeam])

  const teamColor = React.useMemo(() => (
    playerTeam === 'red' ? '#ff4444' : '#4488ff'
  ), [playerTeam])

  // Inject CSS animations
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = CSS_ANIMATIONS
    document.head.appendChild(style)
    return () => document.head.removeChild(style)
  }, [])

  // Auto-join room when team select completes
  useEffect(() => {
    if (hasJoined && isLaunched && !isConnected) {
      joinRoom({
        name: playerName,
        team: playerTeam,
        character: playerCharacter
      })
    }
  }, [hasJoined, isLaunched, isConnected, joinRoom, playerName, playerTeam, playerCharacter])

  // Message listeners
  useEffect(() => {
    if (!isConnected) return

    const unsubGoal = onMessage('goal-scored', (data) => {
      setCelebration({ team: data.team })
      
      const audio = new Audio('/winner-game-sound-404167.mp3')
      audio.volume = 0.03
      audio.play().catch(e => console.error("Audio play failed:", e))
      
      setTimeout(() => {
        audio.pause()
        audio.currentTime = 0
      }, 3000)
      
      setTimeout(() => setCelebration(null), 3000)

      // Reset local player position
      setTimeout(() => {
        if (playerRef.current) {
          const spawn = playerTeam === 'red' ? [-6, 0.1, 0] : [6, 0.1, 0]
          playerRef.current.position.set(...spawn)
        }
      }, 3000)
    })

    const unsubReset = onMessage('game-reset', () => {
      if (playerRef.current) {
        const spawn = playerTeam === 'red' ? [-6, 0.1, 0] : [6, 0.1, 0]
        playerRef.current.position.set(...spawn)
      }
    })

    const unsubOver = onMessage('game-over', (data) => {
      setGameOverData(data)
      
      const audio = new Audio('/endgame.mp3')
      audio.volume = 0.05
      audio.play().catch(e => console.error("Audio play failed:", e))
      
      if (playerRef.current) {
        const spawn = playerTeam === 'red' ? [-6, 0.1, 0] : [6, 0.1, 0]
        playerRef.current.position.set(...spawn)
      }

      setTimeout(() => {
        setGameOverData(null)
        audio.pause()
        audio.currentTime = 0
      }, 5000)
    })

    return () => {
      if (typeof unsubGoal === 'function') unsubGoal()
      if (typeof unsubReset === 'function') unsubReset()
      if (typeof unsubOver === 'function') unsubOver()
    }
  }, [isConnected, onMessage, playerTeam])

  // Connection quality color helper
  const getConnectionQualityColor = (quality) => {
    switch (quality) {
      case 'excellent': return '#00ff00'
      case 'good': return '#ffff00'
      case 'fair': return '#ffa500'
      case 'poor': return '#ff0000'
      default: return '#888'
    }
  }

  // Mobile control callbacks
  const handleMobileMove = useCallback((x, y) => {
    InputManager.setMobileMove(x, y)
  }, [])

  const handleMobileJump = useCallback(() => {
    InputManager.setMobileJump()
  }, [])

  const handleMobileKick = useCallback(() => {
    InputManager.setMobileKick()
  }, [])

  const handleMobileCameraMove = useCallback((dx, dy) => {
    if (cameraOrbit.current) {
      cameraOrbit.current.azimuth -= dx * 0.01
      cameraOrbit.current.polar -= dy * 0.01
      cameraOrbit.current.polar = Math.max(0.2, Math.min(Math.PI / 2, cameraOrbit.current.polar))
    }
  }, [])

  const handleLocalInteraction = useCallback(() => {
    lastLocalInteraction.current = Date.now()
  }, [])

  // Power-up spawning
  useEffect(() => {
    if (!hasJoined) return

    const spawnPowerUp = () => {
      const types = Object.values(POWER_UP_TYPES)
      const randomType = types[Math.floor(Math.random() * types.length)]

      const newPowerUp = {
        id: Math.random().toString(36).substr(2, 9),
        type: randomType.id,
        position: [
          (Math.random() - 0.5) * 28,
          0.2,
          (Math.random() - 0.5) * 18
        ]
      }

      setActivePowerUps([newPowerUp])

      setTimeout(() => {
        setActivePowerUps(prev => prev.filter(p => p.id !== newPowerUp.id))
      }, 5000)
    }

    spawnPowerUp()
    const interval = setInterval(spawnPowerUp, 20000)
    return () => clearInterval(interval)
  }, [hasJoined])

  const handleCollectPowerUp = useCallback((id, type) => {
    setActivePowerUps(prev => prev.filter(p => p.id !== id))
    
    const powerUpKey = Object.keys(POWER_UP_TYPES).find(key => POWER_UP_TYPES[key].id === type)
    if (powerUpKey) {
      setCollectedEmoji(POWER_UP_TYPES[powerUpKey].label)
      setTimeout(() => setCollectedEmoji(null), 15000)
    }
  }, [])

  // Handle leave
  const handleLeave = useCallback(() => {
    setShowExitConfirm(false)
    leaveRoom()
    leaveGame()
  }, [leaveRoom, leaveGame])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {!hasJoined ? (
        <TeamSelectPopup key="team-select-popup" defaultName="" />
      ) : (
        <div className="game-content-wrapper" style={{ width: '100%', height: '100%' }}>
          {/* Connection Status */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        zIndex: 9999,
        background: 'rgba(0,0,0,0.5)',
        padding: '10px 20px',
        borderRadius: '12px',
        color: 'white',
        fontSize: '18px',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        border: '1px solid rgba(255,255,255,0.2)',
        backdropFilter: 'blur(5px)',
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: '5px'
      }}>
        <div style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: isConnected ? '#00ff00' : '#ff0000' }}>
            ● {isConnected ? 'CONNECTED' : 'CONNECTING...'}
          </span>
          <span>{ping}ms</span>
          {isHost && <span style={{ color: '#ffd700' }}>★ HOST</span>}
        </div>
      </div>

      {/* Connection Warning */}
      {showConnectionWarning && (
        <div style={{
          position: 'absolute',
          top: '80px',
          left: '20px',
          zIndex: 9999,
          background: 'rgba(255, 0, 0, 0.7)',
          padding: '10px 15px',
          borderRadius: '8px',
          color: 'white',
          fontSize: '12px',
          fontWeight: 'bold',
          backdropFilter: 'blur(5px)'
        }}>
          ⚠️ POOR CONNECTION - PLAYERS MAY DESYNC
        </div>
      )}

      {/* Exit Button */}
      <button
        onClick={() => setShowExitConfirm(true)}
        style={{
          position: 'absolute',
          top: '20px',
          left: '180px',
          zIndex: 9999,
          background: 'rgba(255,71,87,0.5)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '12px',
          color: 'white',
          padding: '10px',
          cursor: 'pointer',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '18px',
          transition: 'all 0.2s'
        }}
        title="Exit to Menu"
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,71,87,0.7)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,71,87,0.5)'}
      >
        🚪
      </button>

      {/* Fullscreen Button */}
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        zIndex: 9999,
        display: 'flex',
        gap: '10px'
      }}>
        <button
          onClick={() => {
            const elem = document.documentElement
            if (!document.fullscreenElement) {
              elem.requestFullscreen()
            } else {
              document.exitFullscreen()
            }
          }}
          style={{
            background: 'rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '12px',
            color: 'white',
            padding: '10px',
            cursor: 'pointer',
            backdropFilter: 'blur(5px)'
          }}
        >
          ⛶
        </button>
      </div>

      {/* Scoreboard & Timer */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px'
      }}>
        <div style={{
          display: 'flex',
          gap: '20px',
          background: 'rgba(0,0,0,0.6)',
          padding: '10px 30px',
          borderRadius: '20px',
          border: '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(10px)',
          alignItems: 'center'
        }}>
          <div style={{ color: '#ff4757', fontSize: '32px', fontWeight: 'bold' }}>{scores?.red ?? 0}</div>
          <div style={{ 
            color: 'white', 
            fontSize: '24px', 
            fontWeight: 'bold',
            minWidth: '80px',
            textAlign: 'center',
            fontFamily: 'monospace'
          }}>
            {Math.floor((gameTimer || 300) / 60)}:{((gameTimer || 300) % 60).toString().padStart(2, '0')}
          </div>
          <div style={{ color: '#3742fa', fontSize: '32px', fontWeight: 'bold' }}>{scores?.blue ?? 0}</div>
        </div>

        {/* Host Controls */}
        {isHost && (
          <div style={{ display: 'flex', gap: '10px' }}>
            {gameState !== 'playing' ? (
              <button
                onClick={startGame}
                style={{
                  background: '#2ecc71',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(46, 204, 113, 0.3)'
                }}
              >
                START GAME
              </button>
            ) : (
              <button
                onClick={endGame}
                style={{
                  background: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(231, 76, 60, 0.3)'
                }}
              >
                END GAME
              </button>
            )}
          </div>
        )}
      </div>

      {/* 3D Canvas */}
      <Canvas 
        shadows 
        camera={{ position: [0, 8, 12], fov: 45 }} 
        dpr={[1, 2]}
        gl={{ 
          antialias: true, 
          stencil: false, 
          depth: true, 
          powerPreference: 'high-performance',
          alpha: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.7
        }}
      >
        <Suspense fallback={null}>
          {/* No client-side physics - server handles all physics */}

          {/* Visuals (rendered for all) */}
          <GameSkybox />
          <Environment preset="city" environmentIntensity={0.5} />
          <ambientLight intensity={0.15} />
          <directionalLight
            position={[10, 20, 10]}
            intensity={0.5}
            castShadow
            shadow-mapSize={[shadowMapSize, shadowMapSize]}
            shadow-camera-left={-20}
            shadow-camera-right={20}
            shadow-camera-top={20}
            shadow-camera-bottom={-20}
          />
          

          


          <SoccerPitch />
          <MapComponents.MysteryShack />

          {/* Ball - interpolated from server state */}
          <ClientBallVisual ballState={ballState} onKickMessage={onMessage} />

          {/* Goals (visual only) */}
          <SoccerGoal position={[-11.2, 0, 0]} rotation={[0, 0, 0]} netColor="#ff4444" />
          <SoccerGoal position={[11.2, 0, 0]} rotation={[0, -Math.PI, 0]} netColor="#4444ff" />

          {/* Local Player */}
          {me && (
            <LocalPlayer
              ref={playerRef}
              me={me}
              sendInput={sendInput}
              sendKick={sendKick}
              playerName={playerName}
              playerTeam={playerTeam}
              teamColor={teamColor}
              characterType={playerCharacter}
              spawnPosition={spawnPosition}
              powerUps={activePowerUps}
              onCollectPowerUp={handleCollectPowerUp}
              isFreeLook={isFreeLook}
              onLocalInteraction={handleLocalInteraction}
              serverState={myServerState}
            />
          )}

          {/* Remote Players */}
          {remotePlayers.map((p) => (
            <ClientPlayerVisual key={p.sessionId} player={p} />
          ))}

          <CameraController targetRef={playerRef} isFreeLook={isFreeLook} cameraOrbit={cameraOrbit} />

          {/* Power-ups */}
          {activePowerUps.map(p => (
            <PowerUp
              key={p.id}
              position={p.position}
              type={Object.keys(POWER_UP_TYPES).find(key => POWER_UP_TYPES[key].id === p.type)}
            />
          ))}
        </Suspense>
      </Canvas>

      {/* Mobile Controls */}
      {hasJoined && (
        <MobileControls
          onMove={handleMobileMove}
          onJump={handleMobileJump}
          onKick={handleMobileKick}
          onCameraMove={handleMobileCameraMove}
        />
      )}

      {/* Chat Box */}
      <Chat 
        playerName={playerName} 
        playerTeam={playerTeam} 
        sendChat={sendChat}
        onMessage={onMessage}
      />

      {/* Exit Confirmation Modal */}
      {showExitConfirm && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 20000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(10px)',
          animation: 'fadeIn 0.3s ease-out'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(20,20,30,0.9), rgba(40,40,60,0.9))',
            padding: '40px',
            borderRadius: '24px',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5), 0 0 20px rgba(255,71,87,0.2)',
            textAlign: 'center',
            maxWidth: '400px',
            width: '90%',
            animation: 'popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
          }}>
            <div style={{ fontSize: '64px', marginBottom: '20px' }}>🚪</div>
            <h2 style={{
              color: 'white',
              fontSize: '28px',
              margin: '0 0 15px 0',
              fontWeight: '900',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              Leaving so soon?
            </h2>
            <p style={{
              color: 'rgba(255,255,255,0.7)',
              fontSize: '16px',
              margin: '0 0 30px 0',
              lineHeight: '1.5'
            }}>
              Are you sure you want to leave the match? Your current score will be lost.
            </p>
            <div style={{ display: 'flex', gap: '15px' }}>
              <button
                onClick={() => setShowExitConfirm(false)}
                style={{
                  flex: 1,
                  padding: '15px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'white',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              >
                STAY
              </button>
              <button
                onClick={handleLeave}
                style={{
                  flex: 1,
                  padding: '15px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(45deg, #ff4757, #ff6b81)',
                  color: 'white',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: '0 5px 15px rgba(255,71,87,0.4)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 8px 20px rgba(255,71,87,0.6)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 5px 15px rgba(255,71,87,0.4)'
                }}
              >
                LEAVE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overlays (Goal & Game Over) */}
      {celebration && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 10000,
          fontSize: '80px',
          fontWeight: 'bold',
          color: celebration.team === 'red' ? '#ff4757' : '#3742fa',
          textShadow: '0 0 20px rgba(255,255,255,0.8)',
          animation: 'popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}>
          GOAL!
        </div>
      )}

      {gameOverData && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 30000,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(15px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          animation: 'fadeIn 0.5s ease-out'
        }}>
          <h1 style={{ 
            fontSize: '80px', 
            margin: '0 0 20px 0', 
            fontWeight: '900',
            textShadow: '0 0 30px rgba(255,255,255,0.3)'
          }}>
            END GAME!
          </h1>
          
          <div style={{
            fontSize: '48px',
            fontWeight: 'bold',
            color: gameOverData.winner === 'red' ? '#ff4757' : (gameOverData.winner === 'blue' ? '#3742fa' : '#ffffff'),
            marginBottom: '40px',
            textTransform: 'uppercase',
            letterSpacing: '4px'
          }}>
            {gameOverData.winner === 'draw' ? "IT'S A DRAW!" : `${gameOverData.winner.toUpperCase()} TEAM WINS!`}
          </div>

          <div style={{
            display: 'flex',
            gap: '60px',
            background: 'rgba(255,255,255,0.1)',
            padding: '30px 60px',
            borderRadius: '30px',
            border: '1px solid rgba(255,255,255,0.2)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#ff4757', fontSize: '24px', marginBottom: '10px' }}>RED</div>
              <div style={{ fontSize: '64px', fontWeight: '900' }}>{gameOverData.scores.red}</div>
            </div>
            <div style={{ fontSize: '64px', fontWeight: '900', opacity: 0.5 }}>-</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#3742fa', fontSize: '24px', marginBottom: '10px' }}>BLUE</div>
              <div style={{ fontSize: '64px', fontWeight: '900' }}>{gameOverData.scores.blue}</div>
            </div>
          </div>
        </div>
      )}
      </div>
    )}

      {/* Power-up Collection Overlay */}
      {collectedEmoji && (
        <div style={{
          position: 'absolute',
          top: '80px',
          right: '0px',
          zIndex: 10000,
          fontSize: '80px',
          background: 'linear-gradient(135deg, rgba(20,20,30,0.9), rgba(40,40,60,0.9))',
          padding: '5px',
          borderRadius: '24px',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
          animation: 'popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          pointerEvents: 'none'
        }}>
          {collectedEmoji}
        </div>
      )}
    </div>
  )
}
