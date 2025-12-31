import { create } from 'zustand'

const useStore = create((set) => ({
  // Player customization
  playerName: '',
  playerTeam: null, // 'red' or 'blue'
  roomId: 'room1', // Default room
  hasJoined: false,
  // Player customization actions
  setPlayerName: (name) => set({ playerName: name }),
  setPlayerTeam: (team) => set({ playerTeam: team }),
  setRoomId: (id) => set({ roomId: id }),
  joinGame: (name, team, roomId) => set({ 
    playerName: name, 
    playerTeam: team, 
    roomId: roomId,
    hasJoined: true 
  }),
  leaveGame: () => set({ hasJoined: false }),
}))

export default useStore

