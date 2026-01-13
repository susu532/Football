import { create } from 'zustand'

const useStore = create((set) => ({
  // Player customization
  playerName: '',
  playerTeam: null, // 'red' or 'blue'
  playerCharacter: typeof window !== 'undefined' ? localStorage.getItem('playerCharacter') || 'cat' : 'cat',
  playerMap: 'OceanFloor',
  hasJoined: false,
  // Player customization actions
  setPlayerCharacter: (character) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('playerCharacter', character)
    }
    set({ playerCharacter: character })
  },
  setPlayerTeam: (team) => set({ playerTeam: team }),
  joinGame: (name, team, character, map) => set({ 
    playerName: name, 
    playerTeam: team, 
    playerCharacter: character,
    playerMap: map,
    hasJoined: true 
  }),
  setHasJoined: (value) => set({ hasJoined: value }),
  leaveGame: () => set({ hasJoined: false }),
}))

export default useStore
