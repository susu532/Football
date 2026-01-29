/**
 * OmniPitch 3D Soccer Experience
 * Copyright (c) 2026 OmniPitch Games. All Rights Reserved.
 *
 * This file is proprietary and confidential.
 * Unauthorized copying, transfer, or use is strictly prohibited.
 */

import { create } from 'zustand'
import { OFFICIAL_SERVERS } from './serverConfig'

const useStore = create((set) => ({
  // Player customization
  playerName: '',
  playerTeam: null, // 'red' or 'blue'
  playerCharacter: typeof window !== 'undefined' ? localStorage.getItem('playerCharacter') || 'cat' : 'cat',
  playerMap: 'OceanFloor',
  hasJoined: false,
  showSettings: false,
  serverUrl: typeof window !== 'undefined' 
    ? localStorage.getItem('colyseus_server_url') || import.meta.env.VITE_COLYSEUS_SERVER || OFFICIAL_SERVERS[0].url 
    : OFFICIAL_SERVERS[0].url,
  graphicsQuality: 'medium', // 'low', 'medium', 'high'
  showFPS: false,
  // Audio settings
  audioSettings: {
    masterVolume: 0.1,
    musicVolume: 0.1,
    sfxVolume: 0.1,
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
  setServerUrl: (url) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('colyseus_server_url', url)
    }
    set({ serverUrl: url })
  },
}))

export default useStore
