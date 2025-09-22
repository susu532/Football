import React from 'react'
import Scene from './Scene'

export default function App() {
  return (
    <div className="app" style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <main className="viewer" style={{ width: '100vw', height: '100vh', margin: 0, padding: 0 }}>
        <Scene />
      </main>
    </div>
  )
}
