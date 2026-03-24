'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useSalesHistory, useVoidSale } from '@/hooks/use-sales'
import { useCurrentProfile } from '@/hooks/use-profiles'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Loader2, Ban, ScrollText, AlertTriangle, Calendar } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'

export default function SalesHistoryPage() {
    const { data: profile, isLoading: isLoadingProfile } = useCurrentProfile()
    const [saleToVoid, setSaleToVoid] = useState<any>(null)

    const todayStr = () => new Date().toISOString().split('T')[0]
    const [startDate, setStartDate] = useState(todayStr)
    const [endDate, setEndDate] = useState(todayStr)

    const { data: sales, isLoading, error } = useSalesHistory({
        startDate: startDate ? `${startDate}T00:00:00` : undefined,
        endDate: endDate ? `${endDate}T23:59:59` : undefined,
    })
    const { mutate: voidSale, isPending: isVoiding } = useVoidSale()

    const isAdmin = profile?.role === 'ADMIN'

    const handleVoid = () => {
        if (!saleToVoid || !profile) return
        voidSale(
            { saleId: saleToVoid.id, adminId: profile.id },
            {
                onSuccess: () => setSaleToVoid(null)
            }
        )
    }

    if (isLoadingProfile || isLoading) {
        return (
            <div className="flex justify-center items-center h-[50vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4">
                <AlertTriangle className="h-12 w-12 text-amber-500" />
                <h2 className="text-2xl font-bold">Acceso Denegado</h2>
                <p className="text-slate-500">Solo los administradores pueden acceder al historial completo y anulación de ventas.</p>
            </div>
        )
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">Historial de Ventas</h2>
                    <p className="text-slate-500 mt-1">Revisa el detalle histórico y gestiona anulaciones en caso de error.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <Calendar className="h-4 w-4 text-slate-500" />
                    <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-40"
                    />
                    <span className="text-slate-400">—</span>
                    <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-40"
                    />
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setStartDate(todayStr()); setEndDate(todayStr()) }}
                    >
                        Hoy
                    </Button>
                </div>
            </div>

            <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    <TableHead className="w-[180px]">Fecha / Hora</TableHead>
                                    <TableHead>Vendedor</TableHead>
                                    <TableHead>Artículos</TableHead>
                                    <TableHead>Total</TableHead>
                                    <TableHead>Pago / Estado</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {!sales || sales.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-10 text-slate-500">
                                            {error ? 'Error al cargar ventas. Intenta de nuevo.' : 'No hay ventas en el período seleccionado.'}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    sales.map((sale: any) => (
                                        <TableRow key={sale.id} className={sale.status === 'VOIDED' ? 'bg-slate-50' : ''}>
                                            <TableCell className="font-medium">
                                                <div className="text-sm text-slate-900">
                                                    {format(new Date(sale.created_at), "dd MMM yyyy", { locale: es })}
                                                </div>
                                                <div className="text-xs text-slate-500">
                                                    {format(new Date(sale.created_at), "HH:mm")}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {sale.seller?.full_name || 'Desconocido'}
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-xs text-slate-600 space-y-1 max-w-[250px]">
                                                    {sale.sale_items?.map((item: any, i: number) => (
                                                        <div key={i} className={sale.status === 'VOIDED' ? 'line-through text-slate-400' : ''}>
                                                            <span className="font-semibold">{item.qty}x</span> {item.product?.name}
                                                            {item.sale_item_modifiers?.length > 0 && (
                                                                <span className="text-slate-400 block pl-4">
                                                                    + {item.sale_item_modifiers.map((m: any) => m.modifier_name).join(', ')}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-bold">
                                                <span className={sale.status === 'VOIDED' ? 'line-through text-slate-400' : 'text-slate-900'}>
                                                    ${sale.total.toLocaleString()}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col items-start gap-1">
                                                    {sale.status === 'VOIDED' ? (
                                                        <Badge variant="outline" className="text-slate-500 bg-slate-100 border-slate-200">
                                                            ANULADA
                                                        </Badge>
                                                    ) : sale.payment_status === 'PENDING' ? (
                                                        <Badge variant="destructive" className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200">
                                                            POR COBRAR
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border-emerald-200">
                                                            PAGADO
                                                        </Badge>
                                                    )}
                                                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                                                        {sale.payment_method?.name || 'Múltiple'}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {sale.status === 'CONFIRMED' && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                        onClick={() => setSaleToVoid(sale)}
                                                    >
                                                        <Ban className="h-4 w-4 mr-1" />
                                                        Anular
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={!!saleToVoid} onOpenChange={(open) => !open && setSaleToVoid(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <AlertTriangle className="h-5 w-5" />
                            ¿Anular Venta?
                        </DialogTitle>
                        <DialogDescription className="pt-2 text-slate-600 space-y-2" asChild>
                            <div>
                                {saleToVoid && (
                                    <>
                                        <p><strong>Vendedor:</strong> {saleToVoid.seller?.full_name || 'Desconocido'}</p>
                                        <p><strong>Fecha:</strong> {format(new Date(saleToVoid.created_at), "dd MMM yyyy HH:mm", { locale: es })}</p>
                                        <div>
                                            <strong>Artículos:</strong>
                                            <ul className="mt-1 space-y-0.5 pl-3 text-xs list-disc">
                                                {saleToVoid.sale_items?.map((item: any, i: number) => (
                                                    <li key={i}>{item.qty}x {item.product?.name}</li>
                                                ))}
                                            </ul>
                                        </div>
                                        <p>Total: <strong>${saleToVoid.total.toLocaleString()}</strong></p>
                                    </>
                                )}
                                <p>Al confirmar, el inventario <strong>será devuelto al sistema</strong>.</p>
                                <p className="text-sm font-medium text-slate-900">Esta acción no se puede deshacer.</p>
                            </div>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={() => setSaleToVoid(null)} disabled={isVoiding}>
                            Cancelar
                        </Button>
                        <Button variant="destructive" onClick={handleVoid} disabled={isVoiding}>
                            {isVoiding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Ban className="h-4 w-4 mr-2" />}
                            Sí, Anular Venta
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
