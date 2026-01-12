import useStore from './store'

class AudioManager {
  constructor() {
    this.sounds = {}
    this.music = {}
    this.currentMusic = null
    this.initialized = false

    if (typeof window !== 'undefined') {
      this.init()
    }
  }

  init() {
    if (this.initialized) return
    
    // Define sounds
    const soundFiles = {
      kick: '/sounds/kick.wav',
      jump: '/sounds/jump.mp3',
      goal: '/sounds/goal.mp3',
      powerup: '/sounds/powerup.mp3',
      endgame: '/endgame.mp3',
      winner: '/winner-game-sound-404167.mp3',
    }

    // Define music
    const musicFiles = {
      bgMusic: '/sounds/bg-music.mp3',
    }

    // Preload sounds
    for (const [name, path] of Object.entries(soundFiles)) {
      this.sounds[name] = new Audio(path)
    }

    // Preload music
    for (const [name, path] of Object.entries(musicFiles)) {
      const audio = new Audio(path)
      audio.loop = true
      this.music[name] = audio
    }

    // Subscribe to store changes
    useStore.subscribe(
      (state) => state.audioSettings,
      (settings) => {
        this.updateVolumes(settings)
      }
    )

    // Initial volume update
    this.updateVolumes(useStore.getState().audioSettings)
    
    this.initialized = true
  }

  updateVolumes(settings) {
    const { masterVolume, musicVolume, sfxVolume, muted } = settings
    
    // Update SFX volumes
    for (const sound of Object.values(this.sounds)) {
      sound.volume = muted ? 0 : masterVolume * sfxVolume
    }

    // Update Music volumes
    for (const music of Object.values(this.music)) {
      music.volume = muted ? 0 : masterVolume * musicVolume
    }
  }

  playSFX(name) {
    if (!this.initialized) this.init()
    const sound = this.sounds[name]
    if (sound) {
      // Reset and play
      sound.currentTime = 0
      sound.play().catch(e => console.warn(`Failed to play SFX ${name}:`, e))
    }
  }

  playMusic(name) {
    if (!this.initialized) this.init()
    
    if (this.currentMusic && this.currentMusic !== this.music[name]) {
      this.currentMusic.pause()
    }

    const music = this.music[name]
    if (music) {
      this.currentMusic = music
      music.play().catch(e => console.warn(`Failed to play music ${name}:`, e))
    }
  }

  stopMusic() {
    if (this.currentMusic) {
      this.currentMusic.pause()
      this.currentMusic.currentTime = 0
      this.currentMusic = null
    }
  }
}

const audioManager = new AudioManager()
export default audioManager
