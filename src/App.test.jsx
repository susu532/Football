import React from 'react'
import { render, fireEvent } from '@testing-library/react'
import { test, expect } from 'vitest'
import ProductCard from './ProductCard'
import useStore from './store'

if (typeof document === 'undefined') {
  test.skip('adds product to cart via ProductCard button', () => {
    // skipped because DOM not available in this environment
  })
} else {
  test('adds product to cart via ProductCard button', async () => {
    useStore.getState().clearCart()
    const product = { id: 't-ui-1', name: 'UI Test', price: 4.5, color: 'purple' }
    const { getByText } = render(<ProductCard product={product} />)
    const addButton = getByText('Add')
    expect(addButton).toBeTruthy()
    fireEvent.click(addButton)
    const cart = useStore.getState().cart
    expect(cart.length).toBe(1)
    expect(cart[0].id).toBe(product.id)
  })
}
