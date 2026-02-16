'use client'

import React from 'react'
import { Product } from '@/lib/types'
import { useCartStore } from '@/lib/store/cart'
import { Badge } from '@/components/ui/badge'

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

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {products.map(product => {
                const categoryColor = categoryColors[product.category || ''] || 'bg-slate-400'
                const availableUnits = product.available_units ?? 999999
                const isLowStock = availableUnits < 5
                const isOutOfStock = availableUnits === 0

                return (
                    <button
                        key={product.id}
                        className={`relative bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md hover:border-primary transition-all active:scale-95 text-left p-0 ${isOutOfStock ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                        onClick={() => !isOutOfStock && addItem(product)}
                        disabled={isOutOfStock}
                    >
                        {/* Left color stripe for category */}
                        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${categoryColor}`} />

                        <div className="pl-4 pr-3 py-4">
                            <div className="flex items-start justify-between gap-2 mb-2">
                                <h3 className="text-base font-bold text-slate-800 leading-tight line-clamp-2 flex-1">
                                    {product.name}
                                </h3>
                                {availableUnits < 999999 && (
                                    <Badge
                                        variant={isOutOfStock ? "destructive" : isLowStock ? "outline" : "secondary"}
                                        className={`text-xs shrink-0 ${isLowStock && !isOutOfStock ? 'border-orange-500 text-orange-700' : ''
                                            }`}
                                    >
                                        {isOutOfStock ? '0' : availableUnits}
                                    </Badge>
                                )}
                            </div>
                            <p className="text-xl font-extrabold text-green-600">
                                ${product.price.toLocaleString()}
                            </p>
                            {isOutOfStock && (
                                <p className="text-xs text-red-600 font-semibold mt-1">Agotado</p>
                            )}
                        </div>
                    </button>
                )
            })}
        </div>
    )
}

