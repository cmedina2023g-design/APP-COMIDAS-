'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useReceivables, useMarkSaleAsPaid, usePaymentMethods } from '@/hooks/use-sales'
import { Loader2, CheckCircle2, DollarSign, Calendar, User } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"

export function ReceivablesList() {
    const { data: receivables, isLoading } = useReceivables()
    const markAsPaidArgs = useMarkSaleAsPaid()

    // State to track which sale is being processed
    const [processingId, setProcessingId] = useState<string | null>(null)

    const handleMarkAsPaid = async (id: string, paymentMethodId: string, setOpen: (open: boolean) => void) => {
        try {
            setProcessingId(id)
            await markAsPaidArgs.mutateAsync({ saleId: id, paymentMethodId })
            setOpen(false)
        } catch (error) {
            console.error(error)
        } finally {
            setProcessingId(null)
        }
    }

    const totalReceivables = receivables?.reduce((acc: number, item: any) => acc + item.total, 0) || 0

    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
    }

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Total por Cobrar
                        </CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">
                            ${totalReceivables.toLocaleString()}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {receivables?.length || 0} ventas pendientes
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Cuentas por Cobrar (Cartera)</CardTitle>
                    <CardDescription>
                        Gestiona las ventas a crédito pendientes de pago.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {receivables?.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No hay cuentas por cobrar pendientes. 🎉
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {receivables?.map((sale: any) => (
                                <div key={sale.id} className="flex items-center justify-between p-4 border rounded-lg bg-white shadow-sm hover:bg-slate-50 transition-colors">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-lg text-slate-800">
                                                ${sale.total.toLocaleString()}
                                            </span>
                                            <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full font-medium border border-amber-200">
                                                Pendiente
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                            <div className="flex items-center gap-1">
                                                <Calendar className="h-3 w-3" />
                                                {format(new Date(sale.created_at), "PPP p", { locale: es })}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <User className="h-3 w-3" />
                                                Vendedor: {sale.seller?.full_name || 'Desconocido'}
                                            </div>
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            ID: {sale.id.slice(0, 8)}...
                                        </div>
                                    </div>

                                    <PaymentConfirmationDialog
                                        sale={sale}
                                        onConfirm={handleMarkAsPaid}
                                        isProcessing={processingId === sale.id}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

function PaymentConfirmationDialog({ sale, onConfirm, isProcessing }: { sale: any, onConfirm: (id: string, paymentMethodId: string, setOpen: (o: boolean) => void) => void, isProcessing: boolean }) {
    const [open, setOpen] = useState(false)
    const [selectedMethodId, setSelectedMethodId] = useState<string>('')
    const { data: methods } = usePaymentMethods()

    // Filter out credit from payment options (they're paying off credit, so they pay with other methods)
    const paymentOptions = methods?.filter((m: any) => m.name !== 'CREDITO') || []

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2 border-green-200 hover:bg-green-50 text-green-700 hover:text-green-800">
                    <CheckCircle2 className="h-4 w-4" />
                    Registrar Pago
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Registrar pago de ${sale.total.toLocaleString()}</DialogTitle>
                    <DialogDescription>
                        Selecciona cómo pagó el cliente esta deuda.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    <p className="text-sm font-medium mb-3 text-slate-700">¿Cómo pagó?</p>
                    <div className="grid grid-cols-2 gap-2">
                        {paymentOptions.map((method: any) => (
                            <Button
                                key={method.id}
                                variant={selectedMethodId === method.id ? "default" : "outline"}
                                className={selectedMethodId === method.id
                                    ? "bg-green-600 hover:bg-green-700 text-white"
                                    : "hover:bg-slate-50"}
                                onClick={() => setSelectedMethodId(method.id)}
                            >
                                {method.name}
                            </Button>
                        ))}
                    </div>
                </div>

                <DialogFooter>
                    <div className="flex gap-2 justify-end w-full">
                        <Button variant="outline" onClick={() => setOpen(false)}>
                            Cancelar
                        </Button>
                        <Button
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => onConfirm(sale.id, selectedMethodId, setOpen)}
                            disabled={isProcessing || !selectedMethodId}
                        >
                            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Confirmar Pago
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
