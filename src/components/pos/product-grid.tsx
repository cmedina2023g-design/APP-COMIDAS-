'use client'

import React from 'react'
import { Product } from '@/lib/types'
import { useCartStore } from '@/lib/store/cart'
import { Badge } from '@/components/ui/badge'
import { ProductOptionsModal } from './product-options-modal'

interface ProductGridProps {
    products: (Product & { available_units?: number })[]
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

export function ProductGrid({ products }: ProductGridProps) {
    const addItem = useCartStore(state => state.addItem)
    const [selectedProduct, setSelectedProduct] = React.useState<Product | null>(null)
    const [modalOpen, setModalOpen] = React.useState(false)

    const handleProductClick = (product: Product) => {
        // Check if product has modifier groups
        if (product.modifier_groups && product.modifier_groups.length > 0) {
            setSelectedProduct(product)
            setModalOpen(true)
        } else {
            addItem(product)
        }
    }

    return (
        <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
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
                            className="relative bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md hover:border-primary transition-all active:scale-95 text-left p-0"
                            onClick={() => handleProductClick(product)}
                        >
                            {/* Left color stripe for category */}
                            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${categoryColor}`} />

                            <div className="pl-4 pr-3 py-4">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <h3 className="text-base font-bold text-slate-800 leading-tight line-clamp-2 flex-1">
                                        {product.name}
                                    </h3>
                                    {noRecipe && (
                                        <Badge variant="outline" className="text-xs shrink-0 bg-yellow-50 text-yellow-700 border-yellow-300">
                                            Sin receta
                                        </Badge>
                                    )}
                                    {isNegative && (
                                        <Badge variant="outline" className="text-xs shrink-0 bg-red-50 text-red-600 border-red-300">
                                            {units}
                                        </Badge>
                                    )}
                                    {isOutOfStock && (
                                        <Badge variant="outline" className="text-xs shrink-0 bg-red-50 text-red-600 border-red-300">
                                            Sin stock
                                        </Badge>
                                    )}
                                    {isLowStock && (
                                        <Badge variant="outline" className="text-xs shrink-0 border-orange-500 text-orange-700">
                                            {units}
                                        </Badge>
                                    )}
                                    {hasStock && (
                                        <Badge variant="secondary" className="text-xs shrink-0">
                                            {units}
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-xl font-extrabold text-green-600">
                                    ${product.price.toLocaleString()}
                                </p>
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

