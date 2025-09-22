import { describe, it, expect } from 'vitest'
import useStore from './store'

describe('store', () => {
  it('adds items to cart', () => {
    const { addToCart, clearCart } = useStore.getState()
    clearCart()
    addToCart({ id: 't1', name: 'Test', price: 1.23 })
    const cart = useStore.getState().cart
    expect(cart).toHaveLength(1)
    expect(cart[0].name).toBe('Test')
  })

  it('collects coins and loses lives and can reset', () => {
    const s = useStore.getState()
    // reset to known state
    s.resetGame()
    expect(useStore.getState().coins).toBe(0)
    expect(useStore.getState().lives).toBe(3)

    s.collectCoin()
    s.collectCoin()
    expect(useStore.getState().coins).toBe(2)

    s.hitByEnemy()
    expect(useStore.getState().lives).toBe(2)

    s.resetGame()
    expect(useStore.getState().coins).toBe(0)
    expect(useStore.getState().lives).toBe(3)
  })
})
