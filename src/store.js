import { create } from 'zustand'

const useStore = create((set) => ({
  // Player customization
  playerName: '',
  playerTeam: null, // 'red' or 'blue'
  playerCharacter: typeof window !== 'undefined' ? localStorage.getItem('playerCharacter') || 'cat' : 'cat',
  hasJoined: false,
  // Player customization actions
  setPlayerName: (name) => set({ playerName: name }),
  setPlayerTeam: (team) => set({ playerTeam: team }),
  setPlayerCharacter: (character) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('playerCharacter', character)
    }
    set({ playerCharacter: character })
  },
  joinGame: (name, team, character) => set({ 
    playerName: name, 
    playerTeam: team, 
    playerCharacter: character,
    hasJoined: true 
  }),
  leaveGame: () => set({ hasJoined: false }),
}))

export default useStore

