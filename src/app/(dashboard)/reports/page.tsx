'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FinanceDashboard } from '@/components/admin/finance-dashboard'

export default function ReportsPage() {
    const supabase = createClient()

    const { data: sales, isLoading } = useQuery({
        queryKey: ['sales-report'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('sales')
                .select('*')
                .order('created_at', { ascending: false })
                // Limit for demo
                .limit(100)

            if (error) throw error
            return data
        }
    })

    // Group by date
    const chartData = sales?.reduce((acc: any[], sale) => {
        const date = format(new Date(sale.created_at), 'dd/MM')
        const existing = acc.find(i => i.date === date)
        if (existing) {
            existing.total += sale.total
        } else {
            acc.push({ date, total: sale.total })
        }
        return acc
    }, []).reverse() // Show oldest to newest

    const totalSales = sales?.reduce((acc, sale) => acc + sale.total, 0) || 0
    const countSales = sales?.length || 0

    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold tracking-tight">Reportes y Finanzas</h2>

            <Tabs defaultValue="overview" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="overview">Resumen de Ventas</TabsTrigger>
                    <TabsTrigger value="finance">Finanzas (KPIs)</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">Ventas Totales (Muestra)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">${totalSales.toLocaleString()}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">Transacciones</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{countSales}</div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="col-span-4">
                        <CardHeader>
                            <CardTitle>Comportamiento de Ventas</CardTitle>
                        </CardHeader>
                        <CardContent className="pl-2">
                            <div className="h-[300px] w-full">
                                {isLoading ? (
                                    <div className="flex h-full items-center justify-center">Cargando datos...</div>
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="date" />
                                            <YAxis />
                                            <Tooltip />
                                            <Bar dataKey="total" fill="#ea580c" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="finance">
                    <FinanceDashboard />
                </TabsContent>
            </Tabs>
        </div>
    )
}
