'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
    Users,
    LogOut,
    Clock,
    Package,
    Plus,
    RefreshCw,
    Loader2,
    UserCircle,
    Timer,
    RotateCcw,
    ChevronRight,
    ChevronDown,
    ShieldAlert,
    TrendingUp,
    UtensilsCrossed
} from 'lucide-react'
import Link from 'next/link'
import {
    useActiveSessions,
    useCloseSession,
    useShifts,
    useCurrentShift,
    useRunners,
    useRunnerInventory,
    useAssignInventory,
    useReturnInventory,
    useRunnerSummary
} from '@/hooks/use-sessions'
import { createClient } from '@/lib/supabase/client'
import { useProducts } from '@/hooks/use-products'
import { useCurrentProfile } from '@/hooks/use-profiles'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { EmployeeMealsSummary } from '@/components/admin/employee-meals-summary'

import { useReceivables } from '@/hooks/use-sales'
import { ReceivablesWidget } from '@/components/admin/receivables-widget'

// Role translation helper
const roleLabels: Record<string, string> = {
    ADMIN: 'Administrador',
    SELLER: 'Vendedor',
    RUNNER: 'Corredor'
}

export default function AdminPage() {
    const router = useRouter()
    const { data: currentProfile, isLoading: profileLoading } = useCurrentProfile()

    // Redirect non-admin users
    useEffect(() => {
        if (!profileLoading && currentProfile && currentProfile.role !== 'ADMIN') {
            router.push('/dashboard')
        }
    }, [currentProfile, profileLoading, router])

    // Show loading while checking permissions
    if (profileLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        )
    }

    // Show access denied if not admin
    if (currentProfile?.role !== 'ADMIN') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <ShieldAlert className="h-16 w-16 text-red-400 mb-4" />
                <h2 className="text-xl font-bold text-slate-700">Acceso Denegado</h2>
                <p className="text-slate-500">Solo administradores pueden acceder a esta página</p>
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-slate-800">Panel de Administración</h1>
                <div className="flex gap-2">
                    <ReceivablesWidget />
                    <Link href="/admin/finance">
                        <Button className="bg-green-600 hover:bg-green-700">
                            <TrendingUp className="mr-2 h-4 w-4" />
                            Reporte Financiero
                        </Button>
                    </Link>
                </div>
            </div>

            <Tabs defaultValue="sessions" className="space-y-4">
                <TabsList className="bg-slate-100">
                    <TabsTrigger value="sessions" className="gap-2">
                        <Users className="h-4 w-4" />
                        Sesiones Activas
                    </TabsTrigger>
                    <TabsTrigger value="runners" className="gap-2">
                        <Package className="h-4 w-4" />
                        Inventario Corredores
                    </TabsTrigger>
                    <TabsTrigger value="shifts" className="gap-2">
                        <Clock className="h-4 w-4" />
                        Turnos
                    </TabsTrigger>
                    <TabsTrigger value="meals" className="gap-2">
                        <UtensilsCrossed className="h-4 w-4" />
                        Comidas Empleados
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="sessions">
                    <SessionsPanel />
                </TabsContent>

                <TabsContent value="runners">
                    <RunnersPanel />
                </TabsContent>

                <TabsContent value="shifts">
                    <ShiftsPanel />
                </TabsContent>

                <TabsContent value="meals">
                    <EmployeeMealsSummary />
                </TabsContent>
            </Tabs>
        </div>
    )
}

// ==================== SESSIONS PANEL ====================

function SessionsPanel() {
    const { data: sessions, isLoading, refetch } = useActiveSessions()
    const closeSession = useCloseSession()
    const { data: currentShift } = useCurrentShift()
    const supabase = createClient()

    // Realtime subscription for auto-update
    useEffect(() => {
        const channel = supabase
            .channel('sessions-realtime')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'user_sessions'
                },
                () => {
                    refetch()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [refetch, supabase])

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-blue-600" />
                        Sesiones Activas
                    </CardTitle>
                    {currentShift && (
                        <p className="text-sm text-muted-foreground">
                            Turno actual: <Badge variant="outline">{currentShift.name}</Badge>
                        </p>
                    )}
                </div>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Actualizar
                </Button>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                    </div>
                ) : !sessions || sessions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <UserCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>No hay sesiones activas</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {sessions.map((session) => (
                            <div
                                key={session.id}
                                className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                        <UserCircle className="h-6 w-6 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="font-medium">
                                            {session.user?.full_name || 'Usuario'}
                                        </p>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Badge variant="secondary" className="text-xs">
                                                {roleLabels[session.user?.role || 'SELLER'] || 'Vendedor'}
                                            </Badge>
                                            <span className="flex items-center gap-1">
                                                <Timer className="h-3 w-3" />
                                                {formatDistanceToNow(new Date(session.started_at), {
                                                    addSuffix: false,
                                                    locale: es
                                                })}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button variant="destructive" size="sm">
                                            <LogOut className="h-4 w-4 mr-2" />
                                            Cerrar Sesión
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Confirmar cierre de sesión</DialogTitle>
                                            <DialogDescription>
                                                ¿Estás seguro de cerrar la sesión de{' '}
                                                <strong>{session.user?.full_name}</strong>?
                                                Esta acción cerrará inmediatamente su acceso al sistema.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <DialogFooter>
                                            <Button
                                                variant="destructive"
                                                onClick={() => closeSession.mutate(session.id)}
                                                disabled={closeSession.isPending}
                                            >
                                                {closeSession.isPending ? (
                                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                ) : (
                                                    <LogOut className="h-4 w-4 mr-2" />
                                                )}
                                                Confirmar Cierre
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

// ==================== RUNNERS PANEL ====================

function RunnersPanel() {
    const { data: inventory, isLoading, refetch } = useRunnerInventory()
    const { data: summary } = useRunnerSummary()
    const [assignOpen, setAssignOpen] = useState(false)

    return (
        <div className="space-y-4">
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
    // Check if the RETURNED qty exceeds ASSIGNED.
    // NOTE: This logic assumes 'returnQty' is the TOTAL amount being returned now. 
    // If the system supported incremental returns, we'd need (item.returned_qty + currentReturn) > assignedQty.
    // Based on user feedback ("returned 20, assigned 3"), it seems they entered 20 in this input.
    // We will cap it at assignedQty.
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

// ==================== SHIFTS PANEL ====================

function ShiftsPanel() {
    const { data: shifts, isLoading } = useShifts()
    const { data: currentShift } = useCurrentShift()

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-purple-600" />
                    Turnos Configurados
                </CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                    </div>
                ) : (
                    <div className="space-y-3">
                        {shifts?.map((shift) => (
                            <div
                                key={shift.id}
                                className={`flex items-center justify-between p-4 rounded-lg border ${currentShift?.id === shift.id
                                    ? 'bg-purple-50 border-purple-300'
                                    : 'bg-slate-50'
                                    }`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${currentShift?.id === shift.id
                                        ? 'bg-purple-100'
                                        : 'bg-slate-200'
                                        }`}>
                                        <Clock className={`h-5 w-5 ${currentShift?.id === shift.id
                                            ? 'text-purple-600'
                                            : 'text-slate-500'
                                            }`} />
                                    </div>
                                    <div>
                                        <p className="font-medium">{shift.name}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}
                                        </p>
                                    </div>
                                </div>

                                {currentShift?.id === shift.id && (
                                    <Badge className="bg-purple-500">Turno Actual</Badge>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
