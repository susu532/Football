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
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

function renderApp() {
  const rootEl = document.getElementById('root')
  if (!rootEl) {
    console.error('No #root element found in DOM')
    return
  }
  try {
    createRoot(rootEl).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    )
  } catch (err) {
    showError(err)
    throw err
  }
}

function showError(err) {
  try {
    const rootEl = document.getElementById('root')
    if (rootEl) {
      rootEl.innerHTML = `<div style="padding:16px;font-family:Arial,Helvetica,sans-serif"><h2 style="color:#b00020">Application error</h2><pre style="white-space:pre-wrap;color:#b00020">${String(err && err.stack ? err.stack : err)}</pre></div>`
    }
  } catch (e) {
    console.error('Error while rendering error:', e)
  }
}

window.addEventListener('error', (e) => {
  console.error('window error', e.error || e.message)
  showError(e.error || e.message)
})

window.addEventListener('unhandledrejection', (e) => {
  // Ignore common browser extension errors
  if (e.reason && e.reason.message && e.reason.message.includes('message channel closed')) {
    console.warn('Ignored browser extension error:', e.reason)
    return
  }
  console.error('unhandledrejection', e.reason)
  showError(e.reason)
})

renderApp()
