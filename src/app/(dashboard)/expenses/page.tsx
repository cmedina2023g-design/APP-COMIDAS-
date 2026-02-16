'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useExpenses, useCreateGeneralExpense, useCreateInventoryPurchase, useDeleteExpense } from '@/hooks/use-expenses'
import { useIngredients } from '@/hooks/use-inventory'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Loader2, DollarSign, PackagePlus, Calendar as CalendarIcon, Trash2 } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'

export default function ExpensesPage() {
    // FIX HYDRATION: Initialize with undefined, set to Date on mount
    const [date, setDate] = useState<Date | undefined>(undefined)

    useEffect(() => {
        setDate(new Date())
    }, [])

    const { data: expenses, isLoading: loadingExpenses, error: expensesError } = useExpenses(date)
    const { data: ingredients } = useIngredients()

    // Mutations
    const createGeneral = useCreateGeneralExpense()
    const createPurchase = useCreateInventoryPurchase()
    const deleteExpense = useDeleteExpense()

    // Forms State
    const [desc, setDesc] = useState('')
    const [amount, setAmount] = useState('')

    const [ingId, setIngId] = useState('')
    const [qty, setQty] = useState('')
    const [totalPrice, setTotalPrice] = useState('')

    const handleGeneralSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!desc || !amount || !date) return

        await createGeneral.mutateAsync({
            description: desc,
            amount: parseFloat(amount),
            date: date
        })
        setDesc('')
        setAmount('')
    }

    const handlePurchaseSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!ingId || !qty || !totalPrice) return

        await createPurchase.mutateAsync({
            ingredient_id: ingId,
            qty: parseFloat(qty),
            total_price: parseFloat(totalPrice),
            description: `Compra: ${ingredients?.find(i => i.id === ingId)?.name}`
        })
        setIngId('')
        setQty('')
        setTotalPrice('')
    }

    const handleDelete = async (id: string) => {
        if (confirm('¿Estás seguro? Si es una compra de inventario, se descontará del stock.')) {
            await deleteExpense.mutateAsync(id)
        }
    }

    // While hydrating/loading date, show skeleton or just render layout without specific date data
    if (!date) {
        return <div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Gastos y Compras</h2>
                    <p className="text-muted-foreground">Administra los gastos del día.</p>
                </div>

                {/* Date Picker */}
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className={cn(
                                "w-[240px] justify-start text-left font-normal",
                                !date && "text-muted-foreground"
                            )}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {date ? format(date, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                        <Calendar
                            mode="single"
                            selected={date}
                            onSelect={(d) => d && setDate(d)}
                            initialFocus
                        />
                    </PopoverContent>
                </Popover>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Forms Column */}
                <Card>
                    <CardHeader>
                        <CardTitle>Registrar Nuevo ({format(date, 'dd/MM/yyyy')})</CardTitle>
                        <CardDescription>Los gastos quedarán registrados en la fecha seleccionada.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue="general" className="w-full">
                            <TabsList className="grid w-full grid-cols-2 mb-4">
                                <TabsTrigger value="general">Gasto General</TabsTrigger>
                                <TabsTrigger value="inventory">Compra Inventario</TabsTrigger>
                            </TabsList>

                            {/* General Expense Form */}
                            <TabsContent value="general">
                                <form onSubmit={handleGeneralSubmit} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Descripción</Label>
                                        <Input
                                            placeholder="Ej: Turno María, Pago Luz..."
                                            value={desc}
                                            onChange={e => setDesc(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Valor ($)</Label>
                                        <div className="relative">
                                            <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                type="number"
                                                className="pl-9"
                                                placeholder="0.00"
                                                value={amount}
                                                onChange={e => setAmount(e.target.value)}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <Button type="submit" className="w-full" disabled={createGeneral.isPending}>
                                        {createGeneral.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Registrar Gasto
                                    </Button>
                                </form>
                            </TabsContent>

                            {/* Inventory Purchase Form */}
                            <TabsContent value="inventory">
                                <form onSubmit={handlePurchaseSubmit} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Insumo / Ingrediente</Label>
                                        <Select value={ingId} onValueChange={setIngId}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccionar insumo..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {ingredients?.map(ing => (
                                                    <SelectItem key={ing.id} value={ing.id}>
                                                        {ing.name} (Actual: {ing.stock} {ing.unit})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Cantidad Comprada</Label>
                                            <Input
                                                type="number"
                                                placeholder="Ej: 10"
                                                value={qty}
                                                onChange={e => setQty(e.target.value)}
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Costo Total ($)</Label>
                                            <Input
                                                type="number"
                                                placeholder="Ej: 20000"
                                                value={totalPrice}
                                                onChange={e => setTotalPrice(e.target.value)}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="p-3 bg-blue-50 text-blue-800 text-sm rounded-md flex items-start gap-2">
                                        <PackagePlus className="h-5 w-5 shrink-0" />
                                        <span>
                                            Al registrar, se aumentará el stock del ingrediente automáticamente.
                                        </span>
                                    </div>
                                    <Button type="submit" className="w-full" disabled={createPurchase.isPending}>
                                        {createPurchase.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Registrar Compra e Inventario
                                    </Button>
                                </form>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>

                {/* History Column */}
                <Card className="h-fit">
                    <CardHeader>
                        <CardTitle>Historial del {format(date, 'dd/MM/yyyy')}</CardTitle>
                        <CardDescription>
                            Total Gastado: <span className="font-bold text-red-600">
                                ${expenses?.reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()}
                            </span>
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loadingExpenses ? (
                            <div className="text-center py-8">Cargando...</div>
                        ) : expensesError ? (
                            <div className="text-center py-8 text-red-500">
                                <p>Error al cargar gastos</p>
                                <p className="text-xs text-muted-foreground mt-1">{(expensesError as any).message}</p>
                            </div>
                        ) : expenses?.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">No hay gastos registrados para este día.</div>
                        ) : (
                            <div className="space-y-4">
                                {expenses?.map((expense) => (
                                    <div key={expense.id} className="flex justify-between items-center border-b pb-4 last:border-0 last:pb-0">
                                        <div>
                                            <p className="font-medium">{expense.description}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {format(new Date(expense.date), 'HH:mm')} •
                                                <span className={expense.category === 'INVENTORY' ? 'text-blue-600 ml-1' : 'text-slate-600 ml-1'}>
                                                    {expense.category === 'INVENTORY' ? 'Inventario' : 'General'}
                                                </span>
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="font-bold text-red-600">
                                                - ${expense.amount.toLocaleString()}
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-red-400 hover:text-red-700 hover:bg-red-50"
                                                onClick={() => handleDelete(expense.id)}
                                                disabled={deleteExpense.isPending}
                                            >
                                                {deleteExpense.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
