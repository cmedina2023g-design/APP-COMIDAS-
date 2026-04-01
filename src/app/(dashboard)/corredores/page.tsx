'use client'

import { useState, useMemo } from 'react'
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
    ChevronRight,
    ChevronDown,
    ArrowLeft,
    CheckCircle,
    ShoppingBag,
    RotateCcw,
    TrendingUp,
    Users,
    X
} from 'lucide-react'
import Link from 'next/link'
import {
    useRunners,
    useRunnerInventory,
    useAssignInventory,
    useBulkReturnInventory,
    useRunnerSummary,
    useShifts
} from '@/hooks/use-sessions'
import { useProducts } from '@/hooks/use-products'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export default function CorredoresPage() {
    const { data: inventory, isLoading, refetch } = useRunnerInventory()
    const { data: summary } = useRunnerSummary()
    const [assignOpen, setAssignOpen] = useState(false)
    const [closingRunner, setClosingRunner] = useState<{ id: string; name: string } | null>(null)
    const [expandedRunners, setExpandedRunners] = useState<Record<string, boolean>>({})

    // Group inventory by runner
    const byRunner = useMemo(() => {
        const groups: Record<string, { runner: any; items: any[] }> = {}
        for (const item of inventory || []) {
            const rid = item.runner?.id || item.runner_id || 'unknown'
            if (!groups[rid]) {
                groups[rid] = { runner: item.runner, items: [] }
            }
            groups[rid].items.push(item)
        }
        return groups
    }, [inventory])

    const toggleRunner = (id: string) =>
        setExpandedRunners(prev => ({ ...prev, [id]: !prev[id] }))

    const getSummaryForRunner = (runnerId: string) =>
        (summary as any[])?.find((s: any) => s.runner_id === runnerId)

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/pos">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-slate-800">Corredores</h1>
                    <p className="text-muted-foreground text-sm">Inventario y cierre de turno de corredores de hoy.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => refetch()}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Actualizar
                    </Button>
                    <AssignInventoryDialog open={assignOpen} onOpenChange={setAssignOpen} />
                </div>
            </div>

            {/* Summary Cards */}
            {summary && (summary as any[]).length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {(summary as any[]).map((runner: any) => (
                        <Card key={runner.runner_id} className="border-t-4 border-t-blue-500">
                            <CardContent className="pt-4 pb-3">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <Users className="h-4 w-4 text-blue-500" />
                                        <span className="font-semibold text-slate-800">{runner.runner_name}</span>
                                    </div>
                                    {runner.active_assignments > 0
                                        ? <Badge className="bg-green-500 text-white text-xs">En ruta</Badge>
                                        : <Badge variant="secondary" className="text-xs">Cerrado</Badge>
                                    }
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-slate-50 rounded-lg p-2 text-center">
                                        <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide mb-0.5">Asignado</p>
                                        <p className="font-bold text-lg text-slate-800">{runner.total_assigned}</p>
                                    </div>
                                    <div className="bg-yellow-50 rounded-lg p-2 text-center">
                                        <p className="text-[10px] text-yellow-600 font-medium uppercase tracking-wide mb-0.5">Devuelto</p>
                                        <p className="font-bold text-lg text-yellow-700">{runner.total_returned}</p>
                                    </div>
                                </div>

                                <div className="mt-3 border-t pt-2 space-y-1">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500 flex items-center gap-1">
                                            <TrendingUp className="h-3 w-3" />
                                            Ventas POS
                                        </span>
                                        <span className="font-bold text-green-600">
                                            ${(runner.total_pos_sales || 0).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-400">Estimado inventario</span>
                                        <span className="text-slate-600">
                                            ${(runner.total_value_inv || 0).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Inventory Panel */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Package className="h-5 w-5 text-orange-600" />
                        Inventario de Hoy — por Corredor
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="h-6 w-6 animate-spin text-orange-600" />
                        </div>
                    ) : Object.keys(byRunner).length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground">
                            <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                            <p className="font-medium">No hay inventario asignado hoy</p>
                            <Button className="mt-4" onClick={() => setAssignOpen(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Asignar Inventario
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {Object.entries(byRunner).map(([runnerId, { runner, items }]) => {
                                const isExpanded = expandedRunners[runnerId] ?? true
                                const hasActive = items.some(i => i.status === 'active')
                                const runnerSummary = getSummaryForRunner(runnerId)

                                return (
                                    <div key={runnerId} className="border rounded-xl overflow-hidden">
                                        {/* Runner header row */}
                                        <div
                                            className="flex items-center justify-between px-4 py-3 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
                                            onClick={() => toggleRunner(runnerId)}
                                        >
                                            <div className="flex items-center gap-3">
                                                {isExpanded
                                                    ? <ChevronDown className="h-4 w-4 text-slate-400" />
                                                    : <ChevronRight className="h-4 w-4 text-slate-400" />
                                                }
                                                <span className="font-semibold text-slate-800">
                                                    {runner?.full_name || 'Corredor'}
                                                </span>
                                                <Badge variant="outline" className="text-xs">
                                                    {items.length} producto{items.length !== 1 ? 's' : ''}
                                                </Badge>
                                                {hasActive
                                                    ? <Badge className="bg-green-500 text-white text-xs">Activo</Badge>
                                                    : <Badge variant="secondary" className="text-xs">Cerrado</Badge>
                                                }
                                            </div>
                                            {hasActive && (
                                                <Button
                                                    size="sm"
                                                    className="bg-orange-500 hover:bg-orange-600 text-white shrink-0"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setClosingRunner({ id: runnerId, name: runner?.full_name || 'Corredor' })
                                                    }}
                                                >
                                                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                                                    Cerrar Turno
                                                </Button>
                                            )}
                                        </div>

                                        {/* Items table */}
                                        {isExpanded && (
                                            <div className="divide-y">
                                                {/* Column headers */}
                                                <div className="grid grid-cols-4 gap-2 px-4 py-2 bg-white text-xs font-medium text-slate-400 uppercase tracking-wide">
                                                    <span>Producto</span>
                                                    <span className="text-center">Asignado</span>
                                                    <span className="text-center">Devuelto</span>
                                                    <span className="text-center">Vendido</span>
                                                </div>
                                                {items.map(item => {
                                                    const sold = item.assigned_qty - item.returned_qty
                                                    return (
                                                        <div key={item.id} className={cn(
                                                            "grid grid-cols-4 gap-2 px-4 py-3 items-center text-sm",
                                                            item.status === 'closed' ? 'bg-slate-50/50 opacity-70' : 'bg-white hover:bg-slate-50'
                                                        )}>
                                                            <div>
                                                                <p className="font-medium text-slate-800">{item.product?.name}</p>
                                                                {item.status === 'closed' && (
                                                                    <span className="text-[10px] text-slate-400">Cerrado</span>
                                                                )}
                                                            </div>
                                                            <p className="text-center font-semibold text-slate-700">{item.assigned_qty}</p>
                                                            <p className="text-center font-semibold text-yellow-600">{item.returned_qty}</p>
                                                            <p className={cn(
                                                                "text-center font-bold",
                                                                sold > 0 ? "text-green-600" : sold < 0 ? "text-red-500" : "text-slate-400"
                                                            )}>
                                                                {sold}
                                                            </p>
                                                        </div>
                                                    )
                                                })}
                                                {/* Runner subtotals */}
                                                {runnerSummary && (
                                                    <div className="grid grid-cols-4 gap-2 px-4 py-2 bg-slate-100 text-xs font-bold text-slate-600 border-t-2">
                                                        <span>TOTAL</span>
                                                        <span className="text-center">{runnerSummary.total_assigned}</span>
                                                        <span className="text-center text-yellow-700">{runnerSummary.total_returned}</span>
                                                        <span className="text-center text-green-700">{runnerSummary.total_sold_inv}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Bulk Return Modal */}
            {closingRunner && (
                <BulkReturnModal
                    runnerId={closingRunner.id}
                    runnerName={closingRunner.name}
                    items={(byRunner[closingRunner.id]?.items || []).filter(i => i.status === 'active')}
                    onClose={() => setClosingRunner(null)}
                />
            )}
        </div>
    )
}

// ─────────────────────────────────────────────
// Bulk Return Modal (Cerrar Turno)
// ─────────────────────────────────────────────
type BulkItem = {
    id: string
    product: { name: string; price: number }
    assigned_qty: number
    returned_qty: number
}

type ReturnSummaryItem = {
    name: string
    assigned: number
    returned: number
    sold: number
    value: number
}

function BulkReturnModal({
    runnerId,
    runnerName,
    items,
    onClose
}: {
    runnerId: string
    runnerName: string
    items: BulkItem[]
    onClose: () => void
}) {
    const bulkReturn = useBulkReturnInventory()
    const [returnQtys, setReturnQtys] = useState<Record<string, number | ''>>(() => {
        // Pre-fill: returned = assigned - sold_qty (keep 0 as default)
        const init: Record<string, number | ''> = {}
        for (const item of items) {
            init[item.id] = ''
        }
        return init
    })
    const [summary, setSummary] = useState<ReturnSummaryItem[] | null>(null)

    const setAll = (val: number) => {
        const next: Record<string, number | ''> = {}
        for (const item of items) {
            // Can't return more than assigned, cap automatically
            next[item.id] = Math.min(val, item.assigned_qty)
        }
        setReturnQtys(next)
    }

    const handleConfirm = async () => {
        const returns = items.map(item => ({
            assignment_id: item.id,
            returned_qty: Number(returnQtys[item.id]) || 0
        }))

        const result = await bulkReturn.mutateAsync(returns)

        if (result?.success) {
            // Build summary from result items
            const summaryItems: ReturnSummaryItem[] = (result.items || []).map((ri: any) => {
                const item = items.find(i => i.id === ri.assignment_id)
                return {
                    name: item?.product?.name || '—',
                    assigned: ri.assigned_qty,
                    returned: ri.returned_qty,
                    sold: ri.sold_qty,
                    value: ri.sold_qty * (item?.product?.price || 0)
                }
            })
            setSummary(summaryItems)
        }
    }

    const totalReturned = items.reduce((s, item) => s + (Number(returnQtys[item.id]) || 0), 0)
    const totalSoldEst = items.reduce((s, item) => s + (item.assigned_qty - (Number(returnQtys[item.id]) || 0)), 0)

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-lg flex flex-col max-h-[90vh]" aria-describedby="bulk-return-desc">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <RotateCcw className="h-5 w-5 text-orange-500" />
                        Cerrar Turno — {runnerName}
                    </DialogTitle>
                    <DialogDescription id="bulk-return-desc">
                        Ingresa las unidades que regresó el corredor. Se procesarán todas de una vez.
                    </DialogDescription>
                </DialogHeader>

                {summary ? (
                    /* ── POST-RETURN SUMMARY SCREEN ── */
                    <div className="flex-1 overflow-y-auto space-y-4 py-2">
                        <div className="flex items-center gap-2 text-green-600 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                            <CheckCircle className="h-5 w-5 shrink-0" />
                            <p className="text-sm font-medium">Turno cerrado exitosamente</p>
                        </div>

                        <h4 className="font-semibold text-slate-700 text-sm">Resumen de Devolución</h4>

                        <div className="border rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50">
                                    <tr className="text-xs text-slate-500 uppercase">
                                        <th className="text-left px-3 py-2">Producto</th>
                                        <th className="text-center px-2 py-2">Asig.</th>
                                        <th className="text-center px-2 py-2">Dev.</th>
                                        <th className="text-center px-2 py-2">Vend.</th>
                                        <th className="text-right px-3 py-2">Valor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {summary.map((row, i) => (
                                        <tr key={i} className="hover:bg-slate-50">
                                            <td className="px-3 py-2 font-medium text-slate-800">{row.name}</td>
                                            <td className="px-2 py-2 text-center text-slate-500">{row.assigned}</td>
                                            <td className="px-2 py-2 text-center text-yellow-600 font-medium">{row.returned}</td>
                                            <td className="px-2 py-2 text-center text-green-600 font-bold">{row.sold}</td>
                                            <td className="px-3 py-2 text-right font-semibold">${row.value.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-slate-100 border-t-2 font-bold text-sm">
                                    <tr>
                                        <td className="px-3 py-2">TOTAL</td>
                                        <td className="px-2 py-2 text-center text-slate-600">{summary.reduce((s, r) => s + r.assigned, 0)}</td>
                                        <td className="px-2 py-2 text-center text-yellow-700">{summary.reduce((s, r) => s + r.returned, 0)}</td>
                                        <td className="px-2 py-2 text-center text-green-700">{summary.reduce((s, r) => s + r.sold, 0)}</td>
                                        <td className="px-3 py-2 text-right text-green-700">
                                            ${summary.reduce((s, r) => s + r.value, 0).toLocaleString()}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        <Button className="w-full" onClick={onClose}>
                            <X className="h-4 w-4 mr-2" />
                            Listo — Cerrar
                        </Button>
                    </div>
                ) : (
                    /* ── RETURN ENTRY SCREEN ── */
                    <>
                        <div className="flex-1 overflow-y-auto space-y-2 py-1">
                            {/* Quick fill buttons */}
                            <div className="flex gap-2 items-center mb-3">
                                <span className="text-xs text-slate-500 mr-1">Predefinir:</span>
                                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setAll(0)}>
                                    Todo vendido (0 ret.)
                                </Button>
                                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => {
                                    const next: Record<string, number | ''> = {}
                                    for (const item of items) next[item.id] = item.assigned_qty
                                    setReturnQtys(next)
                                }}>
                                    Todo devuelto
                                </Button>
                            </div>

                            {/* Per-product return inputs */}
                            {items.map(item => {
                                const qty = returnQtys[item.id]
                                const numQty = Number(qty) || 0
                                const isOver = numQty > item.assigned_qty
                                return (
                                    <div key={item.id} className={cn(
                                        "flex items-center gap-3 p-3 rounded-lg border",
                                        isOver ? "border-red-300 bg-red-50" : "border-slate-200 bg-white"
                                    )}>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-sm text-slate-800 truncate">{item.product?.name}</p>
                                            <p className="text-xs text-slate-400">Asignado: {item.assigned_qty} unid.</p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Label className="text-xs text-slate-500 whitespace-nowrap">A devolver:</Label>
                                            <Input
                                                type="number"
                                                min={0}
                                                max={item.assigned_qty}
                                                value={qty === '' ? '' : qty}
                                                onChange={e => setReturnQtys(prev => ({
                                                    ...prev,
                                                    [item.id]: e.target.value === '' ? '' : Number(e.target.value)
                                                }))}
                                                placeholder="0"
                                                className={cn("w-20 h-8 text-center", isOver && "border-red-400")}
                                            />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Summary bar */}
                        <div className="border-t pt-3 mt-2 space-y-1">
                            <div className="flex justify-between text-sm text-slate-600">
                                <span className="flex items-center gap-1"><ShoppingBag className="h-3.5 w-3.5" /> Estimado vendido:</span>
                                <span className="font-bold text-green-600">{totalSoldEst} unid.</span>
                            </div>
                            <div className="flex justify-between text-sm text-slate-600">
                                <span className="flex items-center gap-1"><Package className="h-3.5 w-3.5" /> Total a devolver:</span>
                                <span className="font-bold text-yellow-600">{totalReturned} unid.</span>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={onClose} disabled={bulkReturn.isPending}>
                                Cancelar
                            </Button>
                            <Button
                                className="bg-orange-500 hover:bg-orange-600"
                                onClick={handleConfirm}
                                disabled={bulkReturn.isPending || items.some(i => (Number(returnQtys[i.id]) || 0) > i.assigned_qty)}
                            >
                                {bulkReturn.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                                Confirmar Devolución
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}

// ─────────────────────────────────────────────
// Assign Inventory Dialog (unchanged logic, new style)
// ─────────────────────────────────────────────
function AssignInventoryDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const { data: runners } = useRunners()
    const { data: products } = useProducts()
    const { data: shifts } = useShifts()
    const assignInventory = useAssignInventory()

    const [selectedRunner, setSelectedRunner] = useState('')
    const [selectedShift, setSelectedShift] = useState('')
    const [quantities, setQuantities] = useState<Record<string, number>>({})
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})
    const [search, setSearch] = useState('')

    const productsByCategory = useMemo(() => {
        const filtered = products?.filter(p =>
            p.active && p.name.toLowerCase().includes(search.toLowerCase())
        ) || []
        return filtered.reduce((acc: Record<string, typeof filtered>, product) => {
            const cat = product.category || 'Sin Categoría'
            if (!acc[cat]) acc[cat] = []
            acc[cat].push(product)
            return acc
        }, {})
    }, [products, search])

    const totalItems = Object.values(quantities).reduce((sum, qty) => sum + (qty || 0), 0)

    const handleSubmit = () => {
        const items = Object.entries(quantities)
            .filter(([_, qty]) => qty > 0)
            .map(([product_id, qty]) => ({ product_id, qty }))
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
                setSearch('')
            }
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Asignar Inventario
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col" aria-describedby="assign-inv-desc">
                <DialogHeader>
                    <DialogTitle>Asignar Inventario a Corredor</DialogTitle>
                    <DialogDescription id="assign-inv-desc">
                        Solo se asignarán los productos con cantidad mayor a 0.
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
                                {runners?.map(runner => (
                                    <SelectItem key={runner.id} value={runner.id}>{runner.full_name}</SelectItem>
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
                                {shifts?.map(shift => (
                                    <SelectItem key={shift.id} value={shift.id}>
                                        {shift.name} ({shift.start_time?.slice(0, 5)} - {shift.end_time?.slice(0, 5)})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Search */}
                <Input
                    placeholder="Buscar producto..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="mb-3"
                />

                <div className="flex items-center justify-between mb-2">
                    {totalItems > 0 && (
                        <Badge className="bg-blue-500">{totalItems} unidades seleccionadas</Badge>
                    )}
                    {totalItems > 0 && (
                        <Button variant="ghost" size="sm" onClick={() => setQuantities({})}>
                            Limpiar todo
                        </Button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1" style={{ maxHeight: '380px' }}>
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
                                    {categoryQty > 0 && <Badge className="bg-blue-500">{categoryQty}</Badge>}
                                </button>
                                {isExpanded && (
                                    <div className="divide-y">
                                        {categoryProducts.map(product => (
                                            <div
                                                key={product.id}
                                                className={`flex items-center justify-between px-3 py-2 ${quantities[product.id] > 0 ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                                            >
                                                <span className="text-sm flex-1 mr-4">{product.name}</span>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    value={quantities[product.id] || ''}
                                                    onChange={(e) => setQuantities(prev => ({
                                                        ...prev,
                                                        [product.id]: parseInt(e.target.value) || 0
                                                    }))}
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
                            {Object.values(quantities).filter(q => q > 0).length} productos · {totalItems} unidades
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
