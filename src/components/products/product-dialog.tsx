'use client'

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCreateProduct, useUpdateProduct, useProductWithRecipes, useCategories } from '@/hooks/use-products'
import { useIngredients } from '@/hooks/use-inventory'
import { useProfiles } from '@/hooks/use-profiles'
import { useShifts } from '@/hooks/use-sessions'
import { Product } from '@/lib/types'
import { Plus, Trash, Loader2, User, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface ProductDialogProps {
    productToEdit?: Product | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function ProductDialog({ productToEdit, open, onOpenChange }: ProductDialogProps) {
    const createMutation = useCreateProduct()
    const updateMutation = useUpdateProduct()
    const { data: ingredients } = useIngredients()
    const { data: availableCategories } = useCategories()
    const { data: profiles } = useProfiles()
    const { data: shiftsConfig } = useShifts()
    const { data: fullProduct, isLoading: isLoadingDetails } = useProductWithRecipes(productToEdit?.id || null)

    const runners = profiles?.filter(p => p.role === 'RUNNER' && p.active) || []

    const [name, setName] = useState('')
    const [price, setPrice] = useState('')
    const [category, setCategory] = useState('')
    const [subcategory, setSubcategory] = useState('')
    const [imageUrl, setImageUrl] = useState('')
    const [isCustomCategory, setIsCustomCategory] = useState(false)

    // Runner Prices State
    const [runnerPrices, setRunnerPrices] = useState<{ runner_id: string, price: number | '' }[]>([])

    // Shift Prices State
    const [shiftPrices, setShiftPrices] = useState<{ shift_id: string, price: number | '' }[]>([])

    // Subcategory suggestions based on category
    const subcategorySuggestions: Record<string, string[]> = {
        'Bebidas': ['Aguas', 'Gaseosas', 'Cervezas', 'Jugos', 'Maltas', 'Energizantes'],
        'Fritanga': ['Salchipapas', 'Papas', 'Chorizos', 'Arepas'],
        'Pollo': ['Alitas', 'Dedos', 'Pechuga'],
        'Adiciones': ['Salsas', 'Extras', 'Toppings']
    }

    // Recipe State
    const [recipeItems, setRecipeItems] = useState<{ ingredient_id: string, qty: number | '' }[]>([])
    const [selectedIngredient, setSelectedIngredient] = useState('')
    const [selectedQty, setSelectedQty] = useState('')

    // State for Modifiers
    const [modifierGroups, setModifierGroups] = useState<any[]>([])

    // 1. Immediate population of basic fields from productToEdit (already available)
    useEffect(() => {
        if (open) {
            setModifierGroups([])
            
            if (productToEdit) {
                setName(productToEdit.name)
                setPrice(productToEdit.price.toString())
                setCategory(productToEdit.category || '')
                setSubcategory(productToEdit.subcategory || '')
                setImageUrl(productToEdit.image_url || '')
                setIsCustomCategory(false)
            } else {
                setName('')
                setPrice('')
                setCategory('')
                setSubcategory('')
                setImageUrl('')
                setIsCustomCategory(false)
                setRunnerPrices([])
                setShiftPrices([])
                setRecipeItems([])
            }
        }
    }, [productToEdit, open])

    // 2. Population of complex fields when fullProduct (with recipes/prices) is loaded
    useEffect(() => {
        if (open && productToEdit && fullProduct) {
            // Update name/price/category just in case they differ (unlikely but safe)
            setName(fullProduct.name)
            setPrice(fullProduct.price.toString())
            setCategory(fullProduct.category || '')
            setSubcategory(fullProduct.subcategory || '')
            setImageUrl(fullProduct.image_url || '')
            
            setRunnerPrices(fullProduct.runner_prices?.map((rp: any) => ({
                runner_id: rp.runner_id,
                price: rp.price
            })) || [])
            setShiftPrices(fullProduct.shift_prices?.map((sp: any) => ({
                shift_id: sp.shift_id,
                price: sp.price
            })) || [])
            setRecipeItems(fullProduct.recipes?.map((r: any) => ({
                ingredient_id: r.ingredient_id,
                qty: r.qty
            })) || [])
            setModifierGroups(fullProduct.modifier_groups || [])
        }
    }, [fullProduct, open, productToEdit])

    const addIngredient = () => {
        if (!selectedIngredient || !selectedQty) return
        setRecipeItems([...recipeItems, { ingredient_id: selectedIngredient, qty: Number(selectedQty) }])
        setSelectedIngredient('')
        setSelectedQty('')
    }

    const removeIngredient = (index: number) => {
        const newItems = [...recipeItems]
        newItems.splice(index, 1)
        setRecipeItems(newItems)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!name.trim()) {
            toast.error('Nombre requerido', { description: 'Falta el nombre del producto (pestaña Datos Básicos)' })
            return
        }

        if (Number(price) < 0 || price === '') {
            toast.error('Precio inválido', { description: 'Revisa el precio del producto (pestaña Datos Básicos)' })
            return
        }

        for (const group of modifierGroups) {
            if (group.max_selections < group.min_selections) {
                toast.error(`Grupo "${group.name}": el mínimo (${group.min_selections}) no puede ser mayor que el máximo (${group.max_selections}).`)
                return
            }
        }

        try {
            // Clean up empty numbers from recipes and prices before saving
            const safeRecipeItems = recipeItems.map(r => ({ ...r, qty: Number(r.qty) || 0 }))
            const safeRunnerPrices = runnerPrices.map(rp => ({ ...rp, price: Number(rp.price) || 0 }))
            const safeShiftPrices = shiftPrices.map(sp => ({ ...sp, price: Number(sp.price) || 0 }))

            if (productToEdit) {
                await updateMutation.mutateAsync({
                    id: productToEdit.id,
                    product: {
                        name,
                        price: Number(price),
                        category,
                        subcategory: subcategory || null,
                        image_url: imageUrl
                    },
                    recipes: safeRecipeItems,
                    modifier_groups: modifierGroups,
                    runner_prices: safeRunnerPrices,
                    shift_prices: safeShiftPrices
                })
            } else {
                await createMutation.mutateAsync({
                    product: {
                        name,
                        price: Number(price),
                        category,
                        subcategory: subcategory || null,
                        image_url: imageUrl,
                        active: true
                    },
                    recipes: safeRecipeItems,
                    modifier_groups: modifierGroups,
                    runner_prices: safeRunnerPrices,
                    shift_prices: safeShiftPrices
                })
            }
            onOpenChange(false)
        } catch (e) {
            // Error handled in hook
        }
    }

    const getIngredientName = (id: string) => ingredients?.find(i => i.id === id)?.name || id
    const getIngredientUnit = (id: string) => ingredients?.find(i => i.id === id)?.unit || ''

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col" aria-describedby={undefined}>
                <DialogHeader className="shrink-0">
                    <DialogTitle>{productToEdit ? 'Editar Producto' : 'Nuevo Producto'}</DialogTitle>
                </DialogHeader>

                {productToEdit && isLoadingDetails ? (
                    <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>
                ) : (
                    <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
                        <Tabs defaultValue="general" className="w-full flex-1 flex flex-col overflow-hidden">
                            <TabsList className="grid w-full grid-cols-3 mb-2 shrink-0">
                                <TabsTrigger value="general">Datos Básicos</TabsTrigger>
                                <TabsTrigger value="recipe">Receta Base</TabsTrigger>
                                <TabsTrigger value="modifiers">Modificadores</TabsTrigger>
                            </TabsList>

                            <div className="flex-1 overflow-y-auto px-1 pb-4 pr-2">
                                <TabsContent value="general" className="space-y-4 m-0 py-2">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Nombre</Label>
                                            <Input value={name} onChange={e => setName(e.target.value)} required />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Precio Venta (General)</Label>
                                            <Input type="number" value={price} onChange={e => setPrice(e.target.value)} required min="0" />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Categoría</Label>
                                        {isCustomCategory ? (
                                            <div className="flex gap-2">
                                                <Input
                                                    value={category}
                                                    onChange={e => setCategory(e.target.value)}
                                                    placeholder="Nueva categoría..."
                                                    autoFocus
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => { setIsCustomCategory(false); setCategory(''); }}
                                                    title="Volver a lista"
                                                >
                                                    <Trash className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <Select
                                                value={category}
                                                onValueChange={(val) => {
                                                    if (val === 'new_category_custom') {
                                                        setIsCustomCategory(true)
                                                        setCategory('')
                                                    } else {
                                                        setCategory(val)
                                                    }
                                                }}
                                            >
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Seleccionar categoría" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {availableCategories?.map(cat => (
                                                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                                    ))}
                                                    <SelectItem value="new_category_custom" className="text-blue-500 font-medium">
                                                        + Nueva Categoría...
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )}
                                    </div>

                                    {/* Subcategory field - show if category has suggestions OR if it already has a subcategory */}
                                    {(category && (subcategorySuggestions[category] || subcategory)) && (
                                        <div className="space-y-2">
                                            <Label>Subcategoría (opcional)</Label>
                                            <div className="relative">
                                                <Input
                                                    value={subcategory}
                                                    onChange={e => setSubcategory(e.target.value)}
                                                    placeholder="Ej: Aguas, Gaseosas..."
                                                    list="subcategory-suggestions"
                                                />
                                                <datalist id="subcategory-suggestions">
                                                    {subcategorySuggestions[category]?.map(sub => (
                                                        <option key={sub} value={sub} />
                                                    ))}
                                                </datalist>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                Sugerencias: {subcategorySuggestions[category]?.join(', ')}
                                            </p>
                                        </div>
                                    )}

                                    {/* Componente Precios Especiales por Corredor */}
                                    <div className="mt-8 pt-4 border-t space-y-4 bg-muted/20 -mx-1 px-1 rounded pb-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h4 className="text-sm font-bold text-slate-700">Precios por Corredor</h4>
                                                <p className="text-xs text-slate-500">Asigna un precio diferente a cada corredor. Opcional.</p>
                                            </div>
                                            <Button type="button" size="sm" variant="outline" className="h-8 text-xs bg-white text-blue-600 border-blue-200" onClick={() => {
                                                setRunnerPrices([...runnerPrices, { runner_id: '', price: 0 }])
                                            }}>
                                                <User className="h-3 w-3 mr-1" /> Añadir Corredor
                                            </Button>
                                        </div>

                                        {runnerPrices.length === 0 ? (
                                            <div className="text-center py-4 bg-white border border-dashed rounded-lg text-sm text-slate-400">
                                                No hay precios especiales. Todos usarán el precio general.
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {runnerPrices.map((rp, idx) => (
                                                    <div key={idx} className="flex items-center gap-2 bg-white p-2 border rounded-lg shadow-sm">
                                                        <div className="flex-1">
                                                            <Select value={rp.runner_id} onValueChange={(val) => {
                                                                const clone = [...runnerPrices]
                                                                clone[idx].runner_id = val
                                                                setRunnerPrices(clone)
                                                            }}>
                                                                <SelectTrigger className="h-9 text-sm">
                                                                    <SelectValue placeholder="Seleccionar corredor..." />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {runners.map(r => (
                                                                        <SelectItem key={r.id} value={r.id} disabled={runnerPrices.some(existing => existing.runner_id === r.id && existing !== rp)}>
                                                                            {r.full_name}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="w-32">
                                                            <div className="relative">
                                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                                                                <Input type="number" value={rp.price === '' ? '' : rp.price} min="0" placeholder="Precio" className="pl-6 h-9" onChange={(e) => {
                                                                    const clone = [...runnerPrices]
                                                                    clone[idx].price = e.target.value === '' ? '' : Number(e.target.value)
                                                                    setRunnerPrices(clone)
                                                                }} />
                                                            </div>
                                                        </div>
                                                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50" onClick={() => {
                                                            const clone = [...runnerPrices]
                                                            clone.splice(idx, 1)
                                                            setRunnerPrices(clone)
                                                        }}>
                                                            <Trash className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Componente Precios Especiales por Turno */}
                                    <div className="mt-8 pt-4 border-t space-y-4 bg-muted/20 -mx-1 px-1 rounded pb-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h4 className="text-sm font-bold text-slate-700">Precios por Turno (Local)</h4>
                                                <p className="text-xs text-slate-500">Cambia el precio automáticamente dependiendo de la hora del día.</p>
                                            </div>
                                            <Button type="button" size="sm" variant="outline" className="h-8 text-xs bg-white text-emerald-600 border-emerald-200" onClick={() => {
                                                setShiftPrices([...shiftPrices, { shift_id: '', price: 0 }])
                                            }}>
                                                <Clock className="h-3 w-3 mr-1" /> Añadir Turno
                                            </Button>
                                        </div>

                                        {shiftPrices.length === 0 ? (
                                            <div className="text-center py-4 bg-white border border-dashed rounded-lg text-sm text-slate-400">
                                                No hay precios por turno. Se aplicará el precio general siempre.
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {shiftPrices.map((sp, idx) => (
                                                    <div key={idx} className="flex items-center gap-2 bg-white p-2 border rounded-lg shadow-sm">
                                                        <div className="flex-1">
                                                            <Select value={sp.shift_id} onValueChange={(val) => {
                                                                const clone = [...shiftPrices]
                                                                clone[idx].shift_id = val
                                                                setShiftPrices(clone)
                                                            }}>
                                                                <SelectTrigger className="h-9 text-sm">
                                                                    <SelectValue placeholder="Seleccionar turno..." />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {shiftsConfig?.map(s => (
                                                                        <SelectItem key={s.id} value={s.id} disabled={shiftPrices.some(existing => existing.shift_id === s.id && existing !== sp)}>
                                                                            {s.name} ({s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)})
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="w-32">
                                                            <div className="relative">
                                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                                                                <Input type="number" value={sp.price === '' ? '' : sp.price} min="0" placeholder="Precio" className="pl-6 h-9" onChange={(e) => {
                                                                    const clone = [...shiftPrices]
                                                                    clone[idx].price = e.target.value === '' ? '' : Number(e.target.value)
                                                                    setShiftPrices(clone)
                                                                }} />
                                                            </div>
                                                        </div>
                                                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50" onClick={() => {
                                                            const clone = [...shiftPrices]
                                                            clone.splice(idx, 1)
                                                            setShiftPrices(clone)
                                                        }}>
                                                            <Trash className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </TabsContent>

                                <TabsContent value="recipe" className="space-y-4 m-0 py-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-sm font-medium">Receta (Descuento de Inventario)</h4>
                                        {recipeItems.length > 0 && (
                                            <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">
                                                {recipeItems.length} insumo{recipeItems.length !== 1 ? 's' : ''}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex gap-2 items-end mb-2">
                                        <div className="flex-1">
                                            <Label className="text-xs">Insumo</Label>
                                            <Select value={selectedIngredient} onValueChange={setSelectedIngredient}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccionar insumo" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {ingredients?.map(ing => (
                                                        <SelectItem key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="w-24">
                                            <Label className="text-xs">Cantidad</Label>
                                            <Input type="number" value={selectedQty} onChange={e => setSelectedQty(e.target.value)} placeholder="Qty" />
                                        </div>
                                        <Button type="button" size="icon" onClick={addIngredient} disabled={!selectedIngredient || !selectedQty}>
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>

                                    <div className="border rounded-md">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/40">
                                                    <TableHead className="py-2">Insumo</TableHead>
                                                    <TableHead className="py-2">Cantidad / Unidad</TableHead>
                                                    <TableHead className="py-2"></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {recipeItems.length === 0 && (
                                                    <TableRow>
                                                        <TableCell colSpan={3} className="text-center text-muted-foreground text-xs py-4">Sin ingredientes — este producto no descuenta inventario</TableCell>
                                                    </TableRow>
                                                )}
                                                {recipeItems.map((item, idx) => (
                                                    <TableRow key={idx} className="hover:bg-muted/20">
                                                        <TableCell className="py-2 font-medium">{getIngredientName(item.ingredient_id)}</TableCell>
                                                        <TableCell className="py-2">
                                                            <span className="font-semibold text-blue-700">{item.qty}</span>
                                                            {' '}
                                                            <span className="text-muted-foreground text-xs">{getIngredientUnit(item.ingredient_id)}</span>
                                                        </TableCell>
                                                        <TableCell className="py-2 text-right">
                                                            <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeIngredient(idx)}>
                                                                <Trash className="h-3 w-3 text-red-500" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </TabsContent>

                                <TabsContent value="modifiers" className="space-y-4 m-0 py-4">
                                    <div className="p-4 border rounded-md border-dashed text-center bg-muted/20">
                                        <h3 className="font-medium text-sm text-foreground mb-1">Configuración de Opciones y Modificadores</h3>
                                        <p className="text-xs text-muted-foreground mb-4 max-w-sm mx-auto">
                                            Crea grupos de opciones (Ej: "Bases", "Carnes", "Bebidas").
                                            El cajero deberá elegir opciones de estos grupos al agregar el producto.
                                        </p>
                                        {/* Modifier configuration UI will go here */}
                                        <Button type="button" variant="outline" size="sm" onClick={() => setModifierGroups([...modifierGroups, { name: 'Nuevo Grupo', min_selections: 0, max_selections: 1, modifiers: [] }])}>
                                            <Plus className="h-4 w-4 mr-2" /> Agregar Grupo Modificador
                                        </Button>
                                    </div>

                                    {/* Render modifier groups */}
                                    {modifierGroups.map((group, gIdx) => (
                                        <div key={gIdx} className="border rounded-md p-4 bg-muted/5 space-y-4">
                                            {/* Edit group header */}
                                            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b pb-4">
                                                <div className="flex-1 w-full space-y-2">
                                                    <Label className="text-xs font-bold text-slate-700">Nombre del Grupo</Label>
                                                    <Input value={group.name} onChange={e => {
                                                        const newG = [...modifierGroups]; newG[gIdx].name = e.target.value; setModifierGroups(newG);
                                                    }} placeholder="Ej: Elige tu Proteína" className="bg-white border-slate-300" />
                                                </div>
                                                <div className="flex gap-4">
                                                    <div className="w-24 space-y-2">
                                                        <Label className="text-xs font-bold text-slate-700" title="¿Cuántas opciones debe elegir obligatoriamente?">Mínimo</Label>
                                                        <Input type="number" min="0" value={group.min_selections} className={`bg-white ${group.max_selections < group.min_selections ? 'border-red-500' : ''}`} onChange={e => {
                                                            const newG = [...modifierGroups]; newG[gIdx].min_selections = Number(e.target.value); setModifierGroups(newG);
                                                        }} />
                                                    </div>
                                                    <div className="w-24 space-y-2">
                                                        <Label className="text-xs font-bold text-slate-700" title="¿Cuántas opciones puede elegir como máximo?">Máximo</Label>
                                                        <Input type="number" min="1" value={group.max_selections} className={`bg-white ${group.max_selections < group.min_selections ? 'border-red-500' : ''}`} onChange={e => {
                                                            const newG = [...modifierGroups]; newG[gIdx].max_selections = Number(e.target.value); setModifierGroups(newG);
                                                        }} />
                                                    </div>
                                                    <Button type="button" variant="destructive" size="icon" className="mb-[2px]" title="Eliminar Grupo" onClick={() => {
                                                        const newG = [...modifierGroups]; newG.splice(gIdx, 1); setModifierGroups(newG);
                                                    }}>
                                                        <Trash className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Modifiers inside group */}
                                            <div className="pl-2 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-xs font-bold text-slate-700">Opciones a Mostrar</Label>
                                                    <Button type="button" variant="default" size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700" onClick={() => {
                                                        const newG = [...modifierGroups];
                                                        newG[gIdx].modifiers = [...(newG[gIdx].modifiers || []), { name: '', extra_price: 0, recipes: [] }];
                                                        setModifierGroups(newG);
                                                    }}>
                                                        <Plus className="h-3 w-3 mr-1" /> Añadir Opción
                                                    </Button>
                                                </div>

                                                {group.modifiers?.map((mod: any, mIdx: number) => (
                                                    <div key={mIdx} className="bg-slate-50 border rounded-lg p-3 text-sm shadow-sm space-y-3">
                                                        <div className="flex gap-3 items-center">
                                                            <div className="flex-1 space-y-1">
                                                                <Label className="text-[10px] uppercase text-muted-foreground font-semibold">Nombre de Opción</Label>
                                                                <Input placeholder="Ej: Pollo Desmechado" value={mod.name} className="h-8 bg-white border-slate-300" onChange={e => {
                                                                    const newG = [...modifierGroups]; newG[gIdx].modifiers[mIdx].name = e.target.value; setModifierGroups(newG);
                                                                }} />
                                                            </div>
                                                            <div className="w-32 space-y-1">
                                                                <Label className="text-[10px] uppercase text-muted-foreground font-semibold">Precio Extra ($)</Label>
                                                                <Input type="number" placeholder="0" value={mod.extra_price} className="h-8 bg-white border-slate-300" onChange={e => {
                                                                    const newG = [...modifierGroups]; newG[gIdx].modifiers[mIdx].extra_price = Number(e.target.value); setModifierGroups(newG);
                                                                }} />
                                                            </div>
                                                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500 mt-5" onClick={() => {
                                                                const newG = [...modifierGroups]; newG[gIdx].modifiers.splice(mIdx, 1); setModifierGroups(newG);
                                                            }}>
                                                                <Trash className="h-4 w-4" />
                                                            </Button>
                                                        </div>

                                                        {/* Modifier Recipes */}
                                                        <div className="bg-white border rounded p-2 text-xs space-y-2">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-slate-600 font-medium flex items-center gap-1 text-[11px]">
                                                                    ¿Esta opción descuenta insumos del inventario?
                                                                    {mod.recipes?.length > 0 && <span className="bg-blue-100 text-blue-700 font-bold px-1.5 rounded-sm ml-1">{mod.recipes.length}</span>}
                                                                </span>
                                                                <Button type="button" variant="outline" size="sm" className="h-6 text-[10px] text-blue-600 border-blue-200 hover:bg-blue-50" onClick={() => {
                                                                    const newG = [...modifierGroups];
                                                                    newG[gIdx].modifiers[mIdx].recipes = [...(newG[gIdx].modifiers[mIdx].recipes || []), { ingredient_id: '', qty: 0 }];
                                                                    setModifierGroups(newG);
                                                                }}>
                                                                    + Vincular Insumo
                                                                </Button>
                                                            </div>

                                                            {mod.recipes?.map((rec: any, rIdx: number) => (
                                                                <div key={rIdx} className="flex gap-2 items-center bg-slate-50 p-1 rounded border">
                                                                    <div className="flex-1">
                                                                        <Select value={rec.ingredient_id} onValueChange={(val) => {
                                                                            const newG = [...modifierGroups]; newG[gIdx].modifiers[mIdx].recipes[rIdx].ingredient_id = val; setModifierGroups(newG);
                                                                        }}>
                                                                            <SelectTrigger className="h-7 text-xs bg-white">
                                                                                <SelectValue placeholder="Seleccionar insumo" />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                {ingredients?.map(ing => (
                                                                                    <SelectItem key={ing.id} value={ing.id} className="text-xs">{ing.name} ({ing.unit})</SelectItem>
                                                                                ))}
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>
                                                                    <div className="w-24">
                                                                        <Input type="number" placeholder="Cantidad" className="h-7 text-xs bg-white" value={rec.qty || ''} onChange={e => {
                                                                            const newG = [...modifierGroups]; newG[gIdx].modifiers[mIdx].recipes[rIdx].qty = Number(e.target.value); setModifierGroups(newG);
                                                                        }} />
                                                                    </div>
                                                                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-50" onClick={() => {
                                                                        const newG = [...modifierGroups]; newG[gIdx].modifiers[mIdx].recipes.splice(rIdx, 1); setModifierGroups(newG);
                                                                    }}>
                                                                        <Trash className="h-3 w-3" />
                                                                    </Button>
                                                                </div>
                                                            ))}
                                                            {(!mod.recipes || mod.recipes.length === 0) && (
                                                                <div className="text-muted-foreground opacity-60 text-center py-1 text-[11px] bg-slate-50 rounded">
                                                                    No descuenta insumos adicionales
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                                {(!group.modifiers || group.modifiers.length === 0) && (
                                                    <div className="text-center py-3 text-xs text-muted-foreground border rounded bg-white shadow-sm italic">
                                                        No has añadido ninguna opción a este grupo.
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </TabsContent>
                            </div>
                        </Tabs>

                        <div className="flex justify-end gap-2 pt-4 border-t mt-4">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                                {productToEdit ? 'Guardar Cambios' : 'Crear Producto'}
                            </Button>
                        </div>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    )
}
