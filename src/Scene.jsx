// Scene.jsx - Main game scene with Colyseus networking
// Server-authoritative pattern: All physics runs on Colyseus server

import React, { useRef, useEffect, useState, Suspense, useCallback, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, Loader, Environment, Preload, ContactShadows } from '@react-three/drei'
import { EffectComposer, SMAA, Bloom, Vignette } from '@react-three/postprocessing'
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
import { SoccerPitch, SoccerGoal, GameSkybox, GoalCelebrationEffect } from './Environment'

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
    isLocked: false
  })

  // Pre-allocated vector for camera target (avoids GC stutters)
  const cameraTarget = useRef(new THREE.Vector3())

  useEffect(() => {
    if (cameraOrbit) {
      cameraOrbit.current = orbit.current
    }
  }, [cameraOrbit])

  useEffect(() => {
    const onPointerLockChange = () => {
      const isLocked = document.pointerLockElement === document.body
      orbit.current.isLocked = isLocked
    }

    const onPointerLockError = (e) => {
      orbit.current.isLocked = false
      console.warn('Pointer lock error:', e)
    }

    const onClick = (e) => {
      // Ignore clicks on buttons, inputs, or interactive elements
      if (
        e.target.tagName === 'BUTTON' || 
        e.target.tagName === 'INPUT' || 
        e.target.closest('button') || 
        e.target.closest('.interactive-ui')
      ) {
        return
      }

      // Request lock
      if (document.pointerLockElement !== document.body) {
        try {
          const maybePromise = document.body.requestPointerLock()
          if (maybePromise && typeof maybePromise.catch === 'function') {
            maybePromise.catch((err) => {
              console.warn('Pointer lock request rejected:', err)
            })
          }
        } catch (err) {
          console.warn('Pointer lock request failed:', err)
        }
      }
    }

    const onMouseMove = (e) => {
      if (document.pointerLockElement !== document.body) return
      
      const sensitivity = 0.002
      orbit.current.azimuth -= e.movementX * sensitivity
      orbit.current.polar -= e.movementY * sensitivity
      orbit.current.polar = Math.max(0.2, Math.min(Math.PI / 2, orbit.current.polar))
    }

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

    document.addEventListener('pointerlockchange', onPointerLockChange)
    document.addEventListener('pointerlockerror', onPointerLockError)
    document.body.addEventListener('click', onClick)
    document.addEventListener('mousemove', onMouseMove)
    window.addEventListener('wheel', onWheel, { passive: true })

    return () => {
      document.removeEventListener('pointerlockchange', onPointerLockChange)
      document.removeEventListener('pointerlockerror', onPointerLockError)
      document.body.removeEventListener('click', onClick)
      document.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('wheel', onWheel)
    }
  }, [])

  useFrame((_, delta) => {
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
    
    // Use pre-allocated vector and frame-rate independent damp
    cameraTarget.current.set(x, y, z)
    camera.position.x = THREE.MathUtils.damp(camera.position.x, cameraTarget.current.x, 15, delta)
    camera.position.y = THREE.MathUtils.damp(camera.position.y, cameraTarget.current.y, 15, delta)
    camera.position.z = THREE.MathUtils.damp(camera.position.z, cameraTarget.current.z, 15, delta)
    
    camera.lookAt(p.x, p.y + 1, p.z)
  }, 1) // Priority 1: Run after player physics (Priority 0)

  return null
}

export default function Scene() {
  // Store state
  const hasJoined = useStore((s) => s.hasJoined)
  const playerName = useStore((s) => s.playerName)
  const playerTeam = useStore((s) => s.playerTeam)
  const playerCharacter = useStore((s) => s.playerCharacter)
  const playerMap = useStore((s) => s.playerMap)
  const leaveGame = useStore((s) => s.leaveGame)
  const setHasJoined = useStore((s) => s.setHasJoined)
  const setPlayerTeam = useStore((s) => s.setPlayerTeam)

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
    onMessage,
    powerUps,
    selectedMap,
    ping: realPing,
    roomCode,
    availableRooms,
    createPublicRoom,
    createPrivateRoom,
    joinRoomById,
    joinPrivateRoomByCode,
    refreshAvailableRooms
  } = useColyseus(SERVER_URL)



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

  useEffect(() => {
    if (!myServerState?.team) return
    if (!playerTeam) return
    if (myServerState.team !== playerTeam) {
      setPlayerTeam(myServerState.team)
    }
  }, [myServerState?.team, playerTeam, setPlayerTeam])

  // Refs
  const playerRef = useRef()
  const isFreeLook = useRef(false)
  const cameraOrbit = useRef(null)
  const lastLocalInteraction = useRef(0)

  // UI State
  const [celebration, setCelebration] = useState(null)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [gameOverData, setGameOverData] = useState(null)
  const [collectedEmoji, setCollectedEmoji] = useState(null)

  // Mobile detection & Performance Optimization
  const [isMobile, setIsMobile] = useState(false)
  const [dpr, setDpr] = useState([1, 2]) // Use automatic DPR clamping instead of manual state

  useEffect(() => {
    let timeoutId = null
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera
      const mobileRegex = /android|avantgo|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i
      const isMob = mobileRegex.test(userAgent) || window.innerWidth < 768
      setIsMobile(isMob)
    }
    
    checkMobile()
    
    const debouncedCheck = () => {
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = setTimeout(checkMobile, 200)
    }

    window.addEventListener('resize', debouncedCheck)
    return () => {
      window.removeEventListener('resize', debouncedCheck)
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [])

  // Connection Quality Logic
  const connectionQuality = React.useMemo(() => {
    if (realPing < 60) return 'excellent'
    if (realPing < 120) return 'good'
    if (realPing < 200) return 'fair'
    return 'poor'
  }, [realPing])

  const showConnectionWarning = realPing > 250

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

  // Endgame sound effect
  useEffect(() => {
    if (gameOverData) {
      const audio = new Audio('/endgame.mp3')
      audio.volume = 0.90
      audio.play().catch(e => console.error("Endgame audio failed:", e))
    }
  }, [gameOverData])

  // Auto-join room when team select completes
  useEffect(() => {
    if (hasJoined && isLaunched && !isConnected) {
      joinRoom({
        name: playerName,
        team: playerTeam,
        character: playerCharacter,
        map: playerMap
      })
    }
  }, [hasJoined, isLaunched, isConnected, joinRoom, playerName, playerTeam, playerCharacter, playerMap])

  // Message listeners
  useEffect(() => {
    if (!isConnected) return

    const unsubGoal = onMessage('goal-scored', (data) => {
      setCelebration({ team: data.team, id: Date.now() })
      
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
        if (playerRef.current && typeof playerRef.current.resetPosition === 'function') {
          const spawn = playerTeam === 'red' ? [-6, 0.1, 0] : [6, 0.1, 0]
          playerRef.current.resetPosition(...spawn)
        }
      }, 3000)
    })

    const unsubReset = onMessage('game-reset', () => {
      if (playerRef.current && typeof playerRef.current.resetPosition === 'function') {
        const spawn = playerTeam === 'red' ? [-6, 0.1, 0] : [6, 0.1, 0]
        playerRef.current.resetPosition(...spawn)
      }
    })

    const unsubOver = onMessage('game-over', (data) => {
      setGameOverData(data)
      
      if (playerRef.current && typeof playerRef.current.resetPosition === 'function') {
        const spawn = playerTeam === 'red' ? [-6, 0.1, 0] : [6, 0.1, 0]
        playerRef.current.resetPosition(...spawn)
      }

      setTimeout(() => {
        setGameOverData(null)
      }, 5000)
    })

    const unsubPowerUp = onMessage('powerup-collected', (data) => {
      if (data.sessionId === me?.sessionId) {
        handleCollectPowerUp(null, data.type)
      }
    })

    return () => {
      if (typeof unsubGoal === 'function') unsubGoal()
      if (typeof unsubReset === 'function') unsubReset()
      if (typeof unsubOver === 'function') unsubOver()
      if (typeof unsubPowerUp === 'function') unsubPowerUp()
    }
  }, [isConnected, onMessage, playerTeam, me])

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

  const handleCollectPowerUp = useCallback((id, type) => {
    // Collection is now handled on the server
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

  const rooming = useMemo(() => ({
    roomCode,
    availableRooms,
    createPublicRoom,
    createPrivateRoom,
    joinRoomById,
    joinPrivateRoomByCode,
    refreshAvailableRooms
  }), [
    roomCode,
    availableRooms,
    createPublicRoom,
    createPrivateRoom,
    joinRoomById,
    joinPrivateRoomByCode,
    refreshAvailableRooms
  ])

  useEffect(() => {
    if (hasJoined) return
    if (!isLaunched) return
    if (typeof refreshAvailableRooms !== 'function') return
    refreshAvailableRooms()
  }, [hasJoined, isLaunched, refreshAvailableRooms])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', touchAction: 'none' }}>
      {!hasJoined ? (
        <TeamSelectPopup
          key="team-select-popup"
          defaultName=""
          rooming={rooming}
        />
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
          <span style={{ color: getConnectionQualityColor(connectionQuality) }}>{realPing}ms</span>
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

      {/* Mobile Debug Indicator */}
      {isMobile && (
        <div style={{
          position: 'absolute',
          top: '5px',
          left: '5px',
          zIndex: 9999,
          color: 'rgba(255,255,255,0.3)',
          fontSize: '10px',
          pointerEvents: 'none'
        }}>
          MOBILE MODE
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

        {roomCode && (
          <div style={{
            background: 'rgba(0,0,0,0.45)',
            color: 'white',
            padding: '6px 14px',
            borderRadius: '999px',
            border: '1px solid rgba(255,255,255,0.12)',
            fontFamily: 'monospace',
            letterSpacing: '2px',
            fontSize: '12px'
          }}>
            CODE: {roomCode}
          </div>
        )}

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
        camera={{ position: [0, 8, 12], fov: 45, near: 0.1, far: 1000 }} 
        dpr={[1, 2]}
        gl={{ 
          antialias: true,
          stencil: false, 
          depth: true, 
          powerPreference: 'high-performance',
          precision: 'highp',
          alpha: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.9,
          outputColorSpace: THREE.SRGBColorSpace,
          logarithmicDepthBuffer: true
        }}
      >
        <Suspense fallback={null}>
          {/* Post-processing - Enabled for all */}
          <EffectComposer multisampling={4}>
            <SMAA />
            <Bloom luminanceThreshold={1} mipmapBlur intensity={0.5} radius={0.6} />
            <Vignette eskil={false} offset={0.1} darkness={0.5} />
          </EffectComposer>

          {/* No client-side physics - server handles all physics */}

          {/* Visuals (rendered for all) */}
         
          
          {/* Map-specific Lighting & Fog */}
          {(() => {
            const mapConfig = MapComponents.MAP_DATA.find(m => m.id === selectedMap) || MapComponents.MAP_DATA[0]
            const ambient = mapConfig.ambientIntensity ?? 0.4
            const direct = mapConfig.lightIntensity ?? 0.8
            const fogColor = mapConfig.fogColor ?? '#87CEEB'
            const fogDensity = mapConfig.fogDensity ?? 0.01
            const envPreset = mapConfig.environmentPreset ?? 'park'
            const ambientColor = mapConfig.ambientColor
            const lightColor = mapConfig.lightColor

            return (
              <>
               <Environment preset={envPreset} environmentIntensity={direct * 0.5} />
                
                <ambientLight intensity={ambient} color={ambientColor} />
                <directionalLight
                  position={[10, 20, 10]}
                  intensity={direct}
                  castShadow
                  shadow-mapSize={[1024, 1024]}
                />
                
                {/* Soft grounding shadows */}
                <ContactShadows 
                  position={[0, 0.01, 0]} 
                  opacity={0.6} 
                  scale={32} 
                  blur={2} 
                  far={4} 
                  resolution={512} 
                  color="#000000"
                />
              </>
            )
          })()}
          

          


          <SoccerPitch isMobile={false} />
          <MapComponents.MapRenderer mapId={selectedMap} />

          {/* Ball - interpolated from server state */}
          <ClientBallVisual ballState={ballState} onKickMessage={onMessage} localPlayerRef={playerRef} />

          {/* Goals (visual only) */}
          <SoccerGoal position={[-11.2, 0, 0]} rotation={[0, 0, 0]} netColor="#ff4444" />
          <SoccerGoal position={[11.2, 0, 0]} rotation={[0, -Math.PI, 0]} netColor="#4444ff" />

          {/* Goal celebration (front net zone effect) */}
          {celebration && <GoalCelebrationEffect key={celebration.id} team={celebration.team} />}

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
              powerUps={[]} // No longer needed locally
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

          {/* Power-ups from server */}
          {powerUps && powerUps.map(p => (
            <PowerUp
              key={p.id}
              position={[p.x, p.y, p.z]}
              type={p.type}
            />
          ))}

          {/* Preload models to avoid pop-in and improve slow network handling */}
          <Preload all />
        </Suspense>
      </Canvas>

      {/* Loading Screen */}
      <Loader 
        containerStyles={{ background: 'rgba(10,10,15,0.95)', backdropFilter: 'blur(10px)' }}
        innerStyles={{ background: '#2d3436', height: '4px', width: '200px' }}
        barStyles={{ background: '#3742fa', height: '4px' }}
        dataStyles={{ color: 'white', fontFamily: 'Inter, sans-serif', fontWeight: 'bold' }}
        dataInterpolation={(p) => `LOADING STADIUM ${p.toFixed(0)}%`}
      />

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
