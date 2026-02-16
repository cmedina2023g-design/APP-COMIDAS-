'use client'

import React, { useState } from 'react'
import { useProfitLoss } from '@/hooks/use-finance'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { Calendar as CalendarIcon, DollarSign, TrendingUp, TrendingDown, ArrowDown } from 'lucide-react'
import Link from 'next/link'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'

export function FinanceDashboard() {
    const [date, setDate] = useState<{ from: Date; to: Date }>({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date())
    })

    const { data: report, isLoading } = useProfitLoss(date.from, date.to)

    // Colors for charts
    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d']

    const formatCurrency = (val: number) => {
        return val.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
    }

    // Prepare data for charts
    const expenseData = report?.expense_breakdown.map((item) => ({
        name: item.category || 'Sin Categoría',
        value: Number(item.total)
    })) || []

    const paymentData = report?.sales_by_method.map((item) => ({
        name: item.method,
        value: Number(item.total)
    })) || []

    const runnerData = report?.sales_by_runner?.map((item) => {
        // Shorten name: First name + First Last name initial
        const nameParts = (item.runner || 'Sin Asignar').split(' ')
        const shortName = nameParts.length > 1
            ? `${nameParts[0]} ${nameParts[1].charAt(0)}.`
            : nameParts[0]

        return {
            name: shortName,
            fullName: item.runner,
            value: Number(item.total)
        }
    }) || []


    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Finanzas y Utilidades</h2>
                    <p className="text-muted-foreground">Analiza la rentabilidad del negocio.</p>
                </div>

                <div className="flex items-center gap-2">
                    <Link href="/admin/finance/receivables">
                        <Button variant="secondary" className="gap-2">
                            <DollarSign className="h-4 w-4" />
                            Ver Cartera
                        </Button>
                    </Link>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                id="date"
                                variant={"outline"}
                                className={cn(
                                    "w-[300px] justify-start text-left font-normal",
                                    !date && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {date?.from ? (
                                    date.to ? (
                                        <>
                                            {format(date.from, "LLL dd, y", { locale: es })} -{" "}
                                            {format(date.to, "LLL dd, y", { locale: es })}
                                        </>
                                    ) : (
                                        format(date.from, "LLL dd, y", { locale: es })
                                    )
                                ) : (
                                    <span>Selecciona fecha</span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                            <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={date?.from}
                                selected={date}
                                onSelect={(val: any) => val && setDate(val)}
                                numberOfMonths={2}
                            />
                        </PopoverContent>
                    </Popover>
                    <Button variant="outline" onClick={() => setDate({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) })}>
                        Este Mes
                    </Button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ventas Totales</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">
                            {isLoading ? '...' : formatCurrency(report?.total_sales || 0)}
                        </div>
                        <p className="text-xs text-muted-foreground">Ingresos confirmados en el periodo</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Gastos Totales</CardTitle>
                        <ArrowDown className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">
                            {isLoading ? '...' : formatCurrency(report?.total_expenses || 0)}
                        </div>
                        <p className="text-xs text-muted-foreground">Operativos + Inventario</p>
                    </CardContent>
                </Card>
                <Card className={report && report.net_profit >= 0 ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Utilidad Neta</CardTitle>
                        {report && report.net_profit >= 0 ? (
                            <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : (
                            <TrendingDown className="h-4 w-4 text-red-600" />
                        )}
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${report && report.net_profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                            {isLoading ? '...' : formatCurrency(report?.net_profit || 0)}
                        </div>
                        <p className="text-xs text-muted-foreground">Rentabilidad real (Cash Flow)</p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Section */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                {/* Sale Methods Chart */}
                <Card className="col-span-4 lg:col-span-3">
                    <CardHeader>
                        <CardTitle>Ventas por Método de Pago</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        {isLoading ? (
                            <div className="h-full flex items-center justify-center">Cargando...</div>
                        ) : paymentData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={paymentData} layout="vertical" margin={{ left: 40 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" hide />
                                    <YAxis type="category" dataKey="name" width={100} />
                                    <RechartsTooltip formatter={(val: number) => formatCurrency(val)} />
                                    <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={30} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground">No hay datos</div>
                        )}
                    </CardContent>
                </Card>

                {/* Runner Sales Chart (New) */}
                <Card className="col-span-4 lg:col-span-4">
                    <CardHeader>
                        <CardTitle>Rendimiento por Personal</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        {isLoading ? (
                            <div className="h-full flex items-center justify-center">Cargando...</div>
                        ) : runnerData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={runnerData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <RechartsTooltip formatter={(val: number) => formatCurrency(val)} />
                                    <Bar dataKey="value" fill="#8884d8" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground">No hay datos de personal</div>
                        )}
                    </CardContent>
                </Card>

                {/* Expense Breakdown Chart */}
                <Card className="col-span-4 lg:col-span-7">
                    <CardHeader>
                        <CardTitle>Desglose de Gastos</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        {isLoading ? (
                            <div className="h-full flex items-center justify-center">Cargando...</div>
                        ) : expenseData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={expenseData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        dataKey="value"
                                    >
                                        {expenseData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip formatter={(val: number) => formatCurrency(val)} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground">No hay gastos en este periodo</div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
