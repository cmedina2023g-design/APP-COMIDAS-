import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { getOrCreateProfile } from '@/lib/auth-helpers'

export type MonthlyReport = {
    daily_stats: {
        date: string
        sales: number
        expenses: number
        profit: number
    }[]
    summary: {
        total_sales: number
        total_expenses: number
        net_profit: number
    }
    insights: {
        best_product: {
            name: string
            qty_sold: number
            revenue: number
        } | null
        worst_product: {
            name: string
            qty_sold: number
            revenue: number
        } | null
    }
}

export function useMonthlyReport(year: number, month: number) {
    const supabase = createClient()

    return useQuery({
        queryKey: ['monthly-report', year, month],
        queryFn: async () => {
            const { organization_id } = await getOrCreateProfile(supabase)

            const { data, error } = await supabase.rpc('get_monthly_report', {
                p_organization_id: organization_id,
                p_year: year,
                p_month: month // 1-12
            })

            if (error) throw error
            return data as MonthlyReport
        }
    })
}

export type RunnerSale = {
    sale_date: string
    runner_id: string
    runner_name: string
    total_sales: number
    transaction_count: number
}

export function useRunnerSales(startDate: Date, endDate: Date) {
    const supabase = createClient()

    // Format dates YYYY-MM-DD (RPC expects DATE type)
    const startStr = startDate.toISOString().split('T')[0]
    const endStr = endDate.toISOString().split('T')[0]

    return useQuery({
        queryKey: ['runner-sales', startStr, endStr],
        queryFn: async () => {
            const { organization_id } = await getOrCreateProfile(supabase)
            const { data, error } = await supabase.rpc('get_runner_sales_by_period', {
                p_organization_id: organization_id,
                p_start_date: startStr,
                p_end_date: endStr
            })
            if (error) throw error
            return data as RunnerSale[]
        }
    })
}

// ==================== RUNNER SALE DETAILS ====================

export type RunnerSaleDetail = {
    id: string
    created_at: string
    total: number
    payment_method: string
    items: {
        product_name: string
        qty: number
        unit_price: number
        subtotal: number
        modifiers: string[]
    }[]
}

export function useRunnerSaleDetails(sellerId: string | null, startDate: Date, endDate: Date) {
    const supabase = createClient()

    return useQuery({
        queryKey: ['runner-sale-details', sellerId, startDate.toISOString(), endDate.toISOString()],
        enabled: !!sellerId,
        queryFn: async () => {
            if (!sellerId) return []

            const { data, error } = await supabase
                .from('sales')
                .select(`
                    id,
                    created_at,
                    total,
                    sale_payments(
                        amount,
                        payment_method:payment_methods!payment_method_id(name)
                    ),
                    sale_items(
                        qty,
                        unit_price,
                        subtotal,
                        product:products!product_id(name),
                        sale_item_modifiers(modifier_name)
                    )
                `)
                .eq('seller_id', sellerId)
                .eq('status', 'CONFIRMED')
                .gte('created_at', startDate.toISOString())
                .lte('created_at', endDate.toISOString())
                .order('created_at', { ascending: false })

            if (error) throw error

            return (data || []).map((sale: any) => ({
                id: sale.id,
                created_at: sale.created_at,
                total: sale.total,
                payment_method: sale.sale_payments
                    ?.map((sp: any) => sp.payment_method?.name)
                    .filter(Boolean)
                    .join(' + ') || 'Desconocido',
                items: sale.sale_items?.map((item: any) => ({
                    product_name: item.product?.name || 'Producto',
                    qty: item.qty,
                    unit_price: item.unit_price,
                    subtotal: item.subtotal,
                    modifiers: item.sale_item_modifiers?.map((m: any) => m.modifier_name) || []
                })) || []
            })) as RunnerSaleDetail[]
        }
    })
}
