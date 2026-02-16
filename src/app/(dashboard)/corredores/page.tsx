'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
    Package,
    Plus,
    RefreshCw,
    Loader2,
    RotateCcw,
    ChevronRight,
    ChevronDown,
    Clock,
    ArrowLeft
} from 'lucide-react'
import Link from 'next/link'
import {
    useRunners,
    useRunnerInventory,
    useAssignInventory,
    useReturnInventory,
    useRunnerSummary,
    useShifts
} from '@/hooks/use-sessions'
import { useProducts } from '@/hooks/use-products'
import { cn } from '@/lib/utils'

export default function CorredoresPage() {
    const { data: inventory, isLoading, refetch } = useRunnerInventory()
    const { data: summary } = useRunnerSummary()
    const [assignOpen, setAssignOpen] = useState(false)

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/pos">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Despacho de Corredores</h1>
                    <p className="text-muted-foreground">Asigna y controla el inventario de los corredores.</p>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {summary?.map((runner: any) => (
                    <Card key={runner.runner_id} className="border-l-4 border-l-blue-500">
                        <CardContent className="pt-4">
                            <div className="flex items-center justify-between mb-2">
                                <p className="font-medium">{runner.runner_name}</p>
                                {runner.active_assignments > 0 && (
                                    <Badge className="bg-green-500">En ruta</Badge>
                                )}
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center text-sm">
                                <div>
                                    <p className="text-muted-foreground">Asignado</p>
                                    <p className="font-bold text-lg">{runner.total_assigned}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Vendido</p>
                                    <p className="font-bold text-lg text-green-600">{runner.total_sold}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Valor</p>
                                    <p className="font-bold text-lg">${runner.total_value.toLocaleString()}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Main Panel */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-orange-600" />
                        Inventario de Corredores - Hoy
                    </CardTitle>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => refetch()}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Actualizar
                        </Button>
                        <AssignInventoryDialog open={assignOpen} onOpenChange={setAssignOpen} />
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-orange-600" />
                        </div>
                    ) : !inventory || inventory.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                            <p>No hay inventario asignado hoy</p>
                            <Button
                                className="mt-4"
                                onClick={() => setAssignOpen(true)}
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Asignar Inventario
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {inventory.map((item) => (
                                <InventoryItem key={item.id} item={item} />
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

function InventoryItem({ item }: { item: any }) {
    const [returnOpen, setReturnOpen] = useState(false)
    const [returnQty, setReturnQty] = useState('')
    const returnInventory = useReturnInventory()

    const assignedQty = item.assigned_qty || 0
    const currentReturn = parseInt(returnQty) || 0
    const isOverLimit = currentReturn > assignedQty
    const isInvalid = isOverLimit || currentReturn < 0

    const handleReturn = () => {
        if (isInvalid) return

        returnInventory.mutate({
            assignment_id: item.id,
            returned_qty: currentReturn
        }, {
            onSuccess: () => {
                setReturnOpen(false)
                setReturnQty('')
            }
        })
    }

    const formatTime = (dateStr: string | null) => {
        if (!dateStr) return null
        return new Date(dateStr).toLocaleTimeString('es-CO', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        })
    }

    const assignedTime = formatTime(item.assigned_at)
    const returnedTime = formatTime(item.returned_at)

    return (
        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border">
            <div className="flex items-center gap-4">
                <div>
                    <p className="font-medium">{item.product?.name}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{item.runner?.full_name}</span>
                        <span className="text-slate-300">•</span>
                        <Clock className="h-3 w-3" />
                        <span>Asignado: {assignedTime}</span>
                        {returnedTime && (
                            <>
                                <span className="text-slate-300">•</span>
                                <span className="text-yellow-600">Devuelto: {returnedTime}</span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-6">
                <div className="text-center">
                    <p className="text-xs text-muted-foreground">Asignado</p>
                    <p className="font-bold">{item.assigned_qty}</p>
                </div>
                <div className="text-center">
                    <p className="text-xs text-muted-foreground">Devuelto</p>
                    <p className="font-bold text-yellow-600">{item.returned_qty}</p>
                </div>
                <div className="text-center">
                    <p className="text-xs text-muted-foreground">Vendido</p>
                    <p className={cn("font-bold", item.sold_qty < 0 ? "text-red-500" : "text-green-600")}>{item.sold_qty}</p>
                </div>

                {item.status === 'active' ? (
                    <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Devolución
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Registrar Devolución</DialogTitle>
                                <DialogDescription>
                                    {item.product?.name} - {item.runner?.full_name}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                                <div>
                                    <Label>Cantidad devuelta (Máx: {assignedQty})</Label>
                                    <Input
                                        type="number"
                                        value={returnQty}
                                        onChange={(e) => setReturnQty(e.target.value)}
                                        max={assignedQty}
                                        min={0}
                                        placeholder="Cantidad que devuelve"
                                        className={cn(isOverLimit && "border-red-500 focus-visible:ring-red-500")}
                                    />
                                    {isOverLimit && (
                                        <p className="text-red-500 text-xs mt-1 font-medium">
                                            ⚠️ No puede devolver más de lo asignado ({assignedQty}).
                                        </p>
                                    )}
                                </div>
                            </div>
                            <DialogFooter>
                                <Button
                                    onClick={handleReturn}
                                    disabled={returnInventory.isPending || isInvalid || !returnQty}
                                >
                                    {returnInventory.isPending && (
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    )}
                                    Confirmar Devolución
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                ) : (
                    <Badge variant="secondary">Cerrado</Badge>
                )}
            </div>
        </div>
    )
}

function AssignInventoryDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
    const { data: runners } = useRunners()
    const { data: products } = useProducts()
    const { data: shifts } = useShifts()
    const assignInventory = useAssignInventory()

    const [selectedRunner, setSelectedRunner] = useState('')
    const [selectedShift, setSelectedShift] = useState('')
    const [quantities, setQuantities] = useState<Record<string, number>>({})
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})

    // Group products by category
    const productsByCategory = products?.reduce((acc: Record<string, typeof products>, product) => {
        const cat = product.category || 'Sin Categoría'
        if (!acc[cat]) acc[cat] = []
        acc[cat].push(product)
        return acc
    }, {}) || {}

    const updateQuantity = (productId: string, qty: number) => {
        setQuantities(prev => ({
            ...prev,
            [productId]: qty
        }))
    }

    const getItemsToAssign = () => {
        return Object.entries(quantities)
            .filter(([_, qty]) => qty > 0)
            .map(([product_id, qty]) => ({ product_id, qty }))
    }

    const totalItems = Object.values(quantities).reduce((sum, qty) => sum + (qty || 0), 0)

    const handleSubmit = () => {
        const items = getItemsToAssign()
        if (!selectedRunner || items.length === 0) return

        assignInventory.mutate({
            runner_id: selectedRunner,
            shift_id: selectedShift || undefined,
            items
        }, {
            onSuccess: () => {
                onOpenChange(false)
                setSelectedRunner('')
                setQuantities({})
            }
        })
    }

    const clearAll = () => setQuantities({})

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Asignar Inventario
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>Asignar Inventario a Corredor</DialogTitle>
                    <DialogDescription>
                        Ingresa las cantidades de cada producto. Solo se asignarán los productos con cantidad mayor a 0.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <Label>Corredor *</Label>
                        <Select value={selectedRunner} onValueChange={setSelectedRunner}>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccionar corredor" />
                            </SelectTrigger>
                            <SelectContent>
                                {runners?.map((runner) => (
                                    <SelectItem key={runner.id} value={runner.id}>
                                        {runner.full_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label>Turno (opcional)</Label>
                        <Select value={selectedShift} onValueChange={setSelectedShift}>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccionar turno" />
                            </SelectTrigger>
                            <SelectContent>
                                {shifts?.map((shift) => (
                                    <SelectItem key={shift.id} value={shift.id}>
                                        {shift.name} ({shift.start_time?.slice(0, 5)} - {shift.end_time?.slice(0, 5)})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-4">
                        <span className="text-sm font-medium">Productos</span>
                        {totalItems > 0 && (
                            <Badge className="bg-blue-500">{totalItems} unidades seleccionadas</Badge>
                        )}
                    </div>
                    {totalItems > 0 && (
                        <Button variant="ghost" size="sm" onClick={clearAll}>
                            Limpiar todo
                        </Button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-2" style={{ maxHeight: '400px' }}>
                    {Object.entries(productsByCategory).map(([category, categoryProducts]) => {
                        const isExpanded = expandedCategories[category] ?? false
                        const categoryQty = categoryProducts.reduce((sum, p) => sum + (quantities[p.id] || 0), 0)

                        return (
                            <div key={category} className="border rounded-lg overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setExpandedCategories(prev => ({ ...prev, [category]: !isExpanded }))}
                                    className="w-full bg-slate-100 px-3 py-2 font-medium text-sm flex items-center justify-between hover:bg-slate-200 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                        <span>{category}</span>
                                        <span className="text-slate-500 font-normal">({categoryProducts.length})</span>
                                    </div>
                                    {categoryQty > 0 && (
                                        <Badge className="bg-blue-500">{categoryQty}</Badge>
                                    )}
                                </button>
                                {isExpanded && (
                                    <div className="divide-y">
                                        {categoryProducts.map((product) => (
                                            <div
                                                key={product.id}
                                                className={`flex items-center justify-between px-3 py-2 ${quantities[product.id] > 0
                                                    ? 'bg-blue-50'
                                                    : 'hover:bg-slate-50'
                                                    }`}
                                            >
                                                <span className="text-sm">
                                                    {product.name}
                                                </span>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    value={quantities[product.id] || ''}
                                                    onChange={(e) => updateQuantity(product.id, parseInt(e.target.value) || 0)}
                                                    placeholder="0"
                                                    className="w-20 h-8 text-center"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>

                <DialogFooter className="mt-4 pt-4 border-t">
                    <div className="flex items-center justify-between w-full">
                        <span className="text-sm text-muted-foreground">
                            {getItemsToAssign().length} productos · {totalItems} unidades
                        </span>
                        <Button
                            onClick={handleSubmit}
                            disabled={!selectedRunner || totalItems === 0 || assignInventory.isPending}
                        >
                            {assignInventory.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Asignar Inventario
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
