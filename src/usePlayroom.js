import { useState, useEffect, useRef } from 'react'
import { 
  insertCoin, 
  onPlayerJoin, 
  useMultiplayerState, 
  usePlayersList, 
  useIsHost, 
  myPlayer, 
  isHost
} from 'playroomkit'

export function usePlayroom() {
  const [isLaunched, setIsLaunched] = useState(false)
  
  // Initialize Playroom
  useEffect(() => {
    const initPlayroom = async () => {
      try {
        await insertCoin({
          skipLobby: false,
          gameId: "soccer-3d-experience",
          discord: true,
          maxPlayersPerRoom: 10
        })
        setIsLaunched(true)
      } catch (e) {
        console.error("Failed to initialize Playroom:", e)
      }
    }
    
    initPlayroom()
  }, [])

  // Game State Hooks
  const players = usePlayersList(true) // true = trigger re-render on state change
  const [ballState, setBallState] = useMultiplayerState('ball', { 
    position: [0, 0.5, 0], 
    velocity: [0, 0, 0] 
  })
  const [scores, setScores] = useMultiplayerState('scores', { red: 0, blue: 0 })
  const [chatMessages, setChatMessages] = useMultiplayerState('chat', [])
  const isHostPlayer = useIsHost()
  
  // Helper to get my player object
  const me = myPlayer()

  return {
    isLaunched,
    players: players || [],
    ballState: ballState || { position: [0, 0.5, 0], velocity: [0, 0, 0] },
    setBallState,
    scores: scores || { red: 0, blue: 0 },
    setScores,
    chatMessages: chatMessages || [],
    setChatMessages,
    isHost: isHostPlayer,
    me,
    // Expose raw Playroom functions if needed
    isHostFn: isHost
  }
}
