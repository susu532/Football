/**
 * OmniPitch 3D Soccer Experience
 * Copyright (c) 2026 OmniPitch Games. All Rights Reserved.
 *
 * This file is proprietary and confidential.
 * Unauthorized copying, transfer, or use is strictly prohibited.
 *
 * For licensing inquiries: hentertrabelsi@gmail.com
 */

import React from 'react'

export default function PostMatchSummary({ gameOverData, players }) {
  if (!gameOverData) return null

  const { winner, scores } = gameOverData
  const playerList = Array.from(players.values()).sort((a, b) => (b.goals * 3 + b.assists) - (a.goals * 3 + a.assists))

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      zIndex: 30000,
      background: 'rgba(0, 0, 0, 0.9)',
      backdropFilter: 'blur(20px)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      animation: 'fadeIn 0.8s ease-out'
    }}>
      <div style={{
        textAlign: 'center',
        marginBottom: '40px',
        animation: 'popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
      }}>
        <h1 style={{ 
          fontSize: '64px', 
          margin: '0', 
          fontWeight: '900',
          textTransform: 'uppercase',
          letterSpacing: '8px',
          background: 'linear-gradient(to bottom, #fff, #888)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          MATCH ENDED
        </h1>
        <div style={{
          fontSize: '32px',
          fontWeight: 'bold',
          marginTop: '10px',
          color: winner === 'red' ? '#ff4757' : (winner === 'blue' ? '#3742fa' : '#ffffff'),
          textShadow: `0 0 20px ${winner === 'red' ? 'rgba(255, 71, 87, 0.5)' : (winner === 'blue' ? 'rgba(55, 66, 250, 0.5)' : 'rgba(255, 255, 255, 0.3)')}`
        }}>
          {winner === 'draw' ? "IT'S A DRAW!" : `${winner.toUpperCase()} TEAM VICTORIOUS!`}
        </div>
      </div>

      <div style={{
        display: 'flex',
        gap: '40px',
        alignItems: 'center',
        marginBottom: '50px',
        background: 'rgba(255, 255, 255, 0.05)',
        padding: '20px 60px',
        borderRadius: '30px',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#ff4757', fontSize: '20px', fontWeight: 'bold' }}>RED</div>
          <div style={{ fontSize: '72px', fontWeight: '900' }}>{scores.red}</div>
        </div>
        <div style={{ fontSize: '48px', fontWeight: '900', opacity: 0.3 }}>VS</div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#3742fa', fontSize: '20px', fontWeight: 'bold' }}>BLUE</div>
          <div style={{ fontSize: '72px', fontWeight: '900' }}>{scores.blue}</div>
        </div>
      </div>

      <div style={{
        width: '800px',
        background: 'rgba(255, 255, 255, 0.03)',
        borderRadius: '24px',
        padding: '30px',
        border: '1px solid rgba(255, 255, 255, 0.05)'
      }}>
        <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', color: '#888', textAlign: 'center' }}>PLAYER PERFORMANCE</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#555', fontSize: '12px' }}>
              <th style={{ textAlign: 'left', padding: '10px' }}>PLAYER</th>
              <th style={{ textAlign: 'center', padding: '10px' }}>GOALS</th>
              <th style={{ textAlign: 'center', padding: '10px' }}>ASSISTS</th>
              <th style={{ textAlign: 'center', padding: '10px' }}>SHOTS</th>
            </tr>
          </thead>
          <tbody>
            {playerList.map((p) => (
              <tr key={p.sessionId} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                <td style={{ padding: '12px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ 
                      width: '8px', 
                      height: '8px', 
                      borderRadius: '50%', 
                      background: p.team === 'red' ? '#ff4757' : '#3742fa' 
                    }} />
                    <span style={{ fontWeight: 'bold' }}>{p.name}</span>
                  </div>
                </td>
                <td style={{ padding: '12px 10px', textAlign: 'center', fontSize: '20px', fontWeight: 'bold' }}>{p.goals || 0}</td>
                <td style={{ padding: '12px 10px', textAlign: 'center', fontSize: '20px', fontWeight: 'bold', opacity: 0.7 }}>{p.assists || 0}</td>
                <td style={{ padding: '12px 10px', textAlign: 'center', fontSize: '20px', fontWeight: 'bold', opacity: 0.5 }}>{p.shots || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '40px', color: '#666', fontSize: '14px', animation: 'fadeIn 2s' }}>
        GAME WILL RESET SHORTLY...
      </div>
    </div>
  )
}
