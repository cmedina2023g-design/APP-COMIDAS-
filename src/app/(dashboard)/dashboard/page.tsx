'use client'

import React, { useState } from 'react'
import { useDashboardStats } from '@/hooks/use-dashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DollarSign, CreditCard, ShoppingBag, AlertTriangle, ArrowUpRight, ArrowDownRight, Sun, Moon, UserCircle, UtensilsCrossed } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useShiftSales, useShiftPaymentMethods, useRunnerPaymentMethods, useShifts } from '@/hooks/use-sessions'
import { useRunnerSales } from '@/hooks/use-reports'
import { useAllEmployeesSummary } from '@/hooks/use-employee-meals'
import { formatCurrency } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

import { startOfDay, endOfDay } from 'date-fns'

export default function DashboardPage() {
    const { data: stats, isLoading } = useDashboardStats()
    const today = new Date()
    const { data: shiftSales } = useShiftSales(startOfDay(today), endOfDay(today))
    const { data: paymentMethods } = useShiftPaymentMethods(startOfDay(today), endOfDay(today))
    const { data: runnerSales } = useRunnerSales(startOfDay(today), endOfDay(today))
    const { data: runnerPaymentMethods } = useRunnerPaymentMethods(startOfDay(today), endOfDay(today))
    const { data: shifts } = useShifts()
    const [mealsDate, setMealsDate] = useState(new Date().toISOString().split('T')[0])
    const { data: employeeMeals = [] } = useAllEmployeesSummary(mealsDate)

    // Get time for display
    const morningShift = shifts?.find(s => s.name === 'Mañana')
    const afternoonShift = shifts?.find(s => s.name === 'Tarde')

    const formatTime = (timeStr?: string) => {
        if (!timeStr) return ''
        const [hours, minutes] = timeStr.split(':')
        const h = parseInt(hours)
        const ampm = h >= 12 ? 'PM' : 'AM'
        const h12 = h % 12 || 12
        return `${h12}:${minutes} ${ampm}`
    }


    const cards = [
        {
            title: 'Ventas del Día',
            value: isLoading ? '...' : `$${stats?.salesToday.toLocaleString() || '0'}`,
            description: isLoading ? 'Cargando...' : `${stats?.transactionsToday || 0} ventas hoy`,
            icon: DollarSign,
        },
        {
            title: 'Transacciones',
            value: isLoading ? '...' : `${stats?.transactionsToday || '0'}`,
            description: isLoading ? 'Cargando...' : `Promedio: $${stats?.transactionsToday ? Math.round((stats?.salesToday || 0) / stats.transactionsToday).toLocaleString() : '0'}`,
            icon: CreditCard,
        },
        {
            title: 'Producto Top',
            value: isLoading ? '...' : (stats?.topProduct?.name || '-'),
            description: isLoading ? 'Cargando...' : `${stats?.topProduct?.qty || 0} unid. (30 días)`,
            icon: ShoppingBag,
        },
        {
            title: 'Stock Bajo',
            value: isLoading ? '...' : `${stats?.lowStockCount || '0'}`,
            description: 'Ingredientes en alerta',
            icon: AlertTriangle,
            alert: (stats?.lowStockCount || 0) > 0,
        },
    ]

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
                    <p className="text-muted-foreground">Resumen de actividad del día.</p>
                </div>
                <div className="flex gap-2">
                    <Link href="/pos">
                        <Button size="lg" className="bg-green-600 hover:bg-green-700 font-bold text-lg">
                            Nueva Venta (POS)
                        </Button>
                    </Link>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {cards.map((stat) => (
                    <Card key={stat.title}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                {stat.title}
                            </CardTitle>
                            <stat.icon className={`h-4 w-4 ${stat.alert ? 'text-red-500' : 'text-muted-foreground'}`} />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stat.value}</div>
                            <p className="text-xs text-muted-foreground">
                                {stat.description}
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>


            {/* Shift Summary Section */}
            <div>
                <h3 className="text-lg font-semibold mb-3">Ventas por Turno (Hoy)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Morning Shift */}
                    <Card className="border-l-4 border-l-amber-400">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex justify-between items-center">
                                <span className="flex items-center gap-2">
                                    <Sun className="h-5 w-5 text-amber-500" />
                                    Turno Mañana
                                </span>
                                {shiftSales?.find(s => s.shift_name === 'Mañana') ? (
                                    <span className="text-sm font-normal text-muted-foreground">
                                        {shiftSales.find(s => s.shift_name === 'Mañana')?.transaction_count} ventas
                                    </span>
                                ) : null}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                ${shiftSales?.find(s => s.shift_name === 'Mañana')?.total_sales.toLocaleString() || '0'}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {morningShift ? `${formatTime(morningShift.start_time)} - ${formatTime(morningShift.end_time)}` : '6:00 AM - 2:00 PM'}
                            </p>
                            {/* Payment Breakdown */}
                            {(() => {
                                const allMethods = paymentMethods?.filter((pm: any) => pm.shift_name === 'Mañana') || []
                                if (allMethods.length === 0) return null
                                const cashMethods = allMethods.filter((pm: any) => pm.payment_method.toUpperCase() !== 'CREDITO')
                                const creditMethods = allMethods.filter((pm: any) => pm.payment_method.toUpperCase() === 'CREDITO')
                                const totalToHandOver = cashMethods.reduce((acc: number, pm: any) => acc + parseFloat(pm.total_amount), 0)
                                return (
                                    <div className="border-t border-amber-200/50 pt-2 mt-2 space-y-1">
                                        {cashMethods.map((pm: any, i: number) => (
                                            <div key={i} className="flex justify-between text-xs text-amber-800/80">
                                                <span className="capitalize">{pm.payment_method.toLowerCase()}</span>
                                                <span className="font-medium">${parseFloat(pm.total_amount).toLocaleString()}</span>
                                            </div>
                                        ))}
                                        {cashMethods.length > 0 && (
                                            <div className="flex justify-between text-xs font-bold text-green-700 border-t border-green-200/50 pt-1 mt-1">
                                                <span>💰 A entregar:</span>
                                                <span>${totalToHandOver.toLocaleString()}</span>
                                            </div>
                                        )}
                                        {creditMethods.map((pm: any, i: number) => (
                                            <div key={`credit-${i}`} className="flex justify-between text-xs text-amber-600/60 italic">
                                                <span>Crédito (no entregar)</span>
                                                <span>${parseFloat(pm.total_amount).toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                )
                            })()}
                        </CardContent>
                    </Card>

                    {/* Afternoon Shift */}
                    <Card className="border-l-4 border-l-indigo-500">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex justify-between items-center">
                                <span className="flex items-center gap-2">
                                    <Moon className="h-5 w-5 text-indigo-500" />
                                    Turno Tarde
                                </span>
                                {shiftSales?.find(s => s.shift_name === 'Tarde') ? (
                                    <span className="text-sm font-normal text-muted-foreground">
                                        {shiftSales.find(s => s.shift_name === 'Tarde')?.transaction_count} ventas
                                    </span>
                                ) : null}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                ${shiftSales?.find(s => s.shift_name === 'Tarde')?.total_sales.toLocaleString() || '0'}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {afternoonShift ? `${formatTime(afternoonShift.start_time)} - ${formatTime(afternoonShift.end_time)}` : '2:00 PM - 11:00 PM'}
                            </p>
                            {/* Payment Breakdown */}
                            {(() => {
                                const allMethods = paymentMethods?.filter((pm: any) => pm.shift_name === 'Tarde') || []
                                if (allMethods.length === 0) return null
                                const cashMethods = allMethods.filter((pm: any) => pm.payment_method.toUpperCase() !== 'CREDITO')
                                const creditMethods = allMethods.filter((pm: any) => pm.payment_method.toUpperCase() === 'CREDITO')
                                const totalToHandOver = cashMethods.reduce((acc: number, pm: any) => acc + parseFloat(pm.total_amount), 0)
                                return (
                                    <div className="border-t border-indigo-200/50 pt-2 mt-2 space-y-1">
                                        {cashMethods.map((pm: any, i: number) => (
                                            <div key={i} className="flex justify-between text-xs text-indigo-800/80">
                                                <span className="capitalize">{pm.payment_method.toLowerCase()}</span>
                                                <span className="font-medium">${parseFloat(pm.total_amount).toLocaleString()}</span>
                                            </div>
                                        ))}
                                        {cashMethods.length > 0 && (
                                            <div className="flex justify-between text-xs font-bold text-green-700 border-t border-green-200/50 pt-1 mt-1">
                                                <span>💰 A entregar:</span>
                                                <span>${totalToHandOver.toLocaleString()}</span>
                                            </div>
                                        )}
                                        {creditMethods.map((pm: any, i: number) => (
                                            <div key={`credit-${i}`} className="flex justify-between text-xs text-indigo-600/60 italic">
                                                <span>Crédito (no entregar)</span>
                                                <span>${parseFloat(pm.total_amount).toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                )
                            })()}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Runner Sales Section */}
            {runnerSales && runnerSales.length > 0 && (
                <div>
                    <h3 className="text-lg font-semibold mb-3">Ventas por Corredor (Hoy)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {runnerSales.map((runner: any, i: number) => (
                            <Card key={i} className="border-t-4 border-t-blue-500">
                                <CardContent className="pt-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="flex items-center gap-2">
                                            <UserCircle className="h-5 w-5 text-blue-500" />
                                            <span className="font-medium">{runner.runner_name}</span>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-lg">${parseFloat(runner.total_sales).toLocaleString()}</p>
                                            <p className="text-xs text-muted-foreground">{runner.transaction_count} ventas</p>
                                        </div>
                                    </div>

                                    {/* Payment Breakdown */}
                                    {(() => {
                                        const rMethods = runnerPaymentMethods?.filter((pm: any) =>
                                            pm.runner_name === runner.runner_name
                                        ) || []

                                        if (rMethods.length > 0) {
                                            return (
                                                <div className="border-t pt-2 mt-2 space-y-1">
                                                    {rMethods.map((rpm: any, idx: number) => (
                                                        <div key={idx} className="flex justify-between text-xs text-slate-600">
                                                            <span>{rpm.payment_method}</span>
                                                            <span className="font-medium">${parseFloat(rpm.total_amount).toLocaleString()}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )
                                        }
                                    })()}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {/* Employee Meals Summary Section */}
            <div>
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <UtensilsCrossed className="h-5 w-5 text-orange-500" />
                        Comidas Empleados - Control de Consumo
                    </h3>
                    <Input
                        type="date"
                        value={mealsDate}
                        onChange={(e) => setMealsDate(e.target.value)}
                        className="w-auto"
                    />
                </div>
                <Card>
                    <CardContent className="pt-6">
                        {employeeMeals.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8">No hay registros para esta fecha</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b text-sm">
                                            <th className="text-left p-2 font-medium">Empleado</th>
                                            <th className="text-left p-2 font-medium">Items Consumidos</th>
                                            <th className="text-right p-2 font-medium">Total Consumido</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {employeeMeals.map((emp: any) => (
                                            <tr key={emp.employee_id} className="border-b last:border-0 hover:bg-gray-50">
                                                <td className="p-2">
                                                    <div className="font-medium">{emp.employee_name}</div>
                                                    <div className="text-xs text-muted-foreground">{emp.role}</div>
                                                </td>
                                                <td className="p-2 text-center">
                                                    <div className="text-sm space-y-1">
                                                        {emp.meal_details?.map((meal: any, idx: number) => (
                                                            <div key={idx} className="text-left">
                                                                <span className="font-medium">{meal.quantity}x</span> {meal.product_name}
                                                                <span className="text-xs text-muted-foreground ml-2">
                                                                    ({formatCurrency(meal.total_value)})
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="p-2 text-right">
                                                    <span className="font-bold text-orange-600">
                                                        {formatCurrency(emp.total_meals)}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-orange-50 font-bold border-t-2">
                                        <tr>
                                            <td className="p-2">TOTAL DEL DÍA</td>
                                            <td className="p-2 text-left text-orange-700">
                                                {employeeMeals.reduce((sum: number, emp: any) => sum + emp.meal_count, 0)} productos consumidos
                                            </td>
                                            <td className="p-2 text-right text-orange-700">
                                                {formatCurrency(employeeMeals.reduce((sum: number, emp: any) => sum + Number(emp.total_meals), 0))}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ShoppingBag className="h-5 w-5 text-emerald-500" />
                            Productos Vendidos Hoy
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="py-10 text-center">Cargando...</div>
                        ) : (() => {
                            // Aggregate all sale items from today into product totals
                            const productMap = new Map<string, { qty: number; revenue: number }>()
                            stats?.recentSales?.forEach((sale: any) => {
                                sale.sale_items?.forEach((item: any) => {
                                    const name = item.product?.name || 'Producto'
                                    const existing = productMap.get(name) || { qty: 0, revenue: 0 }
                                    existing.qty += item.qty
                                    existing.revenue += item.qty * item.unit_price
                                    productMap.set(name, existing)
                                })
                            })
                            const products = Array.from(productMap.entries())
                                .map(([name, data]) => ({ name, ...data }))
                                .sort((a, b) => b.qty - a.qty)

                            if (products.length === 0) {
                                return (
                                    <div className="text-sm text-center py-10 text-muted-foreground">
                                        No hay ventas registradas hoy.
                                    </div>
                                )
                            }

                            const totalQty = products.reduce((s, p) => s + p.qty, 0)
                            const totalRevenue = products.reduce((s, p) => s + p.revenue, 0)

                            return (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b text-sm">
                                                <th className="text-left p-2 font-medium text-muted-foreground">Producto</th>
                                                <th className="text-center p-2 font-medium text-muted-foreground">Cant.</th>
                                                <th className="text-right p-2 font-medium text-muted-foreground">Ingresos</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {products.map((p) => (
                                                <tr key={p.name} className="border-b last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                    <td className="p-2">
                                                        <span className="font-medium text-sm">{p.name}</span>
                                                    </td>
                                                    <td className="p-2 text-center">
                                                        <Badge variant="secondary" className="font-mono">{p.qty}</Badge>
                                                    </td>
                                                    <td className="p-2 text-right font-medium text-sm">
                                                        ${p.revenue.toLocaleString()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-slate-50 dark:bg-slate-800/50 font-bold border-t-2">
                                            <tr>
                                                <td className="p-2 text-sm">TOTAL</td>
                                                <td className="p-2 text-center">
                                                    <Badge className="font-mono bg-emerald-600">{totalQty}</Badge>
                                                </td>
                                                <td className="p-2 text-right text-emerald-600 text-sm">
                                                    ${totalRevenue.toLocaleString()}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )
                        })()}
                    </CardContent>
                </Card>
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Alertas de Inventario</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-sm text-center py-10 text-muted-foreground">
                            {stats?.lowStockCount ? (
                                <Link href="/inventory" className="text-blue-500 hover:underline">
                                    Ver {stats.lowStockCount} items con bajo stock
                                </Link>
                            ) : (
                                "Inventario en orden."
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
