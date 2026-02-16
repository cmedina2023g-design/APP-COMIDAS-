'use client'

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCreateProduct, useUpdateProduct, useProductWithRecipes, useCategories } from '@/hooks/use-products'
import { useIngredients } from '@/hooks/use-inventory'
import { Product } from '@/lib/types'
import { Plus, Trash, Loader2 } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

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
    const { data: fullProduct, isLoading: isLoadingDetails } = useProductWithRecipes(productToEdit?.id || null)

    const [name, setName] = useState('')
    const [price, setPrice] = useState('')
    const [category, setCategory] = useState('')
    const [subcategory, setSubcategory] = useState('')
    const [imageUrl, setImageUrl] = useState('')
    const [isCustomCategory, setIsCustomCategory] = useState(false)

    // Subcategory suggestions based on category
    const subcategorySuggestions: Record<string, string[]> = {
        'Bebidas': ['Aguas', 'Gaseosas', 'Cervezas', 'Jugos', 'Maltas', 'Energizantes'],
        'Fritanga': ['Salchipapas', 'Papas', 'Chorizos', 'Arepas'],
        'Pollo': ['Alitas', 'Dedos', 'Pechuga'],
        'Adiciones': ['Salsas', 'Extras', 'Toppings']
    }

    // Recipe State
    const [recipeItems, setRecipeItems] = useState<{ ingredient_id: string, qty: number }[]>([])
    const [selectedIngredient, setSelectedIngredient] = useState('')
    const [selectedQty, setSelectedQty] = useState('')

    useEffect(() => {
        if (productToEdit) {
            if (fullProduct) {
                setName(fullProduct.name)
                setPrice(fullProduct.price.toString())
                setCategory(fullProduct.category || '')
                setSubcategory(fullProduct.subcategory || '')
                setImageUrl(fullProduct.image_url || '')
                setRecipeItems(fullProduct.recipes.map((r: any) => ({ ingredient_id: r.ingredient_id, qty: r.qty })))
                setIsCustomCategory(false)
            }
        } else {
            setName('')
            setPrice('')
            setCategory('')
            setSubcategory('')
            setImageUrl('')
            setRecipeItems([])
            setIsCustomCategory(false)
        }
    }, [productToEdit, fullProduct, open])

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

        try {
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
                    recipes: recipeItems
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
                    recipes: recipeItems
                })
            }
            onOpenChange(false)
        } catch (e) {
            // Error handled in hook
        }
    }

    const getIngredientName = (id: string) => ingredients?.find(i => i.id === id)?.name || id

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>{productToEdit ? 'Editar Producto' : 'Nuevo Producto'}</DialogTitle>
                </DialogHeader>

                {productToEdit && isLoadingDetails ? (
                    <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto p-1">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Nombre</Label>
                                <Input value={name} onChange={e => setName(e.target.value)} required />
                            </div>
                            <div className="space-y-2">
                                <Label>Precio Venta</Label>
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

                        {/* Subcategory field */}
                        {category && subcategorySuggestions[category] && (
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

                        <div className="border-t pt-4">
                            <h4 className="text-sm font-medium mb-2">Receta (Descuento de Inventario)</h4>
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
                                        <TableRow>
                                            <TableHead className="py-2">Insumo</TableHead>
                                            <TableHead className="py-2">Cant.</TableHead>
                                            <TableHead className="py-2"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {recipeItems.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={3} className="text-center text-muted-foreground text-xs">Sin ingredientes</TableCell>
                                            </TableRow>
                                        )}
                                        {recipeItems.map((item, idx) => (
                                            <TableRow key={idx}>
                                                <TableCell className="py-2">{getIngredientName(item.ingredient_id)}</TableCell>
                                                <TableCell className="py-2">{item.qty}</TableCell>
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
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
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
