// useColyseus.js - Client networking hook for Colyseus server
// Replaces usePlayroom.js

import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react'
import { Client } from 'colyseus.js'

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
  const [players, setPlayers] = useState([])
  const [ballState, setBallState] = useState({
    x: 0, y: 2, z: 0,
    vx: 0, vy: 0, vz: 0,
    rx: 0, ry: 0, rz: 0, rw: 1
  })
  const [scores, setScores] = useState({ red: 0, blue: 0 })
  const [gamePhase, setGamePhase] = useState('waiting')
  const [gameTimer, setGameTimer] = useState(300)
  const [mySessionId, setMySessionId] = useState(null)

  const roomRef = useRef(null)

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
      const joinedRoom = await client.joinOrCreate('soccer', options)
      roomRef.current = joinedRoom
      setRoom(joinedRoom)
      setMySessionId(joinedRoom.sessionId)
      setIsConnected(true)

      // State change listeners
      joinedRoom.state.players.onAdd((player, sessionId) => {
        setPlayers(prev => {
          const updated = [...prev.filter(p => p.sessionId !== sessionId), {
            sessionId,
            id: sessionId,
            x: player.x,
            y: player.y,
            z: player.z,
            vx: player.vx,
            vy: player.vy,
            vz: player.vz,
            rotY: player.rotY,
            name: player.name,
            team: player.team,
            character: player.character,
            invisible: player.invisible,
            giant: player.giant,
            getState: (key) => player[key],
            setState: () => {} // No-op, state is server-controlled
          }]
          return updated
        })

        // Listen for property changes
        player.onChange(() => {
          setPlayers(prev => prev.map(p => {
            if (p.sessionId === sessionId) {
              return {
                ...p,
                x: player.x,
                y: player.y,
                z: player.z,
                vx: player.vx,
                vy: player.vy,
                vz: player.vz,
                rotY: player.rotY,
                name: player.name,
                team: player.team,
                character: player.character,
                invisible: player.invisible,
                giant: player.giant
              }
            }
            return p
          }))
        })
      })

      joinedRoom.state.players.onRemove((player, sessionId) => {
        setPlayers(prev => prev.filter(p => p.sessionId !== sessionId))
      })

      // Ball state
      joinedRoom.state.ball.onChange(() => {
        const ball = joinedRoom.state.ball
        setBallState({
          x: ball.x,
          y: ball.y,
          z: ball.z,
          vx: ball.vx,
          vy: ball.vy,
          vz: ball.vz,
          rx: ball.rx,
          ry: ball.ry,
          rz: ball.rz,
          rw: ball.rw
        })
      })

      // Game state
      joinedRoom.state.onChange(() => {
        const state = joinedRoom.state
        setScores({ red: state.redScore, blue: state.blueScore })
        setGamePhase(state.gamePhase)
        setGameTimer(state.timer)
      })

      return joinedRoom
    } catch (error) {
      console.error('Failed to join room:', error)
      return null
    }
  }, [client])

  // Leave room
  const leaveRoom = useCallback(() => {
    if (roomRef.current) {
      roomRef.current.leave()
      roomRef.current = null
      setRoom(null)
      setIsConnected(false)
      setPlayers([])
    }
  }, [])

  // Send input to server
  const sendInput = useCallback((input) => {
    if (roomRef.current) {
      roomRef.current.send('input', input)
    }
  }, [])

  // Send kick
  const sendKick = useCallback((impulse) => {
    if (roomRef.current) {
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

  return {
    // Connection
    isLaunched,
    isConnected,
    joinRoom,
    leaveRoom,
    room,

    // State
    players,
    ballState,
    scores,
    gameState: gamePhase,
    gameTimer,
    isHost,
    me,

    // Actions
    sendInput,
    sendKick,
    sendChat,
    startGame,
    endGame,
    onMessage
  }
}

export default useColyseus
