'use client'

import React from 'react'
import { Product } from '@/lib/types'
import { useCartStore } from '@/lib/store/cart'
import { Badge } from '@/components/ui/badge'
import { ProductOptionsModal } from './product-options-modal'

interface ProductGridProps {
    products: (Product & { available_units?: number })[]
    isRunner?: boolean
}

// Color mapping for categories
const categoryColors: Record<string, string> = {
    'Bebidas': 'bg-blue-500',
    'Fritanga': 'bg-orange-500',
    'Adiciones': 'bg-purple-500',
    'Pollo': 'bg-yellow-500',
    'Bowls': 'bg-green-500',
    'Colitas cubanas': 'bg-red-500',
    'Comidas rápidas': 'bg-pink-500',
    'Salchipapas': 'bg-amber-500',
    'Salchipapas para compartir': 'bg-teal-500',
}

export function ProductGrid({ products, isRunner }: ProductGridProps) {
    const addItem = useCartStore(state => state.addItem)
    const [selectedProduct, setSelectedProduct] = React.useState<Product | null>(null)
    const [modalOpen, setModalOpen] = React.useState(false)

    const getEffectivePrice = (product: Product) => {
        if (isRunner && product.runner_price != null) return product.runner_price
        if (!isRunner && product.shift_price != null) return product.shift_price
        return product.price
    }

    const handleProductClick = (product: Product) => {
        // Enforce runner or shift price dynamically for the cart
        const productWithEffectivePrice = {
            ...product,
            price: getEffectivePrice(product)
        }

        // Check if product has modifier groups
        if (product.modifier_groups && product.modifier_groups.length > 0) {
            setSelectedProduct(productWithEffectivePrice)
            setModalOpen(true)
        } else {
            addItem(productWithEffectivePrice)
        }
    }

    return (
        <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-3">
                {products.map(product => {
                    const categoryColor = categoryColors[product.category || ''] || 'bg-slate-400'
                    const noRecipe = product.available_units === undefined || product.available_units >= 999999
                    const units = product.available_units ?? 0
                    const isNegative = !noRecipe && units < 0
                    const isOutOfStock = !noRecipe && units === 0
                    const isLowStock = !noRecipe && units > 0 && units < 5
                    const hasStock = !noRecipe && units >= 5

                    return (
                        <button
                            key={product.id}
                            className="relative bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md hover:border-primary transition-all active:scale-95 text-left p-0 flex flex-col h-full"
                            onClick={() => handleProductClick(product)}
                        >
                            {/* Left color stripe for category */}
                            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${categoryColor}`} />

                            <div className="pl-3 pr-2 py-3 md:pl-4 md:pr-3 md:py-4 flex flex-col flex-1">
                                <h3 className="text-[13px] sm:text-sm md:text-base font-bold text-slate-800 leading-[1.2] break-words mb-1.5 md:mb-2">
                                    {product.name}
                                </h3>

                                <div className="flex flex-wrap items-center gap-1 mb-2">
                                    {noRecipe && (
                                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-yellow-50 text-yellow-700 border-yellow-300">
                                            Sin receta
                                        </Badge>
                                    )}
                                    {isNegative && (
                                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-red-50 text-red-600 border-red-300">
                                            {units}
                                        </Badge>
                                    )}
                                    {isOutOfStock && (
                                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-red-50 text-red-600 border-red-300">
                                            Agotado
                                        </Badge>
                                    )}
                                    {isLowStock && (
                                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-orange-500 text-orange-700">
                                            {units} unid.
                                        </Badge>
                                    )}
                                    {hasStock && (
                                        <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                                            {units} unid.
                                        </Badge>
                                    )}
                                </div>

                                <div className="flex flex-col sm:flex-row sm:items-end gap-0.5 sm:gap-2 mt-auto">
                                    <p className="text-lg md:text-xl font-extrabold text-green-600 leading-none">
                                        ${getEffectivePrice(product).toLocaleString()}
                                    </p>
                                    {isRunner && product.runner_price != null && (
                                        <p className="text-[10px] md:text-[11px] text-slate-400 line-through">
                                            ${product.price.toLocaleString()}
                                        </p>
                                    )}
                                    {!isRunner && product.shift_price != null && (
                                        <Badge variant="outline" className="text-[9px] md:text-[10px] px-1 py-0 h-4 md:h-5 border-sky-300 text-sky-600 bg-sky-50 mt-1 sm:mt-0">
                                            Especial
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </button>
                    )
                })}
            </div>

            <ProductOptionsModal
                product={selectedProduct}
                open={modalOpen}
                onOpenChange={setModalOpen}
            />
        </>
    )
}

