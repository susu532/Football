import { create } from 'zustand'

const useStore = create((set) => ({
  // Player customization
  playerName: '',
  playerTeam: null, // 'red' or 'blue'
  roomId: 'room1', // Default room
  playerCharacter: typeof window !== 'undefined' ? localStorage.getItem('playerCharacter') || 'cat' : 'cat',
  hasJoined: false,
  // Player customization actions
  setPlayerName: (name) => set({ playerName: name }),
  setPlayerTeam: (team) => set({ playerTeam: team }),
  setRoomId: (id) => set({ roomId: id }),
  setPlayerCharacter: (character) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('playerCharacter', character)
    }
    set({ playerCharacter: character })
  },
  joinGame: (name, team, roomId, character) => set({ 
    playerName: name, 
    playerTeam: team, 
    roomId: roomId,
    playerCharacter: character,
    hasJoined: true 
  }),
  leaveGame: () => set({ hasJoined: false }),
}))

export default useStore

