import React from 'react'
import useStore from './store'

export default function SettingsMenu() {
  const showSettings = useStore((s) => s.showSettings)
  const setShowSettings = useStore((s) => s.setShowSettings)
  const audioSettings = useStore((s) => s.audioSettings)
  const setMasterVolume = useStore((s) => s.setMasterVolume)
  const setMusicVolume = useStore((s) => s.setMusicVolume)
  const setSfxVolume = useStore((s) => s.setSfxVolume)
  const setMuted = useStore((s) => s.setMuted)
  const graphicsQuality = useStore((s) => s.graphicsQuality)
  const setGraphicsQuality = useStore((s) => s.setGraphicsQuality)
  const showFPS = useStore((s) => s.showFPS)
  const setShowFPS = useStore((s) => s.setShowFPS)
  const serverUrl = useStore((s) => s.serverUrl)
  const setServerUrl = useStore((s) => s.setServerUrl)

  const [tempServerUrl, setTempServerUrl] = React.useState(serverUrl)

  const handleSaveServer = () => {
    setServerUrl(tempServerUrl)
    window.location.reload()
  }

  if (!showSettings) return null

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      zIndex: 10000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.7)',
      backdropFilter: 'blur(10px)',
      animation: 'fadeIn 0.3s ease-out'
    }}>
      <div style={{
        width: '400px',
        background: 'rgba(255, 255, 255, 0.1)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '24px',
        padding: '30px',
        color: 'white',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', letterSpacing: '1px' }}>SETTINGS</h2>
          <button 
            onClick={() => setShowSettings(false)}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '5px'
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <label>Master Volume</label>
              <span>{Math.round(audioSettings.masterVolume * 100)}%</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01" 
              value={audioSettings.masterVolume}
              onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
              style={{ accentColor: '#4488ff' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <label>Music Volume</label>
              <span>{Math.round(audioSettings.musicVolume * 100)}%</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01" 
              value={audioSettings.musicVolume}
              onChange={(e) => setMusicVolume(parseFloat(e.target.value))}
              style={{ accentColor: '#4488ff' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <label>SFX Volume</label>
              <span>{Math.round(audioSettings.sfxVolume * 100)}%</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01" 
              value={audioSettings.sfxVolume}
              onChange={(e) => setSfxVolume(parseFloat(e.target.value))}
              style={{ accentColor: '#4488ff' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
            <input 
              type="checkbox" 
              id="mute-toggle"
              checked={audioSettings.muted}
              onChange={(e) => setMuted(e.target.checked)}
              style={{ width: '20px', height: '20px', cursor: 'pointer' }}
            />
            <label htmlFor="mute-toggle" style={{ cursor: 'pointer' }}>Mute All Sounds</label>
          </div>

          <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '15px', marginTop: '5px' }}>
            <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold', fontSize: '14px', color: '#aaa' }}>GRAPHICS</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              {['low', 'medium', 'high'].map((q) => (
                <button
                  key={q}
                  onClick={() => setGraphicsQuality(q)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    background: graphicsQuality === q ? '#4488ff' : 'rgba(255, 255, 255, 0.05)',
                    color: 'white',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    transition: 'all 0.2s'
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '15px', marginTop: '5px' }}>
            <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold', fontSize: '14px', color: '#aaa' }}>DISPLAY</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input 
                type="checkbox" 
                id="fps-toggle"
                checked={showFPS}
                onChange={(e) => setShowFPS(e.target.checked)}
                style={{ width: '20px', height: '20px', cursor: 'pointer' }}
              />
              <label htmlFor="fps-toggle" style={{ cursor: 'pointer' }}>Show FPS Counter</label>
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '15px', marginTop: '5px' }}>
            <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold', fontSize: '14px', color: '#aaa' }}>SERVER</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input 
                type="text" 
                value={tempServerUrl}
                onChange={(e) => setTempServerUrl(e.target.value)}
                placeholder="ws://localhost:2567"
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: 'white',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
              <button
                onClick={handleSaveServer}
                style={{
                  padding: '8px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#2ecc71',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#27ae60'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#2ecc71'}
              >
                SAVE & RELOAD
              </button>
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '20px', marginTop: '10px' }}>
          <button 
            onClick={() => setShowSettings(false)}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #4488ff, #3742fa)',
              color: 'white',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'transform 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  )
}
