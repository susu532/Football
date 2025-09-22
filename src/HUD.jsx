import React from 'react'
import useStore from './store'

export default function HUD() {
  const coins = useStore((s) => s.coins)
  const lives = useStore((s) => s.lives)
  const level = useStore((s) => s.level)

  return (
    <div className="overlay-hud">
      <div className="hud-left">Level {level}</div>
      <div className="hud-center">Coins: {coins}</div>
      <div className="hud-right">Lives: {lives}</div>
    </div>
  )
}
