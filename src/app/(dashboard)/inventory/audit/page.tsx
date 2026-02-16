'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useIngredients } from '@/hooks/use-inventory'
import { useCreateAudit } from '@/hooks/use-audit'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Search, Save, ArrowLeft, AlertTriangle } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

export default function InventoryAuditPage() {
    const router = useRouter()
    const { data: ingredients, isLoading } = useIngredients()
    const createAudit = useCreateAudit()

    const [search, setSearch] = useState('')
    const [realStocks, setRealStocks] = useState<Record<string, number>>({})
    const [notes, setNotes] = useState('')

    // Initialize real stocks with current stocks on first load or when needed?
    // Better to let them empty or pre-fill?
    // Let's pre-fill with 0 or empty? 
    // Usually audit implies counting everything. If I leave it empty, it might be ambiguous.
    // Let's assume initialized to current stock for easier "adjustment" or 0? 
    // Best practice: Empty -> user MUST count.

    const handleStockChange = (id: string, value: string) => {
        const val = parseFloat(value)
        setRealStocks(prev => ({
            ...prev,
            [id]: isNaN(val) ? 0 : val
        }))
    }

    const filteredIngredients = useMemo(() => {
        return ingredients?.filter(ing =>
            ing.name.toLowerCase().includes(search.toLowerCase()) ||
            ing.category?.toLowerCase().includes(search.toLowerCase())
        ) || []
    }, [ingredients, search])

    const stats = useMemo(() => {
        let totalDiff = 0
        let itemsCounted = 0

        filteredIngredients.forEach(ing => {
            if (realStocks[ing.id] !== undefined) {
                const diff = realStocks[ing.id] - ing.stock
                const cost = ing.cost_unit || 0
                totalDiff += diff * cost
                itemsCounted++
            }
        })
        return { totalDiff, itemsCounted }
    }, [filteredIngredients, realStocks])

    const handleSubmit = async () => {
        if (itemsCounted === 0) {
            toast.error('No has contado ningún item')
            return
        }

        const items = Object.entries(realStocks).map(([id, val]) => ({
            ingredient_id: id,
            real_stock: val
        }))

        try {
            await createAudit.mutateAsync({
                notes,
                items
            })
            router.push('/inventory')
        } catch (error) {
            // Error handled in hook
        }
    }

    const { totalDiff, itemsCounted } = stats

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Auditoría de Inventario</h2>
                        <p className="text-muted-foreground">Ingresa el conteo físico real. El sistema ajustará el stock automáticamente.</p>
                    </div>
                </div>
                <div className="flex gap-2 items-center">
                    <Card className="bg-slate-50 border-slate-200 p-2 px-4">
                        <div className="text-xs text-muted-foreground uppercase font-bold">Diferencia Total</div>
                        <div className={`text-lg font-bold ${totalDiff < 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {totalDiff.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}
                        </div>
                    </Card>
                    <Button size="lg" onClick={handleSubmit} disabled={createAudit.isPending}>
                        {createAudit.isPending ? 'Guardando...' : 'Finalizar Auditoría'}
                        <Save className="ml-2 h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-3 space-y-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <div className="flex items-center gap-2">
                                <Search className="h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar insumo..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="max-w-sm"
                                />
                            </div>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? (
                                <div className="text-center py-10">Cargando...</div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Insumo</TableHead>
                                            <TableHead>Categoría</TableHead>
                                            <TableHead className="text-center">Stock Sistema</TableHead>
                                            <TableHead className="text-center w-[150px]">Stock Real (Físico)</TableHead>
                                            <TableHead className="text-right">Diferencia</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredIngredients.map(ing => {
                                            const real = realStocks[ing.id]
                                            const hasEntry = real !== undefined
                                            const diff = hasEntry ? real - ing.stock : 0

                                            return (
                                                <TableRow key={ing.id} className={hasEntry && diff !== 0 ? 'bg-muted/30' : ''}>
                                                    <TableCell className="font-medium">
                                                        {ing.name}
                                                        <div className="text-xs text-muted-foreground">Costo: ${ing.cost_unit?.toLocaleString() || 0}</div>
                                                    </TableCell>
                                                    <TableCell>{ing.category}</TableCell>
                                                    <TableCell className="text-center">
                                                        <Badge variant="secondary">{ing.stock} {ing.unit}</Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input
                                                            type="number"
                                                            placeholder="0"
                                                            className={`text-center font-bold ${hasEntry && diff < 0 ? 'border-red-300 bg-red-50 text-red-900' : ''}`}
                                                            onChange={(e) => handleStockChange(ing.id, e.target.value)}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {hasEntry && diff !== 0 && (
                                                            <div className={`flex items-center justify-end gap-1 font-bold ${diff < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                                {diff > 0 ? '+' : ''}{diff} {ing.unit}
                                                                {diff < 0 && <AlertTriangle className="h-3 w-3" />}
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Resumen</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="text-sm font-medium mb-1 block">Notas de Auditoría</label>
                                <Textarea
                                    placeholder="Ej: Se encontró merma en quesos..."
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    rows={4}
                                />
                            </div>
                            <div className="text-sm text-muted-foreground">
                                <p>Items contados: <strong>{itemsCounted}</strong> / {filteredIngredients.length}</p>
                                <p className="mt-2 text-xs">
                                    Al finalizar, se actualizará el stock de todos los items contados. Los no contados permanecerán igual.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
