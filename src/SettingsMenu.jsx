import React, { useState } from 'react'
import useStore from './store'
import { OFFICIAL_SERVERS } from './serverConfig'

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

  const [selectedServer, setSelectedServer] = useState(() => {
    const found = OFFICIAL_SERVERS.find(s => s.url === serverUrl)
    return found ? found.url : 'custom'
  })
  const [customUrl, setCustomUrl] = useState(serverUrl)

  const handleSaveServer = () => {
    const urlToSave = selectedServer === 'custom' ? customUrl : selectedServer
    if (urlToSave !== serverUrl) {
      setServerUrl(urlToSave)
      window.location.reload()
    } else {
      setShowSettings(false)
    }
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
        width: '450px',
        background: 'rgba(20, 20, 30, 0.95)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* SERVER SELECTION */}
          <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold', fontSize: '14px', color: '#aaa' }}>GAME SERVER</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <select
                value={selectedServer}
                onChange={(e) => setSelectedServer(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  fontSize: '14px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                {OFFICIAL_SERVERS.map(server => (
                  <option key={server.url} value={server.url} style={{ background: '#222' }}>
                    {server.name}
                  </option>
                ))}
                <option value="custom" style={{ background: '#222' }}>Custom URL...</option>
              </select>

              {selectedServer === 'custom' && (
                <input
                  type="text"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="wss://..."
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: 'white',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              )}
              
              <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                Current: {serverUrl}
              </div>
              
              <button
                onClick={handleSaveServer}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#4488ff',
                  color: 'white',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  marginTop: '5px'
                }}
              >
                APPLY SERVER CHANGE (RELOADS)
              </button>
            </div>
          </div>

          {/* AUDIO SETTINGS */}
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

          {/* GRAPHICS SETTINGS */}
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
