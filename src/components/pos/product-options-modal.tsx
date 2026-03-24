import React, { useState, useEffect } from 'react'
import { Product } from '@/lib/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useCartStore } from '@/lib/store/cart'
import { toast } from 'sonner'

interface ProductOptionsModalProps {
    product: Product | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function ProductOptionsModal({ product, open, onOpenChange }: ProductOptionsModalProps) {
    const addItem = useCartStore(state => state.addItem)

    // State to store selected modifiers: Record<group_id, array of selected modifier_ids>
    const [selections, setSelections] = useState<Record<string, string[]>>({})

    useEffect(() => {
        if (open && product) {
            // Initialize selections based on defaults / min selections if needed
            const initial: Record<string, string[]> = {}
            product.modifier_groups?.forEach(g => {
                initial[g.id] = []
                // If it's a mandatory radio group (min_selections = 1, max_selections = 1) and there are modifiers, 
                // we could pre-select the first one.
                if (g.min_selections === 1 && g.max_selections === 1 && g.modifiers && g.modifiers.length > 0) {
                    initial[g.id] = [g.modifiers[0].id]
                }
            })
            setSelections(initial)
        }
    }, [open, product])

    if (!product) return null

    const groups = product.modifier_groups || []

    const handleSelectSingle = (groupId: string, modifierId: string) => {
        setSelections(prev => ({
            ...prev,
            [groupId]: [modifierId]
        }))
    }

    const handleSelectMultiple = (groupId: string, modifierId: string, max: number, checked: boolean) => {
        setSelections(prev => {
            const current = prev[groupId] || []
            if (checked) {
                if (current.length >= max) {
                    toast.error(`Máximo ${max} opciones permitidas`)
                    return prev
                }
                return { ...prev, [groupId]: [...current, modifierId] }
            } else {
                return { ...prev, [groupId]: current.filter(id => id !== modifierId) }
            }
        })
    }

    const isFormValid = () => {
        return groups.every(g => {
            const count = (selections[g.id] || []).length
            return count >= g.min_selections && count <= g.max_selections
        })
    }

    // Calculate dynamic price
    const calculateTotal = () => {
        let total = product.price
        Object.keys(selections).forEach(groupId => {
            const selectedIds = selections[groupId]
            const group = groups.find(g => g.id === groupId)
            if (group) {
                selectedIds.forEach(modId => {
                    const mod = group.modifiers?.find((m: any) => m.id === modId)
                    if (mod && mod.extra_price) {
                        total += mod.extra_price
                    }
                })
            }
        })
        return total
    }

    const handleAddToCart = () => {
        if (!isFormValid()) {
            toast.error('Por favor completa todas las opciones obligatorias')
            return
        }

        // Gather full modifier objects to attach to the cart item
        const selectedModifiersList: any[] = []
        Object.keys(selections).forEach(groupId => {
            const selectedIds = selections[groupId]
            const group = groups.find(g => g.id === groupId)
            if (group) {
                selectedIds.forEach(modId => {
                    const mod = group.modifiers?.find((m: any) => m.id === modId)
                    if (mod) {
                        selectedModifiersList.push({
                            modifier_id: mod.id,
                            name: mod.name,
                            extra_price: mod.extra_price,
                            group_name: group.name,
                            recipes: mod.recipes
                        })
                    }
                })
            }
        })

        // We use a clone of the product but update its "price" property?
        // Or we pass modifiers in a separate property and let the Cart / Ticket calculate it.
        // Let's pass the modifiers inside the cart item.

        // Let's create an item object to add to cart
        // Notice we need to adjust useCartStore to handle this
        addItem(product, selectedModifiersList)
        onOpenChange(false)
    }

    const currentTotal = calculateTotal()

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col p-0 overflow-hidden border-0 shadow-2xl rounded-2xl" aria-describedby={undefined}>
                <DialogHeader className="px-6 py-5 border-b bg-slate-50 relative shrink-0">
                    <DialogTitle className="text-2xl font-black text-slate-800 pr-8">{product.name}</DialogTitle>
                    <p className="text-lg font-bold text-green-600 mt-1">
                        Total: ${currentTotal.toLocaleString()}
                    </p>
                </DialogHeader>

                <ScrollArea className="flex-1 custom-scrollbar">
                    <div className="px-6 py-6 space-y-8">
                        {groups.map(group => {
                            const isSingleSelection = group.max_selections === 1
                            const selectedCount = (selections[group.id] || []).length
                            const isValid = selectedCount >= group.min_selections && selectedCount <= group.max_selections

                            return (
                                <div key={group.id} className="space-y-4">
                                    <div className="flex items-center justify-between pb-2 border-b">
                                        <h4 className="text-lg font-bold text-slate-800">
                                            {group.name}
                                        </h4>
                                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${isValid ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                            {group.min_selections === group.max_selections
                                                ? `Elige ${group.min_selections}`
                                                : group.min_selections === 0
                                                    ? `Opcional (hasta ${group.max_selections})`
                                                    : `Elige de ${group.min_selections} a ${group.max_selections}`}
                                        </span>
                                    </div>

                                    {isSingleSelection ? (
                                        <RadioGroup
                                            value={selections[group.id]?.[0] || ''}
                                            onValueChange={(val) => handleSelectSingle(group.id, val)}
                                            className="space-y-2 pl-1"
                                        >
                                            {group.modifiers?.map((mod: any) => {
                                                const isSelected = selections[group.id]?.[0] === mod.id
                                                return (
                                                    <label
                                                        key={mod.id}
                                                        className={`flex items-center justify-between space-x-2 border-2 rounded-xl p-4 transition-all cursor-pointer ${isSelected ? 'border-primary bg-primary/5' : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'}`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <RadioGroupItem value={mod.id} id={mod.id} className={isSelected ? 'text-primary' : ''} />
                                                            <div className="font-semibold text-slate-700">{mod.name}</div>
                                                        </div>
                                                        {mod.extra_price > 0 && (
                                                            <span className="text-sm font-bold text-slate-500">+${mod.extra_price.toLocaleString()}</span>
                                                        )}
                                                    </label>
                                                )
                                            })}
                                        </RadioGroup>
                                    ) : (
                                        <div className="space-y-2 pl-1">
                                            {group.modifiers?.map((mod: any) => {
                                                const isChecked = selections[group.id]?.includes(mod.id)
                                                return (
                                                    <label
                                                        key={mod.id}
                                                        className={`flex items-center justify-between space-x-2 border-2 rounded-xl p-4 transition-all cursor-pointer ${isChecked ? 'border-primary bg-primary/5' : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'}`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <Checkbox
                                                                id={mod.id}
                                                                checked={isChecked}
                                                                onCheckedChange={(checked) => handleSelectMultiple(group.id, mod.id, group.max_selections, !!checked)}
                                                                className={isChecked ? 'data-[state=checked]:bg-primary data-[state=checked]:border-primary' : ''}
                                                            />
                                                            <div className="font-semibold text-slate-700">{mod.name}</div>
                                                        </div>
                                                        {mod.extra_price > 0 && (
                                                            <span className="text-sm font-bold text-slate-500">+${mod.extra_price.toLocaleString()}</span>
                                                        )}
                                                    </label>
                                                )
                                            })}
                                            <div className="flex justify-end mt-2">
                                                <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                                                    Seleccionados: {selectedCount} / {group.max_selections}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </ScrollArea>

                <div className="px-6 py-5 border-t bg-white shrink-0 grid grid-cols-2 gap-4">
                    <Button variant="outline" size="lg" className="w-full text-base font-bold h-14 rounded-xl border-slate-200 hover:bg-slate-50 text-slate-600" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    <Button size="lg" className="w-full text-base font-bold h-14 rounded-xl shadow-md" onClick={handleAddToCart} disabled={!isFormValid()}>
                        Agregar • ${currentTotal.toLocaleString()}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
