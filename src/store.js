import { create } from 'zustand'

const useStore = create((set) => ({
  // Player customization
  playerName: '',
  playerTeam: null, // 'red' or 'blue'
  playerCharacter: typeof window !== 'undefined' ? localStorage.getItem('playerCharacter') || 'cat' : 'cat',
  playerMap: 'OceanFloor',
  hasJoined: false,
  showSettings: false,
  graphicsQuality: 'medium', // 'low', 'medium', 'high'
  showFPS: false,
  // Audio settings
  audioSettings: {
    masterVolume: 0.4,
    musicVolume: 0.1,
    sfxVolume: 0.03,
    muted: false
  },
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
  
  // Audio actions
  setMasterVolume: (volume) => set((state) => ({ 
    audioSettings: { ...state.audioSettings, masterVolume: volume } 
  })),
  setMusicVolume: (volume) => set((state) => ({ 
    audioSettings: { ...state.audioSettings, musicVolume: volume } 
  })),
  setSfxVolume: (volume) => set((state) => ({ 
    audioSettings: { ...state.audioSettings, sfxVolume: volume } 
  })),
  setMuted: (muted) => set((state) => ({ 
    audioSettings: { ...state.audioSettings, muted } 
  })),
  setShowSettings: (show) => set({ showSettings: show }),
  setGraphicsQuality: (quality) => set({ graphicsQuality: quality }),
  setShowFPS: (show) => set({ showFPS: show }),
}))

export default useStore
