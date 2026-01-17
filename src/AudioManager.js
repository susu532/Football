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
      endgame: '/sounds/endgame.mp3',
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
      audio.onerror = () => console.error(`Failed to load music file: ${path}`)
      this.music[name] = audio
    }

    // Subscribe to store changes
    useStore.subscribe((state) => {
      if (state.audioSettings) {
        this.updateVolumes(state.audioSettings)
      }
    })

    // Initial volume update
    this.updateVolumes(useStore.getState().audioSettings)
    
    console.log('AudioManager initialized')
    this.initialized = true
  }

  updateVolumes(settings) {
    const { masterVolume, musicVolume, sfxVolume, muted } = settings
    
    // Update SFX volumes
    for (const sound of Object.values(this.sounds)) {
      sound.volume = muted ? 0 : masterVolume * sfxVolume
    }

    // Update Music volumes
    for (const [name, music] of Object.entries(this.music)) {
      const vol = muted ? 0 : masterVolume * musicVolume
      music.volume = vol
      console.log(`Music ${name} volume set to: ${vol}`)
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
      console.log(`Attempting to play music: ${name}, volume: ${music.volume}`)
      music.play()
        .then(() => console.log(`Music ${name} playing successfully`))
        .catch(e => {
          console.warn(`Failed to play music ${name}:`, e)
          if (e.name === 'NotAllowedError') {
            console.log('Autoplay blocked. Will retry on first user interaction.')
            const retry = () => {
              music.play()
                .then(() => {
                  console.log(`Music ${name} playing after interaction`)
                  window.removeEventListener('click', retry)
                  window.removeEventListener('keydown', retry)
                  window.removeEventListener('touchstart', retry)
                })
                .catch(err => console.warn('Retry failed:', err))
            }
            window.addEventListener('click', retry)
            window.addEventListener('keydown', retry)
            window.addEventListener('touchstart', retry)
          }
        })
    } else {
      console.warn(`Music ${name} not found in AudioManager`)
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
