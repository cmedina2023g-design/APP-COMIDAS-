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
    RotateCcw,
    TrendingUp,
    Users,
    Pencil
} from 'lucide-react'
import Link from 'next/link'
import {
    useRunners,
    useRunnerInventory,
    useAssignInventory,
    useBulkReturnInventory,
    useRunnerSummary,
    useShifts,
    useAdminEditClosedReturns
} from '@/hooks/use-sessions'
import { useProducts } from '@/hooks/use-products'
import { useCurrentProfile } from '@/hooks/use-profiles'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export default function CorredoresPage() {
    const { data: inventory, isLoading, refetch } = useRunnerInventory()
    const { data: summary } = useRunnerSummary()
    const { data: currentProfile } = useCurrentProfile()
    const [assignOpen, setAssignOpen] = useState(false)
    const [closingRunner, setClosingRunner] = useState<{ id: string; name: string } | null>(null)
    const [editingRunner, setEditingRunner] = useState<{ id: string; name: string } | null>(null)
    const [expandedRunners, setExpandedRunners] = useState<Record<string, boolean>>({})

    // Group inventory by runner, then aggregate duplicate products
    const byRunner = useMemo(() => {
        const groups: Record<string, { runner: any; items: any[]; rawItems: any[] }> = {}
        for (const item of inventory || []) {
            const rid = item.runner?.id || item.runner_id || 'unknown'
            if (!groups[rid]) {
                groups[rid] = { runner: item.runner, items: [], rawItems: [] }
            }
            groups[rid].rawItems.push(item)
        }
        // Aggregate products per runner
        for (const rid of Object.keys(groups)) {
            const productMap: Record<string, any> = {}
            for (const item of groups[rid].rawItems) {
                const pid = item.product?.id || item.product_id
                if (!productMap[pid]) {
                    productMap[pid] = {
                        ...item,
                        assigned_qty: 0,
                        returned_qty: 0,
                        sold_qty: 0,
                        _ids: [],          // all assignment IDs for bulk return
                        status: 'closed'   // 'active' if any sub-item is active
                    }
                }
                productMap[pid].assigned_qty += item.assigned_qty || 0
                productMap[pid].returned_qty += item.returned_qty || 0
                productMap[pid].sold_qty += item.sold_qty || 0
                productMap[pid]._ids.push({ id: item.id, assigned_qty: item.assigned_qty })
                if (item.status === 'active') productMap[pid].status = 'active'
            }
            groups[rid].items = Object.values(productMap).sort((a, b) => b.assigned_qty - a.assigned_qty)
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
                        <Card
                            key={runner.runner_id}
                            className="border-t-4 border-t-blue-500 cursor-pointer hover:shadow-md transition-shadow"
                            onClick={() => {
                                setExpandedRunners(prev => ({ ...prev, [runner.runner_id]: true }))
                                setTimeout(() => {
                                    document.getElementById(`runner-${runner.runner_id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                }, 50)
                            }}
                        >
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
                                const isExpanded = expandedRunners[runnerId] ?? false
                                const hasActive = items.some(i => i.status === 'active')
                                const runnerSummary = getSummaryForRunner(runnerId)

                                return (
                                    <div key={runnerId} id={`runner-${runnerId}`} className="border rounded-xl overflow-hidden">
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
                                            {!hasActive && currentProfile?.role === 'ADMIN' && items.length > 0 && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="shrink-0 text-slate-500 hover:text-orange-600 hover:border-orange-200"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setEditingRunner({ id: runnerId, name: runner?.full_name || 'Corredor' })
                                                    }}
                                                >
                                                    <Pencil className="h-3.5 w-3.5 mr-1.5" />
                                                    Editar Devolución
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

            {/* Admin Edit Return Modal */}
            {editingRunner && (
                <AdminEditReturnModal
                    runnerId={editingRunner.id}
                    runnerName={editingRunner.name}
                    items={byRunner[editingRunner.id]?.items || []}
                    onClose={() => setEditingRunner(null)}
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
    _ids?: { id: string; assigned_qty: number }[]  // aggregated sub-assignments
}

type ReturnSummaryItem = {
    name: string
    assigned: number
    returned: number
    sold: number
    value: number
}

function BulkReturnModal({
    runnerId: _runnerId,
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
    const [screen, setScreen] = useState<'choose' | 'input' | 'summary'>('choose')
    const [returnQtys, setReturnQtys] = useState<Record<string, number | ''>>(() =>
        Object.fromEntries(items.map(i => [i.id, '']))
    )
    const [summary, setSummary] = useState<ReturnSummaryItem[] | null>(null)

    const totalAssigned = items.reduce((s, i) => s + i.assigned_qty, 0)
    const totalToReturn = items.reduce((s, i) => s + (Number(returnQtys[i.id]) || 0), 0)
    const hasOverLimit = items.some(i => (Number(returnQtys[i.id]) || 0) > i.assigned_qty)

    // Build the RPC payload distributing qty across sub-assignments
    const buildPayload = (qtys: Record<string, number>) => {
        const returns: { assignment_id: string; returned_qty: number }[] = []
        for (const item of items) {
            const totalToReturn = qtys[item.id] ?? 0
            const subIds = item._ids || [{ id: item.id, assigned_qty: item.assigned_qty }]
            let remaining = totalToReturn
            for (const sub of subIds) {
                const give = Math.min(remaining, sub.assigned_qty)
                returns.push({ assignment_id: sub.id, returned_qty: give })
                remaining -= give
                if (remaining <= 0) break
            }
            for (const sub of subIds) {
                if (!returns.find(r => r.assignment_id === sub.id)) {
                    returns.push({ assignment_id: sub.id, returned_qty: 0 })
                }
            }
        }
        return returns
    }

    const executeReturn = async (qtys: Record<string, number>) => {
        const result = await bulkReturn.mutateAsync(buildPayload(qtys))
        if (result?.success) {
            const map: Record<string, ReturnSummaryItem> = {}
            for (const ri of result.items || []) {
                const item = items.find(i =>
                    (i._ids || [{ id: i.id }]).some((s: any) => s.id === ri.assignment_id)
                )
                const name = item?.product?.name || '—'
                const price = item?.product?.price || 0
                if (!map[name]) map[name] = { name, assigned: 0, returned: 0, sold: 0, value: 0 }
                map[name].assigned += ri.assigned_qty
                map[name].returned += ri.returned_qty
                map[name].sold += ri.sold_qty
                map[name].value += ri.sold_qty * price
            }
            setSummary(Object.values(map))
            setScreen('summary')
        }
    }

    const handleAllSold = () =>
        executeReturn(Object.fromEntries(items.map(i => [i.id, 0])))

    const handleWithReturns = () =>
        executeReturn(Object.fromEntries(items.map(i => [i.id, Number(returnQtys[i.id]) || 0])))

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-sm w-full max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden rounded-2xl">
                <DialogTitle className="sr-only">Cerrar Turno</DialogTitle>
                
                {/* Header */}
                <div className="px-5 pt-5 pb-4 border-b">
                    <div className="flex items-center gap-2">
                        <RotateCcw className="h-4 w-4 text-orange-500 shrink-0" />
                        <span className="font-bold text-slate-800">Cerrar Turno</span>
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5 pl-6">{runnerName}</p>
                </div>

                {/* ── PANTALLA 1: elegir acción ── */}
                {screen === 'choose' && (
                    <>
                    <div className="flex-1 overflow-y-auto px-5 py-5">
                        {/* resumen rápido */}
                        <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
                            {items.map(item => (
                                <div key={item.id} className="flex justify-between text-sm">
                                    <span className="text-slate-600 truncate pr-2">{item.product?.name}</span>
                                    <span className="font-semibold text-slate-800 shrink-0">{item.assigned_qty} unid.</span>
                                </div>
                            ))}
                            <div className="border-t pt-1.5 mt-1 flex justify-between text-sm font-bold text-slate-700">
                                <span>Total asignado</span>
                                <span>{totalAssigned} unid.</span>
                            </div>
                        </div>

                    </div>

                    <div className="px-5 pb-5 pt-3 border-t space-y-2">
                        {/* acción principal */}
                        <Button
                            className="w-full h-14 text-base font-bold bg-green-600 hover:bg-green-700 text-white rounded-xl gap-2"
                            onClick={handleAllSold}
                            disabled={bulkReturn.isPending}
                        >
                            {bulkReturn.isPending
                                ? <Loader2 className="h-5 w-5 animate-spin" />
                                : <><CheckCircle className="h-5 w-5" /> Todo vendido</>
                            }
                        </Button>
                        <p className="text-center text-xs text-slate-400 -mt-1">No hubo ninguna devolución</p>

                        {/* acción secundaria */}
                        <Button
                            variant="outline"
                            className="w-full h-12 rounded-xl text-slate-600 gap-1"
                            onClick={() => setScreen('input')}
                            disabled={bulkReturn.isPending}
                        >
                            Hubo devolución
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                    </>
                )}

                {/* ── PANTALLA 2: ingresar cantidades ── */}
                {screen === 'input' && (
                    <>
                        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
                            <p className="text-xs text-slate-500 mb-1">¿Cuánto devolvió de cada producto?</p>
                            {items.map(item => {
                                const qty = returnQtys[item.id]
                                const isOver = (Number(qty) || 0) > item.assigned_qty
                                return (
                                    <div key={item.id} className={cn(
                                        "flex items-center gap-3 px-4 py-3 rounded-xl border",
                                        isOver ? "border-red-300 bg-red-50" : "bg-white border-slate-200"
                                    )}>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-sm text-slate-800 truncate">{item.product?.name}</p>
                                            <p className="text-xs text-slate-400">{item.assigned_qty} asignados</p>
                                        </div>
                                        <Input
                                            type="number"
                                            inputMode="numeric"
                                            min={0}
                                            max={item.assigned_qty}
                                            value={qty === '' ? '' : qty}
                                            onChange={e => setReturnQtys(prev => ({
                                                ...prev,
                                                [item.id]: e.target.value === '' ? '' : Number(e.target.value)
                                            }))}
                                            placeholder="0"
                                            className={cn("w-20 h-11 text-center text-base shrink-0", isOver && "border-red-400")}
                                        />
                                    </div>
                                )
                            })}
                        </div>

                        <div className="px-5 pb-5 pt-3 border-t space-y-2">
                            <div className="flex justify-between text-sm text-slate-600 mb-1">
                                <span>Total a devolver</span>
                                <span className="font-bold text-orange-600">{totalToReturn} unid.</span>
                            </div>
                            <Button
                                className="w-full h-12 rounded-xl bg-orange-500 hover:bg-orange-600 font-bold"
                                onClick={handleWithReturns}
                                disabled={bulkReturn.isPending || hasOverLimit}
                            >
                                {bulkReturn.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                                Confirmar devolución
                            </Button>
                            <Button
                                variant="ghost"
                                className="w-full h-10 text-slate-400"
                                onClick={() => setScreen('choose')}
                                disabled={bulkReturn.isPending}
                            >
                                ← Volver
                            </Button>
                        </div>
                    </>
                )}

                {/* ── PANTALLA 3: resumen ── */}
                {screen === 'summary' && summary && (
                    <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
                        <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                            <CheckCircle className="h-5 w-5 shrink-0" />
                            <p className="text-sm font-semibold">Turno cerrado exitosamente</p>
                        </div>

                        <div className="rounded-xl border overflow-hidden">
                            <div className="grid grid-cols-4 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                <span className="col-span-1">Producto</span>
                                <span className="text-center">Asig.</span>
                                <span className="text-center">Dev.</span>
                                <span className="text-center">Vend.</span>
                            </div>
                            {summary.map((row, i) => (
                                <div key={i} className="grid grid-cols-4 px-3 py-2.5 border-t text-sm items-center">
                                    <span className="font-medium text-slate-800 truncate pr-1">{row.name}</span>
                                    <span className="text-center text-slate-500">{row.assigned}</span>
                                    <span className="text-center text-yellow-600 font-medium">{row.returned}</span>
                                    <span className="text-center text-green-600 font-bold">{row.sold}</span>
                                </div>
                            ))}
                            <div className="grid grid-cols-4 px-3 py-2.5 border-t bg-slate-50 text-sm font-bold">
                                <span className="text-slate-700">Total</span>
                                <span className="text-center text-slate-600">{summary.reduce((s, r) => s + r.assigned, 0)}</span>
                                <span className="text-center text-yellow-700">{summary.reduce((s, r) => s + r.returned, 0)}</span>
                                <span className="text-center text-green-700">{summary.reduce((s, r) => s + r.sold, 0)}</span>
                            </div>
                        </div>

                        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex justify-between items-center">
                            <span className="text-sm font-medium text-green-700">Valor vendido estimado</span>
                            <span className="text-lg font-bold text-green-700">
                                ${summary.reduce((s, r) => s + r.value, 0).toLocaleString()}
                            </span>
                        </div>

                        <Button className="w-full h-12 rounded-xl font-bold" onClick={onClose}>
                            Listo
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}

// ─────────────────────────────────────────────
// Admin Edit Return Modal (Corregir Turno Cerrado)
// ─────────────────────────────────────────────
function AdminEditReturnModal({
    runnerId: _runnerId,
    runnerName,
    items,
    onClose
}: {
    runnerId: string
    runnerName: string
    items: BulkItem[]
    onClose: () => void
}) {
    const adminEdit = useAdminEditClosedReturns()
    const [returnQtys, setReturnQtys] = useState<Record<string, number | ''>>(() =>
        Object.fromEntries(items.map(i => [i.id, i.returned_qty]))
    )

    const hasChanges = items.some(i => (Number(returnQtys[i.id]) || 0) !== i.returned_qty)
    const hasOverLimit = items.some(i => (Number(returnQtys[i.id]) || 0) > i.assigned_qty)

    // Build the RPC payload distributing new qty across sub-assignments
    const buildPayload = (qtys: Record<string, number>) => {
        const updates: { assignment_id: string; new_returned_qty: number }[] = []
        for (const item of items) {
            const totalTargetReturn = qtys[item.id] ?? 0
            const subIds = item._ids || [{ id: item.id, assigned_qty: item.assigned_qty }]
            let remaining = totalTargetReturn
            for (const sub of subIds) {
                const give = Math.min(remaining, sub.assigned_qty)
                updates.push({ assignment_id: sub.id, new_returned_qty: give })
                remaining -= give
                if (remaining <= 0) break
            }
            // para el resto que se quedan en 0
            for (const sub of subIds) {
                if (!updates.find(u => u.assignment_id === sub.id)) {
                    updates.push({ assignment_id: sub.id, new_returned_qty: 0 })
                }
            }
        }
        return updates
    }

    const handleSave = async () => {
        const qtys = Object.fromEntries(items.map(i => [i.id, Number(returnQtys[i.id]) || 0]))
        const payload = buildPayload(qtys)
        const result = await adminEdit.mutateAsync(payload)
        if (result?.success) {
            onClose()
        }
    }

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-sm w-full max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden rounded-2xl">
                <DialogTitle className="sr-only">Corregir Devolución (Admin)</DialogTitle>
                
                {/* Header */}
                <div className="px-5 pt-5 pb-4 border-b bg-slate-900">
                    <div className="flex items-center gap-2">
                        <Pencil className="h-4 w-4 text-orange-400 shrink-0" />
                        <span className="font-bold text-white">Corregir Devolución (Admin)</span>
                    </div>
                    <p className="text-sm text-slate-400 mt-0.5 pl-6">{runnerName}</p>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
                    <p className="text-xs text-slate-500 mb-2 bg-blue-50 text-blue-700 p-2 rounded-md">
                        Esta acción recalculará automáticamente el inventario del restaurante y el total vendido del corredor.
                    </p>
                    
                    {items.map(item => {
                        const qty = returnQtys[item.id]
                        const isOver = (Number(qty) || 0) > item.assigned_qty
                        const originalQty = item.returned_qty
                        const currentVal = Number(qty) || 0
                        const changed = currentVal !== originalQty

                        return (
                            <div key={item.id} className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl border",
                                isOver ? "border-red-300 bg-red-50" : changed ? "border-orange-300 bg-orange-50" : "bg-white border-slate-200"
                            )}>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm text-slate-800 truncate">{item.product?.name}</p>
                                    <p className="text-xs text-slate-400">
                                        Asignado: {item.assigned_qty} | Orig: {item.returned_qty}
                                    </p>
                                </div>
                                <div className="shrink-0 flex items-center gap-2">
                                    <Input
                                        type="number"
                                        inputMode="numeric"
                                        min={0}
                                        max={item.assigned_qty}
                                        value={qty === '' ? '' : qty}
                                        onChange={e => setReturnQtys(prev => ({
                                            ...prev,
                                            [item.id]: e.target.value === '' ? '' : Number(e.target.value)
                                        }))}
                                        className={cn("w-20 h-11 text-center text-base font-bold", isOver && "border-red-400", changed && "text-orange-600")}
                                    />
                                </div>
                            </div>
                        )
                    })}
                </div>

                <div className="px-5 pb-5 pt-3 border-t bg-slate-50 space-y-2">
                    <div className="flex justify-between text-sm text-slate-600 mb-2">
                        <span>Total de cambios</span>
                        <span className={cn("font-bold", hasChanges ? "text-orange-600" : "text-slate-400")}>
                            {items.filter(i => (Number(returnQtys[i.id]) || 0) !== i.returned_qty).length} productos editados
                        </span>
                    </div>
                    <Button
                        className="w-full h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold"
                        onClick={handleSave}
                        disabled={!hasChanges || hasOverLimit || adminEdit.isPending}
                    >
                        {adminEdit.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Confirmar y Ajustar Inventario
                    </Button>
                </div>
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
