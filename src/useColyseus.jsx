// useColyseus.js - Client networking hook for Colyseus server
// Replaces usePlayroom.js

import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react'
import { Client } from 'colyseus.js'
import { GameState } from './schema/GameState.js'

// Context for sharing room across components
const ColyseusContext = createContext(null)

export function useColyseusContext() {
  return useContext(ColyseusContext)
}

// Provider component
export function ColyseusProvider({ children, serverUrl }) {
  const [room, setRoom] = useState(null)
  const [connected, setConnected] = useState(false)
  const [players, setPlayers] = useState(new Map())
  const [ballState, setBallState] = useState({
    x: 0, y: 2, z: 0,
    vx: 0, vy: 0, vz: 0
  })
  const [gameState, setGameState] = useState({
    redScore: 0,
    blueScore: 0,
    timer: 300,
    gamePhase: 'waiting'
  })
  const [mySessionId, setMySessionId] = useState(null)
  const clientRef = useRef(null)

  const value = {
    room,
    connected,
    players,
    ballState,
    gameState,
    mySessionId,
    isHost: players.size > 0 && [...players.keys()][0] === mySessionId
  }

  return (
    <ColyseusContext.Provider value={value}>
      {children}
    </ColyseusContext.Provider>
  )
}

// Main hook
export function useColyseus(serverUrl = 'ws://localhost:2567') {
  const [client, setClient] = useState(null)
  const [room, setRoom] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isLaunched, setIsLaunched] = useState(false)
  const [roomCode, setRoomCode] = useState(null)
  const [availableRooms, setAvailableRooms] = useState([])
  const [players, setPlayers] = useState([])
  const [ballState, setBallState] = useState({
    x: 0, y: 2, z: 0,
    vx: 0, vy: 0, vz: 0,
    rx: 0, ry: 0, rz: 0, rw: 1
  })
  const [scores, setScores] = useState({ red: 0, blue: 0 })
  const [gamePhase, setGamePhase] = useState('waiting')
  const [gameTimer, setGameTimer] = useState(300)
  const [selectedMap, setSelectedMap] = useState('OceanFloor')
  const [mySessionId, setMySessionId] = useState(null)
  const [powerUps, setPowerUps] = useState([]) // Array for easier mapping
  const [ping, setPing] = useState(0)
  const [pingJitter, setPingJitter] = useState(0)
  const pingHistory = useRef([])

  const roomRef = useRef(null)

  const getHttpServerUrl = useCallback(() => {
    if (!serverUrl) return ''
    if (serverUrl.startsWith('ws://')) return 'http://' + serverUrl.slice('ws://'.length)
    if (serverUrl.startsWith('wss://')) return 'https://' + serverUrl.slice('wss://'.length)
    return serverUrl
  }, [serverUrl])

  const attachRoomHandlers = useCallback((joinedRoom) => {
    setRoomCode(null)

    joinedRoom.onMessage('room-code', (message) => {
      if (message && message.code) {
        setRoomCode(String(message.code))
      }
    })

    // 1. Register Message Handlers FIRST
    joinedRoom.onMessage('player-joined', (message) => {
      console.log('Player joined:', message)
    })

    joinedRoom.onMessage('game-started', (message) => {
      console.log('Game started:', message)
    })

    joinedRoom.onMessage('player-left', (message) => {
      console.log('Player left:', message)
    })

    joinedRoom.onMessage('goal-scored', (message) => {
      console.log('Goal scored:', message)
    })

    joinedRoom.onMessage('game-over', (message) => {
      console.log('Game Over:', message)
    })

    joinedRoom.onMessage('game-reset', (message) => {
      console.log('Game Reset:', message)
    })

    joinedRoom.onMessage('chat-message', (message) => {
      // Handled by Chat.jsx
    })

    joinedRoom.onMessage('pong', () => {
      const now = Date.now()
      if (lastPingTime.current) {
        const sample = now - lastPingTime.current
        
        // Rolling average with 10 samples for stability
        pingHistory.current.push(sample)
        if (pingHistory.current.length > 10) pingHistory.current.shift()
        
        const avg = pingHistory.current.reduce((a, b) => a + b, 0) / pingHistory.current.length
        const variance = pingHistory.current.reduce((acc, p) => acc + (p - avg) ** 2, 0) / pingHistory.current.length
        const jitter = Math.sqrt(variance)
        
        setPing(Math.round(avg))
        setPingJitter(Math.round(jitter))
      }
    })

    // 2. Defensive State Sync
    // We use onStateChange as a fallback because onAdd/onRemove can sometimes 
    // fail if the schema prototype is lost during bundling/HMR.
    joinedRoom.onStateChange((state) => {
      if (!state) return

      // Sync Players List (Efficiently)
      if (state.players) {
        const playerIds = []
        state.players.forEach((p, id) => {
          playerIds.push(id)
        })

        setPlayers(prev => {
          const prevIds = prev.map(p => p.sessionId)
          const hasChanged = playerIds.length !== prevIds.length || 
                             !playerIds.every(id => prevIds.includes(id))
          
          if (hasChanged) {
            const newPlayers = []
            state.players.forEach((p) => newPlayers.push(p))
            return newPlayers
          }
          return prev
        })
      }

      // Sync Ball Proxy
      if (state.ball && ballState !== state.ball) {
        setBallState(state.ball)
      }

      // Sync Game Info
      setScores({ red: state.redScore, blue: state.blueScore })
      setGamePhase(state.gamePhase)
      setGameTimer(state.timer)
      if (state.selectedMap) setSelectedMap(state.selectedMap)

      // Sync Power-ups (Only if collection changes)
      if (state.powerUps) {
        const powerUpIds = []
        state.powerUps.forEach((p, id) => powerUpIds.push(id))
        
        setPowerUps(prev => {
          const prevIds = prev.map(p => p.id)
          const hasChanged = powerUpIds.length !== prevIds.length || 
                             !powerUpIds.every(id => prevIds.includes(id))
          
          if (hasChanged) {
            const newPowerUps = []
            state.powerUps.forEach((p) => newPowerUps.push(p))
            console.log('Power-ups updated:', newPowerUps.length)
            return newPowerUps
          }
          return prev
        })
      }
    })
  }, [ballState])

  const connectToRoom = useCallback((joinedRoom) => {
    roomRef.current = joinedRoom
    setRoom(joinedRoom)
    setMySessionId(joinedRoom.sessionId)
    setIsConnected(true)
    attachRoomHandlers(joinedRoom)
    return joinedRoom
  }, [attachRoomHandlers])

  // Initialize Colyseus client
  useEffect(() => {
    const colyseusClient = new Client(serverUrl)
    setClient(colyseusClient)
    setIsLaunched(true)

    return () => {
      if (roomRef.current) {
        roomRef.current.leave()
      }
    }
  }, [serverUrl])

  // Join room
  const joinRoom = useCallback(async (options = {}) => {
    if (!client) return null

    try {
      const joinedRoom = await client.joinOrCreate('soccer', options, GameState)
      return connectToRoom(joinedRoom)
    } catch (error) {
      console.error('Failed to join room:', error)
      return null
    }
  }, [client, connectToRoom])

  const createPublicRoom = useCallback(async (options = {}) => {
    if (!client) return null
    try {
      const joinedRoom = await client.create('soccer', { ...options, isPublic: true }, GameState)
      return connectToRoom(joinedRoom)
    } catch (error) {
      console.error('Failed to create public room:', error)
      return null
    }
  }, [client, connectToRoom])

  const createPrivateRoom = useCallback(async (options = {}) => {
    if (!client) return null
    try {
      const joinedRoom = await client.create('soccer', { ...options, isPublic: false }, GameState)
      return connectToRoom(joinedRoom)
    } catch (error) {
      console.error('Failed to create private room:', error)
      return null
    }
  }, [client, connectToRoom])

  const joinRoomById = useCallback(async (roomId, options = {}) => {
    if (!client) return null
    try {
      const joinedRoom = await client.joinById(roomId, options, GameState)
      return connectToRoom(joinedRoom)
    } catch (error) {
      console.error('Failed to join room by id:', error)
      return null
    }
  }, [client, connectToRoom])

  const joinPrivateRoomByCode = useCallback(async (code, options = {}) => {
    if (!client) return null

    const normalized = String(code || '').trim().toUpperCase()
    if (!normalized) return null

    try {
      const httpUrl = getHttpServerUrl()
      const res = await fetch(`${httpUrl}/rooms/resolve/${encodeURIComponent(normalized)}`)
      if (!res.ok) {
        console.error('Failed to resolve room code:', normalized)
        return null
      }
      const data = await res.json()
      if (!data || !data.roomId) return null
      return joinRoomById(data.roomId, options)
    } catch (error) {
      console.error('Failed to join room by code:', error)
      return null
    }
  }, [client, getHttpServerUrl, joinRoomById])

  const refreshAvailableRooms = useCallback(async () => {
    try {
      const httpUrl = getHttpServerUrl()
      if (!httpUrl) return []
      const res = await fetch(`${httpUrl}/rooms/public`)
      if (!res.ok) {
        setAvailableRooms([])
        return []
      }
      const rooms = await res.json()
      const publicRooms = (rooms || []).filter(r => r?.metadata?.isPublic !== false)
      setAvailableRooms(publicRooms)
      return publicRooms
    } catch (error) {
      console.error('Failed to list rooms:', error)
      setAvailableRooms([])
      return []
    }
  }, [getHttpServerUrl])

  const lastPingTime = useRef(0)
  const pingInterval = useRef(null)

  // Ping loop
  useEffect(() => {
    if (isConnected && room) {
      pingInterval.current = setInterval(() => {
        if (roomRef.current && roomRef.current.connection && roomRef.current.connection.isOpen) {
          lastPingTime.current = Date.now()
          roomRef.current.send('ping')
        }
      }, 500) // 4x faster for adaptive collision prediction
    } else {
      if (pingInterval.current) clearInterval(pingInterval.current)
    }

    return () => {
      if (pingInterval.current) clearInterval(pingInterval.current)
    }
  }, [isConnected, room])

  // Leave room
  const leaveRoom = useCallback(() => {
    if (roomRef.current) {
      roomRef.current.leave()
      roomRef.current = null
      setRoom(null)
      setIsConnected(false)
      setPlayers([])
      setRoomCode(null)
    }
  }, [])

  // Send input to server
  const sendInput = useCallback((input) => {
    if (roomRef.current && roomRef.current.connection && roomRef.current.connection.isOpen) {
      roomRef.current.send('input', input)
    }
  }, [])

  // Send kick
  const sendKick = useCallback((impulse) => {
    if (roomRef.current && roomRef.current.connection && roomRef.current.connection.isOpen) {
      roomRef.current.send('kick', impulse)
    }
  }, [])

  // Send chat message
  const sendChat = useCallback((message) => {
    if (roomRef.current) {
      roomRef.current.send('chat', { message })
    }
  }, [])

  // Start game (host only)
  const startGame = useCallback(() => {
    if (roomRef.current) {
      roomRef.current.send('start-game')
    }
  }, [])

  // End game (host only)
  const endGame = useCallback(() => {
    if (roomRef.current) {
      roomRef.current.send('end-game')
    }
  }, [])

  // On message handler
  const onMessage = useCallback((type, callback) => {
    if (roomRef.current) {
      return roomRef.current.onMessage(type, callback)
    }
    return () => {}
  }, [room])

  // Computed: is host (first player in room)
  const isHost = players.length > 0 && players[0]?.sessionId === mySessionId

  // Create a "me" object similar to Playroom's myPlayer()
  const me = mySessionId ? {
    id: mySessionId,
    sessionId: mySessionId,
    getState: (key) => {
      const player = players.find(p => p.sessionId === mySessionId)
      return player ? player[key] : undefined
    },
    setState: (key, value, reliable = true) => {
      // For local state, we send to server
      // Server is authoritative, so this is effectively an input
      if (roomRef.current) {
        roomRef.current.send('update-state', { key, value })
      }
    },
    getProfile: () => {
      const player = players.find(p => p.sessionId === mySessionId)
      return player ? { name: player.name } : { name: '' }
    }
  } : null

  // Reconnect logic
  const reconnect = useCallback(async (roomId, sessionId) => {
    if (!client) return null
    
    try {
      console.log('Attempting to reconnect...', roomId, sessionId)
      const reconnectedRoom = await client.reconnect(roomId, sessionId)
      return connectToRoom(reconnectedRoom)
    } catch (error) {
      console.error('Reconnection failed:', error)
      return null
    }
  }, [client, connectToRoom])

  // Visibility Change Handler (Seamless Resume)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.hidden) {
        // ON AFK / BACKGROUND
        console.log('App backgrounded - pausing input')
        // Input loop is naturally paused by requestAnimationFrame in React, 
        // but we can explicitly stop sending if needed.
        // The socket might stay open or close depending on OS/Browser.
      } else {
        // ON RETURN / FOREGROUND
        console.log('App foregrounded - checking connection')
        
        // Check if connection is dead
        if (roomRef.current && (!roomRef.current.connection || !roomRef.current.connection.isOpen)) {
          console.log('Connection lost. Attempting seamless reconnect...')
          
          const lastId = roomRef.current.id
          const lastSession = mySessionId
          
          // Clean up old room ref to prevent errors
          roomRef.current = null
          setRoom(null)
          setIsConnected(false)
          
          if (lastId && lastSession) {
            const newRoom = await reconnect(lastId, lastSession)
            if (!newRoom) {
              console.log('Seamless reconnect failed. Reloading page as fallback.')
              window.location.reload()
            } else {
              console.log('Seamless reconnect successful!')
            }
          }
        }
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [reconnect, mySessionId])

  return {
    // Connection
    isLaunched,
    isConnected,
    joinRoom,
    leaveRoom,
    reconnect, // Expose reconnect
    room,
    roomCode,
    availableRooms,

    // State
    players,
    ballState,
    scores,
    gameState: gamePhase,
    gameTimer,
    selectedMap,
    isHost,
    me,
    powerUps,
    ping,
    pingJitter, // For adaptive collision smoothing

    // Actions
    sendInput,
    sendKick,
    sendChat,
    startGame,
    endGame,
    onMessage,
    createPublicRoom,
    createPrivateRoom,
    joinRoomById,
    joinPrivateRoomByCode,
    refreshAvailableRooms
  }
}
