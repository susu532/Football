import React, { useRef, useEffect, useState, Suspense, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, Loader } from '@react-three/drei'
import * as THREE from 'three'
import CharacterSkin from './CharacterSkin'
import useStore from './store'
import { Physics } from '@react-three/rapier'

import { usePlayroom } from './usePlayroom'
import { RPC } from 'playroomkit'
import TeamSelectPopup from './TeamSelectPopup'
import { PowerUp, POWER_UP_TYPES } from './PowerUp'
import MobileControls from './MobileControls'
import * as MapComponents from './MapComponents'
import { SoccerBall, HostBall, ClientBall } from './Ball'
import { LocalPlayerWithSync, RemotePlayerWithPhysics } from './PlayerSync'
import { RapierArena, SoccerPitch, SoccerGoal, GameSkybox } from './Environment'



const CSS_ANIMATIONS = `
  @keyframes popIn {
    from { transform: scale(0.8); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }
`;



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
  
  // Expose orbit ref for external control (mobile swipe)
  useEffect(() => {
    if (cameraOrbit) {
      cameraOrbit.current = orbit.current
    }
  }, [cameraOrbit])


  useEffect(() => {
    const onPointerDown = (e) => {
      // Ignore if clicking on mobile controls
      if (e.target.closest('.mobile-controls') || e.target.closest('.joystick-container') || e.target.closest('.action-buttons')) {
        return
      }

      // On mobile, we handle camera swipe via touch events in MobileControls.jsx
      // to avoid conflicts with the joystick. So we ignore touch pointer events here.
      if (e.pointerType === 'touch') return

      if (e.button !== 0 && e.button !== 2) return
      
      orbit.current.dragging = true
      orbit.current.lastX = e.clientX
      orbit.current.lastY = e.clientY
      
      if (e.button === 2 && isFreeLook) {
        console.log("Free Look ACTIVE")
        isFreeLook.current = true
      }
    }
    const onPointerUp = () => {
      orbit.current.dragging = false
      if (isFreeLook) {
        console.log("Free Look INACTIVE")
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

    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('contextmenu', onContextMenu)
    
    const onWheel = (e) => {
      const delta = e.deltaY
      const zoomSensitivity = 0.025
      const minDistance = 3
      const maxDistance = 18
      const current = orbit.current
      current.targetDistance = THREE.MathUtils.clamp(current.targetDistance + delta * zoomSensitivity, minDistance, maxDistance)
    }
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
    orbit.current.distance = THREE.MathUtils.lerp(orbit.current.distance, orbit.current.targetDistance ?? orbit.current.distance, 0.12)
    const distance = orbit.current.distance
    const x = p.x + distance * Math.sin(polar) * Math.sin(azimuth)
    const y = p.y + distance * Math.cos(polar) + 2.2
    const z = p.z + distance * Math.sin(polar) * Math.cos(azimuth)
    camera.position.lerp(new THREE.Vector3(x, y, z), 0.15)
    camera.lookAt(p.x, p.y + 1, p.z)
  })
  return null
}












function PhysicsWrapper({ children, isHost }) {
  if (isHost) {
    return <Physics gravity={[0, -20, 0]}>{children}</Physics>
  }
  return <>{children}</>
}


































export default function Scene() {
  // Get player state from store - MUST BE AT TOP
  const hasJoined = useStore((s) => s.hasJoined)
  const playerName = useStore((s) => s.playerName)
  const playerTeam = useStore((s) => s.playerTeam)
  const playerCharacter = useStore((s) => s.playerCharacter)
  const leaveGame = useStore((s) => s.leaveGame)

  // Adaptive shadow quality based on device
  const [shadowMapSize, setShadowMapSize] = useState(2048)
  
  useEffect(() => {
    const isMobile = window.innerWidth < 768 || 'ontouchstart' in window
    setShadowMapSize(isMobile ? 1024 : 2048)
  }, [])

  const { 
    isLaunched, 
    players, 
    ballState, 
    setBallState, 
    scores, 
    setScores, 
    chatMessages,
    setChatMessages,
    isHost, 
    me
  } = usePlayroom()



  // Auto-scroll chat when messages change
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [chatMessages])

  // Filter out my player from remote players list
  const remotePlayers = React.useMemo(() => {
    if (!me) return []
    return players.filter(p => p.id !== me.id)
  }, [players, me])

  const playerRef = useRef()
  const targetRef = useRef() // Camera target
  
  // Rapier Physics State
  // We don't need to maintain ballBody state in React state anymore, 
  // Rapier handles it internally or via refs in RapierBall.
  
  const [chatInput, setChatInput] = useState('')
  const [isChatOpen, setIsChatOpen] = useState(true)
  const [celebration, setCelebration] = useState(null) // { team: 'red' | 'blue' }
  const [activePowerUps, setActivePowerUps] = useState([])
  const chatRef = useRef(null)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const isFreeLook = useRef(false)
  const lastLocalInteraction = useRef(0)
  const ballRigidBodyRef = useRef()

  // RPC Listeners
  useEffect(() => {
    if (isHost) {
      const unsubscribeKick = RPC.register('kick-ball', (data, caller) => {
        if (ballRigidBodyRef.current) {
          const { impulse, point, kickStrength } = data
          
          const ballPos = ballRigidBodyRef.current.translation()
          const playerState = caller.getState('pos') || [0, 0, 0]
          const dx = ballPos.x - playerState[0]
          const dz = ballPos.z - playerState[2]
          const dist = Math.sqrt(dx*dx + dz*dz)
          
          // Allow kick only if very close
          if (dist < 1.5) {
             // CRITICAL FIX: Ensure ball is dynamic before applying impulse
             ballRigidBodyRef.current.setBodyType(0, true)

             // Apply impulse: scale based on kickStrength from client
             const scaledImpulse = new THREE.Vector3(...impulse).multiplyScalar(kickStrength)

             ballRigidBodyRef.current.applyImpulse(scaledImpulse, true)

             // Force a reliable, immediate state sync so all clients see the exact new velocity/position/rotation
             const newLinvel = ballRigidBodyRef.current.linvel()
             const newTranslation = ballRigidBodyRef.current.translation()
             const newRot = ballRigidBodyRef.current.rotation()
             setBallState({
                position: [newTranslation.x, newTranslation.y, newTranslation.z],
                velocity: [newLinvel.x, newLinvel.y, newLinvel.z],
                rotation: [newRot.x, newRot.y, newRot.z, newRot.w]
             }, true)

             // Broadcast kick event for visual feedback
             RPC.call('ball-kicked', {}, RPC.Mode.ALL)
          }
        }
      })
      return () => unsubscribeKick()
    }
  }, [isHost])
  
  const handleLocalInteraction = useCallback(() => {
    lastLocalInteraction.current = Date.now()
  }, [])

  // RPC Listeners
  useEffect(() => {
    if (isLaunched) {
      // Listen for goal celebrations
      RPC.register('goal-scored', (data) => {
        setCelebration({ team: data.team })
        const audio = new Audio('/winner-game-sound-404167.mp3')
        audio.volume = 0.03
        audio.play().catch(e => console.error("Audio play failed:", e))
        setTimeout(() => {
          audio.pause()
          audio.currentTime = 0
        }, 3000)
        setTimeout(() => setCelebration(null), 3000) // Sync to 3s
        
        // Reset local player position
        setTimeout(() => {
          if (playerRef.current) {
            const spawn = playerTeam === 'red' ? [-6, 0.1, 0] : [6, 0.1, 0]
            playerRef.current.position.set(...spawn)
          }
        }, 3000) // Sync to 3s
      })

    }
  }, [isLaunched, playerTeam])
  
  // Connection quality tracking
  const [connectionQuality, setConnectionQuality] = useState('excellent')
  const [ping, setPing] = useState(0)
  const [showConnectionWarning, setShowConnectionWarning] = useState(false)
  
  // Helper function for connection quality color
  const getConnectionQualityColor = (quality) => {
    switch(quality) {
      case 'excellent': return '#00ff00'
      case 'good': return '#ffff00'
      case 'fair': return '#ffa500'
      case 'poor': return '#ff0000'
      default: return '#888'
    }
  }
  
  // Mobile controls state
  const mobileInput = useRef({ move: { x: 0, y: 0 }, jump: false, kick: false })
  const cameraOrbit = useRef(null) // Reference to camera orbit state
  
  // Mobile control callbacks
  const handleMobileMove = useCallback((x, y) => {
    mobileInput.current.move = { x, y }
  }, [])
  
  const handleMobileJump = useCallback(() => {
    mobileInput.current.jump = true
  }, [])
  
  const handleMobileKick = useCallback(() => {
    mobileInput.current.kick = true
  }, [])
  
  const handleMobileCameraMove = useCallback((dx, dy) => {
    // Apply camera rotation like mouse drag
    if (cameraOrbit.current) {
      cameraOrbit.current.azimuth -= dx * 0.01
      cameraOrbit.current.polar -= dy * 0.01
      cameraOrbit.current.polar = Math.max(0.2, Math.min(Math.PI / 2, cameraOrbit.current.polar))
    }
  }, [])
  
  // Power-up Spawning Logic
  useEffect(() => {
    if (!hasJoined) return

    const spawnPowerUp = () => {
      // Pick one random type
      const types = Object.values(POWER_UP_TYPES)
      const randomType = types[Math.floor(Math.random() * types.length)]
      
      const newPowerUp = {
        id: Math.random().toString(36).substr(2, 9),
        type: randomType.id,
        // Random position within pitch bounds (x: -14 to 14, z: -9 to 9)
        position: [
          (Math.random() - 0.5) * 28,
          0.2, // Player elevation
          (Math.random() - 0.5) * 18
        ]
      }
      
      // Set active power-up (ensure only one exists)
      setActivePowerUps([newPowerUp])
      
      // Remove after 5 seconds if not collected
      setTimeout(() => {
        setActivePowerUps(prev => prev.filter(p => p.id !== newPowerUp.id))
      }, 5000)
    }

    // Initial spawn
    spawnPowerUp()

    // Spawn every 20 seconds
    const interval = setInterval(spawnPowerUp, 20000)

    return () => clearInterval(interval)
  }, [hasJoined])
  const handleCollectPowerUp = (id) => {
    setActivePowerUps(prev => prev.filter(p => p.id !== id))
  }

  // Goal Handler
  const handleGoal = (team) => {
    if (isHost) {
      const newScores = { ...scores }
      newScores[team]++
      setScores(newScores)
      
      RPC.call('goal-scored', { team }, RPC.Mode.ALL)
      
      // Reset ball after delay
      setTimeout(() => {
        if (ballRigidBodyRef.current) {
          ballRigidBodyRef.current.setTranslation({ x: 0, y: 2, z: 0 }, true)
          ballRigidBodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
          ballRigidBodyRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true)
          
          // Sync state to all clients
          setBallState({ 
            position: [0, 2, 0], 
            velocity: [0, 0, 0],
            rotation: [0, 0, 0, 1] // Reset rotation to identity
          }, true)
        }
      }, 3000)
    }
  }



  if (!hasJoined) {
    return <TeamSelectPopup defaultName={me?.getProfile()?.name} />
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <style>{CSS_ANIMATIONS}</style>
      {/* Connection Status - Top Left */}
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
        <div style={{
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ color: getConnectionQualityColor(connectionQuality) }}>
            ● {connectionQuality.toUpperCase()}
          </span>
          <span>{ping}ms</span>
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
          backdropFilter: 'blur(5px)',
          animation: 'pulse 1s infinite'
        }}>
          ⚠️ POOR CONNECTION - PLAYERS MAY DESYNC
        </div>
      )}

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
      

      {/* Game Controls - Top Right */}
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

      {/* Scoreboard - Top Center */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        gap: '20px',
        background: 'rgba(0,0,0,0.6)',
        padding: '10px 30px',
        borderRadius: '20px',
        border: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{ color: '#ff4757', fontSize: '32px', fontWeight: 'bold' }}>{scores.red}</div>
        <div style={{ color: 'white', fontSize: '32px', fontWeight: 'bold' }}>-</div>
        <div style={{ color: '#3742fa', fontSize: '32px', fontWeight: 'bold' }}>{scores.blue}</div>
      </div>
      

      {/* Goal Celebration Overlay */}
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

      <Canvas shadows camera={{ position: [0, 8, 12], fov: 45 }} dpr={[1, 2]}>
        <Suspense fallback={null}>
          <PhysicsWrapper isHost={isHost}>
             <GameSkybox />
             <ambientLight intensity={0.7} />
             <directionalLight 
               position={[10, 20, 10]} 
               intensity={1.2} 
               castShadow 
               shadow-mapSize={[shadowMapSize, shadowMapSize]}
               shadow-camera-left={-20}
               shadow-camera-right={20}
               shadow-camera-top={20}
               shadow-camera-bottom={-20}
             />
             
             {isHost && <RapierArena />}
             <SoccerPitch />
             <MapComponents.MysteryShack />
             
             {isHost ? (
               <HostBall setBallState={setBallState} onGoal={handleGoal} ref={ballRigidBodyRef} players={players} />
             ) : (
               <ClientBall ballState={ballState} />
             )}

             <SoccerGoal position={[-11.2, 0, 0]} rotation={[0, 0 , 0]} netColor="#ff4444" />
             <SoccerGoal position={[11.2, 0, 0]} rotation={[0, -Math.PI , 0]} netColor="#4444ff" />

             {me && (
                <LocalPlayerWithSync
                  me={me}
                  playerRef={playerRef}
                  playerName={playerName}
                  playerTeam={playerTeam}
                  teamColor={playerTeam === 'red' ? '#ff4444' : '#4488ff'}
                  characterType={playerCharacter}
                  isHost={isHost}
                  powerUps={activePowerUps}
                  onCollectPowerUp={handleCollectPowerUp}
                  isFreeLook={isFreeLook}
                  mobileInput={mobileInput}
                  onLocalInteraction={handleLocalInteraction}
                  key={playerCharacter}
                />
             )}
            
            {/* Remote Players */}
            {remotePlayers.map((p) => (
              <RemotePlayerWithPhysics 
                key={p.id} 
                player={p}
                isHost={isHost}
              />
            ))}
            
            <CameraController targetRef={playerRef} isFreeLook={isFreeLook} cameraOrbit={cameraOrbit} />
            {activePowerUps.map(p => (
              <PowerUp 
                key={p.id} 
                position={p.position} 
                type={Object.keys(POWER_UP_TYPES).find(key => POWER_UP_TYPES[key].id === p.type)} 
              />
            ))}
          </PhysicsWrapper>
        </Suspense>
        </Canvas>
        <Loader />
        
        {/* Mobile Controls - Only visible on touch devices */}
        {hasJoined && (
          <MobileControls 
            onMove={handleMobileMove}
            onJump={handleMobileJump}
            onKick={handleMobileKick}
            onCameraMove={handleMobileCameraMove}
          />
        )}
        
        {/* Chat Box - Bottom Right */}
        <div style={{
          position: 'absolute',
          bottom: '20px',
          right: '20px',
          width: '300px',
          maxHeight: '250px',
          background: 'rgba(0,0,0,0.7)',
          borderRadius: '12px',
          overflow: 'hidden',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{
            padding: '10px 15px',
            background: 'rgba(0,0,0,0.5)',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>💬 Chat</span>
            <button 
              onClick={() => setIsChatOpen(!isChatOpen)}
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              {isChatOpen ? '−' : '+'}
            </button>
          </div>
          {isChatOpen && (
            <>
              <div 
                ref={chatRef}
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '10px',
                  maxHeight: '150px'
                }}
              >
                {chatMessages.map((msg, i) => (
                  <div key={msg.time + '-' + msg.playerName} style={{ marginBottom: '8px' }}>
                    <span style={{ 
                      color: msg.team === 'red' ? '#ff4757' : msg.team === 'blue' ? '#3742fa' : '#888',
                      fontWeight: 'bold',
                      fontSize: '12px'
                    }}>
                      {msg.playerName}:
                    </span>
                    <span style={{ color: 'white', marginLeft: '5px', fontSize: '12px' }}>
                      {msg.message}
                    </span>
                  </div>
                ))}
              </div>
              <form 
                onSubmit={(e) => {
                  e.preventDefault()
                  if (chatInput.trim()) {
                    const newMessage = {
                      playerName: playerName || 'Guest',
                      team: playerTeam,
                      message: chatInput.trim(),
                      time: Date.now()
                    }
                    // Use multiplayer state for stable sync
                    setChatMessages(prev => [...(prev || []).slice(-49), newMessage])
                    setChatInput('')
                  }
                }}
                style={{ padding: '10px', borderTop: '1px solid rgba(255,255,255,0.2)' }}
              >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type a message..."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: 'none',
                  borderRadius: '6px',
                  background: 'rgba(255,255,255,0.1)',
                  color: 'white',
                  fontSize: '12px',
                  outline: 'none'
                }}
              />
            </form>
          </>
        )}
      </div>

      {/* Modern S-Tier Exit Confirmation Pop-up */}
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
            transform: 'scale(1)',
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
                onClick={() => {
                  setShowExitConfirm(false);
                  // me.quit() is not a valid Playroom function
                  setScores({ red: 0, blue: 0 }); // Reset local scores
                  leaveGame();
                }}
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
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 20px rgba(255,71,87,0.6)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 5px 15px rgba(255,71,87,0.4)';
                }}
              >
                LEAVE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}



// Note: we check for model availability inside the Scene component on mount.


