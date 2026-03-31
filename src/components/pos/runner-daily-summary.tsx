'use client'

import React, { useMemo } from 'react'
import { useRunnerSaleDetails } from '@/hooks/use-reports'
import { startOfDay, endOfDay } from 'date-fns'
import { Card, CardContent } from '@/components/ui/card'
import { DollarSign, Receipt, TrendingUp, UserCircle } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

interface RunnerDailySummaryProps {
    runnerId: string | null
    runnerName: string
}

export function RunnerDailySummary({ runnerId, runnerName }: RunnerDailySummaryProps) {
    const today = new Date()
    const { data: sales, isLoading } = useRunnerSaleDetails(
        runnerId,
        startOfDay(today),
        endOfDay(today)
    )

    const summary = useMemo(() => {
        if (!sales) return null
        const totalAmount = sales.reduce((acc, sale) => acc + sale.total, 0)
        const txCount = sales.length

        // Group by payment method
        const paymentMap = new Map<string, number>()
        sales.forEach(sale => {
            // sale.payment_method could be "EFECTIVO + Nequi", but useRunnerSaleDetails returned it explicitly formatted.
            // Wait, sale_payments allows exact breakdown per payment. 
            // In useRunnerSaleDetails, payment_method is just a joined string if multiple.
            // But we don't have separate amounts per payment method there!
            // Wait, useRunnerSaleDetails doesn't return amounts per method, just the names joined.
            // Oh right, it maps `sale_payments` to just a string. 
            // We can still group by that exact string.
            const method = sale.payment_method || 'Desconocido'
            paymentMap.set(method, (paymentMap.get(method) || 0) + sale.total)
        })

        const breakdowns = Array.from(paymentMap.entries()).map(([method, amount]) => ({
            method,
            amount
        }))

        return { totalAmount, txCount, breakdowns }
    }, [sales])

    if (isLoading) {
        return (
            <div className="space-y-4 pt-4">
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-32 w-full rounded-xl" />
            </div>
        )
    }

    if (!summary || summary.txCount === 0) {
        return (
            <div className="text-center py-10 space-y-3">
                <p className="text-slate-400">Aún no tienes ventas registradas hoy.</p>
            </div>
        )
    }

    return (
        <div className="space-y-6 pt-4 pb-8">
            <div className="flex items-center gap-3 bg-blue-50 p-4 rounded-xl border border-blue-100">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                    <UserCircle size={28} />
                </div>
                <div>
                    <h2 className="font-bold text-slate-800 text-lg leading-tight">{runnerName}</h2>
                    <p className="text-sm text-blue-600 font-medium">Resumen del Día</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <Card className="border-t-4 border-t-emerald-500 shadow-sm">
                    <CardContent className="p-4 flex flex-col items-center justify-center min-h-[100px]">
                        <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                            <DollarSign className="h-4 w-4" /> Total Vendido
                        </p>
                        <p className="text-2xl font-black text-emerald-600">
                            ${summary.totalAmount.toLocaleString()}
                        </p>
                    </CardContent>
                </Card>
                <Card className="border-t-4 border-t-blue-500 shadow-sm">
                    <CardContent className="p-4 flex flex-col items-center justify-center min-h-[100px]">
                        <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                            <Receipt className="h-4 w-4" /> Ventas
                        </p>
                        <p className="text-2xl font-black text-slate-800">
                            {summary.txCount}
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div>
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">
                    Desglose de Pago
                </h3>
                <div className="bg-white rounded-xl border p-4 space-y-3 shadow-sm">
                    {summary.breakdowns.map((b, i) => (
                        <div key={i} className="flex justify-between items-center text-sm">
                            <span className="font-medium text-slate-600">{b.method}</span>
                            <span className="font-bold text-slate-900">${b.amount.toLocaleString()}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div>
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3 mt-6">
                    Últimas Ventas
                </h3>
                <div className="space-y-2">
                    {sales?.slice(0, 5).map(sale => (
                        <div key={sale.id} className="bg-white rounded-lg border p-3 flex justify-between items-center shadow-sm">
                            <div>
                                <p className="font-medium text-sm text-slate-800">${sale.total.toLocaleString()}</p>
                                <p className="text-xs text-slate-400">
                                    {new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-semibold text-slate-600">{sale.payment_method}</p>
                                <p className="text-xs text-slate-500">{sale.items.length} items</p>
                            </div>
                        </div>
                    ))}
                    {sales && sales.length > 5 && (
                        <p className="text-center text-xs text-muted-foreground mt-2">
                            Y {sales.length - 5} ventas más...
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}
