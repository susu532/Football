/**
 * OmniPitch 3D Soccer Experience
 * Copyright (c) 2026 OmniPitch Games. All Rights Reserved.
 *
 * This file is proprietary and confidential.
 * Unauthorized copying, transfer, or use is strictly prohibited.
 *
 * For licensing inquiries: hentertrabelsi@gmail.com
 */

import React, { useState, useEffect } from 'react'

export default function StatsOverlay({ players }) {
  const [visible, setVisible] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 900 || 'ontouchstart' in window)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

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

  // Handle both array and Map formats for players
  const playerArray = Array.isArray(players) ? players : Array.from(players.values?.() || [])
  const playerList = playerArray.sort((a, b) => (b.goals * 3 + b.assists) - (a.goals * 3 + a.assists))

  return (
    <>
      {/* Mobile Toggle Button */}
      {isMobile && (
        <button
          className="stats-overlay-mobile-btn"
          onClick={() => setVisible(!visible)}
          style={{
            position: 'fixed',
            bottom: isMobile ? '100px' : '120px',
            right: '10px',
            width: isMobile && window.innerWidth <= 480 ? '44px' : '50px',
            height: isMobile && window.innerWidth <= 480 ? '44px' : '50px',
            borderRadius: '50%',
            background: visible ? 'rgba(68, 136, 255, 0.8)' : 'rgba(0, 0, 0, 0.6)',
            border: '2px solid rgba(255, 255, 255, 0.2)',
            color: 'white',
            fontSize: isMobile && window.innerWidth <= 480 ? '20px' : '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 9998,
            backdropFilter: 'blur(5px)',
            transition: 'all 0.2s'
          }}
        >
          📊
        </button>
      )}

      {/* Stats Overlay Panel */}
      {visible && (
        <div 
          className="stats-overlay-backdrop"
          style={{
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
            pointerEvents: isMobile ? 'auto' : 'none'
          }}
          onClick={isMobile ? () => setVisible(false) : undefined}
        >
          <div 
            className="stats-overlay-panel"
            style={{
              width: isMobile ? '95vw' : '600px',
              maxWidth: isMobile ? '500px' : '600px',
              background: 'rgba(20, 20, 30, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: isMobile ? '16px' : '20px',
              padding: isMobile ? '20px' : '30px',
              color: 'white',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
              pointerEvents: 'none'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ 
              margin: '0 0 20px 0', 
              textAlign: 'center', 
              fontSize: isMobile ? '18px' : '24px', 
              letterSpacing: '2px',
              color: '#aaa'
            }}>MATCH STATISTICS</h2>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: isMobile ? '280px' : '400px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#888', fontSize: isMobile ? '10px' : '12px' }}>
                    <th style={{ textAlign: 'left', padding: isMobile ? '8px 4px' : '10px' }}>PLAYER</th>
                    <th style={{ textAlign: 'center', padding: isMobile ? '8px 4px' : '10px' }}>TEAM</th>
                    <th style={{ textAlign: 'center', padding: isMobile ? '8px 4px' : '10px' }}>GOALS</th>
                    <th style={{ textAlign: 'center', padding: isMobile ? '8px 4px' : '10px' }}>ASSISTS</th>
                    <th style={{ textAlign: 'center', padding: isMobile ? '8px 4px' : '10px' }}>SHOTS</th>
                  </tr>
                </thead>
                <tbody>
                  {playerList.map((p) => (
                    <tr key={p.sessionId} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <td style={{ 
                        padding: isMobile ? '10px 4px' : '15px 10px', 
                        fontWeight: 'bold',
                        fontSize: isMobile ? '12px' : '14px',
                        maxWidth: isMobile ? '80px' : 'none',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>{p.name}</td>
                      <td style={{ padding: isMobile ? '10px 4px' : '15px 10px', textAlign: 'center' }}>
                        <span className="team-badge" style={{ 
                          padding: isMobile ? '2px 6px' : '4px 8px', 
                          borderRadius: '4px', 
                          fontSize: isMobile ? '8px' : '10px', 
                          fontWeight: 'bold',
                          background: p.team === 'red' ? 'rgba(255, 71, 87, 0.2)' : 'rgba(55, 66, 250, 0.2)',
                          color: p.team === 'red' ? '#ff4757' : '#3742fa',
                          textTransform: 'uppercase'
                        }}>
                          {p.team}
                        </span>
                      </td>
                      <td style={{ padding: isMobile ? '10px 4px' : '15px 10px', textAlign: 'center', fontSize: isMobile ? '14px' : '18px', fontWeight: '900' }}>{p.goals || 0}</td>
                      <td style={{ padding: isMobile ? '10px 4px' : '15px 10px', textAlign: 'center', fontSize: isMobile ? '14px' : '18px', fontWeight: '900', opacity: 0.7 }}>{p.assists || 0}</td>
                      <td style={{ padding: isMobile ? '10px 4px' : '15px 10px', textAlign: 'center', fontSize: isMobile ? '14px' : '18px', fontWeight: '900', opacity: 0.5 }}>{p.shots || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="stats-footer" style={{ marginTop: '20px', textAlign: 'center', fontSize: isMobile ? '10px' : '12px', color: '#666' }}>
              {isMobile ? 'TAP OUTSIDE TO CLOSE' : 'HOLD [TAB] TO VIEW STATS'}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

