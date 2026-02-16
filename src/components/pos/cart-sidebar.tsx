'use client'

import React, { useState } from 'react'
import { useCartStore } from '@/lib/store/cart'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Trash2, Plus, Minus, Loader2, ShoppingBag, CheckCircle2, Edit2, Check } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { usePaymentMethods, useCreateSale } from '@/hooks/use-sales'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'

export function CartSidebar() {
    const { items, total, clearCart } = useCartStore()
    const { data: paymentMethods } = usePaymentMethods()
    const createSaleMutation = useCreateSale()

    const [payments, setPayments] = useState<{ methodId: string, amount: number }[]>([])
    const [successData, setSuccessData] = useState<{ id: string, total: number } | null>(null)

    const totalAmount = total()
    const paidAmount = payments.reduce((sum, p) => sum + p.amount, 0)
    const remainingAmount = totalAmount - paidAmount

    const handleAddPayment = (methodId: string) => {
        // Add a new payment with the remaining amount as default
        setPayments([...payments, { methodId, amount: remainingAmount }])
    }

    const handleUpdatePayment = (index: number, amount: number) => {
        const newPayments = [...payments]
        newPayments[index].amount = amount
        setPayments(newPayments)
    }

    const handleRemovePayment = (index: number) => {
        setPayments(payments.filter((_, i) => i !== index))
    }

    const handleCheckout = async () => {
        if (remainingAmount !== 0) {
            toast.error('El total de pagos debe ser igual al total de la venta')
            return
        }
        if (payments.length === 0) {
            toast.error('Agrega al menos un método de pago')
            return
        }
        if (items.length === 0) return

        try {
            const saleId = await createSaleMutation.mutateAsync({
                total: totalAmount,
                payments: payments,
                items
            })

            setSuccessData({ id: saleId, total: totalAmount })
            clearCart()
            setPayments([]) // Clear payments
        } catch (e) {
            // Handled
        }
    }

    const handleNewSale = () => {
        setSuccessData(null)
    }

    if (successData) {
        return (
            <Card className="h-full flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in">
                <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
                <h2 className="text-2xl font-bold mb-2">¡Venta Exitosa!</h2>
                <p className="text-muted-foreground mb-6">Total: ${successData.total.toLocaleString()}</p>
                <Button className="w-full" size="lg" onClick={handleNewSale}>Nueva Venta</Button>
            </Card>
        )
    }

    return (
        <Card className="h-full flex flex-col border-l rounded-none md:rounded-lg shadow-lg">
            <CardHeader className="pb-2">
                <CardTitle className="flex justify-between items-center">
                    <span>Orden Actual</span>
                    <span className="text-sm font-normal text-muted-foreground">{items.length} items</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto px-2">
                {items.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-muted-foreground text-sm flex-col">
                        <ShoppingBag className="h-10 w-10 mb-2 opacity-20" />
                        No hay productos
                    </div>
                ) : (
                    <div className="space-y-3">
                        {items.map(item => (
                            <CartItemRow key={item.id} item={item} />
                        ))}
                    </div>
                )}
            </CardContent>
            <Separator />
            <CardFooter className="flex flex-col gap-4 p-4 bg-slate-50/50">
                <div className="w-full space-y-2">
                    <div className="flex justify-between text-lg font-bold">
                        <span>Total</span>
                        <span>${totalAmount.toLocaleString()}</span>
                    </div>
                </div>

                <div className="w-full">
                    <p className="text-sm font-medium mb-2">Métodos de Pago</p>

                    {/* Payment breakdown list */}
                    {payments.length > 0 && (
                        <div className="space-y-2 mb-3">
                            {payments.map((payment, index) => {
                                const method = paymentMethods?.find((pm: any) => pm.id === payment.methodId)
                                return (
                                    <div key={index} className="flex gap-2 items-center bg-white p-2 rounded-lg border">
                                        <span className="text-sm font-semibold flex-1">{method?.name}</span>
                                        <Input
                                            type="number"
                                            className="w-24 h-8"
                                            value={payment.amount}
                                            onChange={(e) => handleUpdatePayment(index, Number(e.target.value))}
                                        />
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleRemovePayment(index)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* Remaining amount indicator */}
                    {payments.length > 0 && (
                        <div className={`flex justify-between text-sm font-bold mb-3 p-2 rounded-lg ${remainingAmount === 0 ? 'bg-green-50 text-green-700' :
                            remainingAmount > 0 ? 'bg-orange-50 text-orange-700' : 'bg-red-50 text-red-700'
                            }`}>
                            <span>Restante</span>
                            <span>${remainingAmount.toLocaleString()}</span>
                        </div>
                    )}

                    {/* Add payment buttons */}
                    <div className="grid grid-cols-2 gap-2">
                        {paymentMethods?.map((pm: any) => (
                            <Button
                                key={pm.id}
                                variant="outline"
                                className="h-10 text-sm"
                                onClick={() => handleAddPayment(pm.id)}
                                disabled={remainingAmount <= 0}
                            >
                                + {pm.name}
                            </Button>
                        ))}
                    </div>
                </div>

                <Button
                    className="w-full bg-green-600 hover:bg-green-700 text-lg py-6"
                    disabled={items.length === 0 || remainingAmount !== 0 || payments.length === 0 || createSaleMutation.isPending}
                    onClick={handleCheckout}
                >
                    {createSaleMutation.isPending ? (
                        <Loader2 className="animate-spin h-6 w-6" />
                    ) : (
                        'Cobrar'
                    )}
                </Button>
            </CardFooter>
        </Card>
    )
}

function CartItemRow({ item }: { item: any }) {
    const { updateQty, updatePrice } = useCartStore()
    const [isEditingPrice, setIsEditingPrice] = useState(false)
    const [priceInput, setPriceInput] = useState(item.price.toString())

    const handleSavePrice = () => {
        const newPrice = Number(priceInput)
        if (!isNaN(newPrice) && newPrice >= 0) {
            updatePrice(item.id, newPrice)
            setIsEditingPrice(false)
        }
    }

    return (
        <div className="flex gap-2 items-start bg-slate-50 p-2 rounded-lg">
            <div className="flex-1">
                <p className="font-medium text-sm leading-tight">{item.name}</p>

                <Popover open={isEditingPrice} onOpenChange={setIsEditingPrice}>
                    <PopoverTrigger asChild>
                        <button className="text-xs text-muted-foreground flex items-center gap-1 hover:text-blue-600 transition-colors mt-1" onClick={() => setPriceInput(item.price.toString())}>
                            ${item.price.toLocaleString()} <Edit2 className="h-3 w-3 opacity-50" />
                        </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-2" align="start">
                        <div className="flex gap-2">
                            <Input
                                type="number"
                                value={priceInput}
                                onChange={(e) => setPriceInput(e.target.value)}
                                className="h-8"
                                min="0"
                                autoFocus
                            />
                            <Button size="icon" className="h-8 w-8 flex-shrink-0" onClick={handleSavePrice}>
                                <Check className="h-4 w-4" />
                            </Button>
                        </div>
                    </PopoverContent>
                </Popover>

            </div>
            <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2 bg-white rounded-md border shadow-sm">
                    <button className="p-1 hover:bg-slate-100" onClick={() => updateQty(item.id, item.qty - 1)}><Minus className="h-3 w-3" /></button>
                    <span className="text-sm w-4 text-center font-bold">{item.qty}</span>
                    <button className="p-1 hover:bg-slate-100" onClick={() => updateQty(item.id, item.qty + 1)}><Plus className="h-3 w-3" /></button>
                </div>
                <div className="text-sm font-bold">
                    ${(item.price * item.qty).toLocaleString()}
                </div>
            </div>
        </div>
    )
}
