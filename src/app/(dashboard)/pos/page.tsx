'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useProductsWithStock } from '@/hooks/use-products'
import { ProductGrid } from '@/components/pos/product-grid'
import { CartSidebar } from '@/components/pos/cart-sidebar'
import { Input } from '@/components/ui/input'
import { Search, Menu, UtensilsCrossed, ShoppingCart, Info } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { DailySalesWidget } from '@/components/pos/daily-sales-widget'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useCurrentShift } from '@/hooks/use-sessions'
import { Clock, Sun, Moon } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { MealRegistration } from '@/components/employee/meal-registration'
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useCartStore } from '@/lib/store/cart'

export default function POSPage() {
    const { data: products, isLoading } = useProductsWithStock()
    const [search, setSearch] = useState('')
    const [selectedCategory, setSelectedCategory] = useState<string | null>('Combos')
    const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null)
    const [mealDialogOpen, setMealDialogOpen] = useState(false)
    const { total, items } = useCartStore()
    const [isCartOpen, setIsCartOpen] = useState(false)

    // Define custom category order (most used first)
    const categoryOrder = [
        'Combos',
        'Promociones',
        'Fritanga',
        'Bebidas',
        'Adiciones',
        'Pollo',
        'Bowls'
    ]

    // Derive and sort categories by custom order
    const allCategories = Array.from(new Set(products?.map(p => p.category).filter(Boolean) as string[]))
    const categories = allCategories.sort((a, b) => {
        const indexA = categoryOrder.indexOf(a)
        const indexB = categoryOrder.indexOf(b)
        const posA = indexA === -1 ? 999 : indexA
        const posB = indexB === -1 ? 999 : indexB
        return posA - posB
    })

    // Get subcategories for selected category - simple version
    const subcategories: string[] = []
    if (selectedCategory && products) {
        const subcatSet = new Set<string>()
        products.forEach(p => {
            if (p.category === selectedCategory && p.subcategory) {
                subcatSet.add(p.subcategory)
            }
        })
        subcategories.push(...Array.from(subcatSet))
    }

    const filteredProducts = products?.filter(p => {
        const matchSearch = p.name.toLowerCase().includes(search.toLowerCase())
        const matchCat = selectedCategory ? p.category === selectedCategory : true
        const matchSubcat = selectedSubcategory ? p.subcategory === selectedSubcategory : true
        return matchSearch && matchCat && matchSubcat && p.active
    }) || []

    return (
        <div className="flex flex-col h-screen bg-slate-100 dark:bg-slate-950">
            {/* Header with Menu Button */}
            <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-950 border-b shadow-sm sticky top-0 z-20">
                <Button
                    variant="ghost"
                    size="icon"
                    className="hover:bg-slate-100"
                    onClick={() => window.location.hash = 'menu'}
                >
                    <Menu className="h-6 w-6" />
                </Button>
                <div className="flex-1 overflow-hidden">
                    <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-emerald-600 text-transparent bg-clip-text whitespace-nowrap">
                        Street Food POS
                    </span>
                </div>
                <div className="flex-shrink-0">
                    <ShiftBadge />
                </div>
            </div>

            {/* Main POS Content */}
            <div className="flex flex-col md:flex-row flex-1 gap-4 p-4 overflow-hidden pb-24 md:pb-4">
                {/* Left: Product Catalog */}
                <div className="flex-1 flex flex-col min-w-0 relative h-full">

                    {/* Category filter buttons - Scrollable horizontally on mobile */}
                    <div className="bg-slate-100 dark:bg-slate-950 pb-3 mb-2 -mx-4 px-4 md:mx-0 md:px-0">
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                            <div className="relative flex-shrink-0">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                <Input
                                    placeholder="Buscar..."
                                    className="pl-9 h-12 w-[160px] md:w-[180px] bg-white text-base"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                            <button
                                onClick={() => setSelectedCategory(null)}
                                className={`px-4 py-3 min-h-[48px] rounded-xl whitespace-nowrap text-base font-bold transition-all flex-shrink-0 ${!selectedCategory
                                    ? 'bg-slate-900 text-white shadow-lg'
                                    : 'bg-white text-slate-700 hover:bg-slate-100 border-2 border-slate-200'
                                    }`}
                            >
                                Todos
                            </button>
                            {categories.map(cat => {
                                const isSelected = selectedCategory === cat
                                const isSpecial = cat === 'Combos' || cat === 'Promociones'

                                let buttonClass = 'px-4 py-3 min-h-[48px] rounded-xl whitespace-nowrap text-base font-bold transition-all flex-shrink-0 '

                                if (isSelected) {
                                    if (isSpecial) {
                                        buttonClass += 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg scale-105'
                                    } else {
                                        buttonClass += 'bg-slate-900 text-white shadow-lg'
                                    }
                                } else {
                                    if (isSpecial) {
                                        buttonClass += 'bg-orange-50 text-orange-700 hover:bg-orange-100 border-2 border-orange-300'
                                    } else {
                                        buttonClass += 'bg-white text-slate-700 hover:bg-slate-100 border-2 border-slate-200'
                                    }
                                }

                                return (
                                    <button
                                        key={cat}
                                        onClick={() => {
                                            setSelectedCategory(cat)
                                            setSelectedSubcategory(null)
                                        }}
                                        className={buttonClass}
                                    >
                                        {cat}
                                    </button>
                                )
                            })}
                        </div>

                        {/* Subcategory tabs */}
                        {subcategories.length > 0 && (
                            <div className="flex gap-2 mt-2 overflow-x-auto pb-1 scrollbar-hide">
                                <button
                                    onClick={() => setSelectedSubcategory(null)}
                                    className={`px-4 py-2 rounded-lg whitespace-nowrap text-sm font-semibold flex-shrink-0 ${!selectedSubcategory
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                                        }`}
                                >
                                    Todas
                                </button>
                                {subcategories.map(subcat => (
                                    <button
                                        key={subcat}
                                        onClick={() => setSelectedSubcategory(subcat)}
                                        className={`px-4 py-2 rounded-lg whitespace-nowrap text-sm font-semibold flex-shrink-0 ${selectedSubcategory === subcat
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                                            }`}
                                    >
                                        {subcat}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <ScrollArea className="flex-1 -mx-2 px-2 md:mx-0 md:px-0">
                        {isLoading ? (
                            <div className="flex justify-center py-20">Cargando productos...</div>
                        ) : (
                            <ProductGrid products={filteredProducts} />
                        )}
                        <div className="h-24 md:h-0" /> {/* Spacer for bottom bar */}
                    </ScrollArea>

                </div>

                {/* Center: Cart - Hidden on mobile/tablet, visible on desktop */}
                <div className="hidden lg:flex w-[380px] h-full flex-shrink-0 flex-col">
                    <CartSidebar />
                </div>

                {/* Right: Daily Summary - Hidden on mobile/tablet/laptop, visible on large screens */}
                <div className="hidden xl:flex w-[320px] h-full flex-shrink-0 flex-col">
                    <DailySalesWidget />
                </div>
            </div>

            {/* Mobile Bottom Bar - Cart Trigger */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t p-4 z-40 flex gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
                    <SheetTrigger asChild>
                        <Button className="flex-1 h-14 text-lg font-bold bg-slate-900 hover:bg-slate-800 relative shadow-xl">
                            <ShoppingCart className="mr-2 h-5 w-5" />
                            Ver Pedido
                            <span className="ml-2 bg-emerald-500 text-white px-2 py-0.5 rounded text-sm">
                                ${total().toLocaleString()}
                            </span>
                            {items.length > 0 && (
                                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center border-2 border-white">
                                    {items.length}
                                </span>
                            )}
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="bottom" className="h-[85vh] p-0 flex flex-col rounded-t-[20px]">
                        <div className="p-4 border-b flex items-center justify-between">
                            <h2 className="text-xl font-bold">Tu Pedido</h2>
                            <div className="text-sm text-muted-foreground">{items.length} items</div>
                        </div>
                        <div className="flex-1 overflow-hidden p-2">
                            <CartSidebar />
                        </div>
                    </SheetContent>
                </Sheet>

                {/* Mobile Info Button */}
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="outline" size="icon" className="h-14 w-14 rounded-xl border-2">
                            <Info className="h-6 w-6 text-slate-600" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="bottom" className="h-[70vh] p-4 rounded-t-[20px] overflow-y-auto">
                        <SheetHeader className="mb-4">
                            <SheetTitle>Información del Turno</SheetTitle>
                        </SheetHeader>
                        <DailySalesWidget />
                    </SheetContent>
                </Sheet>
            </div>


            {/* Floating Action Button for Employee Meals */}
            <Dialog open={mealDialogOpen} onOpenChange={setMealDialogOpen}>
                <DialogTrigger asChild>
                    <Button
                        size="lg"
                        className="fixed bottom-24 lg:bottom-6 right-6 h-14 w-14 lg:h-16 lg:w-16 rounded-full shadow-2xl bg-orange-500 hover:bg-orange-600 z-30"
                        title="Registrar Comida Personal"
                    >
                        <UtensilsCrossed className="h-6 w-6 lg:h-7 lg:w-7" />
                    </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-2xl">Registrar Comida Personal 🍽️</DialogTitle>
                    </DialogHeader>
                    <MealRegistration />
                </DialogContent>
            </Dialog>
        </div>
    )
}

function ShiftBadge() {
    const { data: shift, isLoading } = useCurrentShift()

    if (isLoading || !shift) return null

    const isMorning = shift.name === 'Mañana'

    return (
        <div className={`flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 rounded-full text-[10px] md:text-xs font-bold border ${isMorning
            ? 'bg-amber-100 text-amber-700 border-amber-200'
            : 'bg-indigo-100 text-indigo-700 border-indigo-200'
            }`}>
            {isMorning ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
            <span className="hidden md:inline">Turno</span>
            <span>{shift.name}</span>
            <span className="hidden md:inline opacity-70 ml-1">
                ({shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)})
            </span>
        </div>
    )
}



