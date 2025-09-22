import React from 'react'
import ProductCard from './ProductCard'
import useStore from './store'

export default function Sidebar({ products = [] }) {
  const cart = useStore((s) => s.cart)
  const coins = useStore((s) => s.coins)
  const lives = useStore((s) => s.lives)
  const total = cart.reduce((s, item) => s + item.price, 0)

  return (
    <div>
      <h2>Products</h2>
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}

      <h3>Cart</h3>
      <ul>
        {cart.map((c) => (
          <li key={c.id}>{c.name} - ${c.price.toFixed(2)}</li>
        ))}
      </ul>
      <div className="total">Total: ${total.toFixed(2)}</div>

      <div className="status">
        <div>Coins: <strong>{coins}</strong></div>
        <div>Lives: <strong>{lives}</strong></div>
      </div>

      <div className="emperia-note">
        <strong>Emperia:</strong>
        <p>Placeholder for Emperia integration (AR/3D commerce). See README.</p>
      </div>
    </div>
  )
}
