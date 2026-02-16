import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Product } from '@/lib/types'

export interface CartItem extends Product {
    qty: number
}

interface CartState {
    items: CartItem[]
    addItem: (product: Product) => void
    removeItem: (productId: string) => void
    updateQty: (productId: string, qty: number) => void
    updatePrice: (productId: string, price: number) => void
    clearCart: () => void
    total: () => number
}

export const useCartStore = create<CartState>()(
    persist(
        (set, get) => ({
            items: [],
            // ... (keep existing addItem)
            addItem: (product) => {
                const items = get().items
                const existing = items.find((i) => i.id === product.id)
                if (existing) {
                    set({
                        items: items.map((i) =>
                            i.id === product.id ? { ...i, qty: i.qty + 1 } : i
                        ),
                    })
                } else {
                    set({ items: [...items, { ...product, qty: 1 }] })
                }
            },
            removeItem: (productId) => {
                set({ items: get().items.filter((i) => i.id !== productId) })
            },
            updateQty: (productId, qty) => {
                if (qty <= 0) {
                    get().removeItem(productId)
                    return
                }
                set({
                    items: get().items.map((i) =>
                        i.id === productId ? { ...i, qty } : i
                    ),
                })
            },
            updatePrice: (productId, price) => {
                set({
                    items: get().items.map((i) =>
                        i.id === productId ? { ...i, price } : i
                    ),
                })
            },
            clearCart: () => set({ items: [] }),
            total: () => get().items.reduce((acc, item) => acc + item.price * item.qty, 0),
        }),
        {
            name: 'pos-cart-storage', // unique name
        }
    )
)
