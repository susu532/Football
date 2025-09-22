import React from 'react'
import useStore from './store'

export default function ProductCard({ product }) {
  const addToCart = useStore((s) => s.addToCart)
  const selectProduct = useStore((s) => s.selectProduct)
  const selectedId = useStore((s) => s.selectedId)

  return (
    <div className="product-card">
      <div className="product-thumb" style={{ background: product.color }} />
      <div className="product-info">
        <div>{product.name}</div>
        <div>${product.price.toFixed(2)}</div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => addToCart(product)}>Add</button>
        <button onClick={() => selectProduct(product.id)} aria-pressed={selectedId === product.id}>
          View
        </button>
      </div>
    </div>
  )
}
