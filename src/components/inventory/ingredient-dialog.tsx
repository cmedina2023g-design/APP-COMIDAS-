'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCreateIngredient, useUpdateIngredient, useIngredientCategories } from '@/hooks/use-inventory'
import { Ingredient } from '@/lib/types'
import { Loader2, Trash, Plus } from 'lucide-react'

interface IngredientDialogProps {
    ingredientToEdit?: Ingredient | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function IngredientDialog({ ingredientToEdit, open, onOpenChange }: IngredientDialogProps) {
    const createMutation = useCreateIngredient()
    const updateMutation = useUpdateIngredient()
    const { data: availableCategories } = useIngredientCategories()

    const [name, setName] = useState('')
    const [unit, setUnit] = useState('g')
    const [minStock, setMinStock] = useState('0')
    const [category, setCategory] = useState('')
    const [isCustomCategory, setIsCustomCategory] = useState(false)

    useEffect(() => {
        if (ingredientToEdit) {
            setName(ingredientToEdit.name)
            setUnit(ingredientToEdit.unit)
            setMinStock(ingredientToEdit.min_stock.toString())
            setCategory(ingredientToEdit.category || '')
            setIsCustomCategory(false)
        } else {
            setName('')
            setUnit('g')
            setMinStock('0')
            setCategory('')
            setIsCustomCategory(false)
        }
    }, [ingredientToEdit, open])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        try {
            if (ingredientToEdit) {
                await updateMutation.mutateAsync({
                    id: ingredientToEdit.id,
                    name,
                    unit,
                    min_stock: Number(minStock),
                    category
                })
            } else {
                await createMutation.mutateAsync({
                    name,
                    unit,
                    min_stock: Number(minStock),
                    category: category || null,
                    active: true,
                    stock: 0,
                    cost_unit: 0
                })
            }
            onOpenChange(false)
        } catch (e) {
            // Error handled in hook
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{ingredientToEdit ? 'Editar Insumo' : 'Nuevo Insumo'}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Nombre</Label>
                        <Input value={name} onChange={e => setName(e.target.value)} required placeholder="Ej: Pan Perro" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Unidad</Label>
                            <Select value={unit} onValueChange={setUnit}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="g">Gramos (g)</SelectItem>
                                    <SelectItem value="Kg">Kilogramo (Kg)</SelectItem>
                                    <SelectItem value="ml">Mililitros (ml)</SelectItem>
                                    <SelectItem value="L">Litro (L)</SelectItem>
                                    <SelectItem value="Unidad">Unidad</SelectItem>
                                    <SelectItem value="Paquete">Paquete</SelectItem>
                                    <SelectItem value="Lata">Lata</SelectItem>
                                    <SelectItem value="Botella">Botella</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Stock Mínimo (Alerta)</Label>
                            <Input type="number" value={minStock} onChange={e => setMinStock(e.target.value)} min="0" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Categoría (Opcional)</Label>
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

                    <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                        <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                            {createMutation.isPending || updateMutation.isPending ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                            {ingredientToEdit ? 'Guardar Cambios' : 'Crear Insumo'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
