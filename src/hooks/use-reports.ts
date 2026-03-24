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
