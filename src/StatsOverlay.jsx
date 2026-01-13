import React, { useState, useEffect } from 'react'

export default function StatsOverlay({ players }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Tab') {
        e.preventDefault()
        setVisible(true)
      }
    }
    const handleKeyUp = (e) => {
      if (e.key === 'Tab') {
        setVisible(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  if (!visible) return null

  const playerList = Array.from(players.values()).sort((a, b) => (b.goals * 3 + b.assists) - (a.goals * 3 + a.assists))

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      zIndex: 20000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.4)',
      backdropFilter: 'blur(8px)',
      pointerEvents: 'none'
    }}>
      <div style={{
        width: '600px',
        background: 'rgba(20, 20, 30, 0.85)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '20px',
        padding: '30px',
        color: 'white',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)'
      }}>
        <h2 style={{ 
          margin: '0 0 20px 0', 
          textAlign: 'center', 
          fontSize: '24px', 
          letterSpacing: '2px',
          color: '#aaa'
        }}>MATCH STATISTICS</h2>
        
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#888', fontSize: '12px' }}>
              <th style={{ textAlign: 'left', padding: '10px' }}>PLAYER</th>
              <th style={{ textAlign: 'center', padding: '10px' }}>TEAM</th>
              <th style={{ textAlign: 'center', padding: '10px' }}>GOALS</th>
              <th style={{ textAlign: 'center', padding: '10px' }}>ASSISTS</th>
              <th style={{ textAlign: 'center', padding: '10px' }}>SHOTS</th>
            </tr>
          </thead>
          <tbody>
            {playerList.map((p) => (
              <tr key={p.sessionId} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <td style={{ padding: '15px 10px', fontWeight: 'bold' }}>{p.name}</td>
                <td style={{ padding: '15px 10px', textAlign: 'center' }}>
                  <span style={{ 
                    padding: '4px 8px', 
                    borderRadius: '4px', 
                    fontSize: '10px', 
                    fontWeight: 'bold',
                    background: p.team === 'red' ? 'rgba(255, 71, 87, 0.2)' : 'rgba(55, 66, 250, 0.2)',
                    color: p.team === 'red' ? '#ff4757' : '#3742fa',
                    textTransform: 'uppercase'
                  }}>
                    {p.team}
                  </span>
                </td>
                <td style={{ padding: '15px 10px', textAlign: 'center', fontSize: '18px', fontWeight: '900' }}>{p.goals || 0}</td>
                <td style={{ padding: '15px 10px', textAlign: 'center', fontSize: '18px', fontWeight: '900', opacity: 0.7 }}>{p.assists || 0}</td>
                <td style={{ padding: '15px 10px', textAlign: 'center', fontSize: '18px', fontWeight: '900', opacity: 0.5 }}>{p.shots || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '12px', color: '#666' }}>
          HOLD [TAB] TO VIEW STATS
        </div>
      </div>
    </div>
  )
}
