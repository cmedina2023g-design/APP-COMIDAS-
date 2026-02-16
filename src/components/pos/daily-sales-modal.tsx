'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useDailyProductSummary } from '@/hooks/use-sales'
import { useCurrentShift, useShiftPaymentMethods } from '@/hooks/use-sessions'
import { Loader2, ScrollText } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useState } from 'react'

export function DailySalesModal() {
    const { data: summary, isLoading, refetch } = useDailyProductSummary()
    const { data: currentShift } = useCurrentShift()
    const [open, setOpen] = useState(false)

    // Calculate shift boundaries for the current day
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

    // Use the hook to get payment methods for TODAY (or ideally current shift if we had exact times)
    const { data: paymentMethods } = useShiftPaymentMethods(startOfDay, endOfDay)

    const totalSales = paymentMethods?.reduce((acc: number, curr: any) => acc + curr.total_amount, 0) || 0
    const creditSales = paymentMethods?.find((pm: any) => pm.method_name === 'CREDITO')?.total_amount || 0
    const cashSales = totalSales - creditSales

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2 w-full bg-white hover:bg-slate-100 border-slate-200 text-slate-700 shadow-sm">
                    <ScrollText className="h-4 w-4" />
                    Resumen del Turno
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Resumen del Turno</DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Financial Summary */}
                    <div className="grid gap-4">
                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                                <span className="text-sm font-medium text-slate-500">Ventas Totales</span>
                                <span className="text-lg font-bold text-slate-900">${totalSales.toLocaleString()}</span>
                            </div>

                            <div className="space-y-1">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-600">Dinero en Caja (Efectivo/Transferencia)</span>
                                    <span className="font-semibold text-green-600">${cashSales.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-600">Crédito (Por Cobrar)</span>
                                    <span className="font-semibold text-red-600">${creditSales.toLocaleString()}</span>
                                </div>
                            </div>

                            {/* Detailed Payment Breakdown */}
                            <div className="pt-2 text-xs text-slate-400">
                                {paymentMethods?.map((pm: any) => (
                                    <div key={pm.method_name} className="flex justify-between">
                                        <span>{pm.method_name}</span>
                                        <span>${pm.total_amount.toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Product Summary */}
                    <div>
                        <h3 className="text-sm font-medium mb-3">Productos Vendidos</h3>
                        <div className="max-h-[40vh] overflow-y-auto border rounded-md">
                            {isLoading ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="animate-spin h-8 w-8 text-primary" />
                                </div>
                            ) : !summary || summary.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    No hay ventas registradas hoy.
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Producto</TableHead>
                                            <TableHead className="text-right">Cant</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {summary.map((item) => (
                                            <TableRow key={item.name}>
                                                <TableCell className="font-medium text-sm">{item.name}</TableCell>
                                                <TableCell className="text-right font-bold">{item.qty}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-2 mt-4">
                    <Button variant="ghost" size="sm" onClick={() => refetch()}>
                        Actualizar
                    </Button>
                    <Button onClick={() => setOpen(false)}>
                        Cerrar
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
