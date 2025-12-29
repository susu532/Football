import { create } from 'zustand'

const useStore = create((set) => ({
  // Player customization
  playerName: '',
  playerTeam: null, // 'red' or 'blue'
  hasJoined: false,
  // Player customization actions
  setPlayerName: (name) => set({ playerName: name }),
  setPlayerTeam: (team) => set({ playerTeam: team }),
  joinGame: (name, team) => set({ 
    playerName: name, 
    playerTeam: team, 
    hasJoined: true 
  }),
}))

export default useStore

