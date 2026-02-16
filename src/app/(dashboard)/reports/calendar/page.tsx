'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useMonthlyReport, useRunnerSales } from '@/hooks/use-reports'
import { useReceivables } from '@/hooks/use-sales'
import { useShiftSales, useShiftPaymentMethods, useRunnerPaymentMethods } from '@/hooks/use-sessions'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth, isSameDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { Loader2, TrendingUp, TrendingDown, DollarSign, Award, AlertTriangle, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Sun, Moon, UserCircle, Store, CheckCircle2, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

export default function CalendarReportPage() {
    const today = new Date()
    const [currentDate, setCurrentDate] = useState(today)
    const [selectedDate, setSelectedDate] = useState<Date | null>(null)

    // RPC expects 1-based month (1 = Jan, 12 = Dec)
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth() + 1

    const { data: report, isLoading } = useMonthlyReport(year, month)

    // Fetch shift sales for the entire month
    const { data: shiftSales } = useShiftSales(startOfMonth(currentDate), endOfMonth(currentDate))

    // Fetch Runner Sales
    const { data: runnerSales } = useRunnerSales(startOfMonth(currentDate), endOfMonth(currentDate))

    // Fetch Payment Breakdown (Safe separate hook)
    const { data: paymentMethods } = useShiftPaymentMethods(startOfMonth(currentDate), endOfMonth(currentDate))

    // Fetch pending receivables (credit sales not yet paid)
    const { data: receivables } = useReceivables()
    const pendingCredit = receivables?.reduce((acc: number, r: any) => acc + r.total, 0) || 0

    // Fetch Runner Payment Breakdown
    const { data: runnerPaymentMethods } = useRunnerPaymentMethods(startOfMonth(currentDate), endOfMonth(currentDate))

    const handlePrevMonth = () => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
    }

    const handleNextMonth = () => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
    }

    // Calendar Generation
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })

    // Padding for start of week (Mon = 1, Sun = 7 in ISO? getDay returns 0=Sun, 1=Mon)
    // We want Monday first.
    // getDay: 0=Sun, 1=Mon, 2=Tue...
    // Offset: Mon(1)->0, Tue(2)->1... Sun(0)->6
    const startDay = getDay(monthStart)
    const paddingDays = startDay === 0 ? 6 : startDay - 1

    const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Calendario Financiero</h2>
                    <p className="text-muted-foreground">Vista mensual de rendimiento.</p>
                </div>

                <div className="flex items-center gap-4 bg-white p-2 rounded-lg shadow-sm border">
                    <Button variant="ghost" size="icon" onClick={handlePrevMonth}>
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <div className="text-lg font-bold min-w-[150px] text-center capitalize">
                        {format(currentDate, 'MMMM yyyy', { locale: es })}
                    </div>
                    <Button variant="ghost" size="icon" onClick={handleNextMonth}>
                        <ChevronRight className="h-5 w-5" />
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-medium text-slate-500 uppercase">Ventas Totales</CardTitle>
                        <TrendingUp className="h-4 w-4 text-slate-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${(report?.summary?.total_sales || 0).toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">Facturación bruta</p>
                    </CardContent>
                </Card>

                <Card className="bg-green-50 border-green-100 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-medium text-green-700 uppercase">Dinero Recibido</CardTitle>
                        <DollarSign className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-700">
                            ${((report?.summary?.total_sales || 0) - pendingCredit).toLocaleString()}
                        </div>
                        <p className="text-xs text-green-600/80">Efectivo + Transferencias</p>
                    </CardContent>
                </Card>

                <Card className="bg-amber-50 border-amber-100 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-medium text-amber-700 uppercase">Crédito (Por Cobrar)</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-amber-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-700">
                            ${pendingCredit.toLocaleString()}
                        </div>
                        <Link href="/admin/finance/receivables" className="text-xs text-amber-700 hover:underline flex items-center gap-1 mt-1">
                            Ir a registrar pago <ArrowRight className="h-3 w-3" />
                        </Link>
                    </CardContent>
                </Card>

                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-medium text-slate-500 uppercase">Gastos</CardTitle>
                        <TrendingDown className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">${(report?.summary?.total_expenses || 0).toLocaleString()}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* CALENDAR COLUMN (Takes 2/3 space on large screens) */}
                <Card className="xl:col-span-2 shadow-md">
                    <CardHeader className="pb-4">
                        <CardTitle>Resumen Diario</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {/* Days Header */}
                        <div className="grid grid-cols-7 mb-2 text-center text-sm font-semibold text-muted-foreground">
                            {weekDays.map(d => <div key={d} className="py-2">{d}</div>)}
                        </div>

                        {/* Calendar Grid */}
                        <div className="grid grid-cols-7 gap-2">
                            {Array(paddingDays).fill(null).map((_, i) => (
                                <div key={`pad-${i}`} className="h-28 bg-slate-50/50 rounded-md border border-dashed border-slate-200" />
                            ))}

                            {daysInMonth.map(day => {
                                const dateStr = format(day, 'yyyy-MM-dd')
                                const dayStats = report?.daily_stats.find((s: any) => s.date.startsWith(dateStr))
                                const sales = dayStats?.sales || 0
                                const expenses = dayStats?.expenses || 0
                                const profit = sales - expenses

                                // Filter shifts for this day
                                const dayShifts = shiftSales?.filter(s => s.sale_date === dateStr) || []
                                const morningSales = dayShifts.find(s => s.shift_name === 'Mañana')?.total_sales || 0
                                const afternoonSales = dayShifts.find(s => s.shift_name === 'Tarde')?.total_sales || 0

                                return (
                                    <div
                                        key={dateStr}
                                        onClick={() => setSelectedDate(day)}
                                        className="min-h-[120px] border rounded-md p-2 flex flex-col justify-between hover:shadow-lg hover:border-blue-300 transition-all bg-white relative overflow-hidden group cursor-pointer"
                                    >
                                        <div className={cn("text-sm font-semibold mb-1 flex justify-between", isSameDay(day, new Date()) ? "text-blue-600" : "text-slate-500")}>
                                            <span className={cn(isSameDay(day, new Date()) && "bg-blue-100 px-1.5 rounded-full")}>
                                                {format(day, 'd')}
                                            </span>
                                            {sales > 0 && <span className="text-xs text-slate-400 font-normal">${sales.toLocaleString()}</span>}
                                        </div>

                                        {isLoading ? (
                                            <div className="space-y-1">
                                                <div className="h-3 bg-slate-100 rounded w-full animate-pulse"></div>
                                                <div className="h-3 bg-slate-100 rounded w-2/3 animate-pulse"></div>
                                            </div>
                                        ) : (
                                            <div className="space-y-1 mt-1">
                                                {/* Morning Shift */}
                                                {morningSales > 0 && (
                                                    <div className="flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 px-1 rounded border border-amber-100">
                                                        <Sun className="h-3 w-3" />
                                                        <span className="font-medium">${morningSales.toLocaleString()}</span>
                                                    </div>
                                                )}

                                                {/* Afternoon Shift */}
                                                {afternoonSales > 0 && (
                                                    <div className="flex items-center gap-1 text-[10px] bg-indigo-50 text-indigo-700 px-1 rounded border border-indigo-100">
                                                        <Moon className="h-3 w-3" />
                                                        <span className="font-medium">${afternoonSales.toLocaleString()}</span>
                                                    </div>
                                                )}

                                                {/* Expenses (if any) */}
                                                {expenses > 0 && (
                                                    <div className="text-[10px] text-red-500 text-right px-1">
                                                        -${expenses.toLocaleString()}
                                                    </div>
                                                )}

                                                {(sales === 0 && expenses === 0) && (
                                                    <div className="text-slate-300 text-[10px] text-center mt-2">-</div>
                                                )}
                                            </div>
                                        )}

                                        {/* Profit Bar */}
                                        {!isLoading && (sales > 0 || expenses > 0) && (
                                            <div className={cn("h-1 w-full absolute bottom-0 left-0", profit >= 0 ? "bg-emerald-500" : "bg-red-500")} />
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>

                {/* INSIGHTS COLUMN */}
                <div className="space-y-6">
                    {/* Summary Card */}
                    <Card className="bg-slate-900 text-white border-slate-800">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <DollarSign className={cn("h-5 w-5", (report?.summary.net_profit || 0) >= 0 ? "text-emerald-400" : "text-red-400")} />
                                Utilidad Neta
                            </CardTitle>
                            <CardDescription className="text-slate-400">Total del mes</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? <Loader2 className="animate-spin" /> : (
                                <div>
                                    <div className={cn("text-4xl font-bold mb-2", (report?.summary.net_profit || 0) >= 0 ? "text-emerald-400" : "text-red-400")}>
                                        ${(report?.summary.net_profit || 0).toLocaleString()}
                                    </div>
                                    <div className="flex justify-between text-sm text-slate-300 border-t border-slate-700 pt-3">
                                        <span>Ventas: <span className="text-emerald-400">+${(report?.summary.total_sales || 0).toLocaleString()}</span></span>
                                        <span>Gastos: <span className="text-red-400">-${(report?.summary.total_expenses || 0).toLocaleString()}</span></span>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Best Product */}
                    <Card className="border-l-4 border-l-amber-400">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Award className="h-5 w-5 text-amber-500" />
                                Producto Estrella
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : report?.insights.best_product ? (
                                <div>
                                    <div className="text-xl font-bold">{report.insights.best_product.name}</div>
                                    <div className="text-sm text-muted-foreground mt-1">
                                        Vendidos: <span className="font-medium text-slate-900">{report.insights.best_product.qty_sold}</span>
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        Ingresos: <span className="font-medium text-emerald-600">${report.insights.best_product.revenue.toLocaleString()}</span>
                                    </div>
                                </div>
                            ) : <div className="text-muted-foreground text-sm">Sin datos aún</div>}
                        </CardContent>
                    </Card>

                    {/* Worst Product */}
                    <Card className="border-l-4 border-l-slate-300">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                                <TrendingDown className="h-5 w-5 text-slate-500" />
                                Menos Vendido (con ventas)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : report?.insights.worst_product ? (
                                <div>
                                    <div className="text-xl font-bold text-slate-700">{report.insights.worst_product.name}</div>
                                    <div className="text-sm text-muted-foreground mt-1">
                                        Vendidos: <span className="font-medium text-slate-900">{report.insights.worst_product.qty_sold}</span>
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        Ingresos: <span className="font-medium text-emerald-600">${report.insights.worst_product.revenue.toLocaleString()}</span>
                                    </div>
                                </div>
                            ) : <div className="text-muted-foreground text-sm">Sin datos suficientes</div>}
                        </CardContent>
                    </Card>
                </div>
            </div>

            <DayDetailsDialog
                isOpen={!!selectedDate}
                onClose={() => setSelectedDate(null)}
                date={selectedDate}
                report={report}
                shiftSales={shiftSales}
                runnerSales={runnerSales}
                paymentMethods={paymentMethods}
                runnerPaymentMethods={runnerPaymentMethods}
            />
        </div>
    )
}

function DayDetailsDialog({ isOpen, onClose, date, report, shiftSales, runnerSales, paymentMethods, runnerPaymentMethods }: {
    isOpen: boolean
    onClose: () => void
    date: Date | null
    report: any
    shiftSales: any[] | undefined
    runnerSales: any[] | undefined
    paymentMethods: any[] | undefined
    runnerPaymentMethods: any[] | undefined
}) {
    if (!date) return null
    const dateStr = format(date, 'yyyy-MM-dd')

    // Get Shifts first
    const dayShifts = shiftSales?.filter(s => s.sale_date === dateStr) || []
    const morningShift = dayShifts.find(s => s.shift_name === 'Mañana')
    const afternoonShift = dayShifts.find(s => s.shift_name === 'Tarde')
    const morningSales = morningShift?.total_sales || 0
    const afternoonSales = afternoonShift?.total_sales || 0
    const totalShiftSales = morningSales + afternoonSales

    // Get Stats
    const dayStats = report?.daily_stats.find((s: any) => s.date.startsWith(dateStr))
    const reportSales = dayStats?.sales || 0
    const expenses = dayStats?.expenses || 0

    // Fix: If report sales is 0 but shifts have sales, use shifts
    const sales = (reportSales === 0 && totalShiftSales > 0) ? totalShiftSales : reportSales
    const profit = sales - expenses

    // Get Runners
    const dayRunners = runnerSales?.filter((r: any) => r.sale_date === dateStr) || []

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px] overflow-y-auto max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle className="text-xl flex items-center gap-2 capitalize">
                        <CalendarIcon className="h-5 w-5" />
                        {format(date, "EEEE d 'de' MMMM", { locale: es })}
                    </DialogTitle>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-3 rounded-lg border">
                            <p className="text-xs text-muted-foreground uppercase font-bold">Ventas Totales</p>
                            <p className="text-2xl font-bold text-slate-900">${sales.toLocaleString()}</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg border">
                            <p className="text-xs text-muted-foreground uppercase font-bold">Utilidad</p>
                            <p className={cn("text-2xl font-bold", profit >= 0 ? "text-emerald-600" : "text-red-600")}>
                                ${profit.toLocaleString()}
                            </p>
                        </div>
                    </div>

                    {/* Shifts Breakdown */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold border-b pb-2">Desglose por Turno</h4>

                        <div className="rounded-md border border-amber-100 bg-amber-50">
                            <div className="flex items-center justify-between p-2">
                                <div className="flex items-center gap-2">
                                    <Sun className="h-5 w-5 text-amber-500" />
                                    <div>
                                        <p className="text-sm font-medium">Turno Mañana</p>
                                        <div className="flex flex-col">
                                            <p className="text-xs text-muted-foreground">{morningShift?.transaction_count || 0} ventas</p>
                                            {morningShift?.users && morningShift.users.length > 0 && (
                                                <p className="text-[10px] text-amber-700 font-medium truncate max-w-[150px]">
                                                    {morningShift.users.join(', ')}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <p className="font-bold text-amber-900">${(morningShift?.total_sales || 0).toLocaleString()}</p>
                            </div>
                            {/* Payment Breakdown (Filtered from separate source) */}
                            {(() => {
                                const methods = paymentMethods?.filter((pm: any) => pm.sale_date === dateStr && pm.shift_name === 'Mañana') || []
                                if (methods.length === 0) return null
                                return (
                                    <div className="px-2 pb-2 pl-9">
                                        <div className="border-t border-amber-200/50 pt-1 space-y-1">
                                            {methods.map((pm: any, i: number) => (
                                                <div key={i} className="flex justify-between text-xs text-amber-800/80">
                                                    <span className="capitalize">{pm.payment_method.toLowerCase()}</span>
                                                    <span className="font-medium">${parseFloat(pm.total_amount).toLocaleString()}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )
                            })()}
                        </div>

                        <div className="rounded-md border border-indigo-100 bg-indigo-50">
                            <div className="flex items-center justify-between p-2">
                                <div className="flex items-center gap-2">
                                    <Moon className="h-5 w-5 text-indigo-500" />
                                    <div>
                                        <p className="text-sm font-medium">Turno Tarde</p>
                                        <div className="flex flex-col">
                                            <p className="text-xs text-muted-foreground">{afternoonShift?.transaction_count || 0} ventas</p>
                                            {afternoonShift?.users && afternoonShift.users.length > 0 && (
                                                <p className="text-[10px] text-indigo-600 font-medium truncate max-w-[150px]">
                                                    {afternoonShift.users.join(', ')}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <p className="font-bold text-indigo-900">${(afternoonShift?.total_sales || 0).toLocaleString()}</p>
                            </div>
                            {/* Payment Breakdown (Filtered from separate source) */}
                            {(() => {
                                const methods = paymentMethods?.filter((pm: any) => pm.sale_date === dateStr && pm.shift_name === 'Tarde') || []
                                if (methods.length === 0) return null
                                return (
                                    <div className="px-2 pb-2 pl-9">
                                        <div className="border-t border-indigo-200/50 pt-1 space-y-1">
                                            {methods.map((pm: any, i: number) => (
                                                <div key={i} className="flex justify-between text-xs text-indigo-800/80">
                                                    <span className="capitalize">{pm.payment_method.toLowerCase()}</span>
                                                    <span className="font-medium">${parseFloat(pm.total_amount).toLocaleString()}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )
                            })()}
                        </div>
                    </div>

                    {/* Runners Section */}
                    {/* Runners Section */}
                    <div className="space-y-2 mt-2 pt-2 border-t">
                        <h4 className="text-sm font-semibold text-slate-700 mb-2">Ventas por Corredor (POS)</h4>

                        {/* List Runners */}
                        {dayRunners.length > 0 ? (
                            <div className="space-y-2">
                                {dayRunners.map((runner: any, i: number) => (
                                    <div key={i} className="bg-blue-50/50 rounded border border-blue-100 mb-2 overflow-hidden">
                                        <div className="flex justify-between items-center p-2">
                                            <div className="flex items-center gap-2">
                                                <UserCircle className="h-4 w-4 text-blue-500" />
                                                <span className="text-sm font-medium">{runner.runner_name}</span>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-slate-700">${parseFloat(runner.total_sales).toLocaleString()}</p>
                                                <p className="text-[10px] text-muted-foreground">{runner.transaction_count} tickets</p>
                                            </div>
                                        </div>
                                        {/* Runner Breakdown */}
                                        {(() => {
                                            const rMethods = runnerPaymentMethods?.filter((pm: any) =>
                                                pm.sale_date === dateStr && pm.runner_name === runner.runner_name
                                            ) || []

                                            if (rMethods.length > 0) {
                                                return (
                                                    <div className="bg-white/50 px-2 pb-2 pt-1 border-t border-blue-100/50">
                                                        {rMethods.map((rpm: any, idx: number) => (
                                                            <div key={idx} className="flex justify-between text-[11px] text-slate-600">
                                                                <span>{rpm.payment_method}</span>
                                                                <span className="font-medium">${parseFloat(rpm.total_amount).toLocaleString()}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )
                                            }
                                        })()}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            dayRunners.length === 0 && (sales - dayRunners.reduce((acc: number, r: any) => acc + parseFloat(r.total_sales), 0)) <= 0 && (
                                <p className="text-sm text-muted-foreground italic text-center py-2 bg-slate-50 rounded">
                                    Sin ventas registradas en POS por corredores.
                                </p>
                            )
                        )}

                        {/* Automatic: Caja Principal (The difference) */}
                        {(sales - dayRunners.reduce((acc: number, r: any) => acc + parseFloat(r.total_sales), 0)) > 0 && (
                            <div className="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-200 mt-2">
                                <div className="flex items-center gap-2">
                                    <Store className="h-4 w-4 text-slate-500" />
                                    <span className="text-sm font-medium">Caja Principal / Punto Físico</span>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-slate-700">
                                        ${(sales - dayRunners.reduce((acc: number, r: any) => acc + parseFloat(r.total_sales), 0)).toLocaleString()}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">Ventas directas</p>
                                </div>
                            </div>
                        )}

                        <p className="text-[10px] text-muted-foreground mt-1">
                            * Solo muestra ventas registradas en la App (POS).
                        </p>
                    </div>

                    {/* Expenses Section */}
                    {expenses > 0 && (
                        <div className="space-y-2 mt-2">
                            <h4 className="text-sm font-semibold border-b pb-2 text-red-600">Gastos del Día</h4>
                            <div className="flex justify-between items-center bg-red-50 p-2 rounded-md border border-red-100">
                                <span className="text-sm text-red-700">Total Gastos</span>
                                <span className="font-bold text-red-700">-${expenses.toLocaleString()}</span>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog >
    )
}
