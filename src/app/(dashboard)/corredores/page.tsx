'use client'

import { useState, useMemo } from 'react'
import { toast } from 'sonner'
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
    Pencil,
    AlertTriangle,
    Clock
} from 'lucide-react'
import Link from 'next/link'
import {
    useRunners,
    useRunnerInventory,
    useAssignInventory,
    useBulkReturnInventory,
    useShifts,
    useAdminEditClosedReturns,
    useUnclosedPreviousAssignments,
    useRunnerPOSSalesByDates
} from '@/hooks/use-sessions'
import { useProducts } from '@/hooks/use-products'
import { useCurrentProfile } from '@/hooks/use-profiles'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export default function CorredoresPage() {
    const { data: inventory, isLoading, refetch } = useRunnerInventory()
    const { data: currentProfile } = useCurrentProfile()
    const { data: unclosed = [] } = useUnclosedPreviousAssignments()
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })

    // Derive all unique Colombia dates present in inventory (for POS sales lookup)
    const blockDates = useMemo(() => {
        const dates = new Set<string>()
        for (const item of inventory || []) {
            const d = item.assigned_at
                ? new Date(item.assigned_at).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
                : (item.assignment_date as string)
            dates.add(d)
        }
        return Array.from(dates)
    }, [inventory])
    const { data: posSalesByDate = {} } = useRunnerPOSSalesByDates(blockDates)
    const [assignOpen, setAssignOpen] = useState(false)
    const [closingRunner, setClosingRunner] = useState<{ id: string; name: string; date: string } | null>(null)
    const [editingRunner, setEditingRunner] = useState<{ id: string; name: string; date: string } | null>(null)
    const [expandedRunners, setExpandedRunners] = useState<Record<string, boolean>>({})

    // One block per (runner + date). Within each block, events grouped by assigned_at.
    const blocks = useMemo(() => {
        type Event = { assignedAt: string; assignerName: string | null; items: any[]; hasActive: boolean }
        type Block = {
            key: string; runnerId: string; runner: any; date: string; isToday: boolean
            dateLabel: string; events: Event[]; hasActive: boolean
            // flat items list for bulk return (all events merged)
            allItems: any[]
        }
        const map: Record<string, Block> = {}

        for (const item of inventory || []) {
            const rid = item.runner?.id || item.runner_id || 'unknown'
            // Use Colombia date derived from assigned_at (not assignment_date which may be UTC-shifted)
            const date = item.assigned_at
                ? new Date(item.assigned_at).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
                : (item.assignment_date as string)
            const isToday = date === today
            const blockKey = `${rid}__${date}`

            if (!map[blockKey]) {
                const dateLabel = isToday
                    ? 'Hoy'
                    : new Date(date + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
                map[blockKey] = { key: blockKey, runnerId: rid, runner: item.runner, date, isToday, dateLabel, events: [], hasActive: false, allItems: [] }
            }
            const block = map[blockKey]

            // Find or create event by assigned_at
            const assignedAt = item.assigned_at || ''
            let event = block.events.find(e => e.assignedAt === assignedAt)
            if (!event) {
                event = { assignedAt, assignerName: (item as any).assigner?.full_name || null, items: [], hasActive: false }
                block.events.push(event)
            }

            // Aggregate same product within this event
            const pid = item.product?.id || item.product_id
            const existing = event.items.find(p => (p.product?.id || p.product_id) === pid)
            if (!existing) {
                event.items.push({ ...item, assigned_qty: item.assigned_qty || 0, returned_qty: item.returned_qty || 0, _ids: [{ id: item.id, assigned_qty: item.assigned_qty }] })
            } else {
                existing.assigned_qty += item.assigned_qty || 0
                existing.returned_qty += item.returned_qty || 0
                existing._ids.push({ id: item.id, assigned_qty: item.assigned_qty })
                if (item.status === 'active') existing.status = 'active'
            }
            if (item.status === 'active') { event.hasActive = true; block.hasActive = true }
        }

        // Sort events chronologically; sort products by assigned_qty desc; build allItems for bulk return
        return Object.values(map).map(block => {
            block.events.sort((a, b) => a.assignedAt.localeCompare(b.assignedAt))
            block.events.forEach(e => e.items.sort((a: any, b: any) => b.assigned_qty - a.assigned_qty))
            // allItems: merge active events only (for Cerrar Turno)
            const flatMap: Record<string, any> = {}
            for (const event of block.events) {
                if (!event.hasActive) continue
                for (const p of event.items) {
                    const pid = p.product?.id || p.product_id
                    if (!flatMap[pid]) flatMap[pid] = { ...p, assigned_qty: 0, returned_qty: 0, _ids: [], status: 'active' }
                    flatMap[pid].assigned_qty += p.assigned_qty
                    flatMap[pid].returned_qty += p.returned_qty
                    flatMap[pid]._ids.push(...p._ids)
                }
            }
            block.allItems = Object.values(flatMap).sort((a, b) => b.assigned_qty - a.assigned_qty)
            return block
        }).sort((a, b) => a.date !== b.date ? a.date.localeCompare(b.date) : (a.runner?.full_name || '').localeCompare(b.runner?.full_name || ''))
    }, [inventory, today])

    const toggleBlock = (key: string) =>
        setExpandedRunners(prev => ({ ...prev, [key]: !prev[key] }))

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

            {/* Unclosed previous assignments warning */}
            {unclosed.length > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex gap-2 items-start">
                    <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-semibold text-orange-800">
                            {unclosed.length === 1 ? '1 corredor tiene' : `${unclosed.length} corredores tienen`} turno sin cerrar de días anteriores
                        </p>
                        <ul className="mt-1 space-y-0.5">
                            {unclosed.map(u => (
                                <li key={u.runner_id} className="text-xs text-orange-700">
                                    • {u.runner_name} — {new Date(u.assignment_date + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            {/* Summary Cards — one per (runner + date) block */}
            {blocks.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {blocks.map(block => {
                        const allProducts = block.events.flatMap(e => e.items)
                        const assigned = allProducts.reduce((s: number, i: any) => s + i.assigned_qty, 0)
                        const returned = allProducts.reduce((s: number, i: any) => s + i.returned_qty, 0)
                        const estimatedValue = allProducts.reduce((s: number, i: any) => s + (i.assigned_qty - i.returned_qty) * (i.product?.price || 0), 0)
                        const posKey = `${block.runnerId}__${block.date}`
                        const posAmount: number | null = posKey in posSalesByDate ? posSalesByDate[posKey] : null
                        return (
                            <Card
                                key={block.key}
                                className={cn(
                                    "cursor-pointer hover:shadow-md transition-shadow border-t-4",
                                    block.isToday ? "border-t-blue-500" : "border-t-orange-400"
                                )}
                                onClick={() => {
                                    setExpandedRunners(prev => ({ ...prev, [block.key]: true }))
                                    setTimeout(() => {
                                        document.getElementById(`block-${block.key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                    }, 50)
                                }}
                            >
                                <CardContent className="pt-4 pb-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <Users className={cn("h-4 w-4", block.isToday ? "text-blue-500" : "text-orange-500")} />
                                            <span className="font-semibold text-slate-800">{block.runner?.full_name}</span>
                                        </div>
                                        {block.hasActive
                                            ? <Badge className={cn("text-white text-xs", block.isToday ? "bg-green-500" : "bg-orange-500")}>
                                                {block.isToday ? 'En ruta' : 'Sin cerrar'}
                                            </Badge>
                                            : <Badge variant="secondary" className="text-xs">Cerrado</Badge>
                                        }
                                    </div>
                                    <p className="text-xs text-slate-400 mb-3 pl-6">{block.dateLabel}</p>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-slate-50 rounded-lg p-2 text-center">
                                            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide mb-0.5">Asignado</p>
                                            <p className="font-bold text-base text-slate-800">{assigned}</p>
                                        </div>
                                        <div className="bg-yellow-50 rounded-lg p-2 text-center">
                                            <p className="text-[10px] text-yellow-600 font-medium uppercase tracking-wide mb-0.5">Devuelto</p>
                                            <p className="font-bold text-base text-yellow-700">{returned}</p>
                                        </div>
                                    </div>

                                    <div className="mt-3 border-t pt-2 space-y-1.5">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-slate-500 flex items-center gap-1">
                                                <TrendingUp className="h-3 w-3" />
                                                Ventas POS
                                            </span>
                                            <span className="font-bold text-green-600">
                                                {posAmount !== null ? `$${posAmount.toLocaleString()}` : '$0'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-slate-400">Estimado inventario</span>
                                            <span className="font-semibold text-slate-600">
                                                ${estimatedValue.toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}

            {/* Inventory Panel */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Package className="h-5 w-5 text-orange-600" />
                        Inventario por Corredor y Fecha
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="h-6 w-6 animate-spin text-orange-600" />
                        </div>
                    ) : blocks.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground">
                            <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                            <p className="font-medium">No hay inventario asignado</p>
                            <Button className="mt-4" onClick={() => setAssignOpen(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Asignar Inventario
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {blocks.map(block => {
                                const isExpanded = expandedRunners[block.key] ?? false
                                const uniqueProducts = new Set(block.events.flatMap(e => e.items.map((i: any) => i.product?.id || i.product_id))).size

                                return (
                                    <div key={block.key} id={`block-${block.key}`} className={cn(
                                        "border rounded-xl overflow-hidden",
                                        !block.isToday && "border-orange-200"
                                    )}>
                                        {/* Block header */}
                                        <div
                                            className={cn(
                                                "flex items-center justify-between px-4 py-3 cursor-pointer transition-colors",
                                                block.isToday ? "bg-slate-50 hover:bg-slate-100" : "bg-orange-50 hover:bg-orange-100"
                                            )}
                                            onClick={() => toggleBlock(block.key)}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                {isExpanded
                                                    ? <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />
                                                    : <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
                                                }
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-semibold text-slate-800">{block.runner?.full_name || 'Corredor'}</span>
                                                        {!block.isToday && <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />}
                                                        <Badge variant="outline" className={cn("text-xs", !block.isToday && "border-orange-300 text-orange-700 bg-orange-50")}>
                                                            {block.dateLabel}
                                                        </Badge>
                                                        <Badge variant="outline" className="text-xs text-slate-500">
                                                            {block.events.length} asignación{block.events.length !== 1 ? 'es' : ''} · {uniqueProducts} productos
                                                        </Badge>
                                                        {block.hasActive
                                                            ? <Badge className={cn("text-white text-xs", block.isToday ? "bg-green-500" : "bg-orange-500")}>
                                                                {block.isToday ? 'Activo' : 'Sin cerrar'}
                                                            </Badge>
                                                            : <Badge variant="secondary" className="text-xs">Cerrado</Badge>
                                                        }
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                {block.hasActive && (
                                                    <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white"
                                                        onClick={(e) => { e.stopPropagation(); setClosingRunner({ id: block.runnerId, name: block.runner?.full_name || 'Corredor', date: block.date }) }}>
                                                        <RotateCcw className="h-3.5 w-3.5 mr-1.5" />Cerrar Turno
                                                    </Button>
                                                )}
                                                {!block.hasActive && currentProfile?.role === 'ADMIN' && block.events.length > 0 && (
                                                    <Button size="sm" variant="outline" className="text-slate-500 hover:text-orange-600 hover:border-orange-200"
                                                        onClick={(e) => { e.stopPropagation(); setEditingRunner({ id: block.runnerId, name: block.runner?.full_name || 'Corredor', date: block.date }) }}>
                                                        <Pencil className="h-3.5 w-3.5 mr-1.5" />Editar Devolución
                                                    </Button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Events expanded — each assignment as its own sub-section */}
                                        {isExpanded && (
                                            <div className="divide-y">
                                                <div className="grid grid-cols-4 gap-2 px-4 py-2 bg-white text-xs font-medium text-slate-400 uppercase tracking-wide">
                                                    <span>Producto</span>
                                                    <span className="text-center">Asignado</span>
                                                    <span className="text-center">Devuelto</span>
                                                    <span className="text-center">Vendido</span>
                                                </div>
                                                {block.events.map((event, ei) => {
                                                    const timeLabel = event.assignedAt
                                                        ? new Date(event.assignedAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Bogota' })
                                                        : ''
                                                    const eTotal = event.items.reduce((s: any, i: any) => ({ assigned: s.assigned + i.assigned_qty, returned: s.returned + i.returned_qty }), { assigned: 0, returned: 0 })
                                                    return (
                                                        <div key={ei}>
                                                            {/* Event sub-header */}
                                                            <div className={cn(
                                                                "px-4 py-1.5 flex items-center gap-2 text-xs font-semibold",
                                                                event.hasActive ? "bg-blue-50 text-blue-700" : "bg-slate-50 text-slate-500"
                                                            )}>
                                                                <Clock className="h-3 w-3" />
                                                                <span>{timeLabel}</span>
                                                                {event.assignerName && <span className="font-normal opacity-70">· por {event.assignerName}</span>}
                                                                {!event.hasActive && <span className="ml-auto text-[10px]">Cerrado</span>}
                                                            </div>
                                                            {event.items.map((item: any) => {
                                                                const sold = item.assigned_qty - item.returned_qty
                                                                return (
                                                                    <div key={`${block.key}-${ei}-${item.product?.id || item.product_id}`} className={cn(
                                                                        "grid grid-cols-4 gap-2 px-4 py-2.5 items-center text-sm",
                                                                        !event.hasActive ? 'bg-slate-50/50 opacity-70' : 'bg-white hover:bg-slate-50'
                                                                    )}>
                                                                        <p className="font-medium text-slate-800">{item.product?.name}</p>
                                                                        <p className="text-center font-semibold text-slate-700">{item.assigned_qty}</p>
                                                                        <p className="text-center font-semibold text-yellow-600">{item.returned_qty}</p>
                                                                        <p className={cn("text-center font-bold", sold > 0 ? "text-green-600" : sold < 0 ? "text-red-500" : "text-slate-400")}>{sold}</p>
                                                                    </div>
                                                                )
                                                            })}
                                                            <div className={cn("grid grid-cols-4 gap-2 px-4 py-1.5 text-xs font-bold border-t", event.hasActive ? "bg-blue-50/50 text-blue-800" : "bg-slate-100 text-slate-500")}>
                                                                <span>Subtotal</span>
                                                                <span className="text-center">{eTotal.assigned}</span>
                                                                <span className="text-center">{eTotal.returned}</span>
                                                                <span className="text-center">{eTotal.assigned - eTotal.returned}</span>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
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
            {closingRunner && (() => {
                const block = blocks.find(b => b.runnerId === closingRunner.id && b.date === closingRunner.date)
                return (
                    <BulkReturnModal
                        runnerId={closingRunner.id}
                        runnerName={closingRunner.name}
                        dateLabel={block?.dateLabel || closingRunner.date}
                        items={block?.allItems || []}
                        onClose={() => setClosingRunner(null)}
                    />
                )
            })()}

            {/* Admin Edit Return Modal */}
            {editingRunner && (() => {
                const block = blocks.find(b => b.runnerId === editingRunner.id && b.date === editingRunner.date)
                return (
                    <AdminEditReturnModal
                        runnerId={editingRunner.id}
                        runnerName={editingRunner.name}
                        items={block?.allItems || []}
                        onClose={() => setEditingRunner(null)}
                    />
                )
            })()}
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
    dateLabel,
    items,
    onClose
}: {
    runnerId: string
    runnerName: string
    dateLabel: string
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
                    <p className="text-sm text-slate-500 mt-0.5 pl-6">{runnerName} · <span className="font-medium">{dateLabel}</span></p>
                </div>

                {/* ── PANTALLA 1: elegir acción ── */}
                {screen === 'choose' && (
                    <div className="flex flex-col gap-3 px-5 py-5">
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
        if (!selectedRunner) {
            toast.error('Selecciona un corredor')
            return
        }
        if (items.length === 0) {
            toast.error('Agrega al menos un producto con cantidad mayor a 0')
            return
        }

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
