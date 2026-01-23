import useStore from './store'

class AudioManager {
  constructor() {
    this.sounds = {}
    this.music = {}
    this.currentMusic = null
    this.initialized = false
    this.weatherMuteMusic = false

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
      powerup: '/sounds/powerup.mp3',
      endgame: '/sounds/endgame.mp3',
      winner: '/winner-game-sound-404167.mp3',
      pop: '/sounds/pop.mp3',
      // Countdown sounds
      countdownReady: '/sounds/countdown-ready.mp3',
      countdownBeep: '/sounds/countdown-beep.mp3',
      countdownGo: '/sounds/countdown-go.mp3',
    }

    // Define music
    const musicFiles = {
      bgMusic: '/sounds/bg-music.mp3',
    }

    // Define ambient sounds
    const ambientFiles = {
      rain: '/sounds/rainloop.mp3',
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

    // Preload ambient sounds
    this.ambient = {}
    for (const [name, path] of Object.entries(ambientFiles)) {
      const audio = new Audio(path)
      audio.loop = true
      audio.onerror = () => console.error(`Failed to load ambient file: ${path}`)
      this.ambient[name] = audio
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
      const vol = (muted || this.weatherMuteMusic) ? 0 : masterVolume * musicVolume
      music.volume = vol
      console.log(`Music ${name} volume set to: ${vol} (Weather Mute: ${this.weatherMuteMusic})`)
    }

    // Update Ambient volumes (use music volume for now)
    if (this.ambient) {
      for (const [name, ambient] of Object.entries(this.ambient)) {
        const vol = muted ? 0 : masterVolume * musicVolume * 0.7 // Slightly quieter
        ambient.volume = vol
      }
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

  playAmbient(name) {
    if (!this.initialized) this.init()
    const audio = this.ambient[name]
    if (audio) {
      audio.play().catch(e => console.warn(`Failed to play ambient ${name}:`, e))
    }
  }

  stopAmbient(name) {
    if (!this.initialized) this.init()
    const audio = this.ambient[name]
    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }
  }

  setWeatherMuteMusic(muted) {
    this.weatherMuteMusic = muted
    this.updateVolumes(useStore.getState().audioSettings)
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

  /**
   * Play countdown sounds based on remaining seconds
   * @param {number} seconds - Remaining seconds in the countdown
   */
  playCountdownSound(seconds) {
    if (!this.initialized) this.init()
    
    // Play 'ready' sound at 10 seconds
    if (seconds === 10) {
      this.playSFX('countdownReady')
    }
    
    // Play 'beep' sound every second from 10 to 1
    if (seconds >= 1 && seconds <= 10) {
      this.playSFX('countdownBeep')
    }
    
    // Play 'go' sound at 4 seconds
    if (seconds === 7) {
      this.playSFX('countdownGo')
    }
  }
}

const audioManager = new AudioManager()
export default audioManager
