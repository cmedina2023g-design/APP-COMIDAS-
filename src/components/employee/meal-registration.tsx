'use client'

import { useState } from 'react'
import { useRecordMeal, useEmployeeMealsToday, useDeleteMeal } from '@/hooks/use-employee-meals'
import { useProducts } from '@/hooks/use-products'
import { useProfiles } from '@/hooks/use-profiles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Utensils, Trash2, Plus, Minus, User } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export function MealRegistration() {
    const [selectedEmployee, setSelectedEmployee] = useState<string>('')
    const [selectedProduct, setSelectedProduct] = useState<string>('')
    const [quantity, setQuantity] = useState(1)
    const [searchQuery, setSearchQuery] = useState('')

    const { data: products = [] } = useProducts()
    const { data: profiles = [] } = useProfiles()
    const { data: todayMeals = [] } = useEmployeeMealsToday(selectedEmployee)
    const recordMeal = useRecordMeal()
    const deleteMeal = useDeleteMeal()

    // Filter profiles to show only active employees (SELLER and RUNNER)
    const employees = profiles.filter(p => p.active && (p.role === 'SELLER' || p.role === 'RUNNER' || p.role === 'ADMIN'))

    const filteredProducts = products.filter((p: any) =>
        p.active && p.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const handleAddMeal = () => {
        if (!selectedEmployee || !selectedProduct || quantity < 1) {
            return
        }

        recordMeal.mutate({
            employee_id: selectedEmployee,
            product_id: selectedProduct,
            quantity: quantity
        }, {
            onSuccess: () => {
                setSelectedProduct('')
                setQuantity(1)
                setSearchQuery('')
            }
        })
    }

    const handleDelete = (mealId: string) => {
        if (confirm('¿Eliminar esta comida?')) {
            deleteMeal.mutate(mealId)
        }
    }

    const totalValue = todayMeals.reduce((sum, meal) => sum + Number(meal.total_value), 0)
    const selectedEmployeeName = employees.find(e => e.id === selectedEmployee)?.full_name || 'Selecciona empleado'

    return (
        <div className="space-y-6">
            {/* Employee Selector */}
            <Card className="border-2 border-orange-200">
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <User className="h-5 w-5 text-orange-500" />
                        ¿Quién eres?
                    </CardTitle>
                    <CardDescription>
                        Selecciona tu nombre antes de registrar una comida
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Selecciona tu nombre..." />
                        </SelectTrigger>
                        <SelectContent>
                            {employees.map((emp) => (
                                <SelectItem key={emp.id} value={emp.id}>
                                    {emp.full_name || 'Sin nombre'} ({emp.role})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>

            {/* Meal Registration - Only show when employee is selected */}
            {selectedEmployee && (
                <>
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Utensils className="h-5 w-5" />
                                Registrar Comida - {selectedEmployeeName}
                            </CardTitle>
                            <CardDescription>
                                Busca y selecciona lo que consumiste
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium mb-2 block">Buscar Producto</label>
                                    <Input
                                        placeholder="Buscar..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>

                                <div className="max-h-[300px] overflow-y-auto border rounded-lg p-2">
                                    <div className="grid grid-cols-1 gap-2">
                                        {filteredProducts.map((product: any) => (
                                            <button
                                                key={product.id}
                                                onClick={() => setSelectedProduct(product.id)}
                                                className={`p-3 rounded-lg border text-left transition-colors ${selectedProduct === product.id
                                                    ? 'border-orange-500 bg-orange-50'
                                                    : 'border-gray-200 hover:bg-gray-50'
                                                    }`}
                                            >
                                                <div className="flex justify-between items-center">
                                                    <span className="font-medium">{product.name}</span>
                                                    <Badge variant="outline">{formatCurrency(product.price)}</Badge>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {selectedProduct && (
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2">
                                            <Button
                                                size="icon"
                                                variant="outline"
                                                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                            >
                                                <Minus className="h-4 w-4" />
                                            </Button>
                                            <span className="font-bold text-lg w-12 text-center">{quantity}</span>
                                            <Button
                                                size="icon"
                                                variant="outline"
                                                onClick={() => setQuantity(quantity + 1)}
                                            >
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <Button
                                            onClick={handleAddMeal}
                                            disabled={recordMeal.isPending}
                                            className="flex-1 bg-orange-500 hover:bg-orange-600"
                                        >
                                            Registrar Comida
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Today's Meals List */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex justify-between items-center">
                                <span>Comidas de Hoy</span>
                                <Badge variant="secondary" className="text-lg">
                                    Total: {formatCurrency(totalValue)}
                                </Badge>
                            </CardTitle>
                            <CardDescription>
                                Registro de {selectedEmployeeName} para hoy
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {todayMeals.length === 0 ? (
                                <p className="text-center text-muted-foreground py-8">
                                    No hay comidas registradas hoy
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {todayMeals.map((meal) => (
                                        <div
                                            key={meal.id}
                                            className="flex items-center justify-between p-3 border rounded-lg"
                                        >
                                            <div className="flex-1">
                                                <p className="font-medium">{meal.product?.name}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {meal.quantity}x {formatCurrency(meal.unit_price)} = {formatCurrency(meal.total_value)}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {new Date(meal.consumed_at).toLocaleTimeString('es-ES', {
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </p>
                                            </div>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                onClick={() => handleDelete(meal.id)}
                                                disabled={deleteMeal.isPending}
                                            >
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    )
}
