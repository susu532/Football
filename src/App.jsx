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
