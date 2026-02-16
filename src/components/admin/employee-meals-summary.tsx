'use client'

import { useState } from 'react'
import { useAllEmployeesSummary } from '@/hooks/use-employee-meals'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Calendar, UtensilsCrossed, TrendingUp, TrendingDown } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export function EmployeeMealsSummary() {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
    const { data: employeesSummary = [], isLoading } = useAllEmployeesSummary(selectedDate)

    const totalSales = employeesSummary.reduce((sum, emp) => sum + Number(emp.total_sales), 0)
    const totalMeals = employeesSummary.reduce((sum, emp) => sum + Number(emp.total_meals), 0)
    const totalNet = employeesSummary.reduce((sum, emp) => sum + Number(emp.net_amount), 0)

    return (
        <div className="space-y-6">
            {/* Header with Date Picker */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <UtensilsCrossed className="h-5 w-5" />
                        Resumen de Comidas - Empleados
                    </CardTitle>
                    <CardDescription>
                        Ventas vs Comidas consumidas por empleado
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-4 mb-6">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <Input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="max-w-xs"
                        />
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="border rounded-lg p-4">
                            <p className="text-sm text-muted-foreground mb-1">Total Ventas</p>
                            <p className="text-2xl font-bold text-green-600">{formatCurrency(totalSales)}</p>
                        </div>
                        <div className="border rounded-lg p-4">
                            <p className="text-sm text-muted-foreground mb-1">Total Comidas</p>
                            <p className="text-2xl font-bold text-red-600">{formatCurrency(totalMeals)}</p>
                        </div>
                        <div className="border rounded-lg p-4">
                            <p className="text-sm text-muted-foreground mb-1">Total Neto</p>
                            <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalNet)}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Employees Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Detalle por Empleado</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <p className="text-center text-muted-foreground py-8">Cargando...</p>
                    ) : employeesSummary.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">
                            No hay datos para esta fecha
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left p-3 font-medium">Empleado</th>
                                        <th className="text-left p-3 font-medium">Rol</th>
                                        <th className="text-right p-3 font-medium">Ventas</th>
                                        <th className="text-right p-3 font-medium">Comidas</th>
                                        <th className="text-center p-3 font-medium"># Items</th>
                                        <th className="text-right p-3 font-medium">Neto</th>
                                        <th className="text-center p-3 font-medium">Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {employeesSummary.map((employee) => {
                                        const netAmount = Number(employee.net_amount)
                                        const isPositive = netAmount >= 0

                                        return (
                                            <tr key={employee.employee_id} className="border-b hover:bg-gray-50">
                                                <td className="p-3">
                                                    <p className="font-medium">{employee.employee_name}</p>
                                                </td>
                                                <td className="p-3">
                                                    <Badge variant="outline" className="text-xs">
                                                        {employee.role}
                                                    </Badge>
                                                </td>
                                                <td className="p-3 text-right text-green-600 font-medium">
                                                    {formatCurrency(employee.total_sales)}
                                                </td>
                                                <td className="p-3 text-right text-red-600 font-medium">
                                                    {formatCurrency(employee.total_meals)}
                                                </td>
                                                <td className="p-3 text-center">
                                                    <Badge variant="secondary">
                                                        {employee.meal_count}
                                                    </Badge>
                                                </td>
                                                <td className="p-3 text-right">
                                                    <span className={`font-bold ${isPositive ? 'text-blue-600' : 'text-red-600'}`}>
                                                        {formatCurrency(netAmount)}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-center">
                                                    {isPositive ? (
                                                        <TrendingUp className="h-5 w-5 text-green-600 inline" />
                                                    ) : (
                                                        <TrendingDown className="h-5 w-5 text-red-600 inline" />
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                                <tfoot className="bg-gray-50 font-bold">
                                    <tr className="border-t-2">
                                        <td className="p-3" colSpan={2}>TOTAL</td>
                                        <td className="p-3 text-right text-green-600">
                                            {formatCurrency(totalSales)}
                                        </td>
                                        <td className="p-3 text-right text-red-600">
                                            {formatCurrency(totalMeals)}
                                        </td>
                                        <td className="p-3 text-center">
                                            {employeesSummary.reduce((sum, emp) => sum + emp.meal_count, 0)}
                                        </td>
                                        <td className="p-3 text-right text-blue-600">
                                            {formatCurrency(totalNet)}
                                        </td>
                                        <td className="p-3"></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Instructions Card */}
            <Card className="bg-blue-50 border-blue-200">
                <CardHeader>
                    <CardTitle className="text-blue-900">Cómo usar este resumen</CardTitle>
                </CardHeader>
                <CardContent className="text-blue-800">
                    <ul className="list-disc list-inside space-y-2 text-sm">
                        <li>
                            <strong>Ventas:</strong> Total vendido por el empleado en el día
                        </li>
                        <li>
                            <strong>Comidas:</strong> Valor total de productos consumidos
                        </li>
                        <li>
                            <strong>Neto:</strong> Ventas - Comidas = Monto a pagar
                        </li>
                        <li>
                            Ejemplo: Si Juan vendió $60.000 pero comió $8.000, le pagas $52.000
                        </li>
                    </ul>
                </CardContent>
            </Card>
        </div>
    )
}
