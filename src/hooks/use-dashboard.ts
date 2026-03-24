import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { getOrCreateProfile } from '@/lib/auth-helpers'
import { startOfDay, endOfDay, subDays } from 'date-fns'

export interface DashboardStats {
    salesToday: number
    transactionsToday: number
    topProduct: { name: string; qty: number } | null
    lowStockCount: number
    recentSales: any[]
}

export function useDashboardStats() {
    const supabase = createClient()

    return useQuery({
        queryKey: ['dashboard-stats'],
        queryFn: async (): Promise<DashboardStats> => {
            const { organization_id } = await getOrCreateProfile(supabase)
            const todayStart = startOfDay(new Date()).toISOString()
            const todayEnd = endOfDay(new Date()).toISOString()

            console.log('Fetching dashboard stats for:', todayStart, 'to', todayEnd)

            // 1. Get Sales for Today (for stats)
            const { data: todaySales, error: todayError } = await supabase
                .from('sales')
                .select('total')
                .eq('organization_id', organization_id)
                .gte('created_at', todayStart)
                .lte('created_at', todayEnd)

            if (todayError) throw todayError

            const salesToday = todaySales.reduce((acc, curr) => acc + curr.total, 0)
            const transactionsToday = todaySales.length

            // 2. Get Sales History for Logic (Top Product - maybe broaden to last 30 days for better data?)
            const thirtyDaysAgo = subDays(new Date(), 30).toISOString()
            const { data: historySales, error: historyError } = await supabase
                .from('sales')
                .select('sale_items(qty, unit_price, product:products(name))')
                .eq('organization_id', organization_id)
                .gte('created_at', thirtyDaysAgo)

            if (historyError) throw historyError

            // Calculate Top Product from last 30 days history
            const productMap = new Map<string, number>()
            historySales.forEach(sale => {
                sale.sale_items.forEach((item: any) => {
                    const name = item.product?.name || 'Unknown'
                    const qty = item.qty
                    productMap.set(name, (productMap.get(name) || 0) + qty)
                })
            })

            let topProduct = null
            let maxQty = 0
            productMap.forEach((qty, name) => {
                if (qty > maxQty) {
                    maxQty = qty
                    topProduct = { name, qty }
                }
            })

            // 3. Get Today's Sales with items (for products sold today)
            const { data: recentSales, error: recentError } = await supabase
                .from('sales')
                .select('total, created_at, id, sale_items(qty, unit_price, product:products(name))')
                .eq('organization_id', organization_id)
                .gte('created_at', todayStart)
                .lte('created_at', todayEnd)
                .order('created_at', { ascending: false })

            if (recentError) throw recentError

            // 4. Get Low Stock
            const { data: ingredients, error: stockFetchError } = await supabase
                .from('ingredients')
                .select('stock, min_stock')
                .eq('organization_id', organization_id)
            // Filter in JS to avoid Supabase 400 error on .not(null)

            if (stockFetchError) throw stockFetchError

            const actualLowStockCount = ingredients?.filter((i: any) =>
                i.min_stock !== null && i.stock <= i.min_stock
            ).length || 0

            return {
                salesToday,
                transactionsToday,
                topProduct,
                lowStockCount: actualLowStockCount,
                recentSales: recentSales || []
            }
        },
        refetchInterval: 10000 // Refresh every 10s
    })
}
