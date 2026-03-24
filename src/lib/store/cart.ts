import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Product } from '@/lib/types'

export interface CartItem extends Product {
    qty: number
    cartItemId: string // Unique identifier for the cart instance (product.id + modifiers signature)
    modifiers?: any[]
}

interface CartState {
    items: CartItem[]
    addItem: (product: Product, modifiers?: any[]) => void
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
            addItem: (product, modifiers = []) => {
                const items = get().items

                // Calculate total price with modifiers
                let itemPrice = product.price
                modifiers.forEach(m => {
                    itemPrice += (m.extra_price || 0)
                })

                // Create a unique signature based on selected modifiers to group identical items
                const modifiersSignature = modifiers.map(m => m.modifier_id).sort().join(',')
                const cartItemId = `${product.id}-${modifiersSignature}`

                const existingItemIndex = items.findIndex((i) => i.cartItemId === cartItemId)

                if (existingItemIndex !== -1) {
                    const newItems = [...items]
                    newItems[existingItemIndex] = {
                        ...newItems[existingItemIndex],
                        qty: newItems[existingItemIndex].qty + 1
                    }
                    set({ items: newItems })
                } else {
                    set({
                        items: [...items, {
                            ...product,
                            qty: 1,
                            price: itemPrice, // Base price + modifiers
                            cartItemId,
                            modifiers
                        }]
                    })
                }
            },
            removeItem: (cartItemId) => {
                set({ items: get().items.filter((i) => i.cartItemId !== cartItemId) })
            },
            updateQty: (cartItemId, qty) => {
                if (qty <= 0) {
                    get().removeItem(cartItemId)
                    return
                }
                set({
                    items: get().items.map((i) =>
                        i.cartItemId === cartItemId ? { ...i, qty } : i
                    ),
                })
            },
            updatePrice: (cartItemId, price) => {
                set({
                    items: get().items.map((i) =>
                        i.cartItemId === cartItemId ? { ...i, price } : i
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
