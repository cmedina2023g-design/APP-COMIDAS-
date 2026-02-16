import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { CartItem } from '@/lib/store/cart'

export function usePaymentMethods() {
    const supabase = createClient()
    return useQuery({
        queryKey: ['payment_methods'],
        queryFn: async () => {
            const { data, error } = await supabase.from('payment_methods').select('*').eq('active', true)
            if (error) throw error
            return data
        }
    })
}

import { getOrCreateProfile } from '@/lib/auth-helpers'

export function useCreateSale() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({
            total,
            payments,
            items
        }: {
            total: number
            payments: { methodId: string, amount: number }[]
            items: CartItem[]
        }) => {
            const { user, organization_id } = await getOrCreateProfile(supabase)

            // Prepare items payload
            const payloadItems = items.map(i => ({
                product_id: i.id,
                qty: i.qty,
                unit_price: i.price
            }))

            // Prepare payments payload
            const payloadPayments = payments.map(p => ({
                payment_method_id: p.methodId,
                amount: p.amount
            }))

            const { data, error } = await supabase.rpc('create_sale', {
                p_organization_id: organization_id,
                p_seller_id: user.id,
                p_payments: payloadPayments,
                p_total: total,
                p_items: payloadItems
            })

            if (error) throw error
            return data // Returns Sale ID
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sales'] })
            queryClient.invalidateQueries({ queryKey: ['products'] })
            queryClient.invalidateQueries({ queryKey: ['ingredients'] })
            queryClient.invalidateQueries({ queryKey: ['daily-product-summary'] })
            queryClient.invalidateQueries({ queryKey: ['shift-sales'] })
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
        },
        onError: (err: any) => {
            toast.error('Error al procesar venta', { description: err.message })
        }
    })
}

import { startOfDay, endOfDay, format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'

export function useDailyProductSummary() {
    const supabase = createClient()
    return useQuery({
        queryKey: ['daily-product-summary'],
        queryFn: async () => {
            const { organization_id } = await getOrCreateProfile(supabase)

            // Use Colombia timezone
            const timezone = 'America/Bogota'
            const now = new Date()
            const todayStart = startOfDay(toZonedTime(now, timezone)).toISOString()
            const todayEnd = endOfDay(toZonedTime(now, timezone)).toISOString()

            // Fetch sale items with timestamps
            const { data, error } = await supabase
                .from('sale_items')
                .select(`
                    qty,
                    product:products(name),
                    sale:sales!inner(
                        id,
                        created_at, 
                        organization_id, 
                        payment_method:payment_methods(name),
                        sale_payments(payment_method:payment_methods(name))
                    )
                `)
                .eq('sale.organization_id', organization_id)
                .gte('sale.created_at', todayStart)
                .lte('sale.created_at', todayEnd)

            if (error) throw error

            // Return individual items with time and payment method in Colombia timezone
            const items = data.map((item: any) => {
                const saleDate = toZonedTime(new Date(item.sale.created_at), timezone)

                // Get payment method - check sale_payments first (for split payments), then legacy payment_method_id
                let paymentMethodName = 'N/A'

                if (item.sale.sale_payments && item.sale.sale_payments.length > 0) {
                    // Split payment - show all payment methods
                    const methods = item.sale.sale_payments
                        .map((sp: any) => sp.payment_method?.name)
                        .filter(Boolean)
                    paymentMethodName = methods.length > 0 ? methods.join(' + ') : 'N/A'
                } else if (item.sale.payment_method?.name) {
                    // Legacy single payment
                    paymentMethodName = item.sale.payment_method.name
                }

                return {
                    name: item.product?.name || 'Desconocido',
                    qty: item.qty,
                    time: format(saleDate, 'HH:mm'),
                    paymentMethod: paymentMethodName
                }
            })

            // Sort by most recent first
            return items.sort((a: any, b: any) => {
                const timeA = a.time.replace(':', '')
                const timeB = b.time.replace(':', '')
                return timeB.localeCompare(timeA)
            })
        },
        refetchInterval: 30000 // Auto refresh every 30s
    })
}

export function useReceivables() {
    const supabase = createClient()
    return useQuery({
        queryKey: ['receivables'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('sales')
                .select(`
                    *,
                    seller:profiles!seller_id(full_name),
                    payment_method:payment_methods!payment_method_id(name)
                `)
                .eq('payment_status', 'PENDING')
                .eq('status', 'CONFIRMED')
                .order('created_at', { ascending: false })

            if (error) throw error
            return data
        }
    })
}

export function useMarkSaleAsPaid() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ saleId, paymentMethodId }: { saleId: string, paymentMethodId?: string }) => {
            const { data, error } = await supabase.rpc('mark_sale_as_paid', {
                p_sale_id: saleId,
                p_payment_method_id: paymentMethodId || null
            })

            if (error) {
                console.error('Error registrando pago:', error.message)
                throw error
            }
            return data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['receivables'] })
            queryClient.invalidateQueries({ queryKey: ['shift-payment-methods'] })
            queryClient.invalidateQueries({ queryKey: ['monthly-report'] })
            toast.success('Pago registrado exitosamente')
        }
    })
}
