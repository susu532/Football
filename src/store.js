import { create } from 'zustand'

const useStore = create((set) => ({
  cart: [],
  selectedId: null,
  coins: 0,
  lives: 3,
  level: 1,
  addToCart: (product) =>
    set((state) => ({ cart: [...state.cart, { ...product }] })),
  clearCart: () => set({ cart: [] }),
  selectProduct: (id) => set({ selectedId: id }),
  clearSelection: () => set({ selectedId: null }),
  collectCoin: () => set((s) => ({ coins: s.coins + 1 })),
  hitByEnemy: () => set((s) => ({ lives: Math.max(0, s.lives - 1) })),
  // reset the game state (preserve products/cart)
  resetGame: () => set({ coins: 0, lives: 3, level: 1 }),
  // advance to the next level
  nextLevel: () => set((s) => ({ level: s.level + 1, coins: 0 })),
  setLevel: (n) => set({ level: n }),
}))

export default useStore
