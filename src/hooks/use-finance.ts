import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { getOrCreateProfile } from '@/lib/auth-helpers'
import { startOfMonth, endOfMonth } from 'date-fns'

export interface ProfitLossReport {
    total_sales: number
    total_expenses: number
    net_profit: number
    expense_breakdown: { category: string, total: number }[]
    sales_by_method: { method: string, total: number }[]
    sales_by_runner?: { runner: string, total: number }[]
}

export function useProfitLoss(startDate: Date, endDate: Date) {
    const supabase = createClient()
    return useQuery({
        queryKey: ['profit-loss', startDate, endDate],
        queryFn: async () => {
            const { organization_id } = await getOrCreateProfile(supabase)

            const { data, error } = await supabase.rpc('get_profit_loss', {
                p_organization_id: organization_id,
                p_start_date: startDate.toISOString(),
                p_end_date: endDate.toISOString()
            })

            if (error) throw error

            // RPC returns set of rows, but since it's an aggregate we expect 1 row usually?
            // Wait, standard RPC call returns array.
            const result = Array.isArray(data) ? data[0] : data

            return result as ProfitLossReport
        }
    })
}
